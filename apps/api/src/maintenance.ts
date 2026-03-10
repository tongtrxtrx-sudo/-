import { deleteBuffer } from "./storage.js";
import { getSpaceQuotaSummary, pool } from "./db.js";

type SpaceType = "PERSONAL" | "DEPARTMENT" | "PUBLIC_KNOWLEDGE";

interface RecycleCandidate {
  entryId: string;
  targetType: "FOLDER" | "FILE";
  spaceId: string;
  spaceType: SpaceType;
  originalName: string;
  deletedAt: string;
}

interface VersionCandidate {
  versionId: string;
  fileId: string;
  spaceId: string;
  spaceType: SpaceType;
  versionNumber: number;
  originalName: string;
  createdAt: string;
}

function recycleRetentionDays(spaceType: SpaceType): number {
  switch (spaceType) {
    case "PERSONAL":
      return 30;
    case "DEPARTMENT":
      return 60;
    case "PUBLIC_KNOWLEDGE":
      return 90;
  }
}

function versionRetentionPolicy(spaceType: SpaceType): {
  maxVersions: number;
  maxAgeDays: number;
} {
  switch (spaceType) {
    case "PERSONAL":
      return { maxVersions: 20, maxAgeDays: 90 };
    case "DEPARTMENT":
      return { maxVersions: 50, maxAgeDays: 180 };
    case "PUBLIC_KNOWLEDGE":
      return { maxVersions: 100, maxAgeDays: 365 };
  }
}

export async function listExpiredRecycleCandidates(now = new Date()): Promise<RecycleCandidate[]> {
  const result = await pool.query<{
    entry_id: string;
    target_type: "FOLDER" | "FILE";
    space_id: string;
    space_type: SpaceType;
    original_name: string;
    deleted_at: string;
  }>(
    `SELECT re.id AS entry_id, re.target_type, re.space_id, s.type AS space_type, re.original_name, re.deleted_at::text
     FROM recycle_entries re
     JOIN spaces s ON s.id = re.space_id`
  );

  return result.rows.filter((row) => {
    const ageMs = now.getTime() - new Date(row.deleted_at).getTime();
    return ageMs >= recycleRetentionDays(row.space_type) * 24 * 60 * 60 * 1000;
  }).map((row) => ({
    entryId: row.entry_id,
    targetType: row.target_type,
    spaceId: row.space_id,
    spaceType: row.space_type,
    originalName: row.original_name,
    deletedAt: row.deleted_at
  }));
}

export async function listPrunableVersionCandidates(now = new Date()): Promise<VersionCandidate[]> {
  const result = await pool.query<{
    version_id: string;
    file_id: string;
    space_id: string;
    space_type: SpaceType;
    version_number: number;
    original_name: string;
    created_at: string;
    storage_key: string;
    current_storage_key: string;
  }>(
    `SELECT v.id AS version_id,
            v.file_id,
            f.space_id,
            s.type AS space_type,
            v.version_number,
            v.original_name,
            v.created_at::text,
            v.storage_key,
            f.storage_key AS current_storage_key
     FROM file_versions v
     JOIN files f ON f.id = v.file_id
     JOIN spaces s ON s.id = f.space_id
     ORDER BY v.file_id ASC, v.version_number DESC`
  );

  const grouped = new Map<string, typeof result.rows>();
  for (const row of result.rows) {
    const bucket = grouped.get(row.file_id) ?? [];
    bucket.push(row);
    grouped.set(row.file_id, bucket);
  }

  const candidates: VersionCandidate[] = [];
  for (const rows of grouped.values()) {
    const firstRow = rows[0];
    if (!firstRow) {
      continue;
    }
    rows.sort((left, right) => right.version_number - left.version_number);
    const spaceType = firstRow.space_type;
    const policy = versionRetentionPolicy(spaceType);

    rows.forEach((row, index) => {
      const isCurrent = row.storage_key === row.current_storage_key;
      if (isCurrent) {
        return;
      }

      const ageMs = now.getTime() - new Date(row.created_at).getTime();
      const beyondAge = ageMs >= policy.maxAgeDays * 24 * 60 * 60 * 1000;
      const beyondCount = index >= policy.maxVersions;

      if (beyondAge || beyondCount) {
        candidates.push({
          versionId: row.version_id,
          fileId: row.file_id,
          spaceId: row.space_id,
          spaceType,
          versionNumber: row.version_number,
          originalName: row.original_name,
          createdAt: row.created_at
        });
      }
    });
  }

  return candidates;
}

export async function refreshAllQuotaSummaries(): Promise<Awaited<ReturnType<typeof getSpaceQuotaSummary>>[]> {
  const result = await pool.query<{ id: string }>(
    `SELECT id
     FROM spaces
     ORDER BY type ASC, name ASC`
  );

  const summaries = [];
  for (const row of result.rows) {
    summaries.push(await getSpaceQuotaSummary(row.id));
  }
  return summaries;
}

export async function runRetentionJob(input: {
  job: "recycle_cleanup" | "version_prune" | "quota_refresh" | "all";
  dryRun: boolean;
}): Promise<{
  recycleCandidates: RecycleCandidate[];
  versionCandidates: VersionCandidate[];
  quotaSummaries: Awaited<ReturnType<typeof getSpaceQuotaSummary>>[];
}> {
  const recycleCandidates =
    input.job === "recycle_cleanup" || input.job === "all"
      ? await listExpiredRecycleCandidates()
      : [];

  const versionCandidates =
    input.job === "version_prune" || input.job === "all"
      ? await listPrunableVersionCandidates()
      : [];

  const quotaSummaries =
    input.job === "quota_refresh" || input.job === "all"
      ? await refreshAllQuotaSummaries()
      : [];

  if (!input.dryRun && (input.job === "version_prune" || input.job === "all")) {
    for (const candidate of versionCandidates) {
      const lookup = await pool.query<{ storage_key: string }>(
        `SELECT storage_key
         FROM file_versions
         WHERE id = $1`,
        [candidate.versionId]
      );
      const storageKey = lookup.rows[0]?.storage_key;

      await pool.query(
        `DELETE FROM file_versions
         WHERE id = $1`,
        [candidate.versionId]
      );

      if (storageKey) {
        const refs = await pool.query<{ count: string }>(
          `SELECT COUNT(*)::text AS count
           FROM (
             SELECT storage_key
             FROM files
             WHERE storage_key = $1
             UNION ALL
             SELECT storage_key
             FROM file_versions
             WHERE storage_key = $1
           ) refs`,
          [storageKey]
        );
        if (Number(refs.rows[0]?.count ?? "0") === 0) {
          await deleteBuffer(storageKey);
        }
      }
    }
  }

  return {
    recycleCandidates,
    versionCandidates,
    quotaSummaries
  };
}

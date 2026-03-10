import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { hashSync } from "bcryptjs";
import type {
  AccessLevel,
  AuditEventSummary,
  DepartmentSummary,
  FileSummary,
  SpaceQuotaSummary,
  FileVersionSummary,
  FolderKind,
  FolderSummary,
  KnowledgeEntrySummary,
  PermissionGrantSummary,
  RecycleEntrySummary,
  SpaceSummary,
  UserSummary
} from "@my-project/domain";
import { env } from "./config.js";
import type {
  AuditRecord,
  DepartmentRecord,
  FileLockRecord,
  FileRecord,
  FileVersionRecord,
  KnowledgeEntryRecord,
  SpaceQuotaRecord,
  FolderRecord,
  PermissionGrantRecord,
  RecycleEntryRecord,
  SpaceRecord,
  UserRecord
} from "./types.js";

const departmentRootFolders: Array<{ name: string; kind: FolderKind }> = [
  { name: "Collaboration Area", kind: "DEPARTMENT_COLLABORATION" },
  { name: "Publishing Area", kind: "DEPARTMENT_PUBLISHING" },
  { name: "Archive Area", kind: "DEPARTMENT_ARCHIVE" }
];

const knowledgeBaseCategories: Array<{ name: string; kind: FolderKind }> = [
  { name: "Policies and Procedures", kind: "KNOWLEDGE_CATEGORY" },
  { name: "Templates and Forms", kind: "KNOWLEDGE_CATEGORY" },
  { name: "Training Materials", kind: "KNOWLEDGE_CATEGORY" },
  { name: "Product Materials", kind: "KNOWLEDGE_CATEGORY" },
  { name: "Project Cases", kind: "KNOWLEDGE_CATEGORY" },
  { name: "FAQs", kind: "KNOWLEDGE_CATEGORY" }
];

export const pool = new Pool({
  connectionString: env.DATABASE_URL
});

const schemaSql = `
CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL,
  department_id TEXT NULL REFERENCES departments(id) ON DELETE SET NULL,
  password_hash TEXT NOT NULL,
  account_state TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS spaces (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  owner_user_id TEXT NULL REFERENCES users(id) ON DELETE CASCADE,
  owner_department_id TEXT NULL REFERENCES departments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  parent_folder_id TEXT NULL REFERENCES folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  folder_kind TEXT NOT NULL,
  created_by_user_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  deleted_by_user_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  folder_id TEXT NULL REFERENCES folders(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  created_by_user_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  updated_by_user_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  deleted_by_user_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS file_versions (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  storage_key TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_by_user_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (file_id, version_number)
);

CREATE TABLE IF NOT EXISTS file_locks (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL UNIQUE REFERENCES files(id) ON DELETE CASCADE,
  locked_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS space_quotas (
  space_id TEXT PRIMARY KEY REFERENCES spaces(id) ON DELETE CASCADE,
  limit_bytes BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recycle_entries (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  original_parent_folder_id TEXT NULL,
  original_folder_id TEXT NULL,
  original_name TEXT NOT NULL,
  deleted_by_user_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (target_type, target_id)
);

CREATE TABLE IF NOT EXISTS knowledge_entries (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL UNIQUE REFERENCES files(id) ON DELETE CASCADE,
  category_folder_id TEXT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  owner_department_id TEXT NULL REFERENCES departments(id) ON DELETE SET NULL,
  maintainer_user_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL,
  effective_date DATE NULL,
  published_by_user_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS permission_grants (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  grantee_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_level TEXT NOT NULL,
  granted_by_user_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (target_type, target_id, grantee_user_id)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE folders ADD COLUMN IF NOT EXISTS deleted_by_user_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE folders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;
ALTER TABLE files ADD COLUMN IF NOT EXISTS deleted_by_user_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE files ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;
`;

type UserRow = {
  id: string;
  username: string;
  display_name: string;
  role: UserRecord["role"];
  department_id: string | null;
  password_hash: string;
  account_state: UserRecord["accountState"];
};

type DepartmentRow = {
  id: string;
  name: string;
  code: string;
};

type SpaceRow = {
  id: string;
  name: string;
  type: SpaceRecord["type"];
  owner_user_id: string | null;
  owner_department_id: string | null;
};

type FolderRow = {
  id: string;
  space_id: string;
  parent_folder_id: string | null;
  name: string;
  folder_kind: FolderRecord["folderKind"];
  created_by_user_id: string | null;
  deleted_by_user_id: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

type FileRow = {
  id: string;
  space_id: string;
  folder_id: string | null;
  name: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  storage_key: string;
  created_by_user_id: string | null;
  updated_by_user_id: string | null;
  deleted_by_user_id: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

type PermissionGrantRow = {
  id: string;
  target_type: PermissionGrantRecord["targetType"];
  target_id: string;
  grantee_user_id: string;
  access_level: AccessLevel;
  granted_by_user_id: string | null;
  created_at: string;
};

type FileVersionRow = {
  id: string;
  file_id: string;
  version_number: number;
  storage_key: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  created_by_user_id: string | null;
  reason: string;
  created_at: string;
};

type FileLockRow = {
  id: string;
  file_id: string;
  locked_by_user_id: string;
  created_at: string;
  expires_at: string;
};

type RecycleEntryRow = {
  id: string;
  target_type: "FOLDER" | "FILE";
  target_id: string;
  space_id: string;
  original_parent_folder_id: string | null;
  original_folder_id: string | null;
  original_name: string;
  deleted_by_user_id: string | null;
  deleted_at: string;
};

type AuditRow = {
  id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

type SpaceQuotaRow = {
  space_id: string;
  limit_bytes: string | number;
};

type KnowledgeEntryRow = {
  id: string;
  file_id: string;
  category_folder_id: string;
  category_name: string;
  owner_department_id: string | null;
  maintainer_user_id: string | null;
  status: KnowledgeEntryRecord["status"];
  effective_date: string | null;
  published_by_user_id: string | null;
  published_at: string | null;
};

function mapUser(row: UserRow): UserRecord {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    departmentId: row.department_id,
    passwordHash: row.password_hash,
    accountState: row.account_state
  };
}

function mapDepartment(row: DepartmentRow): DepartmentRecord {
  return {
    id: row.id,
    name: row.name,
    code: row.code
  };
}

function mapSpace(row: SpaceRow): SpaceRecord {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    ownerUserId: row.owner_user_id,
    ownerDepartmentId: row.owner_department_id,
    manageable: false
  };
}

function mapFolder(row: FolderRow): FolderRecord {
  return {
    id: row.id,
    spaceId: row.space_id,
    parentFolderId: row.parent_folder_id,
    name: row.name,
    folderKind: row.folder_kind,
    createdByUserId: row.created_by_user_id,
    deletedByUserId: row.deleted_by_user_id,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapFile(row: FileRow): FileRecord {
  return {
    id: row.id,
    spaceId: row.space_id,
    folderId: row.folder_id,
    name: row.name,
    originalName: row.original_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    storageKey: row.storage_key,
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
    deletedByUserId: row.deleted_by_user_id,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapPermissionGrant(row: PermissionGrantRow): PermissionGrantRecord {
  return {
    id: row.id,
    targetType: row.target_type,
    targetId: row.target_id,
    granteeUserId: row.grantee_user_id,
    accessLevel: row.access_level,
    grantedByUserId: row.granted_by_user_id,
    createdAt: row.created_at
  };
}

function mapRecycleEntry(row: RecycleEntryRow): RecycleEntryRecord {
  return {
    id: row.id,
    targetType: row.target_type,
    targetId: row.target_id,
    spaceId: row.space_id,
    originalParentFolderId: row.original_parent_folder_id,
    originalFolderId: row.original_folder_id,
    originalName: row.original_name,
    deletedByUserId: row.deleted_by_user_id,
    deletedAt: row.deleted_at
  };
}

function mapFileVersion(row: FileVersionRow, currentStorageKey: string): FileVersionRecord {
  return {
    id: row.id,
    fileId: row.file_id,
    versionNumber: row.version_number,
    storageKey: row.storage_key,
    originalName: row.original_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    createdByUserId: row.created_by_user_id,
    reason: row.reason,
    createdAt: row.created_at,
    isCurrent: row.storage_key === currentStorageKey
  };
}

function mapAudit(row: AuditRow): AuditRecord {
  return {
    id: row.id,
    actorUserId: row.actor_user_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    details: row.details,
    createdAt: row.created_at
  };
}

function mapSpaceQuota(row: SpaceQuotaRow, usage: {
  activeFileBytes: number;
  recycleBinBytes: number;
  versionSnapshotBytes: number;
  occupiedBytes: number;
}): SpaceQuotaRecord {
  const limitBytes = Number(row.limit_bytes);
  return {
    spaceId: row.space_id,
    limitBytes,
    activeFileBytes: usage.activeFileBytes,
    recycleBinBytes: usage.recycleBinBytes,
    versionSnapshotBytes: usage.versionSnapshotBytes,
    occupiedBytes: usage.occupiedBytes,
    usageRatio: limitBytes === 0 ? 0 : usage.occupiedBytes / limitBytes
  };
}

function mapFileLock(row: FileLockRow): FileLockRecord {
  return {
    id: row.id,
    fileId: row.file_id,
    lockedByUserId: row.locked_by_user_id,
    createdAt: row.created_at,
    expiresAt: row.expires_at
  };
}

function mapKnowledgeEntry(row: KnowledgeEntryRow): KnowledgeEntryRecord {
  return {
    id: row.id,
    fileId: row.file_id,
    categoryFolderId: row.category_folder_id,
    categoryName: row.category_name,
    ownerDepartmentId: row.owner_department_id,
    maintainerUserId: row.maintainer_user_id,
    status: row.status,
    effectiveDate: row.effective_date,
    publishedByUserId: row.published_by_user_id,
    publishedAt: row.published_at
  };
}

function requireFirstRow<T>(rows: T[], message: string): T {
  const row = rows[0];
  if (!row) {
    throw new Error(message);
  }
  return row;
}

function defaultQuotaBytesForSpaceType(type: SpaceRecord["type"]): number {
  const gib = 1024 * 1024 * 1024;
  switch (type) {
    case "PERSONAL":
      return 10 * gib;
    case "DEPARTMENT":
      return 50 * gib;
    case "PUBLIC_KNOWLEDGE":
      return 200 * gib;
  }
}

function toUserSummary(user: UserRecord): UserSummary {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    accountState: user.accountState,
    departmentId: user.departmentId
  };
}

export async function bootstrapDatabase(): Promise<void> {
  await pool.query(schemaSql);
  await ensurePublicKnowledgeSpace();
  await ensureInitialSuperAdmin();
  await ensureDefaultSpaceQuotas();
}

async function ensurePublicKnowledgeSpace(): Promise<void> {
  const result = await pool.query<SpaceRow>(
    "SELECT id, name, type, owner_user_id, owner_department_id FROM spaces WHERE type = 'PUBLIC_KNOWLEDGE' LIMIT 1"
  );

  if (result.rowCount && result.rowCount > 0) {
    await ensureKnowledgeBaseCategories(requireFirstRow(result.rows, "Public knowledge space not found.").id);
    return;
  }

  const inserted = await pool.query<SpaceRow>(
    `INSERT INTO spaces (id, type, name, owner_user_id, owner_department_id)
     VALUES ($1, 'PUBLIC_KNOWLEDGE', $2, NULL, NULL)
     RETURNING id, name, type, owner_user_id, owner_department_id`,
    [randomUUID(), env.PUBLIC_KNOWLEDGE_SPACE_NAME]
  );
  await ensureSpaceQuota(requireFirstRow(inserted.rows, "Failed to create public knowledge space."));
  await ensureKnowledgeBaseCategories(requireFirstRow(inserted.rows, "Failed to create public knowledge space.").id);
}

async function ensureInitialSuperAdmin(): Promise<void> {
  const existing = await findUserByUsername(env.INITIAL_SUPER_ADMIN_USERNAME);
  if (existing) {
    return;
  }

  const id = randomUUID();
  await pool.query(
    `INSERT INTO users (id, username, display_name, role, department_id, password_hash, account_state)
     VALUES ($1, $2, $3, 'SUPER_ADMIN', NULL, $4, 'INITIAL_PASSWORD_REQUIRED')`,
    [
      id,
      env.INITIAL_SUPER_ADMIN_USERNAME,
      "Initial Super Admin",
      hashSync(env.INITIAL_SUPER_ADMIN_PASSWORD, 10)
    ]
  );
  await createPersonalSpace(id, "Initial Super Admin");
  await createAuditEvent({
    actorUserId: id,
    action: "seed_super_admin",
    entityType: "user",
    entityId: id,
    details: {
      username: env.INITIAL_SUPER_ADMIN_USERNAME
    }
  });
}

async function createPersonalSpace(userId: string, displayName: string): Promise<void> {
  const existing = await pool.query(
    "SELECT id FROM spaces WHERE type = 'PERSONAL' AND owner_user_id = $1 LIMIT 1",
    [userId]
  );
  if (existing.rowCount && existing.rowCount > 0) {
    return;
  }

  const inserted = await pool.query<SpaceRow>(
    `INSERT INTO spaces (id, type, name, owner_user_id, owner_department_id)
     VALUES ($1, 'PERSONAL', $2, $3, NULL)
     RETURNING id, name, type, owner_user_id, owner_department_id`,
    [randomUUID(), `${displayName} Personal Space`, userId]
  );
  await ensureSpaceQuota(requireFirstRow(inserted.rows, "Failed to create personal space."));
}

async function createDepartmentSpace(departmentId: string, departmentName: string): Promise<void> {
  const existing = await pool.query<SpaceRow>(
    `SELECT id, name, type, owner_user_id, owner_department_id
     FROM spaces
     WHERE type = 'DEPARTMENT' AND owner_department_id = $1
     LIMIT 1`,
    [departmentId]
  );

  if (existing.rowCount && existing.rowCount > 0) {
    await ensureDepartmentRootFolders(requireFirstRow(existing.rows, "Department space not found.").id);
    return;
  }

  const inserted = await pool.query<SpaceRow>(
    `INSERT INTO spaces (id, type, name, owner_user_id, owner_department_id)
     VALUES ($1, 'DEPARTMENT', $2, NULL, $3)
     RETURNING id, name, type, owner_user_id, owner_department_id`,
    [randomUUID(), `${departmentName} Department Space`, departmentId]
  );
  await ensureSpaceQuota(requireFirstRow(inserted.rows, "Failed to create department space."));
  await ensureDepartmentRootFolders(requireFirstRow(inserted.rows, "Failed to create department space.").id);
}

async function ensureDefaultSpaceQuotas(): Promise<void> {
  const result = await pool.query<SpaceRow>(
    `SELECT id, name, type, owner_user_id, owner_department_id
     FROM spaces`
  );

  for (const row of result.rows) {
    await ensureSpaceQuota(row);
  }
}

async function ensureSpaceQuota(space: SpaceRow): Promise<void> {
  await pool.query(
    `INSERT INTO space_quotas (space_id, limit_bytes)
     VALUES ($1, $2)
     ON CONFLICT (space_id) DO NOTHING`,
    [space.id, defaultQuotaBytesForSpaceType(space.type)]
  );
}

async function ensureDepartmentRootFolders(spaceId: string): Promise<void> {
  for (const folder of departmentRootFolders) {
    const existing = await pool.query(
      `SELECT id
       FROM folders
       WHERE space_id = $1 AND parent_folder_id IS NULL AND name = $2
       LIMIT 1`,
      [spaceId, folder.name]
    );
    if (existing.rowCount && existing.rowCount > 0) {
      continue;
    }

    await pool.query(
      `INSERT INTO folders (id, space_id, parent_folder_id, name, folder_kind, created_by_user_id)
       VALUES ($1, $2, NULL, $3, $4, NULL)`,
      [randomUUID(), spaceId, folder.name, folder.kind]
    );
  }
}

async function ensureKnowledgeBaseCategories(spaceId: string): Promise<void> {
  for (const folder of knowledgeBaseCategories) {
    const existing = await pool.query(
      `SELECT id
       FROM folders
       WHERE space_id = $1 AND parent_folder_id IS NULL AND name = $2
       LIMIT 1`,
      [spaceId, folder.name]
    );
    if (existing.rowCount && existing.rowCount > 0) {
      continue;
    }

    await pool.query(
      `INSERT INTO folders (id, space_id, parent_folder_id, name, folder_kind, created_by_user_id)
       VALUES ($1, $2, NULL, $3, $4, NULL)`,
      [randomUUID(), spaceId, folder.name, folder.kind]
    );
  }
}

export async function createAuditEvent(input: {
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  details: Record<string, unknown>;
}): Promise<void> {
  await pool.query(
    `INSERT INTO audit_events (id, actor_user_id, action, entity_type, entity_id, details)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [
      randomUUID(),
      input.actorUserId,
      input.action,
      input.entityType,
      input.entityId,
      JSON.stringify(input.details)
    ]
  );
}

export async function findUserByUsername(username: string): Promise<UserRecord | null> {
  const result = await pool.query<UserRow>(
    `SELECT id, username, display_name, role, department_id, password_hash, account_state
     FROM users
     WHERE username = $1`,
    [username]
  );
  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  const result = await pool.query<UserRow>(
    `SELECT id, username, display_name, role, department_id, password_hash, account_state
     FROM users
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function listUsers(): Promise<UserSummary[]> {
  const result = await pool.query<UserRow>(
    `SELECT id, username, display_name, role, department_id, password_hash, account_state
     FROM users
     ORDER BY username ASC`
  );
  return result.rows.map((row) => toUserSummary(mapUser(row)));
}

export async function createDepartment(name: string, code: string): Promise<DepartmentSummary> {
  const result = await pool.query<DepartmentRow>(
    `INSERT INTO departments (id, name, code)
     VALUES ($1, $2, $3)
     RETURNING id, name, code`,
    [randomUUID(), name, code]
  );
  const department = mapDepartment(requireFirstRow(result.rows, "Failed to create department."));
  await createDepartmentSpace(department.id, department.name);
  return department;
}

export async function listDepartments(): Promise<DepartmentSummary[]> {
  const result = await pool.query<DepartmentRow>(
    "SELECT id, name, code FROM departments ORDER BY name ASC"
  );
  return result.rows.map(mapDepartment);
}

export async function findPublicKnowledgeSpace(): Promise<SpaceSummary> {
  const result = await pool.query<SpaceRow>(
    `SELECT id, name, type, owner_user_id, owner_department_id
     FROM spaces
     WHERE type = 'PUBLIC_KNOWLEDGE'
     LIMIT 1`
  );
  return mapSpace(requireFirstRow(result.rows, "Public knowledge space not found."));
}

export async function listPublicKnowledgeCategories(): Promise<FolderSummary[]> {
  const space = await findPublicKnowledgeSpace();
  const result = await pool.query<FolderRow>(
    `SELECT id, space_id, parent_folder_id, name, folder_kind, created_by_user_id, deleted_by_user_id, deleted_at::text, created_at::text, updated_at::text
     FROM folders
     WHERE space_id = $1
       AND parent_folder_id IS NULL
       AND folder_kind = 'KNOWLEDGE_CATEGORY'
       AND deleted_at IS NULL
     ORDER BY name ASC`,
    [space.id]
  );
  return result.rows.map(mapFolder);
}

export async function createUser(input: {
  username: string;
  displayName: string;
  role: UserRecord["role"];
  departmentId: string | null;
  passwordHash: string;
}): Promise<UserSummary> {
  const result = await pool.query<UserRow>(
    `INSERT INTO users (id, username, display_name, role, department_id, password_hash, account_state)
     VALUES ($1, $2, $3, $4, $5, $6, 'INITIAL_PASSWORD_REQUIRED')
     RETURNING id, username, display_name, role, department_id, password_hash, account_state`,
    [
      randomUUID(),
      input.username,
      input.displayName,
      input.role,
      input.departmentId,
      input.passwordHash
    ]
  );
  const user = mapUser(requireFirstRow(result.rows, "Failed to create user."));
  await createPersonalSpace(user.id, user.displayName);
  return toUserSummary(user);
}

export async function resetUserPassword(userId: string, passwordHash: string): Promise<UserSummary | null> {
  const result = await pool.query<UserRow>(
    `UPDATE users
     SET password_hash = $2, account_state = 'INITIAL_PASSWORD_REQUIRED', updated_at = NOW()
     WHERE id = $1
     RETURNING id, username, display_name, role, department_id, password_hash, account_state`,
    [userId, passwordHash]
  );
  return result.rows[0] ? toUserSummary(mapUser(result.rows[0])) : null;
}

export async function updateUserPassword(userId: string, passwordHash: string): Promise<UserSummary | null> {
  const result = await pool.query<UserRow>(
    `UPDATE users
     SET password_hash = $2, account_state = 'ACTIVE', updated_at = NOW()
     WHERE id = $1
     RETURNING id, username, display_name, role, department_id, password_hash, account_state`,
    [userId, passwordHash]
  );
  return result.rows[0] ? toUserSummary(mapUser(result.rows[0])) : null;
}

export async function findSpaceById(spaceId: string): Promise<SpaceRecord | null> {
  const result = await pool.query<SpaceRow>(
    `SELECT id, name, type, owner_user_id, owner_department_id
     FROM spaces
     WHERE id = $1`,
    [spaceId]
  );
  return result.rows[0] ? mapSpace(result.rows[0]) : null;
}

export async function findFolderById(folderId: string, options?: {
  includeDeleted?: boolean;
}): Promise<FolderRecord | null> {
  const result = await pool.query<FolderRow>(
    `SELECT id, space_id, parent_folder_id, name, folder_kind, created_by_user_id, deleted_by_user_id, deleted_at::text, created_at::text, updated_at::text
     FROM folders
     WHERE id = $1
       AND ($2::boolean OR deleted_at IS NULL)`,
    [folderId, options?.includeDeleted ?? false]
  );
  return result.rows[0] ? mapFolder(result.rows[0]) : null;
}

export async function findFileById(fileId: string, options?: {
  includeDeleted?: boolean;
}): Promise<FileRecord | null> {
  const result = await pool.query<FileRow>(
    `SELECT id, space_id, folder_id, name, original_name, mime_type, size_bytes, storage_key, created_by_user_id, updated_by_user_id, deleted_by_user_id, deleted_at::text, created_at::text, updated_at::text
     FROM files
     WHERE id = $1
       AND ($2::boolean OR deleted_at IS NULL)`,
    [fileId, options?.includeDeleted ?? false]
  );
  return result.rows[0] ? mapFile(result.rows[0]) : null;
}

export async function findPermissionGrantById(grantId: string): Promise<PermissionGrantSummary | null> {
  const result = await pool.query<PermissionGrantRow>(
    `SELECT id, target_type, target_id, grantee_user_id, access_level, granted_by_user_id, created_at::text
     FROM permission_grants
     WHERE id = $1`,
    [grantId]
  );
  return result.rows[0] ? mapPermissionGrant(result.rows[0]) : null;
}

export async function listAccessibleSpaces(user: UserRecord): Promise<SpaceSummary[]> {
  const grantedSpaceIds = await listGrantedSpaceIdsForUser(user.id);

  const parameters: Array<string | string[]> = [user.id, grantedSpaceIds];
  let query = `
    SELECT DISTINCT s.id, s.name, s.type, s.owner_user_id, s.owner_department_id
    FROM spaces s
    WHERE (
      s.owner_user_id = $1
      OR s.type = 'PUBLIC_KNOWLEDGE'
      OR s.id = ANY($2::text[])
    )
  `;

  if (user.role === "SUPER_ADMIN") {
    query = `
      SELECT DISTINCT s.id, s.name, s.type, s.owner_user_id, s.owner_department_id
      FROM spaces s
      WHERE (
        s.owner_user_id = $1
        OR s.type IN ('DEPARTMENT', 'PUBLIC_KNOWLEDGE')
        OR s.id = ANY($2::text[])
      )
    `;
  } else if (user.departmentId) {
    parameters.push(user.departmentId);
    query += " OR s.owner_department_id = $3";
  }

  query += " ORDER BY s.type ASC, s.name ASC";

  const result = await pool.query<SpaceRow>(query, parameters);
  return result.rows.map((row) => {
    const space = mapSpace(row);
    return {
      ...space,
      manageable: isUserSpaceManager(user, space)
    };
  });
}

async function listGrantedSpaceIdsForUser(userId: string): Promise<string[]> {
  const result = await pool.query<{ space_id: string }>(
    `SELECT DISTINCT space_id
     FROM (
       SELECT target_id AS space_id
       FROM permission_grants
       WHERE grantee_user_id = $1 AND target_type = 'SPACE'

       UNION

       SELECT folders.space_id
       FROM permission_grants
       JOIN folders ON permission_grants.target_id = folders.id
       WHERE permission_grants.grantee_user_id = $1 AND permission_grants.target_type = 'FOLDER'

       UNION

       SELECT files.space_id
       FROM permission_grants
       JOIN files ON permission_grants.target_id = files.id
       WHERE permission_grants.grantee_user_id = $1 AND permission_grants.target_type = 'FILE'
     ) granted_spaces`,
    [userId]
  );
  return result.rows.map((row) => row.space_id);
}

function isUserSpaceManager(user: UserRecord | UserSummary, space: SpaceRecord | SpaceSummary): boolean {
  if (space.type === "PERSONAL") {
    return space.ownerUserId === user.id;
  }
  if (space.type === "DEPARTMENT") {
    return user.role === "SUPER_ADMIN" || (user.role === "DEPARTMENT_MANAGER" && user.departmentId === space.ownerDepartmentId);
  }
  return user.role === "SUPER_ADMIN";
}

export async function listFolderContents(input: {
  spaceId: string;
  parentFolderId: string | null;
}): Promise<{
  folders: FolderSummary[];
  files: FileSummary[];
}> {
  const foldersResult = await pool.query<FolderRow>(
    `SELECT id, space_id, parent_folder_id, name, folder_kind, created_by_user_id, deleted_by_user_id, deleted_at::text, created_at::text, updated_at::text
     FROM folders
     WHERE space_id = $1 AND parent_folder_id IS NOT DISTINCT FROM $2
       AND deleted_at IS NULL
     ORDER BY name ASC`,
    [input.spaceId, input.parentFolderId]
  );

  const filesResult = await pool.query<FileRow>(
    `SELECT id, space_id, folder_id, name, original_name, mime_type, size_bytes, storage_key, created_by_user_id, updated_by_user_id, deleted_by_user_id, deleted_at::text, created_at::text, updated_at::text
     FROM files
     WHERE space_id = $1 AND folder_id IS NOT DISTINCT FROM $2
       AND deleted_at IS NULL
     ORDER BY name ASC`,
    [input.spaceId, input.parentFolderId]
  );

  return {
    folders: foldersResult.rows.map(mapFolder),
    files: filesResult.rows.map(mapFile)
  };
}

export async function listDirectoryUsers(input?: {
  excludeUserId?: string;
}): Promise<UserSummary[]> {
  const result = await pool.query<UserRow>(
    `SELECT id, username, display_name, role, department_id, password_hash, account_state
     FROM users
     WHERE account_state != 'DISABLED'
     ORDER BY display_name ASC, username ASC`
  );

  return result.rows
    .map((row) => toUserSummary(mapUser(row)))
    .filter((user) => user.id !== input?.excludeUserId);
}

export async function createFolderRecord(input: {
  spaceId: string;
  parentFolderId: string | null;
  name: string;
  folderKind?: FolderKind;
  createdByUserId: string | null;
}): Promise<FolderSummary> {
  const duplicate = await pool.query(
    `SELECT id
     FROM folders
     WHERE space_id = $1 AND parent_folder_id IS NOT DISTINCT FROM $2 AND name = $3
     LIMIT 1`,
    [input.spaceId, input.parentFolderId, input.name]
  );
  if (duplicate.rowCount && duplicate.rowCount > 0) {
    throw new Error("A folder with the same name already exists in this location.");
  }

  const result = await pool.query<FolderRow>(
    `INSERT INTO folders (id, space_id, parent_folder_id, name, folder_kind, created_by_user_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, space_id, parent_folder_id, name, folder_kind, created_by_user_id, created_at::text, updated_at::text`,
    [
      randomUUID(),
      input.spaceId,
      input.parentFolderId,
      input.name,
      input.folderKind ?? "STANDARD",
      input.createdByUserId
    ]
  );
  return mapFolder(requireFirstRow(result.rows, "Failed to create folder."));
}

export async function renameFolderRecord(folderId: string, name: string): Promise<FolderSummary> {
  const folder = await findFolderById(folderId);
  if (!folder) {
    throw new Error("Folder not found.");
  }

  const duplicate = await pool.query(
    `SELECT id
     FROM folders
     WHERE space_id = $1
       AND parent_folder_id IS NOT DISTINCT FROM $2
       AND name = $3
       AND id != $4
     LIMIT 1`,
    [folder.spaceId, folder.parentFolderId, name, folder.id]
  );
  if (duplicate.rowCount && duplicate.rowCount > 0) {
    throw new Error("A folder with the same name already exists in this location.");
  }

  const result = await pool.query<FolderRow>(
    `UPDATE folders
     SET name = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING id, space_id, parent_folder_id, name, folder_kind, created_by_user_id, created_at::text, updated_at::text`,
    [folderId, name]
  );
  return mapFolder(requireFirstRow(result.rows, "Failed to rename folder."));
}

export async function moveFolderRecord(folderId: string, parentFolderId: string | null): Promise<FolderSummary> {
  const folder = await findFolderById(folderId);
  if (!folder) {
    throw new Error("Folder not found.");
  }

  const duplicate = await pool.query(
    `SELECT id
     FROM folders
     WHERE space_id = $1
       AND parent_folder_id IS NOT DISTINCT FROM $2
       AND name = $3
       AND id != $4
     LIMIT 1`,
    [folder.spaceId, parentFolderId, folder.name, folder.id]
  );
  if (duplicate.rowCount && duplicate.rowCount > 0) {
    throw new Error("A folder with the same name already exists in the target location.");
  }

  const result = await pool.query<FolderRow>(
    `UPDATE folders
     SET parent_folder_id = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING id, space_id, parent_folder_id, name, folder_kind, created_by_user_id, created_at::text, updated_at::text`,
    [folderId, parentFolderId]
  );
  return mapFolder(requireFirstRow(result.rows, "Failed to move folder."));
}

export async function createFileRecord(input: {
  spaceId: string;
  folderId: string | null;
  name: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  createdByUserId: string | null;
}): Promise<FileSummary> {
  const duplicate = await pool.query(
    `SELECT id
     FROM files
     WHERE space_id = $1 AND folder_id IS NOT DISTINCT FROM $2 AND name = $3
     LIMIT 1`,
    [input.spaceId, input.folderId, input.name]
  );
  if (duplicate.rowCount && duplicate.rowCount > 0) {
    throw new Error("A file with the same name already exists in this location.");
  }

  const result = await pool.query<FileRow>(
    `INSERT INTO files (id, space_id, folder_id, name, original_name, mime_type, size_bytes, storage_key, created_by_user_id, updated_by_user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
     RETURNING id, space_id, folder_id, name, original_name, mime_type, size_bytes, storage_key, created_by_user_id, updated_by_user_id, created_at::text, updated_at::text`,
    [
      randomUUID(),
      input.spaceId,
      input.folderId,
      input.name,
      input.originalName,
      input.mimeType,
      input.sizeBytes,
      input.storageKey,
      input.createdByUserId
    ]
  );
  const file = mapFile(requireFirstRow(result.rows, "Failed to create file."));
  await createFileVersionSnapshot({
    fileId: file.id,
    storageKey: file.storageKey,
    originalName: file.originalName,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    createdByUserId: file.createdByUserId,
    reason: "INITIAL_UPLOAD"
  });
  return file;
}

export async function createKnowledgeEntry(input: {
  fileId: string;
  categoryFolderId: string;
  ownerDepartmentId: string | null;
  maintainerUserId: string | null;
  status: KnowledgeEntryRecord["status"];
  effectiveDate: string | null;
  publishedByUserId: string | null;
}): Promise<KnowledgeEntrySummary> {
  const categoryFolder = await findFolderById(input.categoryFolderId);
  if (!categoryFolder || categoryFolder.folderKind !== "KNOWLEDGE_CATEGORY") {
    throw new Error("Knowledge category folder not found.");
  }

  const categoryName = categoryFolder.name;
  const publishedAt = input.status === "PUBLISHED" ? new Date().toISOString() : null;

  const result = await pool.query<KnowledgeEntryRow>(
    `INSERT INTO knowledge_entries (id, file_id, category_folder_id, owner_department_id, maintainer_user_id, status, effective_date, published_by_user_id, published_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8, $9::timestamptz)
     RETURNING id, file_id, category_folder_id, $10::text AS category_name, owner_department_id, maintainer_user_id, status, effective_date::text, published_by_user_id, published_at::text`,
    [
      randomUUID(),
      input.fileId,
      input.categoryFolderId,
      input.ownerDepartmentId,
      input.maintainerUserId,
      input.status,
      input.effectiveDate,
      input.publishedByUserId,
      publishedAt,
      categoryName
    ]
  );
  return mapKnowledgeEntry(requireFirstRow(result.rows, "Failed to create knowledge entry."));
}

export async function listKnowledgeEntries(): Promise<KnowledgeEntrySummary[]> {
  const result = await pool.query<KnowledgeEntryRow>(
    `SELECT ke.id,
            ke.file_id,
            ke.category_folder_id,
            folders.name AS category_name,
            ke.owner_department_id,
            ke.maintainer_user_id,
            ke.status,
            ke.effective_date::text,
            ke.published_by_user_id,
            ke.published_at::text
     FROM knowledge_entries ke
     JOIN folders ON folders.id = ke.category_folder_id
     ORDER BY ke.published_at DESC NULLS LAST, folders.name ASC`
  );
  return result.rows.map(mapKnowledgeEntry);
}

export async function updateKnowledgeEntry(input: {
  entryId: string;
  ownerDepartmentId: string | null;
  maintainerUserId: string | null;
  status: KnowledgeEntryRecord["status"];
  effectiveDate: string | null;
  publishedByUserId: string | null;
}): Promise<KnowledgeEntrySummary> {
  const existing = await pool.query<KnowledgeEntryRow>(
    `SELECT ke.id,
            ke.file_id,
            ke.category_folder_id,
            folders.name AS category_name,
            ke.owner_department_id,
            ke.maintainer_user_id,
            ke.status,
            ke.effective_date::text,
            ke.published_by_user_id,
            ke.published_at::text
     FROM knowledge_entries ke
     JOIN folders ON folders.id = ke.category_folder_id
     WHERE ke.id = $1`,
    [input.entryId]
  );
  const current = requireFirstRow(existing.rows, "Knowledge entry not found.");
  const publishedAt =
    current.status !== "PUBLISHED" && input.status === "PUBLISHED"
      ? new Date().toISOString()
      : current.published_at;

  const result = await pool.query<KnowledgeEntryRow>(
    `UPDATE knowledge_entries
     SET owner_department_id = $2,
         maintainer_user_id = $3,
         status = $4,
         effective_date = $5::date,
         published_by_user_id = $6,
         published_at = $7::timestamptz
     WHERE id = $1
     RETURNING id, file_id, category_folder_id, $8::text AS category_name, owner_department_id, maintainer_user_id, status, effective_date::text, published_by_user_id, published_at::text`,
    [
      input.entryId,
      input.ownerDepartmentId,
      input.maintainerUserId,
      input.status,
      input.effectiveDate,
      input.publishedByUserId,
      publishedAt,
      current.category_name
    ]
  );
  return mapKnowledgeEntry(requireFirstRow(result.rows, "Failed to update knowledge entry."));
}

async function getNextVersionNumber(fileId: string): Promise<number> {
  const result = await pool.query<{ next_version: number }>(
    `SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version
     FROM file_versions
     WHERE file_id = $1`,
    [fileId]
  );
  return Number(requireFirstRow(result.rows, "Failed to compute next version number.").next_version);
}

export async function createFileVersionSnapshot(input: {
  fileId: string;
  storageKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdByUserId: string | null;
  reason: string;
}): Promise<FileVersionSummary> {
  const versionNumber = await getNextVersionNumber(input.fileId);
  const result = await pool.query<FileVersionRow>(
    `INSERT INTO file_versions (id, file_id, version_number, storage_key, original_name, mime_type, size_bytes, created_by_user_id, reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, file_id, version_number, storage_key, original_name, mime_type, size_bytes, created_by_user_id, reason, created_at::text`,
    [
      randomUUID(),
      input.fileId,
      versionNumber,
      input.storageKey,
      input.originalName,
      input.mimeType,
      input.sizeBytes,
      input.createdByUserId,
      input.reason
    ]
  );
  return mapFileVersion(requireFirstRow(result.rows, "Failed to create file version."), input.storageKey);
}

export async function listFileVersions(fileId: string): Promise<FileVersionSummary[]> {
  const file = await findFileById(fileId, {
    includeDeleted: true
  });
  if (!file) {
    throw new Error("File not found.");
  }

  const result = await pool.query<FileVersionRow>(
    `SELECT id, file_id, version_number, storage_key, original_name, mime_type, size_bytes, created_by_user_id, reason, created_at::text
     FROM file_versions
     WHERE file_id = $1
     ORDER BY version_number DESC`,
    [fileId]
  );
  return result.rows.map((row) => mapFileVersion(row, file.storageKey));
}

export async function replaceFileContent(input: {
  fileId: string;
  storageKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  updatedByUserId: string | null;
}): Promise<FileSummary> {
  const file = await findFileById(input.fileId);
  if (!file) {
    throw new Error("File not found.");
  }

  const existingSnapshot = await pool.query<{ id: string }>(
    `SELECT id
     FROM file_versions
     WHERE file_id = $1 AND storage_key = $2
     LIMIT 1`,
    [file.id, file.storageKey]
  );

  if (!existingSnapshot.rows[0]) {
    await createFileVersionSnapshot({
      fileId: file.id,
      storageKey: file.storageKey,
      originalName: file.originalName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      createdByUserId: file.updatedByUserId ?? file.createdByUserId,
      reason: "BASELINE_SNAPSHOT"
    });
  }

  await pool.query(
    `UPDATE files
     SET storage_key = $2,
         original_name = $3,
         mime_type = $4,
         size_bytes = $5,
         updated_by_user_id = $6,
         updated_at = NOW()
     WHERE id = $1`,
    [
      file.id,
      input.storageKey,
      input.originalName,
      input.mimeType,
      input.sizeBytes,
      input.updatedByUserId
    ]
  );

  await createFileVersionSnapshot({
    fileId: file.id,
    storageKey: input.storageKey,
    originalName: input.originalName,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    createdByUserId: input.updatedByUserId,
    reason: "CONTENT_REPLACED"
  });

  const updated = await findFileById(file.id);
  if (!updated) {
    throw new Error("File not found after replace.");
  }

  return updated;
}

export async function restoreFileVersion(input: {
  fileId: string;
  versionId: string;
  updatedByUserId: string | null;
}): Promise<FileSummary> {
  const file = await findFileById(input.fileId, {
    includeDeleted: true
  });
  if (!file) {
    throw new Error("File not found.");
  }

  const result = await pool.query<FileVersionRow>(
    `SELECT id, file_id, version_number, storage_key, original_name, mime_type, size_bytes, created_by_user_id, reason, created_at::text
     FROM file_versions
     WHERE id = $1 AND file_id = $2`,
    [input.versionId, input.fileId]
  );
  const version = requireFirstRow(result.rows, "Version not found.");

  await pool.query(
    `UPDATE files
     SET storage_key = $2,
         original_name = $3,
         mime_type = $4,
         size_bytes = $5,
         updated_by_user_id = $6,
         updated_at = NOW()
     WHERE id = $1`,
    [
      file.id,
      version.storage_key,
      version.original_name,
      version.mime_type,
      version.size_bytes,
      input.updatedByUserId
    ]
  );

  const updated = await findFileById(file.id, {
    includeDeleted: true
  });
  if (!updated) {
    throw new Error("File not found after restore.");
  }

  return updated;
}

export async function renameFileRecord(fileId: string, name: string): Promise<FileSummary> {
  const file = await findFileById(fileId);
  if (!file) {
    throw new Error("File not found.");
  }

  const duplicate = await pool.query(
    `SELECT id
     FROM files
     WHERE space_id = $1
       AND folder_id IS NOT DISTINCT FROM $2
       AND name = $3
       AND id != $4
     LIMIT 1`,
    [file.spaceId, file.folderId, name, file.id]
  );
  if (duplicate.rowCount && duplicate.rowCount > 0) {
    throw new Error("A file with the same name already exists in this location.");
  }

  const result = await pool.query<FileRow>(
    `UPDATE files
     SET name = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING id, space_id, folder_id, name, original_name, mime_type, size_bytes, storage_key, created_by_user_id, updated_by_user_id, created_at::text, updated_at::text`,
    [fileId, name]
  );
  return mapFile(requireFirstRow(result.rows, "Failed to rename file."));
}

export async function moveFileRecord(fileId: string, folderId: string | null): Promise<FileSummary> {
  const file = await findFileById(fileId);
  if (!file) {
    throw new Error("File not found.");
  }

  const duplicate = await pool.query(
    `SELECT id
     FROM files
     WHERE space_id = $1
       AND folder_id IS NOT DISTINCT FROM $2
       AND name = $3
       AND id != $4
     LIMIT 1`,
    [file.spaceId, folderId, file.name, file.id]
  );
  if (duplicate.rowCount && duplicate.rowCount > 0) {
    throw new Error("A file with the same name already exists in the target location.");
  }

  const result = await pool.query<FileRow>(
    `UPDATE files
     SET folder_id = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING id, space_id, folder_id, name, original_name, mime_type, size_bytes, storage_key, created_by_user_id, updated_by_user_id, created_at::text, updated_at::text`,
    [fileId, folderId]
  );
  return mapFile(requireFirstRow(result.rows, "Failed to move file."));
}

export async function deleteFileToRecycleBin(input: {
  fileId: string;
  deletedByUserId: string | null;
}): Promise<RecycleEntrySummary> {
  const file = await findFileById(input.fileId, {
    includeDeleted: true
  });
  if (!file || file.deletedAt) {
    throw new Error("File not found.");
  }

  const deletedAt = new Date().toISOString();
  await pool.query(
    `UPDATE files
     SET deleted_at = $2::timestamptz, deleted_by_user_id = $3
     WHERE id = $1`,
    [file.id, deletedAt, input.deletedByUserId]
  );

  const result = await pool.query<RecycleEntryRow>(
    `INSERT INTO recycle_entries (id, target_type, target_id, space_id, original_parent_folder_id, original_folder_id, original_name, deleted_by_user_id, deleted_at)
     VALUES ($1, 'FILE', $2, $3, NULL, $4, $5, $6, $7::timestamptz)
     ON CONFLICT (target_type, target_id)
     DO UPDATE SET
       space_id = EXCLUDED.space_id,
       original_folder_id = EXCLUDED.original_folder_id,
       original_name = EXCLUDED.original_name,
       deleted_by_user_id = EXCLUDED.deleted_by_user_id,
       deleted_at = EXCLUDED.deleted_at
     RETURNING id, target_type, target_id, space_id, original_parent_folder_id, original_folder_id, original_name, deleted_by_user_id, deleted_at::text`,
    [randomUUID(), file.id, file.spaceId, file.folderId, file.name, input.deletedByUserId, deletedAt]
  );

  return mapRecycleEntry(requireFirstRow(result.rows, "Failed to create recycle entry for file."));
}

export async function deleteFolderToRecycleBin(input: {
  folderId: string;
  deletedByUserId: string | null;
}): Promise<RecycleEntrySummary> {
  const folder = await findFolderById(input.folderId, {
    includeDeleted: true
  });
  if (!folder || folder.deletedAt) {
    throw new Error("Folder not found.");
  }

  const deletedAt = new Date().toISOString();

  await pool.query(
    `WITH RECURSIVE target_folders AS (
       SELECT id
       FROM folders
       WHERE id = $1

       UNION ALL

       SELECT child.id
       FROM folders child
       JOIN target_folders parent ON child.parent_folder_id = parent.id
     )
     UPDATE folders
     SET deleted_at = $2::timestamptz, deleted_by_user_id = $3
     WHERE id IN (SELECT id FROM target_folders)`,
    [folder.id, deletedAt, input.deletedByUserId]
  );

  await pool.query(
    `WITH RECURSIVE target_folders AS (
       SELECT id
       FROM folders
       WHERE id = $1

       UNION ALL

       SELECT child.id
       FROM folders child
       JOIN target_folders parent ON child.parent_folder_id = parent.id
     )
     UPDATE files
     SET deleted_at = $2::timestamptz, deleted_by_user_id = $3
     WHERE folder_id IN (SELECT id FROM target_folders)`,
    [folder.id, deletedAt, input.deletedByUserId]
  );

  const result = await pool.query<RecycleEntryRow>(
    `INSERT INTO recycle_entries (id, target_type, target_id, space_id, original_parent_folder_id, original_folder_id, original_name, deleted_by_user_id, deleted_at)
     VALUES ($1, 'FOLDER', $2, $3, $4, NULL, $5, $6, $7::timestamptz)
     ON CONFLICT (target_type, target_id)
     DO UPDATE SET
       space_id = EXCLUDED.space_id,
       original_parent_folder_id = EXCLUDED.original_parent_folder_id,
       original_name = EXCLUDED.original_name,
       deleted_by_user_id = EXCLUDED.deleted_by_user_id,
       deleted_at = EXCLUDED.deleted_at
     RETURNING id, target_type, target_id, space_id, original_parent_folder_id, original_folder_id, original_name, deleted_by_user_id, deleted_at::text`,
    [randomUUID(), folder.id, folder.spaceId, folder.parentFolderId, folder.name, input.deletedByUserId, deletedAt]
  );

  return mapRecycleEntry(requireFirstRow(result.rows, "Failed to create recycle entry for folder."));
}

export async function listRecycleEntries(spaceIds: string[]): Promise<RecycleEntrySummary[]> {
  if (spaceIds.length === 0) {
    return [];
  }

  const result = await pool.query<RecycleEntryRow>(
    `SELECT id, target_type, target_id, space_id, original_parent_folder_id, original_folder_id, original_name, deleted_by_user_id, deleted_at::text
     FROM recycle_entries
     WHERE space_id = ANY($1::text[])
     ORDER BY deleted_at DESC`,
    [spaceIds]
  );
  return result.rows.map(mapRecycleEntry);
}

export async function restoreRecycleEntry(entryId: string): Promise<RecycleEntrySummary> {
  const entry = await findRecycleEntryById(entryId);
  if (!entry) {
    throw new Error("Recycle entry not found.");
  }

  if (entry.targetType === "FILE") {
    const file = await findFileById(entry.targetId, {
      includeDeleted: true
    });
    if (!file) {
      throw new Error("File not found.");
    }

    let restoreFolderId = entry.originalFolderId;
    if (restoreFolderId) {
      const targetFolder = await findFolderById(restoreFolderId, {
        includeDeleted: true
      });
      if (!targetFolder || targetFolder.deletedAt) {
        restoreFolderId = null;
      }
    }

    await pool.query(
      `UPDATE files
       SET folder_id = $2, deleted_at = NULL, deleted_by_user_id = NULL, updated_at = NOW()
       WHERE id = $1`,
      [file.id, restoreFolderId]
    );
  } else {
    const folder = await findFolderById(entry.targetId, {
      includeDeleted: true
    });
    if (!folder) {
      throw new Error("Folder not found.");
    }

    let restoreParentFolderId = entry.originalParentFolderId;
    if (restoreParentFolderId) {
      const parentFolder = await findFolderById(restoreParentFolderId, {
        includeDeleted: true
      });
      if (!parentFolder || parentFolder.deletedAt) {
        restoreParentFolderId = null;
      }
    }

    await pool.query(
      `UPDATE folders
       SET parent_folder_id = $2, deleted_at = NULL, deleted_by_user_id = NULL, updated_at = NOW()
       WHERE id = $1`,
      [folder.id, restoreParentFolderId]
    );

    await pool.query(
      `WITH RECURSIVE target_folders AS (
         SELECT id
         FROM folders
         WHERE id = $1

         UNION ALL

         SELECT child.id
         FROM folders child
         JOIN target_folders parent ON child.parent_folder_id = parent.id
       )
       UPDATE folders
       SET deleted_at = NULL, deleted_by_user_id = NULL, updated_at = NOW()
       WHERE id IN (SELECT id FROM target_folders)`,
      [folder.id]
    );

    await pool.query(
      `WITH RECURSIVE target_folders AS (
         SELECT id
         FROM folders
         WHERE id = $1

         UNION ALL

         SELECT child.id
         FROM folders child
         JOIN target_folders parent ON child.parent_folder_id = parent.id
       )
       UPDATE files
       SET deleted_at = NULL, deleted_by_user_id = NULL, updated_at = NOW()
       WHERE folder_id IN (SELECT id FROM target_folders)`,
      [folder.id]
    );
  }

  await pool.query(
    `DELETE FROM recycle_entries
     WHERE id = $1`,
    [entry.id]
  );

  return entry;
}

export async function findRecycleEntryById(entryId: string): Promise<RecycleEntrySummary | null> {
  const result = await pool.query<RecycleEntryRow>(
    `SELECT id, target_type, target_id, space_id, original_parent_folder_id, original_folder_id, original_name, deleted_by_user_id, deleted_at::text
     FROM recycle_entries
     WHERE id = $1`,
    [entryId]
  );
  return result.rows[0] ? mapRecycleEntry(result.rows[0]) : null;
}

export async function getFolderAncestors(folderId: string): Promise<FolderRecord[]> {
  const chain: FolderRecord[] = [];
  let current = await findFolderById(folderId);

  while (current) {
    chain.unshift(current);
    current = current.parentFolderId ? await findFolderById(current.parentFolderId) : null;
  }

  return chain;
}

export async function listPermissionGrantsForUser(input: {
  granteeUserId: string;
  spaceId?: string;
  folderIds?: string[];
  fileId?: string;
}): Promise<PermissionGrantSummary[]> {
  const conditions: string[] = [];
  const parameters: Array<string | string[]> = [input.granteeUserId];
  let index = 2;

  if (input.spaceId) {
    conditions.push(`(target_type = 'SPACE' AND target_id = $${index})`);
    parameters.push(input.spaceId);
    index += 1;
  }

  if (input.folderIds && input.folderIds.length > 0) {
    conditions.push(`(target_type = 'FOLDER' AND target_id = ANY($${index}::text[]))`);
    parameters.push(input.folderIds);
    index += 1;
  }

  if (input.fileId) {
    conditions.push(`(target_type = 'FILE' AND target_id = $${index})`);
    parameters.push(input.fileId);
  }

  if (conditions.length === 0) {
    return [];
  }

  const result = await pool.query<PermissionGrantRow>(
    `SELECT id, target_type, target_id, grantee_user_id, access_level, granted_by_user_id, created_at::text
     FROM permission_grants
     WHERE grantee_user_id = $1 AND (${conditions.join(" OR ")})`,
    parameters
  );
  return result.rows.map(mapPermissionGrant);
}

export async function listSearchCandidateFiles(input: {
  spaceIds: string[];
  nameQuery?: string;
  uploaderUserId?: string;
  updatedFrom?: string;
  updatedTo?: string;
}): Promise<FileSummary[]> {
  if (input.spaceIds.length === 0) {
    return [];
  }

  const conditions = ["space_id = ANY($1::text[])"];
  const parameters: Array<string | string[]> = [input.spaceIds];
  let index = 2;

  if (input.nameQuery) {
    conditions.push(`name ILIKE $${index}`);
    parameters.push(`%${input.nameQuery}%`);
    index += 1;
  }

  if (input.uploaderUserId) {
    conditions.push(`created_by_user_id = $${index}`);
    parameters.push(input.uploaderUserId);
    index += 1;
  }

  if (input.updatedFrom) {
    conditions.push(`updated_at >= $${index}::timestamptz`);
    parameters.push(input.updatedFrom);
    index += 1;
  }

  if (input.updatedTo) {
    conditions.push(`updated_at <= $${index}::timestamptz`);
    parameters.push(input.updatedTo);
  }

  const result = await pool.query<FileRow>(
    `SELECT id, space_id, folder_id, name, original_name, mime_type, size_bytes, storage_key, created_by_user_id, updated_by_user_id, deleted_by_user_id, deleted_at::text, created_at::text, updated_at::text
     FROM files
     WHERE ${conditions.join(" AND ")}
       AND deleted_at IS NULL
     ORDER BY updated_at DESC, name ASC`,
    parameters
  );

  return result.rows.map(mapFile);
}

export async function getSpaceQuotaSummary(spaceId: string): Promise<SpaceQuotaSummary> {
  const quotaResult = await pool.query<SpaceQuotaRow>(
    `SELECT space_id, limit_bytes
     FROM space_quotas
     WHERE space_id = $1`,
    [spaceId]
  );
  const quota = requireFirstRow(quotaResult.rows, "Quota configuration not found.");

  const activeFileResult = await pool.query<{ total: string | null }>(
    `SELECT COALESCE(SUM(size_bytes), 0)::text AS total
     FROM files
     WHERE space_id = $1 AND deleted_at IS NULL`,
    [spaceId]
  );
  const recycleResult = await pool.query<{ total: string | null }>(
    `SELECT COALESCE(SUM(size_bytes), 0)::text AS total
     FROM files
     WHERE space_id = $1 AND deleted_at IS NOT NULL`,
    [spaceId]
  );
  const versionOnlyResult = await pool.query<{ total: string | null }>(
    `WITH current_keys AS (
       SELECT DISTINCT storage_key
       FROM files
       WHERE space_id = $1
     ),
     version_only AS (
       SELECT DISTINCT v.storage_key, v.size_bytes
       FROM file_versions v
       JOIN files f ON f.id = v.file_id
       WHERE f.space_id = $1
         AND v.storage_key NOT IN (SELECT storage_key FROM current_keys)
     )
     SELECT COALESCE(SUM(size_bytes), 0)::text AS total
     FROM version_only`,
    [spaceId]
  );
  const occupiedResult = await pool.query<{ total: string | null }>(
    `WITH storage_items AS (
       SELECT DISTINCT storage_key, size_bytes
       FROM files
       WHERE space_id = $1

       UNION

       SELECT DISTINCT v.storage_key, v.size_bytes
       FROM file_versions v
       JOIN files f ON f.id = v.file_id
       WHERE f.space_id = $1
     )
     SELECT COALESCE(SUM(size_bytes), 0)::text AS total
     FROM storage_items`,
    [spaceId]
  );

  return mapSpaceQuota(quota, {
    activeFileBytes: Number(requireFirstRow(activeFileResult.rows, "Active usage not found.").total ?? "0"),
    recycleBinBytes: Number(requireFirstRow(recycleResult.rows, "Recycle usage not found.").total ?? "0"),
    versionSnapshotBytes: Number(requireFirstRow(versionOnlyResult.rows, "Version usage not found.").total ?? "0"),
    occupiedBytes: Number(requireFirstRow(occupiedResult.rows, "Occupied usage not found.").total ?? "0")
  });
}

export async function getActiveFileLock(fileId: string): Promise<FileLockRecord | null> {
  await pool.query(
    `DELETE FROM file_locks
     WHERE expires_at <= NOW()`
  );

  const result = await pool.query<FileLockRow>(
    `SELECT id, file_id, locked_by_user_id, created_at::text, expires_at::text
     FROM file_locks
     WHERE file_id = $1
     LIMIT 1`,
    [fileId]
  );
  return result.rows[0] ? mapFileLock(result.rows[0]) : null;
}

export async function acquireFileLock(input: {
  fileId: string;
  userId: string;
}): Promise<{
  lock: FileLockRecord | null;
  granted: boolean;
}> {
  const existing = await getActiveFileLock(input.fileId);
  const expiresAt = new Date(Date.now() + env.EDIT_LOCK_MINUTES * 60 * 1000).toISOString();

  if (!existing) {
    const inserted = await pool.query<FileLockRow>(
      `INSERT INTO file_locks (id, file_id, locked_by_user_id, expires_at)
       VALUES ($1, $2, $3, $4::timestamptz)
       RETURNING id, file_id, locked_by_user_id, created_at::text, expires_at::text`,
      [randomUUID(), input.fileId, input.userId, expiresAt]
    );
    return {
      lock: mapFileLock(requireFirstRow(inserted.rows, "Failed to create file lock.")),
      granted: true
    };
  }

  if (existing.lockedByUserId === input.userId) {
    const updated = await pool.query<FileLockRow>(
      `UPDATE file_locks
       SET expires_at = $2::timestamptz
       WHERE file_id = $1
       RETURNING id, file_id, locked_by_user_id, created_at::text, expires_at::text`,
      [input.fileId, expiresAt]
    );
    return {
      lock: mapFileLock(requireFirstRow(updated.rows, "Failed to renew file lock.")),
      granted: true
    };
  }

  return {
    lock: existing,
    granted: false
  };
}

export async function releaseFileLock(fileId: string): Promise<FileLockRecord | null> {
  const result = await pool.query<FileLockRow>(
    `DELETE FROM file_locks
     WHERE file_id = $1
     RETURNING id, file_id, locked_by_user_id, created_at::text, expires_at::text`,
    [fileId]
  );
  return result.rows[0] ? mapFileLock(result.rows[0]) : null;
}

export async function upsertPermissionGrant(input: {
  targetType: PermissionGrantRecord["targetType"];
  targetId: string;
  granteeUserId: string;
  accessLevel: AccessLevel;
  grantedByUserId: string | null;
}): Promise<PermissionGrantSummary> {
  const existing = await pool.query<PermissionGrantRow>(
    `SELECT id, target_type, target_id, grantee_user_id, access_level, granted_by_user_id, created_at::text
     FROM permission_grants
     WHERE target_type = $1 AND target_id = $2 AND grantee_user_id = $3`,
    [input.targetType, input.targetId, input.granteeUserId]
  );

  if (existing.rowCount && existing.rowCount > 0) {
    const updated = await pool.query<PermissionGrantRow>(
      `UPDATE permission_grants
       SET access_level = $4, granted_by_user_id = $5
       WHERE target_type = $1 AND target_id = $2 AND grantee_user_id = $3
       RETURNING id, target_type, target_id, grantee_user_id, access_level, granted_by_user_id, created_at::text`,
      [input.targetType, input.targetId, input.granteeUserId, input.accessLevel, input.grantedByUserId]
    );
    return mapPermissionGrant(requireFirstRow(updated.rows, "Failed to update permission grant."));
  }

  const inserted = await pool.query<PermissionGrantRow>(
    `INSERT INTO permission_grants (id, target_type, target_id, grantee_user_id, access_level, granted_by_user_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, target_type, target_id, grantee_user_id, access_level, granted_by_user_id, created_at::text`,
    [
      randomUUID(),
      input.targetType,
      input.targetId,
      input.granteeUserId,
      input.accessLevel,
      input.grantedByUserId
    ]
  );
  return mapPermissionGrant(requireFirstRow(inserted.rows, "Failed to create permission grant."));
}

export async function listPermissionGrantsByTarget(input: {
  targetType: PermissionGrantRecord["targetType"];
  targetId: string;
}): Promise<PermissionGrantSummary[]> {
  const result = await pool.query<PermissionGrantRow>(
    `SELECT id, target_type, target_id, grantee_user_id, access_level, granted_by_user_id, created_at::text
     FROM permission_grants
     WHERE target_type = $1 AND target_id = $2
     ORDER BY created_at ASC`,
    [input.targetType, input.targetId]
  );
  return result.rows.map(mapPermissionGrant);
}

export async function revokePermissionGrant(grantId: string): Promise<PermissionGrantSummary | null> {
  const result = await pool.query<PermissionGrantRow>(
    `DELETE FROM permission_grants
     WHERE id = $1
     RETURNING id, target_type, target_id, grantee_user_id, access_level, granted_by_user_id, created_at::text`,
    [grantId]
  );
  return result.rows[0] ? mapPermissionGrant(result.rows[0]) : null;
}

export async function listAuditEvents(limit: number): Promise<AuditEventSummary[]> {
  const safeLimit = Math.max(1, Math.min(limit, 200));
  const result = await pool.query<AuditRow>(
    `SELECT id, actor_user_id, action, entity_type, entity_id, details, created_at::text
     FROM audit_events
     ORDER BY created_at DESC
     LIMIT $1`,
    [safeLimit]
  );
  return result.rows.map(mapAudit);
}

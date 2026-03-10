import type { AccessCapabilities, FolderSummary } from "@my-project/domain";
import { findFileById, findFolderById, findSpaceById, getFolderAncestors, listPermissionGrantsForUser } from "./db.js";
import type { FileRecord, FolderRecord, RequestUser, SpaceRecord } from "./types.js";

function applyGrant(
  capabilities: AccessCapabilities,
  accessLevel: "READ" | "EDIT"
): AccessCapabilities {
  if (accessLevel === "EDIT") {
    return {
      ...capabilities,
      canRead: true,
      canEdit: true
    };
  }

  return {
    ...capabilities,
    canRead: true
  };
}

function baseSpaceCapabilities(user: RequestUser, space: SpaceRecord): AccessCapabilities {
  if (space.type === "PERSONAL") {
    const owner = space.ownerUserId === user.id;
    return {
      canRead: owner,
      canEdit: owner,
      canManage: owner
    };
  }

  if (space.type === "DEPARTMENT") {
    if (user.role === "SUPER_ADMIN") {
      return {
        canRead: true,
        canEdit: true,
        canManage: true
      };
    }

    if (user.departmentId && user.departmentId === space.ownerDepartmentId) {
      if (user.role === "DEPARTMENT_MANAGER") {
        return {
          canRead: true,
          canEdit: true,
          canManage: true
        };
      }

      return {
        canRead: true,
        canEdit: false,
        canManage: false
      };
    }

    return {
      canRead: false,
      canEdit: false,
      canManage: false
    };
  }

  return {
    canRead: true,
    canEdit: user.role === "SUPER_ADMIN",
    canManage: user.role === "SUPER_ADMIN"
  };
}

function applyDepartmentFolderRules(
  user: RequestUser,
  space: SpaceRecord,
  capabilities: AccessCapabilities,
  folderChain: FolderSummary[]
): AccessCapabilities {
  if (space.type !== "DEPARTMENT" || user.role !== "USER" || user.departmentId !== space.ownerDepartmentId) {
    return capabilities;
  }

  const insideCollaborationArea = folderChain.some(
    (folder) => folder.folderKind === "DEPARTMENT_COLLABORATION"
  );

  if (!insideCollaborationArea) {
    return capabilities;
  }

  return {
    ...capabilities,
    canRead: true,
    canEdit: true
  };
}

export async function resolveSpaceAccess(
  user: RequestUser,
  spaceId: string
): Promise<{
  space: SpaceRecord;
  capabilities: AccessCapabilities;
}> {
  const space = await findSpaceById(spaceId);
  if (!space) {
    throw new Error("Space not found.");
  }

  let capabilities = baseSpaceCapabilities(user, space);
  const grants = await listPermissionGrantsForUser({
    granteeUserId: user.id,
    spaceId: space.id
  });
  for (const grant of grants) {
    capabilities = applyGrant(capabilities, grant.accessLevel);
  }

  return {
    space,
    capabilities
  };
}

export async function requireReadableSpace(
  user: RequestUser,
  spaceId: string
): Promise<{
  space: SpaceRecord;
  capabilities: AccessCapabilities;
}> {
  const resolved = await resolveSpaceAccess(user, spaceId);

  if (!resolved.capabilities.canRead) {
    throw new Error("You do not have access to this space.");
  }

  return resolved;
}

export async function resolveFolderAccess(input: {
  user: RequestUser;
  spaceId: string;
  folderId: string;
}): Promise<{
  space: SpaceRecord;
  folder: FolderRecord;
  folderChain: FolderRecord[];
  capabilities: AccessCapabilities;
}> {
  const { space, capabilities: baseCapabilities } = await resolveSpaceAccess(
    input.user,
    input.spaceId
  );
  const folder = await findFolderById(input.folderId);

  if (!folder || folder.spaceId !== space.id) {
    throw new Error("Folder not found.");
  }

  const folderChain = await getFolderAncestors(folder.id);
  let capabilities = applyDepartmentFolderRules(
    input.user,
    space,
    baseCapabilities,
    folderChain
  );

  const grants = await listPermissionGrantsForUser({
    granteeUserId: input.user.id,
    spaceId: space.id,
    folderIds: folderChain.map((entry) => entry.id)
  });
  for (const grant of grants) {
    capabilities = applyGrant(capabilities, grant.accessLevel);
  }

  if (!capabilities.canRead) {
    throw new Error("You do not have access to this folder.");
  }

  return {
    space,
    folder,
    folderChain,
    capabilities
  };
}

export async function resolveFileAccess(input: {
  user: RequestUser;
  fileId: string;
}): Promise<{
  space: SpaceRecord;
  file: FileRecord;
  capabilities: AccessCapabilities;
}> {
  const file = await findFileById(input.fileId);
  if (!file) {
    throw new Error("File not found.");
  }

  const { space, capabilities: baseCapabilities } = await resolveSpaceAccess(
    input.user,
    file.spaceId
  );

  let folderChain: FolderRecord[] = [];
  if (file.folderId) {
    folderChain = await getFolderAncestors(file.folderId);
  }

  let capabilities = applyDepartmentFolderRules(
    input.user,
    space,
    baseCapabilities,
    folderChain
  );

  const grants = await listPermissionGrantsForUser({
    granteeUserId: input.user.id,
    spaceId: space.id,
    folderIds: folderChain.map((entry) => entry.id),
    fileId: file.id
  });
  for (const grant of grants) {
    capabilities = applyGrant(capabilities, grant.accessLevel);
  }

  if (!capabilities.canRead) {
    throw new Error("You do not have access to this file.");
  }

  return {
    space,
    file,
    capabilities
  };
}

export async function resolveTargetManageAccess(input: {
  user: RequestUser;
  targetType: "FOLDER" | "FILE";
  targetId: string;
}): Promise<{
  capabilities: AccessCapabilities;
}> {
  if (input.targetType === "FOLDER") {
    const target = await findFolderById(input.targetId);
    if (!target) {
      throw new Error("Folder not found.");
    }

    const resolved = await resolveFolderAccess({
      user: input.user,
      spaceId: target.spaceId,
      folderId: target.id
    });

    if (!resolved.capabilities.canManage) {
      throw new Error("You do not have permission to manage sharing on this folder.");
    }

    return {
      capabilities: resolved.capabilities
    };
  }

  const resolved = await resolveFileAccess({
    user: input.user,
    fileId: input.targetId
  });

  if (!resolved.capabilities.canManage) {
    throw new Error("You do not have permission to manage sharing on this file.");
  }

  return {
    capabilities: resolved.capabilities
  };
}

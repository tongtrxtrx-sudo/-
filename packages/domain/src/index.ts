export const userRoles = [
  "SUPER_ADMIN",
  "DEPARTMENT_MANAGER",
  "USER"
] as const;

export type UserRole = (typeof userRoles)[number];

export const accountStates = [
  "ACTIVE",
  "LOCKED",
  "DISABLED",
  "INITIAL_PASSWORD_REQUIRED"
] as const;

export type AccountState = (typeof accountStates)[number];

export const spaceTypes = [
  "PERSONAL",
  "DEPARTMENT",
  "PUBLIC_KNOWLEDGE"
] as const;

export type SpaceType = (typeof spaceTypes)[number];

export const accessLevels = [
  "READ",
  "EDIT"
] as const;

export type AccessLevel = (typeof accessLevels)[number];

export const folderKinds = [
  "STANDARD",
  "DEPARTMENT_COLLABORATION",
  "DEPARTMENT_PUBLISHING",
  "DEPARTMENT_ARCHIVE",
  "KNOWLEDGE_CATEGORY"
] as const;

export type FolderKind = (typeof folderKinds)[number];

export interface UserSummary {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  accountState: AccountState;
  departmentId: string | null;
}

export interface SpaceSummary {
  id: string;
  name: string;
  type: SpaceType;
  ownerUserId: string | null;
  ownerDepartmentId: string | null;
  manageable: boolean;
}

export interface DepartmentSummary {
  id: string;
  name: string;
  code: string;
}

export interface AuditEventSummary {
  id: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface FolderSummary {
  id: string;
  spaceId: string;
  parentFolderId: string | null;
  name: string;
  folderKind: FolderKind;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FileSummary {
  id: string;
  spaceId: string;
  folderId: string | null;
  name: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PermissionGrantSummary {
  id: string;
  targetType: "SPACE" | "FOLDER" | "FILE";
  targetId: string;
  granteeUserId: string;
  accessLevel: AccessLevel;
  grantedByUserId: string | null;
  createdAt: string;
}

export interface AccessCapabilities {
  canRead: boolean;
  canEdit: boolean;
  canManage: boolean;
}

export interface SearchResultSummary {
  file: FileSummary;
  path: string;
  space: SpaceSummary;
}

export interface RecycleEntrySummary {
  id: string;
  targetType: "FOLDER" | "FILE";
  targetId: string;
  spaceId: string;
  originalParentFolderId: string | null;
  originalFolderId: string | null;
  originalName: string;
  deletedByUserId: string | null;
  deletedAt: string;
}

export interface FileVersionSummary {
  id: string;
  fileId: string;
  versionNumber: number;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdByUserId: string | null;
  reason: string;
  createdAt: string;
  isCurrent: boolean;
}

export interface SpaceQuotaSummary {
  spaceId: string;
  limitBytes: number;
  activeFileBytes: number;
  recycleBinBytes: number;
  versionSnapshotBytes: number;
  occupiedBytes: number;
  usageRatio: number;
}

export interface KnowledgeEntrySummary {
  id: string;
  fileId: string;
  categoryFolderId: string;
  categoryName: string;
  ownerDepartmentId: string | null;
  maintainerUserId: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  effectiveDate: string | null;
  publishedByUserId: string | null;
  publishedAt: string | null;
}

import type {
  AccountState,
  AccessLevel,
  DepartmentSummary,
  FileSummary,
  SpaceQuotaSummary,
  FileVersionSummary,
  KnowledgeEntrySummary,
  FolderSummary,
  PermissionGrantSummary,
  RecycleEntrySummary,
  SpaceSummary,
  UserRole,
  UserSummary
} from "@my-project/domain";

export interface UserRecord {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  departmentId: string | null;
  passwordHash: string;
  accountState: AccountState;
}

export interface DepartmentRecord extends DepartmentSummary {}

export interface SpaceRecord extends SpaceSummary {}

export interface AuditRecord {
  id: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface RequestUser extends UserSummary {}

export interface FolderRecord extends FolderSummary {
  deletedByUserId: string | null;
  deletedAt: string | null;
}

export interface FileRecord extends FileSummary {
  storageKey: string;
  deletedByUserId: string | null;
  deletedAt: string | null;
}

export interface PermissionGrantRecord extends PermissionGrantSummary {
  targetType: "SPACE" | "FOLDER" | "FILE";
  accessLevel: AccessLevel;
}

export interface RecycleEntryRecord extends RecycleEntrySummary {}

export interface FileVersionRecord extends FileVersionSummary {
  storageKey: string;
}

export interface SpaceQuotaRecord extends SpaceQuotaSummary {}

export interface FileLockRecord {
  id: string;
  fileId: string;
  lockedByUserId: string;
  createdAt: string;
  expiresAt: string;
}

export interface KnowledgeEntryRecord extends KnowledgeEntrySummary {}

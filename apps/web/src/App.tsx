import type { ReactElement } from "react";
import { useEffect, useMemo, useState } from "react";
import type {
  AccessCapabilities,
  AuditEventSummary,
  DepartmentSummary,
  FileSummary,
  FileVersionSummary,
  FolderSummary,
  KnowledgeEntrySummary,
  PermissionGrantSummary,
  RecycleEntrySummary,
  SearchResultSummary,
  SpaceSummary,
  SpaceQuotaSummary,
  UserRole,
  UserSummary
} from "@my-project/domain";
import { apiRequest, downloadRequest } from "./api";

const tokenKey = "my-project-token";

interface LoginPayload {
  token: string;
  user: UserSummary;
  spaces: SpaceSummary[];
}

interface SpaceContentPayload {
  space: SpaceSummary;
  currentFolder: FolderSummary | null;
  breadcrumbs: FolderSummary[];
  permissions: AccessCapabilities;
  folders: FolderSummary[];
  files: FileSummary[];
}

interface SearchPayload {
  results: SearchResultSummary[];
}

interface EditorSessionPayload {
  documentServerUrl: string;
  config: Record<string, unknown>;
  token: string;
  lock: {
    lockedByUserId: string;
    expiresAt: string;
  } | null;
  canEdit: boolean;
  mode: "edit" | "view";
  modeReason: "EDIT_LOCK_ACQUIRED" | "EDIT_LOCK_RENEWED" | "LOCKED_BY_OTHER_USER" | "READ_ONLY_PERMISSION";
}

interface OnlyOfficeStatus {
  configured: boolean;
  documentServerUrl: string | null;
  apiPublicBaseUrl: string;
  jwtConfigured: boolean;
  supportedExtensions: string[];
  reachable: boolean;
  message: string;
}

interface ImportGuidance {
  supportedFileTypes: string[];
  maxFileSizeBytes: number;
  recommendedLayout: {
    personal: string;
    department: string[];
    publicKnowledge: string;
  };
  publicKnowledgeCategories: FolderSummary[];
  notes: string[];
}

type SelectedTarget =
  | {
      kind: "FOLDER";
      item: FolderSummary;
    }
  | {
      kind: "FILE";
      item: FileSummary;
    };

interface MoveTargetOption {
  id: string | null;
  label: string;
}

export function App(): ReactElement {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(tokenKey));
  const [user, setUser] = useState<UserSummary | null>(null);
  const [spaces, setSpaces] = useState<SpaceSummary[]>([]);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [content, setContent] = useState<SpaceContentPayload | null>(null);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [directoryUsers, setDirectoryUsers] = useState<UserSummary[]>([]);
  const [departments, setDepartments] = useState<DepartmentSummary[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEventSummary[]>([]);
  const [onlyOfficeStatus, setOnlyOfficeStatus] = useState<OnlyOfficeStatus | null>(null);
  const [importGuidance, setImportGuidance] = useState<ImportGuidance | null>(null);
  const [knowledgeCategories, setKnowledgeCategories] = useState<FolderSummary[]>([]);
  const [knowledgeEntries, setKnowledgeEntries] = useState<KnowledgeEntrySummary[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<SelectedTarget | null>(null);
  const [shareGrants, setShareGrants] = useState<PermissionGrantSummary[]>([]);
  const [recycleEntries, setRecycleEntries] = useState<RecycleEntrySummary[]>([]);
  const [fileVersions, setFileVersions] = useState<FileVersionSummary[]>([]);
  const [quotaSummary, setQuotaSummary] = useState<SpaceQuotaSummary | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResultSummary[]>([]);
  const [editorSession, setEditorSession] = useState<EditorSessionPayload | null>(null);
  const [message, setMessage] = useState<string>("");
  const [working, setWorking] = useState<boolean>(false);

  useEffect(() => {
    if (token) {
      void loadSession(token);
    }
  }, [token]);

  useEffect(() => {
    const firstSpace = spaces[0];
    if (!selectedSpaceId && firstSpace) {
      setSelectedSpaceId(firstSpace.id);
      setCurrentFolderId(null);
      setSelectedTarget(null);
      setShareGrants([]);
    }
  }, [spaces, selectedSpaceId]);

  useEffect(() => {
    if (!token || !user || user.accountState === "INITIAL_PASSWORD_REQUIRED" || !selectedSpaceId) {
      return;
    }

    void loadContent(selectedSpaceId, currentFolderId);
  }, [token, user, selectedSpaceId, currentFolderId]);

  useEffect(() => {
    if (!token || !selectedTarget || !content?.permissions.canManage) {
      setShareGrants([]);
      return;
    }

    void loadShareGrants(selectedTarget);
  }, [token, selectedTarget, content?.permissions.canManage]);

  useEffect(() => {
    if (!token || !selectedTarget || selectedTarget.kind !== "FILE") {
      setFileVersions([]);
      setEditorSession(null);
      return;
    }

    void loadFileVersions(selectedTarget.item.id);
  }, [token, selectedTarget]);

  useEffect(() => {
    if (!token || !user || user.accountState === "INITIAL_PASSWORD_REQUIRED" || !selectedSpaceId) {
      setRecycleEntries([]);
      return;
    }

    void loadRecycleBin(selectedSpaceId);
  }, [token, user, selectedSpaceId]);

  useEffect(() => {
    if (!token || !user || user.accountState === "INITIAL_PASSWORD_REQUIRED" || !selectedSpaceId) {
      setQuotaSummary(null);
      return;
    }

    void loadQuota(selectedSpaceId);
  }, [token, user, selectedSpaceId]);

  useEffect(() => {
    if (!editorSession) {
      return;
    }

    const mountEditor = (): void => {
      const mountNode = document.getElementById("onlyoffice-editor");
      const docsApi = (window as Window & {
        DocsAPI?: {
          DocEditor: new (elementId: string, config: Record<string, unknown>) => unknown;
        };
      }).DocsAPI;

      if (!mountNode || !docsApi) {
        return;
      }

      mountNode.innerHTML = "";
      const fullConfig = {
        ...editorSession.config,
        token: editorSession.token,
        width: "100%",
        height: "700px"
      };

      new docsApi.DocEditor("onlyoffice-editor", fullConfig);
    };

    const scriptId = "onlyoffice-docs-api";
    const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (existingScript) {
      mountEditor();
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = `${editorSession.documentServerUrl}/web-apps/apps/api/documents/api.js`;
    script.onload = () => {
      mountEditor();
    };
    script.onerror = () => {
      setMessage("Failed to load ONLYOFFICE document server script.");
    };
    document.body.appendChild(script);
  }, [editorSession]);

  const moveTargetOptions = useMemo(() => {
    if (!content) {
      return [] as MoveTargetOption[];
    }

    const options: MoveTargetOption[] = [{ id: null, label: "Root" }];
    const seen = new Set<string>(["__root__"]);
    const selectedId = selectedTarget?.item.id ?? null;

    const register = (id: string | null, label: string): void => {
      const key = id ?? "__root__";
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      options.push({ id, label });
    };

    for (const crumb of content.breadcrumbs) {
      if (crumb.id !== selectedId) {
        register(crumb.id, `Breadcrumb: ${crumb.name}`);
      }
    }

    if (content.currentFolder && content.currentFolder.id !== selectedId) {
      register(content.currentFolder.id, `Current: ${content.currentFolder.name}`);
    }

    for (const folder of content.folders) {
      if (folder.id !== selectedId) {
        register(folder.id, `Visible: ${folder.name}`);
      }
    }

    return options;
  }, [content, selectedTarget]);

  const searchableUsers = useMemo(() => {
    const entries = user ? [user, ...directoryUsers] : directoryUsers;
    const seen = new Set<string>();
    return entries.filter((entry) => {
      if (seen.has(entry.id)) {
        return false;
      }
      seen.add(entry.id);
      return true;
    });
  }, [directoryUsers, user]);

  async function loadSession(activeToken: string): Promise<void> {
    try {
      const [payload, directoryPayload] = await Promise.all([
        apiRequest<{ user: UserSummary; spaces: SpaceSummary[] }>("/auth/me", {}, activeToken),
        apiRequest<{ users: UserSummary[] }>("/directory/users", {}, activeToken)
      ]);
      setUser(payload.user);
      setSpaces(payload.spaces);
      setDirectoryUsers(directoryPayload.users);
      const firstSpace = payload.spaces[0];
      if (!selectedSpaceId && firstSpace) {
        setSelectedSpaceId(firstSpace.id);
        setCurrentFolderId(null);
      }
      if (payload.user.role === "SUPER_ADMIN") {
        await loadAdminData(activeToken);
      }
    } catch (error) {
      console.error(error);
      localStorage.removeItem(tokenKey);
      setToken(null);
      setUser(null);
      setSpaces([]);
      setDirectoryUsers([]);
      setSelectedSpaceId(null);
      setCurrentFolderId(null);
      setSelectedTarget(null);
      setShareGrants([]);
      setContent(null);
    }
  }

  async function loadAdminData(activeToken: string): Promise<void> {
    const [usersPayload, departmentsPayload, auditPayload, onlyOfficePayload, categoriesPayload, entriesPayload, importPayload] = await Promise.all([
      apiRequest<{ users: UserSummary[] }>("/admin/users", {}, activeToken),
      apiRequest<{ departments: DepartmentSummary[] }>("/admin/departments", {}, activeToken),
      apiRequest<{ auditEvents: AuditEventSummary[] }>("/admin/audit-events?limit=25", {}, activeToken),
      apiRequest<{ onlyOffice: OnlyOfficeStatus }>("/admin/integrations/onlyoffice/status", {}, activeToken),
      apiRequest<{ categories: FolderSummary[] }>("/public-knowledge/categories", {}, activeToken),
      apiRequest<{ entries: KnowledgeEntrySummary[] }>("/public-knowledge/entries", {}, activeToken),
      apiRequest<ImportGuidance>("/admin/import-guidance", {}, activeToken)
    ]);
    setUsers(usersPayload.users);
    setDepartments(departmentsPayload.departments);
    setAuditEvents(auditPayload.auditEvents);
    setOnlyOfficeStatus(onlyOfficePayload.onlyOffice);
    setKnowledgeCategories(categoriesPayload.categories);
    setKnowledgeEntries(entriesPayload.entries);
    setImportGuidance(importPayload);
  }

  async function loadContent(spaceId: string, folderId: string | null): Promise<void> {
    if (!token) {
      return;
    }

    const query = folderId ? `?folderId=${folderId}` : "";
    try {
      const payload = await apiRequest<SpaceContentPayload>(
        `/spaces/${spaceId}/contents${query}`,
        {},
        token
      );
      setContent(payload);
    } catch (error) {
      setContent(null);
      setMessage((error as Error).message);
    }
  }

  async function loadShareGrants(target: SelectedTarget): Promise<void> {
    if (!token) {
      return;
    }

    try {
      const payload = await apiRequest<{ grants: PermissionGrantSummary[] }>(
        `/shares?targetType=${target.kind}&targetId=${target.item.id}`,
        {},
        token
      );
      setShareGrants(payload.grants);
    } catch {
      setShareGrants([]);
    }
  }

  async function loadFileVersions(fileId: string): Promise<void> {
    if (!token) {
      return;
    }

    try {
      const payload = await apiRequest<{ versions: FileVersionSummary[] }>(
        `/files/${fileId}/versions`,
        {},
        token
      );
      setFileVersions(payload.versions);
    } catch {
      setFileVersions([]);
    }
  }

  async function loadRecycleBin(spaceId: string): Promise<void> {
    if (!token) {
      return;
    }

    try {
      const payload = await apiRequest<{ entries: RecycleEntrySummary[] }>(
        `/recycle-bin?spaceId=${spaceId}`,
        {},
        token
      );
      setRecycleEntries(payload.entries);
    } catch {
      setRecycleEntries([]);
    }
  }

  async function loadQuota(spaceId: string): Promise<void> {
    if (!token) {
      return;
    }

    try {
      const payload = await apiRequest<{ quota: SpaceQuotaSummary }>(
        `/spaces/${spaceId}/quota`,
        {},
        token
      );
      setQuotaSummary(payload.quota);
    } catch {
      setQuotaSummary(null);
    }
  }

  async function searchFiles(formData: FormData): Promise<void> {
    if (!token) {
      return;
    }

    setWorking(true);
    setMessage("");

    try {
      const params = new URLSearchParams();
      const fileName = String(formData.get("fileName") ?? "").trim();
      const path = String(formData.get("path") ?? "").trim();
      const uploaderUserId = String(formData.get("uploaderUserId") ?? "").trim();
      const updatedFrom = String(formData.get("updatedFrom") ?? "").trim();
      const updatedTo = String(formData.get("updatedTo") ?? "").trim();
      const spaceId = String(formData.get("spaceId") ?? "").trim();

      if (fileName) {
        params.set("fileName", fileName);
      }
      if (path) {
        params.set("path", path);
      }
      if (uploaderUserId) {
        params.set("uploaderUserId", uploaderUserId);
      }
      if (updatedFrom) {
        params.set("updatedFrom", new Date(`${updatedFrom}T00:00:00.000Z`).toISOString());
      }
      if (updatedTo) {
        params.set("updatedTo", new Date(`${updatedTo}T23:59:59.999Z`).toISOString());
      }
      if (spaceId) {
        params.set("spaceId", spaceId);
      }

      const payload = await apiRequest<SearchPayload>(
        `/search/files?${params.toString()}`,
        {},
        token
      );
      setSearchResults(payload.results);
      setMessage(`Found ${payload.results.length} file result(s).`);
    } catch (error) {
      setMessage((error as Error).message);
      setSearchResults([]);
    } finally {
      setWorking(false);
    }
  }

  async function signIn(formData: FormData): Promise<void> {
    setWorking(true);
    setMessage("");
    try {
      const payload = await apiRequest<LoginPayload>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username: formData.get("username"),
          password: formData.get("password")
        })
      });
      localStorage.setItem(tokenKey, payload.token);
      setToken(payload.token);
      setUser(payload.user);
      setSpaces(payload.spaces);
      setSelectedSpaceId(payload.spaces[0]?.id ?? null);
      setCurrentFolderId(null);
      setSelectedTarget(null);
      setShareGrants([]);
      setContent(null);
      setMessage("Signed in.");
      await loadSession(payload.token);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setWorking(false);
    }
  }

  async function changePassword(formData: FormData): Promise<void> {
    if (!token) {
      return;
    }
    setWorking(true);
    setMessage("");
    try {
      const payload = await apiRequest<{ token: string; user: UserSummary }>(
        "/auth/change-password",
        {
          method: "POST",
          body: JSON.stringify({
            currentPassword: formData.get("currentPassword"),
            newPassword: formData.get("newPassword")
          })
        },
        token
      );
      localStorage.setItem(tokenKey, payload.token);
      setToken(payload.token);
      setUser(payload.user);
      await loadSession(payload.token);
      setMessage("Password changed.");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setWorking(false);
    }
  }

  async function createDepartment(formData: FormData): Promise<void> {
    if (!token) {
      return;
    }
    setWorking(true);
    setMessage("");
    try {
      await apiRequest(
        "/admin/departments",
        {
          method: "POST",
          body: JSON.stringify({
            name: formData.get("name"),
            code: formData.get("code")
          })
        },
        token
      );
      await loadAdminData(token);
      await loadSession(token);
      setMessage("Department created.");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setWorking(false);
    }
  }

  async function createUser(formData: FormData): Promise<void> {
    if (!token) {
      return;
    }
    setWorking(true);
    setMessage("");
    try {
      const departmentId = formData.get("departmentId");
      await apiRequest(
        "/admin/users",
        {
          method: "POST",
          body: JSON.stringify({
            username: formData.get("username"),
            displayName: formData.get("displayName"),
            role: formData.get("role") as UserRole,
            departmentId: departmentId ? String(departmentId) : null,
            initialPassword: formData.get("initialPassword")
          })
        },
        token
      );
      await loadAdminData(token);
      await loadSession(token);
      setMessage("User created.");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setWorking(false);
    }
  }

  async function publishSelectedFile(formData: FormData): Promise<void> {
    if (!token || !selectedTarget || selectedTarget.kind !== "FILE") {
      return;
    }

    setWorking(true);
    setMessage("");
    try {
      const ownerDepartmentId = formData.get("ownerDepartmentId");
      const maintainerUserId = formData.get("maintainerUserId");

      await apiRequest(
        "/public-knowledge/publish",
        {
          method: "POST",
          body: JSON.stringify({
            sourceFileId: selectedTarget.item.id,
            categoryFolderId: formData.get("categoryFolderId"),
            ownerDepartmentId: ownerDepartmentId ? String(ownerDepartmentId) : null,
            maintainerUserId: maintainerUserId ? String(maintainerUserId) : null,
            status: formData.get("status"),
            effectiveDate: formData.get("effectiveDate") || null
          })
        },
        token
      );

      await loadAdminData(token);
      setMessage("Published to public knowledge.");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setWorking(false);
    }
  }

  async function createFolder(formData: FormData): Promise<void> {
    if (!token || !selectedSpaceId) {
      return;
    }
    setWorking(true);
    setMessage("");
    try {
      await apiRequest(
        `/spaces/${selectedSpaceId}/folders`,
        {
          method: "POST",
          body: JSON.stringify({
            parentFolderId: currentFolderId,
            name: formData.get("folderName")
          })
        },
        token
      );
      await loadContent(selectedSpaceId, currentFolderId);
      setMessage("Folder created.");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setWorking(false);
    }
  }

  async function uploadFile(formData: FormData): Promise<void> {
    if (!token || !selectedSpaceId) {
      return;
    }
    setWorking(true);
    setMessage("");

    try {
      const payload = new FormData();
      const file = formData.get("file");
      if (!(file instanceof File) || file.size === 0) {
        throw new Error("Choose a file to upload.");
      }
      if (currentFolderId) {
        payload.append("folderId", currentFolderId);
      }
      payload.append("file", file);

      await apiRequest(
        `/spaces/${selectedSpaceId}/files/upload`,
        {
          method: "POST",
          body: payload
        },
        token
      );
      await loadContent(selectedSpaceId, currentFolderId);
      setMessage("File uploaded.");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setWorking(false);
    }
  }

  async function downloadFile(file: FileSummary): Promise<void> {
    if (!token) {
      return;
    }
    setWorking(true);
    setMessage("");
    try {
      const blob = await downloadRequest(`/files/${file.id}/download`, token);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.originalName;
      link.click();
      URL.revokeObjectURL(url);
      setMessage(`Downloaded ${file.originalName}.`);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setWorking(false);
    }
  }

  async function renameSelected(formData: FormData): Promise<void> {
    if (!token || !selectedTarget) {
      return;
    }

    setWorking(true);
    setMessage("");
    try {
      const endpoint =
        selectedTarget.kind === "FOLDER"
          ? `/folders/${selectedTarget.item.id}/rename`
          : `/files/${selectedTarget.item.id}/rename`;

      const payload = await apiRequest<{ folder?: FolderSummary; file?: FileSummary }>(
        endpoint,
        {
          method: "PATCH",
          body: JSON.stringify({
            name: formData.get("newName")
          })
        },
        token
      );

      const updatedItem = selectedTarget.kind === "FOLDER" ? payload.folder : payload.file;
      if (updatedItem) {
        setSelectedTarget({
          kind: selectedTarget.kind,
          item: updatedItem
        } as SelectedTarget);
      }

      if (selectedSpaceId) {
        await loadContent(selectedSpaceId, currentFolderId);
      }
      setMessage(`${selectedTarget.kind === "FOLDER" ? "Folder" : "File"} renamed.`);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setWorking(false);
    }
  }

  async function moveSelected(formData: FormData): Promise<void> {
    if (!token || !selectedTarget) {
      return;
    }

    setWorking(true);
    setMessage("");
    try {
      const endpoint =
        selectedTarget.kind === "FOLDER"
          ? `/folders/${selectedTarget.item.id}/move`
          : `/files/${selectedTarget.item.id}/move`;
      const targetFolderId = formData.get("targetFolderId");

      await apiRequest(
        endpoint,
        {
          method: "PATCH",
          body: JSON.stringify({
            targetFolderId: targetFolderId ? String(targetFolderId) : null
          })
        },
        token
      );

      if (selectedSpaceId) {
        await loadContent(selectedSpaceId, currentFolderId);
      }
      setMessage(`${selectedTarget.kind === "FOLDER" ? "Folder" : "File"} moved.`);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setWorking(false);
    }
  }

  async function grantShare(formData: FormData): Promise<void> {
    if (!token || !selectedTarget) {
      return;
    }

    setWorking(true);
    setMessage("");
    try {
      await apiRequest(
        "/shares",
        {
          method: "POST",
          body: JSON.stringify({
            targetType: selectedTarget.kind,
            targetId: selectedTarget.item.id,
            granteeUserId: formData.get("granteeUserId"),
            accessLevel: formData.get("accessLevel")
          })
        },
        token
      );
      await loadShareGrants(selectedTarget);
      setMessage("Share granted.");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setWorking(false);
    }
  }

  async function revokeShare(grantId: string): Promise<void> {
    if (!token || !selectedTarget) {
      return;
    }

    setWorking(true);
    setMessage("");
    try {
      await apiRequest(
        `/shares/${grantId}`,
        {
          method: "DELETE"
        },
        token
      );
      await loadShareGrants(selectedTarget);
      setMessage("Share revoked.");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setWorking(false);
    }
  }

  async function deleteSelected(): Promise<void> {
    if (!token || !selectedTarget) {
      return;
    }

    setWorking(true);
    setMessage("");
    try {
      const endpoint =
        selectedTarget.kind === "FOLDER"
          ? `/folders/${selectedTarget.item.id}/delete`
          : `/files/${selectedTarget.item.id}/delete`;

      await apiRequest(
        endpoint,
        {
          method: "POST"
        },
        token
      );

      if (selectedSpaceId) {
        await Promise.all([
          loadContent(selectedSpaceId, currentFolderId),
          loadRecycleBin(selectedSpaceId)
        ]);
      }
      setSelectedTarget(null);
      setShareGrants([]);
      setMessage(`${selectedTarget.kind === "FOLDER" ? "Folder" : "File"} moved to recycle bin.`);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setWorking(false);
    }
  }

  async function restoreRecycleEntry(entryId: string): Promise<void> {
    if (!token || !selectedSpaceId) {
      return;
    }

    setWorking(true);
    setMessage("");
    try {
      await apiRequest(
        `/recycle-bin/${entryId}/restore`,
        {
          method: "POST"
        },
        token
      );

      await Promise.all([
        loadContent(selectedSpaceId, currentFolderId),
        loadRecycleBin(selectedSpaceId)
      ]);
      setMessage("Recycle bin item restored.");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setWorking(false);
    }
  }

  async function replaceSelectedFile(formData: FormData): Promise<void> {
    if (!token || !selectedTarget || selectedTarget.kind !== "FILE") {
      return;
    }

    setWorking(true);
    setMessage("");
    try {
      const file = formData.get("file");
      if (!(file instanceof File) || file.size === 0) {
        throw new Error("Choose a replacement file.");
      }

      const payload = new FormData();
      payload.append("file", file);

      const response = await apiRequest<{ file: FileSummary }>(
        `/files/${selectedTarget.item.id}/replace`,
        {
          method: "POST",
          body: payload
        },
        token
      );

      setSelectedTarget({
        kind: "FILE",
        item: response.file
      });
      await Promise.all([
        loadFileVersions(response.file.id),
        selectedSpaceId ? loadContent(selectedSpaceId, currentFolderId) : Promise.resolve()
      ]);
      setMessage("File content replaced.");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setWorking(false);
    }
  }

  async function restoreFileVersion(versionId: string): Promise<void> {
    if (!token || !selectedTarget || selectedTarget.kind !== "FILE") {
      return;
    }

    setWorking(true);
    setMessage("");
    try {
      const response = await apiRequest<{ file: FileSummary }>(
        `/files/${selectedTarget.item.id}/versions/${versionId}/restore`,
        {
          method: "POST",
          body: JSON.stringify({})
        },
        token
      );

      setSelectedTarget({
        kind: "FILE",
        item: response.file
      });
      await Promise.all([
        loadFileVersions(response.file.id),
        selectedSpaceId ? loadContent(selectedSpaceId, currentFolderId) : Promise.resolve()
      ]);
      setMessage("File version restored.");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setWorking(false);
    }
  }

  async function signOut(): Promise<void> {
    if (token) {
      try {
        await apiRequest("/auth/logout", { method: "POST" }, token);
      } catch (error) {
        console.error(error);
      }
    }
    localStorage.removeItem(tokenKey);
    setToken(null);
    setUser(null);
    setSpaces([]);
    setDirectoryUsers([]);
    setSelectedSpaceId(null);
    setCurrentFolderId(null);
    setSelectedTarget(null);
    setShareGrants([]);
    setRecycleEntries([]);
    setFileVersions([]);
    setEditorSession(null);
    setContent(null);
    setUsers([]);
    setDepartments([]);
    setAuditEvents([]);
    setMessage("Signed out.");
  }

  function openFolder(folderId: string): void {
    setCurrentFolderId(folderId);
    setSelectedTarget(null);
    setShareGrants([]);
  }

  function selectTarget(target: SelectedTarget): void {
    setSelectedTarget(target);
  }

  function resolveUserLabel(userId: string): string {
    const directoryUser = directoryUsers.find((entry) => entry.id === userId);
    if (directoryUser) {
      return `${directoryUser.displayName} (${directoryUser.username})`;
    }

    const adminUser = users.find((entry) => entry.id === userId);
    if (adminUser) {
      return `${adminUser.displayName} (${adminUser.username})`;
    }

    return userId;
  }

  function formatBytes(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    const units = ["KB", "MB", "GB", "TB"];
    let value = bytes / 1024;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }
    return `${value.toFixed(1)} ${units[unitIndex]}`;
  }

  function isEditorSupported(file: FileSummary): boolean {
    const extension = file.originalName.split(".").pop()?.toLowerCase();
    return extension === "docx" || extension === "xlsx" || extension === "pptx";
  }

  function describeEditorModeReason(session: EditorSessionPayload): string {
    switch (session.modeReason) {
      case "EDIT_LOCK_ACQUIRED":
        return "Editor session loaded with a new single-editor lock.";
      case "EDIT_LOCK_RENEWED":
        return "Editor session loaded and your existing lock was renewed.";
      case "LOCKED_BY_OTHER_USER":
        return "Editor opened in view mode because another user currently holds the edit lock.";
      case "READ_ONLY_PERMISSION":
        return "Editor opened in view mode because you do not have edit permission for this file.";
      default:
        return "Editor session loaded.";
    }
  }

  async function openEditorSession(): Promise<void> {
    if (!token || !selectedTarget || selectedTarget.kind !== "FILE") {
      return;
    }

    setWorking(true);
    setMessage("");
    try {
      const payload = await apiRequest<EditorSessionPayload>(
        `/editor/files/${selectedTarget.item.id}/session`,
        {},
        token
      );
      setEditorSession(payload);
      setMessage(describeEditorModeReason(payload));
    } catch (error) {
      setMessage((error as Error).message);
      setEditorSession(null);
    } finally {
      setWorking(false);
    }
  }

  async function forceUnlockEditor(): Promise<void> {
    if (!token || !selectedTarget || selectedTarget.kind !== "FILE") {
      return;
    }

    setWorking(true);
    setMessage("");
    try {
      await apiRequest(
        `/editor/files/${selectedTarget.item.id}/force-unlock`,
        {
          method: "POST",
          body: JSON.stringify({})
        },
        token
      );
      setMessage("Editor lock released. Reloading the editor session.");
      await openEditorSession();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setWorking(false);
    }
  }

  function renderTargetManagement(): ReactElement | null {
    if (!selectedTarget || !content) {
      return null;
    }

    const canEdit = content.permissions.canEdit;
    const canManage = content.permissions.canManage;

    return (
      <section className="card wide">
        <div className="toolbar">
          <div>
            <h2>Manage Selection</h2>
            <p className="hint">
              Selected {selectedTarget.kind.toLowerCase()}: <strong>{selectedTarget.item.name}</strong>
            </p>
          </div>
          <button
            className="secondary"
            onClick={() => {
              setSelectedTarget(null);
              setShareGrants([]);
            }}
            type="button"
          >
            Clear Selection
          </button>
        </div>

        <div className="content-grid">
          <section className="card nested">
            <h3>Rename</h3>
            <form
              className="compact-form"
              onSubmit={(event) => {
                event.preventDefault();
                void renameSelected(new FormData(event.currentTarget));
              }}
            >
              <label>
                New Name
                <input defaultValue={selectedTarget.item.name} name="newName" type="text" required />
              </label>
              <button disabled={working || !canEdit} type="submit">
                {working ? "Working..." : "Rename"}
              </button>
            </form>
          </section>

          <section className="card nested">
            <h3>Move</h3>
            <form
              className="compact-form"
              onSubmit={(event) => {
                event.preventDefault();
                void moveSelected(new FormData(event.currentTarget));
              }}
            >
              <label>
                Target Location
                <select defaultValue="" name="targetFolderId">
                  {moveTargetOptions.map((option) => (
                    <option key={option.id ?? "__root__"} value={option.id ?? ""}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <button disabled={working || !canEdit} type="submit">
                {working ? "Working..." : "Move"}
              </button>
            </form>
          </section>

          <section className="card nested">
            <h3>Sharing</h3>
            {canManage ? (
              <>
                <form
                  className="compact-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void grantShare(new FormData(event.currentTarget));
                  }}
                >
                  <label>
                    User
                    <select defaultValue="" name="granteeUserId">
                      <option disabled value="">
                        Select user
                      </option>
                      {directoryUsers.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.displayName} ({entry.username})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Access
                    <select defaultValue="READ" name="accessLevel">
                      <option value="READ">READ</option>
                      <option value="EDIT">EDIT</option>
                    </select>
                  </label>
                  <button disabled={working} type="submit">
                    {working ? "Working..." : "Grant Access"}
                  </button>
                </form>

                {shareGrants.length === 0 ? (
                  <p className="hint">No share grants yet.</p>
                ) : (
                  <ul className="browser-list">
                    {shareGrants.map((grant) => (
                      <li key={grant.id}>
                        <div className="file-row">
                          <div>
                            <strong>{resolveUserLabel(grant.granteeUserId)}</strong>
                            <span>{grant.accessLevel}</span>
                          </div>
                          <button onClick={() => void revokeShare(grant.id)} type="button">
                            Revoke
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="hint">You can edit this item, but sharing is restricted to managers and owners.</p>
            )}
          </section>

          {selectedTarget.kind === "FILE" ? (
            <section className="card nested">
              <h3>Versions</h3>
              <form
                className="compact-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void replaceSelectedFile(new FormData(event.currentTarget));
                  event.currentTarget.reset();
                }}
              >
                <label>
                  Replace File Content
                  <input name="file" type="file" required />
                </label>
                <button disabled={working || !canEdit} type="submit">
                  {working ? "Working..." : "Replace Content"}
                </button>
              </form>

              {fileVersions.length === 0 ? (
                <p className="hint">No file versions yet.</p>
              ) : (
                <ul className="browser-list">
                  {fileVersions.map((version) => (
                    <li key={version.id}>
                      <div className="file-row">
                        <div>
                          <strong>
                            v{version.versionNumber} {version.isCurrent ? "(Current)" : ""}
                          </strong>
                          <span>
                            {version.reason} | {version.originalName} | {(version.sizeBytes / 1024).toFixed(1)} KB
                          </span>
                        </div>
                        <button
                          disabled={working || version.isCurrent || !canEdit}
                          onClick={() => void restoreFileVersion(version.id)}
                          type="button"
                        >
                          Restore
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}

          {selectedTarget.kind === "FILE" && isEditorSupported(selectedTarget.item) ? (
            <section className="card nested">
              <h3>ONLYOFFICE</h3>
              <p className="hint">
                Open the selected file in the configured ONLYOFFICE document server. If the server is not configured, the request will fail with a clear message.
              </p>
              <button disabled={working} onClick={() => void openEditorSession()} type="button">
                {working ? "Working..." : "Open Editor"}
              </button>
              {editorSession?.lock ? (
                <p className="hint">
                  Lock owner: {resolveUserLabel(editorSession.lock.lockedByUserId)} | Expires: {new Date(editorSession.lock.expiresAt).toLocaleString()}
                </p>
              ) : null}
              {editorSession && !editorSession.canEdit ? (
                <p className="hint">{describeEditorModeReason(editorSession)}</p>
              ) : null}
              {editorSession?.lock && !editorSession.canEdit && canManage ? (
                <button className="secondary" disabled={working} onClick={() => void forceUnlockEditor()} type="button">
                  {working ? "Working..." : "Force Unlock"}
                </button>
              ) : null}
            </section>
          ) : null}

          {selectedTarget.kind === "FILE" && (user?.role === "SUPER_ADMIN" || user?.role === "DEPARTMENT_MANAGER") ? (
            <section className="card nested">
              <h3>Publish To Public Knowledge</h3>
              <form
                className="compact-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void publishSelectedFile(new FormData(event.currentTarget));
                }}
              >
                <label>
                  Category
                  <select defaultValue="" name="categoryFolderId" required>
                    <option disabled value="">
                      Select category
                    </option>
                    {knowledgeCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Owner Department
                  <select defaultValue="" name="ownerDepartmentId">
                    <option value="">No department</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Maintainer
                  <select defaultValue={user?.id ?? ""} name="maintainerUserId">
                    {[user, ...directoryUsers]
                      .filter((entry): entry is UserSummary => Boolean(entry))
                      .map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.displayName} ({entry.username})
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Status
                  <select defaultValue="PUBLISHED" name="status">
                    <option value="DRAFT">DRAFT</option>
                    <option value="PUBLISHED">PUBLISHED</option>
                    <option value="ARCHIVED">ARCHIVED</option>
                  </select>
                </label>
                <label>
                  Effective Date
                  <input name="effectiveDate" type="date" />
                </label>
                <button disabled={working} type="submit">
                  {working ? "Working..." : "Publish"}
                </button>
              </form>
            </section>
          ) : null}
        </div>

        <div className="danger-zone">
          <button
            className="danger"
            disabled={working || !canManage}
            onClick={() => void deleteSelected()}
            type="button"
          >
            {working ? "Working..." : "Move To Recycle Bin"}
          </button>
        </div>

        {editorSession && selectedTarget.kind === "FILE" ? (
          <section className="card nested">
            <h3>Editor Surface</h3>
            <div id="onlyoffice-editor" />
          </section>
        ) : null}
      </section>
    );
  }

  function renderRecycleBin(): ReactElement | null {
    if (!user || user.accountState === "INITIAL_PASSWORD_REQUIRED" || !selectedSpaceId) {
      return null;
    }

    return (
      <section className="card wide">
        <div className="toolbar">
          <div>
            <h2>Recycle Bin</h2>
            <p className="hint">
              Recycle bin entries are shown for the currently selected space when you have management permission.
            </p>
          </div>
        </div>

        {recycleEntries.length === 0 ? (
          <p className="hint">No recycle bin entries for this space.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Name</th>
                <th>Deleted At</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {recycleEntries.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.targetType}</td>
                  <td>{entry.originalName}</td>
                  <td>{new Date(entry.deletedAt).toLocaleString()}</td>
                  <td>
                    <button onClick={() => void restoreRecycleEntry(entry.id)} type="button">
                      Restore
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    );
  }

  function renderQuotaPanel(): ReactElement | null {
    if (!quotaSummary || !selectedSpaceId) {
      return null;
    }

    return (
      <section className="card wide">
        <div className="toolbar">
          <div>
            <h2>Quota</h2>
            <p className="hint">
              Occupied storage includes active files, recycle-bin files, and version-only snapshots.
            </p>
          </div>
        </div>

        <div className="content-grid">
          <section className="card nested">
            <h3>Baseline</h3>
            <dl className="stack">
              <div>
                <dt>Limit</dt>
                <dd>{formatBytes(quotaSummary.limitBytes)}</dd>
              </div>
              <div>
                <dt>Occupied</dt>
                <dd>{formatBytes(quotaSummary.occupiedBytes)}</dd>
              </div>
              <div>
                <dt>Usage Ratio</dt>
                <dd>{(quotaSummary.usageRatio * 100).toFixed(1)}%</dd>
              </div>
            </dl>
          </section>

          <section className="card nested">
            <h3>Breakdown</h3>
            <dl className="stack">
              <div>
                <dt>Active Files</dt>
                <dd>{formatBytes(quotaSummary.activeFileBytes)}</dd>
              </div>
              <div>
                <dt>Recycle Bin</dt>
                <dd>{formatBytes(quotaSummary.recycleBinBytes)}</dd>
              </div>
              <div>
                <dt>Version Snapshots</dt>
                <dd>{formatBytes(quotaSummary.versionSnapshotBytes)}</dd>
              </div>
            </dl>
          </section>
        </div>
      </section>
    );
  }

  function renderSearchPanel(): ReactElement | null {
    if (!user || user.accountState === "INITIAL_PASSWORD_REQUIRED") {
      return null;
    }

    return (
      <section className="card wide">
        <div className="toolbar">
          <div>
            <h2>Search</h2>
            <p className="hint">
              Search accessible files by file name, path, uploader, and updated time.
            </p>
          </div>
        </div>

        <form
          className="search-form"
          onSubmit={(event) => {
            event.preventDefault();
            void searchFiles(new FormData(event.currentTarget));
          }}
        >
          <label>
            File Name
            <input name="fileName" type="text" />
          </label>
          <label>
            Path
            <input name="path" type="text" />
          </label>
          <label>
            Uploader
            <select name="uploaderUserId" defaultValue="">
              <option value="">Any uploader</option>
              {searchableUsers.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.displayName} ({entry.username})
                </option>
              ))}
            </select>
          </label>
          <label>
            Updated From
            <input name="updatedFrom" type="date" />
          </label>
          <label>
            Updated To
            <input name="updatedTo" type="date" />
          </label>
          <label>
            Space
            <select name="spaceId" defaultValue="">
              <option value="">All accessible spaces</option>
              {spaces.map((space) => (
                <option key={space.id} value={space.id}>
                  {space.name}
                </option>
              ))}
            </select>
          </label>
          <button disabled={working} type="submit">
            {working ? "Working..." : "Search"}
          </button>
        </form>

        {searchResults.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>File</th>
                <th>Path</th>
                <th>Space</th>
                <th>Updated</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {searchResults.map((result) => (
                <tr key={result.file.id}>
                  <td>{result.file.name}</td>
                  <td>{result.path}</td>
                  <td>{result.space.name}</td>
                  <td>{new Date(result.file.updatedAt).toLocaleString()}</td>
                  <td>
                    <button
                      onClick={() => {
                        setSelectedSpaceId(result.space.id);
                        setCurrentFolderId(result.file.folderId);
                        setSelectedTarget({
                          kind: "FILE",
                          item: result.file
                        });
                      }}
                      type="button"
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="hint">Run a search to see results.</p>
        )}
      </section>
    );
  }

  function renderContentBrowser(): ReactElement | null {
    if (!user || user.accountState === "INITIAL_PASSWORD_REQUIRED" || spaces.length === 0) {
      return null;
    }

    return (
      <section className="card wide">
        <div className="toolbar">
          <div>
            <h2>Content Browser</h2>
            <p className="hint">
              Browse spaces, create folders, and upload files inside locations where you have edit permission.
            </p>
          </div>
          <div className="space-tabs">
            {spaces.map((space) => (
              <button
                key={space.id}
                className={space.id === selectedSpaceId ? "tab active" : "tab"}
                onClick={() => {
                  setSelectedSpaceId(space.id);
                  setCurrentFolderId(null);
                  setSelectedTarget(null);
                  setShareGrants([]);
                }}
                type="button"
              >
                {space.name}
              </button>
            ))}
          </div>
        </div>

        {content ? (
          <>
            <div className="browser-head">
              <div>
                <h3>{content.space.name}</h3>
                <div className="breadcrumbs">
                  <button
                    className={!currentFolderId ? "crumb active" : "crumb"}
                    onClick={() => {
                      setCurrentFolderId(null);
                      setSelectedTarget(null);
                      setShareGrants([]);
                    }}
                    type="button"
                  >
                    Root
                  </button>
                  {content.breadcrumbs.map((folder) => (
                    <button
                      key={folder.id}
                      className={folder.id === currentFolderId ? "crumb active" : "crumb"}
                      onClick={() => openFolder(folder.id)}
                      type="button"
                    >
                      {folder.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="permission-pill">
                Read: {content.permissions.canRead ? "Yes" : "No"} | Edit: {content.permissions.canEdit ? "Yes" : "No"} | Manage: {content.permissions.canManage ? "Yes" : "No"}
              </div>
            </div>

            {content.permissions.canEdit ? (
              <div className="actions-grid">
                <form
                  className="compact-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void createFolder(new FormData(event.currentTarget));
                    event.currentTarget.reset();
                  }}
                >
                  <label>
                    New Folder
                    <input name="folderName" type="text" required />
                  </label>
                  <button disabled={working} type="submit">
                    {working ? "Working..." : "Create Folder"}
                  </button>
                </form>

                <form
                  className="compact-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void uploadFile(new FormData(event.currentTarget));
                    event.currentTarget.reset();
                  }}
                >
                  <label>
                    Upload File
                    <input name="file" type="file" required />
                  </label>
                  <button disabled={working} type="submit">
                    {working ? "Working..." : "Upload"}
                  </button>
                </form>
              </div>
            ) : null}

            <div className="content-grid">
              <div>
                <h3>Folders</h3>
                {content.folders.length === 0 ? (
                  <p className="hint">No folders in this location.</p>
                ) : (
                  <ul className="browser-list">
                    {content.folders.map((folder) => (
                      <li key={folder.id}>
                        <div className="file-row">
                          <div>
                            <strong>{folder.name}</strong>
                            <span>{folder.folderKind}</span>
                          </div>
                          <div className="row-actions">
                            <button onClick={() => openFolder(folder.id)} type="button">
                              Open
                            </button>
                            <button
                              className={selectedTarget?.kind === "FOLDER" && selectedTarget.item.id === folder.id ? "secondary active-action" : "secondary"}
                              onClick={() =>
                                selectTarget({
                                  kind: "FOLDER",
                                  item: folder
                                })
                              }
                              type="button"
                            >
                              Manage
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h3>Files</h3>
                {content.files.length === 0 ? (
                  <p className="hint">No files in this location.</p>
                ) : (
                  <ul className="browser-list">
                    {content.files.map((file) => (
                      <li key={file.id}>
                        <div className="file-row">
                          <div>
                            <strong>{file.name}</strong>
                            <span>
                              {file.mimeType} | {(file.sizeBytes / 1024).toFixed(1)} KB
                            </span>
                          </div>
                          <div className="row-actions">
                            <button onClick={() => void downloadFile(file)} type="button">
                              Download
                            </button>
                            <button
                              className={selectedTarget?.kind === "FILE" && selectedTarget.item.id === file.id ? "secondary active-action" : "secondary"}
                              onClick={() =>
                                selectTarget({
                                  kind: "FILE",
                                  item: file
                                })
                              }
                              type="button"
                            >
                              Manage
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {renderTargetManagement()}
          </>
        ) : (
          <p className="hint">Select a space to browse its contents.</p>
        )}
      </section>
    );
  }

  return (
    <div className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">@build - Phase 3 Version History Slice</p>
          <h1>Enterprise On-Prem File Platform</h1>
          <p className="subtitle">
            Login, content browsing, share management, recycle bin, and version history groundwork.
          </p>
        </div>
        {user ? (
          <button className="secondary" onClick={() => void signOut()}>
            Sign out
          </button>
        ) : null}
      </header>

      {message ? <p className="message">{message}</p> : null}

      {!user ? (
        <section className="card">
          <h2>Sign In</h2>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void signIn(new FormData(event.currentTarget));
            }}
          >
            <label>
              Username
              <input name="username" type="text" required />
            </label>
            <label>
              Password
              <input name="password" type="password" required />
            </label>
            <button disabled={working} type="submit">
              {working ? "Working..." : "Sign In"}
            </button>
          </form>
        </section>
      ) : user.accountState === "INITIAL_PASSWORD_REQUIRED" ? (
        <section className="card">
          <h2>Change Initial Password</h2>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void changePassword(new FormData(event.currentTarget));
            }}
          >
            <label>
              Current Password
              <input name="currentPassword" type="password" required />
            </label>
            <label>
              New Password
              <input name="newPassword" type="password" minLength={12} required />
            </label>
            <button disabled={working} type="submit">
              {working ? "Working..." : "Change Password"}
            </button>
          </form>
        </section>
      ) : (
        <main className="grid">
          <section className="card">
            <h2>Session</h2>
            <dl className="stack">
              <div>
                <dt>Name</dt>
                <dd>{user.displayName}</dd>
              </div>
              <div>
                <dt>Username</dt>
                <dd>{user.username}</dd>
              </div>
              <div>
                <dt>Role</dt>
                <dd>{user.role}</dd>
              </div>
              <div>
                <dt>State</dt>
                <dd>{user.accountState}</dd>
              </div>
            </dl>
          </section>

          <section className="card">
            <h2>Accessible Spaces</h2>
            <ul className="space-list">
              {spaces.map((space) => (
                <li key={space.id}>
                  <strong>{space.name}</strong>
                  <span>{space.type}</span>
                </li>
              ))}
            </ul>
          </section>

          {renderSearchPanel()}
          {renderContentBrowser()}
          {renderRecycleBin()}
          {renderQuotaPanel()}

          {user.role === "SUPER_ADMIN" ? (
            <>
              <section className="card">
                <h2>Create Department</h2>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void createDepartment(new FormData(event.currentTarget));
                  }}
                >
                  <label>
                    Name
                    <input name="name" type="text" required />
                  </label>
                  <label>
                    Code
                    <input name="code" type="text" placeholder="OPS" required />
                  </label>
                  <button disabled={working} type="submit">
                    {working ? "Working..." : "Create Department"}
                  </button>
                </form>
              </section>

              <section className="card">
                <h2>Create User</h2>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void createUser(new FormData(event.currentTarget));
                  }}
                >
                  <label>
                    Username
                    <input name="username" type="text" required />
                  </label>
                  <label>
                    Display Name
                    <input name="displayName" type="text" required />
                  </label>
                  <label>
                    Role
                    <select name="role" defaultValue="USER">
                      <option value="USER">USER</option>
                      <option value="DEPARTMENT_MANAGER">DEPARTMENT_MANAGER</option>
                      <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                    </select>
                  </label>
                  <label>
                    Department
                    <select name="departmentId" defaultValue="">
                      <option value="">No department</option>
                      {departments.map((department) => (
                        <option key={department.id} value={department.id}>
                          {department.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Initial Password
                    <input name="initialPassword" type="password" minLength={12} required />
                  </label>
                  <button disabled={working} type="submit">
                    {working ? "Working..." : "Create User"}
                  </button>
                </form>
              </section>

              <section className="card">
                <h2>ONLYOFFICE Status</h2>
                {onlyOfficeStatus ? (
                  <dl className="stack">
                    <div>
                      <dt>Configured</dt>
                      <dd>{onlyOfficeStatus.configured ? "Yes" : "No"}</dd>
                    </div>
                    <div>
                      <dt>Reachable</dt>
                      <dd>{onlyOfficeStatus.reachable ? "Yes" : "No"}</dd>
                    </div>
                    <div>
                      <dt>Server URL</dt>
                      <dd>{onlyOfficeStatus.documentServerUrl ?? "Not configured"}</dd>
                    </div>
                    <div>
                      <dt>API Public Base URL</dt>
                      <dd>{onlyOfficeStatus.apiPublicBaseUrl}</dd>
                    </div>
                    <div>
                      <dt>JWT Configured</dt>
                      <dd>{onlyOfficeStatus.jwtConfigured ? "Yes" : "No"}</dd>
                    </div>
                    <div>
                      <dt>Supported Extensions</dt>
                      <dd>{onlyOfficeStatus.supportedExtensions.join(", ")}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>{onlyOfficeStatus.message}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="hint">ONLYOFFICE status is unavailable.</p>
                )}
              </section>

              <section className="card">
                <h2>Import Guidance</h2>
                {importGuidance ? (
                  <div className="stack">
                    <div>
                      <dt>Supported File Types</dt>
                      <dd>{importGuidance.supportedFileTypes.join(", ")}</dd>
                    </div>
                    <div>
                      <dt>Max File Size</dt>
                      <dd>{formatBytes(importGuidance.maxFileSizeBytes)}</dd>
                    </div>
                    <div>
                      <dt>Personal Layout</dt>
                      <dd>{importGuidance.recommendedLayout.personal}</dd>
                    </div>
                    <div>
                      <dt>Department Layout</dt>
                      <dd>{importGuidance.recommendedLayout.department.join(" | ")}</dd>
                    </div>
                    <div>
                      <dt>Public Knowledge Layout</dt>
                      <dd>{importGuidance.recommendedLayout.publicKnowledge}</dd>
                    </div>
                    <div>
                      <dt>Public Categories</dt>
                      <dd>{importGuidance.publicKnowledgeCategories.map((entry) => entry.name).join(", ")}</dd>
                    </div>
                    <div>
                      <dt>Operator Notes</dt>
                      <dd>{importGuidance.notes.join(" ")}</dd>
                    </div>
                  </div>
                ) : (
                  <p className="hint">Import guidance is unavailable.</p>
                )}
              </section>

              <section className="card wide">
                <h2>Public Knowledge Entries</h2>
                {knowledgeEntries.length === 0 ? (
                  <p className="hint">No public knowledge entries yet.</p>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th>Status</th>
                        <th>Maintainer</th>
                        <th>Effective Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {knowledgeEntries.map((entry) => (
                        <tr key={entry.id}>
                          <td>{entry.categoryName}</td>
                          <td>{entry.status}</td>
                          <td>{entry.maintainerUserId ? resolveUserLabel(entry.maintainerUserId) : "-"}</td>
                          <td>{entry.effectiveDate ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>

              <section className="card wide">
                <h2>Users</h2>
                <table>
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Name</th>
                      <th>Role</th>
                      <th>Department</th>
                      <th>State</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((entry) => (
                      <tr key={entry.id}>
                        <td>{entry.username}</td>
                        <td>{entry.displayName}</td>
                        <td>{entry.role}</td>
                        <td>{entry.departmentId ?? "-"}</td>
                        <td>{entry.accountState}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              <section className="card wide">
                <h2>Recent Audit Events</h2>
                <table>
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Entity</th>
                      <th>Actor</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditEvents.map((event) => (
                      <tr key={event.id}>
                        <td>{event.action}</td>
                        <td>
                          {event.entityType}
                          {event.entityId ? `:${event.entityId}` : ""}
                        </td>
                        <td>{event.actorUserId ?? "-"}</td>
                        <td>{new Date(event.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </>
          ) : null}
        </main>
      )}
    </div>
  );
}

# Build Progress Log

## 2026-03-09 - Planning Baseline

- Stabilized product planning artifacts:
  - `docs/brief.md`
  - `specs/mvp.md`
  - `docs/architecture.md`
  - `docs/v1-phases.md`
- Confirmed execution order:
  - Phase 1 foundation
  - Phase 2 content and permissions
  - Phase 3 lifecycle
  - Phase 4 editor integration
  - Phase 5 release hardening

## 2026-03-09 - Phase 1 Foundation

- Implemented monorepo workspace and shared domain package.
- Implemented Fastify API shell and React web shell.
- Added PostgreSQL bootstrap and seeded initial super admin.
- Added account creation, first-login password change, session handling, and audit event basics.
- Added Docker Compose baseline.

### Verification

- `npm run typecheck`
- `npm run build`
- `docker compose --env-file .env.example -f deploy/docker-compose.yml config`
- `docker compose --env-file .env.example -f deploy/docker-compose.yml up -d --build`
- `GET /health`
- Admin login, department creation, and user creation

## 2026-03-09 - Phase 2 Content Basics

- Added personal and department content browsing.
- Added folder creation.
- Added file upload and download.
- Added initial content browser UI.

### Verification

- Folder create
- File upload
- File download
- Content browsing from the web shell and API

## 2026-03-09 - Phase 2 Content Management

- Added folder rename and move.
- Added file rename and move.
- Added folder and file share grant.
- Added share listing and share revoke.
- Added management UI for selected files and folders.

### Verification

- Rename folder
- Rename file
- Move file
- Grant share
- List share
- Revoke share
- Verify access removal after revoke

## 2026-03-09 - Phase 2 Metadata Search

- Added permission-aware metadata search by:
  - file name
  - path
  - uploader
  - updated time
- Added minimal search UI.
- Fixed search behavior so inaccessible files are skipped instead of failing the whole query.

### Verification

- Admin search returns expected result for renamed and moved file.
- Non-owner search returns empty results after share revoke.
- Web container still serves the updated UI.

## 2026-03-09 - Phase 3 Recycle Bin

- Added recycle-bin schema and additive migration logic for existing development data.
- Added delete-to-recycle-bin behavior for files and folders.
- Added recycle-bin listing by manageable space.
- Added restore behavior for files and folders.
- Added recycle-bin UI with restore actions.
- Fixed request-header behavior so bodyless requests do not send invalid JSON media type by default.

### Verification

- Delete folder to recycle bin
- Recycle-bin listing shows folder entry
- Restore folder from recycle bin
- Nested file becomes visible again after folder restore
- Delete file to recycle bin
- Recycle-bin listing shows file entry
- Restore file from recycle bin

## 2026-03-09 - Phase 3 Version History

- Added file-version schema and snapshot storage.
- Added version listing endpoint.
- Added file-content replacement that writes a new version.
- Added restore-to-version behavior.
- Added baseline snapshot behavior so existing current file content is captured before replacement when no prior version exists.
- Added minimal version-management UI for selected files.

### Verification

- List versions for an existing file
- Replace file content
- Confirm version list expands after replace
- Restore older version
- Confirm download returns restored content

## 2026-03-09 - Phase 3 Quota Groundwork

- Added default quota model by space type.
- Added quota bootstrap for existing and newly created spaces.
- Added occupied-storage accounting with breakdown:
  - active files
  - recycle-bin files
  - version-only snapshots
  - total occupied storage with storage-key deduplication
- Added space quota endpoint.
- Added quota card in the web UI for the selected space.
- Fixed quota response typing so `limitBytes` is emitted as a number rather than a string.

## 2026-03-09 - Phase 3 Retention And Cleanup Groundwork

- Added maintenance module for lifecycle groundwork.
- Added admin maintenance overview endpoint.
- Added maintenance run endpoint with `dryRun` support.
- Added recycle cleanup candidate discovery.
- Added version prune candidate discovery.
- Added executable quota refresh path.

### Verification

- Maintenance overview returns recycle and version candidates
- Maintenance run with `job = quota_refresh` returns refreshed quota summaries
- Maintenance run with `job = all` and `dryRun = true` returns aggregate candidate sets

## 2026-03-10 - Phase 4 ONLYOFFICE Integration Scaffold

- Added ONLYOFFICE-related API configuration and optional secrets.
- Added file-lock persistence and lock acquisition helpers.
- Added editor session endpoint, editor content endpoint, callback endpoint, and force-unlock endpoint.
- Added minimal front-end editor launcher for supported Office files.
- Left the task in progress because the current environment does not provide a real ONLYOFFICE document server URL.

### Verification

- Local typecheck and build still pass after editor scaffolding
- Compose config and runtime still succeed
- `GET /editor/files/:id/session` returns a clear “ONLYOFFICE document server is not configured” message in the current environment

## 2026-03-10 - Phase 4 Skip Decision

- User explicitly allowed skipping Phase 4 because no document server is currently available.
- The repository keeps the ONLYOFFICE scaffold in place for later use.
- Active implementation work is redirected to Phase 5 without deleting the existing editor scaffold.

## 2026-03-10 - Phase 5 Public Knowledge Slice Started

- Added public knowledge metadata schema support.
- Added public knowledge category listing.
- Added public knowledge publish endpoint.
- Added public knowledge metadata update endpoint.
- Added minimal publish form and public knowledge entry list in the admin UI.

### Verification

- Category list returns the expected taxonomy roots
- Publish endpoint creates a public knowledge entry from an existing file
- Entry list returns the published item
- Metadata update changes the entry status from `PUBLISHED` to `ARCHIVED`

## 2026-03-10 - Phase 5 Import And Release Hardening

- Added admin import guidance output.
- Added import runbook documentation.
- Added release-readiness checklist documentation.

### Verification

- Local typecheck and build passed after the hardening updates
- Admin public knowledge publishing runtime flow still works
- Import and release documents now exist in English and Chinese companion form

## 2026-03-11 - Post-V1 Release Assessment

- Added a dedicated release assessment artifact:
  - `docs/release-assessment.md`
  - `docs/release-assessment.zh-CN.md`
- Captured the current release verdict, tested scope, untested scope, blockers, residual risks, and recommended release modes.
- Recorded that V1 is implementation-complete only under the explicit Phase 4 skip decision and that further work now requires a new post-V1 scope choice.

### Verification

- Manual bilingual alignment review of the new release assessment pair
- Continuity files updated to reflect that no implementation slice is active

## 2026-03-11 - Phase 4 Resumed: Lock Semantics And Callback Safety

- Resumed `phase_4_editor_integration` from the earlier user-approved skip state.
- Added richer editor-session mode signaling so the UI can distinguish:
  - edit lock acquired
  - edit lock renewed
  - read-only because another user holds the lock
  - read-only because the user lacks edit permission
- Restricted ONLYOFFICE callback download URLs to the configured document-server origin.
- Added audit coverage for lock acquire, lock renew, locked read-only open, callback lock release, and force unlock.
- Added frontend force-unlock support for authorized operators when a file is opened read-only because another user holds the lock.

### Verification

- `npm run typecheck`
- `npm run build`
- Placeholder ONLYOFFICE URL runtime flow:
  - first editor session returned `canEdit = true` and `modeReason = EDIT_LOCK_ACQUIRED`
  - second authorized editor returned `canEdit = false` and `modeReason = LOCKED_BY_OTHER_USER`
  - force unlock released the lock
  - second editor then returned `canEdit = true` and `modeReason = EDIT_LOCK_ACQUIRED`
- Audit events for the test file included:
  - `onlyoffice_lock_acquired`
  - `onlyoffice_opened_locked_view`
  - `file_force_unlocked`

## 2026-03-11 - Phase 4 Real-Service Wiring

- Added public/internal URL support for:
  - API public versus internal base URLs
  - ONLYOFFICE public versus internal document-server URLs
- Updated editor session generation so ONLYOFFICE server-to-server traffic uses internal API URLs while the browser still receives the public editor URL.
- Added a real `onlyoffice` service to Docker Compose with the official document-server image and dedicated volumes.
- Updated ONLYOFFICE operator documentation to describe the Compose topology and URL split.

### Verification

- `npm run typecheck`
- `npm run build`
- `docker compose --env-file .env.example -f deploy/docker-compose.yml config`
- Compose defaults were pinned to the already available `onlyoffice/documentserver:8.3` image to avoid blocking validation on the very large `latest` tag pull
- Real runtime verification:
  - `http://localhost:8080/web-apps/apps/api/documents/api.js` returned `200 OK`
  - admin ONLYOFFICE status reported `configured = true` and `reachable = true`
  - editor session returned:
    - public editor URL `http://localhost:8080`
    - internal editor URL `http://onlyoffice`
    - public API base URL `http://localhost:3001`
    - internal API base URL `http://api:3001`
  - browser automation opened a real ONLYOFFICE iframe for a supported `.docx` file
- Save-callback investigation findings:
  - ONLYOFFICE command service accepted `forcesave` with `error = 0`
  - ONLYOFFICE sent callback requests with both `status = 6` and later `status = 2`
  - callback token lifetime was extended from `15m` to `8h` for content and callback URLs
  - callback handling was moved into an asynchronous database-backed job queue
  - job retries now use delayed re-scheduling instead of blocking the HTTP callback
  - the test fixture was replaced with a real `.docx` file extracted from ONLYOFFICE itself
  - the remaining blocker is still background output-download failure, even though the same normalized internal URL is reachable immediately afterwards from the API container
  - `onlyoffice_save_failed` audit events now confirm the deferred failure path
  - direct auth experiments confirmed that:
    - plain GET on the generated output URL returns `403`
    - `Authorization: Bearer <callback-body-token>` still returns `403`
    - appending the same token as a query parameter still returns `403`
    - therefore the blocker is not fixed by merely forwarding the callback body token

## Current Position

- Phase 1: complete
- Phase 2: complete
- Phase 3 recycle-bin slice: complete
- Phase 3 version-history slice: complete
- Phase 3 quota-groundwork slice: complete
- Phase 3 retention-groundwork slice: complete
- Phase 5 public-knowledge metadata slice: complete
- Phase 5 import-and-release hardening slice: complete
- Post-V1 release assessment: complete
- Phase 4 resumed slice: in progress

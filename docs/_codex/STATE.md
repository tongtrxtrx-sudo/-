# Codex Build State

## Workflow

- Mode: `@build`
- Product: V1 enterprise on-prem file platform
- Current implementation phase: `phase_4`
- Current implementation focus: real ONLYOFFICE runtime is now reachable and browser editor open is verified; the remaining Phase 4 blocker is callback-time download of generated output during save handling
- Last continuity refresh: 2026-03-11

## Source Of Truth

- Product scope: [docs/brief.md](/D:/work/my-project/docs/brief.md)
- Architecture boundary: [docs/architecture.md](/D:/work/my-project/docs/architecture.md)
- MVP requirements: [specs/mvp.md](/D:/work/my-project/specs/mvp.md)
- Phase plan: [docs/v1-phases.md](/D:/work/my-project/docs/v1-phases.md)
- Task graph: [docs/_codex/tasks.json](/D:/work/my-project/docs/_codex/tasks.json)

## Overall Status

- Planning baseline: complete
- Phase 1 foundation and identity: complete
- Phase 2 spaces, files, permissions, and metadata search: complete
- Phase 3 recycle bin slice: complete
- Phase 3 version history slice: complete
- Phase 3 quota groundwork: complete
- Phase 3 retention groundwork: complete
- Phase 4 online editing integration: in progress after explicit user resumption
- Phase 5 public knowledge release hardening: complete
- Post-V1 release assessment: complete

## Completed Deliverables

- Planning artifacts completed and aligned:
  - `docs/brief.md`
  - `specs/mvp.md`
  - `docs/architecture.md`
  - `docs/v1-phases.md`
  - `docs/release-assessment.md`
- Runtime baseline completed:
  - monorepo workspace
  - shared domain package
  - Fastify API shell
  - React web shell
  - PostgreSQL bootstrap
  - Docker Compose baseline
- Identity and operator baseline completed:
  - seeded super administrator
  - login
  - forced password change
  - user creation
  - department creation
  - audit event recording and query
- File-platform basics completed:
  - personal, department, and public spaces
  - default department collaboration root folders
  - public knowledge category roots
  - folder creation
  - file upload and download
  - folder rename and move
  - file rename and move
  - folder and file share grant
  - share listing and revoke
  - directory user picker
  - permission-aware metadata search
- Lifecycle slice completed:
  - delete folder to recycle bin
  - delete file to recycle bin
  - recycle bin listing by manageable space
  - folder restore from recycle bin
  - file restore from recycle bin
  - file version snapshots
  - version list
  - file content replace
  - restore to prior version
  - default space quotas
  - occupied-storage accounting
  - quota summary endpoint
  - quota display in UI
  - maintenance overview endpoint
  - dry-run recycle cleanup path
  - dry-run version prune path
  - executable quota refresh path
  - public knowledge category listing
  - public knowledge publish endpoint
  - public knowledge metadata update endpoint
  - public knowledge admin publish UI
  - import guidance output
  - import runbook documentation
  - release-readiness checklist documentation

## Verified Evidence

- Local verification completed:
  - `npm install`
  - `npm run typecheck`
  - `npm run build`
- Deployment verification completed:
  - `docker compose --env-file .env.example -f deploy/docker-compose.yml config`
  - `docker compose --env-file .env.example -f deploy/docker-compose.yml up -d --build`
- Runtime verification completed:
  - `GET /health`
  - super admin login
  - department creation
  - user creation
  - content browsing
  - folder create
  - file upload
  - file download
  - rename and move for folders and files
  - share grant, list, revoke
  - search result visibility and inaccessible-result skipping
  - recycle bin delete and restore for both folders and files
  - Phase 4 API-level lock behavior with a placeholder ONLYOFFICE URL:
    - first editor receives edit mode
    - second authorized editor receives locked view mode
    - force unlock releases the lock
    - second editor can acquire a fresh edit lock afterwards
  - Phase 4 real ONLYOFFICE runtime behavior:
    - browser-facing `api.js` returns HTTP 200
    - admin status reports configured and reachable service
    - editor session returns public and internal URL split as expected
    - browser opens a real ONLYOFFICE iframe for a supported `.docx` file
- Documentation verification completed:
  - bilingual alignment review for `docs/release-assessment.md`

## Known Gaps

- Delete currently stops at recycle bin and does not yet enforce retention expiry rules.
- Real save-and-callback content round-trip still remains to be verified against the reachable ONLYOFFICE document server.
- Current callback blocker is reproducible:
  - ONLYOFFICE sends callback requests
  - API receives them
  - browser sessions are valid
  - generated output URLs are reachable from the API container after the callback failure
  - callback token lifetime was increased
  - callback handling was moved into an asynchronous database-backed job queue
  - a valid `.docx` fixture was used for re-validation
  - but asynchronous callback jobs still fail with `fetch failed`, and the save path still does not create new versions
  - direct auth experiments show that forwarding the callback body token does not remove the output URL `403`
  - secure-link experiments show that the callback URL `md5` does not match a recomputation using the running Nginx `secure_link` formula and secret
- Automated bulk import and long-running retention execution remain beyond the current verified scope.

## Current Data Assumptions

- Development environment currently contains seeded and sample data from verification.
- Runtime persistence currently depends on Docker volumes for PostgreSQL and app file storage.
- Existing schemas are migrated in-place with additive SQL and `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` patterns because development data is already present.

## Next Implementation Slice

- Active slice: debug why asynchronous ONLYOFFICE callback jobs still fail to download generated output even though the same URLs later become reachable from the API container.
- After this blocker is resolved, re-run forcesave validation and confirm version creation plus `onlyoffice_saved` audit events.

## Guardrails

- Do not introduce AI behavior in V1.
- Keep deployment single-server Docker Compose compatible.
- Preserve least-privilege boundaries for browse, search, share, delete, recycle, and restore.
- Keep public knowledge archived content hidden from default browse and search.
- Do not implement hard delete semantics as “complete” before retention behavior exists.

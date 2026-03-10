# Architecture: Enterprise On-Prem File Platform

## System Boundary

- The product boundary includes an internal web application for file management, department collaboration, public knowledge publication, metadata search, online Office editing, version recovery, recycle bin recovery, and audit review.
- The operator boundary includes super administrator workflows for account management, permission management, import jobs, quota management, audit inspection, and future AI enablement controls.
- Files, metadata, permissions, versions, recycle-bin state, and audit records are inside this repository's intended system boundary.
- External AI providers are intentionally outside the MVP runtime boundary and remain disabled by default.
- A self-hosted ONLYOFFICE Docs Enterprise editor is the selected internal editor boundary for the MVP rather than a public external dependency.

## Suggested Repository Layout

- `docs/` for brief, architecture, operator workflow notes, and bilingual planning artifacts
- `specs/` for durable implementation-facing specifications and their Chinese companion files
- `apps/web/` for the user-facing web application and administrator UI
- `apps/api/` for the internal API service that owns auth, spaces, files, permissions, search, and audit endpoints
- `packages/domain/` for shared business rules around spaces, permissions, versions, recycle bin, and publishing
- `packages/storage/` for file content storage, version storage, and import utilities
- `packages/search/` for metadata indexing and permission-aware search
- `packages/editor/` for ONLYOFFICE Docs Enterprise integration, file lock handling, and save callbacks
- `packages/audit/` for audit event models and query helpers
- `workers/` for background jobs such as lock cleanup, recycle cleanup, version pruning, quota refresh, and import execution
- `deploy/` for Docker Compose and environment-specific deployment assets
- `tests/` for automated tests split by domain, API, and end-to-end coverage

## Core Components

- Interface layer:
  - User-facing file manager UI for personal space, department space, and public knowledge base browsing
  - Administrator UI for accounts, permissions, imports, quotas, audit logs, and publisher assignments
  - Search UI for metadata-based filtering and permission-scoped result presentation
- Domain logic:
  - Identity and session rules
  - Space and folder ownership rules
  - Permission evaluation and share constraints
  - Public knowledge publication rules
  - Public knowledge taxonomy and archived-visibility rules
  - Version history and recycle bin rules
  - Edit lock rules for supported Office files
- Persistence or external integration:
  - Metadata database for users, departments, spaces, folders, files, versions, permissions, locks, imports, and audits
  - Internal file content storage on attached server volumes or another internal-only storage layer
  - Metadata search index or query layer scoped to authorized content only
  - Self-hosted ONLYOFFICE Docs Enterprise integration for supported editable file types
  - Optional future AI provider adapter kept disabled in the MVP
- Background jobs or scheduled tasks:
  - Import execution
  - Edit lock expiry cleanup
  - Recycle bin expiry cleanup
  - Version retention pruning
  - Quota recalculation
  - Audit retention cleanup

## Core Flows

1. User request enters the web UI and is authenticated through the application session layer.
2. The application resolves the user's role, space scope, and explicit grants before listing, searching, downloading, editing, restoring, or publishing content.
3. File operations route through domain rules that distinguish personal space, department space, and public knowledge base behavior.
4. Supported online edits obtain a single-document edit lock, save through the editor integration boundary, and create version history entries.
5. Delete operations move content into recycle bin first, while restore operations attempt to return content to the original location and ownership context.
6. Import jobs map staged local directories into target spaces and emit validation plus execution reports.
7. Audit events are written for critical authentication, authorization, sharing, publish, recovery, and destructive actions.

## Integration Points

- Authentication and authorization:
  - Internal username/password login
  - Session management
  - Role and grant evaluation for every content path
- Data store:
  - Relational metadata store for users, departments, spaces, folders, files, versions, permissions, locks, imports, quotas, and audit records
  - Internal file content store for binaries and version payloads
- Queue or worker system:
  - Internal worker execution for import, cleanup, quota refresh, and retention tasks
  - No external queue is required in the MVP if the single-server design remains sufficient
- External APIs or internal services:
  - Self-hosted ONLYOFFICE Docs Enterprise service for `docx`, `xlsx`, and `pptx`, with the MVP preferring the product's native integration model over a WOPI-first design
  - Optional future AI adapter that can target a local model or an external API after explicit enablement, but remains disabled in the MVP

## Safety and Reliability Constraints

- No MVP path should require external network egress.
- Authorization checks must happen before browse, search, download, version access, restore, and publish actions.
- Super administrators must not implicitly bypass private content visibility rules merely because they have system management authority.
- Department managers manage department spaces but do not inherit employee personal-space access.
- Edit-lock state must be recoverable, auditable, and cleaned up when sessions expire or fail.
- Version history and recycle bin behavior must be implemented before destructive delete semantics are considered complete.
- Quotas must reflect actual storage pressure from active files, versions, recycle-bin items, and supporting artifacts.
- The default quota baseline is `10GB` per personal space, `50GB` per department space, `200GB` for the public knowledge base, plus at least `300GB` of unallocated system reserve.
- Public knowledge base content should separate published content from archived content so later AI enablement can prefer safer, curated material.
- Archived public knowledge content should be hidden from ordinary default browse and search views.
- Backup and restore paths must be planned separately from the main production storage volume even in a single-server deployment.

## Open Questions

- No blocking architecture questions remain for the MVP planning baseline.
- Deployment-time follow-up remains for license procurement and department-level quota overrides after import inventory review.

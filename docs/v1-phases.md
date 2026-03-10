# Plan: V1 Delivery Phases

## Goal

Deliver the V1 enterprise on-prem file platform in small phases that reduce the highest-risk areas first: identity, permissions, storage behavior, lifecycle control, and editor integration. Each phase should leave the system in a still-deployable state and should avoid starting AI work.

## Delivery Principles

- Stabilize identity, space boundaries, and permission enforcement before adding convenience features.
- Treat version history, recycle bin, quotas, and audit as core product behavior, not later polish.
- Keep the MVP deployable on a single internal server throughout development.
- Delay editor integration until file identity, storage, and version contracts are stable.
- Keep AI disabled in every V1 phase.

## Phase 1: Foundation and Identity

### Objectives

- Establish the runtime skeleton, deployment skeleton, and core data model.
- Ship basic identity, session, role, and space primitives.
- Create the baseline audit model and storage abstraction.

### In Scope

- Repository structure for `apps/`, `packages/`, `workers/`, `deploy/`, and `tests/`
- Docker Compose baseline and environment wiring
- User, department, role, and space entities
- Username/password login
- Forced password change on first login
- Account state handling for active, locked, disabled, and initial-password-required users
- Session management
- Core audit event model
- File metadata model and internal storage abstraction

### Exit Criteria

- A user can sign in, change the initial password, and reach the correct role-scoped home area.
- Super administrators can create, disable, and reset users.
- The system can create personal, department, and public knowledge base space records.
- Audit events exist for login, logout, password reset, and account state changes.
- Docker Compose can start the baseline services locally.

## Phase 2: Spaces, Files, and Permissions

### Objectives

- Ship the core file manager behavior and permission model.
- Lock down personal privacy and department collaboration boundaries early.

### In Scope

- Personal-space file and folder CRUD
- Department-space folder tree with collaboration, publishing, and archive areas
- Public knowledge base browse surface
- Explicit sharing to named users only
- No re-sharing of shared personal content
- Permission evaluation middleware or shared domain rule layer
- File upload, download, rename, and move
- Metadata search by file name, path, uploader, and updated time
- Default read-only behavior for department members outside collaboration areas

### Exit Criteria

- Personal content is private by default.
- Shared personal content is visible only to named recipients.
- Department members can browse department content but edit only in collaboration areas or explicitly granted locations.
- Unauthorized results never appear in metadata search.
- Public knowledge base content is visible only through the published-content rules defined so far.

## Phase 3: Lifecycle, Quotas, and Audit Operations

### Objectives

- Complete destructive-action safety and retention behavior.
- Make storage pressure and auditability operational before editor integration.

### In Scope

- Recycle bin move and restore behavior
- Version history model and restore behavior for non-editor content changes
- Configurable quota model
- Default quota baseline:
  - `10GB` per personal space
  - `50GB` per department space by default
  - `200GB` for the public knowledge base
  - `300GB` minimum unallocated system reserve
- Quota accounting on active files, versions, and recycle-bin items
- Background jobs for recycle cleanup, version pruning, quota recalculation, and audit retention
- Audit query views for super administrators
- Archived content hidden from ordinary default browse and search

### Exit Criteria

- Deleted content moves to recycle bin and can be restored during retention.
- Version history can be listed and restored for supported file update paths.
- Quotas are visible and enforced using occupied storage.
- Super administrators can query audit events by user, file, event type, and time.
- Ordinary users do not see archived public knowledge content by default.

## Phase 4: Online Editing Integration

### Objectives

- Add the selected editor integration only after storage and lifecycle contracts are stable.
- Keep editing limited to single-editor behavior in V1.

### In Scope

- Self-hosted ONLYOFFICE Docs Enterprise integration
- Native integration path preferred over a WOPI-first design
- Single-editor lock acquisition and release
- Lock timeout cleanup and force unlock behavior
- Save callback handling
- New version creation on save
- Audit events for lock, unlock, force unlock, and save
- Editable file support for `docx`, `xlsx`, and `pptx`

### Exit Criteria

- A supported Office document can be opened for editing from an authorized location.
- A second user receives read-only access while a lock is active.
- Saving from the editor produces a new version and preserves authorization boundaries.
- Force unlock is limited to authorized operators and recorded in audit logs.

## Phase 5: Public Knowledge Publishing, Import, and Release Hardening

### Objectives

- Complete the public knowledge workflow and operational release readiness.
- Finish the initial data onboarding path and release checks.

### In Scope

- Public knowledge publishing by super administrators and authorized department managers
- Required metadata for public knowledge content
- First-pass taxonomy:
  - Policies and Procedures
  - Templates and Forms
  - Training Materials
  - Product Materials
  - Project Cases
  - FAQs
- Archived-state handling and publisher filters
- Initial one-time import jobs and import reports
- Deployment hardening for backups, retention jobs, and operational visibility
- Final acceptance walkthroughs against `docs/brief.md`, `specs/mvp.md`, and `docs/architecture.md`

### Exit Criteria

- Authorized publishers can publish and update public knowledge entries with required metadata.
- Archived public knowledge is hidden from ordinary default browse and search but available to authorized operators through explicit filters.
- Administrators can run import jobs from prepared directory structures and review actionable reports.
- The MVP can be deployed on the target single-server environment with documented operating assumptions.
- All acceptance criteria from the MVP spec are covered by manual or automated verification.

## Deferred Until After V1

- AI enablement by department
- Full-text indexing
- Multi-user co-authoring
- Audit export
- LDAP and SSO

## Recommended Immediate Next Step

Start Phase 1 and implement the minimum vertical slice for:

- User account lifecycle
- Login and forced password change
- Space records for personal, department, and public areas
- Core audit event plumbing
- Docker Compose baseline

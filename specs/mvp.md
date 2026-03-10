# Specification: Enterprise On-Prem File Platform MVP

## Metadata

- Version: 0.1.0
- Status: Draft
- Author: Codex
- Created: 2026-03-09
- Last Updated: 2026-03-09

## Problem

The company needs a production-ready on-prem enterprise file platform for about 30 internal users. The MVP must replace unmanaged file collection across employee computers with a controlled internal system for personal storage, department collaboration, structured public knowledge publishing, online Office document editing, version recovery, recycle bin recovery, and auditability. AI capabilities are intentionally deferred and must not block the first release.

## Scope

- In scope:
  - Username and password login for internal users
  - Forced password change on first login
  - Administrator password reset
  - Personal spaces with private-by-default access
  - Department spaces with collaboration, publishing, and archive areas
  - Public knowledge base with controlled publishing
  - Fixed first-pass public knowledge base categories: Policies and Procedures, Templates and Forms, Training Materials, Product Materials, Project Cases, and FAQs
  - Explicit user, folder, and department-level authorization
  - No re-sharing of shared personal content
  - Metadata search by file name, path, uploader, and updated time
  - Single-editor online editing for `docx`, `xlsx`, and `pptx` through self-hosted ONLYOFFICE Docs Enterprise
  - Edit locking, version history, and recycle bin recovery
  - One-time administrator-led import from prepared local folder structures
  - Built-in audit log query
  - Single-server Docker Compose deployment
  - AI reserved for later phases and disabled by default
- Out of scope:
  - AI-powered retrieval or chat in the MVP
  - Full-text indexing in the MVP
  - Real-time multi-user co-authoring
  - Public cloud deployment
  - LDAP, SSO, or advanced identity federation
  - Approval workflows for public knowledge publication
  - Audit log export
  - Online editing for legacy `doc`, `xls`, and `ppt` formats

## Requirements

### Functional

- FR-1: The system must allow super administrators to create, disable, and reset user accounts, and all new users must change their initial password before normal access.
- FR-2: The system must provide a personal space for each user where content is private by default and cannot be accessed without an explicit grant.
- FR-3: The system must support personal file and folder creation, upload, download, rename, move, delete to recycle bin, restore, and permanent cleanup after retention expiry.
- FR-4: The system must allow users to share personal files or folders only with explicitly named users, and recipients must not be able to re-share that content.
- FR-5: The system must provide department spaces managed by super administrators and department managers, with ordinary department members read-only by default outside explicitly editable collaboration areas.
- FR-6: The system must restrict high-risk department-space operations such as permission changes, delete, and move to authorized managers or delegated space maintainers.
- FR-7: The system must provide a public knowledge base where only super administrators and explicitly authorized department managers can publish or update content.
- FR-8: The public knowledge base must require structured metadata for published content, including category, owning department, maintainer, status, and effective date.
- FR-8a: The MVP public knowledge base category taxonomy must start with Policies and Procedures, Templates and Forms, Training Materials, Product Materials, Project Cases, and FAQs.
- FR-9: The system must provide permission-aware metadata search using file name, path, uploader, and updated time filters.
- FR-10: The system must support online editing only for `docx`, `xlsx`, and `pptx` files in the MVP and must enforce a single-editor lock for each editable document.
- FR-11: The system must create a new file version on online save and on overwrite-style content replacement, and authorized users must be able to list, download, and restore prior versions.
- FR-12: The system must move deleted content to recycle bin first, apply retention policies by space type, and allow authorized restoration to the original path when possible.
- FR-13: The system must support one-time import jobs from administrator-prepared local folder structures for personal spaces, department spaces, and the public knowledge base.
- FR-14: The system must provide import validation and reporting for unsupported file types, missing owners, naming conflicts, oversized files, and successful imports.
- FR-15: The system must record audit events for login, password reset, sharing, permission changes, publish actions, delete, restore, force unlock, and other critical content actions.
- FR-16: The system must expose audit logs to super administrators through in-product query and filtering views.
- FR-17: The system must support configurable quotas for personal spaces, department spaces, and the public knowledge base.
- FR-17a: The MVP default quota policy must start with `10GB` per personal space, `50GB` per department space by default, `200GB` for the public knowledge base, and at least `300GB` kept as unallocated system reserve.
- FR-17b: Quota accounting must include occupied storage from active files, versions, and recycle-bin items, while the UI presents both logical current usage and total occupied storage.
- FR-18: The system must preserve the future ability to enable AI per department later while keeping AI disabled by default in the MVP.
- FR-19: Archived public knowledge base content must be hidden from ordinary default browse and search views, while authorized publishers and super administrators can still access it through explicit filters.

### Non-functional

- NFR-1: All files, metadata, permissions, and audit records must remain stored on internal infrastructure in the MVP.
- NFR-2: No MVP user flow may require external network egress.
- NFR-3: Authorization must be enforced consistently for browse, download, search, version history, recycle bin, and restore paths.
- NFR-4: The deployment architecture must fit a single internal server with Docker Compose and low operational overhead.
- NFR-5: The storage model must support at least `1.5TB` of usable production capacity planning and assume active file volume around `500GB`.
- NFR-6: Individual uploaded files larger than `10MB` must be rejected in the MVP.
- NFR-7: Edit locks, recycle retention, version retention, and quota state must be recoverable and observable through background maintenance workflows.
- NFR-8: Public knowledge base content must remain structured and distinguish published content from archived content.

## Acceptance Criteria

- AC-1: A newly created user cannot reach normal product pages until the initial password is changed.
- AC-2: Personal content is invisible to other ordinary users unless an explicit share exists.
- AC-3: A recipient of shared personal content cannot grant access to any third user.
- AC-4: Department members can read department content by default but can edit only within collaboration areas or explicitly granted locations.
- AC-5: When one user edits a supported Office document, another user can only open it read-only until the edit lock is released or forcibly unlocked by an authorized operator.
- AC-6: Saving an edited supported document creates a new version that can later be listed, downloaded, and restored.
- AC-7: Deleting content sends it to recycle bin first, and authorized users can restore it during the configured retention period.
- AC-8: Only super administrators and explicitly authorized department managers can publish to the public knowledge base.
- AC-9: Search results returned for file name, path, uploader, or updated time never include unauthorized content.
- AC-10: Import jobs produce a report showing successful imports and validation failures such as conflicts, missing owners, invalid names, unsupported file types, and oversized files.
- AC-11: Super administrators can query audit events for authentication, sharing, permission changes, delete, restore, publish, and force unlock actions.
- AC-12: Ordinary users do not see archived public knowledge base content in default browse or search views.

## Core Flows

1. Super administrator provisions a user, and the user signs in and changes the initial password.
2. A user uploads and manages content in personal space and optionally shares selected folders or files with named users.
3. Department managers organize department collaboration, publishing, and archive areas while ordinary members operate within read-only and collaboration boundaries.
4. A user edits a supported Office file online, receives an edit lock, saves a new version, and later restores or reviews version history when needed.
5. A user deletes content, recovers it from recycle bin within retention, or allows the system to clean it after expiry.
6. An authorized publisher submits content with required metadata to the public knowledge base.
7. A super administrator imports initial content from prepared local folder structures and reviews the import report.

## Verification

- Manual review: confirm that the role and space model in this specification matches `docs/brief.md`.
- Manual walkthrough: verify first-login password change, personal-space privacy, and no re-sharing behavior against the planned user flows.
- Manual walkthrough: verify department read-only defaults, collaboration-area editing, single-editor locks, version creation, and recycle-bin recovery behavior against the planned user flows.
- Manual review: confirm that public knowledge publication requires authorized roles and structured metadata.
- Manual review: confirm that the MVP taxonomy, archived-content visibility rule, and default quota policy match the planning baseline.
- Manual review: confirm that the MVP keeps AI disabled by default and does not require external egress.
- Future implementation note: add concrete install, test, and end-to-end verification commands when runtime code is introduced.

## Risks and Assumptions

- Risk: Permission enforcement gaps could leak private or department-restricted content through search, history, restore, or future AI paths.
- Risk: Online Office editing integration may still be one of the highest implementation and licensing risks even without real-time co-authoring.
- Risk: Version history and recycle retention can exceed storage expectations if quota and cleanup policies are not enforced from the start.
- Risk: Public knowledge quality can degrade if metadata discipline and ownership are not operationalized.
- Assumption: Initial content can be organized into standardized import directories before system rollout.
- Assumption: Users can accept metadata search in the MVP before full-text search exists.
- Assumption: AI can remain disabled in the MVP without reducing the immediate value of the first release.
- Assumption: The default quota baseline will be tuned per department only after import inventory review rather than before planning approval.

## Change Log

| Date | Version | Description | Author |
| ---- | ------- | ----------- | ------ |
| 2026-03-09 | 0.1.0 | Initial draft | Codex |

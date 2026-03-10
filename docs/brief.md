# Brief: Enterprise On-Prem File Platform

## Problem

The company needs an on-prem enterprise file platform for about 30 internal users. The first release must solve secure file storage, controlled sharing, structured department collaboration, online Office document editing, version history, recycle bin recovery, and auditability inside the internal network. AI-assisted retrieval and Q&A are planned as a later capability and must not block the first production release.

## Users or Operators

- Primary:
  - Regular employees who manage personal files, access explicitly shared folders, search metadata, and edit permitted Office documents online.
  - Department managers who manage department spaces, maintain collaboration and publishing areas, and optionally publish approved content to the public knowledge base when authorized.
- Secondary:
  - Super administrators who manage users, departments, permissions, imports, audit logs, public knowledge base configuration, and system settings.

## Desired Outcome

- Launch a production-ready on-prem file platform that replaces ad hoc department file collection with a single managed system.
- Ensure personal files stay private by default and that all sharing is explicit, auditable, and bounded.
- Provide department collaboration without granting broad destructive permissions to all department members.
- Support single-editor online editing for `docx`, `xlsx`, and `pptx` files with version history and recovery.
- Prepare a clean, controlled public knowledge base that can later serve as the safest initial AI retrieval source.

## In Scope

- Account and password login for about 30 users.
- Password complexity enforcement, forced password change on first login, and administrator password reset.
- Three fixed space types:
  - Personal space
  - Department space
  - Public knowledge base
- Personal file and folder operations:
  - Create folders
  - Upload files
  - Download files
  - Rename files and folders
  - Move files and folders
  - Delete files and folders to recycle bin
- Department space management with three recommended area types:
  - Collaboration area
  - Publishing area
  - Archive area
- Permission grants configured by super administrators, including user-level, folder-level, and department-level grants.
- Personal content sharing to specific users only. Re-sharing by recipients is not allowed.
- Department members are read-only by default. Editing is allowed only in collaboration areas or explicitly authorized locations.
- Public knowledge base publishing by super administrators and explicitly authorized department managers.
- Structured public knowledge base metadata:
  - Category
  - Owning department
  - Maintainer
  - Status
  - Effective date
- Initial public knowledge base taxonomy:
  - Policies and Procedures
  - Templates and Forms
  - Training Materials
  - Product Materials
  - Project Cases
  - FAQs
- Archived public knowledge base content is hidden from ordinary default browse and search views.
- Metadata search for:
  - File name
  - Path
  - Uploader
  - Updated time
- Single-editor online editing for `docx`, `xlsx`, and `pptx` through a self-hosted ONLYOFFICE Docs Enterprise integration.
- Edit locking, lock timeout release, forced unlock with audit logging, and version creation on save.
- Version history with version listing, download, and restore.
- Recycle bin with retention by space importance.
- Initial one-time import from administrator-prepared local folder structures.
- Audit log query inside the product.
- Docker Compose deployment on a single internal server.
- AI configuration reserved for later phases, disabled by default.

## Out of Scope

- AI as a launch requirement.
- Real-time multi-user collaborative editing in the first release.
- Full-text document indexing in the first release.
- Public cloud or multi-tenant SaaS deployment.
- LDAP, SSO, or complex identity federation in the first release.
- Workflow approvals for publishing.
- Audit log export in the first release.
- Automatic migration of legacy permission models from an existing file system.
- Editing support for legacy `doc`, `xls`, and `ppt` formats.

## Constraints

- All files and business data must remain stored on internal infrastructure.
- External network access must follow a minimum-egress principle. AI must remain disabled by default in the first release.
- Permissions must follow least privilege. Users can access only their own data and explicitly granted data.
- Super administrators have management authority but do not implicitly gain unrestricted read access to all private content.
- Department managers independently manage department spaces but do not implicitly gain access to employee personal spaces.
- The main UI should use a chat-first pattern later for AI features, but the first release still requires a file tree and enterprise file management workflow.
- The system must support at least `1.5TB` of usable production storage planning to cover active files, history, recycle bin, indexes, logs, and buffers.
- The default MVP quota policy is:
  - Personal space: `10GB` per user
  - Department space: `50GB` per department by default, adjustable after import inventory review
  - Public knowledge base: `200GB`
  - Unallocated system reserve: at least `300GB`
- Quota enforcement should count occupied storage, including active files, version history, and recycle-bin content, while the UI should show both current logical usage and total occupied storage.
- Current file assumptions:
  - Total active file volume is about `500GB`
  - Individual files are smaller than `10MB`
- Deployment must be simple enough for low-ops internal administration through Docker Compose on a single server.
- Documentation and product rules should treat the public knowledge base as structured published content, not as an ungoverned shared drive.

## Success Signals

- Users can complete daily file storage and retrieval work without relying on unmanaged local folder collections.
- Personal files remain private by default, and sharing boundaries are auditable and understandable.
- Department collaboration works without broad delete or permission-edit powers for ordinary department members.
- Users can recover deleted items and prior document versions without administrator intervention in normal cases.
- Public knowledge base content is published into structured categories and is ready for later controlled AI enablement.
- Administrators can inspect critical login, permission, sharing, deletion, recovery, and publishing events through built-in audit views.

## Acceptance Criteria

- Scenario: First login requires password change
  - Given a newly created user account with an initial password
  - When the user signs in for the first time
  - Then the system requires a password change before normal access is granted

- Scenario: Personal space is private by default
  - Given a regular user has uploaded files to their personal space
  - When another regular user searches or browses without an explicit grant
  - Then the other user cannot view, download, or edit that personal content

- Scenario: Shared personal content cannot be re-shared
  - Given a user grants another user access to a file or folder from personal space
  - When the recipient views the granted content
  - Then the recipient can use only the granted permissions and cannot share it onward

- Scenario: Department members are read-only outside collaboration areas
  - Given a department member accesses department space content outside a collaboration area
  - When the member opens that content
  - Then the member can read and download it but cannot modify, move, delete, or change permissions

- Scenario: Collaboration area allows controlled editing
  - Given a department member has access to a department collaboration area
  - When the member edits a permitted Office document
  - Then the system allows editing, records the action, and creates a new version on save

- Scenario: Single-editor locking is enforced
  - Given one user is actively editing a supported Office document
  - When another user tries to edit the same document at the same time
  - Then the second user receives read-only access until the lock is released or forcibly unlocked by an authorized operator

- Scenario: Deleted content goes to recycle bin
  - Given a user deletes a file or folder they are allowed to delete
  - When the delete action completes
  - Then the item is moved to recycle bin and can be restored within the configured retention window

- Scenario: Version history supports recovery
  - Given a supported document has multiple saved versions
  - When an authorized user opens version history
  - Then the user can view prior versions, download them, and restore one as the current version

- Scenario: Public knowledge base is publish-controlled
  - Given a document is being added to the public knowledge base
  - When the actor is not a super administrator or an explicitly authorized department manager
  - Then the system blocks the publish action

- Scenario: Metadata search respects permissions
  - Given a user searches by file name, path, uploader, or updated time
  - When the system returns search results
  - Then every result is limited to content the user is authorized to access

## Risks and Assumptions

- Risk: Permission mistakes could expose private or department-restricted content through browsing, search, version history, or later AI retrieval.
- Risk: Online Office editing integration may introduce licensing, compatibility, or save-back complexity even with single-editor mode.
- Risk: Version history and recycle bin retention can consume storage faster than expected if quotas and cleanup jobs are not enforced.
- Risk: Public knowledge base quality may degrade if publishing metadata and ownership are not enforced consistently.
- Assumption: The company does not need to migrate from an actively used legacy platform and can prepare initial content in a standardized import folder layout.
- Assumption: The first release can defer AI, full-text indexing, SSO, and multi-user co-authoring without blocking user adoption.
- Assumption: Department spaces represent shared team assets, while personal spaces remain user-owned by default.

## Open Questions

- No blocking product-scope questions remain for the current MVP planning baseline.
- Deployment-time tuning can still adjust per-department quota overrides after the first import inventory is reviewed.

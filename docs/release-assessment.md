# Release Assessment

## Purpose

This document captures the current release confidence for the implemented V1 baseline after the user-approved Phase 4 skip decision.

## Assessment Date

- Date: 2026-03-11
- Assessment basis:
  - implementation status in `docs/_codex/STATE.md`
  - verification history in `docs/_codex/PROGRESS.md`
  - current release checklist in `docs/release-readiness.md`

## Current Verdict

- Conditionally releasable for an internal pilot or operator validation environment when real online Office editing is not part of the release scope.
- Not fully releasable for the originally planned V1 scope if the release requires validated ONLYOFFICE runtime integration.

## Tested Scope

The following areas have implementation and direct verification evidence:

- Workspace bootstrap, API build, and web build
- Docker Compose baseline and health endpoint
- Super administrator login and forced password change
- Department creation and user creation
- Space browsing and folder navigation
- Folder create, rename, move, delete-to-recycle-bin, and restore
- File upload, download, rename, move, delete-to-recycle-bin, and restore
- Share grant, share list, and share revoke
- Permission-aware metadata search
- Version listing, content replacement, and version restore
- Quota summary and occupied-storage accounting
- Maintenance overview and quota refresh execution path
- Public knowledge category list, publish flow, entry list, and status update
- API-level editor lock acquisition, lock denial, and force unlock behavior with a placeholder ONLYOFFICE document-server URL
- Real ONLYOFFICE runtime reachability, status reporting, session generation, and browser editor open

## Untested Or Partially Tested Scope

The following areas remain unverified or only scaffolded:

- Real ONLYOFFICE save-callback content round-trip against a reachable document server remains incomplete; current evidence shows callback requests arrive but the generated output download still fails during callback handling
- Automated bulk import execution against a realistic department data set
- Long-running retention execution, including recycle expiry and version pruning over time
- Full browser-based end-to-end regression coverage
- Release-grade security exercises such as repeated failed-login behavior and recovery drills

## Blocking Items Before General Release

The following items should be treated as blockers for a broader production release:

1. Provide and validate a real ONLYOFFICE document server if online editing is part of the release promise.
2. Validate real ONLYOFFICE save callbacks and version creation before promising full online editing in production.
3. Replace or reset seeded development accounts and verify production secret values.
4. Confirm persistent storage mapping for PostgreSQL and file storage on the target server.
5. Decide whether first-wave data import remains operator-driven or must become automated before release.

## Residual Risks

- Online editing save behavior remains the largest unresolved runtime dependency.
- Import is still partially manual, which increases operator error risk during first rollout.
- Retention groundwork exists, but scheduled cleanup and long-horizon validation are still pending.
- Regression confidence depends mostly on manual verification rather than a dedicated automated end-to-end suite.

## Recommended Release Modes

### Option A: Pilot Release Without Editor

Use this mode when the goal is to validate identity, permissions, storage flows, recycle behavior, and public knowledge publishing with a small internal group.

Required conditions:

- online editing is explicitly out of scope for the pilot
- operator runbook is followed for initial content import
- release-readiness checklist is completed on the target environment

### Option B: General Release With Editor

Use this mode only after the ONLYOFFICE runtime path is configured and verified end to end.

Required conditions:

- editor session open succeeds
- save callback writes content correctly
- single-editor lock behavior is confirmed
- operator recovery path for force unlock is verified

## Recommended Next Actions

1. Decide whether the near-term target is an internal pilot or a broader release.
2. If online editing is required, resume Phase 4 with a real ONLYOFFICE server.
3. If online editing is not required yet, prioritize automated import or stronger regression coverage.
4. Run the `docs/release-readiness.md` checklist on the target environment before any rollout.

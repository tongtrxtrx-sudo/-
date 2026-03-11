# ONLYOFFICE Integration

## Purpose

This document describes how the repository integrates with a self-hosted ONLYOFFICE Docs Enterprise server during `phase_4_editor_integration`.

## Current Implementation Status

- Backend session endpoint exists: `GET /editor/files/:fileId/session`
- Backend content endpoint exists: `GET /editor/files/:fileId/content`
- Backend callback endpoint exists: `POST /editor/files/:fileId/callback`
- Backend force-unlock endpoint exists: `POST /editor/files/:fileId/force-unlock`
- File-lock persistence exists in the application database
- A minimal frontend launcher exists for supported Office files
- Session responses now distinguish edit mode, read-only permission mode, and lock-held-by-other-user mode
- Callback downloads are restricted to the configured ONLYOFFICE document-server origin
- Audit events now cover lock acquisition, lock renewal, locked read-only opens, callback save, callback release, and force unlock
- Real editor runtime validation is blocked until a reachable ONLYOFFICE server is configured

## Required Environment Variables

- `API_PUBLIC_BASE_URL`
  - Publicly reachable base URL for the API from the ONLYOFFICE server perspective
- `ONLYOFFICE_DOCUMENT_SERVER_URL`
  - Base URL of the self-hosted ONLYOFFICE document server
- `ONLYOFFICE_JWT_SECRET`
  - Optional JWT secret for signing ONLYOFFICE session payloads
- `EDIT_LOCK_MINUTES`
  - Edit-lock expiry in minutes

## Supported File Types

- `docx`
- `xlsx`
- `pptx`

## Current Behavior Without A Document Server

- The admin status endpoint reports that the document server is not configured
- Editor session requests return a clear configuration error instead of failing silently
- Existing non-editor file management behavior continues to work
- Local API-level lock behavior can still be verified by configuring a placeholder document-server URL
- Current verification evidence includes:
  - first authorized editor receives an editable session
  - second authorized editor falls back to locked read-only mode
  - force unlock releases the lock
  - the second editor can acquire a fresh lock after force unlock

## Expected Validation After The Server Is Available

1. Configure `ONLYOFFICE_DOCUMENT_SERVER_URL`
2. Configure `API_PUBLIC_BASE_URL`
3. Optionally configure `ONLYOFFICE_JWT_SECRET`
4. Rebuild and restart the stack
5. Open a supported Office file from the web UI
6. Confirm single-editor locking
7. Save from ONLYOFFICE and confirm:
   - callback is accepted
   - file content is replaced
   - a new version is created
8. Force-unlock from an authorized operator account and confirm the lock is removed

## Known Gaps

- The current environment does not yet provide a real document server
- Full end-to-end editor save verification has not been completed against a reachable ONLYOFFICE server
- Final production hardening for ONLYOFFICE deployment is still pending

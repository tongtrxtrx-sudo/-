# Release Readiness

## Purpose

This checklist defines the minimum release-readiness expectations for the current V1 implementation baseline.

## Current Included Scope

- Identity and account lifecycle
- Personal, department, and public spaces
- File upload, download, rename, move, and sharing
- Metadata search
- Recycle bin
- Version history baseline
- Quota baseline
- Public knowledge metadata and publishing baseline

## Current Excluded Or Deferred Scope

- Real ONLYOFFICE runtime verification without a configured document server
- Automated bulk import jobs
- Retention cleanup execution beyond the current groundwork endpoints
- AI enablement

## Release Checklist

1. Confirm `.env` values are set for the target environment.
2. Confirm `JWT_SECRET` is not using the development placeholder.
3. Confirm database and app storage volumes are mapped to intended persistent storage.
4. Confirm `API_PUBLIC_BASE_URL` matches the operator-facing environment.
5. Confirm public knowledge categories are present.
6. Confirm the seeded development accounts are replaced or reset before release.
7. Confirm administrator operators understand the import runbook.
8. Confirm audit views are reachable to super administrators.
9. Confirm quota baseline is acceptable for the target environment.
10. Confirm recycle-bin and version restore behavior on sample files.
11. If ONLYOFFICE is planned for release, confirm the document server URL and JWT settings are configured and validated.

## Minimum Verification Commands

```powershell
npm run typecheck
npm run build
docker compose --env-file .env.example -f deploy/docker-compose.yml config
docker compose --env-file .env.example -f deploy/docker-compose.yml up -d --build
```

## Minimum Functional Checks

- Sign in as super administrator
- Create department
- Create user
- Upload sample file
- Share sample file or folder
- Search sample file
- Delete and restore sample file
- Replace file content and restore an earlier version
- Publish one sample public knowledge item

## Known Release Risks

- ONLYOFFICE remains an external dependency for true online editing validation.
- Automated import remains partially manual at this stage.
- Retention execution paths need later production scheduling and cleanup policy wiring.

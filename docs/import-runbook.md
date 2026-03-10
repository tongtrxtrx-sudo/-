# Import Runbook

## Purpose

This runbook defines the operator-facing process for the initial one-time content import into the enterprise on-prem file platform.

## Scope

- Personal-space import staging
- Department-space import staging
- Public knowledge base import staging
- Validation expectations before import execution

## Supported File Types

- `docx`
- `xlsx`
- `pptx`
- `pdf`
- `txt`
- `md`

## File Constraints

- Maximum file size: `10MB`
- Prefer preserving original file names
- Prefer preserving original last-modified timestamps in source staging

## Recommended Staging Layout

### Personal Spaces

```text
/import/personal/<username>/
```

### Department Spaces

```text
/import/department/<department>/Collaboration Area/
/import/department/<department>/Publishing Area/
/import/department/<department>/Archive Area/
```

### Public Knowledge

```text
/import/public/<category>/
```

Categories should match the current public knowledge taxonomy:

- Policies and Procedures
- Templates and Forms
- Training Materials
- Product Materials
- Project Cases
- FAQs

## Operator Checklist

1. Confirm target users and departments already exist in the system.
2. Confirm department names in staging match the intended department records.
3. Confirm files larger than `10MB` are excluded or split before import.
4. Confirm unsupported file formats are excluded.
5. Confirm public knowledge files are mapped to the correct category.
6. Confirm public knowledge entries have an intended maintainer and effective date policy.
7. Confirm the old source remains available until imported content is spot-checked.

## Current V1 Import Position

The repository currently provides the staging rules, validation assumptions, and public-knowledge metadata workflow. A full automated bulk import job is still a remaining hardening item, so the current V1 operator path is:

1. Stage files in the required layout.
2. Create the target users and departments.
3. Upload or publish content into the correct target spaces through the current application workflow.
4. Spot-check search, permissions, recycle bin, and version behavior after import.

## Post-Import Verification

- Verify a sample personal file is visible only to its owner.
- Verify a sample department collaboration file is editable only where expected.
- Verify a sample published knowledge item appears in the public knowledge list with the intended metadata.
- Verify search returns expected results for imported sample files.
- Verify recycle bin and version behavior still works on imported items.

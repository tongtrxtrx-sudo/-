# Repository Instructions

## Project Summary

- This repository defines an on-prem enterprise file platform for about 30 internal users.
- The first release is a managed enterprise file platform, not an AI-first product.
- Core first-release capabilities are personal space, department space, public knowledge base, online Office editing, version history, recycle bin, audit logs, and controlled sharing.
- All files and business data stay on internal infrastructure. AI is disabled by default and can be enabled later by department with strict permission boundaries.
- Deployment target is a single internal server with Docker Compose and low operational overhead.
- Storage planning should assume at least `1.5TB` of usable production capacity.
- Implementation work in this repository should normally run under the `@build` workflow.
- If the current user message does not explicitly contain `@build`, do not silently continue staged implementation work just because continuity files exist. Ask the user to resend with `@build` before resuming the tracked build workflow.

## Entry Points

- Install:
  - `npm install`
- Run locally:
  - `npm run dev:api`
  - `npm run dev:web`
  - `docker compose --env-file .env.example -f deploy/docker-compose.yml up --build`
- Test:
  - `npm run build`
- Lint / typecheck:
  - `npm run typecheck`

## Repository Map

- `apps/api/` contains the Fastify API for auth, account lifecycle, spaces, and audit endpoints.
- `apps/web/` contains the React web shell for sign-in, forced password change, space summary, and basic super-admin actions.
- `packages/domain/` contains shared domain enums and summary types used by both API and web.
- `deploy/` contains Docker Compose for the single-server baseline.
- `docs/` contains planning, architecture, and operator-facing project artifacts.
- `specs/` contains implementation-facing specifications.
- Runtime code is now present. Keep storage, permissions, audit, and editor integration concerns clearly separated as new packages and workers are introduced.
- Durable project documents in `docs/` and `specs/` must be maintained as bilingual pairs:
  - English canonical file: `<name>.md`
  - Chinese companion file: `<name>.zh-CN.md`
- The English file is the implementation-facing source for agent reasoning. The Chinese companion file is for human review. Keep both files aligned in scope and structure.
- Do not replace the English canonical file with Chinese-only content.

## Safety Boundaries

- Do not send files or business data to external services by default.
- Treat permissions, audit logs, version history, recycle bin behavior, and future AI retrieval boundaries as safety-sensitive areas.
- Super administrators have system management authority but do not implicitly gain unrestricted read access to private user content.
- Department managers manage department spaces but do not implicitly gain access to employee personal spaces.
- Secrets and service credentials must be injected through environment variables or deployment configuration, never committed to the repository.

## Planning Artifacts

- [docs/brief.md](/D:/work/my-project/docs/brief.md) and [docs/brief.zh-CN.md](/D:/work/my-project/docs/brief.zh-CN.md) for product scope, constraints, outcomes, and acceptance criteria.
- [docs/architecture.md](/D:/work/my-project/docs/architecture.md) and `docs/architecture.zh-CN.md` for module boundaries, integration points, and safety constraints.
- `docs/v1-phases.md` and `docs/v1-phases.zh-CN.md` for phased implementation order, dependencies, and exit criteria.
- [specs/mvp.md](/D:/work/my-project/specs/mvp.md) and `specs/mvp.zh-CN.md` for durable implementation-facing MVP requirements.
- `docs/codex-kickoff*.md` and `docs/guided-project-flow*.md` for operator workflow guidance.

## Context Priorities

- For planning or product changes, read `AGENTS.md`, `docs/brief.md`, `docs/architecture.md`, and `specs/mvp.md` first.
- When `@build` is active, also read `docs/_codex/STATE.md`, `docs/_codex/PROGRESS.md`, and `docs/_codex/tasks.json` before choosing the next implementation slice.
- Use the English canonical planning docs for implementation reasoning, then confirm the paired Chinese files remain aligned for user-facing review.
- Before touching permissions, sharing, audit, or future AI boundaries, load the relevant role and scope decisions from the brief and specs.
- Before touching storage or editing behavior, load decisions about import, version history, recycle bin retention, quotas, and document editing constraints.

## Completion Gates

- When creating or editing durable project docs in `docs/` or `specs/`, update both the English canonical file and the Chinese companion file in the same task.
- Keep section ordering and scope aligned across both language versions.
- Do not claim planning artifacts are complete until the bilingual pair has been checked for consistency.
- For the current implementation baseline, run `npm run typecheck` and `npm run build` before claiming the code is in a healthy state.
- If Compose files change, validate them with `docker compose --env-file .env.example -f deploy/docker-compose.yml config`.
- When `@build` is active, update `docs/_codex/STATE.md`, `docs/_codex/PROGRESS.md`, and `docs/_codex/tasks.json` whenever the active slice, completed work, or next task changes.

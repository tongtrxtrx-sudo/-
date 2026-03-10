# Guided Project Flow

Use this sequence for new products or major features.

## Stage 1 - Brainstorm

Goal:
- clarify users, jobs, constraints, non-goals, and major risks

Suggested prompt:
- Help me brainstorm this project. Identify target users, core scenarios, MVP scope, non-goals, major risks, and open questions.

Recommended Codex mode:
- `planning`

## Stage 2 - Confirm Direction

Goal:
- choose the working direction before drafting a detailed plan or implementation spec

Suggested prompt:
- Based on the brainstorm, recommend 2-3 viable directions, compare tradeoffs, and help me confirm the direction, MVP boundary, and non-goals before planning implementation.

Recommended Codex mode:
- `planning`

## Stage 3 - Brief

Goal:
- turn the approved direction into a short implementation-ready brief

Suggested prompt:
- Turn the approved direction into a brief with problem, users, desired outcome, in-scope, out-of-scope, constraints, acceptance criteria, and open questions.

Recommended artifacts:
- `docs/brief.md` using `project-brief.template.md`

Recommended Codex mode:
- `planning`

## Stage 4 - Spec

Goal:
- define architecture, flows, requirements, and verification in a durable document

Suggested prompt:
- Create a durable implementation-facing spec for this project. Cover architecture boundaries, key flows, security constraints, verification, and risks.

Recommended artifacts:
- `specs/mvp.md`
- `specs/security.md`
- `docs/architecture.md`

Recommended Codex mode:
- `default`
- switch to `research` only for live external references
- switch to `deepthink` only when the reasoning itself is hard

## Stage 5 - Repository Setup

Goal:
- add repository-local instructions and the minimum local config

Suggested prompt:
- Generate a minimal repository-level `AGENTS.md` and `.codex/config.toml` for this project based on the approved brief and spec.

Recommended artifacts:
- `AGENTS.md`
- `.codex/config.toml`

Recommended Codex mode:
- `default`

## Stage 6 - Build

Goal:
- execute the approved plan in phases with task tracking

Suggested prompt:
- `@build` Based on the approved brief and specs, break the work into phases, create continuity files only if this repository uses them, and start implementation.

Recommended Codex mode:
- `build`

## Stage 7 - Verify and Harden

Goal:
- validate behavior, permissions, migrations, and operational readiness

Suggested prompt:
- Verify the implementation against the brief and spec. List findings first, then fix the highest-risk gaps and re-run the relevant checks.

Recommended Codex mode:
- `default` for normal verification
- `review` for read-only review passes

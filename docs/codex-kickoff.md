# Codex Kickoff: My Project

Use this file as the operator checklist for the first few sessions.

## Recommended Session Order

1. Brainstorm in `planning`
2. Confirm the working direction in `planning`
3. Turn the result into `docs/brief.md`
4. Write `specs/mvp.md` and `docs/architecture.md`
5. Generate repository-specific `AGENTS.md` and `.codex/config.toml`
6. Start phased implementation with `@build`

## Copyable Prompts

### Session 1 - Brainstorm

```text
Use the planning profile and help me brainstorm My Project. Identify target users, core scenarios, MVP scope, non-goals, major risks, and open questions.
```

### Session 2 - Confirm Direction

```text
Use the planning profile and compare 2-3 viable directions for My Project. Help me confirm the direction, MVP boundary, and non-goals before we write the implementation plan.
```

### Session 3 - Brief

```text
Use the planning profile and turn the approved direction into docs/brief.md with problem, users, desired outcome, in-scope, out-of-scope, constraints, acceptance criteria, risks, assumptions, and open questions.
```

### Session 4 - Spec

```text
Based on docs/brief.md, create specs/mvp.md and docs/architecture.md. Cover architecture boundaries, core flows, security constraints, verification, and risks.
```

### Session 5 - Repository Setup

```text
Based on docs/brief.md and specs/mvp.md, generate a repository-level AGENTS.md and .codex/config.toml with only repository-specific constraints and the minimum local overrides.
```

### Session 6 - Build

```text
@build Based on docs/brief.md and specs/mvp.md, break the implementation into phases, create continuity files only if this repository uses them, and start with the first highest-value slice.
```

## Usage Notes

- Use `default` as the high-capability daily driver for ordinary development work.
- Use `research` when the task benefits from live verification and stronger source grounding.
- Use `deepthink` only when the reasoning itself is unusually hard and local analysis needs extra depth.
- Keep `AGENTS.md` short and repository-specific.
- Keep repository-local MCP config minimal and add only project-specific servers.

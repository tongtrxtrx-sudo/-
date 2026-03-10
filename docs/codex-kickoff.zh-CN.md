# Codex 启动说明：My Project

将此文件作为最初几次会话的操作清单。

## 推荐会话顺序

1. 在 `planning` 中进行头脑风暴
2. 在 `planning` 中确认工作方向
3. 将结果整理为 `docs/brief.md`
4. 编写 `specs/mvp.md` 和 `docs/architecture.md`
5. 生成仓库级 `AGENTS.md` 和 `.codex/config.toml`
6. 使用 `@build` 开始分阶段实现

## 可直接复制的提示词

### Session 1 - 头脑风暴

```text
Use the planning profile and help me brainstorm My Project. Identify target users, core scenarios, MVP scope, non-goals, major risks, and open questions.
```

### Session 2 - 确认方向

```text
Use the planning profile and compare 2-3 viable directions for My Project. Help me confirm the direction, MVP boundary, and non-goals before we write the implementation plan.
```

### Session 3 - 简报

```text
Use the planning profile and turn the approved direction into docs/brief.md with problem, users, desired outcome, in-scope, out-of-scope, constraints, acceptance criteria, risks, assumptions, and open questions.
```

### Session 4 - 规格

```text
Based on docs/brief.md, create specs/mvp.md and docs/architecture.md. Cover architecture boundaries, core flows, security constraints, verification, and risks.
```

### Session 5 - 仓库设置

```text
Based on docs/brief.md and specs/mvp.md, generate a repository-level AGENTS.md and .codex/config.toml with only repository-specific constraints and the minimum local overrides.
```

### Session 6 - 构建

```text
@build Based on docs/brief.md and specs/mvp.md, break the implementation into phases, create continuity files only if this repository uses them, and start with the first highest-value slice.
```

## 使用说明

- 使用 `default` 作为日常开发的高能力默认模式。
- 当任务需要实时校验外部信息并需要更强的来源依据时，使用 `research`。
- 仅当推理本身异常复杂且本地分析需要更深思考时，才使用 `deepthink`。
- 保持 `AGENTS.md` 简短且仓库特定。
- 保持仓库本地 MCP 配置最小化，只添加项目真正需要的服务。

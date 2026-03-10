# 引导式项目流程

在新产品或大型功能中使用以下顺序。

## 阶段 1 - 头脑风暴

目标：
- 澄清用户、工作任务、约束、非目标和主要风险

建议提示词：
- Help me brainstorm this project. Identify target users, core scenarios, MVP scope, non-goals, major risks, and open questions.

推荐 Codex 模式：
- `planning`

## 阶段 2 - 确认方向

目标：
- 在撰写详细计划或实现规格之前，先选定工作方向

建议提示词：
- Based on the brainstorm, recommend 2-3 viable directions, compare tradeoffs, and help me confirm the direction, MVP boundary, and non-goals before planning implementation.

推荐 Codex 模式：
- `planning`

## 阶段 3 - 简报

目标：
- 将已确认的方向整理成一份简短、可用于实现的简报

建议提示词：
- Turn the approved direction into a brief with problem, users, desired outcome, in-scope, out-of-scope, constraints, acceptance criteria, and open questions.

推荐产物：
- 使用 `project-brief.template.md` 生成 `docs/brief.md`

推荐 Codex 模式：
- `planning`

## 阶段 4 - 规格

目标：
- 在持久化文档中定义架构、流程、需求和验证方式

建议提示词：
- Create a durable implementation-facing spec for this project. Cover architecture boundaries, key flows, security constraints, verification, and risks.

推荐产物：
- `specs/mvp.md`
- `specs/security.md`
- `docs/architecture.md`

推荐 Codex 模式：
- `default`
- 仅当需要实时外部参考时切换到 `research`
- 仅当推理本身困难时切换到 `deepthink`

## 阶段 5 - 仓库设置

目标：
- 添加仓库本地指令和最小化本地配置

建议提示词：
- Generate a minimal repository-level `AGENTS.md` and `.codex/config.toml` for this project based on the approved brief and spec.

推荐产物：
- `AGENTS.md`
- `.codex/config.toml`

推荐 Codex 模式：
- `default`

## 阶段 6 - 构建

目标：
- 按阶段执行已批准的计划并跟踪任务

建议提示词：
- `@build` Based on the approved brief and specs, break the work into phases, create continuity files only if this repository uses them, and start implementation.

推荐 Codex 模式：
- `build`

## 阶段 7 - 验证与加固

目标：
- 验证行为、权限、迁移和运维可用性

建议提示词：
- Verify the implementation against the brief and spec. List findings first, then fix the highest-risk gaps and re-run the relevant checks.

推荐 Codex 模式：
- 常规验证使用 `default`
- 只读评审使用 `review`

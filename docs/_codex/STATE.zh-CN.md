# Codex 构建状态

## 工作流

- 模式：`@build`
- 产品：V1 企业内网文件平台
- 当前实现阶段：`post_v1`
- 当前实现焦点：在用户明确允许跳过 Phase 4 的前提下，V1 实现已经收口；当前已补齐发布评估文档，用于交接和选择下一阶段范围
- 最近一次连续性刷新：2026-03-11

## 事实来源

- 产品范围：[docs/brief.md](/D:/work/my-project/docs/brief.md)
- 架构边界：[docs/architecture.md](/D:/work/my-project/docs/architecture.md)
- MVP 需求：[specs/mvp.md](/D:/work/my-project/specs/mvp.md)
- 阶段计划：[docs/v1-phases.md](/D:/work/my-project/docs/v1-phases.md)
- 任务图谱：[docs/_codex/tasks.json](/D:/work/my-project/docs/_codex/tasks.json)

## 总体状态

- 规划基线：完成
- Phase 1 基础与身份：完成
- Phase 2 空间、文件、权限与元数据搜索：完成
- Phase 3 回收站切片：完成
- Phase 3 版本历史切片：完成
- Phase 3 配额基础设施：完成
- Phase 3 保留基础设施：完成
- Phase 4 在线编辑集成：因用户明确允许而暂时跳过
- Phase 5 公共知识发布上线加固：完成
- Post-V1 发布评估：完成

## 已完成交付

- 规划文档已完成并对齐：
  - `docs/brief.md`
  - `specs/mvp.md`
  - `docs/architecture.md`
  - `docs/v1-phases.md`
  - `docs/release-assessment.md`
- 运行时基线已完成：
  - monorepo 工作区
  - 共享 domain 包
  - Fastify API 外壳
  - React Web 外壳
  - PostgreSQL 引导
  - Docker Compose 基线
- 身份与运维基线已完成：
  - 初始超级管理员种子账号
  - 登录
  - 首次改密
  - 用户创建
  - 部门创建
  - 审计事件记录与查询
- 文件平台基础能力已完成：
  - 个人、部门和公共空间
  - 部门协作区根目录
  - 公共知识分类根目录
  - 创建文件夹
  - 上传和下载文件
  - 文件夹改名与移动
  - 文件改名与移动
  - 文件夹和文件授权共享
  - 共享列表与撤销
  - 用户目录选择器
  - 权限感知元数据搜索
- 生命周期切片已完成：
  - 文件夹删除到回收站
  - 文件删除到回收站
  - 按可管理空间列回收站
  - 从回收站恢复文件夹
  - 从回收站恢复文件
  - 文件版本快照
  - 版本列表
  - 文件内容替换
  - 恢复到旧版本
  - 默认空间配额
  - 实际占用统计
  - 配额摘要接口
  - 配额展示 UI
  - 维护概览接口
  - 回收站清理 dry-run 路径
  - 版本裁剪 dry-run 路径
  - 可执行的配额刷新路径
  - 公共知识分类列表
  - 公共知识发布接口
  - 公共知识元数据更新接口
  - 管理页公共知识发布 UI
  - 导入指导输出
  - 导入运行手册文档
  - 上线准备检查文档

## 已验证证据

- 本地验证已完成：
  - `npm install`
  - `npm run typecheck`
  - `npm run build`
- 部署验证已完成：
  - `docker compose --env-file .env.example -f deploy/docker-compose.yml config`
  - `docker compose --env-file .env.example -f deploy/docker-compose.yml up -d --build`
- 运行时验证已完成：
  - `GET /health`
  - 超级管理员登录
  - 部门创建
  - 用户创建
  - 内容浏览
  - 创建文件夹
  - 上传文件
  - 下载文件
  - 文件夹与文件改名/移动
  - 授权、查看共享、撤销共享
  - 搜索结果可见性与无权限结果跳过
  - 文件夹和文件的删除到回收站与恢复
- 文档验证已完成：
  - 已人工核对 `docs/release-assessment.md` 的双语一致性

## 已知缺口

- 当前删除只做到回收站，尚未实现保留期到期后的清理规则。
- Phase 4 仍因缺少真实 ONLYOFFICE 文档服务器而被有意跳过。
- 自动化批量导入和长期保留执行仍然超出当前已验证范围。

## 当前数据假设

- 开发环境中保留了验证过程中产生的种子和示例数据。
- 当前运行时持久化依赖 PostgreSQL 和应用文件存储的 Docker 卷。
- 由于开发数据已经存在，当前 schema 升级采用增量 SQL 和 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` 模式。

## 下一实现切片

- 当前没有正在进行的实现切片。
- 恢复 `@build` 实现前，请先在下面几项中选择一项：
  - 提供真实 ONLYOFFICE 文档服务器，恢复 Phase 4
  - 把首轮导入做成自动化执行
  - 把保留策略从当前基础设施推进到真实执行
  - 为关键链路补自动化回归测试

## 保护规则

- V1 中不要引入 AI 行为。
- 保持单机 Docker Compose 可部署。
- 保持浏览、搜索、共享、删除、回收和恢复的最小权限边界。
- 公共知识中的已归档内容默认继续对浏览和搜索隐藏。
- 在保留策略落地前，不要把硬删除语义视为完成。

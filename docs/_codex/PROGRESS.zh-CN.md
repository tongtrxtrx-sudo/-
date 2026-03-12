# 构建进度日志

## 2026-03-09 - 规划基线

- 已稳定产品规划文档：
  - `docs/brief.md`
  - `specs/mvp.md`
  - `docs/architecture.md`
  - `docs/v1-phases.md`
- 已确认执行顺序：
  - Phase 1 基础与身份
  - Phase 2 内容与权限
  - Phase 3 生命周期
  - Phase 4 编辑器集成
  - Phase 5 上线加固

## 2026-03-09 - Phase 1 基础与身份

- 实现了 monorepo 工作区和共享 domain 包。
- 实现了 Fastify API 外壳和 React Web 外壳。
- 增加了 PostgreSQL 引导和初始超级管理员种子账号。
- 增加了账号创建、首次改密、会话处理和审计事件基础能力。
- 增加了 Docker Compose 基线。

### 验证

- `npm run typecheck`
- `npm run build`
- `docker compose --env-file .env.example -f deploy/docker-compose.yml config`
- `docker compose --env-file .env.example -f deploy/docker-compose.yml up -d --build`
- `GET /health`
- 管理员登录、部门创建和用户创建

## 2026-03-09 - Phase 2 内容基础

- 增加了个人空间和部门空间的内容浏览。
- 增加了创建文件夹。
- 增加了上传和下载文件。
- 增加了最小内容浏览器 UI。

### 验证

- 创建文件夹
- 上传文件
- 下载文件
- 通过 Web 壳和 API 浏览内容

## 2026-03-09 - Phase 2 内容管理

- 增加了文件夹改名和移动。
- 增加了文件改名和移动。
- 增加了文件夹和文件共享授权。
- 增加了共享列表和撤销共享。
- 增加了文件/文件夹选中管理 UI。

### 验证

- 文件夹改名
- 文件改名
- 文件移动
- 授权共享
- 查看共享
- 撤销共享
- 撤销后访问失效

## 2026-03-09 - Phase 2 元数据搜索

- 增加了权限感知的元数据搜索，支持：
  - 文件名
  - 路径
  - 上传者
  - 更新时间
- 增加了最小搜索 UI。
- 修复了搜索行为：无权限文件会被跳过，而不是让整次查询失败。

### 验证

- 管理员可以搜索到被改名并移动后的文件。
- 在共享撤销后，非所有者搜索会返回空结果。
- Web 容器继续正常提供更新后的 UI。

## 2026-03-09 - Phase 3 回收站

- 增加了回收站 schema 和对现有开发数据友好的增量迁移逻辑。
- 增加了文件和文件夹删除到回收站。
- 增加了按可管理空间列出回收站。
- 增加了文件和文件夹恢复。
- 增加了带恢复动作的最小回收站 UI。
- 修复了无请求体请求默认发送错误 JSON 媒体类型的问题。

### 验证

- 文件夹删除到回收站
- 回收站能列出该文件夹
- 从回收站恢复文件夹
- 文件夹恢复后内部文件重新可见
- 文件删除到回收站
- 回收站能列出该文件
- 从回收站恢复文件

## 2026-03-09 - Phase 3 版本历史

- 增加了文件版本 schema 和版本快照存储。
- 增加了版本列表接口。
- 增加了会写入新版本的文件内容替换能力。
- 增加了恢复到指定版本的能力。
- 增加了基线快照逻辑，确保对已有文件第一次替换时，旧内容会先被记录成版本。
- 增加了选中文件的最小版本管理 UI。

### 验证

- 查看现有文件的版本列表
- 替换文件内容
- 确认替换后版本列表增加
- 恢复旧版本
- 确认下载内容回退到恢复后的版本

## 2026-03-09 - Phase 3 配额基础设施

- 增加了按空间类型设置的默认配额模型。
- 增加了对现有空间和新建空间的配额初始化。
- 增加了实际占用统计，拆分为：
  - 当前文件
  - 回收站文件
  - 仅版本快照占用
  - 按 `storage_key` 去重后的总占用
- 增加了空间配额摘要接口。
- 增加了当前空间的配额展示卡片。
- 修复了配额响应中的 `limitBytes` 类型，确保输出为数值而不是字符串。

## 2026-03-09 - Phase 3 保留与清理基础设施

- 增加了生命周期维护模块。
- 增加了管理员维护概览接口。
- 增加了带 `dryRun` 支持的维护执行接口。
- 增加了回收站清理候选项发现。
- 增加了版本裁剪候选项发现。
- 增加了可执行的配额刷新路径。

### 验证

- 维护概览接口返回回收站和版本候选项
- `job = quota_refresh` 的维护执行返回刷新后的配额摘要
- `job = all` 且 `dryRun = true` 时返回聚合候选集合

## 2026-03-10 - Phase 4 ONLYOFFICE 集成骨架

- 增加了 ONLYOFFICE 相关 API 配置和可选密钥。
- 增加了文件锁持久化和锁获取辅助逻辑。
- 增加了编辑会话接口、编辑内容接口、回调接口和强制解锁接口。
- 增加了受支持 Office 文件的最小前端打开器。
- 当前任务仍保持进行中，因为当前环境还没有配置真实的 ONLYOFFICE 文档服务器地址。

### 验证

- 加入编辑器骨架后，本地 typecheck 和 build 仍然通过
- Compose 配置和运行仍然通过
- 在当前环境中，`GET /editor/files/:id/session` 会返回明确的未配置提示

## 2026-03-10 - Phase 4 跳过决策

- 用户已明确允许在当前阶段跳过 Phase 4，因为还没有文档服务器。
- 仓库保留了 ONLYOFFICE 的集成骨架，供后续恢复使用。
- 当前活动实现工作已重定向到 Phase 5，同时不删除现有编辑器骨架。

## 2026-03-10 - Phase 5 公共知识切片已启动

- 增加了公共知识元数据 schema 支持。
- 增加了公共知识分类列表接口。
- 增加了公共知识发布接口。
- 增加了公共知识元数据更新接口。
- 在管理页里增加了最小发布表单和公共知识条目列表。

### 验证

- 分类列表返回了预期的知识分类根目录
- 发布接口可以基于现有文件创建公共知识条目
- 条目列表可以返回刚发布的条目
- 元数据更新可以把条目状态从 `PUBLISHED` 改成 `ARCHIVED`

## 2026-03-10 - Phase 5 导入与上线加固

- 增加了管理端导入指导输出。
- 增加了导入运行手册文档。
- 增加了上线准备检查文档。

### 验证

- 加固更新后，本地 typecheck 和 build 仍然通过
- 管理员公共知识发布运行态链路仍然可用
- 导入和上线文档已同时存在英文主文件与中文伴随文件

## 2026-03-11 - Post-V1 发布评估

- 新增专门的发布评估文档：
  - `docs/release-assessment.md`
  - `docs/release-assessment.zh-CN.md`
- 记录了当前发布结论、已测范围、未测范围、阻塞项、剩余风险和建议的发布模式。
- 明确了：只有在用户允许跳过 Phase 4 的前提下，当前 V1 才算实现收口；如果要继续推进，需要先选择新的 post-V1 范围。

### 验证

- 已人工核对新增发布评估文档的双语一致性
- 连续性文件已更新为“当前没有活动实现切片”

## 2026-03-11 - Phase 4 恢复：锁语义与回调安全

- 将 `phase_4_editor_integration` 从之前用户允许跳过的状态恢复回来。
- 增加了更细的编辑会话模式标识，让 UI 可以区分：
  - 已成功获取编辑锁
  - 已续期当前用户自己的编辑锁
  - 因他人持锁而只能只读打开
  - 因自身没有编辑权限而只能只读打开
- 把 ONLYOFFICE 回调下载 URL 限制为只能来自已配置的文档服务器来源。
- 增加了锁获取、锁续期、因他人持锁而只读打开、回调释放锁和强制解锁的审计覆盖。
- 当文件因他人持锁而只读打开时，前端为授权运维角色增加了强制解锁能力。

### 验证

- `npm run typecheck`
- `npm run build`
- 使用占位 ONLYOFFICE URL 的运行态链路：
  - 第一个编辑会话返回 `canEdit = true`，`modeReason = EDIT_LOCK_ACQUIRED`
  - 第二个有权限用户返回 `canEdit = false`，`modeReason = LOCKED_BY_OTHER_USER`
  - 强制解锁成功释放当前锁
  - 解锁后，第二个用户再次请求会返回 `canEdit = true`，`modeReason = EDIT_LOCK_ACQUIRED`
- 针对该测试文件回查到的审计事件包括：
  - `onlyoffice_lock_acquired`
  - `onlyoffice_opened_locked_view`
  - `file_force_unlocked`

## 2026-03-11 - Phase 4 真实服务接线

- 为下面两组地址增加了公网/容器内分离支持：
  - API 对浏览器暴露的地址与 ONLYOFFICE 在容器网络中访问 API 的内部地址
  - ONLYOFFICE 对浏览器暴露的地址与 API 容器访问 ONLYOFFICE 的内部地址
- 调整了编辑会话生成逻辑，使 ONLYOFFICE 的服务间流量走内部 API 地址，而浏览器继续拿到公网编辑器地址。
- 在 Docker Compose 中增加了真实的 `onlyoffice` 服务，并为其配置了独立卷。
- 更新了 ONLYOFFICE 运维文档，说明 Compose 拓扑和 URL 分离方式。

### 验证

- `npm run typecheck`
- `npm run build`
- `docker compose --env-file .env.example -f deploy/docker-compose.yml config`
- 已把 Compose 默认镜像固定为本机已存在的 `onlyoffice/documentserver:8.3`，避免继续被体积很大的 `latest` 标签首次拉取阻塞
- 真实运行态验证结果：
  - `http://localhost:8080/web-apps/apps/api/documents/api.js` 返回 `200 OK`
  - 管理员 ONLYOFFICE 状态接口返回 `configured = true` 且 `reachable = true`
  - 编辑会话返回了：
    - 浏览器编辑器地址 `http://localhost:8080`
    - 内部编辑器地址 `http://onlyoffice`
    - 浏览器 API 地址 `http://localhost:3001`
    - 容器内部 API 地址 `http://api:3001`
  - 浏览器自动化已经为一个受支持的 `.docx` 文件打开了真实 ONLYOFFICE iframe
- 保存回调排查结果：
  - ONLYOFFICE 命令服务接受了 `forcesave`，并返回 `error = 0`
  - ONLYOFFICE 实际发出了 `status = 6` 以及后续的 `status = 2` callback
  - 内容和回调 URL 的 token 有效期已经从 `15m` 提高到 `8h`
  - callback 处理已经改成数据库驱动的异步 job 队列
  - job 重试现在使用延后调度，而不是阻塞 HTTP callback
  - 测试夹具也已经替换为来自 ONLYOFFICE 自身生成的合法 `.docx`
  - 但剩余阻塞点仍然是：后台下载生成的 `output.docx` 仍然失败，而同一条标准化后的内部 URL 在失败后又能立即从 API 容器访问
  - `onlyoffice_save_failed` 审计事件已经证明失败现在是通过异步 job 延后暴露出来的
  - 直接鉴权对照实验已经确认：
    - 直接 GET 生成文件 URL 会返回 `403`
    - 使用 `Authorization: Bearer <callback-body-token>` 仍然返回 `403`
    - 把同一个 token 追加成 query 参数也仍然返回 `403`
    - 因此问题并不能通过简单转发 callback body 里的 token 来解决
  - secure-link 实验已经确认：
    - 当前运行中的 Nginx 配置校验公式是 `secure_link_md5 \"$secure_link_expires$uri$secure_link_secret\"`
    - callback URL 里的 `md5` 与按当前 `secure_link_secret` 重算出的值不一致
    - 把 URL 里的 `md5` 改成重算值后，响应会从 `403` 变成 `410`

## 当前所处位置

- Phase 1：完成
- Phase 2：完成
- Phase 3 回收站切片：完成
- Phase 3 版本历史切片：完成
- Phase 3 配额基础设施切片：完成
- Phase 3 保留与清理基础设施切片：完成
- Phase 5 公共知识元数据切片：完成
- Phase 5 导入与上线加固切片：完成
- Post-V1 发布评估：完成
- Phase 4 恢复切片：进行中

# ONLYOFFICE 集成说明

## 目的

本文档说明仓库在 `phase_4_editor_integration` 阶段如何接入自托管的 ONLYOFFICE Docs Enterprise 服务。

## 当前实现状态

- 后端编辑会话接口已存在：`GET /editor/files/:fileId/session`
- 后端文档内容接口已存在：`GET /editor/files/:fileId/content`
- 后端回调接口已存在：`POST /editor/files/:fileId/callback`
- 后端强制解锁接口已存在：`POST /editor/files/:fileId/force-unlock`
- 应用数据库中已具备文件锁持久化
- 前端已具备支持 Office 文件的最小打开器
- 在配置真实且可达的 ONLYOFFICE 服务前，无法完成真实编辑器运行验证

## 必需环境变量

- `API_PUBLIC_BASE_URL`
  - 从 ONLYOFFICE 服务器视角可访问到的 API 基础地址
- `ONLYOFFICE_DOCUMENT_SERVER_URL`
  - 自托管 ONLYOFFICE 文档服务器的基础地址
- `ONLYOFFICE_JWT_SECRET`
  - 可选，用于签名 ONLYOFFICE 会话载荷的 JWT 密钥
- `EDIT_LOCK_MINUTES`
  - 编辑锁的过期时间，单位分钟

## 当前支持的文件类型

- `docx`
- `xlsx`
- `pptx`

## 在未配置文档服务器时的当前行为

- 管理员状态接口会明确显示文档服务器未配置
- 编辑会话请求会返回清晰的配置错误，而不是静默失败
- 现有的非编辑器文件管理能力不会受到影响

## 文档服务器可用后的预期验证步骤

1. 配置 `ONLYOFFICE_DOCUMENT_SERVER_URL`
2. 配置 `API_PUBLIC_BASE_URL`
3. 如有需要，配置 `ONLYOFFICE_JWT_SECRET`
4. 重建并重启整套服务
5. 在 Web UI 中打开一个受支持的 Office 文件
6. 确认单编辑者锁生效
7. 在 ONLYOFFICE 中保存，并确认：
   - 回调被接受
   - 文件内容被替换
   - 生成了新版本
8. 使用有权限的运维账号执行强制解锁，并确认锁已被释放

## 已知缺口

- 当前环境还没有真实文档服务器
- 真实编辑器保存回调的端到端验证尚未完成
- ONLYOFFICE 的生产部署加固尚未完成

# main-v54：健康 AI 时延/超时修复发布

2026-11-13 北京时间 20:16 更新既有 CloudBase HTTP 函数成功。发布代码 `cb8f306`（本地 `main`，已含 RAG-010、RAG-011、RAG-012）；函数 `shiwei-http-preview` 超时由 20 秒提升到 **60 秒**，其余环境配置、密钥、知识引用与内容版本保持不变。

## 发布内容

- RAG-012：健康对话/选菜不再重复读取公开知识网关（单次请求约 12–14 次降到约 5 次），服务端请求预算 17s→45s，函数超时 20s→60s；不截断菜谱做法，不放宽过敏/忌口/补买/数量硬条件。
- RAG-011：用户明确表示“不知道分型”后不再重复追问，改为保留未知并说明能力边界。
- RAG-010：输出评测工具、模拟用户数据与已知断点修复（选菜数量、候选复用、覆盖状态、理由等），评测脚本不进入云端路由。
- 未包含 INPUT-003（已在 v53 回退），图片识别入口保持原样。

## 包与首次失败

首次打包误将 `artifacts/build/web/assets/recipes`（约 906MB 菜谱图）带入函数包，包体 933MB，COS 上传 60 秒超时失败，函数未变更。裁剪为与线上一致的 36.2MB（仅 `index.html`、hash 命名 JS/CSS、三张首页图）后重试成功，耗时 54 秒。

- 发布包：`.local-data/cloudbase-http/release-20261113-main-v54/`
- 证据：`.local-data/management/deployment-2026-11-13-v54/`
- 编译入口 SHA-256：`ad03c2451b377fc68f8ff3145548c6b616df416d115657311339f50aa094494e`
- 入口 HTML SHA-256：`7f380910cc4dff1c79f7f6bc0b35fd93dc1bfae7c562ebf7b26eba8fada08de6`
- 回滚包：v53（`.local-data/cloudbase-http/release-20261113-main-v53`）

## 发布后只读核验

- `/healthz` 200 `{"status":"ok"}`；`/readyz` 200，`preview_ready`，`contentVersion=gallery-listed-foods-1000-20261113-v1`。
- 首页 200；`/assets/index-CzP73qNp.js`（443,518 字节）与 `/assets/index-B-3sxG0N.css`（79,366 字节）SHA-256 与本地构建一致。
- 线上 JS 含“拍照识别/拍摄食材图片/选择图片”“图鉴搭配示例”文案，图片识别入口未回归。
- 函数 `Timeout=60`、`Memory=256`、`Status=Active`；`KNOWLEDGE_RELEASE_ID/SHA256` 仍为 `knowledge-food-guidance-20261113-v1`，内容版本仍 1000 菜谱。
- 未登录真实账户、未调用模型、未改账户资料或数据库。

## 边界与后续

- **未测真实健康 AI 时延**：需要用户个人 DeepSeek Key 与登录，本次未调用；发布只证明函数可启动、知识配置就绪与静态资源一致。
- 若真实请求仍慢，先测量知识网关往返、实例冷启动与模型耗时；不要用截断做法换速度。
- 本页不构成临床签认或整菜营养验收。
- 撤回：恢复 v53 函数包（并把函数超时改回 20 秒），不删除知识发布与内容历史，不重置账户。

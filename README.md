# 拾味 · 菜谱推荐

面向家庭做饭的菜谱应用：普通推荐、图鉴、做法、收藏、邮箱注册及加密个人设置同步；登录用户可使用个人 Key 健康 AI 对话与选菜。疾病 RAG 是独立研究能力，尚未作为正式疾病推荐开放。

[打开既有网站](https://shiwei-d2gmiun66b7dc6a4f-1512010497.ap-shanghai.app.tcloudbase.com/) · [文档入口](docs/README.md) · [项目全解与面试合集](docs/project-handbook-2026-10-30/README.md) · [Agent 设计导航](agent-design/README.md)

## 本地运行

使用 Node.js 24；在本仓库根目录执行，PowerShell 入口会选择已有的 Node.js 24：

```powershell
.\scripts\run.ps1 install
.\scripts\run.ps1 build
.\scripts\run.ps1 start
# http://127.0.0.1:4175/
```

默认运行本机构造目录；修改前端后重新构建。真实本地图鉴配置及数据库准备见[开发说明](docs/development/README.md)。当前仅本地测试，云端、真实邮件与付费模型测试保持暂停。

2026-11-05专项本地预览与5次真实RAG样例见[完整例子](agent-design/docs/business-rag-example-2026-11-05.md)，代理专项已结项；之后的[用户用量参考策略](docs/releases/ACCEPTANCE-quantity-policy-2026-11-05.md)统一按食材有无推荐，零收费验证，不改变已部署网站。

```powershell
.\scripts\run.ps1 test
.\scripts\run.ps1 test:e2e
# 需要完整本地验收时：
.\scripts\run.ps1 test:local
```

## 项目目录

多 Agent 开发先读[本地 Git 协作流程](docs/collaboration/README.md)，从[任务登记](docs/collaboration/tasks.md)领取明确范围。各 agent 从已验收本地 main 使用独立目录和任务分支提交，由管理 chat 自主审查、合并及主分支复验，不依赖 GitHub PR。

| 目录 | 职责 |
| --- | --- |
| [frontend/](frontend/README.md) | React 源码及正式静态图片 |
| [backend/](backend/README.md) | Fastify、普通推荐、账户、AI 与知识检索实现 |
| `shared/` | 前后端共享类型、Schema 与业务规则 |
| [datasets/](datasets/README.md) | 配方、来源、整理依据、研究知识和评测数据 |
| [agent-design/](agent-design/README.md) | 检索、增强、生成、记忆、存储、工作流、评测与优化设计 |
| [docs/](docs/README.md) | 当前说明、产品决定、运维、验收与受保护的面试合集 |
| [deployment/](deployment/README.md) | 云函数入口、部署配置、SQL 与示例 |
| [artifacts/](artifacts/README.md) | 构建、验收证据、评审附件、测试与临时输出 |
| [legacy/](legacy/README.md) | 完整保留的历史手写原型 |
| `scripts/`、`tests/` | 既有工具入口与测试 |
| `.local-data/` | 被 Git 忽略的本地配置、数据库和既有发布缓存 |

构建到 `artifacts/build/web/`，网站图片地址和 `/api/v1` 不变。目录整理没有执行部署、线上数据库迁移或真实模型调用；历史验收不等于新结构已通过。详见[整理记录与恢复入口](docs/maintenance/reorganization-2026-11-03/README.md)。

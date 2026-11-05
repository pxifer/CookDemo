# 开发与验证

核对日期：2026-10-30。当前功能和未完成项见[架构说明](../architecture/overview.md)，文档索引见[文档入口](../README.md)。

当前按用户要求仅运行本地测试：`scripts/run.ps1 test`为常规本地回归，`scripts/run.ps1 test:local`为本地20组完整检查。复用已有本地PostgreSQL/Docker和模拟邮箱/模型，不需要CloudBase测试环境，也不读取真实Key。测试入口包含公网HTTP拦截、数据库回环校验及浏览器外网阻断；云端与付费测试继续暂停。详见[资源保留](../operations/resource-preservation.md)。

## 安装与构建

需要 Node.js 24 LTS，依赖版本由 `package-lock.json` 锁定。PowerShell包装脚本优先使用系统Node 24，不符合时尝试已安装的Codex Node 24，不下载运行时。

```powershell
.\scripts\run.ps1 install
.\scripts\run.ps1 build
.\scripts\run.ps1 start
```

默认地址为 `http://127.0.0.1:4175/`。默认内容是构造回归目录，不冒充线上已发布目录。构建输出为 `artifacts/build/web`；`legacy/prototype` 是手写历史原型，不删除、不覆盖。`dev` 与 `start` 都通过Fastify提供已构建页面，修改前端后要重新构建。

标准Node 24环境也可直接使用 `npm ci`、`npm run build`、`npm start`。接口以 `/api/v1` 为前缀，共享Schema由构建脚本预编译为浏览器校验器。

## 配置与运行模式

配置模板见 `.env.example`。默认不自动读取 `.env`，需要时显式加载：

```powershell
.\scripts\run.ps1 start -EnvFile .env.local
```

- `backend/src/main.ts`：本机和原生PG运行入口，配置校验见 `backend/src/config.ts`。
- `scripts/business-local.ps1 -Task Start -Port 4180`：使用已有 `.local-data/deployment/business-local.env` 启动本地图鉴路径。首次数据库准备及指定构造发布版本见[本地运维](../operations/DEPLOYMENT-RUNBOOK.md)。
- `deployment/cloudbase/http-main.ts`：当前已部署的HTTP函数入口，使用CloudBase公开发布包/Data API及真实账户适配；不是本机构造启动脚本的同义命令。
- `LOCAL_TEST_FEATURES=1`：仅在本机启用明确标识的测试身份，不能代替云端真实注册/账户，也不能开启经审核的健康推荐。
- `MODEL_ENABLED=0` 为默认。模型接口准备、密钥、账本及真实联调边界单独见[模型API](../../agent-design/generation/health-model-api.md)。

真实Key、资料加密密钥、会话密钥和连接串只放Git忽略的受控配置，不提交、不打印。沿用既有数据库和部署密钥；修改文件不会自动更改数据库密码。

## 验证命令

```powershell
.\scripts\run.ps1 build
.\scripts\run.ps1 test
.\scripts\run.ps1 test:e2e
# 构建、常规测试、知识校验、四组浏览器及六组真实PG专项
.\scripts\run.ps1 check
```

当前执行隔离若拒绝回环端口或Docker管道，报告会记录`permission_blocked`并继续其他阶段。你可以在普通PowerShell运行`.\scripts\verify-in-terminal.ps1`补测；退出码2表示未完成，1表示失败。先核对本地隔离库配置，不能把正式连接串用于测试。下一阶段新增账户/业务恢复工具、真实AI预算与发布门禁的前提见[执行说明](../operations/validation-status.md)。

常规测试包含领域、API、PGlite与构造模型响应，不能据此声称真实云PG并发、外部模型或健康效果通过。浏览器使用独立Microsoft Edge测试上下文；不访问用户个人浏览器资料。具体视口、端口与启动环境以相应 `playwright*.config.ts` 为准。

按修改范围选择专用配置，不把所有历史配置当作每次必跑项：

| 范围 | 命令入口 |
| --- | --- |
| 原生PG迁移/并发机制 | `npm run test:postgres` |
| 本地数据库业务 | `npm run test:business:postgres`、`npm run test:business:e2e` |
| 工作台/续接UI | `npm run test:ui:e2e`、`npm run test:resume:e2e` |
| CloudBase迁移 | `npm run test:cloudbase`，仅按相应显式测试环境执行 |
| 已部署网站与账户 | `playwright.cloudbase.config.ts`、`playwright.account-cloud.config.ts` 及专项核验脚本；先核对目标和构造测试账号 |

数据库、账户和线上用例有环境及数据前提，缺少条件时记录未运行，不自动创建云资源或使用真实个人资料补测。

## 保存验收证据

为本轮使用独立目录，避免覆盖历史结果：

```powershell
$env:ACCEPTANCE_DIR='artifacts/acceptance/本轮任务名'
.\scripts\run.ps1 test:e2e
.\scripts\run.ps1 capture:evidence
```

截图和结构化结果对应执行时的代码/数据版本；源码指纹和OpenAPI不是功能正确性的替代证明。文档清理只需检查链接、引用及相关文档工具，无需重复整套业务测试。

## 日常维护

当前产品规则以[AGENTS.md](../../AGENTS.md)、[架构](../architecture/overview.md)和适用的[决策](../product/decision-log.md)为准；不要继续引用旧“17道构造目录/无账户/云尚未上线”的推进快照。配方原始数据在 `datasets/recipes/curation`、`datasets/recipes/sources`，当前食品级发布与最新验收从[文档入口](../README.md)进入。

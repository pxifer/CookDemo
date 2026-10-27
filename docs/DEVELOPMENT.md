# 本地开发交付 v0.1

> 2026-10-27：健康模型查询准备接口已新增，默认关闭、供应商未指定，配置/账本/云入口边界见 [HEALTH-MODEL-API.md](HEALTH-MODEL-API.md)。下文“无供应商适配器”和早期账户/目录数量是当时快照；当前规则见 [AGENTS.md](../AGENTS.md)。RAG准备见 [health-rag-plan.md](technical/health-rag-plan.md)。

> 2026-10-20 上线结构增量：已补配置/数据库启动依赖、版本迁移和容器文件，详见 [结构操作手册](DEPLOYMENT-RUNBOOK.md) 与 [实施记录](DEPLOYMENT-STATUS.md)。原默认命令继续为本地构造模式；`scripts/run.ps1 -EnvFile` 可显式加载配置，未加该参数仍不自动读.env。真实建库、容器和云部署是否完成须看实施记录，不由下文历史描述推断。

日期：2026-10-19（Asia/Shanghai）。依据：PRD、TDD v0.1、D0～D6A、UI_DEMO_REVIEW 与 architecture-review-v0.1。本次用户明确授权开发、交付前测试验收；开发不是云资源创建或收费调用授权。

## 运行

需要 Node.js 24 LTS；已在 Windows 的 v24.19.0 验证。依赖采用精确版本与 package-lock.json。Windows 启动脚本会优先检查系统 Node，版本不符时尝试使用已安装的 Codex Node 24，不会下载运行时或修改系统安装。

```powershell
cd D:\codex_AI\菜谱推荐\CookDemo
.\scripts\run.ps1 install
.\scripts\run.ps1 build
.\scripts\run.ps1 start
# http://127.0.0.1:4175
```

标准 Node 24 环境也可使用 `npm ci`、`npm run build`、`npm start`。服务只监听 127.0.0.1。未接入任何模型或云端账户，不需要 API Key。变更前端后重新构建；当前 `dev` 与 `start` 都启动 Fastify 并提供已经构建的页面，没有声称具备热更新。

```powershell
.\scripts\run.ps1 test
.\scripts\run.ps1 test:e2e
# 一次运行构建、领域/API/数据库测试和浏览器验收
.\scripts\run.ps1 check
```

浏览器测试依赖本机 Microsoft Edge，使用独立临时上下文，桌面 1440×1000、手机 390×844。无重试掩盖失败。未安装 Edge 的环境需要显式调整 channel；不自动下载或切换用户的浏览器配置。受限沙箱可能需要允许本机 loopback 连接。已有线上原型保持原部署方式，不把本工程静态构建直接部署成已有云后端。

## 代码布局与状态

| 位置 | 职责与完成边界 |
| --- | --- |
| `src/` | React + TypeScript 工作台、草稿/默认/演示隔离、本机收藏、健康未开放出口；生产构建在 `build/web` |
| `shared/` | 类型、JSON Schema、构造内容、局部词典辅助提取、单位与营养计算 |
| `server/app.ts` | 同源 Fastify、JSON 运行时校验、CSRF/来源、本机游客会话、真实进度 NDJSON 和唯一终态 |
| `server/recommendation.ts` | 全目录资格检查、业务排序、父菜谱归组、有限搜索、单换/变体和最终检查 |
| `server/migrations/`、`db.ts`、`repository.ts` | PostgreSQL 迁移与加密资料 CAS 仓储；以 PGlite 执行真实 PostgreSQL 语法测试，尚未接入云数据库或开放账户资料路由 |
| `server/gateway.ts` | 模型操作不可变绑定、原子认领和共享尝试预算的数据库机制；没有实际供应商适配器或生产调用路径 |
| `server/health.ts` | 完整规则发布清单的验证机制；没有正式健康规则、阈值或审核签认 |
| `server/erasure.ts` | 持久清除任务与幂等推进、恢复证据门禁；外部撤销日志和认证删除通过依赖注入验证，未完成真实恢复演练 |
| `tests/` | 可复跑的领域、API、数据库与浏览器验收 |
| `acceptance/` | 本轮证据；历史 `review-assets/` 保持原样 |
| `dist/` | 原始手写原型，未覆盖、未重新构建，历史 B01～B06 仍属于其旧实现 |

构建前将共享 Schema 预编译为 `src/meal-validator.js`；浏览器不运行 Schema 编译器，因此 CSP 无需 `unsafe-eval`。生成文件需随源代码保存，也可由构建重新生成。原型图片复用到 `public/assets/`，来源见 ASSETS.md；无外部字体、统计脚本或 CDN。构建目录不是原型 dist。

## 已确认行为及实现细化

- 用户本轮确认：默认目标**一荤两素**，按食材和可核实库存调整；不自动补买或放宽限制。当前算法先争取三道，再减少与该目标的分类偏差。自定义每项需明确填写，留空不自动补值，也不据此替用户决定留空语义。
- 用户本轮确认：**家常优先，同层少补买优先**。候选先完成全目录资格检查，再排序/归组/分页，不能被前 30/60 项截断。当前“少补买”的技术比较量为需补买项目数，不假设价格或跨单位重量可比；进一步成本权重仍可独立确认。
- 库存仅在食物、形态、单位、计量基准一致时比较；毛重、带骨/带皮、熟制、未确认基准和克/个不兼容均标未核实。基准选择可选，不自动赋予平均可食率。最多保留三位小数，精确比例转成千分整数计算差额。
- 本地词典是有限范围的录入辅助，所有输出待确认；保留原文和未解析片段。它不冒充已完成的真实模型识别，复杂自然语言质量尚未验收。含否定/允许的限制不能自动撤销旧项。
- 不保存个人候选、最终推荐或原始照片；浏览器自动保存合法的本餐草稿。无效人数等编辑值不覆盖最近的合法草稿，刷新恢复最近合法版本。存储被禁用时显示提示。演示不保存到真实草稿、默认或收藏。
- 不做跨请求候选缓存优化，当前直接完整重算。单换和单菜变体通过受控 ID 保留其他菜并重新核验全套。将来增加复用时仍需独立对照。
- 推荐搜索本地起点为 20,000 节点、1,500ms，每 128 节点让出事件循环；这些是开发配置，不是生产服务指标。预算耗尽标搜索未完成；已核验小套餐可发布，取消不提交结果。
- 游客会话与限流/最新操作元数据为当前进程内临时数据，重启丢失可重算。没有把此机制当作跨实例模型费用账本。模型费用机制独立由 PostgreSQL 操作表承担，目前未对外启用。
- 本机草稿冲突先暂停推荐，由用户选择载入其他页面版本或保留当前编辑；账户缓存、退出清理与跨账号切换尚未进入真实资料联调。

## 仍需完成的接入与开放

| 门槛 | 缺失材料/实现，及影响 |
| --- | --- |
| G-01 正式内容 | 17 父菜谱/34 变体和食品关系仅为项目构造测试包；未获正式准入。营养值全部保持缺项；需逐记录核验来源、许可、食物映射及成分完整性。不是在 24 道旧 Demo 上换上正式标签 |
| G-02 真实识别 | 无已准入供应商账号/型号/地域/保留和免费硬停证明；真实照片入口不上传，图片 API 返回未准入，复杂文字模型接入和独立质量集待完成；不调用用户 Key |
| G-03 云端零账单 | 原有免费云计费冲突未关闭，本轮未开资源、未部署、未升级套餐 |
| G-04 账户和恢复 | 数据库/加密/清除机制已实现局部测试，真实认证适配、账户 API/前端同步合并、凭证管理界面、独立撤销记录持久化及最新水位证明仍未完成。PGlite 和注入桩不证明云 PostgreSQL 多连接锁、认证或全系统恢复 |
| G-05 质量容量 | 已测有限构造回归和本机进程内性能；未测模型效果、真实内容召回、云冷启动、负载/并发/费用和完整端到端指标；200 条检索评估未运行 |
| G-06 健康开放 | 没有专业审核、正式规则/疾病组合支持、不可变签认发布和真实营养来源；只有机制负例，正式健康结果保持关闭 |

这是一份**可运行并已验证本地范围的开发交付**，不是全量 PRD 完工或上线验收。尚未完成的正式能力保留需求，不用构造成功替代它们。相关未决项与 AR-M03～06 的开放停止点继续有效。


## 2026-10-20 界面调整

当前交互以决策日志 D7-04～07 为准：食材直接使用，过敏/忌口分别确认，开启补买自动显示更多菜谱。原有示例食材及演示实验室入口已移除。常用设置在个人设置中主动保存。旧文档中的演示测试结果为历史记录，旧 dist 原型仍原样保留。

本轮验证报告：[ACCEPTANCE-product-ui.md](ACCEPTANCE-product-ui.md)。设置 `$env:ACCEPTANCE_DIR='acceptance/product-ui'` 可将浏览器截图、结果和源码指纹保存在本轮证据目录，避免覆盖历史验收材料。

## 本机测试登录与健康流程（2026-10-20）

用户明确当前只供自己测试。需要本机测试功能时，在启动服务的 PowerShell 中设置开关：

```powershell
$env:LOCAL_TEST_FEATURES='1'
.\scripts\run.ps1 start
```

`.env.example` 仅为配置示例，服务不会自动读取 `.env`。未设置或值不为 `1` 时默认关闭。服务仅监听 `127.0.0.1`，不要以此测试身份对外部署。

页面右上角“我”→“登录”→“登录测试账号”；也可点“健康模式”→“登录并开启健康模式测试”。不需要密码，不连接 CloudBase。测试会话 30 分钟有效、服务重启失效；失效后刷新页面重新登录。退出会关闭健康模式，本餐食材及本机收藏保留。这是同一浏览器的测试身份，没有正式账户资料、云同步或跨账号合并。

健康设置允许添加名称、切换模式并运行推荐流程；结果明确显示尚未按疾病规则筛选，不能作为健康适宜性结论。正式认证与健康审核门槛仍未通过。收藏按钮现在显示空心/实心和文字反馈，卡片使用更深的绿色/红色。

浏览器测试服务器显式启用本机测试开关；API 测试同时覆盖默认关闭与显式开启。运行 `test:e2e` 前停止已占用 4175 端口但未开启测试功能的服务。验收见 [ACCEPTANCE-favorites-health.md](ACCEPTANCE-favorites-health.md)，证据使用 `ACCEPTANCE_DIR=acceptance/favorites-health`。

## 人数与菜数调整（2026-10-20）

当前人数/菜数行为以 D7-10～13 为准，替代旧的固定三道和合计1～6道。自动搭配结合人数参考、主料种类及用量，上限20道；“几个人吃”旁可查看1～12人的完整参考表。自定义填0表示该类不需要，合计1～20道；取消后不再校验旧值。自定义+允许补买生成整套餐，自动+允许补买继续候选分页。现有目录17道的类别覆盖不足以满足任意20道组合，页面会说明缺口。

`tests/planning.test.ts` 覆盖人数参考、软目标、已填量估算/未知量、20道生成/差额/单换、目录覆盖、不同用量变体及运行时契约。证据目录 `acceptance/meal-planning`，报告见 [ACCEPTANCE-meal-planning.md](ACCEPTANCE-meal-planning.md)。重跑命令与前述相同，设置 `$env:ACCEPTANCE_DIR='acceptance/meal-planning'` 后运行浏览器测试和 `scripts/capture-evidence.ts` 即可另存证据。

## 人数只影响菜数（D7-14）

单道做法和用量固定，不随人数放大；营养、库存和补买按标准整道菜计算，多道菜累计。人数只调整自动配菜数量参考。做法和收藏不显示人数，收藏复查不依赖人数输入是否完整，但继续执行食材和饮食限制核对。原“按人数缩放/复查”的文档描述为历史状态，现以 D7-14 为准。报告见 [ACCEPTANCE-fixed-recipe.md](ACCEPTANCE-fixed-recipe.md)，证据目录 `acceptance/fixed-recipe`。

## CloudBase空结构（2026-10-21）

官方CLI已登录，云端26张表/vector0.8.2和权限已核验；应用/真实账号未开放。`.\scripts\cloudbase.ps1` 默认Inspect，只查询已绑定免费环境；另有Plan/History/Apply/Login，具体前置与使用见 [操作手册7.1](DEPLOYMENT-RUNBOOK.md#71-已落地的cloudbase数据库命令)。

新增 `db:cloudbase:prepare` 生成/校验CloudBase原子迁移；`test:cloudbase` 需显式 `RUN_DOCKER_CLOUDBASE_TESTS=1`，仅在本机Docker创建随机隔离库、事务内模拟客户端角色，验证冲突/checksum/重跑及ACL/RLS/向量回滚，结束清理。本地0.8.7和云端0.8.2的证据分别记录，不将管理SQL通道当作Node原生连接或完整发布通过。

`cloudbase.ps1 -Task Capabilities` 只读输出底层网络及SSL/账号/备份计划的可查询状态，拒绝访问按unknown记录，不视为能力不存在。`.\scripts\backup-encrypted.ps1 -VerifyRestore` 创建本机加密空结构归档并恢复演练；`-Archive <已有swbk路径>` 单独核验恢复，秘密目录保持Git忽略。仅schema-only/空库，不支持真实资料灾备。详见 [操作手册8.1](DEPLOYMENT-RUNBOOK.md#81-当前推荐加密结构归档)。归档测试随 `scripts/run.ps1 test` 执行，本轮62项通过；没有新增依赖或云服务。


## 本地数据库业务（D9-01）

当前主入口为scripts/business-local.ps1：Prepare准备独立构造库及发布v1，Start在127.0.0.1:4180运行；原4175为内存构造回归入口。食材/营养/步骤/变体及React详情实际读取PG，模型、真实账户与健康未接通。

scripts/run.ps1 test为常规测试；显式设置RUN_BUSINESS_POSTGRES_TESTS=1后运行test:business:postgres，只创建并清理本次随机测试库。BUSINESS_BROWSER=1配合test:business:e2e使用独立4181服务和真实构造PG；测试结束停服务、保留持久业务库。本轮66项常规、7项真实PG（含父项）及8+32浏览器通过，详情及重跑命令见 [业务验收报告](ACCEPTANCE-local-business.md)。


## 中断续接与图鉴推荐（2026-10-23，D13）

本机联动入口：`.\scripts\business-local.ps1 -Task Start -Port 4176`，默认local-business-gallery-v1。它只读现有图鉴147条/145道及local-business-community-v1，需已有本地Docker数据库；不进行发布或迁移。原构造目录仍可显式指定`-Release local-business-ui-v2`，3道目录可指定`-Release local-business-community-v1`。

打开`http://127.0.0.1:4176/`、`/recipes`及`/favorites`。空食材时勾选允许补买可查看完整候选；仍应用当前过敏/忌口/口味等条件，未核对配方不会冒充适用。图片入口仅本页预览，不调用识别。

现有构建/常规回归命令保留；服务启动后用`.\scripts\run.ps1 test:resume:e2e`验证本轮五个桌面/手机场景。原工作台回归为`test:e2e`；真实数据库旧目录回归用`BUSINESS_BROWSER=1`和`test:business:e2e`。本轮状态及证据见[续接验收](ACCEPTANCE-resume-2026-10-23.md)。

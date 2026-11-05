# 基础 RAG 本地运行与验收

本页随实现维护。以下接口对应本轮实现约定，参数与实际可执行状态以 CLI 帮助、实现代码和验收记录为准；未产生真实报告前不能标记已跑通。

## 前提与目录

- 在 CookDemo 仓库根目录运行，使用 Node.js 24。保留既有依赖锁及普通推荐/账户功能。
- 使用现有本地 PostgreSQL/pgvector 的独立研究数据库 `shiwei_rag_research`；连接只允许回环地址及明确研究库名，不能切换正式库补证据。连接文件为 `.local-data/rag/database-url`，不打印其中内容。
- Python 推理环境、公开权重、模型 revision 与本地配置位于 Git 忽略的 `.local-data/rag/`；不使用全局 Python 环境混装。
- Embedding 服务仅绑定 `127.0.0.1:15199`，一次加载一个模型；通过 `GET /health` 返回真实模型身份，`POST /embed` 按 query/document 角色编码。Node 通过 `LocalEmbeddingProvider` 校验返回身份与向量。
- 研究产物写新目录，例如 `artifacts/acceptance/rag-2026-11-04-*`，不覆盖历史报告。

## 顺序

| 步骤 | 入口 | 核对 |
| --- | --- | --- |
| 环境准备 | `scripts/rag-runtime.ps1 -Task Prepare/Download/Start -Model qwen/bge`、`npm run rag:prepare` | CPU 模型可加载，vector 扩展可用，连接非生产 |
| 建库 | `npm run rag:index` | 原始知识包 hash 不变；全部证据向量、文本 hash、identity 和索引 manifest 一致 |
| 查询 | `npm run rag:query` | 明确 question/context；A1、dense 或 hybrid；证据与条件可追溯 |
| 对照评测 | `npm run rag:evaluate` | 相同数据/条件比较三组；统计召回、完整率、延迟与失败，不补默认条件 |
| 最小闭环 | `npm run rag:smoke` | 默认为 extractive fixture；真实生成要求 `--live`、`RAG_ALLOW_LIVE=1` 和 active 专项授权，只发送登记的公开案例 |

### 首次准备与模型切换

```powershell
.\scripts\rag-runtime.ps1 -Task Prepare
.\scripts\rag-runtime.ps1 -Task Download -Model qwen
```

在第一个终端启动服务。`Start` 前台运行，用 `Ctrl+C` 停止：

```powershell
.\scripts\rag-runtime.ps1 -Task Start -Model qwen
```

保留服务终端，在第二个终端执行数据库准备与建索引：

```powershell
npm run rag:prepare
npm run rag:index -- --index-id qwen-evidence-v1
```

`Prepare`/`Download` 与 `Start` 分开：下载阶段可联网获取公开权重，服务启动后强制离线，只加载本地模型，不调用 DeepSeek。锁文件为 `.local-data/rag/models/{qwen|bge}/model-lock.json`，记录 model ID/revision；`download-manifest.json` 保存实际下载文件 hash，snapshot 位于 `snapshots/<revision>/`。

脚本没有 `Stop` 任务。先在原终端 `Ctrl+C`，再 `Start -Model bge` 才切换模型；本机 CPU 建议顺序加载。两模型分别使用不同 `--index-id`，切换后核对 `/health` 并新建 Node provider，不能以 BGE query 向量查询 Qwen 索引。服务默认 token 上限 8192、CPU threads 6；这是本机运行配置，不是所有候选模型的理论最大上下文。

查询支持 `--question`、`--context`（一段 JSON）和 `--index-id`；只传当前问题明确给出的条件。默认 `rag:query` 与 `rag:smoke` 使用 extractive fixture，它们可以验证真实向量/检索/上下文，但**没有调用生成模型**。真实生成同时要求 `--live`、`RAG_ALLOW_LIVE=1` 和 active 专项授权；query 只接受登记的公开 `--case-id`，smoke 只选择登记的公开案例，两者均拒绝同时传任意 `--question` 或 `--context`。不得将 fixture 结果记录成真实端到端通过。

推荐先选择问题明确的公开来源研究样例：成人高血压与食盐、成人高脂血症与不饱和脂肪/全谷物/低脂奶、无复杂合并症成人肥胖与含糖饮料、明确原发性且无复杂合并症的骨质疏松与膳食钙。每题独立传入必要条件，不能从上一题继承。

## 必须检查的报告

1. 索引：bundle ID/hash、模型/revision、维度、pooling、指令、归一化、表示版本、完整行数与新进程回读。
2. 检索：问题及显式条件、模式、候选 fact/evidence、排名、条件状态、必需支持/限定证据、冲突与撤回水位。
3. 增强：实际注入的原文、出处、条件、缺口和预算；预算不够时不能丢限定证据。
4. 生成：真实供应商 request ID/model/usage、完整终态、回答与引用检查、人审结论和未测事项；Mock 不生成假凭证。
5. 失败：缺条件→待确认；必需证据缺失/撤回→证据不足；模型/协议/索引异常→不可用；不自动重试或静默回普通推荐。

## 本轮真实调用

2026-11-04 用户批准本轮上限 **5 元、最多 50 次调用**；失败也计次数，无自动重试。先从少量样本开始，达到次数或保守金额预留上限即停止。真实授权仅用于本轮公开证据/构造问题，不恢复其他云端或付费验收。

本轮已完成 6 次真实调用，专项授权已关闭；结果见[执行报告](execution-2026-11-04.md)。剩余额度不授予后续继续调用权限，不得自行重开授权或重置账本。

专用测试 Key 仅从 Git 忽略的受控文件读取，不在命令行粘贴、不打印、不复制到账户资料或报告。不借用用户账户已保存的个人 Key。真实调用使用固定 DeepSeek 地址/型号，无任意重定向、无自动充值；费用按当日核验价目作保守预留，实际 usage、未知消耗与估算费用分开记录。

## 完成与边界

只有真实文档/query 向量、PG 持久化及回读、真实召回、实际上下文、真实 DeepSeek 回答和引用复核都具备，才能记录基础 RAG 端到端通过。纯本地模拟是必要契约检查，不能替代最后一步。

研究结果始终不开放产品疾病发布；正式前端、全目录健康菜谱、临床签认、云端并发与完整灾备不因本地闭环通过而完成。问题定位从[技术决策](technology-decisions.md)、[构造验收集](../../datasets/evaluation/rag-acceptance-v1.json)和本轮实际报告进入。

## 本轮实际入口与授权状态

- 任意交互问题默认只运行离线抽取夹具，问题/条件/输出保存在 Git 忽略的 `.local-data/rag/queries/`，不写公开验收目录。
- 真实调用同时要求 `--live`、`RAG_ALLOW_LIVE=1` 和未关闭的专项授权；只允许 `--case-id` 登记的公开构造案例，拒绝同时传任意 `--question` 或 `--context`。
- 本轮已完成 6 次真实调用，专项授权已关闭；后续真实调用必须按新的明确授权更新受控配置，不能自行改回 active 或重置账本。
- 例：`scripts/run.ps1 rag:query -TaskArguments @('--index-id','qwen-evidence-v1','--case-id','dev-ht-salt')` 为不收费的夹具查询，需先启动匹配的 Qwen 服务。
- 实际索引名为 `qwen-evidence-v1` 与 `bge-evidence-v1`；默认索引记录位于 `.local-data/rag/current-index.json`，模型切换时必须核对一致。
- 旧共享 PGlite 的撤回会在每次 CLI 运行时追加同步到 PG 研究库；不会清空任一撤回集，本轮旧库实际撤回数为 0。
- 召回统一先做实体与条件核对，再在事实层使用加权 RRF（常数60、词法权重2、dense权重1）；限定证据闭包不能被预算截断。这些是当前工程参数，不是医疗阈值。
- 本轮 27 题已用于定位检索缺陷并回归，不再称为盲测或独立质量评测；首轮失败报告保留。普通词法基线在该小集合已很好，不能把加入向量直接写成质量提升。

## 业务 RAG 本地研究

对应[契约](business-rag-plan.md)、[执行记录](business-rag-execution-2026-11-04.md)与 TODO A 项。该路径以直接食物/做法指导增强实际选菜，新增目标未向量化，不要求启动Embedding服务。

```powershell
# 内存provider + 既有2道研究配方，供应商为构造fetch
.\scripts\run.ps1 rag:business:evaluate
# 真实本机研究PG + 已校验的341道公开缓存目录，无收费
.\scripts\run.ps1 rag:business:evaluate -TaskArguments @('--pg','--gallery','--output','artifacts/acceptance/business-rag-2026-11-04/recheck')
# 真实页面/API代码 + 构造账户、provider和供应商；桌面/手机
.\scripts\run.ps1 test:rag:e2e
```

`--pg` 只允许 `.local-data/rag/database-url` 指向回环 `shiwei_rag_research` 或 `shiwei_rag_test_*`；追加研究004表，不执行线上迁移。启动时验证本地v2/目标manifest，将新目标与映射快照写PG并回读比较载荷，内存provider使用该版本查询；每次取指导/最终返回核验撤回。旧PGlite撤回追加合并，不重置。

`--gallery` 明确读取已有 `.local-data/cloudbase-http/listed-foods-20261026-v28` 的公开bundle及manifest；缺失或hash不符报错，不联网补取。不是当前云目录承诺。评测不支持 `--live`，不读取用户Key，不用既有6次真实问答声称新选菜生成通过。12题已调试、未独立人审，报告保留此状态。

实际原生入口需显式 `RAG_BUSINESS_RESEARCH=1`、`APP_ENV=local`、回环 `HOST` 及回环 `APP_ORIGIN` 才创建provider；没有开关时保持既有路径。开关本身不安装账户/Key服务；现有账户适配器衔接在本地夹具中验证。研究食材对话无需模型，主动选菜仍沿用Key/调用认领；本轮验证必须走上述构造供应商入口，不能借研究开关重开真实调用。

浏览器端口默认沿用4198，可显式设置 `HEALTH_CHAT_TEST_PORT=15199`；先停止占用该端口的Embedding服务，不能复用未知服务。测试入口固定local、公网拦截、无自动重试；不要启动两个同端口套件。截图与报告目录可通过 `HEALTH_CHAT_ACCEPTANCE_DIR` 指定。

## 2026-11-05 用户手动真实模型预览

用户已明确允许在界面输入个人Key并主动查看真实选菜，区别于关闭的旧脚本预算；代理不自动发起收费请求。预览入口为 `scripts/preview-rag.ts`，需Node24和 `LOCAL_RAG_PREVIEW=1`，可用 `LOCAL_RAG_PREVIEW_PORT` 改端口，默认15199，仅绑定127.0.0.1。不能在离线测试包装器中运行它。

入口校验已有公开缓存manifest并读取341道菜，研究知识来自本机PG；账户/邮箱使用隔离的本地夹具，Key和档案按既有逻辑加密，但仅在本进程有效，停止后清空。固定预览账号 `rag-preview` / `RagPreview!2026`，不预置模型Key。知识对话不调用生成；主动选菜、重推、换菜使用当前用户保存的Key真实调用固定DeepSeek，失败不重试。页面顶部明确提示真实调用与临时存储。

```powershell
$env:LOCAL_RAG_PREVIEW='1'
$env:LOCAL_RAG_PREVIEW_PORT='15199'
# 使用Node24运行；不加载 .env 或评测Key，不经过离线测试包装器
node --import tsx scripts/preview-rag.ts
```

完整公开例子的检索与提示可用 `scripts/trace-business-rag.ts` 重建；它在网络发送前停止，不读个人Key、不生成模拟回执。实际模型结果只有用户主动运行后才具备，不能把该准备报告记成真实生成完成。

同日用户随后明确授权代理操作已保存的Key，上限1元；本轮已完成5次真实调用。`LOCAL_RAG_PREVIEW_BUDGET=1` 启用正常请求包装器，沿用 `.local-data/rag-preview/budget-20261105-cny1.json`，按字节上界/输出上限及已核验高峰价先预留；失败保留预留，无自动重试，损坏或缺失已有账本不能自动重置。原始调用体与响应仅存在该Git忽略目录，不记录headers/Key；摘要及完整例子见[真实界面例子](business-rag-example-2026-11-05.md)。当前模型只提交目录ID及本餐说明，证据绑定由程序形成；合格菜无健康依据时保留判断继续选菜。

代理本轮专项已结项，不自动花费剩余额度；服务保留供用户主动预览。之后追加的用量策略仅做零收费检查：当前前端发送前去除参考量，后端源码也有同一规则；现有预览进程为保留已保存Key没有再次重启，原始API客户端需下次正常启动才加载后端新规则，详见[验收说明](../../docs/releases/ACCEPTANCE-quantity-policy-2026-11-05.md)。不可为了复用Key捕获调试器账户对象。

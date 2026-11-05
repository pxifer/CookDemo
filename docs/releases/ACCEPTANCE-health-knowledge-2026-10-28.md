# 权威来源疾病研究知识库验收

日期：2026-10-28（Asia/Shanghai）。用户本次要求从权威论文或国家机构公开内容按既有RAG要求建库，并明确高血压、糖尿病、痛风同步建立。交付版本：`health-kb-2026-10-28-v1`。

## 实际交付

已建立[来源与使用说明](../../datasets/health/README.md)、[完整JSON知识包](../../datasets/health/2026-10-28-v1/knowledge-bundle.json)、[CSV关系表](../../datasets/health/2026-10-28-v1/relations.csv)、JSONL分表、运行时Schema、独立研究数据库结构、导入和查询命令。没有仅交一份未来设计或链接清单。

| 内容 | 数量 |
| --- | ---: |
| 权威来源 | 7 |
| 疾病实体 | 4（高血压、成人2型糖尿病、痛风、高尿酸血症） |
| 成分实体 | 14 |
| 食品实体 / 食品类实体 | 65 / 11 |
| 工艺实体 | 9 |
| 证据片段 | 53 |
| 疾病—成分作用 | 15 |
| 食品—成分关系 | 73（含25条分类、14条实测） |
| 食物/工艺指导关系及规则草稿 | 58 |
| 烹调变化事实 | 9 |
| 全部关系 | 155 |
| 冲突/差异记录 | 4 |
| 正式健康发布 / 真实菜谱绑定 / 向量索引 | 0 / 0 / 0 |

来源为四份国家卫健委指南/原则、Kaneko 2014嘌呤成分资料、Shinoda 1982烹调实验摘要及美国NCI高温烹肉说明。全部来源链接、适用范围和使用条件已列在知识库说明。论文资料只提取首批已核验记录，没有宣称导入全部270项食品、完整实验参数或任何付费数据库。

本地持久化库实际位置：`CookDemo/.local-data/health-knowledge/2026-10-28-v1/`。[落库结果](../../artifacts/acceptance/health-knowledge-2026-10-28/local-import.json)中的bundle序列化SHA256为`e925765844bd9a0e3e74e90d8cb0c12ebd2807d08e5001b0912af9230e5dc9ee`。JSON文件自身的字节hash由[manifest](../../datasets/health/2026-10-28-v1/manifest.json)管理，二者因序列化空格不同不应混为同一hash。原始PDF/HTML仅在本机临时核对目录，未打包分发。建库期间一次较早的本地草稿保留于`draft-before-directness/`，不作为交付库。

## 已执行验证

| 命令/检查 | 实际结果 |
| --- | --- |
| `python scripts/build-health-knowledge.py` | 从来源定位和整理定义生成53片证据与155条关系；缺失定位即失败 |
| `python scripts/verify-health-source-cache.py` | 7份原始文件hash、53个定位和14个论文Total列数值通过；扫描表1另有页图目视核对及图像hash。[结果](../../artifacts/acceptance/health-knowledge-2026-10-28/source-verification.json) |
| `scripts/run.ps1 health:verify` | 文件manifest、Schema、实体类型、来源版本和证据引用通过 |
| `scripts/run.ps1 health:import-local` | 在独立持久化PGlite导入成功；无云连接或生产迁移 |
| `npm run health:query -- "痛风 牛奶"` | 实际从本地库取出关系、条件和引用，`executionAllowed:false`；没有假定个人肾功能。[查询样例](../../artifacts/acceptance/health-knowledge-2026-10-28/query-local-example.json) |
| `scripts/run.ps1 health:evaluate` | 20/20编辑检索回归案例找到指定关系；不是独立冻结评测集。[逐题结果](../../artifacts/acceptance/health-knowledge-2026-10-28/retrieval-regression.json) |
| `node node_modules/tsx/dist/cli.mjs --test tests/health-knowledge.test.ts tests/health-model.test.ts` | 17/17通过，含6项新知识库专项测试及既有模型准备测试。[日志](../../artifacts/acceptance/health-knowledge-2026-10-28/targeted-tests.txt) |
| `scripts/run.ps1 build` | TypeScript检查和Vite生产构建通过 |
| `scripts/run.ps1 test` | 191项：176通过、14失败、1跳过；见下节。[完整日志](../../artifacts/acceptance/health-knowledge-2026-10-28/tests.txt) |

测试覆盖来源/原文hash、孤立引用、错接实体、禁止伪造approved、缺量保留null、低GI/碳水/果糖不被绝对化、少吃与避免区别、条件逐项未知传播、支持与限制证据撤回、重导不复活、导入事务中断回滚和外键。本地PG测试引擎为PGlite；没有冒充真实多连接PG、云端权限验收、医学专家复核或线上检索评测。

## 全仓未通过项

`tests/candidate-library.test.ts`有1项候选库状态断言失败：预期`candidate_only`而实际为`undefined`。`tests/composition-review.test.ts`有13项在旧成分校正fixture阶段失败，错误为`COMPOSITION_CORRECTION_MISMATCH`。本轮没有修改上述测试及`backend/src/composition-review.ts`，新知识库未接入产品入口；单独运行两个代表案例仍复现相同失败，排除了新增知识库测试并行运行的影响。[独立复现日志](../../artifacts/acceptance/health-knowledge-2026-10-28/unrelated-failures-isolated.txt)。

因此本次可以报告知识库专项与构建通过，不能报告全仓测试全绿。没有为本任务改写旧测试期望、配方指纹或生产内容来消除这些失败。

## 发布边界与下一阶段

本库`source_checked`由项目代理核对来源，不是临床审核签认；全部58条执行候选为draft，正式发布为null。研究查询、建库和条件逻辑均可继续使用；没有因专业审核尚未完成停止研发。

保留鲜香菇来源差异和2023/2024指南差异，不平均数值；香蕉/草莓来源内部不一致的数值已排除。高温产物仅保存条件化过程证据，没有映射成三个病种的禁食结论。连汤食用的总摄入限制明确标为项目解释，未冒充研究直接测量。

本轮没有执行云迁移、模型真实调用或新增收费资源，没有导入个人资料，没有绑定真实发布菜谱。后续需在明确食物身份/条件的基础上逐条专业审核、绑定真实菜谱bundle/hash/variant/method，完成200题独立评测及Embedding/重排对照，再按既有发布机制集成线上推荐。RAG方案、架构、协作规则与D19-09已同步到该实际状态。

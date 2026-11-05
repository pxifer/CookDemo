# RAG优化与疾病扩库v2验收

日期：2026-10-28（Asia/Shanghai）。用户本次要求：一是对照相关文档检查RAG搭建是否可优化，二是继续扩展疾病类型并存入知识库。

已完成实现复核、A1词法检索及完整性/缓存/撤回优化、新增四疾病主题和本地持久化入库。交付版本`health-kb-2026-10-28-v2`。[知识库使用入口](../../datasets/health/README-v2.md) · [实际优化复核](../../agent-design/optimization/health-rag-optimization-v2.md) · [JSON包](../../datasets/health/2026-10-28-v2/knowledge-bundle.json) · [关系CSV](../../datasets/health/2026-10-28-v2/relations.csv)

## 扩库及来源核验

| 内容 | 实际结果 |
| --- | --- |
| 新增疾病主题 | 成人高脂血症、成人肥胖症、成人慢性肾病、成人原发性骨质疏松症 |
| 疾病实体 | v1的4个增加至8个；不代表8疾病已正式发布或组合已支持 |
| 新增来源 / 证据 / 关系 | 4 / 45 / 105 |
| 总来源 / 实体 / 证据 / 关系 | 11 / 137 / 98 / 260 |
| 关系细分 | 疾病—成分37，食物—成分89，食物/工艺指导124，烹调效应10 |
| 规则草稿 / 冲突 | 124 / 5 |
| 临床发布 / 真实菜谱绑定 / 向量 | 0 / 0 / 0 |

v1来源、实体、证据、事实、规则和冲突逐条完整保留。本轮没有把旧目录覆盖成新版本，也没有新增假测量值。原14项样品测定和25项分类资料保持原字段。新病例的阶段、透析、血钾、水肿、尿量、原发性和专业营养计划条件分别保存。

全部新增来源来自国家卫健委编制、国家疾控营养机构或湖南省疾控正式公开的资料。高脂血症页面实际是官方长图，附件栏为空，故核对了原图而非猜测PDF链接。10条目视短摘有图像URL/hash、印刷页及像素区域；骨质疏松来源从2026年公开RAR中只读提取主指南并记录成员名和两层hash。检索服务当时返回429，实际通过机构公开目录和原始附件读取完成核对，没有把失败搜索结果写成证据。

[来源核验报告](../../artifacts/acceptance/health-knowledge-2026-10-28-v2/source-verification.json)确认11份源文件hash、98个定位/图像来源和旧记录保留。对图像的hash/区域检查只能证明来源完整性，文字准确性来自本轮目视核对，未宣称OCR或独立临床审核。

## 实际入库

共享库位置：`CookDemo/.local-data/health-knowledge/shared/`。v1与v2均已持久化导入；[回读报告](../../artifacts/acceptance/health-knowledge-2026-10-28-v2/persisted-verification.json)确认两个版本、260条v2关系、8个疾病实体以及实际查询。原v1独立目录保留作历史副本；已读取其撤回集合，需迁移的旧撤回为0条，当前共享撤回为0条。

v2导入序列化hash：`8ef79acaf14a4bab29ab7c2f02379f1c9c17b20e1eee691c22a41e8280c09c1e`。字节文件hash另由[manifest](../../datasets/health/2026-10-28-v2/manifest.json)管理。规范化hash忽略JSON对象键序及按ID排列的记录顺序，以验证数据库JSONB回读；不与文件字节hash混用。

新增独立研究结构`backend/src/health-knowledge/002-integrity.sql`，原`001-research.sql`和生产迁移未改。研究表、快照和撤回不允许UPDATE/DELETE，内容变化需要新bundle，撤回只追加。缓存最多2个完整性校验后的冻结快照；返回前复查全局撤回，不能由缓存或重导复活。

## 检索实现与对照

已保留旧`searchKnowledgeA0`用于复现；默认A1为受控最长词匹配、中文二元片段回退、英文词、歧义及食品形态过滤。实体和关键词各自排名，RRF融合并返回可解释通道。不使用关键词分数判定安全、不自动推断确诊、不将否定提问转成用户已确认限制。

必需证据走独立于发现top-k的集合，必要限定不会因只取一条发现结果而消失。撤回、缺失、条件未知、不适用各自传播。原泛称糖尿病在已确认2型参数下不重复确认；骨质疏松分型同样尊重显式确认。研究响应始终不可执行。

[50题逐项对照和暖态观察](../../artifacts/acceptance/health-knowledge-2026-10-28-v2/retrieval-comparison.json)：原20题在同一个v1包上A0/A1均20/20；v2全部编辑回归50/50；其中10题含歧义、形态或禁止误命中断言，A0为5/10，A1为10/10。未把词法RRF称为向量混合RAG、BM25、SQL全文或独立检索评测；200题独立分组评测尚未完成。

## 执行检查

| 检查 | 结果 |
| --- | --- |
| `python scripts/build-health-knowledge-v2.py` | 成功，且冻结后再次运行幂等；内容不一致时拒绝覆盖 |
| `python scripts/verify-health-expansion.py` | 11来源、98证据定位/图像来源及v1记录保留通过 |
| `scripts/run.ps1 health:verify` | manifest、Schema、类型、引用、版本检查通过 |
| `scripts/run.ps1 health:import-local`及显式v1导入 | 两个版本实际导入共享PGlite |
| `tsx scripts/verify-health-local-v2.ts` | 持久化回读、旧撤回核对及公共查询样例通过 |
| `scripts/run.ps1 health:evaluate` | 50/50编辑回归通过，输出A0/A1同包对照 |
| 知识库v1/v2及模型准备专项 | 24/24通过；含13项知识库测试，[日志](../../artifacts/acceptance/health-knowledge-2026-10-28-v2/targeted-tests.txt) |
| `scripts/run.ps1 build` | TypeScript及Vite构建通过，[日志](../../artifacts/acceptance/health-knowledge-2026-10-28-v2/build.txt) |
| `scripts/run.ps1 test` | 198项，183通过、14失败、1跳过，[完整日志](../../artifacts/acceptance/health-knowledge-2026-10-28-v2/tests.txt) |

专项覆盖最长词碰撞、连续中文句子、形态和疾病分型、空证据、必需证据与限定、未知/不适用条件、CKD透析与血钾、肾病和骨质疏松组合冲突、回读metadata/hash、冻结对象、禁止原地修改、缓存期间及查询期间撤回、撤回跨版本、重复导入及事务回滚。

全仓14项失败与v1验收相同：候选菜谱1项`candidate_only`预期不符，旧成分校正fixture 13项`COMPOSITION_CORRECTION_MISMATCH`。相关实现和测试本轮未改；没有为变绿删除断言或改配方指纹。构建和专项通过不能写成全仓全绿。本地使用PGlite，未冒充真实PG多连接或云端验证。

## 剩余边界

来源机构公开审核资料不等于机构批准本项目抽取关系。124条规则全部draft、临床审核pending，正式发布为空。真实菜谱绑定、专业审批与发布层、200题独立评测、SQL全文/云RPC、Embedding/重排、线上query编码和真实环境压力测试仍需后续实施。没有启用线上疾病筛选、增加个人Key调用轮次、上传个人资料或新增收费资源。

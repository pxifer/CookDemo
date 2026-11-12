# 来源、覆盖与状态核对

核对日2026-11-12；项目事实基线 `bfa1567ccb43ca02e2a42f75c57e521a250d105d`。题库用于提出问题，代码与实际验收用于回答；两者不混用。

## 1. 项目证据索引

<a id="e01"></a>
- **E01 业务定位与边界**：[AGENTS.md](../../../AGENTS.md)；[overview.md](../../../docs/architecture/overview.md)；[business-rag-plan.md](../../../agent-design/docs/business-rag-plan.md)。

<a id="e02"></a>
- **E02 知识、事实与证据**：[README-v2.md](../../../datasets/health/README-v2.md)；[health-knowledge.ts](../../../shared/health-knowledge.ts)；[knowledge-bundle.schema.json](../../../datasets/health/knowledge-bundle.schema.json)。

<a id="e03"></a>
- **E03 正文解析与离线重建**：[document-parsing-runbook.md](../../../agent-design/docs/document-parsing-runbook.md)；[document-parser.py](../../../scripts/lib/document-parser.py)；[source-rebuild-runbook.md](../../../agent-design/docs/source-rebuild-runbook.md)。

<a id="e04"></a>
- **E04 表格与OCR候选**：[table-ocr-runbook.md](../../../agent-design/docs/table-ocr-runbook.md)；[table-ocr-execution-2026-11-06.md](../../../agent-design/docs/table-ocr-execution-2026-11-06.md)；[evidence-resolution-2026-11-06.md](../../../agent-design/docs/evidence-resolution-2026-11-06.md)。

<a id="e05"></a>
- **E05 向量、模型及参数实测**：[rag-parameters-and-chunking.md](../../../agent-design/docs/rag-parameters-and-chunking.md)；[runtime.py](../../../backend/rag-runtime/runtime.py)；[embedding.ts](../../../backend/src/rag/embedding.ts)；[storage.ts](../../../backend/src/rag/storage.ts)；[chunk-statistics.json](../../../artifacts/acceptance/rag-parameter-audit-2026-11-06/chunk-statistics.json)。

<a id="e06"></a>
- **E06 A1与研究混合检索**：[health-knowledge-retrieval.ts](../../../backend/src/health-knowledge-retrieval.ts)；[retrieval.ts](../../../backend/src/rag/retrieval.ts)；[rag-technology-explained.md](../../../agent-design/docs/rag-technology-explained.md)。

<a id="e07"></a>
- **E07 预算、增强与证据闭包**：[context-budget.ts](../../../shared/context-budget.ts)；[retrieval.ts](../../../backend/src/rag/retrieval.ts)；[generation.ts](../../../backend/src/rag/generation.ts)。

<a id="e08"></a>
- **E08 业务资格、配方绑定与提示**：[health-recipe-selection.ts](../../../backend/src/health-recipe-selection.ts)；[food-guidance.ts](../../../backend/src/rag/food-guidance.ts)；[recommendation.ts](../../../backend/src/recommendation.ts)；[recommendation-input.ts](../../../shared/recommendation-input.ts)。

<a id="e09"></a>
- **E09 生成请求及输出门禁**：[deepseek-json.ts](../../../backend/src/deepseek-json.ts)；[generation.ts](../../../backend/src/rag/generation.ts)；[pipeline.ts](../../../backend/src/rag/pipeline.ts)；[app.ts](../../../backend/src/app.ts)。

<a id="e10"></a>
- **E10 身份、原子认领与加密**：[cloudbase-accounts.ts](../../../backend/src/cloudbase-accounts.ts)；[health-chat.sql](../../../deployment/db/health-chat.sql)；[crypto.ts](../../../backend/src/crypto.ts)；[health-recipe-selection.ts](../../../backend/src/health-recipe-selection.ts)。

<a id="e11"></a>
- **E11 个人建议、限制与撤销**：[ai-food-choices.ts](../../../shared/ai-food-choices.ts)；[health-chat.ts](../../../backend/src/health-chat.ts)；[food-guidance-chat.ts](../../../backend/src/rag/food-guidance-chat.ts)；[AGENTS.md](../../../AGENTS.md)。

<a id="e12"></a>
- **E12 研究对照原记录**：[execution-2026-11-04.md](../../../agent-design/docs/execution-2026-11-04.md)；[rag.ts](../../../scripts/rag.ts)。

<a id="e13"></a>
- **E13 五次真实界面样例**：[business-rag-example-2026-11-05.md](../../../agent-design/docs/business-rag-example-2026-11-05.md)；[final-system-prompt.txt](../../../artifacts/acceptance/business-rag-example-2026-11-05/final-system-prompt.txt)；[call-5-model-response.json](../../../artifacts/acceptance/business-rag-example-2026-11-05/call-5-model-response.json)。

<a id="e14"></a>
- **E14 质量标签、曝光和待完成项**：[quality-annotation-protocol.md](../../../agent-design/docs/quality-annotation-protocol.md)；[todo.md](../../../agent-design/docs/todo.md)；[quality-governance-execution-2026-11-05.md](../../../agent-design/docs/quality-governance-execution-2026-11-05.md)。

<a id="e15"></a>
- **E15 RAG-005 P2与实际修复**：[RAG-005-2026-11-06.md](../../../docs/collaboration/reviews/RAG-005-2026-11-06.md)；[evidence-resolution-2026-11-06.md](../../../agent-design/docs/evidence-resolution-2026-11-06.md)。

<a id="e16"></a>
- **E16 图片食材识别入口边界**：[ingredient-photo-recognition.md](../../../docs/development/ingredient-photo-recognition.md)。

<a id="e17"></a>
- **E17 开发协作与真实贡献归属**：[README.md](../../../docs/collaboration/README.md)；[tasks.md](../../../docs/collaboration/tasks.md)。

<a id="e18"></a>
- **E18 设计储备，不代表已经实现**：[todo.md](../../../agent-design/docs/todo.md)；[technology-decisions.md](../../../agent-design/docs/technology-decisions.md)；[contracts.md](../../../agent-design/docs/contracts.md)。

## 2. 论文、官方文档与成熟产品

用于方法解释，不以外部产品结果冒充本项目对比。上游默认值有版本范围；查阅日期不是复现其全部代码。

<a id="s01"></a>
- **S01 RRF原论文**：[原始来源1](https://cormack.uwaterloo.ca/cormacksigir09-rrf.pdf)。

<a id="s02"></a>
- **S02 锁定Embedding模型的上游说明**：[原始来源1](https://huggingface.co/Qwen/Qwen3-Embedding-0.6B)；[原始来源2](https://huggingface.co/BAAI/bge-m3)。

<a id="s03"></a>
- **S03 pgvector官方文档**：[原始来源1](https://github.com/pgvector/pgvector)。

<a id="s04"></a>
- **S04 BGE reranker模型卡**：[原始来源1](https://huggingface.co/BAAI/bge-reranker-v2-m3)。

<a id="s05"></a>
- **S05 MCP与A2A官方概念**：[原始来源1](https://modelcontextprotocol.io/docs/getting-started/intro)；[原始来源2](https://a2a-protocol.org/latest/)。

<a id="s06"></a>
- **S06 Workflow与Agent边界**：[原始来源1](https://www.anthropic.com/research/building-effective-agents)。

<a id="s07"></a>
- **S07 Lost in the Middle研究**：[原始来源1](https://arxiv.org/abs/2307.03172)。

<a id="s08"></a>
- **S08 Transformer/Attention原论文**：[原始来源1](https://arxiv.org/abs/1706.03762)。

<a id="s09"></a>
- **S09 LoRA与DPO原论文**：[原始来源1](https://arxiv.org/abs/2106.09685)；[原始来源2](https://arxiv.org/abs/2305.18290)。

<a id="s10"></a>
- **S10 GraphRAG原论文**：[原始来源1](https://arxiv.org/abs/2404.16130)。

<a id="s11"></a>
- **S11 LangGraph状态持久化/中断**：[原始来源1](https://docs.langchain.com/oss/python/langgraph/persistence)；[原始来源2](https://docs.langchain.com/oss/python/langgraph/interrupts)。

<a id="s12"></a>
- **S12 Ragas指标说明**：[原始来源1](https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/faithfulness/)。

<a id="s13"></a>
- **S13 OWASP Prompt Injection**：[原始来源1](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)。

<a id="s14"></a>
- **S14 BM25原理及实现差异**：[原始来源1](https://nlp.stanford.edu/IR-book/html/htmledition/okapi-bm25-a-non-binary-model-1.html)；[原始来源2](https://www.elastic.co/docs/reference/elasticsearch/index-settings/similarity)。

<a id="s15"></a>
- **S15 JSON Schema及Ajv**：[原始来源1](https://json-schema.org/understanding-json-schema/reference/object)；[原始来源2](https://ajv.js.org/guide/getting-started.html)。

<a id="s16"></a>
- **S16 WeKnora官方仓库/API**：[原始来源1](https://github.com/Tencent/WeKnora)；[原始来源2](https://github.com/Tencent/WeKnora/blob/main/website-docs/04-api/01-api-overview.md)。

<a id="s17"></a>
- **S17 RAGFlow切块组件文档**：[原始来源1](https://github.com/infiniflow/ragflow/blob/main/docs/guides/agent/ingestion_pipeline/configure_chunker_component.md)。

<a id="s18"></a>
- **S18 ReAct原论文**：[原始来源1](https://arxiv.org/abs/2210.03629)。

<a id="s19"></a>
- **S19 CRAG与Self-RAG原论文**：[原始来源1](https://arxiv.org/abs/2401.15884)；[原始来源2](https://arxiv.org/abs/2310.11511)。

<a id="s20"></a>
- **S20 DeepSeek JSON模式**：[原始来源1](https://api-docs.deepseek.com/guides/json_mode/)。

<a id="s21"></a>
- **S21 SSE与WebSocket**：[原始来源1](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)；[原始来源2](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)。

<a id="s22"></a>
- **S22 Python3.11线程/GIL**：[原始来源1](https://docs.python.org/3.11/library/threading.html)。

## 3. 用户提供的57题：逐题去向

编号与用户列表一一对应，扩展题从Q058起。原有前提若与实现不符，在答案直接澄清，不照单背诵。

| 用户题号 | 筛选后题目 | 回答 |
| --- | --- | --- |
| 1 | 一句话介绍项目，解决什么问题？ | [Q001](qa-01-business-data.md#q001) |
| 2 | 为什么需要RAG，长上下文和微调能否替代？ | [Q002](qa-01-business-data.md#q002) |
| 3 | 大模型负责什么，哪些事交给程序？ | [Q003](qa-01-business-data.md#q003) |
| 4 | 为什么没有使用LangChain或LlamaIndex？ | [Q004](qa-01-business-data.md#q004) |
| 5 | RAG怎样和推荐系统打通，白板怎么画？ | [Q005](qa-01-business-data.md#q005) |
| 6 | 怎样证明比直接聊天更有价值？ | [Q006](qa-01-business-data.md#q006) |
| 7 | 最大的局限是什么，预算增加先做什么？ | [Q007](qa-01-business-data.md#q007) |
| 8 | 资料如何收集、清洗，表格和跨页怎么办？ | [Q008](qa-01-business-data.md#q008) |
| 9 | 为什么把Fact和Evidence分开？ | [Q009](qa-01-business-data.md#q009) |
| 10 | 事实怎样提取，如何防止事实幻觉？ | [Q010](qa-01-business-data.md#q010) |
| 11 | 原文更新或撤回，如何避免继续答旧知识？ | [Q011](qa-01-business-data.md#q011) |
| 12 | 块怎样切、多大、Overlap多少，为什么？ | [Q012](qa-01-business-data.md#q012) |
| 13 | 怎么防止切断“除外、仅限、肾功能”等限定？ | [Q013](qa-01-business-data.md#q013) |
| 14 | 知道哪些切块策略，项目适合哪种？ | [Q014](qa-01-business-data.md#q014) |
| 15 | 6000 token上下文预算怎样来的？ | [Q015](qa-01-business-data.md#q015) |
| 16 | 为什么不只用向量，暴露了什么问题？ | [Q016](qa-02-retrieval-generation.md#q016) |
| 17 | Embedding用什么、维度多少，怎样选？ | [Q017](qa-02-retrieval-generation.md#q017) |
| 18 | A1到底怎么做，是BM25或倒排索引吗？ | [Q018](qa-02-retrieval-generation.md#q018) |
| 19 | 混合检索怎样互补，有没有实际收益？ | [Q019](qa-02-retrieval-generation.md#q019) |
| 20 | RRF原理及公式中的60是什么？ | [Q020](qa-02-retrieval-generation.md#q020) |
| 21 | 为什么RRF取60，做过10/60/100对比吗？ | [Q021](qa-02-retrieval-generation.md#q021) |
| 22 | 为何不把向量距离和词法分数直接相加？ | [Q022](qa-02-retrieval-generation.md#q022) |
| 23 | A1第一、向量第十的事实怎样算分？ | [Q023](qa-02-retrieval-generation.md#q023) |
| 24 | Top-10里出现互斥或相反结论怎么办？ | [Q024](qa-02-retrieval-generation.md#q024) |
| 25 | 粗筛多少、最终多少，为什么？ | [Q025](qa-02-retrieval-generation.md#q025) |
| 26 | 怎样检测和量化“偏题”？ | [Q026](qa-02-retrieval-generation.md#q026) |
| 27 | Rerank解决什么，和Embedding有何不同？ | [Q027](qa-02-retrieval-generation.md#q027) |
| 28 | 如何权衡Reranker延迟和收益？ | [Q028](qa-02-retrieval-generation.md#q028) |
| 29 | 超预算为何回退完整事实，不截断半段证据？ | [Q029](qa-02-retrieval-generation.md#q029) |
| 30 | 怎样防模型编造医学常识？ | [Q030](qa-02-retrieval-generation.md#q030) |
| 31 | 残缺JSON或带Markdown围栏怎么办？ | [Q031](qa-02-retrieval-generation.md#q031) |
| 32 | 如何校验evidenceId真实，存在就够了吗？ | [Q032](qa-02-retrieval-generation.md#q032) |
| 33 | “迷失在中间”是什么，项目怎样处理？ | [Q033](qa-02-retrieval-generation.md#q033) |
| 34 | 如何防用户或资料里的恶意Prompt注入？ | [Q034](qa-02-retrieval-generation.md#q034) |
| 35 | 证据冲突时，大模型应听谁？ | [Q035](qa-02-retrieval-generation.md#q035) |
| 36 | 项目算Agent还是Workflow？ | [Q036](qa-03-agent-evaluation.md#q036) |
| 37 | 库存、过敏、忌口怎样和模型交互？ | [Q037](qa-03-agent-evaluation.md#q037) |
| 38 | 为什么硬过滤交给代码？ | [Q038](qa-03-agent-evaluation.md#q038) |
| 39 | 高血压用户只有培根，怎样反馈？ | [Q039](qa-03-agent-evaluation.md#q039) |
| 40 | 模型写“吃某道菜降血压”，程序怎么拦？ | [Q040](qa-03-agent-evaluation.md#q040) |
| 41 | 疾病分型不明确，多轮怎么补？ | [Q041](qa-03-agent-evaluation.md#q041) |
| 42 | 模型调用同步还是异步，高并发怎样处理？ | [Q042](qa-03-agent-evaluation.md#q042) |
| 43 | 模型超时或429怎么办？ | [Q043](qa-03-agent-evaluation.md#q043) |
| 44 | 一次推荐多少Token，怎样降本？ | [Q044](qa-03-agent-evaluation.md#q044) |
| 45 | Memory怎么做，多轮怎样记忌口？ | [Q045](qa-03-agent-evaluation.md#q045) |
| 46 | 怎样证明效果，用哪些指标？ | [Q046](qa-03-agent-evaluation.md#q046) |
| 47 | 27题怎么选，怎样防自己考自己？ | [Q047](qa-03-agent-evaluation.md#q047) |
| 48 | 了解Ragas吗，为什么没直接用它？ | [Q048](qa-03-agent-evaluation.md#q048) |
| 49 | 重新设计时，Rerank放哪里？ | [Q049](qa-03-agent-evaluation.md#q049) |
| 50 | 最大踩坑怎么讲，怎么定位和修复？ | [Q050](qa-03-agent-evaluation.md#q050) |
| 51 | 为什么加向量后反而不如A1？ | [Q051](qa-03-agent-evaluation.md#q051) |
| 52 | 被说成“规则引擎套模型壳”怎么回答？ | [Q052](qa-03-agent-evaluation.md#q052) |
| 53 | 日活十万时架构怎么改？ | [Q053](qa-03-agent-evaluation.md#q053) |
| 54 | 向量多了怎么办，HNSW和IVFFlat怎么选？ | [Q054](qa-03-agent-evaluation.md#q054) |
| 55 | 冰箱照片如何接入，CV与RAG什么关系？ | [Q055](qa-03-agent-evaluation.md#q055) |
| 56 | 加入视频或音频指南，需要改变什么？ | [Q056](qa-03-agent-evaluation.md#q056) |
| 57 | GraphRAG能解决什么，项目需要吗？ | [Q057](qa-03-agent-evaluation.md#q057) |

## 4. 本地HTML及三份对应AI资料

外部原件位于 `D:/codex_AI/后端8股/春招优化版/Markdown版/`，只读、未改正文。HTML中核对到三个章节：AI与Agent开发面试（section-476）、AI模型与Agent工程实操（section-578）、拾味项目RAG与Agent案例（section-601）。下表校对其标题与相应Markdown；完整文件hash在JSON清单。

| 原资料 | 范围 | HTML标题匹配 | SHA256 |
| --- | --- | --- | --- |
| Agent开发面试.md | 90题＋1条追问链 | 91 | `1beed7d693bb1594cbaf48d90efb5860a70c7bb9c3111e20f35271e20080d993` |
| AI模型与Agent工程实操.md | 18专题/题 | 18 | `b166de84c17bb4d798469f839700a8ac7bc769f0d4465e9771a069244d81ed0d` |
| 拾味项目RAG与Agent案例.md | 45专题/题 | 45 | `82c70a1400f35458c1415a8131029b1d7684beee4c1b6ec99d3703aa4325dde2` |
| 面试资料阅读器.html | HTML阅读入口 | — | `df9be19dc553cdb8f580e539410156ec687363e409fae86ceff2c49137c69405` |

### 4.1 本地90题映射

全部登记：当前实现直接答，未实现概念作储备，Java/Redis/MQ细节只保留可迁移的工程含义，不虚构项目用了Spring或Redis。

| 原题 | 原标题 | 本手册 |
| --- | --- | --- |
| L01 | [P0] Q01 · 请介绍一个你深度参与的Agent项目 | [Q001](qa-01-business-data.md#q001)、[Q005](qa-01-business-data.md#q005) |
| L02 | [P0] Q02 · 你的项目效果怎么样 | [Q006](qa-01-business-data.md#q006)、[Q046](qa-03-agent-evaluation.md#q046) |
| L03 | [P0] Q03 · 你个人负责什么 团队如何分工 | [Q094](qa-05-foundations-scenarios.md#q094)、[Q095](qa-05-foundations-scenarios.md#q095) |
| L04 | [P0] Q04 · 为什么需要RAG 直接用长上下文或微调行不行 | [Q002](qa-01-business-data.md#q002) |
| L05 | [P0] Q05 · Agent Workflow和普通聊天有什么区别 | [Q036](qa-03-agent-evaluation.md#q036) |
| L06 | [P1] Q06 · 项目中最大的技术难点怎么讲 | [Q050](qa-03-agent-evaluation.md#q050)、[Q094](qa-05-foundations-scenarios.md#q094) |
| L07 | [P0] Q07 · 从零搭建RAG的完整流程是什么 | [Q005](qa-01-business-data.md#q005)、[Q008](qa-01-business-data.md#q008) |
| L08 | [P1] Q08 · PDF Word HTML等不同来源怎么处理 | [Q008](qa-01-business-data.md#q008)、[Q056](qa-03-agent-evaluation.md#q056) |
| L09 | [P0] Q09 · Chunk长度怎么确定 为什么不是固定512 | [Q012](qa-01-business-data.md#q012) |
| L10 | [P1] Q10 · Markdown没有标题怎么切 | [Q101](qa-05-foundations-scenarios.md#q101) |
| L11 | [P1] Q11 · 表格怎么切 条件和例外怎么保留 | [Q013](qa-01-business-data.md#q013) |
| L12 | [P1] Q12 · Overlap多大合适 | [Q012](qa-01-business-data.md#q012)、[Q014](qa-01-business-data.md#q014) |
| L13 | [P1] Q13 · 父子块为什么有用 | [Q014](qa-01-business-data.md#q014) |
| L14 | [P0] Q14 · Embedding模型怎么选 | [Q017](qa-02-retrieval-generation.md#q017) |
| L15 | [P1] Q15 · 向量化时有哪些容易忽略的细节 | [Q017](qa-02-retrieval-generation.md#q017)、[Q076](qa-04-engineering-extensions.md#q076)、[Q077](qa-04-engineering-extensions.md#q077) |
| L16 | [P0] Q16 · 关键词和向量为什么要混合 | [Q019](qa-02-retrieval-generation.md#q019) |
| L17 | [P1] Q17 · BM25是什么 PostgreSQL全文检索就是BM25吗 | [Q018](qa-02-retrieval-generation.md#q018)、[Q074](qa-04-engineering-extensions.md#q074) |
| L18 | [P0] Q18 · 多路召回怎么融合 | [Q020](qa-02-retrieval-generation.md#q020)、[Q022](qa-02-retrieval-generation.md#q022)、[Q023](qa-02-retrieval-generation.md#q023) |
| L19 | [P0] Q19 · Reranker和Embedding有什么区别 | [Q027](qa-02-retrieval-generation.md#q027)、[Q028](qa-02-retrieval-generation.md#q028) |
| L20 | [P1] Q20 · Query改写 多轮指代和HyDE怎么用 | [Q073](qa-04-engineering-extensions.md#q073) |
| L21 | [P1] Q21 · 召回很多无关内容怎么办 | [Q026](qa-02-retrieval-generation.md#q026)、[Q103](qa-05-foundations-scenarios.md#q103) |
| L22 | [P0] Q22 · 检索不到怎么办 怎样拒答 | [Q039](qa-03-agent-evaluation.md#q039)、[Q103](qa-05-foundations-scenarios.md#q103) |
| L23 | [P0] Q23 · RAG回答错了怎么定位 | [Q050](qa-03-agent-evaluation.md#q050)、[Q084](qa-04-engineering-extensions.md#q084) |
| L24 | [P0] Q24 · 如何减少幻觉和伪造引用 | [Q030](qa-02-retrieval-generation.md#q030)、[Q032](qa-02-retrieval-generation.md#q032)、[Q040](qa-03-agent-evaluation.md#q040) |
| L25 | [P0] Q25 · ReAct与Plan Execute Replan如何选 | [Q063](qa-04-engineering-extensions.md#q063) |
| L26 | [P0] Q26 · Agent Loop和Harness分别负责什么 | [Q063](qa-04-engineering-extensions.md#q063)、[Q068](qa-04-engineering-extensions.md#q068)、[Q108](qa-05-foundations-scenarios.md#q108) |
| L27 | [P0] Q27 · Function Calling原理是什么 | [Q064](qa-04-engineering-extensions.md#q064) |
| L28 | [P0] Q28 · 工具如何设计才不容易误调用 | [Q065](qa-04-engineering-extensions.md#q065)、[Q091](qa-05-foundations-scenarios.md#q091) |
| L29 | [P0] Q29 · 模型输出JSON就够安全吗 | [Q031](qa-02-retrieval-generation.md#q031)、[Q112](qa-05-foundations-scenarios.md#q112) |
| L30 | [P1] Q30 · 如何保证路由准确和流程不跑偏 | [Q065](qa-04-engineering-extensions.md#q065)、[Q098](qa-05-foundations-scenarios.md#q098) |
| L31 | [P0] Q31 · 如何防止无限循环或无效反思 | [Q068](qa-04-engineering-extensions.md#q068) |
| L32 | [P0] Q32 · 工具超时 失败 重试如何设计 | [Q043](qa-03-agent-evaluation.md#q043)、[Q082](qa-04-engineering-extensions.md#q082) |
| L33 | [P0] Q33 · 如何实现幂等 防止两个实例重复执行 | [Q070](qa-04-engineering-extensions.md#q070) |
| L34 | [P0] Q34 · 人工确认如何落实 | [Q071](qa-04-engineering-extensions.md#q071) |
| L35 | [P0] Q35 · 如何防提示词注入 | [Q034](qa-02-retrieval-generation.md#q034)、[Q089](qa-05-foundations-scenarios.md#q089) |
| L36 | [P0] Q36 · Agent状态保存在哪里 | [Q045](qa-03-agent-evaluation.md#q045)、[Q069](qa-04-engineering-extensions.md#q069) |
| L37 | [P0] Q37 · 短期记忆 长期记忆 RAG和Skill怎么区分 | [Q045](qa-03-agent-evaluation.md#q045)、[Q067](qa-04-engineering-extensions.md#q067) |
| L38 | [P1] Q38 · 为什么上下文没满也要压缩 | [Q085](qa-05-foundations-scenarios.md#q085) |
| L39 | [P0] Q39 · 上下文预算怎么算 何时触发压缩 | [Q015](qa-01-business-data.md#q015)、[Q085](qa-05-foundations-scenarios.md#q085) |
| L40 | [P0] Q40 · 怎样保证压缩不丢关键事实 | [Q013](qa-01-business-data.md#q013)、[Q085](qa-05-foundations-scenarios.md#q085) |
| L41 | [P1] Q41 · 多次压缩和切模型会有什么问题 | [Q086](qa-05-foundations-scenarios.md#q086) |
| L42 | [P1] Q42 · 如何证明压缩节省token且质量不下降 | [Q085](qa-05-foundations-scenarios.md#q085)、[Q088](qa-05-foundations-scenarios.md#q088) |
| L43 | [P2] Q43 · Claude Code上下文压缩机制了解多少 | [Q108](qa-05-foundations-scenarios.md#q108) |
| L44 | [P0] Q44 · RAG检索有哪些指标 | [Q046](qa-03-agent-evaluation.md#q046) |
| L45 | [P1] Q45 · 这些指标怎么计算 | [Q087](qa-05-foundations-scenarios.md#q087) |
| L46 | [P0] Q46 · 生成质量怎么评估 | [Q040](qa-03-agent-evaluation.md#q040)、[Q046](qa-03-agent-evaluation.md#q046) |
| L47 | [P0] Q47 · 评测集谁标 如何避免泄漏 | [Q047](qa-03-agent-evaluation.md#q047)、[Q088](qa-05-foundations-scenarios.md#q088) |
| L48 | [P0] Q48 · Agent怎么评测 | [Q046](qa-03-agent-evaluation.md#q046)、[Q068](qa-04-engineering-extensions.md#q068) |
| L49 | [P0] Q49 · 怎样设计消融实验 | [Q021](qa-02-retrieval-generation.md#q021)、[Q049](qa-03-agent-evaluation.md#q049) |
| L50 | [P1] Q50 · 生产准入看什么 | [Q093](qa-05-foundations-scenarios.md#q093) |
| L51 | [P1] Q51 · 为什么选pgvector 不选Milvus或Qdrant | [Q054](qa-03-agent-evaluation.md#q054) |
| L52 | [P1] Q52 · 精确检索 HNSW IVFFlat有什么区别 | [Q054](qa-03-agent-evaluation.md#q054)、[Q075](qa-04-engineering-extensions.md#q075) |
| L53 | [P1] Q53 · HNSW参数如何调 | [Q075](qa-04-engineering-extensions.md#q075) |
| L54 | [P1] Q54 · 余弦 内积 L2如何选 | [Q076](qa-04-engineering-extensions.md#q076) |
| L55 | [P1] Q55 · 中文检索有哪些坑 | [Q018](qa-02-retrieval-generation.md#q018)、[Q073](qa-04-engineering-extensions.md#q073)、[Q102](qa-05-foundations-scenarios.md#q102) |
| L56 | [P1] Q56 · 增量更新和Embedding迁移怎么做 | [Q077](qa-04-engineering-extensions.md#q077)、[Q078](qa-04-engineering-extensions.md#q078) |
| L57 | [P1] Q57 · 多租户权限和删除怎样保证 | [Q079](qa-04-engineering-extensions.md#q079)、[Q099](qa-05-foundations-scenarios.md#q099) |
| L58 | [P1] Q58 · 数据为什么不能全放JSON或全放向量库 | [Q009](qa-01-business-data.md#q009)、[Q077](qa-04-engineering-extensions.md#q077) |
| L59 | [P1] Q59 · 慢SQL怎么查 索引为什么没用 | [Q084](qa-04-engineering-extensions.md#q084)、[Q106](qa-05-foundations-scenarios.md#q106) |
| L60 | [P1] Q60 · 为什么不一开始就用Redis MQ和图数据库 | [Q053](qa-03-agent-evaluation.md#q053)、[Q106](qa-05-foundations-scenarios.md#q106) |
| L61 | [P1] Q61 · 多Agent比单Agent好在哪里 | [Q072](qa-04-engineering-extensions.md#q072) |
| L62 | [P1] Q62 · 中心调度如何拆任务与合并 | [Q072](qa-04-engineering-extensions.md#q072) |
| L63 | [P0] Q63 · MCP是什么 与Function Calling和HTTP有什么关系 | [Q066](qa-04-engineering-extensions.md#q066) |
| L64 | [P0] Q64 · SSE与WebSocket如何选 | [Q042](qa-03-agent-evaluation.md#q042)、[Q111](qa-05-foundations-scenarios.md#q111) |
| L65 | [P0] Q65 · 长任务崩溃后怎么恢复 | [Q069](qa-04-engineering-extensions.md#q069)、[Q092](qa-05-foundations-scenarios.md#q092) |
| L66 | [P1] Q66 · 共享对象和异步上下文污染怎么发生 | [Q070](qa-04-engineering-extensions.md#q070)、[Q104](qa-05-foundations-scenarios.md#q104) |
| L67 | [P1] Q67 · 缓存怎么设计 如何避免旧知识复活 | [Q080](qa-04-engineering-extensions.md#q080) |
| L68 | [P0] Q68 · 限流与背压如何实现 | [Q081](qa-04-engineering-extensions.md#q081) |
| L69 | [P1] Q69 · 如何记录监控而不泄露健康资料 | [Q090](qa-05-foundations-scenarios.md#q090) |
| L70 | [P0] Q70 · P95延迟如何拆解和优化 | [Q084](qa-04-engineering-extensions.md#q084) |
| L71 | [P0] Q71 · 如何估算成本和容量 | [Q044](qa-03-agent-evaluation.md#q044)、[Q053](qa-03-agent-evaluation.md#q053) |
| L72 | [P1] Q72 · 服务突然CPU或内存升高怎么查 | [Q084](qa-04-engineering-extensions.md#q084)、[Q105](qa-05-foundations-scenarios.md#q105) |
| L73 | [P1] Q73 · 从输入URL到响应发生什么 | [Q042](qa-03-agent-evaluation.md#q042)、[Q084](qa-04-engineering-extensions.md#q084) |
| L74 | [P1] Q74 · 线程 进程 协程及Python GIL如何回答 | [Q042](qa-03-agent-evaluation.md#q042)、[Q083](qa-04-engineering-extensions.md#q083)、[Q105](qa-05-foundations-scenarios.md#q105) |
| L75 | [P1] Q75 · 数据库事务 CAS和锁怎么选 | [Q070](qa-04-engineering-extensions.md#q070) |
| L76 | [P1] Q76 · Redis Lua为什么不宜执行长脚本 | [Q106](qa-05-foundations-scenarios.md#q106) |
| L77 | [P1] Q77 · 索引 回表 深分页和消息队列还会问吗 | [Q106](qa-05-foundations-scenarios.md#q106) |
| L78 | [P1] Q78 · AI Coding全流程怎么控制质量 | [Q094](qa-05-foundations-scenarios.md#q094) |
| L79 | [P1] Q79 · PRD和技术方案各写什么 | [Q095](qa-05-foundations-scenarios.md#q095) |
| L80 | [P2] Q80 · 如何证明开源项目研究深度 | [Q095](qa-05-foundations-scenarios.md#q095)、[Q100](qa-05-foundations-scenarios.md#q100) |
| L81 | [P0] Q81 · Transformer和Attention与应用开发的关系 | [Q059](qa-04-engineering-extensions.md#q059) |
| L82 | [P0] Q82 · KV Cache Prompt Cache和记忆有什么区别 | [Q060](qa-04-engineering-extensions.md#q060)、[Q105](qa-05-foundations-scenarios.md#q105) |
| L83 | [P0] Q83 · 温度 top_p max_tokens怎么选 | [Q061](qa-04-engineering-extensions.md#q061) |
| L84 | [P1] Q84 · 本地模型如何估显存 何时选API | [Q105](qa-05-foundations-scenarios.md#q105) |
| L85 | [P1] Q85 · 什么情况下需要微调 | [Q062](qa-04-engineering-extensions.md#q062) |
| L86 | [P2] Q86 · GraphRAG何时有价值 | [Q057](qa-03-agent-evaluation.md#q057) |
| L87 | [P2] Q87 · Agentic RAG CRAG Self RAG怎么理解 | [Q096](qa-05-foundations-scenarios.md#q096) |
| L88 | [P1] Q88 · 对抗测试和红队怎么设计 | [Q089](qa-05-foundations-scenarios.md#q089) |
| L89 | [P1] Q89 · 手撕会考什么 怎么准备 | [Q087](qa-05-foundations-scenarios.md#q087)、[Q094](qa-05-foundations-scenarios.md#q094) |
| L90 | [P2] Q90 · HR与反问怎么准备 | [Q100](qa-05-foundations-scenarios.md#q100) |

原件最后的追问链练习迁到[本手册追问路线](foundations-and-exercises.md)，不另算第91道题。

### 4.2 AI实操18题映射

| 原题 | 原标题 | 本手册 |
| --- | --- | --- |
| A01 | [P0] 01 · Token、分词和自回归生成是什么？ | [Q058](qa-04-engineering-extensions.md#q058) |
| A02 | [P0] 02 · Attention 至少要解释到什么程度？ | [Q059](qa-04-engineering-extensions.md#q059) |
| A03 | [P0] 03 · Prefill、Decode、TTFT 和 KV Cache 有什么关系？ | [Q060](qa-04-engineering-extensions.md#q060)、[Q105](qa-05-foundations-scenarios.md#q105) |
| A04 | [P0] 04 · Temperature、top_p、输出上限和停止原因如何理解？ | [Q031](qa-02-retrieval-generation.md#q031)、[Q061](qa-04-engineering-extensions.md#q061) |
| A05 | [P0] 05 · 如何选择普通模型、推理模型和本地模型？ | [Q017](qa-02-retrieval-generation.md#q017)、[Q105](qa-05-foundations-scenarios.md#q105) |
| A06 | [P1] 06 · SFT、LoRA、DPO 和 RAG 分别解决什么问题？ | [Q002](qa-01-business-data.md#q002)、[Q062](qa-04-engineering-extensions.md#q062) |
| A07 | [P0] 07 · 怎样写一个可以测试的提示词？ | [Q030](qa-02-retrieval-generation.md#q030)、[Q112](qa-05-foundations-scenarios.md#q112) |
| A08 | [P0] 08 · 一次模型调用从请求到返回应有哪些环节？ | [Q042](qa-03-agent-evaluation.md#q042)、[Q082](qa-04-engineering-extensions.md#q082)、[Q104](qa-05-foundations-scenarios.md#q104) |
| A09 | [P0] 09 · 429、超时、断流和无效 JSON 分别如何处理？ | [Q031](qa-02-retrieval-generation.md#q031)、[Q043](qa-03-agent-evaluation.md#q043) |
| A10 | [P1] 10 · 模型路由、降级和缓存怎样避免改变业务含义？ | [Q080](qa-04-engineering-extensions.md#q080)、[Q098](qa-05-foundations-scenarios.md#q098) |
| A11 | [P0] 11 · 结构化输出为什么仍需要业务校验？ | [Q032](qa-02-retrieval-generation.md#q032)、[Q112](qa-05-foundations-scenarios.md#q112) |
| A12 | [P0] 12 · LangGraph 的状态、节点、边和 reducer 怎样配合？ | [Q063](qa-04-engineering-extensions.md#q063)、[Q069](qa-04-engineering-extensions.md#q069) |
| A13 | [P1] 13 · Checkpoint、interrupt 和恢复时容易犯什么错？ | [Q069](qa-04-engineering-extensions.md#q069)、[Q092](qa-05-foundations-scenarios.md#q092) |
| A14 | [P0] 14 · 一个受控只读 Agent 的最小实现包含什么？ | [Q065](qa-04-engineering-extensions.md#q065)、[Q091](qa-05-foundations-scenarios.md#q091) |
| A15 | [P0] 15 · Agent 怎样判断完成，而不只相信模型说完成？ | [Q038](qa-03-agent-evaluation.md#q038)、[Q068](qa-04-engineering-extensions.md#q068) |
| A16 | [P0] 16 · 一份可以运行的评测集需要哪些字段？ | [Q046](qa-03-agent-evaluation.md#q046)、[Q047](qa-03-agent-evaluation.md#q047) |
| A17 | [P0] 17 · 怎样运行一个最小检索评测脚本？ | [Q087](qa-05-foundations-scenarios.md#q087) |
| A18 | [P0] 18 · 怎样把评测、Trace 和优化形成闭环？ | [Q046](qa-03-agent-evaluation.md#q046)、[Q084](qa-04-engineering-extensions.md#q084)、[Q090](qa-05-foundations-scenarios.md#q090) |

教学只读Agent、LangGraph等仅说明设计，不写成产品代码。

### 4.3 旧项目案例45专题映射与更正

该原件明确为2026-10-28快照。保留原文，使用时按当前事实修正。

| 旧快照说法 | 当前核对 |
| --- | --- |
| v1：7来源/53证据/155事实 | v2：11/98/260；目标包另计，不抹去旧版身份 |
| Embedding尚未接入/没有真实调用 | 研究双Embedding和PG索引已有；业务有5次界面调用，未证明线上效果 |
| 20题回归 | 后续27题工程调试集已曝光；仍无独立临床gold |
| server/、data/等旧目录 | 当前backend/src、datasets；历史记录不批量改写成新验收 |
| 目标链/规划能力 | 以本手册业务/研究/候选三层区分，不把规划目录当完成 |

| 专题 | 原标题 | 当前回答 |
| --- | --- | --- |
| P01 | [P1] 检索基线与结果口径 | [Q001](qa-01-business-data.md#q001) |
| P02 | [P0] 当前链路 | [Q005](qa-01-business-data.md#q005) |
| P03 | [P0] 目标链路 | [Q005](qa-01-business-data.md#q005)、[Q007](qa-01-business-data.md#q007) |
| P04 | [P0] 定义最小业务闭环 | [Q005](qa-01-business-data.md#q005)、[Q037](qa-03-agent-evaluation.md#q037) |
| P05 | [P1] 先准备评测规范 再扩数据 | [Q102](qa-05-foundations-scenarios.md#q102) |
| P06 | [P1] 来源登记和资料解析 | [Q008](qa-01-business-data.md#q008)、[Q011](qa-01-business-data.md#q011) |
| P07 | [P1] 设计实体与事实模型 | [Q009](qa-01-business-data.md#q009)、[Q010](qa-01-business-data.md#q010) |
| P08 | [P1] 构建可复用切块器 | [Q012](qa-01-business-data.md#q012)、[Q013](qa-01-business-data.md#q013)、[Q014](qa-01-business-data.md#q014) |
| P09 | [P1] 建中文词法基线 | [Q018](qa-02-retrieval-generation.md#q018)、[Q074](qa-04-engineering-extensions.md#q074) |
| P10 | [P1] 对照Embedding并解决在线编码 | [Q017](qa-02-retrieval-generation.md#q017)、[Q077](qa-04-engineering-extensions.md#q077) |
| P11 | [P1] 召回 融合 重排与上下文 | [Q019](qa-02-retrieval-generation.md#q019)、[Q025](qa-02-retrieval-generation.md#q025)、[Q027](qa-02-retrieval-generation.md#q027) |
| P12 | [P0] 条件判断与真实菜谱绑定 | [Q015](qa-01-business-data.md#q015)、[Q029](qa-02-retrieval-generation.md#q029) |
| P13 | [P1] 建受控Agent和工具契约 | [Q036](qa-03-agent-evaluation.md#q036)、[Q065](qa-04-engineering-extensions.md#q065) |
| P14 | [P1] 上下文管理与个人记忆 | [Q034](qa-02-retrieval-generation.md#q034)、[Q085](qa-05-foundations-scenarios.md#q085) |
| P15 | [P1] 验收 灰度与持续维护 | [Q046](qa-03-agent-evaluation.md#q046)、[Q093](qa-05-foundations-scenarios.md#q093) |
| P16 | [P1] 一个可以在白板上讲的切块例子 | [Q005](qa-01-business-data.md#q005) |
| P17 | [P1] 中文查询处理流程 | [Q023](qa-02-retrieval-generation.md#q023) |
| P18 | [P1] 为什么不直接让模型判食材安全 | [Q006](qa-01-business-data.md#q006)、[Q030](qa-02-retrieval-generation.md#q030) |
| P19 | [P1] 当前结构可以复用什么 | [Q009](qa-01-business-data.md#q009) |
| P20 | [P1] 版本如何同时生效 | [Q011](qa-01-business-data.md#q011)、[Q077](qa-04-engineering-extensions.md#q077) |
| P21 | [P1] 个人数据怎样隔离 | [Q024](qa-02-retrieval-generation.md#q024)、[Q035](qa-02-retrieval-generation.md#q035) |
| P22 | [P1] 案例一 食材同名与形态导致证据混用 | [Q013](qa-01-business-data.md#q013)、[Q076](qa-04-engineering-extensions.md#q076) |
| P23 | [P1] 案例二 来源正文和表格不一致 | [Q008](qa-01-business-data.md#q008)、[Q012](qa-01-business-data.md#q012) |
| P24 | [P1] 案例三 烹调减少不等于整餐减少 | [Q084](qa-04-engineering-extensions.md#q084) |
| P25 | [P1] 案例四 模型建议不能越过用户意图 | [Q003](qa-01-business-data.md#q003)、[Q071](qa-04-engineering-extensions.md#q071) |
| P26 | [P1] 案例五 重复请求可能重复消费 | [Q070](qa-04-engineering-extensions.md#q070)、[Q081](qa-04-engineering-extensions.md#q081) |
| P27 | [P1] 案例六 有知识库不代表已经有RAG产品 | [Q036](qa-03-agent-evaluation.md#q036)、[Q093](qa-05-foundations-scenarios.md#q093) |
| P28 | [P0] 三个适合后续真正做出成果的实验 | [Q050](qa-03-agent-evaluation.md#q050) |
| P29 | [P1] 为什么不用纯向量检索 | [Q004](qa-01-business-data.md#q004) |
| P30 | [P1] 为什么先用PG而不选图数据库 | [Q054](qa-03-agent-evaluation.md#q054)、[Q057](qa-03-agent-evaluation.md#q057) |
| P31 | [P1] 当前chunk怎么做的 与自动切块有什么区别 | [Q012](qa-01-business-data.md#q012) |
| P32 | [P1] 为什么Embedding还没定 能不能说用了BGE | [Q017](qa-02-retrieval-generation.md#q017) |
| P33 | [P1] 召回不到证据怎么办 | [Q019](qa-02-retrieval-generation.md#q019) |
| P34 | [P0] 为什么现有20题不够 | [Q047](qa-03-agent-evaluation.md#q047) |
| P35 | [P1] 怎样计算上下文压缩的收益 | [Q029](qa-02-retrieval-generation.md#q029)、[Q085](qa-05-foundations-scenarios.md#q085) |
| P36 | [P1] 健康建议冲突如何解决 | [Q035](qa-02-retrieval-generation.md#q035) |
| P37 | [P1] 为什么不让模型生成新菜谱 | [Q003](qa-01-business-data.md#q003)、[Q038](qa-03-agent-evaluation.md#q038) |
| P38 | [P1] 如果用户说删除知识库怎么办 | [Q099](qa-05-foundations-scenarios.md#q099) |
| P39 | [P0] 云函数如何保证一次调用 | [Q070](qa-04-engineering-extensions.md#q070) |
| P40 | [P1] 为什么有AI偏好还需要RAG | [Q005](qa-01-business-data.md#q005)、[Q045](qa-03-agent-evaluation.md#q045) |
| P41 | [P1] 换模型怎样避免旧摘要污染 | [Q086](qa-05-foundations-scenarios.md#q086)、[Q099](qa-05-foundations-scenarios.md#q099) |
| P42 | [P1] 你还缺什么 为什么值得继续做 | [Q007](qa-01-business-data.md#q007) |
| P43 | [P1] 当前可以使用的简历表达 | [Q107](qa-05-foundations-scenarios.md#q107) |
| P44 | [P1] 实现后才能写的表达 | [Q100](qa-05-foundations-scenarios.md#q100) |
| P45 | [P1] 五分钟演示脚本 | [Q005](qa-01-business-data.md#q005)、[Q094](qa-05-foundations-scenarios.md#q094) |

## 5. 用户指定博主：公开图文逐项筛选

分享链接解析到[字节Agent图文](https://www.douyin.com/note/7692045240148158329)，作者小流浪_coding。主页显示18作品，但只提供17个公开note链接；已取得这17条全部196张图片并做本地Windows OCR和主题筛选，无需登录。**剩余1项未核对，不宣称读完所有视频或所有作品。** OCR仍为recognized_requires_review，未完成196页逐字人工校对；已目视核对指定帖与RAG帖的首图。原图/全文OCR仅在Git忽略的本地资料区，不在本手册转发。来源清单只含页面链接、数量和图片hash。

内容是作者自述/整理，未核实为招聘方原题。技术答案须再按官方来源校验；例如“数据库热更新必须由Agent完成”“失败自动重试/降级”均不照抄。

| 页面 | 图片数 | 筛选处置 | 对应回答 |
| --- | ---: | --- | --- |
| [用户指定字节Agent](https://www.douyin.com/note/7692045240148158329) | 22 | Schema、DB错误/热更新、MCP、回调、上下文、检索/质量/耗时/并发；末尾重复AI题库合并到下表，不重复计题 | [Q012](qa-01-business-data.md#q012)、[Q046](qa-03-agent-evaluation.md#q046)、[Q066](qa-04-engineering-extensions.md#q066)、[Q081](qa-04-engineering-extensions.md#q081)、[Q084](qa-04-engineering-extensions.md#q084)、[Q085](qa-05-foundations-scenarios.md#q085)、[Q109](qa-05-foundations-scenarios.md#q109)、[Q110](qa-05-foundations-scenarios.md#q110)、[Q111](qa-05-foundations-scenarios.md#q111)、[Q112](qa-05-foundations-scenarios.md#q112) |
| [录用/鼓励](https://www.douyin.com/note/7679008460893275577) | 1 | 排除：不是技术问答 | 不纳入 |
| [Java高频](https://www.douyin.com/note/7682726464899133425) | 10 | 仅保留性能/并发排查含义；纯Java排除 | [Q081](qa-04-engineering-extensions.md#q081)、[Q084](qa-04-engineering-extensions.md#q084)、[Q106](qa-05-foundations-scenarios.md#q106) |
| [Java+Agent学习路线](https://www.douyin.com/note/7679325816744801915) | 5 | 保留AI学习主题；路线/求职建议非实现 | [Q058](qa-04-engineering-extensions.md#q058)、[Q063](qa-04-engineering-extensions.md#q063)、[Q095](qa-05-foundations-scenarios.md#q095) |
| [美团后端](https://www.douyin.com/note/7703481881736318331) | 6 | 保留事务、幂等、定位思路；Spring细节排除；末尾重复AI题库合并到下表，不重复计题 | [Q070](qa-04-engineering-extensions.md#q070)、[Q084](qa-04-engineering-extensions.md#q084)、[Q106](qa-05-foundations-scenarios.md#q106) |
| [腾讯Agent](https://www.douyin.com/note/7701625628290813433) | 6 | 保留多库路由、权限、改写、Embedding空间；末尾重复AI题库合并到下表，不重复计题 | [Q073](qa-04-engineering-extensions.md#q073)、[Q079](qa-04-engineering-extensions.md#q079)、[Q085](qa-05-foundations-scenarios.md#q085)、[Q098](qa-05-foundations-scenarios.md#q098) |
| [火山引擎Agent](https://www.douyin.com/note/7700197951720897787) | 24 | 保留RAG、429/幂等、无MQ任务及上下文；末尾重复AI题库合并到下表，不重复计题 | [Q043](qa-03-agent-evaluation.md#q043)、[Q070](qa-04-engineering-extensions.md#q070)、[Q085](qa-05-foundations-scenarios.md#q085)、[Q092](qa-05-foundations-scenarios.md#q092) |
| [滴滴后端](https://www.douyin.com/note/7698282660913214385) | 6 | 只保留可迁移后端问题；Java类库排除；末尾重复AI题库合并到下表，不重复计题 | [Q081](qa-04-engineering-extensions.md#q081)、[Q084](qa-04-engineering-extensions.md#q084)、[Q106](qa-05-foundations-scenarios.md#q106) |
| [小红书Agent](https://www.douyin.com/note/7696802320793072113) | 18 | 保留Agent/RAG、状态/工具、质量与工程主题；末尾重复AI题库合并到下表，不重复计题 | [Q036](qa-03-agent-evaluation.md#q036)、[Q063](qa-04-engineering-extensions.md#q063)、[Q065](qa-04-engineering-extensions.md#q065)、[Q069](qa-04-engineering-extensions.md#q069)、[Q090](qa-05-foundations-scenarios.md#q090)、[Q112](qa-05-foundations-scenarios.md#q112) |
| [得物中间件AI](https://www.douyin.com/note/7690881786724885178) | 14 | 保留工程与AI边界，未使用中间件不写成果；末尾重复AI题库合并到下表，不重复计题 | [Q066](qa-04-engineering-extensions.md#q066)、[Q070](qa-04-engineering-extensions.md#q070)、[Q081](qa-04-engineering-extensions.md#q081)、[Q092](qa-05-foundations-scenarios.md#q092)、[Q106](qa-05-foundations-scenarios.md#q106) |
| [SHEIN Java](https://www.douyin.com/note/7688335719730975162) | 17 | 纯Java排除；索引/并发问题归后端储备；末尾重复AI题库合并到下表，不重复计题 | [Q070](qa-04-engineering-extensions.md#q070)、[Q084](qa-04-engineering-extensions.md#q084)、[Q106](qa-05-foundations-scenarios.md#q106) |
| [八股/实习建议](https://www.douyin.com/note/7687172008442180465) | 2 | 排除：求职建议，不作为技术事实 | 不纳入 |
| [字节日常实习](https://www.douyin.com/note/7686779935658378469) | 17 | 保留异常/并发/工程含义；纯Java题排除；末尾重复AI题库合并到下表，不重复计题 | [Q070](qa-04-engineering-extensions.md#q070)、[Q081](qa-04-engineering-extensions.md#q081)、[Q084](qa-04-engineering-extensions.md#q084)、[Q106](qa-05-foundations-scenarios.md#q106) |
| [大三实习建议](https://www.douyin.com/note/7685610042947250097) | 2 | 排除：与RAG技术链无直接关系 | 不纳入 |
| [高德后端](https://www.douyin.com/note/7684107453315805627) | 17 | 保留数据库/性能/并发储备；Java细节排除；末尾重复AI题库合并到下表，不重复计题 | [Q070](qa-04-engineering-extensions.md#q070)、[Q084](qa-04-engineering-extensions.md#q084)、[Q106](qa-05-foundations-scenarios.md#q106) |
| [RAG笔记](https://www.douyin.com/note/7682997575276292273) | 11 | 保留构建、切块、检索、评测主题 | [Q008](qa-01-business-data.md#q008)、[Q012](qa-01-business-data.md#q012)、[Q017](qa-02-retrieval-generation.md#q017)、[Q019](qa-02-retrieval-generation.md#q019)、[Q027](qa-02-retrieval-generation.md#q027)、[Q046](qa-03-agent-evaluation.md#q046)、[Q054](qa-03-agent-evaluation.md#q054) |
| [Agent笔记](https://www.douyin.com/note/7682335211371931825) | 18 | 保留工作流/循环、工具、记忆、成本与观测 | [Q036](qa-03-agent-evaluation.md#q036)、[Q045](qa-03-agent-evaluation.md#q045)、[Q063](qa-04-engineering-extensions.md#q063)、[Q064](qa-04-engineering-extensions.md#q064)、[Q068](qa-04-engineering-extensions.md#q068)、[Q090](qa-05-foundations-scenarios.md#q090) |

### 多帖末尾重复的AI题库：合并后的主题映射

部分Java面经末尾也附Agent/RAG/协议题库，不能因帖子标题是Java而一并漏掉。下列问题主题来自这些重复页及RAG/Agent笔记，均按本项目状态回答。

| 合并主题 | 回答 |
| --- | --- |
| RAG定义、完整离线/在线链及模型边界 | [Q002](qa-01-business-data.md#q002)、[Q003](qa-01-business-data.md#q003)、[Q005](qa-01-business-data.md#q005) |
| 文档存储、切块、单文档、表格及参数 | [Q008](qa-01-business-data.md#q008)、[Q009](qa-01-business-data.md#q009)、[Q012](qa-01-business-data.md#q012)、[Q013](qa-01-business-data.md#q013)、[Q014](qa-01-business-data.md#q014) |
| Embedding、检索流程、向量库与IVF/HNSW | [Q017](qa-02-retrieval-generation.md#q017)、[Q054](qa-03-agent-evaluation.md#q054)、[Q075](qa-04-engineering-extensions.md#q075)、[Q076](qa-04-engineering-extensions.md#q076) |
| 意图定向/全局搜索、词法/向量、多路召回 | [Q018](qa-02-retrieval-generation.md#q018)、[Q019](qa-02-retrieval-generation.md#q019)、[Q020](qa-02-retrieval-generation.md#q020)、[Q065](qa-04-engineering-extensions.md#q065)、[Q098](qa-05-foundations-scenarios.md#q098) |
| 检索优化、低召回排查、重排与偏题 | [Q025](qa-02-retrieval-generation.md#q025)、[Q026](qa-02-retrieval-generation.md#q026)、[Q027](qa-02-retrieval-generation.md#q027)、[Q073](qa-04-engineering-extensions.md#q073)、[Q103](qa-05-foundations-scenarios.md#q103) |
| 冲突、幻觉与证据支持的评测 | [Q024](qa-02-retrieval-generation.md#q024)、[Q030](qa-02-retrieval-generation.md#q030)、[Q032](qa-02-retrieval-generation.md#q032)、[Q035](qa-02-retrieval-generation.md#q035)、[Q046](qa-03-agent-evaluation.md#q046) |
| Agent框架、Workflow/Tools、LLM/RAG关系 | [Q036](qa-03-agent-evaluation.md#q036)、[Q063](qa-04-engineering-extensions.md#q063)、[Q064](qa-04-engineering-extensions.md#q064)、[Q067](qa-04-engineering-extensions.md#q067) |
| CoT/ToT/ReAct/Planning及循环控制 | [Q063](qa-04-engineering-extensions.md#q063)、[Q068](qa-04-engineering-extensions.md#q068)、[Q096](qa-05-foundations-scenarios.md#q096) |
| 短期/长期记忆、抽取存储检索、上下文压缩 | [Q045](qa-03-agent-evaluation.md#q045)、[Q080](qa-04-engineering-extensions.md#q080)、[Q085](qa-05-foundations-scenarios.md#q085)、[Q086](qa-05-foundations-scenarios.md#q086) |
| 工具选择/失败、过大返回、过多Schema | [Q043](qa-03-agent-evaluation.md#q043)、[Q065](qa-04-engineering-extensions.md#q065)、[Q085](qa-05-foundations-scenarios.md#q085)、[Q091](qa-05-foundations-scenarios.md#q091)、[Q111](qa-05-foundations-scenarios.md#q111) |
| 多用户稳定性、异步任务、追踪、可靠性 | [Q069](qa-04-engineering-extensions.md#q069)、[Q070](qa-04-engineering-extensions.md#q070)、[Q081](qa-04-engineering-extensions.md#q081)、[Q090](qa-05-foundations-scenarios.md#q090)、[Q092](qa-05-foundations-scenarios.md#q092)、[Q112](qa-05-foundations-scenarios.md#q112) |
| Function Calling、MCP、Skill、CLI、SSE/WS | [Q064](qa-04-engineering-extensions.md#q064)、[Q066](qa-04-engineering-extensions.md#q066)、[Q067](qa-04-engineering-extensions.md#q067)、[Q111](qa-05-foundations-scenarios.md#q111) |

CLI是程序命令入口，Skill偏任务说明/资源，MCP是工具/资源协议，三者不是谁替代谁。小模型摘要、大量工具Schema裁减、内容索引定位等追加场景见[理论与练习](foundations-and-exercises.md)，均明确当前未实现的部分。

### 外部面经补充：发现问题，不当权威答案

| 公开自述/讨论 | 采用的追问主题 | 回答 |
| --- | --- | --- |
| [公开讨论1](https://www.nowcoder.com/discuss/940040254214389760?sourceSSR=users) | 项目复盘、业务、gold、混合检索与框架 | [Q005](qa-01-business-data.md#q005)、[Q019](qa-02-retrieval-generation.md#q019)、[Q047](qa-03-agent-evaluation.md#q047)、[Q069](qa-04-engineering-extensions.md#q069)、[Q094](qa-05-foundations-scenarios.md#q094) |
| [公开讨论2](https://www.nowcoder.com/discuss/928067497637478400) | RRF常数、错误传播与成本证据 | [Q021](qa-02-retrieval-generation.md#q021)、[Q044](qa-03-agent-evaluation.md#q044)、[Q050](qa-03-agent-evaluation.md#q050)、[Q094](qa-05-foundations-scenarios.md#q094) |
| [公开讨论3](https://www.nowcoder.com/discuss/869231276035760128) | RAG、Memory与意图评测 | [Q045](qa-03-agent-evaluation.md#q045)、[Q046](qa-03-agent-evaluation.md#q046)、[Q065](qa-04-engineering-extensions.md#q065) |
| [公开讨论4](https://www.nowcoder.com/discuss/927526880675205120) | 身份、幂等与故障状态 | [Q070](qa-04-engineering-extensions.md#q070)、[Q082](qa-04-engineering-extensions.md#q082)、[Q104](qa-05-foundations-scenarios.md#q104) |

没有“全网所有面试题”的可验证边界。本手册覆盖本次给定资料和公开可访问补充，按业务相关性合并为112张卡；重复提问归同一答案，非项目技术标明储备，纯招聘/Java细节排除。后续发现新题应先定位缺的是知识解释、实现还是证据，不因多一个热词就扩建系统。

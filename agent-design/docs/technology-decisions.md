# 基础 RAG 技术决策

核对日期：2026-11-04。下列“初选”是结合现有代码和本机资源的工程判断；模型卡规格与本地实测分开记录。性能、医学质量或线上状态不能从设计文字推断。

本轮实现与两模型实测已完成，最终取舍、验收与缺口见[执行报告](execution-2026-11-04.md)；下列对照保留选型理由。

## 决策 1：复用 PostgreSQL/pgvector，先精确检索

| 方案 | 对比重点 | 本项目取舍 |
| --- | --- | --- |
| PostgreSQL/pgvector | 可与事实、版本、条件、撤回一起查询和事务管理；支持精确检索与近似索引 | 首选，复用现有本机 PG；小库先精确余弦，建立可核对的正确性基线 |
| Qdrant | 向量与 payload 过滤专门化，但事实仍在 PG | 保留对照；当前需额外解决双存储同步、撤回与恢复，收益未实测 |
| Chroma | 本地原型与单机接入便捷 | 现有 PG 已是事实权威存储，不为当前小库再加一份持久化 |
| Milvus | 面向更大规模向量工作负载，有独立部署组件 | 当前小库尚无引入与维护这组组件的证据 |

[pgvector 官方](https://github.com/pgvector/pgvector)说明默认精确近邻，并提供 HNSW/IVFFlat；[Qdrant 本地部署](https://qdrant.tech/documentation/quickstart/)、[过滤](https://qdrant.tech/documentation/search/filtering/)、[Chroma 架构](https://docs.trychroma.com/docs/overview/architecture)、[Milvus standalone](https://milvus.io/docs/install_standalone-docker-compose.md)用于部署边界对照。该选择不表示 pgvector 在任何规模都优于专用库。

本轮新增健康 evidence 专用索引表，不能塞进既有菜谱 variant 向量表。冻结原知识包与 `001/002` 研究 SQL 保留，用追加 SQL 扩展；索引 ready 只代表完整派生向量可查询，不代表疾病规则或线上健康推荐获准。

未来只有精确检索实测延迟不满足需求时才对照 ANN。ANN 过滤可能使候选不足，须另验过滤后召回与必要证据；不能把近似候选数直接当完整事实覆盖。

## 决策 2：两名主要 Embedding 候选与一个 CPU 备选

| 模型 | 官方规格/用法 | 本轮角色 |
| --- | --- | --- |
| Qwen3-Embedding-0.6B | 0.6B、32K 上下文、32–1024 可选维度；检索 query 使用任务 instruction，document 不加同一 query 前缀 | 主候选之一，初次固定 1024 维，测 CPU 质量/延迟 |
| BGE-M3 | 1024 维、8192 token，可支持 dense/sparse/multi-vector | 主要对照；本轮仅使用 dense，不同时引入三套表示，不套用旧 BGE 中文 query 前缀 |
| BGE-small-zh-v1.5 | 中文轻量模型、512 维；按模型卡使用中文检索指令 | CPU 资源/延迟不合适时的备选，不预先宣称质量等同 |

规格与示例依据官方 [Qwen 模型卡](https://huggingface.co/Qwen/Qwen3-Embedding-0.6B)、[BGE-M3 模型卡](https://huggingface.co/BAAI/bge-m3)、[BGE-small 中文模型卡](https://huggingface.co/BAAI/bge-small-zh-v1.5)。最大输入长度是模型能力上限，不是项目默认上下文预算。

每个实验锁定模型 revision、维度、pooling、query/document 指令、归一化、表示版本和推理库版本；不同配置分别建索引，query 必须用匹配身份编码。逐条检查真实 tokenizer 长度，超限拒绝或另建可追溯表示，不能静默截断原证据。

本机为 CPU/约 32 GB 内存；两模型顺序加载，不要求同时常驻。Python 环境隔离于 `.local-data/rag/`，公开权重缓存同处受控目录；不改全局 Python。模型常驻回环进程，Node 调用结构化接口并校验身份、向量维数、finite、非零和归一化。

## 决策 3：A1＋dense，在 fact 层融合

A1 已处理受控实体、分型/食品形态和否定，并返回 fact；dense 编码 evidence 以发现语义候选。dense evidence 经事实—证据关联映射成 fact 排名，统一 fact ID 后再做 RRF。不要把不同 ID 空间的排名直接相加，也不把向量相似度解释为健康适宜性概率。

保留 A1、dense、hybrid 三组模式。先查身份/版本、来源状态与撤回，再做候选发现与适用性检查；生成前后仍复查水位。每条选中 fact 的支持和限定证据独立补齐，不能被 top-k 挤掉。必要条件未知、明确不适用、撤回与无相关证据分别处理。

RRF、top-k 和上下文预算是可配置实验参数，不是已验证的上线指标。现有中文 A1 不等于 BM25，PG 默认全文也不能直接命名为中文 BM25；本轮不为跑通强加分词服务或全文扩展。

## 决策 4：先条件化增强，不以模型改写替代证据

上下文按问题、明确条件、选中事实、原文证据、出处、限制与冲突组装。检索文本、原文和生成摘要分开，原文与来源 hash 不随提示词优化变化。预算不足只减少事实集合，不能留下结论却丢掉人群/例外/限定证据。

首版不做在线 query 自主扩写或循环工具搜索。重排列为可开关实验：只有在相同数据上能改善召回/条件保留且延迟可接受才保留；如使用 [bge-reranker-v2-m3](https://huggingface.co/BAAI/bge-reranker-v2-m3)，其输出是 query–passage 相关性分数，不是向量或医学概率。

## 决策 5：复用 DeepSeek，明确输出契约

生成端复用固定 DeepSeek chat 接口、JSON 模式、完整终态和 usage 凭证校验；新增 RAG 回答适配器，不把原先的查询准备接口当成完整回答器。当前接口与 JSON 行为以 [官方首次调用](https://api-docs.deepseek.com/)和 [JSON Output](https://api-docs.deepseek.com/guides/json_mode/)核对；即使供应商建议重试，项目仍保持失败不自动补发。

模型只对本请求证据作带引用的研究性说明。程序校验 fact/evidence ID 是否属于上下文，并复查来源撤回；空白、截断、非法引用、超时和预算不足有明确终态。合法 ID 不自动证明蕴含关系成立，真实样本另做人审。

## 决策 6：普通函数编排，保留可替换接口

Node/TypeScript 依次执行 `embed → retrieve → merge → validate → assemble → generate → validateOutput`；Python 只负责本机模型推理。对外保持清楚的 Embedding、存储、检索、增强与生成接口，避免把框架状态当业务事实。

[LangChain 的检索说明](https://docs.langchain.com/oss/javascript/deepagents/retrieval)和 [LlamaIndex TypeScript RAG](https://developers.llamaindex.ai/typescript/framework/tutorials/rag/)可作连接器/编排对照。当前已有合同、账本、条件和撤回机制，首版不增加框架依赖；后续连接器复杂度实际增加再评估。

## 实测证据如何记录

比较使用同一语料与逐题显式条件，统一 fact 层 Recall@K、MRR/nDCG，并报告必要证据完整率、条件错误、冷启动与温态 P50/P95、内存、索引体积、建库耗时。开发/验收用例隔离，来源编辑题不冒充独立临床评价。

最终模型与参数必须引用实际索引 manifest、数据集版本和运行报告；本文件中的官方规格或初选不替代实测。调用次数、费用预留、真实 usage 与人工复核缺口按[本轮计划](basic-rag-plan-2026-11-04.md)记录。

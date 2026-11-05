# 基础 RAG 数据与调用契约

本页解释本轮实际接口；类型以 [types.ts](../../backend/src/rag/types.ts)、存储约束以[追加 SQL](../../backend/src/health-knowledge/003-evidence-vectors.sql)为准。研究数据、个人资料和产品执行规则分开维护。

## 模型身份与索引

- `EmbeddingIdentity` 同时锁定 `modelId`、40位 revision、维度、L2、pooling、query/document instruction、表示版本及推理库版本。同为1024维不代表两个模型可以混查。
- 原始 evidence 使用稳定 ID，`textHash` 针对实际编码的 `retrievalText`；原文、出处与条件留在冻结知识包中，不因检索表示变化而改写。
- `EvidenceVector` 为 `evidenceId + textHash + vector`。必须全部证据齐全、ID无重复、向量维数正确且有限并归一化，才能在事务中发布 `ready`。
- PG 的索引 manifest 绑定 bundle ID/hash、完整模型身份、预期条数及内容摘要。已有索引不可覆写；重新编码或修改身份使用新 ID。
- pgvector 按 float32 存储，向量摘要按相同精度生成。默认精确余弦，距离不等于适宜性或安全概率。
- 原始包 `embeddingBuilt:false` 描述冻结发布包；派生 PG 索引的真实向量状态由新 manifest 证明，不倒改原包。

## 本机 Embedding 服务

入口见 [Python runtime](../../backend/rag-runtime/runtime.py) 与 [Node provider](../../backend/src/rag/embedding.ts)，仅绑定 `127.0.0.1:15199`。

| 接口 | 输入 | 返回与检查 |
| --- | --- | --- |
| `GET /health` | 无 | `status: ready`、真实 identity 及运行观测 |
| `POST /embed` | JSON `{texts: string[], role: 'query'或'document'}` | `{identity, vectors, tokenCounts}`；顺序与输入一致 |

每批1～16段，每段最多16000字符；服务再按真实 tokenizer 检查8192 token运行上限。超限拒绝，不静默截断。服务离线读取已锁定权重，不下载模型或调用生成端；`POST /embed` 拒绝携带 Origin 的请求。Node 禁止重定向并限制响应大小、超时、模型身份、向量维数及归一化。

## 查询与上下文

- `RagQuestion` 含 `question`、逐题明确的 `context`，可选 `diseaseId`、`mode` 和业务指定的 `requiredEvidenceIds`。验收 `expected*` 仅评分，不送入检索或模型。
- A1 返回 fact；dense 返回 evidence 后通过原始关系映射为 fact，在统一 ID 空间做 RRF。实体范围与适用条件先核对，未知条件不默认补齐。
- `RagContext` 保存选中 fact、原始 evidence、出处/版本/hash、明确条件、冲突、缺口、估算 token 与撤回水位。事实需要的支持/限定证据完整补入；预算不够减少事实，不能删掉例外条款。
- `needs_confirmation` 可返回 `missingConditions`。没有生成回答时不附带伪造的 answer 或调用凭证。
- 来源、版本、证据、事实、知识包与索引撤回按实际关联检查。生成前后重新查询 PG 撤回集；旧研究库撤回在每次 CLI 开始追加同步，不能清空任一撤回集。

## 生成、引用与终态

DeepSeek 只接收本请求公开证据、问题和明确条件，固定既有地址与型号，JSON输出，至多一次调用，无重定向或自动重试。模型输出：

```json
{"claims":[{"text":"有来源支持的陈述","factIds":["实际fact ID"],"evidenceIds":["实际evidence ID"]}],"limitations":["适用范围与限制"]}
```

程序只接受上下文内 ID，每个引用 fact 至少有一条支持证据且带齐全部限定证据；`answer` 由已校验 claim 文本拼接，不能额外塞入无引用正文。ID 合法不等于语义蕴含已被人工确认；本轮代理来源对照不冒充独立人工或临床签认。

| 状态 | 含义 |
| --- | --- |
| `answered` | 生成与引用契约通过，仍是研究说明 |
| `needs_confirmation` | 实体/分型歧义、必要条件缺失或组合未核验 |
| `insufficient_evidence` | 无相关证据、必需证据撤回/缺失或闭包装不进预算 |
| `unavailable` | 模型、索引、协议、预算、输出校验异常或生成期间证据变化 |

所有状态均为 `executionAllowed:false`、`clinicalRelease:null`。离线 `ExtractiveFixtureGenerator` 无供应商凭证；只有真实返回的 request ID、model、完整 usage 和终态校验后才记录真实 receipt。

## 持久化边界与授权

权重、隔离环境、研究连接、专用 Key 与调用账本均在 Git 忽略目录。任意交互查询报告只写 `.local-data/rag/queries/`；公开验收目录只放登记的构造问题与公开证据。

真实调用要求显式开关、登记的公开案例、当日核验价格和 active 专项授权。账本在发请求前持久化保守预留，失败计次数、未知usage不退款；进程文件锁和对象内串行化防止重复预留。账本只保存输入摘要及必要receipt，不保存密钥或提示正文。

本轮5元/50次授权在完成6次后已关闭；不能自行重开或清空账本。命令、当前索引及已知限制见[运行说明](runbook.md)和[执行报告](execution-2026-11-04.md)。

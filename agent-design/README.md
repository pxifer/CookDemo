# Agent 设计导航

设计与运行实现分开：产品运行代码留在 `backend/src/` 与 `shared/`；此处记录职责、输入输出、当前实现位置、限制与待完成项，不建立第二份代码。

涉及 RAG 技术选型、Embedding/向量存储、召回融合、上下文增强、生成与评测的需求，先读[文档目录](docs/README.md)及[基础 RAG 执行计划](docs/basic-rag-plan-2026-11-04.md)。实际命令、实验记录与完成边界见[运行说明](docs/runbook.md)。

| 模块 | 说明 |
| --- | --- |
| [ingestion](ingestion/README.md) | 来源接入、解析、切块和溯源 |
| [retrieval](retrieval/README.md) | A1、证据向量与事实层混合召回；[RAG 方案](retrieval/health-rag-plan.md) |
| [augmentation](augmentation/README.md) | 上下文增强、证据组装和预算 |
| [generation](generation/README.md) | 模型适配与输出复核；[模型 API](generation/health-model-api.md) |
| [memory](memory/README.md) | 页面会话、加密个人档案与撤销 |
| [storage](storage/README.md) | 公共研究库与 PG/pgvector 设计，区别于个人记忆 |
| [orchestration](orchestration/README.md) | 固定工作流、任务水位、调用账本与取消 |
| [evaluation](evaluation/README.md) | 评测入口及[协议](evaluation/protocol.md) |
| [optimization](optimization/README.md) | 实验与[既有 A1 优化复核](optimization/health-rag-optimization-v2.md) |

本轮真实本地 Embedding、研究向量库及6次生成验收见[执行报告](docs/execution-2026-11-04.md)；重排、独立质量审核及线上疾病 RAG 仍有缺口，不因研究结果创建云服务或开启产品开关。面试最终合集仍保留在[原目录](../docs/project-handbook-2026-10-30/README.md)。

后续已完成[食材指导与实际选菜的本地接入](docs/business-rag-execution-2026-11-04.md)：复用直接疾病指导，新增独立减脂/增肌资料与配方绑定；真实PG及构造供应商通过，新增真实调用0次。资料治理、映射覆盖与独立质量审核按[TODO](docs/todo.md)继续，不把局部技术联调写成完整疾病发布。

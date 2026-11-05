# 知识与向量存储

- 职责/输入输出：公共版本知识、来源撤回与索引配置 → 可校验快照及查询存储。
- 当前实现：[backend/src/health-knowledge-repository.ts](../../backend/src/health-knowledge-repository.ts)、[backend/src/health-knowledge/](../../backend/src/health-knowledge/)、[backend/src/migrations/003-vector-structure.sql](../../backend/src/migrations/003-vector-structure.sql)
- 当前状态：原 PGlite 研究库保留；独立本地 PG 研究库已持久化两套各98条证据向量与不可变索引 manifest，使用附加研究 SQL `003-evidence-vectors.sql`。原菜谱向量表及冻结知识包不改，线上疾病知识未正式发布。
- 后续边界：公共证据与个人档案隔离；后续锁定模型、维度、切片和索引版本，不创建新服务。

设计目录不承载产品运行代码，详见[总导航](../README.md)。

实测与恢复入口见[本轮执行](../docs/execution-2026-11-04.md)。

后续业务接入新增不可变 `guidance_assets`（研究SQL004），保存目标知识与显式食材映射快照，启动回读校验；新增目标未建向量。见[业务执行记录](../docs/business-rag-execution-2026-11-04.md)。

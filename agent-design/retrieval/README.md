# 检索

- 职责/输入输出：查询、疾病分型、条件与撤回集 → 候选证据、消歧和缺口。
- 当前实现：[backend/src/health-knowledge-retrieval.ts](../../backend/src/health-knowledge-retrieval.ts)、[backend/src/health-knowledge.ts](../../backend/src/health-knowledge.ts)
- 当前状态：A0/A1 保留；2026-11-04 已完成 Qwen0.6B/BGE-M3 真实本地编码、PG 精确检索及事实层加权 RRF，对照 27 条来源工程用例。必需证据闭包与条件/撤回复核均保留。
- 后续边界：这组用例已用于调试，不能称独立盲测；当前词法基线也表现很好，未证明向量优于词法。重排与正式线上疾病推荐仍未开放。

实际计划、参数和报告从[文档目录](../docs/README.md)、[执行报告](../docs/execution-2026-11-04.md)进入。

设计目录不承载产品运行代码，详见[总导航](../README.md)。

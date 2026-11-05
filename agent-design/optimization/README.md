# 优化

- 职责/输入输出：可复现失败样例、性能与质量数据 → 有对照的优化结论。
- 当前实现：[scripts/check-project.ts](../../scripts/check-project.ts)、[agent-design/evaluation/](../../agent-design/evaluation/)、[backend/src/health-knowledge-retrieval.ts](../../backend/src/health-knowledge-retrieval.ts)
- 当前状态：已有 A1、预算和一致性优化，真实向量/混合召回对照见[执行报告](../docs/execution-2026-11-04.md)；小集合未证明向量质量胜过A1，重排、容量收益及医学质量仍无实测保证。
- 后续边界：先记录问题与基线再实验，不因目录已经建立就引入 Redis、向量服务或 Agent 框架。

设计目录不承载产品运行代码，详见[总导航](../README.md)。

# 评测

- 职责/输入输出：固定数据、源码指纹与运行条件 → 分维度报告、失败样例及未测事项。
- 当前实现：[scripts/evaluate-health-knowledge-v2.ts](../../scripts/evaluate-health-knowledge-v2.ts)、[scripts/evaluate-ai-recipes.ts](../../scripts/evaluate-ai-recipes.ts)、[scripts/evaluate-agent-candidates.ts](../../scripts/evaluate-agent-candidates.ts)、[scripts/rag.ts](../../scripts/rag.ts)、[datasets/evaluation/](../../datasets/evaluation/)
- 当前状态：既有50题编辑回归保留，新增27题三模式/两模型对照及6次真实DeepSeek研究样本，见[执行报告](../docs/execution-2026-11-04.md)。27题已用于调试回归，200题候选也不等于独立冻结评测。
- 后续边界：独立人工/临床审核与泛化质量未完成；本轮6次专项授权已关闭，不自行启用历史预算或追加调用。

设计目录不承载产品运行代码，详见[总导航](../README.md)。

食材指导与实际选菜新增 `rag:business:evaluate` 和 `test:rag:e2e`；真实本地PG、341道公开缓存、12个指导/6个本餐案例及桌面/手机接入结果见[业务执行记录](../docs/business-rag-execution-2026-11-04.md)。供应商为构造数据，12题已用于调试，真实生成效果与独立人审仍待完成。

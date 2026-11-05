# 工作流与调用控制

- 职责/输入输出：身份、任务、输入/凭证版本与预算 → 原子认领、有限步骤执行及明确终态。
- 当前实现：[backend/src/gateway.ts](../../backend/src/gateway.ts)、[backend/src/health-recipe-selection.ts](../../backend/src/health-recipe-selection.ts)、[backend/src/recipe-evidence.ts](../../backend/src/recipe-evidence.ts)
- 当前状态：已有固定工作流、单次认领、任务水位和研究工具闭环；不冒充自主规划或多 Agent。
- 后续边界：共享任务生产开关、跨实例与取消消耗边界按现有验证状态表达。

设计目录不承载产品运行代码，详见[总导航](../README.md)。

# 上下文增强

- 职责/输入输出：本餐、当前账户档案、受检候选和证据 → 有预算且保留来源的上下文。
- 当前实现：[shared/context-budget.ts](../../shared/context-budget.ts)、[backend/src/health-chat.ts](../../backend/src/health-chat.ts)、[backend/src/recipe-evidence.ts](../../backend/src/recipe-evidence.ts)
- 当前状态：既有聊天预算与研究绑定保留；基础研究 RAG 已按 fact 汇合完整 support/qualify 证据、定位、条件、冲突与撤回水位，预算不足减少事实而不截断限定证据。无关未选事实的条件不冒充当前回答必需条件。
- 后续边界：证据依赖条件、撤回和未知状态不能在压缩时丢失。

设计目录不承载产品运行代码，详见[总导航](../README.md)。

当前边界与验收见[执行报告](../docs/execution-2026-11-04.md)。

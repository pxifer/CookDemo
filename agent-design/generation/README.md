# 生成与模型适配

- 职责/输入输出：已核对上下文与用户主动操作 → 经结构、终态及硬条件校验的回答/实际菜谱 ID。
- 当前实现：[backend/src/health-model.ts](../../backend/src/health-model.ts)、[backend/src/health-chat.ts](../../backend/src/health-chat.ts)、[backend/src/health-recipe-selection.ts](../../backend/src/health-recipe-selection.ts)
- 当前状态：个人 Key AI 对话及选菜保留；2026-11-04 独立研究 CLI 已完成6条公开构造问题的真实 DeepSeek RAG 生成，保留真实 request ID/model/usage，并做引用集合、限定证据及返回前撤回复核；产品疾病 RAG 仍未开放。
- 后续边界：保持固定接口、无自动重试和失败不静默回退，质量仍需独立评测。

设计目录不承载产品运行代码，详见[总导航](../README.md)。

本轮费用、调用与审核边界见[执行报告](../docs/execution-2026-11-04.md)；专用付费授权已关闭，不自动恢复。

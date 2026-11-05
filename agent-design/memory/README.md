# 记忆与个人档案

- 职责/输入输出：用户自述、接受/取消与删除 → 按来源归属的加密个人档案和当前会话上下文。
- 当前实现：[shared/health-topics.ts](../../shared/health-topics.ts)、[shared/account-merge.ts](../../shared/account-merge.ts)、[frontend/src/account-store.ts](../../frontend/src/account-store.ts)、[backend/src/cloudbase-accounts.ts](../../backend/src/cloudbase-accounts.ts)
- 当前状态：已有账号档案与 CAS 合并；完整聊天仅页面内存，不是向量长期记忆。
- 后续边界：删病、清除、跨设备冲突及迟到回复必须保留撤销语义；不新增推荐历史。

设计目录不承载产品运行代码，详见[总导航](../README.md)。

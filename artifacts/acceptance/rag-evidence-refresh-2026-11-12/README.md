# RAG-008 本地验收

2026-11-12；基线main `bfa1567ccb43ca02e2a42f75c57e521a250d105d`。顺序、数据解释及命令见[执行记录](../../../agent-design/docs/evidence-refresh-2026-11-12.md)。本目录仅固定公开资料/构造任务，无用户Key或真实健康档案。

- 阶段1：9项隔离/v2回归通过，旧包重导也不能复活缺陷支持。
- 阶段2：29项知识/业务契约通过；新增5个Python正文反例拒绝导航、标题、歧义、原件变更，保留完整条件。
- 阶段3：9项当前/旧映射及新知识回归通过；33规范名、35对象归属；不靠菜名、别名或营养猜测扩展。
- 完整本地单元：353项，351通过、2按既有条件跳过；显式使用现有锁定Python，未安装/升级依赖。构建、主类型及验收类型通过；新核验脚本已纳入验收类型。
- 桌面/手机：[浏览器JSON](browser/browser-results.json)，2项通过，使用构造账户/供应商和本地研究入口；不是新增真实模型生成。
- [存储/检索/映射](storage-and-mapping.json)：真实回环PG＋真实离线Qwen，99条1024维独立索引；旧索引未改。A1/dense/hybrid三条合格查询均answered且限定完整，未知条件needs_confirmation，旧导航required返回insufficient_evidence。
- [业务报告](business/report.json)：341菜谱固定公开缓存，12指导、10本餐场景通过；[用量等价](business/quantity-equivalence.json)在固定夹具operation/secret下实际user packet及catalog一致，输入1g/99999g不改变选菜约束。过敏/不补买缺料正确无结果；新增花菜、娃娃菜场景返回可行菜。
- 仅改变映射的对照：35变体多了指导绑定；有依据变体总数仍337，不能包装成准确率提升。
- 新包两次重建10文件逐字节一致，24个旧冻结文件未变；[冻结核对](rebuild-verification.json)。新正文4条、修订工艺事实4条，其余95证据保持。
- 现有CLI实测：v3＋新index ID＋显式回环Embedding地址，固定公开问题answered、providerCalled=false，报告留忽略目录。

首次新clone检查缺构建页/选错Python，修正环境后通过；首次Docker不可用，用户恢复后才做真实PG。核验脚本初次参数次序错误产生unavailable，修正后五项通过，未把失败改写成真实模型成功。原始过程日志及真实本地向量缓存留 `.local-data/evidence-refresh/`。

没有真实生成API、邮件、云端测试或部署，没有修改既有SQL或冻结索引；新向量不是“模型推荐更好”的证明。完整资料/专业审核、目标/映射覆盖、独立评测和参数消融继续待办；不恢复旧付费预算。回退代码需同步恢复默认catalog/映射选择，已知坏证据隔离不应随回退撤销；PG新增不可变研究版本保留，不能删除旧数据或清空撤回。

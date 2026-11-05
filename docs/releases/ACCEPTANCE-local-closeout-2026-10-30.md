# 浏览器补测通过与后续计划接续

**更新：2026年10月30日已收到并核对[本版完整报告](../../artifacts/acceptance/project-check-2026-10-30T06-04-49-269Z/report.json)。20/20组通过，失败、权限阻塞、未运行均为0；源码指纹稳定并与候选一致，`localGateComplete=true`。以下“最后一轮”运行请求已完成，无需重复执行。后续新增开发与配置入口见[测试站联调记录](ACCEPTANCE-staging-recovery-2026-10-30.md)。**

10月30日核对用户报告[`project-check-2026-10-29T16-54-58-620Z`](../../artifacts/acceptance/project-check-2026-10-29T16-54-58-620Z/report.json)：本轮失败项已清零。Schema、两组类型、前端构建、普通浏览器、业务浏览器六个选定阶段全部通过，`focusedChecksComplete=true`，无失败/权限阻塞。

普通浏览器36项通过；其中8项业务配置用例按原配置跳过，已由独立业务组的8项全部通过覆盖。口味切换、收藏重新核验和构造营养更新已在桌面/手机实际通过。报告仍有14个未选择阶段，`localGateComplete=false`、`releaseReady=false`，不能把局部补测当作本版完整发布验收。

## 最后一轮同版本全量验收（已完成）

核对打包证据时发现，运行时代码引用的`datasets/recipes/curation`下菜谱步骤、成分审查和图片映射JSON不在原源码指纹范围。已将该目录48个数据文件纳入指纹，并新增扫描运行时静态JSON依赖的回归；这些数据以后变化也会使旧验收和旧候选失效。`frontend/src/index.html`原已随src目录覆盖。

补齐后本地检查为[`project-check-2026-10-29T17-01-54-832Z`](../../artifacts/acceptance/project-check-2026-10-29T17-01-54-832Z/report.json)：常规测试241项，240通过、0失败、1项真实PG跳过；构建、类型、知识与契约检查通过，源码稳定。Codex进程仍存在端口/Docker权限限制，原生PG与浏览器只能继续由普通终端执行。

此次已运行不带`-RetryFailed`的完整入口，各组证据已绑定同一版本：

```powershell
& 'D:\codex_AI\菜谱推荐\CookDemo\scripts\verify-in-terminal.ps1'
```

## 已继续完成的后续准备

| 工作 | 实际交付 | 验证边界 |
| --- | --- | --- |
| 发布候选 | [完整基线候选记录](../../artifacts/acceptance/next-stage-audit-2026-10-30/candidate-full-baseline.json)，已绑定20组全量通过报告，构建及依赖锁一致，包含两份追加迁移 | 通过版基线本地打包；随后新增测试站开发另行记录；目标未配置、未复制密钥、未迁移或部署 |
| 独立评测审核材料 | [200题审核包](../../artifacts/acceptance/quality-review-pack-2026-10-29T17-13-06-015199Z/README.md)，含五维题目、公开配方、事实/证据定位索引、待填审核字段和内容hash | 引用无缺失；所有标签仍为candidate，实际输出/最终输入/审核人和质量结论留空 |
| DeepSeek预算准备 | [当日价格核验](../../artifacts/acceptance/next-stage-audit-2026-10-30/pricing-verification.json)，已准备受控价目文件和显式调用入口 | 专用Key缺失，实际模型调用/消费均0；6题离线契约6/6通过；缺Key时live入口拒绝 |
| 云环境盘点 | [只读检查结果](../../artifacts/acceptance/next-stage-audit-2026-10-30/cloud-environments.json) | CLI清单查询被权限拒绝；环境数量和是否有测试副本未知，没有据此创建资源 |
| 账户/灾备/测试站/回滚 | [后续配置与验收模板](../../artifacts/acceptance/next-stage-audit-2026-10-30/remaining-inputs.json) | 四类模板均not_run，所有放行字段false；不是完成报告 |

价目按当日[DeepSeek官方人民币价格表](https://api-docs.deepseek.com/zh-cn/quick_start/pricing/)核对：固定deepseek-flash，按较高时段、输入不命中缓存的2元/百万输入token及8元/百万输出token保守预留，不使用折扣降低预算。价目文件仅在2026-10-30有效；之后运行须重新核价。应用预算预留不等同供应商实际账单。

默认离线入口为`.local-data/evaluation/run-evaluation.ps1`；专用Key在受控文件就位后，显式加`-Live`才会尝试付费，预算继续共用5元账本。不要将Key或密码发到聊天。此入口是6题开发冒烟，不会把200题候选自动变成独立质量通过，也不能替代测试站端到端模型验证。

## 按预设计划的下一步

1. 已核对本版全量报告20组、稳定指纹及全部发布证据；本地通过，正式发布仍缺5类外部证据，通过并不自动部署。
2. 指定已有隔离测试目标、专用邮箱和可注销测试账号。测试目标是“不影响现有网站”的独立副本；若没有现成环境，先确定隔离方式和费用，不自行开通资源。
3. 完成生产独立撤销日志、管理员删除身份续作适配器及真实身份备份/恢复接线。这些仍有实现缺口，不仅是缺配置。官方[PG身份认证说明](https://docs.cloudbase.net/authentication-v2/auth/auth-pg)说明PG模式身份数据位于auth schema；项目实际模式尚未查询确认，当前业务快照不能冒充身份系统完整备份。
4. 已补测试站找回密码的受控邮箱路径，并继续保持默认关闭；名单检查覆盖发信和完成阶段。后续需取得目标和测试身份再真实联调，详见[测试站配置](../operations/config/staging-acceptance.md)。
5. 在5元预算内执行真实模型开发冒烟；独立人员完善/审核200题后冻结，执行五维质量复核。模型执行、程序契约、真实端到端和人审结论分别记录。
6. 完成隔离业务/身份恢复、来源撤回和账户撤销不复活的回滚演练，再对测试站逐项验收，最后审核正式发布。

上述可以继续由Codex完成代码、构建、受控脚本和报告；外部环境/账号、专用Key、独立存储及审核人员目前尚未提供。配置缺口、功能未接线和未执行验证均已分开记录，没有通过新增flag或手填结论绕过门禁。

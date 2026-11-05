# 项目评审整改本地验收

日期：2026-10-29。范围是本地代码、公共内容及明确构造身份；未部署云函数、推送远端、调用真实Key、发送真实邮件或删除用户。

本轮按[项目评审](../archive/project-review-2026-10-29.md)落实，完整状态和剩余缺口见[执行记录](ACCEPTANCE-review-improvements-2026-10-29.md)。当前变更没有独立Git提交，使用[统一报告](../../artifacts/acceptance/review-implementation-2026-10-29/report.json)中的源码/依赖/SQL/测试输入指纹绑定结果；`sourceStable=true`。

| 验证 | 结果 |
| --- | --- |
| 运行时Schema生成、TypeScript、Vite构建 | 通过 |
| 全量Node测试 | 219项，218通过，0失败，1项需真实PG的候选集成跳过 |
| 健康研究知识完整性 | 通过；原v2仍为研究发布 |
| A1检索编辑回归 | 50/50；不是独立冻结集 |
| 真实菜谱证据研究样例 | 2菜/4绑定；研究注解、条件未知、撤回及错绑分开 |
| 公共配方与构造档案AI契约 | 6/6；`mode=mock_contract_only`，`qualityPassed=null` |
| 普通桌面/手机浏览器 | `permission_blocked`，回环连接EACCES |
| 健康聊天桌面/手机浏览器 | `permission_blocked`，同上 |
| 真实模型质量、PG多连接、云端跨实例/迁移、全系统恢复 | 未运行 |

测试基线的14项失败已修复，原成分权限、撤回、篡改断言继续执行；使用冻结历史输入及其解析产物，未放宽生产指纹。候选接口断言按后续产品决定验证公共字段及只读行为，真实PG专项也不再依赖过时固定总数。

新增验证包括：候选截断后拒选不宣称全库无结果、保留最后烹调步骤、必需输入超预算时零调用、非法模型ID仍记录usage、长会话引用和角色顺序、证据发布前撤回、两个API实例的晚到结果取消及页面任务隔离。两个API实例使用同一PGlite fixture，不是原生PG多连接。

`RECOMMENDATION_TASKS_ENABLED`默认关闭；先迁移共享任务SQL并完成真实环境验证，再考虑启用。新UI修改尚缺浏览器复验。本地门禁`localGateComplete=false`、`releaseReady=false`，权限跳过没有被记作成功。

复现命令：`./scripts/run.ps1 check`。编排器权限阻塞退出2，PowerShell包装会报告任务未通过。逐阶段日志、模型契约、研究注解和全部未测项均保存在统一报告同目录。

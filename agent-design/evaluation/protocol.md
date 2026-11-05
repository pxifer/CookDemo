# 可复现评测与后续放行

本轮采用已有Node / Fastify / PGlite / Playwright和公共内容，不增加服务。统一命令为 `./scripts/run.ps1 check`。报告保存源码和依赖锁指纹、逐阶段命令、结果、日志及未测范围；运行期间源文件变化会使验收失效。

## 已可执行的层次

| 入口 | 证明什么 | 不能证明什么 |
| --- | --- | --- |
| `test` | 业务约束、HTTP/模型契约、来源生命周期、研究撤回和构造并发 | 云端实例与真实供应商质量 |
| `health:verify` | 当前知识manifest和结构、证据定位及关系完整性 | 医学签认 |
| `health:evaluate` | 50道来源衍生编辑回归及A0/A1对照 | 未见问题泛化、云端延迟 |
| `health:recipe-demo` | 两道真实配方的4条食材级绑定，条件与撤回闭环 | 整菜疾病适宜性、全库覆盖 |
| `ai:evaluate` | 6个公开配方/构造档案任务的离线mock契约 | 真实模型能否选对、回答是否合理 |
| `test:e2e` / `test:health:e2e` | 桌面/手机用户操作；健康专项也进入统一入口 | 当前受限环境无法连回环地址时不能执行 |

`check`遇到回环连接EACCES/EPERM时记录`permission_blocked`、继续其余阶段，退出码为2。失败为1，全部本地阶段通过为0；外部验证仍单列，不把退出码0当成发布、临床或真实模型全部通过。业务PG专项保留独立隔离库入口。

## 真实模型评测入口

只使用专用、明确获准的测试Key；脚本不加载应用配置、不访问用户保存的Key。用户后续明确本轮DeepSeek评测预算为5元，但仍未提供专用Key位置。真实调用同时要求 `EVALUATION_ALLOW_PAID=1`、`SHIWEI_EVALUATION_KEY_FILE` 和 `SHIWEI_EVALUATION_PRICING_FILE`，再显式运行 `npm run ai:evaluate -- --live`。价目文件必须是当日核验的官方人民币价目，模板见[价格配置](../../docs/operations/config/evaluation-pricing.example.json)。本轮没有执行live。

每题最多一次调用；无效JSON、截断、拒选、硬条件未通过、供应商错误分别保留。已返回usage的无效结果也计入token；无usage的尝试单独列出，不当作零消耗。不自动重试，不根据接口名称猜价；未核定价目时拒绝付费运行。保守预留写入跨运行独占账本，失败和未知消耗不自动退款；预留不能冒充供应商实际账单。账单未核对时费用金额为null。

6题目前为开发候选，`independentReview=null`，`qualityPassed=null`。人工需逐题核对：合法ID、是否回应目标、理由是否由实际配料/做法支持、是否混用做法、未知量是否被冒充精确营养、是否出现疗效保证。通过契约与通过质量是两个字段。首版“过敏任务”曾只检查无调用，复核后收紧为还必须得到程序`no_results`；不能让其他错误冒充正确排除。

## 独立检索集怎样补齐

由未参与召回调参的人核对问题及答案，不把AI出题、调参、作答、打分的闭环称为独立。可先完成200题候选，但数量不能替代标注质量。按疾病、食物形态、歧义、否定、更正、工艺条件、冲突、撤回及无答案分层；同一问题的改写必须分在同一簇，防止开发/冻结集泄漏。

每条标签至少包含 `caseId / clusterId / split / query / context / expectedFactIds / requiredEvidenceIds / forbiddenFactIds / expectedState / annotationVersion / reviewers / adjudication`。以稳定事实和证据span标注，不绑当前chunk ID排序；冻结时保存问题、标签、知识manifest、脚本和配置的hash。reviewers与裁决未完成时状态只能是candidate，不能宣布“独立200题通过”。

开发集用于选k、召回通道和重排；冻结集只用于预先约定的比较，失败后可回到开发集修复，但不能继续把被反复查看的同一批题宣称为未见集。保留失败样本、分组分母和置信区间。小组样本很少时报告原始命中数。

## 向量与重排实验的放行条件

先比较A1，再比较A1+dense+RRF，最后比较增加rerank。必须使用相同问题分组、内容/Embedding版本、过滤条件与预算；RRF融合各通道排名，不直接相加不同量纲相似度。撤回、来源、形态与必要条件在生成前核验，dense不能决定安全。

记录Recall@k、必要证据全覆盖率、无答案误接收、条件错配、MRR/nDCG，以及端到端延迟、输入规模和总token。不能用同题生成的“正确答案向量”泄漏标签；不能拿mock向量证明模型收益。当前无经过授权和核验的Embedding/reranker模型权重或专用服务配置，因此没有虚构向量实验结果，仍保留A1。

## 跨实例与运维放行

新增共享任务水位的SQL为 `deployment/db/recommendation-tasks.sql`。任务按账户+页面taskId隔离，版本及操作ID只作排序，不保存本餐或推荐历史；与付费操作单次认领分开。先在隔离真实PG多连接下执行同任务并发、旧版本、不同taskId、过期、RLS和故障注入，再迁移到既有云库，最后设置 `RECOMMENDATION_TASKS_ENABLED=1`。当前默认关闭，两个API实例/PGlite通过不能替代这些步骤。

忘记密码、注销与恢复仍有实际缺口。已核对官方[邮箱密码找回](https://docs.cloudbase.net/api-reference/webv3/authentication)、[删除当前用户](https://docs.cloudbase.net/http-api/auth/user-delete-me)和[重新认证](https://docs.cloudbase.net/http-api/auth/user-reauthenticate)。身份删除还需要二次认证；供应商“相关数据”描述不能证明自建PG私表、备份和独立撤销日志都已清除。SDK与HTTP文档表现也不能未经受控联调就互换。未触发真实邮件或删除任何用户。

后续本地实现已有邮箱重置、注销工作流/撤销SQL、业务快照/隔离恢复和200题候选集；生产独立日志及真实外部验收仍未齐备。执行状态、所需配置和五维质量标准以[本轮执行与剩余验收](../../docs/operations/validation-status.md)为准；冻结器不会把未审核候选标为独立数据。自动契约通过和独立模型质量通过始终分开。

现有 `scripts/backup-encrypted.ps1 -VerifyRestore`只验证其约定的本地空结构范围；不得拿它证明CloudBase账户、Key、资料和最新删除水位已完成恢复。真实恢复必须有隔离目标、最新独立撤销记录和身份/密钥验证；在这些证据齐备前继续拒绝将恢复结果开放。

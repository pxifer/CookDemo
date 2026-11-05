# RAG资料与业务质量：标注、划分及冻结规范

日期：2026-11-05。对应 TODO C1/C4/C5；本页和工具是工程基础，不代表独立样本或专业审核已经具备。

## 四类任务与标签

| 任务 | 输入 | 评分标签（只交给评分器） |
| --- | --- | --- |
| parsing | 原件ID/hash、页或区域、解析配置 | 正文/噪声区域；表头、行列、对象、值、单位、基准、脚注、否定和条件；可视定位 |
| retrieval | 查询、明确疾病/目标与条件、知识/索引版本 | 相关fact/evidence及0～3相关性、必需支持/限定闭包、偏题/条件错误 |
| food_guidance | 明确疾病/目标、必要条件及食材目录版本 | food/category/process ID、prefer/limit/avoid/unknown、适用条件、支持/限定事实与证据 |
| meal | 本餐食材有无、人数、调料、限制、补买和目录版本 | 可行集合或规则、禁止菜品、类别数量、配料/做法依据、逐项理由支持及预期状态 |

相关性0=无关；1=仅同主题、不能支持所问动作；2=部分支持但仍缺限定；3=直接支持且必要条件完整。相关性与适用性分别标，3分不代表医学安全或整菜适宜。原文缺剂量/工艺条件时不可用高分抵消。过敏/忌口、伪造目录ID、撤回复活、无依据执行声明分别作为硬失败，不由平均质量分抵消。

D19-13仍优先：用户填写1g、99999g或未填量在菜品资格上等价；不能把输入量少作为负标签。原配方量和证据剂量条件另行保留；没有相关依据就保留判断，不冒充定量验证。

## 划分与泄漏边界

每条记录包含稳定case ID、任务、划分、问题族、来源族、原件hash、主题、输入、gold、曝光情况及审核记录。development可调试；regression保留历史/已调试样例；acceptance和hard为只读预留候选。使用预留题定位或改进后必须转为曝光记录，不能继续叫盲测。

两种隔离政策必须声明：

- `source_disjoint`：新来源/解析泛化。原件hash、转载来源族和问题族都不得跨开发与预留集；解析验收始终要求这一隔离。
- `question_family_disjoint`：固定公开知识库上的独立问题评测。允许共享知识库来源，必须披露共享项，问题族与输入仍隔离；结果不能宣称新来源泛化。把已索引资料从验收中全部禁用并不能检验实际固定库RAG。

[曝光登记](../../datasets/evaluation/rag-exposure-registry-v1.json)保守记录既有题集及13个已使用来源。旧27题、50题、12个业务案例和既有候选不能靠改ID变成独立金标准。代码只能检查已登记的曝光、族与hash，无法证明“改写后的问题从未被看过”；应由实际审核者登记问题族、重复来源和争议。

当前[4个工程候选](../../datasets/evaluation/rag-quality-candidates-v1.json)均为regression、gold为空、项目代理整理且待标注。独立acceptance/hard尚未创建，不输出独立质量分数。当前四类各1例只用于验证流程，不能代表覆盖充分。

## 审核记录与职责

记录审核者ID/角色、日期、标签来源、状态、独立性声明、理由和分歧/裁定。工程人员核对解析、映射、协议与程序约束；医学/运动营养适用性需相应专业人员。项目代理核对仍写 `origin:project_agent`，不计独立人审；模型评委也不能给自己签认。

工具拒绝缺审核者/日期/理由却声称裁定、项目代理却声称独立、医学任务由工程角色冒充专业裁定等记录。它只校验用户提供的声明格式，不能核实真实身份或专业资质；专业签认仍依赖真实人员与可核查记录，不由一个JSON字段完成。

`qualityInferenceInput()`仅导出case ID、task及input，gold、划分和审核信息不送检索/生成；input嵌套gold/expected/labels等字段会被拒绝。评分运行要保持gold单独加载，不能用“期望菜名/事实ID”增强模型。主题分布、允许集合、条件和理由链必须在标注后单独报告。

## 执行与冻结

使用Node24，在根目录执行：

```powershell
node --import tsx scripts/rag-quality.ts audit datasets/evaluation/rag-quality-candidates-v1.json datasets/evaluation/rag-exposure-registry-v1.json .local-data/rag-quality/audit-v1
node --import tsx scripts/rag-quality.ts freeze datasets/evaluation/rag-quality-candidates-v1.json datasets/evaluation/rag-exposure-registry-v1.json .local-data/rag-quality/frozen-v1
```

`freeze`校验泄漏与记录结构，生成dataset、规范化载荷hash及文件字节hash；同目录内容变化拒绝覆盖，需新版本/新目录。未审核的划分可以冻结为candidate assignment，`independentAcceptanceReady:false`必须保留；不能把freeze成功写成独立评测通过。

下一步：由真实标注者补齐解析/相关性/食材/本餐标签；另组织未参与调试的问题族，明确固定库与新来源的各自评测目标，冻结后才推进C2/C3调参和C4分层评分。保留失败、分歧与未经专业复核项。

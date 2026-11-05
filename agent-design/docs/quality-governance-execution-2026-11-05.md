# RAG-002：资料重建与评测前置基础执行记录

日期：2026-11-05。用户要求继续TODO。本批从已验证的RAG-001提交开始，在独立任务分支实现，交接前纳入管理流程最新main；不直接改main或自行合并。范围是C1工具/规范、现有资料B1重建和真实预览留下的三项业务细节。B2～B6及独立人审仍按TODO推进。

## 本批实现

| TODO | 结果 | 依据 |
| --- | --- | --- |
| C1前置 | 四类样本契约、问题族/来源族/原件hash与曝光登记；固定库问题及新来源泛化分开；拒绝标签泄漏与伪造独立审核；不可变候选冻结 | [标注规范](quality-annotation-protocol.md)、`scripts/lib/rag-quality-protocol.ts`、`scripts/rag-quality.ts` |
| B1 | 13个公开原件登记、锁定Python及PDF/AES/字体依赖；修复HTML旧路径，默认离线；隔离派生输出、原hash与版本/产物manifest、逐来源拒收 | [重建说明](source-rebuild-runbook.md)、`scripts/rebuild-health-sources.py`及`verify-source-rebuild.py` |
| A3/A6细节 | 20条建议按方向和主题/对象轮转；血脂分型补问可回答，明确不知道保留未知且不重复追问；不显示无法解释的内部条件键 | `backend/src/rag/food-guidance-chat.ts`及`food-guidance.ts` |
| A4增量 | 映射v2仅新增明确白菜心成员，v1保留；新知识指纹/PG快照与旧版分开，不凭菜名或相似度猜成员 | [映射说明](../../datasets/health/food-guidance-mappings-v2.md) |

本次没有补造新的疾病/营养事实，没有给新目标建立向量、训练或启用重排，没有将图像原文冒充OCR，也没有改变用户量值仅供参考的D19-13规则。

## 实际证据

- [四类候选及冻结检查](../../artifacts/acceptance/rag-quality-governance-2026-11-05/evaluation-candidates-final/audit.json)：4个regression工程候选，全部gold为空/待标注；独立acceptance/hard尚未建立，`independentAcceptanceReady:false`。相关性/最终菜品独立质量没有分数，不能把工具通过当质量提升。
- [两次真实原件重建比较](../../artifacts/acceptance/rag-quality-governance-2026-11-05/source-rebuild-verification.json)：13来源、479解析单元，产物逐字节一致；87条既有规范化定位不变、11条待原图核对、4条需新定位，无规范化span找不到。全文输出留在忽略目录，公开报告仅含hash和状态。
- 真实原件首次暴露AES依赖缺失及字体编码提示；新隔离环境补齐并锁定依赖后重新完整构建两次。失败/中间产物留在本地，不覆盖原件、旧文字或冻结定位。
- [真实本机PG及341道公开目录回归](../../artifacts/acceptance/rag-quality-governance-2026-11-05/business-pg/report.json)：12/12指导、6/6本餐场景通过，生成供应商为构造数据；研究PG按新映射ID追加不可变资产并回读。此报告的固定数据集日期仍为11月4日，实际本批执行与新目录区分，不改旧历史日期。
- [实际目录映射对比](../../artifacts/acceptance/rag-quality-governance-2026-11-05/catalog-before-after.json)：对炝拌白菜心用相同实际配方离线重建v1/v2绑定，新成员通过明列配料关联；不调用真实模型、不宣称整菜低脂或完成医学签认。两侧展示都使用本批均衡策略，不冒充旧展示策略的A/B实验。
- 新增专项覆盖跨划分泄漏、固定库来源共享披露、审核记录、gold隔离、20条建议失衡、过敏过滤、补问/未知和新旧映射。Python另覆盖重复构建、原件hash、路径逃逸、拒绝覆盖、否定/单位、真实空白PDF待OCR标记。

完整构建/类型/单元与相关桌面/手机检查对最终提交SHA运行，准确结果与源码稳定性另保存在原仓库 `.local-data/management/submissions/RAG-002-20261105/`，不把本页创建前的回归冒充后续提交的独立复验。管理 chat 仍需按完整SHA审查后集成并复验main。

## 保留与限制

冻结v1/v2、目标资料v1、映射v1、001～004 SQL、旧索引、真实模型历史记录和两套面试材料不改。原预览服务没有重启、没有读取/复制已保存Key；本批实现未自动进入该进程或线上。新增付费模型调用0次，既有专项不重开。

B1已完成范围限定为这些已有原件；正文质量、表格逐格对齐、多栏顺序、OCR置信与语义审核仍待做。4个工程候选尚无真实人工gold，不能输出独立检索/食材/菜品质量结论。来源/定位完整性只是工程条件，不是医学批准。

下一批先为B2建立正文/版面保真样本，再推进B3/B4；专业人员补齐相关性、食材方向和本餐理由标注后，才在明确划分上推进C2～C6的表示、重排和分层评测。未准备好独立集时继续做工程回归，不停开发，也不改名冒充盲测。

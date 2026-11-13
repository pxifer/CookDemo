# 疾病、营养与目标扩展 v1

本包补充项目已有健康知识 v3，以结构化检索接入本地食材建议和实际配方绑定。已导入现有本地研究 PostgreSQL；仍为研究资料，`clinicalRelease=null`，未新增向量、个人全天能量处方或整菜营养计算。

| 内容 | 本包数量及范围 |
| --- | --- |
| 来源 | 9 个：USDA 成分数据库；NIH/NIDDK/NHLBI/ODS、NHS 官方公开资料 |
| 正文证据 | 36 条，保留原文、来源快照 hash、段落/字符定位、限定支持 |
| 疾病 | 新增便秘、胃食管反流病、乳糖不耐受、非酒精性脂肪性肝病、缺铁性贫血；与已有 8 类组合为 13 类食材指导主题 |
| 用户目标 | 增肌、减脂、维持体重、健康增重、运动恢复、均衡饮食；目标独立于疾病 |
| 定性规则 | 42 条食物指导、5 条能量/营养原则 |
| 食材 | 91 个具体 USDA 食物记录，生熟、干鲜、品种、凝固剂和强化状态分别保留 |
| 营养指标 | 32 项；2,912 个食材×指标记录，其中 2,756 个源报数值、156 个明确缺项 |

营养指标包括能量、蛋白质、总脂肪、碳水（差减法）、膳食纤维、饱和脂肪；维生素 A（RAE）、B1、B2、B3（烟酸，不当作烟酸当量）、B5、B6、B9（总叶酸/食物叶酸/DFE分列）、B12、C、D（D2+D3）、E、K；钙、铁、镁、磷、钾、钠、锌、铜、锰、硒及胆碱。B7/生物素是显式缺项指标，本源没有对应含量，不补造数值。

## 来源

| 官方资料 | 内容和状态 |
| --- | --- |
| [USDA SR Legacy 官方下载](https://fdc.nal.usda.gov/download-datasets/)、[数据说明](https://fdc.nal.usda.gov/data-documentation/)、[CC0 许可](https://fdc.nal.usda.gov/api-guide/) | 2018 最终历史数据，FDC 发布日期另存；源值可能来自分析、计算或推算，不统一声称实验测量 |
| [NIDDK 便秘饮食](https://www.niddk.nih.gov/health-information/digestive-diseases/constipation/eating-diet-nutrition) | 官方标注审阅 2018-05；纤维来源与逐步增加的限定一起保留 |
| [NIDDK 成人 GERD 饮食](https://www.niddk.nih.gov/health-information/digestive-diseases/acid-reflux-ger-gerd-adults/eating-diet-nutrition) | 审阅 2020-07；触发因人而异，需本人确认相应食物，不列统一禁食清单 |
| [NIDDK 乳糖不耐受](https://www.niddk.nih.gov/health-information/digestive-diseases/lactose-intolerance/eating-diet-nutrition) | 审阅 2018-02；无乳糖奶仍含乳蛋白，酸奶/硬奶酪保留耐受条件 |
| [NIDDK NAFLD/MASLD 饮食](https://www.niddk.nih.gov/health-information/liver-disease/nafld-nash/eating-diet-nutrition) | 审阅 2021-04；不将一般“脂肪肝”自动归为该病因 |
| [NHLBI 缺铁性贫血](https://www.nhlbi.nih.gov/health/anemia/iron-deficiency-anemia) | 更新 2022-03-24；饮食辅助不替代查因或补铁治疗，一般“贫血”不自动匹配 |
| [NIDDK 减重与维持](https://www.niddk.nih.gov/health-information/weight-management/adult-overweight-obesity/eating-physical-activity) | 审阅 2023-05；减脂和维持分别建主题，未把平均能量例子变成个人目标 |
| [NIH ODS 运动营养资料](https://ods.od.nih.gov/factsheets/ExerciseAndAthleticPerformance-HealthProfessional/) | 运动能量与食物蛋白来源；本次直取 HTML 遇到访问挑战，采用明确标注的公开 web 工具正文快照，hash 指该快照，不能声称原 HTML hash；没有提取补充剂效能规则 |
| [NHS 健康增重](https://www.nhs.uk/live-well/healthy-weight/managing-your-weight/healthy-ways-to-gain-weight/) | 审阅 2023-03-28，页面下次审阅日期 2026-03-28 已过，`reviewDue=true`；非自愿体重下降时不应用普通增重指导 |

NIDDK 页面说明内容由其科学家及其他专家审核；这不等同于本项目获得专业签认。NHS 中文内容是项目改编，遵循其 [OGL 复用条款](https://www.nhs.uk/our-policies/terms-and-conditions/)：Contains public sector information licensed under the Open Government Licence v3.0。不要称为 NHS 批准的中文临床内容。MedlinePlus 的 A.D.A.M. 运动营养文章因其 RAG/数据集限制排除，见 `knowledge.json.exclusions`。

## 成分记录的使用边界

- 固定基准是每 100 g 可食部；来自归档中官方字段说明，定位与归档成员 hash 见 [composition-provenance.json](composition-provenance.json)。牛奶的 100 g 不自动换算成 100 ml。
- 保留 `KCAL/G/MG/UG` 原始单位。维生素D不自动从 IU 混算；叶酸总量、天然食物叶酸和 DFE 不相加。能量作为营养指标，不当作化学成分。
- 数值保留原始字符串、`food_nutrient.csv` 记录 ID/序号、完整原行 hash、数据点及分析/计算/推算方式。`csvRow` 指含表头的 CSV 记录序号，不是物理文本行号。
- `not_reported` 的值、原行和定位均为 null；源报零保留为零，也不声称绝对不含该成分。SR Legacy 没有本批可用的 B7 字段。
- 这些是美国历史样品/参考组成，不能冒充中国具体采购食材的实测值。食材名称检索词只用于召回参考记录，`foodFormConfirmed=false`；具体名称、形态和原始英文名称始终返回，不能据召回替代食物身份核验。扁桃仁不映射为杏核仁。
- 原料和熟食是不同记录；不能仅凭两个记录的差值推导烹调损失或吸收率。数值不参与用户库存用量资格，不自动推导某种食材治病、增肌或整菜达标。

## 查询与重建

在仓库根目录，使用 Node.js 24；命令不调用模型：

```powershell
node --import tsx scripts/nutrition-knowledge.ts verify
node --import tsx scripts/nutrition-knowledge.ts query --query '生西兰花维生素C'
node --import tsx scripts/nutrition-knowledge.ts query --query '干香菇维生素D'
node --import tsx scripts/nutrition-knowledge.ts query --query '维生素B族'
node --import tsx scripts/nutrition-knowledge.ts query --query '增肌'
node --import tsx scripts/nutrition-knowledge.ts import-local --database-url-file '.local-data/rag/database-url'
node --import tsx scripts/nutrition-knowledge.ts query-local --database-url-file '.local-data/rag/database-url' --query '健康增重'
```

未知适用条件会随指导一起返回 `needs_confirmation`；组成事实可以作为带形态的参考记录查询，不表示个人建议已适用。`lookupScope` 区分食材命中、目标相关参考和单指标列表；没有食材命中时，不把其他食材的排名当作用户所问食材的组成。查询仅输出，不提供落盘参数；公共知识库不存个人问题或条件。

原件缓存仅在本地 `.local-data/public-sources/`。显式下载工具 [fetch-nutrition-sources.py](../../../scripts/fetch-nutrition-sources.py) 不处理访问挑战，ODS 快照另行保留。离线构建不联网，使用冻结的 [来源锁](../nutrition-source-lock-v1.json) 和 [策展配置](../nutrition-curation-v1.json)：

```powershell
python scripts/build-nutrition-knowledge.py --cache .local-data/public-sources --output .local-data/nutrition-rebuild-check
```

本批 Python 3.14 与 3.11 的三个发布 JSON 字节一致。旧文件与不同结果均不覆盖；来源或事实更新需新版本。新事实未建向量，原 v3 的 99 条证据索引和历史验收保留。接入结构及实测见 [执行说明](../../../agent-design/docs/nutrition-expansion-2026-11-13.md)。

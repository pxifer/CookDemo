# v1知识库来源与建库记录（历史）

**当前基础入口为[知识库v3](README-v3.md)，另有[疾病、营养与目标扩展](nutrition-guidance-2026-11-13-v1/README.md)**。基础包/旧向量与新结构化组成、食物指导分别管理；当前版本见 `catalog.json`。以下保留 v1 交付时的范围和记录，旧版查询需显式选择 `--bundle 2026-10-28-v1`；不把下文旧默认路径当成当前路径。

版本 `health-kb-2026-10-28-v1`，建库日期 2026-10-28（Asia/Shanghai）。按用户本次明确选择，同时覆盖高血压、糖尿病和痛风；糖尿病首批限定成人2型，高尿酸血症与痛风使用不同疾病ID。

已建立可重建的公共研究知识库，并实际导入本机持久化 PGlite。数据的 `source_checked` 表示项目代理核对了权威来源、原文定位及字段，**不表示项目关系或规则已经过临床专家签认**。58条规则均为草稿；没有创建疾病正式发布、线上菜谱资格或向量索引。

## 交付内容

| 文件 | 内容 |
| --- | --- |
| [knowledge-bundle.json](2026-10-28-v1/knowledge-bundle.json) | 完整可校验JSON包：来源、实体、证据、关系、规则草稿、冲突和边界 |
| [relations.csv](2026-10-28-v1/relations.csv) | 155条关系，可直接用Excel查看；条件、数量、证据ID保留为JSON字段 |
| [sources.jsonl](2026-10-28-v1/sources.jsonl) | 7份来源、版本、发布者、URL、文件SHA256、使用范围 |
| [entities.jsonl](2026-10-28-v1/entities.jsonl) | 103个实体；疾病、成分、食品/食品类和工艺分开 |
| [evidence.jsonl](2026-10-28-v1/evidence.jsonl) | 53个证据单元；原文短摘、解释性摘要和检索文本分开 |
| [facts.jsonl](2026-10-28-v1/facts.jsonl) | 疾病—成分、食品—成分、食物建议和烹调效应 |
| [rule-drafts.jsonl](2026-10-28-v1/rule-drafts.jsonl) | 58条可逐项审核的定性规则，状态始终为draft |
| [conflicts.jsonl](2026-10-28-v1/conflicts.jsonl) | 4项来源差异、版本差异及来源内部不一致 |
| [manifest.json](2026-10-28-v1/manifest.json) | 文件hash和数量清单；没有Embedding模型 |
| [knowledge-bundle.schema.json](knowledge-bundle.schema.json) | 运行时JSON Schema；约束草稿状态与空正式发布 |

## 来源与准入

首批直接采用国家机构正式公开的指南，另以同行评议的食品成分/烹调实验资料补充。下表的来源类型不等同GRADE证据等级；指南中的共识、机制和实测数据分别保留性质，不伪造统一临床证据等级。

| 来源 | 已纳入内容与定位 | 使用边界 |
| --- | --- | --- |
| 国家卫健委《[成人高血压食养指南（2023年版）](https://www.nhc.gov.cn/cms-search/downFiles/63f752a17cfd4b4781f744477561866f.pdf)》 | PDF第4、6–12页；减钠增钾、脂肪、食物选择及条件 | 全天量仅保留原证据背景，不除成每餐阈值 |
| 国家卫健委《[成人糖尿病食养指南（2023年版）](https://www.nhc.gov.cn/cms-search/downFiles/4fcbecd2c18e46baaf291bf46c2b79cd.pdf)》 | PDF第4、7–11、14–15页；碳水、纤维、食物选择、GI限制 | 成人2型主题；“糖尿病”不自动确认为2型；GI是食物反应指标，不当作化学成分 |
| 国家卫健委《[成人高尿酸血症与痛风食养指南（2024年版）](https://hncdc.com/upload/1/cms/content/editor/1741857707075.pdf)》，湖南省疾控中心公开副本 | PDF第4、7–9、13页；嘌呤、果糖、酒精、蛋奶豆和表1-1 | 未合并肾功能不全等复杂情况的成人；分类范围不是逐食物测定值。[卫健委印发通知](https://www.nhc.gov.cn/sps/c100088/202402/9ba512ba8e314a47a181db11d2fa188d.shtml) |
| 国家卫健委《[高血压营养和运动指导原则（2024年版）](https://www.gov.cn/zhengce/zhengceku/202407/P020240701700333981869.pdf)》，中国政府网附件 | 本附件共14页，首批只核对并使用第1–3页，其中第3页表1经图像目视核对 | 高钾血症和肾病例外；蔬菜量和饮酒强度与2023差异单列；不宣称全附件OCR完成 |
| Kaneko等，《[Total Purine and Purine Base Content…](https://doi.org/10.1248/bpb.b13-00967)》，Biol Pharm Bull 2014;37:709–721 | PDF第3–6页方法及表1–3；本批提取14项样品总嘌呤值 | 论文汇总270种食物，本批未声称全部导入；日本样品不直接作为全部中国食品的统一值；Total与Calculated as uric acid不同 |
| Shinoda等，《[Purine Base Contents in Foods and Effects of Cooking Methods](https://doi.org/10.4327/jsnfs1949.35.103)》，1982;35:103–109 | 出版社英文摘要：煎烤保留、肉煮液迁移及收汁再吸附限制 | 本批依据摘要，未核验全部实验参数，不补造温度、时长、损失率或每道菜产率 |
| 美国国家癌症研究所《[Chemicals in Meat Cooked at High Temperatures and Cancer Risk](https://www.cancer.gov/about-cancer/causes-prevention/risk/diet/cooked-meats-fact-sheet)》，页面标示2017-07-11复核 | 高温HCA、烟雾PAH形成条件及人体证据限制 | 仅作条件化工艺事实；没有据此生成高血压、糖尿病或痛风禁食规则 |

检索日期为2026-10-28。已检查国家营养健康机构的技术指南目录并发现2024补充原则；这不等于对全球文献进行系统综述，也不保证未来没有新版本。页面转载日期、检索日期与原文版本分别处理。公开来源不等于已取得整库或全文再发布许可：本包只分发必要短摘、事实字段、摘要和定位；原PDF/HTML保留本机临时核对副本并被Git忽略，没有批量复制付费成分库。

## 关系解释

`disease_component`仅描述成分与相关结局的方向及条件；`food_component`描述含有、可能含有或实测/分类资料；`food_guidance`必须另有直接食物层面指南支持；`cooking_effect`保存条件化变化。关系没有默认“安全”值。

- `quantity:null`是未提供数值，不是零。25条指南嘌呤分类与14条论文样品实测分开，不取区间中点、不平均冲突来源，也不计算用户实际摄入。
- 干香菇、鲜香菇、干豆、特定豆腐加工类型分别编号。未建立类别展开、跨形态换算或品牌映射。别名不替代组成事实。
- 豆制品“可适量”不自动变成“有益优先”，本批相应动作保存为`insufficient_evidence`并保留可适量的原意，避免无依据加分。
- `prefer / limit / avoid / insufficient_evidence`仅为逐条可审查标签；缺临床条件返回`needs_confirmation`，已知不满足返回`not_applicable`。原文依赖剂量的关系保留`doseDependent`，不输出任意量绝对禁食。
- `directness`区分原文陈述、样品测量、指南分类和项目解释。连汤食用不能把肉块降低量作为整餐降低量，标记为项目解释、证据不足，未冒充直接实测结论。
- 对既往诱发食物仅存证据，不在公共库猜测个人触发物。没有采集个人疾病、用药或聊天资料。

## 已保留的冲突

鲜香菇的指南分类范围为30–75 mg/100g，论文特定鲜样品为20.8 mg/100g；保留两条关系并互联冲突，不裁定哪份来源适合任意用户。高血压2023/2024蔬菜日量和饮酒推荐强度也分别保留。

Kaneko论文3.3正文与表2中香蕉/草莓数值顺序不同，本批排除这两项数值，等待勘误或原作者资料核验。没有用模型选择一个值填库。

## 运行与重建

使用项目Node.js 24和已锁定依赖，无新增收费服务。已建本地数据库在`.local-data/health-knowledge/2026-10-28-v1/`，该目录不进入Git。

```powershell
.\scripts\run.ps1 health:verify
.\scripts\run.ps1 health:import-local
.\scripts\run.ps1 health:evaluate
npm run health:query -- "痛风 牛奶"
```

`health:query`从本地数据库加载关系和当前撤回集合，返回原始依据、条件状态及冲突，始终`executionAllowed:false`。命令默认不提供任何个人临床条件，因此可能返回`needs_confirmation`。结构化调用可用`searchKnowledge`显式提供已确认条件；没有根据问题文本推断肾功能或确诊。查询不写入公共知识库。

源码入口：[校验与检索](../../backend/src/health-knowledge.ts)、[数据库仓储](../../backend/src/health-knowledge-repository.ts)、[独立研究结构DDL](../../backend/src/health-knowledge/001-research.sql)。数据库保存实体边与受控词典token的GIN准备索引；当前查询基线从小库加载后在应用内做结构化/关键词排序，**没有宣称已运行SQL全文检索性能评测或BM25**。不以关键词分数判定食材安全。

重新核对来源时运行`research-health-sources.py`和`research-health-html.py`，需要网络；PDF文字提取使用`pypdf`。含扫描图表的页需重新渲染并目视复核，不自动接受OCR。`build-health-knowledge.py`按已列出的人工整理命题生成包；`verify-health-source-cache.py`核对来源hash、53个定位及14个Total列数值。文件变动必须建新发布版本；不要覆盖已交付包或清空撤回集合。临时导入前补充字段时的旧本地草稿保留于`draft-before-directness/`，不作为当前库。

## 当前完成范围

已完成真实证据小库、JSON/JSONL/CSV、Schema、独立关系结构、本机持久化导入、条件/撤回逻辑、关键词检索和20题编辑回归。已保存[验证记录](../../artifacts/acceptance/health-knowledge-2026-10-28/source-verification.json)与[验收说明](../../docs/releases/ACCEPTANCE-health-knowledge-2026-10-28.md)。20题来自本轮整理，不能作为独立冻结测试集、医疗安全率或Embedding效果指标。

后续是逐条专业审核、真实发布菜谱的bundle/hash/variant/method绑定、200题独立评测、Embedding/重排对照及线上集成。本次没有把研究草稿写入当前生产迁移或启用线上健康筛选；知识库可在现有发布机制前继续开发和审核。

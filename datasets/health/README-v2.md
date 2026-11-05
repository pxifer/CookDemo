# 疾病知识库 v2：当前使用入口

2026-10-28（Asia/Shanghai），版本`health-kb-2026-10-28-v2`。已实际存入本机持久化研究数据库，同时保留v1。当前为权威来源公共研究知识库，`source_checked`是项目代理核对来源；规则均为草稿，没有临床专家签认或线上疾病推荐发布。

| 项目 | v1 | v2 |
| --- | ---: | ---: |
| 来源 | 7 | 11 |
| 疾病实体 | 4 | 8 |
| 全部实体 | 103 | 137 |
| 证据片段 | 53 | 98 |
| 关系 | 155 | 260 |
| 规则草稿 | 58 | 124 |
| 冲突记录 | 4 | 5 |
| 正式发布 / 菜谱绑定 / Embedding | 0 / 0 / 0 | 0 / 0 / 0 |

疾病主题为高血压、成人2型糖尿病、痛风、高尿酸血症，以及新增的**成人高脂血症、成人肥胖症、成人慢性肾脏病、成人原发性骨质疏松症**。没有把8个主题写成已正式支持8个病种或任意疾病组合。

## 数据与来源

- [完整JSON包](2026-10-28-v2/knowledge-bundle.json)、[CSV关系表](2026-10-28-v2/relations.csv)、[manifest](2026-10-28-v2/manifest.json)
- [来源](2026-10-28-v2/sources.jsonl)、[实体](2026-10-28-v2/entities.jsonl)、[证据](2026-10-28-v2/evidence.jsonl)、[关系](2026-10-28-v2/facts.jsonl)、[规则草稿](2026-10-28-v2/rule-drafts.jsonl)、[冲突](2026-10-28-v2/conflicts.jsonl)
- [原v1包](2026-10-28-v1/knowledge-bundle.json)、[v1来源说明](README.md)、[当前版本目录](catalog.json)

新增来源与核对范围：

| 来源 | 已核对内容 | 适用限制 |
| --- | --- | --- |
| 国家卫健委《[成人高脂血症食养指南（2023年版）](https://www.chinacdc.cn/jkyj/yyyjk2/jswj13949/202504/t20250407_305765.html)》，中国疾控中心公开图像版 | 首张官方长图的印刷页2、5–7，10个短摘；完整HTML及所用图像各自有hash、像素定位 | 脂肪种类、胆固醇、添加糖和酒精；高胆固醇/高甘油三酯分型条件保留 |
| 国家卫健委《[成人肥胖食养指南（2024年版）](https://www.hncdc.com/upload/1/cms/content/editor/1741857710156.pdf)》，湖南省疾控副本 | PDF第4、7–9、11页，9个证据单元 | 成人且无复杂合并症；妊娠/哺乳等特殊人群不能套用通用减重；不生成断食或极低热量处方 |
| 国家卫健委《[成人慢性肾脏病食养指南（2024年版）](https://www.hncdc.com/upload/1/cms/content/editor/1741857710741.pdf)》，湖南省疾控副本 | PDF第4、7–12、14页，13个证据单元 | 分期、透析、血钾、尿量、水肿、专业营养计划各自保留；不是肾病统一禁钾/禁蛋白 |
| 国家卫健委《[成人骨质疏松症食养指南及问答（2026年版）](https://www.chinanutri.cn/fgbz/fgbzjszn/202605/t20260526_1836069.html)》，中国疾控营养所附件 | 主指南PDF第7–12、14–15页，13个证据单元；压缩包成员名和hash单独核对 | 限成人原发性，不包括特发性或继发性；未生成钙剂/维生素D药物剂量 |

新增共45片证据、105条关系。v1的155条关系及其他记录逐条原样继承，14项论文样品测定值与25项指南分类保留各自性质，未额外伪造精确含量。source的`pageCount`对PDF是文件页数，对高脂血症HTML长图来源为3个图像资产，印刷页另存于locator，不混为PDF页码。

官方旧页面有附件缺失，已记录实际可用的权威公开副本及形式，未用搜索摘要充当正文。10条图像证据经目视转录，保留原图hash和区域，未宣称完成OCR。对原文仅分发必要短摘、事实和定位，完整PDF、RAR、HTML和图像留在被Git忽略的本地核对目录，不宣称已取得整库/全文再发布许可。

## 检索与条件

当前默认A1（`lexical-v2`），旧A0可显式复现。最长匹配减少短词碰撞；连续中文使用二元片段回退，实体/词法分通道排名并以RRF融合。保留否定，不用否定句自动改变事实或个人限制。歧义、没有证据、条件未知、条件不适用及证据撤回分别处理。

显式食品形态不会被其他形态的样品值替换。成分正负标签不自动生成新的食物动作。内部必需证据和例外保留在独立集合，不能被top-k截断；缺失或撤回会明确返回。原文条件和冲突均附在命中关系中，始终`executionAllowed:false`。

新增肾病与骨质疏松的蛋白建议冲突，保存为`cross_disease_applicability`，疾病组合仍`not_evaluated`。不能机械取最严、平均或用有益分抵消限制。`quantity:null`仍表示未知而非零，不按全天量自动三等分每餐。

## 使用命令

在CookDemo目录，使用Node.js 24和项目锁定依赖：

```powershell
.\scripts\run.ps1 health:verify
.\scripts\run.ps1 health:import-local
.\scripts\run.ps1 health:evaluate
npm run health:query -- "高血脂可以选择不饱和脂肪酸吗"
npm run health:query -- "慢性肾病低蛋白大米"
```

默认读取[catalog.json](catalog.json)指向的v2。历史包可用`npm run health:verify -- --bundle 2026-10-28-v1`或`npm run health:query -- --bundle 2026-10-28-v1 "痛风 牛奶"`显式选择；命令只接受目录登记的版本，不能指定任意路径。

本机共享库在`.local-data/health-knowledge/shared/`，已导入v1和v2，全局撤回跨版本共享。原v1独立目录保留为历史副本；已核对其撤回集合为0，若以后迁移其他旧库，应先合并撤回再查询。研究表仅追加不可变版本，修改/删除被数据库拒绝；撤回只追加，不通过重新导入或回滚清空。

仓储缓存最多2个已校验并深冻结的知识包，保留原metadata和规范化hash。缓存不包含权威撤回状态；每次检索及返回前都会读取撤回集合，变化时重算。当前仍是小库应用内检索，未宣称GIN/SQL全文、BM25或云函数性能已通过。

重建新增资料：`python scripts/fetch-health-expansion.py` → 对官方图像/相关PDF页目视核验 → `python scripts/build-health-knowledge-v2.py` → `python scripts/verify-health-expansion.py`。Python需要既有pypdf/Pillow；RAR只读提取使用Windows tar，先检查成员路径。v2重建遇到已冻结内容不一致会拒绝覆盖，更新内容须使用新版本。核对图像需要保留原图，不只依赖转录文字。

## 验证和剩余工作

已验证11份来源hash、98片证据定位或图像来源、v1逐条保留；实际持久化回读成功。50/50编辑回归通过，原20题A0/A1均20/20，10个困难条件断言A0为5/10、A1为10/10。这不是独立冻结测试集、200题目标完成或医疗效果证明。

详见[优化复核](../../agent-design/optimization/health-rag-optimization-v2.md)、[验收报告](../../docs/releases/ACCEPTANCE-health-knowledge-v2-2026-10-28.md)、[来源核验](../../artifacts/acceptance/health-knowledge-2026-10-28-v2/source-verification.json)、[实际落库回读](../../artifacts/acceptance/health-knowledge-2026-10-28-v2/persisted-verification.json)。后续重点仍是真实菜谱绑定、专业审核及正式发布层、200题独立评测、真实PG/云RPC及按实测选择Embedding/重排；未新增收费服务或线上模型轮次。

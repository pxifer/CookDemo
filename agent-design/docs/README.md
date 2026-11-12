# Agent / RAG 设计文档入口

本目录保存当前 RAG 技术选型、实施计划、数据契约与运行验收说明。运行代码仍在 `backend/`、`shared/` 和 `scripts/`，不能因设计目录存在就声称相关能力已经完成。

| 遇到的需求 | 查阅文件 |
| --- | --- |
| 学习/讲解本项目AI、Agent、RAG全链路；准备面试、核对参数/实验/真实难点及外部题库覆盖 | [工程与面试手册](interview/README.md)、[离线阅读器](interview/reader.html)；112题按实际/研究/方案标状态，附来源映射，不编造对比收益 |
| 继续解决食谱业务断点、目标知识、正文/表格/OCR、检索偏题、独立评测与人工审核集 | [后续行动 TODO](todo.md)，含优先级、动作、验收及依赖 |
| 按缓存原件离线重建、锁定解析器、比较输出/定位，不覆盖冻结资料 | [资料重建运行说明](source-rebuild-runbook.md) |
| 修改HTML正文、PDF页边噪声/双栏/断行、表格候选、OCR检测和原文回溯 | [正文解析运行说明](document-parsing-runbook.md)、[2026-11-06实测](document-parsing-execution-2026-11-06.md)；工程候选不等于语义签认 |
| 运行真实离线OCR、长图分片/坐标回映、表格逐格关系、工程修订及新证据定位/入库拒收 | [表格与OCR运行说明](table-ocr-runbook.md)、[本批实测](table-ocr-execution-2026-11-06.md)；原始记录和修订视图分开 |
| 处理无竖线列界、上下标、跨列串文、旧偏移歧义或导航误引 | [v3定位治理与复现](evidence-resolution-2026-11-06.md)，保留真实失败和替代正文重整候选 |
| 建立四类标注、登记曝光、划分/冻结候选、隔离gold与独立人审 | [质量标注规范](quality-annotation-protocol.md)，候选冻结不等于质量通过 |
| 核对本批B1/C1基础、建议均衡/补问及映射v2的真实完成范围 | [质量治理执行记录](quality-governance-execution-2026-11-05.md) |
| 疾病/减脂/增肌如何关联食材、实际配方与选菜理由；接入本地聊天/选菜 | [业务契约](business-rag-plan.md)、[本地执行记录](business-rag-execution-2026-11-04.md)，区分构造供应商、真实PG与专业待审 |
| 查看当前用户输入→检索→实际增强提示→真实DeepSeek→程序输出；排查特定菜品/无依据拒选 | [2026-11-05真实界面例子](business-rag-example-2026-11-05.md)，包含5次真实记录、修复和未测项 |
| 修改用户食材用量、库存资格、菜数或只改量的刷新/调用行为 | [D19-13用量策略及验收](../../docs/releases/ACCEPTANCE-quantity-policy-2026-11-05.md)，普通与AI均按食材有无，原菜谱量保留 |
| 设计或实施基础 RAG；确认本轮范围、阶段与完成标准 | [基础 RAG 计划](basic-rag-plan-2026-11-04.md) |
| 比较向量库、Embedding、混合召回、增强、生成与编排；解释取舍 | [技术决策](technology-decisions.md) |
| 逐项解释RAG具体技术/算法/理论、RRF原理、替代方案与真实对比范围 | [技术与原理清单](rag-technology-explained.md)，区分业务、研究、离线候选及已测/未测 |
| 核对切块方式/大小/重叠、真实token分布、清洗阈值、模型/召回/top-k/预算/生成采样等具体参数与对比 | [全链路参数与切块核对](rag-parameters-and-chunking.md)，区分现值、实测、初值和未实施实验 |
| 准备本地模型/数据库，建索引、查询、对照评测与真实冒烟 | [运行说明](runbook.md) |
| 修改证据向量结构、索引版本、模型身份、输入输出或重建流程 | [数据与调用契约](contracts.md)，结合技术决策与运行说明核对实际代码及新增 SQL |
| 修改 top-k、RRF、证据闭包、上下文预算、引用或失败状态 | 技术决策的检索/增强/生成章节及本轮验收数据 |
| 核对真实生成授权、调用次数、金额、usage 与未测项 | 基础计划的授权边界、运行说明及实际验收报告 |
| 核对基础 RAG 是否已真实跑通、两模型实测取舍与剩余缺口 | [2026-11-04 执行报告](execution-2026-11-04.md) |

模块职责与历史专题从[总导航](../README.md)进入；已有 [RAG 领域方案](../retrieval/health-rag-plan.md)保留疾病—成分—食材—烹调建模依据，[模型入口](../generation/health-model-api.md)保留既有个人 Key 与模型适配边界。

本轮构造用例在[验收数据](../../datasets/evaluation/rag-acceptance-v1.json)。它们是来源可追溯的工程回归，不是独立临床评价。PRD、产品行为与最新用户决定仍按根目录 [AGENTS.md](../../AGENTS.md)的依据顺序解释。

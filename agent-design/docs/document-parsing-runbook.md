# 正文与版面解析候选运行说明

日期：2026-11-06。对应 TODO B2、B3/B4 的结构基础及 B6 的机械门禁。入口只处理离线公开资料缓存；不导入事实、向量、运行时知识或正式推荐。

## 输入、环境与输出

- 输入沿用 [B1 原件登记](../../datasets/health/source-rebuild-registry-v1.json) 的13个来源与3张附件，先后核对原件 SHA-256。缺文件、附件改变、解析异常均拒收，不联网补取。
- 使用独立 Python 3.12.14 和[锁定依赖](../../scripts/document-parser-requirements.txt)：pdfplumber0.11.9、pdfminer.six20251230、lxml6.1.1 等。B1 的 Python3.11/pypdf 环境保持原样；本批复用已有本机运行库，没有安装 OCR 或下载模型。
- 全文只写当前仓库 `.local-data/rag-document-parsing/`。原件缓存不能与输出重叠；已有输出内容不同会拒绝，须换新目录/版本，不覆盖旧记录。
- 每来源 `structure.json` 保存 DOM 原始文本节点或逐页原始取文/词坐标、正文候选、删除原因、表格候选和待核标记；`enhanced.json` 保存独立增强文本及块级范围映射；`ocr-review-queue.json` 保存未执行 OCR 的页/区域。
- `manifest.json` 记录源/附件/产物 hash、解析代码和工具链版本、保真检查及发布状态。原始 PDF/HTML 本身仍是依据，派生文字不冒充原件。
- 转换映射粒度是块→原始词/DOM文本节点；PDF还可回查物理页及 bbox，HTML可回查 DOM 路径/文本槽位。不是逐字符偏移映射，不可直接替换冻结证据 locator。

## 处理策略与门禁

1. HTML 优先 article、main/role=main、已知正文/摘要容器；无候选保留全文并标待审。显式导航、页眉页脚、分享/推荐区、脚本和隐藏内容分别记录删除原因。脚注、参考文献、标题、关键条件/否定/数量优先保留，因此仍可能有噪声，需独立标注校准。
2. PDF 按词坐标分行，容忍同一行中英文字体的基线差异。页边文字只在跨页、位置和频率有依据时删除；交替页码支持奇偶位置及印刷页号偏移，孤立数字、条件、单位、表题和脚注不按页边噪声删除。
3. 有稳定中间空隙才给双栏候选；整宽标题/表格作为分段边界，同一段先左栏后右栏。保守连接断行，只调整空白和阅读顺序，不替换连字符、数字、单位或否定词。复杂版式仍待审。
4. 表格保留有线网格或横线结构候选、行列/合并跨度、单元格/原词坐标、邻近单位与脚注候选。续表仅在明确标记、同表号、相邻页和列几何匹配时建立待核关系，`headerInherited:false`，不自动继承或批准语义表头。
5. 少字、图片主导或图片正文进入 OCR/空白页复核队列；乱码另行标记。`engine:null`、`state:not_run_requires_review`，不伪造识别文本/置信度，不把既有文本层或目视转录改称本次 OCR。
6. PDF每个原词必须恰好保留一次或带原因删除；重复/缺失拒收。既有证据原文可在原始取文匹配、清洗后却消失时，标记 `rejected_do_not_index`。原本无法在几何取文中匹配的证据单列待核；该状态不代表证据错误或清洗通过。

所有成功产物仍是 `candidate_requires_engineering_review`；词数完整、hash一致、原文命中不能证明上下文语义、表格对象—数值—单位关系或健康适用性正确。

## 离线执行

以下在仓库根目录执行；`PYTHON_B2` 替换为上述锁定环境的解释器，`CACHE_HEALTH/CACHE_GOALS` 为已登记的只读缓存，不使用个人配置或 API Key。

```powershell
# 可先用 --only nhc-weight-management-2024 等声明来源做专项，再去掉参数覆盖全部13来源
& PYTHON_B2 -B -X utf8 tests/document_parser_test.py
& PYTHON_B2 -B -X utf8 scripts/parse-health-documents.py --registry datasets/health/source-rebuild-registry-v1.json --health-cache CACHE_HEALTH --goal-cache CACHE_GOALS --output .local-data/rag-document-parsing/run-a --summary .local-data/rag-document-parsing/run-a-summary.json
& PYTHON_B2 -B -X utf8 scripts/parse-health-documents.py --registry datasets/health/source-rebuild-registry-v1.json --health-cache CACHE_HEALTH --goal-cache CACHE_GOALS --output .local-data/rag-document-parsing/run-b --summary .local-data/rag-document-parsing/run-b-summary.json
& PYTHON_B2 -B -X utf8 scripts/verify-document-parsing.py --first .local-data/rag-document-parsing/run-a --second .local-data/rag-document-parsing/run-b --registry datasets/health/source-rebuild-registry-v1.json --cases datasets/evaluation/document-parsing-cases-v1.json --output .local-data/rag-document-parsing/comparison.json
```

比较器核对两个独立产物逐字节一致、来源覆盖、代码/工具链身份、词/DOM分区、增强范围及数字/否定原字符保真；任何失败均不出具通过报告。公开报告仅包含计数/hash/定位ID，完整原文、表格和原页渲染仍留忽略目录。

Node本地单元套件通过 `tests/document-parser.test.ts` 调用当前16项Python专项；设置 `DOCUMENT_PARSER_PYTHON` 指向锁定环境，缺环境/依赖需单独标未运行。B1另用 `RAG_PARSER_PYTHON`，二者不混用。

后续 `document-parsing-v2` 已修复显式导航中的目录标题残留，以及中文混合字号/段首缩进下的断行。v1产物及当时14项验收不覆盖；v2实测与真实OCR/表格后续见[本批记录](table-ocr-execution-2026-11-06.md)。

## 验收、后续与恢复

- [工程样本](../../datasets/evaluation/document-parsing-cases-v1.json) 为构造回归，包含正文、隐藏分拆单位、外部脚注和图片正文识别，不能当独立验收集。真实13来源已全部用于开发，不能再声称盲测。
- 当前[实测记录](document-parsing-execution-2026-11-06.md)及[比较报告](../../artifacts/acceptance/document-parsing-2026-11-06/verification.json)只证明注明的工程范围。真实正文保留率/噪声率、复杂多栏准确率和逐格表格质量仍需独立标注。
- 下一批先制作 B3 多级/合并/跨页/单位/脚注的逐格审核候选，再接入固定版本 OCR 及关键字符复核；未经复核不转成 B5 事实。每次接入使用新证据版本与索引，保留旧包和旧定位。
- 本次无数据库迁移、生成调用或运行时开关。恢复只需停用该离线入口或回退本任务新增脚本/文档；忽略目录按版本保留，不覆盖原件、不批量清理用户文件。

解析API及限制参考 [pdfplumber 官方说明](https://github.com/jsvine/pdfplumber)。坐标/表格结构是解析候选，原图与独立复核仍是检查依据。

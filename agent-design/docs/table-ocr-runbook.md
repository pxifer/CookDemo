# 表格、真实OCR与候选入库门禁

日期：2026-11-06，RAG-004。基于RAG-003继续B2～B6工程部分；所有命令在隔离开发仓库根目录执行。原件、冻结包、既有索引及本地预览保留。

## 环境与处理链

- 正文：沿用Python3.12.14及锁定的[解析依赖](../../scripts/document-parser-requirements.txt)；`document-parsing-v2`修复目录标题残留和保守断行，旧v1输出不覆盖。
- 表格/扫描网格：额外复用已有NumPy2.3.5，见[要求文件](../../scripts/document-review-requirements.txt)；没有升级Node依赖或安装OCR模型。
- OCR：Windows.Media.Ocr，固定中英文引擎、OS build、引擎DLL和两份语言资源hash，见[身份锁](../../datasets/evaluation/ocr-engine-windows-v1.json)。变化时拒绝运行，需复核并建立新版本，不静默接受系统更新。
- WinRT在Windows PowerShell5.1中运行；入口只有ASCII字符，并按.editorconfig保存为UTF-8 BOM。Python环境启动子PowerShell时显式导入其本机标准模块。`ExecutionPolicy Bypass`仅限该子进程，不修改系统策略；PNG以受控内存流解码，不需要StorageFile代理文件权限。
- 双分辨率是预先计划的对照，不是失败重试。账本在每次识别前写入`issued-calls.jsonl`；已有批次拒绝复用，不重置/覆盖旧结果。OCR与生成API调用分开计数，本批无付费生成。

## 真实存储

| 阶段 | 私有产物 | 实际内容 |
| --- | --- | --- |
| B2正文 | `.local-data/rag-document-parsing/v2-a/`、`v2-b/` | 原词/DOM、清洗块、增强文本、删除及回溯；均逐字节复现 |
| B3逐格关系 | `.local-data/rag-table-review/final-a/`、`final-b/` | 单元格原文、坐标、合并跨度、同一几何行的对象/形态、表头路径、数值原串、单位/基准/脚注候选；不推导营养事实 |
| B4真实OCR | `.local-data/rag-ocr-v1/release-a/`、`release-b/` | 渲染PNG、批次/账本、真实行词/像素框、引擎身份、两种渲染差异及关键字符待核项 |
| B3扫描表格 | `.local-data/rag-ocr-tables/final-a/`、`final-b/` | 暗像素网格候选与真实OCR词的单元格归属，保留图像hash及裁切/缩放关系；不按OCR文本顺序猜表格关系 |
| B4工程修订 | `.local-data/rag-ocr-corrections/review-a/` | 独立修订视图、原文字/词ID、原图hash、可视核对及变更记录；不改原始OCR，不冒充独立人工或医学审核 |
| B5定位候选 | `.local-data/rag-evidence-candidates/run-a/`、`run-b/` | 既有证据ID/原文/旧定位与新定位候选分开，记录增强文件hash及块/词回溯；未提取/发布新健康事实 |

长图原件最高19,802px，不能直接给10,000px边长上限的OCR。按原图坐标分成最长3,000px、重叠180px的块，各运行原尺寸/1.5倍；PDF各运行144/216dpi。保存裁切框、原图大小、缩放系数和坐标单位，完整覆盖校验不允许截掉后半图。非零旋转不猜回原坐标，不自动跨分片继承表头。

WinRT提供文字、行/词框和TextAngle，没有单词置信度；所有confidence明确为null。两个渲染都可能把同一个数字识错，即使结果一致也待核。相关API见微软[OcrEngine](https://learn.microsoft.com/en-us/uwp/api/windows.media.ocr.ocrengine)、[OcrWord](https://learn.microsoft.com/en-us/uwp/api/windows.media.ocr.ocrword)及[内存流](https://learn.microsoft.com/en-us/uwp/api/windows.storage.streams.inmemoryrandomaccessstream)。

## 命令顺序

`PYTHON_B2`为锁定解释器；`CACHE_HEALTH/CACHE_GOALS`为已有公开原件缓存。先按[正文说明](document-parsing-runbook.md)完成两组v2解析和比较。以下输出目录均须新建，全文留`.local-data`；第二组把a改b，输入使用对应的独立解析目录。

```powershell
& PYTHON_B2 -B -X utf8 tests/document_parser_test.py
& PYTHON_B2 -B -X utf8 tests/document_review_test.py
& PYTHON_B2 -B -X utf8 scripts/build-table-review.py --parser-root .local-data/rag-document-parsing/v2-a --output .local-data/rag-table-review/final-a --summary .local-data/rag-table-review/final-a-summary.json
& PYTHON_B2 -B -X utf8 scripts/ocr-health-documents.py --parser-root .local-data/rag-document-parsing/v2-a --registry datasets/health/source-rebuild-registry-v1.json --engine-lock datasets/evaluation/ocr-engine-windows-v1.json --health-cache CACHE_HEALTH --goal-cache CACHE_GOALS --output .local-data/rag-ocr-v1/release-a --summary .local-data/rag-ocr-v1/release-a-summary.json
& PYTHON_B2 -B -X utf8 scripts/build-ocr-table-review.py --ocr-root .local-data/rag-ocr-v1/release-a --output .local-data/rag-ocr-tables/final-a --summary .local-data/rag-ocr-tables/final-a-summary.json
& PYTHON_B2 -B -X utf8 scripts/build-evidence-candidates.py --parser-root .local-data/rag-document-parsing/v2-a --output .local-data/rag-evidence-candidates/run-a --summary .local-data/rag-evidence-candidates/run-a-summary.json
& PYTHON_B2 -B -X utf8 scripts/audit-document-governance.py --table-first .local-data/rag-table-review/final-a --table-second .local-data/rag-table-review/final-b --ocr-first .local-data/rag-ocr-v1/release-a --ocr-second .local-data/rag-ocr-v1/release-b --scan-first .local-data/rag-ocr-tables/final-a --scan-second .local-data/rag-ocr-tables/final-b --evidence-first .local-data/rag-evidence-candidates/run-a --evidence-second .local-data/rag-evidence-candidates/run-b --cases datasets/evaluation/document-review-cases-v1.json --output .local-data/rag-document-audit/comparison.json
```

调试可用`ocr-health-documents.py --only nhc-hypertension-principles-2024 --pages 3`，摘要明确标为子集，不能当全量通过。真实OCR不会加入默认单元测试；本地单元只验证算法和门禁，使用`DOCUMENT_PARSER_PYTHON`运行16项正文＋15项表格/OCR/证据专项。

项目代理看图确认后的修订，显式提供JSON记录，再运行`review-ocr-corrections.py --ocr-root ... --corrections ... --output ... --summary ...`。校验image hash、原词ID/原串、同一行连续范围、可视核对记录及实际来源，生成单独视图。此入口不准伪装独立人审，不把修订后的全文自动签认。

## 接入与拒收

- 没有单元格或单元格词分区失败的表格进入`rejected_cell_structure_do_not_index`，原文字仍留正文层，不丢弃原件。
- 表头路径、单位/基准、食品形态、脚注、跨页继承和OCR字符均是待核关系。只有明确续表、相邻页、同原件、几何和重复表头相符才记录机械核验，仍不自动继承未核语义。
- 证据仅有一个匹配、且位于原声明物理页时才生成定位候选；多匹配/未找到/原图单列。旧offset不能直接沿用于新文本，候选也不替换旧证据ID/版本。
- 报告只准入候选保存，不批准新事实、替换证据或建新向量；本批确有未解决的OCR、结构和定位问题。补审后按新证据/知识版本及完整索引契约接入，不能跳过失败条目冒充全库ready。
- [工程样本](../../datasets/evaluation/document-review-cases-v1.json)和真实13来源都已曝光；10个选定字段/上下文检查不是独立质量分数。独立正文/表格/OCR标注、专业适用性和广覆盖校验仍保留待办。
- 恢复时停用新增离线入口或按任务分支撤回新增脚本/导航；不覆盖原件、冻结知识、旧索引、账本和用户预览。全文/原图不进入Git，公开仅提交hash、计数与审核状态。

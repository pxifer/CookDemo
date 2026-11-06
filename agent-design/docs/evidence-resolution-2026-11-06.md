# v3版面与旧定位治理

日期：2026-11-06；RAG-005，基于已集成的RAG-004。本批处理已列出的3个无格结构、2个定位歧义和3个未定位；原件、冻结库、运行时推荐与旧索引不变。

## 真实结果

| 项目 | 结果与边界 |
| --- | --- |
| 正文v3 | 13来源/479单元，两次输出一致；41,318个原词/DOM节点全部恰好保留或带原因删除，字符/回溯门禁通过 |
| 3条未定位 | 修复维生素数字下标与表格逐格阅读顺序，原文精确匹配；没有改写原字符、单位或冻结短摘 |
| 3个无竖线表 | 从重复词间空隙及宽列中的全网格空白投影取得列界，原表5/4/4列核对；当前322表候选、14,214格、7,510关系，格词分区缺失/重复为0 |
| 增肌范围歧义 | 复现旧目标资料构建器的空白折叠策略，先验证旧start/end原文，再以双侧相邻上下文唯一选定；不是取第一次匹配 |
| NCI歧义 | 完整原HTML文本流与DOM逐字对应，证实旧偏移指向被剔除的导航问句；状态为`legacy_navigation_anchor_do_not_index`，正文上下文另存为重整候选，不冒充旧证据通过 |
| 当前102条 | 90条可定位、11条原图待核、1条导航误引隔离；原先5条歧义/未定位已修复或确定隔离原因 |

正文全源字符串可命中91条，但经过旧定位/来源角色核对，仅90条保留定位候选。两个指标不同：字符串存在不证明选中了原证据，更不证明支持了事实。

报告见[正文比较](../../artifacts/acceptance/document-resolution-2026-11-06/parser-verification.json)、[异常核对](../../artifacts/acceptance/document-resolution-2026-11-06/resolution-verification.json)和[原页视觉记录](../../artifacts/acceptance/document-resolution-2026-11-06/visual-review.json)。所有真实来源和本轮样本已曝光，均为工程回归，不是独立评分或专业签认。

## 设计与保留限制

- 下标仅按字号、相邻字母基字符及几何重叠归行；只改阅读顺序和空白，保留原词ID/框。正常字号数字不当下标。预筛基字符避免逐词全扫描的开销。
- 表格按原单元格行列序列化，每个物理单元格只输出一次；保留跨行/列跨度，不按覆盖范围重复填词。增强块校验使用所声明的原词顺序，增删或串改字符会失败。
- 无竖线列界记录空隙带、支持行数及回退投影依据。多行居中文本不能只按同一基线找两侧词；回退要求全网格没有词框穿过空白带。边界仍为候选，不升级成已核语义表头或数值事实。
- 旧目标HTML构建器包含脚本数据，旧健康HTML策略排除了脚本；恢复旧偏移必须复现各自策略。历史文本仅用于偏移验证，脚本内容不会回到增强/检索文本。
- 旧偏移错误、双侧上下文不符或原DOM流无法精确复现，继续拒绝消歧。导航被清掉后也不能自动选同名正文。正文重整候选排除独立问句，但完整适用条件及事实支持关系仍需核对。
- 3张无竖线表分别涉及儿童BMI、孕期体重和运动干预，不把这些数值接成一般成人食谱推荐量。本批不扩展特殊人群功能。

## 复现

沿用锁定Python3.12.14及[依赖](../../scripts/document-parser-requirements.txt)。先按[正文入口](document-parsing-runbook.md)使用两套新目录生成`document-parsing-v3`，再比较；下例第二组把a改b。缓存只读，不使用个人Key/配置。

```powershell
& PYTHON_B2 -B -X utf8 tests/document_resolution_test.py
& PYTHON_B2 -B -X utf8 scripts/build-table-review.py --parser-root .local-data/rag-document-parsing/v3-release-a --output .local-data/rag-resolution/release-tables-a --summary .local-data/rag-resolution/release-tables-a-summary.json
& PYTHON_B2 -B -X utf8 scripts/build-evidence-candidates.py --parser-root .local-data/rag-document-parsing/v3-release-a --legacy-health-cache CACHE_HEALTH --legacy-goal-cache CACHE_GOALS --output .local-data/rag-resolution/release-evidence-a --summary .local-data/rag-resolution/release-evidence-a-summary.json
& PYTHON_B2 -B -X utf8 scripts/verify-document-resolution.py --tables-first .local-data/rag-resolution/release-tables-a --tables-second .local-data/rag-resolution/release-tables-b --evidence-first .local-data/rag-resolution/release-evidence-a --evidence-second .local-data/rag-resolution/release-evidence-b --cases datasets/evaluation/document-resolution-cases-v1.json --parser-verification artifacts/acceptance/document-resolution-2026-11-06/parser-verification.json --output .local-data/rag-resolution/verification.json
```

无旧缓存参数时仍保留歧义，不默认猜测。缓存hash不符、原DOM/旧偏移不符、不能唯一还原或验证失败均不产生“通过”的新定位。

## 验证与后续

- 38项Python专项（16正文＋15表格/OCR＋7定位）通过；新增测试覆盖第二次匹配、错误偏移/上下文拒收、旧提取策略差异和导航来源隔离。3页列数及5条问题证据有实际回归。
- 本批新增OCR/生成调用0；RAG-004的OCR仍是原v2快照，未伪称随v3重新验证。此前失败/中间版本保留；最终代码/数据摘要与精确SHA本地检查交接另存。
- 下一步重整NCI正文支持关系、事实类型/人群/方向/限定闭包，形成可审核的新知识版本，再处理独立正文/表格/OCR质量集。定位修复、网格完整和现有工程核对不能替代这些工作。
- 全文、原页渲染和替代段落只留忽略目录；公开提交hash/状态/计数。停止新入口即可停用本批能力，不覆盖旧证据、旧索引或用户工作区，不执行发布。

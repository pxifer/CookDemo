# INPUT-001、RAG-003、RAG-004 集成审核

日期：2026-11-06。结论：通过，已串行合入本地 main，业务合并提交 `9a6dee562d3f371239cf87f3820b11308be33a23` 复验通过。

## 已审版本与集成

| 任务 | 完整任务 SHA | 结论 |
| --- | --- | --- |
| INPUT-001 | `7843ea612c8fec907e400814e3fb2f135a70bca5` | 上传前撤销保护修复通过；合并 `42407d05e115028cd30000e500fdaebab542888a` 已独立复验 |
| RAG-003 | `dedb500a11b1fe3761386a641b3d5c924b0cec76` | 作为RAG-004依赖审查历史和完整最终差异，不声称单独重跑旧版本 |
| RAG-004 | `fa99864d3921eb0a4facd4ca5231b1394d0452b3` | 正文、表格、OCR与定位候选的离线工程范围通过 |

先合INPUT，再在独立管理任务分支纳入最新main并合RAG。唯一文本冲突为任务表，保留双方记录；集成提交 `2ecfd1f9b1f56f0c4bc78189ef673924fd1cfde5` 重新完整预验。未自动修复业务实现；RAG合入相对INPUT没有backend/frontend/shared差异。任务与main完整SHA在接收前再次核对，源工作区干净，无强制更新或推送。

## 复核与测试

- 上次[INPUT阻断](INPUT-001-2026-11-06.md)的P1已关闭：认领挂起时清空Key、换Key、退出登录，均在供应商上传前终止且供应商调用0次；认领不回退。回复返回后的检查保留。模型均为构造供应商，没有使用真实个人Key。
- INPUT预验和实际合并后：构建、主/验收类型、完整单元342通过/2跳过，手机与桌面核心/图片40项通过。
- 最终组合main：构建、主/验收类型、完整单元344通过/2跳过；原图片/核心40项、健康14项、RAG2项通过。31项Python正文/表格/OCR/定位专项另行独立通过。
- 独立从只读原件缓存重建13来源/479单元，与作者配套输出逐字节相同；41,318原词/DOM节点的分区及增强范围通过。原件、冻结知识、原定位及旧索引未修改。
- 独立治理审计核对作者两次76次OCR的成对产物、图片/引擎/账本与来源覆盖；322表格候选/13,805格、12个扫描渲染网格/287格，3个结构隔离保留。102证据候选为86唯一、2歧义、3未定位、11原图待核。另实际运行一次本机Windows OCR，固定引擎身份和账本入口通过；不把作者152次称为管理方新执行。
- 最初误混旧final扫描表格与新版release OCR时被血缘检查拒收；改用配套release产物后通过，未放宽门禁。
- 最终并行回归首轮核心39通过/1桌面跨页面用例超时，发生在第二页点击文字输入。保留JSON、截图和trace；相同SHA串行运行原40项全部通过，该用例3.5秒。未改断言、超时或源码；记录为一次未稳定复现的时序问题，不伪称首轮全绿。

## 证据和边界

证据根目录为管理副本 `.local-data/management/`，仅本地保留，不公开全文或私密配置：

- INPUT：`CookDemo-management/image-review/.local-data/management/reviews/2026-11-06T12-05-40-160Z-pre-merge-7843ea612c8f/report.json`、`2026-11-06T12-11-31-339Z-post-merge-42407d05e115/report.json`；浏览器JSON位于该副本 `.local-data/acceptance-input/`。
- 最终组合：`CookDemo-management/baseline-review/.local-data/management/reviews/2026-11-06T12-14-54-962Z-pre-merge-2ecfd1f9b1f5/report.json`、`2026-11-06T12-18-07-803Z-post-merge-9a6dee562d3f/report.json`。
- 最终浏览器：同副本 `combined-main-photo-browser-serial.txt`、`.local-data/acceptance-input/browser-results.json`，健康 `browser-ports-1793967525001/report.json`，RAG `browser-ports-1793967745642/report.json`；首轮失败保留 `combined-main-first-failure/` 与 `combined-main-photo-browser.txt`。
- RAG：同副本 `RAG-004-parser-comparison.json`、`RAG-004-audit-review.json`、`RAG-004-ocr-smoke/`。全文重建位于忽略的 `RAG-004-parser-review/`。

最终业务源码指纹 `db951173305f6edeae62076711fa5fbbd2a6f5feebc7216b03ec22ecf9f11c85`，检查前后相同。后续仅追加管理文档，核对指纹后免重跑业务套件。

本次没有独立执行真实PG专项、真实视觉模型、云端、邮件、付费生成或部署；账户测试为本地构造/PGlite。免费视觉模型的真实权限和质量尚未验证。RAG全是工程候选，独立/专业审核与新事实/向量发布仍未完成。

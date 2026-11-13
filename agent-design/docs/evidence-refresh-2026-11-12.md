# RAG-008：正文重整、知识入库、常用映射与本餐回归

基线main `bfa1567ccb43ca02e2a42f75c57e521a250d105d`；日期2026-11-12。顺序为旧支持隔离→小批正文/事实新版本→常用成员→本餐检查。独立评测仍按用户决定上线后完善，不恢复付费预算或部署授权。

集成基线已更新至main `aae56d146f0ad26de9ee59b48f77802a572c1a5a`，包含INPUT-002输入修复和RAG-007手册。下表单元数为合并前阶段检查；集成后按最终提交SHA重新执行`pr:check`，报告留本地审核目录，不把旧报告冒充新SHA通过。手册新增当前增量章与相关卡片说明，112题和原实验数值保留。

## 1. 本批真实变化

| 批次 | 完成内容 | 验证边界 |
| --- | --- | --- |
| 旧支持隔离 | 3条旧NCI短摘进入跨版本隔离；事实可用性、A0/A1、required证据、研究向量过滤及PG重导均执行 | 9项初期专项；已有数据库的重导分支也追加撤回，旧原文不改 |
| 正文重整 | v3保留95条旧证据，新建4正文块、修订4工艺事实，全部补人体/摄入建议限定；微波条件未知不补齐 | Schema1.1与旧1.0分开；5个Python反例；两次重建10文件一致、24冻结文件未变 |
| 新研究入库 | 真实回环PG保存v3及新映射快照，Qwen99×1024向量独立发布；旧索引保持 | 三模式固定题通过，未知条件补问，旧导航required返回证据不足；生成是离线抽取夹具 |
| 常用映射 | 19蔬菜＋12鱼类＋2普通豆腐名称，35对象归属 | 固定341菜谱缓存，35变体增加绑定；总有据变体337不变，不冒充质量增益 |
| 本餐回归 | 指导、菜品、限制、数量策略与当前新版本共同检查 | 12指导/10本餐场景、351单元通过/2既有跳过、桌面/手机2项；无真实生成新样本 |

知识与映射说明：[v3知识](../../datasets/health/README-v3.md)、[映射v3](../../datasets/health/food-guidance-mappings-v3.md)。本地业务仍按主题直接指导及配方绑定；此次向量验证属于独立研究问答，不将二者拼成同一运行链。

## 2. 关键取舍与参数

NCI按完整唯一DOM正文段/列表项摘取，保留原件hash、增强文本offset、原DOM节点和旧导航证明；不是把唯一同名正文自动接到旧引用。原段478/762/377/207字符，没有滑窗长度/Overlap调参。新身份/原文/支持与限定均新版本；旧包、旧Schema、旧映射与历史证据保持。

模型仍为锁定Qwen3-Embedding-0.6B，1024维/L2/lasttoken；本地服务使用临时15251端口。RRF、候选数、预算和业务提示未调参，未加入reranker/BM25/多Agent。研究默认包变更后，旧包的索引不能混用；使用新index ID验证manifest与bundle hash。

研究索引 `qwen-20261112-v3-body-r1`：99条真实本地向量；不是用构造向量冒充，也没有新生成API回执。固定微波问题在A1/dense/hybrid均返回完整支持/限定；这不是独立检索质量对比或参数胜出证明。

## 3. 如何复跑

先启动已有离线Embedding资源，使用项目模型锁与现有权重，不执行Download/Prepare安装。以下占位文件只能指向已确认回环研究库，不能使用正式数据库；连接文件内容不打印。

```powershell
# 可先准备向量；产物仅在忽略目录，不声称已入PG
node node_modules/tsx/dist/cli.mjs scripts/verify-health-refresh.ts --mode prepare --embedding-url http://127.0.0.1:15251
# 默认persist，验证既有研究PG、模型身份、索引及固定公开问题
node node_modules/tsx/dist/cli.mjs scripts/verify-health-refresh.ts --database-url-file <本地研究URL文件> --embedding-url http://127.0.0.1:15251
# 真实公开缓存、构造供应商；无真实生成模式
.\scripts\run.ps1 rag:business:evaluate -TaskArguments @('--gallery','--output','artifacts/acceptance/rag-evidence-refresh-2026-11-12/business')
```

默认catalog已指向v3；原研究CLI新增可选`--embedding-url`，仍只接受回环HTTP，默认15199不变。查询时显式 `--index-id qwen-20261112-v3-body-r1`，避免旧current-index与新bundle不匹配。原main的私有指针/配置未提前修改；合入后按运行说明选择已核验索引，不倒改旧manifest。

## 4. 证据与失败记录

- [存储与映射](../../artifacts/acceptance/rag-evidence-refresh-2026-11-12/storage-and-mapping.json)：真实PG/向量/三模式、未知与旧支持门禁、覆盖变化。
- [本餐报告](../../artifacts/acceptance/rag-evidence-refresh-2026-11-12/business/report.json)、[用量等价](../../artifacts/acceptance/rag-evidence-refresh-2026-11-12/business/quantity-equivalence.json)：固定夹具operation ID/secret，对1g与99999g比较实际user packet和catalog相同；不是将旧真实调用改标。
- [验收说明](../../artifacts/acceptance/rag-evidence-refresh-2026-11-12/README.md)：构建/类型/单元、浏览器、冻结数据及仍未验证范围。

新clone首次基线缺构建页面，且默认Python不是要求的3.11；显式复用已有锁定环境、完成构建后全套通过，无安装/升级依赖。Docker最初未运行，用户恢复后才完成真实PG；不将PGlite当真实PG。核验脚本首次把调用参数次序写错，返回unavailable而未生成错误答案；已修正并把该脚本加入验收类型检查，失败记录保存在忽略目录。没有提高超时、删断言或让测试吞掉语义错误。

## 5. 仍待完成

本批只重整NCI四条工艺事实，不覆盖全部3717结构块、11条原图待核或全库事实审核。减脂/增肌新知识量及食品/工艺映射仍有限；独立/专业审核、参数消融与真实生成广覆盖未完成。已合入的RAG-007手册保留bfa1567历史指标，并链接本批更新，不将旧98条统计重写成新验收。没有修改线上接口、数据库迁移、部署、依赖或付费授权。

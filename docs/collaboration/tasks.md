# 任务登记

当前以本地 Git 分支/提交为队列，不依赖 GitHub PR。用户已取消等待通知条件，由管理员自主验收并合入；下表的早期阻塞快照不作为新的等待要求。GitHub 网络也不再阻塞本地集成。

状态：待分配 → 开发中 → 待审 → 需修改 / 待合并 → 已合并待复验 → 完成。阻塞单列原因，不当作通过。优先级与审查缺陷等级分开。

| 编号 | 负责人 | 目标与范围 | 分支 / PR | 验收标准 | 状态 / 依赖 |
| --- | --- | --- | --- | --- | --- |
| MAN-001 | 管理 chat | 协作规则、模板、SHA绑定工具及自主检查任务 | `chore/managed-baseline-review` | 类型、工具单元、本地基线及主分支复验 | 完成；2026-11-12按用户要求删除定时任务，改为用户发起审核 |
| BASE-001 | 管理 chat | 验收当前本地项目为共同 main 基线，保留既有材料 | RAG-001 + `chore/managed-baseline-review` | 敏感文件/附件核对、构建与回归、安全保存原目录并正常合并复验 | 完成；业务合并 `6fa893b`，合并后复验通过；[管理审核](reviews/BASE-001-2026-11-05.md)，精确结果在 `.local-data/management/baseline-acceptance.json` |
| RAG-001 | 当前开发 chat（重构 AGENTS.md） | 完成既有目录重整、基础/业务RAG及用户参考量策略，提供兼容旧 main 的完整本地候选；含现有协作工具依赖，详见交接 | `agent/rag/RAG-001-reorg-business-rag`，本地提交，不推送 | 保留原件/面试材料；排除密钥/本地配置/缓存；构建、主/验收类型、单元、相关桌面/手机与离线RAG；按确切SHA审核 | 完成；`ae41df2` 已通过BASE-001审核并合入本地main；[交接](submissions/RAG-001-2026-11-05.md) |
| RAG-002 | 当前开发 chat | TODO C1标注/数据划分与B1离线原件重建；补建议均衡、明确补问、映射版本缺口；涉及研究后端、scripts、datasets、Agent文档与专项测试 | `agent/rag/RAG-002-quality-governance` | 冻结资料不变、杜绝评测泄漏与伪造人审、缓存可重复重建、真实目录回归、无新增付费或部署 | 完成；合并 `d61cf63` 并复验通过；[管理审核](reviews/RAG-002-2026-11-06.md) |
| INPUT-001 | 输入开发agent | 去除用量输入、受控图片识别及撤销保护 | `agent/codex/INPUT-001-photo-ingredients`，审核 `7843ea6` | 身份/Key/费用/隐私及输入回归 | 完成；合并 `42407d0` 并复验；[集成审核](reviews/INTEGRATION-2026-11-06.md)，旧P1已关闭 |
| RAG-003 | RAG开发agent | 正文与版面离线解析候选 | `agent/rag/RAG-003-document-parsing`，`dedb500` | 可回溯、重复重建及冻结资料保留 | 工程范围完成；随RAG-004合并 `9a6dee5` 并复验；[集成审核](reviews/INTEGRATION-2026-11-06.md)；独立质量审核待办 |
| RAG-004 | RAG开发agent | 表格逐格、真实离线OCR、定位候选与机械门禁 | `agent/rag/RAG-004-tables-ocr`，审核 `fa99864` | 原字符/坐标/血缘保真、待核隔离及不发布事实 | 工程范围完成；合并 `9a6dee5` 并复验；[集成审核](reviews/INTEGRATION-2026-11-06.md)；独立/专业审核及事实发布未完成 |
| RAG-005 | RAG开发agent | v3无竖线表格、下标/单元格顺序与旧证据定位治理 | `agent/rag/RAG-005-evidence-resolution`，审核 `187ba82` | 原字符保真、旧来源/偏移与导航误引隔离、回归 | 工程范围完成；原P2关闭，合并 `bba9659` 并复验，345单元通过/2跳过、13来源独立重建核对通过；[管理审核](reviews/RAG-005-2026-11-06.md)；新事实/索引未发布 |
| RAG-006 | RAG开发agent | 全链路参数/切块规格；AGENTS与Agent文档导航；离线长度测量证据，不改运行代码或知识/索引 | `agent/rag/RAG-006-parameter-specification` | 绑定实际代码/数据hash；98条证据与3717结构块两tokenizer长度；逐项区分现值/初值/实测/未对比；链接/行数/原件保持核验 | 完成；审核55e2527，合并df5aeab并复验；98证据/3717块两tokenizer独立复算一致；[管理审核](reviews/RAG-006-2026-11-12.md)；无运行代码变化、无模型推理/部署 |
| INPUT-002 | 当前输入开发chat | 食材同义词/候选点选；简短回答缺省档案兼容；当前限制取代旧限制、取消旧请求及CAS保存复核；shared/backend/frontend及专项测试 | `agent/codex/INPUT-002-conversation-matching` | 构建与验收类型；单元348通过2跳过；核心/识图42、健康16浏览器通过 | 完成；审核9576d72，合并c5fc6db并复验，348单元通过/2跳过、核心图片42/健康16通过；[管理审核](reviews/INTEGRATION-2026-11-12.md) |

| RAG-007 | RAG开发agent | 项目AI/Agent工程与面试手册：本地题库、用户57题、公开图文/面经筛选；原理/参数/实验/难点/亮点；文档阅读入口 | `agent/rag/RAG-007-interview-handbook` | 以main bfa1567为事实基线；112题覆盖映射；942本地链接/746锚点、原件hash、离线阅读版及桌面/手机核验；AGENTS102行 | 完成；审核c2160f0，基于INPUT-002集成3697c8e；重建、链接/hash、112题与桌面手机交互核验通过；[管理审核](reviews/INTEGRATION-2026-11-12.md)；实现事实仍绑定原bfa1567快照 |

| RAG-008 | RAG开发agent | 按序重整NCI原文/事实、小批新知识版本接入、常用食材映射及本餐回归；涉及研究后端、datasets、scripts、tests与Agent说明，不改线上开关/秘密/既有SQL | `agent/rag/RAG-008-evidence-refresh` | 起始bfa1567，已纳入main aae56d1；冻结原件/旧包hash保持；坏支持隔离、条件闭包、不可变入库、映射不泛化；构建/类型/本地单元及实际目录回归 | 完成；审核e2aedb3，合并c202387并复验；354单元通过/2跳过，12指导/10本餐/桌面手机2项通过，真实本地PG幂等及撤回核验通过；[管理审核](reviews/RAG-008-2026-11-13.md)；专业质量与新生成未验收 |
| RECIPE-001 | 当前菜谱开发chat | 按既有食品级规则扩展1000道；保留341道原ID，新增659道公开原方；图片按用户要求后续生成；含发布包、重建、逐方校验及本地预览 | `agent/codex/RECIPE-001-expand-1000` | 构建/验收类型、全量单元、1000道逐配料排除与桌面手机图鉴/收藏/推荐；不部署/不真实模型调用 | 待审；基于main05d853f；见submissions/RECIPE-001-2026-11-13.md |

| RAG-009 | 当前 RAG 开发 chat | 常见疾病食物指导、维生素/矿物质/能量及宏量营养记录、用户目标扩展；涉及研究后端、shared契约、独立schema/SQL、datasets、scripts、tests、Agent说明与交接 | `agent/rag/RAG-009-nutrition-goals`，基线 `05d853fd54e6a0202b698050d1686e0a1492c1ad` | 权威原件/单位/形态/缺失值、条件撤回、不可变及真实本地PG读回；构建/类型/单元/实际目录/桌面手机 | 待审；[交接](submissions/RAG-009-2026-11-13.md)，完整SHA见本地分支与最终回复；无模型调用/新向量/部署，保留冻结原件 |

新任务填写：编号、负责人 / chat、目标、可改目录 / 共享文件、明确验收、验证命令、依赖、分支、PR、风险与回退。避免多 agent 同时修改同一迁移或共享契约；必要时拆前置 PR。

已完成任务保留记录；后续小修另开任务，不把完成记录覆盖为新任务。详细审核和证据以 PR 为准，表中保留 PR 链接，减少因改表触发业务 PR 旧 SHA 失效。

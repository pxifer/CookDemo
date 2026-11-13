# 2026-11-13 DSH 接手状态、验证与回退

本页记录 DeepSeek Harness（DSH）接管后的当前事实，供后续维护者与 Agent 使用。历史交接见[Codex 原始交接](2026-11-13-codex-handoff-original.md)（已过时：只列 3 个仓库，且写第三批待回件）。本页不替代任务登记与审核记录。

## 1. 接手范围

- 接管：git 管理、文档/证据整理、评测闭环、知识库扩展、线上只读核验与后续授权内发布准备。
- 排除：Codex 正在进行的 659 张新增菜谱图片生成（`ingredient-photo` 树持续写入），本轮不改该树、不切分支、不跑写产物的脚本。
- 未做：没有真实模型调用、没有部署、没有推送 GitHub、没有改动用户账户或线上数据库。

## 2. 工作区与仓库真实状态（2026-11-13 19:20）

| 路径 | 分支 / HEAD | 状态 |
| --- | --- | --- |
| `CookDemo` | `main` @ `9086549` | 干净，与 `origin/main` 同步；产品主基线 |
| `CookDemo-submissions/RAG-008` | `agent/rag/RAG-009-output-evaluation` @ `e2aedb3` | 研发树，13 改 + 79 未跟踪；**原样保留，未 reset/stash/commit** |
| `CookDemo-eval` | `agent/rag/RAG-010-output-evaluation` @ 本页提交 | 本次集成副本（main 9086549 + 研发工作重放），构建与单元通过 |
| `CookDemo-rag-009` | `agent/rag/RAG-009-nutrition-goals` @ `20dfacb` | 干净；已合入 main `f1c8015` |
| `input-003` | `agent/codex/INPUT-003-meal-controls` @ `f75b834` | 干净；曾合并 `d61c182`，后被 `9086549` 回滚 |
| `ingredient-photo` | `agent/codex/RECIPE-001-expand-1000` @ `b9a446a` | 干净提交基线 + 正在生成的 90+/659 张图片与登记脚本；**进行中，勿动** |
| `demo` | `main` @ `af7c939` | 另一份材料，不自动同步 |
| `CookDemo-management/baseline-review` | 游离 HEAD @ `20dfacb` | 干净，管理审核副本 |
| `CookDemo-management/image-review` | `main` @ `0ca4ed8` | 干净，图片/1000 菜浏览器证据副本；远端引用较旧 |

## 3. 主仓基线与部署

- 主仓 `main` = `9086549`（部署时点基线）：撤销了未跑测试流程的 INPUT-003 合并（`d61c182`），这是当前有意的产品状态。接手后本地 `main` 已推进到 `838bfe4`，见第 5 节。
- 发布记录：v50（1000 菜谱，`b25c20d`）、v51（知识引用 `knowledge-food-guidance-20261113-v1`，`0ca4ed8`，冒烟通过）。
- **未写进 `docs/releases` 的实际部署**：v52（`d61c182`，INPUT-003，未跑测试）、v53（`9086549`，回滚 INPUT-003，未跑测试、`smokeVerified=false`）。`monitor-state.json` 与 `deployment-2026-11-13-v53/deployment.json` 确认 v53 是当前线上版本。
- 结论：线上代码与主仓 HEAD 一致，但最近一次发布**没有测试/冒烟记录**，也没有发布文档；最近一次冒烟通过仍是 v51。回滚包 v51/v52/v53 均在 `.local-data/cloudbase-http/`。
- 部署包 `cloudbaserc.json` 含会话/CSRF/档案密钥，属秘密文件：不得复制进仓库、日志或验收材料。
- 线上只读核验（2026-11-13 19:36，未登录、无模型调用、无写操作）：`/healthz` 200 `{"status":"ok"}`；`/readyz` 200 `preview_ready`，`contentVersion=gallery-listed-foods-1000-20261113-v1`。说明 v53 实际可用并服务 1000 菜谱，但两次只读请求不替代业务回归或正式冒烟记录。

## 4. 评测与回件

- 账本 `output-evaluation-20261113-cny5`：40 次真实调用、保守预留 `1.602422` 元（上限 5 元）；阶段 attempts 策略 32→64，金额与账本不变，无自动重试。接手不重置账本、不新增授权。
- 冻结轮 `outside-in-20261113-base`：8 场景/9 轮，产品指纹 `931edd55…`；知识为 v3 + 旧目标包 + 甲减说明，菜谱目录 341 道 v28，不是主仓 1000 道。
- 第三批回件已落盘（`judge-A-round3-2026-11-13.md`，18:16），本页提交内完成接收登记：9 条 case/run 绑定核对通过，U/N/A 与评委原分保留，见[第三批回件记录](../../../agent-design/docs/judge-feedback-2026-11-13-r3/README.md)。
- 高优先级：u49 未知分型后重复追问、u01 一荤一素缺额未说明、u20 疾病条件未承接、u32 明确请求失败；价格/时长模板噪声另记。
- 主仓已合入的 RAG-009 营养扩展与 1000 菜谱目录**尚未同步到本评测分支**；新轮次须另建 `run_id`，旧分不迁移。

## 5. 本次集成分支（已合并）

更新（2026-11-13 19:45）：RAG-010 已合并到本地 `main` `74202a4`（`--no-ff`，合并树与审核版本 `a05e079` 一致），管理审核记录 `e677537`；未推送远端。合并后复跑单元 403 通过/2 跳过、两套类型检查通过。

更新（2026-11-13 19:55）：RAG-011 修复第三批 u49-t2 重复追问，提交 `ed95fa4`，合并 `838bfe4`；新增两条回归，全量单元 407 项 / 405 通过 / 2 跳过，两套类型检查通过。当前本地 `main` `838bfe4`，领先 `origin/main` 9 个提交，未推送。

更新（2026-11-13 20:16）：RAG-012 修复健康 AI 慢/超时：知识网关读取按请求复用（约 12–14 次降到约 5 次）、服务端预算 17s→45s、函数超时 20s→60s；未截断做法。提交 `8cd2daa`/`955750f`，合并 `b338f49`；408 单元 / 406 通过 / 2 跳过，两套类型通过。**v54 已发布**：函数 `shiwei-http-preview` 更新到 `cb8f306`，Timeout 60 秒；`/healthz`、`/readyz` 200，内容版本仍 1000 菜谱，JS/CSS SHA-256 与本地构建一致，图片识别入口与图鉴示例文案在线上 JS 中存在。首次打包误带 906MB 菜谱图片导致 COS 上传超时（函数未变），裁剪为 36.2MB 包后重试成功。证据：[发布记录](../../releases/ACCEPTANCE-main-v54-2026-11-13.md)、`.local-data/management/deployment-2026-11-13-v54/`。真实健康 AI 时延仍需个人 Key 实测；未登录、未调用模型、未改账户数据。

分支 `agent/rag/RAG-010-output-evaluation` 在独立副本 `CookDemo-eval` 中，从 `main` `9086549` 重放研发树工作：

- 来源：`agent/rag/RAG-009-output-evaluation` @ `e2aedb3` 的 13 个已跟踪改动 + 79 个未跟踪文件（原树未动）。
- 冲突已按语义解决：`AGENTS.md`、`agent-design/docs/README.md`、`backend/src/health-recipe-selection.ts`、`backend/src/rag/food-guidance-chat.ts`；主仓 KB-001 的 `source_guidance`、营养原则与研发的 `topicCoverage` 均保留。
- 提交：知识/输入模块 → 健康修复 → 评测工具与数据 → 文档与回件登记（见 `git log`）。
- 验证：`tsc --noEmit`（主配置与验收配置）通过；`generate-validation`、Vite 构建通过；单元 403 通过/2 跳过（Python 相关测试需 `RAG_PARSER_PYTHON` 指向本机 3.11；首跑因排除 `artifacts/build` 导致 1 条布局测试 404，构建后通过）。
- 未验证：真实 PG、真实模型、云端、桌面/手机浏览器。

## 6. 回退

- 本地 `main` 已包含 RAG-010（`74202a4`），远端 `origin/main` 尚未推送；回退用 `git revert -m 1 74202a4`，任务分支与 `CookDemo-eval` 保留；原研发树不受影响。
- 线上回退：按 v51 包与既有配置恢复；不要删除历史数据、不要重置账户。发布相关证据在 `.local-data/management/` 与 `.local-data/cloudbase-http/`。
- 评测：冻结轮与历史报告只读保留；新轮失败保留，不重写旧分、不重置账本。

## 7. 下一步顺序

1. 用 fixture 轮复现第三批高优先级问题（零付费），补测试后再改行为。
2. 把主仓的 RAG-009 营养扩展与 1000 菜谱目录安全接入评测分支，分别做“固定目录测知识”“固定知识测目录”的对照轮。
3. 在用户明确授权与同一账本内跑新 `run_id` 真实轮，交独立评委，另建第四批 A 包。
4. 图片生成完成后验收 659 张图（登记、哈希、占位替换、桌面/手机），上传与部署需另行授权。
5. 如需发布：按 v50/v51 流程补测试、发布记录与最小只读核验，避免再次出现无记录部署。
更新（2026-11-13 20:36）：**v55 已发布**。函数更新到 `74c74d4`，Timeout 保持 60s：图片识别入口首屏与添加后常显；AI 选菜按人数/荤素/补买确定菜数（不再固定 6 道），候选目录限 12 道、输出限 160/80 字；移除图鉴搭配示例与开发者术语。线上 JS `index-a0MDwe2s.js` 与本地 hash 一致，`/healthz`/`/readyz` 200。真实模型时延未测，需个人 Key；[发布记录](../../releases/ACCEPTANCE-main-v55-2026-11-13.md)。
更新（2026-11-13 21:02）：**v56/v57 已发布**（`ff40729`/`ea5d202`）。AI 在“更多菜谱”模式下不再出 6 道，改按人数/荤素出餐；知识读取 3→2 次；410 单元/408 通过/2 跳过。线上 `index-UtkLOqFD.js` 与本地一致，`/healthz`、`/readyz` 200。真实时延未测：Edge Cookie 库被运行中的浏览器锁定，无法安全复用登录态；[发布记录](../../releases/ACCEPTANCE-main-v57-2026-11-13.md)。
更新（2026-11-13 21:20）：**v58 已发布**（`28b3bcd`）。纠正 v56 误改：不补买按人数出餐，允许补买仍为每页 6 道现有食材候选。提示改为“主料+做法类型+两步摘要”，完整做法留服务端。实测线上公开知识：payload 2.0MB、首次 prepare 1.10s、热 84ms、断言 66–75ms——知识不是 7–8 秒主因，模型提示与输出才是；[发布记录](../../releases/ACCEPTANCE-main-v58-2026-11-13.md)。
更新（2026-11-13 21:45）：**v59 已发布**（`5e0758c`）。健康说明按营养指标/缺条件/未匹配/无资料分层；同一主料最多两道。CLS 查询最近 1 天仅 21 次调用、最大 606ms，未捕获 AI 选菜请求——需用真实 Key 本机复现对照。Key 文件：`.local-data/performance/deepseek-key.txt`（忽略目录）；[发布记录](../../releases/ACCEPTANCE-main-v59-2026-11-13.md)。
更新（2026-11-13 22:05）：**v60 已发布**（`1c81747`）。接受食材选择写入结果说明；模型多选按 count/荤素汤配额裁剪并报缺口；去重改为“主料+做法”每组 2；输出上限提高。真实 Key 实测：冷启 4.05s、温 3.1s（知识 0.9s/75ms + 模型 2.4s/1.6s，prompt 3948 tokens）；[发布记录](../../releases/ACCEPTANCE-main-v60-2026-11-13.md)。
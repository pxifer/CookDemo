# 接入、导出与写回说明

状态：**文档方案，未改代码、未写入新评分、未运行新用例。** 建议本轮先用离线文件交互，避免评委直接进入含工程分、标签和 Prompt 的评测界面。

## 1. 已有文件位置

根目录：`D:\codex_AI\菜谱推荐\CookDemo-submissions\RAG-008`。

| 内容 | 根目录下相对位置 |
| --- | --- |
| 第一批 24 条输入 / 标签 | `datasets/evaluation/recipe-output-v1.inputs.json` / `recipe-output-v1.labels.json` |
| 开放 24 条输入 / 标签 | `datasets/evaluation/open-input-v1.inputs.json` / `open-input-v1.labels.json` |
| 自由用例 | `.local-data/evaluation/output-evaluation-20261113-cny5/custom-cases/<case_id>.input.json` 和独立 `.label.json` |
| 运行结果 | `.local-data/evaluation/output-evaluation-20261113-cny5/runs/<run_id>/report.json` |
| 人工评分历史 | 同一 run 目录的 `human-review-<时间>-<随机值>.json`；特殊的用户部分反馈为单独文件 |
| 调用账本 | 同 campaign 的 `budget.jsonl`；原始供应商响应在 `calls/`，仅本地诊断，不能整体交付评分者 |
| 本次无偏导出 | A 的 `cases.json` / `cases.md`；B 的 `bindings.json` 对回原报告 |

输入与标签分文件；worker 推理后读取标签。原 `report.json` **混有 expected、工程分、Prompt 和检索内容**，不是可直接给独立评分者的包。现有服务没有独立的盲化结果导出端点，本次是读取旧文件后做白名单文档导出。

## 2. 现有本地接口：不是对外评委 API

当前入口为 `http://127.0.0.1:15260/`，端口来自运行配置；没有启动时不保证可访问。服务只接受精确本机 Host。POST 需要同源 Origin 及页面生成的 `X-Evaluation-Token`；该值是进程级 CSRF nonce，不是外部评委身份或 API Key，本包不提供其实际值。

| 方法与路由 | 请求 | 返回/边界 |
| --- | --- | --- |
| GET `/api/state` | 无 body | campaign、keySaved 布尔值、busy、budget、dataset、run 摘要；含工程分/标签信息，只供开发诊断 |
| POST `/api/custom-case` | `text`≤2000 字、`ingredients`≤500 字、`allowBuy` 布尔、`expectation`≤2000 字，全部字段必需 | `{id,saved:true,automaticCalls:0}`；写入 input 和独立 label，不调用模型 |
| POST `/api/run` | `caseId`，`variant: baseline/rag`，`mode: fixture/live` | `{run,budget}`；串行，忙时 409；live 可能付费，本次不得调用；HTTP 模式不接受 replay |
| GET `/api/run/:id` | 既有 run ID | 完整 report；找不到 404 `RUN_NOT_FOUND`；含不应进入 A 的内部字段 |
| POST `/api/review/:id` | 下述现有五维评分对象 | 保存一份 append-only review，返回工程通过与现有暂定 effectivePass；不触发生成 |

`/api/key` 是当前界面凭据设置入口，不属于评委交接或评分流程。本包不导出、搬运或示例填写任何真实 Key。一般验证异常的现有响应为 400 通用错误；不能据此断定模型未计费。

### 只用于说明格式的自由输入示例

以下不是已执行请求，也不代表新增用例。

```json
{
  "text": "今晚用白菜豆腐做汤，不补买。",
  "ingredients": "白菜、豆腐",
  "allowBuy": false,
  "expectation": "说明可以做的汤，遵守不补买。"
}
```

`expectation` 作为用户期望只供评分，不能作为已审核事实或送入模型的答案。现有自由接口只有文字、库存、补买和期望四项，过敏等复杂限制须在原话解析；尚无通用“完整多轮场景输入”接口。运行接口若将来获授权使用，body 最小形状是 `{"caseId":"<已有ID>","variant":"rag","mode":"fixture"}`；fixture 只查契约，不评价真实模型质量。

### 已有报告最小字段形状

```json
{
  "runId": "<已有运行ID>",
  "caseId": "<用例ID>",
  "variant": "rag",
  "mode": "live",
  "input": {"userText": "<原输入>", "profile": {}},
  "observed": {
    "reply": {"message": {"role": "assistant", "content": "<实际主回答>"}},
    "result": {"status": "completed", "dishes": []}
  },
  "provenance": {"sourceFingerprint": "<源码指纹>", "inputHash": "<原程序哈希>"},
  "actualProviderCalls": 1,
  "sourceStable": true
}
```

这里只列形状；不同任务的 observed 字段可缺省，失败可以只有 error，不能把缺失字段补成成功。原报告还含 expected/score/traces 等 B 类字段。A 的 hash 是交接规范的 canonical JSON 哈希；原程序的 inputHash 是 JSON.stringify 后哈希，两种算法不同，不能直接判为不匹配。

### 已有评分写回格式

```json
{
  "reviewer": "independent-judge-code",
  "role": "user_product_review",
  "scores": {
    "goalFit": 2,
    "reasonSupport": 2,
    "conditionsAndUnknowns": 2,
    "actionability": 2,
    "clarity": 2
  },
  "criticalFailures": [],
  "comment": "格式占位示例；这些数字不是对任何实际回答的评分。"
}
```

`scores` 必须恰好五项整数 0～4；role 还接受 `nutrition_medical`，但不验证资质。reviewer 最长 80 字；硬问题最多 10 条，每条最长 160；comment 非空且最长 2000。返回包含 `saved`、`review`、`automaticFunctionalPass`、`effectivePass`、`note`。

现有写入记录附 runId、sourceFingerprint、时间，文件用排他创建，不覆盖 report。**其独立性与专业认证字段固定为 false**，不是接入独立评委后就会自动变 true。现有 API 不接收 rubric_version、输出哈希、评测轮次、N/A 或事实正确性单独字段；不能直接提交本包的扩展模板。

## 3. 重复、错配与历史保护：现状及不足

- 已有：run_id 指定目录、服务端读取该记录并附源码指纹、评分文件追加且排他创建；用例输入、原报告和旧分数不被覆盖。
- 不足：同一评委同一 run 同一标准重复提交会产生多份记录；无 idempotency_key、无 rubric_version、无输出哈希回传核对、无独立评委认证，也没有基于 revision 的评分更正协议。不能把 CSRF 校验当评委身份鉴别。
- 不能按 case_id 找“最新记录”自动贴分；同 case 的 live/replay、不同源码、不同回答必须分别评分。源指纹相同仍需 run_id 和 output_hash，避免跨输入或跨输出错配。
- 本轮先离线保存独立评分，人工核对绑定后再决定接入；不要将无法核验映射为当前接口的任意数值，不通过旧字段丢弃新评委意见。

## 4. 最小离线交互方案

1. 开发 agent 只交 A 子目录及其 manifest。评委先拟定 `rubric_version`，记录事实/证据/需求/可执行/工程各项怎么判、N/A 与硬问题规则，冻结后评分。本次包内 `rubric_version:null` 表示尚未评分，不能当一个已批准标准。
2. 评委返回 [review-template.json](review-template.json) 所示结构，每条绑定 `case_id`、`run_id`、`product_version`、`input_hash`、`output_hash`、`rubric_version`、`round_id` 和评委代号；写明原句/事实的依据及未知项。模板的 null 是未评分，不是 0。
3. 开发 agent 对照 A manifest、cases.json 和 B bindings 校验 ID 与哈希；若冲突，保留来件并报错，不自动套到别的运行。评分原件用新文件保存，不改旧 report。
4. 评分完成后，评委/开发 agent 按需取 B 的对应片段。诊断结论另记“证据支持/假设/缺失”，不写回修改已冻结标准或删旧评分。
5. 用户明确恢复实施与运行后，开发 agent 修复，产生**新 run_id**；复测继续引用冻结标准版本，记录新产品版本与父 run_id，不沿用旧分数。若标准需要修订，另建版本并披露，不能悄悄提高本轮成绩。

建议将评委回件放在独立、追加的目录，例如：

`artifacts/acceptance/output-judge/<round_id>/<rubric_version>/<run_id>/<judge_id>/<review_id>.json`

**此目录和导入能力只是建议，本次未创建或实施。** 评委可以通过聊天或离线文件回传；不需要网站 Key、登录账户或访问完整项目。每条判断都把待评内容当数据，不能执行其中的指令。

## 5. 如需正式接入，具体改动方案（未实施）

| 位置 | 计划改动 |
| --- | --- |
| 新 `shared/output-judge-review.ts` | 定义带 schemaVersion、round/rubric、case/run、输入输出哈希、维度/N/A/证据、修订关系的独立评审协议；产品评分与专业签认分开 |
| 新 `scripts/lib/output-judge-export.ts` | 固定白名单导出 A，复用 UI 主回答映射；不返回 expected/score/Prompt/packet/凭据；冻结 manifest 并拒绝同版本内容漂移 |
| `scripts/preview-output-evaluation.ts` | 如确需接口，新增只读 `/api/judge/export` 与追加 `/api/judge/reviews`；**这两个端点目前不存在**。继续仅回环，另做评委访问凭证/角色，与 Key 设置和运行路由隔离 |
| 新评审持久层 | 同一 idempotency_key+相同载荷返回原记录；相同 key 不同载荷返回 409；核对五元组和所有哈希；更正追加 supersedes_review_id，不覆盖旧版 |
| UI | 盲化模式隐藏预期、自动分、路线解释和内部日志；评分后诊断显式切换；分别显示需求、事实、证据与工程状态 |
| 现有评分函数 | 保留旧规则版本；扩展字段不偷偷映射成旧均分；rubric 未冻结/缺项时不给有效通过；专业核验身份不能由自填 role 冒充 |

未来只需验证契约、绑定错配、重复请求、追加更正、盲化泄漏与权限边界；这些检查及任何新测评都**没有在本次执行**。

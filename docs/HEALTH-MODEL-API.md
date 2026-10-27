# 健康模式模型 API 入口

日期：2026-10-27。D19-04开放登录用户个人Key健康AI对话，D19-05增加独立AI去疾确认筛选和调用凭证，模型为DeepSeek；填写不调用，用户发送才调用。独立的服务端查询准备仍默认MODEL_ENABLED=0，本站RAG疾病筛选尚未上线。

## D19-05 当前流程：了解健康情况 → 确认AI去疾 → 本餐搭配

AI现在按已给疾病/身体问题进行必要补问，结构化返回reply、clarify/advice阶段及最多8个食材候选，逐项包含prefer/limit/avoid方向、原因和适用条件。模型只提出建议；本餐上下文包含已确认食材名、调料及是否检查、现有过敏/忌口名、补买开关、人数与已填疾病，不上传原图或完整原始录入。用户在对话框可看到已传信息范围。

用户明确要求新的独立排除叫“AI去疾”。建议等待用户同意，不写过敏/忌口。`Meal.aiFoodChoices`为可选字段，preferred/limited/excluded分别最多20个目录可匹配食材名；仅本餐，关闭健康模式暂停，账户个人设置不包含它。excluded过滤变体明列配料（含调料/可选项）；软偏好只在已满足库存、原硬限制、补买及配菜目标的方案间排序。用户可“同意选择并重新搭配”或只应用不搭配，不自动添加库存或开启补买。

每次成功回复额外返回`invocation`：DeepSeek requestId、实际model、prompt/completion/total tokens、时间。字段必须由供应商响应给出且通过校验，无凭证/乱JSON/截断不当作成功；不生成假ID或估算usage。页面只显示Key末4位作核对，完整Key仍不保存。旧版未记录id/usage，不能从历史认领表证明某次模型响应或解释用户私有后台无记录的原因。

AI文字安全显示段落、强调及列表，不执行HTML、脚本、远程图片或可执行链接。固定DeepSeek域名，不注入测试fetch或本地答案。真实账号控制台用量需以对应Key账号及供应商返回的用量核对。模型当前仍是一般知识参考，未声称已接RAG。

本轮验证与发布见[AI去疾交付](ACCEPTANCE-ai-food-guidance-2026-10-27.md)。下列D19-04说明为前轮接口边界，输出格式/上限以当前实现为准。

## 当前开放：登录用户自备Key的健康AI对话（D19-04）

用户已要求开放健康模式、登录后填写API并与AI对话。当前入口不再显示“健康推荐暂不可用”：登录/注册后返回健康设置，填写DeepSeek API Key，开启后在工作台推荐区顶部显示可收起的对话框；手机自然排列。疾病选填，多轮对话、取消、清空、换Key及错误反馈已实现。

- `POST /api/v1/health/chat`：同源JSON，已有Cookie及`X-CSRF-Token`；字段为`operationId`（UUID）、`apiKey`（sk-前缀）、`messages`（user/assistant交替，末条user）、`diseases`（可空）。前端不选择URL、模型或system消息。
- 固定`https://api.deepseek.com/chat/completions`、`deepseek-flash`，关闭思考，输出2000token上限；应用总截止17秒，取消传递至上游，单次发送无自动重试。最多15条上下文、合计16000字符，当前问题最多2000字符。
- Key仅浏览器当前页面内存与本次同源请求内存，不写localStorage/sessionStorage、账户、数据库或日志。刷新、离开页面、关闭模式或退出登录即清除；**未提供永久保存Key功能**。填写/开启本身不调用模型，点击发送才使用用户自己的DeepSeek额度，不使用平台Key。
- 对话历史仅本页内存；提交时携带裁剪后的对话、疾病及前述已披露的本餐结构化上下文，不自动上传本餐原始文字、图片或个人档案。回复安全格式化Markdown段落、强调和列表，不执行HTML或模型工具。
- 公网通过真实账户验证，并由`CloudBaseAccounts.claimAiChat`调用PG RPC `shiwei_ai_chat_claim`做共享单次认领、每账户滚动每分钟6次/24小时120次限额；只存owner、operation UUID、HMAC指纹及时间。认证角色不能更新/删除活动记录，不保存Key/疾病/消息正文。RPC按账户行锁串行化，不在等待模型时持有事务。记录需按后续运维保留策略由有权管理员清理，当前不宣称自动定时删除。
- `healthChatAvailable`表示对话入口；`healthModelAvailable`仍表示下文的服务端查询准备配置，二者不同。聊天无需`MODEL_ENABLED=1`或平台`.env` Key。本机显式测试身份可用内存单次认领，不能当成公网共享账本。
- 旧`HealthModel.prepare`接口继续保留，不自动触发用户Key；云端未配置该服务端模型。健康模式下菜谱可正常按食材/食品级过敏忌口搭配，返回`healthAssessment.state=conversation_only`。AI对话与推荐互不静默改写，RAG/疾病规则筛选仍未上线。

模型调用由用户发送动作授权；本站知识库未接入的提示保留在对话框内，不伪造已检索证据。账号退出/失效时清理对话与Key，服务端结果发布前复验身份。上游Key错误、余额不足、限流、网络失败、取消和截断均有独立反馈，不泄漏供应商原始错误正文。

实现和验收见[健康聊天交付](ACCEPTANCE-health-chat-2026-10-27.md)。下文为上一轮服务端查询准备接口与未来配置说明，不能据此再次封闭本轮已授权的个人Key对话。

## 已实现

- `server/health-model.ts`定义可替换`HealthModel.prepare`，当前暂定适配为DeepSeek `deepseek-flash`，旧智谱`glm-4.7-flash`保留显式兼容，不自动切换。以后新增供应商通过独立适配器；该服务端查询准备接口不接受浏览器指定URL/型号/Key。本轮独立聊天入口允许登录用户随请求提交个人Key。
- 健康推荐入口沿用`POST /api/v1/recommendations`，`meal.health=true`、疾病名在`meal.diseases`；调用前校验会话、登录、CSRF、运行时Schema及待确认限制。普通模式不调用模型。
- 查询任务版本为`health-query-v2-qualitative`，覆盖成分有益/不利方向、食物层面建议、烹调新增/变化物质和证据条件；不要求用户先称重。仍只发送疾病名称；不发送用户ID、过敏/忌口、食材原文、照片、完整草稿。标准名为候选，不覆盖原输入。
- 返回`healthAssessment.state='evidence_required'`及检索计划；`status='unavailable'`、`dishes=[]`。知识规则未接通时不返回健康菜谱。成功整理检索词不表示疾病支持或健康审核通过。
- 服务端固定允许的地址，禁止重定向；JSON输出Schema、原疾病顺序/一一对应、完整终态及64KiB正文上限。模型最多1000输出token；没有SDK隐式重试。
- 复用PostgreSQL `InvocationLedger`：身份+操作+输入/本餐版本+任务版本+供应商型号+凭证版本绑定，数据库原子认领额度；不持久保存健康原文或模型正文。成功、失败、超时/未知都保留已消耗额度；不自动重试。
- 总超时默认15秒，可设100～20000ms；同进程最多2个在途请求，额外请求立即返回忙。取消通过AbortSignal传给供应商；无法保证上游停止或不消耗。
- 重新校验身份、内容与本餐版本；旧操作取消时不发布旧查询计划。会话返回`healthModelAvailable`，健康设置显示相应入口和必要传输说明，退出/普通模式保留原流程。

请求样例仍使用完整现有推荐Schema（`meal`不是只有两个字段）：

```ts
const body = {
  operationId: crypto.randomUUID(),
  meal: { ...currentMeal, health: true, diseases: ['用户填写的名称'] },
  action: 'generate', selected: [], page: 0, previous: [], contentVersion,
};
// 同源客户端携带已有cookie和X-CSRF-Token，支持原NDJSON进度/终态协议。
```

返回示意（仅构造名称）：

```json
{
  "status": "unavailable",
  "dishes": [],
  "healthAssessment": {
    "state": "evidence_required",
    "message": "疾病信息已整理。健康证据与规则尚未接通，暂不能给出健康菜谱；可返回普通模式。",
    "plan": {
      "diseases": [{ "input": "测试疾病", "canonical": null }],
      "evidenceQueries": ["测试疾病 成分 食材 烹调条件 证据"]
    }
  }
}
```

## 未来联调配置

以下为DeepSeek后续真实联调操作说明，本轮不执行。`.env.example`有注释模板；启动不会自动读.env，使用`run.ps1 -EnvFile`显式加载。

1. 使用本地已迁移PG，准备不同的32字节base64 `SESSION_SECRET_B64/CSRF_SECRET_B64`、`DATABASE_URL`和需要时的`LOCAL_TEST_FEATURES=1`。现有单纯构造启动不要求数据库；启用模型则强制有数据库账本与稳定密钥，缺项启动失败。
2. 暂定`MODEL_PROVIDER=deepseek`、`MODEL_NAME=deepseek-flash`（配置模板已填，调用仍关闭）。正式联调前核验账户权限、数据保留/处理和预算；DeepSeek按用量计费，需显式`MODEL_FEE_MODE=byok`才能启用，账本单次尝试、无平台付费模式。该标记是对后端用户自备Key的费用归属声明，不是本站已做充值或有免费资格。保留的智谱适配仍为`MODEL_PROVIDER=zhipu / MODEL_NAME=glm-4.7-flash`，不能互混型号或自动回退。
3. Key放后端秘密文件，使用`MODEL_API_KEY_FILE`；或后端环境`MODEL_API_KEY`，两者不能同时设置。不得使用`VITE_`前缀、提交.env或在聊天发送Key。当前没有用户BYOK保存/回读界面。
4. 有界配置示例：`MODEL_TIMEOUT_MS=15000`、`MODEL_QUOTA_BUCKET=health-query-v1`。先在本地数据库显式分配测试总额度，例如下面20次；桶不是每日自动重置，也不是供应商余额。缺桶/耗尽不发送请求，不在重启时重置已用额度。

```sql
INSERT INTO quota(bucket, maximum)
VALUES ('health-query-v1', 20)
ON CONFLICT DO NOTHING;
```

5. 最后设`MODEL_ENABLED=1`，执行`./scripts/run.ps1 start -EnvFile .env.local`，登录本机测试身份，健康模式添加名称后生成。开关开启不自动发验证请求；仍需用户操作生成。正式`HEALTH_ENABLED`继续关闭，不能通过打开模型开关绕过健康审核。

DeepSeek协议核查于2026-10-27：[官方首次调用](https://api-docs.deepseek.com/)使用`https://api.deepseek.com/chat/completions`及Bearer认证，当前建议型号为`deepseek-flash`；[JSON Output](https://api-docs.deepseek.com/guides/json_mode/)要求json_object、提示中提及JSON并给样例，可能出现空正文；代码已带示例并拒绝空/截断/错名输出，不自动重发。[官方价格](https://api-docs.deepseek.com/quick_start/pricing/)说明按用量从充值/赠送余额扣费，因此不当成平台免费服务。这里只核对接口，未核验实际账号权限、条款准入和效果；本轮没有任何真实API消费。

DeepSeek是生成/查询理解模型选择，**不等于Embedding或Reranker已选择DeepSeek**；向量模型仍按RAG方案独立对照。后续RAG输出食材的有益倾向、少吃/避免和依据，当前prepare只整理查询，不让模型凭记忆直接判食材。

## CloudBase 与生产边界

目前实际云函数入口`cloudbase/http-main.ts`不注入HealthModel，默认`healthModelAvailable=false`。**只往现有云函数填MODEL_ENABLED/Key不会接通模型**。生产还缺最小权限的共享调用账本通道；不能使用管理员Key或进程内Map冒充跨实例幂等和总预算。

本轮已准备通用适配器与本地PG入口；生产需新增/验证Data API RPC账本或原生PG最小权限连接后，在云入口注入相同适配器，同时加平台全局和每账号共享限流、请求截止时间及数据条款配置。当前进程并发2和通用会话限流不能代替这些生产控制。原子认领使用现有SQL，PGlite回归不证明真实PG多连接并发通过。当前HTTP函数历史配置20秒，模型默认15秒仍须为认证/读取/复核/响应留余量并实测，不直接照搬测试超时。

`/readyz.gates.health`仍为false；健康模型配置状态不等于正式健康能力开放。本轮没有更改云函数、资料Key、菜谱发布包或数据库迁移。

## 验证

`tests/health-model.test.ts`覆盖配置默认关闭、型号/地址/秘密拒绝、数据库操作绑定/原子认领、重复操作、错误/截断/超大/错名输出、超时取消、额度不足与不重试，以及健康API登录/CSRF/限制门禁与普通模式零调用。上游用构造响应，不连接真实服务。

常规运行`./scripts/run.ps1 build`、`./scripts/run.ps1 test`；浏览器回归`./scripts/run.ps1 test:e2e`。原接口验收见[首次记录](ACCEPTANCE-health-preparation-2026-10-27.md)，本轮DeepSeek/定性目标调整见[更新验收](ACCEPTANCE-deepseek-qualitative-2026-10-27.md)。

下一步RAG实施见[健康知识方案](technical/health-rag-plan.md)。

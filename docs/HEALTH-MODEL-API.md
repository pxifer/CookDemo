# 健康模式模型 API 入口

日期：2026-10-27。用户要求准备模型接口，随后明确“暂不指定，只准备接口”。默认`MODEL_ENABLED=0`，本轮未添加Key、未调用真实模型、未部署健康模式。

## 已实现

- `server/health-model.ts`定义可替换`HealthModel.prepare`，第一个参考适配器为智谱`glm-4.7-flash`；这不表示最终选定供应商。以后新增供应商通过独立适配器，浏览器不能提交URL/型号/Key。
- 健康推荐入口沿用`POST /api/v1/recommendations`，`meal.health=true`、疾病名在`meal.diseases`；调用前校验会话、登录、CSRF、运行时Schema及待确认限制。普通模式不调用模型。
- 只发送疾病名称；不发送用户ID、过敏/忌口、食材原文、照片、完整草稿。标准名为候选，不覆盖原输入。
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

以下为选定供应商之后的操作说明，本轮不执行。`.env.example`有注释模板；启动不会自动读.env，使用`run.ps1 -EnvFile`显式加载。

1. 使用本地已迁移PG，准备不同的32字节base64 `SESSION_SECRET_B64/CSRF_SECRET_B64`、`DATABASE_URL`和需要时的`LOCAL_TEST_FEATURES=1`。现有单纯构造启动不要求数据库；启用模型则强制有数据库账本与稳定密钥，缺项启动失败。
2. 选定并核验具体境内服务的可调用状态、数据保留/处理和免费边界。若试用参考适配器，显式填`MODEL_PROVIDER=zhipu`、`MODEL_NAME=glm-4.7-flash`；其他型号/供应商会拒绝，不能用同名付费型号替代。
3. Key放后端秘密文件，使用`MODEL_API_KEY_FILE`；或后端环境`MODEL_API_KEY`，两者不能同时设置。不得使用`VITE_`前缀、提交.env或在聊天发送Key。当前没有用户BYOK保存/回读界面。
4. 有界配置示例：`MODEL_TIMEOUT_MS=15000`、`MODEL_QUOTA_BUCKET=health-query-v1`。先在本地数据库显式分配测试总额度，例如下面20次；桶不是每日自动重置，也不是供应商余额。缺桶/耗尽不发送请求，不在重启时重置已用额度。

```sql
INSERT INTO quota(bucket, maximum)
VALUES ('health-query-v1', 20)
ON CONFLICT DO NOTHING;
```

5. 最后设`MODEL_ENABLED=1`，执行`./scripts/run.ps1 start -EnvFile .env.local`，登录本机测试身份，健康模式添加名称后生成。开关开启不自动发验证请求；仍需用户操作生成。正式`HEALTH_ENABLED`继续关闭，不能通过打开模型开关绕过健康审核。

参考协议已核查2026-10-27：[智谱对话补全](https://docs.bigmodel.cn/api-reference/模型-api/对话补全)提供固定v4地址和Bearer认证；[GLM-4.7-Flash](https://docs.bigmodel.cn/cn/guide/models/free/glm-4.7-flash)支持JSON和思考控制。本轮仅核对接口能力，没有核验实际账户权限/额度、敏感数据条款或实测质量。

## CloudBase 与生产边界

目前实际云函数入口`cloudbase/http-main.ts`不注入HealthModel，默认`healthModelAvailable=false`。**只往现有云函数填MODEL_ENABLED/Key不会接通模型**。生产还缺最小权限的共享调用账本通道；不能使用管理员Key或进程内Map冒充跨实例幂等和总预算。

本轮已准备通用适配器与本地PG入口；生产需新增/验证Data API RPC账本或原生PG最小权限连接后，在云入口注入相同适配器，同时加平台全局和每账号共享限流、请求截止时间及数据条款配置。当前进程并发2和通用会话限流不能代替这些生产控制。原子认领使用现有SQL，PGlite回归不证明真实PG多连接并发通过。当前HTTP函数历史配置20秒，模型默认15秒仍须为认证/读取/复核/响应留余量并实测，不直接照搬测试超时。

`/readyz.gates.health`仍为false；健康模型配置状态不等于正式健康能力开放。本轮没有更改云函数、资料Key、菜谱发布包或数据库迁移。

## 验证

`tests/health-model.test.ts`覆盖配置默认关闭、型号/地址/秘密拒绝、数据库操作绑定/原子认领、重复操作、错误/截断/超大/错名输出、超时取消、额度不足与不重试，以及健康API登录/CSRF/限制门禁与普通模式零调用。上游用构造响应，不连接真实服务。

常规运行`./scripts/run.ps1 build`、`./scripts/run.ps1 test`；浏览器回归`./scripts/run.ps1 test:e2e`。本轮实际执行结果见[验收记录](ACCEPTANCE-health-preparation-2026-10-27.md)。

下一步RAG实施见[健康知识方案](technical/health-rag-plan.md)。

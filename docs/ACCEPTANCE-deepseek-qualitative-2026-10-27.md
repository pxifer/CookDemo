# DeepSeek与定性健康RAG调整验收

日期：2026-10-27，Asia/Shanghai。基线为`243adbc`，本轮开始时工作区干净。需求来源为D19-03：模型暂定DeepSeek；健康RAG连接疾病—成分作用—食材组成—烹调新物质，告知有益倾向/少吃/应避免后推荐菜品，不执着于精确量。

## 完成

- 新增DeepSeek固定地址适配，暂用官方当前`deepseek-flash`，JSON输出与关闭思考；保留显式智谱兼容，不自动回退或接受任意URL/型号。后端供应商名称展示为DeepSeek，前端无需改动。
- `MODEL_ENABLED=0`不变；配置模板暂定DeepSeek，启用需显式个人Key费用模式`MODEL_FEE_MODE=byok`及原有账本/秘密配置。DeepSeek官方为按量收费，账本不能冒充platform_free；使用现有BYOK单次预算，不充值、不验证扣费、不实际调用。
- 查询任务更新到`health-query-v2-qualitative`，提示包含正负影响、食物层面证据、工艺产生/变化物质及必要条件，保留JSON样例。旧操作的任务/供应商/费用绑定变化会拒绝复用。
- 重写RAG目标、疾病—成分影响与食材指导实体、定性组成关系、工艺事件、召回方向、目标动作和评测用例。量/产率/温度时长数字非普遍前置；剂量或工艺依赖仅限制相关结论，不改成无条件建议。既有普通库存/补买数量规则未修改。
- AGENTS、模型入口说明、TDD、数据/模型/检索专题、README/开发/未决问题及D19-03同步更新。前轮历史验收保留，后续明确决定覆盖旧“供应商未定”与普遍量门槛解释。

目标动作：`prefer`可优先、有益倾向；`limit`少吃；`avoid`当前适用条件下应避免；`insufficient_evidence`证据不足。机制作用不能直接推定吃该食材有益；不因检出可能有害物质就一律禁止；明确避免项不能用益处抵消。

## 验证

| 检查 | 结果 |
| --- | --- |
| `scripts/run.ps1 build` | 通过：Schema生成、TypeScript、Vite |
| Node24运行`health-model.test.ts`、`api.test.ts`、`deployment.test.ts` | 22项通过、0失败 |
| 新增/加强的行为 | DeepSeek地址/标签、明确费用模式、单次预算、空JSON内容拒绝、供应商/旧操作绑定、旧适配器兼容；继承取消/超时/额度/并发/登录/CSRF/普通零调用回归 |
| 文档链接与`git diff --check` | 通过 |

证据见 [tests.txt](../acceptance/deepseek-qualitative-2026-10-27/tests.txt)。上游均为构造响应，账本为PGlite执行真实PG语法；无真实模型调用或真实PG多连接测试。本轮未改UI布局/普通推荐引擎，不重复浏览器和全量回归；上一轮已记录的14项全量历史失败及2项旧布局断言仍未处理，不能称作全量已通过。

## 尚未完成

健康RAG仍是实施准备方案，未导入疾病/成分事实、运行Embedding或上线食材指导/菜品健康排序。实际prepare仍只整理查询，缺知识发布时返回`evidence_required`。不能把放宽精确量要求包装成健康推荐已可用。

未填真实Key、未部署云函数、未改健康发布开关或运行云迁移。本轮不重试上一轮未成功的GitHub推送；仅本地保存变更。

接口依据（2026-10-27核查）：[DeepSeek首次调用](https://api-docs.deepseek.com/)、[JSON Output](https://api-docs.deepseek.com/guides/json_mode/)、[模型与计费](https://api-docs.deepseek.com/quick_start/pricing/)。数据处理条款、实际账户预算与供应商效果仍需正式联调时核验。

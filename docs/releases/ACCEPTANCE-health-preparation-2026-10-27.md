# 健康模型接口与RAG准备验收

日期：2026-10-27，Asia/Shanghai。基线：`5a64769 优化无健康1版`，本轮开始时工作区干净。用户要求模型入口、AGENTS修正和健康RAG技术准备；随后明确暂不指定供应商、只准备接口。另已明确授权推送此前5次提交到现有GitHub main。

## 本轮交付

- `backend/src/health-model.ts`、`shared/health-model.ts`：统一HealthModel查询准备契约与首个参考适配器、固定供应商地址/型号、后端秘密、响应结构和语义检查、超时/取消、不重试、复用PG原子调用账本。主入口按显式配置注入，缺数据库和稳定会话秘密时拒绝启用。
- `backend/src/app.ts`、`shared/session.ts`、`shared/types.ts`：健康请求在身份/CSRF/输入门禁后进入模型；普通模式零调用；模型计划未接证据时健康结果保持不可用、无菜谱；旧响应不发布计划。
- `frontend/src/health-settings.tsx`、`frontend/src/main.tsx`：分离健康设置，配置可用时支持疾病必填、登录和传输对象提示；服务供应商标签由后端提供；保留关闭/普通模式与原本机测试路径。
- `AGENTS.md`重写为当前规则，清除无正式工程/无真实账户、固定三道/六道、配方按人数缩放、普通模式全量成分审批、日常主动保存默认、公开来源外链等过时或已被替代约束。
- [RAG方案](../../agent-design/retrieval/health-rag-plan.md)：关系数据、条件化烹调事件、原文证据切片、中文词典/全文、pgvector、Embedding对照、RRF/重排、撤回/版本、质量指标与P0～P4实施计划及替代方案比较。
- [模型配置说明](../../agent-design/generation/health-model-api.md)、README/开发/TDD/专题/未决及D19-02同步更新，保留历史记录与明确替代关系。

没有填写真实API Key、调用真实模型、导入疾病事实、创建云资源、改变已发布菜谱包、运行新迁移或部署云函数。当前CloudBase入口仍无共享模型账本适配，正式健康支持和RAG尚未上线。

## 实际验证

Node.js 24.22.1，Windows；浏览器为本机Edge、独立构造会话。上游模型全部使用构造响应，PG账本通过PGlite执行真实PG语法；不代表真实PG多连接或供应商准入已通过。

| 检查 | 结果 |
| --- | --- |
| `scripts/run.ps1 build` | 通过，包含Schema生成、TypeScript和Vite |
| 定向`health-model.test.ts / api.test.ts / deployment.test.ts` | 21项通过，0失败 |
| 常规全量`tests/*.test.ts` | 166项：151通过、14失败、1跳过 |
| 桌面/手机健康入口及原本机健康流程 | 4项通过；新场景覆盖必填、登录、缺证据终态、切回普通和无横向溢出 |
| 额外D7-07布局场景 | 桌面/手机2项失败，基线独立构建复现相同失败 |
| 文档本地链接与`git diff --check` | 通过；Git提示LF/CRLF规范化，不影响内容 |

定向回归覆盖固定地址/型号、密钥配置、不发送个人身份/完整草稿、重复操作仅调用一次、输入变化拒绝、额度不足不调用、上游认证/限流/500、不完整/错名/越界输出、超时取消、未知结果保留预算、登录/CSRF、未知限制阻断、普通路径不调用以及旧版本慢响应。

浏览器最后一轮使用`PLAYWRIGHT_PORT=4196`、`ACCEPTANCE_DIR=acceptance/health-preparation-2026-10-27/focused`并运行：

```powershell
# Node24环境；本机loopback浏览器测试需允许套接字访问
node node_modules/@playwright/test/cli.js test tests/browser.spec.ts --grep '健康|本机测试'
```

## 已证实的历史失败，未以放宽断言掩盖

全量14项失败为：`candidate-library.test.ts`一项仍期望旧`state=candidate_only`及内部字段；`composition-review.test.ts`十三项在构造固定旧配方时抛`COMPOSITION_CORRECTION_MISMATCH`，尚未进入本轮健康模型代码。

为区分回归，从Git的`5a64769`用`git archive`提取原始server/shared/src/tests/docs-data及scripts/lib到忽略的`.local-data/health-baseline/`，运行这两组原始测试：共17项，2通过、14失败、1跳过；失败名称与当前全量完全一致。相关数据和旧核验代码本轮未修改。

额外D7-07要求输入栏高度小于860px；当前桌面921.375px、手机870.375px。使用原始baseline前端单独构建、原始server及原始浏览器测试在4195运行，两种尺寸复现相同数值。该失败发生在打开健康弹层前，本轮未修改CSS；未把阈值调大来制造通过。后续应按当前布局重审测试需求和内容，不把本次健康接口交付说成全量回归全绿。

证据在 [health-preparation-2026-10-27](../../artifacts/acceptance/health-preparation-2026-10-27/verification-summary.json)，包含摘要、原始浏览器JSON与桌面/手机截图。基线提取目录在`.local-data/`，不提交临时源码、tar或秘密。

## Git与剩余事项

本地已有要求的`5a64769 优化无健康1版`。远端推送在明确授权后仍多次遇到HTTP408/TCP连接超时，不能把客户端错误后的“Everything up-to-date”当成功。最近成功读取的远端main是`5e5ecf547c3475a29da177204106c95f1307ba06`，本地此前5次提交仍待同步。没有强推、改写历史或为缩小上传删除原图。

本轮新增实现另存本地提交，不将它悄悄包含进仅授权的“此前5次提交”推送。恢复网络后，原基线范围可推`5a64769:refs/heads/main`；如需要同时推本轮新增实现，再按该范围授权处理。

后续工作：确定供应商与首个疾病主题/证据来源；补齐云最小权限共享账本、每用户预算与检索通道；按RAG方案先构造小规模事实/证据闭环，再实测Embedding、切片和召回收益，完成审核与生产联调。

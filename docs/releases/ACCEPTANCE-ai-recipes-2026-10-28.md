# AI实际选菜交付

日期：2026-10-28。决定：D19-12。发布目标：health-chat-v45，沿用既有免费CloudBase HTTP函数，无新资源或数据库迁移。

## 改变

旧健康搭配只把AI食材意见转换成普通引擎的排序/排除。现在主动点击AI搭配、重推或换一道，服务端会用账户Key发起一次DeepSeek选菜请求：模型读取符合硬条件的真实菜谱候选配料和做法节选、当前食材与用量、调料与检查开关、人数、口味、补买许可，以及按疾病/目标归属的建议和已接受选择，直接选择菜品并逐菜说明理由。

程序先做资格检查，模型只能选择给出的ID，返回后再做单菜/整餐累计库存和类别数量复核。模型结果不被普通排序替换；失败、编造ID、重复父菜谱或不可行组合不会静默降级成普通推荐。菜谱目录本身没有变化，真实做法继续用原弹层查看。

推荐候选最多48道父菜谱，正文上限60000字符；可选列表由模型选择至多18道、每页6道。不是声称一次读取全部图鉴。翻页/手选口味使用绑定UID/Key/档案/本餐/目录的15分钟加密游标，跨实例可用，不追加模型请求。单换保留其他菜和顺序，保存/取消建议不调用模型。结果提供本餐搭配说明和每菜“AI推荐理由”。界面说明个人额度使用范围，图鉴示例与真正AI搭配分开表达。

## 验证与边界

构建通过。相关Node测试及桌面/手机浏览器验收结果见[相关测试](../../artifacts/acceptance/ai-recipes-2026-10-28/tests.txt)、[浏览器结果](../../artifacts/acceptance/ai-recipes-2026-10-28/browser-results.json)。新增测试检查请求确含自述健康情况/接受记录/库存用量/调料开关/补买和真实做法，模型指定菜成为最终结果；伪造ID、累计短缺、无Key、重复操作、无效游标和模型断连拒绝；跨实例翻页不追加调用；单换仅更新目标；页面展示理由并定位菜品，能直接打开做法。

首轮旧API测试仍期待本机测试返回conversation_only；现明确标成test_only，避免把没有真实模型的本机食材筛选称为AI选菜。已更新这项状态断言，身份、过敏/忌口和未知限制检查全部保留。

开发验证使用构造模型响应和测试身份，不使用用户Key，不以构造数据宣称真实供应商医学建议正确。线上复验使用一次性账户，普通账户/UI核对不调用模型；可另用明确无效的测试Key验证选菜入口实际到达固定供应商并收到Key拒绝（不执行推理、不产生模型费用），不会借用用户Key。正式疾病RAG和临床签认未在本轮上线。

```powershell
.\scripts\run.ps1 build
node --import tsx --test tests/health-recipe-selection.test.ts tests/health-topics.test.ts tests/health-account.test.ts tests/ai-food-choices.test.ts tests/health-chat.test.ts tests/health-model.test.ts tests/account-sync.test.ts tests/api.test.ts tests/planning.test.ts tests/recommendation-variety.test.ts tests/persistence.test.ts
$env:HEALTH_CHAT_ACCEPTANCE_DIR='acceptance/ai-recipes-2026-10-28'
node node_modules/@playwright/test/cli.js test --config playwright.health-chat.config.ts
```

最终相关Node测试84项通过、0失败；桌面/手机浏览器14项通过、0失败、0跳过。分页测试最初错误假设固定r0父菜总在第一页；原推荐有同等候选变化，已改为针对实际首张卡测试手选口味，保持“改口味不追加模型调用”的原断言。

health-chat-v45已部署成功，原免费配置保持，无新资源/迁移。线上资源哈希与最终构建一致，341道父菜谱与图鉴映射缺失0。临时账户桌面/手机复验通过，接受/取消/删除来源和Key恢复正常。另用明确无效的测试Key经健康搭配入口发起一次供应商HTTP请求，收到CHAT_KEY_REJECTED，且没有普通推荐结果；确认选菜入口实际到达固定DeepSeek。providerRequests=1，providerInferenceCalls=0，realApiKeyUsed=false，cleanup=true。选菜内容/理由本身仍由构造响应测试，不冒充真实供应商推理或医学验收。见[线上核对](../../artifacts/acceptance/ai-recipes-2026-10-28/live-release.json)、[线上复验](../../artifacts/acceptance/ai-recipes-2026-10-28/live-verification.json)。

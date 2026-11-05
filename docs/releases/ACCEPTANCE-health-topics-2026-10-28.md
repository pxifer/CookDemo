# 健康建议来源、撤销与自然对话交付

日期：2026-10-28。决定：D19-11。现有CloudBase HTTP函数版本：health-chat-v44。

## 行为

- 每个疾病或饮食目标分别保存建议和推荐/少选/避开接受记录。三栏都能接受、取消，个人设置可按来源逐项移除。
- 综合时避开优先于少选，少选优先于推荐；保留来源独立选择。取消其中一个来源后，其余来源继续生效。普通模式暂停这些约束。
- 删除疾病/目标同时删除对应建议与接受记录，清除无归属旧摘要和本餐临时AI选择。重新添加也不恢复旧接受记录。清除健康档案按钮使用明显的红色按钮，一并清除接受记录和旧AI去疾。
- 登录与跨设备同步恢复来源记录，三方合并保留明确删除。服务端用当前账户资料，发送前先同步待保存设置，档案不一致时不转发旧历史；迟到模型回复不能覆盖新设置。
- 开关健康模式只隐藏/显示对话，不清空本页消息。删除关注后，旧对话仍可见但不再给后续模型作上下文。完整聊天仍仅页面内存；刷新或退出不恢复消息。
- 食谱示例改为无图列表，点击直接打开已有做法弹层。保留搭配后收起对话与定位菜品；界面不显示模型用量、请求ID等调用详情。
- 引导保留但不强制固定阶段，允许直接提问、简短回答、补充病症、跳过非关键问题。增加结构化输出预算，仍检查完整终态和结构，不自动重试。

## 旧数据

旧版全局记录即使只剩单一疾病/目标，也可能混有已删除疾病的建议，因此无法确定归属，不猜测：保留关注名称，清掉无归属旧摘要/选择，提示按当前档案重新整理。既有加密账户信封与CAS继续使用，不新建数据库表或资源。

## 验证

最终构建通过。Node相关测试79项通过、0失败，桌面/手机Playwright测试12项通过、0失败、0跳过。测试覆盖风湿病→糖尿病的独立来源、同食材冲突、接受/取消、删除后另一来源恢复、重加不复活旧接受、跨设备删病、旧客户端资料不回退、临时本餐约束失效、模式开关保留消息、设置恢复、无图列表、做法弹层、定位、Key隔离及无自动重发。

首轮浏览器测试有2项失败，原因是验收脚本第二处还在查旧的“已接受”按钮文字；已改为核验新的“取消推荐/少选/避开”可用按钮，最终完整回归全部通过。未删减交互检查。最终证据：[测试输出](../../artifacts/acceptance/health-topics-2026-10-28/tests.txt)、[浏览器结果](../../artifacts/acceptance/health-topics-2026-10-28/browser-results.json)、[桌面分病症界面](../../artifacts/acceptance/health-topics-2026-10-28/desktop-disease-groups.png)、[手机分病症界面](../../artifacts/acceptance/health-topics-2026-10-28/mobile-disease-groups.png)。

运行命令：

```powershell
.\scripts\run.ps1 build
node --import tsx --test tests/health-topics.test.ts tests/health-account.test.ts tests/ai-food-choices.test.ts tests/health-chat.test.ts tests/health-model.test.ts tests/account-sync.test.ts tests/api.test.ts tests/planning.test.ts tests/recommendation-variety.test.ts tests/persistence.test.ts
$env:HEALTH_CHAT_ACCEPTANCE_DIR='acceptance/health-topics-2026-10-28'
node node_modules/@playwright/test/cli.js test --config playwright.health-chat.config.ts
```

模型响应和健康资料均为明确构造的测试数据，没有调用真实DeepSeek或使用用户Key；不据此宣称真实供应商医学建议正确或疾病RAG已上线。真实模型措辞与每次完整响应仍取决于供应商，截断/超时仍明确报错、保留输入且不自动重发。线上复验使用一次性测试账户和无效测试Key，仅验证账户/UI/云端保存，完成后删除该测试账户及其记录。

首次线上复验发现登录后普通个人设置尚在同步时，Key保存会立即拒绝；已改为等待已有同步完成再提交Key，并新增延迟账户写入的桌面/手机回归。期间失败仅涉及一次性测试账户，已清理；无真实模型调用。

另有旧加密信封回归，直接构造“仅剩风湿病但摘要/全局建议仍来自已删高血压”的旧账户，确认读取不再将高血压内容归到风湿病，也不继续执行旧接受约束，现有Key保留。

最终线上版本health-chat-v44已确认部署成功，配置字节核对保持原样，无新资源/迁移。公开资源哈希与最终构建一致；341道父菜谱，图鉴变体映射缺失0。真实云端一次性账户在桌面与手机均通过：Key保存/重登恢复/清空、接受/取消后重新接受、删除来源后约束清空、重登恢复来源、无图列表与页内做法、提示消失、共享重复认领防重。providerCalls=0，realApiKeyUsed=false，cleanup=true。见[线上版本核对](../../artifacts/acceptance/health-topics-2026-10-28/live-release.json)、[线上验收](../../artifacts/acceptance/health-topics-2026-10-28/live-verification.json)。

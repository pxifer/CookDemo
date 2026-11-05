# 人数参考、自动菜数与20道套餐验收

日期：2026-10-20（Asia/Shanghai）。依据：用户四张截图及自动菜数、自定义取消、补买、20道上限和收藏外观要求；决策 D7-10～13。范围为本机 React/Fastify 工程，保留原 PRD 快照。

## 交付行为

- 自动模式结合人数、可用主料种类、填写用量及整套餐累计，人数表是软参考，不强制三道或六道；搜索允许少于或超过参考，最多20道。食材区提示填写用量能让菜数和补买建议更精确。
- “几个人吃”旁可查看完整人数参考。入口放在原人数行内，不增加一整行左栏设置。
- 自定义仅在勾选时校验，荤/素/汤填非负整数，不需要的填0，合计1～20。取消后清除旧提示，忽略原来的空白或超总数，刷新后保持自动模式。
- 自定义食材不足时说明指定数量、实际可搭配数及原因，并提供“允许补买，按指定数量搭配”。接受后生成指定整套餐，不切换成六道候选；维持过敏、忌口及整体主料复用要求。
- 自动+补买仍展示可选菜谱，每页六张仅是分页。自定义套餐可以一次展示20道，已选菜谱与旧方案数组契约同步扩展至20项，单换保持其余菜。
- 收藏恢复浅奶油圆底，移除深色外圈；心形为较上一轮稍浅的暖红，保留空心/实心和即时反馈。

## 页面中的人数参考

这是产品的家常搭配起点，不是食量、营养或疾病标准。实际食材不足时减少，不按表凑数。

| 人数 | 荤菜 | 素菜 | 汤品 | 合计 |
| --- | --- | --- | --- | --- |
| 1 | 1 | 2 | 0 | 3 |
| 2 | 2 | 3 | 0 | 5 |
| 3 | 2 | 3 | 0 | 5 |
| 4 | 3 | 3 | 1 | 7 |
| 5 | 3 | 4 | 1 | 8 |
| 6 | 4 | 4 | 1 | 9 |
| 7 | 4 | 5 | 1 | 10 |
| 8 | 5 | 5 | 1 | 11 |
| 9 | 5 | 6 | 1 | 12 |
| 10 | 6 | 6 | 1 | 13 |
| 11 | 6 | 7 | 1 | 14 |
| 12 | 7 | 7 | 1 | 15 |

## 实际验证

| 检查 | 结果 |
| --- | --- |
| `./scripts/run.ps1 build` | 通过：运行时 Schema、TypeScript、Vite |
| `./scripts/run.ps1 test` | 51/51 通过，新增9项人数/数量/模式/变体/大套餐测试 |
| `ACCEPTANCE_DIR=acceptance/meal-planning ./scripts/run.ps1 test:e2e` | 30/30 通过，桌面15、手机15，最终44.9秒 |
| `git diff --check` | 通过，仅 Git 换行规范提示 |
| 原 PRD SHA256 | 保持 `54C26CABF13DD61F7D215FCBFE236F88ADA6DCD49DA540E92A5458AF44F92E30` |

重点证据：2人自动五道、4人自动七道，减少库存后变三道；可超人数参考的构造用例；同单位未核实基准的已填量用于保守估算、空值/个克不可比不误判；取消自定义空白及21道错误；九道不足后补买生成3荤5素1汤；20道合成套餐累计需20个鸡蛋、库存2个、差额18个；20道单换保留19道；20项请求契约通过；不同用量变体不被合并，手选口味继续生效。原小目录独立穷举、硬限制、排序、过期结果、断流、焦点、320/390/768/1440px溢出和本机测试登录/退出回归通过。

初轮暴露桌面左栏增加至895px，以及口味分支导致20道请求搜索超限。将参考入口移入人数行，保留原小于860px断言；按完全相同的非调料需求/缺失调料合并可选口味，并增加类别容量剪枝，未扩大节点/时限预算。自动先搜索人数参考范围，再按乐观界探索更大方案，避免优先耗尽在大组合上。完整重跑通过，没有靠降低原布局或结果断言掩盖问题。

## 证据及边界

- [浏览器结果](../../artifacts/acceptance/meal-planning/browser-results.json)
- [手机人数表](../../artifacts/acceptance/meal-planning/mobile-serving-guide.png)、[桌面人数表](../../artifacts/acceptance/meal-planning/desktop-serving-guide.png)
- [九道补买套餐·桌面](../../artifacts/acceptance/meal-planning/desktop-custom-nine.png)、[手机](../../artifacts/acceptance/meal-planning/mobile-custom-nine.png)
- [收藏卡片](../../artifacts/acceptance/meal-planning/desktop-favorite-card.png)、[手机收藏详情](../../artifacts/acceptance/meal-planning/mobile-favorite-detail.png)
- [桌面布局](../../artifacts/acceptance/meal-planning/desktop-compact.png)、[手机布局](../../artifacts/acceptance/meal-planning/mobile-compact.png)
- [源码指纹](../../artifacts/acceptance/meal-planning/source-manifest.json)、[OpenAPI](../../artifacts/acceptance/meal-planning/openapi.json)

重量基准未知时仍不能声称净量足够或计算精确补买差额，仅作保守搭配估算；不会把约量、根/把/个与克数强行换算。当前页面目录仍只有17个构造父菜谱，无法满足任意类别的20道请求，必须如实显示目录/限制缺口；完整20道算法测试采用独立21父菜谱构造集，没有向页面注入假结果或新增无依据菜谱。

未改原型 `legacy/prototype`，未提交或推送、未部署；正式内容、模型、云账户/同步及健康审核门槛仍未通过。本机测试登录和健康流程保留此前范围。当前任务交付的是本机功能及界面增量验收。

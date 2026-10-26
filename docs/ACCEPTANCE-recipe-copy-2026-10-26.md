# 配方展示修正验收

2026-10-26，按用户最后明确的三项范围完成并上线。

- 来源保留作者及原始链接，删除“公开配方资料；保留原始出处”等内部尾注。
- 保留54份按原方拆分、细化的做法；当前线上341道菜、345种做法均不少于3步。独立方法各自编号。
- 主料、辅料、调料去掉“用量未注明”“未定量”等编辑尾注，保留名称、已知数量和可选标记；不会因缺少用量整项隐藏食材。

`scripts/run.ps1 build` 通过；`cloudbase-http.test.ts`、`gallery-content.test.ts` 合计16项测试通过。以现有发布包核对菜谱ID、图片映射及食材数据保持一致；线上全部图鉴记录与目录检查通过。桌面1440px、手机390px实际打开鲜虾蛋饼详情，来源简洁、6步完整、用量尾注移除，无横向溢出。

发布目录 `.local-data/cloudbase-http/release-20261026-recipe-copy-v29`；配置与既有包字节一致，账户密钥与内容版本不变。发布前核对免费套餐、禁超额与禁自动续费；仅更新已有函数，无数据库迁移，无真实账号测试。内容版本继续为 `gallery-listed-foods-20261026-v27`。

证据：[本地检查](../acceptance/recipe-copy-2026-10-26-verified/local-verification.json)、[线上检查](../acceptance/recipe-copy-2026-10-26-verified/live-verification.json)、[桌面](../acceptance/recipe-copy-2026-10-26-verified/live-desktop.png)、[手机](../acceptance/recipe-copy-2026-10-26-verified/live-mobile.png)。

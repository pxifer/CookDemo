# 工作台交互修复与合并发布

日期：2026-10-26（Asia/Shanghai）。依据D18-02与D18-03，覆盖上轮七项和本轮五项反馈。

## 本轮改动

- 推荐无结果、指定数量不足、换菜/重推失败不再列出逐菜排除、缺料和原方未知量明细；保留结果、可搭配数量和实际可执行的建议。需要确认的饮食设置和输入冲突仍提示处理。
- 候选与套餐的口味切换均保持已选菜序，仅更新目标卡片。先请求服务端复核，成功后保存口味；失败保留原口味与原卡片。服务端仍检查限制、库存和套餐累计，收藏复核使用同一入口。
- 卡片口味与补买入口合并一行，单口味也显示简洁味型；补买清单在卡片内浮层展开，底部操作统一对齐。
- 新增肉禽、鱼虾海鲜、蛋类、蔬菜、菌菇、豆制品、主食杂粮、奶类、水果、豆类坚果及其他食材导航；选择分类后选择食材，保留搜索/直接输入。分类仅用于导航，不作为食品级过滤依据。
- 同时包含上轮固定用量、图片完整展示、来源纯文字、底部补买单层展开、详情底部返回按钮、详情首帧回顶、返回图鉴恢复位置。

## 验证

构建与严格TypeScript检查通过。相关8个测试文件共68项通过，覆盖饮食限制、累计库存、候选复用、变体、无结果/不足提示、分类和公开配方文案。

完整测试155项为140通过、14失败、1跳过。旧失败为：候选图库旧接口期望与历史成分审批指纹用例。已将HEAD导出到隔离目录，原候选/成分测试17项同样为2通过、14失败、1跳过，错误包括COMPOSITION_CORRECTION_MISMATCH；本轮没有放宽审批校验或削弱这些断言。完整测试输出保留供后续维护，不能称为全量通过。

本地Edge桌面1440×1000、手机390×844通过：图鉴第二页深处打开详情首帧为0px；顶部/底部按钮和浏览器往返精确恢复位置；详情刷新后返回；来源无链接；图片比例；单层补买；分类添加牛肉/西兰花；口味切换不导航、不移除任何原卡片节点，其他菜卡文字与顺序不变；操作行对齐；自定义/自动无结果提示无无关明细；无横向溢出。

证据：[相关测试](../../artifacts/acceptance/workspace-ui-2026-10-26/targeted-tests.txt)、[本地交互结果](../../artifacts/acceptance/workspace-ui-2026-10-26/local/verification.json)、[桌面卡片](../../artifacts/acceptance/workspace-ui-2026-10-26/local/desktop-aligned-cards.png)、[食材分类入口](../../artifacts/acceptance/workspace-ui-2026-10-26/local/desktop-food-picker.png)、[无结果提示](../../artifacts/acceptance/workspace-ui-2026-10-26/local/desktop-custom-empty.png)。

## 发布状态

发布包已准备：`.local-data/cloudbase-http/release-20261026-workspace-ui-v30`。已部署成功。发布前实际检查免费体验环境、禁超额与禁自动续费。账户配置与既有发布包字节一致，内容版本继续为 `gallery-listed-foods-20261026-v27`，无数据库迁移，无真实账号操作。

线上Edge桌面与手机完整执行同一组检查并通过，包括本轮五项与上轮七项。线上JS `/assets/index-CZ4JL_ls.js` 和CSS `/assets/index-Bp1VTSvM.css` 与本地已验证构建一致，就绪状态 `preview_ready`。

[发布核对](../../artifacts/acceptance/workspace-ui-2026-10-26/deployment.json)、[线上交互结果](../../artifacts/acceptance/workspace-ui-2026-10-26/live/verification.json)、[线上桌面卡片](../../artifacts/acceptance/workspace-ui-2026-10-26/live/desktop-aligned-cards.png)、[线上手机分类入口](../../artifacts/acceptance/workspace-ui-2026-10-26/live/mobile-food-picker.png)。

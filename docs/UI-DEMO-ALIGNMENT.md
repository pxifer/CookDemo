# 沿用 UI Demo 的界面调整

日期：2026-10-19（Asia/Shanghai）。来源：用户明确要求“界面沿用UIdemo的”，随后要求先保存当前 Git 版本。

新工程页面以 `dist/index.html`、`dist/styles.css` 和历史审查截图为视觉基准：恢复顶部导航、页面介绍和健康入口、210px桌面/175px手机横幅、左侧食材与偏好、右侧推荐工具栏/空状态/三列桌面菜卡、底部实验室与页脚。`src/demo.css` 由原样式派生，`src/styles.css` 适配新增功能控件和关键说明可读性；原始 dist 保持不变。

保留已完成的输入确认、未知限制阻断、数量核对、单换与变体、收藏、草稿及演示隔离。原 Demo 的模拟登录/医学筛选没有替代新工程未准入出口。图片默认入口沿用原展示，尚未准入的上传和拍照按钮明确禁用。实验室场景使用独立构造状态，疾病/组合核对场景不宣称真实冲突结论。

实际验证：Node.js 24 下 TypeScript/Vite构建通过；桌面和手机各10项、共20项浏览器回归全部通过，0重试。除既有主路径和B01～B06外，检查默认图片页、输入方式键盘切换、320/390/768/1440宽度无横向溢出，以及桌面横幅210px/左栏345px、手机横幅175px。桌面和手机截图已人工复核。规则/服务端本轮没有变更，之前35项领域/API/数据库结果仍为上一轮证据，不冒充本轮重跑。

本轮材料独立存放，之前验收与历史 review-assets 保留：

- [浏览器20项结果](../acceptance/ui-demo/browser-results.json)
- [桌面初始页](../acceptance/ui-demo/desktop-initial.png)、[桌面套餐](../acceptance/ui-demo/desktop-meal.png)
- [手机初始页](../acceptance/ui-demo/mobile-initial.png)、[手机套餐](../acceptance/ui-demo/mobile-meal.png)
- [本轮源码指纹](../acceptance/ui-demo/source-manifest.json)、[OpenAPI](../acceptance/ui-demo/openapi.json)

复跑可设置 `$env:ACCEPTANCE_DIR='acceptance/ui-demo'`，然后执行 `scripts/run.ps1 test:e2e`；证据脚本也使用该目录设置。正式内容/账户/模型/健康/云准入边界继续见 DEVELOPMENT.md 和 ACCEPTANCE-v0.1.md。

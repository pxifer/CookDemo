# 全量菜谱配图验收（2026-10-27）

用户要求：把所有菜品的图片完善。范围为当前已发布的341道父菜谱，不改变345种口味做法及原方食材。

## 实现

- 原有145道配图保留，补齐196道缺图；每道菜独立图片，无跨菜替代或拼图拆分。
- 使用内置 `image_gen`，逐菜提供当前配方的主料、辅料、调料和做法，统一暖色石台、浅色餐具及成品构图。生成图为菜品展示示意，不作为真实试做记录。
- 196张PNG原图保存在 `public/assets/recipes/`；生成同名WebP网页版本，1280px宽、quality90。原图共493,860,456字节，WebP共49,272,032字节，减少约90.0%。
- 新映射独立于不可变菜谱发布包。`CloudBaseGalleryRepository.load()`与图鉴候选路径同时应用映射，工作台、收藏和做法详情使用同一道菜的图片。
- 沿用 `gallery-listed-foods-20261026-v27`、现有账户配置和免费套餐，不写数据库。发布包为 `release-20261027-all-recipe-images-v32`，仅上传196张新WebP。

## 已运行验证

- 196张独立原图与WebP完整，196份逐图提示词已保存。
- 13张联系表逐图检查，196张菜名、主体、成品形态及展示风格通过；另按配方复查薄荷、柠檬、油菜、辣椒等容易误认的实际配料。
- 全部341道菜路径存在、可解码，341份图片哈希独立；原145道路径保留，发布内容及原始包不变，撤回检查保留。
- `scripts/run.ps1 build` 通过；`cloudbase-http.test.ts`及`gallery-content.test.ts`共17项通过。
- 本地桌面图鉴15页共341张图片加载通过，手机两页48张加载通过；两种视口各验证3个详情与6张工作台图片，无横向溢出。
- 本地浏览器在受限沙箱内启动失败，改为沙箱外无界面浏览器后上述检查通过。

## 发布与线上

`release-20261027-all-recipe-images-v32` 已发布。现有免费套餐、禁止超额计费和自动续费关闭状态在发布前核验通过；配置文件哈希与v31一致，未写数据库。196张新WebP上传校验通过，线上逐图GET、内容类型、字节数及SHA-256均与本地一致；线上目录341道映射完整，内容版本保持不变。

线上桌面图鉴15页共341张图片、手机两页48张图片均解码通过；两种视口各验证3个详情、6张工作台图片及无横向溢出。浏览器测试初次使用默认5秒断言遇到启动内容仍在读取，正确设置30秒断言等待后复验通过；没有修改产品加载逻辑。

## 证据

- [覆盖检查](../acceptance/recipe-images-2026-10-27/coverage.json)
- [图片文件与哈希](../acceptance/recipe-images-2026-10-27/assets.json)
- [逐图检查](../acceptance/recipe-images-2026-10-27/visual-review.json)
- [提示词集](data/recipe-image-prompts-2026-10-27.jsonl)
- [本地浏览器结果](../acceptance/recipe-images-2026-10-27/local/browser-verification.json)
- [线上逐图哈希](../acceptance/recipe-images-2026-10-27/live/static-verification.json)
- [线上浏览器结果](../acceptance/recipe-images-2026-10-27/live/browser-verification.json)
- [发布记录](../acceptance/recipe-images-2026-10-27/live/deployment.json)

本轮未运行全项目测试套件，不将图片验收扩展为其他业务或健康能力验收。

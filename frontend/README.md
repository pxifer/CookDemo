# 前端

- `src/`：React 工作台、图鉴、账户与健康对话，复用根目录 `shared/` 契约。
- `public/`：正式静态资源；图片是源文件，不能按缓存清理，浏览器 URL 沿用 `/assets/...`。
- 从仓库根目录运行 `scripts/run.ps1 build`，输出到 `artifacts/build/web/`，再运行 `scripts/run.ps1 start`。
- 构建生成的校验器仍写入 `src/meal-validator.js`；不在本目录单独安装依赖。

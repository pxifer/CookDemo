# 从 GitHub 部署到 Cloudflare

这个 Demo 是纯静态网页：页面、脚本、样式和图片全部位于 `dist/`，没有真实后端、登录服务或 API 密钥。

## 方案一：Cloudflare Pages（推荐）

1. 打开 Cloudflare 的 Workers & Pages，创建 Pages 应用，选择导入现有 Git 仓库。
2. 连接 GitHub，选择 `pxifer/CookDemo`。
3. 按下面的设置部署：

| 配置 | 值 |
| --- | --- |
| 生产分支 | `main` |
| 框架预设 | None / 无 |
| 根目录 | 留空（仓库根目录） |
| 构建命令 | `exit 0` |
| 构建输出目录 | `dist` |
| 环境变量 | 无 |

部署成功后访问 Cloudflare 提供的 `*.pages.dev` 地址。之后向 `main` 推送更新，即可由 Git 集成触发新的部署。

如果出现首页404，检查输出目录是否为 `dist`，以及仓库中是否存在 `dist/index.html`。不要把 `demo` 填成根目录，本仓库已经以项目本身作为根目录。

依据：[Cloudflare 静态 HTML 部署文档](https://developers.cloudflare.com/pages/framework-guides/deploy-anything/)、[构建配置文档](https://developers.cloudflare.com/pages/configuration/build-configuration/)。

## 方案二：Cloudflare Workers 静态资源

如果你在 Cloudflare 选择了 Workers 的 Git 部署入口，使用：

- 根目录：仓库根目录。
- 构建命令：不需要构建，可留空。
- 部署命令：`npx wrangler deploy --config wrangler.workers.jsonc`。
- 不需要应用 API 密钥、数据库绑定或 Worker 业务脚本。Cloudflare Git 集成负责其部署授权。

仓库内的配置将 Worker 名称设为 `cookdemo`，静态资源目录设为 `./dist`。如果你在控制台建立的 Worker 使用了其他名称，请同步修改配置中的 `name`，或在部署命令末尾添加 `--name 你的Worker名称`。

也可在已经登录 Cloudflare 的本地终端运行同一条部署命令。Wrangler 由 `npx` 获取，不是浏览器 Demo 的运行依赖。

依据：[Workers 静态站点入门](https://developers.cloudflare.com/workers/static-assets/get-started/)、[静态资源配置](https://developers.cloudflare.com/workers/static-assets/binding/)。

## 体验边界

- 设置与收藏仅存储于访问者当前浏览器；换域名后不会自动迁移。
- 图片上传只用于本地预览，识别结果为固定模拟数据。
- 所有热量、营养和疾病筛选均为演示，不提供真实医学结论。
- 中文字体有可选的 Google Fonts 加载，无法访问时回退系统字体。
- 不包含原演示托管平台的项目标识、访问凭证或本地截图。

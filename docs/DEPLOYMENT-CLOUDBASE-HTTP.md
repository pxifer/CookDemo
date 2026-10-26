# 免费HTTP云函数部署操作手册

2026-10-23，依据D14-01。目标环境：`shiwei-d2gmiun66b7dc6a4f` / `ap-shanghai`。这是普通HTTP云函数预览，不是云托管容器，也不是正式健康或账户开放。

## 访问和组成

- 网站：https://shiwei-d2gmiun66b7dc6a4f-1512010497.ap-shanghai.app.tcloudbase.com/
- 工作台、`/recipes`、`/favorites`与API同源。首次浏览器访问可能出现腾讯云测试域名确认页，点击“确定访问”。仅自定义域名方案才另核域名/备案；本轮没有伪装已完成。
- SCF：`shiwei-http-preview`，HTTP、Nodejs24.11、256MiB、20秒，监听9000；不预置并发，不使用云托管或镜像仓库。
- 图片：既有免费静态托管的`assets/recipes`，182文件（91 PNG+91 WebP），不覆盖原`__auth`、`cloud-admin`，不使用prune。当前90道有匹配配图，其余仍显示缺图状态，不换其他菜图。
- 数据：现有PG新增`public.shiwei_gallery_releases`公开发布表。图鉴147条源记录→145菜/146变体；原方、口味和匹配逻辑沿用本机，包指纹保存在受控配置中。原26张核心/向量表保留，不转移用户资料或密钥。

## 构建和配置

项目Node24运行：`scripts/run.ps1 build`、`scripts/run.ps1 test`。`scripts/prepare-http-release.ts`只读从本机应用账号导出公开菜谱并构建函数；目录必须位于`.local-data/cloudbase-http`且不存在，不覆盖旧包。源数据要求3道社区基础配方及147条候选，拒绝构造内容。

本轮目录`.local-data/cloudbase-http/release-20261023`包含公开gallery-bundle、manifest、function、独立migration目录和受限cloudbaserc。`scripts/build-http-seed.ts`生成新增发布表迁移，原两条CloudBase迁移按原文件复制。先dry-run确认仅一条pending，再up并查任务Succeed、独立回读与权限。

`configure-http-preview.ts`生成独立会话/CSRF随机密钥；publish_key角色为anon。实际cloudbaserc、发布键和原始部署响应位于Git忽略目录，不在聊天/日志输出值，Windows文件ACL限制。函数包只上传`function/`，这些配置文件在包外。Node24不采用云端安装依赖，使用锁定依赖本地`npm ci --omit=dev --ignore-scripts`；esbuild只编译服务器源码，运行依赖保留。

启动脚本`scf_bootstrap`使用`/var/lang/node24/bin/node`与绝对工作目录`/var/user`；Fastify静态根目录必须通过resolve转成绝对路径。初轮遗漏此项造成启动443，已定位并修复，不能只按Active状态判断网站可用。

## 发布和验证

所有命令先核验环境仍为baas_trial、EnableOverrun=false、IsAutoRenew=false；不要用升级或按量来修复部署错误。当前会话CLI3.8.7已经授权，失效时按原设备码流程由用户本人确认。

在受控发布目录执行官方CLI：`fn deploy shiwei-http-preview --httpFn --install-dependency false --runtime Nodejs24.11 -e shiwei-d2gmiun66b7dc6a4f --region ap-shanghai --json --yes`。更新时仅对本项目已创建的同名函数使用force，复用已有密钥并保留旧包。配置public=true与gatewayPath=/会创建匿名HTTP路由；应用仍验证同源/CSRF并限制频率。不要输出fn detail中的Environment。

图片只上传独立目录：`hosting deploy public/assets/recipes assets/recipes -e shiwei-d2gmiun66b7dc6a4f --region ap-shanghai --verify`；保留原图作失败回退，现代浏览器优先同菜WebP。

实际验证`/healthz`、`/readyz`（preview_ready）、145菜API及资源200，再运行`playwright.cloudbase.config.ts`的桌面/手机场景。普通本地e2e不会隐式访问云。浏览器确认腾讯云提示后，验证食材→推荐→图片→做法→收藏刷新、图鉴筛选/刷新、补买及来源拦截。

## 更新、撤回和仍未开放范围

更新菜谱时新建受控包/发布ID，核对来源、原方及新SHA后发布新行并更新函数环境指纹；不覆盖旧包或用SQL直接修改已批准的旧迁移。需要停止内容时可将本发布行published设false：anon不可见，仓库返回503，推荐不得回退构造目录。禁用HTTP路由可停止入口；本轮不自动删除函数、图片或数据库。

原生PG直连、CA及运行账号仍未通过，不应把只读Data API当作任意SQL/跨请求事务连接。后续账户/同步、凭证持久化、模型识别、正式健康和完整恢复仍须单独完成原门禁；收藏与偏好目前保存在当前浏览器，同源于本机的新域名不会自动读取localhost的个人草稿。

官方核对：[HTTP云函数部署](https://docs.cloudbase.net/cli-v1/functions/deploy)、[Node24运行环境](https://docs.cloudbase.net/cloud-function/runtime-support)、[PG连接方式](https://docs.cloudbase.net/database/postgresql/connecting-to-postgresql)、[免费套餐](https://www.cloudbase.net/pricing)。云托管按量限制仍见[官方说明](https://docs.cloudbase.net/run/limitation)，不将普通HTTP函数混同为云托管函数框架。
# 2026-10-24 当前增量

以下2026-10-23章节保留历史：当前同名函数已经支持真实受邀账户及加密同步。新增迁移 `20261024010000_account_ingredients` 和函数包 `release-20261024-account-v2`；同步私表2张，公开原文/配料盘点6张。初始邀请文件仅在本机忽略目录；账户不开放自助注册。30分钟会话过期重新登录。运行配置新增 `ACCOUNT_SYNC_ENABLED=1`、`PROFILE_ENCRYPTION_KEY_B64`、`PROFILE_KEY_VERSION`，资料密钥独立且更新必须保持原值，禁止每次发布随机重建。v2打包复用v1配置；旧包保留，但旧版函数不认识账户，不能把回退旧代码当作账户恢复。

新验证命令：`node node_modules/@playwright/test/cli.js test --config playwright.account-cloud.config.ts`。仅使用构造账号，trace关闭；不要开启含密码的跟踪、打印账户响应/函数Environment或把private文件放入发布包。免费套餐/超额停服边界不变。新增事实不自动批准成分/过敏/健康，完整状态及证据见 [账户与配料验收](ACCEPTANCE-account-ingredients-2026-10-24.md)。


D15-02首批逐方核验发布采用新增迁移20261024020000_composition_review和函数包release-20261024-account-v3；4份旧迁移字节保持不变。COMPOSITION_RELEASE_ID及COMPOSITION_RELEASE_SHA256仅引用公开核验包，缺失/撤回/篡改不回退。先执行build-composition-release、本地测试、dry-run/up及独立回读；v3沿用v1/v2全部账户与会话密钥，configure-composition-http逐项验证后发布。构造账户已清理，账户浏览器测试须重建独立测试账号；卡片及公开推荐可单独复测。完整结果见专项验收。

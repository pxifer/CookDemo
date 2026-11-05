# 免费HTTP云函数上线验收

2026-10-23（上海时区）。依据用户确认的D14-01免费HTTP方案。云环境`shiwei-d2gmiun66b7dc6a4f`，ap-shanghai。

## 当前可访问

[拾味公网网站](https://shiwei-d2gmiun66b7dc6a4f-1512010497.ap-shanghai.app.tcloudbase.com/)。腾讯云测试域名首次显示平台确认页，按正常“确定访问”进入。工作台、图鉴、收藏和API同源HTTPS；没有自定义已备案域名的虚假声明。

## 实施结果

- 普通SCF HTTP函数`shiwei-http-preview`，Nodejs24.11、256MiB、20秒、监听9000、Active。未使用收费云托管/镜像仓库，未购买CVM，未设置预置并发。仅创建本项目新函数，路径修复后更新同一函数。
- 现有上海PG新增一张`shiwei_gallery_releases`，只存公开菜谱发布包，147条源记录生成145道/146变体；不修改原001～003及26张核心/向量表。已核对的3道基础配方不含构造营养，其他仍为来源候选，不标专业审核通过。90道有同菜配图。
- 新表强制RLS：anon只读已发布payload及定位列，INSERT/UPDATE/账户读取均false；publish_key的JWT角色为anon，不使用管理员/service_role。发布前dry-run仅一条pending，云任务`task-556d46d8f03a46a5`的RunMigrations=Succeed；随后原角色独立核验数量、权限，匿名Data API真实读取145道及固定包SHA通过。
- 固定包指纹`a8672d832d83d0e77fcd331334612a5a3697e89b301d2c49183cd0f830b1063b`，内容版本`local-business-gallery-v1-c018e1b4c2b40a30`。读取失败/撤回/篡改不回退构造内容，返回前复读沿用竞态保护；未复制个人表/推荐历史/Key到公开表。
- 静态托管182文件（91PNG+91WebP）全部上传成功并verify=true，原`__auth`和cloud-admin保留，没有prune。浏览器实际解码同菜WebP成功，收藏缩略图实际解码通过。无对应配图的菜仍保留缺图状态。
- 会话和CSRF密钥独立生成，受限配置放Git忽略目录，函数包目录不含配置文件；匿名发布键不发浏览器。Secure/HttpOnly/SameSite会话及同源/CSRF检查继续生效。生产/staging门禁不放开；独立preview入口不启用测试登录、账户/模型/健康。

## 实际检查和故障记录

- Node24：严格TypeScript及Vite通过，新增HTTP入口与准备脚本纳入检查。105项常规用例为104通过、0失败、1项可选真实PG测试未启用。3项新增测试覆盖仓库→145菜→推荐、撤回/篡改拒绝，以及匿名仅可读已发布内容、不可读checksum/账号或修改发布。
- 最终函数包在本机9000启动，真实云PG读取、healthz/readyz均200；临时进程随后关闭。公网健康、就绪、页面、JS及145菜API均200，readyz为preview_ready。
- 公网Edge桌面1440×1000/手机390×844共6项通过、0跳过。覆盖手动“白菜、猪肉、粉条”不补买推荐出“白菜猪肉炖粉条”、配图实际解码、做法、收藏/刷新、图鉴筛选/刷新、6道补买候选、HTTPS会话及伪造来源拦截。无横向溢出。收藏配图加强复测2项也通过。
- 首次函数创建Active但公网443：最终包的相对静态根目录不被Fastify接受，改绝对路径并更新后修复。原始部署回执保留在受控目录，不把Active冒充页面可用。
- 浏览器前两轮遗漏/未等待腾讯云动态确认页，导致页面场景失败并中断剩余；使用正常访客等待、点击确认后最终6项通过。失败截图/trace及最终JSON均保留，未绕过或移除平台确认页。
- 上线后独立查询：baas_trial、EnableOverrun=false、IsAutoRenew=false、到期2027-04-21 23:59:59；原26表权限/RLS/账本检查继续通过。没有开通日志服务或按量。

## 证据与边界

脱敏[verification.json](../../artifacts/acceptance/cloudbase-http-2026-10-23/verification.json)、[最终浏览器报告](../../artifacts/acceptance/cloudbase-http-2026-10-23/browser-final.json)、[收藏图片复测](../../artifacts/acceptance/cloudbase-http-2026-10-23/favorite-images.json)，截图在同目录`browser-final/`、`favorite-images/`。公网工作台截图为[workspace-cloud.png](../../artifacts/acceptance/cloudbase-http-2026-10-23/workspace-cloud.png)。

这是免费体验环境的可访问预览，资源耗尽仍按既有设置停服，不承诺无限额度或永久在线。账户同步、真实图片识别、正式健康、专业配方/营养审核和完整恢复继续未完成。收藏/偏好仍保存在当前浏览器，公网域名不能自动读取localhost草稿。Data API只读适配不代表原生PG连接/TLS/运行角色问题已经解决。操作与更新/撤回见[手册](../operations/DEPLOYMENT-CLOUDBASE-HTTP.md)。

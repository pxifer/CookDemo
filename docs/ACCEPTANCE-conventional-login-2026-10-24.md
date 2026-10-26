# 常规登录入口与自动填充兼容

用户反馈登录页“点不动”、出现两个登录，要求按常见网站方式处理。保留全部既有工作区修改和账户数据，沿用D16-03自动个人设置同步，不改变认证、密码规则或计费。

## 已定位及修改

- 原上方“登录”是模式切换按钮，点击当前登录模式也会清空密码；下方“登录并同步”才提交。移除顶部切换栏，登录页仅保留一个“登录”提交按钮，下方“还没有账号？注册账号”；注册页显示“已有账号？返回登录”。弹窗标题对应登录/注册，已登录显示个人设置，去掉重复账号标题和说明。
- 原提交只读React状态，浏览器/密码管理器若仅填入DOM而未触发输入事件，会出现屏幕有值而提交按空值校验的情况。改为提交前用FormData读取当前可见表单，再更新组件状态；保留标准username/current-password/new-password提示。截图本身不能证明该浏览器具体发出了哪些事件，本轮测试明确构造未触发事件的DOM填充，不冒充真实密码管理器人工验收。
- 失败保留输入，成功后才清空；正在登录/注册明确区分。有同步锁防同一事件循环重复提交；注册验证码发送也读取表单邮箱，不因自动填充未更新状态而禁用发送。保持CSRF、验证码、官方身份及Cookie确认，未读取用户截图中的凭据或尝试用户账号。

## 验证

- 严格TypeScript、Vite构建通过，前端`index-CtzitKCO.js`、`index-ntqTk18d.css`。
- [本机手机/桌面8/8回归](../acceptance/public-registration-2026-10-24/conventional-login-results.json)：单登录按钮/对应标题、注册返回、无输入事件的DOM填充可成功登录；错误密码不清空；双次requestSubmit只发送一个请求。注册、失败反馈、自动个人设置同步、跨设备隔离和人数不参与同步继续通过。模拟邮件和PGlite，不代表真实邮箱注册。
- 本轮修改仅前端登录交互；上一版131项单元通过/1可选项跳过的后端基线保持，未重复运行或当作本轮新增结果。
- [真实云端手机/桌面登录](../acceptance/conventional-login-2026-10-24/cloud-login-ui.json)：一次性构造账号在真实公网页面以无input事件的DOM填充值成功登录，两端均只有一个登录提交且各发一次请求，成功反馈可见、退出正常；账号和测试资料/会话核对所有权后已删除。没有使用用户账号或真实邮箱注册。截图：[手机](../acceptance/conventional-login-2026-10-24/mobile-login.png)、[桌面](../acceptance/conventional-login-2026-10-24/desktop-login.png)，只在退出并清空用户名后截图，没有密码/验证码。
- [公网入口及注册保护2/2通过](../acceptance/conventional-login-2026-10-24/live-results.json)：标题、单登录按钮、底部注册切换、8位校验、失败保留、真实供应商图片验证码与跨来源/私表保护正常，没有发送邮件。
- 发布至同一个免费HTTP函数`release-20261024-account-v8`。[本机验证汇总](../acceptance/conventional-login-2026-10-24/local-validation.json)、[发布后边界](../acceptance/conventional-login-2026-10-24/cloud-boundaries.json)确认所有配置和密钥沿用v7、没有数据库迁移，体验版/禁止超额/关闭自动续费保持。[秘密扫描](../acceptance/account-ingredients-2026-10-24/secret-boundary-conventional-login-final-verification.json)未发现实际配置密钥或既有测试凭据泄露。

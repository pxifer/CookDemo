# 2026-10-24 自助注册与个人信息保存

来源：用户明确纠正“并非受邀账号，需要每个用户都能登录，保留自己的信息”。本轮以该要求替代此前受邀建号的入口限制；旧账户、工作区改动、云端个人密文和菜谱版本均保留。

## 用户流程

个人设置→注册账号→输入用户名、邮箱→获取并填写六位邮箱验证码→设置并确认密码→注册并登录。没有邀请码、管理员预置或受邀名单检查。注册用户自己设置密码，不再强制修改一次初始密码。原有预置账号继续登录并保持原改密流程。

用户名5～24位，含字母，可用数字、点、下划线、短横线且以字母/数字开头；密码已按用户后续D16-02要求从12位放宽为8～32位，包含大小写字母、数字及符号。后续用用户名和密码登录。验证码发送后有60秒冷却；供应商要求图片验证时，注册和登录均可显示、换图、验证后继续。注册失败输入保留与结果提示的最新验证见[修复记录](ACCEPTANCE-password-feedback-2026-10-24.md)。

每个用户拥有独立的认证UID、本机账号空间和受RLS保护的云端资料。收藏及主动保存的常用偏好（包含保存的过敏/忌口、口味、调料等）继续加密跨设备同步；登录展示游客合并与版本冲突，不能静默覆盖限制。本餐食材及文字草稿仍只留本机。注册入口开放不改变健康模式或菜谱成分的核验边界。

## 实现与安全边界

- 复用上海CloudBase内置认证，按官方发送邮箱验证码→验证→signup→token introspect顺序执行，成功后初始化当前UID的应用会话。运行时不携带管理端密钥、service_role、SMTP账号或密码，不经管理员建号接口冒充自助注册。
- 邮箱发送任务的verification_id、邮箱和device封装成认证密文，绑定签名游客会话、用途及有效期。浏览器仅在当前组件内存保留不透明challenge与输入；不能借用另一会话的证明，不能传入userId指定资料所属者。供应商的一次性验证负责防重放，服务端拒绝过期、篡改及未知证明。
- 注册、图片验证、发送验证码都走同源CSRF保护；严格限定请求字段与长度。每会话发送冷却及有界内存计数，供应商限流继续生效；不承诺冷启动后的应用内存计数是全局额度器。零账单仍依赖环境关闭超额按量，不自动升级或购买短信/邮件套餐。
- 邮箱仅用于身份验证，由同一上海认证服务处理，不写入公共食材库或推荐日志。密码交给官方认证服务，应用个人资料表仅保留既有认证密文，不新增密码列。
- 原SESSION/CSRF/PROFILE密钥、内容及成分核验环境配置逐项保留。无需改表、原迁移或数据；已注册用户继续按auth.uid()行级隔离。关闭注册开关不关闭已有账户登录，登录所需图片验证仍可使用。
- 站内仍未接入自助忘记密码、账户注销、完整恢复和正式健康准入，不把本次注册功能当成这些功能完成。默认腾讯云域名的访问提示页及原域名准入边界保持。

## 云配置与发布

[身份源回读](../acceptance/public-registration-2026-10-24/provider-configuration.json)：开启已有email身份源及内置代发；用户名、匿名、手机号登录其他状态保持。旧邮箱配置仅在忽略目录备份，未输出SMTP秘密。仍为baas_trial、EnableOverrun=false、自动续费关闭；未调用邮件发送进行配置探测。

函数包v4完成注册入口，最终包`release-20261024-account-v5`补齐登录图片验证恢复，均更新原`shiwei-http-preview`，不重建资源。v4继承v3全部环境配置，v5继承v4；没有重新生成资料或会话密钥。最终前端为`index-hveq3PTJ.js`、`index-QoFmrGYD.css`。

## 已运行验证及明确未验证范围

- Node24严格TypeScript编译与Vite构建通过。全量129项，128通过、1项可选PG跳过；随后认证相关18项定向回归通过。覆盖邮箱验证顺序、个人选择密码、跨实例解密、CAS、账号隔离、同源/CSRF、过期/篡改/跨会话/重放、错误验证码、弱密码、重复注册、供应商图片验证和注册开关。
- [本机构造供应商＋真实PGlite与HTTP/React浏览器闭环](../acceptance/public-registration-2026-10-24/browser-final-results.json)：桌面和手机2/2通过，每个用例分别注册两个用户，检查错误验证码可重试、图片验证码恢复、游客主动合并、刷新、第二设备登录恢复、新账号为空及退出失效。模拟邮箱为example.invalid，没有真实发信；不把这项写成真实邮件送达证明。
- 首轮测试服务器静态根路径不是绝对路径，启动失败，原报告保留；修正测试服务器resolve后，[第二轮2/2](../acceptance/public-registration-2026-10-24/browser-v2-results.json)通过，随后增加图片验证场景的最终2/2通过。没有降低注册、恢复或隔离断言。
- 真实邮箱送达及用户收件端完整注册需要用户实际收信。本轮已请用户通过网站反馈，未索取密码/验证码，也未用管理员预置账号替代真实邮箱注册验收。未收到反馈前，不宣称已验证真实邮件投递。
- 最终v5公网：[注册入口/响应式/真实供应商图片验证码/无证明注册拒绝/跨源保护2/2通过](../acceptance/public-registration-2026-10-24/live-results.json)，[原推荐/逐方限制/图片/图鉴/收藏回归8/8通过](../acceptance/public-registration-2026-10-24/previous-paths/browser-results.json)。公网测试未发送真实邮件或创建测试账号，不把真实图片验证通过当作邮箱收信证明。
- [部署后免费边界](../acceptance/public-registration-2026-10-24/cloud-boundaries.json)保持baas_trial、按量关闭、续费关闭；原表和迁移未变。[秘密扫描](../acceptance/account-ingredients-2026-10-24/secret-boundary-public-registration-verification.json)覆盖404个源码/文档/公开证据及构建文本，实际秘密值无命中。最终git diff --check通过。

官方依据（2026-10-24核对）：[signup仅支持验证后的身份](https://docs.cloudbase.net/http-api/auth/auth-sign-up)、[发送邮箱验证码](https://docs.cloudbase.net/http-api/auth/auth-send-verification)、[校验验证码](https://docs.cloudbase.net/http-api/auth/auth-verify-verification)、[内置邮件代发](https://docs.cloudbase.net/authentication-v2/method/email-login)、[修改邮箱身份源](https://cloud.tencent.com/document/api/876/129350)、[图片验证码](https://docs.cloudbase.net/http-api/auth/auth-get-captcha-data)、[验证图片验证码](https://docs.cloudbase.net/http-api/auth/auth-verify-captcha-data)。SDK与HTTP文档用户名长度有差异，本次邮箱注册按5～24位保守交集实现，旧登录仍接受原用户名长度。

# 2026-10-24 账户同步、紧凑卡片与配料盘点

依据：用户本轮四项实现要求；继承 FR-04/05/06/09、游客主动合并、版本检查、调料不限仍检查过敏/忌口，以及 D5 零账单和境内资料约束。保留全部原有工作区修改、旧发布和原始候选；未 reset/clean，未改 PRD。

## 当前交付范围

| 要求 | 实际状态 |
| --- | --- |
| 账户登录和同步存储 | 上海 CloudBase 内置受邀用户名/密码真实接入；收藏和主动保存的常用偏好加密跨设备同步；本餐食材不上传 |
| 卡片展示 | 图片序号与可见“成品示意”移除，角标显示口味；单口味不重复展示，多个口味保留下拉；补买清单默认收起，可键盘展开，展开区最高180px后滚动 |
| 全量配料入库 | 145道/146变体，372食材/调料、1,762条运行时配料行、147份原始记录及1,726条原始配料文本已入云PG；保留角色、可省状态、原文、来源、未知量和解析状态 |
| 过敏/忌口 | **分批开放，未全量完成**。用户已批准逐方核验。首批清蒸南瓜、糖拌番茄两份原方核验完整；其余140道候选继续拦截，既有3道来源准入规则保持。未批量标记 componentsComplete，复合调料成分不明继续拦截 |

网站：[拾味](https://shiwei-d2gmiun66b7dc6a4f-1512010497.ap-shanghai.app.tcloudbase.com/)。受邀入口：个人设置→账户与同步。账号 `shiwei` 已创建；随机初始密码只在本机 `.local-data/cloudbase-http/account-ingredients-20261024/owner-invitation.private.json`，Windows ACL限制当前用户/SYSTEM，Git忽略。首次登录先修改密码，不把密码写入本文或聊天。

## 账户实现及边界

- 通过官方 `/auth/v1/signin` 和 `/auth/v1/token/introspect` 验证用户；PG请求携带该用户token，RLS使用 `auth.uid()`，不使用管理员或 service_role。运行时没有管理账户凭证。邀请建号仅用已授权本机CLI。
- 账户cookie为HttpOnly/Secure/SameSite=Strict的认证密文；独立资料密钥AES-256-GCM绑定所属用户/用途/版本。密钥通过函数配置注入，配置不在上传代码包内，与会话/CSRF密钥分离；后续发布必须沿用，不重新生成。账户会话30分钟，届满重新登录；没有把refresh token写入浏览器存储。
- 新增私有 `shiwei_account_state`、`shiwei_account_sessions`，强制RLS。只保存密文、版本、改密状态及会话摘要/期限，公开配料表不包含用户资料。旧26张表、001～003应用账本保持原样。
- 服务端严格验证保存结构，只接受收藏和无食材/原始输入的已保存默认；本餐草稿留设备且按账号隔离。首次登录保留已有游客草稿到尚无草稿的账户本机空间，不覆盖既有账户草稿。
- 游客内容导入及设备冲突展示双方收藏、口味、限制范围并由用户选择；CAS写入，旧版本409，不静默重试覆盖。合并保留双方限制，范围或确认状态不一致标记conflict；单方替换需明确点击。登出撤销数据库会话，复制旧cookie也无法重新使用。
- 当前是受邀账户功能开放。自助注册、短信/邮箱、BYOK持久化、正式健康、完整账户注销/备份撤销重放与恢复准入本轮没有实现；`readyz`不伪装全系统正式准入完成。密码忘记后由邀请人通过CloudBase控制台处理，非站内自助找回。

## 配料事实与待核对范围

新增6张公开源数据表：`shiwei_source_recipe_records`、`shiwei_source_ingredient_entries`、`shiwei_ingredient_inventory`、`shiwei_recipe_inventory`、`shiwei_recipe_ingredient_lines`、`shiwei_ingredient_proposals`。均强制RLS，anon仅能读取对应公开发布版本，不能写；个人两表不向anon开放。

每条候选身份/可能过敏成分关联单列在 proposals，版本 `ingredient-evidence-20261024-v1`，全部是pending-source-review或requires-product-label，**不会改变运行时的成分完备性或推荐准入**。库存简名匹配与过敏成分关系继续分开，不用“猪肉”“粉条”等模糊召回来证明限制范围正确。不推算缺失营养，也不把未知当0。

1,726条原始配料文本中6条尚未识别为具体食材，原文未丢弃：

| 源记录 | 菜名 | 原文及上下文 | 后续处理 |
| --- | --- | --- | --- |
| 23 main/4 | 大盘鸡 | “菜椒甜椒各一个”之后的“各50g” | 数量续行，应核原文关联，不作为新食材 |
| 26 main/2 | 姜葱捞鸡 | “鸡腿4个”之后的“约400g” | 同上；核实是总量还是单个量 |
| 35 main/4 | 山西过油肉 | “其他调料20g” | 没有明确配料名称；不能证明调料栏已完整覆盖 |
| 37 main/1 | 带把肘子 | “带脚”和“爪猪前肘”断行 | 核对标点后连回原文，不新增“脚”食材 |
| 71 seasonings/12 | 牛排 | 可选迷迭香或百里香说明 | 二选一及可省关系待核；预制牛排酱汁另需产品成分 |
| 103 aux/6 | 萝卜炖羊排 | “姜10g／一般买一头姜／从中切大约4片即可” | 操作说明回附姜，不作为第四种食材 |

数量来自入库回读，不表示这些之外的1,720条已经完成人工审核。复合调料如酱油、蚝油、鸡精、预制酱汁不能按通用名称猜完整配料；后续应逐份配方核对原文覆盖、普通食材身份、复合品标签和替代/可省关系，有缺项继续拦截。

## 自动审批拒绝与用户批准的替代方案

自动审批拒绝了“批量推断过敏成分并移除候选菜谱整体拦截”的补丁，理由是可能让未完整核对的配方绕过过敏/忌口保护。被拒补丁未落地。随后向用户说明原因与具体替代方案，用户明确选择“按逐方核验方案继续（推荐）”。该授权不等于忽略未知成分；实施以确切来源证据、单方绑定和缺项继续拦截为边界。

首批核对固定 HowToCook commit `0e106eea348c734fe1586f781202994439cf98a5` 的必备原料、计算及全部操作步骤：

| 配方 | 核对结果 | 原文证据 |
| --- | --- | --- |
| 清蒸南瓜 R382 | 入盘仅南瓜300g；1000ml饮用水用于蒸锅，非配方投料；无油、盐、复合调料 | [原文快照](../../artifacts/acceptance/account-ingredients-2026-10-24/R382-source.md)，SHA256 `00708225f67ba4aa10a61b7ea3885487f63bc0b9d4e6d01afa57325bb05d495f` |
| 糖拌番茄 R380 | 西红柿、白砂糖；步骤白糖对应同一配料，开水为去皮替代操作。保留原解析行，白糖/白砂糖只在本方内双向检查忌口 | [原文快照](../../artifacts/acceptance/account-ingredients-2026-10-24/R380-source.md)，SHA256 `0a17cd82ca74f182fdd543842535beac063179b47bfdf55135f76b8a1101f822` |

原文已从固定GitHub raw地址重新取回并对照摘要；不导入简介功效或卡路里。核验限定天然单一原料及原文指定的纯白砂糖、水，不扩展到品牌复合糖、调味制品或厨房交叉接触；不是专业医疗审核或适宜性保证。

公开核验发布 `composition-review-20261024-v1` 存在既有 `shiwei_gallery_releases` 的新增不可变行，包含146份变体状态，2份本批通过、144份本批待核（含沿用既有准入的3道，不表示撤销旧审核）。见[逐方清单](../../artifacts/acceptance/account-ingredients-2026-10-24/composition-inventory.json)和[发布摘要](../../artifacts/acceptance/account-ingredients-2026-10-24/composition-release.json)。本批只有两份证据对应的候选获得例外，其余140道候选父菜谱保持原拦截。

运行时同时校验发布摘要、服务端白名单和配料/步骤/来源/食物/关联指纹；改变任何受核字段就不再沿用结论。客户端不能提交核验标记。核验记录缺失、撤回、篡改或查询失败均停止该版本内容读取，发布结果前再次读取，不回退旧通过结论。换菜、口味、重推、收藏复查统一执行；调料不限库存仍检查忌口。未修改全局食物完备标记，也未推算营养或开放健康模式。

剩余工作是逐方补齐原文覆盖、身份、可省/替代及复合品标签证据，不能以批量抽取或用户授权替代事实核验。当前不得称第4项全量完成或全部145道可用于限制条件。[官方食安资料](https://www.cfs.gov.hk/sc_chi/consumer_zone/safefood_all/food_allergy.html)支持对复合品标签和交叉接触另行核对，不能按通用调料名称推定无过敏成分。

## 云部署及验证

- 迁移：`20261024010000_account_ingredients.sql`，先本地PGlite完整执行、dry-run确认只新增一条，再由官方CLI提交；任务 `task-47902b443edd4c1b` 为 Succeed/RunMigrations。新增8张表及6个RPC，没有修改原迁移。
- 账户/卡片运行包v2已部署；逐方核验运行包`.local-data/cloudbase-http/release-20261024-account-v3`同名函数更新，沿用旧SESSION/CSRF密钥及本轮v1独立PROFILE密钥，逐项比对保持一致，未重建资源。前端 `index-IfdAEiX0.js`、`index-CeTmbhUR.css`。
- 核验迁移`20261024020000_composition_review.sql`，4份旧迁移逐字节未变；本地PGlite执行/匿名写拒绝/JSON回读及云dry-run通过，仅一项pending，任务`task-df0e3e6f17f34525`为Succeed/RunMigrations。未新增权限或改写原发布。
- 云回读 [配料数量及权限](../../artifacts/acceptance/account-ingredients-2026-10-24/cloud-inventory-verification.json)：372/146/1762/147/1726，6条needs-review；8表RLS及FORCE全部true，anon私表访问/公开表写权限/私表明文个人字段均无。
- [真实CloudBase账户验证](../../artifacts/acceptance/account-ingredients-2026-10-24/cloud-account-verification.json)：两个独立构造账号实际登录/首次改密，跨实例加密读取、CAS409、直接Data API行级隔离、密文无测试明文、退出后会话撤销均通过。构造过敏数据仅用于验收，无真实用户健康资料。
- [部署后边界回查](../../artifacts/acceptance/account-ingredients-2026-10-24/cloud-existing-boundaries.json)：仍为baas_trial，EnableOverrun=false，自动续费false；旧26张表权限与原迁移保持，体验到期日2027-04-21。
- Node24严格编译、Schema生成、Vite构建通过；加入逐方核验后124项常规测试123通过、0失败、1项可选本地PG未开启。6项新核验测试含原文摘要、全局事实不变、对应限制/糖名、其他候选保持拦截、8类篡改失效、换菜/收藏共用门禁、未知限制和健康不放行、撤回/返回前复查及客户端伪造拒绝。
- 公网原有推荐、图片解码、图鉴刷新、收藏刷新、来源拒绝，桌面/手机共6/6通过，见 [原路径复测](../../artifacts/acceptance/account-ingredients-2026-10-24/previous-paths/browser-results.json)。
- 新账户浏览器首轮：桌面/手机账户路径2/2通过；卡片用例两次失败原因是仅输入白菜，实际符合条件只有4道，测试却要求6道。修正为白菜、猪肉、粉条、鸡蛋，保留6道断言和首轮失败证据，未更改推荐行为迎合测试。[最终卡片及账户复测4/4通过](../../artifacts/acceptance/account-ingredients-2026-10-24/browser-v2-results.json)，[图片解码与首次改密再登录4/4通过](../../artifacts/acceptance/account-ingredients-2026-10-24/browser-password-and-visual-results.json)，桌面/手机均覆盖。首次改密后实际保存云端偏好。
- [构造账号清理](../../artifacts/acceptance/account-ingredients-2026-10-24/fixture-cleanup.json)：4个构造账号及其会话/资料已删除，人工受邀账号和管理员未动。浏览器账户用例复跑需新建独立构造账号，不能复用已删除凭证。验收trace关闭，避免录入密码进入追踪包。
- [秘密边界扫描](../../artifacts/acceptance/account-ingredients-2026-10-24/secret-boundary-verification.json)：账户阶段372个文本文件/构建文件对照实际秘密值无命中；[逐方核验阶段复查](../../artifacts/acceptance/account-ingredients-2026-10-24/secret-boundary-composition-verification.json)扫描383个文件仍无命中。私有配置及邀请码在Git忽略的本机受限目录，未写入交付文档。
- [逐方核验云回读](../../artifacts/acceptance/account-ingredients-2026-10-24/cloud-composition-verification.json)：146条状态中2条通过、144条本批待核；原菜谱发布摘要和配料数量保持，RLS/FORCE开启，anon写入/私表访问均无。[上线后免费边界](../../artifacts/acceptance/account-ingredients-2026-10-24/cloud-composition-boundaries.json)仍为baas_trial、按量关闭、自动续费关闭。
- v3公网最终回归：[桌面/手机逐方限制与原推荐/图鉴/图片/收藏路径8/8通过](../../artifacts/acceptance/account-ingredients-2026-10-24/composition-live/browser-results.json)，[紧凑卡片2/2通过](../../artifacts/acceptance/account-ingredients-2026-10-24/browser-composition-results.json)。实际确认花生限制下可推荐两份已核验原方，南瓜/番茄/白糖忌口排除对应菜品，收藏复查同样拦截，乾隆白菜等成分未齐配方仍不能放行。卡片图片实际解码，桌面截图已人工查看，补买折叠及口味角标正确。[本地验证汇总](../../artifacts/acceptance/account-ingredients-2026-10-24/composition-local-validation.json)保留124项的通过/跳过数；最终git diff --check通过。

官方依据（2026-10-24已核对）：[用户名密码登录](https://docs.cloudbase.net/http-api/auth/auth-sign-in)、[token验证](https://docs.cloudbase.net/http-api/auth/auth-token-introspect)、[认证与PG RLS](https://docs.cloudbase.net/authentication-v2/auth/auth-pg)、[管理员邀请建号](https://docs.cloudbase.net/api-reference/manager/node/user)、[Web认证改密](https://docs.cloudbase.net/api-reference/webv3-pg/authentication)。改密采用官方SDK3.6.3的sudo旧密码→PATCH password流程，并已真实验证；未引入SDK运行时依赖。

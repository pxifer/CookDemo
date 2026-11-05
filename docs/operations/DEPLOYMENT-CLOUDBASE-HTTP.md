# CloudBase HTTP 云函数部署手册

核对日期：2026-10-30。现有环境为 `shiwei-d2gmiun66b7dc6a4f` / 上海 `ap-shanghai`，当前入口为普通HTTP函数 `shiwei-http-preview`，不是云托管容器。最新代码维护包为[maintenance-v46](../releases/ACCEPTANCE-maintenance-release-2026-10-30.md)，沿用原配置/密钥，无迁移或图片上传；6个发布后只读检查通过。后续测试仍在本地，未完成的新功能保持关闭。

## 当前组成与已验收版本

- [网站](https://shiwei-d2gmiun66b7dc6a4f-1512010497.ap-shanghai.app.tcloudbase.com/)：页面和API同源；测试域名可能显示腾讯云访问确认页。自定义正式域名/备案不在本手册中宣称已完成。
- 后端：`deployment/cloudbase/http-main.ts`，Node.js 24、监听9000；工作台、图鉴、收藏与真实注册/登录使用同一应用。
- 数据：PostgreSQL公开发布包与食品级记录经Data API读取；账户同步私表和加密资料独立。公开角色只读有效发布，不能写账户私表。
- 图片：既有静态托管 `assets/recipes`，网页优先同菜WebP；保留已有文件和映射，不用另一道菜替代缺图。
- 最近内容验收：`gallery-listed-foods-20261026-v27`，341道父菜谱/345种口味；[食品级验收](../releases/ACCEPTANCE-listed-foods-v27-2026-10-26.md)。
- 最近全量图片发布：`release-20261027-all-recipe-images-v32`，341道对应图片齐全；[配图及线上哈希验收](../releases/ACCEPTANCE-recipe-images-2026-10-27.md)。数量和版本为该次已验收快照，以后以实际发布为准。

真实邮箱注册、用户名密码登录及加密个人设置/收藏同步已经接通。疾病健康推荐仍关闭，当前云入口不注入HealthModel；单独填模型开关/Key不会完成云端模型接线。详见[模型API边界](../../agent-design/generation/health-model-api.md)。

## 构建与发布包

先根据修改范围构建和测试：

```powershell
.\scripts\run.ps1 build
.\scripts\run.ps1 test
```

发布包放在Git忽略的 `.local-data/cloudbase-http/` 独立新目录，保留旧包用于追溯/撤回。不同历史脚本绑定不同内容版本，不能将早期145道目录打包脚本直接套用于当前发布。

| 修改范围 | 现有参考工具 |
| --- | --- |
| 食品级内容包与HTTP配置 | `scripts/build-listed-food-release.ts`、`scripts/prepare-listed-food-http.ts`、`scripts/deploy-listed-foods-v27.ps1` |
| 全量图片与对应函数包 | `scripts/prepare-all-recipe-images.ts`、`scripts/deploy-all-recipe-images.ps1` |
| 发布/食品级接口核验 | `scripts/verify-listed-food-release.ts`、`scripts/verify-listed-food-live.ts` |
| 图片本地/线上核验 | `scripts/verify-all-recipe-images.ts`、`scripts/verify-all-recipe-images-ui.ts`、`scripts/verify-all-recipe-images-live.ts` |

这些工具不是自动选择最新版的通用发布服务。更新前核对实际入参、源发布ID/hash、输出目录和待执行迁移；不改写已应用迁移或旧发布包。Node24运行依赖采用锁定版本，本地构建后上传，不把发布成功等同于运行时依赖已可用。

## 配置与密钥

入口读取 `APP_ORIGIN`、`CLOUDBASE_ENV_ID`、`CLOUDBASE_PUBLISHABLE_KEY`、`CONTENT_BUNDLE_ID`、`CONTENT_BUNDLE_SHA256`、独立的 `SESSION_SECRET_B64` / `CSRF_SECRET_B64`。账户启用配置为 `ACCOUNT_SYNC_ENABLED`、`PROFILE_ENCRYPTION_KEY_B64`、`PROFILE_KEY_VERSION`，自助注册使用 `PUBLIC_REGISTRATION_ENABLED`。

既有资料/会话密钥要原值沿用，不能在每次发布时随机重建；资料密钥不能与会话/CSRF密钥相同。本机测试身份不得在云入口启用。旧成分审查配置只用于对应旧发布路径，当前食品级包不再以旧审批指纹拦截普通推荐。

配置文件和原始部署响应留在受控忽略目录，设置文件权限；仅上传函数包，秘密文件不能混入包内或公开证据。不要输出CLI函数详情中的Environment或账户响应。

## 更新与验证

操作现有函数前，核对目标环境及既有零账单/禁超额/禁自动续费设置仍符合要求；核验是当次操作，不能把10月的证据当作永久套餐承诺。本次文档整理不连接云、不更改资源、费用、权限、密钥或发布。

在已核对的发布目录，可使用既有官方CLI命令更新同名函数：

```powershell
cloudbase fn deploy shiwei-http-preview --httpFn --install-dependency false --runtime Nodejs24.11 -e shiwei-d2gmiun66b7dc6a4f --region ap-shanghai --json --yes
```

CLI实际调用方式以已安装工具为准。只在更新本项目既有同名函数且确认目标后使用所需覆盖参数；不自动创建容器、镜像仓库或其他收费资源。图片只上传实际新增/变更文件到 `assets/recipes`，禁止prune删除无关静态文件，保留原 `__auth`、`cloud-admin` 等已有内容。

发布后核对：

1. `/healthz`、`/readyz`、公开目录版本/hash、JS/CSS与图片实际响应。
2. 受影响的工作台→推荐→换菜/口味→做法→收藏、图鉴筛选/分页/返回位置。
3. 账户变更仅用独立构造账号验证注册/登录/设置/隔离；关闭含密码的trace，不操作真实个人资料。
4. 明列食材/调料的过敏与忌口、补买、空结果和来源/CSRF拒绝仍执行。

按需使用 `playwright.cloudbase.config.ts`、`playwright.account-cloud.config.ts` 或专项核验脚本。只运行本地测试不等于线上已验证，Git提交不等于已部署。

## 撤回与仍未完成项

内容撤回须按版本/有效发布状态执行，仓库读取失败不得回退构造目录。旧内容与包保留，但不自动将旧函数代码回退当成账户恢复，也不能复活已撤回证据或发布。必要时关闭既有HTTP路由停止入口，不擅自删除数据库、函数或图片。

忘记密码/注销、完整账户灾备、云共享模型账本、真实图片识别、健康知识与审核仍见[当前架构](../architecture/overview.md)。历史部署和恢复结果保留在对应验收及 `artifacts/acceptance`，不再维护旧容器方案或“尚无账户/尚未上线”的推进清单。

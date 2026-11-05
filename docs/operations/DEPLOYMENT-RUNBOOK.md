# 本地数据库与运维手册

本手册只描述仍可使用的本地工具，不再维护逐阶段执行记录。线上当前使用CloudBase普通HTTP云函数，更新和撤回见[云端部署手册](DEPLOYMENT-CLOUDBASE-HTTP.md)。

## 本地数据库

需要已启动的本机Docker及Node.js 24。以下脚本使用 `deployment/compose.local.yml`，准备或复用本地秘密、启动数据库、迁移并核验，不创建云资源：

```powershell
.\scripts\setup-local.ps1
```

工具约束目标Compose项目 `shiwei-local`、容器 `shiwei-local-db-1`、本机loopback端口；开发库 `shiwei_dev`、隔离结构测试库 `shiwei_test_structure`。失败时保留数据卷，不靠删库重建、重新随机生成密码或开放公网端口修复。

受控配置在 `.local-data/deployment/`，已有文件不覆盖。数据库初始化后，直接修改秘密文件不会同步修改角色密码；不要把该目录打包、提交或输出到聊天。

## 本地内容与图鉴

已有图鉴和配置时：

```powershell
.\scripts\run.ps1 build
.\scripts\business-local.ps1 -Task Start -Port 4180
```

该包装脚本默认图鉴版本只支持Start，不要对默认版本运行Prepare。首次准备独立构造业务库时，显式指定构造版本：

```powershell
.\scripts\business-local.ps1 -Task Prepare -Release local-business-v1
.\scripts\business-local.ps1 -Task Start -Release local-business-v1 -Port 4180
```

上述Prepare使用构造测试资料，独立库为 `shiwei_business_local`，不向线上发布真实配方。已存在的公开候选/真实发布包与构造版本分别管理，不自动切换版本或复活撤回内容。脚本实现见 `scripts/content-local.ts`，环境不匹配时停止。

## 迁移与结构检查

迁移文件保留原字节和checksum，已应用的旧迁移不能编辑；新增变更另建迁移。显式配置迁移环境与最小权限运行环境，不把迁移所有者长期当作应用账号。

```powershell
.\scripts\run.ps1 db:migrate -EnvFile .local-data/deployment/migrate.env
.\scripts\run.ps1 db:check -EnvFile .local-data/deployment/app.env
```

环境文件名仅为操作示例，使用实际已准备的对应文件，不在命令行内填写连接串。需要向量结构时按脚本实际参数显式加 `-Vector`；存在pgvector表不表示Embedding或健康知识已就绪。

云迁移位于 `deployment/cloudbase/migrations`，与本地原生PG命令分开。Data API读取成功不证明原生 `pg.Pool` 连接、TLS及跨请求事务已验证；不能用管理员Key绕过最小权限接线。

## 加密空结构恢复工具

仅适用于脚本允许的本机空结构与对应源码版本：

```powershell
.\scripts\backup-encrypted.ps1 -VerifyRestore
.\scripts\backup-encrypted.ps1 -Archive '.local-data/encrypted-backups/实际归档文件.swbk'
```

使用AES-256-GCM外层保护schema-only归档。密钥与归档分目录、受Windows ACL保护；已有密钥不能丢弃或重新生成以尝试解密旧归档。工具在随机隔离库验证恢复，不切换运行库，不恢复源角色/ACL，不覆盖已有归档。

这不是业务数据、CloudBase认证、最新撤销日志或完整账户恢复。云业务备份、独立介质、轮换调度及完整清除/撤销重放还需各自实现和演练，不能把本地空结构通过写成全系统灾备通过。

## 运行观察

`/healthz` 用于存活检查，`/readyz` 和配置相关结构探针按当前运行入口检查内容/依赖状态。必须同时核对公开页面、目录读取和相关API，不以进程启动、云函数Active或空表存在代替业务就绪。

当前能力与剩余缺口统一见[架构说明](../architecture/overview.md)。历史故障、命令结果与回滚证据保留在 `artifacts/acceptance` 及对应验收报告，不再重复追加“推进中/等待用户”的旧状态。

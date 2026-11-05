# 部署材料

- `cloudbase/http-main.ts`：现有上海 CloudBase HTTP 云函数入口；`cloudbase/migrations/` 保留云端迁移文件。
- `db/`：既有运维和待验证功能 SQL；归位不代表已执行。
- `compose.local.yml`、`staging.env.example`：本地数据库及配置模板；本地实际秘密继续留在 `.local-data/`。
- `examples/`：历史部署示例，按示例的说明使用，不冒充当前云端配置。

部署手册见[HTTP 云函数](../docs/operations/DEPLOYMENT-CLOUDBASE-HTTP.md)，本地运维见[运维手册](../docs/operations/DEPLOYMENT-RUNBOOK.md)。工具仍从仓库根目录 `scripts/` 运行；云函数发布包内部保留 `build/web/`。本次整理不执行上传、云迁移、真实模型调用或发布。

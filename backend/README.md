# 后端

`src/` 保留既有模块化单体结构：`main.ts` 为本地/原生 PG 入口，`app.ts` 组装 API，推荐、账户、模型和研究检索分别由原模块承担。

数据库迁移 SQL 随运行代码保存在 `src/migrations/`，研究 SQL 在 `src/health-knowledge/`；文件内容与迁移编号未因目录整理而变化。云端入口在 [deployment/cloudbase/](../deployment/cloudbase/)，Agent 分模块导航见 [agent-design](../agent-design/README.md)。

从仓库根目录运行现有 `scripts/run.ps1` 命令。默认静态目录为 `artifacts/build/web/`；容器可通过 `STATIC_ROOT=build/web` 沿用包内目录，云函数默认也沿用包内 `build/web`。

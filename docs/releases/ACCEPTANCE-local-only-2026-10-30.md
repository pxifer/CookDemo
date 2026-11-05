# 测试恢复本地执行

2026年10月30日，按用户“把测试放回本地”实施。复用已有本机PostgreSQL、Docker和Playwright，不搭云测试站，不访问正式网站，不发送真实邮件，也不加载或使用已填写的DeepSeek Key。云端及付费模型专项继续暂停。

## 当前执行方式

| 范围 | 位置与依赖 |
| --- | --- |
| 构建、类型、规则、知识与评测契约 | 本机Node.js 24和仓库数据 |
| 注册、登录、找回与健康AI交互 | 本机模拟身份/邮箱/模型及测试PGlite或本机PG |
| PostgreSQL集成 | 已有本机数据库和Docker容器 |
| 桌面/手机浏览器 | 127.0.0.1页面和模拟服务，不复用其他已启动服务 |
| 真实邮箱、真实模型质量、云端灾备及回滚 | 暂停，仍未通过；不能用本地结果替代 |

既有20组检查本来主要在本地执行；此次重点是明确默认范围并增加防误连。`pg-cloud-migrations`名称保留，但只在本机Docker验证SQL，不执行云端迁移。

`scripts/run-local-tests.ts`接管常规测试、浏览器和PG脚本。子进程移除继承的云端/模型Key位置、远程数据库和代理等配置，固定禁止付费；统一`check`也使用同一策略。PG仅接受既有回环项目库，结构测试库固定为`shiwei_test_structure`；Docker须为本机管道/Unix socket。

Node预加载器拦截公网fetch/http/https，禁止fetch跟随重定向。浏览器使用本地代理阻断外网，禁用Service Worker，并拦截外部HTTP/WebSocket。策略用于防误连，不能描述为已完成正式环境安全或供应商质量验收。

## 本轮验证

执行一次本地统一入口，见[项目报告](../../artifacts/acceptance/project-check-2026-10-30T10-59-36-214Z/report.json)：

- 常规测试246项，245通过、0失败、1项真实PG用例按单元配置跳过。
- 构建、两组类型、Schema、知识完整性、编辑检索、配方证据及两组AI契约等10组本地检查通过。
- 新增3项防误连测试通过：验证回环URL与本地PG、拒绝主机覆盖、清理凭证环境；真实子进程在发出请求前拒绝原生fetch/http/https，未向被拒地址实际发请求。
- 独立TypeScript检查测试包装器通过；两个PowerShell入口在实际5.1解析器中错误为0，保留UTF-8 BOM。
- 4组浏览器及6组PG在当前Codex进程仍因本机端口/Docker权限阻塞，未执行，未回退到云端。浏览器策略在此尚无实际运行通过证据。

当前源码与报告指纹一致，详见[实现汇总](../../artifacts/acceptance/local-only-2026-10-30/implementation.json)。此前普通PowerShell20组全通过基线保留，不移植到当前版本；正式发布仍未就绪。

## 本地入口

```powershell
# 常规回归
& 'D:\codex_AI\菜谱推荐\CookDemo\scripts\run.ps1' test

# 确需全量时，在普通PowerShell并打开已有Docker后执行
& 'D:\codex_AI\菜谱推荐\CookDemo\scripts\run.ps1' test:local
```

原`verify-in-terminal.ps1`也指向同一受控本地入口，无须云环境或Key。后续优先按变更做必要验证，当前不重复执行全量。资源约定见[本地测试与资源保留](../operations/resource-preservation.md)。

# CloudBase 结构环境：按顺序执行

**2026-10-23：已按D14-01上线免费普通HTTP云函数预览。当前入口、更新与撤回流程见[HTTP部署操作手册](../docs/DEPLOYMENT-CLOUDBASE-HTTP.md)。下方容器/空结构阶段内容保留历史，不能据此判断当前网站尚未上线。**

更新日期：2026-10-21。免费环境 **`shiwei-d2gmiun66b7dc6a4f`** 的PostgreSQL/向量空结构已实际部署，见实施记录R16～R20。云应用尚未部署，数据录入、具体模型、正式账户/健康开放后置。

**实际配置：**上海/ap-shanghai；PG17.11；库名 `postgres-l3nqdxta`（小写l）；vector0.8.2位于extensions；26张项目表/001～003原checksum已核验。套餐baas_trial、超限按量/自动续费关闭，到期时间API原值2027-04-21 23:59:59。迁移角色不是应用运行账号，Node原生连接/TLS仍待配置。

**当前用户无需手工查询：**已在Edge完成官方CLI授权，由实施人员直接检查和部署。确需登录确认或其他本人操作时再提供具体步骤，不再逐字段索取SQL结果。

## 第一步：已完成的账号和数据库核验

### 1.1 环境概览和实际入口

用户在 [CloudBase控制台](https://tcb.cloud.tencent.com/)确认地域/类型及SQL编辑器等入口；随后CLI通过官方API复核套餐和地域。当前容器服务列表为0，未配置公开入口。

日期、套餐及实际SQL/ACL证据见 [云端验收](../acceptance/cloudbase-structure-2026-10-21/verification.json)，创建前历史见R09～R13。

[官方快速体验](https://docs.cloudbase.net/database/postgresql/quickstart)列入口“控制台 → 数据库 → SQL编辑器”；若当前界面只有数据库管理/DMC或其他入口，先按实际入口核对，不照搬MySQL设置步骤。数据库类型若不是PostgreSQL，先反馈，不删除或重建环境。

### 1.2 只读SQL：版本、vector、权限

现使用 `scripts/cloudbase.ps1 -Task Inspect` 直接检查，核对免费套餐、26张表、RLS、默认/有效客户端授权、原迁移checksum和vector。原 [横向查询](db/cloudbase-inspect.sql)与 [纵向查询](db/cloudbase-inspect-vertical.sql)保留作只读诊断，无需用户重复执行。

实测管理角色 `cloudbase_postgres_postgres_l3nqdxta`：can_create_in_public=true、can_create_roles=false、非SUPERUSER但BYPASSRLS。`cloudbase_read_only_user`别名在此环境切换失败，未为此加权；只读SQL通过现有管理通道执行。新表原有客户端默认读写授权已由云迁移回收，未动auth/storage平台对象。

本地/云端分别执行验证，不用本机0.8.7替代云端0.8.2证据；权限检查覆盖有效权限与默认授权，不仅看默认ACL数组。真实浏览器身份和Data API完整端到端验收仍待后续。

### 1.3 应用连接和最小运行角色（仍待落实）

[官方后端连接说明](https://docs.cloudbase.net/database/postgresql/connecting-to-postgresql)列PostgreSQL协议。已知库名不等于原生主机；当前环境资源API的PG条目仅给Name/InstanceName/Status/Region/TenantType/DocumentExt，尚未取得主机、端口、CA和最小运行角色。实施人员继续核对可用配置入口/平台机制，不按环境ID猜地址或以管理员角色长期运行应用。

2026-10-21继续直查底层 `DescribeDBInstanceAttribute` 成功，返回jnsgw的pg_direct_link/pgrest_direct_link网关条目；public为initing且无地址/端口。SSL配置、账号列表、备份计划查询分别被当前授权拒绝，不能推断SSL关闭或免费版不支持。可用 `.\scripts\cloudbase.ps1 -Task Capabilities` 只读重查；[能力证据](../acceptance/prelaunch-operations-2026-10-21/cloud-capabilities.json)不包含网关IP/账号ID/秘密。

后续官方澄清应同时确认：此tenant免费环境的原生连接入口/同地域网络、CA及主机名验证、独立最小权限运行账号创建路径、无需购买资源的PG导出恢复。不要套用独享腾讯云PG或MySQL的开外网/付费备份步骤；当前SQL管理角色无CREATEROLE且BYPASSRLS。

当前云迁移走官方SQL管理通道，每条迁移内部为一个原子DO，保留事务级锁/账本；这没有接通应用 `pg.Pool`，不证明跨连接CAS/预算竞争已在云端验证。原生连接落实后再配置URL/CA和运行账号；安全TLS或角色机制不满足时先记录限制并提出适配方案。完整URL/秘密只进入受控配置。

### 1.4 容器计费核验（应用部署前仍需完成）

当前不启用付费套餐、超限按量或固定IP。以下为官方咨询问题草稿；本轮未发送工单/外部消息。实施人员先核对官方资料与账号能力，确需本人处理或授权对外咨询时再告知用户：

> 我已创建CloudBase免费版环境 shiwei-d2gmiun66b7dc6a4f，创建页选择上海、PostgreSQL，显示¥0/月、6个月、3000资源点且不能开启超限按量。请确认：这个套餐能否在不开超限按量、不开其他付费资源的前提下，通过云托管运行自有Docker镜像（Node.js 24，HTTP端口8080）？CPU、内存、网络、HTTP网关、镜像仓库和日志是否均有免费可用路径，额度用尽是否硬停且不产生套餐外账单？资源点价格页列云托管CPU/内存抵扣标准，但云托管使用限制页仍要求开启超限按量，这条限制是否适用于这个套餐？请提供适用套餐/地域的说明链接。

记录答复时间、适用地域、计费模式及环境类型。需要关闭的准入项为：

1. 上海 PostgreSQL 免费体验环境能否在完全不开超限按量时运行云托管容器？资源点用尽是否所有必要服务均停用且不扣费？
2. 本地构建镜像的仓库、上传/拉取、容器网络出站、HTTP 网关、认证和日志是否存在必须单独付费的资源？
3. 可用 PostgreSQL 版本、vector 扩展、数据库账号权限、内网连通、TLS CA、导出/恢复方式和免费域名测试限制是什么？

公开文档仍有冲突：[资源点价格](https://cloud.tencent.com/document/product/876/127357)与[云托管限制](https://docs.cloudbase.net/run/limitation)。若官方明确免费环境不可运行该容器，记录CloudBase当前路径不满足准入，再提交替代方案；不以付费试用、优惠券或预算告警替代D5零账单。公开域名备案另有[付费环境/固定IP条件](https://cloud.tencent.com/document/product/876/128405)，正式公开入口仍需单独解决。

### 1.5 已完成的独立本地准备

本机加密schema-only归档及从已有归档恢复已实际通过：26表/3版本、随机隔离库和临时文件已清理，密钥独立目录/Windows ACL/Git忽略已核验。命令见 [操作手册8.1](../docs/DEPLOYMENT-RUNBOOK.md#81-当前推荐加密结构归档)。这不是云PG备份或含账户/凭证/最新撤销的恢复；云导出、七天轮换/每日调度、独立介质保管仍未做。

## 第二步：空表和向量迁移（已执行）

1. 复用平台已分配的PG库，未新购数据库实例。免费/按量关闭核验后部署；容器计费准入单独保持未通过。
2. `20261021123000_shiwei_core.sql` 包装001/002原源文件及checksum，创建24张核心/账本表；`20261021123100_shiwei_vector.sql` 启用vector0.8.2并包装003，增加两张空向量表。
3. 两条迁移均先本机隔离测试与官方dry-run，再提交、等待任务Succeed、独立查实表和账本；云历史2条、应用账本3条、后续计划pending=[]。不把HTTP多次请求当成事务。
4. 云端按项目表/附属序列清单回收PUBLIC与anon/authenticated/service_role授权，开启RLS，并收回当前迁移角色对public新表/序列的广泛默认授权。没有执行本地全public授权脚本；最小应用运行角色仍待1.3。
5. 云端构造向量探针验证错误维度拒绝/正确维度可写，全部构造记录回滚；最终账户/菜谱/向量均0。代码、命令和证据见操作手册与R17～R20。

已部署的云迁移文件不再改写；新增变更生成新版本。原始001～003也保持原文。结构完成不等于账户、内容、模型、完整恢复或正式公开门槛已通过。

## 第三步：满足容器零账单条件后部署应用（尚未执行）

1. 第二步已完成；先落实1.3的原生URL/CA、最小运行角色及运行授权/RLS策略，再验证Node原生连接和结构探针。不能把迁移管理角色直接用作正式运行角色。
2. 确认1.4的计费/镜像-网络-网关-日志条件已核实，记录官方说明及实际套餐配置。未满足时不创建容器服务；当前列表为0。
3. 本地 `docker build --platform linux/amd64 -t shiwei:staging .`，记录实际镜像 digest；使用已核验零账单的镜像仓库。
4. 云托管选择端口 8080、最小0/最大1实例，按已批准测试规格起步；实测不足时记录，不自动购买更高套餐。
5. 按 [staging.env.example](staging.env.example)配置精确 HTTPS `APP_ORIGIN`、数据库 URL/CA、独立会话密钥。可用环境变量注入或受控秘密文件挂载，均不能写镜像/前端。文件须对容器运行用户可读。
6. 存活检查 `/healthz`；本轮结构检查 `/deploymentz`。`/readyz` 会因内容后置而保持503，不能把 `/deploymentz` 当完整产品上线门槛。
7. 默认不接入模型、不开放账户、不返回构造菜谱。邀请入口、容器重启、数据库断连、配额硬停、日志与空结构备份验证后更新部署记录。

## 仍未开放

内容读取/发布与规则接线、真实认证/同步/保存 Key、独立撤销日志和全系统恢复、正式数据、AI/Embedding、专业健康审核、域名备案及正式公开访问。状态以 [实施记录](../docs/DEPLOYMENT-STATUS.md) 为准。

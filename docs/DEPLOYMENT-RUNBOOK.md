# 上线结构操作手册

**2026-10-23：已按D14-01上线免费普通HTTP云函数预览。当前入口、更新与撤回流程见[HTTP部署操作手册](DEPLOYMENT-CLOUDBASE-HTTP.md)。下方容器/空结构阶段内容保留历史，不能据此判断当前网站尚未上线。**

更新日期：2026-10-23。当前执行状态、每项结果及未完成项见 [DEPLOYMENT-STATUS.md](DEPLOYMENT-STATUS.md)。最新依赖顺序及阻塞见[持续推进记录](ACCEPTANCE-continuous-2026-10-23.md)。本手册对应已落地的代码；选型背景见 [原部署研究](DEPLOYMENT-GUIDE.md)。

## 0. 当前阶段：本地数据库业务

本地业务链路阶段已完成一轮；用户现要求持续推进至上线或额度耗尽。继续核验上线条件和补齐业务，不重复云迁移、扩展空结构或申请更高权限。云托管的超限按量准入与零账单约束冲突，创建操作跳过。下文历史命令保留；当前以第10、11节和[持续推进记录](ACCEPTANCE-continuous-2026-10-23.md)为准。

```powershell
.\scripts\run.ps1 build
.\scripts\business-local.ps1 -Task Prepare
.\scripts\business-local.ps1 -Task Start
```

地址：http://127.0.0.1:4180/ 。本轮已准备并启动；若需重启，在旧进程停止后执行Start。准备命令只针对独立构造库 `shiwei_business_local`，复用现有角色/001和002，保留原库/卷，不装模型或启用正式健康；默认不启用测试身份。25食材/18菜谱/36变体均为构造测试，营养值不代表真实食物。

配置为 `CONTENT_SOURCE=database`、`CONTENT_RELEASE_ID=local-business-v1`、loopback主机/数据库和本机同源URL；运行连接用shiwei_app只读账号。文件在 `.local-data/deployment/business-local.env`，已有文件不覆盖。`-Release local-business-v2`可显式选择已发布构造版本，不能自动跳到最新版本或复活撤回版本；导入/发布/撤回命令及复现方法见验收报告第6节。

数据库模式未向staging/production开放；正式内容和云应用仍未准入。原构造内存模式保留作回归基线，数据库模式发生故障不会切换到它。

本轮先解决运行配置、空库结构、迁移、向量结构和容器；数据录入及具体模型后置。真实认证/同步、凭证保存、独立撤销日志和正式健康仍未开放，不能仅凭建库成功对外开放真实资料。

## 1. 当前先需要你完成什么

Docker安装和本地初始化已于2026-10-21完成。当前数据库健康运行，PostgreSQL17.11/pgvector0.8.7，共26张表；真实PG测试、应用容器运行和空结构恢复已通过。具体证据见实施记录R05～R08。

云端免费环境 **`shiwei-d2gmiun66b7dc6a4f`** 已通过官方CLI完成空结构部署：上海、PG17.11、库 `postgres-l3nqdxta`（小写l）、vector0.8.2/extensions、26张项目表。原迁移checksum/权限/RLS及回滚式向量约束探针已核验；超限按量/自动续费关闭，到期日2027-04-21，见实施记录R16～R20。历史“未创建/未查询”不再是当前状态。

**当前无需用户手工跑SQL。**用户在Edge完成一次官方CLI授权后，后续检查/迁移已由实施人员执行。原生连接/TLS/最小运行角色、云容器计费、备份与公开入口等仍待完成，见 [CloudBase清单](../deploy/CLOUDBASE-CHECKLIST.md)。若确需本人登录或控制台操作，再给出具体步骤。

当前已在项目内生成本地随机秘密文件、设置 Windows ACL，并保持 Git 忽略。它们位于 `.local-data/deployment/`，不会在记录中输出值。不要删除这些文件来修改密码；数据库初始化后修改文件不会同步更改库内角色密码。

## 2. Docker 就绪后执行的本地步骤

以下命令在仓库根目录运行。首次建库会拉取 PostgreSQL/pgvector 镜像，使用本机资源；不创建云资源。

```powershell
cd 'D:\codex_AI\菜谱推荐\CookDemo'
.\scripts\setup-local.ps1
```

脚本依次：准备/复用本地秘密 → 验证 Linux 引擎 → 启动数据库并等待健康检查 → 执行核心/向量迁移 → 应用运行角色授权 → 用运行角色检查空结构。任何一步失败即停止，保留数据卷，不自动删除数据库或改密码。

实际目标资源：

| 项目 | 值 |
| --- | --- |
| Compose 项目/配置 | `shiwei-local` / `deploy/compose.local.yml`，显式使用仓库根作为 project-directory |
| 开发数据库 | `shiwei_dev` |
| 构造测试数据库 | `shiwei_test_structure`，不得替换为生产库 |
| 数据库镜像 | `pgvector/pgvector:0.8.7-pg17`，已固定实测digest，实际PostgreSQL17.11；摘要见Compose/实施记录 |
| 监听 | 仅本机 `127.0.0.1:5432` |
| 角色 | `postgres` 仅初始化；`shiwei_owner` 迁移；`shiwei_app` 运行，后两者无超级管理员/建库/建角色权限 |
| 持久化 | Docker 命名数据卷；不保存到应用容器 |
| 密码传递 | 本地受控文件 → Docker secrets；不把实际值放进 Compose 或 Git |
| 核心结构 | 23张业务表 + `schema_migrations` |
| 可选向量结构 | `embedding_indexes`、`recipe_variant_embeddings`；空表，不选模型、不编码数据 |

首次初始化脚本只对**新数据卷**执行。若此前手动建过同名数据卷或角色，不能假定新生成的秘密匹配旧密码；停止并核对实际数据/角色，不自动清卷。若5432被占用，统一修改Compose端口和受控URL文件，再检查，不能只改一处。

脚本会自动定位Docker Desktop并将其bin路径加入本进程PATH，以找到新安装的凭证助手；不修改系统环境变量。需要手动启动/停止时可在Docker Desktop中管理 `shiwei-local-db-1`。本机运行库是 `shiwei_dev`，账号 `shiwei_app`，地址 `127.0.0.1:5432`；密码只保存在受控本地文件，不在此文档显示。

只准备配置、暂不建库：

```powershell
.\scripts\setup-local.ps1 -PrepareOnly
```

## 3. 迁移、结构检查和真实 PostgreSQL 验证

```powershell
# 迁移用owner角色；完整向量结构需要实例已提供vector扩展/对应权限。
.\scripts\run.ps1 db:migrate -EnvFile '.local-data/deployment/migration.env' -Vector

# 用应用运行角色检查。
.\scripts\run.ps1 db:check -EnvFile '.local-data/deployment/local.env' -Vector

# 显式真实PG测试，仅使用独立构造测试库。
.\scripts\run.ps1 test:postgres -EnvFile '.local-data/deployment/postgres-test.env'
```

真实PG测试覆盖并行迁移串行化、跨连接资料CAS、并发共享预算、vector维度约束。常规 `test` 使用PGlite的SQL/领域验证，不等价于上述多连接测试。未提供 `RUN_POSTGRES_TESTS=1` 时真实PG测试会跳过，记录时必须注明，不能写为通过。

迁移说明：

- `001-initial.sql` 保留原文；`002-content-structure.sql` 建空公共内容及账户支持结构；`003-vector-structure.sql` 按 `-Vector` 可选执行。
- 迁移在真实PG的一个专用连接/事务中持有事务级advisory lock，应用启动不自动迁移。
- 每个文件记录规范化换行后的SHA-256，重复执行跳过；已应用文件发生改写拒绝执行，修改结构须新增迁移。
- 已有旧001记录但没有checksum时，核对旧库后可显式用 `-AdoptLegacy` 接管。此开关仅接管旧001，不替任意结构漂移背书；先备份，禁止直接改账本绕过。
- 若vector不受支持，仅执行核心迁移，记录向量未完成；不会删除旧表或用别的服务伪装成功。

## 4. 表结构边界

`content_sources` 和 `catalog_release_sources` 管许可/来源关联；`catalog_releases` 关联既有发布清单；`catalog_foods`、别名和关系表保留形态/成分完整性；`catalog_nutrition` 保存每100g可食部分数值及来源记录；菜谱/变体/配料/步骤按发布版本关联。配料为固定整道标准量，不随本餐人数缩放，继承D7-14。

`catalog_search_documents` 提供受控分词后的关键词存储和GIN索引，不宣称已实现中文分词或BM25。向量列采用不限固定维度的 `vector`，通过索引登记与外键/维度检查约束每个索引空间；不预选1024/512等具体模型维度，不创建HNSW。写入必须绑定公共内容版本；个人输入、健康限制和查询向量不持久化。类型与维度说明见[pgvector官方文档](https://github.com/pgvector/pgvector#vector-type)。

当前没有导入器、真实内容发布/读取适配及质量审核；本机默认仍用原构造目录测试，预发布 `CONTENT_SOURCE=pending` 将目录/文字提取/推荐路由置为不可用，不能偷偷退回构造数据。真实内容接入后再单独开发对应读取/规则适配。

## 5. 启动和探针

```powershell
# 不连数据库，继续现有本地构造测试。
.\scripts\run.ps1 build
.\scripts\run.ps1 start

# 数据库建好后，本地带数据库依赖启动。
.\scripts\run.ps1 start -EnvFile '.local-data/deployment/local.env'
```

`-EnvFile` 是本轮加入的显式加载选项，底层使用Node的env-file参数；不加选项仍不自动读取 `.env`。现有终端环境变量优先于文件值，排错时检查是否有遗留配置，但不要打印全量环境/秘密文件。

| 地址 | 200表示什么 | 失败或边界 |
| --- | --- | --- |
| `/healthz` | 进程可以响应 | 不检查数据库或正式能力 |
| `/deploymentz` | 当前配置所需数据库/迁移/可选向量结构可用 | 不表示内容、账户、模型或健康已获准；返回 `releaseReady:false` |
| `/readyz` | 本地构造路径可运行时仍标 `local_only` | 预发布内容后置返回503 `content_pending`；数据库失效返回503；不是上线通过证据 |

本地无数据库的 `/deploymentz` 只反映本地结构模式，不声称数据库已创建。已配置数据库但连接/迁移缺失时，启动失败；运行中数据库故障使结构探针返回503且不输出连接信息。

## 6. 实际配置契约

| 配置 | 当前已支持的行为 |
| --- | --- |
| `APP_ENV` | `local`（默认）、`staging`、`production`；后两者目前仅能运行关闭业务的结构环境 |
| `HOST` / `PORT` | 本地默认loopback/4175；云显式0.0.0.0/8080；local模式拒绝非本机监听 |
| `APP_ORIGIN` | 云模式必填精确HTTPS origin；不含路径/末尾斜杠，不能用本机域名 |
| `LOCAL_TEST_FEATURES` | 仅local且loopback可设1；云模式拒绝 |
| `DATABASE_URL` / `DATABASE_URL_FILE` | 二选一；连接运行库；缺数据库的云环境拒绝启动 |
| `DATABASE_CA_FILE` | 非loopback数据库要求证书CA及URL中 `sslmode=verify-full`；驱动移除冲突URL SSL参数，再显式校验CA/主机名 |
| `DB_POOL_MAX` | 默认4，上限20；增加前核算平台总连接，包含迁移/发布峰值 |
| `DB_CONNECT_TIMEOUT_MS` / `DB_QUERY_TIMEOUT_MS` | 默认5000，范围100～30000 |
| `SESSION_SECRET_B64(_FILE)` / `CSRF_SECRET_B64(_FILE)` | 各自独立32字节随机值的Base64；云模式必填且不可相同 |
| `CONTENT_SOURCE` | `constructed`仅本地；`pending`关闭内容依赖业务；尚不接受 `database`，等待数据读取适配 |
| `DB_REQUIRE_VECTOR` | 0/1；设1时结构探针要求003和vector扩展 |
| `ACCOUNTS_ENABLED` / `MODEL_ENABLED` / `SEMANTIC_SEARCH_ENABLED` / `HEALTH_ENABLED` | 当前只接受0或false；实际接入后再扩展，不用开关伪装已实现 |

容器内访问数据库不是访问自己的127.0.0.1；云URL/CA按实际内网主机配置。本轮没有引入接受任意不校验证书的选项。驱动SSL组合处理依据[node-postgres官方说明](https://node-postgres.com/features/ssl#usage-with-connectionstring)。

## 7. 容器与云端下一步

实际容器配置位于仓库根目录 `Dockerfile`/`.dockerignore`；旧 `docs/deployment/*.example` 为上一轮研究示例，不作为当前操作入口。

```powershell
docker build --platform linux/amd64 -t shiwei:staging .
```

云端前置操作见 [CloudBase清单](../deploy/CLOUDBASE-CHECKLIST.md)，运行配置见 [staging.env.example](../deploy/staging.env.example)。镜像默认staging、非root、端口8080，启动需真实URL/CA/会话秘密。数据库迁移独立执行；可在镜像中通过 `node --import tsx scripts/database.ts migrate --vector` 执行一次性任务，仍需迁移角色与对应配置。

构建镜像未携带本地.env、密码文件、备份或验收图片，当前保留tsx所需依赖，未做生产依赖精简。2026-10-21已在Dockerfile固定实测Node基础镜像digest（Node24.22.0），本地镜像构建/非root运行/数据库连通及探针验证通过；镜像独立扫描、云网络/TLS/公开入口仍属于后续发布步骤。

### 7.1 已落地的CloudBase数据库命令

官方CLI固定3.8.7，位于Git忽略的 `.local-data/tooling/cloudbase-cli`，不加入应用依赖或镜像。新机器准备时使用Node24并安装：

```powershell
npm install --prefix .local-data/tooling/cloudbase-cli --ignore-scripts --save-exact --no-audit --no-fund @cloudbase/cli@3.8.7
.\scripts\cloudbase.ps1 -Task Login
```

Login使用官方设备码；本人在Edge确认即可，CLI登录态由官方工具管理，不能复制到源码/前端/备份。当前机器已授权，无需重复登录。依据为 [官方CLI登录说明](https://docs.cloudbase.net/cli-v1/install)。

```powershell
# 默认只读；绑定当前环境/地域并核验免费套餐/禁止按量/不自动续费。
.\scripts\cloudbase.ps1 -Task Inspect
.\scripts\cloudbase.ps1 -Task Capabilities
.\scripts\cloudbase.ps1 -Task History
.\scripts\cloudbase.ps1 -Task Plan

# 仅在存在已审阅的新数据库迁移时执行；不创建云容器。
.\scripts\cloudbase.ps1 -Task Apply

# 只生成/核对不可改写的已落地迁移，不执行云SQL。
.\scripts\run.ps1 db:cloudbase:prepare

# 显式本机Docker隔离预演，随机测试库/角色自动清理；不访问云库。
$env:RUN_DOCKER_CLOUDBASE_TESTS='1'
.\scripts\run.ps1 test:cloudbase
```

原001～003仍是源文件。CloudBase的两条SQL将它们包装在同一条DO的原子事务中，保留advisory lock和原checksum，追加仅针对项目的ACL/RLS防护；先核心后向量，官方历史与应用账本分别记录。CLI迁移行为见 [官方PG命令](https://docs.cloudbase.net/cli-v1/db/postgresql/management)。生成器发现已有文件变化就拒绝覆盖；已应用后变更须新建版本。

云端初始默认ACL会开放public新表给客户端，因此不能直接用本地全public授权脚本。当前26表已开启RLS，客户端对表/序列无有效权限，当前迁移角色的public新表/序列默认授权已回收；没有给客户端创建读写策略。管理角色有BYPASSRLS，不能把它作为正式应用运行账号。完整 [云端验收证据](../acceptance/cloudbase-structure-2026-10-21/verification.json)与剩余运行连接条件分开追踪。

Capabilities只读核验底层实例网络、SSL、账号和备份计划。当前实例详情查询成功，jnsgw网关条目存在，public入口initing/无地址端口；后三项被当前授权拒绝，输出unknown和错误码。未知不当作SSL关闭或备份不存在；未自动扩权、开公网、重置密码。依据为 [实例详情API](https://cloud.tencent.com/document/api/409/16772)、[SSL查询API](https://cloud.tencent.com/document/product/409/116172)和 [备份计划API](https://cloud.tencent.com/document/api/409/68069)。

## 8. 空结构备份/恢复试跑

### 8.1 当前推荐：加密结构归档

在Windows、本机Docker数据库启动时执行：

```powershell
# 创建新加密归档，并在随机隔离库验证恢复。
.\scripts\backup-encrypted.ps1 -VerifyRestore

# 已有归档单独恢复演练：把路径替换成上一步输出的archive。
.\scripts\backup-encrypted.ps1 -Archive '.local-data/encrypted-backups/shiwei-empty-日期-随机ID.swbk'
```

脚本固定本项目容器，不接受远端Docker；新归档前核验所有项目业务表为空和三个源checksum。密钥首次随机生成，已有文件不覆盖，位于 `.local-data/backup-keys/local-structure-v1.b64`；与 `.local-data/encrypted-backups/` 分开，两个目录及临时恢复目录均由包装脚本先设置Windows ACL。不要直接调用TS脚本或把密钥提交Git/发到聊天/打包进归档；已有归档恢复不会重新生成丢失的密钥。

归档采用版本化AES-256-GCM外层，随机nonce、头部作为AAD绑定用途/时间/库名/源checksum；pg_dump结构流直接加密，不在备份阶段保存明文dump。恢复先校验格式、密钥及认证标签，再把经认证的临时dump交给pg_restore。归档与目标均不覆盖已有文件；调用必须等待完成，文件复制不是原子发布。恢复临时文件受ACL保护，仅进入随机隔离库，用完清理，不切换原库或开放服务。

导出固定schema-only，**不备份业务数据**。三行迁移账本从归档认证元数据与本地原始001～003核对后重建；恢复26表/3版本/零业务行通过，只能证明本地空结构可恢复。已有归档演练不依赖shiwei_dev在线数据，但需要同一版本源码、密钥、Docker和vector扩展。源版本不同则拒绝，不能直接改checksum绕过。

归档使用no-owner/no-privileges，隔离库不恢复源角色或ACL；实际接入前须重新执行对应环境的最小授权并验证。本工具不会执行这一步，也不会把隔离恢复库自动作为运行数据库。

当前密钥和归档仍在同一电脑；尚未安排独立介质保管、每日任务或七天轮换，也没有云业务/认证/最新撤销记录备份。用户开始保存真实资料前再落实完整恢复，不把这个命令当作全系统灾备。每次生成受控本地回执；脱敏实测见 [本轮证据](../acceptance/prelaunch-operations-2026-10-21/encrypted-restore.json)。

### 8.2 历史明文空结构工具

```powershell
.\scripts\backup-local.ps1 -VerifyRestore
```

该工具只允许开发库中无账户、无公共内容时执行，生成 `.local-data/backups/` 的归档/校验回执，并创建本次专用 `shiwei_restore_<随机ID>` 隔离库验证后清理。它不替代含真实资料的外层加密备份、七天自动轮换、托管认证与密钥恢复、独立最新撤销记录及24小时RPO/RTO演练。真实资料进入前必须先完成这些事项；当前S09保持部分完成。

此命令及旧归档是先前空库实验记录。后续结构归档优先使用8.1；旧明文文件没有自动转换或删除。

2026-10-21实际演练已通过，核对26张表和三个迁移版本。恢复前预装vector，并从归档目录中仅排除重复创建public schema的项，避免新库默认schema冲突；不删除原业务schema或原数据库。

## 9. 记录规则

每完成一步，在实施记录中写：日期、资源/文件、实际命令、结果、证据路径和剩余问题。资源未创建、命令跳过、仅PGlite验证、仅静态检查、数据/模型后置均分别标记。不得记录密码/Key或完整环境；跨聊天继续以该记录为入口，避免重复建环境或覆盖已有数据。

## 10. 本地新版工作台与独立图鉴（2026-10-22～23）

当前新版预览入口为 http://127.0.0.1:4176/ ，图鉴为 http://127.0.0.1:4176/recipes 。使用既有Docker和隔离库，启动：

```powershell
.\scripts\business-local.ps1 -Task Start -Release local-business-ui-v2 -Port 4176
npm run test:ui:e2e
```

测试命令使用独立配置，不自动建立或替换数据库服务。若需回退，先在对应终端Ctrl+C，再以同一命令指定 `-Release local-business-v1`；旧版本保留，不删除数据库和卷。旧4180服务未替换，不用它核验新版口味与调料。新版仍是构造推荐目录，候选库139条未发布；详细状态见[本轮验收](ACCEPTANCE-ui-revision-2026-10-22.md)。

## 11. 持续推进的执行边界与复现（2026-10-23）

真实来源版本 `local-business-community-v1` 的3道菜及测试已备好，自动审批在导入／发布前拒绝操作。等待用户明确解除历史后置限制；不要执行Prepare／Import／Publish、改配置直读草稿或换工具绕过。当前4176仍选 `local-business-ui-v2`。

可继续执行的只读核验和候选图片更新：

```powershell
.\scripts\recipe-candidates-local.ps1 -Task Import
.\scripts\recipe-candidates-local.ps1 -Task Inspect
```

Import仅限已授权本机候选批次，R39快照为147条、145道、78道配图及9条规范展示修订，全部待审核；原139条与增补8条分批保存。持续数量以Inspect和[配图进度](recipes/image-progress.md)为准。它不是正式内容发布器；Inspect中的旧catalog统计针对v1，不代表4176当前v2的34变体。图片提示词与原始资产保存在docs/data及public/assets/recipes，不写入云端。

新增图片后，先使用已安装的sharp离线执行 `scripts/optimize-recipe-images.mjs` 生成同名WebP及[进度表](recipes/image-progress.md)，再构建客户端、Import／Inspect候选和验证应用账号读取。工具不自动安装依赖或调用API；若sharp不在项目模块路径，可用 `SHARP_PACKAGE_PATH` 指定已安装包。原PNG保留；不需要为图片更新发布正式菜谱版本。

云端接下来的依赖依次为：零账单运行准入 → 原生PG连接／CA／最小运行角色 → 审核内容生产读取 → 同源HTTPS与公开入口 → 公网主流程／故障／回退验收。当前前两项阻塞，后续未执行；不通过关闭生产保护或公开本机测试入口跳步。

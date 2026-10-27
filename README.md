# 拾味 · 本地开发版与历史 UI Demo

> 2026-10-27 D19-03：模型现暂定DeepSeek；健康RAG以疾病—成分影响—食材/烹调物质—定性食材指导—菜品推荐为目标，不普遍要求精确量。详见[最新RAG方案](docs/technical/health-rag-plan.md)和[模型入口](docs/HEALTH-MODEL-API.md)；此前“供应商未指定”为历史状态。

2026-10-27：健康模型接口准备、配置及已测边界见 [模型入口](docs/HEALTH-MODEL-API.md)；疾病—成分—食材—烹调过程的切片、召回、向量存储和技术取舍见 [健康RAG方案](docs/technical/health-rag-plan.md)。供应商未指定，接口默认关闭；下文带日期状态为历史快照，当前规则以 [AGENTS.md](AGENTS.md) 及后续决策为准。

2026-10-23：[免费腾讯云预览入口](https://shiwei-d2gmiun66b7dc6a4f-1512010497.ap-shanghai.app.tcloudbase.com/)已上线，首次点击平台“确定访问”。[验收记录](docs/ACCEPTANCE-cloudbase-http-2026-10-23.md) · [更新/撤回手册](docs/DEPLOYMENT-CLOUDBASE-HTTP.md)。

## 当前：本地数据库业务链路

2026-10-21已接通本机React/Fastify/PostgreSQL构造业务版：[打开本地业务页面](http://127.0.0.1:4180/)。25食材、18菜谱、36变体；可验证导入/发布/读取、饮食过滤、固定配方用量、步骤/营养/变体、收藏复查和版本回退。正式数据、模型、真实认证/同步和健康建议未接通；本阶段暂停云部署及备份扩展。

```powershell
.\scripts\run.ps1 build
.\scripts\business-local.ps1 -Task Prepare
.\scripts\business-local.ps1 -Task Start
```

详细审查、必要修改/可推迟优化、使用和复跑命令、失败修复及剩余缺口见 [本地业务链路验收报告](docs/ACCEPTANCE-local-business.md)。本轮常规66项、真实PG7项（含父项）、数据库浏览器8项及原回归32项通过。下面4175入口保留为内存构造回归模式，不能用它冒充数据库业务版。

真实菜谱录入前见 [菜品与完整做法目录](docs/RECIPE-SOURCE-RESEARCH.md)：364道不同菜品、392份完整文字流程，另6份缺项；按较权威／待验证、荤菜／蔬菜豆蛋／汤分册，包含大厨来源核验、同味方法参考与未完成项。目前仅文档候选，未录入或发布；来源未定量不补造克重。

2026-10-19 新增 React/TypeScript/Vite + Fastify 正式工程与 PostgreSQL 机制测试。旧 `dist/` 原型及线上 Demo 保留，不覆盖历史审查证据。

```powershell
.\scripts\run.ps1 install
.\scripts\run.ps1 build
.\scripts\run.ps1 start
# 打开 http://127.0.0.1:4175
```

使用 Node.js 24 LTS；启动脚本可使用已安装的 Codex Node 24。当前本地版提供输入确认、推荐、换菜、真实配方口味变体、本机收藏及草稿/默认/演示隔离。内容为 17 道构造菜谱，图片模型、真实账户、云同步、正式营养和健康支持未准入，不模拟成功。

开发、复跑测试与剩余门槛见 [DEVELOPMENT.md](docs/DEVELOPMENT.md)，验收范围及证据见 [ACCEPTANCE-v0.1.md](docs/ACCEPTANCE-v0.1.md)。**下面原有 Cloudflare 说明只适用于历史 dist 静态原型，不能用于发布新后端。**

数据库/向量库、云端、AI、账户与备份的选型、配置、部署顺序及待开发缺口，见 [从 Demo 到落地部署手册](docs/DEPLOYMENT-GUIDE.md)。附本地 PostgreSQL Compose 和应用容器模板；云与模型仍待准入，模板不表示已经部署。

2026-10-21 上线结构已推进到云数据库：上海CloudBase免费环境的PG17.11、26张空表、pgvector0.8.2及项目权限隔离已部署并验证；云应用尚未部署。当前命令见 [结构操作手册](docs/DEPLOYMENT-RUNBOOK.md)，逐项完成/待做及证据见 [实施记录](docs/DEPLOYMENT-STATUS.md)。配置使用根目录 `Dockerfile`、`deploy/` 与 `cloudbase/migrations/`；正式数据和具体模型按用户要求后置。

同日继续完成本机加密空结构归档与已有归档恢复（26表/3版本），62项常规测试通过；云端原生连接/最小账号、容器零账单及完整恢复仍待落实。本轮能力与恢复证据另存 `acceptance/prelaunch-operations-2026-10-21/`，未覆盖此前部署快照。

后续按用户要求沿用原 UI Demo 的界面，调整记录及20项桌面/手机回归见 [UI-DEMO-ALIGNMENT.md](docs/UI-DEMO-ALIGNMENT.md)。

## 历史 UI Demo

手机优先的浏览器原型，原生 HTML / CSS / JavaScript，无需安装依赖或配置 API 密钥。

## Cloudflare 从 GitHub 部署

仓库：<https://github.com/pxifer/CookDemo>

线上地址：<https://cookdemo.pages.dev/>（用户已确认部署成功）。

推荐使用 **Cloudflare Pages → 导入 Git 仓库**，选择 `pxifer/CookDemo`：

| 设置 | 值 |
| --- | --- |
| 生产分支 | `main` |
| 框架预设 | `None` / 无 |
| 根目录 | 仓库根目录，留空即可 |
| 构建命令 | `exit 0` |
| 构建输出目录 | `dist` |
| 环境变量 | 无需设置 |

`dist/index.html` 已是可以直接部署的入口，无需 `npm install`、`npm run build` 或后端服务。

如果你选择 **Workers** 而不是 Pages，可使用仓库内的 `wrangler.workers.jsonc`。两种入口的详细步骤见 [CLOUDFLARE.md](CLOUDFLARE.md)。

## 本地预览

在本目录运行：

```powershell
python -m http.server 4174 --bind 127.0.0.1 --directory dist
```

浏览器打开 http://127.0.0.1:4174 。也可直接打开 `dist/index.html`；浏览器对 file 地址的本地保存策略可能不同。

## 建议体验顺序

1. 点“用示例食材试一试”，核对食材，生成三道菜。
2. 尝试单道替换、整套重推、切换口味、荤素汤数量和多菜候选分页。
3. 查看做法并收藏，使用无需填写信息的演示账户。
4. 打开健康模式，列表选择或输入“高血压病”，确认标准名称后应用。
5. 在健康模式详情中查看营养及“依据说明”占位。
6. 用底部“体验实验室”切换缺料、过敏、识别失败、未支持疾病和冲突场景。
7. 修改个人设置，刷新验证本地保存；通过“重置 Demo”清除演示数据。

## 真实与模拟的边界

- 24道固定菜谱：16道家常菜、8道特色或创意菜。过敏、口味、主料、调料库存和常见数字用量会影响候选。
- 默认套餐先选择可行的三菜组合，指定组合或库存不足时减少菜数。库存数量可按 g、克、kg、千克、公斤、斤、个、ml、毫升核对，并累计套餐内重复食材；其他表述仅展示，不假装已核实够量。
- “不检查调味料库存”只跳过库存匹配，不取消过敏忌口。
- 上传图片只生成本地预览并载入固定示例清单，不上传、不分析实际图片，不长期保存。拍照入口由手机浏览器支持程度决定，不支持时可选图或文字输入。
- 登录是本地演示状态，不注册、不跨设备同步。只保存设置和收藏菜谱 ID，不记录完整推荐历史。
- 健康筛选仅使用预置演示标签。疾病列表、别名匹配、未支持反馈和冲突流程都不代表医学能力。没有真实健康结论或引用。
- 卡片采用3张本地 AI 食物示意图，不是24道菜的逐道成品实拍。
- 页面字体可从 Google Fonts 加载；网络不可用时使用系统中文字体。除此以外不依赖外部资源。
- 演示套餐最多6道菜，就餐人数1–12人。这是原型交互默认值，不是已确认的正式产品上限。
- 未添加站内满意度问卷或任何跟踪分析。

## 文件说明

- `dist/index.html`：页面结构。
- `dist/styles.css`：响应式样式。
- `dist/data.js`：24道菜谱和示例词表。
- `dist/engine.js`：纯模拟筛选、组合、用量规则。
- `dist/app.js`：页面交互及浏览器本地保存。
- `dist/assets/`：项目内的食物示意图，生成说明见 `ASSETS.md`。

## 规则检查

```powershell
node smoke-test.cjs
```

覆盖菜谱数量、文字解析、默认可行组合、荤素分类、过敏排除、成分不明、他人限制主动合并、口味、调味料、食材不足、人数、整餐食材复用及重新推荐差异。

本仓库为独立的静态站点源码，不依赖原演示托管平台。Cloudflare 只需托管 `dist` 中的文件。

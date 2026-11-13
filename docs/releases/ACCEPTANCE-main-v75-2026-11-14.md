# main-v75：用量不再进入食材名（源头修复）

2026-11-14。本地完成，**未部署、未推送**。

## 根因（修正 v74 的判断）

v74 把问题当作"展示层出现了脏词"。实际是**构建期把用量写进了食材名通道**：

1. `scripts/build-recipe-1000.ts` 把「食材名」和「用量」拼成一行 `${name} ${weight}`，再交给按空格/标点切分的解析器，用量列因此被当成独立食材；
2. 调料串是没有分隔符的整串（`大蒜几瓣`、`姜一小块`、`油一汤匙`、`盐1/2小匙`），解析器只在"数字 + 白名单单位"时剥离，`几/数/点/大块/棵/朵/节/盒/汤匙` 等一律漏网；
3. `1/2小匙` 的分数斜杠被当作"或"分隔，切出 `2小匙`；
4. 词表最长匹配会把 `蒜瓣` 拆成 `蒜` + `瓣`，碎片没有被同一套规则拦下。

脏名不是从做法正文捞出来的，而是从**用量字段**漏进来的；共 19 个，分布在 20 行。

## 修正

- **结构化来源**：`listedIngredients` 接受 `{name, amount}`，用量不再进入名称通道；`sourceIngredients` 拆成 `mergeSourceIngredients`（切分）+ 解析，避免二次解析拼接文本。
- **用量剥离**：阿拉伯数字后整段丢弃（`15ml`、`2.0支`、`1份`）；中文数字仍要求可识别量词，`三文鱼/五花肉/二荆条/八角/千张` 不会被切断；`姜一块啊` 这类尾字也能剥掉。
- **分数不拆分**：仅当斜杠两侧不同时是数字时才作为"或"处理。
- **同一把尺子**：解析入口、词表切分、展示层都用 `isInvalidFoodName`，不再各写一套。
- **修 v74 误伤**：`千张`（豆腐皮）曾被当成"千 + 张"删除，现列入 `amountLookalikeFoods` 白名单；`百叶/八角/二荆条/十三香` 同理。

## 边界

- **341 道基础包冻结**：其 `瓣` 一行（辣椒炒肉片）属于已审核原文，按测试要求逐字节保留，由下拉过滤（已能挡住）。`verifyGalleryBundle` 的基础包 deepEqual 断言仍通过。
- 本轮只改内容与解析，未改 UI 代码，未做浏览器回归。
- 新内容版本 `gallery-listed-foods-1000-20261114-v2`，hash `ffc8388d54a1fecb3da994b3403985b128db4dd8cbe0e54d40a30146fbd5e59e`。**已发布**（见下节）。

## 发布（2026-11-14 02:17）

发布链路此前是断的，本轮一并修复（详见[部署手册](../operations/DEPLOYMENT-CLOUDBASE-HTTP.md)）：

- 13 个发布脚本引用了不存在的 `@deployment/cloudbase/cli`，实际安装为官方 `@cloudbase/cli` 3.8.7；已全部改正。
- `tcb db pg migration up` 会把本地全部迁移一起上传（当前 13.6MB），超过 API 10MiB 上限；只带新迁移又被 15 条历史冲突挡住。约 5MB 的内容行改为进程内调用同一 CLI 的 `db execute`（端点/角色/凭证不变，只绕开操作系统参数长度限制）。
- 新增 `scripts/prepare-content-release.ts` 与 `scripts/publish-content-release.ts`，把打包与"先内容行、再函数"的顺序固化为可审查命令。

执行结果：

1. 内容行已写入并校验：`release_id=gallery-listed-foods-1000-20261114-v2`，`checksum` 与 manifest 一致，`published=true`；旧 v1 行保留未改。
2. 函数 `shiwei-http-preview` 已部署：`Nodejs24.11`、`Timeout=60`、`CONTENT_BUNDLE_ID/CONTENT_BUNDLE_SHA256` 指向 v2。
3. 只读核对：`/healthz` 200；`/readyz` 200 且 `contentVersion=gallery-listed-foods-1000-20261114-v2`；首页 `index-BwIUTq3Y.js`、`index-MiMYkjjf.css` 与本地产物一致。
4. 真实接口核验 `/api/v1/catalog/recipes`：1000 道、1116 个食品名，19 个脏名全部消失，`千张` 在位；`家常烤鱼`、`黄豆粉菠菜汤`、`焗烤豆腐` 的配料行已正确（用量留在展示文本，如 `鱼段 一大块`、`菠菜 几颗`）。

发布期间环境曾开启超额计费（`EnableOverrun=true`），脚本按设计拒绝执行；用户关闭后继续，未绕过守卫。

## 验证

- 结构化 diff（相对 HEAD 重建基线）：`changedRecipes=20`，删除的 19 个食品名全部是脏词，无新增脏名；`甜酒酿` 的角色变化经确认属于历史代码漂移（`isSeasoningFood` 含该名），与本改动无关。
- 下拉分组离线验证：407 项，脏词 0，`千张` 回到「豆制品」。
- 单元 `419` / `416` 通过 / `1` 失败 / `2` 跳过；唯一失败是 `离线原件重建` 用默认 `python`（3.14）触发 `PYTHON_311_REQUIRED`，改用 3.11 后 6/6 通过——环境问题，非本改动。
- `npm run build`（生成校验器 + `tsc --noEmit` + Vite）通过。
- 未调用真实模型。

# main-v93：补买清单按食材/调料分块展示

2026-11-15。只发代码，内容版本不变（仍 `gallery-listed-foods-1000-20261114-v3`）。

## 变更

上一版只在同一列表里加了“食材 / 调料”小标题，视觉上仍是一条连续清单。本次改为真正的分块：

- “食材”和“调料”各自一个带边框、圆角、浅色底的卡片；
- 每块标题右侧显示该项数量（如“食材 4 项”“调料 9 项”）；
- 两块之间留间距，不再共用同一条虚线列表；
- 单菜“补买 N 项”弹层与整餐“本餐补买清单”使用同一套分块。

## 发布

| 项 | 值 |
|---|---|
| 函数 | `shiwei-http-preview`（上海，HTTP 函数） |
| 环境 | `shiwei-d2gmiun66b7dc6a4f` |
| 运行时 / 超时 | Nodejs24.11 / 60s |
| 发布包 | `.local-data/cloudbase-http/release-20261115-main-v93` |
| 提交 | `df67ebf` |
| 前端产物 | `index-CWwng8N8.js` / `index-B7XHbuBe.css` |
| 内容版本 | `gallery-listed-foods-1000-20261114-v3`（未改） |

## 验证

- `tsc --noEmit`、`npm run build` 通过。
- 线上：`/healthz` 200、`/readyz` 200；首页引用 `index-CWwng8N8.js`；线上 JS/CSS 含 `shopping-section` 分块样式。
- 分流与数量规则测试（8 项）保持通过：调料独立成组、姜/姜片合并、同单位求和、不同单位分开、未注明用量提示。

## 未做

- 视觉仍未实测（本机 Edge 无法建立自动化连接、Chrome 安装损坏）；本次是纯 CSS/结构改动。
- 健康模式真实模型未调用。

## 回滚

保留 `release-20261115-main-v92`，重新部署同名函数即可回退。

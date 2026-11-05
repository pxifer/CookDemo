# 收藏反馈及本机登录、健康流程验收

日期：2026-10-20（Asia/Shanghai）。依据：用户两张收藏截图、登录/健康要求，以及“暂时未上线，只是开放给我测试”的明确范围。追踪 D7-08～09，原 PRD 未修改。

## 完成结果

- 详情收藏从固定文字改成“收藏此口味/已收藏·点击取消”，搭配空心/实心 SVG 和即时状态提示。详情与卡片同步，刷新后保留收藏及口味。
- 卡片收藏使用深绿色描边，选中为深红色实心；详情底部操作保持可见，桌面与手机检查提示完整落在弹窗内。
- 显式开启 `LOCAL_TEST_FEATURES=1` 后可使用本机测试账号。右上角“我”进入登录，或从健康入口登录并开启；不需要密码、不连接正式认证服务。
- 健康设置支持名称输入、标签选择、开关及推荐流程。点击标签保留正在输入的名称；健康结果常驻提示尚未按疾病规则筛选。过敏、忌口和库存规则继续生效。
- 刷新保持有效测试会话；退出撤销会话、关闭健康模式，保留食材和本机收藏。测试会话绑定游客、HttpOnly/SameSite=Strict、30 分钟失效，重启不保留。

## 验证

| 项目 | 结果 |
| --- | --- |
| `./scripts/run.ps1 build` | 通过：运行时校验器、TypeScript、Vite |
| `./scripts/run.ps1 test` | 42/42 通过，新增测试覆盖默认关闭、显式登录、游客绑定、退出撤销、未登录健康拒绝及硬限制保留 |
| `ACCEPTANCE_DIR=acceptance/favorites-health ./scripts/run.ps1 test:e2e` | 26/26 通过，桌面 13、手机 13，最终 41.2 秒，含新增收藏反馈/持久化、健康登录/刷新/退出流程 |
| `node smoke-test.cjs` | 通过：24 个原型样例及规则冒烟；原 `legacy/prototype` 保留 |
| `git diff --check` | 通过，仅 Git 换行规范提示 |
| 原 PRD SHA256 | 保持 `54C26CABF13DD61F7D215FCBFE236F88ADA6DCD49DA540E92A5458AF44F92E30` |

浏览器还回归了录入、单位、数量冲突、过敏/忌口、同行人主动合并、补买翻页、调料、偏好、换菜/变体、非法人数、晚到结果/断流、焦点、横向溢出和多页面冲突。视觉检查发现手机收藏提示被弹窗边缘裁切，修正底部定位并增加提示边界断言后重跑完整浏览器套件。

## 证据及限制

- [浏览器结构化结果](../../artifacts/acceptance/favorites-health/browser-results.json)
- [桌面收藏详情](../../artifacts/acceptance/favorites-health/desktop-favorite-detail.png)、[桌面卡片](../../artifacts/acceptance/favorites-health/desktop-favorite-card.png)、[桌面健康流程](../../artifacts/acceptance/favorites-health/desktop-health-test.png)
- [手机收藏详情](../../artifacts/acceptance/favorites-health/mobile-favorite-detail.png)、[手机卡片](../../artifacts/acceptance/favorites-health/mobile-favorite-card.png)、[手机健康流程](../../artifacts/acceptance/favorites-health/mobile-health-test.png)
- [源码指纹](../../artifacts/acceptance/favorites-health/source-manifest.json)、[OpenAPI](../../artifacts/acceptance/favorites-health/openapi.json)

本轮是本机测试流程验收。没有上线、收费调用、真实 CloudBase 认证、账户同步、健康规则审核或疾病适宜性验证。17 道构造内容及营养缺项不因本轮调整变成正式内容。服务默认不开测试身份；G-01、G-04、G-06 继续有效。历史 `legacy/prototype`、PRD 和旧验收材料保留；变更尚未提交或推送。

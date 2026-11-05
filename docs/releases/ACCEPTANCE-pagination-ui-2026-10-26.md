# 分页定位与响应优化

日期：2026-10-26（Asia/Shanghai）。依据用户本轮三项反馈与D18-04。

工作台上一页/下一页在新结果提交、加载提示移除后立即定位第一行菜卡，顶部保留16px。菜谱图鉴上下页也在布局阶段直接定位首行，取消继承全局平滑滚动。焦点移动均禁用自动滚动，详情打开/返回的历史位置恢复继续保留。

工作台的候选排序改为每请求预计算食材匹配分数、复用单菜随机排名，父菜谱顺序去重采用Map。每次请求继续完整检查库存、饮食要求和发布状态，没有跨请求个人结果缓存。

## 验证

构建、严格TypeScript及69项相关测试通过。用修改前HEAD引擎对照24组输入/饮食限制/前后页场景，菜序、变体、总数、游标及库存明细一致。

相同六食材样本，本地上一页计算由约100～104ms降至29～33ms，约减少70%；线上修复前上一页样本总耗时604ms，其中计算336ms。线上修复后顺序复测上一页总耗时510ms、计算164ms，分别比该修复前样本减少约16%和51%。耗时受运行环境和网络影响，不表示所有请求均有相同耗时；并行验证期间样本另存，未用于该顺序对照。

桌面1440×1000及手机390×844，在正常动效下分别检查工作台、图鉴上下页。首帧及连续3帧首行均位于约16px，只有instant定位调用，没有smooth；返回上一页保持原菜序。

[本地分页结果](../../artifacts/acceptance/pagination-ui-2026-10-26/local/verification.json)、[引擎对照](../../artifacts/acceptance/pagination-ui-2026-10-26/engine-parity.json)、[修复前耗时](../../artifacts/acceptance/pagination-ui-2026-10-26/performance-before.json)、[本地修复后耗时](../../artifacts/acceptance/pagination-ui-2026-10-26/performance-after-local.json)。

## 发布

v31已部署到既有CloudBase函数，免费环境禁超额/禁自动续费检查通过。账户与内容配置字节不变，无数据库迁移。线上JS为 `/assets/index-CfmtTBQd.js`，与已测试构建一致，状态 `preview_ready`。

线上桌面/手机的工作台与图鉴上下页均通过首帧及连续3帧约16px、instant且无smooth验证。返回上一页菜序相同。线上工作台上一页交互样本约900ms（包括浏览器点击、网络和渲染），图鉴上一页约97～166ms；不把接口计算时间冒充完整交互耗时。

[线上分页验证](../../artifacts/acceptance/pagination-ui-2026-10-26/live/verification.json)、[顺序接口耗时](../../artifacts/acceptance/pagination-ui-2026-10-26/live/performance-after.json)、[部署核对](../../artifacts/acceptance/pagination-ui-2026-10-26/live/deployment.json)、[桌面首行位置](../../artifacts/acceptance/pagination-ui-2026-10-26/live/desktop-workspace-first-row.png)、[手机图鉴位置](../../artifacts/acceptance/pagination-ui-2026-10-26/live/mobile-library-first-row.png)。

上轮界面功能本地复核通过，结果保存在[回归验证](../../artifacts/acceptance/pagination-ui-2026-10-26/regression-local/verification.json)。线上验证脚本最终直接检查页面渲染、首帧与滚动调用，不等待云端流式连接的调试协议结束事件。上轮完整测试已知14项历史失败，本轮未涉及相应旧候选接口/成分审批指纹。

# RAG-007：工程与面试手册核对

日期2026-11-12；实现事实基线 `bfa1567ccb43ca02e2a42f75c57e521a250d105d`。范围仅文档、离线阅读器及教学小脚本，不修改应用、数据库、知识包、向量或部署。

- [交付入口](../../../agent-design/docs/interview/README.md)、[阅读器](../../../agent-design/docs/interview/reader.html)、[来源清单](../../../agent-design/docs/interview/source-manifest.json)。
- [机器核对摘要](verification.json)：112连续唯一题号；14份Markdown中的942个本地链接、746个显式锚点链接无缺失；阅读器内部链接无缺失/重复ID；AGENTS为102行。
- 本地原HTML的91个Agent标题（90题＋追问链）、18个AI实操标题、45个项目专题标题与对应原Markdown全部匹配。四份外部原件hash保持，不改写2026-10-28旧快照。
- 公开资料：17条note/196张图片完成离线OCR与主题筛选；主页显示18作品，1项没有公开链接未核对。OCR仍待人工逐字复核，完整原图/OCR不入Git；只提交来源、图片hash和范围说明。
- `render.py`重建前后HTML hash一致；`exercises.py`离线运行完成。构造两题各模式Recall@2=1、MRR=0.75，JSON正常/围栏/截断/重复键/目录外ID示例符合演示预期；**不是新的项目质量对比**。
- Playwright验证1440×1000桌面、390×844手机，目视首页/问答/图示；手机page/client均375 CSS px，无整页横溢。搜索RRF（11题）、RRF 60（6题）、Q112（1题）、空结果恢复、问答展开/折叠、目录及E02来源跳转可用。附录9张表保留模型revision和切块参数，控制台0错误。
- 审核修正了阅读器空搜索恢复状态；重新加载后验证通过。首次沙箱临时HTTP服务无法使用套接字，改为仅绑定回环的只读手册目录服务完成检查；不访问菜谱API/Key/模型。

生成命令：`python agent-design/docs/interview/render.py`；教学命令：`python agent-design/docs/interview/exercises.py`。实际使用已存在的Python运行时，没有安装依赖。链接/hash核对使用本地只读脚本与已有lxml，原始截图和核对过程保存在忽略目录 `.local-data/interview-sources/`。

依据AGENTS纯文档检查范围，本次不重新运行应用构建/全量单元、PG或模型验收；历史指标和失败样例均注明原日期，不伪称本次复跑。无新增付费生成/Embedding推理、专业评测或云端测试，原预算未重开。

回退：仅移除本任务新增手册/本验收目录及新增导航、任务登记文本；不恢复或改动业务/数据。通过独立任务分支本地提交，交管理审核；不自行合并main、不恢复已取消的定时任务。

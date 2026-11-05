# 数据集与来源

| 位置 | 内容与边界 |
| --- | --- |
| [recipes/](recipes/README.md) | 菜谱来源登记、正式运行所需快照与导航数据 |
| `recipes/sources/` | 原始菜谱文稿和来源核对材料，保留溯源依据 |
| `recipes/curation/` | 从原文档目录迁入的整理、审查、步骤及图片映射 JSON/JSONL；部分是前后端运行依赖 |
| [health/](health/README-v2.md) | 版本化公共研究知识、schema 与不可变 manifest，不保存个人健康资料 |
| `evaluation/` | 评测候选、开发数据及审核信息；候选不等于独立冻结评测 |
| `release/` | 发布范围与门禁输入 |

移动版本数据不改变字节内容、ID、hash、来源或审核状态。来源原件不能仅因“旧”“体积大”而删除；临时下载缓存见 `artifacts/tmp/health-sources/`，离线重建前仍需核对来源与校验值。

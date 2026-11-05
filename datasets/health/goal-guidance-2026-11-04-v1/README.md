# 减脂 / 增肌定性目标研究资料 v1

状态：本地研究，专业审核待完成，`clinicalRelease:null`。2个目标、5条事实、4条支持/限定原文短摘；目标与疾病实体分开，不写个人档案或摄入处方。

| 来源 | 本轮整理范围 | 原件与定位 |
| --- | --- | --- |
| [国家卫健委《体重管理指导原则（2024年版）》](https://www.nhc.gov.cn/wjw/ylyjs/202412/b3d40e0141834897808ce6c9dce76a60.shtml) | 少高糖方向、优先蒸煮、少煎炸；添加白糖提示标为项目解释，不认定整菜高糖 | PDF第10页；原件hash及规范化摘录位置见knowledge/manifest |
| [ISSN 2017 protein and exercise立场文件](https://pmc.ncbi.nlm.nih.gov/articles/PMC5477153/) | 健康成年、抗阻训练的窄范围，鸡蛋/牛肉作为膳食蛋白来源候选；保留健康运动人群限定原文 | HTML规范化位置、章节、来源hash、原文span hash |

资料包含来源ID、版本、URL、原件hash、原文、定位、稳定fact/object/topic ID、方向、人群条件、支持与限定证据、直接陈述或项目解释。出处与hash可回查不等于结论已独立专业审核。

本轮不整理数值蛋白摄入量、能量缺口、疾病并发增肌处方、食材治疗作用或整菜营养保证。“含白糖”只作配料少选提醒，不推定含糖量；蒸煮取实际主做法，不能用备选做法或菜名代替。

原件缓存位于 Git忽略的 `.local-data/rag-business/sources/`，不复制完整来源到公共数据集。复建脚本 [build-goal-guidance.py](../../../scripts/build-goal-guidance.py)只读本地原件，无网络/模型调用；本机隔离Python3.11环境使用pypdf6.21.4，实际锁文件在 `.local-data/rag-business/parser-requirements.txt`。HTML当前仅按解析器取文字及空白规范化，不宣称完成自动正文识别、表格或OCR治理。

```powershell
.\.local-data\rag-business\parser\Scripts\python.exe -X utf8 scripts/build-goal-guidance.py
.\scripts\run.ps1 rag:business:evaluate -TaskArguments @('--pg','--gallery')
```

同知识ID内容变化会拒绝覆盖，纠错需新版本；已建的研究PG快照不可修改。映射独立在 [food-guidance-mappings-v1.json](../food-guidance-mappings-v1.json)，新增目标未建立向量索引。执行范围和缺口见[本轮记录](../../../agent-design/docs/business-rag-execution-2026-11-04.md)。

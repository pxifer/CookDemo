# 来源接入与切块

- 职责/输入输出：权威来源、原文定位、版本与 hash → 研究证据包及实体/关系。
- 当前实现：[scripts/build-health-knowledge.py](../../scripts/build-health-knowledge.py)、[scripts/build-health-knowledge-v2.py](../../scripts/build-health-knowledge-v2.py)、[datasets/health/](../../datasets/health/)
- 当前状态：已有本地构建与来源核对；尚未部署通用多格式自动导入服务。
- 后续边界：增加格式适配前先定义原文定位、撤回和重建验证。

设计目录不承载产品运行代码，详见[总导航](../README.md)。

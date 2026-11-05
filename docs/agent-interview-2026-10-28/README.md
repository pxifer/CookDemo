# Agent面试与拾味落地资料导航

更新日期：2026年10月28日。

三份主文档形成一条准备路径：先建立通用知识，再把知识映射到真实项目，最后按优化方案做出可展示的结果。每份均提供Word阅读版与可持续更新的Markdown源文件。

## 三份主文档

| 文档 | 内容 | 阅读版 | 源文件 |
| --- | --- | --- | --- |
| 01 Agent开发面试题与分级回答 | 90道题 P0至P2 口述回答 追问 易错口径 14天复习 | [Word](01_Agent开发面试题与分级回答.docx) | [Markdown](01_Agent开发面试题与分级回答.md) |
| 02 拾味项目RAG与Agent落地和面试讲述 | 能力事实 从零建设12步 真实难点 项目追问 讲述稿与简历 | [Word](02_拾味项目RAG与Agent落地和面试讲述.docx) | [Markdown](02_拾味项目RAG与Agent落地和面试讲述.md) |
| 03 拾味RAG与Agent优化选型及实施路线 | 14项决策 存储 检索 状态机 压缩 评测 故障矩阵 20项任务 | [Word](03_拾味RAG与Agent优化选型及实施路线.docx) | [Markdown](03_拾味RAG与Agent优化选型及实施路线.md) |

面试前优先读第一份Q01至Q50，再练第二份三分钟稿与专项追问。开发时以第三份的迭代顺序推进，并回查[现有健康RAG方案](../../agent-design/retrieval/health-rag-plan.md)。独立评测、向量部署、结构摘要与正式健康发布均未因文档交付而变成已实现。

## 调研方法与可信度

用户两份TXT仅提供问题参考，没有把其中的角色、企业项目和指令视为用户经历或任务授权。网络检索覆盖公开面经、官方架构文档、模型卡、数据库和协议文档及论文；面经只提炼考点，技术结论以原始资料核对。优先级是项目相关性、基础依赖与失败代价的综合判断，不是统计频率。

资料核查日为2026年10月28日。下列链接中，官网可能发生跳转或版本更新。对只读到搜索摘要或关联摘录的面经明确标注，未把它当完整原帖已核验；不可访问的链接不承担技术结论。没有进行医学系统综述，也没有新增临床建议。

## 网络资料及用途

### 面经样本

1. [字节Agent开发日常实习一面](https://api-cdn.nowcoder.com/feed/main/detail/d2cf5165d1184b59879eff5793b7b453?sourceSSR=subject)：已读取正文。上下文计数、压缩验证、Skill、单多Agent、后端基础与JSON手撕；候选人自述。
2. [字节日常实习集团信息系统一面](https://www.nowcoder.com/feed/main/detail/00e3488329c041c5a5a357c14ce138b4?sourceSSR=dynamic)：搜索摘要及前一原帖的关联摘录可核对；完整独立正文访问未成功。用于切块、融合、Plan Execute、RAG与Skill的题型线索。
3. [字节Agent开发后端日常实习一面](https://www.nowcoder.com/discuss/932295617999622144?sourceSSR=home)：只核对搜索摘要，正文抓取未成功。作为项目选型追问的补充线索，不用于技术答案。

### RAG与模型

4. [Retrieval Augmented Generation原论文](https://arxiv.org/abs/2005.11401)：参数知识和外部检索组合的基本动机。
5. [RAG检索流程综述](https://arxiv.org/abs/2404.10981)：检索前、检索、检索后与生成分层。
6. [Anthropic Contextual Retrieval](https://www.anthropic.com/engineering/contextual-retrieval)：关键词与语义互补及片段上下文问题；未将其厂商实验提升幅度移植为本项目结果。
7. [BGE M3官方模型卡](https://huggingface.co/BAAI/bge-m3)：1024维、8192 token与表示类型；未下载或实测。
8. [Qwen3 Embedding 0.6B官方模型卡](https://huggingface.co/Qwen/Qwen3-Embedding-0.6B)：上下文、指令与维度支持；未下载或实测。
9. [BGE reranker v2 m3官方模型卡](https://huggingface.co/BAAI/bge-reranker-v2-m3)：query passage联合打分及资源取舍。
10. [DeepSeek官方首次调用](https://api-docs.deepseek.com/)：当前模型别名、API入口与Harness导航；本轮未调用真实模型。

### Agent与上下文

11. [Building effective agents](https://www.anthropic.com/research/building-effective-agents)：Workflow与Agent及复杂度取舍。
12. [ReAct原论文](https://arxiv.org/abs/2210.03629)：观察与行动交替的范式。
13. [Writing effective tools](https://www.anthropic.com/research/writing-tools-for-agents)：工具粒度与接口表达。
14. [Effective context engineering](https://www.anthropic.com/research/effective-context-engineering-for-ai-agents)：有限上下文、工具结果与信息组织。
15. [Lost in the Middle](https://arxiv.org/abs/2307.03172)：长上下文位置效应；不把旧模型实验视为所有新模型的固定结果。
16. [Claude Code工作原理](https://code.claude.com/docs/en/how-claude-code-works)：Loop与Harness公开解释；未推断内部摘要prompt和阈值。
17. [LangGraph持久化](https://docs.langchain.com/oss/python/langgraph/persistence)：checkpoint和store的边界；不是当前项目依赖。
18. [DeepSeek Harness官方架构](https://deepseek-harness.github.io/deepseek-harness/en/reference/)：插件、服务、会话与上下文设施；只作公开架构对照。
19. [DeepSeek Harness官方仓库](https://github.com/deepseek-ai/deepseek-harness)：核对项目身份，不声称已精读源码或完成接入。
20. [pi官方仓库](https://github.com/earendil-works/pi)：精简可扩展Harness及模型与执行设施；原badlogic链接核查时跳转到此仓库。

### 数据库与协议

21. [pgvector官方仓库](https://github.com/pgvector/pgvector)：精确与近似检索、参数及过滤；云端实际版本未重新检测。
22. [PostgreSQL 17全文检索](https://www.postgresql.org/docs/17/textsearch-controls.html)：分词、tsquery和排名；不能将ts_rank_cd称为BM25。
23. [PostgreSQL 17执行计划](https://www.postgresql.org/docs/17/using-explain.html)：慢查询定位和实际执行边界。
24. [MCP工具规范2025年11月版](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)：工具发现、schema和调用；锁定版本作解释，不声称是所有服务最新实现。
25. [MCP安全实践](https://modelcontextprotocol.io/docs/2025-11-25/tutorials/security/security_best_practices)：授权、代理、SSRF与作用域；技术安全需在应用侧落实。

### 评测

26. [Ragas原论文](https://arxiv.org/abs/2309.15217)：检索与生成质量分层评价。
27. [Ragas可用指标](https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/)：faithfulness、context recall、tool accuracy等指标入口。
28. [Demystifying evals for AI agents](https://www.anthropic.com/research/demystifying-evals-for-ai-agents)：任务、试验、轨迹与最终状态的区别。

正文以链接就近标注主要依据。项目特定的表结构、任务顺序、预算与验收目标属于结合代码和资料的工程设计，不是某份来源保证的最优方案。

## 项目依据与复核

当前事实优先核对[协作规则](../../AGENTS.md)、[模型API](../../agent-design/generation/health-model-api.md)、[研究库说明](../../datasets/health/README.md)、知识包与代码，历史验收仅支持其当时范围。模型聊天和RAG准备接口分开解释。

新增[只读复核脚本](support/audit-baseline.ts)和[结果](support/baseline-audit.json)没有修改检索代码。运行方式是在项目根目录使用锁定tsx依赖：

```powershell
node --import tsx docs/agent-interview-2026-10-28/support/audit-baseline.ts
```

20题内前5条完整预期事实覆盖20/20，前1条18/20。标注单位是已有expectedFactIds，非证据Recall或独立测试；未测真实模型、线上P95和医疗安全。文档的完整性、链接和Word版视觉核验记录保留在support目录，不作为项目功能验收。

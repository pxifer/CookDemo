# 公共资料离线重建与定位差异核对

日期：2026-11-05。对应TODO B1；现有13个来源可按固定原件hash和解析器重建。正文识别、多栏、页眉页脚、表格、OCR及语义审核仍属B2～B6。

## 输入与产物

- [原件登记](../../datasets/health/source-rebuild-registry-v1.json)：11个旧来源＋2个目标来源；原件文件名、cache组、原hash、PDF页数及图像版附件hash；不分发完整原文。
- `health`缓存默认仍在原项目 `artifacts/tmp/health-sources/`，目标来源在 `.local-data/rag-business/sources/`；可显式传入其他只读缓存根目录，不复制秘密或覆盖缓存。
- 每来源输出逐页文字、去Unicode空白的派生副本、解析器/Python/依赖版本与脚本hash、原件/附件hash、产物hash、字符数量及待复核标记。去空白副本仅用于定位比较，不称清洗正文。
- 全文派生产物仅允许写入当前项目 `.local-data/` 或忽略的 `artifacts/tmp/health-rebuild/`，不写冻结包/公开数据集，也不覆盖不同内容的旧输出。

## 锁定环境

Python3.11；[要求文件](../../scripts/health-parser-requirements.txt)锁定pypdf6.21.4、cryptography50.0.2、cffi2.1.1、pycparser3.12与fonttools4.68.0。本次新建独立解析环境，未改旧环境。AES解析需要pypdf的crypto额外依赖，字体编码由fonts依赖支持；见[pypdf官方安装说明](https://github.com/py-pdf/pypdf/blob/main/docs/user/installation.md)。这不是下载OCR模型或字体素材。

```powershell
# 仅首次准备新隔离环境时安装锁定依赖；后续重建完全离线
python -m venv .local-data/rag-governance/parser
.\.local-data\rag-governance\parser\Scripts\python.exe -m pip install -r scripts/health-parser-requirements.txt
# CACHE_HEALTH/CACHE_GOALS在下面替换为现有公开原件缓存目录
.\.local-data\rag-governance\parser\Scripts\python.exe -B -X utf8 scripts/rebuild-health-sources.py --registry datasets/health/source-rebuild-registry-v1.json --health-cache CACHE_HEALTH --goal-cache CACHE_GOALS --output .local-data/rag-governance/run-a
# 使用相同参数，output改为run-b，再做独立产物比较
.\.local-data\rag-governance\parser\Scripts\python.exe -B -X utf8 scripts/verify-source-rebuild.py --first .local-data/rag-governance/run-a --second .local-data/rag-governance/run-b --registry datasets/health/source-rebuild-registry-v1.json --bundle datasets/health/2026-10-28-v2/knowledge-bundle.json --goals datasets/health/goal-guidance-2026-11-04-v1/knowledge.json --output .local-data/rag-governance/comparison.json
```

解析错误、依赖缺失、hash/页数不符逐来源拒收并标incomplete，不填假页面；缺依赖不能算重建通过。短文本页标记需要版面/OCR复核，阈值40个非空白字符是工程预警，不是语义合格线。图像版原件附件单独核验hash，不把旧目视转录改称OCR。

`scripts/research-health-html.py`已统一到 `artifacts/tmp/health-sources/`，默认只查缓存；缺文件直接失败。显式 `--fetch`才下载缺失公开原件，本次没有调用该开关。原文件不覆盖，不再自动改写旧pages/定位，派生文字走新重建入口。

## 本次实测

[比较报告](../../artifacts/acceptance/rag-quality-governance-2026-11-05/source-rebuild-verification.json)：13来源、479解析单元（9个PDF共475页，4个HTML各1个单元），两次独立输出逐字节一致。旧98条＋目标4条证据中，87条保持规范化定位、11条仍按原图核对、4条原文可找到但需要新定位；没有找不到的规范化span。新定位不能直接覆盖冻结资料，后续接入须新证据版本与复核。

原件、冻结v1/v2、目标包和旧映射v1保留。比较成功仅证明重建稳定和文字定位关系，不能证明解析语义、表格数值或健康适用性正确；本次没有发布新事实、重建旧向量索引或启用线上服务。

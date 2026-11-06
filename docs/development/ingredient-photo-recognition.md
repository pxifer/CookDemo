# 食材名称输入与图片识别

2026-11-05，INPUT-001。独立开发分支，需管理审核后合入；不代表正式云端已部署。

## 使用

- 食材清单仅保留名称、改名和删除；不再显示用量或单位。带量文字仍可解析，但加入清单及恢复旧草稿时清除 amount、quantityUnit、alternative；不改变食材身份、过敏忌口、人数和补买设置。菜谱原配方用量仍保留。
- 拍照识别 → 选择照片 → 点击识别 → 核对/勾选 → 添加所选食材。不确定对象单独提示，不自动入库；已知名称复用原有合并和推荐流程，未知名称仍须改名或删除。
- 选择图片本身不调用模型。前端将图片重编码为最长1280像素JPEG并移除元数据；服务端仅接收内联JPEG/PNG/WebP，最大2MiB，并核对文件签名，不接受外部URL。原图与处理后的图像均不写服务端文件或公共知识库。

## 模型选择

默认 `IMAGE_MODEL_PROVIDER=auto`：有服务端 `IMAGE_ZHIPU_API_KEY` 时选择免费智谱；没有则选择 DeepSeek，复用当前登录账户保存的 DeepSeek Key，固定 `deepseek-flash`。无个人Key时界面提示配置；不需要开启健康模式。图片和文本都按供应商用量收费。

免费方案：服务端设置 `IMAGE_ZHIPU_API_KEY` 即自动启用（也可显式设置 `IMAGE_MODEL_PROVIDER=zhipu`），固定 `glm-4.6v-flash`。Key仅服务端环境变量保存，不使用VITE变量，不提供浏览器改URL/型号入口；健康模式仍使用原有DeepSeek个人Key。缺少智谱Key时启动拒绝该配置，不自动转付费模型。免费标识依据2026-11-05官方资料，账号权限及并发额度仍以供应商为准。

- [智谱官方免费视觉模型](https://docs.bigmodel.cn/cn/guide/models/free/glm-4.6v-flash)
- [DeepSeek官方图片接口](https://api-docs.deepseek.com/zh-cn/guides/vision/)

## 服务端边界

`POST /api/v1/recognitions/image`：operationId、image及可选contentVersion。登录、CSRF/同源、密码初始化、内容版本校验生效；与聊天/选菜共用账户PG认领及限额，失败也占尝试次数，无自动重试。固定模型、关闭思考、最多1200输出tokens、20秒服务端截止。模型响应要求完整stop、JSON结构及供应商usage；不返回Key、图片或供应商原文。

2026-11-06修复：认领结束后、供应商请求之前重新认证并核对UID/密码状态及本次绑定Key；清空/替换Key或会话撤销直接终止，不上传图片。返回前再次执行相同复核。认领保留已消费状态，不重放。

返回 operationId、extraction 与 uncertain。extraction仅含食材候选，不包含从照片推断的健康资料、限制或人数。界面确认后才并入清单。更换/移除照片、取消、账户/本餐版本变化及卸载时取消请求并丢弃迟到结果。

当前仅接入模型及既有费用归属，未实施平台统一承担DeepSeek费用，也未改为每日10次额度。

## 本地验证

构建：`scripts/run.ps1 build`。单元回归：`scripts/run.ps1 test`（新增模拟视觉响应及登录/重复请求用例）。专项浏览器：Node24通过tsx执行 `scripts/verify-ingredient-photo.ts`；仍调用同一公网拦截包装器，使用回环15201端口，涵盖原核心浏览器流程与图片确认/迟到取消。证据写入忽略的 `.local-data/acceptance-input/`。无真实模型、云端或真实邮件验收。

## 免费服务启用条件（2026-11-06）

官方模型页将GLM-4.6V-Flash列为免费；[官方用户协议](https://docs.bigmodel.cn/cn/terms/user-agreement)第三部分第5项涵盖向第三方提供服务，第7项涵盖API应用开发。结合模型页所列商品/电商场景，可作为商业应用接入的依据，但不是无限额度或免除平台条款的承诺；仍须以实际账号权限与最新价格为准。

平台需已有注册/实名的智谱账户和服务端Key。Key不交给终端用户。免费路线下，用户登录本站后即可识别，不需填写个人模型Key；保留共享PG账户限额和身份门禁。当前环境未发现配置的智谱Key，不能宣称内部服务已经启用，也不会代用户注册、接受服务条款或编造凭证。未配置时保持登录并提交个人DeepSeek Key后才允许识别。

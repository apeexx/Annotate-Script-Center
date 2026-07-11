# Aishell Tech 闽南语助手后端

## 入口

- `GET /api/aishell-tech/minnan-helper/ai/recommend/health`
- `GET /api/aishell-tech/minnan-helper/ai/recommend/defaults`
- `POST /api/aishell-tech/minnan-helper/ai/recommend`
- `POST /api/aishell-tech/minnan-helper/ai/recommend/jobs`
- `GET /api/aishell-tech/minnan-helper/ai/recommend/jobs/:jobId`
- `GET /api/aishell-tech/minnan-helper/ai/recommend/jobs/:jobId/debug`
- `GET /api/aishell-tech/minnan-helper/ai/recommend/logs/summary`

## 模块边界

- `config.js`：Aishell 独立配置、模型默认值、队列组设置与 `AISHELL_AI_*` 环境变量读取；第一阶段允许只读回退旧的 `DATABAKER_AI_*`。
- `errors.js`：Aishell 自己的错误包装，统一阶段、可重试标记、provider 状态码与取消态。
- `cache.js`：Aishell recommend 成功缓存。
- `queue.js`：Aishell 独立 provider queue 入口，默认组名：
  - `aishell_qwen_omni`
  - `aishell_fun_asr`
  - `aishell_text_compare`
- `pipeline.js`：Aishell 自己的同步推荐编排，只复用公共 provider HTTP 工具，不复用 DataBaker recommend orchestration。
- `dashscope-omni-client.js`：Aishell 独立 DashScope compatible-mode Omni 客户端，直接构造 `input_audio` 流式请求并固定 `enable_thinking=false`。
- `ai-service.js`：请求归一、默认 Prompt、health/defaults、统一成功/失败响应包装。
- `ai-routes.js`：HTTP 路由、客户端断开取消、同步超时墙、成功后写缓存与 CSV 日志。

## 当前实现口径

- Aishell 已不再把请求映射成 DataBaker recommend payload，也不再直接调用 DataBaker `recommend()`。
- 底层仍复用公共 provider 工具：
  - `platform-resources/backend/ai/providers/qwen-openai-compatible.js`
  - `platform-resources/backend/ai/providers/funasr.js`
- 当前仓库所有 AI 链路都已统一固定关闭 thinking；Aishell 即使收到前端或旧配置的 thinking 请求，也会强制归一为 `false`。
- 当前默认链路改为“短请求创建 job + HTTP 轮询结果”；同步 recommend 继续保留为兼容 / 调试入口，不引入 SSE 或 WebSocket。
- 默认同步总超时统一为 `60000ms`；环境变量可用 `AISHELL_AI_TIMEOUT_MS` 覆盖。
- 客户端主动刷新、关闭页面或代理提前断开时，Aishell 会通过 `AbortSignal` 取消后续链路，不再把这类中断请求写成成功缓存或成功 CSV 行。
- 路由层当前只把 `request.aborted` 与 `response.close` 视为真实断连；不会再把请求体正常读完后的 `request.close` 误判成客户端已断开。

## 推荐模式

- 当前不再使用旧“模型方案 + 识别策略”，后端统一按三个阶段执行：
  - `转换`：先按 `minnan-lexicon.json` 的 `对应华语 -> 建议用字` 规则做最长匹配替换；参考源 `minnan-lexicon.csv` 只保留给人工整理和外部 AI 处理。只有命中多候选或切分冲突时，才会调用文本模型做歧义兜底，输出 `convertedText`。
  - `听音`：按实际发音输出 `heardText`；可选 `Fun-ASR` 或 `Omni`，但都只负责听音本身。
  - `比较`：必须等待转换完成后执行最终判断：
    - `compareFamily=qwen`：复用文本队列做纯文本比较。
    - `compareFamily=omni`：复用 Omni 队列做独立的第三段音频比较请求。
- `compareAdoptionThreshold` 默认 `0.75`；当 `correctionConfidence` 低于阈值时，后端会优先保留 `heardText`，并把 `needHumanReview` 置为 `true`。
- 后处理 `lexicon.rewriteMode` 固定为 `off`，不会再做强制词表改写。
- 当前仓库口径补充：Aishell 与 DataBaker 闽南语运行时主词表现已同步落为同一份内容，但仍分别保留各自 JSON 路径，便于后续按平台独立演进。

## 返回契约

- 成功：`success + data + meta`
- 失败：`success=false + error + meta`

其中：

- `data` 只放业务结果，例如 `convertedText`、`heardText`、`recommendedText`、`needHumanReview`；旧 `lexiconCandidateText` 仅作为兼容回退保留。
- `meta` 固定放诊断上下文：
  - `requestId`
  - `stage`
  - `models`
  - `execution`
  - `timing`
  - `usage`
  - `queue`
  - `cache`
  - `debugId`
  - `retryCount`
  - `cancelled`
  - `lexicon`
    - `status / source / sourceFile / referenceSourceFile / rowCount / warningMessage / rewriteMode`
  - `audioFirstReference`
    - `convertedText`
    - `convertPairs`
    - `correctionThreshold`
    - `correctionConfidence`
    - `candidateDecisions`
- `error` 固定放：
  - `code`
  - `message`
  - `stage`
  - `retryable`
  - `providerStatus`
  - `providerCode`

## defaults / health

- `defaults` 返回：
  - `stages.convert / stages.listen / stages.compare`
  - 每个阶段的默认模型、Prompt、参数与模型列表
  - 比较阶段额外返回 `family / familyOptions / qwenPrompt / omniPrompt / adoptionThreshold`
  - `omniPrompt` 当前语义为“Omni 比较 Prompt”：用于第三段 Omni compare
- `health` 返回：
  - 当前三阶段默认配置
  - 当前同步超时
  - Aishell 独立队列组配置
- 当前默认组合已收口为：`转换 qwen3.5-plus + 听音 qwen3.5-omni-flash + Qwen 比较 qwen3.5-plus`。

## 日志与缓存

- Aishell 继续写平台专属 CSV：
  - `platform-resources/aishell-tech/minnan-helper/data/runtime/ai-calls-YYYY-MM-DD.csv`
- CSV 当前会记录：
  - 是否取消
  - 当前阶段
  - 总耗时 / 转换耗时 / 听音耗时 / 比较耗时
  - 排队等待
  - 重试次数
  - 缓存命中
  - Aishell 当前执行链路与三阶段模型信息
- 统计接口：
  - `GET /api/aishell-tech/minnan-helper/ai/recommend/logs/summary`
- 只有完整同步返回成功并真正写出响应后，才允许写成功缓存和成功日志。

## 安全边界

- 后端只返回 AI 辅助结果，不保存平台标注数据。
- 不记录 token、cookie、authorization、完整音频 URL、完整签名 URL。
- 取消、超时、中途断开只保留必要诊断摘要，不伪装成成功请求。

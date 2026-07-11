# Aishell Tech 泰语助手后端

## 接口

- `GET /api/aishell-tech/thai-helper/ai/recommend/health`
- `GET /api/aishell-tech/thai-helper/ai/recommend/defaults`
- `POST /api/aishell-tech/thai-helper/ai/recommend`
- `POST /api/aishell-tech/thai-helper/ai/recommend/jobs`
- `GET /api/aishell-tech/thai-helper/ai/recommend/jobs/:jobId`
- `GET /api/aishell-tech/thai-helper/ai/recommend/jobs/:jobId/debug`
- `GET /api/aishell-tech/thai-helper/ai/recommend/logs/summary`

## 当前实现

- 只保留单阶段 `recognize`。
- 默认模型：`qwen3.5-omni-flash`。
- 默认 Prompt 约束：
  - 同时输出最终泰语转写文本与语速建议
  - 返回严格 JSON：`{"text":"...","speed":"slow|normal|fast"}`
  - `text` 保留泰语字符与正常空格，不翻译成中文
  - `speed` 只能是 `slow / normal / fast`
- 不再存在：
  - 词表读取
  - `convert / listen / compare` 三阶段
  - `convertedText / heardText / audioFirstReference`

## 请求与响应

- 请求归一后只接受：
  - `singleModel`
  - `singlePrompt`
  - 共享高级参数
  - `aiStages.recognize`
- 成功响应固定：
  - `success`
  - `data.recommendedText`
  - `data.recommendedSpeed`
  - `data.referenceText`
  - `meta`
- `meta` 当前会同时返回：
  - `usage.promptTokens / completionTokens / totalTokens`
  - `cost.recognize / cost.totalEstimatedCostCny`
- 失败响应固定：
  - `success=false`
  - `error.code / error.message / error.stage / error.retryable`
  - `meta`
- 若模型返回非法语速值，会显式返回 `invalid-recommended-speed` 一类错误，不做静默猜测。
- 旧中文值 `慢 / 正常 / 快` 当前只作为兼容输入解析；后端正式输出统一收口为 `slow / normal / fast`。
- `stage error` 当前会保留 plain object 里的 `message / code / statusCode`，不再把结构化错误折叠成 `[object Object]`。

## 队列与日志

- 当前独立队列组只使用 `aishell_qwen_omni`。
- 同步 `recommend` 当前会正确解包统一 provider queue 返回的 `{ value, queueMeta }`，识别成功结果不会再被误判为空文本。
- Omni usage 当前会保留 `raw prompt_tokens_details / completion_tokens_details`，用于单阶段费用估算与 CSV 导出。
- 默认继续走 `POST /jobs` + 轮询 `GET /jobs/:jobId`。
- 日志只记录单阶段 `recognize` 的 token、耗时、模型与人民币估算；结果口径对应 `text + speed` 双字段。

## 安全边界

- 只返回 AI 辅助文本，不保存平台标注结果。
- 不记录 token、cookie、authorization、完整音频 URL。
- 超时、中断、失败只保留必要诊断信息。

# Aishell Tech 粤语助手后端

## 接口

- `GET /api/aishell-tech/cantonese-helper/ai/recommend/health`
- `GET /api/aishell-tech/cantonese-helper/ai/recommend/defaults`
- `POST /api/aishell-tech/cantonese-helper/ai/recommend`
- `POST /api/aishell-tech/cantonese-helper/ai/recommend/jobs`
- `GET /api/aishell-tech/cantonese-helper/ai/recommend/jobs/:jobId`
- `GET /api/aishell-tech/cantonese-helper/ai/recommend/jobs/:jobId/debug`
- `POST /api/aishell-tech/cantonese-helper/ai/recommend/jobs/:jobId/cancel`
- `GET /api/aishell-tech/cantonese-helper/ai/recommend/logs/summary`

## 当前实现

- 默认创建短任务后轮询结果；同步 `POST /recommend` 仅保留兼容 / 调试用途。取消接口会中止在途任务，任务状态统一为取消失败态，不会伪装成成功。
- 三阶段为转换候选、听音转写、比较决策：转换和听音并发，比较随后执行。默认模型为 `qwen3.5-plus / qwen3.5-omni-flash / qwen3.5-plus`，每次模型调用最多 `60000ms`，`enable_thinking=false`。
- 转换只将页面参考文本转为繁体粤语候选，不能直接写回；听音基于真实音频生成 `heardText` 与语速；比较生成最终文本。Fun-ASR 听音强制使用 Omni 音频比较，Qwen 比较保留听音速度。
- 环境变量优先级：`AISHELL_CANTONESE_AI_*`，再回退 `AISHELL_AI_*`、`DASHSCOPE_*` 和既有兼容项。
- 请求沿用统一 AI 调用账本，必须携带已在 options 首页保存的 `aiUsageOperatorName`。
- 三阶段 Prompt 都要求繁体粤语口语、不翻译普通话、保留合理中英混说；文本规范空白与常用全角中文标点，非法语速显式返回错误，不做静默猜测。

## 响应与错误

- 比较阶段默认采纳阈值固定为 `0.75`；扩展、设置页和未传阈值的兼容接口使用同一默认值，低于此值时回退听音文本并标记人工复核。
- 成功：`success=true`、`data.convertedText`、`data.heardText`、`data.recommendedText`、`data.recommendedSpeed`、`data.referenceText`、分阶段 `meta.usage`、分阶段 `meta.cost`。
- 失败：`success=false`、`error.code / message / stage / retryable`、`meta.requestId`。
- 上游限流统一为 `provider-rate-limited`，状态码 `429` 且可重试；超时为 `timeout`，状态码 `504` 且可重试。

## 安全边界

- 只返回 AI 辅助结果，不保存平台标注结果。
- 不记录 API Key、token、cookie、authorization 或完整音频 URL。

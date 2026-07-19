# Aishell Tech 粤语助手后端

## 接口

- `GET /api/aishell-tech/cantonese-helper/ai/recommend/health`
- `GET /api/aishell-tech/cantonese-helper/ai/recommend/defaults`
- `POST /api/aishell-tech/cantonese-helper/ai/recommend`

## 当前实现

- 固定同步单阶段 `recognize`：`qwen3.5-omni-flash`、`60000ms`、`enable_thinking=false`，并固定请求 `response_format={type:"json_object"}`，保证返回 JSON 对象。
- 环境变量优先级：`AISHELL_CANTONESE_AI_*`，再回退 `AISHELL_AI_*`、`DASHSCOPE_*` 和既有兼容项。
- 请求沿用统一 AI 调用账本，必须携带已在 options 首页保存的 `aiUsageOperatorName`。
- 默认 Prompt 要求繁体粤语忠实转写、不翻译普通话、保留合理中英混说，并返回严格 JSON：`{"text":"...","speed":"slow|normal|fast"}`。
- 文本规范空白与常用全角中文标点；非法语速显式返回错误，不做静默猜测。

## 响应与错误

- 成功：`success=true`、`data.recommendedText`、`data.recommendedSpeed`、`data.referenceText`、`meta.usage`、`meta.cost`。
- 失败：`success=false`、`error.code / message / stage / retryable`、`meta.requestId`。
- 上游限流统一为 `provider-rate-limited`，状态码 `429` 且可重试；超时为 `timeout`，状态码 `504` 且可重试。

## 安全边界

- 只返回 AI 辅助结果，不保存平台标注结果。
- 不记录 API Key、token、cookie、authorization 或完整音频 URL。

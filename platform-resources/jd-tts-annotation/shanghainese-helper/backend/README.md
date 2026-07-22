# 京东 TTS 上海话助手后端

此目录提供异步音频识别接口，路由前缀为 `/api/jd-tts-annotation/shanghainese-helper/ai/recommend`。

## 接口

- `GET /api/jd-tts-annotation/shanghainese-helper/ai/recommend/health`
- `GET /api/jd-tts-annotation/shanghainese-helper/ai/recommend/defaults`
- `POST /api/jd-tts-annotation/shanghainese-helper/ai/recommend`
- `POST /api/jd-tts-annotation/shanghainese-helper/ai/recommend/jobs`
- `GET /api/jd-tts-annotation/shanghainese-helper/ai/recommend/jobs/:jobId`
- `GET /api/jd-tts-annotation/shanghainese-helper/ai/recommend/jobs/:jobId/debug`
- `POST /api/jd-tts-annotation/shanghainese-helper/ai/recommend/jobs/:jobId/cancel`

根路径和 `/jobs` 均只创建异步任务并返回 `202`；运行时使用 `/jobs`。任务从创建起最长 60 秒。

## 请求与响应

- 归一后的输入仅接受数字字符串 `utteranceId`、`checksum`、WAV Base64 `audioDataUrl`、`clientRequestId`、受白名单约束的 `aiOmni` 和脱敏用途元数据。
- 请求携带 `audioUrl` 会被拒绝；资源地址、Cookie、Authorization 不会进入成功体、缓存、调试响应或日志。
- 成功业务字段固定为：
  - `data.utteranceId`
  - `data.checksum`
  - `data.listenText`
  - `data.needHumanReview`
- 空模型结果会返回空 `listenText` 并标记 `needHumanReview=true`；客户端不应回填。

## 模型、队列与缓存

- 默认模型：`qwen3.5-omni-plus`；可选 `qwen3.5-omni-flash`。
- 强制 `enableThinking=false`，仅执行单阶段原始上海话听写。
- 专属队列组：`jd_tts_qwen_omni`，与其他平台的队列隔离。
- 请求体上限 3 MiB；内存缓存默认保留 12 小时、最多 100 项。缓存键包含语句身份、WAV 摘要、模型、Prompt、参数和执行链路。

## 文件与日志

- `ai-routes.js`：HTTP jobs、轮询、取消与脱敏调试响应。
- `ai-service.js`：请求白名单、模型参数和响应结构。
- `pipeline.js`：专属队列与 Qwen Omni 调用编排。
- `cache.js`：仅内存的结果缓存。
- `config.js`：60 秒超时和缓存边界配置。
- `../data/ai-call-log.js`：仅记录 Token、人民币估算、耗时、队列摘要、语句身份摘要和安全错误摘要；不记录音频、资源地址、转写文本或鉴权数据。

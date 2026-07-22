# 京东 TTS 上海话助手后端

此目录提供异步音频识别接口，路由前缀为 `/api/jd-tts-annotation/shanghainese-helper/ai/recommend`。

## 约束

- 只接收 WAV Base64 Data URL，不接收或保存音频 URL。
- 只返回当前语句的 ID、校验值、原始听写文本及人工复核标记。
- 根路径和 `/jobs` 都只创建异步任务，均返回 `202`；AI 仅在 job 生命周期中运行，任务从创建起最长 60 秒。
- Qwen 空响应会返回空文本并标为需要人工复核；其他 provider 错误正常失败。
- 请求体上限为 3MB；缓存按过期时间清理，默认最多保留 100 项。

## 文件

- `ai-routes.js`：HTTP jobs、轮询、取消与脱敏调试响应。
- `ai-service.js`：请求白名单、模型参数和响应结构。
- `pipeline.js`：专属队列与 Qwen Omni 调用编排。
- `cache.js`：仅内存的结果缓存。
- `config.js`：60 秒超时和缓存边界配置。

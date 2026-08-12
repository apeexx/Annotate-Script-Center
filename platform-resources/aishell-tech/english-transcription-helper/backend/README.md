# 希尔贝壳英语音频转写助手后端

## 职责

本目录实现英语单阶段 Omni 转写。浏览器已将当前安全蓝色区段裁剪为 WAV Data URL；后端只将该裁剪音频交给共享 Omni 客户端，并把原始英语结果作为 `listenText` 返回。

## 配置与安全约束

- 默认模型为 `qwen3.5-omni-plus`，白名单还包括 `qwen3.5-omni-flash`。
- 单次请求和 job 生命周期均固定最多 `60000ms`；`enable_thinking` 始终为 `false`。
- Prompt 要求英语原样转写；重叠、静音、听不清或无法确认时只允许精确 `#N#`，不得猜测或补写。
- 强制校验 WAV Base64 Data URL、区段身份、非空 taskId / packageId 与时长字段；请求体上限为 3MB。同步请求与 POST /jobs 会在缓存、Job 创建和模型调用前拒绝缺失或仅空白的任务/分包身份，缓存不会读写空身份。后端不下载原始音频，也不接收完整来源地址。
- 密钥继续由统一服务端环境变量解析；前端、仓库文档、调试响应和日志均不得保存密钥、凭据或音频内容。

## 路由与队列

统一接口前缀为 `/api/aishell-tech/english-transcription-helper/ai/recommend`：

- `GET /health`
- `GET /defaults`
- `POST /` (relative to the prefix above; full route: `POST /api/aishell-tech/english-transcription-helper/ai/recommend`)
- `POST /jobs`
- `GET /jobs/:jobId`
- `POST /jobs/:jobId/cancel`
- `GET /jobs/:jobId/debug`

运行时默认创建 job 后轮询结果。队列组为 `aishell_english_transcription_qwen_omni`，默认 `8 RPM / 1` 个上游并发；最终限流、取消或超时只返回脱敏诊断。成功结果为 `success + data + meta`，业务文本仅在 `data.listenText` 中出现。

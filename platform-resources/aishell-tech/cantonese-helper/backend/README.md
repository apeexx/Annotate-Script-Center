# 希尔贝壳粤语助手后端

## 职责

本目录实现粤语助手的单阶段 Omni 原始听写。浏览器已将当前蓝色区段裁剪为 WAV Data URL；后端只把该裁剪音频交给 Qwen Omni，响应把模型原始文本作为唯一业务结果 `listenText` 返回。精确 `#N#` 是重叠、串音、静音或听不清的人工复核标记，不是可自动写入的转写。

## 配置与约束

- 默认模型：`qwen3.5-omni-plus`；白名单还包括 `qwen3.5-omni-flash`。
- 默认超时固定为 `60000ms`，支持环境变量下调，不允许超过 60 秒。
- `enable_thinking` 始终为 `false`。
- 空 Prompt 使用默认繁体粤语口语原始听写 Prompt；无论使用默认还是 Options 中已保存的 Prompt，后端都会追加“重叠或无法确认时只输出 `#N#`、不得猜词”的安全规则。
- 后端不下载原始音频；强制校验 `audioDataUrl` 为 WAV Base64 Data URL，以及 `regionId`、`segmentNumber`、`startMs`、`endMs`、`durationMs`、`selectionKey` 的一致性。缺失或无效时返回 `400`。
- 请求体上限为 `3MB`，超限返回 `413 / payload-too-large`；不执行 Fun-ASR、语速、词表、转换或比较阶段。

## 接口与任务

接口见上级 README。同步推荐仅供兼容和诊断；运行时默认创建 `POST /jobs` 后轮询结果。任务使用公共 job store、缓存和粤语专用 `aishell_cantonese_qwen_omni` 队列；该队列不按具体模型名分流，默认上游并发 `1`、最多 `8 RPM`。粤语前端只保留一个在途作业，避免 job 在单并发队列中排队至 60 秒上限。识别到 `429`、`provider-rate-limited` 或 `limit_burst_rate` 时，后端最多执行 `3` 次带随机抖动的指数退避；每次重试会先等待其退避时间和本队列剩余请求间隔中的较长者，随后重置下一个请求间隔。耗尽后前端会暂停未发区段，用户可在额度恢复后重新启动“未完成”批量。粤语 job 从创建时刻起（含排队）固定最多 `60000ms`，不受公共 `ASC_AI_JOB_TIMEOUT_MS` 放宽影响；超时、客户端断开或取消都会取消未完成的模型请求，且取消或失败的任务不写入成功缓存。

可选服务端覆盖项为 `AISHELL_CANTONESE_AI_QWEN_OMNI_RPM_LIMIT`、`AISHELL_CANTONESE_AI_QWEN_OMNI_CONCURRENCY`、`AISHELL_CANTONESE_AI_QWEN_OMNI_BURST_RETRY_MAX` 与 `AISHELL_CANTONESE_AI_QWEN_OMNI_BURST_RETRY_BASE_MS`。失败响应保留脱敏后的上游诊断、状态码、provider code 与队列重试信息，不记录音频、凭据或完整请求内容。

原始听写要求有效的 `taskItemId`、裁剪 WAV 与区段身份；`audioUrl` 只可作来源上下文，绝不传给模型。`referenceText` 仅作为可为空的条目上下文保留在请求和结果中，不参与 Prompt，也不作为拒绝条件。

缓存键同时包含条目、区段身份/起止时间、模型配置与裁剪 WAV 的 SHA-256 摘要；摘要只用于隔离缓存，缓存内容、日志和调试摘要均不保留 Base64 音频或完整来源 URL。调试摘要还会屏蔽凭据字段。

- `POST /api/aishell-tech/cantonese-helper/ai/recommend/jobs/:jobId/cancel`：取消已创建 job；不需要请求体，成功返回 `200` 与该 job 的轮询状态。当前路由器只支持 `GET/POST`，因此不使用 `DELETE`。
- `GET /api/aishell-tech/cantonese-helper/ai/recommend/jobs/:jobId`：继续轮询 job。取消后或超时后返回 `status: "failed"`，并在 `error.error.code` 中返回 `aborted` 或 `ai-job-timeout`。

成功结构固定为 `success + data + meta`，其中 `data.listenText` 是唯一识别结果。仅当上游流收到正常 `[DONE]` 结束标记时，粤语调用可以把空文本作为成功结果返回并设置 `needHumanReview: true`；任何包含 `#N#` 的模型输出都会规范为唯一 `#N#` 并设置该标记。缺少结束标记的空文本仍返回脱敏接口异常。空流错误会保存脱敏后的 SSE 摘要，供 job debug 查询；公开错误 `meta` 与 job debug 都不保留 URL、音频 Data URL、凭据或 secret/password 值。

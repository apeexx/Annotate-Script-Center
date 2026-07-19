# 希尔贝壳粤语助手后端

## 职责

本目录实现粤语助手的单阶段 Omni 原始听写。浏览器已将当前蓝色区段裁剪为 WAV Data URL；后端只把该裁剪音频交给 Qwen Omni，响应把模型原始文本作为唯一业务结果 `listenText` 返回。

## 配置与约束

- 默认模型：`qwen3.5-omni-plus`；白名单还包括 `qwen3.5-omni-flash`。
- 默认超时固定为 `60000ms`，支持环境变量下调，不允许超过 60 秒。
- `enable_thinking` 始终为 `false`。
- 空 Prompt 使用默认繁体粤语口语原始听写 Prompt。
- 后端不下载原始音频；强制校验 `audioDataUrl` 为 WAV Base64 Data URL，以及 `regionId`、`segmentNumber`、`startMs`、`endMs`、`durationMs`、`selectionKey` 的一致性。缺失或无效时返回 `400`。
- 请求体上限为 `3MB`，超限返回 `413 / payload-too-large`；不执行 Fun-ASR、语速、词表、转换或比较阶段。

## 接口与任务

接口见上级 README。同步推荐仅供兼容和诊断；运行时默认创建 `POST /jobs` 后轮询结果。任务使用公共 job store、缓存和 `aishell_qwen_omni` 队列，但粤语 job 从创建时刻起（含排队）固定最多 `60000ms`，不受公共 `ASC_AI_JOB_TIMEOUT_MS` 放宽影响；超时、客户端断开或取消都会取消未完成的模型请求，且取消或失败的任务不写入成功缓存。

原始听写要求有效的 `taskItemId`、裁剪 WAV 与区段身份；`audioUrl` 只可作来源上下文，绝不传给模型。`referenceText` 仅作为可为空的条目上下文保留在请求和结果中，不参与 Prompt，也不作为拒绝条件。

缓存键同时包含条目、区段身份/起止时间、模型配置与裁剪 WAV 的 SHA-256 摘要；摘要只用于隔离缓存，缓存内容、日志和调试摘要均不保留 Base64 音频或完整来源 URL。调试摘要还会屏蔽凭据字段。

- `POST /api/aishell-tech/cantonese-helper/ai/recommend/jobs/:jobId/cancel`：取消已创建 job；不需要请求体，成功返回 `200` 与该 job 的轮询状态。当前路由器只支持 `GET/POST`，因此不使用 `DELETE`。
- `GET /api/aishell-tech/cantonese-helper/ai/recommend/jobs/:jobId`：继续轮询 job。取消后或超时后返回 `status: "failed"`，并在 `error.error.code` 中返回 `aborted` 或 `ai-job-timeout`。

成功结构固定为 `success + data + meta`，其中 `data.listenText` 是唯一识别结果。`meta` 包含模型、耗时、Token、人民币估算、队列/缓存状态及脱敏调试摘要。

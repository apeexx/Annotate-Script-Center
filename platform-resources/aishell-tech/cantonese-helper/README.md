# 希尔贝壳粤语助手资料

## 当前能力

- 运行时代码：`extension/sites/aishell-tech/cantonese-helper/`。
- 仅在 `https://mark.aishelltech.com/mytask/mark?...` 工作页启用。
- 使用当前分包条目的 `dataRoot + url` 拼接 OSS 音频地址；保留任务、分包、条目、参考文本、页面当前文本、条目编号、时长和使用人元数据。参考文本可为空，不阻断基于音频的原始听写。
- AI 为单次 Omni 原始听写。浏览器先按当前蓝色波形区段裁剪原始音频为 `16kHz` 单声道 WAV Base64 Data URL，再交给模型；这是对原先“直传 OSS URL”的已批准替换。
- 区段按 `wave > region.wavesurfer-region` DOM 顺序映射页面区段按钮，使用当前“截取时长”校准像素时间；标题只作校验。映射、时长或裁剪失败时拒绝识别，绝不回退整段音频。
- 请求固定携带 `regionId`、`segmentNumber`、`startMs`、`endMs`、`durationMs` 与 `selectionKey`。完整 `audioUrl` 仅保留为瞬时来源上下文，不送入模型，也不写入缓存、调试摘要或日志。
- 成功业务结果唯一为繁体粤语口语 `listenText`。页面展示、复制和填入都原样使用该字段，不做繁简转换、去空格、补标点或词表替换。

## 保存与批量边界

- 单条识别和“原样填入”不会自动保存。
- 用户明确启动批量后，“全部”覆盖当前音频的全部蓝色区段，“未完成”逐段切换并以“文本”输入框为空筛选；前端可并发预取 AI 结果，但先按区段 DOM 顺序缓冲，页面切段、填入和保存严格串行，并只点击平台真实保存按钮。
- 空 `listenText` 只计为人工复核，不填入、不保存。停止批量后不再发起新的裁剪、AI 请求或新的保存；已经开始的保存步骤安全收尾。
- 不自动提交任务，不跨分包处理，也不操作质检控件。

## 后端

后端说明见 `backend/README.md`。统一接口前缀为：

- `GET /api/aishell-tech/cantonese-helper/ai/recommend/health`
- `GET /api/aishell-tech/cantonese-helper/ai/recommend/defaults`
- `POST /api/aishell-tech/cantonese-helper/ai/recommend`
- `POST /api/aishell-tech/cantonese-helper/ai/recommend/jobs`
- `POST /api/aishell-tech/cantonese-helper/ai/recommend/jobs/:jobId/cancel`
- `GET /api/aishell-tech/cantonese-helper/ai/recommend/jobs/:jobId`
- `GET /api/aishell-tech/cantonese-helper/ai/recommend/jobs/:jobId/debug`

## 边界

- 默认模型为 `qwen3.5-omni-plus`，只允许切换到 `qwen3.5-omni-flash`。
- 模型 Prompt 和白名单参数由 Options 保存，空 Prompt 回退后端默认的粤语原始听写 Prompt。
- 请求体上限为 `3MB`；超过时返回结构化 `payload-too-large`，不把音频内容、完整音频地址或凭据写入调试信息。
- 不使用主世界抓包、动态脚本注入、SSE 或 WebSocket。

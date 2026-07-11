# 闽南语助手后端（AI 推荐 + 导出上传）

本目录是 闽南语助手本地 Node 后端实现，通过统一入口 `platform-resources/backend/server.js` 注册。
当前同时提供两类能力：

- AI 推荐文本接口。
- 导出 CSV 上传与下载接口（扩展前端导出后自动上传，后端保存 `latest.csv` 并提供下载；原始记录脱敏后单独保存 `latest-raw.json`）。
- 前端“AI连续填入合格项”当前仍是“并发分析 + 顺序填入”，只处理 `statusName=质检合格`；默认改为短请求创建 `POST /ai/recommend/jobs`，再轮询 `GET /jobs/:jobId`，同步 recommend 只保留兼容 / 调试入口。
- 前端“AI连续填入合格项并发数量”已归到共享“AI 设置”区域，并按模型动态归一：
  - Omni：默认 `5`，范围 `1~25`
  - Fun-ASR：默认 `5`，范围 `1~50`
- 前端和后端都会对超范围值做归一；更高并发不会绕过上游模型限流，只会更快堆积到统一后端队列。
- 前端调度为“并发请求 + 队列消费填入”：AI 结果返回后即进入队列，由前端串行填入，不等待全部请求结束；该变更不涉及后端接口新增。
- 当前排查串行感时，要同时看：
  - 前端悬浮窗里的 `前端并发 / 已发起AI请求 / 前端活跃AI请求 / AI已返回 / 待填队列`
  - 后端 `health.queue.groups.fun_asr` 与 `text_compare` 的 `activeCount/maxConcurrent/pendingCount`
- Fun-ASR 不支持 thinking；本链路不会给 REST 或 Python provider 传 `enable_thinking`。thinking 只影响 Qwen Omni / compare 阶段，compare 未勾选时后端会显式关闭。

## 接口

- `GET /api/data-baker/round-one-quality/ai/recommend/health`
- `GET /api/data-baker/round-one-quality/ai/recommend/defaults`
- `POST /api/data-baker/round-one-quality/ai/recommend`
- `GET /api/data-baker/round-one-quality/ai/recommend/logs/summary`
- `POST /api/data-baker/round-one-quality/ai/recommend`（默认）
- `GET /api/data-baker/round-one-quality/ai/recommend/debug/:debugId`（同步 recommend 失败时查询脱敏后的原始 AI 返回）
- `POST /api/data-baker/round-one-quality/ai/recommend/jobs`（默认）
- `GET /api/data-baker/round-one-quality/ai/recommend/jobs/:jobId`（默认轮询）
  - `GET /api/data-baker/round-one-quality/ai/recommend/jobs/:jobId/debug`（仅 JSON 解析失败时返回脱敏 debugRawJson）
- `GET /api/data-baker/round-one-quality/export/health`
- `GET /api/data-baker/round-one-quality/export/config`
- `POST /api/data-baker/round-one-quality/export/upload`
- `GET /api/data-baker/round-one-quality/export/download`
- `HEAD /api/data-baker/round-one-quality/export/download`
- `GET /api/data-baker/round-one-quality/export/list`

`POST /api/data-baker/round-one-quality/ai/recommend` 成功体里的 `lexicon` 当前固定补齐：

- `enabled`
- `status / source / sourceFile / referenceSourceFile / rowCount / warningMessage`
- `rewriteMode / matchedCount / rewriteChanged / rewriteChanges`

## 文件职责

- `../ai/adapter.js`：DataBaker 接入统一 `ai-framework` 的项目 adapter，先负责输入归一和旧 recommend 响应兼容。
- `../data/adapter.js`：DataBaker 脚本级 data adapter，统一收口共享下载轨道所需的数据集元数据、`latest.csv` 路径解析和兼容下载文件名。
- `../data/field-mappings.js`：DataBaker 导出字段口径中心，统一维护 canonical CSV 列、legacy alias 和唯一键字段组。
- `../data/scripts/csv.js`：DataBaker CSV helper，统一 legacy 表头归一、CSV 解析、行数统计和写出。
- `../data/scripts/merge.js`：DataBaker merge helper，统一 CSV 唯一键计算、CSV merge 统计和 rawRecords merge。
- `../data/scripts/download.js`：DataBaker 下载脚本 helper，把 `latest.csv` 转成共享下载 core 可直接消费的 target。
- `../data/scripts/upload.js`：DataBaker 上传字段归一 helper，统一 `export/upload` payload 校验、字段归一和 `rawJson` legacy alias 兼容。
- `../data/scripts/persist.js`：DataBaker 导出持久化 helper，统一 latest/history/events 写入和 meta/event payload 组装。
- `../data/scripts/fetch.js`：DataBaker 导出读取 helper，统一 latest 快照、`latest.json`、history CSV 列表和 `upload-events.jsonl` 读取。
- `index.js`：项目路由注册入口。
- `ai-routes.js`：负责 HTTP health / defaults / recommend / jobs 路由注册；recommend 入口当前已改由统一 `ai-framework` route factory 驱动，但仍保留旧接口响应结构。
- `ai-call-log.js`：DataBaker AI 调用日志桥接层，把旧 recommend 记录归一到共享 `platform-resources/backend/ai-call-log/`，并提供 `logs/summary` 统计。
- `ai-service.js`：DataBaker AI 当前业务层，集中管理请求归一化、Fun-ASR REST 与当前通用链路、prompt、schema 解析、词表、文本归一化、成本估算、调用日志、缓存、队列和推荐响应组装。
- `ai-legacy-omni-service.js`：DataBaker 专用 Qwen Omni legacy 快速路径，参考提交 `9677e4cea98de222b70f89c9e0af1d89971dc471` 恢复旧版两阶段逻辑。
- `ai-client-qwen-legacy.js`：DataBaker 专用 Qwen Omni legacy 客户端，只服务 Omni 快速路径，不影响统一 AI 基座。
- `ai-debug-store.js`：原始 AI 返回的内存级调试信息暂存，默认 TTL 30 分钟、最大 1000 条，不落盘。
- `ai-job-store.js`：DataBaker AI 异步 job 的内存状态管理、超时取消、TTL 清理、debug 原始 JSON 暂存和统计快照。
- `export-routes.js`：导出 health / config / upload / download 路由。当前 `download` 已改为复用 `platform-resources/backend/project-data-download/csv-file-download-core.js`，外部 path 保持不变。
- `export-store.js`：导出 overall store，当前主要保留旧 latest 读取和总体编排；CSV 解析/写出、CSV/raw merge、latest/history/events 持久化都已开始复用 `../data/scripts/*.js`。
- `platform-resources/backend/ai/providers/funasr-rest.js`：按阿里云官方 RESTful API 提交 Fun-ASR 异步任务、轮询任务并拉取转写结果。
- `platform-resources/backend/ai/providers/funasr.js`：统一选择 Fun-ASR `rest/python` provider。
- `platform-resources/backend/ai/python/funasr_client.py`：保留的 Python SDK fallback / 调试脚本。
- `platform-resources/backend/ai/`：统一 AI 基座，提供 Qwen provider、Fun-ASR REST / Python provider、provider 队列、结果缓存和公共脱敏/错误处理。
- `../ai/assets/`：DataBaker AI 资产目录占位；当前仍沿用 `ai-service.js` 与 `backend/reference/`，后续逐步迁移 prompt/rules/schema。
- `../data/assets/`：DataBaker 数据资产目录，当前补充了字段映射说明、upload payload 说明和脱敏样例。
- `../data/README.md`：DataBaker 脚本级 data 目录说明；当前已开始承接下载脚本、upload 字段归一、CSV helper、merge helper、history 读取 helper、字段映射和脱敏样例，不直接迁移运行数据。

## AI 调用日志与统计

- AI 调用 CSV 当前落在：
  - `platform-resources/data-baker/round-one-quality/backend/logs/ai-calls-YYYY-MM-DD.csv`
- `recommend` 与历史兼容 `jobs` 结果都会复用同一套共享日志核心。
- `GET /api/data-baker/round-one-quality/ai/recommend/logs/summary` 当前会返回：
  - 总调用数 / 成功数 / 失败数
  - 输入 Token / 输出 Token / 总 Token 统计
  - 按日期聚合
  - 按 `AI 调用使用人` 聚合
  - 按错误码聚合
- `DATABAKER_AI_CALL_LOG_DIR` 可覆盖默认日志目录。

## 模型

当前前端先选择“识别模式”：

- `two_stage`：显示“听音模型 + 比较模型”
- `omni_single`：只显示“AI 模型”

双模型字段：

- 听音模型：`fun-asr`、`qwen3.5-omni-plus`、`qwen3.5-omni-flash`、`qwen3.5-omni-flash-2026-03-15`、`qwen3-omni-flash`、`qwen3-omni-flash-2025-12-01`、`qwen3-omni-flash-2025-09-15`
- 比较模型：`qwen3.6-plus`、`qwen3.5-plus`、`qwen3.6-flash`、`qwen3.5-flash`

单模型字段：

- AI 模型：`qwen3.5-omni-plus`、`qwen3.5-omni-flash`、`qwen3.5-omni-flash-2026-03-15`、`qwen3-omni-flash`、`qwen3-omni-flash-2025-12-01`、`qwen3-omni-flash-2025-09-15`

环境变量可覆盖：

- `DATABAKER_AI_FUN_ASR_MODEL`
- `DATABAKER_AI_OMNI_MODEL`
- `DATABAKER_AI_COMPARE_MODEL`

## 环境变量

- `DASHSCOPE_API_KEY`：DashScope API Key，真实调用必需；统一后端启动时默认从仓库根目录 `config/env/ai.env` 自动读取。
- `config/env/ai.env`、`config/env/ai.local.env` 为忽略文件；真实生产内容建议只保留密钥和少量非默认覆盖项。
- `DATABAKER_AI_TIMEOUT_MS`：AI 请求超时，默认 `60000`。
- `DATABAKER_AI_OMNI_LEGACY_FAST_PATH`：默认 `1`；开启后上述 DataBaker Omni 模型优先走参考提交 `9677e4cea98de222b70f89c9e0af1d89971dc471` 的 Omni legacy 快速路径。
- `DATABAKER_AI_MOCK`：设为 `1` 时走 mock，可直接写入 `config/env/ai.env`。
- `DATABAKER_AI_ENABLE_THINKING`：默认 `0`，原生 `fetch` 请求体顶层传 `enable_thinking=false` 尝试关闭 thinking；设为 `1` 时不传该字段。
- `DATABAKER_AI_PIPELINE_MODE`：识别模式默认值与历史兼容字段；当前主值是 `two_stage / omni_single`。旧值 `qwen_omni_compare / fun_asr_compare / qwen_omni_two_stage / listen_only` 会迁移到新的识别模式。
- `DATABAKER_AI_FUN_ASR_MODEL`：Fun-ASR 录音文件识别模型，默认 `fun-asr`。
- `DATABAKER_AI_FUN_ASR_PROVIDER`：Fun-ASR provider 模式，默认 `rest`。
- `DATABAKER_AI_FUN_ASR_PROVIDER_FALLBACK`：默认空；仅显式设为 `python` 时，REST 失败后才退回 Python。
- `DATABAKER_AI_FUN_ASR_REST_BASE_URL`：可选，覆盖 Fun-ASR REST API base；留空时按 `DASHSCOPE_BASE_URL` 推导到 `/api/v1`。
- `DATABAKER_AI_OMNI_MODEL`：Qwen Omni 模型默认值；双模型下用于 Omni 听音，单模型下用于 Omni 单模型推荐，默认 `qwen3.5-omni-flash`。
- `DATABAKER_FUNASR_PYTHON_BIN`：可选，显式指定 Python 解释器路径；未设置时优先使用统一虚拟环境 `platform-resources/backend/.venv`。
- `DATABAKER_AI_FUN_ASR_LANGUAGE_HINTS`：Fun-ASR 语言提示，默认 `zh`。
- `DATABAKER_AI_FUN_ASR_POLL_INTERVAL_MS`：Fun-ASR REST 轮询间隔，默认 `1000` ms。
- `DATABAKER_AI_FUN_ASR_ASYNC_JOBS_ENABLED`：历史兼容开关，默认 `0`；当前默认链路不再依赖异步 job。
- `ASC_AI_JOB_TIMEOUT_MS`：共享 AI job 超时，默认 `60000`。仅在历史兼容 job 被显式启用时生效。
- `ASC_AI_JOB_TTL_MS`：共享 AI job 记录保留 TTL，默认 `1800000`（30 分钟）。
- `ASC_AI_JOB_MAX_SIZE`：共享 AI job 最大保留数量，默认 `600`。达到上限时返回“后端 AI 任务队列已满，请稍后重试。”。
- `ASC_AI_JOB_POLL_INTERVAL_MS`：前端轮询 job 状态建议间隔，默认 `1000` ms。
- `DATABAKER_AI_JOB_*`：仅保留历史兼容 fallback；未设置 `ASC_AI_JOB_*` 时才读取。
- `DATABAKER_AI_QWEN_OMNI_RPM_LIMIT`：Qwen Omni 队列限流，默认 `45` RPM。
- `DATABAKER_AI_FUN_ASR_RPM_LIMIT`：Fun-ASR 队列限流，默认 `500` RPM。
- `DATABAKER_AI_TEXT_RPM_LIMIT`：Compare 文本模型队列限流，默认 `500` RPM。
- `DATABAKER_AI_QWEN_OMNI_CONCURRENCY`：Qwen Omni 并发上限，默认 `3`。
- `DATABAKER_AI_FUN_ASR_CONCURRENCY`：Fun-ASR 并发上限，默认 `2`；如 `2 核 2G` 服务器压力高，可继续调低，若资源充足也可手动调高。
- `DATABAKER_AI_TEXT_CONCURRENCY`：Compare 文本模型并发上限，默认 `5`。
- `DATABAKER_AI_PROVIDER_RETRY_MAX`：上游 `429` 指数退避最大重试次数，默认 `3`。
- `DATABAKER_AI_QWEN_SMOOTH_ENABLED`：默认 `0`；为 `1` 时才让 DataBaker Omni legacy 快速路径重新经过 `qwen_omni` / `text_compare` 平滑队列。
- `DATABAKER_AI_QWEN_BURST_RETRY_MAX`：Qwen Omni / compare 阶段识别到 `limit_burst_rate` 后的最大退避重试次数，默认 `0`；需要更稳时可手动设为 `3`。
- `DATABAKER_AI_QWEN_BURST_RETRY_BASE_MS`：Qwen `limit_burst_rate` 首次退避基准延迟，默认 `1200ms`，后续指数退避并带 jitter。
- `DATABAKER_AI_QUEUE_MAX_SIZE`：统一 provider 队列最大长度，默认 `600`。达到上限时返回“后端 AI 任务队列已满，请稍后重试。”。
- `DATABAKER_AI_CACHE_TTL_MS`：推荐结果内存缓存 TTL，默认 `43200000`（12 小时）。
- `DATABAKER_AI_LEXICON_REWRITE_MODE`：词表最终推荐文本改写模式，默认 `aggressive`；设为 `off` 时只保留 prompt 上下文，不做强替换。
- `DATABAKER_AI_CROP_EFFECTIVE_AUDIO`：预留有效音频裁剪开关，默认 `0`。
- `DATABAKER_AI_CROP_PADDING_SECONDS`：预留裁剪前后补齐秒数，默认 `0.12`。
- `DATABAKER_ROUND_ONE_EXPORT_DIR`：导出文件保存目录，默认 `platform-resources/data-baker/round-one-quality/backend/export-data/`。
- `DATABAKER_ROUND_ONE_EXPORT_HISTORY`：设为 `1` 时保存历史 CSV 到 `history/`。
- `DATABAKER_ROUND_ONE_EXPORT_EVENTS`：设为 `1` 时追加 `upload-events.jsonl`。

后端入口 `platform-resources/backend/server.js` 会自动加载：

1. `config/env/ai.env`
2. `config/env/ai.local.env`
3. `.env.local`
4. 可选 `ASC_ENV_FILE` 指向的外部文件

因此本地不需要每次手动 `set DASHSCOPE_API_KEY`。如果 `config/env/ai.env` 和系统环境变量都没有配置 `DASHSCOPE_API_KEY`，且未开启 `DATABAKER_AI_MOCK=1`，health 会返回 `status=missing-api-key`。

未配置 `DASHSCOPE_API_KEY` 且未开启 mock 时：

- health 返回 `status=missing-api-key`。
- recommend 返回 `success=false` 和 `code=missing-api-key`。

## 原始 AI 返回调试

- 批量失败列表会优先使用同步 `recommend` 返回的 `hasRawAiDebug/debugId`，并通过 `GET /ai/recommend/debug/:debugId` 查看脱敏后的原始 AI 返回。
- `qwen-empty-response`、`model-json-parse-failed`、`provider-http-error` 会写入内存级 debug store，并在错误响应中返回 `debugId`。
- `qwen-burst-rate-limited` 也会写入内存级 debug store；debug 中会保留脱敏后的 `providerCode=limit_burst_rate`、`rawSseText`、`stage`、`model`、`requestId`。
- Fun-ASR 错误也会按阶段写入 debug store：
  - `fun_asr_submit`
  - `fun_asr_poll`
  - `fun_asr_transcription_download`
  - `fun_asr_parse`
- Fun-ASR 前端错误会优先区分：鉴权/权限、平台音频 URL 不可访问、模型名错误、上游限流、任务失败、结果下载失败。
- `jobs/:jobId/debug` 仍保留历史兼容，但同步 recommend debug 现在是默认调试入口。
- debug 内容只保存在内存中，默认 TTL 30 分钟，不落盘。
- debug 内容会脱敏并截断，不包含完整音频 URL、签名 URL、cookie、token、authorization、API Key。

## 导出上传与下载

导出下载边界：

- `upload`、`latest.csv` 合并、`latest-raw.json`、history/events 仍由 DataBaker 自己维护。
- `download` 现在内部走统一 `project-data-download` 共享下载 core，继续返回同一个 `latest.csv`，不改前端接口地址。

- 扩展前端在 `group/detail` 导出 CSV 后，会调用：
  - `POST /api/data-baker/round-one-quality/export/upload`
- 后端默认写入：
  - `platform-resources/data-baker/round-one-quality/backend/export-data/latest.csv`
  - `platform-resources/data-baker/round-one-quality/backend/export-data/latest-raw.json`
  - `platform-resources/data-baker/round-one-quality/backend/export-data/latest.json`
- 说明：`latest.csv` 不包含“原始JSON”列；`latest-raw.json` 保存脱敏后的原始记录数组；`latest.json` 保存累计元信息。
- 上传不再覆盖 `latest.csv`，而是按“文本编号”累计合并：
  - 唯一键默认且优先使用 `文本编号`（全局唯一）。
  - 仅当 `文本编号` 为空时才按兜底键（`文件名+段编号`、`文件名`、`采集人+手机号+段编号`、稳定 JSON）合并。
  - 相同文本编号再次上传会更新旧行，不会因任务ID不同而重复新增。
  - 不同任务数据可共存，前提是文本编号不同。
- `taskId/taskIds` 只用于元信息、日志和排查，不参与唯一键判断。
- CSV 表头会把旧字段兼容迁移到新口径：`质检人 -> 质检人_P`，`有效时长` / `有效时长(秒)` / `有效合格时长` -> `有效合格时长_S`，避免重复列。
- 下载接口 `GET/HEAD /api/data-baker/round-one-quality/export/download` 仍返回 `latest.csv`，现在返回的是累计合并总表。
- 下载最新 CSV：
  - `GET /api/data-baker/round-one-quality/export/download`
  - `HEAD /api/data-baker/round-one-quality/export/download`
- 仅当开启 `DATABAKER_ROUND_ONE_EXPORT_HISTORY=1` 时才写入 `history/*.csv` 和对应 `history/*.raw.json`；history 保存的是“本次原始上传文件”，不是累计快照。
- 仅当开启 `DATABAKER_ROUND_ONE_EXPORT_EVENTS=1` 时才写入 `upload-events.jsonl`。
- 上传接口只接受 JSON 且 `csvText` 非空，CSV 超过 `20MB` 会拒绝。
- 上传接口继续兼容 `rawJson`，但内部统一归一到 `rawRecords`。
- 上传接口返回合并统计：`incomingRowCount/existingRowCount/addedRowCount/updatedRowCount/unchangedRowCount/rowCount/taskIds`。
- `export/config` 当前会附带 latest 快照存在性、`latestMeta` 摘要和最近 5 条脱敏 upload events，便于协作者核对运行状态。
- `export/list` 当前返回 history CSV 列表，并补充对应 `*.raw.json` 是否存在。
- 后端日志只输出 `requestId`、`incomingRowCount`、`existingRowCount`、`addedRowCount`、`updatedRowCount`、`rowCount`、`fileName`、`csvPath`、`uploadedAt`、`taskIds`，不打印完整 CSV 内容。

CSV 字段统一口径：

- 新导出的 `latest.csv` 统一使用字段名 `有效合格时长_S`（数据来源仍是 `effectivePassTotalTime`）。
- 历史导出中 `有效合格时长` 属于旧字段名，供兼容识别；新导出不再使用该字段名。
- `export-data/` 属于运行数据目录，不提交 Git。

## 推荐流程

1. 校验请求体中的 `collectId`、`itemId`、`audioUrl`、`pageText`。
2. 生成词表上下文与缓存 key；缓存 key 使用 sha256，不保存完整 `audioUrl`。
3. 命中缓存时直接返回历史推荐；未命中则进入 provider 队列。
4. 听音模型为 `qwen3.5-omni-plus` 或 `qwen3.5-omni-flash`：
   - 默认优先走 Omni legacy 快速路径。
   - 参考提交 `9677e4cea98de222b70f89c9e0af1d89971dc471` 的旧版两阶段逻辑：先调用 Qwen Omni `input_audio` 产出 `heardText`，再调用 compare 模型生成 `recommendedText`。
   - 该路径不走 async job、不走 Fun-ASR REST、不走 Python。
   - 默认按前端并发直接调用 Qwen 上游；前端建任务请求固定不低于 `50ms` 错峰发到后端，但后端不再对 Omni legacy 做平滑排队，除非显式设置 `DATABAKER_AI_QWEN_SMOOTH_ENABLED=1`。
   - 若 SSE 返回 `data: {"error":{"code":"limit_burst_rate"...}}`，后端会识别为上游突发限流，而不是误报成 `qwen-empty-response`。
   - `limit_burst_rate` 默认不自动退避重试；前端直接显示“Qwen 请求突增限流，接口返回请求增长过快，可降低并发或稍后重试。”，并继续保留原始 debug。
5. 听音模型为 `fun-asr`：
   - 先进入 `fun_asr` 队列，由统一基座 `platform-resources/backend/ai/providers/funasr.js` 默认转到 `platform-resources/backend/ai/providers/funasr-rest.js`。
   - Node 端按官方 RESTful API 调用 `fun-asr`：提交异步任务，再轮询任务状态。
   - Fun-ASR 返回 `heardText` 后，再进入 `text_compare` 队列调用 compare 模型生成 `recommendedText`。
   - Python SDK 只在显式设置 `DATABAKER_AI_FUN_ASR_PROVIDER=python` 或 `DATABAKER_AI_FUN_ASR_PROVIDER_FALLBACK=python` 时启用。
6. Fun-ASR / 通用 provider 队列遇到 `429` 仍走统一指数退避 + jitter 重试；但 DataBaker Omni legacy 默认不对 `limit_burst_rate` 自动重试，除非显式设置 `DATABAKER_AI_QWEN_BURST_RETRY_MAX>0` 或开启 `DATABAKER_AI_QWEN_SMOOTH_ENABLED=1`。
7. `two_stage + fun-asr` 的批量连续填入默认短请求创建 `POST /api/data-baker/round-one-quality/ai/recommend/jobs`：
   - 前端按 `50ms` 错峰发起，谁先完成 job，谁先进入待填队列。
   - 前端并发参数只控制最大活跃任务数；后端 queue / RPM 限流仍继续保护 Fun-ASR 与 compare。
   - 同步 recommend 仅保留为兼容 / 调试入口。

8. provider 队列现在同时控制 RPM 和 group 并发：
   - `qwen_omni` 默认并发 `3`
   - `fun_asr` 默认并发 `2`
   - `text_compare` 默认并发 `5`
   这样 Fun-ASR 不再是“上一条完全结束后才启动下一条”的严格串行。
9. 若批量执行时感觉仍像串行，优先检查：
   - `fun_asr.activeCount` 是否能超过 `1`
   - `text_compare.activeCount` 是否能超过 `1`
   - `queueWaitMs` 是不是主要堆在 compare 阶段
10. 对 `heardText` / `recommendedText` 做现有清洗、简繁归一、词表替换与中文句末标点补全。
11. 成功结果写入 TTL 缓存，并组装统一响应，返回模式、模型、队列、缓存、阶段耗时、`requestId` 和调试摘要。

同步 recommend 与异步 jobs 的定位差异：

- 异步 job 超时后会立刻 fail 并 abort；如果底层请求已经返回迟到结果，也只会记录 `ignoredLateResult=true`，不会覆盖 job 状态。
- 批量失败列表统一使用“查看原始AI返回”入口；同步 recommend 失败会优先通过 `debugId` 查询脱敏后的原始 AI 返回。

- 单条“AI 推荐文本”按钮和非 Fun-ASR 批量路径仍可继续使用同步 `POST /ai/recommend`。
- `loadFailureDebugJson` 前端兜底函数已恢复定义；没有 debug 数据时会提示“当前失败项没有可复制的原始 JSON。”，不再出现 `ReferenceError`。
- 如果浏览器里看到大批量 `Failed to fetch`，而后端日志已经显示 Fun-ASR submit/poll 成功，通常不是识别失败，而是同步 HTTP 等待太久导致链路断开。

后端原生 `fetch` 请求默认在请求体顶层传 `enable_thinking=false`，不再使用 OpenAI SDK 风格的 `extra_body.enable_thinking`。如果供应商返回不支持 `enable_thinking` 的 400 错误，后端会移除该字段自动重试一次；如需开启 thinking，可设置 `DATABAKER_AI_ENABLE_THINKING=1`。Fun-ASR 本身没有 thinking 参数，也不会向 REST 或 Python provider 传 `enable_thinking`。

Qwen Omni 听音 + compare 是当前默认链路；`fun-asr` 作为可切换听音模型保留。本仓库不会因为任一链路自动保存、自动提交、批量识别或流转。

听音模型请求中的音频片段格式：

```json
{
  "type": "input_audio",
  "input_audio": {
    "data": "完整音频 URL",
    "format": "wav"
  }
}
```

`format` 会从 URL pathname 后缀推断，支持 `wav`、`mp3`、`aac`、`m4a`、`amr`、`3gp`、`3gpp`，无法识别时默认 `wav`。`data` 必须保留完整音频 URL，包括签名 query 参数，但日志和文档中不得记录完整 URL。Fun-ASR 模式同样只接受 `http/https` 音频 URL；若服务端无法访问平台音频地址，会返回明确错误而不是静默降级。

统一 Python 虚拟环境默认路径：

```powershell
platform-resources\backend\.venv\Scripts\python.exe
platform-resources\backend\.venv\bin\python
```

`.venv` 与 `__pycache__` 都属于本地运行产物，不提交 Git。

## 统一 Python 虚拟环境（.venv）

- 统一后端 Python 虚拟环境固定放在 `platform-resources/backend/.venv`。
- 当前仅在 Fun-ASR Python fallback / 调试模式下使用该目录，后续新增 Python 辅助脚本也优先复用该目录。
- Fun-ASR Python SDK 仅作为 fallback / 调试保留，不提供独立 Python 服务。
- 用户不需要单独运行 `python xxx.py`；统一启动入口始终是 `node platform-resources/backend/server.js`。
- Fun-ASR Python 运行环境统一位于 `platform-resources/backend`，其中依赖文件为 `platform-resources/backend/ai/python/requirements.txt`。
- DataBaker 业务目录不再维护独立 Python 文件、requirements 文件、通用 provider 队列或通用缓存；这些公共能力统一收敛到 `platform-resources/backend/ai/`。
- 详细的 Windows/Linux 创建命令、环境变量、后端重启与验证流程统一见根目录 `README.md`，这里不重复部署主流程。

## 闽南方言字词表

业务词表 JSON 路径：

```text
platform-resources/data-baker/round-one-quality/backend/reference/minnan-lexicon.json
```

参考源 CSV 路径：

```text
platform-resources/data-baker/round-one-quality/backend/reference/minnan-lexicon.csv
```

参考源 CSV 历史表头至少包含 `编号`、`建议用字`、`对应华语`。这些表头只保留给人工整理、导入和外部 AI 处理，不再作为运行时主读取字段。

词表有两层用途：

1. prompt 上下文：听音 prompt 会先注入基础易混规则，再按 `pageText` 筛选最多 40 条上下文；对比 prompt 会结合 `pageText` 与 `heardText` 筛选最多 60 条上下文。
2. 最终推荐文本强替换：默认 `aggressive`，按“对应华语 -> 建议用字”做长词优先替换，例如 `他 -> 伊`、`喜欢 -> 欢喜`、`的 -> 诶`。

Prompt 简繁规则（2026-05-17 热修）：

- 听音输出 `heardText` 与推荐输出 `recommendedText` 的普通中文字符要求统一为简体中文。
- 若 `pageText`、`heardText` 出现普通繁体字，推荐文本应转换为普通简体字形。
- `minnan-lexicon.json` 位于 `backend/reference/` 目录，作为 DataBaker 业务词表运行时主文件，不属于统一 AI 基座。
- `minnan-lexicon.csv` 继续保留为参考源。
- `minnan-lexicon.json` 命中的“建议用字”不参与普通简繁转换，命中后必须保留。
- 词表建议用字优先于普通简繁转换，不可把方言建议字形改回普通话同义词。

后端结果归一化补充（2026-05-18 热修）：

- 除了 prompt 约束，后端会在模型返回后对 `heardText` 和 `recommendedText` 再做一次普通繁体转简体归一化。
- 归一化前会先保护词表建议用字（来自 `BASE_ENTRIES + minnan-lexicon.json`），归一化后再恢复，避免方言建议用字被覆盖。
- `pageText` 保持页面原始文本，不做改写，仅作为比较输入来源。
- 若显式切到 Python provider，`platform-resources/backend/ai/python/funasr_client.py` 还会在 Python 阶段先用 `opencc-python-reimplemented`（OpenCC `t2s`）做一轮繁转简；如果 OpenCC 不可用，再退回内置映射。
- 默认 REST provider 下，`two_stage + fun-asr` 的 `heardText` 主要在 DataBaker 结果组装阶段做统一繁转简；Python provider 时则会再多一层“Python 源头繁转简”。
- `阮 / 汝 / 伊 / 诶` 等命中词表建议用字的字符会继续保留，不改回普通话同义词。

强替换只修改返回给前端展示的 `recommendedText`，不会修改原始 `pageText`，也不会触发自动保存、自动提交、批量识别或流转。后端会对 `heardText` 和最终 `recommendedText` 删除空格、Tab、换行和全角空格，日志记录的也是清理后的文本，不额外保存清理前文本。可通过 `DATABAKER_AI_LEXICON_REWRITE_MODE=off` 关闭强替换，只保留 prompt 上下文。词表缺失时后端仍可运行，但会跳过 JSON 主词表上下文，推荐效果可能下降。后续更新词条内容时应先维护 JSON 主词表，CSV 只作参考源保留，不要把词表内容硬编码进 JS。

词表清洗规则：

- 中文括号和英文括号中的内容全部视为拼音或批注，例如 `家（gei、dao）、厝（cuo）` 会清洗为 `家`、`厝`，`床（眠床）(min ceng)` 会清洗为 `床`。
- 拉丁字母、拼音音调字母、数字注音和残留连接符不会参与 prompt 上下文匹配或强替换。
- CSV 来源的单字“对应华语”默认不进入强替换规则，避免把 `家庭` 误改成 `厝庭` 之类的异常文本。
- 基础高频单字仍由 `BASE_ENTRIES` 显式控制，例如 `我 -> 阮`、`你 -> 汝`、`他 -> 伊`、`的 -> 诶`、`很 -> 真`、`吃 -> 食`。
- 如果出现异常替换，优先检查 `minnan-lexicon.json` 与参考源 `minnan-lexicon.csv` 中是否存在词条整理偏差、括号批注、拼音残留或单字映射问题。

PowerShell 下可用以下命令做最小清洗回归：

```powershell
@'
const { __testOnly } = require('./platform-resources/data-baker/round-one-quality/backend/ai-service');
console.log(__testOnly.splitTerms('家（gei、dao）、厝（cuo）'));
console.log(__testOnly.splitTerms('透早(tao za )'));
'@ | node -
```

## 真实调用排查

如果前端显示 `Qwen 接口请求失败（HTTP 400）` 或 `Fun-ASR 音频不可访问`：

1. 先查看后端返回给前端的 `summary`，该字段已脱敏，不应包含完整音频 URL、token、cookie、`OSSAccessKeyId` 或 `Signature`。
2. 确认 `qwen3.5-omni-plus` / `qwen3.5-omni-flash` 听音链路使用的是 Qwen Omni `input_audio`，不是旧的 `audio_url`。
3. 确认 Fun-ASR 走的是 REST 录音文件识别提交/查询链路（默认），或在显式切换时走 Python SDK fallback，而不是 OpenAI-compatible chat 模型。
4. 确认当前音频 URL 在服务端可访问，且签名参数没有过期。
5. 确认 `config/env/ai.env` 中 `DASHSCOPE_API_KEY` 正确。
6. 检查 health/defaults 中的队列、重试、deprecated mode 提示与缓存统计，确认前后端模式口径一致。
7. 将 `DATABAKER_AI_MOCK=1` 写入 `config/env/ai.env` 后重启后端，可排除前端、路由和日志链路问题。

Fun-ASR `403` 的常见原因：

- DashScope 权限未开通或地域不匹配
- API Key 对 `fun-asr` 无权限
- 平台签名 `audioUrl` 对 Fun-ASR 服务不可访问
- 调用参数错误

若需要先恢复可用性，优先切回 `qwen3.5-omni-flash` 或 `qwen3.5-omni-plus` 作为听音模型。

## 日志安全

每次 recommend 调用都会尝试写入：

- `platform-resources/data-baker/round-one-quality/backend/logs/recommend-calls.jsonl`
- `platform-resources/data-baker/round-one-quality/backend/logs/recommend-calls.csv`

可通过 `DATABAKER_AI_CALL_LOG_DIR` 覆盖日志目录。JSONL 保留英文 key，便于后续程序处理；CSV 新建时写入中文表头，字段包含标注员、token、费用、有效时间、音频总时长、mock 状态、流水线模式、词表改写明细、听音阶段耗时、对比阶段耗时和错误信息。已有旧 CSV 文件第一版不自动迁移，删除旧文件后会按中文表头重新创建。

`mock=true` 的耗时只代表本地 mock 链路，不代表真实 Qwen 听音 / 对比耗时；真实调用应以 `mock=false` 记录中的 `listenDurationMs`、`compareDurationMs` 和总 `durationMs` 为准。

后端日志只允许输出：

- `requestId`
- 音频 `hostname`
- `sentenceNumber`
- `pipelineMode`
- `listenModel`
- `compareModel`
- 是否 mock

不得输出：

- 完整 `audioUrl`
- access token
- cookie
- `OSSAccessKeyId`
- `Signature`
- API Key

## 费用估算

费用字段仅用于调试展示，不参与业务判断。

- 收入估算：`effectiveTime / 3600 * 350`
- AI 成本：按 usage token 估算。
- 价格表当前已合并到 `ai-service.js` 中维护，并标注“按当前测试估算，可后续调整”。
- 如果模型 usage 未返回或未解析，`cost.note` 会提示成本可能低估。

## 有效音频裁剪

第一版默认不启用裁剪。已保留环境变量：

- `DATABAKER_AI_CROP_EFFECTIVE_AUDIO`
- `DATABAKER_AI_CROP_PADDING_SECONDS`

后续如启用裁剪，需要下载完整音频、按有效起止时间裁剪、转 16k 单声道 wav、base64 传给 Qwen；裁剪失败必须 fallback 到完整 `audioUrl`，且全过程不得记录完整音频 URL。

## latest.csv 表头兼容迁移

- DataBaker 后端合并 `latest.csv` 时会把旧表头兼容迁移到新口径：`质检人 -> 质检人_P`，`有效时长` / `有效合格时长` -> `有效合格时长_S`。
- 下一次上传或合并后，写出的 `latest.csv` 只保留新字段，不再同时输出旧字段重复列。
- `文本编号` 仍是唯一键；CSV 继续使用 UTF-8 BOM 和标准 CSV 转义。

## 批量 recommend 去重

- DataBaker 批量连续填入默认走 `POST /api/data-baker/round-one-quality/ai/recommend/jobs`。
- 当前页 N 条唯一合格项会发送 N 条建任务请求；前端默认按 50ms 错峰发起，并继续由前端并发上限控制活跃任务数。
- 批量请求会附带 `batchRunId`、`batchItemIndex`、`batchProcessKey`、`clientRequestId`。
- 后端新增内存级 in-flight 去重：仅当 `batchRunId + batchProcessKey` 同时存在时启用，避免旧 content runtime 或重复点击导致同一题重复打上游模型。
- health 返回 `dedupe.activeCount/joinedCount/completedCount/failedCount/maxSize/ttlMs`，排查重复请求时优先看悬浮窗的“唯一任务数/重复跳过”和 health 的 `dedupe.joinedCount`。

# 统一 AI 基座

`platform-resources/backend/ai/` 用于放统一后端的公共 AI 能力。

当前目录结构：

- `config.js`：统一读取 DashScope、Fun-ASR provider 模式、REST API base、限流、Python 运行环境，以及 DataBaker 识别模式、听音模型、单模型、比较模型白名单配置。
- `model-catalog.js`：统一模型注册表；维护模型名、官方文档、费用文档、family、tier、thinking 默认策略和运行时顺序。
- `model-dispatcher.js`：统一模型调度层；按模型名决定走 JS 还是 Python 实现，并提供 `getModelMeta / listModelsByFamily / invokeModel / getModelDocs`。
- `sanitizer.js`：统一脱敏工具，避免日志输出完整音频 URL、签名 URL、token、cookie。
- `errors.js`：统一 provider / Python 运行时错误包装。
- `provider-queue.js`：统一 provider 限流队列，当前支持 `qwen_omni`、`fun_asr`、`text_compare`，同时支持每个 group 独立 `maxConcurrent`。
- `result-cache.js`：统一 TTL 内存缓存与缓存 key 生成。
- `usage.js`：通用 usage 归一化。
- `smoke-test-provider-queue.js`：本地并发自测脚本，用于验证 `fun_asr` 组在不同 `maxConcurrent` 下是否真正并发。
- `providers/qwen-openai-compatible.js`：DashScope OpenAI-compatible `/chat/completions` 调用封装，支持文本比较和 Omni `input_audio`。
- `providers/qwen-python.js`：Qwen Python 通道 wrapper；Node 通过子进程调用 `python/qwen_openai_client.py`，用于文本比较和 Omni `input_audio` 的 Python 备用链路。
- `providers/funasr-rest.js`：Node 直接调用 Fun-ASR RESTful API，负责提交异步任务、轮询任务状态、下载 `transcription_url` 并提取单条 `heardText`。
- `providers/funasr-python.js`：Node 通过 `child_process` 调用 Python Fun-ASR SDK 的统一 wrapper，并显式设置 `PYTHONIOENCODING=utf-8` / `PYTHONUTF8=1`。
- `providers/funasr.js`：统一 Fun-ASR 入口，负责 `rest/python` provider 选择与显式 fallback。
- `python/funasr_client.py`：Fun-ASR Python SDK 辅助脚本。
- `python/qwen_openai_client.py`：Qwen OpenAI-compatible Python 辅助脚本。
- `python/requirements.txt`：Fun-ASR Python 依赖，当前包含 `dashscope` 与 `opencc-python-reimplemented`。

边界规则：

- 这里不放具体平台 Prompt。
- 这里不放具体平台字段归一化。
- 这里不放具体平台推荐结果组装。
- 平台目录只保留自己的业务编排、Prompt、schema、词表、结果组装。

统一模型规则：

- 百炼核心模型统一只在 `model-catalog.js` 注册，不再允许每个平台长期手写一份完整模型清单。
- 当前统一注册的核心模型固定为：
  - 文本：`qwen3.6-plus`、`qwen3.5-plus`、`qwen3.6-flash`、`qwen3.5-flash`
  - 多模态：`qwen3.5-omni-plus`、`qwen3.5-omni-flash`
  - 语音识别：`fun-asr`
- 默认运行时顺序统一为 `JS 优先，Python 备用`。
- thinking 默认统一关闭；模型元数据只记录“是否支持 thinking”，不把开启 thinking 作为默认路径。
- 旧的 `qwen3-omni-flash*` / dated Omni 型号仍可作为兼容旧配置被识别，但不再作为统一模型目录的推荐选项。

当前接入平台：

- DataBaker 闽南语助手

当前 DataBaker 业务层结构：

- `platform-resources/data-baker/round-one-quality/backend/ai-routes.js`：HTTP 路由
- `platform-resources/data-baker/round-one-quality/backend/ai-service.js`：DataBaker 专属业务编排
- `platform-resources/data-baker/round-one-quality/backend/reference/minnan-lexicon.csv`：DataBaker 词表参考资料

统一启动口径：

- 仍然只启动 Node 后端：`node platform-resources/backend/server.js`
- 统一 AI / 模型请求默认超时时间为 `60000ms`；非 AI 接口超时另按业务设置。
- Fun-ASR 默认 provider 是 Node REST，不启动 Python 子进程。
- Python 不作为独立服务启动；只在显式切到 `DATABAKER_AI_FUN_ASR_PROVIDER=python` 或 `DATABAKER_AI_FUN_ASR_PROVIDER_FALLBACK=python` 时作为统一 Node 后端内部辅助进程。
- Fun-ASR REST 是异步任务模式：`POST /services/audio/asr/transcription` 提交任务，`POST /tasks/{task_id}` 查询任务；本轮只实现单条 REST 调用，不启用 `file_urls` batch。
- `funasr_client.py` 的 stdout JSON 必须稳定按 UTF-8 输出；`funasr-python.js` 必须按 UTF-8 解码 stdout/stderr，避免 Windows 下出现 `�` / 黑菱形乱码。
- `funasr_client.py` 会先用 OpenCC `t2s`（不可用时退回内置映射）把 Fun-ASR `heardText` 统一转为简体；DataBaker 业务层还会再按词表保护规则做一次兜底转换。
- `阮 / 汝 / 伊 / 诶` 等闽南词表建议用字不属于统一 AI 基座内置词表，但 DataBaker 业务层会在二次兜底时保护这些建议字形。
- Fun-ASR 没有 thinking 参数；thinking 只影响 Qwen Omni / compare 阶段。
- Fun-ASR 并发由 `DATABAKER_AI_FUN_ASR_CONCURRENCY` 控制，默认 `2`；如 `2 核 2G` 服务器压力高可继续调低，若资源充足也可手动调高。
- `provider-queue.js` 现在会返回并记录 `pendingCount / activeCount / maxConcurrent / queueWaitMs / durationMs`，用于判断瓶颈是在前端发起、Fun-ASR 队列还是 compare 阶段。
- `providers/funasr-rest.js` 会记录 `[FunASR][REST] submit start/finish` 与 `[FunASR][REST] poll start/finish`；不会输出完整 `audioUrl`、token 或 API Key。
- `providers/funasr-python.js` 会记录 `[FunASR] spawn start/finish`；不会输出完整 `audioUrl`、token 或 API Key。
- DataBaker 前端“AI连续填入合格项并发数量”是浏览器同时发往统一后端的请求数，当前按模型动态归一：
  - Omni：默认 `5`，范围 `1~25`
  - Fun-ASR：默认 `5`，范围 `1~50`
- 前端和后端都会对超范围值做归一；请求体会携带 `frontConcurrency / batchConcurrency / concurrencyModelType` 作为诊断字段，但不会传进模型 Prompt。
- DataBaker `two_stage + fun-asr` 的批量连续填入默认先创建 recommend jobs；前端按 `50ms` 错峰发起并用前端活跃并发上限控制节奏，后端继续通过 provider queue / RPM 限流保护上游。
- Fun-ASR 错误现在会细分为鉴权/权限、音频 URL 不可访问、模型名错误、上游限流、任务失败、转写结果下载失败和通用 provider error；失败仍保留“查看原始AI返回”入口。
- Qwen provider 与 DataBaker Omni legacy client 现在都会识别 SSE `data: {"error": ...}`。若 `error.code/type` 为 `limit_burst_rate`、`throttling`、`rate_limit`、`limit_requests`、`TooManyRequests`，会按上游限流分类，而不是误判成空文本。
- DataBaker Omni legacy 快速路径默认不再把 Qwen 上游平滑进 `qwen_omni` / `text_compare` 队列；前端并发多少就直接发送多少。仅当 `DATABAKER_AI_QWEN_SMOOTH_ENABLED=1` 时，才会重新启用 Qwen 平滑队列。
- `DATABAKER_AI_QWEN_BURST_RETRY_MAX` 默认 `0`，即 `limit_burst_rate` 默认不自动退避重试，只暴露真实错误并保留 debug；如需更稳，可手动设为 `3` 并配合 `DATABAKER_AI_QWEN_BURST_RETRY_BASE_MS`。
- DataBaker 异步 job 默认上限仍为 `600`，provider queue 默认上限也同步为 `600`；当前 jobs 已是默认 AI 结果接收方案，同步 recommend 只保留兼容 / 调试入口。
- 单个异步 job 默认超时 `60000ms`，超时后会通过 `AbortController` 取消或逻辑丢弃迟到结果，并固定提示“当前任务超过60s，请重新请求。”。默认 AI 结果接收链路为“短请求创建 job + 轮询状态”。
- DataBaker 模型输出 JSON 解析失败时，会保留脱敏后的 `debugRawJson`，供前端“复制原始JSON”按钮通过 `/ai/recommend/jobs/:jobId/debug` 拉取。



# Abaka AI Task21 后端 AI 调试说明

## 接口

- `GET /api/abaka-ai/task21/ai/health`
- `GET /api/abaka-ai/task21/ai/defaults`
- `POST /api/abaka-ai/task21/ai/analyze`
- `GET /api/abaka-ai/task21/ai/analyze/logs/summary`

## 统一 AI framework 桥接状态

- 当前阶段采用桥接式迁移，不直接重写 Task21 原有两阶段视觉业务层。
- `POST /api/abaka-ai/task21/ai/analyze` 已改为通过 `platform-resources/backend/ai-framework/` route factory 驱动。
- `platform-resources/abaka-ai/task21/ai/adapter.js` 负责：
  - 请求映射到统一输入契约
  - 旧 success / error body 兼容
  - `result` 暴露给 framework 的脚本级结果通道
- `platform-resources/abaka-ai/task21/backend/ai-analyze-request.js` 负责 analyze 请求归一与运行时模型选项解析，供 adapter 与业务层共用。
- `GET /health`、`GET /defaults` 当前仍走旧实现；Prompt 与规则暂时仍保留在 `backend/prompt.js`、`backend/ai/prompt.md`。
- `platform-resources/abaka-ai/task21/ai/assets/` 当前是资产目录占位，后续再逐步迁移 prompt / rules / schema / defaults。

## AI 调用日志与统计

- Task21 当前已默认记录每次 `analyze` 调用。
- `health/defaults` 当前已补齐公共 jobs / runtime 元信息，默认链路为 `POST /jobs` + 轮询 `GET /jobs/:jobId`，同步 `analyze` 只保留兼容 / 调试入口。
- 日志文件：
  - `platform-resources/abaka-ai/task21/backend/logs/ai-calls-YYYY-MM-DD.csv`
- 统计接口：
  - `GET /api/abaka-ai/task21/ai/analyze/logs/summary`

## 分析方案

- `two_stage`（默认）：
  - 阶段一 `vision_extract`：视觉模型只提取事实（visual observations）。
  - 可选阶段 `ocr_extract`：OCR 模型提取图片文字线索（默认关闭）。
  - 阶段二 `reasoning_decide`：推理模型按 Task21 规则输出最终建议。
- `single_model`（保留）：
  - 单模型一次完成图像理解与规则判断。

默认模型：
- 视觉阶段：`qwen3.6-plus`
- 推理阶段：`qwen3.6-plus`
- 单模型：`qwen3.6-plus`
- OCR：默认关闭，`ABAKA_TASK21_AI_OCR_MODEL` 默认为空

候选模型：
- 视觉/单模型：`qwen3.6-plus`、`qwen3.6-flash`、`qwen3-vl-plus`、`qwen3-vl-flash`、`qwen3.5-plus`、`qwen3.5-flash`、`qwen-vl-max`、`qwen-vl-plus`
- 推理：`qwen3.6-plus`、`qwen3.6-flash`、`qwen3.5-plus`、`qwen3.5-flash`
- 旧名 `qwen-vl-max-latest`、`qwen-vl-ocr-latest`、`qvq-plus-latest` 不再作为默认或候选

## 前端可传调试参数

请求体可通过 `options` 或 `debugConfig` 传入：

- `analysisMode`
- `visionModel`
- `ocrEnabled`
- `ocrModel`
- `reasoningModel`
- `singleModel`
- `enableThinking`
- `timeoutMs`

后端规则：

- `analysisMode` 仅允许 `two_stage | single_model`，默认 `two_stage`。
- `timeoutMs` 强制限制到 `1000~300000`。
- 模型 override 仅在 `ABAKA_TASK21_AI_ALLOW_CLIENT_MODEL_OVERRIDE=true` 时生效，且必须命中对应白名单。
- `enableThinking` 默认 `false`，并显式发送 `enable_thinking=false`。
- 对支持 thinking 的模型显式发送 `enable_thinking=true/false`；不支持或未知时不强传，并在调试信息标记 `notApplicable` 或 `model-thinking-support-unknown`。

## thinking 参数策略

- 默认始终显式发送：`enable_thinking=false`。
- 用户开启后显式发送：`enable_thinking=true`。
- 如果模型/接口不支持该参数：
  - 默认直接返回清晰错误（不静默移除）。
  - 仅当 `ABAKA_TASK21_AI_ALLOW_THINKING_PARAM_FALLBACK=true` 时，才允许移除参数重试，并返回 `fallbackUsed=true`。

## 环境变量（Abaka Task21）

- `ABAKA_TASK21_AI_MOCK`
- `ABAKA_TASK21_AI_ANALYSIS_MODE`
- `ABAKA_TASK21_AI_VISION_MODEL`
- `ABAKA_TASK21_AI_OCR_ENABLED`
- `ABAKA_TASK21_AI_OCR_MODEL`
- `ABAKA_TASK21_AI_REASONING_MODEL`
- `ABAKA_TASK21_AI_SINGLE_MODEL`
- `ABAKA_TASK21_AI_MODEL`（旧变量，singleModel 兼容回退）
- `ABAKA_TASK21_AI_ALLOWED_VISION_MODELS`
- `ABAKA_TASK21_AI_ALLOWED_OCR_MODELS`
- `ABAKA_TASK21_AI_ALLOWED_REASONING_MODELS`
- `ABAKA_TASK21_AI_ALLOWED_SINGLE_MODELS`
- `ABAKA_TASK21_AI_TIMEOUT_MS`：AI 请求超时，默认 `60000`。
- `ABAKA_TASK21_AI_ALLOW_CLIENT_MODEL_OVERRIDE`
- `ABAKA_TASK21_AI_ENABLE_THINKING`
- `ABAKA_TASK21_AI_ALLOW_THINKING_PARAM_FALLBACK`

## 安全边界

- 前端不保存 API Key；后端只从 `DASHSCOPE_API_KEY` 读取。
- 不输出 token/cookie/authorization/完整图片 URL/完整 dataUrl。
- AI 仅输出建议，不自动写入、不自动保存、不自动提交。

# 闽南语助手后端（Magic Data）

## 路由

- `GET /api/magic-data/minnan-helper/ai/review-current/health`
- `GET /api/magic-data/minnan-helper/ai/defaults`
- `POST /api/magic-data/minnan-helper/ai/review-current`
- `GET /api/magic-data/minnan-helper/ai/review-current/logs/summary`

## 当前迁移状态

- `POST /api/magic-data/minnan-helper/ai/review-current` 当前已改为通过统一 `platform-resources/backend/ai-framework/` route factory 驱动。
- 对外成功 / 失败响应结构保持原兼容形态：
  - 成功：`success + data + cache + backend`
  - 失败：`success + requestId + code + message + scriptId (+ summary)`
- 成功体 `data.lexicon` 当前继续返回 `enabled / status / matchedCount / matches / rewriteMode`；前端顶部摘要区直接用这组字段展示 `词表状态与模式`。
- `health/defaults` 当前已补齐公共 jobs / runtime 元信息：默认链路为 `POST /jobs` + 轮询 `GET /jobs/:jobId`，并附带共享模型池默认策略。

## AI 调用日志与统计

- 闽南语助手当前已默认记录 AI 质检调用。
- 日志文件：
  - `platform-resources/magic-data/minnan-helper/backend/logs/ai-calls-YYYY-MM-DD.csv`
- 统计接口：
  - `GET /api/magic-data/minnan-helper/ai/review-current/logs/summary`
- `MAGIC_DATA_MINNAN_AI_CALL_LOG_DIR` 或 `MAGIC_DATA_AI_CALL_LOG_DIR` 可覆盖默认日志目录。

## 识别模式

- `two_stage + fun-asr`：Fun-ASR 听音 + compare 模型复核。
- `two_stage + Qwen Omni`：Qwen Omni 听音 + compare 模型复核。
- `omni_single + Qwen Omni`：单模型一次完成听音与两行文本复核。
- `recognition_convert`：先将闽南语语音识别为普通话，再结合词表转换为闽南语，最后执行三项质检。

## 词表

- `./lexicon/minnan-lexicon.json`
- `./lexicon/minnan-lexicon.csv`（参考源）
- 可用 `tools/convert-hakka-lexicon.js`（兼容脚本名，输出已改为闽南语词表路径）转换自定义表格。

## 配置（优先级：MINNAN 前缀 > 旧通用前缀）

- `MAGIC_DATA_MINNAN_AI_LISTEN_MODEL`（fallback: `MAGIC_DATA_AI_LISTEN_MODEL`）
- `MAGIC_DATA_MINNAN_AI_OMNI_MODEL`（fallback: `MAGIC_DATA_AI_LISTEN_MODEL`）
- `MAGIC_DATA_MINNAN_AI_COMPARE_MODEL`（fallback: `MAGIC_DATA_AI_COMPARE_MODEL`）
- `MAGIC_DATA_MINNAN_AI_PIPELINE_MODE`（`two_stage | omni_single | recognition_convert`）
- `MAGIC_DATA_MINNAN_AI_FUN_ASR_MODEL`（默认 `fun-asr`）
- `MAGIC_DATA_MINNAN_AI_FUN_ASR_PROVIDER`（默认 `rest`）
- `MAGIC_DATA_MINNAN_AI_FUN_ASR_PROVIDER_FALLBACK`（可选 `python`）
- `MAGIC_DATA_MINNAN_AI_FUN_ASR_REST_BASE_URL`
- `MAGIC_DATA_MINNAN_AI_FUN_ASR_POLL_INTERVAL_MS`
- `MAGIC_DATA_MINNAN_AI_TIMEOUT_MS`（fallback: `MAGIC_DATA_AI_TIMEOUT_MS`）
- `MAGIC_DATA_MINNAN_AI_ENABLE_THINKING`（fallback: `MAGIC_DATA_AI_ENABLE_THINKING`）
- `MAGIC_DATA_MINNAN_AI_MOCK`（fallback: `MAGIC_DATA_AI_MOCK`）
- `MAGIC_DATA_MINNAN_AI_ALLOW_CLIENT_MODEL_OVERRIDE`
- `MAGIC_DATA_MINNAN_AI_LEXICON_REWRITE_MODE`
- `MAGIC_DATA_MINNAN_AI_CACHE_TTL_MS`
- `MAGIC_DATA_MINNAN_AI_CALL_LOG_DIR`（fallback: `MAGIC_DATA_AI_CALL_LOG_DIR`）

## 安全边界

- 不记录完整签名音频 URL、token、cookie、authorization、API Key。
- 只提供 AI 建议，不触发平台保存/提交/审核/流转接口。

# 客家话助手后端（Magic Data）

## 路由

- 新接口：
  - `GET /api/magic-data/hakka-helper/ai/review-current/health`
  - `GET /api/magic-data/hakka-helper/ai/defaults`
  - `POST /api/magic-data/hakka-helper/ai/review-current`
  - `GET /api/magic-data/hakka-helper/ai/review-current/logs/summary`
- 兼容旧接口：
  - `GET /api/magic-data/annotator/ai/review-current/health`
  - `GET /api/magic-data/annotator/ai/defaults`
  - `POST /api/magic-data/annotator/ai/review-current`
  - `GET /api/magic-data/annotator/ai/review-current/logs/summary`

## 当前迁移状态

- `POST /api/magic-data/hakka-helper/ai/review-current` 当前已改为通过统一 `platform-resources/backend/ai-framework/` route factory 驱动。
- legacy `annotator` 兼容路径继续保留，并与新路径共用同一条 framework 桥接链路。
- 对外成功 / 失败响应结构保持原兼容形态：
  - 成功：`success + data`
  - 失败：`success + requestId + code + message (+ summary)`
- 成功体 `data.lexicon` 当前继续返回 `enabled / status / matchedCount / matches`，并新增 `rewriteMode`，用于前端统一展示 `词表状态与模式`。
- `data.lexicon.rewriteMode` 当前默认返回 `exact`。
- `mandarin_to_dialect` 当前已真正接入识别转换链路：
  - 听音阶段先输出普通话识别文本
  - 比较阶段会携带词表转换出的客家话候选
  - 响应中 `recognitionConvert.convertedDialectText` 为最终正字归一化后的客家话建议
- `health/defaults` 当前已补齐公共 jobs / runtime 元信息：默认链路为 `POST /jobs` + 轮询 `GET /jobs/:jobId`，并附带共享模型池默认策略。

## AI 调用日志与统计

- 客家话助手当前已默认记录 AI 质检调用。
- 日志文件：
  - `platform-resources/magic-data/hakka-helper/backend/logs/ai-calls-YYYY-MM-DD.csv`
- 统计接口：
  - `GET /api/magic-data/hakka-helper/ai/review-current/logs/summary`
  - `GET /api/magic-data/annotator/ai/review-current/logs/summary`
- `MAGIC_DATA_HAKKA_AI_CALL_LOG_DIR` 或 `MAGIC_DATA_AI_CALL_LOG_DIR` 可覆盖默认日志目录。

## 词表

- `./lexicon/hakka-lexicon.json`
- `./lexicon/hakka-lexicon.csv`（参考源）
- `hakka-lexicon.json` 为运行时主词表，继续复用 `platform-resources/backend/business-lexicon.js` 校验。
- 客家话最终建议文本当前只对以下字段做 `exact` 正字归一化：
  - `dialectTextCheck.suggestedValue`
  - `recommendations.dialectText`
  - `recognitionConvert.convertedDialectText`（仅 `mandarin_to_dialect`）
- `audioCheck.heardDialectText` 保持听音证据原样，不参与正字归一化。

## 配置（优先级：HAKKA 前缀 > 旧通用前缀）

- `MAGIC_DATA_HAKKA_AI_LISTEN_MODEL`（fallback: `MAGIC_DATA_AI_LISTEN_MODEL`）
- `MAGIC_DATA_HAKKA_AI_COMPARE_MODEL`（fallback: `MAGIC_DATA_AI_COMPARE_MODEL`）
- `MAGIC_DATA_HAKKA_AI_TIMEOUT_MS`（fallback: `MAGIC_DATA_AI_TIMEOUT_MS`）
- `MAGIC_DATA_HAKKA_AI_ENABLE_THINKING`（fallback: `MAGIC_DATA_AI_ENABLE_THINKING`）
- `MAGIC_DATA_HAKKA_AI_MOCK`（fallback: `MAGIC_DATA_AI_MOCK`）
- `MAGIC_DATA_HAKKA_AI_CALL_LOG_DIR`（fallback: `MAGIC_DATA_AI_CALL_LOG_DIR`）
- `MAGIC_DATA_HAKKA_AI_LEXICON_REWRITE_MODE`（fallback: `MAGIC_DATA_AI_LEXICON_REWRITE_MODE`，默认 `exact`）

## 默认配置

- `modelMode`: `two_stage`
- `recognitionStrategy`: `direct_dialect`
- `listenModel`: `qwen3.5-omni-flash`
- `compareModel`: `qwen3.5-flash`
- `enable_thinking`: `false`

候选配置：

- 高质量：`direct_dialect + qwen3.5-plus`
- 普通话优先：`mandarin_to_dialect + qwen3.5-plus`

## 安全边界

- 不记录完整签名音频 URL、token、cookie、authorization、API Key。
- 只提供 AI 建议，不触发平台保存/提交/审核/流转接口。

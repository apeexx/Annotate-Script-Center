# Aishell Tech 粤语助手资料

## 目录职责

- `backend/`：粤语助手独立三阶段 recommend 与任务接口。
- `data/`：粤语助手 AI 调用日志定义与运行时 CSV 目录。

## 当前口径

- 内部脚本 ID：`aishellTechCantoneseAssistant`。
- 与 Aishell Tech 其他已注册脚本互斥，启用状态由 `platforms.aishellTech.activeScriptId` 管理。
- 按“转换候选 + 听音转写 + 比较决策”生成繁体粤语口语；不接闽南语词表、不翻译成普通话。
- 默认模型为 `qwen3.5-plus / qwen3.5-omni-flash / qwen3.5-plus`；转换和听音并发，比较随后执行，thinking 始终关闭。
- 听音为 Fun-ASR 时强制改用 Omni 音频比较，最终语速来自音频；Qwen 比较保留听音语速。
- 输出严格使用 `text + speed`，其中 `speed` 仅允许 `slow / normal / fast`。
- 平台通用 Network 与 DOM 资料以 `platform-resources/aishell-tech/network/` 和 `platform-resources/aishell-tech/page-structure/` 为准；若真实页面字段差异，仅调整粤语运行时选择器。

## 接口与日志

- 接口根路径：`/api/aishell-tech/cantonese-helper/ai/recommend`。
- `GET /health`、`GET /defaults`、`POST /recommend` 均可用于兼容或调试；默认运行链路为 `POST /jobs` 后轮询 `GET /jobs/:jobId`。
- 还提供 `GET /jobs/:jobId/debug`、`POST /jobs/:jobId/cancel` 及 `GET /logs/summary`；不使用 SSE 或 WebSocket。
- 成功响应返回 `data.convertedText`、`data.heardText`、`data.recommendedText`、`data.recommendedSpeed`、`data.referenceText` 与分阶段 `meta.usage / meta.cost`。
- AI 日志数据集 ID：`aishell-tech-cantonese-helper-ai`。
- 运行时日志目录：`platform-resources/aishell-tech/cantonese-helper/data/runtime/`。
- CSV 按转换、听音、比较分别记录模型、Token 和预估人民币，并记录取消、阶段、排队、重试和缓存摘要。

## 安全边界

- 不保留真实 token、cookie、authorization 或完整音频 URL。
- `data/runtime/` 下的运行文件不提交 Git。

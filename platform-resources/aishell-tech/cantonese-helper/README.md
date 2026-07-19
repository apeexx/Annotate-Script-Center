# Aishell Tech 粤语助手资料

## 目录职责

- `backend/`：粤语助手独立同步 recommend 接口。
- `data/`：粤语助手 AI 调用日志定义与运行时 CSV 目录。

## 当前口径

- 内部脚本 ID：`aishellTechCantoneseAssistant`。
- 与 Aishell Tech 其他已注册脚本互斥，启用状态由 `platforms.aishellTech.activeScriptId` 管理。
- 音频直接转写为繁体粤语口语；不接词表、不做转换/比较双阶段、不翻译成普通话。
- 输出严格使用 `text + speed`，其中 `speed` 仅允许 `slow / normal / fast`。
- 平台通用 Network 与 DOM 资料以 `platform-resources/aishell-tech/network/` 和 `platform-resources/aishell-tech/page-structure/` 为准；若真实页面字段差异，仅调整粤语运行时选择器。

## 接口与日志

- 接口根路径：`/api/aishell-tech/cantonese-helper/ai/recommend`。
- `GET /health`、`GET /defaults`、`POST /recommend` 均为同步接口；不提供 jobs、SSE 或 WebSocket。
- 成功响应返回 `data.recommendedText`、`data.recommendedSpeed`、`data.referenceText` 与 `meta.usage / meta.cost`。
- AI 日志数据集 ID：`aishell-tech-cantonese-helper-ai`。
- 运行时日志目录：`platform-resources/aishell-tech/cantonese-helper/data/runtime/`。

## 安全边界

- 不保留真实 token、cookie、authorization 或完整音频 URL。
- `data/runtime/` 下的运行文件不提交 Git。

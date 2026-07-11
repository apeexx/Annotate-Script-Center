# Aishell Tech 泰语助手资料

## 目录职责

- `backend/`：泰语助手独立 recommend / jobs / 日志统计接口。
- `data/`：泰语助手 AI 调用日志目录与脚本级说明。

## 当前口径

- 当前脚本是 Aishell Tech 平台下的正式第三脚本，和 `闽南语助手`、`越南语助手` 同平台互斥。
- 运行时与后端统一按“泰语音频直接转写为泰语文本”处理：
  - 单阶段 Omni
  - 无词表
  - 无转换阶段
  - 无比较阶段
- 结果固定要求双字段：
  - `text`
  - `speed`
- `speed` 最终只允许 `slow / normal / fast` 三个值。
- 平台通用 Network 与 DOM 资料继续以：
  - `platform-resources/aishell-tech/network/`
  - `platform-resources/aishell-tech/page-structure/`
  为准。

## 当前接口与日志

- 接口根路径：`/api/aishell-tech/thai-helper/ai/recommend`
- 成功响应固定返回：
  - `data.recommendedText`
  - `data.recommendedSpeed`
  - `data.referenceText`
  - `meta`
- 前端保存请求固定走平台真实 `POST /api/mark/SaveShortMark`，其中 `mark.speed` 正式值为 `slow / normal / fast`。
- AI 日志数据集 ID：`aishell-tech-thai-helper-ai`
- 运行时日志目录：`platform-resources/aishell-tech/thai-helper/data/runtime/`
- 当前后端 `/defaults` 读取失败时，options 会回退到本地完整单阶段默认值，不再把泰语页渲染成“只有空字段”的半残状态。
- 当前前端结果卡与 AI 调用日志都会展示费用估算；单阶段统一按 `识别预估人民币 / 总预估人民币` 口径输出。

## 安全边界

- 不保留真实 token、cookie、authorization、完整签名音频 URL。
- 仅保留脱敏后的字段结构、接口契约和脚本边界说明。
- `data/runtime/` 下运行文件不提交 Git。

# Aishell Tech 越南语助手资料

## 目录职责

- `backend/`：越南语助手独立 recommend / jobs / 日志统计接口。
- `data/`：越南语助手 AI 调用日志目录与脚本级说明。

## 当前口径

- 当前脚本是 Aishell Tech 平台下的正式第二脚本，和 `闽南语助手`、`泰语助手` 同平台互斥。
- 当前运行时同时兼容 `/mytask/mark` 默认标注场景与 `scene=check` 质检场景。
- 运行时与后端统一按“越南语音频直接转写为越南语文本并判断语速”处理：
  - 单阶段 Omni
  - 无词表
  - 无转换阶段
  - 无比较阶段
- 结果固定要求双字段：`text + speed`，其中 `speed` 只允许 `slow / normal / fast`。
- 平台通用 Network 与 DOM 资料继续以：
  - `platform-resources/aishell-tech/network/`
  - `platform-resources/aishell-tech/page-structure/`
  为准。

## 质检页数据口径

- 标注页读取 `/api/taskItem/packageItemList/<packageId>`；质检页读取 `/api/taskItem/checkPackageItemList/<packageId>`。
- 质检列表自身 `id` 只作为来源记录 ID；AI、批量和标注保存确认统一使用 `markTaskItemId`。
- 质检列表的 `number` 允许不连续，页面切条按响应数组顺序与左侧列表顺序对应。
- 音频按“条目 `dataRoot` -> 任务 `dataRoot` -> 默认 OSS 根地址”选择根地址，再与相对 `url` 标准拼接。
- 质检响应缺少 `text` 时，运行时从页面 `.mark-area` 的“原始文本”读取参考文本。

## 当前接口与日志

- 接口根路径：`/api/aishell-tech/vietnamese-helper/ai/recommend`
- 成功响应固定返回 `data.recommendedText / data.recommendedSpeed / data.referenceText / meta`。
- 前端保存请求固定走平台真实 `POST /api/mark/SaveShortMark`，其中 `mark` 写入 `{"text":"...","speed":"..."}`。
- AI 日志数据集 ID：`aishell-tech-vietnamese-helper-ai`
- 运行时日志目录：`platform-resources/aishell-tech/vietnamese-helper/data/runtime/`
- 当前后端 `/defaults` 读取失败时，options 会回退到本地完整单阶段默认值，不再把越南语页渲染成“只有空字段”的半残状态。
- 当前前端结果卡与 AI 调用日志都会展示费用估算；单阶段统一按 `识别预估人民币 / 总预估人民币` 口径输出。

## 安全边界

- 不保留真实 token、cookie、authorization、完整签名音频 URL。
- 质检页只复用上方标注文本、语速与标注保存能力，不读取或修改 `.check-area` 的质检结论与质检保存。
- 仅保留脱敏后的字段结构、接口契约和脚本边界说明。
- `data/runtime/` 下运行文件不提交 Git。

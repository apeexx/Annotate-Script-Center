# Aishell Tech 粤语助手运行时

## 当前范围

- 仅在 `https://mark.aishelltech.com/mytask/mark?...` 生效。
- 平台前端显示名统一使用 `希尔贝壳`；不改内部平台 ID、目录名或接口路径。
- 内部 ID 为 `aishellTechCantoneseAssistant`，与 Aishell Tech 的闽南语、越南语、泰语和中英短剧脚本互斥；生效脚本由 `platforms.aishellTech.activeScriptId` 控制。

## 当前能力

- 单条识别繁体粤语口语文本与语速，结果回填为 `text + speed`。
- 批量模式只处理当前分包：AI 结果可并发预取，页面切条、填入和真实保存严格串行。
- 支持停止批量；已启动的当前条结束后停止后续工作。
- 保存固定走平台真实 `POST /api/mark/SaveShortMark`，不自动提交任务、不跨分包、不触发 `.check-area`。
- 通过表单标签或 `for` 属性分别定位 `text`、`speed` 两个字段，不依赖单输入框假设。

## AI 口径

- 只走同步单阶段 Omni，固定模型 `qwen3.5-omni-flash`、`60000ms` 超时、`enable_thinking=false`。
- Prompt 忠实转写繁体粤语口语，不翻译成普通话，保留合理中英混说，并规范空白与常用全角中文标点。
- 语速统一为 `slow / normal / fast`。
- 成功结果包含 `recommendedText`、`recommendedSpeed`、`referenceText` 与统一 `usage / cost / meta`。
- Options 可保存 Prompt、启用状态、前端并发和快捷键；模型、超时与 thinking 不可改。

## 保存边界

- 只有用户点击单条填入或批量入口后，才会触发页面真实保存按钮。
- 不绕过平台原生 `disabled` 或 `readonly` 限制。
- 扩展重载后若业务页出现旧上下文，刷新业务页后再继续操作。

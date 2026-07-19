# Aishell Tech 粤语助手运行时

## 当前范围

- 仅在 `https://mark.aishelltech.com/mytask/mark?...` 生效。
- 平台前端显示名统一使用 `希尔贝壳`；不改内部平台 ID、目录名或接口路径。
- 内部 ID 为 `aishellTechCantoneseAssistant`，与 Aishell Tech 的闽南语、越南语、泰语和中英短剧脚本互斥；生效脚本由 `platforms.aishellTech.activeScriptId` 控制。

## 当前能力

- 单条按“转换候选 + 听音转写 + 比较决策”生成繁体粤语口语建议；结果卡展示原始参考、转换候选、听音文本、最终推荐、最终语速及候选差异。
- 批量模式只处理当前分包：AI 结果可并发预取，页面切条、填入和真实保存严格串行。
- 支持停止批量：停止后不再创建新请求，并向已创建的后端任务发送取消；已经开始的页面真实保存会收尾后结束本轮。
- 保存固定走平台真实 `POST /api/mark/SaveShortMark`，不自动提交任务、不跨分包、不触发 `.check-area`。
- 通过表单标签或 `for` 属性分别定位 `text`、`speed` 两个字段，不依赖单输入框假设。

## AI 口径

- 转换与听音可并发，比较在两者完成后执行；默认是 `转换 qwen3.5-plus + 听音 qwen3.5-omni-flash + Qwen 比较 qwen3.5-plus`，每次模型调用最多 `60000ms`，thinking 固定关闭。
- 转换候选只作比较参考，绝不直接写入标注页；听音与比较 Prompt 均要求繁体粤语口语、不翻译普通话、保留合理中英混说并规范空白和标点。
- 听音选择 Fun-ASR 时，比较自动使用 Omni，保证最终 `recommendedSpeed` 来自音频；Qwen 文本比较则保留听音阶段的语速。
- 语速统一为 `slow / normal / fast`；成功结果包含 `convertedText`、`heardText`、`recommendedText`、`recommendedSpeed`、`referenceText` 与分阶段 `usage / cost / meta`。
- Options 可分别保存三阶段模型、Prompt、生成参数、比较方式、采纳阈值、启用状态、前端并发和快捷键；旧单阶段 Prompt 与参数自动迁到听音阶段。

## 任务接口

- 默认调用 `POST /api/aishell-tech/cantonese-helper/ai/recommend/jobs`，再轮询 `GET /jobs/:jobId`。
- 需要排查时可读取 `GET /jobs/:jobId/debug`；停止批量会调用 `POST /jobs/:jobId/cancel`。
- 同步 `POST /recommend` 仅保留兼容和调试用途；不使用 SSE 或 WebSocket。

## 保存边界

- 只有用户点击单条填入或批量入口后，才会触发页面真实保存按钮。
- 不绕过平台原生 `disabled` 或 `readonly` 限制。
- 扩展重载后若业务页出现旧上下文，刷新业务页后再继续操作。

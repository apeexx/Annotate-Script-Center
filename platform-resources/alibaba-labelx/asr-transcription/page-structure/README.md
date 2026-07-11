# Alibaba LabelX ASR 转写页面结构（脱敏）

## 页面标识 / 路由 / 前置条件

- 当前文件已按统一模板整理；优先使用稳定路由、query 和页面前置条件识别。

## 页面总览

每条题卡包含：

- 内容区：
  - 音频播放器。
  - 平台前进 / 后退 / 重载 / 倍速控件。
  - `文本` 展示区，显示原始识别文本。
- 回答区：
  - 标注人提示。
  - 审核态订正提示，例如 `答案已订正`。
  - `是否有效` 单选组：`有效 / 无效 / 特殊`。
  - `转写文本` textarea。
  - `特殊备注` textarea。
  - `历史标注`。
  - `标记错误` / `取消标记错误`。

## DOM 树 / 区域结构

每条题卡包含：

- 内容区：
  - 音频播放器。
  - 平台前进 / 后退 / 重载 / 倍速控件。
  - `文本` 展示区，显示原始识别文本。
- 回答区：
  - 标注人提示。
  - 审核态订正提示，例如 `答案已订正`。
  - `是否有效` 单选组：`有效 / 无效 / 特殊`。
  - `转写文本` textarea。
  - `特殊备注` textarea。
  - `历史标注`。
  - `标记错误` / `取消标记错误`。

## 稳定选择器表

- 优先使用 route、标题文案、稳定输入框和原生按钮文本，不依赖 hash class。

## 动态区域 / 重渲染风险

本轮 Chrome 页面未检测到：

- `#asr-edge-transcription-stats-upload-entry`
- `#asr-edge-judgement-stats-upload-entry`
- `[id*=asr-edge]`
- `[class*=asr-edge]`
- `window.__ASREdgeAlibabaLabelxTranscriptionStatsClient`
- `window.__ASREdgeAlibabaLabelxJudgementServer`

可能原因：

- 当前 Chrome 未加载本仓库 `extension/`。
- 扩展未启用对应脚本。
- options 当前 active project 不匹配。
- 页面刷新后 content script 未注入或未命中。

- 扩展启用后的工具栏 DOM 和快捷键行为。
- 在正常可编辑详情页复测高速全页一键填充保存方案。
- 样式设置面板 DOM。

## 可挂载点建议

- 如需挂载扩展 UI，优先选择宿主页面外层安全区域，不覆盖原生写操作控件。

## 页面区域与接口映射

- 会触发 `POST /api/v1/label/center/mistake`。
- 会触发 `POST /api/v1/label/center/subTask/{subTaskId}/data`。
- 会触发 `POST /api/v1/label/center/subTask/{subTaskId}/data`。
- 触发 `POST /api/v1/label/center/subTask/{subTaskId}/commit`。
- 随后触发 `POST /api/v1/label/center/{taskId}/check/fetch`。
- 平台只触发 1 次 `POST /api/v1/label/center/subTask/{subTaskId}/data`。

## 写操作边界 / 未确认项

- 扩展启用后的工具栏 DOM 和快捷键行为。
- 在正常可编辑详情页复测高速全页一键填充保存方案。
- 样式设置面板 DOM。

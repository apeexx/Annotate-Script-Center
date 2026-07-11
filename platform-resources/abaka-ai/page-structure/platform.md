# Abaka AI Task 页面公共结构（脱敏）

## 页面标识 / 路由 / 前置条件

- 当前文件已按统一模板整理；优先使用稳定路由、query 和页面前置条件识别。

## 页面总览

- 当前页主要记录稳定区域、可见文案和角色边界。

## DOM 树 / 区域结构

- 当前文件未补充完整 DOM 树；后续仅记录稳定区域结构。

## 稳定选择器表

推荐优先级：

1. URL route：`/data-task/v2`、`/task-v2/data-item`、`/items`。
2. query keys：`taskId`、`vm`、`dm`、`role`、`batchId`、`itemId`、`selectIds`、`nodeId`、`viewMode`。
3. 表头文本：Item ID / 条目号、Label Status / 标注状态、Review Status / 当前审核状态。
4. `data-col-key`：作为表格列辅助定位。
5. `role`、`aria-label`、input placeholder。
6. 中文 / English 双语文案兜底。

禁止作为唯一依据：

- `data-v-*`
- 打包 hash class
- 完整图片 / 音频 / 文件 URL
- 行序号

## 动态区域 / 重渲染风险

- 当前页存在状态切换和局部重绘风险；避免依赖瞬时 class 和顺序定位。

## 可挂载点建议

- 如需挂载扩展 UI，优先选择宿主页面外层安全区域，不覆盖原生写操作控件。

## 页面区域与接口映射

| same_font | custom radio | `true`、`false`、`unsure`、`error`、`same underlying font+artistic effect` | 同中文页 | 标题 `same_font` + `radio-container` + `radio-item` | 选项点击后可能自动保存 | `/api/v2/label/save-labels` | Task21 主标注结构。 |
| image_b_texts_removed | radio + rich text editor | `specify`、`true`、`null` | 同中文页 | same_font 后继字段块 + editor aria | 保存时并入 payload | `/api/v2/label/save-labels` | 点击 true 后出现。 |
| other_changes | radio + textarea | `specify`、`unsure`、`null` | 同中文页 | 后继字段块 + textarea | 保存时并入 payload | `/api/v2/label/save-labels` | 查看页禁用，标注页可见。 |
- 公共接口族一致：`get-item-info`、`find-labels`、`find-issues`、`find-label-records`、`get-ai-check-result`、`find-invalidate-frame`、`sampling/get-frames-data`、`find-items-base-info`。

## 写操作边界 / 未确认项

- 写操作默认维持人工确认边界；未确认链路不得按文案直接推断。

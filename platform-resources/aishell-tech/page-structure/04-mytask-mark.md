# 04-数据标注 DOM 结构

## 页面标识 / 路由 / 前置条件

- 路由：`/mytask/mark?taskId=<taskId>&packageId=<packageId>[&scene=check]`
- 主容器：`.mark-container`
- 框架：Vue 2 + Element UI + Wavesurfer.js (canvas)

## 页面总览

- 默认标注场景与 `scene=check` 质检场景共用短标注 DOM 家族。
- 质检场景仍保留左侧列表、波形与 `.mark-area`，并额外显示 `.check-area`。

## DOM 树 / 区域结构

- `.mark-container`
  - `.list`：当前分包条目列表
  - `.fileName-line`：当前文件名
  - Wavesurfer 波形与控制条
  - `.mark-area`：原始文本、可编辑文本、可编辑语速、上方标注保存
  - `.check-area`：质检意见、质检结果、下方质检保存（仅质检场景）

## 稳定选择器表

| 目标 | 选择器 |
|------|--------|
| 文件列表容器 | `.list` |
| 当前选中条目 | `.list-item-selected button.el-button--text` |
| 已完成条目 | `.list-item-finshed` |
| 条目文件名 | `button > span > span`（如 "1: ...59666546789.wav"） |
| 进度 | `.el-card__header span` 含 ` / 86` |
| 上一条 | `button` 含 "上一条" |
| 下一条 | `button` 含 "下一条" |
| 返回 | `a.el-link` 含 "返回" |
| 播放/暂停 | `button.el-button--primary` |
| 标注文本输入框 | `.mark-area .el-form-item` 中 `for="text"` / 文案含“文本”的文本框，第一输入框兜底 |
| 标注语速输入框 | `.mark-area .el-form-item` 中 `for="speed"` / 文案含“语速”的文本框，第二输入框兜底 |
| 原始文本 | `.mark-area label`="原始文本" 相邻值 |
| 保存按钮 | `.mark-area button` 含 "保存" |
| 质检意见 | `.check-area textarea.el-textarea__inner` |
| 质检结果 | `.check-area` 内合格 / 不合格单选控件 |
| 质检保存按钮 | `.check-area button` 含 "保存" |
| 文件名 | `.fileName-line span`（第一个） |

## 动态区域 / 重渲染风险

- 当前页存在状态切换和局部重绘风险；避免依赖瞬时 class 和全页按钮顺序定位。
- 页面同时存在两个文案为“保存”的按钮，必须以 `.mark-area` / `.check-area` 容器进行作用域隔离。
- 质检列表业务序号可能不连续；当前项按 `.list-item-selected` 在 DOM 列表中的数组索引定位。

## 可挂载点建议

- 如需挂载扩展 UI，优先选择宿主页面外层安全区域，不覆盖原生写操作控件。

## 页面区域与接口映射

- 默认标注场景 `.list` 对应 `packageItemList`。
- `scene=check` 的 `.list` 对应 `checkPackageItemList`；响应数组顺序与左侧 DOM 顺序一致。
- `.mark-area` 对应原标注文本上下文，质检记录通过 `markTaskItemId` 关联该上下文。

## 写操作边界 / 未确认项

- 越南语助手只允许填入 `.mark-area` 的文本与语速，并点击其上方真实保存按钮。
- 不得读取、修改或点击 `.check-area` 的质检意见、合格 / 不合格与下方保存。
- 验收 / 重检角色结构仍未确认，不复用本页写操作结论。

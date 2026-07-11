# Abaka AI Task 页面公共网络采集索引

## 请求标识 / 目的

本目录维护 Abaka AI Task 页面公共状态能力，不限定于 Task21 的 `same_font` 标注字段。Skipped / Dropped / Recovery / 状态 Tab / 标注送审后的 Data 页状态变化都放在这里。

Task21 `same_font` 保存、派生字段和暂存维护在 `../../task21/network/08-label-save-labels.md`。公共暂存按钮链路维护在 `../task-page/12-stash-save.md`。

## 页面入口 / 触发动作

- 当前文件未补充额外入口说明；默认按对应页面自然加载或用户显式操作触发。

## 请求摘要

- 当前文件未补充更细的请求摘要。

## 请求体摘要

- 当前记录未见独立 request body；以路径参数或 query 为主。

## 响应摘要

- 请求体和响应体只保留字段名、类型、数组长度、状态枚举和结构路径。

## 关键字段

- 当前重点继续以路径、query、响应字段名和脱敏占位为主。

## 前端接入建议

- 可以被动监听这些接口并记录脱敏结构。
- 不主动调用 `receive-item`、`recover-item`、`save-labels`、`submit-item`。
- 状态变更必须由用户在平台页面人工确认。
- Skipped 重新进入标注、Dropped Recovery、Submit 都属于高风险动作，后续扩展不得静默执行。

## 风险 / 未确认项

- 不记录 cookie、token、authorization、password、secret、signature。
- 不记录完整图片、音频、文件、对象存储 URL、base64 data URL。
- 不记录测试账号、人员姓名、客户原始文本内容。
- 所有真实 ID 使用 `{taskId}`、`{itemId}`、`{nodeId}`、`{roleId}`、`{selectId}`、`{batchId}` 或 `<REDACTED_*>`。
- 请求体和响应体只保留字段名、类型、数组长度、状态枚举和结构路径。

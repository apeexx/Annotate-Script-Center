# Abaka AI Task21 专项网络请求概览（脱敏）

## 请求标识 / 目的

本文件只维护 Task21 专项 Network 入口。公共 Data 页、领取、查看、状态 Tab、Skipped / Dropped、恢复、语言切换、资源加载等请求已上移到 `../../network/`。

- `network/README.md`：Task21 专项网络索引。
- `network/08-label-save-labels.md`：same_font、image_b_texts_removed、other_changes 保存结构。

公共请求入口：

- 平台通用初始化、空间、权限和任务接口：`../../network/platform.md`
- Task 页面公共网络：`../../network/README.md`

- 采集日期：2026-05-16。
- 采集方式：Google Chrome DevTools MCP、临时脱敏 XHR/fetch 监听器、Network 面板结构观察。
- 主页面：`/items`。
- 主目标：Task21。
- 专项字段：`same_font`、`image_b_texts_removed`、`other_changes`。

## 页面入口 / 触发动作

- 采集日期：2026-05-16。
- 采集方式：Google Chrome DevTools MCP、临时脱敏 XHR/fetch 监听器、Network 面板结构观察。
- 主页面：`/items`。
- 主目标：Task21。
- 专项字段：`same_font`、`image_b_texts_removed`、`other_changes`。

## 请求摘要

| 类别 | 主要接口 | 详细文档 |
| --- | --- | --- |
| Task21 标签保存 / 暂存 | `/api/v2/label/save-labels` | `network/08-label-save-labels.md` |
| 公共暂存按钮 | `/api/v2/label/save-labels` | `../../network/task-page/12-stash-save.md` |
| 公共提交链路 | `/api/v2/item/submit-item` | `../../network/task-page/11-submit-review.md` |

## 请求体摘要

- 当前记录未见独立 request body；以路径参数或 query 为主。

## 响应摘要

- 请求体和响应体只记录字段结构、字段类型、数组长度、状态码、业务 `code`、公开 Toast / 校验提示。
- 不提交原始 HAR、JSON、截图、CSV、完整响应体或完整资源 URL。
该接口后续扩展只能被动监听。AI 建议不得自动写入 `data.create/update/delete`，必须由用户人工确认。其他状态变更边界见 `../../page-structure/actions.md`。

## 关键字段

- 当前重点继续以路径、query、响应字段名和脱敏占位为主。

## 前端接入建议

- 接入时优先复用当前页已有稳定锚点，只做只读监听或最小范围辅助。

## 风险 / 未确认项

- 不记录账号、密码、cookie、authorization、token、access_token、refresh_token、secret、signature、credential、session。
- 不记录完整图片、音频、文件、下载、对象存储、`src`、`href`、`url`、`path` 值。
- 真实 ID 使用 `{taskId}`、`{itemId}`、`{nodeId}`、`{selectId}`、`{roleId}`、`{batchId}` 或 `<REDACTED_*>`。
- 请求体和响应体只记录字段结构、字段类型、数组长度、状态码、业务 `code`、公开 Toast / 校验提示。
- 不提交原始 HAR、JSON、截图、CSV、完整响应体或完整资源 URL。

已确认会改变 Task21 标签数据的专项接口：

- `/api/v2/label/save-labels`

该接口后续扩展只能被动监听。AI 建议不得自动写入 `data.create/update/delete`，必须由用户人工确认。其他状态变更边界见 `../../page-structure/actions.md`。

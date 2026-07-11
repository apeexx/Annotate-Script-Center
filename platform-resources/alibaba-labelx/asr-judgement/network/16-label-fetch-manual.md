# POST /api/v1/label/center/{taskId}/label/fetch 手动领取

## 请求标识 / 目的

该请求由标注首页“可领取的任务”表格中的 `领取` 按钮触发，用于手动领取一个子任务包。

本次采集覆盖两种结果：

- 领取成功：后端返回新的 `subTaskId`。
- 领取失败：任务数据池为空，HTTP 仍为 `200`，业务响应 `code=500`。

## 页面入口 / 触发动作

- 在标注首页点击一条可领取任务的 `领取`。
- 用户指定的历史任务数据池为空时，再点击对应任务 `领取`。
- 在同一首页连续点击两次当前可领取任务的 `领取`，用于准备后续任务切换测试。

领取成功后，本次页面停留在标注首页并刷新列表：

- `GET /api/v1/label/center/subTasks?finished=false...`
- `GET /api/v1/label/center/tasks...`
- `GET /api/v1/label/center/tasks/process...`

领取成功后，首页“我的任务 / 未完成”表格出现新领取包，行内按钮变为 `标注`、`释放`。后续可通过 `标注` 进入详情页，也可以直接使用返回的 `subTaskId` 构造详情页规范化 URL。

连续手动领取多条时，每次领取都会重复以下链路：

```text
POST /api/v1/label/center/<REDACTED_TASK_ID>/label/fetch
GET  /api/v1/label/center/subTasks?type=label&finished=false...
GET  /api/v1/label/center/tasks?subTaskType=label...
GET  /api/v1/label/center/tasks/process?taskIds=<REDACTED_TASK_IDS>...
```

本次连续领取后，首页“我的任务 / 未完成”中出现多条未完成包，均显示 `标注`、`释放` 操作。

## 请求摘要

- Method：`POST`
- URL：`/api/v1/label/center/<REDACTED_TASK_ID>/label/fetch`
- Content-Type：`application/x-www-form-urlencoded; charset=UTF-8`
- Request Body：

```text
id=<REDACTED_TASK_ID>&_=<REDACTED_TIMESTAMP>
```

- Status：`200`

## 请求体摘要

- 当前记录未见独立 request body；以路径参数或 query 为主。

## 响应摘要

```json
{
  "code": 0,
  "message": null,
  "log": null,
  "data": "<REDACTED_SUBTASK_ID>",
  "traceId": "<REDACTED_TRACE_ID>",
  "success": true
}
```

```json
{
  "code": 500,
  "message": "暂无待标注数据",
  "log": "<REDACTED_STACK_TRACE>",
  "data": null,
  "traceId": "<REDACTED_TRACE_ID>",
  "success": false
}
```

## 关键字段

- `id` 与 URL path 中的 `{taskId}` 一致，表示要领取的任务 ID。
- 成功响应的 `data` 是新领取的 `subTaskId`。
- 失败时 HTTP status 仍为 `200`，必须读取 JSON `code` / `success` 判断业务结果。
- 手动领取请求体不同于自动领取：手动领取是 form body；自动领取是 JSON body，并带 `autoFetch=true`。

## 前端接入建议

- 扩展默认不要主动调用该接口，避免改变任务分配状态。
- 若只做采集，可被动监听该 endpoint，并根据 Content-Type 区分手动领取和自动领取。
- 领取结果不能只看 HTTP status，应同时检查 `success` 与 `code`。
- 成功响应中的 `data` 可作为进入详情页的 `subTaskId`，但日志中必须脱敏。

## 风险 / 未确认项

- 手动点击 `标注` 按钮进入详情页的行为已补充到 `22-home-open-subtask-detail.md`。
- 领取成功后如果平台自动跳转到详情页的分支未在本次首页手动领取中出现。

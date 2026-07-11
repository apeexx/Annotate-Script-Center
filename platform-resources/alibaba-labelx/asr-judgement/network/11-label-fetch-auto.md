# POST /api/v1/label/center/{taskId}/label/fetch

## 请求标识 / 目的

该请求用于领取或自动领取下一包标注数据。本次采集是在“自动领取”开关开启时点击“提交任务”后自动触发。

本次采集场景中，用户确认任务池没有可领取数据，因此请求后没有跳转到新的详情页，而是返回标注首页。

2026-04-25 二次采集已通过页面内 `fetch` / `XMLHttpRequest` 钩子在导航前读取到空池响应体摘要。

## 页面入口 / 触发动作

- 在详情页保持“自动领取”开启。
- 点击 `提交任务`。
- `commit` 请求返回后自动触发本请求。

本次请求后页面跳转到：

```text
/corpora/labeling/labelingTask?projectId=<REDACTED_PROJECT_ID>
```

首页随后加载：

- `GET /api/v1/label/center/subTasks`
- `GET /api/v1/label/center/tasks`
- `GET /api/v1/label/center/tasks/process`

## 请求摘要

- Method：`POST`
- URL：`/api/v1/label/center/<REDACTED_TASK_ID>/label/fetch`
- Content-Type：`application/json`
- Request Body：

```json
{
  "taskId": "<REDACTED_TASK_ID>",
  "type": "label",
  "autoFetch": true
}
```

- Status：`200`
- Response Body：HTTP 成功，但业务响应为任务池无待标注数据。

## 请求体摘要

- 当前记录未见独立 request body；以路径参数或 query 为主。

## 响应摘要

```json
{
  "code": 500,
  "message": "暂无待标注数据",
  "log": "<STRING len=18274>",
  "data": null,
  "traceId": "<REDACTED_TRACE_ID>",
  "traceSql": null,
  "extraInfo": null,
  "cost": 0,
  "success": false
}
```

说明：`log` 字段很长，疑似后端诊断文本；文档只记录长度，不保存原文。该响应表示自动领取空池路径，不表示前置 `commit` 提交失败。

## 关键字段

- URL path 中的 `taskId` 与 body 中 `taskId` 一致。
- `type=label` 表示领取标注类型子任务。
- `autoFetch=true` 表示该请求由自动领取流程触发。
- HTTP status 为 `200` 不代表领取成功，需要继续检查业务 `code` / `success` / `data`。
- 任务池无可领取数据路径表现为 `code=500`、`success=false`、`data=null`、`message="暂无待标注数据"`。
- 如果后端分配到新包，按用户说明预期会跳转到新的标注详情页；本次仍未观察到该分支。

## 前端接入建议

- 扩展不应主动调用该接口，避免改变任务分配状态。
- 可被动监听该请求区分“提交后自动领取”与“手动领取”。
- 需要根据 `autoFetch` 字段区分触发来源。
- 不能仅凭 `status=200` 判断一定领取到新包，需要结合最终 URL 或 response body。

## 风险 / 未确认项

- 有可领取数据时的响应 body 和跳转详情页 URL 未采集。
- 手动点击首页“领取”按钮时是否使用同一接口、`autoFetch` 是否为 `false` 未采集。

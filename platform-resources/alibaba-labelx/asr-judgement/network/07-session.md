# POST /api/v1/label/center/{subTaskId}/session

## 请求标识 / 目的

该请求创建或返回当前详情页会话 ID。后续 `timer` 心跳会携带该 sessionId。

## 页面入口 / 触发动作

- 打开详情页。
- 刷新详情页。

## 请求摘要

- Method：`POST`
- URL：`/api/v1/label/center/<REDACTED_SUBTASK_ID>/session`
- Content-Type：`application/x-www-form-urlencoded; charset=utf-8`
- Request Body：
  - `subTaskId=<REDACTED_SUBTASK_ID>`
  - `_=<REDACTED_TIMESTAMP>`
- Status：`200`

## 请求体摘要

- 当前记录未见独立 request body；以路径参数或 query 为主。

## 响应摘要

```json
{
  "code": 0,
  "message": null,
  "log": null,
  "data": "<REDACTED_SESSION_ID>",
  "traceId": "<REDACTED_TRACE_ID>",
  "traceSql": null,
  "extraInfo": null,
  "cost": 0,
  "success": true
}
```

## 关键字段

- `data` 是页面会话 ID。
- `timer` 心跳的 `sessionId` 与该字段对应。
- 该 sessionId 是运行态值，不能写入文档、日志或扩展持久存储。

## 前端接入建议

- 仅可作为识别页面生命周期的辅助信号。
- 不建议主动调用或重放该请求。
- 如果需要判断页面初始化完成，应优先等待 `data` 或 `getLabelTaskInfo` 请求，而不是 session。

## 风险 / 未确认项

- session 是否与保存、提交请求关联尚未采集。

# GET /api/v1/label/center/subTask/{subTaskId}/summary

## 请求标识 / 目的

该请求返回当前子任务的简要统计信息。

## 页面入口 / 触发动作

- 打开详情页。
- 刷新详情页。

## 请求摘要

- Method：`GET`
- URL：`/api/v1/label/center/subTask/<REDACTED_SUBTASK_ID>/summary`
- Query：
  - `_=<REDACTED_TIMESTAMP>`
- Request Body：无。
- Status：`200`

## 请求体摘要

- 当前记录未见独立 request body；以路径参数或 query 为主。

## 响应摘要

```json
{
  "code": 0,
  "message": null,
  "log": null,
  "data": {
    "id": "<REDACTED_SUBTASK_ID>",
    "total": 400,
    "mistakeCount": 0
  },
  "traceId": "<REDACTED_TRACE_ID>",
  "success": true
}
```

## 关键字段

- `data.id` 是当前子任务 ID。
- `total` 是当前子任务样本总数。
- `mistakeCount` 是异常或错误样本计数。

## 前端接入建议

- 可作为辅助进度信息来源。
- 核心样本详情仍应来自 `03-subtask-data.md` 记录的 `data` 接口。

## 风险 / 未确认项

- 提交任务后 `summary` 是否更新 `gmtCommit` 或其他字段未采集。

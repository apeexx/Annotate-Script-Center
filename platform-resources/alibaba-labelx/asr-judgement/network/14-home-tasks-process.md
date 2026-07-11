# GET /api/v1/label/center/tasks/process

## 请求标识 / 目的

该请求加载首页“可领取的任务”列表对应的进度或领取状态信息。本次是在首页任务列表返回后触发。

## 页面入口 / 触发动作

- 点击详情页 `提交任务`。
- 页面返回标注首页。
- 首页加载可领取任务列表后触发本请求。

## 请求摘要

- Method：`GET`
- URL：`/api/v1/label/center/tasks/process`
- Query：
  - `subTaskType=label`
  - `taskIds=<REDACTED_TASK_ID_LIST>`
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
  "data": [],
  "traceId": "<REDACTED_TRACE_ID>",
  "success": true
}
```

## 关键字段

- `taskIds` 来自首页 `tasks` 接口当前页返回的任务 ID 列表。
- 本次 `data=[]`，说明这些任务没有额外 process 信息或当前用户无可展示进度。
- 该请求不是详情页核心数据源。

## 前端接入建议

- 仅首页逻辑需要关注。
- 不要将它用于判断详情页是否提交成功；提交成功更直接的信号是 `commit` 请求状态和最终 URL。

## 风险 / 未确认项

- 有 process 数据时的返回结构未采集。
- 不同任务模式 `vote` / `single` 下 process 数据是否不同未采集。

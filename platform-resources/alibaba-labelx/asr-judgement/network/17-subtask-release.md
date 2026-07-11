# POST /api/v1/label/center/subTask/{subTaskId}/release

## 请求标识 / 目的

该请求由标注首页“我的任务 / 未完成”表格中的 `释放` 按钮触发，用于释放已领取但未提交的子任务包。

## 页面入口 / 触发动作

- 首页手动领取成功后，在“我的任务 / 未完成”列表点击该包的 `释放`。

释放成功后页面出现 `释放成功` 提示，并刷新首页列表：

- `GET /api/v1/label/center/subTasks?finished=false...`
- `GET /api/v1/label/center/tasks...`
- `GET /api/v1/label/center/tasks/process...`

## 请求摘要

- Method：`POST`
- URL：`/api/v1/label/center/subTask/<REDACTED_SUBTASK_ID>/release`
- Content-Type：`application/x-www-form-urlencoded; charset=UTF-8`
- Request Body：

```text
id=<REDACTED_SUBTASK_ID>&_=<REDACTED_TIMESTAMP>
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
  "data": true,
  "traceId": "<REDACTED_TRACE_ID>",
  "success": true
}
```

## 关键字段

- URL path 中的 `{subTaskId}` 与 body 的 `id` 一致。
- `data=true` 表示释放成功。
- 该接口会改变任务占用状态，不属于只读接口。

## 前端接入建议

- 扩展不应主动调用该接口。
- 若做行为观察，只记录 endpoint、method、status、`success` 和页面提示，不记录真实 ID。
- 释放后首页列表会刷新，脚本应避免把旧行缓存当作仍有效任务。

## 风险 / 未确认项

- 释放失败、已提交包释放、网络失败时的响应结构未采集。

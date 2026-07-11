# POST /api/v1/label/center/subTask/{subTaskId}/commit

## 请求标识 / 目的

该请求由详情页顶部“提交任务”按钮触发，用于提交当前子任务包。提交成功后当前包不可返回继续测试。

已采集成功提交场景：

- 页面位于 ASR 更优判断详情页。
- “自动领取”开关处于开启状态。
- 点击“提交任务”后页面返回标注首页。
- 未出现可停留观察的确认弹窗。
- 2026-04-25 二次采集使用页面内 `fetch` / `XMLHttpRequest` 钩子在导航前读取到响应体摘要。

另一次未完成包中点击 `提交任务` 时，前端必填校验先阻断，没有发出本接口。见 `20-submit-client-validation.md`。

## 页面入口 / 触发动作

- 点击详情页顶部按钮：`提交任务`。

## 请求摘要

- Method：`POST`
- URL：`/api/v1/label/center/subTask/<REDACTED_SUBTASK_ID>/commit`
- Content-Type：`application/json`
- Request Header：
  - `labelsessionid: <REDACTED_LABEL_SESSION_ID>`
  - `Cookie: <REDACTED>`
- Request Body：

```json
{
  "subTaskId": "<REDACTED_SUBTASK_ID>"
}
```

- Status：`200`
- Response Body：成功响应，业务 `code=0`，`data=true`，`success=true`。

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
  "traceSql": null,
  "extraInfo": null,
  "cost": 0,
  "success": true
}
```

## 关键字段

- URL path 中的 `subTaskId` 与 body 中 `subTaskId` 一致。
- `labelsessionid` 是详情页会话相关请求头，不能记录真实值。
- 请求体只包含当前子任务 ID，未观察到提交当前页答案列表或 dataId 列表。
- 状态码 `200` 且响应 `code=0`、`data=true`、`success=true` 表示当前子任务提交成功。

## 前端接入建议

- 扩展不应主动调用该接口。
- 如果需要识别用户提交行为，可被动监听该 URL。
- 被动监听时只记录 `method`、endpoint、status、是否触发后续 `label/fetch`、最终 URL，不记录真实 session/header/cookie。
- 由于提交后不可回退，调试逻辑不要自动点击“提交任务”。

## 风险 / 未确认项

- 自动领取关闭时，提交成功后的跳转行为是否相同未采集。
- 服务端提交失败、网络失败的响应结构未采集。

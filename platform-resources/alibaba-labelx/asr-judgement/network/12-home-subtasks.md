# GET /api/v1/label/center/subTasks

## 请求标识 / 目的

该请求加载标注首页“我的任务 / 未完成”列表。本次是在提交详情页后返回首页时触发。

## 页面入口 / 触发动作

- 点击详情页 `提交任务`。
- 自动领取未进入新详情页，页面返回标注首页。

## 请求摘要

- Method：`GET`
- URL：`/api/v1/label/center/subTasks`
- Query：
  - `type=label`
  - `keyword=`
  - `appId=<REDACTED_PROJECT_ID>`
  - `finished=false`
  - `page=1`
  - `pageSize=5`
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
  "data": {
    "data": [],
    "recordCount": 0
  },
  "traceId": "<REDACTED_TRACE_ID>",
  "success": true
}
```

## 关键字段

- `type=label` 表示标注任务。
- `finished=false` 对应首页“我的任务 / 未完成”列表。
- `data.data=[]` 且 `recordCount=0` 表示当前未完成子任务列表为空。
- 已完成列表使用同一 endpoint，但 `finished=true`，详见 `15-home-subtasks-finished.md`。

## 前端接入建议

- 该请求属于首页列表，不属于详情页样本解析。
- 可用于判断提交后是否仍存在未完成包。
- 不要把该接口作为当前详情页数据来源。

## 风险 / 未确认项

- 有未完成任务时列表项字段未在本轮记录。

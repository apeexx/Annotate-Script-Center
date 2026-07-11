# GET /api/v1/label/center/subTask/{subTaskId}/board

## 请求标识 / 目的

该请求返回当前子任务的全量样本进度面板。它不包含完整样本内容，只包含每条数据的结果状态摘要。

## 页面入口 / 触发动作

- 打开详情页。
- 刷新详情页。

## 请求摘要

- Method：`GET`
- URL：`/api/v1/label/center/subTask/<REDACTED_SUBTASK_ID>/board`
- Query：
  - `filterPassedVote=false`
  - `filter={"questions":[],"dataStatus":"ALL","questionsQueryConditions":"AND"}`
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
    "subTaskId": "<REDACTED_SUBTASK_ID>",
    "gmtCreate": "<REDACTED_TIME>",
    "gmtCommit": null,
    "size": 400,
    "dataList": [
      {
        "dataId": "<REDACTED_DATA_ID_1>",
        "hasResult": true,
        "hasMistake": false
      },
      {
        "dataId": "<REDACTED_DATA_ID_2>",
        "hasResult": false,
        "hasMistake": false
      }
    ]
  },
  "traceId": "<REDACTED_TRACE_ID>",
  "success": true
}
```

## 关键字段

- `size` 是子任务总样本数。
- `dataList[].dataId` 对应 `data` 接口中的样本 ID。
- `dataList[].hasResult` 表示样本是否已有标注结果。
- `dataList[].hasMistake` 表示样本是否被标记为异常或错误。
- `gmtCommit` 当前为 `null`，可能与提交任务状态相关，尚未采集确认。

## 前端接入建议

- 可用于构建进度状态或快速判断未完成样本数量。
- 不适合用于读取 ASR 文本、音频地址或答案详情。
- 与 `data` 接口合并时，以 `dataId` 作为关联键。

## 风险 / 未确认项

- 提交任务后 `gmtCommit`、`hasResult`、`hasMistake` 是否变化未采集。
- 筛选条件变化时 `dataList` 是否只返回过滤后的样本未采集。

# GET /api/v1/label/center/subTask/{subTaskId}/data 分页与筛选

## 请求标识 / 目的

该记录补充详情页分页大小切换和筛选操作对 `data`、`summary`、`board` 请求的影响。

## 页面入口 / 触发动作

- 在详情页页码选择器中把 `10 条/页` 切换为 `20 条/页`。
- 打开 `筛选` 面板，将任务状态从 `全部` 改为 `已完成` 并点击 `确定`。
- 再点击 `重置` 和 `确定`，恢复为 `全部`。
- 在当前页必填题均已填写后，点击分页页码 `2`。

切换每页条数、筛选和重置筛选后，均观察到同步刷新：

- `GET /api/v1/label/center/subTask/<REDACTED_SUBTASK_ID>/summary`
- `GET /api/v1/label/center/subTask/<REDACTED_SUBTASK_ID>/board?filterPassedVote=false&filter=<URL_ENCODED_FILTER>...`

`summary` 不带筛选 query；`board` 的 `filter` 与 `data` 请求一致。

真实翻页后同样观察到同步刷新：

- `GET /api/v1/label/center/subTask/<REDACTED_SUBTASK_ID>/summary?_=<REDACTED_TIMESTAMP>`
- `GET /api/v1/label/center/subTask/<REDACTED_SUBTASK_ID>/board?filterPassedVote=false&filter=<URL_ENCODED_FILTER>&_=<REDACTED_TIMESTAMP>`
- 当前页音频资源随后按新页 `dataList[].data.raw_audio_path` 发起多条 `206 Partial Content` media 请求。

## 请求摘要

- Method：`GET`
- URL：`/api/v1/label/center/subTask/<REDACTED_SUBTASK_ID>/data`
- Query 摘要：

```json
{
  "page": "1",
  "pageSize": "20",
  "filterPassedVote": "false",
  "filter": {
    "questions": [],
    "dataStatus": "ALL",
    "questionsQueryConditions": "AND"
  },
  "_": "<REDACTED_TIMESTAMP>"
}
```

- Status：`200`

- Method：`GET`
- URL：`/api/v1/label/center/subTask/<REDACTED_SUBTASK_ID>/data`
- Query 摘要：

```json
{
  "page": "1",
  "pageSize": "20",
  "filterPassedVote": "false",
  "filter": {
    "questions": [],
    "dataStatus": "FINISHED",
    "questionsQueryConditions": "AND"
  },
  "_": "<REDACTED_TIMESTAMP>"
}
```

- Status：`200`

```json
{
  "page": "1",
  "pageSize": "20",
  "filterPassedVote": "false",
  "filter": {
    "questions": [],
    "dataStatus": "ALL",
    "questionsQueryConditions": "AND"
  },
  "_": "<REDACTED_TIMESTAMP>"
}
```

- Method：`GET`
- URL：`/api/v1/label/center/subTask/<REDACTED_SUBTASK_ID>/data`
- Query 摘要：

```json
{
  "page": "2",
  "pageSize": "20",
  "filterPassedVote": "false",
  "filter": {
    "questions": [],
    "dataStatus": "ALL",
    "questionsQueryConditions": "AND"
  },
  "_": "<REDACTED_TIMESTAMP>"
}
```

- Status：`200`
- 页面结果：分页激活项从 `1` 切换到 `2`，当前页渲染 20 条题卡；未出现必填校验提示。

## 请求体摘要

- 当前记录未见独立 request body；以路径参数或 query 为主。

## 响应摘要

响应主体结构与 `03-subtask-data.md` 相同，差异是 `dataList` 的数量和内容随 `pageSize` / `filter` 变化：

```json
{
  "code": 0,
  "data": {
    "id": "<REDACTED_SUBTASK_ID>",
    "taskId": "<REDACTED_TASK_ID>",
    "size": 400,
    "template": "<SAME_SHAPE_AS_INITIAL_DATA>",
    "templateConfig": "<SAME_SHAPE_AS_INITIAL_DATA>",
    "dataList": [
      {
        "dataId": "<REDACTED_DATA_ID>",
        "data": {
          "raw_audio_path": "<REDACTED_SIGNED_AUDIO_URL>",
          "online_rec": "asr_text1: <REDACTED>\nasr_text2: <REDACTED>",
          "wav_id": "<REDACTED_WAV_ID>"
        },
        "result": "<NULL_OR_MARK_RESULT>",
        "status": "<NULL_OR_STATUS>"
      }
    ]
  },
  "success": true
}
- 其余重复细节已省略；如需补充，只保留当前有效结论。

## 关键字段

- 页码组件的每页条数直接映射到 `pageSize`。
- 点击页码直接映射到 `page`，本次页码 `2` 对应 `page=2`。
- 筛选面板的任务状态映射到 `filter.dataStatus`：
  - `全部` => `ALL`
  - `已完成` => `FINISHED`
  - `未完成` 预计对应另一枚举，未采集。
- `filter.questions` 用于“回答区数据”筛选，本次保持空数组。
- `questionsQueryConditions` 对应筛选条件关系 `AND` / `OR`。

## 前端接入建议

- 被动解析当前页数据时，应把 `page`、`pageSize`、`filter` 一并保存到运行态上下文。
- 不要假设当前页永远是 10 条；页面可选择 1、2、3、4、5、10、20、30、40、50 条/页。
- 不要假设当前页永远是第一页；应从最新 `data` 请求 query 中读取 `page`。
- 如果扩展需要和页面筛选结果一致，应监听最新一次 `data` 或 `board` 请求的 `filter`。
- URL 中 `filter` 是 JSON 字符串再 URL encode，解析时需要 `decodeURIComponent` 后 `JSON.parse`。
- 翻页前页面会做必填校验；如当前页未完成，可能不会发出 `page=2` 请求，只显示前端提示。

## 风险 / 未确认项

- 任务状态 `未完成` 的 `dataStatus` 枚举值未采集。
- 新增“回答区数据”筛选条件后的 `filter.questions` 结构未采集；用户确认实际使用中基本不会使用该筛选，因此不再主动采集。

# GET /api/v1/label/center/tasks

## 请求标识 / 目的

该请求加载标注首页“可领取的任务”列表。本次是在提交详情页后返回首页时触发。

## 页面入口 / 触发动作

- 点击详情页 `提交任务`。
- 自动领取未进入新详情页，页面返回标注首页。

## 请求摘要

- Method：`GET`
- URL：`/api/v1/label/center/tasks`
- Query：
  - `subTaskType=label`
  - `keyword=`
  - `appId=<REDACTED_PROJECT_ID>`
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
    "data": [
      {
        "taskId": "<REDACTED_TASK_ID_1>",
        "subTaskType": null,
        "name": "<REDACTED_TASK_NAME_1>",
        "gmtCreate": "<REDACTED_TIME>",
        "total": null,
        "left": null,
        "labelModel": "vote"
      },
      {
        "taskId": "<REDACTED_TASK_ID_2>",
        "subTaskType": null,
        "name": "<REDACTED_TASK_NAME_2>",
        "gmtCreate": "<REDACTED_TIME>",
        "total": null,
        "left": null,
        "labelModel": "single"
      }
    ],
    "recordCount": 13
- 其余重复细节已省略；如需补充，只保留当前有效结论。

## 关键字段

- `data.data[]` 是可领取任务列表。
- `taskId` 是领取接口 `/label/center/{taskId}/label/fetch` 使用的任务 ID。
- `labelModel` 表示任务标注模式，本次看到 `vote` 和 `single` 两类。
- 当前 ASR 更优判断任务使用 `labelModel=vote`；历史转写任务可出现 `labelModel=single`。
- 任务名也可辅助判断：ASR 更优判断任务名包含 `ASR更优结果判断` / `ASR更优`，历史转写任务名可为 `中文普通话asr任务`。
- `total`、`left` 在本次响应中为 `null`，不能依赖它们判断是否有可领取数据。

## 前端接入建议

- 该请求只适合首页任务列表页面使用。
- 若扩展需要从首页识别 ASR 更优判断任务，优先使用 `labelModel=vote`，再结合脱敏后的任务名和后续 `subTasks` 摘要中的 `size=400` 判断；`labelModel=single` 应视为转写任务并跳过。
- 不要记录完整任务名；任务名可能包含业务信息。

## 风险 / 未确认项

- 任务列表搜索 `keyword` 时响应结构是否变化未采集。
- 下一页 `page>1` 的结构未采集。

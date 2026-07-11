# GET /api/v1/label/tasks/getLabelTaskInfo

## 请求标识 / 目的

该请求返回任务模板、字段配置、答案选项和流程配置。它是扩展避免硬编码页面结构的重要数据源。

## 页面入口 / 触发动作

- 打开详情页。
- 刷新详情页。

通常在 `data` 接口返回后出现，因为请求参数需要 `taskId`。

## 请求摘要

- Method：`GET`
- URL：`/api/v1/label/tasks/getLabelTaskInfo`
- Query：
  - `taskId=<REDACTED_TASK_ID>`
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
    "id": "<REDACTED_TASK_ID>",
    "name": "<REDACTED_TASK_NAME>",
    "type": "custom",
    "bizType": "",
    "status": "running",
    "createTime": "<REDACTED_DATE>",
    "expectedCount": 20000,
    "dataset": {
      "type": "corpus",
      "config": {
        "id": "<REDACTED_DATASET_ID>"
      },
      "appId": null,
      "name": null
    },
    "template": {
      "id": "<REDACTED_TEMPLATE_ID>",
      "name": "<REDACTED_TEMPLATE_NAME>",
      "parameters": [
        {
          "name": null,
- 其余重复细节已省略；如需补充，只保留当前有效结论。

## 关键字段

| 字段路径 | 含义推断 | 扩展用途 |
| --- | --- | --- |
| `data.id` | 任务 ID | 与 `data` 接口的 `taskId` 对齐 |
| `data.status` | 任务状态 | 当前采集为 `running` |
| `data.template.scheme.answerList` | 答案字段定义 | 判断单选、填空、选项 |
| `answerList[].fieldId` | 答案字段 ID | 保存请求可能会用到，待采集确认 |
| `answerList[].options` | 单选枚举 | 快捷键/自动选择候选 |
| `contentList[].fieldName` | 内容字段名 | 映射样本数据字段 |
| `processConfigVO.labelModel` | 标注模式 | 当前为投票模式 |
| `processConfigVO.voteNum` | 投票人数 | 当前为 3 |
| `assignStrategy` | 分配策略 | 当前为抢单或领取型 |

## 前端接入建议

- 用该接口建立题目 schema，不要把 DOM 文案作为唯一依据。
- 单选题选项应以 `options[].value` 为准。
- 内容字段应以 `contentList[].fieldName` 映射 `dataList[].data`。
- `fieldId` 暂时只作为内部字段标识记录；保存请求的 payload 结构还未采集确认。

## 风险 / 未确认项

- 保存请求是否使用 `fieldId`、`title`、`value` 或其他组件字段尚未采集。
- 不同 ASR 更优项目模板 ID 和 fieldId 是否稳定尚未确认。

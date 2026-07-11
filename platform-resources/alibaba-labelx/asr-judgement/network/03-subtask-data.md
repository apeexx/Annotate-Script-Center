# GET /api/v1/label/center/subTask/{subTaskId}/data

## 请求标识 / 目的

这是当前已采集到的核心数据源。该请求返回当前分页样本、模板结构、音频 URL 字段、ASR 文本字段、已有标注结果和部分样本状态。

该接口同时适用于：

- 未完成标注详情页。
- 已完成只读详情页，例如 URL 带 `disableEdit=true` 与 `isFinished=true`。

## 页面入口 / 触发动作

- 打开详情页。
- 刷新详情页。
- 打开或刷新已完成只读详情页。
- 切换每页条数。
- 使用筛选面板筛选任务状态。
- 保存答案后再次请求时会回显已保存 `result.markResult`。

标注详情页的规范化路由形态：

```text
/corpora/labeling/sdk?missionType=label&projectId=<REDACTED_PROJECT_ID>&subTaskId=<REDACTED_SUBTASK_ID>
```

已完成只读详情页的规范化路由形态：

```text
/corpora/labeling/sdk?disableEdit=true&isFinished=true&missionType=label&projectId=<REDACTED_PROJECT_ID>&subTaskId=<REDACTED_SUBTASK_ID>
```

注意：实际复制出来的 URL 或 Network 记录中，`subTaskId` 后可能夹带编码后的换行或空格，例如 `%0A`、`%20`。扩展解析 URL 参数时必须先 `decodeURIComponent` 再 `trim()`，构造接口或匹配请求时不要把这些空白字符当作真实 ID 的一部分。

## 请求摘要

- Method：`GET`
- URL：`/api/v1/label/center/subTask/<REDACTED_SUBTASK_ID>/data`
- Query：
  - `page=1`
  - `pageSize=10`，切换每页条数后可变为 `20` 等
  - `filterPassedVote=false`
  - `filter={"questions":[],"dataStatus":"ALL","questionsQueryConditions":"AND"}`，筛选已完成时 `dataStatus=FINISHED`
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
    "type": "LABEL",
    "taskId": "<REDACTED_TASK_ID>",
    "batchId": "<REDACTED_BATCH_ID>",
    "status": 0,
    "gmtCreate": "<REDACTED_TIME>",
    "gmtCommit": null,
    "taskName": "<REDACTED_TASK_NAME>",
    "size": 400,
    "template": {
      "id": "<REDACTED_TEMPLATE_ID>",
      "name": "<REDACTED_TEMPLATE_NAME>",
      "appId": "<REDACTED_PROJECT_ID>",
      "scheme": {
        "answerList": [
          {
            "type": "Answer",
            "label": "哪个ASR更优",
            "title": "单选",
            "fieldId": "<REDACTED_FIELD_ID_CHOICE>",
- 其余重复细节已省略；如需补充，只保留当前有效结论。

## 关键字段

| 字段路径 | 含义推断 | 扩展用途 |
| --- | --- | --- |
| `data.id` | 子任务 ID | 与 URL `subTaskId` 对齐 |
| `data.taskId` | 任务 ID | 可用于关联模板接口 |
| `data.size` | 子任务样本总数 | 进度展示 |
| `data.template.scheme.answerList` | 答案字段定义 | 解析单选和填空题 |
| `data.template.scheme.contentList` | 内容字段定义 | 映射音频、ASR 文本、wav_id |
| `data.dataList[]` | 当前分页样本 | 快判脚本核心样本来源 |
| `data.dataList[].data.raw_audio_path` | 签名音频 URL | 页面音频播放器来源，只能脱敏记录 |
| `data.dataList[].data.online_rec` | 两个 ASR 文本 | 可拆分 `asr_text1` / `asr_text2` |
| `data.dataList[].data.wav_id` | 样本 ID | 可用于页面定位，日志中脱敏 |
| `data.dataList[].result.markResult` | 已有标注结果 | 回显当前答案状态 |
| `data.dataList[].hasMistake` | 异常标记 | 进度/状态判断 |
| `data.status` | 子任务状态 | 未完成和已完成详情页可能不同 |
| `data.gmtCommit` | 子任务提交时间 | 已完成只读详情页通常有值 |

- `template` 与 `templateConfig` 均包含模板信息，`templateConfig` 额外包含 `questions`。
- `answerList` 的顺序应与 `result.markResult` 的顺序对应。
- `online_rec` 当前以 `asr_text1:` 和 `asr_text2:` 作为文本分隔线索，但解析时应容忍大小写、空格、换行和转义字符差异。
- `is_anti_cheating=true` 且 `better_asr_gt` 有值时，疑似防作弊或质检样本。
- `raw_audio_path` 的 query 是临时访问签名，不能持久化。
- 已完成只读详情页仍会刷新该接口，只是页面 URL 会多出 `disableEdit=true`、`isFinished=true`，并且子任务状态/提交时间字段可能体现已完成状态。

## 前端接入建议

- 首选监听该接口响应并生成当前页样本缓存。
- 不要保存完整 `online_rec` 到日志；只在页面运行态使用。
- 解析样本时以 `contentList[].fieldName` 为准，不要只靠固定字段名。
- 对 `result.markResult` 做空值容错：第二项填空可能为 `null`。
- 对分页和筛选预留参数解析能力，当前已确认 `pageSize` 和 `filter.dataStatus` 会变化。
- 从页面 URL 读取 `subTaskId` 时必须做 `decodeURIComponent(...).trim()`。
- 被动匹配 Network URL 时，允许 `subTaskId` 后存在 `%20` 或 `%0A` 这类编码空白，但内部缓存 key 只能使用修剪后的数字 ID。

## 风险 / 未确认项

- 翻页时是否仍使用同一接口，仅变更 `page`。
- 筛选 `questions` 时返回结构是否变化。
- 已完成只读详情页的完整响应结构是否与未完成详情页完全一致仍需后续用 DevTools 直接采集确认。

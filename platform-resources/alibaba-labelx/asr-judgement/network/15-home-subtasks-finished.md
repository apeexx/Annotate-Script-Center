# GET /api/v1/label/center/subTasks?finished=true

## 请求标识 / 目的

该请求加载标注首页“我的任务 / 已完成”列表。用户手工在标注首页验证到该接口会返回已提交的子任务包列表。

## 页面入口 / 触发动作

- 打开标注首页。
- 切换到“我的任务 / 已完成”。
- 或在首页手动请求 `finished=true` 列表。

## 请求摘要

- Method：`GET`
- URL：`/api/v1/label/center/subTasks`
- Query：
  - `type=label`
  - `keyword=`
  - `appId=<REDACTED_PROJECT_ID>`
  - `finished=true`
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
  "log": null,
  "data": {
    "data": [
      {
        "id": "<REDACTED_SUBTASK_ID>",
        "type": "LABEL",
        "taskId": "<REDACTED_TASK_ID>",
        "batchId": "<REDACTED_BATCH_ID>",
        "status": 1,
        "gmtCreate": "<REDACTED_TIME>",
        "gmtCommit": "<REDACTED_TIME>",
        "taskName": "<REDACTED_TASK_NAME>",
        "size": 400,
        "template": null,
        "templateConfig": null,
        "dataList": null,
        "dataResultHistory": null,
        "rejectReason": "<REDACTED_OR_NULL>",
        "labelModel": "vote",
        "supportModify": null,
        "taskType": "custom"
      }
- 其余重复细节已省略；如需补充，只保留当前有效结论。

## 关键字段

- `finished=true` 对应“我的任务 / 已完成”列表。
- `data.data[]` 是已提交子任务包列表。
- `id` 是子任务 ID，可用于进入详情页的 `subTaskId`。
- `taskId` 是任务 ID。
- `batchId` 是分包 ID。
- `status=1` 在本轮样例中表示已提交或已完成状态。
- `gmtCommit` 是提交时间。
- ASR 更优判断分包当前可用 `labelModel=vote`、`size=400` 和任务名包含 `ASR更优结果判断` / `ASR更优` 识别。
- 历史转写分包可用 `labelModel=single`、`size=50` 或任务名 `中文普通话asr任务` 排除。
- `template`、`templateConfig`、`dataList` 在首页列表中为 `null`，详情数据仍需进入 SDK 详情页后通过 `/subTask/{subTaskId}/data` 获取。
- `rejectReason` 可能为字符串或 `null`，含义需要后续结合页面文案确认。

## 前端接入建议

- 首页识别已完成包时监听 `finished=true` 的 `subTasks` 请求，并先过滤非 ASR 更优判断分包，避免同账号历史转写数据混入统计上传。
- 从列表进入详情页时，应使用 `id` 作为 `subTaskId`，并先做字符串 trim。
- 进入已完成只读详情页后，继续依赖 `03-subtask-data.md` 中的 `/subTask/{subTaskId}/data` 获取完整样本和答案。
- 不要把首页列表的 `template=null` 误判为没有模板；模板在详情页或任务模板接口中读取。

## 风险 / 未确认项

- `rejectReason` 的业务含义需要结合页面提示二次确认。
- `supportModify` 有值时是否允许修改已完成包未采集。
- 已完成列表点击详情时前端是否固定带 `disableEdit=true` 与 `isFinished=true` 尚需直接观察。

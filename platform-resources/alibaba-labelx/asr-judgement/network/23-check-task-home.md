# 审核首页列表请求

## 请求标识 / 目的

- 当前文件记录该请求或该组请求的稳定参考结论。

## 页面入口 / 触发动作

- 当前文件未补充额外入口说明；默认按对应页面自然加载或用户显式操作触发。

## 请求摘要

- 当前文件未补充更细的请求摘要。

## 请求体摘要

- 当前记录未见独立 request body；以路径参数或 query 为主。

## 响应摘要

`subTasks?type=check&finished=true` 的列表项字段与标注首页已完成分包基本一致：

```json
{
  "id": "<REDACTED_SUBTASK_ID>",
  "type": "check",
  "taskId": "<REDACTED_TASK_ID>",
  "batchId": "<REDACTED_BATCH_ID>",
  "status": "<REDACTED_STATUS>",
  "gmtCreate": "<REDACTED_TIME>",
  "gmtCommit": "<REDACTED_TIME>",
  "taskName": "<REDACTED_TASK_NAME>",
  "size": "<REDACTED_COUNT>",
  "template": "<REDACTED_TEMPLATE>",
  "templateConfig": "<REDACTED_TEMPLATE_CONFIG>",
  "dataList": "<REDACTED_LIST>",
  "dataResultHistory": "<REDACTED_HISTORY>",
  "labelModel": "<REDACTED_LABEL_MODEL>",
  "taskType": "<REDACTED_TASK_TYPE>"
}
```

`tasks?subTaskType=check` 的列表项包含 `taskId`、`subTaskType`、`name`、`gmtCreate`、`total`、`left`、`labelModel` 等字段。

## 关键字段

- 当前重点继续以路径、query、响应字段名和脱敏占位为主。

## 前端接入建议

- 接入时优先复用当前页已有稳定锚点，只做只读监听或最小范围辅助。

## 风险 / 未确认项

- 文档只保留当前有效结论；新增缺口统一回写稳定参考页或 `log.md`。

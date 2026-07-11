# POST /api/v2/item/get-task-item-list-lite

## 请求标识 / 目的

读取 Task21 Data 页条目列表，支持全部数据、批次视图、角色切换、筛选、分页。

## 页面入口 / 触发动作

- 进入 Data 页。
- 切换 `All` / `By Batch`。
- 切换标注 / 标注内审角色。
- 搜索、筛选、分页。

Data 页表格已经显示表头：`Item ID`、`Frames`、`Invalid Frames`、`Import Round`、`Batch`、`Stage`、`Label Status`、`Review Status` 等。

列表为空时显示 `No Data`。有数据时表格显示条目行，右上按钮根据选择状态从 `Claim Label` 变为 `Label: N`。

## 请求摘要

- Method：`POST`
- URL：
  - `/api/v2/item/get-task-item-list-lite`
  - `/api/v2/item/get-item-list-lite`
- Content-Type：`application/json`
- Status：`200`
- Request Header 摘要：敏感字段已脱敏。
- Query keys：无。

## 请求体摘要

{
      "taskId": "{taskId}",
      "nodeId": "{nodeId}",
      "role": "{roleId}",
      "pageNum": "number",
      "pageSize": "number",
      "status": "<OPTIONAL_STATUS>",
      "packageIds": ["{batchId}"],
      "search": "<OPTIONAL_SEARCH_TEXT>",
      "searchModule": {
        "type": "AND",
        "units": []
      }
    }

## 响应摘要

{
      "code": 0,
      "data": {
        "total": "number",
        "data": [
          {
            "_id": "{itemId}",
            "domainId": "<PUBLIC_ITEM_ID_SUFFIX>",
            "importRound": "<PUBLIC_ROUND_LABEL>",
            "packageInfo": {
              "name": "<PUBLIC_BATCH_NAME>"
            },
            "node": "<PUBLIC_NODE_LABEL>",
            "labelStatus": "<STATUS_ENUM>",
            "checkStatus": "<STATUS_ENUM>",
            "operateTime": "<TIMESTAMP>"
          }
        ]
      }
    }

## 关键字段

- `domainId` 是页面显示的条目号后缀，不等同于 Mongo 风格 `{itemId}`。
- `labelStatus`、`checkStatus` 决定行状态和能否送审 / 审核。

## 前端接入建议

读取条目列表时只记录条目结构和状态枚举，不记录客户原始文本或完整资源字段。

## 风险 / 未确认项

- 大量分页、复杂筛选和失败响应结构待补。

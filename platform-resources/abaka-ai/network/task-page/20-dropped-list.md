# POST /api/v2/item/get-task-item-abandon-list

## 请求标识 / 目的

加载 Task 页面 Dropped 列表，显示已放弃条目。该接口属于 Task 页面公共状态列表能力。

## 页面入口 / 触发动作

在 Task21 Data 页点击 `Dropped` Tab。

- 页面：`/task-v2/data-item?taskId={taskId}&vm=all&dm=all`。
- 角色：标注角色已实测；标注内审角色只读观察过空列表。
- 本轮标注角色 Dropped 列表有 1 条测试数据。

- URL 变为 `/task-v2/data-item?taskId={taskId}&vm=all&dm=abandoned`。
- Dropped Tab 显示数量。
- 表格行 Label Status 显示 `Dropped`。
- 顶部主按钮为 `Recovery`，未选中时 disabled，选中一条后可点击。

## 请求摘要

- Method：`POST`
- URL / Path：`/api/v2/item/get-task-item-abandon-list`
- Content-Type：`application/json`
- Status：`200`
- Query keys：无
- Request Header 摘要：敏感字段已脱敏。

## 请求体摘要

{
      "taskId": "{taskId}",
      "pageNum": "<number>",
      "pageSize": "<number>",
      "search": {
        "type": "AND",
        "units": []
      },
      "nodeId": "{nodeId}"
    }

## 响应摘要

{
      "code": 0,
      "data": {
        "data": [
          {
            "_id": "{itemId}",
            "taskId": "{taskId}",
            "nodeId": "{nodeId}",
            "status": "PROCESSING",
            "processStatus": {
              "label": "LABELING",
              "check": "UNCHECKED"
            },
            "permission": ["<permission shape>"]
          }
        ],
        "total": "<number>"
      }
    }

## 关键字段

- Dropped 视图使用 `dm=abandoned`。
- Dropped 列表 endpoint 名称使用 `abandon`，页面文案使用 `Dropped`。

## 前端接入建议

- 可以被动监听该接口识别 Dropped 列表。
- 不主动点击 `Recovery`。
- 恢复必须由用户人工确认，且只允许单条测试或用户明确选择的条目。

## 风险 / 未确认项

- Dropped 空列表在标注角色下的中文提示待补。
- Dropped 列表分页、筛选叠加结构待补。

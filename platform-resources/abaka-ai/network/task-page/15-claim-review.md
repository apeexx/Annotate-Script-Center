# POST /api/v2/item/receive-item 领取审核

## 请求标识 / 目的

由内审角色页 `Claim Review / 领取审核` 按钮触发，用于领取审核条目并进入内审 `/items` 页面。该接口由 Task21、Task17 复用，通过 `taskId` 与 `nodeId` 区分任务和节点。

## 页面入口 / 触发动作

打开 `role={reviewRoleId}` 的 Task21 Data 页，点击 `Claim Review`。2026-05-16 二次测试再次点击领取审核，Task21 仍成功领取 1 条测试数据，未触发空池响应。

2026-05-16 补测 Task17 内审 Data 页点击 `领取审核`，用于捕获无可领取数据的失败响应。

- 页面：`/task-v2/data-item?taskId={taskId}&vm=all&dm=all&role={reviewRoleId}`。
- 简体中文按钮文案为 `领取审核`。
- 列表显示 `No Data` 时，仍可点击 `Claim Review`。
- 表格包含 `Reviewer`、`Review Team` 列。

页面显示 `Successfully Claimed`，按钮区变为 `Save / Skip / Reject / Label / Pass`。

二次测试中仍进入内审 `/items` 页面，后续只观察，不点击 `Reject / Label / Pass` 或任何审核完成类动作。

Task17 空池补测中，请求未跳转 `/items`，返回失败业务码；页面随后出现验证组件，本轮未继续操作验证组件。

## 请求摘要

- Method：`POST`
- URL：`/api/v2/item/receive-item`
- Content-Type：`application/json`
- Status：`200`
- Request Header 摘要：敏感字段已脱敏。
- Query keys：无。

## 请求体摘要

{
      "taskId": "{taskId}",
      "nodeId": "{reviewNodeId}",
      "search": {
        "type": "AND",
        "units": []
      }
    }

## 响应摘要

{
      "code": 0,
      "data": ["{itemId}"]
    }

空池失败响应：

    {
      "code": 1000000,
      "message": "领取条目失败，无条目可领"
    }

## 关键字段

- 同一个 `receive-item` 接口通过 `nodeId` 区分领取标注和领取审核。
- 内审页面的 `processStatus.check` 进入 `CHECKING` 类状态。

## 前端接入建议

领取审核属于状态变更。扩展不得自动调用；只可记录用户手动领取后的脱敏结构。

## 风险 / 未确认项

- `Reject / Label / Pass` 流转接口未在本轮测试。

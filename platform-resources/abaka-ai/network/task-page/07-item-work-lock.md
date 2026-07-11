# POST /api/v2/item/work

## 请求标识 / 目的

进入 `/items` 标注或内审页时建立当前条工作状态 / 锁定状态。

## 页面入口 / 触发动作

- 领取标注成功进入 `/items`。
- 领取审核成功进入 `/items`。
- 直接打开可编辑 `/items` URL。

页面显示加载态和锁定/解锁状态，随后出现可操作按钮。

页面显示 `Lock`、`Unlocked state supports modification tags`、计时器和操作按钮。

## 请求摘要

- Method：`POST`
- URL：`/api/v2/item/work`
- Content-Type：`application/json`
- Status：`200`
- Request Header 摘要：敏感字段已脱敏。
- Query keys：无。

## 请求体摘要

{
      "nodeId": "{nodeId}",
      "itemId": "{itemId}"
    }

## 响应摘要

{
      "code": 0,
      "data": {}
    }

## 关键字段

该接口会改变或刷新工作占用状态，属于状态相关接口。

## 前端接入建议

后续扩展不得主动调用；只可被动监听，记录是否进入工作态。

## 风险 / 未确认项

- 锁定失败、他人占用、长时间暂停后的重新工作接口待补。

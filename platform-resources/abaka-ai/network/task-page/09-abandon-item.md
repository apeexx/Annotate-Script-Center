# POST /api/v2/item/abandon-item

## 请求标识 / 目的

由标注页 `Drop` 按钮触发，用于放弃当前条目。

## 页面入口 / 触发动作

在 Task21 标注页点击 `Drop`。本轮未观察到二次确认弹窗，点击后直接发出请求。

- 页面：Task21 `/items` 标注页。
- 当前条已有或没有标签均可点击 `Drop`。
- 页面底部可见 `Save / Drop / Skip / Submit`。

- 页面显示 `Drop` 操作提示。
- URL 切换到下一条 `{itemId}`，并追加 `currentIds`。
- 右侧条目列表增加已处理条目。
- 本轮未观察到恢复按钮。

## 请求摘要

- Method：`POST`
- URL：`/api/v2/item/abandon-item`
- Content-Type：`application/json`
- Status：`200`
- Request Header 摘要：敏感字段已脱敏。
- Query keys：无。

## 请求体摘要

{
      "nodeId": "{nodeId}",
      "itemId": "{itemId}",
      "reason": "",
      "workTime": "number"
    }

## 响应摘要

{
      "code": 0,
      "data": true
    }

## 关键字段

- `reason` 可为空字符串。
- `data=true` 表示放弃成功。
- 放弃后平台会尝试自动领取下一条。

## 前端接入建议

高风险动作。后续扩展不得自动触发；如提供辅助，只能弹出二次确认，并在用户点击平台原生按钮后被动监听结果。

## 风险 / 未确认项

- 放弃失败响应待补。
- 放弃后恢复接口待补。
- 中文环境确认弹窗是否出现待补。

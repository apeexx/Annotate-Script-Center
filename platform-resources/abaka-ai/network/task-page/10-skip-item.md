# POST /api/v2/item/skip-item

## 请求标识 / 目的

由标注页 `Skip` 按钮触发，用于跳过当前条目。

## 页面入口 / 触发动作

在 Task21 标注页点击 `Skip`。本轮未观察到二次确认弹窗，点击后直接发出请求。

- 页面：Task21 `/items` 标注页。
- 当前条未提交。
- 底部按钮：`Save / Drop / Skip / Submit`。

- 页面出现 `Skiped Successfully`。
- 随后出现 `Submitted successfully, has automatically received the next`。
- URL 切换到下一条 `{itemId}`，并追加 `currentIds`。

## 请求摘要

- Method：`POST`
- URL：`/api/v2/item/skip-item`
- Content-Type：`application/json`
- Status：`200`
- Request Header 摘要：敏感字段已脱敏。
- Query keys：无。

## 请求体摘要

{
      "nodeId": "{nodeId}",
      "itemId": "{itemId}",
      "workTime": "number"
    }

## 响应摘要

{
      "code": 0,
      "data": true
    }

## 关键字段

- HTTP 200 且 `data=true` 表示跳过成功。
- 跳过会改变当前条目状态，并触发自动领取。

## 前端接入建议

高风险动作。扩展不得自动触发；只允许被动监听 endpoint、status、业务结果和跳转行为。

## 风险 / 未确认项

- 跳过失败响应待补。
- 跳过后的恢复接口待补。

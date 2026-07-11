# Skipped 条目重新进入标注

## 请求标识 / 目的

记录 Skipped 条目从 Data 页重新进入标注工作态的链路。本轮未观察到 Skipped 专用 `recover-item` 请求；实际入口是选中 Skipped 行后点击 `Label: 1`。

## 页面入口 / 触发动作

1. 打开 `Skipped` Tab。
2. 选中一条 Skipped 测试数据。
3. 点击顶部 `Label: 1`。

- 页面：`/task-v2/data-item?taskId={taskId}&vm=all&dm=skipped`。
- Skipped 列表中有 1 条测试数据。
- 行 Label Status 为 `Skipped`。
- 顶部按钮为 `View` 和 `Label: 1`。

- 页面进入 `/items` 标注页。
- `get-item-info` 返回中 `processStatus.label` 变为 `LABELING`。
- `permission[].status` 变为 `WORKING`。
- 页面显示 `Save / Drop / Skip / Submit` 等标注操作按钮。

## 请求摘要

- Method：`POST`
- URL / Path：`/api/v2/item/receive-item`
- Content-Type：`application/json`
- Status：`200`
- Query keys：无
- Request Header 摘要：敏感字段已脱敏。

## 请求体摘要

{
      "taskId": "{taskId}",
      "nodeId": "{nodeId}",
      "itemIds": ["{itemId}"]
    }

## 响应摘要

{
      "code": 0,
      "data": ["{itemId}"]
    }

## 关键字段

- Skipped 恢复不是 Dropped 的通用 `recover-item`，而是通过 `receive-item` 重新领取指定 item。
- 该动作会改变条目工作状态，并触发 `work` 锁定。

## 前端接入建议

- 后续扩展可以被动识别 `dm=skipped` 下的 `receive-item` 作为 Skipped 重新进入标注事件。
- 不得自动点击 `Label: N`。
- 若提供辅助入口，必须二次确认并明确会重新领取 / 锁定条目。

## 风险 / 未确认项

- Skipped 是否还有其他恢复入口待补。
- Skipped 重新进入标注后如果不保存直接退出的释放规则待补。
- 中文环境按钮文案待补。

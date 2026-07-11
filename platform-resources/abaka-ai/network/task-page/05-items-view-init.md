# POST /api/v2/item/get-view-item-permission 等查看页初始化

## 请求标识 / 目的

进入 `/items?viewMode=true` 查看页时读取权限、条目、标签、问题、记录、AI 检查、无效帧、抽帧和右侧条目列表。

## 页面入口 / 触发动作

在 Data 页点击 `View`，或直接打开 Task21 查看页 URL。

- 页面：Task21 Data 页。
- 操作：只读查看，不改变条目状态。

页面显示资源区、same_font 只读结构、右侧条目列表、锁定提示和图片查看器按钮。

## 请求摘要

- Method：`POST`
- URL：
  - `/api/v2/item/get-view-item-permission`
  - `/api/v2/item/get-item-history`
  - `/api/v2//item/check-operate-item-permission`
  - `/api/v2/item/get-item-info`
  - `/api/v2/label/find-labels`
  - `/api/v2/label/find-issues`
  - `/api/v2/label/find-label-records`
  - `/api/v2/label/get-ai-check-result`
  - `/api/v2/item/find-invalidate-frame/`
  - `/api/v2/item/sampling/get-frames-data`
  - `/api/v2/item/find-items-base-info`
- Content-Type：`application/json`
- Status：`200`
- Request Header 摘要：敏感字段已脱敏。
- Query keys：无。

## 请求体摘要

{
      "taskId": "{taskId}",
      "itemId": "{itemId}",
      "nodeId": "{nodeId}",
      "selectIds": ["{selectId}"],
      "pageNum": "number",
      "pageSize": "number"
    }

不同接口只取其中必要字段，例如 `find-labels` 主要使用 `itemId` + `taskId`。

## 响应摘要

{
      "code": 0,
      "data": {
        "permission": "<BOOLEAN_OR_OBJECT>",
        "item": "<ITEM_INFO_OBJECT>",
        "labels": [
          {
            "data": {
              "label": "Annotation Area_same_font",
              "value": "<ENUM_VALUE>"
            }
          }
        ],
        "records": [],
        "issues": []
      }
    }

## 关键字段

- `get-view-item-permission` 决定只读权限。
- `find-labels` 是 same_font 历史标签读取来源。
- `find-items-base-info` 用于右侧条目列表。

## 前端接入建议

查看页适合只读解析当前条结构；不要在查看页触发保存或流转动作。

## 风险 / 未确认项

- 查看页多 `selectIds` 右侧列表点击是否发起新请求，Task21 单条不足时待补。

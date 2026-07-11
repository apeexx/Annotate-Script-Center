# POST /api/v2/label/save-labels 暂存 / Save

## 请求标识 / 目的

记录 Task21 标注页 `Save` 按钮。实测 `Save` 复用 `/api/v2/label/save-labels`。

## 页面入口 / 触发动作

选择 same_font 和派生字段后点击底部 `Save`。

- same_font 已选择 `true`。
- `image_b_texts_removed` 已选择 `true`。
- `other_changes` 已选择 `unsure`。

页面出现 `Staging` 提示。

## 请求摘要

- Method：`POST`
- URL：`/api/v2/label/save-labels`
- Content-Type：`application/json`
- Status：`200`
- Request Header 摘要：敏感字段已脱敏。
- Query keys：无。

## 请求体摘要

{
      "nodeId": "{nodeId}",
      "itemId": "{itemId}",
      "taskId": "{taskId}",
      "workTime": "number",
      "data": {
        "create": [
          {
            "label": "Annotation Area_same_font",
            "value": "true"
          },
          {
            "label": "Annotation Area_same_font_true_image_b_texts_removed",
            "value": "true"
          },
          {
            "label": "Annotation Area_same_font_true_other_changes",
            "value": "unsure"
- 其余重复细节已省略；如需补充，只保留当前有效结论。

## 响应摘要

{
      "code": 0,
      "data": {
        "insertData": [
          {
            "_id": "<REDACTED_LABEL_ID>",
            "hash": "<REDACTED_HASH>",
            "dataId": "number"
          }
        ],
        "updateCount": 0,
        "updateData": [],
        "deleteCount": 0,
        "deleteData": []
      }
    }

## 关键字段

`Save` 是暂存按钮，底层与标签保存接口一致。

## 前端接入建议

后续扩展不要主动调用。若提供快捷键，只能触发页面原生按钮并要求人工确认。

## 风险 / 未确认项

- 暂存失败响应待补。
- 中文按钮文案和 Toast 待补。

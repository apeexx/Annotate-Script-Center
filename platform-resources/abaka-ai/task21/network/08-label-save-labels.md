# POST /api/v2/label/save-labels

## 请求标识 / 目的

保存 Task21 same_font 主标注和派生字段。当前实测中，点击 same_font / 派生字段本身只改变前端状态；点击 `Save` 时发送保存请求。

## 页面入口 / 触发动作

- 点击 `same_font = true`。
- 点击派生字段 `image_b_texts_removed = true`。
- 点击派生字段 `other_changes = unsure`。
- 点击页面底部 `Save`。
- 2026-05-16 补测：点击 `other_changes = specify`，输入自由文本后点击 `暂存`。
- 2026-05-16 Task21 快捷键第一版：按键触发 same_font/派生字段选项点击时，本质仍是页面 DOM 交互；扩展不直接发起保存请求。

- 页面：Task21 标注页。
- 当前条显示 `same_font`，选择 `true` 后展开 `image_b_texts_removed`、`other_changes`。

点击 `Save` 后页面出现 `Staging` 提示。简体中文环境点击 `暂存` 后页面出现 `暂存成功`。点击字段本身未观察到自动保存请求。

## 请求摘要

- Method：`POST`
- URL：`/api/v2/label/save-labels`
- Content-Type：`application/json`
- Status：`200`
- Request Header 摘要：敏感字段已脱敏。
- Query keys：无。

## 请求体摘要

单选和派生字段保存：

    {
      "nodeId": "{nodeId}",
      "itemId": "{itemId}",
      "taskId": "{taskId}",
      "workTime": "number",
      "data": {
        "create": [
          {
            "id": "number",
            "hash": "<REDACTED_HASH>",
            "label": "Annotation Area_same_font",
            "value": "true",
            "drawType": "QUESTION",
            "count": "number",
            "frameIndex": "number"
          },
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
        "updateCount": "number",
        "updateData": [],
        "deleteCount": "number",
        "deleteData": []
      }
    }

## 关键字段

- `data.create[]` 放新增标签。
- `data.update[]` 放更新标签。
- `data.delete[]` 放删除标签。
- `label` 使用 `Annotation Area_...` 层级表达 same_font 与派生字段。
- `value` 保存公开枚举值，例如 `true`、`unsure`。
- `other_changes = specify` 下的 textarea 文本同样进入 `value` 字段；文档只记录 `<TEXT_VALUE>` 占位，不记录实际文本。

## 前端接入建议

扩展只被动监听该接口。AI 建议不得自动写入 `data.create/update/delete`，必须由用户人工确认。快捷键能力仅允许触发页面真实点击，不允许直接调用该接口。

## 风险 / 未确认项

- 保存失败响应待补。

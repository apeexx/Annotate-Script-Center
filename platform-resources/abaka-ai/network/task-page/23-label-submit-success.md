# POST /api/v2/item/submit-item 标注送审成功

## 请求标识 / 目的

记录标注权限下，Task21 单条测试数据填写最小 `same_font` 后点击 `Submit` 的成功送审链路。该动作是高风险状态变更，只用于测试账号单条采集。

## 页面入口 / 触发动作

1. 从 Skipped 列表选中一条测试数据并点击 `Label: 1`，进入 `/items` 标注页。
2. 在 `same_font` 中选择一个最小有效枚举值。
3. 点击底部 `Submit`。

- 页面：`/items?taskId={taskId}&dm=skipped&itemId={itemId}&nodeId={nodeId}&selectIds={itemId}`。
- 角色：标注权限。
- 底部按钮：`Save`、`Drop`、`Skip`、`Submit`。
- `same_font` 为空时会前端校验阻断；本轮选择最小有效值后成功发起送审。

- 点击 `Submit` 后页面进入加载态，显示当前条不可操作。
- 成功后底部操作按钮从 `Save / Drop / Skip / Submit` 变为 `Claim`。
- 当前条仍停留在 `/items`，未观察到自动领取下一条。
- Data 页 Overview 中该条显示 `Labeled / Pending Review`。

## 请求摘要

- Method：`POST`
- URL / Path：`/api/v2/item/submit-item`
- Content-Type：`application/json`
- Status：`200`
- Query keys：无
- Request Header 摘要：敏感字段已脱敏。

## 请求体摘要

送审前页面先保存本次 `same_font`：

    {
      "nodeId": "{nodeId}",
      "itemId": "{itemId}",
      "taskId": "{taskId}",
      "workTime": "<number>",
      "data": {
        "create": [
          {
            "hash": "0_Annotation Area_same_font",
            "label": "Annotation Area_same_font",
            "value": "<ENUM_VALUE>",
            "drawType": "QUESTION",
            "count": "<number>",
            "frameIndex": "<number>"
          }
        ],
- 其余重复细节已省略；如需补充，只保留当前有效结论。

## 响应摘要

保存响应：

    {
      "code": 0,
      "data": {
        "insertData": ["<label shape>"],
        "updateCount": "<number>",
        "updateData": [],
        "deleteCount": "<number>",
        "deleteData": []
      }
    }

提交响应：

    {
      "code": 0,
      "data": true
    }

## 关键字段

- `approve` 是提交请求的布尔字段，标注权限送审时也存在。
- `submit-item` 成功后会把标注节点状态置为 `PASSED`，主标注状态为 `LABELED`。
- 送审前会自动或同步保存当前未落库的标签变更。

## 前端接入建议

- 后续扩展不得主动调用 `submit-item`。
- 可以被动监听 `save-labels -> submit-item` 链路识别用户提交成功。
- 送审成功判断必须以真实 `submit-item` 返回和后续 `get-item-info` 状态为准，不能只看按钮点击。

## 风险 / 未确认项

- `approve=false` 场景含义待补。
- 提交失败响应待补。
- 成功后是否在多选条目场景自动跳转下一条待补。
- 中文环境成功 Toast 待补。

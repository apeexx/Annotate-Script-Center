# POST /api/v2/item/get-item-info（Task21 标注页脱敏结构）

## 请求标识 / 目的

- 当前文件记录该请求或该组请求的稳定参考结论。

## 页面入口 / 触发动作

- 标注区外层：`.grid-board`
- 字段块：`.l-item`
- 字段标题：`.l-title-text`
- 标题动作区：`.l-header-actions`
- 图片标题：`.content-title span`（`image_a` / `image_b` / `image_b_removed`）
- 图片区域：`.content-image-view img`

## 请求摘要

- Method：`POST`
- URL：`/api/v2/item/get-item-info`
- Content-Type：`application/json`
- credentials：`include`（浏览器已有登录会话）

## 请求体摘要

{
      "taskId": "{taskId}",
      "itemId": "{itemId}",
      "nodeId": "{nodeId}"
    }

## 响应摘要

{
      "code": 0,
      "data": {
        "...": "...",
        "<images_path>": {
          "image_a|imageA": "<masked>",
          "image_b|imageB": "<masked>",
          "image_b_removed|imageBRemoved": "<masked>"
        },
        "<texts_path>": {
          "image_a_texts|imageATexts": "<string-or-array>",
          "image_b_texts|imageBTexts": "<string-or-array>",
          "text_positions|textPositions|positions|bbox|boxes": "<object-or-array>"
        }
      }
    }

## 关键字段

- 当前重点继续以路径、query、响应字段名和脱敏占位为主。

## 前端接入建议

- 接入时优先复用当前页已有稳定锚点，只做只读监听或最小范围辅助。

## 风险 / 未确认项

- 文档只保留当前有效结论；新增缺口统一回写稳定参考页或 `log.md`。

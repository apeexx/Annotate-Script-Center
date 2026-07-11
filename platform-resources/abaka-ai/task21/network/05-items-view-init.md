# POST /api/v2/item/get-item-info（Task21 查看页脱敏结构）

## 请求标识 / 目的

- 当前文件记录该请求或该组请求的稳定参考结论。

## 页面入口 / 触发动作

- 当前文件未补充额外入口说明；默认按对应页面自然加载或用户显式操作触发。

## 请求摘要

- Method：`POST`
- URL：`/api/v2/item/get-item-info`
- Content-Type：`application/json`
- credentials：浏览器同源会话（不手写 token/cookie）

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
        "<path_to_images>": {
          "image_a|imageA": "<masked-url-or-object>",
          "image_b|imageB": "<masked-url-or-object>",
          "image_b_removed|imageBRemoved": "<masked-url-or-object>"
        },
        "<path_to_texts>": {
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

# POST /api/v2/item/get-item-search-template-list

## 请求标识 / 目的

读取 Task21 Data 页筛选模板，用于渲染筛选区字段和可选条件。

## 页面入口 / 触发动作

进入 `/task-v2/data-item` Data 页或刷新页面。

- 页面：Task21 Data 页。
- 语言：本轮实测为 English，既有文档已记录中文文案。
- 角色：标注或标注内审均会加载筛选模板。

筛选区显示 `Search by ID or filename...`、`Filter`、搜索 / 重置控件。

## 请求摘要

- Method：`POST`
- URL：`/api/v2/item/get-item-search-template-list`
- Content-Type：`application/json`
- Status：`200`
- Request Header 摘要：敏感字段已脱敏，不记录 cookie / authorization。
- Query keys：无。

## 请求体摘要

{
      "taskId": "{taskId}",
      "nodeId": "{nodeId}",
      "role": "{roleId} 或缺省",
      "module": "<FILTER_MODULE>"
    }

## 响应摘要

{
      "code": 0,
      "data": [
        {
          "field": "<FIELD_NAME>",
          "label": "<PUBLIC_LABEL>",
          "type": "<CONTROL_TYPE>",
          "options": [
            {
              "label": "<PUBLIC_OPTION_LABEL>",
              "value": "<ENUM_VALUE>"
            }
          ]
        }
      ]
    }

## 关键字段

- `taskId` 用于确定当前任务模板。
- 模板返回字段决定筛选区控件类型，后续脚本不应硬编码所有筛选项。

## 前端接入建议

只被动读取模板结构，用于识别筛选区；不要保存用户输入的筛选值。

## 风险 / 未确认项

- 不同角色下筛选模板字段是否完全一致仍待补。

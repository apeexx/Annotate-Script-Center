# 04-数据标注 网络请求

## 请求标识 / 目的

- 页面路由：`/mytask/mark?taskId=<taskId>&packageId=<packageId>[&scene=check]`
- 入口：任务详情页 → 点击分包"查看"按钮
- 鉴权：`Authorization: Bearer <JWT>`

## 页面入口 / 触发动作

| 序号 | URL | 方法 | 用途 |
|------|-----|------|------|
| 1 | `/api/account/info` | POST | 当前用户信息与角色 |
| 2 | `/api/task/detail/<taskId>` | GET | 任务详情（含 `dataRoot`、模板 ID） |
| 3 | `/api/taskItem/packageItemList/<packageId>` | GET | **全量条目列表**（`pageSize=9999`，不分页） |
| 4 | `/api/taskItem/checkPackageItemList/<packageId>` | GET | **质检分包全量条目列表**（仅 `scene=check`） |
| 5 | `/api/template/detail/<templateId>` | GET | 模板字段配置 |

## 请求摘要

- 默认标注场景读取 `packageItemList`；`scene=check` 必须切换到 `checkPackageItemList`。
- 两个条目接口均使用 URL 路径中的 `packageId`，鉴权头沿用页面登录态。

## 请求体摘要

- 当前记录未见独立 request body；以路径参数或 query 为主。

## 响应摘要

- 条目列表统一位于 `data.result.items`，并带 `pageIndex / pageSize / totalCount`。
- `packageItemList` 的 `id` 即原标注条目 ID，常用字段包括 `number / fileName / url / text / dataStatus`。
- `checkPackageItemList` 的 `id` 是质检记录 ID；`markTaskItemId` 才是对应原标注条目 ID。常用字段还包括 `checkStatus / dataRoot`，其中 `number` 允许不连续、`text` 允许为空。

## 关键字段

- **URL**：`GET /api/template/detail/<templateId>`
- **响应关键字段**：
  ```json
  {
    "name": "闽南标注",
    "templateItems": [
      {
        "name": "文本",
        "fieldName": "text",
        "necessary": true,
        "type": 0
      },
      {
        "name": "语速",
        "fieldName": "speed",
        "necessary": true,
        "type": 0
      }
    ]
  }
  ```
- 当前越南语模板同时使用 `text / speed`，保存时 `mark` 为 `{"text":"...","speed":"slow|normal|fast"}` 的 JSON 字符串。
- 质检页接入 AI 或标注保存时，必须保留质检 `id` 作为来源记录，并使用 `markTaskItemId` 作为原标注条目上下文。
- 音频地址按“条目 `dataRoot` -> 任务详情 `project.dataRoot` -> 默认 OSS 根地址”选择根地址，再拼接条目相对 `url`。

## 前端接入建议

- 接入时先根据 `scene` 选择条目接口，再按响应数组顺序与左侧列表索引对应，不能用不连续的 `number` 直接当数组下标。
- 质检页若需要修改原标注文本或语速，只点击 `.mark-area` 的页面真实保存按钮；不得直接调用质检写接口。

## 风险 / 未确认项

- 当前未确认验收 / 重检场景的列表接口与写操作 payload；不得从本质检场景外推。
- 不记录 token、authorization、完整音频 URL 或真实文本。

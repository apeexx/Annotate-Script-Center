# 02-我的任务列表 网络请求

## 请求标识 / 目的

- 页面路由：`/mytask/index`
- 前端框架：Vue 2 + Element UI
- 访问方式：顶部菜单「我的任务」
- 鉴权格式：`Authorization: Bearer <JWT>`
- 分页格式：`page` + `size`

---

## 页面入口 / 触发动作

- 当前文件未补充额外入口说明；默认按对应页面自然加载或用户显式操作触发。

## 请求摘要

- 当前文件未补充更细的请求摘要。

## 请求体摘要

- 当前记录未见独立 request body；以路径参数或 query 为主。

## 响应摘要

- **响应关键字段**：
  - `data.result.id`：用户 ID
  - `data.result.username`：用户名
  - `data.result.name`：显示名
  - `data.result.roles`：角色代码（`a` = 标注员）
  - `data.result.curRole`：当前角色
  - `data.result.sex`：性别（2=未知/未设）
  - `data.result.age`：年龄
  - `data.isSucceed`：是否成功
- **响应关键字段**：
  - `data.result.indexFrom`：起始索引
  - `data.result.pageIndex`：当前页码
  - `data.result.pageSize`：每页条数
  - `data.result.totalCount`：总任务数

## 关键字段

- 当前重点继续以路径、query、响应字段名和脱敏占位为主。

## 前端接入建议

- 接入时优先复用当前页已有稳定锚点，只做只读监听或最小范围辅助。

## 风险 / 未确认项

- 文档只保留当前有效结论；新增缺口统一回写稳定参考页或 `log.md`。

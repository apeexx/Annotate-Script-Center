# GET /api/v1/appInfo/listAuthAppInfo

## 请求标识 / 目的

该请求读取当前用户可访问的应用/项目元信息。它出现在详情页初始化阶段，但不是 ASR 样本内容的核心数据源。

## 页面入口 / 触发动作

- 打开详情页。
- 刷新详情页。

## 请求摘要

- Method：`GET`
- URL：`/api/v1/appInfo/listAuthAppInfo`
- Query：
  - `isRedirect=false`
  - `module=label`
  - `_=<REDACTED_TIMESTAMP>`
- Request Body：无。
- Status：`200`

## 请求体摘要

- 当前记录未见独立 request body；以路径参数或 query 为主。

## 响应摘要

- 如果需要确认当前页面所属项目，优先使用 URL 中的 `projectId`，而不是记录该接口完整响应。

## 关键字段

- `id` 对应当前 LabelX 应用或项目 ID。
- `isAdmin` 表示当前用户是否为应用管理员。
- `ownerVO`、`creatorVO`、`deptInfo` 包含人员或组织信息，必须脱敏。
- `iconUrl` 可能带签名参数，必须脱敏。

## 前端接入建议

- 对 ASR 快判解析来说，该请求不是核心数据源。
- 不建议记录人员、部门、应用负责人等字段。
- 如果需要确认当前页面所属项目，优先使用 URL 中的 `projectId`，而不是记录该接口完整响应。

## 风险 / 未确认项

- 应用权限不足、未登录或跨项目访问时的返回结构未采集。

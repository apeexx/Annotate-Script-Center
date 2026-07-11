# Abaka AI 通用网络请求（脱敏）

## 请求标识 / 目的

本文件记录 Abaka AI 多页面共用的初始化、权限、任务和资源类接口。Task 页面公共请求已经上移到根级 `network/` 目录，任务差异分别维护在 `task21/` 和 `task17/`：

- Task 页面公共网络索引：`network/README.md`
- Task 页面公共 Data / `/items` 请求：`network/task-page/`
- Task 页面公共状态流转：`network/task-page/18-status-tabs.md` 起的编号文档
- Task21 same_font 专项：`task21/network/README.md`
- Task17 对比资料：`task17/network/README.md`

- 采集日期：2026-05-16。
- 采集方式：Google Chrome DevTools MCP、DevTools DOM snapshot、只读 Console 结构脚本、Network 面板结构观察。
- 页面：登录后任务列表、Task21 Data 页、Task21 `/items` 页、Task17 对比页。
- 说明：本文件只记录平台通用接口结构，不放 Task21 same_font 专属细节。

## 页面入口 / 触发动作

- 采集日期：2026-05-16。
- 采集方式：Google Chrome DevTools MCP、DevTools DOM snapshot、只读 Console 结构脚本、Network 面板结构观察。
- 页面：登录后任务列表、Task21 Data 页、Task21 `/items` 页、Task17 对比页。
- 说明：本文件只记录平台通用接口结构，不放 Task21 same_font 专属细节。

## 请求摘要

- Method：`POST`
- Path：`/api/auth-center/user/user-info`
- Query：无。
- Method：`GET`
- Path：`/api/permission/module-tree/space`
- Query：无。
- Method：`GET`
- Path：`/api/contract/space`
- Query：无。
- Method：`POST`
- Path：`/api/auth-center/space/storage`
- Query：无。
- Method：`POST`
- Path：`/api/auth-center/space/list`

## 请求体摘要

- 当前记录未见独立 request body；以路径参数或 query 为主。

## 响应摘要

- 请求和响应只记录字段结构、列表路径、分页字段、触发页面和安全备注。
- Response：
  - `data.mfa`
  - `data.username`
  - `data.platform`
  - `data.spaceRole`
  - `data.nickname`
  - `data.email`
  - `data.other`
  - `data.space`
  - `data.space.users[]`
- 安全备注：响应包含用户和空间成员结构，只记录字段，不记录真实账号信息。
- Response：
- Response：

## 关键字段

- 当前重点继续以路径、query、响应字段名和脱敏占位为主。

## 前端接入建议

- 接入时优先复用当前页已有稳定锚点，只做只读监听或最小范围辅助。

## 风险 / 未确认项

- 不记录 cookie、authorization、token、access_token、refresh_token、password、secret、sign、signature、credential、session。
- 不记录完整 audio、url、file、download、oss、src、href、path 字符串。
- 资源字段只记录字段名、类型、长度、是否 masked、可能的扩展名。
- 请求和响应只记录字段结构、列表路径、分页字段、触发页面和安全备注。

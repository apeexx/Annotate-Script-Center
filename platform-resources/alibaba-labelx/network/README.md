# Alibaba LabelX 通用网络请求（脱敏）

## 请求标识 / 目的

本文件记录 Alibaba LabelX 在 ASR 转写和 ASR 快判中已确认共用的网络接口结构。项目专属字段、任务识别规则和统计取数策略仍维护在各脚本目录：

- `asr-transcription/network/README.md`
- `asr-judgement/network/`

- 采集日期：2026-05-09
- 采集方式：Chrome DevTools MCP，已登录会话，人工授权后执行可逆操作。
- 采集页面：
  - 审核首页：`/corpora/labeling/checkTask?projectId=<REDACTED_PROJECT_ID>`
  - 审核详情页：`/corpora/labeling/sdk?missionType=check&projectId=<REDACTED_PROJECT_ID>&subTaskId=<REDACTED_SUBTASK_ID>`
- 本轮样例为 `labelModel=single` 的 ASR 转写任务；快判已存在独立采集资料，公共接口形态一致时在本文件合并记录。

## 页面入口 / 触发动作

- 采集日期：2026-05-09
- 采集方式：Chrome DevTools MCP，已登录会话，人工授权后执行可逆操作。
- 采集页面：
  - 审核首页：`/corpora/labeling/checkTask?projectId=<REDACTED_PROJECT_ID>`
  - 审核详情页：`/corpora/labeling/sdk?missionType=check&projectId=<REDACTED_PROJECT_ID>&subTaskId=<REDACTED_SUBTASK_ID>`
- 本轮样例为 `labelModel=single` 的 ASR 转写任务；快判已存在独立采集资料，公共接口形态一致时在本文件合并记录。

## 请求摘要

- Method：`POST`
- Path：`/api/v1/label/center/subTask/{subTaskId}/commit`
- 触发：详情页点击 `提交任务`。
- Request body：
  - `subTaskId`
- 本轮观察：
  - 返回 `200`。
  - 点击后返回审核首页。

- Method：`POST`
- Path：`/api/v1/label/center/subTask/{subTaskId}/commit`
- 触发：详情页点击 `提交任务` 旁下拉菜单中的 `提交并结束`。
- Request body：
  - `subTaskId`
- 本轮观察：
  - 返回 `200`。
  - 随后跳转审核首页 `/corpora/labeling/checkTask`。
  - 首页重拉 `subTasks?type=check`、`tasks?subTaskType=check`、`tasks/process?subTaskType=check`。
  - 未触发 `/api/v1/label/center/{taskId}/check/fetch`，即不会自动领取下一包。

- 页面：`/corpora/labeling/sdk?missionType=check&projectId=<REDACTED_PROJECT_ID>&subTaskId=<REDACTED_SUBTASK_ID>`
- 入口：详情页顶部 `驳 回` 按钮。
- 弹窗标题：`驳回至上个环节`。
- 弹窗字段：
  - `驳回理由`，必填 textarea，计数上限 `500`。
- 弹窗按钮：
  - `取 消`
  - `确 定`
- Method：`POST`
- Path：`/api/v1/label/center/subTask/{subTaskId}/reject`
- Request body：
  - `subTaskId`
  - `rejectReason`
  - `type`
  - `userIdList`
- 本轮字段类型：
  - `subTaskId`：string
  - `rejectReason`：string
  - `type`：string
  - `userIdList`：array
- Response 字段树：
  - `code`
  - `message`
  - `log`
  - `data`
  - `traceId`
  - `traceSql`
  - `extraInfo`
  - `cost`
  - `success`
- 其余重复细节已省略；如需补充，只保留当前有效结论。

## 请求体摘要

- 当前记录未见独立 request body；以路径参数或 query 为主。

## 响应摘要

- 请求和响应示例只保留字段名、状态码、列表数量和业务含义。
- Response：
  - `data.id`
  - `data.type`
  - `data.taskId`
  - `data.batchId`
  - `data.status`
  - `data.gmtCreate`
  - `data.gmtCommit`
  - `data.taskName`
  - `data.size`
  - `data.template`
  - `data.templateConfig`
  - `data.dataList[]`

## 关键字段

本轮在以下响应中均未发现 `supplier`、`vendor`、`company`、`provider`、`供应商`、`厂商`、`公司` 字段：

- `tasks`
- `subTasks`
- `tasks/process`
- `subTask/{subTaskId}/data`
- `summary`
- `board`
- `getLabelTaskInfo`

补采 `missionType=label` 标注详情页的初始化、保存、提交和自动领取链路时，仍未发现上述供应商字段。

当前可用供应商来源只能从任务名推断，例如：

- `棋燊-...`
- `希尔贝壳-...`

后续实现建议的供应商优先级：

1. `payload.supplier.name`
2. `payload.vendor.name`
3. `payload.supplier`
4. `payload.vendor`
5. `csvPatch["供应商"]`
6. `taskName` / `name` 前缀规则推断
7. `未识别供应商`

## 前端接入建议

本轮在以下响应中均未发现 `supplier`、`vendor`、`company`、`provider`、`供应商`、`厂商`、`公司` 字段：

- `tasks`
- `subTasks`
- `tasks/process`
- `subTask/{subTaskId}/data`
- `summary`
- `board`
- `getLabelTaskInfo`

补采 `missionType=label` 标注详情页的初始化、保存、提交和自动领取链路时，仍未发现上述供应商字段。

当前可用供应商来源只能从任务名推断，例如：

- `棋燊-...`
- `希尔贝壳-...`

后续实现建议的供应商优先级：

1. `payload.supplier.name`
2. `payload.vendor.name`
3. `payload.supplier`
4. `payload.vendor`
5. `csvPatch["供应商"]`
- 其余重复细节已省略；如需补充，只保留当前有效结论。

## 风险 / 未确认项

- 不记录 cookie、SSO token、access token、authorization、完整 session。
- 不记录完整签名音频 URL。音频 URL 只记录字段路径、hostname、pathname 后缀和 query 参数名。
- 不记录完整用户隐私字段。
- 请求和响应示例只保留字段名、状态码、列表数量和业务含义。

- 转写详情页提交失败、必填校验阻断和保存失败响应。
- 扩展加载并启用后的转写工具栏 DOM 与按钮事件。
- 快判页面在当前项目中的最新实时样例，用于对比历史快判资料是否仍完全适用。

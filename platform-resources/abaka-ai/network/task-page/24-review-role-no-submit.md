# 标注内审角色只读观察

## 请求标识 / 目的

记录 Task21 标注内审角色下 Data 页、状态 Tab 和查看页的只读结构。按本轮边界，标注内审权限下禁止提交、禁止通过、禁止驳回、禁止审核完成类动作。

## 页面入口 / 触发动作

1. 打开 `/task-v2/data-item?taskId={taskId}&vm=all&dm=all&role={reviewRoleId}`。
2. 只点击 `Overview`、`Skipped`、`Dropped` Tab。
3. 选中一条内审数据后点击 `View` 进入 `viewMode=true` 查看页。
4. 未点击 `Review: 1`、`Claim Review`、`Pass`、`Reject`、`Label` 或任何提交类按钮。

- 角色切换显示 `标注内审`。
- 顶部按钮包括 `View`、`Claim Review`。
- 选中一条 Overview 数据后按钮变为 `View`、`Review: 1`。
- 列表字段增加 Reviewer、Review Team。

- Review role Overview 中可见 `Reviewing` 状态。
- Skipped / Dropped Tab 本轮在 review role 下返回空列表。
- 查看页 URL 带 `viewMode=true`。
- 查看页没有点击任何通过、驳回、送审或审核完成动作。

## 请求摘要

- Method：`POST`
- URL / Path：
  - `/api/v2/item/get-task-item-list-lite`
  - `/api/v2/item/get-task-item-skip-list`
  - `/api/v2/item/get-task-item-abandon-list`
  - `/api/v2/item/get-frame-count`
  - `/api/v2/item/get-item-history`
  - `/api/v2/item/get-view-item-permission`
  - `/api/v2//item/check-operate-item-permission`
  - `/api/v2/item/get-item-info`
  - `/api/v2/label/find-labels`
  - `/api/v2/label/find-issues`
  - `/api/v2/label/find-label-records`
  - `/api/v2/label/get-ai-check-result`
  - `/api/v2/item/find-invalidate-frame/`
  - `/api/v2/item/sampling/get-frames-data`
  - `/api/v2/item/find-items-base-info`
- Content-Type：`application/json`
- Status：`200`
- Query keys：无
- Request Header 摘要：敏感字段已脱敏。

## 请求体摘要

列表请求：

    {
      "taskId": "{taskId}",
      "pageNum": "<number>",
      "pageSize": "<number>",
      "search": {
        "type": "AND",
        "units": []
      },
      "nodeId": "{reviewNodeId}"
    }

查看页请求：

    {
      "taskId": "{taskId}",
      "nodeId": "{reviewNodeId}",
- 其余重复细节已省略；如需补充，只保留当前有效结论。

## 响应摘要

列表响应：

    {
      "code": 0,
      "data": {
        "data": [
          {
            "_id": "{itemId}",
            "processStatus": {
              "label": "LABELED",
              "check": "CHECKING",
              "nodesCheckStatus": "<object>",
              "nodesSubmitTimes": "<object>"
            },
            "permission": ["<label/review permission shape>"]
          }
        ],
        "total": "<number>"
      }
    }

查看页响应摘要：

    {
      "code": 0,
      "data": {
- 其余重复细节已省略；如需补充，只保留当前有效结论。

## 关键字段

- 内审角色列表使用同一批 Data 页 endpoint，但 `nodeId` 切换为 review 节点。
- `processStatus.check = CHECKING` 表示条目处于内审处理中。
- `Review: 1` 是进入内审工作页的高风险入口，本轮未点击。

## 前端接入建议

- 可以只读识别内审角色、按钮文案和列表状态。
- 不得自动点击 `Claim Review`、`Review: N`、`Pass`、`Reject`、`Label` 或任何提交类按钮。
- 后续如设计内审辅助，只能展示只读建议和人工确认提示。

## 风险 / 未确认项

- 内审工作页 `Pass / Reject / Label` 的接口结构未采集，按用户本轮边界禁止采集。
- 内审 Skipped / Dropped 有数据时是否有恢复入口待补。
- 中文环境下内审查看页按钮文案待补。

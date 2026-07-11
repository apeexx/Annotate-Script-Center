# 06 审核任务详情页（checkdata/taskDetail）

## 页面标识 / 路由 / 前置条件

- URL 示例：`https://work.magicdatatech.com/#/checkdata/taskDetail?id=...&projectId=...&batchId=...&processNodeId=...&teamId=...&userId=...&formType=1&...`
- 路由：`#/checkdata/taskDetail`（已确认）

## 页面总览

- 任务摘要区（来自 `userTaskDetail/detail`）
- 抽检记录列表区（来自 `sampling/samplingRecordPage`）
- 分页区（待补采）

## DOM 树 / 区域结构

- `#app`（已确认）
- 列表区组件推定 `el-table`（待补采）

- 任务摘要区（来自 `userTaskDetail/detail`）
- 抽检记录列表区（来自 `sampling/samplingRecordPage`）
- 分页区（待补采）

## 稳定选择器表

- 进入审核单条页按钮（待补采）
- 抽检/导出相关按钮（待补采）

## 动态区域 / 重渲染风险

- 列表内可能包含影响状态的操作按钮，默认禁止自动触发。

## 可挂载点建议

- 如需挂载扩展 UI，优先选择宿主页面外层安全区域，不覆盖原生写操作控件。

## 页面区域与接口映射

- 抽检记录列表区（来自 `sampling/samplingRecordPage`）

## 写操作边界 / 未确认项

- 写操作默认维持人工确认边界；未确认链路不得按文案直接推断。

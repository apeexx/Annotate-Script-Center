# 03 标注任务详情页（mark/details）

## 页面标识 / 路由 / 前置条件

- URL 示例：`https://work.magicdatatech.com/#/mark/details?batchId=...&processNodeId=...&projectId=...&teamId=...&userId=...&projectType=AS`
- 路由：`#/mark/details`（通过真实导航确认）

- `batchId`
- `processNodeId`
- `projectId`
- `teamId`
- `userId`
- `projectType`

## 页面总览

- 详情摘要区（来自 `userTaskDetail/detail`，已确认）
- 子任务/包列表区（来自 `getUserTaskDetailList`，已确认）
- 分页区（已确认存在）

## DOM 树 / 区域结构

- `#app`（已确认）
- `el-table`、`el-pagination`（已确认：bundle 关键词）

- 详情摘要区（来自 `userTaskDetail/detail`，已确认）
- 子任务/包列表区（来自 `getUserTaskDetailList`，已确认）
- 分页区（已确认存在）

## 稳定选择器表

- 进入单条标注页按钮（待补采 selector）
- 可能存在领取/流转相关按钮（待补采）

## 动态区域 / 重渲染风险

- 若出现提交/流转类按钮，均按敏感动作处理。

## 可挂载点建议

- 如需挂载扩展 UI，优先选择宿主页面外层安全区域，不覆盖原生写操作控件。

## 页面区域与接口映射

- 当前文件未补充更细的接口映射；新增时只记录稳定区域与请求族对应关系。

## 写操作边界 / 未确认项

- 写操作默认维持人工确认边界；未确认链路不得按文案直接推断。

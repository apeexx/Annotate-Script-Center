# Alibaba LabelX 通用页面结构（脱敏）

## 页面标识 / 路由 / 前置条件

- 标注首页：`/corpora/labeling/labelingTask?projectId=<REDACTED_PROJECT_ID>`
- 标注详情页：`/corpora/labeling/sdk?missionType=label&projectId=<REDACTED_PROJECT_ID>&subTaskId=<REDACTED_SUBTASK_ID>`
- 审核首页：`/corpora/labeling/checkTask?projectId=<REDACTED_PROJECT_ID>`
- 审核详情页：`/corpora/labeling/sdk?missionType=check&projectId=<REDACTED_PROJECT_ID>&subTaskId=<REDACTED_SUBTASK_ID>`

## 页面总览

- 标注首页：`/corpora/labeling/labelingTask?projectId=<REDACTED_PROJECT_ID>`
- 标注详情页：`/corpora/labeling/sdk?missionType=label&projectId=<REDACTED_PROJECT_ID>&subTaskId=<REDACTED_SUBTASK_ID>`
- 审核首页：`/corpora/labeling/checkTask?projectId=<REDACTED_PROJECT_ID>`
- 审核详情页：`/corpora/labeling/sdk?missionType=check&projectId=<REDACTED_PROJECT_ID>&subTaskId=<REDACTED_SUBTASK_ID>`

## DOM 树 / 区域结构

- 当前文件未补充完整 DOM 树；后续仅记录稳定区域结构。

## 稳定选择器表

- 优先使用 route、标题文案、稳定输入框和原生按钮文本，不依赖 hash class。

## 动态区域 / 重渲染风险

- 快判详情页当前项目实时 DOM 与历史资料差异。
- 样式设置面板展开后的 DOM。
- 扩展启用后的转写工具栏 DOM 和按钮状态。

## 可挂载点建议

- 如需挂载扩展 UI，优先选择宿主页面外层安全区域，不覆盖原生写操作控件。

## 页面区域与接口映射

- 当前文件未补充更细的接口映射；新增时只记录稳定区域与请求族对应关系。

## 写操作边界 / 未确认项

- 快判详情页当前项目实时 DOM 与历史资料差异。
- 样式设置面板展开后的 DOM。
- 扩展启用后的转写工具栏 DOM 和按钮状态。

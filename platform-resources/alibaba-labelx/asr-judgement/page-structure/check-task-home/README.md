# 审核首页结构资料

## 页面标识 / 路由 / 前置条件

本目录记录 LabelX 审核首页，也就是审核任务列表页。该页面用于查看当前账号已领取或已完成的审核子任务，并展示可领取 / 可分配的审核任务列表。

该页面与标注首页布局相近，同样包含顶部导航、左侧任务菜单、`我的任务` 和 `可领取的任务` 区域。页面上可出现 `分人员领取` 按钮，但本次采集只做只读观察，没有点击领取、释放或提交。

- `https://labelx.alibaba-inc.com/corpora/labeling/checkTask?projectId=<REDACTED_PROJECT_ID>`

建议路由识别拆成：

- 路径：`/corpora/labeling/checkTask`
- 关键查询参数：
  - `projectId`

## 页面总览

本目录记录 LabelX 审核首页，也就是审核任务列表页。该页面用于查看当前账号已领取或已完成的审核子任务，并展示可领取 / 可分配的审核任务列表。

该页面与标注首页布局相近，同样包含顶部导航、左侧任务菜单、`我的任务` 和 `可领取的任务` 区域。页面上可出现 `分人员领取` 按钮，但本次采集只做只读观察，没有点击领取、释放或提交。

## DOM 树 / 区域结构

- 当前文件未补充完整 DOM 树；后续仅记录稳定区域结构。

## 稳定选择器表

- 顶部导航头像：
  - `.ant-v5-dropdown-trigger[class*="NavAvatar-module__userInfoWrapper"]`
  - `[class*="NavAvatar-module__dropdown"] [role="menuitem"]`
- 页面主容器：
  - `main#mainContentWrapper`
  - `.label-center-container`
- 首页分页和任务表格：
  - `.my-task-list`
  - `.all-task-list-container`
  - `ul.label-center-pagination`

## 动态区域 / 重渲染风险

- 当前页存在状态切换和局部重绘风险；避免依赖瞬时 class 和顺序定位。

## 可挂载点建议

- 如需挂载扩展 UI，优先选择宿主页面外层安全区域，不覆盖原生写操作控件。

## 页面区域与接口映射

- `/api/v1/label/center/subTasks?type=check&keyword=&appId=<PROJECT_ID>&finished=false&page=1&pageSize=5&_=<timestamp>`
- `/api/v1/label/center/subTasks?type=check&keyword=&appId=<PROJECT_ID>&finished=true&page=1&pageSize=5&_=<timestamp>`
- `/api/v1/label/center/tasks?subTaskType=check&keyword=&appId=<PROJECT_ID>&page=1&pageSize=5&_=<timestamp>`
- `/api/v1/label/center/tasks/process?subTaskType=check&taskIds=<TASK_IDS>&_=<timestamp>`

## 写操作边界 / 未确认项

- 写操作默认维持人工确认边界；未确认链路不得按文案直接推断。

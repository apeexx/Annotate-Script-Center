# 页面元信息

## 页面标识 / 路由 / 前置条件

- 页面名称：智能标注
- 页面类型：LabelX 标注首页 / 标注任务列表页
- 页面 URL 样例：`https://labelx.alibaba-inc.com/corpora/labeling/labelingTask?projectId=<REDACTED_PROJECT_ID>`
- 页面用途：展示已领取标注子任务和可领取任务，并提供进入标注详情、释放任务、领取任务的入口
- 历史本地 Console 导出文件：
  - `C:\Projects\annotation-script-center\platform-resources\alibaba-labelx\asr-judgement\page-structure\labeling-task-home\首页1.json`
  - `C:\Projects\annotation-script-center\platform-resources\alibaba-labelx\asr-judgement\page-structure\labeling-task-home\首页2.json`
- Console 导出概要：
  - buttons：13
  - radios：0
  - textareas：0

## 页面总览

- 当前页主要记录稳定区域、可见文案和角色边界。

## DOM 树 / 区域结构

- 当前文件未补充完整 DOM 树；后续仅记录稳定区域结构。

## 稳定选择器表

- 任务名称过滤框：
  - `.label-center-filter input[placeholder="请输入任务名称"]`
- 我的任务表格行：
  - `.my-task-list .ant-v5-table-tbody .ant-v5-table-row`
- 可领取任务表格行：
  - `.all-task-list-container .ant-v5-table-tbody .ant-v5-table-row`
- 行内操作按钮：
  - `button.label-center-task-link`
- 顶部导航头像下拉：
  - `.ant-v5-avatar.ant-v5-avatar-circle`
  - `.ant-v5-dropdown-menu[role="menu"]`
- 进入详情页按钮：
  - 在 `.my-task-list` 行内查找文本 `标注`
- 释放按钮：
  - 在 `.my-task-list` 行内查找文本 `释放`
- 领取按钮：
  - 在 `.all-task-list-container` 行内查找文本 `领取`
- 分页：
  - `.label-center-pagination`

## 动态区域 / 重渲染风险

- 当前页存在状态切换和局部重绘风险；避免依赖瞬时 class 和顺序定位。

## 可挂载点建议

- 如需挂载扩展 UI，优先选择宿主页面外层安全区域，不覆盖原生写操作控件。

## 页面区域与接口映射

- `GET /api/v1/label/center/subTasks?type=label&keyword=&appId=<REDACTED_PROJECT_ID>&finished=false&page=1&pageSize=5...`
  - `GET /api/v1/label/center/subTasks?type=label&keyword=&appId=<REDACTED_PROJECT_ID>&finished=true&page=1&pageSize=5...`
  - `GET /api/v1/label/center/tasks?subTaskType=label&keyword=&appId=<REDACTED_PROJECT_ID>&page=1&pageSize=5...`
  - `GET /api/v1/label/center/tasks/process?subTaskType=label&taskIds=...`
  - `POST /api/v1/label/center/<REDACTED_TASK_ID>/label/fetch`
  - `POST /api/v1/label/center/subTask/<REDACTED_SUBTASK_ID>/release`

## 写操作边界 / 未确认项

- 写操作默认维持人工确认边界；未确认链路不得按文案直接推断。

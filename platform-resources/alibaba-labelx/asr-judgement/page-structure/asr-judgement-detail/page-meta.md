# 页面元信息

## 页面标识 / 路由 / 前置条件

- 页面名称：智能标注
- 页面类型：ASR 更优判断详情页
- 页面 URL 样例：`https://labelx.alibaba-inc.com/corpora/labeling/sdk?missionType=label&projectId=<REDACTED_PROJECT_ID>&subTaskId=<REDACTED_SUBTASK_ID>`
- 已完成只读 URL 样例：`https://labelx.alibaba-inc.com/corpora/labeling/sdk?disableEdit=true&isFinished=true&missionType=label&projectId=<REDACTED_PROJECT_ID>&subTaskId=<REDACTED_SUBTASK_ID>`
- 页面用途：在同一页内批量判断多条音频题卡的两个 ASR 结果谁更优，并可填写“特殊情况标注”
- 顶层容器：
  - `#root`
  - `main#mainContentWrapper`
  - `.renderSdk`
- 题卡区根容器：
  - `.render-container`
  - `.labelRender-root.innerScroll`
- 其余重复细节已省略；如需补充，只保留当前有效结论。

## 页面总览

- 当前页主要记录稳定区域、可见文案和角色边界。

## DOM 树 / 区域结构

- 当前文件未补充完整 DOM 树；后续仅记录稳定区域结构。

## 稳定选择器表

- 优先使用 route、标题文案、稳定输入框和原生按钮文本，不依赖 hash class。

## 动态区域 / 重渲染风险

- 当前页存在状态切换和局部重绘风险；避免依赖瞬时 class 和顺序定位。

## 可挂载点建议

- 如需挂载扩展 UI，优先选择宿主页面外层安全区域，不覆盖原生写操作控件。

## 页面区域与接口映射

- `GET /api/v1/label/center/subTask/<REDACTED_SUBTASK_ID>/data?page=1&pageSize=10...`
  - `GET /api/v1/label/center/subTask/<REDACTED_SUBTASK_ID>/summary`
  - `GET /api/v1/label/center/subTask/<REDACTED_SUBTASK_ID>/board...`
  - `POST /api/v1/label/center/timer`
  - `POST /api/v1/label/center/<REDACTED_SUBTASK_ID>/session`
  - `POST /api/v1/label/center/subTask/<REDACTED_SUBTASK_ID>/data`
- 单选和填空保存共用 `/api/v1/label/center/subTask/{subTaskId}/data`，但扩展默认不应主动调用。

## 写操作边界 / 未确认项

- 写操作默认维持人工确认边界；未确认链路不得按文案直接推断。

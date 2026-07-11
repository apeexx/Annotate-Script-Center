# 07 审核单条页（asrmarkCheck）

## 页面标识 / 路由 / 前置条件

- URL 示例：`https://work.magicdatatech.com/#/asrmarkCheck?formType=1&id=...`
- 路由：`#/asrmarkCheck`（已确认）

- `formType`
- `id`（采样记录 ID）

- 初始化阶段会加载：
  - `sampling/asrPreview/{id}`
  - `sampling/getLabelConf?sampRecordId=...`
  - `sampling/taskInfo/{id}`
  - `sampling/projectInfo/{id}`
  - `mtBatchUserCfg/{batchId}`
  - `annotateTask/historySubmitter/{taskItemId}`

## 页面总览

- 顶部审核信息区（来自 `sampling/projectInfo`）
- 样本预览区（来自 `sampling/asrPreview`）
- 单条审核数据区（来自 `sampling/taskInfo`）
- 音频播放区（OSS 音频加载）
- 审核动作区（通过/驳回/提交等，selector 待补采）

- 初始化阶段会加载：
  - `sampling/asrPreview/{id}`
  - `sampling/getLabelConf?sampRecordId=...`
  - `sampling/taskInfo/{id}`
  - `sampling/projectInfo/{id}`
  - `mtBatchUserCfg/{batchId}`
  - `annotateTask/historySubmitter/{taskItemId}`

## DOM 树 / 区域结构

- `#app`（已确认）
- `topic_content` / `topic_top` / `topic_select` / `topic_top-title`（已确认：bundle片段）
- `wavesurfer`（已确认：bundle关键词）
- `textarea`（已确认：bundle关键词）

- 顶部审核信息区（来自 `sampling/projectInfo`）
- 样本预览区（来自 `sampling/asrPreview`）
- 单条审核数据区（来自 `sampling/taskInfo`）
- 音频播放区（OSS 音频加载）
- 审核动作区（通过/驳回/提交等，selector 待补采）

## 稳定选择器表

- 文案存在：`保存`、`提交`、`通过`、`驳回`、`上一条`、`下一条`（已确认）
- 精确 selector（待补采）

## 动态区域 / 重渲染风险

- 初始化阶段会加载：
  - `sampling/asrPreview/{id}`
  - `sampling/getLabelConf?sampRecordId=...`
  - `sampling/taskInfo/{id}`
  - `sampling/projectInfo/{id}`
  - `mtBatchUserCfg/{batchId}`
  - `annotateTask/historySubmitter/{taskItemId}`

- 审核提交/通过/驳回属于高敏动作，默认禁止自动触发。

## 可挂载点建议

- 如需挂载扩展 UI，优先选择宿主页面外层安全区域，不覆盖原生写操作控件。

## 页面区域与接口映射

- 初始化阶段会加载：
  - `sampling/asrPreview/{id}`
  - `sampling/getLabelConf?sampRecordId=...`
  - `sampling/taskInfo/{id}`
  - `sampling/projectInfo/{id}`
  - `mtBatchUserCfg/{batchId}`
  - `annotateTask/historySubmitter/{taskItemId}`

## 写操作边界 / 未确认项

- 写操作默认维持人工确认边界；未确认链路不得按文案直接推断。

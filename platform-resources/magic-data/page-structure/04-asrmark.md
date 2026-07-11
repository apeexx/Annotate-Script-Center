# 04 标注单条页（asrmark）

## 页面标识 / 路由 / 前置条件

- URL 示例：`https://work.magicdatatech.com/#/asrmark?taskItemId=...&formType=1&userId=...`
- 路由：`#/asrmark`（已确认）

- `taskItemId`
- `formType`
- `userId`

## 页面总览

- 头部信息区（任务/批次/包状态，来自 `annotateHeaderInfo`）
- 音频区域（波形与播放控制，待补采精确 selector）
- 文本标注区（`textarea` + `mark_info`）
- 动作区（保存/提交/上一条/下一条，文案已确认）

## DOM 树 / 区域结构

- `#app`（已确认）
- `wavesurfer`（已确认：bundle 关键词）
- `textarea`（已确认：bundle 关键词）
- `mark_info`（已确认：bundle 关键词）

- 头部信息区（任务/批次/包状态，来自 `annotateHeaderInfo`）
- 音频区域（波形与播放控制，待补采精确 selector）
- 文本标注区（`textarea` + `mark_info`）
- 动作区（保存/提交/上一条/下一条，文案已确认）

## 稳定选择器表

- 文案存在：`保存`、`提交`、`上一条`、`下一条`（已确认）
- 精确 selector（待补采）

## 动态区域 / 重渲染风险

- 保存/提交属于敏感动作，本轮未触发。

## 可挂载点建议

- 如需挂载扩展 UI，优先选择宿主页面外层安全区域，不覆盖原生写操作控件。

## 页面区域与接口映射

- 当前文件未补充更细的接口映射；新增时只记录稳定区域与请求族对应关系。

## 写操作边界 / 未确认项

- 写操作默认维持人工确认边界；未确认链路不得按文案直接推断。

# 客家话助手（Magic Data）

本目录是 Magic Data `#/asrmark` 与 `#/asrmarkCheck` 下“客家话助手”前端入口。

## 文件

- `content.js`：客家话助手入口编排与挂载。
- `assistant-panel.js`：客家话助手新版结果面板（与闽南语助手同能力，独立 DOM 命名空间）。
- `shortcuts-runtime.js`：客家话助手快捷键运行时（独立存储 key）。
- `ui-panel.js`：旧版兼容面板（legacy，当前主链路不再挂载）。

## 复用模块

客家话助手依赖 `../shared/`：

- `page-detector.js`
- `data-collector.js`
- `ai-review-client.js`（`/api/magic-data/hakka-helper/ai/review-current`）
- `assistant-panel-core.js`（legacy 兼容模块，当前客家话主链路不再使用）
- `shortcuts-runtime.js`（legacy 兼容模块，当前客家话主链路不再使用）

## 配置与快捷键

- 与闽南语助手统一使用“模型方案 + 识别策略”配置字段：
  - 模型方案：`two_stage` / `omni_single`
  - 识别策略：`direct_dialect` / `mandarin_to_dialect`
- 为兼容历史配置，仍保留 legacy `aiReviewRecognitionMode`（含 `recognition_convert`）映射。
- 快捷键动作已与闽南语助手统一到同一动作集合，并补充 `开启/关闭全自动` 专属动作；支持 `全部填入AI推荐`、`显示 AI 原始输出`、详情折叠切换等动作键。
- - `two_stage + direct_dialect`
  - 听音：`qwen3.5-omni-flash`
  - 比较：`qwen3.5-flash`
- `enable_thinking=false`
- - 客家话助手与闽南语助手统一走 Magic Data pipeline 字段联动（模型方案/识别策略/听音模型/比较模型/单模型）。
  - 保存时同时写入新字段与 legacy 字段（`aiReview*` + `listenModel/reviewModel`），并显式持久化模型选择值，避免刷新后回退显示。
  - `storage` legacy 迁移逻辑改为“显式字段优先”，`recognition_convert` 不再覆盖用户已选择的 `aiReviewModelMode`，避免保存后被强制回写为单模型。
- - options 中移除 `AI 质检模式` 选择，客家话助手仅使用 `模型方案 + 识别策略`。
  - 审核页（`#/asrmarkCheck`）文本可编辑时，行内建议支持 `填入本行`；`全部填入AI推荐` 在审核页仅填文本项，不填说话人，不自动保存/提交。
- - 改为通过 AI prompt 约束普通中文输出简体，结果区与行内建议不再依赖本地后端二次繁转简。
  - 命中客家话词表 `语料统一用字` 时继续保留对应写法。
- - `mandarin_to_dialect` 当前已真实接入“先普通话识别，再按词表转客家话”的后端链路。
  - 前端会继续收到兼容原结构的 `recognitionConvert`，其中 `convertedDialectText` 已是后端最终正字归一化后的客家话建议文本。
- - `review-current/jobs/:jobId` 成功态当前返回 `data.success + data.data` 双层结构。
  - 前端 client 当前已在 Job 轮询分支优先解包到真正的质检结果对象，避免新版面板把外层成功响应误当成结果。
  - 新版面板渲染前也会再次兜底解包 `success/data` 包装层，避免线上返回被外层空 `requestId/models/timing` 覆盖后，右侧结果区误显示“无法判断 / 摘要 -”。
  - 该热修用于修复“AI 质检当前条”完成后右侧结果区误显示“无法判断 / 摘要 -”的问题。

## 前端交互（新版）

- 右侧按钮布局：主操作 `AI 质检当前条`、`全部填入AI推荐`；辅助操作 `刷新采集`、`重置高度`、`复制 AI 质检摘要`、`显示 AI 原始输出`。
- `显示 AI 原始输出` 按钮保持可点击；当当前条还没有 AI 返回时不再置灰，点击后提示“暂无 AI 原始输出”。
- `总结论` 顶部摘要区当前新增 `词表状态与模式`，固定显示 `主词表状态 / 固定携带 / 改写模式`，便于区分主词表是否已加载以及当前后端改写模式。
- `总结论` 顶部摘要区当前同步拆分显示 `模型 / 耗时 / 人民币`：`omni_single` 只显示 `预估人民币`；双阶段显示 `听音预估人民币 / 复核预估人民币 / 总预估人民币`；缺少价格源时统一显示 `没有数据源`。
- `#/asrmark` 当前支持当前页临时“全自动”模式：
  - 默认关闭，不写入长期配置；
  - 自动链路固定为 `等待加载 -> AI识别 -> 填入 -> 提交 -> 等待下一条`；
  - 通过可录制快捷键 `开启/关闭全自动` 控制，不再保留面板按钮；
  - AI 四项都判定“正确”时，按“无需填入”继续直接提交，不再误判为失败停机；
  - 任一步失败立即停机；手动关闭时会立刻中断未发出的后续步骤。
- 已移除旧按钮：`填入第一行`、`填入第二行`、`忽略结果`。
- 三个详情块独立折叠：`说话人属性`、`客家话内容`、`普通话文本`，并按 `taskItemId + section` 记忆展开状态。
- 行内建议直接显示在两行文本下方；正确项仅显示“正确”，需改项显示建议文本 + `填入本行`。建议节点当前改为幂等更新，不再因 hover 或页面轻微重绘反复销毁重建。
- 说话人建议直接插入平台原生“说话人属性”表单项，正确项只显示 `AI建议：正确`；按钮节点当前也按 task 幂等复用，避免 hover 闪烁。
- 审核页（`#/asrmarkCheck`）已接入 AI 质检：
  - 不再显示“审核页暂未接入填入”提示。
  - 支持采集当前审核条并执行 AI 三项质检。
  - 文本可编辑时显示行内 `填入本行` 与文本项 `全部填入AI推荐`；文本不可编辑时自动隐藏填入动作。
  - 结果按 `pageType + taskItemId + samplingRecordId` 维度保持，不因页面轻微刷新自动清空。

## 后端对齐说明

- 客家话助手前端新版面板依赖后端返回完整结构化字段：
  - `speakerCheck`
  - `dialectTextCheck`
  - `mandarinTextCheck`
  - `overall`
  - `recommendations`
  - `audioCheck`
- 客家话后端已按闽南语后端结构补齐上述字段，并保留 legacy `listen/comparison/verdict` 兼容字段。
- 前端直接展示后端返回的 AI 文本；普通中文简体约束继续由模型 prompt 负责。
- 客家话最终建议文本当前会由后端做 `exact` 正字归一化，只影响：
  - `dialectTextCheck.suggestedValue`
  - `recommendations.dialectText`
  - `recognitionConvert.convertedDialectText`
- `audioCheck.heardDialectText` 继续保留听音证据原文，不参与正字归一化。

## 行为边界

- 只允许用户主动点击按钮或快捷键触发 AI。
- 只给建议，不自动保存、不自动提交、不自动审核、不自动领取、不自动流转。
- 例外授权：当前页临时“全自动”仅限 `#/asrmark`，且严格只走页面真实 `提交` 按钮，不直调平台提交 API。

# Abaka AI Task 页面脚本

## 脚本定位

本目录是 Abaka AI Task 页面运行时代码，当前包含两类能力：

- MAIN world：`page-world/network-structure-observer.js`（只读脱敏结构采集）
- ISOLATED world：
  - 快捷键：`content.js`、`shortcuts.js`、`dom-actions.js`、`toast.js`
  - AI 分析：`pricing.js`、`data-collector.js`、`ai-client.js`、`ai-panel.js`

## 当前阶段

- 阶段：Task21助手（快捷键 + AI 辅助填写）。
- 目标：
  - 快捷键辅助 `same_font` 与派生字段选择、暂存、送审按钮点击
  - AI 面板提供 same_font / image_b_texts_removed / other_changes / overall 四种分析
- 范围：
  - 快捷键仅 DOM 点击，不直接调用平台保存/提交/领取/流转接口
- AI 默认只输出建议；仅在用户点击“填写 AI 答案”时才写入字段，不自动保存、不自动提交、不自动送审

## 快捷键动作

- `same_font=true`
- `same_font=false`
- `same_font=same underlying font+artistic effect`
- `image_b_texts_removed=specify`
- `other_changes=specify`
- 点击页面真实“暂存 / Save / Stash”按钮
- 点击页面真实“送审 / Submit / Submit Review”按钮

默认快捷键为空；只有用户在 options 中录制并保存后，运行时才会响应对应动作。

联动开关：`autoSelectSpecifyOnSameFontTrue=true`（默认开启）同时适用于：

- `same_font=true`
- `same_font=same underlying font+artistic effect`

联动为幂等“确保选中”：

- `specify` 未选中时才点击；
- `specify` 已选中时保持不变，不重复点击，避免取消。

## 运行时边界

- 快捷键仅在 `/items` 页面生效。
- 必须检测到 `same_font` 字段后才执行动作，避免 Task17 等页面误触发。
- 焦点在 `input`、`textarea`、`select`、`contenteditable`、编辑器节点时忽略快捷键。
- `4/5` 对应 `specify` 也为幂等选择：已选中时不会取消。
- `6/7` 仅点击页面真实按钮，不直接调用平台保存/送审接口。
- `7` 不自动确认二次弹窗，若出现确认弹窗需用户手动确认。
- `7` 在疑似标注内审环境会被阻止，避免误触发送审。
- `6/7` 在 `viewMode=true` 查看页不执行。
- 不自动提交、不自动保存、不自动领取、不自动放弃、不自动跳过、不自动送审。

## AI 面板（Task21助手）

- 面板入口：`/items` 页面字段标题右侧内联按钮。
- 按钮挂载：
  - `same_font` 标题右侧：`AI分析`、`整体分析`
  - `image_b_texts_removed` 标题右侧：`AI分析`
  - `other_changes` 标题右侧：`AI分析`
- 结果展示：
  - 主视图只展示：推荐选择、标准答案、理由、`填写 AI 答案` 按钮
  - 调试信息与原始 JSON（脱敏）默认折叠隐藏
  - 支持关闭、拖动、调整宽高、重置位置
  - 拖动/缩放布局会写入 `localStorage`：`asc-abaka-task21-ai-panel-layout-v1`
- 按钮可用性：
  - 检测不到对应板块则置灰，提示“未检测到该板块”。
  - `same_font=false/unsure` 时后两个按钮仍可用于调试分析，但会提示正式流程可跳过。
- AI 分析动作：
  - AI 分析 `same_font`
  - AI 分析 `image_b_texts_removed`
  - AI 分析 `other_changes`
  - AI 整体分析
- Options 的 Task21助手详情页：
  - AI 相关设置默认隐藏
  - 连续点击标题 10 次后显示（仅当前页面会话）
  - 未解锁直接保存时，不会重置隐藏 AI 配置
- AI 调试子板块（解锁后可见）：
  - 分析方案：`two_stage`（默认）/ `single_model`
  - 默认推荐：双模型 `qwen3.6-plus + qwen3.6-plus`
  - 单模型默认：`qwen3.6-plus`
  - 兼容历史误填：`qwen3.6plus` 会归一为 `qwen3.6-plus`
  - 视觉模型（双模型阶段一）
    - 候选：`qwen3.6-plus`、`qwen3.6-flash`、`qwen3-vl-plus`、`qwen3-vl-flash`、`qwen3.5-plus`、`qwen3.5-flash`、`qwen-vl-max`、`qwen-vl-plus`
  - OCR 模型与 OCR 开关（默认关闭）
    - OCR 专用模型待文字提取官方文档进一步核对，默认不预置模型
  - 推理模型（双模型阶段二）
    - 候选：`qwen3.6-plus`、`qwen3.6-flash`、`qwen3.5-plus`、`qwen3.5-flash`
  - 单模型（single_model）
  - thinking 当前已全局固定关闭
  - 请求超时（默认 `60000ms`）
  - 前端不保存 API Key
- AI 调用元数据：
  - 每次 AI 请求默认附带 `aiUsageOperatorName`
  - `aiUsageOperatorName` 取自 options 首页全局字段“AI 调用使用人”，未填写时直接阻止请求
  - 当前 Task21 运行时代码还没有稳定的平台当前用户来源，`platformUserName/platformUserId` 暂时按空字符串发送
- 填写行为边界：
- AI 仍然只作辅助；仅在用户点击“填写 AI 答案”时才写入字段，不自动保存、不自动提交、不自动送审
  - 仅在用户点击 `填写 AI 答案` 时，才会写入 radio / 输入框
  - 不点击 checkbox，不绕过 disabled/readOnly 控件
  - `image_b_texts_removed` 是 `custom-md-editor / Monaco` 输入区，定位优先级为：`.l-item` + `.l-title-text=image_b_texts_removed` -> 当前字段内 `.custom-md-editor/.monaco-container/.monaco-editor`
  - `other_changes` 继续使用 Naive UI textarea（`textarea.n-input__textarea-el`），定位限制在当前 `.l-item` 内，避免串填其他字段
  - 选择 `specify` 后会先等待输入区渲染（默认 `5000ms`）再写入，避免 radio 切换后立即写入失败
  - Monaco 写入主路径改为：读取 `.monaco-editor[data-uri]` -> `window.monaco.editor.getModels()` -> 匹配 `model.uri.toString()` -> `model.setValue(text)`
  - Monaco fallback 顺序：editor instance -> `execCommand("insertText")` / input 事件链 -> textarea fallback；fallback 只会提示“需人工确认”，不会伪造成功
  - 调试信息与面板标题区会显示 `runtimeVersion` / `domActionsVersion`，用于判断页面是否仍在运行旧 content script
  - 若页面仍出现旧的 `2500ms` 提示，优先重新加载扩展并刷新当前 Abaka Task21 页面

- image_b_texts_removed 标准答案格式：
  - 只比较 `image_b` 与 `image_b_removed`
  - `image_a` 不参与删除判断，只用于 `same_font`
  - `T` 是目标删除文本多重集（multiset），只作目标范围辅助，最终仍以 `image_b` / `image_b_removed` 实际图片内容为准
  - `B` 是 `image_b` 可读文本实例多重集，`R` 是 `image_b_removed` 仍可读文本实例多重集，`D = B - R`
  - `true` 条件：`D == T`
  - `null` 条件：`D` 为空
  - `specify` 条件：`D` 非空且 `D != T`
  - 不要因为“有删除文本”就一律 `specify`；如果 `D == T` 必须 `true`
  - 不要因为“目标文本全删”就一律 `true`；如果有 extra、部分删除或数量不匹配，必须 `specify`
  - 支持 `all instances of xxx` / `1 instance of xxx` / `N instances of xxx`
  - 多实例比较大小写不敏感；普通空格、普通字距差异可忽略
  - 换行和 `<br>` 有意义，带换行与无换行文本不能合并；输出要保留实际文本形态，例如 `MODERN<br>ABODE`
  - `image_b_removed` 中仍保留的文本不算删除，不能写进标准答案
  - 组合文本只删除局部时，只写被删片段；例如 `Logo Variation` 中 `Logo` 保留、`Variation` 被删时，应写 `1 instance of Variation`
  - 如果同一文本全部实例都消失、但 `D == T`，仍应选 `true`，不要为了 `all instances` 强行改成 `specify`
  - 仍不接受 bullet、编号、解释

- other_changes 比较口径：
  - 只比较 `image_b_removed` 与 `image_b`
  - 不再比较 `image_a` 与 `image_b`
  - `specify` 时输出英文短句（建议 30 词以内）
- same_font 口径补充：
  - 支持 `error`（例如仅单侧存在文本的异常样本）
  - `same_font=false/unsure/error` 时后续字段应按 `not_applicable` 处理
- 安全：
  - 不展示完整图片 URL、完整 dataUrl、token/cookie/authorization 等敏感字段。

## Task21 统计 / 导出入口（列表页）

- 列表页入口：`/task-v2/data-item?taskId={taskId}&vm=all&dm=all`
- 批次页入口：`/task-v2/data-item?taskId={taskId}&vm=batch&dm=all&batchId={batchId}`
- 顶部按钮与 `/items` 字段旁 AI 分析按钮是两套独立入口：
  - `/items` 详情页继续保留字段标题右侧 `AI分析 / 整体分析`
  - `/task-v2/data-item` 列表页新增顶部右侧 `统计当前列表` 与 `下载统计CSV`
- 挂载优先级：
  - `.app-content-header-right .action-buttons.is-global`
  - `.app-content-header-right .search-actions.is-global`
  - `.app-content-header-right`
  - 若顶部容器暂时找不到，则 fallback 为页面右上角浮动入口
- 运行时会为列表页入口做去重与重挂载：
  - 固定使用 `data-asc-task21-statistics-toolbar="true"`，避免重复插入多个按钮
  - Vue 重渲染或筛选刷新后会重新挂载
  - 路由离开 `/task-v2/data-item` 后会自动移除
- 当前仓库尚未落地 Task21 统计后端与独立前端 runtime：
- 目前点击 `统计当前列表` 会给出“Task21统计模块未就绪，请先完成统计采集模块。”
  - `下载统计CSV` 默认禁用，不会伪造下载地址
- 该入口不会自动领取标注、不会自动保存、不会自动提交、不会自动送审。
- 如扩展刚重载，请先刷新 Abaka Task21 业务页再测试，避免旧 content script 继续停留。

## Console 调试入口

- 页面 Console 可手动调用：
  - `window.__ASCEdgeAbakaAiDomActions.debugFindFieldTextInput("image_b_texts_removed")`
  - `window.__ASCEdgeAbakaAiDomActions.debugFillFieldText("image_b_texts_removed", "all instances of MULTILINGUAL")`
- `debugFindFieldTextInput` 只返回诊断信息，不写入内容。
- `debugFillFieldText` 复用正式填写链路，但只在用户手动执行时运行，不会被脚本自动调用。
- 诊断信息仅包含字段定位、Monaco `data-uri`、`viewLinesPreview` 等必要摘要，不输出 token/cookie/完整图片 URL。

## 数据采集策略（AI 调试）

- 优先：`POST /api/v2/item/get-item-info`（同源、`credentials: include`，不手动设置 token/cookie）。
- 回退：DOM 采集（`.content-title` + `.content-image-view img`）。
- 图片字段固定映射：
  - `image_a`
  - `image_b`
  - `image_b_removed`
- 日志/UI 只展示脱敏统计，不展示完整 URL 或完整 dataUrl/base64。

## Console 导出（只读采集）

```js
window.__ASCAbakaAiCapture && window.__ASCAbakaAiCapture.snapshot()
window.__ASCAbakaAiCapture && window.__ASCAbakaAiCapture.download()
```

## 安全边界

- 不记录账号密码、cookie、token、authorization、password、secret、signature。
- 不记录完整图片、音频、文件、对象存储 URL。
- 不提交原始 HAR、JSON、截图、CSV 或完整响应。
- 当前统一显式传 `enable_thinking=false`；Task21 不再开放手动开启 thinking。
- 若模型不支持或能力未知，仍不会盲传 `enable_thinking`；调试信息继续标记 `notApplicable`。
- `ABAKA_TASK21_AI_ALLOW_THINKING_PARAM_FALLBACK` 仅保留历史兼容说明；当前固定关闭 thinking 后，正常链路不会再依赖它开启思考。

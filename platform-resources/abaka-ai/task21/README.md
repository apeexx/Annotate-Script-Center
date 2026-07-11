# Abaka AI Task21 项目资料

## 当前状态

- 主目标：Task21。
- 专项结构：`same_font`、`image_b_texts_removed`、`other_changes`。
- 当前阶段：Task21助手完成态（快捷键 + AI 辅助填写）。
- 采集方式：Google Chrome DevTools MCP、DevTools DOM snapshot、只读 Console 结构脚本、Network 面板结构观察。
- 当前不做自动化流转，不实现自动领取、自动提交、自动放弃、自动跳过、自动送审。

公共 Task 页面能力已经上移到 `../` 根目录，包括 Data 页、状态 Tab、Skipped / Dropped / Recovery、领取、查看、语言切换、资源加载和动作边界。

## 资料文件

| 文件 | 职责 |
| --- | --- |
| `README.md` | Task21 项目入口、业务识别和资料导航。 |
| `ai/assets/README.md` | Task21 接入统一 AI framework 后的资产目录边界说明。 |
| `data/README.md` | Task21 脚本级统计/下载数据目录边界说明。 |
| `network/task21.md` | Task21 专项 Network 概览。 |
| `network/README.md` | Task21 专项网络索引。 |
| `network/08-label-save-labels.md` | Task21 same_font 与派生字段保存结构。 |
| `page-structure/README.md` | Task21 same_font 页面结构和选择器策略。 |

公共资料入口：

- 平台公共网络：`../network/platform.md`
- Task 页面公共网络：`../network/README.md`
- Task 页面公共结构：`../page-structure/platform.md`
- Task 页面公共动作边界：`../page-structure/actions.md`
- Task 页面公共多语言：`../page-structure/i18n.md`

## Task21 业务识别

| 字段 | 样例 |
| --- | --- |
| 任务号 / Project ID | `#HM_395_v2` |
| 名称 / Name | `Task21` |
| 工具类型 / Tool Type | `MMAT` |
| 所属团队 / Team | `abaka.ai` |
| 创建者 / Owner | `Anniejln` |
| 创建时间 / Created Time | `04-30-2026 22:01:33` |

这些值来自测试账号内的页面结构识别样例，用于人工核对和候选定位，不应作为后续脚本的唯一硬编码依据。

## Task21 页面入口

| 页面 | URL 模式 | 说明 |
| --- | --- | --- |
| Task21 全部数据页 | `/task-v2/data-item?taskId={taskId}&vm=all&dm=all` | Data 页全部数据视图，公共结构见 `../page-structure/platform.md`。 |
| Task21 批次页 | `/task-v2/data-item?taskId={taskId}&vm=batch&dm=all&batchId={batchId}` | 批次侧栏 + 条目列表。 |
| Task21 标注角色页 | `/task-v2/data-item?taskId={taskId}&role={labelRoleId}` | 标注节点，主按钮为领取标注。 |
| Task21 内审角色页 | `/task-v2/data-item?taskId={taskId}&role={reviewRoleId}` | 内审节点，主按钮为领取审核。 |
| Task21 查看页 | `/items?taskId={taskId}&itemId={itemId}&selectIds={selectId}&viewMode=true&nodeId={nodeId}` | 只读查看工作页。 |
| Task21 标注页 | `/items?taskId={taskId}&itemId={itemId}&selectIds={selectId}&nodeId={nodeId}` | 可编辑 same_font 标注工作页。 |

详细公共 DOM 见 `../page-structure/platform.md`，Task21 same_font 结构见 `page-structure/README.md`。

列表页统计 / 导出入口补充（2026-05-21）：

- `/task-v2/data-item?taskId={taskId}&vm=all&dm=all`
- `/task-v2/data-item?taskId={taskId}&vm=batch&dm=all&batchId={batchId}`

上述列表页会尝试在顶部右侧工具栏挂载 Task21 统计入口：

- 优先：`.app-content-header-right .action-buttons.is-global`
- 回退：`.app-content-header-right .search-actions.is-global`
- 再回退：`.app-content-header-right`
- 若顶部容器暂时找不到，则使用页面右上角浮动入口兜底

当前仓库状态说明：

- `/items` 详情页已有 Task21 助手 AI 分析入口，不受本次列表页入口影响
- Task21 统计后端接口与独立统计 runtime 当前未随仓库落地，因此列表页入口目前以“可见 + 明确提示”为主
- 入口不会自动领取标注、不会自动保存、不会自动提交、不会自动送审
- 若后续补齐统计 runtime，应优先复用该顶部入口，不要再隐藏到快捷键或 AI 浮窗内

## AI 调用日志与统计

- Task21 AI analyze 当前已默认记录成功 / 失败调用。
- 日志文件：
  - `platform-resources/abaka-ai/task21/backend/logs/ai-calls-YYYY-MM-DD.csv`
- 统计接口：
  - `GET /api/abaka-ai/task21/ai/analyze/logs/summary`

## Network 入口

- 平台通用初始化、权限、任务和资源接口：`../network/platform.md`
- Data 页、`/items` 初始化、领取、状态流转、语言和资源接口：`../network/README.md`
- Task21 same_font 保存接口：`network/task21.md`
- Task21 专项 Network 采集索引：`network/README.md`
- 重点专项文档：`network/08-label-save-labels.md`

## 当前能力与后续候选

- AI 后端桥接状态：
  - `POST /api/abaka-ai/task21/ai/analyze` 已改为通过 `platform-resources/backend/ai-framework/` route factory 驱动。
  - `platform-resources/abaka-ai/task21/ai/adapter.js` 负责请求映射、旧响应结构兼容和脚本级结果暴露。
  - `platform-resources/abaka-ai/task21/backend/ai-analyze-request.js` 负责 Task21 analyze 请求归一，与 adapter 共用。
  - `GET /api/abaka-ai/task21/ai/health` 与 `GET /api/abaka-ai/task21/ai/defaults` 当前仍保留旧实现，本轮先做桥接，不一次性推倒两阶段视觉链路。
  - `ai/assets/` 与 `data/` 当前先固定目录边界，后续再逐步迁移 prompt / rules / schema / defaults / 统计下载逻辑。
- 已完成能力：
  - 快捷键 1~7（含暂存、送审）
  - 字段旁 AI 分析 / 整体分析
  - 用户点击“填写 AI 答案”后写入（Monaco / Naive UI）
  - image_b_texts_removed 的 T/B/R/D 多重集规则
  - 列表页顶部统计入口挂载
- 待补能力：
  - 统计后端接口与独立统计 runtime
  - 统计导出真实下载链路
  - 操作前确认层

## 快捷键辅助第一版

- `1`：`same_font=true`
- `2`：`same_font=false`
- `3`：`same_font=same underlying font+artistic effect`
- `4`：`image_b_texts_removed=specify`
- `5`：`other_changes=specify`
- `6`：点击页面真实“暂存 / Save / Stash”按钮
- `7`：点击页面真实“送审 / Submit / Submit Review”按钮

联动逻辑：

- `same_font=true` 与 `same_font=same underlying font+artistic effect` 快捷键触发后，默认都会确保 `image_b_texts_removed=specify` 和 `other_changes=specify`。
- 该联动由配置项 `autoSelectSpecifyOnSameFontTrue` 控制，默认开启。
- 联动是幂等行为：如果 `specify` 已经选中，则保持不变，不重复点击以避免取消。
- 单独按 `4/5` 也按幂等策略执行：已选中时不会取消。
- 行为属于运行时 DOM 点击，不直接调用平台 API；若页面产生自动保存，由平台自身行为触发。
- `7` 属于高风险动作，仍是用户按键触发；扩展只点击页面真实按钮，不自动确认二次弹窗。
- 疑似标注内审环境下会阻止 `7`，避免误触发送审。
- `6/7` 在 `viewMode=true` 查看页不执行。

## AI 辅助分析（Task21助手）

- 单板块分析：
  - same_font
  - image_b_texts_removed
  - other_changes
- 整体分析：
  - 先判 same_font
  - same_font=false/unsure/error 时按流程将后两项标记为 not_applicable
  - same_font=true 或 same underlying font+artistic effect 时继续分析后两项
- AI 结果仅用于辅助判断；用户点击“填写 AI 答案”后才会写入页面，不自动保存/提交/送审。
- `image_b_texts_removed` 的实际输入区是 `custom-md-editor / Monaco`；定位必须先锁定当前 `.l-item` 和 `.l-title-text=image_b_texts_removed`，再在字段内查 `.custom-md-editor`、`.monaco-container`、`.monaco-editor[data-uri]`、`textarea.inputarea`、`.view-lines`。
- `other_changes` 继续使用 Naive UI textarea（`textarea.n-input__textarea-el`），定位限制在当前 `.l-item` 内。
- `specify` 写入前会等待输入框渲染（默认 `5000ms`），降低切换 radio 后找不到输入框的问题。
- Monaco 写入主路径：读取 `.monaco-editor[data-uri]`，再用 `window.monaco.editor.getModels()` 匹配 `model.uri.toString()`，命中后执行 `model.setValue(text)`。
- Monaco fallback 顺序：editor instance -> `execCommand("insertText")` / input 事件链 -> textarea fallback；textarea fallback 只能返回“需人工确认”，不能把视觉层文本当作成功。
- `image_b_texts_removed` 新判断流程：
  - `T` = target removal text multiset，目标删除文本多重集，只作辅助，不覆盖图片事实。
  - `B` = image_b 中可读文本实例多重集。
  - `R` = image_b_removed 中仍可读文本实例多重集。
  - `D = B - R`，即 image_b 有、image_b_removed 没有的实际删除文本多重集。
- `image_b_texts_removed` 只看 `image_b` 与 `image_b_removed`，不允许用 `image_a` 判断删除。
- `true` 条件：`D == T`。
- `null` 条件：`D` 为空。
- `specify` 条件：`D` 非空且 `D != T`，包括 extra deleted texts、部分删除、count mismatch。
- 多实例比较大小写不敏感；普通空格/普通字距差异可忽略。
- 换行和 `<br>` 有意义，不能把带换行文本和无换行文本合并。
- `specify` 标准答案支持：
  - `all instances of xxx`
  - `1 instance of xxx`
  - `N instances of xxx`
- 示例：
  - `Logo Variation` 中 `Logo` 仍保留、只删 `Variation` 时，写 `1 instance of Variation`
  - `MODERN<br>ABODE` 被删时，输出必须保留 `<br>`
  - 如果 `image_b_removed` 里仍保留某文本实例，不能写 `all instances of xxx`
  - 如果 `D == T`，不要为了出现多个实例或 `all instances` 格式把结果强行改成 `specify`
- Task21助手新增运行时版本标识：
  - `runtimeVersion: task21-assistant-fill-v2-20260519`
  - `domActionsVersion: task21-dom-actions-fill-v2-20260519`
- 若用户页面仍显示旧的 `2500ms` 提示，优先判断为扩展未重载或旧页面未刷新，而不是直接判定仓库代码未更新。
- 悬浮窗主视图仅展示推荐选择、标准答案、理由和填写按钮；调试信息默认折叠。
- 悬浮窗支持拖动、调整宽高和重置位置。
- Prompt 与规则沉淀路径：`backend/ai/README.md`、`backend/ai/prompt.md`、`backend/prompt.js`。
- UI 形态：字段标题右侧内联按钮 + 字段锚点悬浮窗（不再使用右下角全局面板）。
- 字段按钮：
  - same_font：`AI分析`、`整体分析`
  - image_b_texts_removed：`AI分析`
  - other_changes：`AI分析`
- 快捷键（默认）：
  - `Alt+1`：AI 分析 same_font
  - `Alt+2`：AI 分析 image_b_texts_removed
  - `Alt+3`：AI 分析 other_changes
  - `Alt+4`：AI 整体分析
- 数据采集优先 `get-item-info`，DOM 只作为回退。
- `same_font` 允许值补充：`true | false | unsure | error | same underlying font+artistic effect`。
- `image_b_texts_removed` 的 `specify` 标准答案支持：
  - `all instances of xxx`
  - `1 instance of xxx`
  - `N instances of xxx`
- 同内容多处删除优先 `all instances of xxx`。
- `image_b` 中有、`image_b_removed` 中没有，才算删除；目标文本 `T` 只作辅助范围。
- 纯文字替换：删掉旧字进 `image_b_texts_removed`，新字替换行为进 `other_changes`。
- 文字改图案：删字进 `image_b_texts_removed`，图案改动进 `other_changes`。
- 模糊不可识别文字不进入删除列表，统一在 `other_changes` 描述文字块/文字元素变动。
- `other_changes` 只比较 `image_b_removed` 与 `image_b`，`specify` 输出英文短句。

Console 调试入口：

- `window.__ASCEdgeAbakaAiDomActions.debugFindFieldTextInput("image_b_texts_removed")`
- `window.__ASCEdgeAbakaAiDomActions.debugFillFieldText("image_b_texts_removed", "all instances of MULTILINGUAL")`
- 页面刷新后可先看 Console：
  - `[ASC][Abaka AI] Task21 assistant runtime version: task21-assistant-fill-v2-20260519`

模型口径说明：

- 默认模型保持 `qwen3.6-plus`（视觉/推理/单模型）。
- 兼容历史误填 `qwen3.6plus`，会归一为 `qwen3.6-plus`。
- 本次未能联网核对官方文档，保留项目当前 `qwen3.6-plus` 口径。

## 待补清单

- 内审 Reject / Label / Pass 流转接口，本轮边界禁止采集。
- 异常弹窗、保存失败提示、权限不足提示。
- 更多 Task21 same_font 条目状态下的字段差异。



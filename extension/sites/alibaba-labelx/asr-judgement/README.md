# 阿里 ASR 语音判别

这个目录对应 LabelX 上的 ASR 快判 / 更优判断脚本。

## 当前状态

- 已归档真实页面结构和网络资料：`platform-resources/alibaba-labelx/asr-judgement/`
- 快判在 options 中拥有独立脚本详情页和简化设置表单。
- 快判已接入独立运行时，入口文件为 `content.js`、`audio-controller.js`、`page-world/network-observer.js`；音量、倍速、播放、分页、总时长、判别动作、快捷键、toast、工具栏、网络协议、ASR 差异视图、轻量题卡摘要、雷题判断、AI 半自动建议和统计上传等能力已拆成小文件。
- 快判音频基础能力已切换到 `extension/sites/alibaba-labelx/shared/audio-controller-core.js` 复用实现；快判 `audio-controller.js` 仅保留薄封装。
- `content.js` 当前只作为入口编排层，不再承载具体功能实现。

## 负责范围

- 当前页面命中后，脚本中心以 `judgement` 作为快判脚本 ID 管理启停状态。
- options 快判详情页负责保存快判专属设置：默认音量、默认倍速、倍速步进、前进 / 后退步长、默认每页条数、自动播放音频、ASR 对齐差异视图、差异高亮颜色、轻量题卡摘要、雷题判断与快捷键；AI 参数迁移到通用隐藏部件“ASR 语音 AI 设置”。
- 快判默认倍速为 `2x`；新音频加载、切题、自动播放和重置倍速都会回到当前配置默认值。
- 切换到下一题时会立即暂停旧音频，并按默认倍速 / 音量自动播放新题音频（开启自动播放时）。
- 快判 `400` 条自定义 pageSize 仍属于快判专属能力，不在 shared audio core 中实现。
- 快判详情页和任务列表页 DOM / 网络资料统一沉淀到根目录 `platform-resources/alibaba-labelx/asr-judgement/`，供 Chrome / Edge 共用。
- 运行时只读取 `shared/constants.js` 和 `shared/storage.js`，不复用转写业务模块。
- 当前运行时不实现保存、提交、自动流转，也不点击会产生业务动作的按钮。

## AI 半自动参考建议（v2：双模型）

- `aiSuggestionEnabled` 保留为历史兼容字段，但 normalize 与运行时都强制为 `true`，不再提供前端启用/关闭开关。
- AI 建议地址不再由脚本详情页单独配置；统一使用 options 首页顶部“后端接口地址”拼接：
  - `server`：`https://script.xiangtianzhen.store/api/alibaba-labelx/asr-judgement/ai/suggest`
  - `local`：`http://127.0.0.1:3333/api/alibaba-labelx/asr-judgement/ai/suggest`
- 请求超时字段：`aiSuggestionRequestTimeoutMs`，默认 `60000`。
- 快判 options 新增 AI 字段：
  - `aiSuggestionListenModel`（默认 `qwen3.5-omni-flash`）
  - `aiSuggestionCompareModel`（默认 `qwen3.5-plus`）
  - `aiSuggestionListenPrompt` / `aiSuggestionComparePrompt`（可选，留空使用后端内置模板）
  - `aiSuggestionTemperature` / `aiSuggestionTopP`
  - `aiSuggestionMaxTokens` / `aiSuggestionMaxCompletionTokens`
  - `aiSuggestionPresencePenalty` / `aiSuggestionFrequencyPenalty`
  - `aiSuggestionSeed` / `aiSuggestionStopSequences`
  - `aiSuggestionEnableThinking`（默认 `false`）
  - `aiSuggestionWebSearchEnabled`（默认 `true`，仅比较阶段生效）
- 快判 AI 参数默认隐藏在通用部件“ASR 语音 AI 设置”中：在 options 快判详情页标题“阿里ASR语音判别”连续点击 10 次后显示，并插入在脚本标题下方。
- 快判普通设置区不再直接展示模型、Prompt、temperature 等 AI 细项，只保留“默认能力、仅手动触发”的说明。
- 隐藏面板解锁后会调用 `GET /api/alibaba-labelx/asr-judgement/ai/defaults` 读取后端默认模型、Prompt 和参数；失败时回退本地默认值并提示。
- Prompt/参数采用“默认值 + override”模式：前端输入为空或与默认一致时，不保存 override，运行时由后端继续使用默认值。
- 不支持的参数前端不显示；后端也会做白名单过滤，不透传未支持字段。
- `response_format` 不对前端开放，后端固定结构化 JSON 输出。
- 顶部工具栏 AI 分组仅保留两个按钮：`AI 分析当前题`、`复制两条 ASR 文本`。
- `AI：采用建议`、`AI：重新分析`、`AI：忽略建议`不再在顶部工具栏重复显示，但仍可通过 AI 面板按钮和快捷键触发。
- 快捷键动作：`shortcuts.aiSuggestCurrentItem`（默认未绑定）。
- 触发方式：只支持工具栏按钮或快捷键手动触发，且只分析“当前题卡”；不会自动分析全页或批量请求。
- 扩展不直连 Qwen，API Key 只在后端环境变量 `DASHSCOPE_API_KEY` 中配置。
- 后端为双阶段 pipeline：
  - 第一阶段：听音模型只输出 `heardText/isValidAudio/confidence` 等听音结果。
  - 第二阶段：比较模型结合 `heardText + asrText1/asrText2 + 可选上文` 输出“哪个更优”建议。
- 快判比较规则版本：`asr-judgement-rules-20260422`。
- 权重规则：
  - `asrText1/asrText2` 是主判断对象；
  - `heardText` 只用于辅助比较两条候选谁更接近音频；
  - `contextText`（上文）与 Web Search 只用于消歧，不能替代候选比较。
- 判别遵循官方 ASR 判断规范分层：
  - P0/P1 为硬伤（核心词/意图错误、漏转多转、强截等）；
  - P2 为轻微差异（标点、空格、语气词、儿化音等）。
- `both_bad` 仅在两条都存在影响理解的 P0/P1 时使用，不能作为“没把握”兜底。
- `uncertain_or_similar` 应少用，仅在两条都合格且无明显优劣时使用。
- 实意词、专有名词、动作词、否定词优先级高于标点和格式。
- 专有名词、地名、人名、品牌、行业词会结合 Web Search 辅助确认。
- 当前题“上文”块会被采集为 `contextText`；若存在上文，AI 卡片默认“使用上文理解：开”。
- 上文开关只在当前题 AI 卡片运行态生效，不写入全局 settings；切换后需点击“重新分析”生效。
- 上文仅用于语义消歧，不能覆盖听音事实。
- Web Search（联网搜索）默认开启，可在“ASR 语音 AI 设置”中关闭；仅在 compare 阶段启用，不在 listen 阶段启用。
- Web Search 不支持时，后端会移除对应参数重试一次，并在结果卡展示“开（已回退）”。
- Qwen 音频输入使用 `messages[].content[].type=input_audio`，字段为 `input_audio.data + input_audio.format`，`format` 会按 URL 后缀推断（wav/mp3/aac/m4a/amr/3gp/3gpp，默认 wav）。
- `enable_thinking` 参数会按开关显式发送：关闭传 `false`、开启传 `true`；若上游返回“不支持/参数无效”，会移除该参数后仅重试一次，不做无限重试。
- 点击“AI 分析当前题”后，当前题卡会立即显示“正在分析当前题...”状态卡；成功后替换为建议卡；失败或超时会替换为错误卡（含“重试/忽略”）。
- 结果卡会显示听音文本、听音置信度、建议答案、置信度、风险等级、是否使用上文、Web Search 状态、双模型信息、阶段耗时、`听音预估人民币 / 比较预估人民币 / 总预估人民币` 和 requestId；缺少价格源时统一显示 `没有数据源`。
- 建议答案（`answerText`）只允许五个固定选项：`第一个更好`、`第二个更好`、`不确定或差不多`、`都不好`、`其他方言或语种`。
- 解释性文案只能放在“简短理由”（`reasonSummary`），不能写入建议答案。
- 当两条 ASR 主体一致但标点/空格/数字格式存在明显优劣时，应选择更规范的一条；不能把“仅标点不同”一律判成“不确定或差不多”。
- 只有点击“采用建议”才会调用 `selectJudgementChoice(choiceActionKey)` 写入单选；不采用可以忽略。
- 雷题优先级高于 AI：命中雷题会提示“雷题优先”；若 AI 与雷题标准答案冲突，会禁用“采用建议”。
- 不记录完整 `audioUrl` 到 `chrome.storage`、DOM 属性或日志。
- AI 建议能力本身不自动保存、不自动提交、不自动领取、不自动流转；仍需用户手动点击“AI 分析当前题”与“采用建议”。
- 后端日志阶段至少包括：`suggest start`、`listen start/success`、`compare start/success`、`suggest success/suggest failed`；日志只记录 `requestId/hostname/itemIndex/模型/耗时/状态` 等脱敏摘要。
- 真实链路验收必须确认 `GET /api/alibaba-labelx/asr-judgement/ai/health` 返回 `mockEnabled=false`，不得以 mock 结果替代真实调用验证。

## 能力路线

快判脚本的核心目标是服务标注员，提高“听音频、看两个 ASR 文本、判断哪个更好”的效率。后续能力按以下顺序推进：

1. 提效脚本：只改善页面展示、播放、快捷键、提示和信息聚合，不替标注员做业务判断。
2. 半自动人工：脚本给出差异摘要、疑似建议或风险提示，但最终选择仍由标注员确认。
3. 全自动：脚本自动选择、保存、提交或流转任务。只有在规则、接口、异常路径和回滚策略都充分验证后才允许进入这一阶段。

当前优先做第一阶段；第二阶段只做可解释建议；第三阶段暂不作为近期目标。

## ASR 对齐差异视图

- `judgement-asr-diff-view.js` 会按 `.labelRender-item-content-wrap` 分块读取内容，优先识别标题 `online_rec` / `两个ASR文本`，并以 `asr_text1/asr_text2` 解析成功作为最终判定，再生成对齐差异视图。
- 新版 LabelX 内容区可能包含 `上文`、`音频地址`、`wav_id` 等块；这些块不参与 ASR 差异对比。
- 差异视图只隐藏真正 ASR 文本块中的原始双行文本，不隐藏 `上文` 块。
- 差异视图启动时会立即扫描一次题卡；后续 DOM 变化使用节流扫描，避免 LabelX 持续异步更新时防抖计时器一直被重置。
- 对齐算法使用字符级编辑距离：缺字 / 多字位置会用空白占位对齐；同一位置不同字会高亮显示；仅标点或空格不同会使用独立颜色。当前算法会降低标点、空格等符号的插入 / 删除权重，减少标点把中文主体对齐带偏的情况。
- 题卡内会显示差异摘要，例如“完全相同”“仅标点或空格不同”“存在缺字或多字”“长度差异较大”“存在 N 处差异”。
- 该功能属于提效脚本，只增强阅读，不自动判断哪个 ASR 更好，不写入答案。
- 设置字段为 `asrDiffViewEnabled`，默认开启；可在 options 快判设置中关闭，关闭后恢复 LabelX 原始文本展示。
- 高亮颜色字段为 `asrDiffColors.changeBackground`、`asrDiffColors.gapBackground`、`asrDiffColors.punctuationBackground`，可在 options 中分别调整“替换 / 不同字”“缺字 / 多字”“标点 / 空格”的背景色；普通差异视图和轻量题卡摘要共用同一套颜色。
- 如果后续发现页面结构变更导致误判，应先更新 `platform-resources/alibaba-labelx/asr-judgement/page-structure/` 再调整选择器。

## 选择后辅助流转

- 设置字段为 `autoAdvanceAfterChoice`，默认关闭。
- 开启后，通过 `1~5` 快捷键或快判工具栏按钮选择“哪个ASR更优”后，会自动点击当前页下一条 `.labelRender-item[data-index]` 并滚动到中间。
- 该功能只在当前页内移动，不自动翻页，不自动提交，不自动领取新任务。
- 自动下一题内部派发的合成点击不会再触发快捷键动作，避免跳题时误写入下一题选项。

## 提效功能池

- ASR 文本差异高亮：已实现字符级对齐差异视图，用颜色标出新增、缺失、替换和仅标点差异，帮助标注员快速定位不同点。
- 差异摘要：已实现“完全相同 / 仅标点或空格不同 / 存在缺字或多字 / 长度差异较大 / 存在 N 处差异”等短标签。
- 差异导航：一题内如果差异较多，提供跳转到上一个 / 下一个差异的轻量按钮或快捷键。
- 文本布局增强：已将两条 ASR 文本改成更容易对齐阅读的双行显示，保留原文内容，不改变 LabelX 原始数据。
- 选择后辅助流转：已支持在选择 `1~5` 后自动滚动到当前页下一题，仍不自动提交。
- 轻量题卡摘要：已支持在每个题卡内部顶部显示“两个ASR文本”和“哪个ASR更优”的当前状态，可在 options 中开启或关闭；配合 LabelX 样式设置隐藏内容区 / 回答区和卡片大小调整，可以减少需要关注的可见内容。
- 雷题判断：已支持基于本地 CSV 雷题库提示标准答案，并在当前选择与标准答案不一致时显示严重提示。
- 当前音频控制：已支持当前音频前进 / 后退、临时倍速、临时音量；默认音量、默认倍速、倍速步进和前进 / 后退步长在 options 中配置。

## 轻量题卡摘要

- 设置字段为 `compactCardEnabled`，默认开启；可在 options 快判设置中关闭，关闭后运行时会移除已生成的摘要块。
- `judgement-compact-card.js` 会监听 `.labelRender-item[data-index]`，开关开启时在对应 `.labelRender-item` 根节点内部顶部插入扩展摘要块，并给原题卡根节点添加 `data-asr-edge-judgement-compact-item` 作为关联标记。
- 轻量摘要启动时会立即扫描一次题卡；后续 DOM 变化使用节流扫描，避免 LabelX 持续异步更新时防抖计时器一直被重置，导致摘要块不生成。
- 摘要块不放进 `.labelRender-item-content` 或 `.labelRender-item-answer`，因此开启 LabelX 的“隐藏内容区 / 隐藏回答区”并压缩原题卡后仍可见。
- 摘要块作为 `.labelRender-item` 的直接子节点挂载，使用内部首行显示方式占满当前题卡宽度，但不作为 `.labelRender-scrollable` 的独立子项参与布局，避免破坏 LabelX 原生多列 / flex 排列。
- ASR 文本优先从原始 `.dt-text-container` 解析；如果原始容器被 ASR 差异视图隐藏或重绘，则回退读取差异视图的 `data-asr-edge-signature`。
- 摘要块显示 `asr_text1`、`asr_text2` 和“哪个ASR更优”的当前选择；未选中时显示“未选择”。
- 摘要块中的 ASR 文本会自动换行并撑高题卡，避免长文本被单行省略。
- “哪个ASR更优”当前选择会按五个选项使用不同底色，便于在多题卡视图中快速区分。
- 摘要块会在“哪个ASR更优”当前选择下方显示当前音频时间，例如 `0:07 / 0:07`；音频播放、跳转或元数据加载后会随题卡状态刷新。
- 当“ASR 对齐差异视图”开启时，轻量摘要里的 `asr_text1` 和 `asr_text2` 也会使用同一套对齐高亮样式，并把差异摘要放在标题下方，尽量与右侧音频时间处于同一视觉高度；关闭该功能后恢复为普通文本。
- 如果雷题判断开启且当前题卡命中雷题库，摘要块会显示“雷题：标准答案：...”；当前选择与标准答案不一致时显示“严重提示：该雷题与标准答案不一致”。
- 该能力不替代原生单选写入；选择仍通过 `1~5` 快捷键、快判工具栏按钮或关闭隐藏样式后操作原页面完成。
- 卡片大小仍由 LabelX 的“样式设置”控制，扩展只补充轻量摘要内容；摘要宽度跟随宿主题卡，不额外占用滚动容器的布局槽位。
- 如果不使用 LabelX 隐藏样式，摘要块也会显示，但会与原内容 / 原回答区并存；不需要时直接在 options 关闭。

## 雷题判断

- 设置字段为 `thunderQuestionEnabled`，默认开启；可在 options 快判设置中关闭。
- 雷题库文件为 `data/thunder-question-bank.csv`，随扩展打包，当前列为 `online_rec` 和 `better_asr`。
- `judgement-thunder-question.js` 会解析雷题库中的 `asr_text1/asr_text2`，按两条 ASR 文本归一化后匹配当前题卡，不依赖题号或分页位置。
- 命中雷题时，会在轻量题卡摘要和回答区“特殊情况标注”题块内插入提示，仅提示标准答案，不写入文本框，不自动选择答案。
- 如果当前“哪个ASR更优”的选择与雷题库标准答案不一致，会在摘要和特殊情况标注区域显示红色严重提示，并弹出一次错误 toast。

## 统计数据上传（0.2.11）

- `asr-judgement-server.js` 只负责扩展侧统计上传运行时，被 content script 注入到 LabelX 页面。
- Node 本地统计接收服务已迁移到 `platform-resources/alibaba-labelx/asr-judgement/backend/`，不会被 manifest 注入；推荐统一启动入口是 `platform-resources/backend/server.js`。
- 本地启动命令：在仓库根目录运行 `node platform-resources/backend/server.js`，默认监听 `http://127.0.0.1:3333/api/alibaba-labelx/asr-judgement/statistics/upload`，并兼容旧地址 `http://127.0.0.1:3333/api/asr-judgement/statistics/upload`。
- 供应商列表接口：`http://127.0.0.1:3333/api/alibaba-labelx/asr-judgement/statistics/suppliers`。
- CSV 下载接口默认总表：`http://127.0.0.1:3333/api/alibaba-labelx/asr-judgement/statistics/download`。
- 本地服务主写入根级总表：`statistics-data/statistics-merged.csv`。
- 不再主动创建 `statistics-data/suppliers/`；该目录若本地已存在，属于旧方案残留，可忽略或手动清理。
- 统计格式参考 `希尔数据示例.csv`，扩展内置 CSV 基础列顺序为：`任务名称`、`任务ID`、`标注员1子任务ID`、`标注员2子任务ID`、`标注员3子任务ID`、`审核子任务ID`、`分包ID`、`题数`、`有效时长(秒)`、人员、领取 / 提交时间和完成状态。
- 供应商列动态输出：单供应商数据集不输出 `供应商`；多供应商数据集在最后一列追加 `供应商`。
- CSV 写出前统一清洗字段：去 BOM、去首尾空白（含全角空格/Tab/换行/零宽字符），避免输出 ` 任务名称` 或 ` 未识别供应商` 这类脏值。
- 当 `csvPatch["供应商"]` 为 `未识别供应商` / `unknown-supplier` / 空值时，后端会回退任务名重新识别供应商。
- 单条分包 payload 的基础字段放在 `csvPatch`，当前子任务身份放在 `roleRecord`。服务端以 `mergeKey.supplierKey + "::" + mergeKey.batchId`（等价于 `供应商 + 分包ID`）做幂等合并，把多个标注员和审核员的补丁记录合并成一行 CSV 宽表。
- 顶部导航右侧头像旁会显示“上传统计”按钮；标注首页、审核首页和快判详情页都使用同一个入口，快判工具栏内不再放统计按钮。
- 只要当前 URL 带有 `projectId`，手动上传和定时上传都会按项目维度采集该账号下的标注 / 审核首页数据；详情页与首页走同一条批量采集路径，不再保留“当前 `subTaskId` 单条上传”回退。若页面 URL 没有 `projectId`，统计上传会直接失败并提示。
- 标注首页 URL 为 `/corpora/labeling/labelingTask?projectId=...`，按标注角色写入 CSV；审核首页 URL 为 `/corpora/labeling/checkTask?projectId=...`，按审核角色写入 CSV。点击首页按钮时会同时尝试读取标注和审核两类列表，避免只上传当前页类型。
- 首页上传会直接使用 LabelX 登录态请求首页任务数据：先读取 `/api/v1/label/center/tasks` 和 `/api/v1/label/center/subTasks`，再对每个子任务调用 `/api/v1/label/center/subTask/{subTaskId}/data` 获取完整题目与时长，最后批量上传 `payloads`。已通过 DevTools 确认：标注首页使用 `type=label` / `subTaskType=label`，审核首页使用 `type=check` / `subTaskType=check`；两类首页的已完成列表都通过 `subTasks?finished=true` 读取。
- 快判首页统计分页按 `recordCount` 补齐并保留页数保护阈值（防无限分页）；仍保持快判详情 `pageSize=400` 的业务口径，不套用转写 `pageSize=5000`。
- 快判详情抓取并发改为动态规则：`Math.floor(total/5)`，最小 `1`，最大 `999`，并发显示值与实际执行并发一致。
- 快判统计上传已接入 `shared/progress-indicator.js`：显示阶段、完成/总数、百分比、并发、成功/失败，不再只显示“上传中”。
- 首页上传只保留 ASR 更优判断数据：优先按 `labelModel=vote` 判断；如果接口缺少该字段，再用 `taskName` 包含 `ASR更优结果判断` / `ASR更优` 且 `size=400` 作为补充判断。`labelModel=single`、`taskName=中文普通话asr任务` 或 `size=50` 会视为历史转写数据并跳过。
- 标注员 / 审核员姓名优先从顶部头像下拉读取：脚本会对 `.NavAvatar-module__userInfoWrapper...avatar` 触发 hover，再读取下拉菜单中的用户展示名；读取失败时回退到接口字段。
- 快判统计上传与定时上传为脚本默认能力，运行时强制启用；options 不再提供统计开关、上传地址下拉、时间配置 URL 或手动上传按钮。
- 不再支持进入快判详情页自动上传，避免仅打开页面就产生统计写入。
- 上传接口地址由全局后端模式拼接：
  - `server`：`https://script.xiangtianzhen.store/api/alibaba-labelx/asr-judgement/statistics/upload`
  - `local`：`http://127.0.0.1:3333/api/alibaba-labelx/asr-judgement/statistics/upload`
- 历史保存的 `statsUploadEndpoint/aiSuggestionEndpoint` 仅用于兼容迁移全局模式，不再作为运行时主配置。
- 定时上传默认时间固定写在代码中，为 `10:00`、`16:00`；到点后会增加随机延迟，避免大量客户端同时请求服务器。options 不再配置本地默认时间和随机延迟。
- 定时时间配置通过“全局后端地址 + 统计 upload path”发起 `GET` 请求并追加 `purpose=schedule`。当前支持响应形态中包含 `data.times`、`data.uploadTimes` 或 `data.scheduleTimes`，例如 `["10:00","16:00"]`；请求会附带当前 URL 的 `projectId` 和 `subTaskId`。请求失败时回退到代码内默认时间。
- 统计上传失败提示会包含 HTTP 状态码、上传接口地址和最多 300 字响应摘要；如果是浏览器权限、CORS、证书或网络拦截导致请求未发出，会明确提示“上传请求未发出或被浏览器/网络拦截”。
- 服务端更推荐的抗峰值方案是：上传接口只做快速校验和入队 / upsert，返回 `202` 或轻量成功响应；后端队列再异步合并 CSV 和写数据库。这样比只靠客户端随机延迟更稳。

## 快判统计双键槽位校验修复

- 本次修复只保证“人工备份并清空服务器快判统计数据后”的未来正确性，不兼容历史脏数据，也不提供自动迁移 / 自动修复旧 CSV。
- 首次启用新规则前，需要先人工备份并清空服务端现有快判统计数据，再让全员重新上传一次。
- 标注角色的统计身份键已收紧为 `用户名 + subTaskId` 双键精确命中：
  - 只有同一用户名且同一 `subTaskId` 重传时，才会复用原标注槽位。
  - 同用户名但 `subTaskId` 不同，会被后端拒绝为双键冲突。
  - 同 `subTaskId` 但用户名不同，也会被后端拒绝为双键冲突。
  - 三个标注槽位都占满且没有双键精确命中时，仍按“超过 3 个标注员子任务”拒绝。
- 审核角色这轮不改成双键规则，仍沿用原单槽位逻辑。
- 快判首页 / 定时上传在调用 existing 检查时，标注请求项现在会显式带上当前 `userName`。
- existing 对标注角色的跳过条件已改为“双键精确命中才视为 complete”：
  - 同一个人同一个 `subTaskId` 再上传，会被正确识别为已完成并跳过。
  - 同名换了新 `subTaskId`、或同 `subTaskId` 换了名字，不会再被误判成“已完整可跳过”。
- 首页上传当前补回“冲突跳过”体验：
  - 如果 existing 已识别为“单键命中双键冲突”，前端会直接记为“冲突跳过”，不再继续拉详情和上传，也不再把它算进失败。
  - `完整跳过` 只表示双键精确命中。
  - `冲突跳过` 不参与“补传并覆盖当前人员”。
- 标注上传 payload 中的 `roleRecord.userName` 已升级为必填；缺失用户名的标注记录会在上传前直接拒绝，不再允许写入新行。
- 这次不新增“清空快判统计”的后端接口；清空动作属于人工运维步骤，不写成脚本能力。

## 半自动功能池

- 规则建议：根据文本差异类型给出“疑似第一个更好 / 疑似第二个更好 / 建议人工复听”的可解释提示，但不自动选中。
- 风险提示：当两条文本完全相同、只有标点差异、长度差异过大或疑似漏字时，在题卡内提醒复核。
- 一键采用建议：已提供“采用建议”按钮，但仅在人工确认后写入单选，且雷题冲突时会禁用。

## 全自动边界

- 自动选择、自动保存、自动提交、自动领取和自动流转属于全自动能力。
- 进入全自动前必须补齐保存、提交、失败响应、校验阻断、自动领取成功 / 失败等网络采集，并在 `README.md`、`platform-resources/` 和 `log.md` 中记录验证范围。
- 未验证前，不允许让脚本静默提交或批量改写标注结果。

## 快捷键动作清单

默认 `1`~`5` 分别对应“哪个ASR更优”的五个选项；默认“增大音量”为 `[`，“减小音量”为 `]`，“重置音量”为 `\`，“后退当前音频”为 `ArrowLeft`，“前进当前音频”为 `ArrowRight`，“播放/暂停当前音频”为 `Space`。提高倍速、降低倍速和重置倍速默认未绑定，需要在脚本中心的“阿里ASR语音判别”详情页手动录制并保存。前进 / 后退步长只提供 `0.1`、`0.25`、`0.5`、`1` 秒四档。

- 选择：第一个更好
- 选择：第二个更好
- 选择：都不好
- 选择：不确定或差不多
- 选择：其他方言或语种
- 增大音量
- 减小音量
- 重置音量
- 提高倍速
- 降低倍速
- 重置倍速
- 后退当前音频
- 前进当前音频
- 播放/暂停当前音频
- AI 分析当前题
- AI：采用建议
- AI：重新分析
- AI：忽略建议
- 复制两条 ASR 文本
- 提交任务（仅触发页面系统按钮）
- 提交任务并结束（仅触发页面系统按钮）

“提交任务 / 提交任务并结束”快捷键只点击页面真实系统按钮，不直接调用平台接口；如页面弹出二次确认，需要人工确认。
该动作由 `extension/sites/alibaba-labelx/shared/submit-actions.js` 提供，快判仅做快捷键映射和状态提示。

复制两条 ASR 文本格式固定为：

```text
asr_text1:<第一条文本>;
asr_text2:<第二条文本>
```

快捷键支持键盘组合和鼠标按键。运行时如果焦点在 `input`、`textarea`、`select` 或 `contenteditable` 内，不触发全局快捷键。
运行时只响应浏览器真实用户事件；页面初始化、脚本派发的合成点击或合成按键不会触发判别动作。
判别写入必须能定位到当前题卡：优先使用 `.labelRender-item-selected`，其次使用正在播放的音频题卡，再回退到 `.labelRender-answerNav-status` 解析出的题号；无法定位时不会默认选择第一页第一题。
删除快捷键后保存即可清空；录制时按 `Esc` 退出，不保存。
音量和倍速快捷键只调整当前音频，不会扩散到其他题卡；重置音量 / 重置倍速会把当前音频恢复到 options 中保存的默认音量 / 默认倍速。新加载或音频源变化后的音频也会使用这些默认值。

## DOM 选择器依据

当前音频能力只依赖已采集的快判详情页结构：

- 单条题卡：`.labelRender-item[data-index]`
- 当前选中题卡：`.labelRender-item-selected`
- 音频播放器容器：`.dt-audio-base-container`
- 音频元素：`audio[controls]`
- 顶部工具栏区域：`.mark-toolbox`
- 顶部主导航区域：`.header-component-container`

运行时工具栏挂载在 `.mark-toolbox` 内，优先放在 `.mark-toolbox-breadcrumb-wrapper` 后方；如果页面结构变化，则回退到 `.mark-toolbox` 内部首位或末尾。总时长挂载在顶部主导航栏，优先插入 `.header-component-container` 的菜单后方。
后续新增快判运行时动作时，除页面已有等价控件的动作外，应同步在这个工具栏中增加按钮入口。

题卡列表和音频节点是异步加载的，运行时使用 `MutationObserver` 监听新增节点。每个 `audio` 都有自己的临时音量和倍速状态；新音频默认使用 options 中保存的默认音量和默认倍速，快捷键调整只影响当前音频。

## 分页与总时长

- 快判设置字段为 `itemsPerPage`，默认值为 `50 条/页`。
- 页面原生分页选择器只包含 `1/2/3/4/5/10/20/30/40/50 条/页`；这些原生档位只通过 LabelX 分页选择器切换，不走网络改写。
- options 前端重新开放 `400 条/页`，运行时会先触发 LabelX 原生分页刷新，再由 MAIN world 网络层把详情页 `data` 请求改写为 `pageSize=400`；`100/150/200 条/页` 仍不开放，历史配置会自动回退为 `50 条/页`。
- 顶部主导航栏会展示总时长、当前默认每页条数、默认倍速和默认音量，来源是 `/api/v1/label/center/subTask/{subTaskId}/data` 返回的 `data.dataList[].data.duration` 以及 options 保存的快判配置。
- 总时长统计仍按完整子任务包读取，先尝试 `pageSize=400`；如果响应不足总数，会按 50 条分页只读补齐并求和。总时长不依赖当前页面实际渲染条数。

## 未完成能力

- `judgement-virtual-window.js`：实验性窗口化显示暂不启用，options 前端不展示开关，`content.js` 会强制把 `virtualWindowEnabled` 视为 `false`。
- 已尝试按当前题号只展开前后 5 题，并对窗口外 `.labelRender-item[data-index]` 写入 `asr-edge-judgement-window-hidden` 和 LabelX inline CSS 变量；实测未能稳定压缩宿主页面题卡，后续需要重新确认 LabelX 真实渲染层级和样式生效点。
- 暂存实现保留在代码中，后续继续处理时优先检查：题卡外层真实高度来源、`.labelRender-scrollable` 的滚动计算、React 重渲染是否覆盖 inline CSS 变量。
- `100/150/200 条/页` 自定义大页数显示暂不开放：当前只恢复 `400 条/页` 作为全量显示测试入口；如果 400 条页面出现卡顿，后续仍需要重新设计窗口化或其他降载方案。
- 轻量题卡摘要内的直接选择按钮暂不实现；后续如要在摘要块内提供直接选择按钮，必须先验证 Ant Design Radio 受控状态和保存请求是否可靠触发。

## 人工验证步骤

1. 重新加载扩展。
2. 在 options 脚本中心启用“阿里ASR语音判别”。
3. 在快判设置中确认“默认每页条数”只显示 `1/2/3/4/5/10/20/30/40/50/400 条/页`，并保存为 `50 条/页`。
4. 打开快判详情页，确认 popup 状态不是“注入失败”。
5. 确认页面最顶部主导航空白区域显示 `总时长`、当前每页档位、默认倍速和默认音量。
6. 打开 DevTools Network，确认 `subTask/{id}/data` 请求的 `pageSize` 与 LabelX 原生分页档位一致，且点击第 2 页或更后页时 `page` 保持为页面真实页码，不会被改回 `1`；若总时长接口未返回全量，确认后续只读分页请求能补齐总时长。
7. 在快判设置中改为 `20 条/页` 保存并刷新详情页，确认页面原生分页切换到 `20 条/页`。
8. 在快判设置中改为 `400 条/页` 保存并刷新详情页，确认顶部主导航显示 `每页 400 条/页`，DevTools Network 中详情页 `data` 请求被改写为 `pageSize=400`；确认 options 前端仍不能选择 `100/150/200 条/页`，历史保存过的这些档位会回退显示为 `50 条/页`。
9. 在快判设置中确认“轻量题卡摘要”开启，保存并刷新详情页，确认每个 `.labelRender-item` 根节点内部顶部出现 `data-asr-edge-judgement-compact-card` 摘要块，并包含 `asr_text1`、`asr_text2`、“哪个ASR更优”的当前状态和音频时间比。
10. 在快判设置中关闭“轻量题卡摘要”，保存并刷新详情页，确认扩展摘要块被移除；重新开启后摘要块恢复。
11. 在 LabelX 样式设置中开启“隐藏内容区”和“隐藏回答区”，确认每个题卡仍显示扩展轻量摘要块。
12. 在 LabelX 样式设置中调整“卡片大小”或多列布局，确认 `.labelRender-scrollable > .labelRender-item` 仍按 LabelX 原生多列 / flex 规则排列，轻量摘要位于每个题卡内部并跟随该题卡宽度。
13. 确认轻量摘要中的长 ASR 文本会自动换行并完整显示，不再出现单行省略号截断。
14. 在隐藏内容区和回答区的状态下，按 `1`~`5` 或点击快判工具栏判别按钮，确认轻量摘要里的当前选择会更新，并且五种选项显示为不同颜色。

雷题判断补充验证：

- 在快判设置中确认“雷题判断”默认开启；打开命中雷题库的题卡，确认轻量题卡摘要和回答区“特殊情况标注”区域显示雷题标准答案。
- 对命中雷题的题卡选择一个非标准答案，确认轻量题卡摘要和特殊情况标注区域显示红色“严重提示：该雷题与标准答案不一致”，并出现一次错误 toast。
- 关闭“雷题判断”并保存刷新，确认雷题提示被移除，且不影响原有 ASR 差异视图和单选操作。

15. 确认“两个ASR文本”位置和轻量题卡摘要内都显示扩展生成的对齐差异视图，缺字位置为空白占位，不同字符高亮，且摘要标签靠近标题区域。
16. 在快判设置中修改 ASR 差异颜色并保存刷新，确认普通差异视图和轻量题卡摘要同步使用新颜色。
17. 在快判设置中关闭“ASR 差异高亮”，保存并刷新详情页，确认恢复 LabelX 原始双行文本。
18. 在快判设置中重新开启“ASR 差异高亮”，保存并刷新详情页，确认对齐差异视图恢复。
19. 在快判设置中开启“选择后自动下一题”，保存并刷新详情页。
20. 在快判详情页按 `1`~`5`，确认当前选中题卡的“哪个ASR更优”会切换到对应选项，并自动跳到当前页下一题。
21. 关闭“选择后自动下一题”，保存并刷新详情页，确认选择后不再自动移动题卡。
22. 在快判详情页验证音量、重置音量、倍速、重置倍速、前进 / 后退、播放/暂停快捷键；默认增大音量为 `[`，减小音量为 `]`，重置音量为 `\`，后退为 `ArrowLeft`，前进为 `ArrowRight`。
23. 调整当前题卡音量或倍速后，切换到其他题卡，确认其他音频仍使用 options 中保存的默认音量和默认倍速；回到原题卡时临时值仍只属于该题卡。
24. 在 options 中修改默认倍速、默认音量、倍速步进和前进 / 后退步长并保存；确认倍速步进和前进 / 后退步长都只提供 `0.1/0.25/0.5/1` 四档，刷新详情页后确认新加载音频使用新的默认值，重置倍速 / 重置音量回到新默认值。
25. 确认页面最顶部主导航区域同时显示总时长、`每页 50 条/页`、默认倍速和默认音量。
26. 确认工具栏按钮可执行判别、音量、倍速和进退动作；播放/暂停不额外添加按钮。
27. 触发快捷键或按钮后，确认页面右上角会出现短提示。
28. 在 options 中确认“统计数据上传”区域不再出现启用/定时开关、上传地址下拉、时间配置 URL 与“上传统计”按钮，只保留强制启用说明。
29. 在 options 首页顶部把“后端接口地址”切到“本机”，再打开 `labelingTask?projectId=...`、`checkTask?projectId=...` 或任一快判详情页，点击顶部导航头像旁的“上传统计”，确认扩展会同时请求标注和审核两类首页的 `tasks`、`subTasks`、`subTasks?finished=true` 和每个 ASR 更优判断分包的 `/subTask/{subTaskId}/data`，并向本地服务发送批量 `payloads`；详情页上传的 payload 行数应与同一账号同一项目首页上传一致，历史转写任务应被跳过，不进入上传 payload。
30. 确认快判详情页工具栏不出现“统计 / 上传统计”按钮；若上传接口尚未部署，顶部导航点击“上传统计”应只提示上传失败，不应影响题卡判别、保存或页面操作。
31. 将 active project 切回“阿里ASR语音转写”，刷新 LabelX 页面，确认快判快捷键和工具栏不再触发。
32. 打开一个未标注的全新快判详情页，不按快捷键、不点工具栏，确认脚本不会自动选中“哪个ASR更优”的任一选项；若页面本身返回了已保存答案，应以接口数据或页面原始状态为准。

AI 建议补充验证：

33. 在 options 快判详情页确认不再出现“启用 AI 半自动参考建议”开关，且有“默认能力、仅手动触发”的说明。
34. 连续点击“阿里ASR语音判别”标题 10 次，确认标题下方出现“ASR 语音 AI 设置”隐藏面板。
35. 在高级设置中修改听音模型、比较模型、Prompt、temperature/top_p 等支持字段并保存。
36. 确认不支持参数不会显示；若手工构造请求发送不支持参数，后端会忽略，不会透传给模型。
37. 在 options 首页顶部将“后端接口地址”切到“本机”，确认 AI 请求地址随之为 `http://127.0.0.1:3333/api/alibaba-labelx/asr-judgement/ai/suggest`。
38. 启动后端后访问 `GET /api/alibaba-labelx/asr-judgement/ai/health`，确认返回 `listenModel/compareModel/mockEnabled/hasApiKey/supportedParams` 等字段。
39. 若当前题存在“上文”块，首次分析前确认 AI 卡片默认显示“使用上文理解：开”；切换为“关”后需点击“重新分析”生效。
40. 若未配置 `DASHSCOPE_API_KEY`，触发“AI 分析当前题”，确认返回 `missing-api-key` 类错误且页面不崩溃。
41. 若已配置 `DASHSCOPE_API_KEY`，点击“AI 分析当前题”或快捷键，确认只分析当前题卡，不会自动分析其他题卡。
42. 确认题卡旁出现 AI 建议卡，展示听音文本、建议答案、置信度、理由、风险等级、是否使用上文、双模型信息、耗时和 requestId。
43. 点击“采用建议”，确认最终写入动作来自 `selectJudgementChoice(choiceActionKey)`，且不会触发自动保存、自动提交、自动领取或自动流转。
44. 命中雷题时确认“雷题优先”提示存在；若 AI 与雷题标准答案冲突，“采用建议”按钮应禁用。

## 已知限制

- 浏览器自动播放策略可能拒绝无用户手势的 `audio.play()`，运行时只记录失败原因，不重复刷屏。
- 快判的“默认倍速”会同时作为新音频的初始倍速和当前音频的重置目标；设置页不再保留独立的“当前倍速”字段。
- 快捷键动作只改变当前页面当前音频的运行态，不自动写回存储；需要持久化默认音量、默认倍速、倍速步进或前进 / 后退步长时仍在 options 中保存。
- 鼠标左键这类通用按键可以录制，但会拦截页面点击，建议优先使用组合键或侧键。
- `100/150/200 条/页` 自定义大页数入口仍暂停开放；`400 条/页` 已恢复为全量显示入口，如页面卡顿或答案回显异常，需要重新评估窗口化或其他降载方案。
- 生产统计上传依赖外部服务端接口；本地 Node 服务只用于调试和验证 CSV 合并形态，不替代正式数据库。
- AI 建议默认依赖本地/服务端后端代理；扩展前端不直接调用 DashScope。
- 未配置 `DASHSCOPE_API_KEY` 时，AI 建议接口会返回缺 key 错误，不会自动降级为 mock 成功。
- 本目录不包含提交、保存、自动领取、自动流转逻辑。

## 当前文件结构

```text
asr-judgement/
  README.md
  content.js
  page-detector.js
  judgement-actions.js
  judgement-shortcuts.js
  judgement-toast.js
  judgement-toolbar.js
  judgement-page-size.js
  judgement-duration-summary.js
  judgement-virtual-window.js
  judgement-asr-diff-view.js
  judgement-thunder-question.js
  judgement-compact-card.js
  judgement-ai-suggestion.js
  asr-judgement-server.js
  judgement-auto-advance.js
  audio-controller.js
  audio-volume-controller.js
  audio-rate-controller.js
  audio-playback-controller.js
  page-world/
    network-protocol.js
    network-config.js
    network-url-rewriter.js
    network-summary.js
    network-observer.js
  data/
    thunder-question-bank.csv
```

平台资源后端服务结构：

```text
platform-resources/backend/
  README.md
  server.js
  app.js
  router.js
  registry.js
  response.js
  config.js

platform-resources/alibaba-labelx/asr-judgement/backend/
  README.md
  index.js
  routes.js
  server.js
  http-server.js
  payload-merge.js
  file-store.js
  csv-columns.js
  csv-writer.js
```

项目级维护规则与修改日志放在仓库根目录：

- `AGENTS.md`
- `log.md`

## 平台资料

LabelX 快判页面结构、网络请求、统计格式和未完成事项已经迁移到根目录：

```text
platform-resources/alibaba-labelx/asr-judgement/
```

旧目录 `page-structure/` 已移除，不再保留页面结构和网络采集内容。

已包含：

- `page-structure/asr-judgement-detail/`
  - 快判详情页
  - 多题卡结构
  - 音频播放器
  - ASR 更优单选组
  - 特殊情况文本框
  - 顶部提交与自动领取区域
- `page-structure/labeling-task-home/`
  - 标注任务列表页
  - 我的任务
  - 可领取任务
  - 领取 / 标注 / 释放按钮结构
- `page-structure/check-task-home/`
  - 审核任务列表页
  - 审核首页接口参数和页面入口
- `network/`
  - 详情页 data、保存、提交、领取、释放和首页 tasks / subTasks 等网络采集资料
- `backend/`
  - 统计 CSV、上传 payload、本地调试服务契约和服务端合并逻辑说明
- `unfinished.md`
  - 未完成能力、风险点和后续验证条件

## 运行时模块边界

- `content.js`：只保留设置加载、启停编排、状态聚合、网络桥接、总时长状态和模块串联。
- `judgement-actions.js`：维护判别选项定义、快捷键动作顺序和“哪个ASR更优”写入逻辑。
- `judgement-shortcuts.js`：维护键盘 / 鼠标快捷键匹配、事件拦截和 follow-up 事件抑制。
- `judgement-toast.js`：维护右上角运行时提示。
- `judgement-toolbar.js`：维护 `.mark-toolbox` 工具栏和顶部主导航总时长挂载。
- `judgement-page-size.js`：维护默认每页条数、原生分页选择器点击和重试逻辑。
- `judgement-duration-summary.js`：维护总时长请求、分页补齐和网络摘要归一化。
- `judgement-virtual-window.js`：暂存未完成的实验性窗口化显示代码，当前不启用。
- `judgement-asr-diff-view.js`：维护 ASR 文本对齐差异视图、差异摘要、对齐算法和高亮颜色。
- `judgement-thunder-question.js`：维护雷题库 CSV 读取、题卡匹配、特殊情况标注提示和标准答案不一致告警。
- `judgement-compact-card.js`：维护轻量题卡摘要，在 `.labelRender-item` 根节点内部补充 ASR 文本、音频时间比和当前判别状态，并支持配合隐藏内容区 / 回答区和卡片宽度调整使用。
- `judgement-ai-suggestion.js`：维护 AI 建议请求、当前题定位、建议卡片渲染、雷题优先提示和“采用建议”动作调用。
- `asr-judgement-server.js`：维护扩展侧统计数据采集、首页 / 详情页手动上传、定时上传和基于上传接口的远程时间配置读取。
- `platform-resources/backend/`：维护统一 Node 后端启动入口、基础路由、响应工具和项目 API 注册。
- `platform-resources/alibaba-labelx/asr-judgement/backend/`：维护快判项目的 Node 本地调试接收服务，`index.js` 负责注册项目 API，`routes.js` 处理 HTTP 路由，其余小文件分别处理 CSV 列、CSV 读写、文件存储和分包合并。
- `judgement-auto-advance.js`：维护选择判别结果后的当前页自动下一题。
- `audio-controller.js`：只保留音频扫描、配置、状态和动作路由。
- `audio-volume-controller.js`：维护音量与 Web Audio gain 逻辑。
- `audio-rate-controller.js`：维护倍速、倍速显示和重置逻辑。
- `audio-playback-controller.js`：维护播放、暂停、自动播放和相邻音频播放。
- `page-world/network-*.js`：运行在 MAIN world，负责 data 请求改写、响应摘要和 `postMessage`。

后续继续拆分时，优先保持 `content.js` 作为入口编排层，不要把具体 DOM 操作重新塞回入口。

新增快判 JS 时应直接放入 `asr-judgement/`，并同步更新 `manifest.json` 或相应动态加载入口。不要复制 `asr-transcription/settings-panel.js` 给快判；快判保持独立简化设置页。

## 加载顺序要求

快判依赖 `manifest.json` 的数组顺序加载，不使用打包器或 ES module：

- MAIN world：`network-protocol.js`、`network-config.js`、`network-url-rewriter.js`、`network-summary.js`、`network-observer.js`。
- ISOLATED world：`page-detector.js`、音频小模块、`audio-controller.js`、分页/总时长模块、暂存窗口化模块、ASR 差异视图、雷题判断、轻量题卡摘要、统计上传、自动下一题、判别/提示/快捷键/工具栏模块、`content.js`。

调整文件名或新增模块时，必须同步更新 `manifest.json` 并验证脚本路径存在。

## 公共目录策略

当前不创建公共目录。只有当快判和转写确实复用同一能力，并且 README 中记录了复用点、调用方和验证步骤后，才考虑抽取公共代码。

## 中文乱码修正（CSV 健康值合并）

- 统计 CSV 写入统一为 **UTF-8 with BOM**，提升 Excel 直接打开时的中文兼容性。
- CSV 写出前会清理关键字段（任务名称、标注员/审核员、供应商）的前后空白、BOM、零宽字符。
- 若旧 CSV 中存在 `�`（U+FFFD）损坏值，合并时优先采用新 payload 的健康值覆盖旧损坏值。
- 当 `供应商` 为 `未识别供应商`、`unknown-supplier`、空值或包含 `�` 时，必须回退到任务名称重新推断。
- LabelX 转写已知供应商仍按任务名优先识别：包含 `棋燊` -> `棋燊`，包含 `希尔贝壳` -> `希尔贝壳`。
- 主存储继续保持根级总表：`statistics-data/statistics-merged.csv`。
- 不主动生成 `statistics-data/suppliers/`，历史残留目录不作为主输出。
- 转写与快判后端都使用同一套“中文清洗 + 健康值优先”策略。
- 日志与错误信息继续脱敏，不记录 cookie、token、authorization、完整音频 URL。

## 导出完整性与断点跳过增强

- 统计以 `分包ID` 作为关键定位点：分包ID 为空的数据直接废弃，不写入 CSV、不上传。
- 后端新增 existing 检查接口（转写/快判）：
  - `POST /api/alibaba-labelx/asr-transcription/statistics/existing`
  - `POST /api/alibaba-labelx/asr-judgement/statistics/existing`
- 导出前先检查已有根级总表 `statistics-data/statistics-merged.csv`：
  - `complete=true` 的分包数据直接跳过详情拉取。
  - `complete=false` 或不存在的数据继续拉取详情并重试。
- existing 检查失败时回退全量拉取，不阻断导出流程。
- 失败数据定义调整为：分包ID为空（废弃/拒绝）、详情请求失败、JSON解析失败、上传请求失败等真正失败；字段空白默认记为 warning/incomplete，不计入 failed。
- 结束时若存在失败数据，提示：`有数据导出失败，请再次点击导出`。
- 再次点击导出时会优先跳过已完整数据，重点补失败/不完整数据。
- 动态并发规则统一为：`Math.floor(total / 5)`，最小 `1`，最大 `999`。
- 转写与快判进度条都展示：阶段、完成/总数、并发、成功、失败，并支持 skipped/discarded 摘要。
- 定时上传时间统一：每天 `10:00`、`16:00`。
- 定时上传到服务器前新增随机延迟：`0~300` 秒、`100ms` 步进；手动上传不延迟。
- CSV 主存储继续为根级总表：`statistics-data/statistics-merged.csv`；不主动生成 `statistics-data/suppliers/`。
- CSV 继续使用 UTF-8 with BOM，单供应商不输出“供应商”列，多供应商在最后一列输出“供应商”。
- 全流程继续脱敏：不记录 cookie、token、authorization、完整音频 URL。

## 失败判定修正
- LabelX 统计按标注/审核分角色逐步合并：另一角色字段为空属于正常情况，不再判失败。
- 只有 `分包ID` 为空时才直接废弃（discardedNoBatchId），不写 CSV、不上传。
- `任务名称/任务ID/人员/领取时间/提交时间/有效时长` 为空默认记为 warning/incomplete，不阻断上传。
- 批量上传改为“部分失败不影响成功数据保存”，后端返回 `acceptedCount/rejectedCount/rejectedItems`。
- 结束提示规则：仅当 `failed > 0` 才提示“有数据导出失败，请再次点击导出”；仅 warning 时提示“部分字段待后续角色补齐”。
- existing `complete` 按当前 role 最小条件判断：转写 `label=标注子任务ID`、`audit=审核子任务ID`；快判 `label=任一标注员子任务ID`、`audit=审核子任务ID`。
- 统计主存储继续为根级 `statistics-data/statistics-merged.csv`，不主动创建 `statistics-data/suppliers/`。
- 并发规则保持 `Math.floor(total / 5)`，最小 `1`，最大 `999`；定时上传保持 `10:00/16:00`，上传前随机延迟 `0~300s`（`100ms` 步进）。

## complete/跳过修正
- `existing` 接口中 `exists=true` 不等于 `complete=true`；只有满足最低完整条件才可跳过。
- 转写 `complete` 最低要求：`分包ID + 任务名称 + 任务ID + 题数 + 当前 role 对应子任务ID`。
- 快判 `complete` 最低要求：`分包ID + 任务名称 + 任务ID + 题数 + 当前 role 对应子任务ID（label 为任一标注员槽位ID）`。
- 任务名称为空不算失败，但必须判为 `complete=false`，下次导出继续拉详情补齐。
- `exists=true && complete=false` 必须继续拉详情与上传，不计入 `skippedComplete`。
- 无待上传数据（`payloads.length=0`）时不调用 `/statistics/upload`，提示“已全部完整，无需上传”。
- 上传进度板块宽度已增大（`min-width:560px`、`max-width:780px`、允许换行），四位数成功/失败数量可见。
- 主存储仍为根级 `statistics-data/statistics-merged.csv`，不主动生成 `statistics-data/suppliers/`。

## 进度样式同步

- 快判继续使用共享进度组件，样式与转写同步为水平居中紧凑卡片。
- 完成态不再切换为大块面板，关键数字（成功/失败）保持可见。
- 无待上传 payload 时同样不调用 upload，直接提示“已全部完整，无需上传”。

## 进度悬浮窗样式小修

- 版本保持 `0.2.11`，本轮仅修上传进度显示样式。
- 快判上传进度改为页面顶部居中悬浮窗（fixed），不再挤在平台顶部导航内部。
- 进行中/完成/失败统一为同一紧凑卡片布局，完成态不再出现横向绿色长条。
- 快判上传按钮不再写入长 `title` 文案，悬停不再出现黑色长 tooltip。
- 与转写保持同一 `shared/progress-indicator.js` 共享样式实现。
## 快判统计取消跳过上传

- 手动点击首页“上传统计”时，仍先走 existing 检查，`complete=true` 的分包默认跳过。
- existing 命中单键冲突时，当前会记为“冲突跳过”，不会继续上传，也不会触发 force replace。
- 如果本轮存在 `skippedCompleteCount > 0`，上传完成后会在首页顶部按钮旁显示“补传并覆盖当前人员”。
- 点击按钮后会使用 `reason=home-manual-force-replace` 重新拉取本轮全部快判详情，并携带 `forceReplaceByBatchId=true`、`replaceMode="batch"`、`replaceBatchIds` 上传。
- 后端仍以 `分包ID` 归并行，但 force replace 只会覆盖当前标注员槽位或当前审核列，不会删除同分包的其他标注员列。
- 定时上传不会显示该按钮，也不会自动触发强制替换。
- 详情页第一版不默认显示 force replace 按钮，避免详情页只拿到单角色时误判当前人员覆盖范围。

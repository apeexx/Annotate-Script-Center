# 阿里 ASR 转写（轻量工具栏版）

## 当前状态

- 当前以轻量工具栏版、根级总表统计链路和人工确认式 AI 推荐为准。
- `asr-transcription` 已删除旧版独立大表单与页面内 overlay 设置面板。
- 已恢复转写轻量设置面板与快捷键运行时（仅覆盖当前保留功能）。
- 当前保留转写详情页工具栏按钮能力，并允许通过 options 调整基础参数。
- 工具栏已改为页面内注入结构：优先挂载 `.mark-toolbox`，其次挂到首条题卡上方，不再默认固定悬浮在页面顶部中央。
- 转写音频基础能力已切换到 `extension/sites/alibaba-labelx/shared/audio-controller-core.js` 复用实现；转写 `audio-controller.js` 仅保留薄封装。
- 新增转写统计导出能力：支持手动上传与定时上传，后端内部按“供应商 + 分包ID”合并 CSV，主写入根级总表。
- 转写统计上传地址不再在脚本详情页单独配置，统一由 options 首页顶部“后端接口地址”（`server/local`）控制。
- 转写统计上传与定时上传为脚本默认能力，运行时强制启用；转写详情页不提供统计开关。
- 新增“当前题 AI 推荐”第一版：点击后只分析当前题，结果显示在当前题卡片内；必须人工点击“填入推荐文本”才会写入文本框。

## 保留能力（仅当前题 / 当前音频）

- 当前题：
  - 快速填入
  - 标有效 / 标无效
  - 去空格
  - 数字转换
  - 焦点切换
  - AI 推荐当前题（仅供参考）
  - 填入 AI 推荐（手动触发）
- 当前音频：
  - 播放 / 暂停
  - 前进 / 后退
  - 倍速提高 / 降低 / 重置
  - 音量提高 / 降低 / 重置
  - 复制时长

## 默认值与可配置项

- 默认值基于 `shared/constants.js -> DEFAULT_ASR_CONFIG`，运行时会从 `chrome.storage` 读取并覆盖。
- options 转写轻量设置面板可配置：
  - 自动播放 `autoPlay`
  - 默认倍速 `playbackRateValue` / 重置倍速 `resetRateValue`
  - 倍速步进 `rateStepValue`
  - 前进/后退步长 `seekStepSeconds`
  - 默认音量 `volumeValue`
  - 当前题行为 `defaultValid/fillOnValid/clearOnInvalid`
  - 当前保留功能快捷键（含“上传转写统计”“AI 推荐当前题”“填入 AI 推荐”“提交任务”“提交任务并结束”）
- 转写 AI 模型/Prompt/参数配置已接入通用隐藏部件“ASR 语音 AI 设置”：默认隐藏，在转写脚本详情页标题连续点击 10 次后显示，仅影响转写脚本。
- 解锁后会请求 `GET /api/alibaba-labelx/asr-transcription/ai/defaults` 拉取后端默认模型、Prompt 与参数，并在面板显示有效配置。
- Prompt/参数采用脚本级 override：输入为空或恢复默认即不保存 override，请求时由后端默认配置生效。
- `response_format` 不对前端开放，转写结构化输出由后端固定控制。
- thinking 开关采用显式传参：关闭传 `enable_thinking=false`，开启传 `enable_thinking=true`；若模型不支持仅移除参数重试一次。
- 统计上传与定时上传不在 options 转写详情页配置；运行时始终启用。
- 转写默认倍速为 `1.5x`，默认自动播放开启；切题时会先停止旧音频，再按默认倍速 / 音量尝试播放新题音频。

## 注入与页面命中策略

- content script 在 `document_start` 注入后不会一次性失败退出。
- 会在 `DOMContentLoaded`、`window.load`、`MutationObserver`、SPA 路由变化和短轮询下持续重试命中。
- 仅在 `labelx.alibaba-inc.com` 且路径包含 `/corpora/labeling/` 时继续等待转写详情页 DOM。
- 若检测到快判特征（如“哪个ASR更优”），不会启动转写工具栏。
- `PANEL_PING` 始终响应注入状态：
  - 已注入未命中：`injected=true, matched=false`
  - 已命中并运行：`injected=true, matched=true`
  - 真无响应才应视为注入失败
- 扩展在 `chrome://extensions` 重新加载后，旧页面可能出现 `Extension context invalidated`；当前已在 `shared/storage.js` 统一识别，并让转写运行时进入 `extension-context-invalidated` 停机状态（提示刷新页面），不再把它当普通配置错误反复告警。

## 工具栏布局（仿快判结构）

- 分组：`当前题`、`文本`、`音频`、`倍速`、`音量`、`状态`。
- 样式：浅色底、细边框、圆角、分组按钮白底蓝字、状态块浅绿提示。
- 状态块长期显示：启用状态、当前题定位、当前音频状态、最近动作结果。
- 页面 DOM 重绘后会自动重挂载，同一时刻只保留一个工具栏节点。

## AI 推荐第一版（当前题）

- 前端接口：
  - `POST /api/alibaba-labelx/asr-transcription/ai/suggest-current`
  - `GET /api/alibaba-labelx/asr-transcription/ai/suggest-current/health`
- 触发方式：
  - 工具栏按钮：`AI推荐`、`填入AI`
  - 快捷键：`shortcutAiSuggest`、`shortcutApplyAiSuggestion`、`shortcutSubmitTask`、`shortcutSubmitTaskAndFinish`
- 输入范围：
  - 仅当前题，采集当前题可见候选文本、当前 textarea 文本、当前题音频 URL（最多两条）。
- 输出展示：
  - 当前题卡片展示状态、推荐文本、判断、置信度、简短原因、风险提示，以及单行 `预估人民币`；缺少价格源时统一显示 `没有数据源`。
- 行为边界：
  - 不自动填入、不自动保存、不自动提交、不自动领取、不自动流转、不自动跳下一题。
  - 提交类快捷键仅调用 `extension/sites/alibaba-labelx/shared/submit-actions.js` 点击页面系统按钮，不直接调平台 API，不自动确认二次弹窗。
  - “填入推荐文本”只写当前题 textarea，并触发 `input/change` 事件。
  - API Key 只在后端读取，前端不保存。
  - 日志不输出完整音频 URL，只记录摘要信息。

## 明确不做

- 不做时间戳、说话人区分。
- 不做 AI 初稿、AI 校对、AI 格式化、AI 标点。
- 不新增后端保存接口，不构建或注入自定义保存 payload。
- 不强制保存、不点击保存按钮。
- 不自动提交、不自动领取、不自动流转、不自动跳转下一任务。
- 不做整页受控执行与全页批量修改。
- 不提供旧版独立完整大表单和 overlay 设置面板。

## 转写统计导出（新增）

- 页面入口：顶部导航头像附近“上传转写统计”按钮；工具栏“上传统计”按钮也可触发。
- 上传过程中显示进度条：当前阶段、完成数/总数、百分比、并发数、成功/失败数。
- 进度组件由 `shared/progress-indicator.js` 提供，后续快判/标贝易采可复用同一套 UI 与状态字段。
- 上传能力强制启用：`statsUploadEnabled=true`、`statsAutoUploadOnSchedule=true`。
- 默认定时：`10:00`、`16:00`；定时上传在真正 POST 前增加随机延迟 `0~300` 秒（`100ms` 步进），手动上传不延迟；会优先读取上传接口返回的 schedule。
- 平台页面实测详情请求常见 `pageSize=10`；扩展统计上传按全量口径优先使用 `pageSize=5000` 抓取详情。
- 首页与详情都按 `recordCount` 计算总页数，不再固定只抓前 `5` 页、前 `50` 个子任务或前 `300` 条详情。
- 首页列表和详情分页都保留保护阈值；超过阈值会明确告警并截断，不再静默漏数。
- 首页分页和详情抓取都支持并发；详情阶段并发按 `Math.floor(total / 5)` 动态计算（`total` 为当前阶段待处理子任务总数），最小 `1`，最大 `999`（例如 `1854 -> 370`，`8000 -> 999`）。
- 首页会同时抓取 `finished=false` 与 `finished=true` 的 `subTasks`，并按清洗后的 `subTaskId` 去重。
- 单次上传内同一 `subTaskId` 只请求一次详情（按清洗后 ID 去重）。
- 上传锁：上传中重复点击或定时触发会返回 `upload-in-progress` 并跳过，不会并发第二轮上传。
- `subTaskId` 会在请求前清洗：去除普通空格、Tab、换行、回车、全角空格以及 decode 后残留空白。
- 任务识别规则：
  - 排除快判：`labelModel=vote`，或任务名包含 `ASR更优结果判断/ASR更优/更优结果判断/更优判断`。
  - 采集转写：`labelModel=single`，或任务名包含 `中文普通话asr任务/中文普通话asr/asr任务/普通话asr`，或 `size=50`（且未命中快判排除）。
- 上传接口由全局后端模式拼接：
  - `server`：`https://script.xiangtianzhen.store/api/alibaba-labelx/asr-transcription/statistics/upload`
  - `local`：`http://127.0.0.1:3333/api/alibaba-labelx/asr-transcription/statistics/upload`
- 供应商列表接口由全局后端模式拼接：
  - `server`：`https://script.xiangtianzhen.store/api/alibaba-labelx/asr-transcription/statistics/suppliers`
  - `local`：`http://127.0.0.1:3333/api/alibaba-labelx/asr-transcription/statistics/suppliers`
- 下载接口由全局后端模式拼接，默认下载总表（不要求 `supplier`）：
  - `server`：`https://script.xiangtianzhen.store/api/alibaba-labelx/asr-transcription/statistics/download`
  - `local`：`http://127.0.0.1:3333/api/alibaba-labelx/asr-transcription/statistics/download`
- CSV 基础列为：`任务名称,任务ID,标注子任务ID,审核子任务ID,分包ID,题数,有效时长(秒),标注员,审核员,标注领取时间,标注提交时间,审核领取时间,审核提交时间,标注是否完成,审核是否完成`。
- 供应商列动态输出：
  - 单供应商数据集不输出 `供应商` 列。
  - 多供应商数据集在最后一列追加 `供应商`。
- CSV 写出前会清洗字段前后空白（含 BOM、全角空格、Tab、换行、零宽字符），不会再输出 ` 任务名称` 或 ` 未识别供应商` 这类脏值。
- `csvPatch` 只承载基础字段：`任务名称/供应商/任务ID/分包ID/题数/有效时长(秒)`。
- 供应商识别优先级：
  1. `payload.supplier.name`
  2. `payload.vendor.name`
  3. `payload.supplier`
  4. `payload.vendor`
  5. `csvPatch["供应商"]`
  6. `taskName/name` 推断（已知：`棋燊`、`希尔贝壳`）
  7. `未识别供应商`
- 任务名识别前会先做规范化：`decodeURIComponent`（失败则回退原文）+ 去除前后空白（含普通空格、Tab、换行、回车、全角空格）+ 连续空白规整。
- 转写供应商命中优先规则：任务名包含 `希尔贝壳` -> `希尔贝壳`；包含 `棋燊` -> `棋燊`；都未命中再走前缀推断。
- 识别前会先做任务名规范化：`decodeURIComponent` 容错、去除 `BOM`、清理前后空白与全角空格，并生成去空白匹配串，兼容任务名前导空格/全角空格场景。
- 当 `csvPatch["供应商"]` 为 `未识别供应商` / `unknown-supplier` / 空值时，不再直接沿用，必须回退任务名重新识别供应商。
- 示例：
  - ` 希尔贝壳-中文普通话asr任务-线上回流3rd-13` => `希尔贝壳`
  - ` 棋燊-中文普通话asr-线上回流2nd-45` => `棋燊`
- 统计主落盘路径：`statistics-data/statistics-merged.csv`。
- 不再主动创建 `statistics-data/suppliers/`；该目录若本地已存在，属于旧方案残留，可忽略或手动清理。新写入主路径为根级总表。
- 有效时长统计只累计“是否有效”严格等于“有效”的题目 `duration`；不使用 `includes("有效")`，避免“无效”误算。
- 标注员/审核员解析新增 `dataResultHistory` 兜底：优先 `type===0`，找不到时使用最后一条。
- `legacy-reference/asr-script.user.js` 仅作为分页、并发、有效时长与 `dataResultHistory` 解析逻辑参考，不恢复 Tampermonkey 架构。
- 标注/审核字段只允许由 `roleRecord` 按 `role` 写入；`role=label` 仅写标注字段，`role=audit` 仅写审核字段。
- 后端会忽略 `csvPatch` 里误传的角色字段；`role` 缺失或非法会拒绝写入，避免污染 CSV。
- 统计导出只采集和上传统计数据，不保存平台、不提交平台、不自动流转平台任务。
- 统计日志和提示不输出 cookie、token、完整音频 URL、完整签名 URL。

## 文件职责

- `content.js`：页面命中重试、运行时编排、工具栏、popup ping 响应。
- `runtime-config.js`：脚本中心启用状态读取 + 转写轻量设置规范化（含快捷键与统计配置）。
- `active-item.js`：当前题与当前音频定位（含“首个可见题卡”兜底）。
- `item-actions.js`：当前题文本与有效/无效动作。
- `audio-controller.js`：当前音频控制与时长复制。
- `text-utils.js`：去空格、轻量数字转换。
- `transcription-stats-client.js`：浏览器端转写统计上传客户端，仅负责统计采集、手动/定时上传、按钮状态回传。
- `shortcut-bus.js`：转写快捷键运行时，仅映射当前保留动作，普通输入不误拦截。
- `platform-resources/alibaba-labelx/asr-transcription/backend/`：Node 后端服务目录，负责路由、分包合并、CSV 落盘与下载。

## 真实浏览器验证步骤

1. 在 Chrome / Edge 重新加载 `extension/`。
2. 打开普通 LabelX 页面，确认 popup 不误报“注入失败”，应显示“已注入，等待转写详情页”或同义状态。
3. 打开 LabelX 转写详情页并等待题目 DOM 出现，确认工具栏自动出现。
4. 确认工具栏没有“设置”按钮。
5. 验证所有保留按钮动作。
6. 打开 options 转写详情页，确认仅保留轻量设置面板，不出现独立后端地址下拉框。
7. 切换到 `asr-judgement` 页面，确认不出现转写工具栏，快判功能不受影响。
8. 在当前题点击 `AI推荐`，确认只请求 `POST /api/alibaba-labelx/asr-transcription/ai/suggest-current`。
9. AI 卡片出现后点击“填入推荐文本”，确认只修改当前题 textarea，且不自动保存/提交/跳题。
10. 未配置 `DASHSCOPE_API_KEY` 时，确认提示“后端未读取到 DASHSCOPE_API_KEY”。
11. 检查浏览器控制台与后端日志：不出现完整音频 URL、cookie、token、authorization、API Key。

## 后续约束

- 若未来恢复已删能力，必须走“新需求 + 新设计 + 新验收”，不能直接恢复旧脚本。

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

## 待补任务名称与进度样式修正

- `existing` 中 `exists=true` 不等于 `complete=true`；任务名称为空时需继续补齐，不可误跳过。
- 任务名称补齐链路改为健康值优先：`detail.taskName/name -> summary.taskName/name -> taskMap.taskName/name`。
- `detail` 空任务名称不得覆盖 `summary/taskMap` 健康任务名称。
- 分包 `15982950` 这类“旧行任务名称为空”场景，上传后会复用旧行并补齐任务名称与供应商。
- 进度条水平居中，完成态与进行中保持同一紧凑样式；四位数成功/失败统计可见。
- 无待上传数据时不调用 upload，显示“已全部完整，无需上传”。

## 进度悬浮窗样式小修

- 版本保持 `0.2.11`，本轮仅修前端进度展示样式。
- 上传进度组件改为页面顶部居中悬浮窗（fixed），不再嵌在平台顶部导航容器内。
- 进行中、成功、失败、警告都保持同一紧凑卡片布局，完成态不再出现横向绿色铺满条。
- 上传按钮不再写入长 `title` 文案，鼠标悬停不再出现黑色长 tooltip。
- 转写与快判继续共用 `shared/progress-indicator.js` 样式实现。
## 转写统计取消跳过上传

- 手动点击首页“上传转写统计”时，仍先检查后端 existing 状态，完整分包默认跳过。
- 普通手动上传完成后，如果本轮有 `skippedCompleteCount > 0`，会显示“补传并覆盖当前人员”按钮。
- 点击后使用 `reason=home-manual-force-replace` 重新拉取本轮全部转写详情，并携带 `forceReplaceByBatchId=true`、`replaceMode="batch"`、`replaceBatchIds` 上传。
- 后端仍以 `分包ID` 归并行，但 force replace 只会局部覆盖当前 `label / audit` 角色列，不会删除同分包其他人员或其他角色已存在的列数据。
- 定时上传不会出现这个按钮，也不会进入 force replace 模式。
- 详情页第一版不默认支持 force replace，避免详情页只拿到单角色时误判当前人员覆盖范围。

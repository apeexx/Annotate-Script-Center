# 闽南语助手 AI 推荐文本

- 修复 `roundOneCollect` 页面右侧 `闽南语助手推荐文本` 工具卡在 DOM 尚未渲染完成时输出 `AI panel mount target not found` 的问题。
- 右侧工具卡找不到挂载点时不再作为扩展错误上报；当前只会输出一次 `console.debug`，并在后续 DOM 变更与 `300ms` 轻量延迟中继续重试挂载。
- `findMountTarget` 现在优先定位“本句话文本”区域，再回退到右侧波形区附近容器，不会乱挂到 `body` 或左侧句子列表。
- `clearResult` 只清结果，不删除工具卡根节点；离开页面、脚本停用或 runtime 停止时才由 `remove` 清理节点。
- 左侧 `AI连续填入合格项` 按钮与右侧工具卡挂载继续独立；扩展重载后仍建议刷新 DataBaker 业务页面，避免旧 content script 残留。
- 修复 `roundOneCollect` 右侧 `闽南语助手推荐文本` 工具卡在正文区域未挂载/误隐藏的问题。
- 右侧工具卡与左侧 `AI连续填入合格项` 按钮是两个独立入口；即使 `filter-screen` 不可用，右侧工具卡也应单独显示。
- 扩展重载后需要刷新 DataBaker 业务页面，再验证右侧工具卡和批量按钮。

本目录是 标贝易采 质检站点的扩展运行时代码，目标页面为：

- 首页：`https://datafactory.data-baker.com/v2/#/quality/roundOne`
- 详情页：`https://datafactory.data-baker.com/v2/#/quality/roundOneCollect?collectId=...&checkType=0`
- 任务组详情页：`https://datafactory.data-baker.com/v2/#/group/detail?taskId=...`

这是独立新增站点，不属于 Alibaba LabelX，也不复用 `extension/sites/alibaba-labelx/asr-judgement/` 或 `extension/sites/alibaba-labelx/asr-transcription/` 的业务代码。

## 当前能力

- 仅在 `roundOneCollect` 详情页注入小工具卡。
- 已接入扩展 options “标注脚本中心”，在 `标贝易采` 平台区域提供脚本启停和专属设置页。
- 只处理左侧当前选中的单条句子。
- 工具卡提供“AI 推荐文本”按钮，由用户手动点击触发。
- 左侧句子列表上方 `filter-screen` 新增“AI连续填入合格项”按钮（位于“批量判定”按钮右侧；挂载失败时回退到 AI 面板内）。
- 点击该按钮会先刷新当前页列表，再筛选当前页全部 `statusName=质检合格`（或 DOM 显示“一检合格”）条目。
- 处理策略为“请求窗口灌满 + 顺序消费”：启动后会先按当前并发上限尽快发出首批 AI 请求；结果返回后进入缓冲区，填入流程按 AI 返回顺序逐条消费。某条 AI 一旦完成，就立即释放 1 个前端请求槽位并补发下一条，不等待当前填入 / 保存阶段结束，支持运行中手动停止。
- AI连续填入合格项并发数量已迁到共享的“AI 设置”区域，并按模型动态归一：
  - Omni：默认 `5`，范围 `1~25`
  - Fun-ASR：默认 `5`，范围 `1~50`
- 当前 DataBaker Qwen Omni 默认按前端并发创建 jobs，前端固定按不低于 `50ms` 错峰发起；Fun-ASR REST 仍继续走自己的后端并发保护。
- 当识别模式为 `two_stage` 且听音模型为 `fun-asr` 时，批量连续填入默认短请求创建 `POST /ai/recommend/jobs`，再轮询 `GET /jobs/:jobId`；当前页有 N 条合格项，就会调度 N 条任务，前端按 `50ms` 错峰发起，并由前端活跃并发上限与后端 provider queue / RPM 限流共同保护链路。
- 异步 job 默认最大保留数量 `600`，provider queue 默认最大排队数 `600`。
- 单条 AI / 模型请求默认超时 `60000ms`；若仍未返回，失败列表固定提示“当前任务超过60s，请重新请求。”，且迟到结果不会再进入待填队列。
- 批量失败列表现在统一显示“查看原始AI返回”按钮；支持 `qwen-empty-response`、`model-json-parse-failed`、`provider-http-error`、`fun-asr-auth-error`、`fun-asr-audio-url-unreachable`、`fun-asr-task-failed` 等失败直接查看脱敏后的 debug JSON。
- 点击“查看原始AI返回”后会弹出文本悬浮窗，标题为“原始 AI 返回”，并在 textarea 中展示 `JSON.stringify(debug, null, 2)`。
- 若 Qwen Omni SSE 返回 `data: {"error":{"code":"limit_burst_rate"...}}`，前端失败文案会明确显示“Qwen 请求突增限流，接口返回请求增长过快，可降低并发或稍后重试。”，不再误报为“Qwen 接口未返回有效文本”。
- 悬浮窗内提供“复制”与“关闭”按钮；若剪贴板不可用，仍可手动选择 textarea 内容复制。
- 新增顶部统计悬浮窗，运行中展示 AI 返回、待填队列、填入成功/失败/跳过和失败条目。
- 顶部悬浮窗还会显示 `后端任务已提交 / 运行中 / 成功 / 失败`，方便区分是前端没发起并发，还是后端 Fun-ASR / compare 仍在排队。
- 顶部悬浮窗会显示当前 AI 链路、当前 AI 模型、并发规则、前端并发、发送间隔和执行耗时。
- 执行耗时从点击“AI连续填入合格项”开始计时，运行中每秒刷新；完成、停止或异常结束后会保留最终耗时。
- 并发规则展示只用于前端状态提示，不改变现有模型调用链路、并发策略或后端逻辑：
  - Omni：默认 `5`，范围 `1~25`
  - Fun-ASR：默认 `5`，范围 `1~50`
- 悬浮窗在任务完成或停止后保留约 60 秒，可手动关闭。
- 失败列表提供“重新填写失败内容”按钮，仅重试已有推荐文本的填入失败项，不会重新请求 AI。
- 点击后读取当前题的 `audioUrl`、页面候选文本、句子编号、朗读要求、有效时间和音频时长，再调用“全局后端接口地址 + 固定 API path”。
- 结果卡展示页面候选文本、AI 听音文本、AI 推荐文本、是否相对页面文本变更、置信度、模型、流水线模式、阶段耗时、决策和复核提示。
- 人民币估算当前直接显示在结果卡：`omni_single` 只显示一行 `预估人民币`；双阶段链路显示 `听音预估人民币 / 对比预估人民币 / 总预估人民币`；缺少价格源时显示 `没有数据源`。
- 结果卡当前新增 `词表状态与模式`：固定显示 `主词表状态 / 固定携带 / 改写模式`，用于区分 `ready / reference_only / missing / invalid` 与当前 `aggressive / off` 改写口径。
- 结果卡提供“复制推荐文本”“填入推荐文本”“忽略”。
- “填入推荐文本”只在用户点击后触发，只写入页面的“本句话文本”输入框，不自动保存、不自动提交、不自动点击合格 / 不合格。
- “AI连续填入合格项”会跳过 `质检不合格`、`未质检` 和状态未知条目，不点击 checkbox，不自动保存、不自动提交、不做自动流转。
- AI 听音文本、AI 推荐文本展示和填入前会自动删除普通空格、全角空格、Tab 和换行；页面候选文本保持平台原文。
- AI 推荐文本展示和填入前会自动补全中文句末标点；英文句末 `.?!;` 会转为 `。？！；`，无句末标点时默认补 `。`。
- `group/detail` 页面新增“导出数据总表”按钮，通过 MAIN world 拦截页面原生 `queryByCondition` 响应，按分页控件逐页合并导出全量 CSV（含 BOM）。
- 导出完成后会自动上传 CSV 到统一后端保存，同时保留浏览器本地下载；上传失败不影响本地下载。
- 后端上传保存为累计合并逻辑：`latest.csv` 不再覆盖，按“文本编号”合并（任务ID仅作元信息，不参与唯一键）。
- 支持自动每页条数，默认进入详情页后尝试设置为 `50条/页`，只点击页面原生分页控件。
- 支持 标贝易采 专属快捷键配置，默认全部未设置；快捷键只处理当前题或当前推荐卡。
- 新增快捷键：`Alt+Q` 触发“AI并发分析并连续填入合格项”（运行中再次触发为停止）。

## 文件职责

```text
round-one-quality/
  content.js
  data-api.js
  ai-recommendation.js
  ui-panel.js
  page-size-controller.js
  shortcuts.js
  group-export.js
  page-world/
    network-observer.js
```

- `content.js`：入口编排，判断当前页面是否 `roundOneCollect`，初始化数据 API、AI 推荐和 UI 面板。
- `data-api.js`：解析 `collectId/checkType`，监听 MAIN world 缓存的列表接口响应，定位当前选中题并生成后端请求数据。
- `ai-recommendation.js`：默认负责 `POST /api/data-baker/round-one-quality/ai/recommend/jobs` + 轮询 `GET /jobs/:jobId`；同步 recommend 仅在共享 jobs client 缺失时作为兼容回退，请求体只传必要字段。
- `ui-panel.js`：注入按钮和推荐结果卡，支持复制和用户点击后填入推荐文本。
- `page-size-controller.js`：在详情页有限重试点击分页大小选择器，按设置切换到目标每页条数。
- `shortcuts.js`：监听 标贝易采 专属快捷键；先匹配已配置快捷键再处理输入焦点，普通输入不拦截。旧的被动焦点恢复已移除；脚本通过检测“本句话文本”变化，在平台自动切题后短暂 focus/blur 文本框恢复快捷键焦点。
- `group-export.js`：仅在 `group/detail?taskId=...` 页面注入“导出数据总表”按钮；切换分页大小时会先点击 `.el-pagination__sizes .el-select` 内的 `.el-input.el-input--mini.el-input--suffix`，等待下拉出现后选择 `100条/页`，再通过跳页控件逐页触发平台原生查询并等待 MAIN world 的 `queryByCondition` 响应消息后合并下载 CSV；导出后自动 `POST /api/data-baker/round-one-quality/export/upload` 上传 CSV。
- `page-world/network-observer.js`：运行在 MAIN world，观察 `queryCollectStatementByCondtion`（一检详情页）和 `queryByCondition`（group/detail）响应并以内存消息通知 ISOLATED world。

## options 设置

`闽南语助手` 在 options 首页默认启用，方便上线验证；用户可在卡片中关闭脚本。专属设置页支持：

- AI 推荐相关设置已迁移到通用隐藏部件“ASR 语音 AI 设置”（标题连续点击 10 次显示），普通设置区不再直接展示 AI 开关/超时字段。
- 在“ASR 语音 AI 设置”中可配置启用 / 关闭 AI 推荐文本；关闭后页面不显示 AI 推荐工具卡，也不会触发推荐请求。
- “ASR 语音 AI 设置”解锁后会请求 `GET /api/data-baker/round-one-quality/ai/recommend/defaults`，默认展示后端当前模型、Prompt 与生成参数，而不是空白输入框。
- 标贝易采前端会显示“识别模式”字段：
  - `two_stage`：显示“听音模型 + 比较模型”
  - `omni_single`：只显示“AI 模型”
- 双模型听音模型只允许：`fun-asr`、`qwen3.5-omni-plus`、`qwen3.5-omni-flash`、`qwen3.5-omni-flash-2026-03-15`、`qwen3-omni-flash`、`qwen3-omni-flash-2025-12-01`、`qwen3-omni-flash-2025-09-15`。
- 单模型 AI 模型只允许：`qwen3.5-omni-plus`、`qwen3.5-omni-flash`、`qwen3.5-omni-flash-2026-03-15`、`qwen3-omni-flash`、`qwen3-omni-flash-2025-12-01`、`qwen3-omni-flash-2025-09-15`，默认 `qwen3.5-omni-flash`。
- 双模型比较模型只允许以下 4 个选项：`qwen3.6-plus`、`qwen3.5-plus`、`qwen3.6-flash`、`qwen3.5-flash`，默认 `qwen3.5-plus`；旧配置若不在这 4 个中，会迁移为 `qwen3.5-plus`。
- 选择 `fun-asr` 时，设置页会显示 Python SDK / `.venv` 提示；当前默认 provider 已改为 Node REST，Python 仅作为 fallback / 调试方案保留。选择 Qwen Omni 模型时隐藏该提示。
- Prompt 与参数按 override 保存：字段清空或恢复默认时不保存 override，请求时由后端默认值生效；只有与默认不同的值才随请求透传。
- 不支持参数前端不显示，后端二次白名单过滤；`response_format` 不对前端开放。
- 后端接口地址由 options 首页顶部“后端接口地址”统一控制：
  - `server`：`https://script.xiangtianzhen.store/api/data-baker/round-one-quality/ai/recommend`
  - `local`：`http://127.0.0.1:3333/api/data-baker/round-one-quality/ai/recommend`
- 在“ASR 语音 AI 设置”中配置前端请求超时时间，页面以秒展示，默认 `60` 秒；扩展内部仍按毫秒存储到 `aiRecommendRequestTimeoutMs`。
- 启用 / 关闭自动每页条数，默认启用，默认目标为 `50条/页`，可选 `5条/页`、`10条/页`、`20条/页`、`50条/页`、`100条/页`。
- AI连续填入合格项并发数量已经归到共享“AI 设置”区域：
  - Omni：默认 `5`，范围 `1~25`
  - Fun-ASR：默认 `5`，范围 `1~50`
- 前端和后端都会对超范围值做归一；这里的“前端并发”表示浏览器同时维持多少个在途 AI 请求窗口，AI 一旦返回就会补发下一条，不是“等保存完成后才补位”的节流器。DataBaker Qwen Omni 当前默认按前端并发直接请求，后端不再对 Omni legacy 上游做平滑排队；Fun-ASR REST 不在本次调整范围。
- 运行中顶部悬浮窗会显示：`前端并发`、`已发起AI请求`、`前端活跃AI请求`、`AI已返回`、`待填队列`，以及实时累计的 `批量输入Token / 批量输出Token / 批量总Token / 批量预估人民币`，用于区分是前端没发起并发、后端排队，还是本轮 AI 消耗已经累积到什么程度。
- 悬浮窗中的 `前端并发` 会显示实际归一后的值；若当前是 `two_stage + fun-asr`，请求体还会附带 `frontConcurrency / batchConcurrency / concurrencyModelType` 诊断字段，便于后端排查。
- 配置快捷键，默认全部未设置。支持动作：AI 推荐文本、复制 AI 听音文本、复制 AI 推荐文本、填入推荐文本、忽略 AI 推荐结果、句子判定合格 / 不合格、任务判定通过 / 部分驳回 / 全部驳回。
- 普通输入不会被快捷键拦截；如果焦点停留在“本句话文本”输入框，只有按下已配置快捷键时才会自动 blur 输入框并执行动作。
- 点击左侧 `.sentence-list .sentence-item` 切换题目、点击平台动作按钮、或平台自动切换 `.sentence-list .sentence-item.active` 后，脚本不再做被动 blur/focus，避免干扰音频区域加载。
- 当检测到“本句话文本”变化且用户不在手动编辑时，脚本会短暂进入文本框再退出，以恢复快捷键焦点；普通输入与平台切题流程保持原生行为，不绕过 disabled。
- “填入推荐文本”成功后会立即并延迟退出“本句话文本”输入框，方便继续使用快捷键；不会自动保存、自动提交或自动判定。

扩展前端只保存超时时间、开关、分页和快捷键设置，不保存 API Key、access token、cookie 或完整 `audioUrl`。模型密钥仍由后端通过 `config/env/ai.env` 读取；脚本详情页不提供 API Key 或独立后端地址输入。
导出上传能力为脚本默认能力，不在详情页提供关闭开关；后端地址继续由 options 首页顶部“后端接口地址”统一控制。

## 页面选择器依据

页面结构资料维护在：

```text
platform-resources/data-baker/round-one-quality/page-structure.md
platform-resources/data-baker/round-one-quality/network.md
```

当前运行时主要依赖：

- 左侧句子列表：`.sentence-list`
- 单条句子：`.sentence-list .sentence-item`
- 当前选中句子：`.sentence-list .sentence-item.active`
- 当前句子标题：`.sentence-list .sentence-item .title`
- 右侧详情容器：`.waver-page`
- “本句话文本”输入框：`.waver-page .text-box textarea.el-textarea__inner`
- 音频 iframe 容器：`#iframeBox iframe#myIframe`
- 时间信息：`.timeform_left_time`
- 分页容器：`.roundOneCollect-el-pagination`

音频真实地址优先来自列表接口字段 `audioUrl`。页面中 `#myIframe` 只是播放器入口，不把 iframe `src` 当成可直接传给 AI 的音频地址。

## 数据来源与安全边界

- 前端不硬编码 `access_token`、cookie、OSS 参数或音频签名。
- MAIN world 网络观察脚本监听同源接口路径 `/cms/tbAudioUserTask/queryCollectStatementByCondtion` 与 `/cms/tbAudioUserTask/queryByCondition`。
- 接口响应只保存在当前页面内存中，不写入 `chrome.storage`、DOM 持久属性、`localStorage` 或文档。
- 扩展前端不直连 DashScope，AI Key 只允许后端读取环境变量 `DASHSCOPE_API_KEY`。
- 前端和后端日志都不输出完整 `audioUrl`、access token、cookie、`OSSAccessKeyId` 或 `Signature`。
- 扩展前端不保存 API Key；`DASHSCOPE_API_KEY` 由后端通过 `config/env/ai.env` 或系统环境变量读取。

## 后端接口

本地后端入口仍是：

```powershell
node platform-resources\backend\server.js
```

接口：

- `GET http://127.0.0.1:3333/api/data-baker/round-one-quality/ai/recommend/health`
- `GET http://127.0.0.1:3333/api/data-baker/round-one-quality/ai/recommend/defaults`
- `POST http://127.0.0.1:3333/api/data-baker/round-one-quality/ai/recommend`
- `POST http://127.0.0.1:3333/api/data-baker/round-one-quality/ai/recommend/jobs`（历史兼容 / 调试）
- `GET http://127.0.0.1:3333/api/data-baker/round-one-quality/ai/recommend/jobs/:jobId`（历史兼容 / 调试）
- `GET http://127.0.0.1:3333/api/data-baker/round-one-quality/export/health`
- `GET http://127.0.0.1:3333/api/data-baker/round-one-quality/export/config`
- `POST http://127.0.0.1:3333/api/data-baker/round-one-quality/export/upload`
- `GET http://127.0.0.1:3333/api/data-baker/round-one-quality/export/download`

扩展默认请求服务器接口：

- `POST https://script.xiangtianzhen.store/api/data-baker/round-one-quality/ai/recommend`
- `POST https://script.xiangtianzhen.store/api/data-baker/round-one-quality/ai/recommend/jobs`（历史兼容 / 调试）
- `GET https://script.xiangtianzhen.store/api/data-baker/round-one-quality/ai/recommend/jobs/:jobId`（历史兼容 / 调试）
- `POST https://script.xiangtianzhen.store/api/data-baker/round-one-quality/export/upload`
- `GET https://script.xiangtianzhen.store/api/data-baker/round-one-quality/export/download`

任务总表导出不再由 content script 直接 `fetch /cms/tbAudioUserTask/queryByCondition`。原因是平台可能对扩展直接请求返回 `code=51000`。当前方案改为触发页面原生分页查询并拦截响应：先展开 Element UI 分页大小下拉并选择 `100条/页`，再逐页触发并合并导出；导出后会自动上传到统一后端保存。CSV 已移除“采集ID”列与“原始JSON”列，保留 UTF-8 BOM；原始记录改为脱敏后单独上传保存。

CSV 字段统一口径：导出中的计费时长字段标题统一为 `有效时长`，值仍取 `effectivePassTotalTime`；历史标题 `有效合格时长` 不再用于新导出。

当前前端保留“识别模式”+模型选择：

- `two_stage`：显示听音模型 `fun-asr / qwen3.5-omni-plus / qwen3.5-omni-flash / qwen3.5-omni-flash-2026-03-15 / qwen3-omni-flash / qwen3-omni-flash-2025-12-01 / qwen3-omni-flash-2025-09-15`，再显示 compare 文本模型 `qwen3.6-plus / qwen3.5-plus / qwen3.6-flash / qwen3.5-flash`
- `omni_single`：只显示 AI 模型 `qwen3.5-omni-plus / qwen3.5-omni-flash / qwen3.5-omni-flash-2026-03-15 / qwen3-omni-flash / qwen3-omni-flash-2025-12-01 / qwen3-omni-flash-2025-09-15`

后端会按识别模式 + 模型自动推导内部链路：

- `two_stage + fun-asr`：默认先由 Node REST Fun-ASR 客户端得到 `heardText`，再调用 compare 模型生成 `recommendedText`
- `two_stage + Qwen Omni`：默认优先走 Omni legacy 快速路径，先通过 Qwen Omni `input_audio` 得到 `heardText`，再调用 compare 模型生成 `recommendedText`
- `omni_single + Qwen Omni`：当 `DATABAKER_AI_OMNI_LEGACY_FAST_PATH=1` 时，也优先切到 Omni legacy 快速路径兜底，以保证基础速度和稳定性
- `two_stage + fun-asr` 的批量连续填入默认先创建 `/jobs` 任务，再轮询 job 状态；同步 `POST /ai/recommend` 只保留兼容回退
- Fun-ASR 没有 thinking 概念；thinking 只影响 Qwen Omni 阶段和 compare 阶段。
- 如果听音模型选择 `fun-asr` 且连续填入看起来像串行，先对照后端 `health.queue.groups.fun_asr.activeCount/maxConcurrent`；若 `activeCount` 能超过 `1`，通常说明前端并发发起正常，瓶颈更可能在 Fun-ASR 上游识别耗时或 compare 阶段排队。

Fun-ASR 默认通过统一后端 REST provider 调用：

```text
platform-resources/backend/ai/providers/funasr-rest.js
platform-resources/backend/ai/providers/funasr.js
```

Python fallback / 调试脚本仍保留在：

```text
platform-resources/backend/ai/python/funasr_client.py
```

后端优先使用以下 Python 解释器：

- `platform-resources/backend/.venv/Scripts/python.exe`
- `platform-resources/backend/.venv/bin/python`
- 或环境变量 `DATABAKER_FUNASR_PYTHON_BIN`

如果显式切到 `DATABAKER_AI_FUN_ASR_PROVIDER=python` 或 `DATABAKER_AI_FUN_ASR_PROVIDER_FALLBACK=python` 且未配置 Python 虚拟环境，前端会显示：

```text
Fun-ASR Python 环境未配置，请在 platform-resources/backend/.venv 创建统一 Python 虚拟环境，并执行 .venv\Scripts\python.exe -m pip install -r ai\python\requirements.txt。
```

- 默认虚拟环境路径已统一为 `platform-resources/backend/.venv`。
- Fun-ASR 默认 provider 为 `rest`，可通过 `DATABAKER_AI_FUN_ASR_PROVIDER=python` 切回 Python fallback。
- Fun-ASR REST 是异步任务模式：先 `POST /services/audio/asr/transcription` 提交，再 `POST /tasks/{task_id}` 轮询；当前只做单条 REST 调用，不启用 batch。
- Fun-ASR 前端错误会优先分类为：鉴权/权限错误、平台音频 URL 不可访问、模型名错误、上游限流、任务失败、转写结果下载失败。
- “查看原始AI返回”弹出的 debug JSON 只保留脱敏后的 `provider / stage / model / providerStatus / providerCode / taskId / taskStatus / responseBody / rawText` 摘要，不包含完整音频 URL、签名 URL、cookie、token、authorization、API Key。
- 服务器部署、Windows/Linux 创建命令、重启与 `403` 排查统一见根目录 `README.md`。
- `platform-resources/backend/ai/python/requirements.txt` 现包含 `opencc-python-reimplemented`；服务器更新后需要重新执行 `pip install -r ai\python\requirements.txt`。
- `fun-asr` 若返回繁体或繁简混合字形，后端会在 Python 返回阶段和 DataBaker 结果组装阶段两次繁转简，并保护 `阮 / 汝 / 伊 / 诶` 等闽南词表建议用字。

后端仍保留 provider/model group 级限流能力，但 DataBaker Qwen Omni legacy 快速路径默认不再做平滑排队，也默认不对 `limit_burst_rate` 自动退避重试；多人并发时若触发 Qwen 上游突发限流，前端会直接显示真实原因并继续保留“查看原始AI返回”入口。`429` 的根因仍是上游模型或账号维度限流，不是 `2 核 2G` 服务器算力问题。多个 RAM 用户或 API Key 若属于同一阿里云主账号，也可能合并计入限流。

后端已接入闽南方言字词表参考资料 CSV：

```text
platform-resources/data-baker/round-one-quality/backend/reference/minnan-lexicon.csv
```

词表既用于听音和对比 prompt 的上下文提示，也会默认以 `aggressive` 模式对最终推荐文本做强替换。强替换后的文本只展示在推荐卡中，仍需用户手动复制或点击“填入推荐文本”，扩展不会自动保存、提交或批量处理。可通过后端环境变量 `DATABAKER_AI_LEXICON_REWRITE_MODE=off` 关闭强替换。词表缺失时功能仍可运行，但“的/诶”“很/真”“喜欢/欢喜”“这位/即个”“他/伊”等易混场景的推荐质量可能下降；更新词表时只替换 CSV 文件即可。

当后端返回 `lexicon.rewriteChanged=true` 时，推荐卡会显示“词表替换：已替换 N 处”，并列出最多 8 个替换项，例如 `他 → 伊`、`喜欢 → 欢喜`、`的 → 诶`。

推荐卡会在后端返回 `timing` 时显示 Fun-ASR/Omni 耗时、compare 耗时和总耗时，并可显示队列、重试、缓存命中信息。Fun-ASR 默认并发由 `DATABAKER_AI_FUN_ASR_CONCURRENCY=2` 控制；如 `2 核 2G` 服务器压力高可继续调低，若资源充足也可手动调高。后续如增加“预生成当前页 AI 推荐”按钮，也必须继续走统一后端排队与缓存链路，不能让前端直连 DashScope。

## 人工验证步骤

1. 重新加载扩展。
2. 打开 options 页面，确认首页出现 `标贝易采` 平台和 `闽南语助手` 卡片。
3. 点击“打开设置”，确认脚本详情页不再提供独立后端地址配置；后端地址由 options 首页顶部统一切换。
4. 确认自动每页条数默认启用且目标为 `50条/页`；快捷键配置区域默认全部未设置。
5. 录制一个快捷键，例如 `Alt+A` 绑定“AI 推荐文本”，保存后刷新 options 页面，确认配置仍存在。
6. 如需本机调试，先在 options 首页顶部把“后端接口地址”切到“本机”，再启动本地后端：`node platform-resources\backend\server.js`。
7. 访问 health 接口，确认返回 `success=true`。
8. 打开 `https://datafactory.data-baker.com/v2/#/quality/roundOneCollect?collectId=...&checkType=0`。
9. 等待列表和右侧题目加载，确认右侧“本句话文本”下方出现 `标贝易采 AI 推荐文本` 工具卡，并观察页面自动尝试切换为 `50条/页`。
10. 点击左侧不同句子，确认旧推荐结果会清空或提示需要重新生成；切换后不点击空白区域直接按已配置快捷键，确认快捷键仍响应。
11. 点击平台“确定”让页面自动切到下一条，不点击屏幕直接按已配置快捷键，确认快捷键仍响应。
12. 点击“AI 推荐文本”或按已绑定快捷键，确认只请求当前选中单条，且请求地址随首页全局后端模式切换。
13. 推荐结果出来后，验证复制 AI 听音文本、复制推荐文本、填入和忽略快捷键只作用于当前推荐卡。
14. 当后端返回带空格的 AI 听音文本或 AI 推荐文本时，确认推荐卡展示、复制和填入后的文本都已去除空白字符；页面候选文本原文不被修改。
15. 验证合格 / 不合格快捷键只点击 `.submit-btn` 中对应按钮；任务判定按钮 disabled 时快捷键不会绕过平台限制。
16. 聚焦“本句话文本”输入框，输入未配置为快捷键的普通字符，确认正常输入且不被拦截。
17. 聚焦“本句话文本”输入框后按已配置快捷键，例如 `Alt+A`，确认输入框先失焦再执行快捷键。
18. 点击“填入推荐文本”，确认只写入“本句话文本”输入框，且输入框会立即和延迟失焦；不会自动保存、提交、合格、不合格或任务判定。
19. 当后端返回的推荐文本没有句末标点时，确认推荐卡和填入后的输入框末尾都有中文句末标点。
20. 填入后不点击页面，直接按快捷键，确认仍可继续响应。
21. 关闭 标贝易采 脚本后刷新详情页，确认工具卡、自动分页和快捷键都停止；只关闭 AI 推荐时不显示工具卡。
22. 打开非 `roundOneCollect` 页面，确认不注入该工具卡。
23. 打开 `group/detail?taskId=...` 页面，确认出现“导出数据总表”按钮；点击后状态应展示“准备导出，正在切换到 100条/页”“正在导出：第 x / y 页”，最终提示“已下载 CSV”，并显示后端上传成功或失败（失败不影响本地下载）。
24. 导出后访问 `http://127.0.0.1:3333/api/data-baker/round-one-quality/export/download`，确认可下载后端保存的最新 CSV。
25. 打开 options 中“ASR 语音 AI 设置”，确认显示“识别模式”下拉。
26. 选择 `two_stage`，确认显示“听音模型”和“比较模型”，且“听音模型”下拉不再出现 `[object Object]`。
27. 确认听音模型下拉包含 `fun-asr`、`qwen3.5-omni-plus`、`qwen3.5-omni-flash`。
28. 确认比较模型下拉包含 `qwen3.6-plus`、`qwen3.5-plus`、`qwen3.6-flash`、`qwen3.5-flash`。
29. 切换到 `omni_single`，确认只显示“AI 模型”，不显示“听音模型”和“比较模型”。
30. 确认 `AI 模型` 下拉只包含 `qwen3.5-omni-plus`、`qwen3.5-omni-flash`，且不出现 `fun-asr`。
31. 切回 `two_stage` 后选择 `fun-asr`，确认界面显示 Python 虚拟环境提示。
32. 切换到 `qwen3.5-omni-plus` 或 `qwen3.5-omni-flash` 后，确认 Python 提示立即隐藏，不需要先保存。
33. 选择 `two_stage + fun-asr` 后点击单条“AI 推荐文本”，确认浏览器仍只请求统一后端接口，后端链路为 Fun-ASR 听音 + compare。
34. 选择 `two_stage + qwen3.5-omni-flash` 或 `two_stage + qwen3.5-omni-plus` 后点击单条“AI 推荐文本”，确认后端链路为 Qwen Omni 听音 + compare。
35. 选择 `omni_single + qwen3.5-omni-flash` 或 `omni_single + qwen3.5-omni-plus` 后点击单条“AI 推荐文本”，确认默认优先走 Omni legacy 快速路径；若 `DATABAKER_AI_OMNI_LEGACY_FAST_PATH=1`，允许切到旧版两阶段链路以恢复速度和稳定性。
36. 点击“AI并发分析并连续填入合格项”，在 `fun-asr` 下确认默认并发为 `5`、范围 `1~50`；切到 Omni 后确认默认并发为 `5`、范围 `1~25`，填入仍保持顺序消费。
37. 如果当前是 `two_stage + fun-asr`，确认 Network 中优先出现大量按 `50ms` 错峰发起的 `POST /ai/recommend/jobs`，随后是对应的 `GET /ai/recommend/jobs/:jobId` 轮询，而不是 50 个长时间挂起的同步 `POST /ai/recommend`。
38. 如果后端触发排队、429 重试或队列满，确认顶部悬浮窗/结果提示会显示“AI 排队 / 限流重试 / AI 分析失败”等友好状态，而不是误导为页面卡死。
39. 默认 REST provider 下，未配置 Python 虚拟环境时 `two_stage + fun-asr` 仍应可用；只有显式切到 `provider=python` 或 `fallback=python` 时才会报清晰环境缺失错误，不应直接展示 provider 原始 JSON。
40. 若 Fun-ASR 返回 `403`，页面提示应说明可能是 DashScope 权限/地域、API Key 权限或平台音频 URL 对服务端不可访问，并建议先切换到 `qwen3.5-omni-flash` 或 `qwen3.5-omni-plus`。
41. 确认页面填入后仍不自动保存、不自动提交、不自动判定、不自动流转。

## 已知限制

- 当前不实现自动保存、自动提交、批量识别、自动流转或自动判定。
- 如果当前页面还没有触发列表接口，运行时会尝试同源读取当前页数据；若浏览器限制导致读取失败，需要刷新详情页或点击左侧句子后再触发。
- 若 15 秒内未捕获到 `queryByCondition` 响应，页面会提示“未捕获到平台 queryByCondition 响应，请点击页面查询按钮后重试。”。
- 如果分页大小下拉无法自动展开或未找到 `100条/页`，页面会提示手动切换到 `100条/页` 后重试；必要时会降级导出当前页并给出明确提示。
- 如果后端未启动或服务器接口未部署最新版本，导出状态会提示“后端上传失败”，但本地下载仍会成功。
- 如果无法安全定位可编辑的“本句话文本”输入框，结果卡仍保留复制入口，但不会强行填入。
- 有效音频裁剪第一版未启用；后端只保留环境变量和代码结构，默认把完整 `audioUrl` 交给听音模型。
- 选择 `fun-asr` 作为听音模型时，真实可用性还取决于 Fun-ASR 服务是否能访问平台 `audioUrl`；若服务端无法访问签名音频地址，后端会返回明确错误，但不会在日志或响应中泄露完整 URL。
- 如果 Fun-ASR 返回 `403`，常见原因包括：
  - DashScope 权限或地域未开通
  - API Key 对 `fun-asr` 无权限
  - 平台签名 `audioUrl` 对 Fun-ASR 服务不可访问
  - 调用参数错误
  临时恢复使用时，优先切换到 `qwen3.5-omni-plus` 或 `qwen3.5-omni-flash`。

## 导出 CSV 字段命名修复

- DataBaker 分组导出的人员字段改为 `质检人_P`。
- 参与有效合格时长统计的字段改为 `有效合格时长_S`。
- `采集人`、`有效总时长`、`有效不合格时长` 保持原口径，不追加 `_P` / `_S`。
- `_S` 表示参与时长统计 / 结算的字段，`_P` 表示人员字段。

## 批量连续填入 tasks 作用域热修

- 修复 `AI并发分析并连续填入合格项` 中 `tasks is not defined` 的前端运行时错误。
- 根因是批量悬浮窗摘要函数在 `tasks` 作用域外直接读取 `tasks.length`；现在改为只使用 `plannedSendCount / totalCount` 等安全摘要字段。
- 批量流程仍保持：短请求创建 jobs、`50ms` 错峰；前端并发按模型动态归一，Omni 默认 `15` / `1~25`，Fun-ASR 默认 `25` / `1~50`。
- 扩展重载后需要刷新 DataBaker 业务页面，再重新测试，避免旧 content script 仍驻留。

## Omni legacy 快速路径热修

- 修复 `loadFailureDebugJson is not defined`：失败列表继续保留原始调试入口，没有 debug 数据时会提示“当前失败项没有可查看的原始 AI 返回。”。
- `qwen3.5-omni-flash` / `qwen3.5-omni-plus` 默认走 Omni legacy 快速路径，参考提交 `9677e4cea98de222b70f89c9e0af1d89971dc471`。
- Omni legacy 快速路径的目标是先恢复基础速度和稳定性；`fun-asr` 仍走当前 Node REST provider，不受该路径影响。

## 批量失败原始 AI 返回可观测性

- DataBaker 批量失败列表新增“查看原始AI返回”按钮，点击后会弹出脱敏后的 debug JSON 文本悬浮窗，并提供复制按钮。
- 同步 `POST /api/data-baker/round-one-quality/ai/recommend` 失败时，如果属于 `qwen-empty-response`、`model-json-parse-failed`、`provider-http-error` 等可观测错误，会返回 `hasRawAiDebug=true` 和 `debugId`。
- 后端新增内存级 `ai-debug-store`，只保留最近一段时间的脱敏 debug，不落盘，默认 TTL 30 分钟。
- debug 内容不包含完整音频 URL、签名 URL、cookie、token、authorization、API Key；超长原始响应会截断。
- 当前前端默认走 `POST /ai/recommend/jobs`、`50ms` 错峰；前端并发按模型动态归一，同步 recommend 只保留兼容回退。

## Qwen burst rate SSE 误报热修

- `qwen3.5-omni-flash / qwen3.5-omni-plus` 的 Omni legacy 快速路径现在会识别 SSE `data: {"error": ...}`，尤其是 `limit_burst_rate`。
- `limit_burst_rate` 表示 Qwen 请求增长过快的上游突发限流，不属于真实空响应，也不是 JSON 解析失败。
- 当前前端 `50ms` 错峰只是把批量建任务请求发到统一后端；DataBaker Omni legacy 默认直接并发调用 Qwen，上游不再经过 `qwen_omni` / `text_compare` provider queue 平滑，除非显式设置 `DATABAKER_AI_QWEN_SMOOTH_ENABLED=1`。
- legacy Omni 遇到 `limit_burst_rate` 时默认不自动退避重试；失败列表会直接显示“Qwen 请求突增限流，接口返回请求增长过快，可降低并发或稍后重试。”并继续保留“查看原始AI返回”按钮。

## 批量请求去重与诊断

- “AI连续填入合格项”每次启动会生成唯一 `batchRunId`。
- 当前页 N 条唯一合格项会发送 N 条建任务请求，默认走异步 jobs。
- 每条请求会附带 `batchRunId`、`batchItemIndex`、`batchProcessKey`、`clientRequestId`。
- 前端同一批次会先按 `processKey` 去重，重复任务只保留第一条，并在悬浮窗显示“唯一任务数 / 重复跳过”。
- 页面级全局锁 `window.__ASC_DATABAKER_ROUND_ONE_BATCH_LOCK__` 会阻止旧 content script、多 runtime 或双击按钮在 5 分钟内重复启动第二批任务。
- 扩展重载后需要刷新 DataBaker 业务页面再测试，否则旧 content script 仍可能保留。

# 闽南语助手平台资料

本目录记录 标贝易采 质检站点“一检质检”页面结构、网络接口和本地后端调试资料。

## 页面范围

- 平台域名：`https://datafactory.data-baker.com/`
- 质检首页：`/v2/#/quality/roundOne`
- 质检详情页：`/v2/#/quality/roundOneCollect?collectId=...&checkType=0`

当前只服务扩展目录：

```text
extension/sites/data-baker/round-one-quality/
```

该站点与 Alibaba LabelX 无关，不应把 标贝易采 逻辑放入 `extension/sites/alibaba-labelx/`。

## 扩展 options 接入

`闽南语助手` 已接入扩展 options “标注脚本中心”：

- options 首页展示 `标贝易采` 平台区域和 `闽南语助手` 脚本卡片。
- 脚本可在卡片中启停，默认启用，便于上线验证。
- 后端接口地址统一由 options 首页顶部“后端接口地址”控制；专属设置页不再提供独立后端地址。
- 专属设置页可配置请求超时时间和 AI 推荐开关。
- 专属设置页新增自动每页条数，默认启用并设置为 `50条/页`，只点击页面原生分页控件。
- 专属设置页新增快捷键配置，默认全部未设置，可手动绑定 AI 推荐、复制、填入、忽略、句子判定和任务判定动作。
- 左侧句子列表上方 `filter-screen`（“全选/批量判定”同一行）新增“AI连续填入合格项”：按钮挂载在“批量判定”右侧。
- 点击后先刷新当前页 `queryCollectStatementByCondtion`，筛选当前页 `statusName=质检合格` 条目。
- 先按配置并发数并发发起所有 AI 推荐，结果返回后进入缓冲区；填入流程不等待全部返回，按 AI 返回顺序从队列取结果后逐条选中并填入；运行中可再次点击或按 `Alt+Q` 停止。
- “AI连续填入合格项并发数量”已归到共享“AI 设置”区域，并按模型动态归一：
  - Omni：默认 `5`，范围 `1~25`
  - Fun-ASR：默认 `5`，范围 `1~50`
- 前端和后端都会对超范围值做归一；请求体会额外携带 `frontConcurrency / batchConcurrency / concurrencyModelType` 诊断字段，但不会传进模型 Prompt。
- 当识别模式为 `two_stage` 且听音模型为 `fun-asr` 时，批量连续填入默认短请求创建 `POST /ai/recommend/jobs`。当前页有 N 条合格项，就会为 N 条任务调度对应请求；前端按 `50ms` 错峰发起，并继续受前端活跃并发上限与后端 provider queue / RPM 限流保护。
- 运行中会显示顶部统计悬浮窗；完成或停止后保留约 60 秒，并展示失败条目与“重新填写失败内容”入口。
- `group/detail?taskId=...` 页面新增“导出数据总表”按钮，先点击 Element UI 分页大小选择器并选择 `100条/页`，再逐页触发页面原生请求，由 MAIN world 拦截 `queryByCondition` 响应合并导出 CSV（使用当前登录态，不依赖本地后端）。
- 导出 CSV 不再包含“原始JSON”列；原始记录会脱敏后单独上传并由后端保存为 `latest-raw.json`（历史模式下为 `*.raw.json`）。
- 后端 `latest.csv` 改为累计合并总表，不再每次上传覆盖：
  - 唯一键仅以“文本编号”为主（任务ID不参与唯一键）。
  - 相同文本编号再次上传会更新旧行。
  - 不同任务可共存，前提是文本编号不同。
- 默认推荐接口走服务器：`https://script.xiangtianzhen.store/api/data-baker/round-one-quality/ai/recommend`。
- 本机接口 `http://127.0.0.1:3333/api/data-baker/round-one-quality/ai/recommend` 仅用于开发调试。
- 扩展前端不保存 API Key，`DASHSCOPE_API_KEY` 仍由后端通过 `config/env/ai.env` 或系统环境变量读取。
- 该平台导出的 `latest.csv` 已纳入统一“项目数据下载”聚合接口数据集，可按供应商规则筛选下载（若 CSV 存在多供应商）。
- 导出 CSV 的计费时长字段新口径统一为 `有效时长`（来源字段保持 `effectivePassTotalTime`）；历史字段名 `有效合格时长` 仅作兼容识别。

## 当前资料

```text
round-one-quality/
  README.md
  ai/
    adapter.js
    assets/
      README.md
    data/
      adapter.js
      field-mappings.js
      README.md
      scripts/
        csv.js
        download.js
        fetch.js
        merge.js
        persist.js
        upload.js
    assets/
      README.md
      mappings/
        export-columns.md
        upload-payload.md
      samples/
        latest-sample.csv
        latest-raw-sample.json
        latest-meta-sample.json
        upload-events-sample.jsonl
        upload-payload-sample.json
  page-structure/
    README.md
  network/
    README.md
  backend/
    README.md
    index.js
    ai-routes.js
    ai-service.js
    reference/
      minnan-lexicon.json
      minnan-lexicon.csv
```

- `page-structure/README.md`：页面 DOM 结构、稳定选择器和当前可编辑文本框判断。
- `network/README.md`：列表接口路径、请求参数、响应字段和缓存策略。
- `backend/reference/minnan-lexicon.json`：闽南方言业务词表运行时主文件。
- `backend/reference/minnan-lexicon.csv`：闽南方言字词表参考源，保留给人工整理、导入和外部 AI 处理使用，不再作为运行时主读取源。
- `ai/`：DataBaker 接入统一 `platform-resources/backend/ai-framework/` 的项目 adapter 与未来 prompt/schema/lexicon 资产目录。
- `data/`：DataBaker 脚本级数据逻辑目录。当前已开始收口 `adapter.js`、`field-mappings.js`、`scripts/csv.js`、`scripts/merge.js`、`scripts/download.js`、`scripts/upload.js`、`scripts/persist.js`、`scripts/fetch.js`，并补了 `assets/mappings` 与 `assets/samples`；真实导出运行数据仍在 `backend/export-data/`。
- `backend/`：标贝易采 AI 推荐文本业务编排目录。当前业务层以 `ai-routes.js + ai-call-log.js + ai-service.js + ai-legacy-omni-service.js + ai-client-qwen-legacy.js` 组成；公共 AI provider、限流队列、缓存与 Python 辅助脚本统一收敛到 `platform-resources/backend/ai/`。`ai-routes.js` 的 recommend 入口已改为通过 `ai-framework` route factory 驱动，但对外仍保留旧接口响应结构。`ai-service.js` 继续负责 Fun-ASR REST 和当前通用链路，Omni legacy 快速路径独立收口在 `ai-legacy-omni-service.js`。
- `backend/export-routes.js` 的 `export/download` 当前已接到 `platform-resources/backend/project-data-download/` 下的共享 CSV 文件下载 core；对外继续保持 `GET/HEAD /api/data-baker/round-one-quality/export/download`。

## AI 调用日志与统计

- DataBaker 当前已默认记录每次 AI recommend 的成功 / 失败调用。
- 日志文件：
  - `platform-resources/data-baker/round-one-quality/backend/logs/ai-calls-YYYY-MM-DD.csv`
- 统计接口：
  - `GET /api/data-baker/round-one-quality/ai/recommend/logs/summary`

## 自动分页与快捷键

- 运行时只在 `roundOneCollect` 详情页生效。
- 自动分页目标 DOM 为 `.roundOneCollect-el-pagination span.el-pagination__sizes .el-select`，会读取当前分页 input 值，若不是目标值则打开下拉并点击可见的 `5条/页`、`10条/页`、`20条/页`、`50条/页` 或 `100条/页`。
- 自动分页有限重试，默认最多 5 次，失败只输出简短 `console.debug`，不影响 AI 推荐主流程。
- 快捷键默认全部未设置，用户需在 options 标贝易采 专属设置页手动录制。
- 默认新增 `Alt+Q`：触发“AI并发分析并连续填入合格项”（运行中再次触发为停止）。
- 快捷键不会在 `input`、`textarea`、`select` 或 `contenteditable` 聚焦时触发。
- 句子判定只点击 `.submit-btn` 中的“合格 / 不合格”；任务判定只点击 `.operate-btn` 中包含“任务判定”的“通过 / 部分驳回 / 全部驳回”按钮。
- 任务判定按钮 disabled 时不会绕过平台限制；该能力不自动保存、不自动提交、不自动流转。
- “AI连续填入合格项”不会自动保存、自动提交、自动批量流转，也不会点击左侧 checkbox；`质检不合格`、`未质检` 与状态未知会直接跳过。

## 安全记录规则

- 不记录真实 `access_token`、`refresh_token`、cookie。
- 不记录完整签名音频 URL、`OSSAccessKeyId`、`Signature`。
- 不记录客户文本、采集人姓名、手机号、合同内容或未脱敏截图。
- 文档只记录选择器、接口路径、参数名、字段名和脱敏后的结构结论。

## 后端接口

统一后端启动：

```powershell
node platform-resources\backend\server.js
```

标贝易采 AI 推荐接口：

- `GET /api/data-baker/round-one-quality/ai/recommend/health`
- `POST /api/data-baker/round-one-quality/ai/recommend`
- `POST /api/data-baker/round-one-quality/ai/recommend`（默认）
- `POST /api/data-baker/round-one-quality/ai/recommend/jobs`（历史兼容 / 调试）
- `GET /api/data-baker/round-one-quality/ai/recommend/jobs/:jobId`（历史兼容 / 调试）

扩展默认请求服务器完整路径：

- `POST https://script.xiangtianzhen.store/api/data-baker/round-one-quality/ai/recommend`

导出默认走前端拦截链路：扩展不直接 `fetch /cms/tbAudioUserTask/queryByCondition`，而是触发页面原生分页查询并拦截响应。背景是平台可能对扩展直接请求返回 `code=51000`。当前流程会先展开分页大小下拉并选择 `100条/页`，再逐页导出全量数据；CSV 带 UTF-8 BOM，不依赖本地后端和账号密码配置，且已移除“采集ID”列。若下拉未能自动展开，可手动切到 `100条/页` 后重试。

## 闽南方言词表

后端当前已接入闽南方言业务词表 JSON：

```text
platform-resources/data-baker/round-one-quality/backend/reference/minnan-lexicon.json
```

参考源继续保留：

```text
platform-resources/data-baker/round-one-quality/backend/reference/minnan-lexicon.csv
```

业务词表既作为 Qwen prompt 上下文，也会默认以 `aggressive` 模式对最终推荐文本做强替换，用于帮助模型在“的/诶”“很/真”“喜欢/欢喜”“这位/即个”“他/伊”等场景中选择更合适的字形。强替换只影响推荐文本展示，不会触发自动提交、自动保存或批量识别；如需关闭，可设置 `DATABAKER_AI_LEXICON_REWRITE_MODE=off`。词表缺失时后端仍可运行，但推荐文本效果会下降；如果 `minnan-lexicon.json` 缺失但本地 `minnan-lexicon.csv` 仍在，页面会在右下角弹出一次“没有字词对应表”提示，停留约 1 秒后自动消失，同时继续按无词表模式运行，不会把 CSV 重新当成业务主读取源。后续更新词条内容时，应先整理 JSON 主词表；CSV 只作参考源保留。

AI prompt 输出字形规则：

- 普通中文输出统一为简体中文（包含 `heardText` 与 `recommendedText`）。
- 若输入文本包含普通繁体字，推荐文本需转换为普通简体。
- `minnan-lexicon.json` 命中的建议用字属于保留项，不参与普通简繁转换。
- 词表命中优先于普通简繁转换，避免把方言建议用字改成普通话同义写法。

后端也会在模型输出后对 `heardText` 与 `recommendedText` 做普通繁体转简体归一化（`pageText` 原始文本不改）；归一化前会先保护词表建议用字，保证 `阮/汝/伊/囡仔/诶` 等方言建议用字不被覆盖。

词表括号内容全部按拼音 / 批注处理，不参与建议用字或对应华语，例如 `家（gei、dao）、厝（cuo）` 只会清洗出 `家`、`厝`。拉丁字母、拼音音调字母、数字注音和残留连接符也不会参与替换。单字映射默认跳过强替换，避免误伤 `家庭` 这类复合词；基础高频单字仍由后端 `BASE_ENTRIES` 显式维护，例如 `他 -> 伊`、`的 -> 诶`、`很 -> 真`、`吃 -> 食`。如果出现异常替换，优先检查 `minnan-lexicon.json` 与参考源 `minnan-lexicon.csv` 的词条整理是否一致。

后端会对 AI 听音文本和最终 AI 推荐文本删除普通空格、全角空格、Tab 和换行，推荐卡展示、复制、填入和调用日志都使用清理后的文本；页面候选文本原文不做去空格处理。

环境变量：

- `DASHSCOPE_API_KEY`：DashScope API Key，只由后端读取。
- `DATABAKER_AI_FUN_ASR_MODEL`：Fun-ASR 录音文件识别模型，默认 `fun-asr`。
- `DATABAKER_AI_LISTEN_MODEL`：DataBaker 听音模型默认值；当前 Omni legacy 快速路径默认使用 `qwen3.5-omni-flash`。
- `DATABAKER_AI_OMNI_MODEL`：Qwen Omni 模型默认值；双模型下用于 Omni 听音，单模型下用于 Omni 单模型推荐，默认 `qwen3.5-omni-flash`。
- `DATABAKER_AI_COMPARE_MODEL`：对比模型，默认 `qwen3.5-plus`。
- `DATABAKER_AI_TIMEOUT_MS`：AI 请求超时，默认 `60000`。
- `DATABAKER_AI_OMNI_LEGACY_FAST_PATH`：默认 `1`；开启后上述 DataBaker Omni 模型会优先走参考提交 `9677e4cea98de222b70f89c9e0af1d89971dc471` 的 Omni legacy 快速路径。
- `DATABAKER_AI_ENABLE_THINKING`：历史兼容变量；当前仓库已统一固定关闭 thinking，DataBaker 会继续显式传 `enable_thinking=false`，不再允许通过该变量开启。
- `DATABAKER_AI_PIPELINE_MODE`：识别模式默认值与历史兼容字段；当前主值是 `two_stage / omni_single`。旧值 `qwen_omni_compare / fun_asr_compare / qwen_omni_two_stage / listen_only` 会迁移到新的识别模式。
- `DATABAKER_FUNASR_PYTHON_BIN`：可选，指定 Python 解释器路径；未设置时优先使用统一虚拟环境 `platform-resources/backend/.venv`。
- `DATABAKER_AI_FUN_ASR_LANGUAGE_HINTS`：Fun-ASR 语言提示，默认 `zh`。
- `DATABAKER_AI_QWEN_OMNI_RPM_LIMIT`：Qwen Omni 队列限流，默认 `45` RPM。
- `DATABAKER_AI_FUN_ASR_RPM_LIMIT`：Fun-ASR 队列限流，默认 `500` RPM。
- `DATABAKER_AI_TEXT_RPM_LIMIT`：Compare 文本模型队列限流，默认 `500` RPM。
- `DATABAKER_AI_QWEN_OMNI_CONCURRENCY`：Qwen Omni 并发上限，默认 `3`。
- `DATABAKER_AI_FUN_ASR_CONCURRENCY`：Fun-ASR 并发上限，默认 `5`；`2 核 2G` 服务器压力高时建议调低到 `3`。
- `DATABAKER_AI_TEXT_CONCURRENCY`：Compare 文本模型并发上限，默认 `5`。
- `DATABAKER_AI_PROVIDER_RETRY_MAX`：上游 `429` 指数退避最大重试次数，默认 `3`。
- `DATABAKER_AI_QWEN_SMOOTH_ENABLED`：默认 `0`；DataBaker Omni legacy 快速路径默认按前端并发直接请求，只有设为 `1` 时才重新启用后端平滑。
- `DATABAKER_AI_QWEN_BURST_RETRY_MAX`：默认 `0`；`limit_burst_rate` 默认直接暴露真实错误，不自动退避重试，需要更稳时再手动改为 `3`。
- `ASC_AI_JOB_TIMEOUT_MS`：共享 AI job 超时，默认 `60000`。仅在历史兼容 job 被显式启用时生效。
- `ASC_AI_JOB_TTL_MS`：共享 AI job 记录保留 TTL，默认 `1800000`（30 分钟）。
- `ASC_AI_JOB_MAX_SIZE`：共享 AI job 最大保留数量，默认 `600`。
- `ASC_AI_JOB_POLL_INTERVAL_MS`：前端轮询 job 状态建议间隔，默认 `1000` ms。
- `DATABAKER_AI_JOB_*`：仅保留历史兼容 fallback；生产环境优先写 `ASC_AI_JOB_*`。
- `DATABAKER_AI_QUEUE_MAX_SIZE`：统一 provider 队列最大长度，默认 `600`。
- `DATABAKER_AI_CACHE_TTL_MS`：推荐结果内存缓存 TTL，默认 `43200000`（12 小时）。
- `DATABAKER_AI_LEXICON_REWRITE_MODE`：词表最终推荐文本改写模式，默认 `aggressive`；设为 `off` 时只保留 prompt 上下文。
- `DATABAKER_AI_CROP_EFFECTIVE_AUDIO`：预留有效音频裁剪开关，默认 `0`。
- `DATABAKER_AI_CROP_PADDING_SECONDS`：预留裁剪前后补齐秒数，默认 `0.12`。

## 听音模型与限流

当前前端先选择“识别模式”：

- `two_stage`：显示“听音模型 + 比较模型”
- `omni_single`：只显示“AI 模型”

双模型配置：

- 听音模型：`fun-asr`、`qwen3.5-omni-plus`、`qwen3.5-omni-flash`、`qwen3.5-omni-flash-2026-03-15`、`qwen3-omni-flash`、`qwen3-omni-flash-2025-12-01`、`qwen3-omni-flash-2025-09-15`
- 比较模型：`qwen3.6-plus`、`qwen3.5-plus`、`qwen3.6-flash`、`qwen3.5-flash`

单模型配置：

- AI 模型：`qwen3.5-omni-plus`、`qwen3.5-omni-flash`、`qwen3.5-omni-flash-2026-03-15`、`qwen3-omni-flash`、`qwen3-omni-flash-2025-12-01`、`qwen3-omni-flash-2025-09-15`

运行时链路：

- `two_stage + fun-asr`：先调用 Fun-ASR 录音文件识别，再调用文本 compare 模型。
- `two_stage + Qwen Omni`：默认优先走 Omni legacy 快速路径，先通过 Qwen Omni `input_audio` 产出 `heardText`，再调用文本 compare 模型。
- `omni_single + Qwen Omni`：当 `DATABAKER_AI_OMNI_LEGACY_FAST_PATH=1` 时，也优先切到 Omni legacy 快速路径兜底，以先恢复基础速度和稳定性。

设置页口径：

- 显示“识别模式”字段。
- `two_stage` 下显示“听音模型”和“比较模型”，不显示“AI 模型”。
- `omni_single` 下只显示“AI 模型”，不显示“听音模型”和“比较模型”。
- 选择 `fun-asr` 时显示 Python SDK / `.venv` 提示。
  - 当前默认 provider 已改为 Node REST；Python SDK 仅作为 fallback / 调试方案保留。
- 选择 Qwen Omni 模型时隐藏 Python 提示。
- 比较模型默认 `qwen3.5-plus`；旧配置若为其他值，会迁移为 `qwen3.5-plus`。

统一约束：

- 所有上游模型调用都必须进入后端 provider/model group 队列。
- 队列按 `qwen_omni / fun_asr / text_compare` 分组限流，并按 group 配置最大并发。
- Fun-ASR / 通用 provider 队列遇到 `429` 仍会做指数退避和 jitter 重试；但 DataBaker Omni legacy 默认不对 `limit_burst_rate` 自动重试，而是直接返回真实错误并保留 debug。
- 推荐结果会按题目、模式、模型和规则版本做内存 TTL 缓存，重复点击与多人重复处理优先命中缓存。
- `429` 的根因是上游模型限流，不是本地或服务器 `2 核 2G` 算力问题；多个 RAM 用户或 API Key 若归属于同一阿里云主账号，也可能共享限流额度。
- Qwen Omni 和 Fun-ASR 的调用链路不同，不能只靠改模型名互换。
- 选择 `fun-asr` 作为听音模型时，还依赖 Fun-ASR 服务能访问平台 `audioUrl`。如果音频 URL 对服务端不可访问，后端会明确报错，但日志和文档不会泄露完整签名 URL。
- Fun-ASR 不走 OpenAI-compatible chat/completions；当前默认通过 Node RESTful API 调用。
- Fun-ASR 没有 thinking 概念；当前 DataBaker 的 Qwen Omni 听音阶段和 compare 阶段也已统一固定关闭 thinking。
- Fun-ASR 失败时，前端现在会优先区分：鉴权/权限错误、平台音频 URL 不可访问、模型名错误、上游限流、任务失败、转写结果下载失败；失败列表继续保留“查看原始AI返回”。
- Python 只是统一 Node 后端内部调用的 fallback / 调试辅助进程，不提供独立 Python 服务；标准启动入口始终是 `node platform-resources/backend/server.js`。

Fun-ASR 默认 REST / Python fallback 相关路径：

```text
platform-resources/backend/ai/python/funasr_client.py
platform-resources/backend/ai/python/requirements.txt
```

- 默认虚拟环境路径已统一为 `platform-resources/backend/.venv`。
- Fun-ASR 默认 provider 为 `rest`，完整部署流程统一见根目录 `README.md`；本平台资料不重复服务器部署命令。若显式切到 `provider=python`，则继续复用同一个 `.venv` 与 `backend/ai/python/` 目录结构。
- `platform-resources/backend/ai/python/requirements.txt` 现新增 `opencc-python-reimplemented`，部署后需要重新执行 `pip install -r ai/python/requirements.txt`。
- Fun-ASR REST 补充：
  - Node 后端默认通过 `POST /services/audio/asr/transcription` 提交任务，再通过 `POST /tasks/{task_id}` 轮询
  - 当前只做单条 REST 调用，不启用 `file_urls` batch
- 默认链路不启动 Python 子进程，可降低本机 CPU 压力
- `two_stage + fun-asr` 的批量连续填入默认直接走同步 `POST /ai/recommend`；异步 jobs 仅保留为历史兼容 / 调试接口。
- 单条 AI / 模型请求默认超时 `60000ms`；超过 1 分钟仍未返回，默认认为该链路不适合当前项目，应优先优化模型、Prompt、任务拆分或后端策略。
- 如果模型输出 JSON 解析失败，失败列表会显示“复制原始JSON”按钮；同步 recommend 与历史兼容 jobs 都会返回可复制的脱敏 debug 信息。
- 前端 `loadFailureDebugJson` 已恢复为安全兜底函数；没有 debug 数据时会明确提示“当前失败项没有可复制的原始 JSON.”，不再抛 `ReferenceError`。
- job 默认 TTL 仍为 `1800000`（30 分钟）；这属于历史兼容 job 记录保留时间，不影响默认同步 recommend 主链路。
- Python fallback 编码补充：
  - 仅显式切到 `provider=python` 时，Node 后端才会向 Python 子进程显式设置 `PYTHONIOENCODING=utf-8` 与 `PYTHONUTF8=1`
  - `platform-resources/backend/ai/python/funasr_client.py` 会按 UTF-8 输出 stdout JSON
  - `platform-resources/backend/ai/providers/funasr-python.js` 会按 UTF-8 解码 stdout/stderr
  - 若曾出现 `�` / 黑菱形乱码，修复部署后需要重启统一后端，避免旧内存缓存继续命中乱码结果
  - `qwen3.5-omni-plus` / `qwen3.5-omni-flash` 不经过 Python 子进程，因此不受该编码问题影响
- Fun-ASR 简繁补充：
  - Fun-ASR 可能返回繁体或繁简混合字形
  - 默认 REST provider 下，DataBaker AI 结果组装阶段会做统一繁转简
  - 显式切到 Python provider 时，还会先在 Python Fun-ASR 返回阶段做一次繁转简
  - `阮 / 汝 / 伊 / 诶` 等闽南词表建议用字会被保护，不按普通繁简转换覆盖

## 真实浏览器验收建议

1. 重新加载扩展。
2. 打开 options，确认显示“识别模式”下拉。
3. 选择 `two_stage`，确认显示“听音模型”和“比较模型”，且“听音模型”下拉不再出现 `[object Object]`。
4. 切换到 `omni_single`，确认只显示“AI 模型”，且模型选项只包含 `qwen3.5-omni-plus`、`qwen3.5-omni-flash`。
5. 进入 `roundOneCollect` 页面，在 `omni_single` 下选择 `qwen3.5-omni-flash` 或 `qwen3.5-omni-plus` 后点击单条“AI 推荐文本”，确认浏览器请求只走统一后端接口，不直连 DashScope，且默认优先走 Omni legacy 快速路径。
6. 切回 `two_stage` 并选择听音模型为 `fun-asr`，确认界面显示 Fun-ASR provider 提示，后端链路为 Fun-ASR + compare。
7. 点击“AI并发分析并连续填入合格项”，确认在 `fun-asr` 下默认并发为 `25`、范围 `1~50`；切到 Omni 后会归一到默认 `15`、范围 `1~25`。
8. DataBaker 选择 Qwen Omni 且前端并发调到 `25` 时，浏览器应继续按 `50ms` 错峰创建 jobs；后端默认不再对 Omni legacy 做平滑排队。
9. 后端日志可看到模式、排队、重试、cache hit/miss，但不能出现完整 `audioUrl`、签名 URL、cookie 或 token。
10. 默认 REST provider 下，即使未配置 Python 虚拟环境，`two_stage + fun-asr` 也应能调用；只有显式切到 `provider=python` 或 `fallback=python` 时才依赖 `.venv`。
11. 选择 `two_stage + fun-asr` 后点击“AI连续填入合格项”，确认 Network 中优先出现大量按 `50ms` 错峰发起的 `POST /api/data-baker/round-one-quality/ai/recommend/jobs`，随后再轮询 `GET /api/data-baker/round-one-quality/ai/recommend/jobs/:jobId`。

12. 若切到 Python provider，再用 `5-10` 条真实平台音频验证 Fun-ASR 可访问。
13. 若 Fun-ASR 返回 `403`，确认页面提示会说明可能是权限/地域、API Key 或平台 `audioUrl` 可访问性问题，并建议切换到 `qwen3.5-omni-flash` 或 `qwen3.5-omni-plus`。
14. 选择 `qwen3.5-omni-plus` 或 `qwen3.5-omni-flash` 时，需要验证后端能先返回 `heardText`，再调用 compare 模型生成 `recommendedText`。
15. 页面填入后仍不自动保存、不自动提交、不自动判定、不自动流转。

## 当前边界

- 当前“AI连续填入合格项”采用“并发分析结果入缓冲 + 顺序填入”策略，仅在当前页执行，不跨页。
- 诊断串行感时，先区分两层并发：
  - 前端并发：`aiQualifiedAutofillConcurrency`
    - Omni：默认 `15`，范围 `1~25`
    - Fun-ASR：默认 `25`，范围 `1~50`
  - 后端 Fun-ASR 并发：`DATABAKER_AI_FUN_ASR_CONCURRENCY`，默认 `2`
  - 后端 compare 并发：`DATABAKER_AI_TEXT_CONCURRENCY`，默认 `5`
- 如果前端“AI已返回”增长慢，不一定是前端没并发，也可能是 Fun-ASR 听音阶段或 compare 阶段在后端排队；优先看 `health.queue.groups.fun_asr.activeCount/maxConcurrent`。
- 不做自动保存、不做自动提交、不做批量识别、不做自动流转。
- 结果写入页面输入框必须由用户点击“填入推荐文本”触发。
- 如果页面结构变化导致无法安全定位输入框，扩展只保留复制能力。

## 批量请求诊断字段

- 批量连续填入会在悬浮窗展示 `batchRunId`、总合格数、唯一任务数、重复跳过、已发起请求、活跃请求、AI 已返回、待填队列，以及实时累计的 `批量输入Token / 批量输出Token / 批量总Token / 批量预估人民币`。
- 如果看到 `launchedCount` 大于 `uniqueTaskCount`，才需要优先怀疑前端重复发送；否则应先区分是后端排队等待还是连接中断。
- 后端排队等待不等于队列已满；若后续接入队列 health，应结合 `pendingCount/maxSize` 判断是否真正满载。




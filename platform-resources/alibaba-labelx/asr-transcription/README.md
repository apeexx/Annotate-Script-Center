# Alibaba LabelX ASR 转写资料

## 当前状态

- 当前以轻量工具栏版、统一总表统计链路和人工确认式 AI 推荐为准。
- `extension/sites/alibaba-labelx/asr-transcription/` 已切换为轻量工具栏版。
- 旧版独立大表单、页面 overlay 设置面板已移除。
- options 已恢复转写轻量设置面板与当前功能快捷键配置（不包含统计上传开关）。
- 运行时只保留当前题与当前音频基础动作，新增“当前题 AI 推荐（人工确认填入）”，不包含保存/提交/自动化闭环。
- 工具栏已改为页面内注入：优先 `.mark-toolbox`，找不到时回退到首条题卡前，不再默认顶部固定悬浮。
- 新增“转写统计导出”链路：复用快判上传架构口径，独立后端目录与独立 CSV 列；统计上传与定时上传运行时强制启用。
- AI 后端桥接状态：
  - `POST /api/alibaba-labelx/asr-transcription/ai/suggest-current` 已改为通过 `platform-resources/backend/ai-framework/` route factory 驱动。
  - `platform-resources/alibaba-labelx/asr-transcription/ai/adapter.js` 负责请求映射与旧响应结构兼容。
  - `platform-resources/alibaba-labelx/asr-transcription/backend/ai-suggest-request.js` 负责 AI 请求归一，与 adapter 共用。
  - 统计上传、CSV 合并、下载与 suppliers 相关逻辑仍保留在 `backend/`，本轮不动。
  - `GET /api/alibaba-labelx/asr-transcription/ai/suggest-current/health` 与 `GET /api/alibaba-labelx/asr-transcription/ai/defaults` 当前仍保留旧实现。
- 下载链路共享 core 状态：
  - `GET/HEAD /api/alibaba-labelx/asr-transcription/statistics/download`
  - `GET /api/alibaba-labelx/asr-transcription/statistics/suppliers`
  - `POST /api/alibaba-labelx/asr-transcription/statistics/existing`
  - 以上 3 条链路已开始复用 `platform-resources/backend/project-data-download/` 下的 LabelX 共享下载 core。
  - 当前转写脚本级差异已收口到 `platform-resources/alibaba-labelx/asr-transcription/data/adapter.js`。

## AI 调用日志与统计

- 转写 AI 推荐当前已默认记录成功 / 失败调用。
- 日志文件：
  - `platform-resources/alibaba-labelx/asr-transcription/backend/logs/ai-calls-YYYY-MM-DD.csv`
- 统计接口：
  - `GET /api/alibaba-labelx/asr-transcription/ai/suggest-current/logs/summary`

## 当前业务口径（与扩展运行时一致）

- 一条音频对应一个完整文本框。
- 仅保留按钮能力：
  - 当前题：快速填入、标有效、标无效、去空格、数字转换、焦点切换。
  - 当前音频：播放/暂停、前进/后退、倍速提高/降低/重置、音量提高/降低/重置、复制时长。
- 默认值由 `shared/constants.js -> DEFAULT_ASR_CONFIG` 提供，运行时读取项目 `asrConfig` 覆盖。
- options 转写轻量设置面板可配置：
  - 自动播放、默认倍速、重置倍速、倍速步进、前进/后退步长、默认音量
  - 当前题行为（默认有效、标有效自动填入、标无效自动清空）
  - 当前保留功能快捷键（含上传统计）
- 统计上传与定时上传不在 options 转写详情页提供开关。
- 统计主存储为根级总表 `statistics-data/statistics-merged.csv`，历史供应商目录仅兼容读取迁移。
- 允许“当前题 AI 推荐”第一版（只分析当前题，人工确认填入）。
- 仍不实现时间戳、说话人区分、AI 初稿/校对/格式化/标点。
- 仍不实现自动保存、自动提交、自动跳转、全页批量修改。

## 注入状态与 popup 口径

- content script 在 `document_start` 注入后保持 pending，不因首轮 DOM 未就绪而永久停机。
- 通过 `DOMContentLoaded`、`load`、`MutationObserver`、SPA 路由变化、短轮询持续重试。
- popup 状态区分：
  - 已注入但未命中详情页：显示“已注入，等待转写详情页”。
  - 已命中并启动：显示“运行成功”。
  - 真正无响应：显示“注入失败”。

## 目录职责（轻量版）

- `content.js`：页面命中重试 + 运行时编排 + ping。
- `toolbar.js`：页面内工具栏挂载、分组渲染、状态块与重挂载。
- `runtime-config.js`：启用状态与固定默认值。
- `transcription-stats-client.js`：浏览器端统计上传客户端，只做采集、上传、按钮和定时调度，不做 CSV 落盘。
- `shortcut-bus.js`：浏览器端转写快捷键运行时，只调当前保留动作，不引入保存/提交/AI/批量动作。
- `backend/`：Node 后端统计服务；上传、合并与 CSV 写入仍在本目录，下载 / suppliers / existing 已开始复用统一 LabelX 下载 core。
- `ai/`：统一 AI framework adapter 与后续 AI 资产目录。
- `data/`：脚本级数据 adapter 目录；当前已新增 `adapter.js`，负责转写下载 / existing 的项目差异。
- `active-item.js`：当前题定位。
- `item-actions.js`：当前题动作。
- `audio-controller.js`：当前音频动作。
- `text-utils.js`：文本处理。

## 转写统计导出口径

- 前端上传入口：
  - 顶部导航头像旁“上传转写统计”按钮。
  - 转写工具栏“上传统计”按钮。
  - 上传期间显示进度条：阶段、完成数/总数、百分比、并发、成功/失败。
  - 进度组件由 `extension/shared/progress-indicator.js` 提供，后续可复用到快判和其他平台脚本。
- 详情接口取数口径：
  - 页面实测常见 `GET /api/v1/label/center/subTask/{subTaskId}/data?page=1&pageSize=10...`。
  - 扩展统计上传默认详情请求 `pageSize=5000`；如果 `recordCount > 5000`，继续按页补齐。
  - 首页和详情都按 `recordCount` 计算 `totalPages`，不再固定只抓前 `5` 页、`50` 个子任务或 `300` 条详情。
  - 首页与详情分页最大页数上限均为 `999`；超过上限会输出告警并截断，不再静默漏抓。
  - 首页会同时抓 `finished=false` 与 `finished=true` 的 `subTasks`；同一轮上传按清洗后的 `subTaskId` 去重。
  - `subTaskId` 在拼 URL 前必须先做空白清洗（普通空格、Tab、换行、回车、全角空格）。
  - 首页分页抓取和详情抓取都支持并发；详情并发默认 `5`，动态不超过任务数，硬上限 `999`。
  - 上传锁：若上传中再次触发，返回 `upload-in-progress` 并跳过，不并发第二轮。
- 转写/快判识别口径：
  - 快判排除：`labelModel=vote` 或任务名命中 `ASR更优结果判断/ASR更优/更优结果判断/更优判断`（典型 `size=400`）。
  - 转写采集：`labelModel=single` 或任务名命中 `中文普通话asr任务/中文普通话asr/asr任务/普通话asr`（典型 `size=50`）。
- 上传接口：
  - `https://script.xiangtianzhen.store/api/alibaba-labelx/asr-transcription/statistics/upload`
  - `http://127.0.0.1:3333/api/alibaba-labelx/asr-transcription/statistics/upload`
- 供应商列表接口：
  - `https://script.xiangtianzhen.store/api/alibaba-labelx/asr-transcription/statistics/suppliers`
  - `http://127.0.0.1:3333/api/alibaba-labelx/asr-transcription/statistics/suppliers`
- 下载接口（默认总表，不要求 `supplier`）：
  - `https://script.xiangtianzhen.store/api/alibaba-labelx/asr-transcription/statistics/download`
  - `http://127.0.0.1:3333/api/alibaba-labelx/asr-transcription/statistics/download`
- 默认定时上传：`10:00`、`16:00`；定时上传在真正 POST 前增加随机延迟 `0~300` 秒（`100ms` 步进），手动上传不延迟。
- 后端目录：`platform-resources/alibaba-labelx/asr-transcription/backend/`。
- 统计写入目录：`platform-resources/alibaba-labelx/asr-transcription/backend/statistics-data/statistics-merged.csv`。
- CSV 基础列：
  `任务名称,任务ID,标注子任务ID,审核子任务ID,分包ID,题数,有效时长(秒),标注员,审核员,标注领取时间,标注提交时间,审核领取时间,审核提交时间,标注是否完成,审核是否完成`。
- 供应商列动态输出：
  - 单供应商数据集不输出 `供应商` 列。
  - 多供应商数据集在最后一列追加 `供应商` 列。
- 同一分包按 `供应商 + 分包ID` 合并标注与审核记录。
- 有效时长仅统计“是否有效”严格等于“有效”的题目时长，不使用 `includes("有效")`，避免“无效”误算。
- 标注员/审核员解析新增 `dataResultHistory` 兜底：优先 `type===0`，否则取最后一条。
- `legacy-reference/asr-script.user.js` 仅用于分页、并发、详情补齐、有效时长和 `dataResultHistory` 解析逻辑参考，不恢复 Tampermonkey 架构。
- 历史 `statistics-data/suppliers/<供应商>/statistics-merged.csv` 仅兼容读取迁移，不删除旧运行数据；新写入主路径是根级总表。
- 服务器下载地址需部署最新后端后可用；本地可先用 `127.0.0.1:3333` 验证。
- 资料与代码均不记录 cookie、token、完整音频 URL、完整签名 URL。

## 网络采集文档

- 已补充真实采集网络口径文档：`network/README.md`。
- 文档覆盖首页 `tasks/subTasks/tasks/process` 与详情页 `subTask/{id}/data|summary|board|getLabelTaskInfo`。
- 已明确 `subTaskId` 可能包含换行和空格编码，接口构造前必须先清洗。
- 已明确页面请求常见 `pageSize=10`，扩展统计上传策略改为 `pageSize=5000 + 按 recordCount 分页补齐`。
- 已新增转写页面结构文档：`page-structure/README.md`。
- `missionType=check`、`type=check`、`subTaskType=check`、有效性切换、转写文本自动保存、提交任务和自动领取链路。
- 已确认当前接口没有独立供应商字段；后续统计只能优先从 `taskName` / `name` 前缀推断，例如 `棋燊`、`希尔贝壳`。

## 后续约束

- 若未来要恢复已删旧能力，必须走“新需求 -> 新设计 -> 新实现 -> 新验收”，不能直接恢复旧文件或旧架构。

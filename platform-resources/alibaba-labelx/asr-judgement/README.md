# Alibaba LabelX ASR 快判资料

## 目录用途

本目录是 ASR 快判的平台资源入口，记录页面结构、网络请求、统计数据格式、本地调试后端和未完成能力。这里是 Chrome / Edge 共用资源，不放扩展运行时代码。

对应运行时代码仍在：

```text
extension/sites/alibaba-labelx/asr-judgement/
```

## 子目录

- `page-structure/`：快判详情页、标注首页、审核首页 DOM 结构和代表性 HTML 片段。
- `network/`：LabelX 快判相关请求采集，包含详情页 data、首页 tasks / subTasks、保存、提交、领取、释放等接口记录。
- `ai/`：快判 AI framework adapter 与后续资产目录；当前已新增 `adapter.js` / `adapter.test.js`，Prompt 与规则资产仍暂存于 `backend/ai/`。
- `data/`：脚本级数据 adapter 目录；当前已新增 `adapter.js`，负责快判下载 / existing 的项目差异。
- `backend/`：快判统计上传本地 Node 调试服务；上传、合并与 CSV 写入仍在本目录，下载 / suppliers / existing 已开始复用统一 LabelX 下载 core。
- `unfinished.md`：未完成能力、风险点和后续验证条件。

## AI framework 桥接状态

- `POST /api/alibaba-labelx/asr-judgement/ai/suggest` 已改为通过 `platform-resources/backend/ai-framework/` route factory 驱动。
- `platform-resources/alibaba-labelx/asr-judgement/ai/adapter.js` 负责：
  - 请求映射到统一输入契约
  - 旧 success / error body 兼容
  - 快判建议结果暴露给 framework 的脚本级结果通道
- `platform-resources/alibaba-labelx/asr-judgement/backend/ai-suggest-request.js` 负责 AI 请求归一、AI 参数清洗与脱敏错误辅助函数，供 adapter 与业务层共用。
- `GET /api/alibaba-labelx/asr-judgement/ai/health` 与 `GET /api/alibaba-labelx/asr-judgement/ai/defaults` 当前保持原有返回语义，本轮先做桥接式迁移。
- 统计上传、existing 检查、suppliers、download 与 CSV 落盘链路本轮不动，仍保留在 `backend/`。

## 下载链路共享 core 状态

- `GET/HEAD /api/alibaba-labelx/asr-judgement/statistics/download`
- `GET /api/alibaba-labelx/asr-judgement/statistics/suppliers`
- `POST /api/alibaba-labelx/asr-judgement/statistics/existing`
- 以上 3 条链路已开始复用 `platform-resources/backend/project-data-download/` 下的 LabelX 共享下载 core。
- 当前快判脚本级差异已收口到 `platform-resources/alibaba-labelx/asr-judgement/data/adapter.js`。

## AI 调用日志与统计

- 快判 AI 建议当前已默认记录成功 / 失败调用。
- 日志文件：
  - `platform-resources/alibaba-labelx/asr-judgement/backend/logs/ai-calls-YYYY-MM-DD.csv`
- 统计接口：
  - `GET /api/alibaba-labelx/asr-judgement/ai/suggest/logs/summary`

## 当前已迁移资料

- 快判详情页：`/corpora/labeling/sdk?missionType=label&projectId=...&subTaskId=...`
- 已完成只读详情页：`/corpora/labeling/sdk?disableEdit=true&isFinished=true&missionType=label&projectId=...&subTaskId=...`
- 标注首页：`/corpora/labeling/labelingTask?projectId=...`
- 审核首页：`/corpora/labeling/checkTask?projectId=...`
- 顶部头像下拉用户信息结构。
- 快判网络采集 `01` 到 `23`，以及待采集项和大页数负载测试片段。
- 快判 AI 半自动建议接口：`/api/alibaba-labelx/asr-judgement/ai/health`、`/api/alibaba-labelx/asr-judgement/ai/suggest`。
- AI 第一版模型固定走 `qwen3-omni-flash`（后续预留 `qwen3.5-omni-plus`）。
- AI 文本 prompt 仅包含 `asrText1/asrText2`；`projectId/subTaskId/itemId/itemIndex/audioUrl` 不进入模型文本上下文。
- `audioUrl` 仅用于模型音频输入字段。

## 维护规则

- 新增 LabelX DOM、网络请求或统计契约时，优先更新本目录。
- 如果运行时代码仍引用旧路径，应同步更新对应 README，避免资料入口分裂。
- `extension/sites/alibaba-labelx/asr-judgement/page-structure/` 不再保存快判页面结构；页面结构和网络采集内容统一维护在本目录。

## 当前统计口径（快判）

- 本轮为小修正，不升级 `0.2.12`。
- 统计主存储保持根级总表：`statistics-data/statistics-merged.csv`。
- 不再主动创建 `statistics-data/suppliers/`；若本地已存在，属于旧方案残留，可忽略或手动清理。
- CSV 供应商列动态策略：
  - 单供应商不输出 `供应商` 列。
  - 多供应商在最后一列输出 `供应商`。
- CSV 写出前统一清洗字段：去 BOM、去首尾空白（含全角空格/Tab/换行/零宽字符），任务名称/ID/人员/时间/完成状态/供应商都不保留前后空格。
- 供应商识别优先级：
  1. `payload.supplier/vendor`
  2. `csvPatch["供应商"]`
  3. `taskName` 推断（含 `棋燊`、`希尔贝壳`）
  4. `未识别供应商`
- 若 `csvPatch["供应商"]` 为 `未识别供应商` / `unknown-supplier` / 空值，必须回退到任务名重新识别。
- 快判首页和详情按 `recordCount` 补齐，不再静默截断。
- 快判详情保持 `pageSize=400` 业务口径。
- 快判并发规则：`Math.floor(total/5)`，最小 `1`，最大 `999`（并发显示值需与实际一致）。
- 快判上传已接入共享进度组件 `extension/shared/progress-indicator.js`，显示阶段、完成/总数、百分比、并发、成功/失败。

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

## existing/进度同步说明

- 快判保持 `exists=true` 与 `complete=true` 分离判定，`complete=false` 必须继续补齐。
- 快判进度样式同步共享组件：水平居中、完成态紧凑、四位数统计可见。
- 无待上传 payload 时不调用 upload。

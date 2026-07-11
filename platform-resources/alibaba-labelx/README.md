# Alibaba LabelX 平台资源

## 平台范围

本目录保存 Alibaba LabelX 相关的平台资料和调试工具，供 Chrome / Edge 共用的 `extension/` 扩展源码共同参考。

当前已整理的脚本项目：

- `asr-judgement/`：阿里 ASR 语音判别 / ASR 快判。
- `asr-transcription/`：阿里 ASR 语音转写，已补充转写首页与详情页的脱敏网络请求文档（见 `asr-transcription/network/README.md`）。
- `network/README.md`：LabelX 标注 / 审核首页和详情页中已确认可被转写、快判共用的网络接口结构。
- `page-structure/README.md`：LabelX 通用顶部导航、首页列表、详情页工具栏、题卡和音频结构。

## 通用约定

- 页面结构和网络接口以真实采集为准，不凭印象写选择器。
- 项目级资料放到具体脚本项目目录，不提前抽公共 shared。
- 只有确认判断和转写确实复用的 LabelX 平台级事实，才放在本目录根级 README 中。
- 涉及人员、任务、音频签名、token、cookie、session 的内容必须脱敏。
- 采集 HTML 结构和 Network 默认只用 Google Chrome DevTools / MCP。
- Playwright Edge 仅用于真实按钮/快捷键行为验证，或 DevTools 不可用时兜底。
- Codex 默认只负责打开浏览器；用户自行登录并进入目标页面，回复“处理好了”后再继续采集或测试。

## 已确认通用事实

- LabelX 是 React 单页应用，页面主要挂载在 `#root`。
- 顶部导航右侧头像下拉结构可用于读取当前用户展示名，当前共享片段保存在 `asr-judgement/page-structure/common-top-nav-avatar-dropdown.html`。
- 页面中的 `data-aplus-*`、`data-spm-*`、`aria-describedby` 和运行时随机 class 不作为稳定选择器依据。
- 标注首页和审核首页共用 `tasks`、`subTasks`、`tasks/process` 三类列表接口，差异主要是 `type` / `subTaskType`。
- 详情页共用 `subTask/{id}/data`、`summary`、`board`、`getLabelTaskInfo` 初始化接口。
- 详情页保存当前题数据使用 `POST /api/v1/label/center/subTask/{subTaskId}/data`，提交当前包使用 `POST /api/v1/label/center/subTask/{subTaskId}/commit`。
- 当前已采集响应中没有独立 `supplier/vendor/company/provider/供应商` 字段；供应商只能从任务名称前缀推断。

## 下载链路共享 core

- 转写与快判当前都保留原有外部下载接口：
  - `/api/alibaba-labelx/asr-transcription/statistics/download|suppliers|existing`
  - `/api/alibaba-labelx/asr-judgement/statistics/download|suppliers|existing`
- 两套后端内部实现已开始复用：
  - `platform-resources/backend/project-data-download/labelx-download-core.js`
  - `platform-resources/backend/project-data-download/labelx-existing-core.js`
- 脚本级差异分别由：
  - `platform-resources/alibaba-labelx/asr-transcription/data/adapter.js`
  - `platform-resources/alibaba-labelx/asr-judgement/data/adapter.js`
  提供。

## 统计总表修正（转写/快判共识）

- 当前版本维持 `0.2.11`，本轮为 `0.2.11` 修正增强，不升级 `0.2.12`。
- 统计 CSV 采用动态供应商列：
  - 单供应商数据集不输出 `供应商` 列。
  - 多供应商数据集在最后一列追加 `供应商` 列。
- CSV 写出前统一做字段清洗：去 BOM、去首尾空白（含全角空格/Tab/换行/零宽字符），任务名称/ID/人员/时间/状态/供应商都不保留前后空格。
- 内部 payload / mergeKey 继续保留 supplier 信息，保证跨供应商同分包 ID 不覆盖。
- 供应商识别优先级：
  1. `payload.supplier.name` / `payload.vendor.name`
  2. `payload.supplier` / `payload.vendor`
  3. `csvPatch["供应商"]`
  4. `taskName/name` 推断（当前已知：`棋燊`、`希尔贝壳`）
  5. `未识别供应商`
- 任务名会先做规范化（`decodeURIComponent` 容错 + 去除 `BOM` + 清理前后空白/全角空格 + 连续空白规整，并生成去空白匹配串），再优先按包含关系识别 `海天` / `希尔贝壳` / `棋燊`；命中 `贝壳` 归一为 `希尔贝壳`，命中 `supplier=H` 且任务名含海天语义时归一为 `海天`。
- 若已有供应商字段是 `未识别供应商` / `unknown-supplier` / 空值，必须回退到任务名重新识别，不得固化错误供应商。
- 详情阶段并发按 `Math.floor(total/5)` 动态计算（最小 `1`，最大 `999`），并在进度条中显示真实执行并发（如 `1854 -> 370`、`8000 -> 999`）。
- 页数上限与并发上限分开管理：页数上限用于防无限分页，并发上限固定 `500`。
- 后端主存储恢复为根级总表：`statistics-data/statistics-merged.csv`。
- 默认下载总表：`.../statistics/download`（不要求 supplier 参数）。
- 供应商列表 `.../statistics/suppliers` 保留为辅助信息接口，不影响总表下载。
- 不再主动创建 `statistics-data/suppliers/`；该目录若本地已存在，属于旧方案残留，可忽略或手动清理。
- 转写与快判都接入 `shared/progress-indicator.js`；后续所有平台长耗时统计/导出上传任务默认复用该组件。

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

## 转写待补补齐口径

- `existing` 判断中 `exists=true` 不等于 `complete=true`，仍需按 `missingFields` 判断是否回流补齐。
- 任务名称为空的数据可保存但不算 complete；下次导出必须继续补齐。
- 转写任务名称补齐优先从 `detail/summary/taskMap` 汇总健康值，不允许 `detail` 空值覆盖健康值。

## LabelX：判断/转写防串表与历史 CSV 修复
- 新增 `platform-resources/alibaba-labelx/backend/asr-project-kind.js` 统一项目类型识别：`payload.project` / `payload.rawKeys.labelModel`（高优先） > `taskName` > CSV schema > 题数兜底（`400` 仅历史兜底）。
- 快判与转写后端都接入高置信防串表校验：判断数据不写入转写表，转写数据不写入判断表；拒绝原因通过 `rejectedItems` 返回。
- 新增历史修复工具：`node platform-resources/alibaba-labelx/backend/legacy-csv-repair.js --dry-run`、`--write --backup`。
- 历史修复会把误入转写 CSV 的判断数据迁移到快判 CSV，并修复供应商归一（海天 / 希尔贝壳 / 棋燊）。
- `statistics-data/` 为运行数据目录，修复仅本地或服务器执行，不提交 Git。

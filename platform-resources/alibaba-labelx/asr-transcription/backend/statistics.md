# Alibaba LabelX ASR 转写统计上传策略（0.2.11 修正）

## 版本说明

- 当前扩展版本保持 `0.2.11`。
- 本轮是 `0.2.11` 修正增强，不升级到 `0.2.12`。

## 目标

- 修正 0.2.11 初版的固定供应商列策略，改为动态供应商列。
- 修正转写统计抓取完整性，避免固定页数/条数导致漏数。
- 保持统计上传与定时上传为脚本默认能力（强制启用）。

## CSV 供应商列策略

- 内部合并键继续使用 `供应商 + 分包ID`，避免跨供应商同分包 ID 覆盖。
- CSV 写出时按当前数据集动态决定是否输出 `供应商`：
  - 单供应商数据集：不输出 `供应商` 列。
  - 多供应商数据集：在最后一列追加 `供应商` 列。
- 不再把 `供应商` 固定在中间列。
- CSV 写出前统一清洗字段：去 BOM、去首尾空白（含全角空格/Tab/换行/零宽字符），任务名称/ID/人员/时间/完成状态/供应商都不保留前后空格。

## 供应商识别优先级

1. `payload.supplier.name`
2. `payload.vendor.name`
3. `payload.supplier`
4. `payload.vendor`
5. `csvPatch["供应商"]`
6. `taskName/name` 推断（当前已知：`棋燊`、`希尔贝壳`）
7. `未识别供应商`

- 任务名识别前先做规范化：`decodeURIComponent`（失败回退原文）+ 去除 `BOM` + 清理前后空白（普通空格/Tab/换行/回车/全角空格）+ 连续空白规整，并生成去空白匹配串。
- 优先包含匹配：
  - 命中 `希尔贝壳` -> `希尔贝壳`
  - 命中 `棋燊` -> `棋燊`
- 若已有 `csvPatch["供应商"]` 为 `未识别供应商` / `unknown-supplier` / 空值，必须回退到任务名重新识别供应商。
- 示例：
  - ` 希尔贝壳-中文普通话asr任务-线上回流3rd-13` => `希尔贝壳`
  - ` 棋燊-中文普通话asr-线上回流2nd-45` => `棋燊`

## 转写抓取完整性口径

- 首页列表与详情列表都按 `recordCount` 计算总页数，不再固定 5 页/50 条/300 条。
- 首页会同时抓取：
  - `subTasks?finished=false`
  - `subTasks?finished=true`
- 详情接口：`/api/v1/label/center/subTask/{subTaskId}/data`
  - 优先 `pageSize=5000` 请求第一页。
  - 若 `recordCount > 5000`，继续分页补齐。
- 并发策略：
  - 详情阶段并发：`Math.floor(total / 5)`（`total` 为当前阶段待处理总数）。
  - 并发最小 `1`。
  - 并发硬上限 `999`（例如 `1854 -> 370`、`8000 -> 999`）。
- 分页上限：
  - 首页与详情都保留保护阈值。
  - 超限时明确告警并截断，不静默漏数。
- 页数上限与并发上限分开：页数上限用于防无限分页；并发上限固定 `500`。

## 上传进度显示

- 上传过程新增进度条（共享组件：`extension/shared/progress-indicator.js`）。
- 进度项包含：
  - 当前阶段
  - 已完成 / 总数
  - 百分比
  - 当前并发
  - 成功 / 失败数量
- 进度条并发显示值与实际执行并发一致（详情阶段同样按 `Math.floor(total / 5)`，最小 `1`，最大 `999`）。
- 同一进度组件已同步给快判统计；后续所有平台长耗时统计/导出任务默认复用该组件。

## 有效时长与人员解析

- 有效时长只累计“是否有效”严格等于“有效”的题目 `duration`。
- 不使用 `includes("有效")`，避免“无效”误判。
- 标注员/审核员解析新增 `dataResultHistory` 兜底：
  - 优先 `type === 0`。
  - 找不到则取最后一条。

## 落盘与下载

- 统计主写入：`statistics-data/statistics-merged.csv`。
- 不再主动创建 `statistics-data/suppliers/`；该目录若本地已存在，属于旧方案残留，可忽略或手动清理。
- 默认下载接口（总表）：`/api/alibaba-labelx/asr-transcription/statistics/download`
- 供应商列表接口：
  - `/api/alibaba-labelx/asr-transcription/statistics/suppliers`

## 参考边界

- `legacy-reference/asr-script.user.js` 仅用于逻辑参考（分页、并发、有效时长、`dataResultHistory`）。
- 不恢复 Tampermonkey 架构，不引入 `GM_xmlhttpRequest`，不恢复旧密码弹窗或危险自动提交流程。

## 0.2.11 中文乱码修正（CSV 健康值合并）

- 当前版本保持 `0.2.11`，本轮不升级 `0.2.12`。
- 统计 CSV 写入统一为 **UTF-8 with BOM**，提升 Excel 直接打开时的中文兼容性。
- CSV 写出前会清理关键字段（任务名称、标注员/审核员、供应商）的前后空白、BOM、零宽字符。
- 若旧 CSV 中存在 `�`（U+FFFD）损坏值，合并时优先采用新 payload 的健康值覆盖旧损坏值。
- 当 `供应商` 为 `未识别供应商`、`unknown-supplier`、空值或包含 `�` 时，必须回退到任务名称重新推断。
- LabelX 转写已知供应商仍按任务名优先识别：包含 `棋燊` -> `棋燊`，包含 `希尔贝壳` -> `希尔贝壳`。
- 主存储继续保持根级总表：`statistics-data/statistics-merged.csv`。
- 不主动生成 `statistics-data/suppliers/`，历史残留目录不作为主输出。
- 转写与快判后端都使用同一套“中文清洗 + 健康值优先”策略。
- 日志与错误信息继续脱敏，不记录 cookie、token、authorization、完整音频 URL。

## 0.2.11 导出完整性与断点跳过增强

- 当前版本保持 `0.2.11`，本轮不升级 `0.2.12`。
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

## 2026-05-10 0.2.11 失败判定修正
- LabelX 统计按标注/审核分角色逐步合并：另一角色字段为空属于正常情况，不再判失败。
- 只有 `分包ID` 为空时才直接废弃（discardedNoBatchId），不写 CSV、不上传。
- `任务名称/任务ID/人员/领取时间/提交时间/有效时长` 为空默认记为 warning/incomplete，不阻断上传。
- 批量上传改为“部分失败不影响成功数据保存”，后端返回 `acceptedCount/rejectedCount/rejectedItems`。
- 结束提示规则：仅当 `failed > 0` 才提示“有数据导出失败，请再次点击导出”；仅 warning 时提示“部分字段待后续角色补齐”。
- existing `complete` 按当前 role 最小条件判断：转写 `label=标注子任务ID`、`audit=审核子任务ID`；快判 `label=任一标注员子任务ID`、`audit=审核子任务ID`。
- 统计主存储继续为根级 `statistics-data/statistics-merged.csv`，不主动创建 `statistics-data/suppliers/`。
- 并发规则保持 `Math.floor(total / 5)`，最小 `1`，最大 `999`；定时上传保持 `10:00/16:00`，上传前随机延迟 `0~300s`（`100ms` 步进）。



## 2026-05-10 0.2.11 complete/跳过修正
- `existing` 接口中 `exists=true` 不等于 `complete=true`；只有满足最低完整条件才可跳过。
- 转写 `complete` 最低要求：`分包ID + 任务名称 + 任务ID + 题数 + 当前 role 对应子任务ID`。
- 快判 `complete` 最低要求：`分包ID + 任务名称 + 任务ID + 题数 + 当前 role 对应子任务ID（label 为任一标注员槽位ID）`。
- 任务名称为空不算失败，但必须判为 `complete=false`，下次导出继续拉详情补齐。
- `exists=true && complete=false` 必须继续拉详情与上传，不计入 `skippedComplete`。
- 无待上传数据（`payloads.length=0`）时不调用 `/statistics/upload`，提示“已全部完整，无需上传”。
- 上传进度板块宽度已增大（`min-width:560px`、`max-width:780px`、允许换行），四位数成功/失败数量可见。
- 主存储仍为根级 `statistics-data/statistics-merged.csv`，不主动生成 `statistics-data/suppliers/`。
- 版本保持 `0.2.11`。

## 2026-05-10 0.2.11 待补任务名称补齐规则

- `existing` 返回 `exists=true && complete=false` 时，前端必须继续拉取并上传补齐。
- 任务名称补齐来源优先级：`detail.taskName/name` -> `summary.taskName/name` -> `taskMap.taskName/name`。
- `detail` 任务名称为空时，不得覆盖 `summary/taskMap` 的健康任务名称。
- 后端合并同 `分包ID + role + subTaskId` 时优先复用旧行，允许健康新值覆盖旧空任务名称和`未识别供应商`。
- 无待上传 payload 时不调用 `/statistics/upload`，状态提示“已全部完整，无需上传”。

## 2026-05-10 0.2.11 进度悬浮窗样式补充

- 共享进度组件统一为页面顶部居中悬浮窗（fixed），不再挂在平台顶部导航内挤压布局。
- 进行中/完成/失败复用同一紧凑卡片布局，完成态不再出现横向绿色长条。
- 转写与快判上传按钮不再设置长 `title` 文案，悬停不再出现黑色长 tooltip。

# Alibaba LabelX ASR 转写网络请求（脱敏）

## 请求标识 / 目的

- 采集日期：2026-05-08
- 采集方式：Chrome DevTools / MCP（已登录会话，只读）
- 首页：`/corpora/labeling/labelingTask?projectId=<REDACTED_PROJECT_ID>`
- 详情页：`/corpora/labeling/sdk?...&missionType=label&projectId=<REDACTED_PROJECT_ID>&subTaskId=<REDACTED_SUBTASK_ID>`
- 追加采集日期：2026-05-09
- 追加页面：
  - 审核首页：`/corpora/labeling/checkTask?projectId=<REDACTED_PROJECT_ID>`
  - 审核详情页：`/corpora/labeling/sdk?missionType=check&projectId=<REDACTED_PROJECT_ID>&subTaskId=<REDACTED_SUBTASK_ID>`
- 通用接口结构已同步沉淀到 `../../network/README.md`。

## 页面入口 / 触发动作

- 采集日期：2026-05-08
- 采集方式：Chrome DevTools / MCP（已登录会话，只读）
- 首页：`/corpora/labeling/labelingTask?projectId=<REDACTED_PROJECT_ID>`
- 详情页：`/corpora/labeling/sdk?...&missionType=label&projectId=<REDACTED_PROJECT_ID>&subTaskId=<REDACTED_SUBTASK_ID>`
- 追加采集日期：2026-05-09
- 追加页面：
  - 审核首页：`/corpora/labeling/checkTask?projectId=<REDACTED_PROJECT_ID>`
  - 审核详情页：`/corpora/labeling/sdk?missionType=check&projectId=<REDACTED_PROJECT_ID>&subTaskId=<REDACTED_SUBTASK_ID>`
- 通用接口结构已同步沉淀到 `../../network/README.md`。

## 请求摘要

页面：`/corpora/labeling/sdk?missionType=label&projectId=<REDACTED_PROJECT_ID>&subTaskId=<REDACTED_SUBTASK_ID>`

- 操作：用户授权后点击 `提交任务`。
- 提交请求：
  - Method：`POST`
  - Path：`/api/v1/label/center/subTask/{subTaskId}/commit`
  - Request body：`subTaskId`
- 自动领取请求：
  - Method：`POST`
  - Path：`/api/v1/label/center/{taskId}/check/fetch`
  - Request body：
    - `taskId`
    - `type=check`
    - `autoFetch=true`
- 本轮页面行为：
  - 自动领取开关开启。
  - 提交后未进入新详情页，返回审核首页。
  - 审核首页随后请求 `subTasks?type=check`、`tasks?subTaskType=check`、`tasks/process?subTaskType=check`。

- 操作：用户授权后点击 `提交任务` 旁下拉菜单中的 `提交并结束`。
- 提交请求：
  - Method：`POST`
  - Path：`/api/v1/label/center/subTask/{subTaskId}/commit`
  - Request body：`subTaskId`
- 本轮页面行为：
  - 返回 `200`。
  - 随后进入审核首页 `/corpora/labeling/checkTask?projectId=<REDACTED_PROJECT_ID>`。
  - 首页重拉：
    - `GET /api/v1/label/center/subTasks?type=check`
    - `GET /api/v1/label/center/tasks?subTaskType=check`
    - `GET /api/v1/label/center/tasks/process?subTaskType=check`
  - 未触发 `/api/v1/label/center/{taskId}/check/fetch`。
- 结论：
  - 普通 `提交任务` 在自动领取开启时会触发 `check/fetch`。
  - `提交并结束` 只提交并返回首页，不自动领取下一包。

页面：`/corpora/labeling/sdk?missionType=check&projectId=<REDACTED_PROJECT_ID>&subTaskId=<REDACTED_SUBTASK_ID>`

## 请求体摘要

- 当前记录未见独立 request body；以路径参数或 query 为主。

## 响应摘要

- 快判样例（应排除）：
  - `taskName=ASR更优结果判断_...`
  - `size=400`
  - `labelModel=vote`
- 转写样例（应采集）：
  - `taskName=希尔贝壳-中文普通话asr任务-线上回流3rd-16`
  - `size=50`
  - `labelModel=single`
  - 子任务示例：`id=17863539`

本轮审核详情页为转写任务，`labelModel=single`，`size=50`。

## 关键字段

- `data.type`：审核态样例为 `CHECK`。
- `data.rejectReason`：审核被驳回原因摘要。
- `data.labelModel=single`。
- `data.taskType=custom`。
- `data.dataList[].data` 字段：
  - `seed_text`
  - `end_time`
  - `segment_duration`
  - `language`
  - `data_from`
  - `data_source`
  - `gaode_asr2_text`
  - `req_id`
  - `wav_id`
  - `duration`
  - `start_time`
  - `gaode_asr2_wer`
  - `raw_audio_path`
  - `audio_path`
  - `gaode_asr1_text`
  - `from`
  - `online_rec`
  - `segment_id`
  - `gaode_asr1_wer`
- `data.dataList[].result` 字段：
  - `markResult`

- 字段路径：
  - `data.dataList[].data.raw_audio_path`
  - `data.dataList[].data.audio_path`
  - `data.dataList[].data.wav_id`
  - `audio.currentSrc`
- `raw_audio_path` 和页面 `audio.currentSrc` 是完整签名 URL。
- 只允许记录：
  - hostname：`labelx.alibaba-inc.com`
  - pathname 后缀：`audio/<REDACTED_FILE>.wav`
  - query 参数名：`Expires`、`OSSAccessKeyId`、`Signature`

- 平台页面实测详情请求常见 `pageSize=10`；扩展统计上传为降低请求数量，优先使用 `pageSize=5000` 请求详情第一页。
- 首页列表与详情列表都按 `recordCount` 计算总页数，不再固定只抓前 `5` 页、`50` 子任务或 `300` 详情条目。
- 详情接口若 `recordCount > 5000`，继续分页补齐。
- 首页分页上限 `999` 页；详情分页上限 `999` 页，超限时明确告警并截断，不静默漏数。
- 详情抓取默认并发 `5`，并发硬上限 `999`，根据任务数量动态收敛。
- 遇空页、重复页签名或 `recordCount` 缺失时，会按运行态保护提前停止或告警。
- 上传运行态带全局锁：`upload-in-progress` 时跳过重复触发，避免手动连点和定时任务并发。
- `subTaskId` 必须先 `decode` 再清洗空白字符：
  - 普通空格、Tab、换行、回车、全角空格。
- 首页先过滤“转写任务”，再请求详情分页：
  - 排除：`labelModel=vote` 或任务名命中“ASR更优结果判断”等关键词。
  - 采集：`labelModel=single` 或任务名命中“中文普通话asr任务”等关键词，`size=50` 可作候选辅助。
- 有效时长应从详情分页 `dataList` 聚合 `duration` 秒值。
- 供应商字段当前不能从接口直接读取；统计实现需要从 `taskName` / `name` 前缀推断。

本轮在以下响应中均未发现 `supplier/vendor/company/provider/供应商` 字段：

- 转写标注首页历史采集：无。
- 转写标注详情页本轮采集：无。
- 转写审核首页本轮采集：无。
- 转写审核详情页本轮采集：无。
- `getLabelTaskInfo`：无。
- `summary` / `board`：无。

当前样例：

- `棋燊`：可从 `棋燊-...` 任务名前缀推断。
- `希尔贝壳`：历史采集样例中可从 `希尔贝壳-...` 任务名前缀推断。

推荐后续供应商识别优先级：

1. `payload.supplier.name`
2. `payload.vendor.name`
3. `payload.supplier`
4. `payload.vendor`
5. `csvPatch["供应商"]`
6. `taskName` / `name` 前缀规则推断
7. `未识别供应商`

## 前端接入建议

- 平台页面实测详情请求常见 `pageSize=10`；扩展统计上传为降低请求数量，优先使用 `pageSize=5000` 请求详情第一页。
- 首页列表与详情列表都按 `recordCount` 计算总页数，不再固定只抓前 `5` 页、`50` 子任务或 `300` 详情条目。
- 详情接口若 `recordCount > 5000`，继续分页补齐。
- 首页分页上限 `999` 页；详情分页上限 `999` 页，超限时明确告警并截断，不静默漏数。
- 详情抓取默认并发 `5`，并发硬上限 `999`，根据任务数量动态收敛。
- 遇空页、重复页签名或 `recordCount` 缺失时，会按运行态保护提前停止或告警。
- 上传运行态带全局锁：`upload-in-progress` 时跳过重复触发，避免手动连点和定时任务并发。
- `subTaskId` 必须先 `decode` 再清洗空白字符：
  - 普通空格、Tab、换行、回车、全角空格。
- 首页先过滤“转写任务”，再请求详情分页：
  - 排除：`labelModel=vote` 或任务名命中“ASR更优结果判断”等关键词。
  - 采集：`labelModel=single` 或任务名命中“中文普通话asr任务”等关键词，`size=50` 可作候选辅助。
- 有效时长应从详情分页 `dataList` 聚合 `duration` 秒值。
- 供应商字段当前不能从接口直接读取；统计实现需要从 `taskName` / `name` 前缀推断。

本轮在以下响应中均未发现 `supplier/vendor/company/provider/供应商` 字段：

- 转写标注首页历史采集：无。
- 转写标注详情页本轮采集：无。
- 转写审核首页本轮采集：无。
- 转写审核详情页本轮采集：无。
- `getLabelTaskInfo`：无。
- `summary` / `board`：无。

当前样例：

- `棋燊`：可从 `棋燊-...` 任务名前缀推断。
- `希尔贝壳`：历史采集样例中可从 `希尔贝壳-...` 任务名前缀推断。

推荐后续供应商识别优先级：

1. `payload.supplier.name`
2. `payload.vendor.name`
3. `payload.supplier`
4. `payload.vendor`
5. `csvPatch["供应商"]`
6. `taskName` / `name` 前缀规则推断
7. `未识别供应商`

## 风险 / 未确认项

- 不记录 cookie、SSO token、access token。
- 不记录完整签名音频 URL。
- 不记录完整 request headers。
- 仅记录接口路径、query 参数名、响应字段结构和业务关键字段。

- 不记录真实驳回理由全文。
- 不记录完整子任务 ID。
- 不记录请求头、cookie、authorization 或 token。

- 不同 `missionType`（`label/audit/review`）在详情页的数据字段差异。
- 扩展加载后的转写工具栏 DOM、按钮与快捷键行为。
- 在 `处理中` 或正常可编辑详情页复测多条 `dataList[]` 直接保存，确认高速全页填充是否可行。

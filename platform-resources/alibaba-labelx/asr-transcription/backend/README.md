# Alibaba LabelX ASR 转写统计后端

## 目录用途

本目录提供 ASR 转写统计上传、合并与 CSV 下载能力，路由由 `platform-resources/backend/server.js` 统一启动注册。

说明：浏览器扩展前端只保留 `extension/sites/alibaba-labelx/asr-transcription/transcription-stats-client.js` 作为统计上传客户端，不在前端实现 Node 服务或 CSV 落盘。
当前 `0.2.11` 稳定口径：转写统计内部按“供应商 + 分包ID”合并，主写入根级总表；历史供应商目录仅兼容读取，不作为主输出。
当前 `0.3.2` 新增“当前题 AI 推荐”接口：只返回辅助推荐，不做自动保存/提交。

## 统一 AI framework 桥接状态

- 当前阶段采用桥接式迁移，不重写转写统计上传和 CSV 合并链路。
- `POST /api/alibaba-labelx/asr-transcription/ai/suggest-current` 已改为通过 `platform-resources/backend/ai-framework/` route factory 驱动。
- `platform-resources/alibaba-labelx/asr-transcription/ai/adapter.js` 负责：
  - 请求映射到统一输入契约
  - 旧 success / error body 兼容
  - 转写推荐结果暴露给 framework 的脚本级结果通道
- `platform-resources/alibaba-labelx/asr-transcription/backend/ai-suggest-request.js` 负责 AI 请求归一、AI 参数清洗与脱敏错误辅助函数，供 adapter 与业务层共用。
- `GET /api/alibaba-labelx/asr-transcription/ai/suggest-current/health` 与 `GET /api/alibaba-labelx/asr-transcription/ai/defaults` 当前已补齐公共 jobs / runtime 元信息，默认链路为 `POST /jobs` + 轮询 `GET /jobs/:jobId`。
- 统计上传、existing 检查、suppliers、download 与 CSV 落盘链路本轮不动。

## 统一下载 core 桥接状态

- 当前阶段保留转写统计外部下载接口不变，不把脚本下载入口改成 `admin/project-data-download`。
- `GET/HEAD /api/alibaba-labelx/asr-transcription/statistics/download`
- `GET /api/alibaba-labelx/asr-transcription/statistics/suppliers`
- `POST /api/alibaba-labelx/asr-transcription/statistics/existing`
- 上述 3 条链路已开始复用：
  - `platform-resources/backend/project-data-download/labelx-download-core.js`
  - `platform-resources/backend/project-data-download/labelx-existing-core.js`
- 转写脚本级差异由 `platform-resources/alibaba-labelx/asr-transcription/data/adapter.js` 提供。
- 上传、CSV 合并、落盘与 suppliers 识别底层 store 仍保留在当前 `backend/`，本轮不动。

## 默认数据目录

- `platform-resources/alibaba-labelx/asr-transcription/backend/statistics-data/`
- 主 CSV：`statistics-data/statistics-merged.csv`
- 历史 `statistics-data/suppliers/<供应商>/statistics-merged.csv` 若本地存在，仅作为兼容读取迁移，不主动创建、不继续写入。

## 环境变量

- `ASR_TRANSCRIPTION_STATS_DIR`：统计输出目录。
- `ASR_TRANSCRIPTION_PERSIST_ROWS_JSON=1`：额外写入 `statistics-rows.json`。
- `ASR_TRANSCRIPTION_PERSIST_UPLOAD_EVENTS=1`：额外写入 `statistics-upload-events.jsonl`。
- `ASR_TRANSCRIPTION_AI_MOCK=1`：启用转写 AI mock 调试模式。
- `ASR_TRANSCRIPTION_AI_LISTEN_MODEL`：听音模型，默认 `qwen3.5-omni-flash`。
- `ASR_TRANSCRIPTION_AI_COMPARE_MODEL`：文本比较模型，默认 `qwen3.5-plus`。
- `ASR_TRANSCRIPTION_AI_TIMEOUT_MS`：AI 请求超时，默认 `60000`。
- `ASR_TRANSCRIPTION_AI_ENABLE_THINKING`：默认 `0`，开启时尝试传 `enable_thinking=true`。
- `ASR_TRANSCRIPTION_AI_ALLOW_CLIENT_MODEL_OVERRIDE`：默认 `1`，允许请求体覆盖模型名。

## 接口

- `GET /api/alibaba-labelx/asr-transcription/statistics/health`
- `GET /api/alibaba-labelx/asr-transcription/statistics/config`
- `GET /api/alibaba-labelx/asr-transcription/statistics/upload?purpose=schedule`
- `POST /api/alibaba-labelx/asr-transcription/statistics/upload`
- `GET /api/alibaba-labelx/asr-transcription/statistics/suppliers`
- `GET /api/alibaba-labelx/asr-transcription/statistics/download`
- `HEAD /api/alibaba-labelx/asr-transcription/statistics/download`
- `GET /api/alibaba-labelx/asr-transcription/ai/suggest-current/health`
- `GET /api/alibaba-labelx/asr-transcription/ai/defaults`
- `POST /api/alibaba-labelx/asr-transcription/ai/suggest-current`
- `GET /api/alibaba-labelx/asr-transcription/ai/suggest-current/logs/summary`

下载接口默认返回根级总表，不要求 `supplier` 参数；`suppliers` 接口仅作为辅助信息接口。下载文件名统一带 `YYYYMMDD-HHmm`（Asia/Shanghai）。
- 总表：`asr-transcription-statistics-merged-YYYYMMDD-HHmm.csv`
- 供应商：`asr-transcription-<供应商safeName>-statistics-YYYYMMDD-HHmm.csv`
- `supplier` 有值但无匹配时返回 `404`，不回退总表。
- `existing` 当前也走共享 LabelX existing core，但返回结构保持原样：`success + data.items`。

## AI 调用日志与统计

- 转写当前题 AI 推荐现在会默认写调用日志。
- 日志文件：
  - `platform-resources/alibaba-labelx/asr-transcription/backend/logs/ai-calls-YYYY-MM-DD.csv`
- 统计接口：
  - `GET /api/alibaba-labelx/asr-transcription/ai/suggest-current/logs/summary`

兼容短路径：

- `GET /api/asr-transcription/statistics/health`
- `GET /api/asr-transcription/statistics/config`
- `GET /api/asr-transcription/statistics/upload?purpose=schedule`
- `POST /api/asr-transcription/statistics/upload`

## 默认定时配置

- `times`: `["10:00","16:00"]`
- 定时上传在真正 POST 前增加随机延迟：`0~300` 秒、`100ms` 步进（手动上传不延迟）。

## CSV 列顺序

CSV 写出时按当前供应商集合动态决定是否输出“供应商”列：

- 单供应商数据集：不输出“供应商”列。
- 多供应商数据集：在最后一列追加“供应商”列。

单供应商数据集默认列顺序：

```
任务名称,任务ID,标注子任务ID,审核子任务ID,分包ID,题数,有效时长,标注员,审核员,标注领取时间,标注提交时间,审核领取时间,审核提交时间,标注是否完成,审核是否完成
```

## 合并规则

1. 以“供应商 + 分包ID”（`mergeKey.supplierKey + "::" + mergeKey.batchId`）合并。
2. 供应商识别优先级：`payload.supplier.name`、`payload.vendor.name`、`payload.supplier`、`payload.vendor`、`csvPatch["供应商"]`、`taskName/name` 规则推断、`未识别供应商`。
   - 命中 `海天` 归一为 `海天`；命中 `贝壳` / `希尔贝壳` 归一为 `希尔贝壳`；命中 `棋燊` 归一为 `棋燊`；`supplier=H` + 海天任务名归一为 `海天`。
3. `csvPatch` 只用于基础字段：`任务名称/任务ID/分包ID/题数/有效时长`，可带 `供应商` 作为识别兜底。
4. 后端 `applyBasePatch` 会忽略 `csvPatch` 里所有角色字段（标注/审核字段），避免前端误传污染 CSV。
5. `role=label` 仅写标注字段；`role=audit` 仅写审核字段，双方互不覆盖。
6. `roleRecord.role` 必须为 `label` 或 `audit`，缺失/非法会直接拒绝写入并返回错误。
7. 有提交时间优先判定“已完成”；否则按状态值；无法判断写“未完成”。
8. `有效时长` 使用自然小数格式（最多 4 位，去尾零）。
9. 项目类型识别优先级：`payload.project`、`payload.rawKeys.labelModel`（高优先）；其次 `taskName` 关键词；再次 CSV schema；最后题数兜底（`400` 仅历史兜底）。
10. 防串表：检测到高置信判断数据（如 `project=...asr-judgement` 或 `labelModel=vote`）会拒绝写入转写统计表，并通过 `rejectedItems` 返回原因。

## 安全要求

- 不写入 token、cookie、完整音频 URL、完整签名 URL。
- 上传日志只输出：`requestId`、`projectId`、`batchId`、`payloadCount`、`rowCount`、`csvPath`。

共享下载相关文件职责补充：

- `platform-resources/backend/project-data-download/labelx-download-core.js`：LabelX 下载文件名、响应头、供应商过滤与 `GET/HEAD /download` 共享主流程。
- `platform-resources/backend/project-data-download/labelx-existing-core.js`：LabelX `existing` 分包分组与返回项组装共享流程。
- `platform-resources/alibaba-labelx/asr-transcription/data/adapter.js`：转写下载 / existing 的脚本级差异。

历史兼容说明：

- 旧 CSV 表头 `有效时长(秒)` 在读取时会自动归一为 `有效时长`。
- 统计运行数据目录（`statistics-data/`）属于本地产物，不提交 Git。
- 历史修复工具：`node platform-resources/alibaba-labelx/backend/legacy-csv-repair.js --dry-run`（预览）与 `--write --backup`（写入并备份）；运行 CSV 修复仅本地执行，不提交 Git。
## 手动取消跳过上传（转写）

- 首页 / 列表页手动点击“上传转写统计”时，仍会先执行 existing 检查；`complete=true` 的分包默认跳过。
- 普通手动上传结束后，如果本轮存在 `skippedCompleteCount > 0`，前端会显示“补传并覆盖当前人员”按钮。
- 点击按钮后前端改用 `reason=home-manual-force-replace`，重新拉取本轮范围内全部转写详情，不再按 `complete=true` 过滤。
- force replace payload 会显式携带 `forceReplaceByBatchId=true`、`replaceMode="batch"` 和去重后的 `replaceBatchIds`。
- 后端 `payload-merge.js` 继续以 `分包ID` 归并行，但 force replace 不再删整行；只会局部覆盖当前 `label / audit` 角色列，空字段不会把旧值清空。
- 定时上传不会显示 force 按钮，也不会触发当前人员局部覆盖。
- 详情页第一版不默认支持 force replace，避免详情页只拿到单角色时误判当前人员覆盖范围。
- CSV 结构不变，`statistics-data/` 仍是本地运行数据，不提交 Git。

## CSV 字段命名口径修复

- 转写导出表头中的业务时长字段恢复为 `有效时长(秒)_S`。
- 人员统计字段统一追加 `_P`：`标注员_P`、`审核员_P`。
- `_S` 表示参与时长统计 / 结算的字段，`_P` 表示人员字段；只加在指定业务字段上。
- 旧字段 `有效时长` / `有效时长(秒)` 会兼容迁移到 `有效时长(秒)_S`；旧人员字段 `标注员` / `审核员` 会迁移到 `_P` 字段。
- 新下载 CSV 不再输出旧字段重复列；运行数据目录 `statistics-data/` 仍不提交 Git。

# 快判本地服务（统计 + AI 建议）

当前对应扩展版本：`0.2.11`。

该目录是 ASR 快判 Node 本地服务代码，当前包含两类接口：

- 统计上传与 CSV 下载
- AI 半自动参考建议（health / suggest）

它不会被扩展 manifest 注入到 LabelX 页面，也不属于浏览器扩展运行时代码。Chrome / Edge 共用的 `extension/` 扩展源码都可以使用这个本地调试服务。

## 启动方式

在仓库根目录运行：

```powershell
node platform-resources\backend\server.js
```

默认监听：

```text
http://127.0.0.1:3333
```

AI 接口：

```text
http://127.0.0.1:3333/api/alibaba-labelx/asr-judgement/ai/health
http://127.0.0.1:3333/api/alibaba-labelx/asr-judgement/ai/defaults
http://127.0.0.1:3333/api/alibaba-labelx/asr-judgement/ai/suggest
http://127.0.0.1:3333/api/alibaba-labelx/asr-judgement/ai/suggest/logs/summary
```

定时配置检查地址：

```text
http://127.0.0.1:3333/api/alibaba-labelx/asr-judgement/statistics/config
```

扩展实际会优先对“上传接口地址”发起 `GET` 请求并追加 `purpose=schedule`，例如：

```text
http://127.0.0.1:3333/api/alibaba-labelx/asr-judgement/statistics/upload?purpose=schedule
```

供应商列表地址：

```text
http://127.0.0.1:3333/api/alibaba-labelx/asr-judgement/statistics/suppliers
```

CSV 下载地址（默认总表，文件名带 `YYYYMMDD-HHmm`）：

```text
http://127.0.0.1:3333/api/alibaba-labelx/asr-judgement/statistics/download
http://127.0.0.1:3333/api/alibaba-labelx/asr-judgement/statistics/download?supplier=<供应商>
```

旧启动入口仍可用：

```powershell
node platform-resources\alibaba-labelx\asr-judgement\backend\server.js
```

旧接口路径也继续兼容：

```text
http://127.0.0.1:3333/api/asr-judgement/statistics/upload
```

CSV 下载旧路径 `/api/asr-judgement/statistics/download` 已移除，不再兼容。

可用环境变量：

- `ASR_JUDGEMENT_SERVER_HOST`：监听地址，默认 `127.0.0.1`。
- `ASR_JUDGEMENT_SERVER_PORT`：监听端口，默认 `3333`。
- `ASR_JUDGEMENT_STATS_DIR`：统计输出目录，默认 `platform-resources/alibaba-labelx/asr-judgement/backend/statistics-data/`。
- `ASR_JUDGEMENT_PERSIST_ROWS_JSON`：设为 `1` 时额外写入 `statistics-rows.json`，默认不写。
- `ASR_JUDGEMENT_PERSIST_UPLOAD_EVENTS`：设为 `1` 时额外写入 `statistics-upload-events.jsonl`，默认不写。
- `DASHSCOPE_API_KEY`：Qwen API Key，仅后端读取；扩展前端不存储该 key。
- `DASHSCOPE_BASE_URL`：可选，默认 `https://dashscope.aliyuncs.com/compatible-mode/v1`。
- `ASR_JUDGEMENT_AI_MODEL`：默认 `qwen3-omni-flash`，预留 `qwen3.5-omni-plus`。
- `ASR_JUDGEMENT_AI_TIMEOUT_MS`：AI suggest 超时，默认 `60000`。
- `ASR_JUDGEMENT_AI_MOCK`：仅设为 `1` 时启用 mock；默认关闭，主流程真实调用 Qwen。

## 统一 AI framework 桥接状态

- 当前阶段采用桥接式迁移，不重写快判统计上传和 CSV 合并链路。
- `POST /api/alibaba-labelx/asr-judgement/ai/suggest` 已改为通过 `platform-resources/backend/ai-framework/` route factory 驱动。
- `platform-resources/alibaba-labelx/asr-judgement/ai/adapter.js` 负责：
  - 请求映射到统一输入契约
  - 旧 success / error body 兼容
  - 快判建议结果暴露给 framework 的脚本级结果通道
- `platform-resources/alibaba-labelx/asr-judgement/backend/ai-suggest-request.js` 负责 AI 请求归一、AI 参数清洗与脱敏错误辅助函数，供 adapter 与业务层共用。
- `GET /api/alibaba-labelx/asr-judgement/ai/health` 与 `GET /api/alibaba-labelx/asr-judgement/ai/defaults` 当前已补齐公共 jobs / runtime 元信息，默认链路为 `POST /jobs` + 轮询 `GET /jobs/:jobId`。
- 统计上传、existing 检查、suppliers、download 与 CSV 落盘链路本轮不动。

## 统一下载 core 桥接状态

- 当前阶段保留快判统计外部下载接口不变，不把脚本下载入口改成 `admin/project-data-download`。
- `GET/HEAD /api/alibaba-labelx/asr-judgement/statistics/download`
- `GET /api/alibaba-labelx/asr-judgement/statistics/suppliers`
- `POST /api/alibaba-labelx/asr-judgement/statistics/existing`
- 上述 3 条链路已开始复用：
  - `platform-resources/backend/project-data-download/labelx-download-core.js`
  - `platform-resources/backend/project-data-download/labelx-existing-core.js`
- 快判脚本级差异由 `platform-resources/alibaba-labelx/asr-judgement/data/adapter.js` 提供。
- 上传、CSV 合并、落盘与 suppliers 识别底层 store 仍保留在当前 `backend/`，本轮不动。

## 文件职责

- `index.js`：供统一后端入口注册本项目 API。
- `routes.js`：HTTP 路由、健康检查、上传接口、定时配置接口；快判下载 / suppliers / existing 现在通过共享 LabelX 下载 core 驱动。
- `server.js`：兼容旧用法的本项目独立启动入口。
- `http-server.js`：兼容旧用法的本项目 HTTP server 包装层。
- `payload-merge.js`：按“供应商 + 分包ID”合并上传补丁记录，填充标注员 / 审核员宽表列。
- `file-store.js`：默认写入根级 `statistics-data/statistics-merged.csv`，必要时可兼容读取历史供应商目录和旧 `statistics-rows.json`。
- `csv-columns.js`：CSV 列顺序定义。
- `csv-writer.js`：CSV 转义和写入。
- `ai-routes.js`：AI health/defaults/suggest 路由桥接层，接统一 `ai-framework` route factory，并保持旧返回结构兼容。
- `ai-suggest-request.js`：快判 AI 请求归一、模型参数清洗、脱敏错误辅助函数。
- `ai-client-qwen.js`：DashScope Qwen 客户端（OpenAI-compatible chat completions + stream=true）。
- `ai-prompt.js`：读取 `./ai/` 规则资料并拼装 prompt。
- `ai-response-schema.js`：模型输出 JSON 解析、枚举校验、`answer -> choiceActionKey` 映射、置信度归一化。

## 接口约定

- `POST /api/alibaba-labelx/asr-judgement/statistics/upload`：接收单个分包补丁 payload，也接收首页批量上传的 `{ payloads: [...] }` 信封。服务端会逐条按 `mergeKey.supplierKey + "::" + mergeKey.batchId`（等价于“供应商 + 分包ID”）合并。
- `GET /api/alibaba-labelx/asr-judgement/statistics/upload?purpose=schedule`：返回定时上传配置，供扩展从同一个上传接口地址读取时间。
- `GET /api/alibaba-labelx/asr-judgement/statistics/config`：返回同样的定时上传配置，便于本地直接调试。
- `GET /api/alibaba-labelx/asr-judgement/statistics/health`：健康检查和当前 CSV 路径。
- `GET /api/alibaba-labelx/asr-judgement/statistics/suppliers`：列出当前可下载供应商。
- `GET /api/alibaba-labelx/asr-judgement/statistics/download`：默认下载根级总表，文件名为 `asr-judgement-statistics-merged-YYYYMMDD-HHmm.csv`。
- `GET /api/alibaba-labelx/asr-judgement/statistics/download?supplier=<供应商>`：按供应商过滤后下载，文件名为 `asr-judgement-<供应商safeName>-statistics-YYYYMMDD-HHmm.csv`；若无匹配数据返回 `404`，不回退总表。
- `POST /api/alibaba-labelx/asr-judgement/statistics/existing`：当前也走共享 LabelX existing core，但返回结构保持原样：`success + data.items`。
- `GET /api/alibaba-labelx/asr-judgement/ai/health`：AI 服务健康检查，返回 `hasApiKey`、`mockEnabled`、`defaultModel` 等状态。
- `GET /api/alibaba-labelx/asr-judgement/ai/defaults`：返回前端 AI 面板默认模型、Prompt 模板与支持参数。
- `POST /api/alibaba-labelx/asr-judgement/ai/suggest`：只分析当前题，返回建议答案、置信度、理由、风险等级和 requestId。
- `GET /api/alibaba-labelx/asr-judgement/ai/suggest/logs/summary`：返回 AI 调用日志统计汇总。

为了兼容旧版扩展默认地址，上传、定时配置和健康检查仍保留 `/api/asr-judgement/statistics/...` 旧路径；CSV 下载旧路径不保留。

AI 接口没有旧路径别名，统一使用 `/api/alibaba-labelx/asr-judgement/ai/...`。

模型与校验规则：

- 请求体未传 `model` 时，后端使用 `ASR_JUDGEMENT_AI_MODEL`；若该环境变量非法，则回退 `qwen3-omni-flash`。
- 请求体传了 `model` 且不在允许列表（`qwen3-omni-flash`、`qwen3.5-omni-plus`）时，`suggest` 返回 `HTTP 400`，`code=invalid-model`。
- AI 文本 prompt 只包含 `asrText1/asrText2`；`projectId/subTaskId/itemId/itemIndex/audioUrl` 不写入文本 prompt。
- `audioUrl` 只作为模型音频输入字段使用。

如果未配置 `DASHSCOPE_API_KEY`：

- 服务仍可启动；
- `health` 返回 `status=missing-api-key`；
- `suggest` 返回 `success=false` 和 `missing-api-key`，不会把缺 key 当作 mock 成功。

AI 日志与数据边界：

- 后端日志不输出完整 `audioUrl`，只允许记录 `requestId`、`hostname`、`itemIndex`、`model`。
- 返回体不回传 API Key，不回传完整 `audioUrl`。

## AI 调用日志与统计

- 快判当前题 AI 建议现在会默认写调用日志。
- 日志文件：
  - `platform-resources/alibaba-labelx/asr-judgement/backend/logs/ai-calls-YYYY-MM-DD.csv`
- 统计接口：
  - `GET /api/alibaba-labelx/asr-judgement/ai/suggest/logs/summary`

## 真实 Qwen 联调检查项

1. `DASHSCOPE_API_KEY` 已配置，且当前 shell 环境可读到该变量。
2. `DASHSCOPE_BASE_URL` 与账号可用区域一致（默认 `https://dashscope.aliyuncs.com/compatible-mode/v1`）。
3. 目标模型 `qwen3-omni-flash` 在当前账号可用。
4. `audioUrl` 为 Qwen 可访问的公开短音频 URL。
5. 若 `suggest` 报音频输入格式错误，需要根据 DashScope 当前文档调整 `audio_url` / `input_audio` 字段结构。
6. 若未配置 key 或没有可访问音频 URL，不应声称“真实 suggest 已跑通”。

建议验证命令：

- `GET /health`：检查 `hasApiKey`、`defaultModel`、`effectiveDefaultModel`。
- 非法模型：`POST /suggest` with `model=bad-model`，预期 `HTTP 400` + `code=invalid-model`。
- 缺 key：未配置 `DASHSCOPE_API_KEY` 且 `ASR_JUDGEMENT_AI_MOCK!=1` 时，预期 `suggest` 返回 `missing-api-key`，服务不崩溃。

## 统计规则

- 扩展侧统计上传模块：`extension/sites/alibaba-labelx/asr-judgement/asr-judgement-server.js`。
- 首页、详情页和定时上传统一按 `projectId` 采集该账号在当前项目下的标注 / 审核分包。
- 不再保留“详情页当前 `subTaskId` 单条上传”回退。
- 统计只保留 ASR 更优判断数据：优先按 `labelModel=vote` 判断；接口缺失时用 `taskName` 包含 `ASR更优结果判断` / `ASR更优` 且 `size=400` 兜底。
- `labelModel=single`、`taskName=中文普通话asr任务` 或 `size=50` 视为历史转写数据并跳过。
- 有效时长以秒为单位，保留 4 位小数。
- 单条 payload 的基础字段放在 `csvPatch`。
- 当前子任务身份放在 `roleRecord`。
- 服务端按 `mergeKey.supplierKey + "::" + mergeKey.batchId`（等价于“供应商 + 分包ID”）做幂等合并。
- 多个标注员和审核员的记录会合并成同一行 CSV 宽表。
- 供应商识别优先级：`payload.supplier.name`、`payload.vendor.name`、`payload.supplier`、`payload.vendor`、`csvPatch["供应商"]`、`taskName/name` 规则推断、`未识别供应商`。
- 供应商规则补充：任务名命中 `海天` 识别为 `海天`；命中 `贝壳` / `希尔贝壳` 统一为 `希尔贝壳`；命中 `棋燊` 识别为 `棋燊`；`supplier=H` 且任务名含海天语义时归一为 `海天`。
- 项目类型识别优先级：`payload.project` 与 `payload.rawKeys.labelModel`（高优先）；其次 `taskName` 关键词；再次 CSV schema；最后 `题数`（`400` 仅历史兜底）。
- 防串表：检测到高置信转写数据（如 `project=...asr-transcription` 或 `labelModel=single`）会拒绝写入快判统计表，并通过 `rejectedItems` 返回原因。
- CSV 写出时动态处理“供应商”列：单供应商数据集不输出；多供应商数据集在最后一列追加。

## 快判统计双键槽位校验修复

- 本次修复目标是“清空旧数据后重新全量上传”的未来正确性；不兼容历史脏数据，不提供历史 CSV 自动修复或迁移。
- 启用前需要人工备份并清空服务端现有快判统计数据，再使用新代码重新上传。
- 标注槽位分配规则已收紧为 `用户名 + subTaskId` 双键：
  - 两个键都相同：复用原槽位并覆盖更新该槽位字段。
  - `subTaskId` 相同但用户名不同：拒绝上传，返回“子任务ID命中但用户名不一致”类冲突。
  - 用户名相同但 `subTaskId` 不同：拒绝上传，返回“用户名命中但子任务ID不一致”类冲突。
  - 三个槽位无双键命中但存在空槽位：写入第一个空槽位。
  - 三个槽位都已占满且无双键命中：保持现有“同一供应商分包超过 3 个标注员子任务”拒绝逻辑。
- 审核槽位规则本轮不变，仍保持原单槽位语义。
- `POST /api/alibaba-labelx/asr-judgement/statistics/upload` 现在要求标注 payload 的 `roleRecord.userName` 必填；缺失时该条会被放入 `rejectedItems`，不再允许写入无用户名槽位。
- `POST /api/alibaba-labelx/asr-judgement/statistics/existing` 的 label 请求项现在支持传入 `userName`；响应结构保持 `success + data.items` 不变。
- existing 对标注角色的 `complete` 判定已改为双键精确命中：
  - 只有同一槽位同时命中 `用户名 + subTaskId` 时才返回 `complete=true`。
  - 只命中一个键时返回 `complete=false`，避免前端把冲突数据误判为“已上传可跳过”。
- 前端首页上传对 label existing 现已区分两类跳过：
  - `完整跳过`：双键精确命中，前端记入 `skippedCompleteCount`。
  - `冲突跳过`：单键命中冲突，前端记入 `skippedConflictCount`，不再继续上传，也不参与 force replace。
- 这轮不新增服务端“清空统计数据”接口，清空旧数据继续由人工运维完成。

共享下载相关文件职责补充：

- `platform-resources/backend/project-data-download/labelx-download-core.js`：LabelX 下载文件名、响应头、供应商过滤与 `GET/HEAD /download` 共享主流程。
- `platform-resources/backend/project-data-download/labelx-existing-core.js`：LabelX `existing` 分包分组与返回项组装共享流程。
- `platform-resources/alibaba-labelx/asr-judgement/data/adapter.js`：快判下载 / existing 的脚本级差异。

## CSV 宽表字段

当前统计 CSV 列顺序：

```text
任务名称,任务ID,标注员1子任务ID,标注员2子任务ID,标注员3子任务ID,审核子任务ID,分包ID,题数,有效时长,标注员1,标注员2,标注员3,审核员,标注员1领取时间,标注员1提交时间,标注员2领取时间,标注员2提交时间,标注员3领取时间,标注员3提交时间,审核领取时间,审核提交时间,标注员1是否完成,标注员2是否完成,标注员3是否完成,审核是否完成
```

## 输出文件

默认输出在当前服务目录下的 `statistics-data/`：

- `statistics-merged.csv`：根级总表（主输出）。
- `suppliers/<供应商>/statistics-merged.csv`：历史残留目录（如存在仅兼容读取，不作为主输出）。

默认不再写入 `statistics-upload-events.jsonl` 和 `statistics-rows.json`，避免 10 万级分包数据重复占用磁盘。需要临时排查时，可以把 `ASR_JUDGEMENT_PERSIST_ROWS_JSON=1` 或 `ASR_JUDGEMENT_PERSIST_UPLOAD_EVENTS=1` 加到启动环境变量中。

`statistics-data/` 是本地调试产物，已在本目录 `.gitignore` 中忽略。

历史兼容说明：

- 旧 CSV 表头 `有效时长(秒)` 在读取时会自动归一为 `有效时长`。
- 统计运行数据目录（`statistics-data/`）属于本地产物，不提交 Git。
- 历史修复工具：`node platform-resources/alibaba-labelx/backend/legacy-csv-repair.js --dry-run`（预览）和 `--write --backup`（写入并备份）；运行 CSV 修复仅本地执行，不提交 Git。
## 手动取消跳过上传（快判）

- 首页 / 列表页手动点击“上传统计”时，仍会先调用 existing 检查；`complete=true` 的分包默认跳过，不重复拉详情。
- single-key 双键冲突分包当前会在前端直接记为“冲突跳过”，不重拉详情、不上传，也不会触发“补传并覆盖当前人员”。
- 只有手动首页上传结束后，且本轮 `skippedCompleteCount > 0` 时，顶部按钮旁才会出现“补传并覆盖当前人员”。
- 点击后前端会改用 `reason=home-manual-force-replace`，重新拉取本轮范围内的全部快判详情，不再按 `complete=true` 跳过。
- 强制上传 payload 会带上 `forceReplaceByBatchId=true`、`replaceMode="batch"` 和 `replaceBatchIds`。
- 后端收到 force replace 后，不再按 `replaceBatchIds` 删除旧 CSV 行；只会覆盖当前标注员槽位或当前审核列，空字段不会把旧值清空。
- 定时上传 `reason=schedule` 仍保留默认跳过逻辑，不显示“补传并覆盖当前人员”，也不会触发当前人员局部覆盖。
- 详情页第一版不显示 force replace 按钮，避免详情页只上传单角色后误判当前人员覆盖范围。
- CSV 字段口径不变，`statistics-data/` 仍属于运行产物，不提交 Git。
- force replace 也遵循标注双键规则：只允许同一 `用户名 + subTaskId` 覆盖原槽位；单键命中冲突不会再被 existing 错误跳过，也不会自动并槽。

## CSV 字段命名口径修复

- 快判导出表头中的业务时长字段恢复为 `有效时长(秒)_S`。
- 人员统计字段统一追加 `_P`：`标注员1_P`、`标注员2_P`、`标注员3_P`、`审核员_P`。
- `_S` 表示参与时长统计 / 结算的字段，`_P` 表示人员字段；只加在指定业务字段上，不泛化到所有列。
- 旧字段 `有效时长` / `有效时长(秒)` 会兼容迁移到 `有效时长(秒)_S`；旧人员字段会迁移到对应 `_P` 字段。
- 新下载 CSV 不再输出旧字段重复列；运行数据目录 `statistics-data/` 仍不提交 Git。

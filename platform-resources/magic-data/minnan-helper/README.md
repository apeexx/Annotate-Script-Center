# 闽南语助手（Magic Data）资料

本目录只维护闽南语助手专属资料。

## 实际文件与职责

- `ai/adapter.js`：闽南语助手接入统一 `ai-framework` 的项目 adapter。
- `ai/assets/README.md`：AI 资产目录占位说明。
- `data/README.md`：脚本级 data 目录占位说明。
- `backend/index.js`：闽南语助手后端注册入口。
- `backend/ai-routes.js`：闽南语助手 AI 路由注册；`review-current` 已改为通过统一 `ai-framework` route factory 驱动，但外部响应结构保持兼容。
- `backend/ai-*.js`：闽南语助手 AI 能力实现（模型调用、Prompt、词表、日志、成本估算）。
- `backend/lexicon/minnan-lexicon.json`：闽南语业务词表运行时主文件。
- `backend/lexicon/minnan-lexicon.csv`：闽南语词表参考源。
- `backend/tools/convert-hakka-lexicon.js`：闽南语词表转换脚本（文件名保留兼容，输入输出已是闽南语词表）。
- 运行时缺少 `minnan-lexicon.json` 但本地 `minnan-lexicon.csv` 仍存在时，页面会在右下角弹出一次“没有字词对应表”提示，停留约 1 秒后自动消失；复核链路继续按无词表模式返回，不回退成 CSV 主读取。
- `network/.gitkeep`：当前无助手专属 Network 差异；共用结构见平台根目录 `network/`。
- `page-structure/.gitkeep`：当前无助手专属页面结构差异；共用结构见平台根目录 `page-structure/`。

## 接口

- `GET /api/magic-data/minnan-helper/ai/review-current/health`
- `GET /api/magic-data/minnan-helper/ai/defaults`
- `POST /api/magic-data/minnan-helper/ai/review-current`

## AI 链路

- 模型方案（`modelMode`）：
  - `two_stage`：听音模型 + 比较/转换模型
  - `omni_single`：单模型完成听音与质检
- 识别策略（`recognitionStrategy`）：
  - `direct_dialect`：直接识别方言文本
  - `mandarin_to_dialect`：先识别普通话，再结合闽南词表转换闽南语
- 兼容旧字段：`aiReviewRecognitionMode=recognition_convert` 会映射为 `two_stage + mandarin_to_dialect`。
- 配置保存链路修复后，`aiReviewModelMode/aiReviewRecognitionStrategy` 为显式优先；legacy `recognition_convert` 仅用于无显式字段的迁移兜底，不再反向覆盖用户选择。
- options 已移除 `AI 质检模式` 展示，闽南语助手统一按 `modelMode + recognitionStrategy` 配置和保存。
- 输出结构以“三项预测质检”为主：
  - `speakerCheck`（性别/年龄）
  - `dialectTextCheck`（闽南语文本）
  - `mandarinTextCheck`（普通话文本）
  - `overall`（结论/摘要）
- 同时兼容 Magic Data 旧面板字段：`recommendations.*`、`audioCheck.*`、`textRuleCheck.*`，并保留 `listen/comparison/verdict` legacy 字段。
- `mandarin_to_dialect` 中间产物输出到 debug/raw（脱敏）：
  - `recognizedMandarinText`
  - `convertedDialectText`
  - `lexiconMatches`
  - `conversionWarnings`
  - `recognitionStrategy=mandarin_to_dialect`

## AI 调用日志与统计

- 闽南语助手当前已默认记录每次 `review-current` 调用。
- 日志文件：
  - `platform-resources/magic-data/minnan-helper/backend/logs/ai-calls-YYYY-MM-DD.csv`
- 统计接口：
  - `GET /api/magic-data/minnan-helper/ai/review-current/logs/summary`

## 说话人数据来源

- 优先读取 `annotateDetailInfo` 的 `base_speak + mark_info[].speak_people` 映射关系。
- 前端 DOM fallback 仅允许读取已选 radio（`.el-radio.is-checked` 或 `aria-checked=true`），避免通过选项文本误判。

## 前端展示与交互口径

- 不再创建左侧独立大摘要框，避免空白占位。
- 说话人建议直接插入平台原生“说话人属性”表单项（`性别`/`年龄` 的 `.el-form-item`）。
- 右侧 AI 面板不提供“填入第一行/填入第二行”，改为行内 `填入本行` 与 `全部填入AI推荐`。
- 文本行内建议改为极简：
  - 正确：仅显示 `正确`（不显示填入按钮）
  - 需改：显示差异高亮建议文本 + `填入本行`
- 说话人属性（性别/年龄）也显示 AI 建议：
  - 正确：只显示 `AI建议：正确`
  - 需改：显示建议值，并提供 `填入性别/填入年龄`
- 行内建议与说话人建议按 task 幂等更新，避免节点反复销毁重建导致 hover 闪烁。
- 仅在存在“需修改项”时显示 `全部填入AI推荐`；仅填需改项，不自动保存/提交。
- 新增“显示 AI 原始输出”按钮，展示脱敏 raw 输出与归一化结果（支持复制）。
- 闽南语助手 options 不提供并发数配置（DataBaker 的并发配置保持在 DataBaker 脚本内）。
- 右侧结果区结构：`总结论` 置顶；`说话人属性`、`闽南语内容`、`普通话文本` 三个板块独立折叠（默认折叠），并按 `taskItemId + section` 记忆展开状态。

## 词表与环境变量

- 闽南语业务词表：`backend/lexicon/minnan-lexicon.json`（不依赖 DataBaker 运行时路径）。
- 闽南语参考源：`backend/lexicon/minnan-lexicon.csv`。
- 环境变量优先级：`MAGIC_DATA_MINNAN_AI_*` > `MAGIC_DATA_AI_*`。
- `DASHSCOPE_API_KEY` / `DASHSCOPE_BASE_URL` 仍是统一 provider 配置。

## 安全边界

- AI 仅做辅助建议，不自动保存、不自动提交、不自动领取、不自动审核、不自动流转。

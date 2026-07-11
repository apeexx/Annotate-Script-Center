# Aishell Tech 数据处理工作平台资料

## 平台信息

- **平台名称**：数据处理工作平台
- **平台域名**：`https://mark.aishelltech.com/`
- **API 域名**：`https://markapi.aishelltech.com`
- **前端技术栈**：Vue 2 + Element UI + Wavesurfer.js
- **路由类型**：History API（带 Query 参数 `taskId`、`packageId`）
- **鉴权格式**：`Authorization: Bearer <JWT>`
- **分页格式**：`page` + `size`
- **音频存储**：OSS（`https://bpp-collect.oss-cn-hangzhou.aliyuncs.com`），`dataRoot + url` 拼接，当前无需签名

## 路由体系（6 页）

| 页面 | 路径 | 说明 |
|------|------|------|
| 首页 | `/index` | 平台 Welcome 页 |
| 我的任务 | `/mytask/index` | 任务列表（el-table，22条，page+size 分页） |
| 任务详情 | `/mytask/detail/<taskId>` | 基本信息 + 分包列表 + "查看"按钮 |
| 数据标注 / 质检 | `/mytask/mark?taskId=xxx&packageId=xxx[&scene=check]` | 核心工作页（文件列表 + Wavesurfer + 标注表单；质检场景显示质检区） |
| 我的团队 | `/organization/myteam` | 组织 + 团队 + 用户管理 |
| 登录 | `/login` | 登录页 |

## 页面流转

```
/mytask/index（任务列表）
    └─ 点击任务名 → /mytask/detail/:taskId（任务详情）
                      └─ 点击分包"查看" → /mytask/mark?taskId=xxx&packageId=xxx（数据标注）
```

## 目录职责

| 目录 | 内容 | 状态 |
|------|------|------|
| `network/` | 索引 README + 5 个稳定参考页 | 完成 |
| `page-structure/` | 索引 README + 5 个稳定参考页 | 核心链路完成；`05-organization` 仍是边界摘要，详细 DOM 仍待补 |

## 当前阶段

**独立脚本已接入**。当前已完成：

- `extension/sites/aishell-tech/minnan-helper/` 闽南语助手运行时代码。
- `extension/sites/aishell-tech/vietnamese-helper/` 越南语助手运行时代码。
- `extension/sites/aishell-tech/thai-helper/` 泰语助手运行时代码。
- `extension/sites/aishell-tech/cn-en-short-drama/` 中英短剧脚本运行时代码（只读当前媒体信息面板）。
- `platform-resources/aishell-tech/minnan-helper/backend/` 闽南语助手独立 AI recommend 路由。
- `platform-resources/aishell-tech/vietnamese-helper/backend/` 越南语助手独立 AI recommend 路由。
- `platform-resources/aishell-tech/thai-helper/backend/` 泰语助手独立 AI recommend 路由。
- `platform-resources/aishell-tech/cn-en-short-drama/` 中英短剧脚本资料；当前已补脚本专属页面结构与 Network 参考，并已接入只读 runtime。
- `/mytask/index`、`/mytask/detail/:taskId`、`/mytask/mark` 的路由覆盖与资料复用。

当前业务能力只在 `/mytask/mark` 生效；共享短标注模板的 `scene=check` 质检视图已完成最小稳定采样并接入越南语助手。`我的团队`、验收 / 重检角色视图与多个对话框仍待补采。

## 当前接入范围

### 已落地范围

当前首版覆盖核心标注链路：

1. `/mytask/index`
2. `/mytask/detail/:taskId`
3. `/mytask/mark?taskId=...&packageId=...[&scene=check]`

这三页当前已经具备：

- 稳定路由
- 关键 DOM 选择器
- 任务 / 分包 / 标注条目 / 质检条目请求链
- 保存接口结构 `POST /api/mark/SaveShortMark`
- 音频拼接规则 `dataRoot + url`

当前 `/mytask/mark` 已至少确认两类模板：

- 共享短标注模板：
  - 以 `platform-resources/aishell-tech/page-structure/04-mytask-mark.md` 为准
  - Network 以 `platform-resources/aishell-tech/network/04-mytask-mark.md` 为准
  - 现有闽南语 / 越南语 / 泰语助手继续复用
- 脚本专属整段评分模板：
  - 以 `platform-resources/aishell-tech/cn-en-short-drama/page-structure/README.md` 为准
  - Network 以 `platform-resources/aishell-tech/cn-en-short-drama/network/README.md` 为准
  - 当前已接入 `extension/sites/aishell-tech/cn-en-short-drama/` 只读媒体面板，不并回共享 `04-mytask-mark.md`

### 当前专属后端

当前已接入三套独立后端接口：

- 闽南语助手：
  - `GET /api/aishell-tech/minnan-helper/ai/recommend/health`
  - `GET /api/aishell-tech/minnan-helper/ai/recommend/defaults`
  - `POST /api/aishell-tech/minnan-helper/ai/recommend`
  - `POST /api/aishell-tech/minnan-helper/ai/recommend/jobs`
  - `GET /api/aishell-tech/minnan-helper/ai/recommend/jobs/:jobId`
  - `GET /api/aishell-tech/minnan-helper/ai/recommend/jobs/:jobId/debug`
- 越南语助手：
  - `GET /api/aishell-tech/vietnamese-helper/ai/recommend/health`
  - `GET /api/aishell-tech/vietnamese-helper/ai/recommend/defaults`
  - `POST /api/aishell-tech/vietnamese-helper/ai/recommend`
  - `POST /api/aishell-tech/vietnamese-helper/ai/recommend/jobs`
  - `GET /api/aishell-tech/vietnamese-helper/ai/recommend/jobs/:jobId`
  - `GET /api/aishell-tech/vietnamese-helper/ai/recommend/jobs/:jobId/debug`
- 泰语助手：
  - `GET /api/aishell-tech/thai-helper/ai/recommend/health`
  - `GET /api/aishell-tech/thai-helper/ai/recommend/defaults`
  - `POST /api/aishell-tech/thai-helper/ai/recommend`
  - `POST /api/aishell-tech/thai-helper/ai/recommend/jobs`
  - `GET /api/aishell-tech/thai-helper/ai/recommend/jobs/:jobId`
  - `GET /api/aishell-tech/thai-helper/ai/recommend/jobs/:jobId/debug`

实现边界：

- Aishell 保持独立路由、独立脚本 ID；当前平台侧已从“单脚本硬编码”扩成“同平台三脚本互斥”，由 `platforms.aishellTech.activeScriptId` 控制生效脚本。
- 闽南语助手继续保留自己的三阶段链路与词表资料目录。
- 越南语助手固定为“单阶段 Omni 输出 `text + speed` 双字段，其中 `speed` 正式值为 `slow / normal / fast`”，不接词表、不做转换/比较双阶段。
- 泰语助手固定为“单阶段 Omni 输出 `text + speed` 双字段，其中 `speed` 正式值为 `slow / normal / fast`”，不接词表、不做转换/比较双阶段。
- Aishell 的 Omni 音频调用继续复用各脚本各自的 `dashscope-omni-client.js`，统一固定 `enable_thinking=false`。
- 底层只复用公共 provider HTTP 工具，不再复用 DataBaker recommend orchestration。
- 闽南语助手当前独立队列组固定为 `aishell_qwen_omni / aishell_fun_asr / aishell_text_compare`。
- 越南语助手当前只使用 `aishell_qwen_omni`。
- 泰语助手当前只使用 `aishell_qwen_omni`。
- 当前环境变量默认优先读取 `AISHELL_AI_*`；第一阶段仍允许只读回退旧的 `DATABAKER_AI_*`。
- 当前默认链路为 `POST /jobs` + 轮询 `GET /jobs/:jobId`；同步 `POST /recommend` 只保留兼容 / 调试用途，不引入 SSE 或 WebSocket；当前同步总超时统一为 `60000ms`。
- 当前仓库所有 AI 链路都已统一固定关闭 thinking；Aishell 不再开放 thinking 作为有效配置项。
- 成功响应固定为 `success + data + meta`，失败响应固定为 `success=false + error + meta`。

### 当前运行时能力

- 仅在 `https://mark.aishelltech.com/mytask/mark?...` 注入业务面板。
- 闽南语助手当前 AI 配置固定为独立的 `转换 / 听音 / 比较` 三板块。
- 越南语助手当前 AI 配置固定为单阶段 Omni；结果区展示 `原始文本`、`识别文本`、`当前语速` 与 `语速建议`，保存时回填 `text + speed`。
- 泰语助手当前 AI 配置固定为单阶段 Omni；结果区展示 `识别文本` 与 `语速建议`，保存时回填 `text + speed`。
- 中英短剧脚本当前固定为只读 `当前媒体信息` 面板：
  - 展示 `题目 / 模板 / 总时长 / 分段数 / 视频 / 音频`
  - 视频缺失时显示 `暂无视频`
  - 不接 AI、不自动保存、不自动提交
- 当前条支持 AI 识别、复制识别文本、填入当前条；越南语助手不再暴露听音文本复制与差异高亮，并在页面值一致时仍允许重复填入保存。
- 越南语助手已兼容 `scene=check`：质检列表使用 `checkPackageItemList`，并通过 `markTaskItemId` 对齐原标注条目；只允许操作 `.mark-area`，不触碰 `.check-area`。
- 泰语助手当前条支持 AI 识别、填入文本与语速并触发真实保存；当文本已一致但语速仍缺失时，仍允许直接应用语速建议。
- 批量模式保留 `全部AI批量识别` 与 `未完成的AI批量识别` 两种入口。
- AI 请求按前端并发预取；页面填入与保存严格串行，每条都点击页面真实“保存”按钮并等待选中项切换后再继续。

### 当前不阻塞首阶段、但后续要补的资料

- `/organization/myteam` 详细 DOM
- 验收 / 重检角色视图与其专属页面差异
- 历史标注记录弹窗
- 修改任务信息 / 数据分包 / 定向分配 / 选择团队等对话框
- 长标注 `saveLongMark`
- 质检 / 重检 / 验收写操作 payload

这些项不阻塞首阶段“标注员视角 + 短音频标注”接入，但会影响后续扩到组织管理、质检和验收视角。

## 关键发现

### 标注保存

SaveShortMark 的 `mark` 字段不是纯文本，而是 JSON 字符串。当前越南语与泰语均固定写入 `{"text":"...","speed":"..."}`。`scene` 为 `"mark"`。

### 文件列表

条目状态通过 CSS 类名区分：`list-item`（未选）、`list-item-selected`（当前）、`list-item-finshed`（已完成）。保存成功后条目自动标记完成并跳转下一条。

### 条目数据

`packageItemList` 一次返回全量 86 条（`pageSize=9999`），不分页。每条含 `id`、`fileName`、`url`、`text`（参考文本）等字段。

`scene=check` 使用 `checkPackageItemList`，同样以 `pageSize=9999` 返回当前质检分包全量条目。质检记录的 `id` 与原标注条目 ID 不同，运行时必须使用 `markTaskItemId` 对齐 AI 与标注保存链路；`number` 允许不连续。

### 音频

`dataRoot` 取自 `/api/task/detail` 响应。音频 URL 拼接规则：`dataRoot + url`。OSS 直链，当前无需签名参数。

### 质检

默认标注场景隐藏 `.check-area`；`scene=check` 会显示质检意见、质检结果和独立的下方保存按钮。越南语助手只复用上方 `.mark-area` 的文本、语速与保存，不操作任何质检控件。

## 安全边界

- AI 仅辅助建议，不自动保存/提交/审核/流转。
- 文档不记录 token、cookie、签名 URL、真实敏感文本。
- 质检区域 `.check-area` 仅质检员可见，不得绕过。
- 音频 URL 运行时从 `dataRoot + url` 拼接，不硬编码。

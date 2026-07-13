# 标注脚本中心项目规则

## 1. 项目事实

- 仓库目录：`C:\Projects\annotation-script-center`
- 运行时代码主目录：`extension/`
- 平台资料与后端主目录：`platform-resources/`
- 统一后端入口：`platform-resources/backend/server.js`
- 当前扩展版本以 `extension/manifest.json` 为准
- GitHub 主仓库：`git@github.com:XiangTianzhen/annotation-script-center.git`
- Gitee 镜像：`git@gitee.com:XiangTianzhen/annotation-script-center.git`

## 2. 文档职责与必读顺序

### 2.1 文档职责

- `AGENTS.md`
  - 当前仓库最高优先级规则
  - 只写项目级长期规则
  - 不堆平台细节、不堆版本流水
- `README.md`
  - 项目首页导航
  - 只写项目定位、目录入口、启动入口、文档入口
- `docs/README.md`
  - `docs/` 导航页
  - 说明当前保留的少量文档各自记录什么
- `docs/platforms-index.md`
  - 平台与脚本入口索引
  - 处理具体平台前先读
- `docs/external-docs-aliyun-bailian.md`
  - 百炼官方文档入口与查阅规则
- `docs/unfinished-crx-enterprise-managed-install.md`
  - 当前未完成模块与现实阻塞
- `extension/README.md`
  - 扩展当前运行时契约、目录说明、加载方式
- `platform-resources/README.md`
  - 平台资料目录契约、平台入口、统一后端边界
- `platform-resources/backend/README.md`
  - 统一后端当前契约、接口与运行说明
- `log.md`
  - 历史改动唯一总账

### 2.2 文档写法规则

- 详细 README 只写当前能力、当前边界、当前目录、当前接口。
- 不在 README 里继续堆日期、热修说明、版本流水、阶段复盘。
- 历史过程、阶段收尾、迁移记录统一写入 `log.md`。
- 平台细则继续写在各平台 README；项目级统一规则写在 `AGENTS.md`。
- `docs/` 只保留少量长期入口文件，不再按多层子目录继续扩张。

### 2.3 开始处理前必须先读

1. `AGENTS.md`
2. `README.md`
3. 平台相关任务先读 `docs/platforms-index.md`
4. 与任务直接相关的：
   - `extension/README.md`
   - `platform-resources/README.md`
   - `extension/sites/<platform>/<script>/README.md`
   - `platform-resources/<platform>/README.md`
   - `platform-resources/<platform>/<script>/README.md`
   - 相关源码、配置、接口与数据文件
5. 若涉及百炼 / DashScope / Qwen / thinking / 结构化输出 / Qwen-Omni / Web Search / 调用地区 / 限流，额外先读 `docs/external-docs-aliyun-bailian.md`
6. 若涉及 CRX 企业托管自动安装阻塞，额外先读 `docs/unfinished-crx-enterprise-managed-install.md`

## 3. Git 与执行规则

- 默认在 `main` 单工作区执行。
- 默认不创建分支、不创建 worktree、不创建 PR。
- 修改前后都必须检查 `git status`。
- 若 Prompt 含 `ASC_ABORT_IF_DIRTY` 且发现无关改动，必须停止并报告。
- 若工作区已有无关改动：
  - 不得覆盖、回退或混入无关修改
  - 只能最小范围改动当前任务相关文件
  - 无法安全隔离时必须先报告
- 只读任务不得改文件、不得提交。
- 验证失败不得提交、不得 push。
- 执行类任务在验证通过后，默认按项目规则提交到 `origin main`；若当前工作区存在无法安全隔离的无关改动，则不得强行提交。

### 3.1 任务暗号

- `ASC_READONLY`：只读审计，不改文件
- `ASC_MAIN_TASK`：在 `main` 执行任务
- `ASC_MAIN_HOTFIX`：在 `main` 小修
- `ASC_RELEASE`：发布流程（版本、CRX、tag）
- `ASC_BRANCH_TASK`：仅用户明确要求分支时使用

### 3.2 commit 规范

- commit message 必须使用中文。
- 允许保留英文范围标识，但描述必须是中文。
- 推荐格式：
  - `修复(data-baker): 修复 AI 工具卡挂载失败`
  - `优化(aishell): 调整结果卡人民币展示`
  - `新增(backend): 增加 Fun-ASR REST 调用`
  - `文档(readme): 收口项目导航`
  - `发布: v<version>`
- 禁止使用纯英文、`update`、`fix bug`、`修改` 等含糊提交说明。

## 4. 目录边界

- `extension/`
  - 浏览器扩展运行时代码
  - 前端只负责采集、展示、调用接口、触发下载和真实 DOM 交互
- `platform-resources/`
  - 平台资料、页面结构、Network 资料、脚本后端实现
- `platform-resources/backend/`
  - 统一后端入口、路由注册、公共 AI / 下载 / 管理能力
- `docs/`
  - 扁平化的长期索引、外部文档入口、未完成事项
- `scripts/`
  - 构建、打包、同步、本地工具脚本
- 过程性 plan / spec / brainstorm 文档统一放仓库根目录 `.superpowers/`，不放 `docs/`
- `config/`
  - 配置模板、发布配置、价格配置、本地私有配置说明

### 4.1 平台资料目录规则

- `platform-resources/<platform>/` 默认优先使用：
  - `README.md`
  - `backend/`
  - `network/`
  - `page-structure/`
  - `<script-id>/`
- 平台共用后端优先放平台根级 `backend/`。
- 平台共用页面结构优先放平台根级 `page-structure/`。
- 平台共用 Network 资料优先放平台根级 `network/`。
- 单脚本目录默认优先使用：
  - `README.md`
  - `backend/`
  - `network/`
  - `page-structure/`
- 仅脚本专属差异放脚本目录。
- README 只维护实际职责、接口、边界和差异，不重复抄默认目录模板。
- 需要保留空目录时使用 `.gitkeep`。
- 未实际接入扩展运行时代码前，不伪造 `extension/sites/<platform>/` 目录。

### 4.2 配置目录规则

- `config/package-crx-release.json`
  - 可提交的默认 CRX 打包配置
- `config/aliyun-bailian-model-pricing.json`
  - 可提交的模型价格配置
- `config/env/`
  - 运行时环境变量文件
- `config/secrets/`
  - 本地私有密钥与覆盖配置
- 不再新增 `config/release/`、`config/pricing/` 这类单文件子目录。
- 新增非敏感单文件配置时，优先直接放在 `config/` 根级。

### 4.3 平台参考文档模板规则

- `platform-resources/**/network/` 与 `platform-resources/**/page-structure/` 只保留当前有效的稳定参考文档。
- 过程型文件不得继续留在主参考目录：
  - `pending-capture.md`
  - `next-session-handoff.md`
  - `playwright/devtools/readonly/retest` 一类复测或会话交接记录
- 过程历史统一写入 `log.md`；当前边界写入对应 README 或稳定参考页。
- 空占位目录只保留 `.gitkeep`，不额外补无意义 README。
- 目录内存在多份稳定参考页时，`README.md` 必须作为索引页。
- 目录内只有单份稳定参考时，允许直接用该单页承载参考，不强行拆分。
- Network 索引 README 固定章节：
  - `目录定位`
  - `适用范围 / 当前覆盖`
  - `文件列表`
  - `阅读顺序`
  - `通用约定`
  - `当前边界 / 待补项`
- Network 单页参考固定章节：
  - `请求标识 / 目的`
  - `页面入口 / 触发动作`
  - `请求摘要`
  - `请求体摘要`
  - `响应摘要`
  - `关键字段`
  - `前端接入建议`
  - `风险 / 未确认项`
- Page-structure 索引 README 固定章节：
  - `目录定位`
  - `适用范围 / 当前覆盖`
  - `文件列表`
  - `阅读顺序`
  - `通用约定`
  - `当前边界 / 待补项`
- Page-structure 单页参考固定章节：
  - `页面标识 / 路由 / 前置条件`
  - `页面总览`
  - `DOM 树 / 区域结构`
  - `稳定选择器表`
  - `动态区域 / 重渲染风险`
  - `可挂载点建议`
  - `页面区域与接口映射`
  - `写操作边界 / 未确认项`
- 参考文档只写当前有效结论，不写日期型流水或重复的会话过程。
- 章节命名、字段顺序、脱敏口径必须保持统一，便于 AI 和人快速扫读。

## 5. 统一行为规则

### 5.1 AI 与自动化边界

- AI 建议默认只作辅助。
- 默认禁止自动保存、自动提交、自动领取、自动送审、自动审核、自动判定流转。
- 只有当前 Prompt 明确授权时，才允许自动提交类动作。
- 批量能力默认只作用于当前页、当前任务或当前音频，不跨页。
- 批量能力必须提供停止机制与失败统计。
- 不得绕过平台原生 `disabled` / `readonly` 限制。
- 提交类动作默认只点击页面真实按钮，不直接调平台提交 API，除非该脚本 README 已明确允许且当前 Prompt 明确要求。

### 5.2 平台互斥与统一入口

- 同一平台存在多个脚本时，默认互斥启用。
- 启用某脚本时必须自动关闭同平台其他脚本。
- 关闭当前脚本时不自动启用其他脚本。
- 如需并行启用，必须由当前 Prompt 明确授权。
- 各脚本详情页不得新增独立后端地址；后端地址统一走 options 首页入口。
- Magic Data 双助手（客家话 / 闽南语）同平台互斥启用。

### 5.3 shared 模块规则

- `extension/sites/alibaba-labelx/shared/audio-controller-core.js`
  - LabelX 快判 / 转写通用音频核心
- `extension/sites/alibaba-labelx/shared/submit-actions.js`
  - LabelX 快判 / 转写通用提交快捷键动作
- `extension/options/options-shared-shortcut-panel.js`
  - 脚本详情页快捷键通用渲染组件
- 提交类动作只作为快捷键，不加入顶部工具栏。
- options 新增或修改快捷键面板时必须复用共享组件。
- 所有脚本默认快捷键统一为空。
- 只保留用户显式保存过的键位。
- 不再新增硬编码默认组合。
- “重置”统一使用“清空快捷键”语义，不恢复旧默认键位。

## 6. AI 消耗、日志与超时规则

- AI 调用 CSV 导出表头统一使用中文。
- 后续新增或改动 AI 调用记录时，默认记录：
  - `输入Token`
  - `输出Token`
  - `总Token`
- 有人民币估算时同时记录金额列。
- 多阶段 AI 调用默认拆分阶段 token 与阶段人民币列。
- CSV 不再记录 `pricingStatus / inputPrice / outputPrice` 这类重复文本字段。
- 后续新增或改动 AI 服务返回结构时，默认补齐统一 `cost` 对象。
- 价格统一读取 `config/aliyun-bailian-model-pricing.json`。
- 只要前端已有 AI 结果信息区，且结果已带统一 `cost`，默认补人民币估算展示：
  - 单阶段显示一行 `预估人民币`
  - 多阶段显示各阶段 `预估人民币` 与 `总预估人民币`
- 只要前端已有 AI 批量状态区，且批量结果已带统一 `usage/cost`，默认补：
  - `批量输入Token`
  - `批量输出Token`
  - `批量总Token`
  - `批量预估人民币`
- 批量消耗口径固定为“已返回 AI 结果的调用消耗”。
- 缺少价格数据时：
  - 页面可显示 `没有数据源`
  - CSV 金额列保持空白，不写文本状态
- 日志必须脱敏，不输出敏感字段全文。
- TTS 自动清除默认时间统一为 `60000ms`。
- AI / 模型请求默认超时时间统一为 `60000ms`。
- 本项目默认不使用异步 job / SSE / WebSocket 接收 AI 结果，除非当前 Prompt 明确要求。
- 若单次 AI / 模型请求超过 `60000ms` 仍无法返回，优先优化模型、Prompt、任务拆分或后端策略，而不是继续拉长超时。

## 7. 业务词表治理规则

- 当前纳入统一治理的业务词表主格式固定为 `JSON`。
- `CSV / XLSX` 只保留为参考源、原始来源或导入来源。
- 当前统一治理范围仅指以下 5 份业务词表：
  - `platform-resources/data-baker/round-one-quality/backend/reference/minnan-lexicon.json`
  - `platform-resources/aishell-tech/minnan-helper/backend/reference/minnan-lexicon.json`
  - `platform-resources/magic-data/hakka-helper/backend/lexicon/hakka-lexicon.json`
  - `platform-resources/magic-data/minnan-helper/backend/lexicon/minnan-lexicon.json`
- JSON 顶层字段固定为：
  - `schemaVersion`
  - `language`
  - `mode`
  - `sourceFiles`
  - `updatedAt`
  - `entries`
- 每个 `entry` 固定字段为：
  - `id`
  - `normalized`
  - `display`
  - `mandarin`
  - `aliases`
  - `notes`
  - `tags`
  - `attributes`
- 处理“字词表 / 词表 / lexicon”任务时，默认流程为：
  1. 先确认当前只处理哪一份词表
  2. 先输出一段交给网页端 AI 的单词表处理 Prompt
  3. 用户自行上传或粘贴这一份词表内容
  4. 用户自行维护整理后的 JSON
  5. Codex 只做结构校验、代码接入、测试和文档同步
- Codex 默认可改：
  - JSON schema / 校验器
  - 运行时代码接入
  - 文档
  - 测试
  - 参考源到 JSON 的处理 Prompt
- Codex 默认不改：
  - 词表 JSON 中的具体词条内容
  - 用户自行维护的释义、别名、备注
- 运行时降级规则：
  - JSON 主词表存在且合法：正常读取 JSON
  - JSON 缺失但参考 CSV 仍在：业务按无词表模式继续，允许给出一次“没有字词对应表”提示
  - JSON 与参考 CSV 都不存在：直接按无词表模式继续，不额外报错

## 8. Prompt、资料补充与文档同步

### 8.1 Prompt 输出规则

- 网页端输出 Codex Prompt 时，默认生成 `.md` 文件供下载。
- 仅当用户明确要求“直接贴出 Prompt”时，才直接在消息中输出。
- Prompt 内不嵌套复杂 Markdown 三反引号代码块。
- 命令、JSON、env、示例响应统一用普通缩进文本表示。
- 推荐命名：`codex-prompt-<task-slug>.md`。
- Prompt 最小结构默认包含：
  - 推荐模型
  - 推理强度
  - 任务暗号
  - 当前目录
  - 当前分支
  - 文件白名单
  - 验证命令
  - 是否提交
  - commit message
  - 最终输出要求

### 8.2 资料补充提醒

- 页面 UI / DOM 问题：优先提醒上传页面截图、Elements 截图、关键 HTML 片段。
- Network / 接口问题：优先提醒上传请求 URL、请求参数、响应体、状态码。
- Console / 扩展报错：优先提醒上传完整错误堆栈和触发步骤。
- AI / 模型问题：优先提醒上传脱敏后的原始 AI 返回 JSON、debug JSON、后端日志、模型配置截图。
- 数据导入 / CSV / JSON 问题：优先提醒上传脱敏样例文件、字段说明、期望输出。
- 音频 / TTS / ASR 问题：优先提醒上传音频样例、识别结果、页面文本、朗读要求。
- cookie、token、authorization、签名参数、完整资源 URL 必须先脱敏。

### 8.3 文档同步

- 有效改动必须同步更新对应 README 与 `log.md`。
- 新增平台或脚本时，必须同步更新：
  - `extension/sites/<platform>/<script>/README.md`
  - `platform-resources/<platform>/<script>/README.md` 或资料目录
  - `docs/platforms-index.md`
  - `log.md`
- 仅平台资料初始化、尚未接入运行时代码的平台，不伪造运行时代码目录。
- 不得把关键规则只留在对话输出里。

## 9. 验证与测试文件治理

- 修改 JS 后运行 `node --check <file>`。
- 修改 `manifest.json` 后必须确认：
  - JSON 可解析
  - manifest 引用脚本路径都存在
- 只运行仓库中真实存在的验证命令。
- 不得伪造验证结果。

### 9.1 测试文件治理

- AI / 模型 / 日志 / 队列链路相关 `*.test.js` 默认视为临时验证资产。
- 当前任务若只是用它们做一次性校验，验证完成后可删除，除非用户明确要求保留。
- `options`、`storage`、`ui-panel`、`content`、`data-api`、`shortcuts` 这类核心回归测试默认保留。
- 删除测试文件前，先确认不属于当前长期回归基线。

## 10. 版本与发布规则

- 默认保持当前 `extension/manifest.json` 版本不变。
- 只有用户明确要求“完成当前版本 / 准备打包 / 准备发布 / 提升版本号”时，才调整版本号。
- 当前阶段版本固定为 `0.4.1`。
- 在用户明确说明“这是 `0.4.1` 的最终版本并开始打包 / 发布”之前，不自动提升到 `0.4.2`。
- `ASC_RELEASE` 前必须先完成真实浏览器验收。
- 发布失败不得 commit / tag / push。
- 正式发布产物以 CRX 三件套为准：
  - `annotation-script-center-v<version>.crx`
  - `annotation-script-center-update.xml`
  - `annotation-script-center-crx-latest.json`
- ZIP 仅作为过渡分发兼容项，不作为正式发布验收必选项。

## 11. 安全与脱敏

- 不提交 API Key、token、cookie、authorization、access token、JWT secret、CRX 私钥。
- 不提交真实客户数据、员工敏感信息、合同内容、未脱敏截图、完整签名 URL、完整音频 URL。
- 前端不得保存 API Key、cookie、token、完整签名 URL、完整音频 URL。
- 若用户贴出敏感信息，不写入代码、文档、日志或测试文件。
- 日志和错误信息中只保留必要摘要，例如：
  - `requestId`
  - `hostname`
  - `status code`
  - `model`
  - `duration`
  - 错误摘要

## 12. 禁止事项

- 不伪造验证结果。
- 不未经授权做大重构。
- 不删除已有业务逻辑，除非任务明确要求。
- 不随意引入新依赖；如必须引入，先说明原因、替代方案与影响。
- 不把后端逻辑写进前端目录。
- 不把平台细节长文重新塞回 `AGENTS.md` 或根 `README.md`。

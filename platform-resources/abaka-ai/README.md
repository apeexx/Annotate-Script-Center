# Abaka AI 平台资料

## 平台定位

Abaka AI 是国外标准标注平台。本目录按 Alibaba LabelX 的维护方式拆分为“平台公共资料 + 任务项目资料”。公共 Task 页面能力放在 `platform-resources/abaka-ai/` 根目录，Task21 和 Task17 的差异分别放入各自项目目录。

## 当前项目

| 项目 | 目录 | 当前阶段 | 资料入口 |
| --- | --- | --- | --- |
| Task21 | `platform-resources/abaka-ai/task21/` | Task21助手完成态（快捷键 + AI 辅助填写；image_b_texts_removed 已升级为 T/B/R/D 多重集判断，规则为 `D == T => true`、`D` 为空 => `null`、其余 `specify`；列表页统计入口已挂载，统计后端待补） | `task21/README.md` |
| Task17 | `platform-resources/abaka-ai/task17/` | 公共结构对比、内审领取空池响应已采集 | `task17/README.md` |

运行时代码仍在 `extension/sites/abaka-ai/task-page/`，该名称表示扩展注入的通用 Task 页面脚本，不等同于平台资料项目名。

## 公共资料

- 平台通用网络：`network/platform.md`
- Task 页面公共网络索引：`network/README.md`
- Task 页面公共 Data / `/items` 请求：`network/task-page/`
- Task 页面公共状态流转：`network/task-page/18-status-tabs.md` 起的编号文档
- Task 页面公共结构：`page-structure/platform.md`
- Task 页面动作与状态边界：`page-structure/actions.md`
- Task 页面多语言文案：`page-structure/i18n.md`
- 扩展运行时入口：`extension/sites/abaka-ai/task-page/README.md`

## 归档规则

- Task17 和 Task21 都能观察到的页面壳、Data 页、状态 Tab、Skipped / Dropped / Recovery、领取、查看、资源加载、语言切换等能力，统一维护在根目录公共资料。
- Task21 `same_font`、`image_b_texts_removed`、`other_changes` 等专项字段只放在 `task21/`。
- Task17 图片二选一、内审空池和对比结论只放在 `task17/`。
- 新任务接入时，先复用根目录公共资料，再在新任务目录记录差异。

## 安全边界

- 不记录账号密码、cookie、token、authorization、password、secret、signature。
- 不记录完整图片、音频、文件或对象存储 URL。
- 不提交原始 HAR、JSON、截图、CSV、完整接口响应。
- 状态变更类动作必须人工确认。
- 扩展默认不自动领取、不自动保存、不自动提交、不自动流转。
- Skipped / Dropped / Recovery / Submit 等 Task 页面公共状态流转不得静默触发。
- Task17 默认只查看和对比；本轮仅按用户授权补测内审领取空池失败响应，不继续审核流转。



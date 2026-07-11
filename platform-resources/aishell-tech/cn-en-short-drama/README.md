# Aishell Tech 中英短剧脚本资料

## 目录职责

- `README.md`：脚本资料入口、当前状态与边界说明。
- `network/README.md`：中英短剧脚本专属 Network 稳定参考索引。
- `page-structure/README.md`：中英短剧脚本专属页面结构稳定参考。

## 当前状态

- 当前脚本显示名为 `中英短剧脚本`，slug 为 `cn-en-short-drama`。
- 当前阶段为“已接入运行时（只读媒体面板）”。
- 当前已创建运行时代码目录：
  - `extension/sites/aishell-tech/cn-en-short-drama/`
- 当前未新增独立后端接口；继续复用 Aishell 平台现有任务详情与分包读取链路。

## 当前口径

- 当前脚本继续共享 Aishell Tech 平台路由：`/mytask/mark?taskId=<taskId>&packageId=<packageId>`。
- 当前已确认它不是现有共享 `04-mytask-mark.md` 覆盖的单文本 `mark-area` 短标注模板，而是脚本专属的“整段标注 + 多维评分”变体：
  - `floating-mark-area.is-docked`
  - `.floating-mark`
  - `.mark-form-content`
  - `.mark-form`
- 当前页已确认的关键结构包括：
  - 双通道波形工作区
  - 左侧条目列表状态
  - 6 个必填评分 `textarea`
  - `设置为无效`
  - `查看历史标注记录`
  - `保存整段`
  - `完成标注`
- 当前运行时第一版只在该模板上挂载只读 `当前媒体信息` 面板，不把这套模板上提为 Aishell 平台共用参考。

## 当前接口与边界

- 当前运行时代码已正式接线：
  - `scriptId`：`aishellTechCnEnShortDrama`
  - manifest 内容脚本：
    - `extension/sites/aishell-tech/cn-en-short-drama/data-api.js`
    - `extension/sites/aishell-tech/cn-en-short-drama/ui-panel.js`
    - `extension/sites/aishell-tech/cn-en-short-drama/content.js`
- 当前能力：
  - 读取任务详情与分包条目
  - 在 `/mytask/mark` 页面展示 `题目 / 模板 / 总时长 / 分段数 / 视频 / 音频`
  - 视频缺失时显示 `暂无视频`
- 当前脚本已补脚本专属 Network 参考：
  - `platform-resources/aishell-tech/cn-en-short-drama/network/README.md`
  - `platform-resources/aishell-tech/cn-en-short-drama/network/01-mytask-mark-whole-segment.md`
- 平台共用初始化与公共请求结构继续以：
  - `platform-resources/aishell-tech/network/README.md`
  - `platform-resources/aishell-tech/network/04-mytask-mark.md`
  为准。
- 当前运行时仍不预设：
  - 自动保存
  - 自动提交
  - 自动完成标注
  - 自动设置无效
  - AI 获取
- `保存整段`、`完成标注`、`设置为无效 / 有效` 当前统一视为人工触发写操作。
- 历史标注记录当前仅保留读操作结论；live 页面按钮测试时已观察到 `GetMarkHistoryList` 异常日志，后续真正接入前仍需补一次直接 Network 面板复核。

## 安全边界

- 不记录真实账号、token、cookie、authorization、完整签名 URL 或真实标注内容。
- 仅保留脱敏后的结构结论、稳定锚点和页面边界说明。
- 当前运行时只读展示媒体信息，不绕过页面原生写操作入口。

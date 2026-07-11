# Aishell Tech 中英短剧脚本运行时

## 当前范围

- 仅在 `https://mark.aishelltech.com/mytask/mark?...` 生效。
- 前端显示名统一使用 `希尔贝壳`；不改内部平台 ID、目录名或接口路径。
- 当前为 Aishell Tech 平台下第四个正式脚本，与 `闽南语助手`、`越南语助手`、`泰语助手` 同平台互斥；生效脚本由 `platforms.aishellTech.activeScriptId` 控制。

## 当前能力

- 当前版本只接入一个只读的 `当前媒体信息` 面板。
- 面板固定展示：
  - `题目`
  - `模板`
  - `总时长`
  - `分段数`
  - `视频`
  - `音频`
- 页面优先通过 Aishell 当前任务详情与分包列表接口读取媒体信息，再回退到 DOM 可见结构。
- 媒体面板优先挂载到：
  - `.floating-mark-area.is-docked .floating-mark`
  - 回退 `.mark-form-content`
- 面板会跟随当前条切换自动刷新。
- 当页面或接口没有稳定视频地址时，`视频` 行显示 `暂无视频`。

## 当前边界

- 当前版本不接入 AI 获取。
- 不自动保存。
- 不自动提交。
- 不触发 `保存整段`、`完成标注`、`设置为无效` 或 `查看历史标注记录`。
- 不猜测不存在稳定字段的视频地址；只有接口明确返回时才展示。

## 数据口径

- 任务详情读取：`GET /api/task/detail/:taskId`
- 分包条目读取：`GET /api/taskItem/packageItemList/:packageId`
- 音频地址继续按 `dataRoot + url` 拼接。
- 视频地址当前只读取稳定字段：
  - `videoUrl`
  - `videoPath`

## 验收建议

- 在 options 中启用 `中英短剧脚本`。
- 进入希尔贝壳 `/mytask/mark?taskId=...&packageId=...`。
- 确认右侧整段评分区上方出现 `当前媒体信息` 面板。
- 切换左侧条目，确认 `音频` / `视频` 与分段信息同步刷新。
- 若当前任务没有稳定视频字段，确认 `视频` 行显示 `暂无视频`。

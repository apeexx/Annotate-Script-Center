# Magic Data Network参考索引
## 目录定位

- 目录：`platform-resources/magic-data/network`
- 类型：Network 稳定参考索引。
- 本目录只保留当前有效结论，不再承载会话交接、复测流水或历史过程文档。

## 适用范围 / 当前覆盖

- 当前保留 9 份稳定参考页。
- 当前目录聚焦接口入口、请求摘要、响应结构、接入建议和风险边界。
- 过程型记录已移出主参考目录；如需追加历史过程，统一写入 `log.md`。

## 文件列表

| 文件 | 说明 |
| --- | --- |
| `01-welcome.md` | 01 首页（welcome）网络摘要 |
| `02-mark-list.md` | 02 标注任务页（mark/list）网络摘要 |
| `03-mark-details.md` | 03 标注任务详情页（mark/details）网络摘要 |
| `04-asrmark.md` | 04 标注单条页（asrmark）网络摘要 |
| `05-check-task.md` | 05 审核任务页（checkTask）网络摘要 |
| `06-check-task-detail.md` | 06 审核任务详情页（checkdata/taskDetail）网络摘要 |
| `07-asrmark-check.md` | 07 审核单条页（asrmarkCheck）网络摘要 |
| `08-sensitive-operations.md` | 08 敏感写操作接口清单（仅识别，未触发） |
| `09-safety-boundary-rules.md` | Magic Data ANNOTATOR 安全边界 |

## 阅读顺序

- 先读本索引，再按文件名顺序下钻到对应单页参考。
1. `01-welcome.md`
2. `02-mark-list.md`
3. `03-mark-details.md`
4. `04-asrmark.md`
5. `05-check-task.md`
6. `06-check-task-detail.md`
7. `07-asrmark-check.md`
8. `08-sensitive-operations.md`
9. `09-safety-boundary-rules.md`

## 通用约定

- 只记录当前有效结论，不写日期型历史流水。
- 路径、字段名、选择器、按钮文案都按脱敏后的稳定锚点记录。
- 单页参考固定使用 `请求标识 / 目的 -> 页面入口 / 触发动作 -> 请求摘要 -> 请求体摘要 -> 响应摘要 -> 关键字段 -> 前端接入建议 -> 风险 / 未确认项` 顺序。
- 不记录 token、cookie、authorization、完整签名 URL、真实敏感文本。

## 当前边界 / 待补项

- 新增缺口时，先补稳定参考结论，再同步更新对应平台 README 或 `log.md`。
- 如果目录当前没有专属差异，保持空目录或由父级 README 说明，不额外制造占位文档。

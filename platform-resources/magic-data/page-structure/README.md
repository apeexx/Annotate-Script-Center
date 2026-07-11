# Magic Data 页面结构参考索引
## 目录定位

- 目录：`platform-resources/magic-data/page-structure`
- 类型：页面结构 稳定参考索引。
- 本目录只保留当前有效结论，不再承载会话交接、复测流水或历史过程文档。

## 适用范围 / 当前覆盖

- 当前保留 7 份稳定参考页。
- 当前目录聚焦路由识别、DOM 锚点、稳定选择器、挂载建议和写操作边界。
- 过程型记录已移出主参考目录；如需追加历史过程，统一写入 `log.md`。

## 文件列表

| 文件 | 说明 |
| --- | --- |
| `01-welcome.md` | 01 首页（welcome） |
| `02-mark-list.md` | 02 标注任务页（mark/list） |
| `03-mark-details.md` | 03 标注任务详情页（mark/details） |
| `04-asrmark.md` | 04 标注单条页（asrmark） |
| `05-check-task.md` | 05 审核任务页（checkTask） |
| `06-check-task-detail.md` | 06 审核任务详情页（checkdata/taskDetail） |
| `07-asrmark-check.md` | 07 审核单条页（asrmarkCheck） |

## 阅读顺序

- 先读本索引，再按文件名顺序下钻到对应单页参考。
1. `01-welcome.md`
2. `02-mark-list.md`
3. `03-mark-details.md`
4. `04-asrmark.md`
5. `05-check-task.md`
6. `06-check-task-detail.md`
7. `07-asrmark-check.md`

## 通用约定

- 只记录当前有效结论，不写日期型历史流水。
- 路径、字段名、选择器、按钮文案都按脱敏后的稳定锚点记录。
- 单页参考固定使用 `页面标识 / 路由 / 前置条件 -> 页面总览 -> DOM 树 / 区域结构 -> 稳定选择器表 -> 动态区域 / 重渲染风险 -> 可挂载点建议 -> 页面区域与接口映射 -> 写操作边界 / 未确认项` 顺序。
- 不记录 token、cookie、authorization、完整签名 URL、真实敏感文本。

## 当前边界 / 待补项

- 新增缺口时，先补稳定参考结论，再同步更新对应平台 README 或 `log.md`。
- 如果目录当前没有专属差异，保持空目录或由父级 README 说明，不额外制造占位文档。

# Abaka AI / Task 页面 Network参考索引
## 目录定位

- 目录：`platform-resources/abaka-ai/network/task-page`
- 类型：Network 稳定参考索引。
- 本目录只保留当前有效结论，不再承载会话交接、复测流水或历史过程文档。

## 适用范围 / 当前覆盖

- 当前保留 24 份稳定参考页。
- 当前目录聚焦接口入口、请求摘要、响应结构、接入建议和风险边界。
- 过程型记录已移出主参考目录；如需追加历史过程，统一写入 `log.md`。

## 文件列表

| 文件 | 说明 |
| --- | --- |
| `01-data-page-search-template.md` | POST /api/v2/item/get-item-search-template-list |
| `02-data-page-package-list.md` | POST /api/v2/package/get-package-list 与批次筛选 |
| `03-data-page-item-list.md` | POST /api/v2/item/get-task-item-list-lite |
| `04-data-page-selection-frame-count.md` | POST /api/v2/item/get-frame-count |
| `05-items-view-init.md` | POST /api/v2/item/get-view-item-permission 等查看页初始化 |
| `06-items-label-init.md` | POST /api/v2/item/get-item-info 等标注页初始化 |
| `07-item-work-lock.md` | POST /api/v2/item/work |
| `09-abandon-item.md` | POST /api/v2/item/abandon-item |
| `10-skip-item.md` | POST /api/v2/item/skip-item |
| `11-submit-review.md` | Submit / 送审 |
| `12-stash-save.md` | POST /api/v2/label/save-labels 暂存 / Save |
| `13-restore-item.md` | 恢复已放弃 / 已跳过条目 |
| `14-claim-label.md` | POST /api/v2/item/receive-item 领取标注 |
| `15-claim-review.md` | POST /api/v2/item/receive-item 领取审核 |
| `16-language-switch.md` | 语言切换请求观察 |
| `17-resource-files.md` | 资源文件请求 |
| `18-status-tabs.md` | Abaka AI Task 页面状态 Tab 请求 |
| `19-skipped-list.md` | POST /api/v2/item/get-task-item-skip-list |
| `20-dropped-list.md` | POST /api/v2/item/get-task-item-abandon-list |
| `21-restore-skipped-item.md` | Skipped 条目重新进入标注 |
| `22-restore-dropped-item.md` | POST /api/v2/item/recover-item 恢复 Dropped 条目 |
| `23-label-submit-success.md` | POST /api/v2/item/submit-item 标注送审成功 |
| `24-review-role-no-submit.md` | 标注内审角色只读观察 |
| `status-flows.md` | Abaka AI Task 页面公共网络采集索引 |

## 阅读顺序

- 先读本索引，再按文件名顺序下钻到对应单页参考。
1. `01-data-page-search-template.md`
2. `02-data-page-package-list.md`
3. `03-data-page-item-list.md`
4. `04-data-page-selection-frame-count.md`
5. `05-items-view-init.md`
6. `06-items-label-init.md`
7. `07-item-work-lock.md`
8. `09-abandon-item.md`
9. `10-skip-item.md`
10. `11-submit-review.md`
11. `12-stash-save.md`
12. `13-restore-item.md`
13. `14-claim-label.md`
14. `15-claim-review.md`
15. `16-language-switch.md`
16. `17-resource-files.md`
17. `18-status-tabs.md`
18. `19-skipped-list.md`
19. `20-dropped-list.md`
20. `21-restore-skipped-item.md`
21. `22-restore-dropped-item.md`
22. `23-label-submit-success.md`
23. `24-review-role-no-submit.md`
24. `status-flows.md`

## 通用约定

- 只记录当前有效结论，不写日期型历史流水。
- 路径、字段名、选择器、按钮文案都按脱敏后的稳定锚点记录。
- 单页参考固定使用 `请求标识 / 目的 -> 页面入口 / 触发动作 -> 请求摘要 -> 请求体摘要 -> 响应摘要 -> 关键字段 -> 前端接入建议 -> 风险 / 未确认项` 顺序。
- 不记录 token、cookie、authorization、完整签名 URL、真实敏感文本。

## 当前边界 / 待补项

- 新增缺口时，先补稳定参考结论，再同步更新对应平台 README 或 `log.md`。
- 如果目录当前没有专属差异，保持空目录或由父级 README 说明，不额外制造占位文档。

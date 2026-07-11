# Alibaba LabelX / ASR 快判 Network参考索引
## 目录定位

- 目录：`platform-resources/alibaba-labelx/asr-judgement/network`
- 类型：Network 稳定参考索引。
- 本目录只保留当前有效结论，不再承载会话交接、复测流水或历史过程文档。

## 适用范围 / 当前覆盖

- 当前保留 24 份稳定参考页。
- 当前目录聚焦接口入口、请求摘要、响应结构、接入建议和风险边界。
- 过程型记录已移出主参考目录；如需追加历史过程，统一写入 `log.md`。

## 文件列表

| 文件 | 说明 |
| --- | --- |
| `01-survey-results.md` | GET /api/v1/label/surveyResults |
| `02-list-auth-app-info.md` | GET /api/v1/appInfo/listAuthAppInfo |
| `03-subtask-data.md` | GET /api/v1/label/center/subTask/{subTaskId}/data |
| `04-subtask-summary.md` | GET /api/v1/label/center/subTask/{subTaskId}/summary |
| `05-subtask-board.md` | GET /api/v1/label/center/subTask/{subTaskId}/board |
| `06-timer.md` | POST /api/v1/label/center/timer |
| `07-session.md` | POST /api/v1/label/center/{subTaskId}/session |
| `08-get-label-task-info.md` | GET /api/v1/label/tasks/getLabelTaskInfo |
| `09-audio-media.md` | GET /oss-proxy-labelx/.../*.wav |
| `10-subtask-commit.md` | POST /api/v1/label/center/subTask/{subTaskId}/commit |
| `11-label-fetch-auto.md` | POST /api/v1/label/center/{taskId}/label/fetch |
| `12-home-subtasks.md` | GET /api/v1/label/center/subTasks |
| `13-home-tasks.md` | GET /api/v1/label/center/tasks |
| `14-home-tasks-process.md` | GET /api/v1/label/center/tasks/process |
| `15-home-subtasks-finished.md` | GET /api/v1/label/center/subTasks?finished=true |
| `16-label-fetch-manual.md` | POST /api/v1/label/center/{taskId}/label/fetch 手动领取 |
| `17-subtask-release.md` | POST /api/v1/label/center/subTask/{subTaskId}/release |
| `18-subtask-data-save.md` | POST /api/v1/label/center/subTask/{subTaskId}/data 保存答案 |
| `19-subtask-data-pagination-filter.md` | GET /api/v1/label/center/subTask/{subTaskId}/data 分页与筛选 |
| `20-submit-client-validation.md` | 提交任务客户端校验阻断 |
| `21-item-selection-navigation.md` | 题卡选中与上下题导航 |
| `22-home-open-subtask-detail.md` | 首页“标注”打开子任务详情 |
| `23-check-task-home.md` | 审核首页列表请求 |
| `page-size-load-test-snippet.md` | 快判每页条数负载测试脚本 |

## 阅读顺序

- 先读本索引，再按文件名顺序下钻到对应单页参考。
1. `01-survey-results.md`
2. `02-list-auth-app-info.md`
3. `03-subtask-data.md`
4. `04-subtask-summary.md`
5. `05-subtask-board.md`
6. `06-timer.md`
7. `07-session.md`
8. `08-get-label-task-info.md`
9. `09-audio-media.md`
10. `10-subtask-commit.md`
11. `11-label-fetch-auto.md`
12. `12-home-subtasks.md`
13. `13-home-tasks.md`
14. `14-home-tasks-process.md`
15. `15-home-subtasks-finished.md`
16. `16-label-fetch-manual.md`
17. `17-subtask-release.md`
18. `18-subtask-data-save.md`
19. `19-subtask-data-pagination-filter.md`
20. `20-submit-client-validation.md`
21. `21-item-selection-navigation.md`
22. `22-home-open-subtask-detail.md`
23. `23-check-task-home.md`
24. `page-size-load-test-snippet.md`

## 通用约定

- 只记录当前有效结论，不写日期型历史流水。
- 路径、字段名、选择器、按钮文案都按脱敏后的稳定锚点记录。
- 单页参考固定使用 `请求标识 / 目的 -> 页面入口 / 触发动作 -> 请求摘要 -> 请求体摘要 -> 响应摘要 -> 关键字段 -> 前端接入建议 -> 风险 / 未确认项` 顺序。
- 不记录 token、cookie、authorization、完整签名 URL、真实敏感文本。

## 当前边界 / 待补项

- 新增缺口时，先补稳定参考结论，再同步更新对应平台 README 或 `log.md`。
- 如果目录当前没有专属差异，保持空目录或由父级 README 说明，不额外制造占位文档。

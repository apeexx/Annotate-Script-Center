# 中英短剧脚本 Network 参考索引

## 目录定位

- 目录：`platform-resources/aishell-tech/cn-en-short-drama/network`
- 类型：脚本专属 Network 稳定参考索引。
- 本目录只记录中英短剧整段评分模板相对平台共用 `04-mytask-mark.md` 的专属请求差异。

## 适用范围 / 当前覆盖

- 当前覆盖共享路由 `/mytask/mark?taskId=<taskId>&packageId=<packageId>` 下的“整段标注 + 多维评分”模板。
- 当前已沉淀：
  - 整段读取 `getLongWholeMark`
  - 整段保存 `saveLongWholeMark`
  - 完成标注 `finishLongMark`
  - 有效 / 无效切换 `setEffective` / `setInvalid`
  - 历史标注记录 `GetMarkHistoryList`
- 平台共用初始化请求、任务详情、条目列表和模板读取仍以下列资料为准：
  - `../../network/README.md`
  - `../../network/04-mytask-mark.md`

## 文件列表

| 文件 | 说明 |
| --- | --- |
| `01-mytask-mark-whole-segment.md` | `/mytask/mark` 整段标注模板专属请求与按钮映射 |

## 阅读顺序

- 先读本索引，再读整段标注专项单页。
1. `01-mytask-mark-whole-segment.md`
2. 需要平台共用初始化时，再回看 `../../network/04-mytask-mark.md`

## 通用约定

- 只记录当前有效结论，不写会话流水。
- 请求路径、字段名、按钮文案都按脱敏后的稳定锚点记录。
- 单页参考固定使用 `请求标识 / 目的 -> 页面入口 / 触发动作 -> 请求摘要 -> 请求体摘要 -> 响应摘要 -> 关键字段 -> 前端接入建议 -> 风险 / 未确认项` 顺序。
- 不记录 token、cookie、authorization、完整资源 URL、真实标注文本。

## 当前边界 / 待补项

- 当前结论来自 live 页面按钮测试、历史弹窗直采与 bundle 静态分析交叉核验，不包含完整 HAR。
- `查看历史标注记录` 当前已确认会拉起历史弹窗；live 复现时表格头正常渲染，但内容显示 `暂无数据`，同时运行时日志仍输出缺少 `taskItemId` 后缀的 `/api/mark/GetMarkHistoryList/`。
- 当前仍缺原始 request/response headers 与 response body 级别的浏览器面板记录。
- 当前文档只服务脚本资料初始化，不代表已授权前端绕过真实页面按钮直接调用保存 / 完成接口。

# Aishell Tech Network参考索引
## 目录定位

- 目录：`platform-resources/aishell-tech/network`
- 类型：Network 稳定参考索引。
- 本目录只保留当前有效结论，不再承载会话交接、复测流水或历史过程文档。

## 适用范围 / 当前覆盖

- 当前保留 5 份稳定参考页。
- 当前目录聚焦接口入口、请求摘要、响应结构、接入建议和风险边界。
- 过程型记录已移出主参考目录；如需追加历史过程，统一写入 `log.md`。

## 文件列表

| 文件 | 说明 |
| --- | --- |
| `01-index.md` | 01-首页 网络请求 |
| `02-mytask-index.md` | 02-我的任务列表 网络请求 |
| `03-mytask-detail.md` | 04-任务详情 网络请求 |
| `04-mytask-mark.md` | 04-数据标注 网络请求 |
| `05-organization.md` | 05-我的团队 网络请求 |

## 阅读顺序

- 先读本索引，再按文件名顺序下钻到对应单页参考。
1. `01-index.md`
2. `02-mytask-index.md`
3. `03-mytask-detail.md`
4. `04-mytask-mark.md`
5. `05-organization.md`

## 通用约定

- 只记录当前有效结论，不写日期型历史流水。
- 路径、字段名、选择器、按钮文案都按脱敏后的稳定锚点记录。
- 单页参考固定使用 `请求标识 / 目的 -> 页面入口 / 触发动作 -> 请求摘要 -> 请求体摘要 -> 响应摘要 -> 关键字段 -> 前端接入建议 -> 风险 / 未确认项` 顺序。
- 不记录 token、cookie、authorization、完整签名 URL、真实敏感文本。

## 当前边界 / 待补项

- 新增缺口时，先补稳定参考结论，再同步更新对应平台 README 或 `log.md`。
- 如果目录当前没有专属差异，保持空目录或由父级 README 说明，不额外制造占位文档。
- Aishell 当前 `/mytask/mark` 的 Network 已至少存在两类模板：
  - 共享短标注模板：继续维护在 `04-mytask-mark.md`
  - 中英短剧脚本专属整段评分模板：单独维护在 `../cn-en-short-drama/network/README.md`

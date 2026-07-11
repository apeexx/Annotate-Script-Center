# ASR Judgement Data 目录

`platform-resources/alibaba-labelx/asr-judgement/data/` 用于脚本级数据逻辑。

当前阶段：

- 已新增 `adapter.js`，负责快判下载 / suppliers / existing 的脚本级差异：
  - 下载文件名前缀
  - 3 个标注槽位与审核槽位的选 row 规则
  - `complete` 判定
  - 分包缺失时的缺字段提示
- 快判统计上传、合并与落盘后端当前仍保留在 `backend/`。
- 未来如新增字段映射、供应商样例或脱敏样例，优先收口到这里。

## 标注 existing 双键规则

- 标注角色 existing 的脚本级身份键已改为 `用户名 + subTaskId`。
- `adapter.js` 当前规则：
  - 只有双键同时命中同一标注槽位时，`evaluateCompletion()` 才会返回 `complete=true`。
  - 只命中用户名或只命中 `subTaskId` 时，返回 `complete=false`，并给出双键冲突类缺字段提示。
  - 空用户名或空 `subTaskId` 不会被当成完整记录。
  - `pickRow()` 对标注不再按“任意 `subTaskId` 命中或首行兜底”判定完成，只把双键精确命中作为完整槽位。
- 前端首页上传当前会消费这两类双键冲突缺字段提示，并把它们记为“冲突跳过”；因此这里的冲突文案属于前后端共享契约，不应随意改名。
- 这套规则用于保证“清空旧数据后重新全量上传”的正确性，不兼容历史脏数据。

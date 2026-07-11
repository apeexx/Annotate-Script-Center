# Aishell Tech 泰语助手数据目录

## 当前内容

- `ai-call-log.js`：脚本级 AI 调用日志定义。
- `runtime/`：运行时写出的 CSV 文件目录。

## 日志口径

- 数据集 ID：`aishell-tech-thai-helper-ai`
- 默认文件：`ai-calls-YYYY-MM-DD.csv`
- 当前只记录单阶段 `recognize`：
  - 双字段结果口径：`text + speed`
  - 识别模型
  - 识别耗时
  - Token
  - 识别预估人民币
  - 总预估人民币
  - 任务 / 分包 / 条目 ID
  - 缓存命中 / 重试 / 取消状态

## 约束

- `runtime/` 下运行文件不提交 Git。
- 不写入 token、cookie、authorization、完整音频 URL。

# Magic Data 客家话词表目录

## 文件约定

- Excel 原始文件：`客家话-正字表.xlsx`
- 后端运行时主读 JSON：`hakka-lexicon.json`
- 参考源 CSV：`hakka-lexicon.csv`

## 说明

- 后端实际读取 `hakka-lexicon.json`。
- `hakka-lexicon.json` 继续复用统一业务词表 JSON schema：
  - 顶层字段：`schemaVersion / language / mode / sourceFiles / updatedAt / entries`
  - 单条字段：`id / normalized / display / mandarin / aliases / notes / tags / attributes`
- 当前除词表上下文提示外，后端还会把它用于“最终客家话建议文本”的 `exact` 正字归一化。
- 词条内容默认由用户维护；Codex 本轮只做结构接入、校验、测试和运行时读取，不改词条语义。
- 如果没有词表文件，后端仍可运行，接口返回 `lexicon.status=missing`。
- 如果只有 `hakka-lexicon.csv`，当前仍只把 CSV 视为参考源，不回退成 CSV 主读取。

## 转换方式

如仓库已具备 `xlsx` 依赖，可运行：

```powershell
node platform-resources\magic-data\hakka-helper\backend\tools\convert-hakka-lexicon.js
```

若当前仓库没有 `xlsx` 依赖，请手动将 Excel 另存为 UTF-8 CSV，文件名保持 `hakka-lexicon.csv`。

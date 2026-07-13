# Magic Data 客家话词表目录

## 文件约定

- Excel 原始文件：`客家话-正字表.xlsx`（当前为 7 月版）
- 后端运行时主读 JSON：`hakka-lexicon.json`
- 参考源 CSV：`hakka-lexicon.csv`

## 说明

- 后端实际读取 `hakka-lexicon.json`。
- `hakka-lexicon.json` 继续复用统一业务词表 JSON schema：
  - 顶层字段：`schemaVersion / language / mode / sourceFiles / updatedAt / entries`
  - 单条字段：`id / normalized / display / mandarin / aliases / notes / tags / attributes`
- 当前除词表上下文提示外，后端还会把它用于“最终客家话建议文本”的 `exact` 正字归一化。
- 词条内容默认由用户维护；当前转换只合并 Excel 的“正字”和“补充正字”工作表，“疑问”工作表不进入运行时词表。
- 如果没有词表文件，后端仍可运行，接口返回 `lexicon.status=missing`。
- 如果只有 `hakka-lexicon.csv`，当前仍只把 CSV 视为参考源，不回退成 CSV 主读取。

## 转换方式

如维护环境已具备 `xlsx` 依赖，可运行：

```powershell
node platform-resources\magic-data\hakka-helper\backend\tools\convert-hakka-lexicon.js
```

该脚本会同时重建 `hakka-lexicon.csv` 与 `hakka-lexicon.json`；没有 `xlsx` 依赖时，请在具备该依赖的维护环境运行，不要手工编辑运行时 JSON。

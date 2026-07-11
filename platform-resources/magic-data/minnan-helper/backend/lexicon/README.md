# Magic Data 闽南语词表目录

## 文件约定

- 运行时主文件：`minnan-lexicon.json`
- 参考源 CSV：`minnan-lexicon.csv`
- 可选 Excel：`闽南语-推荐词表.xlsx`

## 说明

- 后端默认读取 `minnan-lexicon.json`。
- 第一版是“词表提示模式”，不做强替换。
- 如果词表缺失，后端仍可运行，接口返回 `lexicon.status=missing`。

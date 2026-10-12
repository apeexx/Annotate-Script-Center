# Magic Data 闽南语词表目录

## 文件约定

- 可选导入来源 JSON：`minnan-lexicon.json`
- 参考源 CSV：`minnan-lexicon.csv`
- 可选 Excel：`闽南语-推荐词表.xlsx`

## 说明

- 后端默认查询 SQLite；初始化从现有 `minnan-lexicon.csv` 导入。
- 第一版是“词表提示模式”，不做强替换。
- 如果数据库或对应词表未初始化，后端仍可运行，接口返回 `lexicon.status=missing`。

## 数据库维护

运行时词表标识：`magic-data/minnan-helper`。首次启动前在仓库根目录执行 `node scripts/import-lexicons.js`；更新源文件后执行 `node scripts/import-lexicons.js --replace --lexicon magic-data/minnan-helper` 并重启后端。运行环境要求 Node.js 24，数据库路径由 `ASC_LEXICON_DB_PATH` 配置。完整备份、恢复和自定义来源说明见 `platform-resources/backend/README.md`。

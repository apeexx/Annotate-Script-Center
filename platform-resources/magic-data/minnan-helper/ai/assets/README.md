# Minnan Helper AI Assets

当前目录是 `magic-data/minnan-helper` 接入统一 AI framework 的资产占位目录。

当前阶段：

- 闽南语助手仍沿用 `backend/ai-service.js` 内的 prompt/template 和 SQLite 闽南语词表（CSV 为默认导入源）；`backend/lexicon/minnan-lexicon.csv` 只保留为参考源。
- 本轮先完成 adapter 桥接，不一次性迁移旧业务层。

后续迁移目标：

- prompt
- rules
- schema
- defaults
- lexicon 入口说明

## 数据库维护

运行时词表标识：`magic-data/minnan-helper`。首次启动前在仓库根目录执行 `node scripts/import-lexicons.js`；更新源文件后执行 `node scripts/import-lexicons.js --replace --lexicon magic-data/minnan-helper` 并重启后端。运行环境要求 Node.js 24，数据库路径由 `ASC_LEXICON_DB_PATH` 配置。完整备份、恢复和自定义来源说明见 `platform-resources/backend/README.md`。

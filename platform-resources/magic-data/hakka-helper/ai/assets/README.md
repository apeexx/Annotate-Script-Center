# Hakka Helper AI Assets

当前目录是 `magic-data/hakka-helper` 接入统一 AI framework 的资产占位目录。

当前阶段：

- 客家话助手仍沿用 `backend/ai-prompts.js`、`backend/ai-response-schema.js` 和 SQLite 客家话词表（JSON 为初始导入源）；`backend/lexicon/hakka-lexicon.csv` 只保留为参考源。
- 本轮先完成 adapter 桥接和 legacy `annotator` 路径兼容，不一次性迁移旧业务层。

后续迁移目标：

- prompt
- rules
- schema
- defaults
- lexicon 入口说明

## 数据库维护

运行时词表标识：`magic-data/hakka-helper`。首次启动前在仓库根目录执行 `node scripts/import-lexicons.js`；更新源文件后执行 `node scripts/import-lexicons.js --replace --lexicon magic-data/hakka-helper` 并重启后端。运行环境要求 Node.js 24，数据库路径由 `ASC_LEXICON_DB_PATH` 配置。完整备份、恢复和自定义来源说明见 `platform-resources/backend/README.md`。

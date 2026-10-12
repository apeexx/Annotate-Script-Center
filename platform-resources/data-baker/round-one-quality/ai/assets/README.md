# DataBaker AI Assets

当前目录是 `platform-resources/data-baker/round-one-quality/ai/` 的资产占位目录。

当前阶段：

- DataBaker 仍沿用 `backend/ai-service.js` 内的 prompt/template 和 SQLite 闽南语词表（JSON 为初始导入源）；`backend/reference/minnan-lexicon.csv` 只保留为参考源。
- 本轮先把 adapter 接入统一 framework，暂不一次性搬空旧业务层。

后续迁移会逐步把以下内容迁到这里：

- prompt
- rules
- schema
- defaults
- lexicon 入口说明

## 数据库维护

运行时词表标识：`data-baker/round-one-quality`。首次启动前在仓库根目录执行 `node scripts/import-lexicons.js`；更新源文件后执行 `node scripts/import-lexicons.js --replace --lexicon data-baker/round-one-quality` 并重启后端。运行环境要求 Node.js 24，数据库路径由 `ASC_LEXICON_DB_PATH` 配置。完整备份、恢复和自定义来源说明见 `platform-resources/backend/README.md`。

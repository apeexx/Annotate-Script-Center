# Hakka Helper AI Assets

当前目录是 `magic-data/hakka-helper` 接入统一 AI framework 的资产占位目录。

当前阶段：

- 客家话助手仍沿用 `backend/ai-prompts.js`、`backend/ai-response-schema.js` 和 `backend/lexicon/hakka-lexicon.json`；`backend/lexicon/hakka-lexicon.csv` 只保留为参考源。
- 本轮先完成 adapter 桥接和 legacy `annotator` 路径兼容，不一次性迁移旧业务层。

后续迁移目标：

- prompt
- rules
- schema
- defaults
- lexicon 入口说明

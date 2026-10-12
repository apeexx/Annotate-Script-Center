# 京东 TTS 上海话正字词表

## 导入来源

- `shanghainese-lexicon.json`：后端词表初始化导入来源。
- `prepare-shanghainese-lexicon-prompt.md`：将参考 Excel 整理为导入 JSON 的提示词。

## 维护边界

- `normalized` 与 `display` 均为《上海方言正字表最新.xlsx》“分类汇总表”第一列的同一正字。
- `aliases` 只维护人工确认的错写或异体字；不得由第三列普通话翻译反向推断，也不得包含空字符串或仅空白字符。
- 同一别名不得指向不同正字；词表不合法时后端安全原样回填。
- SQLite 是运行时存储，JSON/Excel 仅为导入或参考来源；运行时不读取这些源文件，不记录其绝对路径。

## 数据库维护

运行时词表标识：`jd-tts-annotation/shanghainese-helper`。首次启动前在仓库根目录执行 `node scripts/import-lexicons.js`；更新源文件后执行 `node scripts/import-lexicons.js --replace --lexicon jd-tts-annotation/shanghainese-helper` 并重启后端。运行环境要求 Node.js 24，数据库路径由 `ASC_LEXICON_DB_PATH` 配置。完整备份、恢复和自定义来源说明见 `platform-resources/backend/README.md`。

# 京东 TTS 上海话正字词表

## 运行时文件

- `shanghainese-lexicon.json`：后端唯一读取的运行时 JSON。
- `prepare-shanghainese-lexicon-prompt.md`：将参考 Excel 整理为运行时 JSON 的提示词。

## 维护边界

- `normalized` 与 `display` 均为《上海方言正字表最新.xlsx》“分类汇总表”第一列的同一正字。
- `aliases` 只维护人工确认的错写或异体字；不得由第三列普通话翻译反向推断，也不得包含空字符串或仅空白字符。
- 同一别名不得指向不同正字；词表不合法时后端安全原样回填。
- JSON 是主格式，Excel 仅为参考源；运行时不读取 Excel，不记录其绝对路径。

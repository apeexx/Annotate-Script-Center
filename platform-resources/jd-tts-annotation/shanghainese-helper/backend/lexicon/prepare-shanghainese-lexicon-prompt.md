# 上海话正字别名 JSON 整理提示词

请基于我上传的《上海方言正字表最新.xlsx》创建或更新 `shanghainese-lexicon.json` 的 `entries`。

要求：

1. 只把“分类汇总表”第一列“上海话词汇”作为 `normalized` 和 `display`，两个字段必须完全相同。
2. `aliases` 只能填写人工确认的错写、异体字或明确等价写法；没有确认别名时必须是空数组，不得填写空字符串或仅空白字符。
3. 严禁根据“普通话翻译”反向推断上海话词汇，严禁补充猜测别名，严禁将规范写法本身放进 `aliases`。
4. 同一别名不能映射到两个不同正字；不确定的词不要写入 `aliases`。
5. `mandarin` 可抄录第三列普通话翻译；没有翻译时使用空字符串。该字段不参与运行时替换。
6. 每条词条都必须包含 `id`、`normalized`、`display`、`mandarin`、`aliases`、`notes`、`tags`、`attributes`；其中 `notes/tags` 为数组，`attributes` 为对象。
7. 顶层字段固定为 `schemaVersion: 1`、`language: "shanghainese"`、`mode: "exact_alias_to_canonical"`、`sourceFiles`、`updatedAt`、`entries`。
8. 只返回合法 JSON，不要添加 Markdown、解释、音标、Prompt 或额外字段。

示例词条仅说明结构，不是可直接采用的词表数据：

{
  "id": "shanghai-0001",
  "normalized": "规范正字",
  "display": "规范正字",
  "mandarin": "",
  "aliases": ["人工确认的错写"],
  "notes": [],
  "tags": [],
  "attributes": {}
}

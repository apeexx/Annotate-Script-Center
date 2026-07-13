"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const converter = require("./convert-hakka-lexicon.js");

test("新版客家话正字表会合并正字与补充正字，并拆分别名", function () {
  assert.equal(typeof converter.convertWorkbookRows, "function");

  const result = converter.convertWorkbookRows({
    "正字": [
      {
        "客家话正字（转写内容）": "欸/了",
        "参考读音": "i1 / liau3",
        "普通话字/意思": "了",
        "备注": "主表备注",
      },
    ],
    "补充正字": [
      {
        "客家话正字（转写内容）": "细满仔",
        "参考读音": "se3man4zai3",
        "普通话字/意思": "小孩子",
      },
    ],
    "疑问": [
      {
        "客家话正字（转写内容）": "不应导入",
        "普通话字/意思": "不应导入",
      },
    ],
  });

  assert.deepEqual(result.rows, [
    {
      "序号": "1",
      "注音": "i1 / liau3",
      "语料统一用字": "欸",
      "其他可接受的写法": "了",
      "辞典将来用字参考": "",
      "普通话": "了",
      "优先级": "1",
      "备注": "主表备注",
    },
    {
      "序号": "2",
      "注音": "se3man4zai3",
      "语料统一用字": "细满仔",
      "其他可接受的写法": "",
      "辞典将来用字参考": "",
      "普通话": "小孩子",
      "优先级": "2",
      "备注": "",
    },
  ]);
  assert.deepEqual(result.ignoredSheets, ["疑问"]);
});

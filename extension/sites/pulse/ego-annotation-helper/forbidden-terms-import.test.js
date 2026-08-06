"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const modulePath = path.resolve(__dirname, "forbidden-terms-import.js");

function loadApi() {
  if (!fs.existsSync(modulePath)) {
    return {};
  }
  const context = { globalThis: {}, console };
  context.globalThis.globalThis = context.globalThis;
  vm.runInNewContext(fs.readFileSync(modulePath, "utf8"), context, { filename: modulePath });
  return context.globalThis.ASREdgePulseForbiddenTermsImport || {};
}

test("仅接受 xlsx，并把解析结果保留为待确认的导入草稿", async function () {
  const api = loadApi();
  assert.equal(typeof api.createImportDraft, "function");
  let parserCalls = 0;
  const file = {
    name: "八月禁用词.xlsx",
    arrayBuffer: async function () {
      return new ArrayBuffer(16);
    },
  };
  const draft = await api.createImportDraft(file, {
    parseXlsxTerms: async function () {
      parserCalls += 1;
      return {
        sourceColumn: "B",
        rawTermCount: 4,
        terms: ["检查", "摆弄", "A"],
      };
    },
  });

  assert.equal(parserCalls, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(draft)), {
    sourceFileName: "八月禁用词.xlsx",
    sourceColumn: "B",
    rawTermCount: 4,
    terms: ["检查", "摆弄", "A"],
  });
  await assert.rejects(
    api.createImportDraft({ name: "旧格式.xls", arrayBuffer: async function () { return new ArrayBuffer(0); } }, {}),
    /xlsx/i
  );
});

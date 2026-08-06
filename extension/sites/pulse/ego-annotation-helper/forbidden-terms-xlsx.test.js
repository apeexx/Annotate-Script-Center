"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const modulePath = path.resolve(__dirname, "forbidden-terms-xlsx.js");
const sourceWorkbookPath = path.resolve(__dirname, "..", "..", "..", "..", "platform-resources", "pulse", "ego-annotation-helper", "reference", "禁止使用词汇.xlsx");

function decodeXmlText(value) {
  return String(value || "")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function collectXmlElements(xml, tagName) {
  const expression = new RegExp("<" + tagName + "(?:\\s[^>]*)?/>|<" + tagName + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + tagName + ">", "g");
  const nodes = [];
  let match;
  while ((match = expression.exec(xml))) {
    const opening = match[0].slice(0, match[0].indexOf(">") + 1);
    const innerXml = match[1] || "";
    const attributes = {};
    opening.replace(/([\w:.-]+)=(?:"([^"]*)"|'([^']*)')/g, function (_all, name, doubleQuoted, singleQuoted) {
      attributes[name] = doubleQuoted == null ? singleQuoted : doubleQuoted;
      return _all;
    });
    nodes.push({
      getAttribute: function (name) {
        return Object.prototype.hasOwnProperty.call(attributes, name) ? attributes[name] : null;
      },
      getElementsByTagName: function (childTagName) {
        return collectXmlElements(innerXml, childTagName);
      },
      textContent: decodeXmlText(String(innerXml).replace(/<[^>]+>/g, "")),
    });
  }
  return nodes;
}

class TestDomParser {
  parseFromString(xml) {
    return {
      getElementsByTagName: function (tagName) {
        return collectXmlElements(xml, tagName);
      },
    };
  }
}

function loadApi() {
  if (!fs.existsSync(modulePath)) {
    return {};
  }
  const context = {
    globalThis: {
      Blob,
      DecompressionStream,
      Response,
      ASREdgePulseForbiddenTerms: {
        collectTermCandidates: function (values) {
          return values
            .flatMap(function (value) {
              return String(value || "").split(/[,，、]/);
            })
            .map(function (value) {
              return value.trim().replace(/^[“”‘’"']+|[“”‘’"']+$/g, "");
            })
            .filter(Boolean);
        },
        normalizeTerms: function (values) {
          const seen = new Set();
          return values
            .flatMap(function (value) {
              return String(value || "").split(/[,，、]/);
            })
            .map(function (value) {
              return value.trim().replace(/^[“”‘’"']+|[“”‘’"']+$/g, "");
            })
            .filter(function (value) {
              if (!value || seen.has(value)) return false;
              seen.add(value);
              return true;
            });
        },
      },
    },
    console,
    Blob,
    Response,
    TextDecoder,
  };
  context.globalThis.globalThis = context.globalThis;
  vm.runInNewContext(fs.readFileSync(modulePath, "utf8"), context, { filename: modulePath });
  return context.globalThis.ASREdgePulseForbiddenTermsXlsx || {};
}

function toArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

test("当前禁止使用词汇.xlsx 读取首个有内容列并得到 84 个去重词", async function () {
  const api = loadApi();
  assert.equal(typeof api.parseXlsxTerms, "function");
  const result = await api.parseXlsxTerms(toArrayBuffer(fs.readFileSync(sourceWorkbookPath)), {
    DOMParser: TestDomParser,
  });

  assert.equal(result.sourceColumn, "B");
  assert.equal(result.rawTermCount, 85);
  assert.equal(result.terms.length, 84);
  assert.equal(result.terms.filter(function (term) { return term === "摆弄"; }).length, 1);
});

test("损坏或无有效词的工作簿拒绝解析", async function () {
  const api = loadApi();
  assert.equal(typeof api.parseXlsxTerms, "function");
  await assert.rejects(
    api.parseXlsxTerms(new ArrayBuffer(8), { DOMParser: TestDomParser }),
    /xlsx|Excel|工作簿|压缩/i
  );
});

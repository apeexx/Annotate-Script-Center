"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const modulePath = path.resolve(__dirname, "forbidden-terms.js");
const termsPath = path.resolve(__dirname, "data", "forbidden-terms.json");

function loadApi(options) {
  if (!fs.existsSync(modulePath)) {
    return {};
  }
  const config = options || {};
  const context = {
    globalThis: {},
    console,
    chrome: config.chrome,
    fetch: config.fetch,
  };
  context.globalThis.globalThis = context.globalThis;
  vm.runInNewContext(fs.readFileSync(modulePath, "utf8"), context, { filename: modulePath });
  return context.globalThis.ASREdgePulseForbiddenTerms || {};
}

function createChromeStorage(initialValues) {
  const values = Object.assign({}, initialValues || {});
  return {
    values,
    chrome: {
      runtime: {
        getURL: function (path) {
          return "chrome-extension://pulse/" + path;
        },
        lastError: null,
      },
      storage: {
        local: {
          get: function (key, callback) {
            callback({ [key]: values[key] });
          },
          set: function (payload, callback) {
            Object.assign(values, payload);
            callback();
          },
          remove: function (key, callback) {
            delete values[key];
            callback();
          },
        },
      },
    },
  };
}

test("禁用词词表从 Excel 参考源导入为 84 条去重词", function () {
  const api = loadApi();
  assert.equal(typeof api.normalizeTerms, "function");
  const data = fs.existsSync(termsPath)
    ? JSON.parse(fs.readFileSync(termsPath, "utf8"))
    : { terms: [] };
  const terms = api.normalizeTerms(data.terms);

  assert.equal(terms.length, 84);
  assert.equal(terms.filter((term) => term === "摆弄").length, 1);
  assert.ok(terms.includes("手"));
  assert.ok(terms.includes("a"));
  assert.ok(terms.includes("A"));
});

test("禁用词按最长词优先且不会产生嵌套命中", function () {
  const api = loadApi();
  assert.equal(typeof api.createMatcher, "function");
  const matcher = api.createMatcher(["猛", "猛推", "推"]);

  assert.deepEqual(
    JSON.parse(JSON.stringify(matcher.find("猛推猛"))),
    [
      { start: 0, end: 2, term: "猛推" },
      { start: 2, end: 3, term: "猛" },
    ]
  );
});

test("禁用词按字面子串区分大小写，并保留每一次独立命中", function () {
  const api = loadApi();
  assert.equal(typeof api.createMatcher, "function");
  const matcher = api.createMatcher(["手", "a", "A"]);

  assert.deepEqual(
    JSON.parse(JSON.stringify(matcher.find("右手 Aa a手"))),
    [
      { start: 1, end: 2, term: "手" },
      { start: 3, end: 4, term: "A" },
      { start: 4, end: 5, term: "a" },
      { start: 6, end: 7, term: "a" },
      { start: 7, end: 8, term: "手" },
    ]
  );
  assert.deepEqual(JSON.parse(JSON.stringify(matcher.find(""))), []);
});

test("导入词项沿用 Excel 的分隔符、引号清理与首次出现顺序", function () {
  const api = loadApi();
  assert.equal(typeof api.collectTermCandidates, "function");
  assert.deepEqual(
    JSON.parse(JSON.stringify(api.collectTermCandidates([" “检查”、“查看” ", "摆弄,摆弄、A,a"]))),
    ["检查", "查看", "摆弄", "摆弄", "A", "a"]
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(api.normalizeTerms([" “检查”、“查看” ", "摆弄,摆弄、A,a"]))),
    ["检查", "查看", "摆弄", "A", "a"]
  );
});

test("有效自定义词表优先于内置表，清除后回退默认词表", async function () {
  const storage = createChromeStorage();
  const api = loadApi({
    chrome: storage.chrome,
    fetch: async function () {
      return {
        ok: true,
        json: async function () {
          return { terms: ["默认词"] };
        },
      };
    },
  });
  assert.equal(typeof api.saveCustomTerms, "function");
  assert.equal(typeof api.clearCustomTerms, "function");
  assert.equal(typeof api.invalidateMatcherCache, "function");

  const saved = await api.saveCustomTerms({
    sourceFileName: "更新表.xlsx",
    importedAt: "2026-08-06T06:00:00.000Z",
    terms: ["新词", "新词", "A"],
  });
  assert.deepEqual(JSON.parse(JSON.stringify(saved.terms)), ["新词", "A"]);
  assert.equal(storage.values[api.CUSTOM_TERMS_STORAGE_KEY].sourceFileName, "更新表.xlsx");

  const customMatcher = await api.loadMatcherFromExtension();
  assert.deepEqual(JSON.parse(JSON.stringify(customMatcher.find("默认词新词A"))), [
    { start: 3, end: 5, term: "新词" },
    { start: 5, end: 6, term: "A" },
  ]);

  await api.clearCustomTerms();
  api.invalidateMatcherCache();
  const defaultMatcher = await api.loadMatcherFromExtension();
  assert.deepEqual(JSON.parse(JSON.stringify(defaultMatcher.find("默认词新词"))), [
    { start: 0, end: 3, term: "默认词" },
  ]);
});

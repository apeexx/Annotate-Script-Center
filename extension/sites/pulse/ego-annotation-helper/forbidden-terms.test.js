"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const modulePath = path.resolve(__dirname, "forbidden-terms.js");
const termsPath = path.resolve(__dirname, "data", "forbidden-terms.json");

function loadApi() {
  if (!fs.existsSync(modulePath)) {
    return {};
  }
  const context = { globalThis: {}, console };
  context.globalThis.globalThis = context.globalThis;
  vm.runInNewContext(fs.readFileSync(modulePath, "utf8"), context, { filename: modulePath });
  return context.globalThis.ASREdgePulseForbiddenTerms || {};
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

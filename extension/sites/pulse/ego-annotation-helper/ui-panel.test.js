"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const modulePath = path.resolve(__dirname, "ui-panel.js");

function loadApi() {
  if (!fs.existsSync(modulePath)) {
    return {};
  }
  const context = { globalThis: {}, console };
  context.globalThis.globalThis = context.globalThis;
  vm.runInNewContext(fs.readFileSync(modulePath, "utf8"), context, { filename: modulePath });
  return context.globalThis.ASREdgePulseUiPanel || {};
}

test("中文翻译锚点只接受精确标签并定位包含 textarea 的父组", function () {
  const api = loadApi();
  assert.equal(typeof api.findTranslationGroup, "function");
  const textarea = { value: "原始文本" };
  const group = { querySelector: (selector) => (selector === "textarea" ? textarea : null) };
  const header = { parentElement: group };
  const label = { textContent: "中文翻译", parentElement: header };
  const root = {
    querySelectorAll: () => [{ textContent: "英文翻译", parentElement: header }, label],
  };

  assert.equal(api.findTranslationGroup(root), group);
});

test("核查横条完全保留原文，仅把命中区间标记为红色片段", function () {
  const api = loadApi();
  assert.equal(typeof api.createHighlightParts, "function");
  const text = "右手拿起A罐";
  const parts = api.createHighlightParts(text, [
    { start: 1, end: 2, term: "手" },
    { start: 4, end: 5, term: "A" },
  ]);

  assert.equal(parts.map((part) => part.text).join(""), text);
  assert.deepEqual(
    JSON.parse(JSON.stringify(parts.filter((part) => part.type === "match").map((part) => part.text))),
    ["手", "A"]
  );
  assert.deepEqual(JSON.parse(JSON.stringify(api.createHighlightParts(text, []))), [
    { type: "text", text },
  ]);
});

test("React 重绘后已有面板不会重复挂载，规则文案保留换行", function () {
  const api = loadApi();
  assert.equal(typeof api.hasMountedPanel, "function");
  assert.equal(api.hasMountedPanel({ querySelector: () => ({}) }), true);
  assert.equal(api.hasMountedPanel({ querySelector: () => null }), false);
  assert.match(api.RULE_TEXT, /\n/);
  assert.match(api.RULE_TEXT, /不要照抄模板/);
});

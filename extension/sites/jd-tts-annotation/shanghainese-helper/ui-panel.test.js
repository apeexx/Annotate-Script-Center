"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const panel = require(path.resolve(__dirname, "ui-panel.js"));

function createHarness() {
  const events = [];
  const textarea = { value: "旧文本", disabled: false, readOnly: false, dispatchEvent(event) { events.push(event); } };
  const pinyin = { value: "pin yin", querySelector() { throw new Error("must not query pinyin"); } };
  const textContainer = { querySelector(selector) { assert.equal(selector, "textarea.el-textarea__inner"); return textarea; }, insertAdjacentElement() {} };
  const label = { textContent: "文本:", nextElementSibling: textContainer };
  const pinyinLabel = { textContent: "拼音:", nextElementSibling: pinyin };
  const document = {
    querySelectorAll(selector) { assert.equal(selector, "span"); return [pinyinLabel, label]; },
    createElement() { return { textContent: "", disabled: false, addEventListener() {}, remove() {} }; },
  };
  function Textarea() {}
  Object.defineProperty(Textarea.prototype, "value", { set(value) { this._nativeValue = value; }, get() { return this._nativeValue; } });
  function InputEvent(type, init) { this.type = type; Object.assign(this, init); }
  return { document, textarea, pinyin, events, Textarea, InputEvent };
}

test("JD Shanghai panel selects only the textarea immediately after the exact text label and dispatches input only", function () {
  const harness = createHarness();
  const runtime = panel.createRuntime({ document: harness.document, HTMLTextAreaElement: harness.Textarea, InputEvent: harness.InputEvent });
  runtime.ensureMounted();
  assert.equal(runtime.fillRecommendedText({ listenText: "侬好" }, function () { return true; }), true);
  assert.equal(harness.textarea._nativeValue, "侬好");
  assert.equal(harness.pinyin.value, "pin yin");
  assert.deepEqual(harness.events.map(function (event) { return [event.type, event.bubbles, event.inputType, event.data]; }), [["input", true, "insertText", "侬好"]]);
});

test("JD Shanghai panel refuses all no-write cases without touching the pinyin field", function () {
  const harness = createHarness();
  const runtime = panel.createRuntime({ document: harness.document, HTMLTextAreaElement: harness.Textarea, InputEvent: harness.InputEvent });
  runtime.ensureMounted();
  assert.equal(runtime.fillRecommendedText({ listenText: "" }, function () { return true; }), false);
  harness.textarea.disabled = true;
  assert.equal(runtime.fillRecommendedText({ listenText: "识别文本" }, function () { return true; }), false);
  harness.textarea.disabled = false;
  assert.equal(runtime.fillRecommendedText({ listenText: "识别文本" }, function () { return false; }), false);
  assert.equal(harness.textarea._nativeValue, undefined);
  assert.equal(harness.pinyin.value, "pin yin");
  assert.equal(harness.events.length, 0);
});

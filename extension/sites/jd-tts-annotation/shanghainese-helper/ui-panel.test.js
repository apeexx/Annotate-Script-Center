"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const panel = require(path.resolve(__dirname, "ui-panel.js"));

function createHarness() {
  const events = [];
  const pinyin = {};
  Object.defineProperty(pinyin, "value", { get() { throw new Error("must not access pinyin value"); }, set() { throw new Error("must not write pinyin value"); } });
  const textarea = {
    disabled: false,
    readOnly: false,
    dispatchEvent(event) { events.push(event); },
    focus() { throw new Error("must not focus platform textarea"); },
    blur() { throw new Error("must not blur platform textarea"); },
    click() { throw new Error("must not click platform textarea"); },
    change() { throw new Error("must not change platform textarea"); },
    save() { throw new Error("must not save platform textarea"); },
    submit() { throw new Error("must not submit platform textarea"); },
    reserve() { throw new Error("must not reserve platform textarea"); },
  };
  const textContainer = {
    querySelector(selector) { assert.equal(selector, "textarea.el-textarea__inner"); return textarea; },
    insertAdjacentElement(_position, button) { button.parentElement = this; button.isConnected = true; },
  };
  textarea.parentElement = textContainer;
  const label = { textContent: "文本:", nextElementSibling: textContainer };
  const buttons = [];
  const document = {
    querySelector(selector) { assert.equal(selector, "div.cell > span:first-child"); return label; },
    createElement() {
      const button = { disabled: false, isConnected: false, addEventListener() {}, remove() { this.isConnected = false; this.parentElement = null; } };
      buttons.push(button);
      return button;
    },
  };
  function Textarea() {}
  Object.defineProperty(Textarea.prototype, "value", { set(value) { this._nativeValue = value; }, get() { return this._nativeValue; } });
  function InputEvent(type, init) { this.type = type; Object.assign(this, init); }
  return { document, textarea, pinyin, textContainer, buttons, events, Textarea, InputEvent };
}

test("JD Shanghai panel selects only the textarea after the exact text label and dispatches input only", function () {
  const harness = createHarness();
  const runtime = panel.createRuntime({ document: harness.document, HTMLTextAreaElement: harness.Textarea, InputEvent: harness.InputEvent });
  runtime.ensureMounted();
  assert.equal(runtime.fillRecommendedText({ listenText: "侬好" }, function () { return true; }), true);
  assert.equal(harness.textarea._nativeValue, "侬好");
  assert.deepEqual(harness.events.map(function (event) { return [event.type, event.bubbles, event.inputType, event.data]; }), [["input", true, "insertText", "侬好"]]);
});

test("JD Shanghai panel refuses readonly or stale writes without touching pinyin", function () {
  const harness = createHarness();
  const runtime = panel.createRuntime({ document: harness.document, HTMLTextAreaElement: harness.Textarea, InputEvent: harness.InputEvent });
  runtime.ensureMounted();
  assert.equal(runtime.fillRecommendedText({ listenText: "" }, function () { return true; }), false);
  harness.textarea.disabled = true;
  assert.equal(runtime.fillRecommendedText({ listenText: "不应写入" }, function () { return true; }), false);
  harness.textarea.disabled = false;
  harness.textarea.readOnly = true;
  assert.equal(runtime.fillRecommendedText({ listenText: "不应写入" }, function () { return true; }), false);
  harness.textarea.readOnly = false;
  assert.equal(runtime.fillRecommendedText({ listenText: "不应写入" }, function () { return false; }), false);
  assert.equal(harness.textarea._nativeValue, undefined);
  assert.equal(harness.events.length, 0);
});

test("JD Shanghai panel remounts its detached button without accessing the pinyin field", function () {
  const harness = createHarness();
  const runtime = panel.createRuntime({ document: harness.document, HTMLTextAreaElement: harness.Textarea, InputEvent: harness.InputEvent });
  runtime.ensureMounted();
  harness.buttons[0].isConnected = false;
  runtime.ensureMounted();
  assert.equal(harness.buttons.length, 2);
});

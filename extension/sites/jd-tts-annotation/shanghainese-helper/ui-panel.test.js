"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const panel = require(path.resolve(__dirname, "ui-panel.js"));

function createHarness(options) {
  const config = options || {};
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
    insertions: [],
    querySelector(selector) { assert.equal(selector, "textarea.el-textarea__inner"); return textarea; },
    insertAdjacentElement(position, button) {
      this.insertions.push([position, button]);
      assert.equal(position, "afterend");
      button.parentElement = cell;
      button.isConnected = true;
      this.nextSibling = button;
    },
  };
  const cell = { id: "text-cell" };
  textContainer.parentElement = cell;
  textarea.parentElement = textContainer;
  const label = { textContent: "文本:", nextElementSibling: textContainer };
  const buttons = [];
  const toolbar = { id: "toolbar" };
  const secondToolbar = { id: "second-toolbar" };
  const wrongParent = { id: "wrong-parent" };
  function createNativeAutoAnnotate(parentElement) {
    const nativeMutations = [];
    const nativeButton = {
      textContent: "自动标注",
      parentElement,
      clickCalls: 0,
      insertAdjacentElement(position, button) {
        assert.equal(position, "afterend");
        if (config.nativeInsertionNoEffect === true) { return; }
        if (config.nativeInsertionWrongParent === true) {
          button.parentElement = wrongParent;
          button.isConnected = true;
          return;
        }
        button.parentElement = parentElement;
        button.isConnected = true;
        this.nextSibling = button;
      },
    };
    nativeButton.style = new Proxy({}, { set() { nativeMutations.push("style"); throw new Error("must not mutate native button style"); } });
    Object.defineProperty(nativeButton, "className", { get() { return ""; }, set() { nativeMutations.push("class"); throw new Error("must not mutate native button class"); } });
    nativeButton.setAttribute = function () { nativeMutations.push("attribute"); throw new Error("must not mutate native button attributes"); };
    nativeButton.addEventListener = function () { nativeMutations.push("listener"); throw new Error("must not attach native button listener"); };
    nativeButton.click = function () { this.clickCalls += 1; nativeMutations.push("click"); throw new Error("must not click native button"); };
    nativeButton.nativeMutations = nativeMutations;
    return nativeButton;
  }
  const nativeAutoAnnotate = createNativeAutoAnnotate(toolbar);
  const secondNativeAutoAnnotate = createNativeAutoAnnotate(secondToolbar);
  const toolbarButtons = config.withToolbar === false ? [] : [nativeAutoAnnotate];
  const document = {
    querySelector(selector) { assert.equal(selector, "div.cell > span:first-child"); return label; },
    querySelectorAll(selector) {
      assert.equal(selector, "button");
      return toolbarButtons;
    },
    createElement() {
      const button = {
        disabled: false,
        isConnected: false,
        style: {},
        addEventListener() {},
        remove() { this.isConnected = false; this.parentElement = null; },
      };
      buttons.push(button);
      return button;
    },
  };
  function Textarea() {}
  Object.defineProperty(Textarea.prototype, "value", { set(value) { this._nativeValue = value; }, get() { return this._nativeValue; } });
  function InputEvent(type, init) { this.type = type; Object.assign(this, init); }
  function replaceToolbarAutoAnnotate() {
    toolbarButtons.splice(0, toolbarButtons.length, secondNativeAutoAnnotate);
  }
  function showToolbar() { toolbarButtons.splice(0, toolbarButtons.length, nativeAutoAnnotate); }
  return { document, textarea, pinyin, textContainer, cell, toolbar, secondToolbar, wrongParent, nativeAutoAnnotate, secondNativeAutoAnnotate, replaceToolbarAutoAnnotate, showToolbar, buttons, events, Textarea, InputEvent };
}

test("JD Shanghai panel mounts its distinct recognition button after the native auto-annotation button", function () {
  const harness = createHarness();
  const runtime = panel.createRuntime({ document: harness.document, HTMLTextAreaElement: harness.Textarea, InputEvent: harness.InputEvent });

  assert.equal(runtime.ensureMounted(), true);
  assert.equal(harness.buttons.length, 1);
  assert.equal(harness.nativeAutoAnnotate.nextSibling, harness.buttons[0]);
  assert.equal(harness.buttons[0].textContent, "上海话识别");
  assert.equal(harness.buttons[0].title, "扩展功能：识别当前音频并仅填入文本");
  assert.equal(harness.nativeAutoAnnotate.clickCalls, 0);
});

test("JD Shanghai panel falls back to the text field when the native toolbar is unavailable", function () {
  const harness = createHarness({ withToolbar: false });
  const runtime = panel.createRuntime({ document: harness.document, HTMLTextAreaElement: harness.Textarea, InputEvent: harness.InputEvent });

  assert.equal(runtime.ensureMounted(), true);
  assert.equal(harness.textContainer.insertions.length, 1);
  assert.equal(harness.textContainer.insertions[0][0], "afterend");
  assert.equal(harness.buttons[0].parentElement, harness.cell);
  assert.equal(runtime.getMountTarget(), harness.cell);
  assert.equal(harness.buttons[0].textContent, "上海话识别");
});

test("JD Shanghai panel falls back to the text field when native insertion has no effect", function () {
  const harness = createHarness({ nativeInsertionNoEffect: true });
  const runtime = panel.createRuntime({ document: harness.document, HTMLTextAreaElement: harness.Textarea, InputEvent: harness.InputEvent });

  assert.equal(runtime.ensureMounted(), true);
  assert.equal(harness.textContainer.insertions.length, 1);
  assert.deepEqual(harness.textContainer.insertions[0], ["afterend", harness.buttons[0]]);
  assert.equal(harness.buttons[0].parentElement, harness.cell);
  assert.equal(harness.textContainer.nextSibling, harness.buttons[0]);
});

test("JD Shanghai panel relocates an incorrectly parented native insertion beside the text field", function () {
  const harness = createHarness({ nativeInsertionWrongParent: true });
  const runtime = panel.createRuntime({ document: harness.document, HTMLTextAreaElement: harness.Textarea, InputEvent: harness.InputEvent });

  assert.equal(runtime.ensureMounted(), true);
  assert.equal(harness.textContainer.insertions.length, 1);
  assert.deepEqual(harness.textContainer.insertions[0], ["afterend", harness.buttons[0]]);
  assert.equal(harness.textContainer.nextSibling, harness.buttons[0]);
  assert.equal(harness.buttons[0].parentElement, harness.cell);
  assert.notEqual(harness.buttons[0].parentElement, harness.wrongParent);
});

test("JD Shanghai panel migrates a connected fallback button into a newly available toolbar", function () {
  const harness = createHarness({ withToolbar: false });
  const runtime = panel.createRuntime({ document: harness.document, HTMLTextAreaElement: harness.Textarea, InputEvent: harness.InputEvent });

  runtime.ensureMounted();
  const fallbackButton = harness.buttons[0];
  harness.showToolbar();
  runtime.ensureMounted();

  assert.equal(harness.buttons.length, 2);
  assert.equal(fallbackButton.isConnected, false);
  assert.equal(fallbackButton.parentElement, null);
  assert.equal(harness.nativeAutoAnnotate.nextSibling, harness.buttons[1]);
  assert.equal(harness.buttons[1].parentElement, harness.toolbar);
});

test("JD Shanghai panel remounts into a replaced toolbar and reports that toolbar as its mount target", function () {
  const harness = createHarness();
  const runtime = panel.createRuntime({ document: harness.document, HTMLTextAreaElement: harness.Textarea, InputEvent: harness.InputEvent });

  runtime.ensureMounted();
  harness.buttons[0].isConnected = false;
  harness.replaceToolbarAutoAnnotate();
  runtime.ensureMounted();

  assert.equal(harness.buttons.length, 2);
  assert.equal(harness.buttons[0].isConnected, false);
  assert.equal(harness.secondNativeAutoAnnotate.nextSibling, harness.buttons[1]);
  assert.equal(runtime.getMountTarget(), harness.secondToolbar);
});

test("JD Shanghai panel reports its live parent or the text-field fallback instead of a stale mount target", function () {
  const harness = createHarness();
  const runtime = panel.createRuntime({ document: harness.document, HTMLTextAreaElement: harness.Textarea, InputEvent: harness.InputEvent });

  runtime.ensureMounted();
  harness.buttons[0].parentElement = harness.secondToolbar;
  assert.equal(runtime.getMountTarget(), harness.secondToolbar);
  harness.buttons[0].isConnected = false;
  harness.buttons[0].parentElement = null;
  assert.equal(runtime.getMountTarget(), harness.textContainer);
});

test("JD Shanghai panel mounts beside native auto-annotation without mutating or clicking it", function () {
  const harness = createHarness();
  const runtime = panel.createRuntime({ document: harness.document, HTMLTextAreaElement: harness.Textarea, InputEvent: harness.InputEvent });

  assert.equal(runtime.ensureMounted(), true);
  assert.deepEqual(harness.nativeAutoAnnotate.nativeMutations, []);
  assert.equal(harness.nativeAutoAnnotate.clickCalls, 0);
});

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

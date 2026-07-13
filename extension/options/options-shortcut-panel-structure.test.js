"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("options html loads the shared shortcut panel script and exposes a dedicated CVPC grid", function () {
  const html = fs.readFileSync(path.resolve(__dirname, "options.html"), "utf8");

  assert.match(html, /options-shared-shortcut-panel\.js/);
  assert.match(html, /id="data-baker-cvpc-shortcut-grid"/);
  assert.match(html, /id="data-baker-cvpc-recording-status"/);
  assert.match(html, /id="data-baker-cvpc-block-new-tab-tip"/);
  assert.match(html, /id="data-baker-cvpc-block-pause-state-tip"/);
  assert.match(html, /屏蔽“不能打开新的Tab页”提示|屏蔽'不能打开新的Tab页'提示|屏蔽.*不能打开新的Tab页.*提示/);
  assert.match(html, /屏蔽“系统进入暂停状态”提示|屏蔽'系统进入暂停状态'提示|屏蔽.*系统进入暂停状态.*提示/);
  assert.match(html, /默认全部未设置/);
  assert.doesNotMatch(html, /固定快捷键/);
});

test("options source routes CVPC shortcut rendering through the shared recordable shortcut grid", function () {
  const script = fs.readFileSync(path.resolve(__dirname, "options.js"), "utf8");

  assert.match(script, /const sharedShortcutPanel = globalThis\.ASREdgeOptionsSharedShortcutPanel/);
  assert.match(script, /function renderRecordableShortcutGrid\(/);
  assert.match(script, /gridId: "data-baker-cvpc-shortcut-grid"/);
  assert.match(script, /actions: dataBakerCvpcShortcutActions/);
  assert.match(script, /values: dataBakerCvpcShortcutsDraft/);
  assert.doesNotMatch(script, /createDataBakerCvpcFixedShortcutMap/);
});

test("options html renames the Abaka shortcut reset action to clear shortcuts", function () {
  const html = fs.readFileSync(path.resolve(__dirname, "options.html"), "utf8");

  assert.match(html, /id="abaka-reset-shortcuts"/);
  assert.match(html, /清空快捷键/);
  assert.doesNotMatch(html, /恢复默认快捷键/);
});

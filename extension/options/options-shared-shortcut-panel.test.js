"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildShortcutGridMarkup,
} = require("./options-shared-shortcut-panel");

function formatShortcut(value) {
  if (!value) {
    return "未设置";
  }
  const parts = [];
  if (value.alt) {
    parts.push("Alt");
  }
  if (value.shift) {
    parts.push("Shift");
  }
  parts.push(String(value.key || ""));
  return parts.join(" + ");
}

test("shared shortcut panel renders recordable rows with record and clear buttons", function () {
  const html = buildShortcutGridMarkup({
    mode: "recordable",
    actions: [{ key: "preview", label: "生成画段建议" }],
    values: {
      preview: { alt: true, shift: true, key: "4" },
    },
    formatShortcut,
    recordAttrName: "data-record-cvpc-shortcut",
    clearAttrName: "data-clear-cvpc-shortcut",
  });

  assert.match(html, /shortcut-row/);
  assert.match(html, /生成画段建议/);
  assert.match(html, /Alt \+ Shift \+ 4/);
  assert.match(html, /data-record-cvpc-shortcut="preview"/);
  assert.match(html, /data-clear-cvpc-shortcut="preview"/);
  assert.match(html, /secondary-button/);
  assert.match(html, /ghost-button/);
});

test("shared shortcut panel shows recording state in recordable mode", function () {
  const html = buildShortcutGridMarkup({
    mode: "recordable",
    actions: [{ key: "preview", label: "生成画段建议" }],
    values: {
      preview: { alt: true, shift: true, key: "4" },
    },
    recordingKey: "preview",
    formatShortcut,
    recordAttrName: "data-record-cvpc-shortcut",
    clearAttrName: "data-clear-cvpc-shortcut",
  });

  assert.match(html, /录制中\.\.\./);
  assert.match(html, />录制中</);
});

test("shared shortcut panel renders readonly rows without record and clear buttons", function () {
  const html = buildShortcutGridMarkup({
    mode: "readonly",
    actions: [{ key: "valid", label: "当前段设为 Valid" }],
    values: {
      valid: { alt: true, shift: true, key: "1" },
    },
    formatShortcut,
  });

  assert.match(html, /shortcut-row-readonly/);
  assert.match(html, /当前段设为 Valid/);
  assert.match(html, /Alt \+ Shift \+ 1/);
  assert.doesNotMatch(html, /secondary-button/);
  assert.doesNotMatch(html, /ghost-button/);
  assert.doesNotMatch(html, /data-record-/);
  assert.doesNotMatch(html, /data-clear-/);
});

test("shared shortcut panel shows 未设置 for empty recordable shortcuts", function () {
  const html = buildShortcutGridMarkup({
    mode: "recordable",
    actions: [{ key: "valid", label: "当前段设为 Valid" }],
    values: {
      valid: null,
    },
    formatShortcut,
    recordAttrName: "data-record-shortcut",
    clearAttrName: "data-clear-shortcut",
  });

  assert.match(html, /当前段设为 Valid/);
  assert.match(html, />未设置</);
  assert.match(html, /data-record-shortcut="valid"/);
});

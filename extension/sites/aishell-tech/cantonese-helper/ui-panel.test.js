"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const panel = require(path.resolve(__dirname, "ui-panel.js"));

test("Aishell Cantonese refuses to fill a result after the selected task item changes", function () {
  const isResultBoundToCurrentItem = panel.__test__.isResultBoundToCurrentItem;

  assert.equal(
    isResultBoundToCurrentItem(
      { taskItemId: "task-item-before", listenText: "旧条识别文本" },
      { taskItemId: "task-item-after" }
    ),
    false
  );
  assert.equal(
    isResultBoundToCurrentItem(
      { taskItemId: "task-item-current", listenText: "当前条识别文本" },
      { taskItemId: "task-item-current" }
    ),
    true
  );
});

test("Aishell Cantonese refuses to fill a result after only the selected blue segment changes", function () {
  const isResultBoundToCurrentItem = panel.__test__.isResultBoundToCurrentItem;

  assert.equal(
    isResultBoundToCurrentItem(
      { taskItemId: "task-item-current", itemKey: "task-item-current|region-1:1830-2990", listenText: "第一段" },
      { taskItemId: "task-item-current", key: "task-item-current|region-2:3150-6510" }
    ),
    false
  );
});

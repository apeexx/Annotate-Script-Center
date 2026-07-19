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

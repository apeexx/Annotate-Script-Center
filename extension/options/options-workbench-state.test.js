"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildDetailWorkbenchTrackState,
  buildPlatformEntryDescriptor,
  buildOrderedPlatformIds,
  movePlatformOrderItem,
  getDetailWorkbenchLayoutMode,
} = require("./options-workbench-state");

test("platform entry descriptor prefers explicit display host and entry url", function () {
  const result = buildPlatformEntryDescriptor({
    host: "datafactory.data-baker.com",
    displayHost: "datafactory.data-baker.com/v2",
    entryUrl: "https://datafactory.data-baker.com/v2",
    matches: ["https://datafactory.data-baker.com/*"],
  });

  assert.deepEqual(result, {
    displayHost: "datafactory.data-baker.com/v2",
    entryUrl: "https://datafactory.data-baker.com/v2",
  });
});

test("platform entry descriptor falls back to host and inferred root url", function () {
  const result = buildPlatformEntryDescriptor({
    host: "labelx.alibaba-inc.com",
    matches: ["https://labelx.alibaba-inc.com/corpora/labeling/*"],
  });

  assert.deepEqual(result, {
    displayHost: "labelx.alibaba-inc.com",
    entryUrl: "https://labelx.alibaba-inc.com",
  });
});

test("platform order keeps saved sequence and appends missing ids", function () {
  const result = buildOrderedPlatformIds(
    ["alibabaLabelx", "lightwheel", "dataBaker", "abakaAi"],
    ["dataBaker", "alibabaLabelx"]
  );

  assert.deepEqual(result, ["dataBaker", "alibabaLabelx", "lightwheel", "abakaAi"]);
});

test("platform order ignores duplicates and unknown ids", function () {
  const result = buildOrderedPlatformIds(
    ["alibabaLabelx", "lightwheel", "dataBaker"],
    ["unknown", "lightwheel", "lightwheel", "alibabaLabelx"]
  );

  assert.deepEqual(result, ["lightwheel", "alibabaLabelx", "dataBaker"]);
});

test("move platform order item repositions target id", function () {
  const result = movePlatformOrderItem(
    ["alibabaLabelx", "lightwheel", "dataBaker", "abakaAi"],
    "dataBaker",
    1
  );

  assert.deepEqual(result, ["alibabaLabelx", "dataBaker", "lightwheel", "abakaAi"]);
});

test("detail workbench layout mode uses layered defaults", function () {
  assert.equal(
    getDetailWorkbenchLayoutMode({
      hasBasePanel: true,
      hasAiPanel: true,
      hasShortcutPanel: true,
    }),
    "base-ai-shortcut"
  );

  assert.equal(
    getDetailWorkbenchLayoutMode({
      hasBasePanel: true,
      hasAiPanel: false,
      hasShortcutPanel: true,
    }),
    "base-shortcut"
  );

  assert.equal(
    getDetailWorkbenchLayoutMode({
      hasBasePanel: true,
      hasAiPanel: true,
      hasShortcutPanel: false,
    }),
    "base-ai"
  );

  assert.equal(
    getDetailWorkbenchLayoutMode({
      hasBasePanel: true,
      hasAiPanel: false,
      hasShortcutPanel: false,
    }),
    "single"
  );
});

test("detail workbench track state distributes panels across primary and secondary tracks", function () {
  assert.deepEqual(
    buildDetailWorkbenchTrackState({
      hasBasePanel: true,
      hasAiPanel: true,
      hasShortcutPanel: true,
    }),
    {
      primary: ["base", "shortcut"],
      secondary: ["ai"],
      panelCount: 3,
      isSingle: false,
    }
  );

  assert.deepEqual(
    buildDetailWorkbenchTrackState({
      hasBasePanel: true,
      hasAiPanel: false,
      hasShortcutPanel: true,
    }),
    {
      primary: ["base"],
      secondary: ["shortcut"],
      panelCount: 2,
      isSingle: false,
    }
  );

  assert.deepEqual(
    buildDetailWorkbenchTrackState({
      hasBasePanel: true,
      hasAiPanel: false,
      hasShortcutPanel: false,
    }),
    {
      primary: ["base"],
      secondary: [],
      panelCount: 1,
      isSingle: true,
    }
  );
});

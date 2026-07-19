"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const modulePath = path.resolve(__dirname, "ui-panel.js");

function loadModule() {
  delete require.cache[modulePath];
  delete globalThis.__ASREdgeAishellTechCantoneseUiPanelInstalled;
  delete globalThis.__ASREdgeAishellTechCantoneseUiPanel;
  const api = require(modulePath);
  return {
    api,
    cleanup: function () {
      delete require.cache[modulePath];
      delete globalThis.__ASREdgeAishellTechCantoneseUiPanelInstalled;
      delete globalThis.__ASREdgeAishellTechCantoneseUiPanel;
    },
  };
}

test("Cantonese result rows expose the three-stage texts and final speed", function () {
  const harness = loadModule();

  try {
    const helper = harness.api.__test__?.buildResultRows;
    assert.equal(typeof helper, "function");
    assert.deepEqual(
      helper({
        referenceText: "我而家去食飯。",
        convertedText: "我而家去食飯。",
        heardText: "我而家去食飯呀。",
        recommendedText: "我而家去食飯呀。",
        currentSpeed: "normal",
        recommendedSpeed: "fast",
      }),
      [
        ["原始参考文本", "我而家去食飯。"],
        ["转换候选", "我而家去食飯。"],
        ["听音文本", "我而家去食飯呀。"],
        ["最终推荐", "我而家去食飯呀。"],
        ["当前语速", "normal"],
        ["最终语速", "fast"],
      ]
    );
  } finally {
    harness.cleanup();
  }
});

test("Cantonese text-diff state marks a conversion difference", function () {
  const harness = loadModule();

  try {
    const helper = harness.api.__test__?.buildTextDiffState;
    assert.equal(typeof helper, "function");
    const diff = helper("我而家去食飯呀。", "我而家去食飯。 ");
    assert.equal(diff.hasDiff, true);
    assert.ok(diff.leftParts.some(function (part) {
      return part.type === "diff" && part.text.includes("呀");
    }));
  } finally {
    harness.cleanup();
  }
});

"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const modulePath = path.resolve(__dirname, "thai-helper", "ui-panel.js");

function loadModule() {
  delete require.cache[modulePath];
  delete globalThis.__ASREdgeAishellTechThaiUiPanelInstalled;
  delete globalThis.__ASREdgeAishellTechThaiUiPanel;
  const api = require(modulePath);
  return {
    api,
    cleanup: function () {
      delete require.cache[modulePath];
      delete globalThis.__ASREdgeAishellTechThaiUiPanelInstalled;
      delete globalThis.__ASREdgeAishellTechThaiUiPanel;
    },
  };
}

test("Aishell Thai result stays actionable when text matches but speed differs", function () {
  const harness = loadModule();

  try {
    const helper = harness.api.__test__?.canFillCurrentResult;
    assert.equal(typeof helper, "function");

    assert.equal(
      helper({
        referenceText: "ตั้งนาฬิกาปลุกเวลาหนึ่งโมงบ่าย",
        recommendedText: "ตั้งนาฬิกาปลุกเวลาหนึ่งโมงบ่าย",
        currentSpeed: "slow",
        recommendedSpeed: "normal",
      }),
      true
    );
    assert.equal(
      helper({
        referenceText: "ตั้งนาฬิกาปลุกเวลาหนึ่งโมงบ่าย",
        recommendedText: "ตั้งนาฬิกาปลุกเวลาหนึ่งโมงบ่าย",
        currentSpeed: "normal",
        recommendedSpeed: "normal",
      }),
      true
    );
  } finally {
    harness.cleanup();
  }
});

test("Aishell Thai result compares same-state hint against displayed values", function () {
  const harness = loadModule();

  try {
    const helper = harness.api.__test__?.isSameAsDisplayedCurrent;
    assert.equal(typeof helper, "function");

    assert.equal(
      helper({
        referenceText: "ตั้งนาฬิกาปลุกเวลาหนึ่งโมงบ่าย",
        recommendedText: "ตั้งนาฬิกาปลุกเวลาหนึ่งโมงบ่าย",
        currentSpeed: "正常",
        recommendedSpeed: "normal",
      }),
      false
    );
    assert.equal(
      helper({
        referenceText: "ตั้งนาฬิกาปลุกเวลาหนึ่งโมงบ่าย",
        recommendedText: "ตั้งนาฬิกาปลุกเวลาหนึ่งโมงบ่าย",
        currentSpeed: "normal",
        recommendedSpeed: "normal",
      }),
      true
    );
  } finally {
    harness.cleanup();
  }
});

test("Aishell Thai result rows include current and recommended speed", function () {
  const harness = loadModule();

  try {
    const helper = harness.api.__test__?.buildResultRows;
    assert.equal(typeof helper, "function");

    assert.deepEqual(
      helper({
        referenceText: "ตั้งนาฬิกาปลุกเวลาหนึ่งโมงบ่าย",
        recommendedText: "ตั้งนาฬิกาปลุกเวลาหนึ่งโมงบ่าย",
        currentSpeed: "slow",
        recommendedSpeed: "normal",
      }),
      [
        ["原始文本", "ตั้งนาฬิกาปลุกเวลาหนึ่งโมงบ่าย"],
        ["识别文本", "ตั้งนาฬิกาปลุกเวลาหนึ่งโมงบ่าย"],
        ["当前语速", "slow"],
        ["语速建议", "normal"],
      ]
    );
  } finally {
    harness.cleanup();
  }
});

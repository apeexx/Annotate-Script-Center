"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const dataApiModulePath = path.resolve(__dirname, "thai-helper", "data-api.js");

function loadApi() {
  delete require.cache[dataApiModulePath];
  delete globalThis.__ASREdgeAishellTechThaiDataApiInstalled;
  delete globalThis.__ASREdgeAishellTechThaiDataApi;
  const api = require(dataApiModulePath);
  return {
    api,
    cleanup: function () {
      delete require.cache[dataApiModulePath];
      delete globalThis.__ASREdgeAishellTechThaiDataApiInstalled;
      delete globalThis.__ASREdgeAishellTechThaiDataApi;
    },
  };
}

function createLabel(forValue, text) {
  return {
    textContent: text,
    getAttribute: function (name) {
      return String(name) === "for" ? forValue : "";
    },
  };
}

function createRow(labelFor, labelText, inputNode) {
  return {
    textContent: labelText,
    querySelector: function (selector) {
      if (selector === "label[for]") {
        return createLabel(labelFor, labelText);
      }
      if (selector === "input.el-input__inner[type='text']") {
        return inputNode;
      }
      return null;
    },
  };
}

test("Aishell Thai save payload keeps text and speed fields", function () {
  const harness = loadApi();

  try {
    const payload = harness.api.buildSaveShortMarkPayload(
      {
        taskItemId: "2065236136409829381",
        spendTime: 4,
        duration: 6.3,
      },
      {
        text: "ตั้งนาฬิกาปลุกเวลาหนึ่งโมงบ่าย",
        speed: "正常",
      }
    );

    assert.equal(
      payload.mark,
      JSON.stringify({
        text: "ตั้งนาฬิกาปลุกเวลาหนึ่งโมงบ่าย",
        speed: "normal",
      })
    );
    assert.equal(payload.taskItemId, "2065236136409829381");
    assert.equal(payload.spendTime, 4);
    assert.equal(payload.scene, "mark");
    assert.equal(payload.duration, 6.3);
  } finally {
    harness.cleanup();
  }
});

test("Aishell Thai field lookup resolves text and speed inputs by for attribute", function () {
  const harness = loadApi();

  try {
    const textInput = { id: "text-input" };
    const speedInput = { id: "speed-input" };
    const documentLike = {
      querySelectorAll: function (selector) {
        assert.equal(selector, ".mark-area .el-form-item");
        return [
          createRow("text", "文本", textInput),
          createRow("speed", "语速", speedInput),
        ];
      },
    };

    const fields = harness.api.findMarkFieldInputs(documentLike);

    assert.equal(fields.text, textInput);
    assert.equal(fields.speed, speedInput);
  } finally {
    harness.cleanup();
  }
});

test("Aishell Thai displayed field reader keeps raw speed text for UI hint checks", function () {
  const harness = loadApi();

  try {
    const textInput = {
      value: "ตั้งนาฬิกาปลุกเวลาหนึ่งโมงบ่าย.",
      tagName: "INPUT",
    };
    const speedInput = {
      value: "正常",
      tagName: "INPUT",
    };
    const documentLike = {
      querySelectorAll: function (selector) {
        assert.equal(selector, ".mark-area .el-form-item");
        return [
          createRow("text", "文本", textInput),
          createRow("speed", "语速", speedInput),
        ];
      },
    };

    const fields = harness.api.readDisplayedMarkFieldValues(documentLike);

    assert.deepEqual(fields, {
      text: "ตั้งนาฬิกาปลุกเวลาหนึ่งโมงบ่าย.",
      speed: "正常",
    });
    assert.equal(harness.api.normalizeThaiSpeedValue(fields.speed), "normal");
  } finally {
    harness.cleanup();
  }
});

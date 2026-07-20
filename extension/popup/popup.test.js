"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const popupPath = path.resolve(__dirname, "popup.js");

function createElement() {
  return {
    textContent: "",
    disabled: false,
    className: "",
    addEventListener() {},
  };
}

test("Aishell popup recognizes the enabled Cantonese assistant on the mark page", async function () {
  const previous = {
    ASREdgeConstants: globalThis.ASREdgeConstants,
    ASREdgeStorage: globalThis.ASREdgeStorage,
    chrome: globalThis.chrome,
    document: globalThis.document,
  };
  const elements = {
    "extension-name": createElement(),
    "stage-label": createElement(),
    "detected-title": createElement(),
    "detected-description": createElement(),
    "open-script-settings": createElement(),
    "detected-status-pill": createElement(),
    "popup-status": createElement(),
  };
  let onDomContentLoaded = null;
  globalThis.ASREdgeConstants = {
    AISHELL_TECH_CANTONESE_SCRIPT_ID: "aishellTechCantoneseAssistant",
    AISHELL_TECH_PLATFORM: { host: "mark.aishelltech.com" },
    EXTENSION_NAME: "标注脚本中心",
    STAGE_LABEL: "脚本中心",
    SCRIPT_LIBRARY: {
      aishellTechCantoneseAssistant: { label: "粤语助手" },
    },
    isScriptRuntimeAccessible(scriptId) {
      return scriptId === "aishellTechCantoneseAssistant";
    },
  };
  globalThis.ASREdgeStorage = {
    async getSettings() {
      return {
        platforms: {
          aishellTech: {
            activeScriptId: "aishellTechCantoneseAssistant",
            scripts: {
              cantoneseHelper: {
                enabled: true,
                aiRecommendEnabled: true,
              },
            },
          },
        },
      };
    },
  };
  globalThis.chrome = {
    tabs: {
      query(_queryInfo, callback) {
        callback([{ url: "https://mark.aishelltech.com/mytask/mark?taskId=task-1&packageId=package-1" }]);
      },
      create() {},
    },
    runtime: { getURL(value) { return value; } },
  };
  globalThis.document = {
    title: "",
    getElementById(id) {
      return elements[id];
    },
    addEventListener(name, callback) {
      if (name === "DOMContentLoaded") {
        onDomContentLoaded = callback;
      }
    },
  };

  delete require.cache[popupPath];
  try {
    require(popupPath);
    await onDomContentLoaded();
    assert.equal(elements["detected-title"].textContent, "粤语助手");
    assert.equal(elements["open-script-settings"].disabled, false);
    assert.equal(elements["detected-status-pill"].textContent, "已启用");
  } finally {
    delete require.cache[popupPath];
    Object.assign(globalThis, previous);
  }
});

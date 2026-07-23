"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const popupPath = path.resolve(__dirname, "popup.js");

function createElement() {
  const listeners = new Map();
  return {
    textContent: "",
    disabled: false,
    className: "",
    addEventListener(name, callback) {
      listeners.set(name, callback);
    },
    getListener(name) {
      return listeners.get(name);
    },
  };
}

async function flushAsyncWork() {
  for (let index = 0; index < 8; index += 1) {
    await Promise.resolve();
  }
}

async function loadPopup({ constants, storage, url }) {
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
  globalThis.ASREdgeConstants = constants;
  globalThis.ASREdgeStorage = storage;
  globalThis.chrome = {
    tabs: {
      query(_queryInfo, callback) {
        callback([{ url }]);
      },
      create() {},
    },
    runtime: { getURL(value) { return value; } },
  };
  globalThis.document = {
    title: "",
    getElementById(id) { return elements[id]; },
    addEventListener(name, callback) {
      if (name === "DOMContentLoaded") onDomContentLoaded = callback;
    },
  };

  delete require.cache[popupPath];
  try {
    require(popupPath);
    await onDomContentLoaded();
  } catch (error) {
    delete require.cache[popupPath];
    Object.assign(globalThis, previous);
    throw error;
  }

  return {
    elements,
    cleanup() {
      delete require.cache[popupPath];
      Object.assign(globalThis, previous);
    },
  };
}

test("Aishell popup recognizes the enabled Cantonese assistant on the mark page", async function () {
  const harness = await loadPopup({
    constants: {
      AISHELL_TECH_CANTONESE_SCRIPT_ID: "aishellTechCantoneseAssistant",
      AISHELL_TECH_PLATFORM: { host: "mark.aishelltech.com" },
      EXTENSION_NAME: "Script Center",
      STAGE_LABEL: "Script Center",
      SCRIPT_LIBRARY: {
        aishellTechCantoneseAssistant: { label: "Cantonese assistant" },
      },
      isScriptRuntimeAccessible(scriptId) {
        return scriptId === "aishellTechCantoneseAssistant";
      },
    },
    storage: {
      async getSettings() {
        return {
          platforms: {
            aishellTech: {
              activeScriptId: "aishellTechCantoneseAssistant",
              scripts: { cantoneseHelper: { enabled: true, aiRecommendEnabled: true } },
            },
          },
        };
      },
    },
    url: "https://mark.aishelltech.com/mytask/mark?taskId=task-1&packageId=package-1",
  });
  try {
    assert.equal(harness.elements["detected-title"].textContent, "Cantonese assistant");
    assert.equal(harness.elements["open-script-settings"].disabled, false);
  } finally {
    harness.cleanup();
  }
});

test("JD TTS popup recognizes the enabled Shanghai assistant on the annotation hash route", async function () {
  const harness = await loadPopup({
    constants: {
      JD_TTS_SHANGHAINESE_SCRIPT_ID: "jdTtsShanghaineseAssistant",
      JD_TTS_ANNOTATION_PLATFORM: { host: "tts-biaozhu-pub.jd.com" },
      EXTENSION_NAME: "Script Center",
      STAGE_LABEL: "Script Center",
      SCRIPT_LIBRARY: {
        jdTtsShanghaineseAssistant: { label: "Shanghai assistant" },
      },
      isScriptRuntimeAccessible(scriptId) {
        return scriptId === "jdTtsShanghaineseAssistant";
      },
    },
    storage: {
      async getSettings() {
        return {
          platforms: {
            jdTtsAnnotation: {
              enabled: true,
              activeScriptId: "jdTtsShanghaineseAssistant",
              scripts: { shanghaineseHelper: { enabled: true, aiRecommendEnabled: true } },
            },
          },
        };
      },
    },
    url: "https://tts-biaozhu-pub.jd.com/#/annotation/dataset/annotate",
  });
  try {
    assert.equal(harness.elements["detected-title"].textContent, "Shanghai assistant");
    assert.equal(harness.elements["open-script-settings"].disabled, false);
  } finally {
    harness.cleanup();
  }
});

test("JD TTS popup recognizes a disabled Shanghai assistant and enables it from the current page", async function () {
  let settings = { platforms: { jdTtsAnnotation: { enabled: false } } };
  const enableCalls = [];
  const harness = await loadPopup({
    constants: {
      JD_TTS_SHANGHAINESE_SCRIPT_ID: "jdTtsShanghaineseAssistant",
      JD_TTS_ANNOTATION_PLATFORM: { host: "tts-biaozhu-pub.jd.com" },
      EXTENSION_NAME: "Script Center",
      STAGE_LABEL: "Script Center",
      SCRIPT_LIBRARY: {
        jdTtsShanghaineseAssistant: { label: "Shanghai assistant" },
      },
      isScriptRuntimeAccessible(scriptId, currentSettings) {
        return Boolean(
          scriptId === "jdTtsShanghaineseAssistant" &&
            currentSettings?.platforms?.jdTtsAnnotation?.enabled === true &&
            currentSettings?.platforms?.jdTtsAnnotation?.activeScriptId === scriptId &&
            currentSettings?.platforms?.jdTtsAnnotation?.scripts?.shanghaineseHelper?.enabled === true &&
            currentSettings?.platforms?.jdTtsAnnotation?.scripts?.shanghaineseHelper?.aiRecommendEnabled === true
        );
      },
    },
    storage: {
      async getSettings() {
        return settings;
      },
      async setScriptEnabled(scriptId, enabled) {
        enableCalls.push([scriptId, enabled]);
        settings = {
          platforms: {
            jdTtsAnnotation: {
              enabled,
              activeScriptId: enabled ? scriptId : "",
              scripts: {
                shanghaineseHelper: { enabled, aiRecommendEnabled: enabled },
              },
            },
          },
        };
        return settings;
      },
    },
    url: "https://tts-biaozhu-pub.jd.com/#/annotation/dataset/annotate",
  });
  try {
    assert.equal(harness.elements["detected-title"].textContent, "Shanghai assistant");
    assert.equal(harness.elements["open-script-settings"].disabled, false);
    assert.equal(harness.elements["detected-status-pill"].disabled, false);
    harness.elements["detected-status-pill"].getListener("click")();
    await flushAsyncWork();
    assert.deepEqual(enableCalls, [["jdTtsShanghaineseAssistant", true]]);
    assert.equal(harness.elements["detected-status-pill"].className, "pill-toggle enabled");
  } finally {
    harness.cleanup();
  }
});

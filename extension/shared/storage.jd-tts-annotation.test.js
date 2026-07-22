"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const constantsModulePath = path.resolve(__dirname, "constants.js");
const storageModulePath = path.resolve(__dirname, "storage.js");

function loadStorageApi(initialSettings) {
  delete require.cache[constantsModulePath];
  delete require.cache[storageModulePath];
  delete globalThis.ASREdgeConstants;
  delete globalThis.ASREdgeStorage;

  const constants = require(constantsModulePath);
  const store = { [constants.STORAGE_KEY]: initialSettings || {} };
  globalThis.ASREdgeConstants = constants;
  globalThis.chrome = {
    runtime: { id: "test-extension", lastError: null },
    storage: {
      local: {
        get(key, callback) {
          callback({ [key]: store[key] });
        },
        set(payload, callback) {
          Object.assign(store, payload);
          callback();
        },
      },
    },
  };
  require(storageModulePath);
  return {
    constants,
    storage: globalThis.ASREdgeStorage,
    cleanup() {
      delete require.cache[constantsModulePath];
      delete require.cache[storageModulePath];
      delete globalThis.ASREdgeConstants;
      delete globalThis.ASREdgeStorage;
      delete globalThis.chrome;
    },
  };
}

test("JD TTS defaults to disabled and uses the fixed server endpoint", async function () {
  const harness = loadStorageApi({});
  try {
    const config = (await harness.storage.getSettings()).platforms.jdTtsAnnotation;
    assert.equal(config.enabled, false);
    assert.equal(config.activeScriptId, "");
    assert.equal(config.scripts.shanghaineseHelper.enabled, false);
    assert.equal(
      config.scripts.shanghaineseHelper.aiRecommendEndpoint,
      "https://script.aisiyunling.com/api/jd-tts-annotation/shanghainese-helper/ai/recommend"
    );
  } finally {
    harness.cleanup();
  }
});

test("JD TTS storage preserves the approved local endpoint", async function () {
  const harness = loadStorageApi({
    platforms: {
      jdTtsAnnotation: {
        scripts: {
          shanghaineseHelper: {
            aiRecommendEndpoint:
              "http://127.0.0.1:3333/api/jd-tts-annotation/shanghainese-helper/ai/recommend",
          },
        },
      },
    },
  });
  try {
    const config = (await harness.storage.getSettings()).platforms.jdTtsAnnotation.scripts.shanghaineseHelper;
    assert.equal(
      config.aiRecommendEndpoint,
      "http://127.0.0.1:3333/api/jd-tts-annotation/shanghainese-helper/ai/recommend"
    );
  } finally {
    harness.cleanup();
  }
});

test("JD TTS storage uses only whitelisted flat AI fields and keeps an empty prompt", async function () {
  const harness = loadStorageApi({
    platforms: {
      jdTtsAnnotation: {
        enabled: true,
        activeScriptId: "jdTtsShanghaineseAssistant",
        scripts: {
          shanghaineseHelper: {
            enabled: true,
            aiRecommendEnabled: true,
            aiRecommendSingleModel: "unsupported-model",
            aiRecommendSinglePrompt: "",
            aiOmni: { model: "must-not-persist" },
          },
        },
      },
    },
  });
  try {
    const config = (await harness.storage.getSettings()).platforms.jdTtsAnnotation.scripts.shanghaineseHelper;
    assert.equal(config.aiRecommendSingleModel, "qwen3.5-omni-plus");
    assert.equal(config.aiRecommendSinglePrompt, "");
    assert.equal(Object.hasOwn(config, "aiOmni"), false);
    assert.equal(Object.hasOwn(config, "audioUrl"), false);
  } finally {
    harness.cleanup();
  }
});

test("JD TTS enablement does not enable unrelated platforms", async function () {
  const harness = loadStorageApi({
    platforms: {
      aishellTech: { enabled: false },
      magicData: { enabled: false },
      dataBaker: { enabled: false },
    },
  });
  try {
    const settings = await harness.storage.setScriptEnabled("jdTtsShanghaineseAssistant", true);
    assert.equal(settings.platforms.jdTtsAnnotation.enabled, true);
    assert.equal(settings.platforms.jdTtsAnnotation.activeScriptId, "jdTtsShanghaineseAssistant");
    assert.equal(settings.platforms.jdTtsAnnotation.scripts.shanghaineseHelper.enabled, true);
    assert.equal(settings.platforms.aishellTech.enabled, false);
    assert.equal(settings.platforms.magicData.enabled, false);
    assert.equal(settings.platforms.dataBaker.enabled, false);
  } finally {
    harness.cleanup();
  }
});

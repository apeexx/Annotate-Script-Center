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
    runtime: {
      id: "test-extension",
      lastError: null,
      getManifest() {
        return { version: "0.4.3" };
      },
    },
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
    store,
    cleanup() {
      delete require.cache[constantsModulePath];
      delete require.cache[storageModulePath];
      delete globalThis.ASREdgeConstants;
      delete globalThis.ASREdgeStorage;
      delete globalThis.chrome;
    },
  };
}

test("AI usage operator save re-reads the persisted value for a fresh extension context", async function () {
  const firstContext = loadStorageApi({});
  let secondContext = null;
  try {
    const saved = await firstContext.storage.saveAiUsageOperatorName("  测试使用人  ");

    assert.deepEqual(saved, {
      operatorName: "测试使用人",
      configured: true,
      persisted: true,
      storageStatus: "ready",
      extensionId: "test-extension",
      extensionVersion: "0.4.3",
    });

    secondContext = loadStorageApi(firstContext.store[firstContext.constants.STORAGE_KEY]);
    const reread = await secondContext.storage.readAiUsageOperatorState();
    assert.deepEqual(reread, {
      operatorName: "测试使用人",
      configured: true,
      storageStatus: "ready",
      extensionId: "test-extension",
      extensionVersion: "0.4.3",
    });
  } finally {
    secondContext?.cleanup();
    firstContext.cleanup();
  }
});

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

test("JD TTS storage rebuilds its helper from the allowlist and discards sensitive or legacy fields", async function () {
  const harness = loadStorageApi({
    platforms: {
      jdTtsAnnotation: {
        enabled: true,
        activeScriptId: "jdTtsShanghaineseAssistant",
        scripts: {
          shanghaineseHelper: {
            id: "attacker-controlled-id",
            enabled: true,
            aiRecommendEnabled: true,
            aiRecommendEndpoint:
              "http://127.0.0.1:3333/api/jd-tts-annotation/shanghainese-helper/ai/recommend",
            aiRecommendSingleModel: "qwen3.5-omni-flash",
            aiRecommendSinglePrompt: "safe prompt",
            aiRecommendTemperature: "0.2",
            aiRecommendTopP: "0.8",
            Authorization: "must-not-persist",
            Cookie: "must-not-persist",
            audioBuffer: "must-not-persist",
            signedUrl: "must-not-persist",
            jobID: "must-not-persist",
            requestHeaders: { Authorization: "must-not-persist", Cookie: "must-not-persist" },
            nested: { audioBuffer: "must-not-persist", signedUrl: "must-not-persist" },
            aiRecommendListenModel: "must-not-persist",
            aiRecommendConvertPrompt: "must-not-persist",
            stages: { recognize: { model: "must-not-persist" } },
            shortcuts: { fill: "must-not-persist" },
          },
        },
      },
    },
  });
  try {
    const config = (await harness.storage.getSettings()).platforms.jdTtsAnnotation.scripts.shanghaineseHelper;
    assert.deepEqual(Object.keys(config).sort(), [
      "aiRecommendEnableThinking",
      "aiRecommendEnabled",
      "aiRecommendEndpoint",
      "aiRecommendFrequencyPenalty",
      "aiRecommendMaxCompletionTokens",
      "aiRecommendMaxTokens",
      "aiRecommendPresencePenalty",
      "aiRecommendRequestTimeoutMs",
      "aiRecommendSeed",
      "aiRecommendSingleModel",
      "aiRecommendSinglePrompt",
      "aiRecommendStopSequences",
      "aiRecommendTemperature",
      "aiRecommendTopP",
      "enabled",
      "id",
    ].sort());
    assert.equal(config.id, "jdTtsShanghaineseAssistant");
    assert.equal(config.aiRecommendSingleModel, "qwen3.5-omni-flash");
    assert.equal(config.aiRecommendSinglePrompt, "safe prompt");
    assert.equal(Object.hasOwn(config, "Authorization"), false);
    assert.equal(Object.hasOwn(config, "requestHeaders"), false);
    assert.equal(Object.hasOwn(config, "aiRecommendListenModel"), false);
    assert.equal(Object.hasOwn(config, "stages"), false);
  } finally {
    harness.cleanup();
  }
});

test("JD TTS storage rebuilds the platform root and rejects extra scripts", async function () {
  const harness = loadStorageApi({
    platforms: {
      jdTtsAnnotation: {
        enabled: true,
        activeScriptId: "jdTtsShanghaineseAssistant",
        Authorization: "must-not-persist",
        signedUrl: "must-not-persist",
        nested: { Cookie: "must-not-persist" },
        scripts: {
          shanghaineseHelper: { enabled: true, aiRecommendEnabled: true },
          evil: { audioBuffer: "must-not-persist", jobID: "must-not-persist" },
        },
      },
    },
  });
  try {
    const platform = (await harness.storage.getSettings()).platforms.jdTtsAnnotation;
    assert.deepEqual(Object.keys(platform).sort(), ["activeScriptId", "enabled", "scripts"]);
    assert.deepEqual(Object.keys(platform.scripts), ["shanghaineseHelper"]);
    assert.equal(Object.hasOwn(platform, "Authorization"), false);
    assert.equal(Object.hasOwn(platform, "signedUrl"), false);
    assert.equal(Object.hasOwn(platform, "nested"), false);
    assert.equal(platform.activeScriptId, "jdTtsShanghaineseAssistant");
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

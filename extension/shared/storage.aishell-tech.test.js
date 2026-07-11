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
  const store = {
    [constants.STORAGE_KEY]: initialSettings || {},
  };

  globalThis.ASREdgeConstants = constants;
  globalThis.chrome = {
    runtime: {
      id: "test-extension",
      lastError: null,
    },
    storage: {
      local: {
        get: function (key, callback) {
          const result = {};
          if (typeof key === "string") {
            result[key] = store[key];
          }
          callback(result);
        },
        set: function (payload, callback) {
          Object.keys(payload || {}).forEach(function (key) {
            store[key] = payload[key];
          });
          callback();
        },
      },
    },
  };

  require(storageModulePath);

  return {
    constants,
    storage: globalThis.ASREdgeStorage,
    cleanup: function () {
      delete require.cache[constantsModulePath];
      delete require.cache[storageModulePath];
      delete globalThis.ASREdgeConstants;
      delete globalThis.ASREdgeStorage;
      delete globalThis.chrome;
    },
  };
}

test("Aishell storage defaults use the three-stage phase config", async function () {
  const harness = loadStorageApi({});

  try {
    const settings = await harness.storage.getSettings();
    const dataBakerScript = settings.platforms.dataBaker.scripts.roundOneQuality;
    const script = settings.platforms.aishellTech.scripts.minnanHelper;

    assert.equal(dataBakerScript.aiQualifiedAutofillConcurrency, 5);
    assert.equal(script.aiRecommendConvertModel, "qwen3.5-plus");
    assert.equal(script.aiRecommendListenModel, "qwen3.5-omni-flash");
    assert.equal(script.aiRecommendCompareFamily, "qwen");
    assert.equal(script.aiRecommendCompareModel, "qwen3.5-plus");
    assert.equal(script.aiRecommendCompareAdoptionThreshold, 0.75);
    assert.equal(
      script.aiRecommendEndpoint,
      "https://script.xiangtianzhen.store/api/aishell-tech/minnan-helper/ai/recommend"
    );
    assert.deepEqual(settings.meta.backendBaseUrls, {
      server: "https://script.xiangtianzhen.store",
      local: "http://127.0.0.1:3333",
    });
    assert.equal(script.aiRecommendConvertPrompt, "");
    assert.equal(script.aiRecommendListenPrompt, "");
    assert.equal(script.aiRecommendCompareQwenPrompt, "");
    assert.equal(script.aiRecommendCompareOmniPrompt, "");
    assert.equal(script.aiQualifiedAutofillConcurrency, 5);
    assert.equal(
      Object.prototype.hasOwnProperty.call(script, "aiRecommendPipelineMode"),
      false
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(script, "aiRecommendRecognitionStrategy"),
      false
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(script, "aiRecommendCandidateModel"),
      false
    );
  } finally {
    harness.cleanup();
  }
});

test("Aishell storage ignores legacy AI fields and resets to new defaults", async function () {
  const harness = loadStorageApi({
    platforms: {
      aishellTech: {
        enabled: true,
        scripts: {
          minnanHelper: {
            id: "aishellTechMinnanAssistant",
            enabled: true,
            aiRecommendEnabled: true,
            aiRecommendPipelineMode: "two_stage",
            aiRecommendRecognitionStrategy: "direct_dialect",
            aiRecommendListenModel: "qwen3.5-omni-flash",
            aiRecommendCandidateModel: "qwen3.6-plus",
            aiRecommendCompareModel: "qwen3.5-flash",
            aiRecommendSingleModel: "qwen3.5-omni-flash",
            aiRecommendCandidatePrompt: "legacy-candidate-prompt",
            aiRecommendComparePrompt: "legacy-compare-prompt",
            aiRecommendAudioFirstReferenceCorrectionThreshold: 0.912,
          },
        },
      },
    },
  });

  try {
    const settings = await harness.storage.getSettings();
    const script = settings.platforms.aishellTech.scripts.minnanHelper;

    assert.equal(script.aiRecommendConvertModel, "qwen3.5-plus");
    assert.equal(script.aiRecommendListenModel, "qwen3.5-omni-flash");
    assert.equal(script.aiRecommendCompareFamily, "qwen");
    assert.equal(script.aiRecommendCompareModel, "qwen3.5-plus");
    assert.equal(script.aiRecommendCompareAdoptionThreshold, 0.75);
    assert.equal(
      script.aiRecommendEndpoint,
      "https://script.xiangtianzhen.store/api/aishell-tech/minnan-helper/ai/recommend"
    );
    assert.equal(script.aiRecommendConvertPrompt, "");
    assert.equal(script.aiRecommendCompareQwenPrompt, "");
    assert.equal(
      Object.prototype.hasOwnProperty.call(script, "aiRecommendPipelineMode"),
      false
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(script, "aiRecommendCandidateModel"),
      false
    );
  } finally {
    harness.cleanup();
  }
});

test("Aishell storage keeps new three-stage custom values untouched", async function () {
  const harness = loadStorageApi({
    platforms: {
      aishellTech: {
        enabled: true,
        scripts: {
          minnanHelper: {
            id: "aishellTechMinnanAssistant",
            enabled: true,
            aiRecommendEnabled: true,
            aiRecommendConvertModel: "qwen3.6-plus",
            aiRecommendConvertPrompt: "convert-prompt",
            aiRecommendConvertTemperature: "0.3",
            aiRecommendListenModel: "fun-asr",
            aiRecommendListenPrompt: "listen-prompt",
            aiRecommendCompareFamily: "omni",
            aiRecommendCompareModel: "qwen3.5-omni-plus",
            aiRecommendCompareOmniPrompt: "compare-omni-prompt",
            aiRecommendCompareAdoptionThreshold: 0.812,
          },
        },
      },
    },
  });

  try {
    const settings = await harness.storage.getSettings();
    const script = settings.platforms.aishellTech.scripts.minnanHelper;

    assert.equal(script.aiRecommendConvertModel, "qwen3.6-plus");
    assert.equal(script.aiRecommendConvertPrompt, "convert-prompt");
    assert.equal(script.aiRecommendConvertTemperature, "0.3");
    assert.equal(script.aiRecommendListenModel, "fun-asr");
    assert.equal(script.aiRecommendListenPrompt, "listen-prompt");
    assert.equal(script.aiRecommendCompareFamily, "omni");
    assert.equal(script.aiRecommendCompareModel, "qwen3.5-omni-plus");
    assert.equal(script.aiRecommendCompareOmniPrompt, "compare-omni-prompt");
    assert.equal(script.aiRecommendCompareAdoptionThreshold, 0.812);
  } finally {
    harness.cleanup();
  }
});

test("Aishell storage drops legacy Aishell fields even when mixed with new phase fields", async function () {
  const harness = loadStorageApi({
    platforms: {
      aishellTech: {
        enabled: true,
        scripts: {
          minnanHelper: {
            id: "aishellTechMinnanAssistant",
            enabled: true,
            aiRecommendEnabled: true,
            aiRecommendPipelineMode: "omni_single",
            aiRecommendRecognitionStrategy: "audio_first_reference",
            aiRecommendCandidateModel: "qwen3.6-plus",
            aiRecommendCompareModel: "qwen3.5-flash",
            aiRecommendAudioFirstReferenceCorrectionThreshold: 0.222,
            aiRecommendConvertModel: "qwen3.5-flash",
            aiRecommendListenModel: "fun-asr",
            aiRecommendCompareFamily: "qwen",
            aiRecommendCompareModel: "qwen3.6-plus",
            aiRecommendCompareAdoptionThreshold: 0.701,
            aiRecommendCompareQwenPrompt: "compare-qwen-prompt",
          },
        },
      },
    },
  });

  try {
    const settings = await harness.storage.getSettings();
    const script = settings.platforms.aishellTech.scripts.minnanHelper;

    assert.equal(script.aiRecommendConvertModel, "qwen3.5-flash");
    assert.equal(script.aiRecommendListenModel, "fun-asr");
    assert.equal(script.aiRecommendCompareFamily, "qwen");
    assert.equal(script.aiRecommendCompareModel, "qwen3.6-plus");
    assert.equal(script.aiRecommendCompareAdoptionThreshold, 0.701);
    assert.equal(script.aiRecommendCompareQwenPrompt, "compare-qwen-prompt");
    assert.equal(
      Object.prototype.hasOwnProperty.call(script, "aiRecommendPipelineMode"),
      false
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(script, "aiRecommendCandidateModel"),
      false
    );
  } finally {
    harness.cleanup();
  }
});

test("storage keeps customized legal autofill concurrency values untouched", async function () {
  const harness = loadStorageApi({
    platforms: {
      dataBaker: {
        enabled: true,
        scripts: {
          roundOneQuality: {
            id: "dataBakerRoundOneQuality",
            enabled: true,
            aiRecommendEnabled: true,
            aiRecommendPipelineMode: "two_stage",
            aiRecommendListenModel: "qwen3.5-omni-flash",
            aiRecommendSingleModel: "qwen3.5-omni-flash",
            aiQualifiedAutofillConcurrency: 12,
          },
        },
      },
      aishellTech: {
        enabled: true,
        scripts: {
          minnanHelper: {
            id: "aishellTechMinnanAssistant",
            enabled: true,
            aiRecommendEnabled: true,
            aiRecommendListenModel: "fun-asr",
            aiRecommendCompareFamily: "omni",
            aiRecommendListenModel: "fun-asr",
            aiQualifiedAutofillConcurrency: 9,
          },
        },
      },
    },
  });

  try {
    const settings = await harness.storage.getSettings();

    assert.equal(settings.platforms.dataBaker.scripts.roundOneQuality.aiQualifiedAutofillConcurrency, 12);
    assert.equal(settings.platforms.aishellTech.scripts.minnanHelper.aiQualifiedAutofillConcurrency, 9);
  } finally {
    harness.cleanup();
  }
});

test("Aishell storage defaults expose active script and Vietnamese helper config", async function () {
  const harness = loadStorageApi({});

  try {
    const settings = await harness.storage.getSettings();
    const platform = settings.platforms.aishellTech;
    const minnanScript = platform.scripts.minnanHelper;
    const vietnameseScript = platform.scripts.vietnameseHelper;

    assert.equal(platform.activeScriptId, "aishellTechMinnanAssistant");
    assert.equal(minnanScript.enabled, true);
    assert.equal(minnanScript.aiRecommendEnabled, true);
    assert.equal(vietnameseScript.id, "aishellTechVietnameseAssistant");
    assert.equal(vietnameseScript.enabled, false);
    assert.equal(vietnameseScript.aiRecommendEnabled, false);
    assert.equal(vietnameseScript.aiRecommendSingleModel, "qwen3.5-omni-flash");
    assert.equal(vietnameseScript.aiRecommendSinglePrompt, "");
    assert.equal(vietnameseScript.aiRecommendEndpoint, "https://script.xiangtianzhen.store/api/aishell-tech/vietnamese-helper/ai/recommend");
  } finally {
    harness.cleanup();
  }
});

test("Aishell storage defaults expose Thai helper config", async function () {
  const harness = loadStorageApi({});

  try {
    const settings = await harness.storage.getSettings();
    const thaiScript = settings.platforms.aishellTech.scripts.thaiHelper;

    assert.equal(thaiScript.id, "aishellTechThaiAssistant");
    assert.equal(thaiScript.enabled, false);
    assert.equal(thaiScript.aiRecommendEnabled, false);
    assert.equal(thaiScript.aiRecommendSingleModel, "qwen3.5-omni-flash");
    assert.equal(thaiScript.aiRecommendSinglePrompt, "");
    assert.equal(
      thaiScript.aiRecommendEndpoint,
      "https://script.xiangtianzhen.store/api/aishell-tech/thai-helper/ai/recommend"
    );
  } finally {
    harness.cleanup();
  }
});

test("Aishell storage defaults expose cn-en short drama config", async function () {
  const harness = loadStorageApi({});

  try {
    const settings = await harness.storage.getSettings();
    const script = settings.platforms.aishellTech.scripts.cnEnShortDrama;

    assert.equal(script.id, "aishellTechCnEnShortDrama");
    assert.equal(script.enabled, false);
    assert.equal(script.aiRecommendEnabled, false);
  } finally {
    harness.cleanup();
  }
});

test("Aishell storage enables Vietnamese helper as the active mutually exclusive script", async function () {
  const harness = loadStorageApi({});

  try {
    let settings = await harness.storage.setScriptEnabled("aishellTechVietnameseAssistant", true);
    assert.equal(settings.platforms.aishellTech.activeScriptId, "aishellTechVietnameseAssistant");
    assert.equal(settings.platforms.aishellTech.scripts.minnanHelper.enabled, false);
    assert.equal(settings.platforms.aishellTech.scripts.minnanHelper.aiRecommendEnabled, false);
    assert.equal(settings.platforms.aishellTech.scripts.vietnameseHelper.enabled, true);
    assert.equal(settings.platforms.aishellTech.scripts.vietnameseHelper.aiRecommendEnabled, true);

    settings = await harness.storage.setScriptEnabled("aishellTechMinnanAssistant", true);
    assert.equal(settings.platforms.aishellTech.activeScriptId, "aishellTechMinnanAssistant");
    assert.equal(settings.platforms.aishellTech.scripts.minnanHelper.enabled, true);
    assert.equal(settings.platforms.aishellTech.scripts.minnanHelper.aiRecommendEnabled, true);
    assert.equal(settings.platforms.aishellTech.scripts.vietnameseHelper.enabled, false);
    assert.equal(settings.platforms.aishellTech.scripts.vietnameseHelper.aiRecommendEnabled, false);
  } finally {
    harness.cleanup();
  }
});

test("Aishell storage enables Thai helper as the active mutually exclusive script", async function () {
  const harness = loadStorageApi({});

  try {
    const settings = await harness.storage.setScriptEnabled("aishellTechThaiAssistant", true);

    assert.equal(settings.platforms.aishellTech.activeScriptId, "aishellTechThaiAssistant");
    assert.equal(settings.platforms.aishellTech.scripts.minnanHelper.enabled, false);
    assert.equal(settings.platforms.aishellTech.scripts.minnanHelper.aiRecommendEnabled, false);
    assert.equal(settings.platforms.aishellTech.scripts.vietnameseHelper.enabled, false);
    assert.equal(settings.platforms.aishellTech.scripts.vietnameseHelper.aiRecommendEnabled, false);
    assert.equal(settings.platforms.aishellTech.scripts.thaiHelper.enabled, true);
    assert.equal(settings.platforms.aishellTech.scripts.thaiHelper.aiRecommendEnabled, true);
  } finally {
    harness.cleanup();
  }
});

test("Aishell storage enables cn-en short drama as the active mutually exclusive script", async function () {
  const harness = loadStorageApi({});

  try {
    const settings = await harness.storage.setScriptEnabled("aishellTechCnEnShortDrama", true);

    assert.equal(settings.platforms.aishellTech.activeScriptId, "aishellTechCnEnShortDrama");
    assert.equal(settings.platforms.aishellTech.scripts.minnanHelper.enabled, false);
    assert.equal(settings.platforms.aishellTech.scripts.minnanHelper.aiRecommendEnabled, false);
    assert.equal(settings.platforms.aishellTech.scripts.vietnameseHelper.enabled, false);
    assert.equal(settings.platforms.aishellTech.scripts.vietnameseHelper.aiRecommendEnabled, false);
    assert.equal(settings.platforms.aishellTech.scripts.thaiHelper.enabled, false);
    assert.equal(settings.platforms.aishellTech.scripts.thaiHelper.aiRecommendEnabled, false);
    assert.equal(settings.platforms.aishellTech.scripts.cnEnShortDrama.enabled, true);
    assert.equal(settings.platforms.aishellTech.scripts.cnEnShortDrama.aiRecommendEnabled, false);
  } finally {
    harness.cleanup();
  }
});

test("Aishell storage migrates legacy single-script config to Minnan activeScriptId", async function () {
  const harness = loadStorageApi({
    platforms: {
      aishellTech: {
        enabled: true,
        scripts: {
          minnanHelper: {
            id: "aishellTechMinnanAssistant",
            enabled: true,
            aiRecommendEnabled: true,
          },
        },
      },
    },
  });

  try {
    const settings = await harness.storage.getSettings();
    assert.equal(settings.platforms.aishellTech.activeScriptId, "aishellTechMinnanAssistant");
    assert.equal(settings.platforms.aishellTech.scripts.minnanHelper.enabled, true);
    assert.equal(settings.platforms.aishellTech.scripts.vietnameseHelper.id, "aishellTechVietnameseAssistant");
    assert.equal(settings.platforms.aishellTech.scripts.vietnameseHelper.enabled, false);
    assert.equal(settings.platforms.aishellTech.scripts.vietnameseHelper.aiRecommendEnabled, false);
  } finally {
    harness.cleanup();
  }
});

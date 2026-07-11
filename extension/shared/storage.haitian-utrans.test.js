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
    constants: constants,
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

test("Haitian uTrans storage defaults enable the audio download helper", async function () {
  const harness = loadStorageApi({});

  try {
    const settings = await harness.storage.getSettings();
    const platform = settings.platforms.haitianUtrans;
    const script = platform.scripts.audioDownloadHelper;

    assert.equal(platform.enabled, true);
    assert.equal(script.id, harness.constants.HAITIAN_UTRANS_AUDIO_DOWNLOAD_HELPER_SCRIPT_ID);
    assert.equal(script.enabled, true);
  } finally {
    harness.cleanup();
  }
});

test("Haitian uTrans setScriptEnabled keeps platform and script enabled state in sync", async function () {
  const harness = loadStorageApi({});

  try {
    let settings = await harness.storage.setScriptEnabled(
      harness.constants.HAITIAN_UTRANS_AUDIO_DOWNLOAD_HELPER_SCRIPT_ID,
      false
    );
    assert.equal(settings.platforms.haitianUtrans.enabled, false);
    assert.equal(settings.platforms.haitianUtrans.scripts.audioDownloadHelper.enabled, false);

    settings = await harness.storage.setScriptEnabled(
      harness.constants.HAITIAN_UTRANS_AUDIO_DOWNLOAD_HELPER_SCRIPT_ID,
      true
    );
    assert.equal(settings.platforms.haitianUtrans.enabled, true);
    assert.equal(settings.platforms.haitianUtrans.scripts.audioDownloadHelper.enabled, true);
  } finally {
    harness.cleanup();
  }
});

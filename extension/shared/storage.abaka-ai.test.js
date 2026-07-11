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

test("Abaka storage defaults leave all shortcuts empty", async function () {
  const harness = loadStorageApi({});

  try {
    const settings = await harness.storage.getSettings();
    const shortcuts = settings.platforms.abakaAi.scripts.taskPageCapture.shortcuts;

    assert.deepEqual(shortcuts, {
      sameFontTrue: null,
      sameFontFalse: null,
      sameFontArtisticEffect: null,
      imageBTextsRemovedSpecify: null,
      otherChangesSpecify: null,
      stashSave: null,
      submitReview: null,
      aiAnalyzeSameFont: null,
      aiAnalyzeImageBTextsRemoved: null,
      aiAnalyzeOtherChanges: null,
      aiAnalyzeOverall: null,
    });
  } finally {
    harness.cleanup();
  }
});

test("Abaka storage preserves explicit shortcut overrides and keeps other actions empty", async function () {
  const harness = loadStorageApi({
    platforms: {
      abakaAi: {
        scripts: {
          taskPageCapture: {
            shortcuts: {
              sameFontTrue: {
                key: "1",
              },
            },
          },
        },
      },
    },
  });

  try {
    const settings = await harness.storage.getSettings();
    const shortcuts = settings.platforms.abakaAi.scripts.taskPageCapture.shortcuts;

    assert.deepEqual(shortcuts.sameFontTrue, {
      ctrl: false,
      alt: false,
      shift: false,
      meta: false,
      key: "1",
      button: null,
    });
    assert.equal(shortcuts.sameFontFalse, null);
    assert.equal(shortcuts.aiAnalyzeOverall, null);
  } finally {
    harness.cleanup();
  }
});

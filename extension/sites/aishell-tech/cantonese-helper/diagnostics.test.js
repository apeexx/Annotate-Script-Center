"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const diagnosticsModulePath = path.resolve(__dirname, "diagnostics.js");

function loadDiagnosticsApi() {
  delete require.cache[diagnosticsModulePath];
  delete globalThis.__ASREdgeAishellTechCantoneseDiagnosticsInstalled;
  delete globalThis.__ASREdgeAishellTechCantoneseDiagnostics;
  const api = require(diagnosticsModulePath);
  return {
    api,
    cleanup: function () {
      delete require.cache[diagnosticsModulePath];
      delete globalThis.__ASREdgeAishellTechCantoneseDiagnosticsInstalled;
      delete globalThis.__ASREdgeAishellTechCantoneseDiagnostics;
    },
  };
}

test("Cantonese diagnostics identify the three-stage pipeline and all selected models", function () {
  const harness = loadDiagnosticsApi();

  try {
    const rows = harness.api.buildCurrentResultDiagnostics({
      meta: {
        models: {
          convertModel: "qwen3.5-plus",
          listenModel: "qwen3.5-omni-flash",
          compareModelFamily: "qwen",
          compareModel: "qwen3.5-plus",
        },
      },
    }).rows;
    const rowMap = new Map(rows);

    assert.equal(rowMap.get("执行链路"), "转换候选 + 听音转写 + 比较决策（Qwen）");
    assert.equal(
      rowMap.get("模型选择"),
      "转换 qwen3.5-plus / 听音 qwen3.5-omni-flash / 比较 Qwen qwen3.5-plus"
    );
  } finally {
    harness.cleanup();
  }
});

"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const modulePath = path.resolve(__dirname, "ai-recommendation.js");

function loadModule() {
  delete require.cache[modulePath];
  delete globalThis.__ASREdgeAishellTechCantoneseAiRecommendationInstalled;
  delete globalThis.__ASREdgeAishellTechCantoneseAiRecommendation;
  const api = require(modulePath);
  return {
    api,
    cleanup: function () {
      delete require.cache[modulePath];
      delete globalThis.__ASREdgeAishellTechCantoneseAiRecommendationInstalled;
      delete globalThis.__ASREdgeAishellTechCantoneseAiRecommendation;
    },
  };
}

test("Cantonese AI client passes a batch cancellation signal to the task lifecycle", async function () {
  const harness = loadModule();
  const controller = new AbortController();
  let receivedSignal = null;

  try {
    const runtime = harness.api.createRuntime({
      endpoint: "http://127.0.0.1:3333/api/aishell-tech/cantonese-helper/ai/recommend",
      settings: { meta: { aiUsageOperatorName: "本地验收" } },
      aiStages: {
        convert: { model: "qwen3.5-plus", prompt: "转换", params: {} },
        listen: { model: "qwen3.5-omni-flash", prompt: "听音", params: {} },
        compare: { family: "qwen", model: "qwen3.5-plus", prompt: "比较", params: {} },
      },
      jobClient: {
        runJobLifecycle: async function (options) {
          receivedSignal = options.signal;
          return {
            data: {
              recommendedText: "我而家去食飯呀。",
              recommendedSpeed: "normal",
              meta: { requestId: "test-request" },
            },
          };
        },
      },
    });

    await runtime.recommend(
      {
        taskId: "task-1",
        packageId: "package-1",
        taskItemId: "item-1",
        audioUrl: "https://example.invalid/audio.wav",
        referenceText: "我而家去食飯。",
      },
      { signal: controller.signal }
    );

    assert.equal(receivedSignal, controller.signal);
  } finally {
    harness.cleanup();
  }
});

"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { createCantoneseRecommendPipeline } = require("./pipeline");

test("Cantonese pipeline runs convert and listen before Qwen comparison and keeps listen speed", async function () {
  const calls = [];
  const pipeline = createCantoneseRecommendPipeline({
    enqueueTask: async function (_group, task) { return task(); },
    requestCompare: async function (_input, prompt, heardText, options) {
      calls.push({ stage: options.stage, prompt: prompt.userPrompt, heardText, model: options.model });
      if (options.stage === "convert") return { rawText: '{"convertedText":"我哋而家去食飯。"}', usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 } };
      return { rawText: '{"recommendedText":"我哋而家去食飯。","decision":"use_heard_text","confidence":0.93,"needHumanReview":false,"changePoints":[]}', usage: { prompt_tokens: 4, completion_tokens: 2, total_tokens: 6 } };
    },
    requestOmniInputAudio: async function (_input, prompt, options) {
      calls.push({ stage: options.stage, prompt: prompt.userPrompt, model: options.model });
      return { rawText: '{"heardText":"我哋而家去食飯。","recommendedSpeed":"fast"}', usage: { prompt_tokens: 7, completion_tokens: 2, total_tokens: 9 } };
    },
  });

  const result = await pipeline.run({
    requestId: "pipeline-qwen",
    taskItemId: "item-1",
    audioUrl: "https://example.invalid/audio.wav",
    referenceText: "我们现在去吃饭。",
    aiStages: {
      convert: { model: "qwen3.5-plus", prompt: "convert", params: {} },
      listen: { model: "qwen3.5-omni-flash", prompt: "listen", params: {} },
      compare: { family: "qwen", model: "qwen3.5-plus", prompt: "compare", params: {}, adoptionThreshold: 0.8 },
    },
  });

  assert.equal(result.data.convertedText, "我哋而家去食飯。");
  assert.equal(result.data.heardText, "我哋而家去食飯。");
  assert.equal(result.data.recommendedText, "我哋而家去食飯。");
  assert.equal(result.data.recommendedSpeed, "fast");
  assert.equal(result.meta.models.compareModelFamily, "qwen");
  assert.equal(result.meta.usage.totalTokens, 18);
  assert.equal(Number.isFinite(result.meta.timing.convertDurationMs), true);
  assert.equal(Number.isFinite(result.meta.timing.listenDurationMs), true);
  assert.equal(Number.isFinite(result.meta.timing.compareDurationMs), true);
  assert.deepEqual(calls.map(function (call) { return call.stage; }).sort(), ["compare", "convert", "listen"]);
});

test("Cantonese pipeline requires Omni comparison for Fun-ASR so the final speed comes from audio", async function () {
  const pipeline = createCantoneseRecommendPipeline({
    enqueueTask: async function (_group, task) { return task(); },
    requestCompare: async function (_input, _prompt, _heardText, options) {
      if (options.stage === "convert") {
        return { rawText: '{"convertedText":"我哋而家去食飯。"}', usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 } };
      }
      throw new Error("Qwen comparison must not run");
    },
    requestFunAsrRecognition: async function () { return { text: "我哋而家去食飯。", usage: { input_tokens: 5, output_tokens: 0, total_tokens: 5 } }; },
    requestOmniInputAudio: async function (_input, _prompt, options) {
      assert.equal(options.stage, "compare");
      return { rawText: '{"recommendedText":"我哋而家去食飯。","recommendedSpeed":"slow","decision":"use_heard_text","confidence":0.8,"needHumanReview":false,"changePoints":[]}', usage: { prompt_tokens: 7, completion_tokens: 2, total_tokens: 9 } };
    },
  });

  const result = await pipeline.run({
    requestId: "pipeline-fun-asr",
    taskItemId: "item-2",
    audioUrl: "https://example.invalid/audio.wav",
    referenceText: "原始參考文字",
    aiStages: {
      convert: { model: "qwen3.5-plus", prompt: "convert", params: {} },
      listen: { model: "fun-asr", prompt: "listen", params: {} },
      compare: { family: "omni", model: "qwen3.5-omni-flash", prompt: "compare", params: {}, adoptionThreshold: 0.8 },
    },
  });

  assert.equal(result.data.recommendedSpeed, "slow");
  assert.equal(result.meta.models.compareModelFamily, "omni");
  assert.equal(result.meta.models.listenModel, "fun-asr");
});

test("Cantonese pipeline falls back to heard text when comparison confidence misses the adoption threshold", async function () {
  const pipeline = createCantoneseRecommendPipeline({
    enqueueTask: async function (_group, task) { return task(); },
    requestCompare: async function (_input, _prompt, _heardText, options) {
      if (options.stage === "convert") {
        return { rawText: '{"convertedText":"候選文字"}', usage: {} };
      }
      return {
        rawText: '{"recommendedText":"低置信度比較文字","decision":"merge","confidence":0.6,"needHumanReview":false,"changePoints":[]}',
        usage: {},
      };
    },
    requestOmniInputAudio: async function () {
      return { rawText: '{"heardText":"真實聽音文字","recommendedSpeed":"normal"}', usage: {} };
    },
  });

  const result = await pipeline.run({
    requestId: "pipeline-threshold",
    taskItemId: "item-3",
    audioUrl: "https://example.invalid/audio.wav",
    referenceText: "參考文字",
    aiStages: {
      convert: { model: "qwen3.5-plus", prompt: "convert", params: {} },
      listen: { model: "qwen3.5-omni-flash", prompt: "listen", params: {} },
      compare: { family: "qwen", model: "qwen3.5-plus", prompt: "compare", params: {}, adoptionThreshold: 0.8 },
    },
  });

  assert.equal(result.data.recommendedText, "真實聽音文字");
  assert.equal(result.data.recommendedSpeed, "normal");
  assert.equal(result.data.decision, "use_heard_text");
  assert.equal(result.data.needHumanReview, true);
  assert.equal(result.meta.adoption.accepted, false);
  assert.equal(result.meta.adoption.threshold, 0.8);
});

test("Cantonese pipeline retains the listening stage diagnostics when the provider returns empty text", async function () {
  const pipeline = createCantoneseRecommendPipeline({
    enqueueTask: async function (_group, task) { return task(); },
    requestCompare: async function (_input, _prompt, _heardText, options) {
      if (options.stage === "convert") {
        return { rawText: '{"convertedText":"候选文字"}', usage: {} };
      }
      throw new Error("comparison must not run after listening fails");
    },
    requestOmniInputAudio: async function () {
      return { model: "qwen3.5-omni-flash", rawText: "", finishReason: "stop", usage: {} };
    },
  });

  await assert.rejects(
    pipeline.run({
      requestId: "pipeline-empty-listen",
      taskItemId: "item-4",
      audioUrl: "https://example.invalid/audio.wav",
      referenceText: "参考文字",
      aiStages: {
        convert: { model: "qwen3.5-plus", prompt: "convert", params: {} },
        listen: { model: "qwen3.5-omni-flash", prompt: "listen", params: {} },
        compare: { family: "qwen", model: "qwen3.5-plus", prompt: "compare", params: {}, adoptionThreshold: 0.8 },
      },
    }),
    function (error) {
      assert.equal(error.code, "empty-provider-response");
      assert.equal(error.stage, "listen");
      assert.equal(error.debugRawAiResponse.stage, "listen");
      assert.equal(error.debugRawAiResponse.model, "qwen3.5-omni-flash");
      assert.equal(error.debugRawAiResponse.rawTextLength, 0);
      assert.equal(error.debugRawAiResponse.finishReason, "stop");
      return true;
    }
  );
});

"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const pipelineApi = require(path.resolve(__dirname, "pipeline.js"));

test("JD TTS Shanghai pipeline sends only the WAV Data URL to its dedicated queue", async function () {
  const received = {};
  const pipeline = pipelineApi.createRecommendPipeline({
    enqueueTask: async function (groupName, task) {
      received.groupName = groupName;
      return {
        value: await task(),
        queueMeta: { groupName, queueWaitMs: 12, retryCount: 0 },
      };
    },
    requestOmniInputAudio: async function (input, prompt, options) {
      received.input = input;
      received.prompt = prompt;
      received.options = options;
      return {
        rawText: "侬好 ！",
        model: "qwen3.5-omni-plus",
        usage: { prompt_tokens: 8, completion_tokens: 3, total_tokens: 11 },
      };
    },
  });

  const result = await pipeline.run({
    utteranceId: "4881635",
    checksum: "a".repeat(32),
    audioDataUrl: "data:audio/x-wav;base64,UklGRg==",
    aiOmni: {
      model: "qwen3.5-omni-plus",
      prompt: "只输出上海话原始文本。",
      params: { temperature: 0.2 },
    },
  }, { requestId: "request-1", timeoutMs: 60000 });

  assert.equal(received.groupName, "jd_tts_qwen_omni");
  assert.deepEqual(received.input, {
    audioUrl: "data:audio/x-wav;base64,UklGRg==",
    aiOptions: { temperature: 0.2 },
  });
  assert.equal(received.prompt.systemPrompt, "只输出上海话原始文本。");
  assert.equal(received.options.enableThinking, false);
  assert.deepEqual(result.data, {
    utteranceId: "4881635",
    checksum: "a".repeat(32),
    listenText: "侬好 ！",
    needHumanReview: false,
  });
});

test("JD TTS Shanghai treats an empty provider transcription as a human-review result", async function () {
  const pipeline = pipelineApi.createRecommendPipeline({
    enqueueTask: async function (groupName, task) {
      return {
        value: await task(),
        queueMeta: { groupName, queueWaitMs: 0, retryCount: 0 },
      };
    },
    requestOmniInputAudio: async function () {
      const error = new Error("empty transcription");
      error.code = "qwen-empty-response";
      error.statusCode = 502;
      error.debugRawAiResponse = { usage: { prompt_tokens: 4, completion_tokens: 0, total_tokens: 4 } };
      throw error;
    },
  });

  const result = await pipeline.run({
    utteranceId: "4881635",
    checksum: "a".repeat(32),
    audioDataUrl: "data:audio/x-wav;base64,UklGRg==",
    aiOmni: { model: "qwen3.5-omni-plus", prompt: "只输出文本", params: {} },
  }, { requestId: "request-empty", timeoutMs: 60000 });

  assert.deepEqual(result.data, {
    utteranceId: "4881635",
    checksum: "a".repeat(32),
    listenText: "",
    needHumanReview: true,
  });
  assert.equal(result.meta.usage.promptTokens, 4);
});

"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const modulePath = path.resolve(__dirname, "pipeline.js");
const CROPPED_WAV_DATA_URL = "data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQIAAAAAAA==";

function loadModule() {
  delete require.cache[modulePath];
  return require(modulePath);
}

function createRequest(overrides) {
  return Object.assign(
    {
      taskItemId: "item-safe-fixture",
      fileName: "fixture.wav",
      audioDataUrl: CROPPED_WAV_DATA_URL,
      regionId: "region-safe-fixture",
      segmentNumber: 7,
      startMs: 1200,
      endMs: 2600,
      durationMs: 1400,
      selectionKey: "region-safe-fixture:1200-2600",
      aiOmni: {
        model: "qwen3.5-omni-plus",
        prompt: "Keep original English.",
        params: { temperature: 0.1 },
        enableThinking: false,
      },
    },
    overrides || {}
  );
}

test("English pipeline sends only the cropped WAV to Omni and returns original English", async function () {
  const api = loadModule();
  const received = {};
  const pipeline = api.createRecommendPipeline({
    enqueueTask: async function (groupName, task) {
      received.groupName = groupName;
      return {
        value: await task(),
        queueMeta: { groupName, queueWaitMs: 0, retryCount: 0 },
      };
    },
    requestOmniInputAudio: async function (input, prompt, options) {
      received.input = input;
      received.prompt = prompt;
      received.options = options;
      return {
        rawText: "Keep original English.",
        model: "qwen3.5-omni-plus",
        usage: { prompt_tokens: 8, completion_tokens: 4, total_tokens: 12 },
      };
    },
  });

  const request = createRequest({
    audioUrl: "https://example.invalid/full-source.wav?signature=not-for-provider",
    taskId: "task-private-fixture",
    packageId: "package-private-fixture",
    taskItemId: "item-private-fixture",
    fileName: "file-private-fixture.wav",
    itemNumber: 91,
    regionId: "region-private-fixture",
    referenceText: "PAGE_REFERENCE_PRIVATE_FIXTURE",
    existingMarkText: "PAGE_EXISTING_PRIVATE_FIXTURE",
  });
  const result = await pipeline.run(request, { requestId: "request-safe-fixture", timeoutMs: 60000 });

  assert.equal(received.groupName, "aishell_english_transcription_qwen_omni");
  assert.equal(received.input.audioUrl, CROPPED_WAV_DATA_URL);
  assert.doesNotMatch(JSON.stringify(received.input), /example\.invalid/);
  assert.doesNotMatch(received.prompt.userPrompt, /example\.invalid/);
  const promptJson = JSON.stringify(received.prompt);
  assert.doesNotMatch(promptJson, /task-private-fixture|package-private-fixture|item-private-fixture|file-private-fixture\.wav|region-private-fixture|PAGE_REFERENCE_PRIVATE_FIXTURE|PAGE_EXISTING_PRIVATE_FIXTURE/);
  assert.doesNotMatch(received.prompt.userPrompt, /\b(?:fileName|taskId|packageId|taskItemId|itemNumber|regionId|segmentNumber|startMs|endMs|durationMs|selectionKey|referenceText|existingMarkText)\b/);
  assert.equal(received.options.enableThinking, false);
  assert.equal(received.options.timeoutMs, 60000);
  assert.equal(result.data.listenText, "Keep original English.");
  assert.equal(result.data.needHumanReview, false);
});

test("English pipeline canonicalizes any human-review marker as exactly #N#", async function () {
  const api = loadModule();
  assert.equal(api.normalizeHumanReviewText("overlap #N# fragment"), "#N#");

  const pipeline = api.createRecommendPipeline({
    enqueueTask: async function (groupName, task) {
      return {
        value: await task(),
        queueMeta: { groupName, queueWaitMs: 0, retryCount: 0 },
      };
    },
    requestOmniInputAudio: async function () {
      return { rawText: "unclear #N# fragment", model: "qwen3.5-omni-plus", usage: {} };
    },
  });

  const result = await pipeline.run(createRequest());
  assert.equal(result.data.listenText, "#N#");
  assert.equal(result.data.needHumanReview, true);
});

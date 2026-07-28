"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const modulePath = path.resolve(__dirname, "pipeline.js");

test("Aishell Cantonese raw-listen pipeline is available", function () {
  assert.equal(fs.existsSync(modulePath), true);
});

function loadModule() {
  delete require.cache[modulePath];
  return require(modulePath);
}

test("Aishell Cantonese pipeline sends only the cropped WAV and preserves raw listenText", async function () {
  const api = loadModule();
  const received = {};
  const pipeline = api.createRecommendPipeline({
    enqueueTask: async function (groupName, task) {
      received.queueGroup = groupName;
      return {
        value: await task(),
        queueMeta: { groupName: "aishell_cantonese_qwen_omni", queueWaitMs: 0, retryCount: 0 },
      };
    },
    requestOmniInputAudio: async function (input, prompt, options) {
      received.input = input;
      received.prompt = prompt;
      received.options = options;
      return {
        rawText: "冇問題 ！",
        model: "qwen3.5-omni-flash",
        usage: { prompt_tokens: 12, completion_tokens: 4, total_tokens: 16 },
      };
    },
  });

  const result = await pipeline.run(
    {
      taskItemId: "item-1",
      audioUrl: "https://oss.example.com/audio.wav",
      audioDataUrl: "data:audio/wav;base64,UklGRg==",
      regionId: "region-1",
      segmentNumber: 1,
      startMs: 1830,
      endMs: 2990,
      durationMs: 1160,
      referenceText: "平台参考文本",
      fileName: "001.wav",
      duration: 1200,
      aiOmni: {
        model: "qwen3.5-omni-flash",
        prompt: "只輸出原始繁體粵語。",
        params: { temperature: 0.2 },
        enableThinking: false,
      },
    },
    { requestId: "req-1", timeoutMs: 60000 }
  );

  assert.equal(received.input.audioUrl, "data:audio/wav;base64,UklGRg==");
  assert.equal(received.queueGroup, "aishell_cantonese_qwen_omni");
  assert.match(received.prompt.systemPrompt, /只輸出原始繁體粵語。/);
  assert.match(received.prompt.systemPrompt, /#N#/);
  assert.doesNotMatch(received.prompt.userPrompt, /平台参考文本/);
  assert.equal(received.options.enableThinking, false);
  assert.equal(received.options.allowEmptyText, true);
  assert.equal(result.data.listenText, "冇問題 ！");
  assert.equal(result.data.referenceText, "平台参考文本");
  assert.equal(result.meta.models.omniModel, "qwen3.5-omni-flash");
});

test("Aishell Cantonese pipeline keeps a normally completed blank listenText for human review", async function () {
  const api = loadModule();
  const pipeline = api.createRecommendPipeline({
    enqueueTask: async function (_groupName, task) {
      return {
        value: await task(),
        queueMeta: { groupName: "aishell_cantonese_qwen_omni", queueWaitMs: 0, retryCount: 0 },
      };
    },
    requestOmniInputAudio: async function () {
      return { rawText: "", model: "qwen3.5-omni-plus", usage: {} };
    },
  });

  const result = await pipeline.run({
    taskItemId: "item-empty",
    audioDataUrl: "data:audio/wav;base64,UklGRg==",
    regionId: "region-empty",
    segmentNumber: 2,
    startMs: 0,
    endMs: 500,
    durationMs: 500,
    selectionKey: "region-empty:0-500",
    aiOmni: { model: "qwen3.5-omni-plus" },
  });

  assert.equal(result.data.listenText, "");
  assert.equal(result.data.needHumanReview, true);
});

test("Aishell Cantonese pipeline marks #N# as human review instead of a fillable transcript", async function () {
  const api = loadModule();
  const pipeline = api.createRecommendPipeline({
    enqueueTask: async function (_groupName, task) {
      return {
        value: await task(),
        queueMeta: { groupName: "aishell_cantonese_qwen_omni", queueWaitMs: 0, retryCount: 0 },
      };
    },
    requestOmniInputAudio: async function () {
      return { rawText: "#N#", model: "qwen3.5-omni-plus", usage: {} };
    },
  });

  const result = await pipeline.run({
    taskItemId: "item-review-marker",
    audioDataUrl: "data:audio/wav;base64,UklGRg==",
    regionId: "region-review-marker",
    segmentNumber: 4,
    startMs: 0,
    endMs: 500,
    durationMs: 500,
    selectionKey: "region-review-marker:0-500",
    aiOmni: { model: "qwen3.5-omni-plus" },
  });

  assert.equal(result.data.listenText, "#N#");
  assert.equal(result.data.needHumanReview, true);
});

test("Aishell Cantonese pipeline canonicalizes every #N#-containing response as human review", async function () {
  const api = loadModule();
  const samples = [" #N# ", "#N# explanation", "before #N#\nafter"];

  for (const rawText of samples) {
    const pipeline = api.createRecommendPipeline({
      enqueueTask: async function (_groupName, task) {
        return {
          value: await task(),
          queueMeta: { groupName: "aishell_cantonese_qwen_omni", queueWaitMs: 0, retryCount: 0 },
        };
      },
      requestOmniInputAudio: async function () {
        return { rawText, model: "qwen3.5-omni-plus", usage: {} };
      },
    });

    const result = await pipeline.run({
      taskItemId: "item-marker-normalization",
      audioDataUrl: "data:audio/wav;base64,UklGRg==",
      regionId: "region-marker-normalization",
      segmentNumber: 5,
      startMs: 0,
      endMs: 500,
      durationMs: 500,
      selectionKey: "region-marker-normalization:0-500",
      aiOmni: { model: "qwen3.5-omni-plus" },
    });

    assert.equal(result.data.listenText, "#N#");
    assert.equal(result.data.needHumanReview, true);
  }
});

test("Aishell Cantonese pipeline preserves exhausted rate-limit retry diagnostics", async function () {
  const api = loadModule();
  const upstreamError = Object.assign(new Error("上游模型限流，后端已重试仍失败。"), {
    code: "provider-rate-limited",
    providerCode: "limit_burst_rate",
    providerStatus: 429,
    summary: "limit_burst_rate",
    queueMeta: {
      groupName: "aishell_cantonese_qwen_omni",
      queueWaitMs: 2400,
      retryCount: 3,
    },
  });
  const pipeline = api.createRecommendPipeline({
    enqueueTask: async function () {
      throw upstreamError;
    },
  });

  await assert.rejects(
    pipeline.run(
      {
        taskItemId: "item-1",
        audioDataUrl: "data:audio/wav;base64,UklGRg==",
        regionId: "region-1",
        segmentNumber: 1,
        startMs: 1830,
        endMs: 2990,
        durationMs: 1160,
        selectionKey: "region-1:1830-2990",
        aiOmni: { model: "qwen3.5-omni-plus" },
      },
      { requestId: "req-rate-limit", timeoutMs: 60000 }
    ),
    function (error) {
      return (
        error?.providerStatus === 429 &&
        error?.providerCode === "limit_burst_rate" &&
        error?.meta?.retryCount === 3 &&
        error?.meta?.queue?.totalQueueWaitMs === 2400
      );
    }
  );
});

test("Aishell Cantonese pipeline exposes a sanitized empty-stream summary without audio data", async function () {
  const api = loadModule();
  const upstreamError = Object.assign(new Error("DashScope Omni 接口未返回有效文本。"), {
    code: "qwen-empty-response",
    statusCode: 502,
    debugRawAiResponse: {
      provider: "aishell-dashscope-omni",
      streamCompleted: false,
      parsedChunksCount: 0,
      audioDataUrl: "data:audio/wav;base64,UklGRg==",
    },
  });
  const pipeline = api.createRecommendPipeline({
    enqueueTask: async function () {
      throw upstreamError;
    },
  });

  await assert.rejects(
    pipeline.run(
      {
        taskItemId: "item-empty-stream",
        audioDataUrl: "data:audio/wav;base64,UklGRg==",
        regionId: "region-empty-stream",
        segmentNumber: 3,
        startMs: 0,
        endMs: 500,
        durationMs: 500,
        selectionKey: "region-empty-stream:0-500",
        aiOmni: { model: "qwen3.5-omni-plus" },
      },
      { requestId: "req-empty-stream", timeoutMs: 60000 }
    ),
    function (error) {
      const providerDebug = error?.meta?.providerDebug;
      return (
        providerDebug?.streamCompleted === false &&
        providerDebug?.parsedChunksCount === 0 &&
        !/data:audio\/wav/i.test(JSON.stringify(providerDebug))
      );
    }
  );
});

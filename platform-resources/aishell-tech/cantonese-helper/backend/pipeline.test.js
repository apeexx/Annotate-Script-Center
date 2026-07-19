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

test("Aishell Cantonese pipeline sends the direct OSS URL and preserves raw listenText", async function () {
  const api = loadModule();
  const received = {};
  const pipeline = api.createRecommendPipeline({
    enqueueTask: async function (_groupName, task) {
      return {
        value: await task(),
        queueMeta: { groupName: "aishell_qwen_omni", queueWaitMs: 0, retryCount: 0 },
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

  assert.equal(received.input.audioUrl, "https://oss.example.com/audio.wav");
  assert.equal(received.prompt.systemPrompt, "只輸出原始繁體粵語。");
  assert.doesNotMatch(received.prompt.userPrompt, /平台参考文本/);
  assert.equal(received.options.enableThinking, false);
  assert.equal(result.data.listenText, "冇問題 ！");
  assert.equal(result.data.referenceText, "平台参考文本");
  assert.equal(result.meta.models.omniModel, "qwen3.5-omni-flash");
});

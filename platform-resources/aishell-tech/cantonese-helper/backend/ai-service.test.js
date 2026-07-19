"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DEFAULT_OMNI_MODEL,
  DEFAULT_SINGLE_PROMPT,
  createCantoneseRecommendService,
  normalizeRecommendRequest,
} = require("./ai-service");
const { buildDashScopeOmniRequestBody } = require("./dashscope-omni-client");
const { getCantoneseProviderConfig } = require("./config");

test("Cantonese request is fixed to Omni Flash with a Traditional Cantonese transcript prompt", function () {
  const normalized = normalizeRecommendRequest({
    taskItemId: "item-1",
    audioUrl: "https://example.invalid/audio.wav",
    singleModel: "qwen3.5-omni-plus",
  });

  assert.equal(DEFAULT_OMNI_MODEL, "qwen3.5-omni-flash");
  assert.equal(normalized.singleModel, "qwen3.5-omni-flash");
  assert.match(DEFAULT_SINGLE_PROMPT, /粵語/);
  assert.match(DEFAULT_SINGLE_PROMPT, /繁體/);
  assert.match(DEFAULT_SINGLE_PROMPT, /不翻譯成普通話/);
  assert.match(DEFAULT_SINGLE_PROMPT, /slow\|normal\|fast/);
});

test("Cantonese recommendation returns normalized text, speed, usage, and cost from one Omni call", async function () {
  const service = createCantoneseRecommendService({
    requestOmniInputAudio: async function (input, prompt, options) {
      assert.equal(input.audioUrl, "https://example.invalid/audio.wav");
      assert.equal(options.model, "qwen3.5-omni-flash");
      assert.equal(options.timeoutMs, 60000);
      assert.match(prompt.userPrompt, /粵語/);
      return {
        rawText: '{"text":"佢哋話：hello, world!","speed":"快"}',
        usage: {
          prompt_tokens: 21,
          completion_tokens: 7,
          total_tokens: 28,
          prompt_tokens_details: {
            text_tokens: 5,
            audio_tokens: 16,
          },
        },
      };
    },
  });

  const result = await service.run({
    requestId: "cantonese-success",
    taskItemId: "item-1",
    audioUrl: "https://example.invalid/audio.wav",
    referenceText: "參考文字",
  });

  assert.equal(result.recommendedText, "佢哋話：hello，world！");
  assert.equal(result.recommendedSpeed, "fast");
  assert.equal(result.referenceText, "參考文字");
  assert.deepEqual(result.meta.usage, {
    promptTokens: 21,
    completionTokens: 7,
    totalTokens: 28,
  });
  assert.equal(result.meta.models.recognizeModel, "qwen3.5-omni-flash");
  assert.equal(result.meta.cost.currency, "CNY");
});

test("Cantonese recommendation normalizes upstream rate limits into the shared retryable error contract", async function () {
  const service = createCantoneseRecommendService({
    requestOmniInputAudio: async function () {
      const error = new Error("too many requests");
      error.statusCode = 429;
      error.code = "provider-http-error";
      throw error;
    },
  });

  await assert.rejects(
    service.run({
      requestId: "cantonese-rate-limit",
      taskItemId: "item-2",
      audioUrl: "https://example.invalid/audio.wav",
    }),
    function (error) {
      assert.equal(error.code, "provider-rate-limited");
      assert.equal(error.statusCode, 429);
      assert.equal(error.retryable, true);
      assert.equal(error.stage, "recognize");
      return true;
    }
  );
});

test("Cantonese DashScope request always disables thinking", function () {
  const body = buildDashScopeOmniRequestBody({
    model: "qwen3.5-omni-flash",
    audioUrl: "https://example.invalid/audio.mp3",
    userPrompt: "請只回傳 JSON。",
  });

  assert.equal(body.model, "qwen3.5-omni-flash");
  assert.equal(body.enable_thinking, false);
  assert.equal(body.stream, true);
  assert.deepEqual(body.response_format, { type: "json_object" });
  assert.equal(body.messages[1].content[0].input_audio.format, "mp3");
});

test("Cantonese environment variables take priority over shared Aishell compatibility variables", function () {
  const original = {
    cantoneseKey: process.env.AISHELL_CANTONESE_AI_API_KEY,
    aishellKey: process.env.AISHELL_AI_API_KEY,
    dashscopeKey: process.env.DASHSCOPE_API_KEY,
    cantoneseBaseUrl: process.env.AISHELL_CANTONESE_AI_BASE_URL,
    aishellBaseUrl: process.env.AISHELL_AI_BASE_URL,
  };
  process.env.AISHELL_CANTONESE_AI_API_KEY = "cantonese-key";
  process.env.AISHELL_AI_API_KEY = "shared-key";
  process.env.DASHSCOPE_API_KEY = "dashscope-key";
  process.env.AISHELL_CANTONESE_AI_BASE_URL = "https://cantonese.example/v1/";
  process.env.AISHELL_AI_BASE_URL = "https://shared.example/v1";

  try {
    const config = getCantoneseProviderConfig();
    assert.equal(config.apiKey, "cantonese-key");
    assert.equal(config.baseUrl, "https://cantonese.example/v1");
    assert.equal(config.timeoutMs, 60000);
  } finally {
    Object.entries(original).forEach(function ([key, value]) {
      const envKey = {
        cantoneseKey: "AISHELL_CANTONESE_AI_API_KEY",
        aishellKey: "AISHELL_AI_API_KEY",
        dashscopeKey: "DASHSCOPE_API_KEY",
        cantoneseBaseUrl: "AISHELL_CANTONESE_AI_BASE_URL",
        aishellBaseUrl: "AISHELL_AI_BASE_URL",
      }[key];
      if (value === undefined) {
        delete process.env[envKey];
      } else {
        process.env[envKey] = value;
      }
    });
  }
});

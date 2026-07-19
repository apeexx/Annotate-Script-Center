"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DEFAULT_COMPARE_ADOPTION_THRESHOLD,
  buildRecommendErrorBody,
  buildRecommendSuccessBody,
  createCantoneseRecommendService,
  createDefaultsPayload,
  createHealthPayload,
  normalizeRecommendRequest,
} = require("./ai-service");
const { buildDashScopeOmniRequestBody } = require("./dashscope-omni-client");
const { getCantoneseProviderConfig } = require("./config");

test("Cantonese defaults expose editable convert, listen, and compare stages", function () {
  const defaults = createDefaultsPayload().defaults;
  assert.equal(defaults.modelMode, "three_stage_parallel");
  assert.equal(defaults.stages.convert.model, "qwen3.5-plus");
  assert.equal(defaults.stages.listen.model, "qwen3.5-omni-flash");
  assert.equal(defaults.stages.compare.family, "qwen");
  assert.equal(defaults.stages.compare.qwenModel, "qwen3.5-plus");
  assert.equal(DEFAULT_COMPARE_ADOPTION_THRESHOLD, 0.75);
  assert.equal(defaults.stages.compare.adoptionThreshold, DEFAULT_COMPARE_ADOPTION_THRESHOLD);
  assert.match(defaults.stages.convert.prompt, /繁體粵語/);
  assert.match(defaults.stages.listen.prompt, /slow、normal 或 fast/);
  assert.match(defaults.stages.compare.omniPrompt, /語速/);
  assert.equal(defaults.singleModel, "qwen3.5-omni-flash");
  assert.equal(defaults.singlePrompt, defaults.stages.listen.prompt);
  assert.deepEqual(defaults.requestParams, defaults.stages.listen.params);
  assert.equal(createHealthPayload().model, "qwen3.5-omni-flash");
});

test("Cantonese migrates legacy single-stage prompt and parameters into listen", function () {
  const request = normalizeRecommendRequest({
    taskItemId: "item-legacy",
    audioUrl: "https://example.invalid/audio.wav",
    referenceText: "參考文字",
    singleModel: "qwen3.5-omni-plus",
    singlePrompt: "舊的粵語聽音提示詞",
    aiOptions: { temperature: 0.2, top_p: 0.7, max_tokens: 1800, stop: ["END"] },
  });
  assert.equal(request.aiStages.listen.model, "qwen3.5-omni-plus");
  assert.equal(request.aiStages.listen.prompt, "舊的粵語聽音提示詞");
  assert.deepEqual(request.aiStages.listen.params, { temperature: 0.2, top_p: 0.7, max_tokens: 1800, stop: ["END"] });
  assert.equal(request.enableThinking, false);
});

test("Cantonese accepts the released recognize-stage request shape as a listen-stage alias", function () {
  const request = normalizeRecommendRequest({
    taskItemId: "item-released-client",
    audioUrl: "https://example.invalid/audio.wav",
    aiStages: {
      recognize: {
        model: "qwen3.5-omni-plus",
        prompt: "released-client-prompt",
        params: { temperature: 0.2, top_p: 0.7, max_tokens: 1800, stop: ["END"] },
      },
    },
  });

  assert.equal(request.aiStages.listen.model, "qwen3.5-omni-plus");
  assert.equal(request.aiStages.listen.prompt, "released-client-prompt");
  assert.deepEqual(request.aiStages.listen.params, {
    temperature: 0.2,
    top_p: 0.7,
    max_tokens: 1800,
    stop: ["END"],
  });
});

test("Cantonese upgrades Fun-ASR plus Qwen comparison to Omni comparison", function () {
  const request = normalizeRecommendRequest({
    taskItemId: "item-fun-asr",
    audioUrl: "https://example.invalid/audio.wav",
    aiStages: { listen: { model: "fun-asr" }, compare: { family: "qwen", model: "qwen3.5-plus" } },
  });
  assert.equal(request.aiStages.listen.model, "fun-asr");
  assert.equal(request.aiStages.compare.family, "omni");
  assert.equal(request.aiStages.compare.model, "qwen3.5-omni-flash");
  assert.equal(request.aiStages.compare.speedSource, "omni-compare");
});

test("Cantonese Omni request keeps thinking disabled while passing the chosen model and parameters", function () {
  const body = buildDashScopeOmniRequestBody({
    model: "qwen3.5-omni-plus",
    audioUrl: "https://example.invalid/audio.mp3",
    requestParams: { temperature: 0.2, top_p: 0.7, max_tokens: 1800, presence_penalty: 0.1, frequency_penalty: 0.2, seed: 11, stop: ["END"] },
    userPrompt: "請只回傳 JSON。",
  });
  assert.equal(body.model, "qwen3.5-omni-plus");
  assert.equal(body.enable_thinking, false);
  assert.equal(body.max_tokens, 1800);
  assert.equal(body.messages[1].content[0].input_audio.format, "mp3");
  assert.equal(body.presence_penalty, 0.1);
  assert.equal(body.frequency_penalty, 0.2);
  assert.equal(body.seed, 11);
  assert.deepEqual(body.stop, ["END"]);
});

test("Cantonese service returns the unified multi-stage result without writing annotations", async function () {
  const service = createCantoneseRecommendService({
    pipeline: {
      run: async function () {
        return {
          data: { convertedText: "候選", heardText: "聽音", recommendedText: "最終粵語", recommendedSpeed: "fast", referenceText: "參考" },
          meta: { requestId: "service-success", stage: "complete", usage: { totalTokens: 10 }, cost: { currency: "CNY" } },
        };
      },
    },
  });
  const result = await service.run({ taskItemId: "item-service", audioUrl: "https://example.invalid/audio.wav", requestId: "service-success" });
  const body = buildRecommendSuccessBody(result);
  assert.equal(body.success, true);
  assert.equal(body.data.convertedText, "候選");
  assert.equal(body.data.heardText, "聽音");
  assert.equal(body.data.recommendedText, "最終粵語");
  assert.equal(body.data.recommendedSpeed, "fast");
});

test("Cantonese service normalizes rate limits into the shared stage error contract", async function () {
  const service = createCantoneseRecommendService({
    pipeline: { run: async function () { const error = new Error("too many requests"); error.statusCode = 429; error.stage = "compare"; throw error; } },
  });
  await assert.rejects(
    service.run({ taskItemId: "item-rate-limit", audioUrl: "https://example.invalid/audio.wav", requestId: "rate-limit" }),
    function (error) {
      const body = buildRecommendErrorBody(error, "rate-limit");
      assert.equal(body.error.code, "provider-rate-limited");
      assert.equal(body.error.stage, "compare");
      assert.equal(body.error.retryable, true);
      return true;
    }
  );
});

test("Cantonese environment variables take priority over shared Aishell compatibility variables", function () {
  const original = { cantoneseKey: process.env.AISHELL_CANTONESE_AI_API_KEY, aishellKey: process.env.AISHELL_AI_API_KEY, dashscopeKey: process.env.DASHSCOPE_API_KEY, cantoneseBaseUrl: process.env.AISHELL_CANTONESE_AI_BASE_URL, aishellBaseUrl: process.env.AISHELL_AI_BASE_URL };
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
      const envKey = { cantoneseKey: "AISHELL_CANTONESE_AI_API_KEY", aishellKey: "AISHELL_AI_API_KEY", dashscopeKey: "DASHSCOPE_API_KEY", cantoneseBaseUrl: "AISHELL_CANTONESE_AI_BASE_URL", aishellBaseUrl: "AISHELL_AI_BASE_URL" }[key];
      if (value === undefined) delete process.env[envKey]; else process.env[envKey] = value;
    });
  }
});

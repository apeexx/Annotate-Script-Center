"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const recommendation = require(path.resolve(__dirname, "ai-recommendation.js"));

test("JD Shanghai recommendation sends only the safe current audio snapshot to jobs", async function () {
  let received = null;
  const runtime = recommendation.createRuntime({
    endpoint: "https://backend.example.test/api/jd-tts-annotation/shanghainese-helper/ai/recommend",
    aiOmni: { model: "qwen3.5-omni-plus", prompt: "识别", params: { temperature: 0.1 } },
    requestMeta: { aiUsageOperatorName: "tester", platformUserName: "annotator" },
    fetchImpl: async function () { return { ok: true, status: 200, json: async function () { return { success: true }; } }; },
    jobClient: {
      runJobLifecycle: async function (input) {
        received = input;
        return { data: { utteranceId: "42", checksum: "a".repeat(32), listenText: "侬好", needHumanReview: false, meta: { requestId: "safe" } } };
      },
    },
  });
  const result = await runtime.recommend({
    utteranceId: "42",
    checksum: "a".repeat(32),
    audioDataUrl: "data:audio/x-wav;base64,UklGRg==",
    sourceAudioUrl: "https://must-not-leak.example.test/audio.wav",
  });

  assert.deepEqual(Object.keys(received.body).sort(), ["aiOmni", "aiUsageOperatorName", "audioDataUrl", "checksum", "clientRequestId", "clientVersion", "platformUserName", "platformUserId", "utteranceId"].sort());
  assert.equal(received.body.sourceAudioUrl, undefined);
  assert.equal(received.body.audioUrl, undefined);
  assert.equal(received.pollIntervalMs, 800);
  assert.equal(received.timeoutMs, 60000);
  assert.deepEqual(result, { utteranceId: "42", checksum: "a".repeat(32), listenText: "侬好", needHumanReview: false, meta: { requestId: "safe" } });
});

test("JD Shanghai recommendation preserves raw listenText and never exposes a job id", async function () {
  const runtime = recommendation.createRuntime({
    endpoint: "https://backend.example.test/api/jd-tts-annotation/shanghainese-helper/ai/recommend",
    fetchImpl: async function () { return { ok: true, status: 200, json: async function () { return { success: true }; } }; },
    jobClient: { runJobLifecycle: async function () { return { data: { utteranceId: "7", checksum: "b".repeat(32), listenText: " 原样 文本 ", needHumanReview: true, meta: { jobId: "hidden" } }, job: { jobId: "hidden" } }; } },
  });
  const result = await runtime.recommend({ utteranceId: "7", checksum: "b".repeat(32), audioDataUrl: "data:audio/wav;base64,UklGRg==" });
  assert.equal(result.listenText, " 原样 文本 ");
  assert.equal(Object.prototype.hasOwnProperty.call(result, "jobId"), false);
});

test("JD Shanghai recommendation maps saved flat single-stage settings on every request", async function () {
  const calls = [];
  const settings = { meta: { backendEndpointMode: "server" }, platforms: { jdTtsAnnotation: { scripts: { shanghaineseHelper: {
    aiRecommendSingleModel: "qwen3.5-omni-plus", aiRecommendSinglePrompt: "server prompt", aiRecommendTemperature: "0.125", aiRecommendMaxTokens: "321", aiRecommendStopSequences: "END\nSTOP",
  } } } } };
  const runtime = recommendation.createRuntime({
    constants: { buildBackendUrl(path, currentSettings) { return (currentSettings.meta.backendEndpointMode === "local" ? "http://127.0.0.1:3335" : "https://server.example.test") + path; } },
    getSettings: async function () { return settings; },
    fetchImpl: async function () { return { ok: true, status: 200, json: async function () { return { success: true }; } }; },
    jobClient: { runJobLifecycle: async function (input) { calls.push(input); return { data: { utteranceId: input.body.utteranceId, checksum: input.body.checksum, listenText: "ok", needHumanReview: false } }; } },
  });
  const snapshot = { utteranceId: "42", checksum: "a".repeat(32), audioDataUrl: "data:audio/x-wav;base64,UklGRg==" };
  await runtime.recommend(snapshot);
  settings.meta.backendEndpointMode = "local";
  Object.assign(settings.platforms.jdTtsAnnotation.scripts.shanghaineseHelper, {
    aiRecommendSingleModel: "qwen3.5-omni-flash", aiRecommendSinglePrompt: "local prompt", aiRecommendTemperature: "", aiRecommendTopP: "0.2", aiRecommendMaxTokens: "", aiRecommendStopSequences: "",
  });
  await runtime.recommend(snapshot);
  assert.deepEqual(calls.map(function (call) { return call.endpoint; }), ["https://server.example.test/api/jd-tts-annotation/shanghainese-helper/ai/recommend", "http://127.0.0.1:3335/api/jd-tts-annotation/shanghainese-helper/ai/recommend"]);
  assert.deepEqual(calls.map(function (call) { return call.body.aiOmni; }), [{ model: "qwen3.5-omni-plus", prompt: "server prompt", params: { temperature: 0.125, max_tokens: 321, stop: ["END", "STOP"] } }, { model: "qwen3.5-omni-flash", prompt: "local prompt", params: { top_p: 0.2 } }]);
  assert.equal(calls.some(function (call) { return /^\//.test(call.endpoint); }), false);
});

test("JD Shanghai recommendation selects a healthy alternate backend before exactly one jobs creation", async function () {
  const endpoints = [];
  const healthCalls = [];
  const runtime = recommendation.createRuntime({
    constants: { buildBackendUrl(path, settings) { return (settings.meta.backendEndpointMode === "local" ? "http://127.0.0.1:3335" : "https://server.example.test") + path; } },
    getSettings: async function () { return { meta: { backendEndpointMode: "server" }, platforms: { jdTtsAnnotation: { scripts: { shanghaineseHelper: { aiRecommendSingleModel: "qwen3.5-omni-plus", aiRecommendSinglePrompt: "prompt" } } } } }; },
    fetchImpl: async function (url, init) { healthCalls.push([url, init.method]); const local = url.indexOf("127.0.0.1") >= 0; return { ok: local, status: local ? 200 : 503, json: async function () { return { success: local }; } }; },
    jobClient: { runJobLifecycle: async function (input) { endpoints.push(input.endpoint); if (input.endpoint.indexOf("127.0.0.1") < 0) { throw new TypeError("create network failure"); } return { data: { utteranceId: "42", checksum: "a".repeat(32), listenText: "ok", needHumanReview: false } }; } },
  });
  await runtime.recommend({ utteranceId: "42", checksum: "a".repeat(32), audioDataUrl: "data:audio/x-wav;base64,UklGRg==" });
  assert.deepEqual(endpoints, ["http://127.0.0.1:3335/api/jd-tts-annotation/shanghainese-helper/ai/recommend"]);
  assert.deepEqual(healthCalls, [["https://server.example.test/api/jd-tts-annotation/shanghainese-helper/ai/recommend/health", "GET"], ["http://127.0.0.1:3335/api/jd-tts-annotation/shanghainese-helper/ai/recommend/health", "GET"]]);
});

test("JD Shanghai recommendation never creates a second job after a selected endpoint poll network failure", async function () {
  const endpoints = [];
  const runtime = recommendation.createRuntime({
    constants: { buildBackendUrl(path, settings) { return (settings.meta.backendEndpointMode === "local" ? "http://127.0.0.1:3335" : "https://server.example.test") + path; } },
    getSettings: async function () { return { meta: { backendEndpointMode: "server" }, platforms: { jdTtsAnnotation: { scripts: { shanghaineseHelper: { aiRecommendSingleModel: "qwen3.5-omni-plus", aiRecommendSinglePrompt: "prompt" } } } } }; },
    fetchImpl: async function (url) { const local = url.indexOf("127.0.0.1") >= 0; return { ok: local, status: local ? 200 : 503, json: async function () { return { success: local }; } }; },
    jobClient: { runJobLifecycle: async function (input) { endpoints.push(input.endpoint); throw new TypeError("poll network failure"); } },
  });
  await assert.rejects(runtime.recommend({ utteranceId: "42", checksum: "a".repeat(32), audioDataUrl: "data:audio/x-wav;base64,UklGRg==" }), function (error) { return error?.code === "network-disconnected"; });
  assert.deepEqual(endpoints, ["http://127.0.0.1:3335/api/jd-tts-annotation/shanghainese-helper/ai/recommend"]);
});

test("JD Shanghai recommendation classifies a network failure without fallback when primary health is available", async function () {
  let jobCalls = 0;
  const runtime = recommendation.createRuntime({
    constants: { buildBackendUrl(path) { return "https://server.example.test" + path; } },
    getSettings: async function () { return { meta: { backendEndpointMode: "server" }, platforms: { jdTtsAnnotation: { scripts: { shanghaineseHelper: { aiRecommendSingleModel: "qwen3.5-omni-plus", aiRecommendSinglePrompt: "prompt" } } } } }; },
    fetchImpl: async function () { return { ok: true, status: 200, json: async function () { return { success: true }; } }; },
    jobClient: { runJobLifecycle: async function () { jobCalls += 1; throw new TypeError("Failed to fetch"); } },
  });
  await assert.rejects(
    runtime.recommend({ utteranceId: "42", checksum: "a".repeat(32), audioDataUrl: "data:audio/x-wav;base64,UklGRg==" }),
    function (error) { return error?.code === "network-disconnected" && error?.rawResponse?.fallbackAttempted === false; }
  );
  assert.equal(jobCalls, 1);
});

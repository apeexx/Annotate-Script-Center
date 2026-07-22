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
    jobClient: { runJobLifecycle: async function () { return { data: { utteranceId: "7", checksum: "b".repeat(32), listenText: " 原样 文本 ", needHumanReview: true, meta: { jobId: "hidden" } }, job: { jobId: "hidden" } }; } },
  });
  const result = await runtime.recommend({ utteranceId: "7", checksum: "b".repeat(32), audioDataUrl: "data:audio/wav;base64,UklGRg==" });
  assert.equal(result.listenText, " 原样 文本 ");
  assert.equal(Object.prototype.hasOwnProperty.call(result, "jobId"), false);
});

test("JD Shanghai recommendation resolves the unified server or local backend and saved aiOmni on every request", async function () {
  const calls = [];
  const settings = [
    { meta: { backendEndpointMode: "server" }, platforms: { jdTtsAnnotation: { scripts: { shanghaineseHelper: { aiOmni: { model: "qwen3.5-omni-plus", prompt: "server prompt", params: { temperature: 0.1 } } } } } } },
    { meta: { backendEndpointMode: "local" }, platforms: { jdTtsAnnotation: { scripts: { shanghaineseHelper: { aiOmni: { model: "qwen3.5-omni-flash", prompt: "local prompt", params: { top_p: 0.2 } } } } } } },
  ];
  const runtime = recommendation.createRuntime({
    constants: { buildBackendUrl(path, currentSettings) { return (currentSettings.meta.backendEndpointMode === "local" ? "http://127.0.0.1:3335" : "https://server.example.test") + path; } },
    getSettings: async function () { return settings.shift(); },
    jobClient: { runJobLifecycle: async function (input) { calls.push(input); return { data: { utteranceId: input.body.utteranceId, checksum: input.body.checksum, listenText: "ok", needHumanReview: false } }; } },
  });
  const snapshot = { utteranceId: "42", checksum: "a".repeat(32), audioDataUrl: "data:audio/x-wav;base64,UklGRg==" };
  await runtime.recommend(snapshot);
  await runtime.recommend(snapshot);
  assert.deepEqual(calls.map(function (call) { return call.endpoint; }), ["https://server.example.test/api/jd-tts-annotation/shanghainese-helper/ai/recommend", "http://127.0.0.1:3335/api/jd-tts-annotation/shanghainese-helper/ai/recommend"]);
  assert.deepEqual(calls.map(function (call) { return call.body.aiOmni; }), [{ model: "qwen3.5-omni-plus", prompt: "server prompt", params: { temperature: 0.1 } }, { model: "qwen3.5-omni-flash", prompt: "local prompt", params: { top_p: 0.2 } }]);
  assert.equal(calls.some(function (call) { return /^\//.test(call.endpoint); }), false);
});

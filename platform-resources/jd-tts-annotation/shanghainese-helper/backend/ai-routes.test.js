"use strict";

const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const path = require("node:path");
const test = require("node:test");

const routes = require(path.resolve(__dirname, "ai-routes.js"));

test("JD TTS Shanghai registers health, defaults, recommend, and job lifecycle routes", function () {
  const registered = [];
  routes.createRecommendRouteRuntime().registerAiRoutes({
    get: function (route) { registered.push("GET " + route); },
    post: function (route) { registered.push("POST " + route); },
  });

  assert.deepEqual(registered, [
    "GET /api/jd-tts-annotation/shanghainese-helper/ai/recommend/health",
    "GET /api/jd-tts-annotation/shanghainese-helper/ai/recommend/defaults",
    "POST /api/jd-tts-annotation/shanghainese-helper/ai/recommend",
    "POST /api/jd-tts-annotation/shanghainese-helper/ai/recommend/jobs",
    "GET /api/jd-tts-annotation/shanghainese-helper/ai/recommend/jobs/:jobId",
    "GET /api/jd-tts-annotation/shanghainese-helper/ai/recommend/jobs/:jobId/debug",
    "POST /api/jd-tts-annotation/shanghainese-helper/ai/recommend/jobs/:jobId/cancel",
  ]);
});

test("JD TTS Shanghai keeps the legacy recommend path as the jobs creation alias", function () {
  const handlers = {};
  routes.createRecommendRouteRuntime().registerAiRoutes({
    get: function () {},
    post: function (route, handler) { handlers[route] = handler; },
  });

  assert.equal(
    handlers["/api/jd-tts-annotation/shanghainese-helper/ai/recommend"],
    handlers["/api/jd-tts-annotation/shanghainese-helper/ai/recommend/jobs"]
  );
});

test("JD TTS Shanghai saves sanitized provider debug payload when a job fails", async function () {
  const request = new EventEmitter();
  const response = {};
  const job = {
    jobId: "jd-job-failure-1",
    requestId: "request-failure",
    routeKey: "/api/jd-tts-annotation/shanghainese-helper/ai/recommend",
    status: "pending",
    createdAt: 1,
    updatedAt: 1,
    startedAt: 0,
    finishedAt: 0,
    itemId: "4881635",
    textId: "checksum",
    responseBody: null,
    errorBody: null,
    hasDebugPayload: false,
  };
  let debugPayload = null;
  const runtime = routes.createRecommendRouteRuntime({
    normalizeRecommendRequest: function (body) { return body; },
    jobStore: {
      createJob: function () { return job; },
      getJobSignal: function () { return new AbortController().signal; },
      markJobRunning: function () { job.status = "running"; },
      markJobSucceeded: function () {},
      markJobFailed: function (_jobId, options) {
        debugPayload = options.debugPayload;
        job.status = "failed";
        job.errorBody = options.errorBody;
      },
    },
    pipeline: {
      run: async function () {
        const error = new Error("provider failed");
        error.code = "provider-failed";
        error.debugRawAiResponse = {
          providerStatus: 502,
          audioDataUrl: "data:audio/x-wav;base64,U0VDUkVU",
          sourceUrl: "https://private.example.test/file.wav?signature=secret",
          cookie: "private-cookie",
          token: "private-token",
        };
        throw error;
      },
    },
    buildRecommendCacheKey: function () { return "job-failure"; },
    getCachedRecommendResult: function () { return null; },
    setCachedRecommendResult: function () {},
    sendJson: function (target, statusCode, body) {
      target.statusCode = statusCode;
      target.body = body;
    },
    setTimeout: function () { return {}; },
    clearTimeout: function () {},
  });

  process.nextTick(function () {
    request.emit("data", Buffer.from(JSON.stringify({
      requestId: "request-failure",
      utteranceId: "4881635",
      checksum: "a".repeat(32),
      audioDataUrl: "data:audio/x-wav;base64,UklGRg==",
      aiUsageOperatorName: "测试使用人",
      aiOmni: { model: "qwen3.5-omni-plus", prompt: "only text", params: {} },
    })));
    request.emit("end");
  });
  await runtime.handleCreateRecommendJob({ request, response });
  await new Promise(function (resolve) { setImmediate(resolve); });

  const serialized = JSON.stringify(debugPayload);
  assert.equal(response.statusCode, 202);
  assert.equal(debugPayload.providerStatus, 502);
  assert.doesNotMatch(serialized, /data:audio|private\.example|signature=|private-cookie|private-token/i);
});

test("JD TTS Shanghai debug sanitizer redacts audio data and source URLs", function () {
  const sanitized = routes.sanitizeDebugPayload({
    audioDataUrl: "data:audio/x-wav;base64,UklGRg==",
    audioUrl: "https://private.example.test/audio.wav?signature=private",
    nested: { cookie: "private-cookie" },
  });
  const serialized = JSON.stringify(sanitized);
  assert.doesNotMatch(serialized, /data:audio|private\.example|private-cookie/i);
});

test("JD TTS Shanghai stops reading an oversized request body before later chunks", async function () {
  const request = new EventEmitter();
  const response = {};
  let resumed = false;
  request.resume = function () { resumed = true; };
  const runtime = routes.createRecommendRouteRuntime({
    sendJson: function (target, statusCode, body) {
      target.statusCode = statusCode;
      target.body = body;
    },
  });

  process.nextTick(function () {
    request.emit("data", Buffer.alloc(3 * 1024 * 1024 + 1, 0x61));
    request.emit("data", Buffer.from("must-not-be-buffered"));
    request.emit("end");
  });
  await runtime.handleRecommend({ request, response });

  assert.equal(resumed, true);
  assert.equal(response.statusCode, 413);
  assert.equal(response.body.error.code, "payload-too-large");
  assert.equal(request.listenerCount("data"), 0);
});

test("JD TTS Shanghai rejects missing AI usage operator before creating an async job", async function () {
  const request = new EventEmitter();
  const response = {};
  let createCalls = 0;
  const runtime = routes.createRecommendRouteRuntime({
    jobStore: {
      createJob() { createCalls += 1; throw new Error("must not create job"); },
    },
    sendJson(target, statusCode, body) { target.statusCode = statusCode; target.body = body; },
  });
  process.nextTick(function () {
    request.emit("data", Buffer.from(JSON.stringify({
      utteranceId: "4881635",
      checksum: "a".repeat(32),
      audioDataUrl: "data:audio/x-wav;base64,UklGRg==",
    })));
    request.emit("end");
  });

  await runtime.handleCreateRecommendJob({ request, response });

  assert.equal(createCalls, 0);
  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error.code, "missing-ai-usage-operator-name");
  assert.equal(response.body.error.stage, "validate");
});

test("JD TTS Shanghai rejects a missing AI usage operator on the compatibility entry before its pipeline runs", async function () {
  const request = new EventEmitter();
  const response = {};
  let pipelineCalls = 0;
  const runtime = routes.createRecommendRouteRuntime({
    pipeline: { run: async function () { pipelineCalls += 1; throw new Error("must not run"); } },
    sendJson(target, statusCode, body) { target.statusCode = statusCode; target.body = body; },
  });
  process.nextTick(function () {
    request.emit("data", Buffer.from(JSON.stringify({
      utteranceId: "4881635",
      checksum: "a".repeat(32),
      audioDataUrl: "data:audio/x-wav;base64,UklGRg==",
    })));
    request.emit("end");
  });

  await runtime.handleRecommend({ request, response });

  assert.equal(pipelineCalls, 0);
  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error.code, "missing-ai-usage-operator-name");
  assert.equal(response.body.error.stage, "validate");
});

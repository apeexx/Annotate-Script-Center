"use strict";

const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const path = require("node:path");
const test = require("node:test");

const routes = require(path.resolve(__dirname, "ai-routes.js"));

const CROPPED_WAV_DATA_URL = "data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQIAAAAAAA==";

function createJsonRequest(body) {
  const request = new EventEmitter();
  request.destroy = function () {};
  process.nextTick(function () {
    request.emit("data", Buffer.from(JSON.stringify(body)));
    request.emit("end");
  });
  return request;
}

function createEnglishRequest(overrides) {
  return Object.assign({
    taskId: "task-safe-fixture",
    packageId: "package-safe-fixture",
    taskItemId: "item-safe-fixture",
    audioDataUrl: CROPPED_WAV_DATA_URL,
    regionId: "region-safe-fixture",
    segmentNumber: 7,
    startMs: 1200,
    endMs: 2600,
    durationMs: 1400,
    selectionKey: "region-safe-fixture:1200-2600",
    aiUsageOperatorName: "test-operator",
  }, overrides || {});
}

function createJobStore(job) {
  const controller = new AbortController();
  return {
    controller,
    createJob: function () { return job; },
    getJob: function () { return job; },
    getJobSignal: function () { return controller.signal; },
    markJobRunning: function () { job.status = "running"; },
    markJobSucceeded: function (_jobId, options) {
      job.status = "succeeded";
      job.responseBody = options.responseBody;
      return { ignored: false };
    },
    markJobFailed: function (_jobId, options) {
      job.status = "failed";
      job.errorBody = options.errorBody;
    },
    cancelJob: function (_jobId, options) {
      job.status = "failed";
      job.errorBody = options?.errorBody || null;
      controller.abort(options?.errorBody);
      return job;
    },
    getJobDebug: function () { return {}; },
  };
}

test("English routes expose the full recommend job route family", function () {
  const registered = [];
  routes.createRecommendRouteRuntime().registerAiRoutes({
    get: function (pathname) { registered.push("GET " + pathname); },
    post: function (pathname) { registered.push("POST " + pathname); },
  });

  assert.ok(registered.includes("GET /api/aishell-tech/english-transcription-helper/ai/recommend/health"));
  assert.ok(registered.includes("GET /api/aishell-tech/english-transcription-helper/ai/recommend/defaults"));
  assert.ok(registered.includes("POST /api/aishell-tech/english-transcription-helper/ai/recommend"));
  assert.ok(registered.includes("POST /api/aishell-tech/english-transcription-helper/ai/recommend/jobs"));
  assert.ok(registered.includes("GET /api/aishell-tech/english-transcription-helper/ai/recommend/jobs/:jobId"));
  assert.ok(registered.includes("GET /api/aishell-tech/english-transcription-helper/ai/recommend/jobs/:jobId/debug"));
  assert.ok(registered.includes("POST /api/aishell-tech/english-transcription-helper/ai/recommend/jobs/:jobId/cancel"));
});

test("English job lifecycle always gives the pipeline 60 seconds and disabled thinking", async function () {
  const job = {
    jobId: "english-job-safe-fixture",
    requestId: "request-safe-fixture",
    routeKey: "/api/aishell-tech/english-transcription-helper/ai/recommend",
    status: "pending",
    createdAt: 1,
    updatedAt: 1,
    startedAt: 0,
    finishedAt: 0,
    itemId: "item-safe-fixture",
    textId: "task-safe-fixture",
    responseBody: null,
    errorBody: null,
    hasDebugPayload: false,
  };
  const jobStore = createJobStore(job);
  const scheduled = [];
  const received = {};
  const runtime = routes.createRecommendRouteRuntime({
    jobStore,
    normalizeRecommendRequest: function (body) {
      return Object.assign({}, body, { aiOmni: { enableThinking: false } });
    },
    pipeline: {
      run: async function (request, context) {
        received.request = request;
        received.context = context;
        return { data: { listenText: "Keep original English.", needHumanReview: false }, meta: {} };
      },
    },
    buildRecommendCacheKey: function () { return "safe-key"; },
    getCachedRecommendResult: function () { return null; },
    setCachedRecommendResult: function () {},
    buildRecommendSuccessBody: function (result) { return { success: true, data: result.data, meta: result.meta }; },
    sendJson: function (response, statusCode, body) {
      response.statusCode = statusCode;
      response.body = body;
      response.writableEnded = true;
    },
    setTimeout: function (callback, delayMs) {
      scheduled.push({ callback, delayMs });
      return {};
    },
    clearTimeout: function () {},
  });

  const response = {};
  await runtime.handleCreateRecommendJob({
    request: createJsonRequest({
      requestId: "request-safe-fixture",
      taskId: "task-safe-fixture",
      taskItemId: "item-safe-fixture",
      aiUsageOperatorName: "test-operator",
    }),
    response,
  });
  await new Promise(function (resolve) { setImmediate(resolve); });

  assert.equal(response.statusCode, 202);
  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0].delayMs, 60000);
  assert.equal(received.context.timeoutMs, 60000);
  assert.equal(received.request.aiOmni.enableThinking, false);
});

test("English routes reject missing task context before sync execution or job creation", async function () {
  const job = {
    jobId: "english-job-context-fixture",
    requestId: "request-context-fixture",
    routeKey: "/api/aishell-tech/english-transcription-helper/ai/recommend",
    status: "pending",
    createdAt: 1,
    updatedAt: 1,
    startedAt: 0,
    finishedAt: 0,
    itemId: "item-safe-fixture",
    textId: "task-safe-fixture",
    responseBody: null,
    errorBody: null,
    hasDebugPayload: false,
  };
  let jobCreateCount = 0;
  let cacheReadCount = 0;
  let cacheWriteCount = 0;
  let pipelineRunCount = 0;
  const jobStore = Object.assign(createJobStore(job), {
    createJob: function () {
      jobCreateCount += 1;
      return job;
    },
  });
  const runtime = routes.createRecommendRouteRuntime({
    jobStore,
    buildRecommendCacheKey: function () {
      cacheReadCount += 1;
      return "must-not-cache";
    },
    getCachedRecommendResult: function () {
      cacheReadCount += 1;
      return null;
    },
    setCachedRecommendResult: function () { cacheWriteCount += 1; },
    pipeline: {
      run: async function () {
        pipelineRunCount += 1;
        return { data: { listenText: "unexpected" }, meta: {} };
      },
    },
    sendJson: function (response, statusCode, body) {
      response.statusCode = statusCode;
      response.body = body;
      response.writableEnded = true;
    },
    setTimeout: function () { return {}; },
    clearTimeout: function () {},
  });
  const invalidRequest = createEnglishRequest({ taskId: " " });
  const syncResponse = new EventEmitter();
  syncResponse.destroyed = false;
  syncResponse.writableEnded = false;
  await runtime.handleRecommend({ request: createJsonRequest(invalidRequest), response: syncResponse });
  const jobResponse = {};
  await runtime.handleCreateRecommendJob({ request: createJsonRequest(invalidRequest), response: jobResponse });

  [syncResponse, jobResponse].forEach(function (response) {
    assert.equal(response.statusCode, 400);
    assert.equal(response.body.error.code, "missing-task-context");
  });
  assert.equal(jobCreateCount, 0);
  assert.equal(cacheReadCount, 0);
  assert.equal(cacheWriteCount, 0);
  assert.equal(pipelineRunCount, 0);
});

test("English routes reject bodies over 3 MB and never reveal cropped audio in debug payloads", async function () {
  const request = new EventEmitter();
  const response = new EventEmitter();
  let resumed = false;
  request.resume = function () { resumed = true; };
  response.destroyed = false;
  response.writableEnded = false;
  const runtime = routes.createRecommendRouteRuntime({
    sendJson: function (target, statusCode, body) {
      target.statusCode = statusCode;
      target.body = body;
      target.writableEnded = true;
    },
  });

  process.nextTick(function () {
    request.emit("data", Buffer.alloc(3 * 1024 * 1024 + 1, 0x61));
  });
  await runtime.handleRecommend({ request, response });

  assert.equal(resumed, true);
  assert.equal(response.statusCode, 413);
  assert.equal(response.body.error.code, "payload-too-large");

  const bareWavBase64 = "UklGRiYAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQIAAAAAAA==";
  const sanitized = routes.sanitizeDebugPayload({
    audioDataUrl: "data:audio/wav;base64," + bareWavBase64,
    audioBase64: bareWavBase64,
    audio_base64: bareWavBase64,
    sourceUrl: "https://example.invalid/full-source.wav?signature=not-for-debug",
    nested: { providerStatus: 429, rawAudio: bareWavBase64 },
  });
  const serialized = JSON.stringify(sanitized);
  assert.doesNotMatch(serialized, /data:audio\/wav/i);
  assert.doesNotMatch(serialized, /example\.invalid/);
  assert.doesNotMatch(serialized, /UklGRjYAAABXQVZF/);
  assert.equal(sanitized.nested.providerStatus, 429);
});

test("English route debug redaction removes serialized JSON and every supported audio encoding", function () {
  const urlSafeAudio = Buffer.alloc(48, 0xff).toString("base64url");
  const unpaddedAudio = Buffer.alloc(49, 0xab).toString("base64").replace(/=+$/, "");
  const nonAudioDataUrl = "data:application/octet-stream;base64," + unpaddedAudio;
  const serializedAudio = JSON.stringify({
    audioBase64: urlSafeAudio,
    audio_base64: unpaddedAudio,
    dataUrl: nonAudioDataUrl,
  });

  const sanitized = routes.sanitizeDebugPayload({
    serializedAudio,
    urlSafeAudio,
    unpaddedAudio,
    nonAudioDataUrl,
  });
  const publicJson = JSON.stringify(sanitized);

  assert.doesNotMatch(publicJson, new RegExp(urlSafeAudio));
  assert.doesNotMatch(publicJson, new RegExp(unpaddedAudio));
  assert.doesNotMatch(publicJson, /data:application\/octet-stream;base64/i);
});

test("English routes keep provider queue failure details out of sync and job error bodies", async function () {
  const urlSafeAudio = Buffer.alloc(48, 0xff).toString("base64url");
  const unpaddedAudio = Buffer.alloc(49, 0xab).toString("base64").replace(/=+$/, "");
  const upstreamMessage = "provider-queue-internal-detail " + JSON.stringify({
    audioBase64: urlSafeAudio,
    audio_base64: unpaddedAudio,
    dataUrl: "data:application/octet-stream;base64," + unpaddedAudio,
  });
  const createUpstreamError = function () {
    return Object.assign(new Error(upstreamMessage), {
      code: "provider-failed",
      statusCode: 502,
      summary: upstreamMessage,
      meta: { providerMessage: upstreamMessage },
    });
  };
  const job = {
    jobId: "english-job-redaction-fixture",
    requestId: "request-redaction-fixture",
    routeKey: "/api/aishell-tech/english-transcription-helper/ai/recommend",
    status: "pending",
    createdAt: 1,
    updatedAt: 1,
    startedAt: 0,
    finishedAt: 0,
    itemId: "item-redaction-fixture",
    textId: "task-redaction-fixture",
    responseBody: null,
    errorBody: null,
    hasDebugPayload: false,
  };
  const runtime = routes.createRecommendRouteRuntime({
    jobStore: createJobStore(job),
    normalizeRecommendRequest: function (body) { return body; },
    buildRecommendCacheKey: function () { return "redaction-fixture"; },
    getCachedRecommendResult: function () { return null; },
    setCachedRecommendResult: function () {},
    pipeline: { run: async function () { throw createUpstreamError(); } },
    parseTimeoutMs: function () { return 60000; },
    sendJson: function (response, statusCode, body) {
      response.statusCode = statusCode;
      response.body = body;
      response.writableEnded = true;
    },
    setTimeout: function () { return {}; },
    clearTimeout: function () {},
  });
  const requestBody = {
    requestId: "request-redaction-fixture",
    taskId: "task-redaction-fixture",
    taskItemId: "item-redaction-fixture",
    aiUsageOperatorName: "test-operator",
  };
  const syncResponse = new EventEmitter();
  syncResponse.destroyed = false;
  syncResponse.writableEnded = false;
  await runtime.handleRecommend({ request: createJsonRequest(requestBody), response: syncResponse });

  const jobResponse = {};
  await runtime.handleCreateRecommendJob({ request: createJsonRequest(requestBody), response: jobResponse });
  await new Promise(function (resolve) { setImmediate(resolve); });

  [syncResponse.body, job.errorBody].forEach(function (body) {
    const publicJson = JSON.stringify(body);
    assert.equal(body.error.message, "English transcription request failed.");
    assert.doesNotMatch(publicJson, /provider-queue-internal-detail/);
    assert.doesNotMatch(publicJson, new RegExp(urlSafeAudio));
    assert.doesNotMatch(publicJson, new RegExp(unpaddedAudio));
    assert.doesNotMatch(publicJson, /data:application\/octet-stream;base64/i);
  });
});

test("English route debug redaction removes opaque Data URLs from ordinary fields and serialized JSON", function () {
  const opaqueDataUrl = "data:,opaque";
  const base64DataUrl = "data:;base64,SGVsbG8=";
  const sanitized = routes.sanitizeDebugPayload({
    ordinaryField: "provider detail: " + opaqueDataUrl,
    anotherOrdinaryField: base64DataUrl,
    serialized: JSON.stringify({
      ordinaryField: opaqueDataUrl,
      anotherOrdinaryField: base64DataUrl,
    }),
  });
  const publicJson = JSON.stringify(sanitized);

  assert.equal(publicJson.includes(opaqueDataUrl), false);
  assert.equal(publicJson.includes(base64DataUrl), false);
});

test("English job status re-sanitizes stored error codes before publishing them", function () {
  const opaqueDataUrl = "data:;base64,SGVsbG8=";
  const job = {
    jobId: "english-job-status-redaction-fixture",
    requestId: "request-status-redaction-fixture",
    routeKey: "/api/aishell-tech/english-transcription-helper/ai/recommend",
    status: "failed",
    createdAt: 1,
    updatedAt: 1,
    startedAt: 1,
    finishedAt: 1,
    itemId: "item-status-redaction-fixture",
    textId: "task-status-redaction-fixture",
    responseBody: null,
    errorBody: {
      success: false,
      error: {
        code: "https://provider.example.invalid/error?signature=test-signature",
        providerCode: opaqueDataUrl,
        providerStatus: 429,
      },
      meta: { ordinaryField: opaqueDataUrl },
    },
    hasDebugPayload: false,
  };
  const response = {};
  const runtime = routes.createRecommendRouteRuntime({
    jobStore: Object.assign(createJobStore(job), { getJob: function () { return job; } }),
    sendJson: function (target, statusCode, body) {
      target.statusCode = statusCode;
      target.body = body;
      target.writableEnded = true;
    },
  });

  runtime.handleGetRecommendJobStatus({ response, params: { jobId: job.jobId } });

  const publicJson = JSON.stringify(response.body);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.error.error.code, "request-error");
  assert.equal(response.body.error.error.providerCode, "");
  assert.equal(publicJson.includes("provider.example.invalid"), false);
  assert.equal(publicJson.includes("test-signature"), false);
  assert.equal(publicJson.includes(opaqueDataUrl), false);
});

test("English routes retain only safe rate-limit identity in sync and Job failures", async function () {
  const opaqueDataUrl = "data:;base64,SGVsbG8=";
  const job = {
    jobId: "english-job-rate-limit-redaction-fixture",
    requestId: "request-rate-limit-redaction-fixture",
    routeKey: "/api/aishell-tech/english-transcription-helper/ai/recommend",
    status: "pending",
    createdAt: 1,
    updatedAt: 1,
    startedAt: 0,
    finishedAt: 0,
    itemId: "item-rate-limit-redaction-fixture",
    textId: "task-rate-limit-redaction-fixture",
    responseBody: null,
    errorBody: null,
    hasDebugPayload: false,
  };
  const createRateLimitError = function () {
    return Object.assign(new Error("provider limit failure"), {
      code: "provider-rate-limited",
      providerCode: opaqueDataUrl,
      providerStatus: 429,
      statusCode: 429,
      meta: { ordinaryField: opaqueDataUrl },
    });
  };
  const runtime = routes.createRecommendRouteRuntime({
    jobStore: createJobStore(job),
    normalizeRecommendRequest: function (body) { return body; },
    buildRecommendCacheKey: function () { return "rate-limit-redaction-fixture"; },
    getCachedRecommendResult: function () { return null; },
    setCachedRecommendResult: function () {},
    pipeline: { run: async function () { throw createRateLimitError(); } },
    parseTimeoutMs: function () { return 60000; },
    sendJson: function (response, statusCode, body) {
      response.statusCode = statusCode;
      response.body = body;
      response.writableEnded = true;
    },
    setTimeout: function () { return {}; },
    clearTimeout: function () {},
  });
  const requestBody = {
    requestId: "request-rate-limit-redaction-fixture",
    taskId: "task-rate-limit-redaction-fixture",
    taskItemId: "item-rate-limit-redaction-fixture",
    aiUsageOperatorName: "test-operator",
  };
  const syncResponse = new EventEmitter();
  syncResponse.destroyed = false;
  syncResponse.writableEnded = false;
  await runtime.handleRecommend({ request: createJsonRequest(requestBody), response: syncResponse });

  const jobResponse = {};
  await runtime.handleCreateRecommendJob({ request: createJsonRequest(requestBody), response: jobResponse });
  await new Promise(function (resolve) { setImmediate(resolve); });

  [syncResponse.body, job.errorBody].forEach(function (body) {
    const publicJson = JSON.stringify(body);
    assert.equal(body.error.code, "provider-rate-limited");
    assert.equal(body.error.providerCode, "");
    assert.equal(publicJson.includes(opaqueDataUrl), false);
  });
});

test("English job create, status, and cancel redact reflected Data URLs in root fields", async function () {
  const opaqueDataUrl = "data:,opaque";
  const base64DataUrl = "data:;base64,SGVsbG8=";
  const job = {
    jobId: opaqueDataUrl,
    requestId: base64DataUrl,
    routeKey: opaqueDataUrl,
    status: "pending",
    createdAt: 1,
    updatedAt: 1,
    startedAt: 0,
    finishedAt: 0,
    itemId: base64DataUrl,
    textId: opaqueDataUrl,
    responseBody: null,
    errorBody: null,
    hasDebugPayload: false,
  };
  const runtime = routes.createRecommendRouteRuntime({
    jobStore: createJobStore(job),
    normalizeRecommendRequest: function (body) { return body; },
    buildRecommendCacheKey: function () { return "root-redaction-fixture"; },
    getCachedRecommendResult: function () { return null; },
    setCachedRecommendResult: function () {},
    pipeline: { run: async function () { return { data: { listenText: "Keep original English." }, meta: {} }; } },
    parseTimeoutMs: function () { return 60000; },
    sendJson: function (response, statusCode, body) {
      response.statusCode = statusCode;
      response.body = body;
      response.writableEnded = true;
    },
    setTimeout: function () { return {}; },
    clearTimeout: function () {},
  });
  const requestBody = { taskItemId: "item-safe-fixture", aiUsageOperatorName: "test-operator" };
  const createResponse = {};
  await runtime.handleCreateRecommendJob({ request: createJsonRequest(requestBody), response: createResponse });
  const statusResponse = {};
  runtime.handleGetRecommendJobStatus({ response: statusResponse, params: { jobId: job.jobId } });
  const cancelResponse = {};
  runtime.handleCancelRecommendJob({ response: cancelResponse, params: { jobId: job.jobId } });

  [createResponse.body, statusResponse.body, cancelResponse.body].forEach(function (body) {
    const publicJson = JSON.stringify(body);
    assert.equal(publicJson.includes(opaqueDataUrl), false);
    assert.equal(publicJson.includes(base64DataUrl), false);
  });
});

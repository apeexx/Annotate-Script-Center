"use strict";

const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const http = require("node:http");
const path = require("node:path");
const test = require("node:test");

const routes = require(path.resolve(__dirname, "ai-routes.js"));

test("Aishell Cantonese debug payload never retains cropped audio or source URLs", function () {
  const sanitized = routes.sanitizeDebugPayload({
    audioDataUrl: "data:audio/wav;base64,UklGRg==",
    audioUrl: "https://oss.example.test/full.wav?signature=secret",
    nested: {
      sourceUrl: "https://oss.example.test/other.wav?signature=secret",
      providerStatus: 502,
    },
    authorization: "Bearer top-secret-token",
    cookie: "session=private-cookie",
    nestedError: "provider rejected authorization=top-secret-token",
    providerEcho: "provider echoed eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJleGFtcGxlIn0.synthetic-signature",
    downloadFailure: "download failed for https://oss.example.test/private/audio.wav",
  });

  const serialized = JSON.stringify(sanitized);
  assert.doesNotMatch(serialized, /data:audio\/wav/i);
  assert.doesNotMatch(serialized, /oss\.example\.test/);
  assert.doesNotMatch(serialized, /top-secret-token/);
  assert.doesNotMatch(serialized, /private-cookie/);
  assert.doesNotMatch(serialized, /eyJhbGciOiJIUzI1NiJ9/);
  assert.doesNotMatch(serialized, /private\/audio\.wav/);
  assert.equal(sanitized.nested.providerStatus, 502);
});

test("Aishell Cantonese rejects a cropped WAV request larger than 3MB before it reaches the pipeline", async function () {
  const request = new EventEmitter();
  const response = new EventEmitter();
  let resumed = false;
  request.resume = function () {
    resumed = true;
  };
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
  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, "payload-too-large");
});

test("Aishell Cantonese returns JSON payload-too-large responses for both sync and job requests", async function (t) {
  const runtime = routes.createRecommendRouteRuntime();
  const server = http.createServer(function (request, response) {
    if (request.url.endsWith("/jobs")) {
      void runtime.handleCreateRecommendJob({ request, response });
      return;
    }
    void runtime.handleRecommend({ request, response });
  });
  t.after(async function () {
    server.closeAllConnections();
    await new Promise(function (resolve) { server.close(resolve); });
  });
  await new Promise(function (resolve, reject) {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const oversizedBody = Buffer.alloc(3 * 1024 * 1024 + 1, 0x61);

  async function post(pathname) {
    return new Promise(function (resolve, reject) {
      const request = http.request({
        host: "127.0.0.1",
        port: address.port,
        method: "POST",
        path: pathname,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": String(oversizedBody.length),
        },
      }, function (response) {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", function (chunk) { body += chunk; });
        response.once("end", function () {
          resolve({ statusCode: response.statusCode, body: JSON.parse(body) });
        });
      });
      request.once("error", reject);
      request.end(oversizedBody);
    });
  }

  for (const pathname of [
    "/api/aishell-tech/cantonese-helper/ai/recommend",
    "/api/aishell-tech/cantonese-helper/ai/recommend/jobs",
  ]) {
    const result = await post(pathname);
    assert.equal(result.statusCode, 413);
    assert.equal(result.body.success, false);
    assert.equal(result.body.error.code, "payload-too-large");
  }
});

test("Aishell Cantonese registers the job create, polling, and cancel routes", function () {
  const registered = [];
  routes.createRecommendRouteRuntime().registerAiRoutes({
    get: function (path) { registered.push("GET " + path); },
    post: function (path) { registered.push("POST " + path); },
  });

  assert.ok(registered.includes("POST /api/aishell-tech/cantonese-helper/ai/recommend/jobs"));
  assert.ok(registered.includes("GET /api/aishell-tech/cantonese-helper/ai/recommend/jobs/:jobId"));
  assert.ok(registered.includes("POST /api/aishell-tech/cantonese-helper/ai/recommend/jobs/:jobId/cancel"));
});

test("Aishell Cantonese creates a job and makes its raw listenText available through polling", async function () {
  const request = new EventEmitter();
  request.destroy = function () {};
  const job = {
    jobId: "cantonese-job-1",
    requestId: "request-1",
    routeKey: "/api/aishell-tech/cantonese-helper/ai/recommend",
    status: "pending",
    createdAt: 1,
    updatedAt: 1,
    startedAt: 0,
    finishedAt: 0,
    itemId: "item-1",
    textId: "task-1",
    responseBody: null,
    errorBody: null,
    hasDebugPayload: false,
  };
  const jobStore = {
    createJob: function () { return job; },
    getJob: function () { return job; },
    getJobSignal: function () { return new AbortController().signal; },
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
  };
  const runtime = routes.createRecommendRouteRuntime({
    jobStore,
    normalizeRecommendRequest: function (body) { return body; },
    pipeline: {
      run: async function () {
        return { data: { listenText: "冇問題 ！" }, meta: { requestId: "request-1" } };
      },
    },
    buildRecommendCacheKey: function () { return "segment-cache-key"; },
    getCachedRecommendResult: function () { return null; },
    setCachedRecommendResult: function () {},
    buildRecommendSuccessBody: function (result) {
      return { success: true, data: result.data, meta: result.meta };
    },
    buildRecommendErrorBody: function ({ error }) {
      return { success: false, error: { code: error.code || "request-error" } };
    },
    sendJson: function (target, statusCode, body) {
      target.statusCode = statusCode;
      target.body = body;
      target.writableEnded = true;
    },
    setTimeout: function () { return {}; },
    clearTimeout: function () {},
  });

  process.nextTick(function () {
    request.emit("data", Buffer.from(JSON.stringify({
      requestId: "request-1",
      taskId: "task-1",
      taskItemId: "item-1",
      aiUsageOperatorName: "test-operator",
    })));
    request.emit("end");
  });

  const createResponse = {};
  await runtime.handleCreateRecommendJob({ request, response: createResponse });
  await new Promise(function (resolve) { setImmediate(resolve); });

  const pollResponse = {};
  runtime.handleGetRecommendJobStatus({ response: pollResponse, params: { jobId: "cantonese-job-1" } });

  assert.equal(createResponse.statusCode, 202);
  assert.equal(createResponse.body.status, "pending");
  assert.equal(pollResponse.statusCode, 200);
  assert.equal(pollResponse.body.status, "succeeded");
  assert.equal(pollResponse.body.data.data.listenText, "冇問題 ！");
});

test("Aishell Cantonese cancels an unfinished job at the fixed 60-second lifetime", async function () {
  const request = new EventEmitter();
  request.destroy = function () {};
  const job = {
    jobId: "cantonese-timeout-job",
    requestId: "timeout-request",
    routeKey: "/api/aishell-tech/cantonese-helper/ai/recommend",
    status: "pending",
    createdAt: 1,
    updatedAt: 1,
    startedAt: 0,
    finishedAt: 0,
    itemId: "item-1",
    textId: "task-1",
    responseBody: null,
    errorBody: null,
    hasDebugPayload: false,
  };
  const controller = new AbortController();
  const jobStore = {
    createJob: function () { return job; },
    getJobSignal: function () { return controller.signal; },
    markJobRunning: function () { job.status = "running"; },
    markJobSucceeded: function () { return { ignored: false }; },
    markJobFailed: function () {},
    cancelJob: function (_jobId, options) {
      job.status = "failed";
      job.errorBody = options.errorBody;
      controller.abort(options.errorBody);
      return job;
    },
  };
  const scheduled = [];
  const runtime = routes.createRecommendRouteRuntime({
    jobStore,
    normalizeRecommendRequest: function (body) { return body; },
    pipeline: { run: function () { return new Promise(function () {}); } },
    buildRecommendCacheKey: function () { return "timeout-cache-key"; },
    getCachedRecommendResult: function () { return null; },
    buildRecommendErrorBody: function ({ error }) {
      return { success: false, error: { code: error.code || "request-error" } };
    },
    sendJson: function (target, statusCode, body) {
      target.statusCode = statusCode;
      target.body = body;
      target.writableEnded = true;
    },
    setTimeout: function (callback, delayMs) {
      scheduled.push({ callback, delayMs });
      return {};
    },
    clearTimeout: function () {},
  });

  process.nextTick(function () {
    request.emit("data", Buffer.from(JSON.stringify({
      requestId: "timeout-request",
      taskId: "task-1",
      taskItemId: "item-1",
      aiUsageOperatorName: "test-operator",
    })));
    request.emit("end");
  });

  await runtime.handleCreateRecommendJob({ request, response: {} });
  await new Promise(function (resolve) { setImmediate(resolve); });
  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0].delayMs, 60000);

  scheduled[0].callback();
  assert.equal(job.status, "failed");
  assert.equal(job.errorBody.error.code, "ai-job-timeout");
  assert.equal(controller.signal.aborted, true);
});

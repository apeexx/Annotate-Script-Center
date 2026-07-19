"use strict";

const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const http = require("node:http");
const test = require("node:test");

test("Aishell Cantonese registers the bounded recommend, job polling, and debug routes", function () {
  const { registerAiRoutes } = require("./ai-routes");
  const routes = [];
  const router = {
    get: function (path, handler) {
      routes.push({ method: "GET", path, handler });
    },
    post: function (path, handler) {
      routes.push({ method: "POST", path, handler });
    },
  };

  registerAiRoutes(router);

  assert.deepEqual(
    routes.map(function (route) {
      return route.method + " " + route.path;
    }),
    [
      "GET /api/aishell-tech/cantonese-helper/ai/recommend/health",
      "GET /api/aishell-tech/cantonese-helper/ai/recommend/defaults",
      "POST /api/aishell-tech/cantonese-helper/ai/recommend",
      "POST /api/aishell-tech/cantonese-helper/ai/recommend/jobs",
      "POST /api/aishell-tech/cantonese-helper/ai/recommend/jobs/:jobId/cancel",
      "GET /api/aishell-tech/cantonese-helper/ai/recommend/jobs/:jobId",
      "GET /api/aishell-tech/cantonese-helper/ai/recommend/jobs/:jobId/debug",
    ]
  );
});

test("Aishell Cantonese recommend stops reading an unfinished request body when its lifecycle times out", async function () {
  const { createRecommendRouteRuntime } = require("./ai-routes");
  const request = new EventEmitter();
  const response = new EventEmitter();
  let resumeCount = 0;

  request.resume = function () {
    resumeCount += 1;
  };
  response.destroyed = false;
  response.writableEnded = false;

  const runtime = createRecommendRouteRuntime({
    parseTimeoutMs: function () {
      return 10;
    },
    buildRecommendErrorBody: function ({ error }) {
      return { success: false, error: { code: error.code } };
    },
    sendJson: function (target, statusCode, body) {
      target.statusCode = statusCode;
      target.body = body;
      target.writableEnded = true;
    },
  });

  await Promise.race([
    runtime.handleRecommend({ request, response }),
    new Promise(function (_resolve, reject) {
      setTimeout(function () {
        reject(new Error("unfinished request body did not respect the lifecycle timeout"));
      }, 100);
    }),
  ]);

  assert.equal(resumeCount, 1);
  assert.equal(response.statusCode, 504);
  assert.equal(response.body.error.code, "aborted");
});

test("Aishell Cantonese returns a 504 JSON response before closing an unfinished real HTTP request body", async function (t) {
  const { createRecommendRouteRuntime } = require("./ai-routes");
  const runtime = createRecommendRouteRuntime({
    parseTimeoutMs: function () {
      return 10;
    },
  });
  const server = http.createServer(function (request, response) {
    void runtime.handleRecommend({ request, response });
  });
  let clientRequest = null;

  t.after(async function () {
    if (clientRequest) {
      clientRequest.destroy();
    }
    server.closeAllConnections();
    await new Promise(function (resolve) {
      server.close(function () {
        resolve();
      });
    });
  });

  await new Promise(function (resolve, reject) {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const partialBody = '{"secret":"do-not-return"';
  const result = await new Promise(function (resolve, reject) {
    const timeout = setTimeout(function () {
      reject(new Error("unfinished real HTTP request did not receive a timeout response"));
    }, 200);
    clientRequest = http.request({
      host: "127.0.0.1",
      port: address.port,
      method: "POST",
      path: "/api/aishell-tech/cantonese-helper/ai/recommend",
      headers: {
        Connection: "close",
        "Content-Length": String(Buffer.byteLength(partialBody, "utf8") + 1),
      },
    }, function (response) {
      let responseBody = "";
      response.setEncoding("utf8");
      response.on("data", function (chunk) {
        responseBody += chunk;
      });
      response.once("end", function () {
        clearTimeout(timeout);
        resolve({
          body: JSON.parse(responseBody),
          rawBody: responseBody,
          statusCode: response.statusCode,
        });
      });
    });
    clientRequest.once("error", function (error) {
      clearTimeout(timeout);
      reject(error);
    });
    clientRequest.write(partialBody);
  });

  assert.equal(result.statusCode, 504);
  assert.equal(result.body.success, false);
  assert.equal(result.body.error.code, "aborted");
  assert.equal(result.body.error.stage, "queue");
  assert.equal(result.rawBody.includes("do-not-return"), false);
});

test("Aishell Cantonese does not cache a job result after the job was cancelled", async function () {
  const { createRecommendRouteRuntime } = require("./ai-routes");
  const request = new EventEmitter();
  const response = new EventEmitter();
  const job = { jobId: "job-cancelled", requestId: "request-1", status: "pending" };
  let cacheSetCount = 0;

  request.destroy = function () {};
  const runtime = createRecommendRouteRuntime({
    normalizeRecommendRequest: function (body) {
      return body;
    },
    pipeline: {
      run: async function () {
        return {
          data: { taskItemId: "item-1", listenText: "聽寫結果" },
          meta: { requestId: "request-1", cache: { hit: false, sourceRequestId: "" } },
        };
      },
    },
    jobStore: {
      createJob: function () {
        return job;
      },
      getJobSignal: function () {
        return new AbortController().signal;
      },
      markJobRunning: function () {},
      markJobSucceeded: function () {
        return { ignored: true };
      },
      markJobFailed: function () {},
    },
    buildRecommendCacheKey: function () {
      return "cache-key";
    },
    getCachedRecommendResult: function () {
      return null;
    },
    setCachedRecommendResult: function () {
      cacheSetCount += 1;
    },
    buildRecommendSuccessBody: function (result) {
      return { success: true, data: result.data, meta: result.meta };
    },
    buildRecommendErrorBody: function ({ error }) {
      return { success: false, error: { code: error.code || "request-error" } };
    },
    sendJson: function (target, _statusCode, body) {
      target.body = body;
      target.writableEnded = true;
    },
  });

  process.nextTick(function () {
    request.emit("data", Buffer.from(JSON.stringify({
      requestId: "request-1",
      taskItemId: "item-1",
      aiUsageOperatorName: "tester",
    })));
    request.emit("end");
  });

  await runtime.handleCreateRecommendJob({ request, response });
  await new Promise(function (resolve) {
    setImmediate(resolve);
  });

  assert.equal(response.body.status, "pending");
  assert.equal(cacheSetCount, 0);
});

function createControlledJobStore() {
  const controller = new AbortController();
  const job = {
    jobId: "job-controlled",
    requestId: "request-controlled",
    routeKey: "/api/aishell-tech/cantonese-helper/ai/recommend",
    status: "pending",
    createdAt: 1,
    updatedAt: 1,
    startedAt: 0,
    finishedAt: 0,
    itemId: "item-1",
    textId: "",
    responseBody: null,
    errorBody: null,
    hasDebugPayload: false,
  };

  return {
    job,
    cancelJob: function (jobId, options) {
      assert.equal(jobId, job.jobId);
      job.status = "failed";
      job.finishedAt = 2;
      job.errorBody = options?.errorBody || {
        success: false,
        error: { code: "aborted", stage: "queue" },
      };
      controller.abort(job.errorBody);
      return job;
    },
    createJob: function () {
      return job;
    },
    getJob: function (jobId) {
      assert.equal(jobId, job.jobId);
      return job;
    },
    getJobSignal: function () {
      return controller.signal;
    },
    markJobFailed: function () {
      return { ignored: job.status === "failed" };
    },
    markJobRunning: function () {
      if (job.status !== "failed") {
        job.status = "running";
        job.startedAt = 1;
      }
    },
    markJobSucceeded: function () {
      if (job.status === "failed") {
        return { ignored: true };
      }
      job.status = "succeeded";
      return { ignored: false };
    },
  };
}

function createJobRequest() {
  const request = new EventEmitter();
  request.destroy = function () {};
  process.nextTick(function () {
    request.emit("data", Buffer.from(JSON.stringify({
      requestId: "request-controlled",
      taskItemId: "item-1",
      aiUsageOperatorName: "tester",
    })));
    request.emit("end");
  });
  return request;
}

test("Aishell Cantonese cancels a created job through a POST route and never caches its late result", async function () {
  const { createRecommendRouteRuntime } = require("./ai-routes");
  const jobStore = createControlledJobStore();
  let finishPipeline;
  let cacheSetCount = 0;
  const runtime = createRecommendRouteRuntime({
    jobStore,
    normalizeRecommendRequest: function (body) {
      return body;
    },
    pipeline: {
      run: function () {
        return new Promise(function (resolve) {
          finishPipeline = resolve;
        });
      },
    },
    buildRecommendCacheKey: function () {
      return "cache-key";
    },
    getCachedRecommendResult: function () {
      return null;
    },
    setCachedRecommendResult: function () {
      cacheSetCount += 1;
    },
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
    setTimeout: function () {
      return {};
    },
    clearTimeout: function () {},
  });
  const routes = [];
  runtime.registerAiRoutes({
    get: function (path) {
      routes.push("GET " + path);
    },
    post: function (path) {
      routes.push("POST " + path);
    },
  });

  assert.ok(routes.includes("POST /api/aishell-tech/cantonese-helper/ai/recommend/jobs/:jobId/cancel"));

  await runtime.handleCreateRecommendJob({ request: createJobRequest(), response: {} });
  await new Promise(function (resolve) {
    setImmediate(resolve);
  });

  const cancelResponse = {};
  runtime.handleCancelRecommendJob({
    response: cancelResponse,
    params: { jobId: jobStore.job.jobId },
  });

  assert.equal(cancelResponse.statusCode, 200);
  assert.equal(cancelResponse.body.status, "failed");
  assert.equal(cancelResponse.body.error.error.code, "aborted");

  finishPipeline({
    data: { taskItemId: "item-1", listenText: "late result" },
    meta: { requestId: "request-controlled" },
  });
  await new Promise(function (resolve) {
    setImmediate(resolve);
  });

  const pollResponse = {};
  runtime.handleGetRecommendJobStatus({
    response: pollResponse,
    params: { jobId: jobStore.job.jobId },
  });
  assert.equal(pollResponse.body.status, "failed");
  assert.equal(pollResponse.body.error.error.code, "aborted");
  assert.equal(cacheSetCount, 0);
});

test("Aishell Cantonese job lifetime remains 60 seconds from creation even when the shared timeout is larger", async function (t) {
  const { createRecommendRouteRuntime } = require("./ai-routes");
  const previousSharedTimeout = process.env.ASC_AI_JOB_TIMEOUT_MS;
  process.env.ASC_AI_JOB_TIMEOUT_MS = "300000";
  t.after(function () {
    if (previousSharedTimeout === undefined) {
      delete process.env.ASC_AI_JOB_TIMEOUT_MS;
    } else {
      process.env.ASC_AI_JOB_TIMEOUT_MS = previousSharedTimeout;
    }
  });

  const jobStore = createControlledJobStore();
  const scheduled = [];
  let finishPipeline;
  let cacheSetCount = 0;
  const runtime = createRecommendRouteRuntime({
    jobStore,
    normalizeRecommendRequest: function (body) {
      return body;
    },
    pipeline: {
      run: function () {
        return new Promise(function (resolve) {
          finishPipeline = resolve;
        });
      },
    },
    buildRecommendCacheKey: function () {
      return "cache-key";
    },
    getCachedRecommendResult: function () {
      return null;
    },
    setCachedRecommendResult: function () {
      cacheSetCount += 1;
    },
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
    setTimeout: function (callback, delayMs) {
      scheduled.push({ callback, delayMs });
      return scheduled.length - 1;
    },
    clearTimeout: function () {},
  });

  await runtime.handleCreateRecommendJob({ request: createJobRequest(), response: {} });
  await new Promise(function (resolve) {
    setImmediate(resolve);
  });

  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0].delayMs, 60000);
  scheduled[0].callback();

  assert.equal(jobStore.job.status, "failed");
  assert.equal(jobStore.job.errorBody.error.code, "ai-job-timeout");

  finishPipeline({
    data: { taskItemId: "item-1", listenText: "late result" },
    meta: { requestId: "request-controlled" },
  });
  await new Promise(function (resolve) {
    setImmediate(resolve);
  });

  assert.equal(cacheSetCount, 0);
});

"use strict";

const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const test = require("node:test");

const {
  AI_BASE_PATH,
  AI_DEFAULTS_PATH,
  AI_HEALTH_PATH,
  registerAiRoutes,
  createCantoneseRouteRuntime,
} = require("./ai-routes");

test("Cantonese backend registers only direct recommend, defaults, and health endpoints", function () {
  const registrations = [];
  const router = {
    get: function (path) {
      registrations.push(["GET", path]);
    },
    post: function (path) {
      registrations.push(["POST", path]);
    },
  };

  registerAiRoutes(router);

  assert.deepEqual(registrations, [
    ["GET", "/api/aishell-tech/cantonese-helper/ai/recommend/health"],
    ["GET", "/api/aishell-tech/cantonese-helper/ai/recommend/defaults"],
    ["POST", "/api/aishell-tech/cantonese-helper/ai/recommend"],
  ]);
  assert.equal(AI_BASE_PATH, "/api/aishell-tech/cantonese-helper/ai/recommend");
  assert.equal(AI_HEALTH_PATH, AI_BASE_PATH + "/health");
  assert.equal(AI_DEFAULTS_PATH, AI_BASE_PATH + "/defaults");
});

test("Cantonese direct endpoint returns a unified retryable response for rate limits", async function () {
  const runtime = createCantoneseRouteRuntime({
    createRequestId: function () {
      return "cantonese-route-rate-limit";
    },
    service: {
      run: async function () {
        const error = new Error("too many requests");
        error.code = "provider-rate-limited";
        error.statusCode = 429;
        error.stage = "recognize";
        throw error;
      },
    },
    appendAishellCantoneseAiCallLogSafe: function () {},
  });
  const response = {
    statusCode: 0,
    body: "",
    writeHead: function (statusCode) {
      this.statusCode = statusCode;
    },
    end: function (body) {
      this.body = String(body || "");
    },
  };

  await runtime.handleRecommend({
    request: Readable.from([
      JSON.stringify({
        taskItemId: "item-3",
        audioUrl: "https://example.invalid/audio.wav",
        aiUsageOperatorName: "测试员",
      }),
    ]),
    response,
  });

  const body = JSON.parse(response.body);
  assert.equal(response.statusCode, 429);
  assert.equal(body.success, false);
  assert.equal(body.error.code, "provider-rate-limited");
  assert.equal(body.error.retryable, true);
  assert.equal(body.meta.requestId, "cantonese-route-rate-limit");
});

test("Cantonese direct endpoint requires the shared AI usage operator before calling the model", async function () {
  let called = false;
  const runtime = createCantoneseRouteRuntime({
    createRequestId: function () {
      return "cantonese-route-operator";
    },
    service: {
      run: async function () {
        called = true;
        return {};
      },
    },
    appendAishellCantoneseAiCallLogSafe: function () {},
  });
  const response = {
    statusCode: 0,
    body: "",
    writeHead: function (statusCode) {
      this.statusCode = statusCode;
    },
    end: function (body) {
      this.body = String(body || "");
    },
  };

  await runtime.handleRecommend({
    request: Readable.from([
      JSON.stringify({ taskItemId: "item-4", audioUrl: "https://example.invalid/audio.wav" }),
    ]),
    response,
  });

  const body = JSON.parse(response.body);
  assert.equal(called, false);
  assert.equal(response.statusCode, 400);
  assert.equal(body.success, false);
  assert.equal(body.error.code, "missing-ai-usage-operator-name");
});

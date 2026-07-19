"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  AI_BASE_PATH,
  AI_DEFAULTS_PATH,
  AI_HEALTH_PATH,
  AI_JOBS_PATH,
  AI_JOB_DETAIL_PATH,
  AI_JOB_DEBUG_PATH,
  AI_JOB_CANCEL_PATH,
  AI_LOG_SUMMARY_PATH,
  createCantoneseRouteRuntime,
  registerAiRoutes,
} = require("./ai-routes");

test("Cantonese backend registers direct compatibility plus async job, debug, cancel, and log endpoints", function () {
  const registrations = [];
  const router = {
    get: function (path) { registrations.push(["GET", path]); },
    post: function (path) { registrations.push(["POST", path]); },
  };
  registerAiRoutes(router);
  assert.deepEqual(registrations, [
    ["GET", AI_HEALTH_PATH], ["GET", AI_DEFAULTS_PATH], ["POST", AI_BASE_PATH], ["POST", AI_JOBS_PATH],
    ["GET", AI_JOB_DETAIL_PATH], ["GET", AI_JOB_DEBUG_PATH], ["POST", AI_JOB_CANCEL_PATH], ["GET", AI_LOG_SUMMARY_PATH],
  ]);
  assert.equal(AI_BASE_PATH, "/api/aishell-tech/cantonese-helper/ai/recommend");
  assert.equal(AI_JOBS_PATH, AI_BASE_PATH + "/jobs");
});

test("Cantonese cancel endpoint delegates to the shared job store and returns terminal job status", function () {
  const response = { body: "", statusCode: 0, writeHead: function (statusCode) { this.statusCode = statusCode; }, end: function (body) { this.body = String(body || ""); } };
  const runtime = createCantoneseRouteRuntime({
    jobStore: {
      cancelJob: function (jobId) {
        return {
          jobId,
          requestId: "cancel-request",
          status: "failed",
          errorBody: { success: false, error: { code: "aborted" }, meta: { cancelled: true } },
        };
      },
    },
  });
  runtime.handleCancelRecommendJob({ params: { jobId: "job-cancel" }, response });
  const body = JSON.parse(response.body);
  assert.equal(response.statusCode, 200);
  assert.equal(body.status, "failed");
  assert.equal(body.error.error.code, "aborted");
});

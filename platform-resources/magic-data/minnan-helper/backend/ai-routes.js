"use strict";

const { sendJson } = require("../../../backend/response");
const { buildAiCallLogSummaryPayload } = require("../../../backend/ai-call-log");
const { createAiRoute } = require("../../../backend/ai-framework");
const { createAiJobRouteHandlers } = require("../../../backend/ai-framework/core/create-ai-job-routes");
const minnanHelperAdapter = require("../ai/adapter");
const {
  SCRIPT_ID,
  createDefaultsPayload,
  createHealthPayload,
  readRequestBody,
  reviewCurrent,
} = require("./ai-service");

const AI_BASE_PATH = "/api/magic-data/minnan-helper/ai/review-current";
const AI_HEALTH_PATH = AI_BASE_PATH + "/health";
const AI_DEFAULTS_PATH = "/api/magic-data/minnan-helper/ai/defaults";
const AI_JOBS_PATH = AI_BASE_PATH + "/jobs";
const AI_JOB_DETAIL_PATH = AI_JOBS_PATH + "/:jobId";
const AI_JOB_DEBUG_PATH = AI_JOB_DETAIL_PATH + "/debug";
const AI_LOG_SUMMARY_PATH = AI_BASE_PATH + "/logs/summary";
const MAX_BODY_BYTES = 3 * 1024 * 1024;

function createRequestId() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const suffix = Math.random().toString(36).slice(2, 8);
  return String(yyyy) + mm + dd + "-" + hh + mi + ss + "-" + suffix;
}

function normalizeText(value) {
  return String(value || "").trim();
}

const reviewCurrentRouteOptions = {
  maxBodyBytes: MAX_BODY_BYTES,
  run(context) {
    const requestId = normalizeText(context?.normalizedRequest?.requestId || createRequestId());
    const body = context?.runtimeContext?.rawBody || {};
    return reviewCurrent(body, requestId);
  },
  createSuccessBody(context) {
    return minnanHelperAdapter.buildReviewSuccessBody(context);
  },
  createErrorBody(context) {
    const error = context?.error || {};
    if (error?.code === "timeout" && !error.statusCode) {
      error.statusCode = 504;
    }
    return minnanHelperAdapter.buildReviewErrorBody(context);
  },
};
const handleReviewCurrent = createAiRoute(minnanHelperAdapter, reviewCurrentRouteOptions);
const reviewCurrentJobHandlers = createAiJobRouteHandlers(
  minnanHelperAdapter,
  reviewCurrentRouteOptions
);
function registerAiRoutes(router) {
  router.get(AI_HEALTH_PATH, function ({ response }) {
    sendJson(response, 200, createHealthPayload());
  });

  router.get(AI_DEFAULTS_PATH, function ({ response }) {
    sendJson(response, 200, createDefaultsPayload());
  });

  router.post(AI_BASE_PATH, function (routeContext) {
    return handleReviewCurrent(routeContext);
  });
  router.post(AI_JOBS_PATH, function (routeContext) {
    return reviewCurrentJobHandlers.handleCreateJob(routeContext);
  });
  router.get(AI_JOB_DETAIL_PATH, function (routeContext) {
    return reviewCurrentJobHandlers.handleGetJobStatus(routeContext);
  });
  router.get(AI_JOB_DEBUG_PATH, function (routeContext) {
    return reviewCurrentJobHandlers.handleGetJobDebug(routeContext);
  });
  router.get(AI_LOG_SUMMARY_PATH, function ({ response, query }) {
    sendJson(
      response,
      200,
      buildAiCallLogSummaryPayload({
        service: "magic-data-minnan-helper-ai-review-current",
        scriptId: SCRIPT_ID,
        logger: minnanHelperAdapter.aiCallLogger,
        query,
      })
    );
  });
}

module.exports = {
  AI_BASE_PATH,
  AI_DEFAULTS_PATH,
  AI_HEALTH_PATH,
  AI_JOB_DEBUG_PATH,
  AI_JOB_DETAIL_PATH,
  AI_JOBS_PATH,
  AI_LOG_SUMMARY_PATH,
  handleReviewCurrent,
  registerAiRoutes,
};

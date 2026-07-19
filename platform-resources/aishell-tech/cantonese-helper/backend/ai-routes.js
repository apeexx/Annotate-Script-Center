"use strict";

const { sendJson: defaultSendJson } = require("../../../backend/response");
const { assertAiUsageOperatorName: defaultAssertAiUsageOperatorName } = require("../../../backend/ai-call-log");
const {
  aiCallLogger,
  appendAishellCantoneseAiCallLogSafe,
} = require("../data/ai-call-log");
const {
  buildRecommendErrorBody,
  buildRecommendSuccessBody,
  createCantoneseRecommendService,
  createDefaultsPayload,
  createHealthPayload,
} = require("./ai-service");

const AI_BASE_PATH = "/api/aishell-tech/cantonese-helper/ai/recommend";
const AI_HEALTH_PATH = AI_BASE_PATH + "/health";
const AI_DEFAULTS_PATH = AI_BASE_PATH + "/defaults";
const MAX_BODY_BYTES = 1024 * 1024;

function createRequestId() {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

function readRequestBody(request) {
  return new Promise(function (resolve, reject) {
    let body = "";
    request.on("data", function (chunk) {
      body += chunk;
      if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) {
        const error = new Error("请求体超过限制。");
        error.code = "request-body-too-large";
        error.statusCode = 413;
        reject(error);
        request.destroy();
      }
    });
    request.on("end", function () {
      resolve(body);
    });
    request.on("error", reject);
  });
}

function createCantoneseRouteRuntime(overrides) {
  const deps = Object.assign(
    {
      appendAishellCantoneseAiCallLogSafe,
      assertAiUsageOperatorName: defaultAssertAiUsageOperatorName,
      buildRecommendErrorBody,
      buildRecommendSuccessBody,
      createCantoneseRecommendService,
      createDefaultsPayload,
      createHealthPayload,
      createRequestId,
      readRequestBody,
      sendJson: defaultSendJson,
    },
    overrides || {}
  );
  const service = deps.service && typeof deps.service.run === "function"
    ? deps.service
    : deps.createCantoneseRecommendService();

  async function handleRecommend({ request, response }) {
    const requestId = deps.createRequestId();
    let body = {};
    try {
      body = JSON.parse((await deps.readRequestBody(request)) || "{}");
      body.requestId = body.requestId || body.clientRequestId || requestId;
      deps.assertAiUsageOperatorName(body);
      const result = await service.run(body);
      const responseBody = deps.buildRecommendSuccessBody(result);
      deps.sendJson(response, 200, responseBody);
      deps.appendAishellCantoneseAiCallLogSafe({
        requestId,
        rawBody: body,
        normalizedRequest: body,
        result,
        durationMs: result?.meta?.timing?.totalDurationMs,
      });
    } catch (error) {
      const statusCode = Math.max(400, Number(error?.statusCode || 500));
      deps.sendJson(response, statusCode, deps.buildRecommendErrorBody(error, body.requestId || requestId));
      deps.appendAishellCantoneseAiCallLogSafe({
        requestId,
        rawBody: body,
        normalizedRequest: body,
        error,
      });
    }
  }

  function registerAiRoutes(router) {
    router.get(AI_HEALTH_PATH, function ({ response }) {
      deps.sendJson(response, 200, deps.createHealthPayload());
    });
    router.get(AI_DEFAULTS_PATH, function ({ response }) {
      deps.sendJson(response, 200, deps.createDefaultsPayload());
    });
    router.post(AI_BASE_PATH, handleRecommend);
  }

  return { handleRecommend, registerAiRoutes };
}

const defaultRuntime = createCantoneseRouteRuntime();

module.exports = {
  AI_BASE_PATH,
  AI_DEFAULTS_PATH,
  AI_HEALTH_PATH,
  createCantoneseRouteRuntime,
  registerAiRoutes: defaultRuntime.registerAiRoutes,
};

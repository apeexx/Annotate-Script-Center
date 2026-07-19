"use strict";

const crypto = require("crypto");
const { sendJson: defaultSendJson } = require("../../../backend/response");
const { assertAiUsageOperatorName: defaultAssertAiUsageOperatorName, buildAiCallLogSummaryPayload } = require("../../../backend/ai-call-log");
const { buildJobStatusBody } = require("../../../backend/ai-framework/core/create-ai-job-routes");
const { sharedAiJobStore } = require("../../../backend/ai-framework/runtime/ai-job-store");
const { aiCallLogger, appendAishellCantoneseAiCallLogSafe } = require("../data/ai-call-log");
const {
  SERVICE_NAME,
  SCRIPT_ID,
  buildRecommendErrorBody,
  buildRecommendSuccessBody,
  createCantoneseRecommendService,
  createDefaultsPayload,
  createHealthPayload,
} = require("./ai-service");

const AI_BASE_PATH = "/api/aishell-tech/cantonese-helper/ai/recommend";
const AI_HEALTH_PATH = AI_BASE_PATH + "/health";
const AI_DEFAULTS_PATH = AI_BASE_PATH + "/defaults";
const AI_JOBS_PATH = AI_BASE_PATH + "/jobs";
const AI_JOB_DETAIL_PATH = AI_JOBS_PATH + "/:jobId";
const AI_JOB_DEBUG_PATH = AI_JOB_DETAIL_PATH + "/debug";
const AI_JOB_CANCEL_PATH = AI_JOB_DETAIL_PATH + "/cancel";
const AI_LOG_SUMMARY_PATH = AI_BASE_PATH + "/logs/summary";
const MAX_BODY_BYTES = 3 * 1024 * 1024;

function createRequestId() {
  return typeof crypto.randomUUID === "function" ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex");
}

function normalizeText(value) {
  return String(value || "").trim();
}

function readRequestBody(request) {
  return new Promise(function (resolve, reject) {
    let body = "";
    request.on("data", function (chunk) {
      body += chunk;
      if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) {
        const error = new Error("请求体超过 3MB。");
        error.code = "payload-too-large";
        error.statusCode = 413;
        reject(error);
        request.destroy();
      }
    });
    request.on("end", function () { resolve(body); });
    request.on("error", reject);
  });
}

function createCantoneseRouteRuntime(overrides) {
  const deps = Object.assign(
    {
      aiCallLogger,
      appendAishellCantoneseAiCallLogSafe,
      assertAiUsageOperatorName: defaultAssertAiUsageOperatorName,
      buildRecommendErrorBody,
      buildRecommendSuccessBody,
      buildJobStatusBody,
      createCantoneseRecommendService,
      createDefaultsPayload,
      createHealthPayload,
      createRequestId,
      jobStore: sharedAiJobStore,
      readRequestBody,
      sendJson: defaultSendJson,
    },
    overrides || {}
  );
  const service = deps.service && typeof deps.service.run === "function" ? deps.service : deps.createCantoneseRecommendService();

  function appendLog(input) {
    try { deps.appendAishellCantoneseAiCallLogSafe(input); } catch (_error) { /* logging must not alter AI output */ }
  }

  async function parseBody(request, requestId) {
    let body;
    try { body = JSON.parse((await deps.readRequestBody(request)) || "{}"); }
    catch (error) {
      if (error?.statusCode) throw error;
      const parsedError = new Error("请求体 JSON 解析失败。"); parsedError.code = "invalid-json"; parsedError.statusCode = 400; throw parsedError;
    }
    body.requestId = normalizeText(body.requestId || body.clientRequestId || requestId);
    deps.assertAiUsageOperatorName(body);
    return body;
  }

  async function execute(requestBody, requestId, jobId) {
    try {
      const result = await service.run(requestBody, {
        requestId,
        jobId: normalizeText(jobId),
        signal: jobId ? deps.jobStore.getJobSignal(jobId) : null,
        timeoutMs: 60000,
      });
      const successBody = deps.buildRecommendSuccessBody(result);
      appendLog({ createdAt: new Date().toISOString(), requestId, rawBody: requestBody, normalizedRequest: requestBody, result });
      return successBody;
    } catch (error) {
      const errorBody = deps.buildRecommendErrorBody(error, requestId);
      appendLog({ createdAt: new Date().toISOString(), requestId, rawBody: requestBody, normalizedRequest: requestBody, error });
      throw Object.assign(error instanceof Error ? error : new Error("AI 请求失败。"), { requestId, errorBody });
    }
  }

  async function handleRecommend(routeContext) {
    const requestId = deps.createRequestId();
    let body = {};
    try {
      body = await parseBody(routeContext.request, requestId);
      const result = await execute(body, body.requestId);
      deps.sendJson(routeContext.response, 200, result);
    } catch (error) {
      deps.sendJson(routeContext.response, Math.max(400, Number(error?.statusCode || 500)), error.errorBody || deps.buildRecommendErrorBody(error, body.requestId || requestId));
    }
  }

  async function handleCreateRecommendJob(routeContext) {
    const requestId = deps.createRequestId();
    let body = {};
    try {
      body = await parseBody(routeContext.request, requestId);
      const job = deps.jobStore.createJob({ requestId: body.requestId, routeKey: AI_BASE_PATH, itemId: body.taskItemId || body.itemId, textId: body.taskId || body.packageId });
      deps.sendJson(routeContext.response, 202, deps.buildJobStatusBody(job));
      Promise.resolve().then(async function () {
        try {
          deps.jobStore.markJobRunning(job.jobId);
          const result = await execute(body, body.requestId, job.jobId);
          deps.jobStore.markJobSucceeded(job.jobId, { responseBody: result });
        } catch (error) {
          deps.jobStore.markJobFailed(job.jobId, {
            errorBody: error.errorBody || deps.buildRecommendErrorBody(error, body.requestId),
            debugPayload: error.debugRawJson || error.debugRawAiResponse ? { debugRawJson: error.debugRawJson || null, rawAiDebug: error.debugRawAiResponse || null } : null,
          });
        }
      }).catch(function () {});
    } catch (error) {
      deps.sendJson(routeContext.response, Math.max(400, Number(error?.statusCode || 500)), deps.buildRecommendErrorBody(error, body.requestId || requestId));
    }
  }

  function handleGetRecommendJobStatus(routeContext) {
    try { deps.sendJson(routeContext.response, 200, deps.buildJobStatusBody(deps.jobStore.getJob(routeContext?.params?.jobId))); }
    catch (error) { deps.sendJson(routeContext.response, Math.max(400, Number(error?.statusCode || 500)), deps.buildRecommendErrorBody(error)); }
  }

  function handleGetRecommendJobDebug(routeContext) {
    try { deps.sendJson(routeContext.response, 200, { success: true, jobId: normalizeText(routeContext?.params?.jobId), debug: deps.jobStore.getJobDebug(routeContext?.params?.jobId) }); }
    catch (error) { deps.sendJson(routeContext.response, Math.max(400, Number(error?.statusCode || 500)), deps.buildRecommendErrorBody(error)); }
  }

  function handleCancelRecommendJob(routeContext) {
    try { deps.sendJson(routeContext.response, 200, deps.buildJobStatusBody(deps.jobStore.cancelJob(routeContext?.params?.jobId))); }
    catch (error) { deps.sendJson(routeContext.response, Math.max(400, Number(error?.statusCode || 500)), deps.buildRecommendErrorBody(error)); }
  }

  function registerAiRoutes(router) {
    router.get(AI_HEALTH_PATH, function ({ response }) { deps.sendJson(response, 200, deps.createHealthPayload()); });
    router.get(AI_DEFAULTS_PATH, function ({ response }) { deps.sendJson(response, 200, deps.createDefaultsPayload()); });
    router.post(AI_BASE_PATH, handleRecommend);
    router.post(AI_JOBS_PATH, handleCreateRecommendJob);
    router.get(AI_JOB_DETAIL_PATH, handleGetRecommendJobStatus);
    router.get(AI_JOB_DEBUG_PATH, handleGetRecommendJobDebug);
    router.post(AI_JOB_CANCEL_PATH, handleCancelRecommendJob);
    router.get(AI_LOG_SUMMARY_PATH, function ({ response, query }) {
      deps.sendJson(response, 200, buildAiCallLogSummaryPayload({ service: SERVICE_NAME, scriptId: SCRIPT_ID, logger: deps.aiCallLogger, query }));
    });
  }

  return { handleRecommend, handleCreateRecommendJob, handleGetRecommendJobStatus, handleGetRecommendJobDebug, handleCancelRecommendJob, registerAiRoutes };
}

const defaultRuntime = createCantoneseRouteRuntime();

module.exports = {
  AI_BASE_PATH, AI_DEFAULTS_PATH, AI_HEALTH_PATH, AI_JOBS_PATH, AI_JOB_DETAIL_PATH, AI_JOB_DEBUG_PATH, AI_JOB_CANCEL_PATH, AI_LOG_SUMMARY_PATH,
  createCantoneseRouteRuntime,
  handleCreateRecommendJob: defaultRuntime.handleCreateRecommendJob,
  handleGetRecommendJobStatus: defaultRuntime.handleGetRecommendJobStatus,
  handleGetRecommendJobDebug: defaultRuntime.handleGetRecommendJobDebug,
  handleCancelRecommendJob: defaultRuntime.handleCancelRecommendJob,
  registerAiRoutes: defaultRuntime.registerAiRoutes,
};

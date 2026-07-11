"use strict";

const crypto = require("crypto");

const { sendJson } = require("../../../backend/response");
const {
  assertAiUsageOperatorName,
  buildAiCallLogSummaryPayload,
} = require("../../../backend/ai-call-log");
const { createAiRoute } = require("../../../backend/ai-framework");
const dataBakerRoundOneAdapter = require("../ai/adapter");
const { aiCallLogger } = require("./ai-call-log");
const { getInFlightDedupeHealth, runWithInFlightDedupe } = require("./ai-inflight-dedupe");
const { getAiDebug } = require("./ai-debug-store");
const {
  LEGACY_OMNI_COMMIT,
  isOmniLegacyFastPathEnabled,
  isQwenSmoothEnabled,
  recommendLegacyOmni,
  shouldUseLegacyOmniFastPath,
} = require("./ai-legacy-omni-service");
const {
  createDefaultsPayload,
  createHealthPayload,
  normalizeRecommendRequest,
  recommend,
} = require("./ai-service");
const {
  createAiRecommendJob,
  getAiRecommendJob,
  getAiRecommendJobDebug,
  getAiRecommendJobSignal,
  markAiRecommendJobFailed,
  markAiRecommendJobRunning,
  markAiRecommendJobSucceeded,
} = require("./ai-job-store");

const AI_BASE_PATH = "/api/data-baker/round-one-quality/ai/recommend";
const AI_HEALTH_PATH = AI_BASE_PATH + "/health";
const AI_DEFAULTS_PATH = AI_BASE_PATH + "/defaults";
const AI_LOG_SUMMARY_PATH = AI_BASE_PATH + "/logs/summary";
const AI_DEBUG_PATH = AI_BASE_PATH + "/debug/:debugId";
const AI_JOBS_PATH = AI_BASE_PATH + "/jobs";
const AI_JOB_DETAIL_PATH = AI_JOBS_PATH + "/:jobId";
const AI_JOB_DEBUG_PATH = AI_JOB_DETAIL_PATH + "/debug";
const MAX_BODY_BYTES = 3 * 1024 * 1024;

function createRequestId() {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString("hex");
}

function readRequestBody(request) {
  return new Promise(function (resolve, reject) {
    let body = "";
    request.on("data", function (chunk) {
      body += chunk;
      if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) {
        const error = new Error("请求体超过 3MB。");
        error.statusCode = 413;
        error.code = "payload-too-large";
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

function createHttpError(statusCode, message, code) {
  const error = new Error(String(message || "请求失败。"));
  error.statusCode = Number(statusCode) || 500;
  error.code = String(code || "request-failed");
  return error;
}

function normalizeNullableInteger(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 0;
  }
  return number;
}

function buildErrorResponseBody(error, fallbackMessage) {
  const responseBody = {
    success: false,
    requestId: String(error?.requestId || ""),
    code: String(error?.code || ""),
    message: String(error?.safeMessage || error?.message || fallbackMessage || "请求失败。").slice(0, 240),
  };
  if (Number(error?.providerStatus) > 0) {
    responseBody.providerStatus = Number(error.providerStatus);
  } else if (Number(error?.statusCode) > 0) {
    responseBody.providerStatus = Number(error.statusCode);
  }
  if (String(error?.providerCode || "").trim()) {
    responseBody.providerCode = String(error.providerCode || "").trim();
  }
  if (String(error?.summary || "").trim()) {
    responseBody.summary = String(error.summary || "").trim().slice(0, 240);
  }
  if (error?.hasRawAiDebug === true || String(error?.debugId || "").trim()) {
    responseBody.hasRawAiDebug = true;
    responseBody.debugId = String(error?.debugId || "").trim();
    if (error?.rawAiDebug && typeof error.rawAiDebug === "object") {
      responseBody.rawAiDebug = error.rawAiDebug;
    }
  }
  if (error?.debugRawJson && typeof error.debugRawJson === "object") {
    responseBody.hasDebugRawJson = true;
    responseBody.debugRawJson = error.debugRawJson;
  }
  return responseBody;
}

function buildHealthPayload() {
  const payload = createHealthPayload();
  payload.dedupe = getInFlightDedupeHealth();
  payload.omniLegacyFastPath = isOmniLegacyFastPathEnabled();
  payload.qwenSmoothEnabled = isQwenSmoothEnabled();
  payload.omniLegacyCommit = LEGACY_OMNI_COMMIT;
  payload.notes = Object.assign({}, payload.notes || {}, {
    defaultResultMode: "async-job-default",
    asyncJobsDefaultEnabled: true,
    requestStaggerMs: 50,
    inflightDedupe: "enabled-when-batchRunId-and-batchProcessKey-present",
    omniLegacyFastPath: isOmniLegacyFastPathEnabled(),
    qwenSmoothEnabled: isQwenSmoothEnabled(),
    omniLegacyCommit: LEGACY_OMNI_COMMIT,
  });
  return payload;
}

function buildJobStatusBody(jobLike) {
  const job = jobLike && typeof jobLike === "object" ? jobLike : {};
  return {
    success: true,
    jobId: String(job.jobId || ""),
    requestId: String(job.requestId || ""),
    status: String(job.status || "pending"),
    createdAt: normalizeNullableInteger(job.createdAt),
    updatedAt: normalizeNullableInteger(job.updatedAt),
    startedAt: normalizeNullableInteger(job.startedAt),
    finishedAt: normalizeNullableInteger(job.finishedAt),
    itemId: String(job.itemId || ""),
    textId: String(job.textId || ""),
    sentenceNumber: normalizeNullableInteger(job.sentenceNumber),
    hasDebugRawJson: job.hasDebugRawJson === true,
    providerStatus: normalizeNullableInteger(job.providerStatus),
    runtime: job.runtime && typeof job.runtime === "object" ? job.runtime : null,
    data: job.status === "succeeded" ? job.result || null : null,
    error:
      job.status === "failed"
        ? {
            code: String(job.errorCode || ""),
            message: String(job.errorMessage || "任务执行失败。"),
            providerStatus: normalizeNullableInteger(job.providerStatus),
          }
        : null,
  };
}

async function executeRecommendWithOptionalDedupe(requestBody, normalizedRequest, requestId, runtimeOptions) {
  const source = normalizedRequest && typeof normalizedRequest === "object"
    ? normalizedRequest
    : normalizeRecommendRequest(requestBody || {});
  return runWithInFlightDedupe(
    {
      batchRunId: source.batchRunId,
      batchProcessKey: source.batchProcessKey,
      recognitionMode: source.recognitionMode || source.pipelineMode,
      listenModel: source.listenModel || source.aiOptions?.listenModel,
      compareModel: source.compareModel || source.aiOptions?.compareModel,
      singleModel: source.singleModel || source.aiOptions?.singleModel,
    },
    function () {
      return recommend(requestBody || {}, requestId, runtimeOptions || {});
    },
    function (dedupeInfo) {
      console.info("[DataBaker][ai][dedupe] join inflight", {
        requestId,
        batchRunId: String(source.batchRunId || ""),
        batchProcessKey: String(source.batchProcessKey || ""),
        dedupeKeyShort: String(dedupeInfo?.keyShort || ""),
      });
    }
  );
}

async function executeRecommendWithRouting(requestBody, normalizedRequest, requestId, runtimeOptions) {
  const source = normalizedRequest && typeof normalizedRequest === "object"
    ? normalizedRequest
    : normalizeRecommendRequest(requestBody || {});
  if (shouldUseLegacyOmniFastPath(source)) {
    const value = await recommendLegacyOmni(requestBody || {}, requestId, runtimeOptions || {});
    return {
      value,
      dedupeEnabled: false,
      joined: false,
      joinedInflight: false,
      dedupeKeyShort: "",
      legacyOmniFastPath: true,
    };
  }
  const result = await executeRecommendWithOptionalDedupe(
    requestBody || {},
    source,
    requestId,
    runtimeOptions || {}
  );
  return Object.assign({}, result || {}, {
    legacyOmniFastPath: false,
  });
}

const handleRecommend = createAiRoute(dataBakerRoundOneAdapter, {
  run(context) {
    const normalizedRequest =
      context?.normalizedRequest?.runtimeContext?.normalizedRecommendRequest ||
      normalizeRecommendRequest(context?.runtimeContext?.rawBody || {});

    console.info("[DataBaker][round-one-quality][ai] recommend start", {
      requestId: String(context?.normalizedRequest?.requestId || ""),
      itemId: String(normalizedRequest.itemId || ""),
      textId: String(normalizedRequest.textId || ""),
      sentenceNumber: normalizeNullableInteger(normalizedRequest.sentenceNumber),
      recognitionMode: String(normalizedRequest.recognitionMode || ""),
      pipelineMode: String(normalizedRequest.pipelineMode || ""),
      batchRunId: String(normalizedRequest.batchRunId || ""),
      batchItemIndex: normalizeNullableInteger(normalizedRequest.batchItemIndex),
      batchProcessKey: String(normalizedRequest.batchProcessKey || ""),
      clientRequestId: String(normalizedRequest.clientRequestId || ""),
    });

    return executeRecommendWithRouting(
      context?.runtimeContext?.rawBody || {},
      normalizedRequest,
      String(context?.normalizedRequest?.requestId || ""),
      {}
    );
  },
  createSuccessBody(context) {
    return dataBakerRoundOneAdapter.buildRecommendSuccessBody(context);
  },
  createErrorBody(context) {
    return dataBakerRoundOneAdapter.buildRecommendErrorBody(context);
  },
});

async function runRecommendJob(jobId, requestBody, requestId) {
  let normalizedRequest = null;
  try {
    normalizedRequest = normalizeRecommendRequest(requestBody || {});
    markAiRecommendJobRunning(jobId);
    const signal = getAiRecommendJobSignal(jobId);
    const dedupeResult = await executeRecommendWithRouting(
      requestBody || {},
      normalizedRequest,
      requestId,
      {
        signal,
        jobId,
        createdAt: new Date().toISOString(),
      }
    );
    const result = dedupeResult?.value || dedupeResult;
    markAiRecommendJobSucceeded(jobId, {
      result,
      providerStatus: normalizeNullableInteger(result?.providerStatus) || 200,
      runtime: result?.runtime || null,
    });
  } catch (error) {
    markAiRecommendJobFailed(jobId, {
      code: String(error?.code || "ai-recommend-job-failed"),
      message: String(error?.safeMessage || error?.message || "DataBaker AI recommend 失败。"),
      providerStatus: normalizeNullableInteger(error?.providerStatus || error?.statusCode),
      runtime: error?.runtime || null,
      debugRawJson: error?.debugRawJson || null,
    });
  }
}

async function handleCreateRecommendJob(request, response) {
  let requestId = createRequestId();
  try {
    const rawBody = await readRequestBody(request);
    let body = {};
    try {
      body = JSON.parse(rawBody || "{}");
    } catch (error) {
      throw createHttpError(400, "请求体 JSON 解析失败。", "invalid-json");
    }
    requestId = String(body.requestId || requestId);
    assertAiUsageOperatorName(body);
    const normalizedRequest = normalizeRecommendRequest(body);
    const job = createAiRecommendJob({
      requestId,
      itemId: normalizedRequest.itemId,
      textId: normalizedRequest.textId,
      sentenceNumber: normalizedRequest.sentenceNumber,
    });
    sendJson(response, 202, buildJobStatusBody(job));
    Promise.resolve().then(function () {
      return runRecommendJob(job.jobId, body, requestId);
    });
  } catch (error) {
    const statusCode = Math.max(400, Number(error?.statusCode) || 500);
    error.requestId = String(error?.requestId || requestId || "");
    sendJson(response, statusCode, buildErrorResponseBody(error, "创建 AI recommend 异步任务失败。"));
  }
}

function handleGetRecommendJobStatus(_request, response, jobId) {
  try {
    const job = getAiRecommendJob(jobId);
    sendJson(response, 200, buildJobStatusBody(job));
  } catch (error) {
    const statusCode = Math.max(400, Number(error?.statusCode) || 500);
    sendJson(response, statusCode, buildErrorResponseBody(error, "查询 AI recommend 任务状态失败。"));
  }
}

function handleGetRecommendJobDebug(_request, response, jobId) {
  try {
    const debug = getAiRecommendJobDebug(jobId);
    sendJson(response, 200, {
      success: true,
      jobId: String(jobId || ""),
      debug,
    });
  } catch (error) {
    const statusCode = Math.max(400, Number(error?.statusCode) || 500);
    sendJson(response, statusCode, buildErrorResponseBody(error, "查询 AI recommend 调试信息失败。"));
  }
}

function handleGetRecommendDebug(_request, response, debugId) {
  try {
    const debug = getAiDebug(debugId);
    sendJson(response, 200, {
      success: true,
      debug,
    });
  } catch (error) {
    const statusCode = Math.max(400, Number(error?.statusCode) || 500);
    sendJson(response, statusCode, {
      success: false,
      code: String(error?.code || "ai-debug-not-found"),
      message: String(error?.message || "原始 AI 返回不存在或已过期。"),
    });
  }
}

function registerAiRoutes(router) {
  router.get(AI_HEALTH_PATH, function ({ response }) {
    sendJson(response, 200, buildHealthPayload());
  });
  router.get(AI_DEFAULTS_PATH, function ({ response }) {
    const payload = createDefaultsPayload();
    payload.omniLegacyFastPath = isOmniLegacyFastPathEnabled();
    payload.qwenSmoothEnabled = isQwenSmoothEnabled();
    payload.omniLegacyCommit = LEGACY_OMNI_COMMIT;
    payload.notes = Object.assign({}, payload.notes || {}, {
      omniLegacyFastPath: isOmniLegacyFastPathEnabled(),
      qwenSmoothEnabled: isQwenSmoothEnabled(),
      omniLegacyCommit: LEGACY_OMNI_COMMIT,
    });
    sendJson(response, 200, payload);
  });
  router.post(AI_BASE_PATH, function ({ request, response }) {
    return handleRecommend(request, response);
  });
  router.get(AI_LOG_SUMMARY_PATH, function ({ response, query }) {
    sendJson(
      response,
      200,
      buildAiCallLogSummaryPayload({
        service: "data-baker-round-one-quality-ai-recommend",
        scriptId: "dataBakerRoundOneQuality",
        logger: aiCallLogger,
        query,
      })
    );
  });
  router.get(AI_DEBUG_PATH, function ({ response, params }) {
    return handleGetRecommendDebug(null, response, params?.debugId);
  });
  router.post(AI_JOBS_PATH, function ({ request, response }) {
    return handleCreateRecommendJob(request, response);
  });
  router.get(AI_JOB_DEBUG_PATH, function ({ response, params }) {
    return handleGetRecommendJobDebug(null, response, params?.jobId);
  });
  router.get(AI_JOB_DETAIL_PATH, function ({ response, params }) {
    return handleGetRecommendJobStatus(null, response, params?.jobId);
  });
}

module.exports = {
  AI_BASE_PATH,
  AI_DEBUG_PATH,
  AI_DEFAULTS_PATH,
  AI_HEALTH_PATH,
  AI_LOG_SUMMARY_PATH,
  AI_JOBS_PATH,
  AI_JOB_DEBUG_PATH,
  AI_JOB_DETAIL_PATH,
  buildHealthPayload,
  buildJobStatusBody,
  handleCreateRecommendJob,
  handleGetRecommendDebug,
  handleGetRecommendJobDebug,
  handleGetRecommendJobStatus,
  handleRecommend,
  registerAiRoutes,
};

"use strict";

const crypto = require("crypto");
const { assertAiUsageOperatorName } = require("../../../backend/ai-call-log");
const { buildJobStatusBody } = require("../../../backend/ai-framework/core/create-ai-job-routes");
const { sharedAiJobStore } = require("../../../backend/ai-framework/runtime/ai-job-store");
const { sendJson: defaultSendJson } = require("../../../backend/response");
const {
  buildRecommendCacheKey: defaultBuildRecommendCacheKey,
  getCachedRecommendResult: defaultGetCachedRecommendResult,
  setCachedRecommendResult: defaultSetCachedRecommendResult,
} = require("./cache");
const { parseTimeoutMs: defaultParseTimeoutMs } = require("./config");
const { normalizeLifecycleAbort: defaultNormalizeLifecycleAbort } = require("./errors");
const { sanitizePublicPayload: defaultSanitizePublicPayload } = require("./redaction");
const { createRecommendPipeline: defaultCreateRecommendPipeline } = require("./pipeline");
const {
  buildRecommendErrorBody: defaultBuildRecommendErrorBody,
  buildRecommendSuccessBody: defaultBuildRecommendSuccessBody,
  createDefaultsPayload: defaultCreateDefaultsPayload,
  createHealthPayload: defaultCreateHealthPayload,
  normalizeRecommendRequest: defaultNormalizeRecommendRequest,
} = require("./ai-service");

const AI_BASE_PATH = "/api/aishell-tech/english-transcription-helper/ai/recommend";
const AI_HEALTH_PATH = AI_BASE_PATH + "/health";
const AI_DEFAULTS_PATH = AI_BASE_PATH + "/defaults";
const AI_JOBS_PATH = AI_BASE_PATH + "/jobs";
const AI_JOB_DETAIL_PATH = AI_JOBS_PATH + "/:jobId";
const AI_JOB_DEBUG_PATH = AI_JOB_DETAIL_PATH + "/debug";
const AI_JOB_CANCEL_PATH = AI_JOB_DETAIL_PATH + "/cancel";
const MAX_BODY_BYTES = 3 * 1024 * 1024;
const ENGLISH_TRANSCRIPTION_JOB_LIFECYCLE_TIMEOUT_MS = 60000;

function createRequestId() {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString("hex");
}

function normalizeText(value) {
  return String(value || "").trim();
}

function createHttpError(statusCode, message, code) {
  const error = new Error(String(message || "Request failed."));
  error.statusCode = Number(statusCode) || 500;
  error.code = String(code || "request-failed");
  return error;
}

function readRequestBody(request, signal, normalizeLifecycleAbort) {
  return new Promise(function (resolve, reject) {
    if (signal?.aborted === true) {
      reject(normalizeLifecycleAbort(signal.reason, { stage: "queue" }));
      return;
    }
    let body = "";
    const cleanup = function () {
      request.off("data", onData);
      request.off("end", onEnd);
      request.off("error", onError);
      signal?.removeEventListener?.("abort", onAbort);
    };
    const onAbort = function () {
      cleanup();
      reject(normalizeLifecycleAbort(signal.reason, { stage: "queue" }));
      try { request.resume(); } catch (_error) {}
    };
    const onData = function (chunk) {
      body += chunk;
      if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) {
        cleanup();
        reject(createHttpError(413, "Request body exceeds 3 MB.", "payload-too-large"));
        try { request.resume(); } catch (_error) {}
      }
    };
    const onEnd = function () {
      cleanup();
      resolve(body);
    };
    const onError = function (error) {
      cleanup();
      reject(error);
    };
    request.on("data", onData);
    request.on("end", onEnd);
    request.on("error", onError);
    signal?.addEventListener?.("abort", onAbort, { once: true });
  });
}

function parseRequestBody(rawBody) {
  try {
    return JSON.parse(rawBody || "{}");
  } catch (_error) {
    throw createHttpError(400, "Request body is not valid JSON.", "invalid-json");
  }
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value === undefined ? null : value));
}

function normalizeDebugKey(key) {
  return normalizeText(key).toLowerCase().replace(/[_-]/g, "");
}

function isSensitiveDebugKey(key) {
  return /(?:authorization|cookie|token|api[_-]?key|secret|password|signature)/i.test(
    normalizeDebugKey(key)
  );
}

function isLikelyBase64Payload(value) {
  const text = normalizeText(value);
  return (
    text.length >= 48 &&
    text.length % 4 === 0 &&
    /^[a-z0-9+/]+={0,2}$/i.test(text)
  );
}

function sanitizeDebugPayload(value, depth) {
  return defaultSanitizePublicPayload(value, depth);
}

function buildCachedSuccessResult(result, requestId) {
  const cached = cloneJson(result || {});
  const sourceRequestId = normalizeText(cached?.meta?.requestId);
  cached.meta = Object.assign({}, cached.meta || {}, {
    requestId,
    stage: normalizeText(cached?.meta?.stage) || "complete",
    cache: { hit: true, sourceRequestId },
  });
  return cached;
}

function buildJobLifetimeTimeoutErrorBody(job) {
  return {
    success: false,
    error: {
      code: "ai-job-timeout",
      message: "The English transcription job was cancelled after 60 seconds.",
      stage: "queue",
      retryable: true,
      providerStatus: 0,
      providerCode: "",
    },
    meta: { requestId: normalizeText(job?.requestId), stage: "queue", timedOut: true },
  };
}

function createLifecycleController(request, response, timeoutMs, requestId, normalizeLifecycleAbort) {
  const controller = new AbortController();
  let finished = false;
  const abort = function (reason) {
    if (!finished && controller.signal.aborted !== true) {
      controller.abort(normalizeLifecycleAbort(reason, { requestId, stage: "queue" }));
    }
  };
  const timer = setTimeout(function () {
    abort({ code: "aborted", statusCode: 504, message: "The synchronous request exceeded 60 seconds." });
  }, timeoutMs);
  const onClose = function () {
    if (response.writableEnded !== true) {
      abort({ code: "client-disconnected", statusCode: 499, message: "The client connection closed." });
    }
  };
  request.on("aborted", onClose);
  response.on("close", onClose);
  return {
    signal: controller.signal,
    cleanup: function () {
      finished = true;
      clearTimeout(timer);
      request.off("aborted", onClose);
      response.off("close", onClose);
    },
  };
}

function createRecommendRouteRuntime(overrides) {
  const deps = Object.assign(
    {
      buildRecommendCacheKey: defaultBuildRecommendCacheKey,
      buildRecommendErrorBody: defaultBuildRecommendErrorBody,
      buildRecommendSuccessBody: defaultBuildRecommendSuccessBody,
      createDefaultsPayload: defaultCreateDefaultsPayload,
      createHealthPayload: defaultCreateHealthPayload,
      createRecommendPipeline: defaultCreateRecommendPipeline,
      getCachedRecommendResult: defaultGetCachedRecommendResult,
      jobStore: sharedAiJobStore,
      normalizeLifecycleAbort: defaultNormalizeLifecycleAbort,
      normalizeRecommendRequest: defaultNormalizeRecommendRequest,
      parseTimeoutMs: defaultParseTimeoutMs,
      sanitizePublicPayload: defaultSanitizePublicPayload,
      sendJson: defaultSendJson,
      setCachedRecommendResult: defaultSetCachedRecommendResult,
      setTimeout,
      clearTimeout,
    },
    overrides || {}
  );
  const pipeline = deps.pipeline?.run ? deps.pipeline : deps.createRecommendPipeline();


  function sanitizePublicJobText(value) {
    const sanitized = deps.sanitizePublicPayload(normalizeText(value));
    return typeof sanitized === "string" ? sanitized : "[redacted-serialized-value]";
  }
  function buildPublicJobStatusBody(job) {
    const result = Object.assign({}, buildJobStatusBody(job));
    ["jobId", "requestId", "routeKey", "status", "itemId", "textId"].forEach(function (key) {
      result[key] = sanitizePublicJobText(result[key]);
    });
    if (result.data && typeof result.data === "object") {
      result.data = deps.buildRecommendSuccessBody(result.data);
    }
    if (result.error && typeof result.error === "object") {
      const rawErrorBody = result.error;
      let error = rawErrorBody.error && typeof rawErrorBody.error === "object"
        ? Object.assign({}, rawErrorBody.error)
        : Object.assign({}, rawErrorBody);
      if (rawErrorBody.meta && typeof rawErrorBody.meta === "object") {
        error = Object.assign({}, error, { meta: rawErrorBody.meta });
      }
      result.error = deps.buildRecommendErrorBody({ error });
    }
    return result;
  }

  async function executeRecommend(rawBody, runtime) {
    const context = runtime && typeof runtime === "object" ? runtime : {};
    assertAiUsageOperatorName(rawBody);
    const request = context.normalizedRequest && typeof context.normalizedRequest === "object"
      ? context.normalizedRequest
      : deps.normalizeRecommendRequest(rawBody);
    const requestId = normalizeText(context.requestId || rawBody.requestId) || createRequestId();
    const cacheKey = deps.buildRecommendCacheKey(request);
    const cached = deps.getCachedRecommendResult(cacheKey);
    if (cached) {
      return { cacheKey, result: buildCachedSuccessResult(cached, requestId), fromCache: true };
    }
    const result = await pipeline.run(request, {
      requestId,
      timeoutMs: Math.min(60000, Math.max(1000, Number(context.timeoutMs) || 60000)),
      signal: context.signal || null,
      startedAtMs: Date.now(),
    });
    return { cacheKey, result, fromCache: false };
  }

  async function handleRecommend(routeContext) {
    const context = routeContext || {};
    const timeoutMs = deps.parseTimeoutMs();
    let requestId = createRequestId();
    const lifecycle = createLifecycleController(
      context.request,
      context.response,
      timeoutMs,
      requestId,
      deps.normalizeLifecycleAbort
    );
    try {
      const body = parseRequestBody(
        await readRequestBody(context.request, lifecycle.signal, deps.normalizeLifecycleAbort)
      );
      requestId = normalizeText(body.requestId) || requestId;
      const execution = await executeRecommend(body, { requestId, timeoutMs, signal: lifecycle.signal });
      deps.sendJson(context.response, 200, deps.buildRecommendSuccessBody(execution.result));
      if (!execution.fromCache && lifecycle.signal.aborted !== true && context.response.writableEnded === true) {
        deps.setCachedRecommendResult(execution.cacheKey, execution.result);
      }
    } catch (error) {
      error.requestId = normalizeText(error.requestId || requestId);
      if (context.response.destroyed !== true) {
        const statusCode = Math.max(400, Number(error.statusCode || error.providerStatus || 500));
        deps.sendJson(
          context.response,
          statusCode,
          deps.buildRecommendErrorBody({ error }),
          statusCode === 504 ? { Connection: "close" } : undefined
        );
      }
    } finally {
      lifecycle.cleanup();
    }
  }

  async function handleCreateRecommendJob(routeContext) {
    const context = routeContext || {};
    let requestId = "";
    try {
      const body = parseRequestBody(await readRequestBody(context.request));
      assertAiUsageOperatorName(body);
      requestId = normalizeText(body.requestId) || createRequestId();
      const normalizedRequest = deps.normalizeRecommendRequest(body);
      const job = deps.jobStore.createJob({
        requestId,
        routeKey: AI_BASE_PATH,
        itemId: normalizeText(body.taskItemId || body.itemId),
        textId: normalizeText(body.taskId || body.packageId),
      });
      const lifecycleTimer = deps.setTimeout(function () {
        try {
          deps.jobStore.cancelJob(job.jobId, { errorBody: buildJobLifetimeTimeoutErrorBody(job) });
        } catch (_error) {}
      }, ENGLISH_TRANSCRIPTION_JOB_LIFECYCLE_TIMEOUT_MS);
      deps.sendJson(context.response, 202, buildPublicJobStatusBody(job));
      Promise.resolve().then(async function () {
        try {
          deps.jobStore.markJobRunning(job.jobId);
          const execution = await executeRecommend(body, {
            requestId,
            timeoutMs: 60000,
            signal: deps.jobStore.getJobSignal(job.jobId),
            normalizedRequest,
          });
          const completion = deps.jobStore.markJobSucceeded(job.jobId, {
            responseBody: deps.buildRecommendSuccessBody(execution.result),
          });
          if (!execution.fromCache && completion?.ignored !== true) {
            deps.setCachedRecommendResult(execution.cacheKey, execution.result);
          }
        } catch (error) {
          deps.jobStore.markJobFailed(job.jobId, {
            errorBody: deps.buildRecommendErrorBody({ error: Object.assign(error, { requestId }) }),
            debugPayload: sanitizeDebugPayload(
              error?.meta?.providerDebug ||
                error?.debugRawAiResponse ||
                error?.debugRawJson ||
                error?.rawResponse ||
                null
            ),
          });
        } finally {
          deps.clearTimeout(lifecycleTimer);
        }
      }).catch(function () {});
    } catch (error) {
      deps.sendJson(
        context.response,
        Math.max(400, Number(error.statusCode || 500)),
        deps.buildRecommendErrorBody({ error: Object.assign(error, { requestId }) })
      );
    }
  }

  function handleGetRecommendJobStatus(routeContext) {
    try {
      deps.sendJson(
        routeContext.response,
        200,
        buildPublicJobStatusBody(deps.jobStore.getJob(routeContext?.params?.jobId))
      );
    } catch (error) {
      deps.sendJson(
        routeContext.response,
        Math.max(400, Number(error.statusCode || 500)),
        deps.buildRecommendErrorBody({ error })
      );
    }
  }

  function handleGetRecommendJobDebug(routeContext) {
    try {
      deps.sendJson(routeContext.response, 200, {
        success: true,
        jobId: normalizeText(routeContext?.params?.jobId),
        debug: sanitizeDebugPayload(deps.jobStore.getJobDebug(routeContext?.params?.jobId)),
      });
    } catch (error) {
      deps.sendJson(
        routeContext.response,
        Math.max(400, Number(error.statusCode || 500)),
        deps.buildRecommendErrorBody({ error })
      );
    }
  }

  function handleCancelRecommendJob(routeContext) {
    try {
      deps.sendJson(
        routeContext.response,
        200,
        buildPublicJobStatusBody(deps.jobStore.cancelJob(routeContext?.params?.jobId))
      );
    } catch (error) {
      deps.sendJson(
        routeContext.response,
        Math.max(400, Number(error.statusCode || 500)),
        deps.buildRecommendErrorBody({ error })
      );
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
    router.post(AI_JOBS_PATH, handleCreateRecommendJob);
    router.post(AI_JOB_CANCEL_PATH, handleCancelRecommendJob);
    router.get(AI_JOB_DETAIL_PATH, handleGetRecommendJobStatus);
    router.get(AI_JOB_DEBUG_PATH, handleGetRecommendJobDebug);
  }

  return {
    handleCreateRecommendJob,
    handleCancelRecommendJob,
    handleGetRecommendJobDebug,
    handleGetRecommendJobStatus,
    handleRecommend,
    registerAiRoutes,
  };
}

const defaultRouteRuntime = createRecommendRouteRuntime();

module.exports = {
  AI_BASE_PATH,
  AI_DEFAULTS_PATH,
  AI_HEALTH_PATH,
  AI_JOB_DEBUG_PATH,
  AI_JOB_CANCEL_PATH,
  AI_JOB_DETAIL_PATH,
  AI_JOBS_PATH,
  ENGLISH_TRANSCRIPTION_JOB_LIFECYCLE_TIMEOUT_MS,
  createRecommendRouteRuntime,
  handleCreateRecommendJob: defaultRouteRuntime.handleCreateRecommendJob,
  handleCancelRecommendJob: defaultRouteRuntime.handleCancelRecommendJob,
  handleGetRecommendJobDebug: defaultRouteRuntime.handleGetRecommendJobDebug,
  handleGetRecommendJobStatus: defaultRouteRuntime.handleGetRecommendJobStatus,
  handleRecommend: defaultRouteRuntime.handleRecommend,
  registerAiRoutes: defaultRouteRuntime.registerAiRoutes,
  sanitizeDebugPayload,
};

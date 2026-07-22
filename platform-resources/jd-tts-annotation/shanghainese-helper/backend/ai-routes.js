"use strict";

const crypto = require("crypto");
const { sendJson } = require("../../../backend/response");
const { buildJobStatusBody } = require("../../../backend/ai-framework/core/create-ai-job-routes");
const { sharedAiJobStore } = require("../../../backend/ai-framework/runtime/ai-job-store");
const { buildRecommendCacheKey, getCachedRecommendResult, setCachedRecommendResult } = require("./cache");
const { createRecommendPipeline } = require("./pipeline");
const { aiCallLogger } = require("../data/ai-call-log");
const {
  buildRecommendErrorBody,
  buildRecommendSuccessBody,
  createDefaultsPayload,
  createHealthPayload,
  normalizeRecommendRequest,
} = require("./ai-service");

const AI_BASE_PATH = "/api/jd-tts-annotation/shanghainese-helper/ai/recommend";
const MAX_BODY_BYTES = 3 * 1024 * 1024;
const JOB_TIMEOUT_MS = 60000;

function normalizeText(value) {
  return String(value || "").trim();
}

function createRequestId() {
  return typeof crypto.randomUUID === "function" ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex");
}

function createHttpError(statusCode, message, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function readRequestBody(request) {
  return new Promise(function (resolve, reject) {
    let body = "";
    request.on("data", function (chunk) {
      body += chunk;
      if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) {
        request.resume();
        reject(createHttpError(413, "请求体超过 3MB。", "payload-too-large"));
      }
    });
    request.once("end", function () { resolve(body); });
    request.once("error", reject);
  });
}

function parseRequestBody(rawBody) {
  try {
    return JSON.parse(rawBody || "{}");
  } catch (_error) {
    throw createHttpError(400, "请求体 JSON 解析失败。", "invalid-json");
  }
}

function readCappedRequestBody(request) {
  return new Promise(function (resolve, reject) {
    let body = "";
    let size = 0;
    let settled = false;
    function cleanup() {
      request.removeListener("data", onData);
      request.removeListener("end", onEnd);
      request.removeListener("error", onError);
    }
    function finish(callback, value) {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      callback(value);
    }
    function onData(chunk) {
      const chunkSize = Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(String(chunk), "utf8");
      size += chunkSize;
      if (size > MAX_BODY_BYTES) {
        if (typeof request.resume === "function") {
          request.resume();
        }
        finish(reject, createHttpError(413, "request body exceeds 3MB", "payload-too-large"));
        return;
      }
      body += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
    }
    function onEnd() { finish(resolve, body); }
    function onError(error) { finish(reject, error); }
    request.on("data", onData);
    request.once("end", onEnd);
    request.once("error", onError);
  });
}

function sanitizeDebugPayload(value, depth) {
  const level = Number(depth || 0);
  if (level > 8) {
    return "[truncated]";
  }
  if (Array.isArray(value)) {
    return value.slice(0, 50).map(function (entry) { return sanitizeDebugPayload(entry, level + 1); });
  }
  if (value && typeof value === "object") {
    const result = {};
    Object.keys(value).slice(0, 100).forEach(function (key) {
      if (/(?:audio(?:data|source)?url|url|authorization|cookie|token|api[_-]?key|secret|signature|password)/i.test(key)) {
        result[key] = "[redacted]";
      } else {
        result[key] = sanitizeDebugPayload(value[key], level + 1);
      }
    });
    return result;
  }
  if (typeof value === "string") {
    if (/data:audio\/|https?:\/\/|(?:bearer\s+|cookie=|signature=|authorization=)/i.test(value)) {
      return "[redacted]";
    }
    return value.length > 20000 ? value.slice(0, 20000) + "…" : value;
  }
  return value;
}

function createRecommendRouteRuntime(overrides) {
  const deps = Object.assign({
    sendJson,
    jobStore: sharedAiJobStore,
    pipeline: createRecommendPipeline(),
    normalizeRecommendRequest,
    buildRecommendSuccessBody,
    buildRecommendErrorBody,
    buildRecommendCacheKey,
    getCachedRecommendResult,
    setCachedRecommendResult,
    setTimeout,
    clearTimeout,
    aiCallLogger,
  }, overrides || {});

  function sendFailure(response, error, requestId) {
    const body = deps.buildRecommendErrorBody({ error: Object.assign({}, error, { meta: { requestId: normalizeText(requestId) } }) });
    deps.sendJson(response, Math.max(400, Number(error?.statusCode) || 500), body);
  }

  async function execute(request, context) {
    const cacheKey = deps.buildRecommendCacheKey(request);
    const cached = deps.getCachedRecommendResult(cacheKey);
    if (cached) {
      cached.meta = Object.assign({}, cached.meta || {}, { requestId: context.requestId, cache: { hit: true, sourceRequestId: normalizeText(cached?.meta?.requestId) } });
      return cached;
    }
    const result = await deps.pipeline.run(request, context);
    const safeResult = {
      data: result.data,
      meta: Object.assign({}, result.meta || {}, { requestId: context.requestId, cache: { hit: false, sourceRequestId: "" } }),
    };
    deps.setCachedRecommendResult(cacheKey, safeResult);
    return safeResult;
  }

  function appendLog(payload) {
    if (deps.aiCallLogger && typeof deps.aiCallLogger.appendSafe === "function") {
      deps.aiCallLogger.appendSafe(payload);
    }
  }

  function buildSafeLogError(error) {
    return {
      code: normalizeText(error?.code) || "request-error",
      stage: normalizeText(error?.stage) || "recognize",
      statusCode: Number(error?.statusCode || 0) || 0,
      providerStatus: Number(error?.providerStatus || 0) || 0,
      retryable: error?.retryable === true,
      safeMessage: "上海话识别请求失败。",
    };
  }

  async function parseAndNormalize(request) {
    const parsed = parseRequestBody(await readCappedRequestBody(request));
    return { parsed, normalized: deps.normalizeRecommendRequest(parsed) };
  }

  async function handleHealth(context) {
    deps.sendJson(context.response, 200, createHealthPayload());
  }

  async function handleDefaults(context) {
    deps.sendJson(context.response, 200, createDefaultsPayload());
  }

  async function handleRecommend(context) {
    let requestId = "";
    try {
      const parsed = await parseAndNormalize(context.request);
      requestId = parsed.normalized.requestId || createRequestId();
      const result = await execute(parsed.normalized, { requestId, signal: null, timeoutMs: JOB_TIMEOUT_MS });
      appendLog({ createdAt: new Date().toISOString(), requestId, normalizedRequest: parsed.normalized, result });
      deps.sendJson(context.response, 200, deps.buildRecommendSuccessBody(result));
    } catch (error) {
      appendLog({ createdAt: new Date().toISOString(), requestId, error: buildSafeLogError(error) });
      sendFailure(context.response, error, requestId);
    }
  }

  async function handleCreateRecommendJob(context) {
    let requestId = "";
    try {
      const parsed = await parseAndNormalize(context.request);
      requestId = parsed.normalized.requestId || createRequestId();
      const job = deps.jobStore.createJob({ requestId, routeKey: AI_BASE_PATH, itemId: parsed.normalized.utteranceId, textId: parsed.normalized.checksum });
      deps.sendJson(context.response, 202, buildJobStatusBody(job));
      const timer = deps.setTimeout(function () {
        try {
          deps.jobStore.cancelJob(job.jobId, { stage: "queue", errorBody: { success: false, error: { code: "ai-job-timeout", message: "当前任务从创建起超过 60 秒，已取消。", stage: "queue", retryable: true } } });
        } catch (_error) {}
      }, JOB_TIMEOUT_MS);
      Promise.resolve().then(async function () {
        try {
          deps.jobStore.markJobRunning(job.jobId);
          const result = await execute(parsed.normalized, { requestId, signal: deps.jobStore.getJobSignal(job.jobId), timeoutMs: JOB_TIMEOUT_MS });
          const responseBody = deps.buildRecommendSuccessBody(result);
          deps.jobStore.markJobSucceeded(job.jobId, { responseBody });
          appendLog({ createdAt: new Date().toISOString(), requestId, normalizedRequest: parsed.normalized, result });
        } catch (error) {
          const errorBody = deps.buildRecommendErrorBody({ error: Object.assign({}, error, { meta: { requestId } }) });
          deps.jobStore.markJobFailed(job.jobId, { errorBody, debugPayload: sanitizeDebugPayload(error?.debugRawAiResponse || error?.rawAiDebug || error?.meta || {}) });
          appendLog({ createdAt: new Date().toISOString(), requestId, error: buildSafeLogError(error) });
        } finally {
          deps.clearTimeout(timer);
        }
      }).catch(function () {});
    } catch (error) {
      sendFailure(context.response, error, requestId);
    }
  }

  async function handleGetRecommendJobStatus(context) {
    try {
      deps.sendJson(context.response, 200, buildJobStatusBody(deps.jobStore.getJob(context.params?.jobId)));
    } catch (error) {
      sendFailure(context.response, error, "");
    }
  }

  async function handleGetRecommendJobDebug(context) {
    try {
      deps.sendJson(context.response, 200, { success: true, jobId: normalizeText(context.params?.jobId), debug: sanitizeDebugPayload(deps.jobStore.getJobDebug(context.params?.jobId)) });
    } catch (error) {
      sendFailure(context.response, error, "");
    }
  }

  async function handleCancelRecommendJob(context) {
    try {
      const job = deps.jobStore.cancelJob(context.params?.jobId, { stage: "queue", errorBody: { success: false, error: { code: "aborted", message: "任务已取消。", stage: "queue", retryable: false } } });
      deps.sendJson(context.response, 200, buildJobStatusBody(job));
    } catch (error) {
      sendFailure(context.response, error, "");
    }
  }

  function registerAiRoutes(router) {
    router.get(AI_BASE_PATH + "/health", handleHealth);
    router.get(AI_BASE_PATH + "/defaults", handleDefaults);
    router.post(AI_BASE_PATH, handleCreateRecommendJob);
    router.post(AI_BASE_PATH + "/jobs", handleCreateRecommendJob);
    router.get(AI_BASE_PATH + "/jobs/:jobId", handleGetRecommendJobStatus);
    router.get(AI_BASE_PATH + "/jobs/:jobId/debug", handleGetRecommendJobDebug);
    router.post(AI_BASE_PATH + "/jobs/:jobId/cancel", handleCancelRecommendJob);
  }

  return { registerAiRoutes, handleRecommend, handleCreateRecommendJob, handleGetRecommendJobStatus, handleGetRecommendJobDebug, handleCancelRecommendJob };
}

function registerAiRoutes(router, options) {
  createRecommendRouteRuntime(options).registerAiRoutes(router);
}

module.exports = { AI_BASE_PATH, createRecommendRouteRuntime, registerAiRoutes, sanitizeDebugPayload };

"use strict";

const {
  isProviderRateLimitedError,
  normalizeAbortError,
} = require("../../../backend/ai/errors");

function normalizeText(value) {
  return String(value || "").trim();
}

function cloneMeta(meta) {
  return meta && typeof meta === "object" ? JSON.parse(JSON.stringify(meta)) : {};
}

function extractErrorSource(errorLike) {
  if (errorLike instanceof Error) {
    return errorLike;
  }
  if (errorLike && typeof errorLike === "object") {
    const source = errorLike;
    const nestedError = source.error && typeof source.error === "object" ? source.error : {};
    const error = new Error(
      normalizeText(
        source.message ||
          nestedError.message ||
          source.summary ||
          source.providerMessage ||
          source.responseBody?.message ||
          source.body?.message
      ) || "请求失败。"
    );
    error.code = normalizeText(source.code || nestedError.code) || "aishell-ai-request-failed";
    error.statusCode =
      Number(
        source.statusCode ||
          source.providerStatus ||
          source.status ||
          nestedError.statusCode ||
          nestedError.providerStatus ||
          nestedError.status
      ) || 500;
    error.providerStatus =
      Number(
        source.providerStatus ||
          source.statusCode ||
          source.status ||
          nestedError.providerStatus ||
          nestedError.statusCode ||
          nestedError.status
      ) || undefined;
    error.providerCode = normalizeText(source.providerCode || nestedError.providerCode);
    error.summary = normalizeText(source.summary || nestedError.summary);
    error.requestId = normalizeText(source.requestId || nestedError.requestId);
    if (source.debugRawAiResponse && typeof source.debugRawAiResponse === "object") {
      error.debugRawAiResponse = source.debugRawAiResponse;
    } else if (source.debugRawJson && typeof source.debugRawJson === "object") {
      error.debugRawJson = source.debugRawJson;
    }
    if (source.rawResponse && typeof source.rawResponse === "object") {
      error.rawResponse = source.rawResponse;
    }
    return error;
  }
  return new Error(String(errorLike || "请求失败。"));
}

function createAishellError(message, code, statusCode, extra) {
  const error = new Error(String(message || "Aishell AI 请求失败。"));
  error.code = normalizeText(code) || "aishell-ai-request-failed";
  error.statusCode = Number(statusCode) || 500;
  Object.assign(error, extra || {});
  return error;
}

function createClientDisconnectedError(requestId, meta) {
  const clonedMeta = cloneMeta(meta);
  const error = createAishellError("客户端连接已关闭，当前同步请求已取消。", "client-disconnected", 499, {
    retryable: false,
    stage: normalizeText(clonedMeta.stage) || "queue",
    requestId: normalizeText(requestId),
    meta: clonedMeta,
  });
  error.meta.cancelled = true;
  return error;
}

function createStageError(stage, errorLike, meta) {
  const source = extractErrorSource(errorLike);
  const error = createAishellError(
    source.message || "Aishell AI 请求失败。",
    source.code || "aishell-ai-request-failed",
    source.statusCode || source.providerStatus || 500,
    {
      providerStatus: Number(source.providerStatus || source.statusCode || 0) || undefined,
      providerCode: normalizeText(source.providerCode),
      summary: normalizeText(source.summary),
      requestId: normalizeText(source.requestId || meta?.requestId),
      stage: normalizeText(stage) || "post_process",
      retryable: false,
      meta: cloneMeta(meta),
    }
  );

  if (source.debugRawAiResponse && typeof source.debugRawAiResponse === "object") {
    error.debugRawJson = source.debugRawAiResponse;
  } else if (source.debugRawJson && typeof source.debugRawJson === "object") {
    error.debugRawJson = source.debugRawJson;
  }

  if (source.rawResponse && typeof source.rawResponse === "object") {
    error.rawResponse = source.rawResponse;
  }

  if (source.code === "provider-queue-full") {
    error.statusCode = 503;
    error.retryable = true;
  } else if (isProviderRateLimitedError(source)) {
    error.code = "provider-rate-limited";
    error.statusCode = 429;
    error.retryable = true;
  } else if (source.code === "timeout") {
    error.statusCode = 504;
    error.retryable = true;
  } else if (source.code === "aborted" || source.code === "client-disconnected") {
    error.statusCode = source.statusCode || 504;
    error.retryable = false;
    if (error.meta && typeof error.meta === "object") {
      error.meta.cancelled = true;
    }
  }

  return error;
}

function normalizeLifecycleAbort(reason, meta) {
  return createStageError(
    meta?.stage || "queue",
    normalizeAbortError(reason, "当前同步请求已取消。", "aborted", 504),
    meta
  );
}

module.exports = {
  createAishellError,
  createClientDisconnectedError,
  createStageError,
  normalizeLifecycleAbort,
};

"use strict";

const { isProviderRateLimitedError, normalizeAbortError } = require("../../../backend/ai/errors");

function normalizeText(value) {
  return String(value || "").trim();
}

function createStageError(stage, errorLike, meta) {
  const source = errorLike instanceof Error ? errorLike : Object.assign(new Error("粤语 AI 请求失败。"), errorLike || {});
  const error = new Error(source.message || "粤语 AI 请求失败。");
  error.code = normalizeText(source.code) || "aishell-cantonese-ai-request-failed";
  error.statusCode = Number(source.statusCode || source.providerStatus) || 500;
  error.providerStatus = Number(source.providerStatus || source.statusCode) || 0;
  error.requestId = normalizeText(source.requestId || meta?.requestId);
  error.stage = normalizeText(stage) || "recognize";
  error.retryable = false;
  error.meta = Object.assign({}, meta || {});
  if (isProviderRateLimitedError(source)) {
    error.code = "provider-rate-limited";
    error.statusCode = 429;
    error.retryable = true;
  } else if (source.code === "timeout") {
    error.statusCode = 504;
    error.retryable = true;
  } else if (source.code === "aborted" || source.code === "client-disconnected") {
    error.statusCode = Number(source.statusCode) || 504;
    error.meta.cancelled = true;
  }
  return error;
}

function normalizeLifecycleAbort(reason, meta) {
  return createStageError(
    meta?.stage || "queue",
    normalizeAbortError(reason, "当前粤语 AI 请求已取消。", "aborted", 504),
    meta
  );
}

module.exports = {
  createStageError,
  normalizeLifecycleAbort,
};

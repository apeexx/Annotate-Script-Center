"use strict";

const { sanitizeProviderErrorSummary } = require("./sanitizer");

function createError(message, code, statusCode) {
  const error = new Error(message);
  error.code = code || "";
  error.statusCode = statusCode;
  return error;
}

function createProviderHttpError(statusCode, summary, message) {
  const error = createError(
    message || "上游模型请求失败（HTTP " + String(statusCode || 500) + "）。",
    "provider-http-error",
    Number(statusCode) || 500
  );
  error.summary = sanitizeProviderErrorSummary(summary || "");
  return error;
}

function createFunAsrProviderError(message, code, statusCode, options) {
  const source = options && typeof options === "object" ? options : {};
  const error = createError(
    message || "Fun-ASR 上游模型接口返回错误，可查看原始AI返回。",
    code || "fun-asr-provider-error",
    Number(statusCode) || 502
  );
  error.providerStatus = Number(source.providerStatus || statusCode) || Number(statusCode) || 502;
  error.providerCode = String(source.providerCode || "").trim();
  error.rawStatus = String(source.rawStatus || "").trim();
  error.summary = sanitizeProviderErrorSummary(source.summary || "");
  return error;
}

function isRateLimitProviderCode(value) {
  const code = String(value || "").trim().toLowerCase();
  return (
    code === "limit_burst_rate" ||
    code === "throttling" ||
    code === "rate_limit" ||
    code === "limit_requests" ||
    code === "toomanyrequests"
  );
}

function createRateLimitError(summary, options) {
  const source = options && typeof options === "object" ? options : {};
  const error = createError(
    String(source.message || "上游模型限流，后端已重试仍失败，请稍后重试。"),
    String(source.code || "provider-rate-limited"),
    429
  );
  error.providerStatus = Number(source.providerStatus) || 429;
  error.providerCode = String(source.providerCode || "").trim();
  error.summary = sanitizeProviderErrorSummary(summary || "");
  return error;
}

function createTimeoutError(message) {
  return createError(message || "上游模型请求超时。", "timeout", 504);
}

function createAbortedError(message, code, statusCode) {
  return createError(message || "请求已取消。", code || "aborted", statusCode || 504);
}

function normalizeAbortError(reason, fallbackMessage, fallbackCode, fallbackStatusCode) {
  if (reason instanceof Error) {
    const error = createError(
      reason.message || fallbackMessage || "请求已取消。",
      reason.code || fallbackCode || "aborted",
      reason.statusCode || fallbackStatusCode || 504
    );
    if (reason.summary) {
      error.summary = sanitizeProviderErrorSummary(reason.summary);
    }
    if (reason.providerStatus) {
      error.providerStatus = Number(reason.providerStatus) || 0;
    }
    return error;
  }
  if (reason && typeof reason === "object") {
    const error = createError(
      String(reason.message || fallbackMessage || "请求已取消。"),
      String(reason.code || fallbackCode || "aborted"),
      Number(reason.statusCode || fallbackStatusCode) || 504
    );
    if (reason.summary) {
      error.summary = sanitizeProviderErrorSummary(reason.summary);
    }
    if (reason.providerStatus) {
      error.providerStatus = Number(reason.providerStatus) || 0;
    }
    return error;
  }
  return createAbortedError(fallbackMessage, fallbackCode, fallbackStatusCode);
}

function createJobTimeoutError() {
  return createAbortedError("当前任务超过60s，请重新请求。", "ai-job-timeout", 504);
}

function createPythonRuntimeError(message, code, statusCode, summary) {
  const error = createError(message, code || "python-runtime-error", statusCode || 502);
  if (summary) {
    error.summary = sanitizeProviderErrorSummary(summary);
  }
  return error;
}

function createAudioUrlUnavailableError(message, statusCode, rawStatus) {
  const error = createError(
    message || "Fun-ASR 无法访问当前音频链接，请确认平台 audioUrl 对模型服务可访问。",
    "fun-asr-audio-url-unreachable",
    statusCode || 403
  );
  error.providerStatus = statusCode || 403;
  error.summary = sanitizeProviderErrorSummary(message || "");
  if (rawStatus) {
    error.rawStatus = String(rawStatus);
  }
  return error;
}

function isProviderRateLimitedError(error) {
  if (!error) {
    return false;
  }
  return (
    error.code === "qwen-burst-rate-limited" ||
    error.code === "provider-rate-limited" ||
    error.code === "fun-asr-rate-limited" ||
    isRateLimitProviderCode(error.providerCode) ||
    (error.code === "provider-http-error" && Number(error.statusCode) === 429) ||
    Number(error.providerStatus) === 429
  );
}

function isAudioUrlLikelyUnavailable(text) {
  const lowered = String(text || "").toLowerCase();
  return (
    lowered.indexOf("url") >= 0 &&
    ["access", "download", "forbidden", "denied", "signature", "oss", "403", "404"].some(function (keyword) {
      return lowered.indexOf(keyword) >= 0;
    })
  );
}

module.exports = {
  createAbortedError,
  createAudioUrlUnavailableError,
  createFunAsrProviderError,
  createJobTimeoutError,
  createProviderHttpError,
  createPythonRuntimeError,
  createRateLimitError,
  createTimeoutError,
  isAudioUrlLikelyUnavailable,
  isRateLimitProviderCode,
  isProviderRateLimitedError,
  normalizeAbortError,
};

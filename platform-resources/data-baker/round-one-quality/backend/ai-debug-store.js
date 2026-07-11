"use strict";

const crypto = require("crypto");

const {
  sanitizeProviderDebugJson,
  sanitizeProviderDebugPayload,
  sanitizeProviderDebugText,
} = require("../../../backend/ai/sanitizer");

const DEFAULT_TTL_MS = 30 * 60 * 1000;
const DEFAULT_MAX_SIZE = 1000;
const DEFAULT_TEXT_LIMIT = 20000;

const state = {
  records: new Map(),
  order: [],
};

function parsePositiveInteger(value, fallback) {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number) || number <= 0) {
    return fallback;
  }
  return number;
}

function getDebugStoreConfig() {
  return {
    ttlMs: parsePositiveInteger(
      process.env.DATABAKER_AI_DEBUG_STORE_TTL_MS || process.env.DATABAKER_AI_DEBUG_TTL_MS,
      DEFAULT_TTL_MS
    ),
    maxSize: parsePositiveInteger(
      process.env.DATABAKER_AI_DEBUG_STORE_MAX_SIZE || process.env.DATABAKER_AI_DEBUG_MAX_SIZE,
      DEFAULT_MAX_SIZE
    ),
    textLimit: parsePositiveInteger(process.env.DATABAKER_AI_DEBUG_TEXT_LIMIT, DEFAULT_TEXT_LIMIT),
  };
}

function createDebugId() {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString("hex");
}

function safeString(value, limit) {
  return sanitizeProviderDebugText(String(value || ""), Math.max(40, Number(limit) || 240)).trim();
}

function normalizeStage(value) {
  const text = String(value || "").trim().toLowerCase();
  if (
    text === "listen" ||
    text === "compare" ||
    text === "omni_single" ||
    text === "fun_asr" ||
    text === "fun_asr_submit" ||
    text === "fun_asr_poll" ||
    text === "fun_asr_transcription_download" ||
    text === "fun_asr_parse" ||
    text === "unknown"
  ) {
    return text;
  }
  return "unknown";
}

function normalizeProvider(value) {
  const text = String(value || "").trim().toLowerCase();
  if (
    text === "qwen" ||
    text === "fun-asr" ||
    text === "fun-asr-rest" ||
    text === "legacy-omni" ||
    text === "dashscope-fun-asr-and-qwen"
  ) {
    return text;
  }
  return text || "unknown";
}

function cleanupExpired(now) {
  const currentNow = Number(now) || Date.now();
  state.order = state.order.filter(function (debugId) {
    const record = state.records.get(debugId);
    if (!record) {
      return false;
    }
    if (record.expiresAt <= currentNow) {
      state.records.delete(debugId);
      return false;
    }
    return true;
  });
}

function enforceMaxSize(maxSize) {
  while (state.order.length > maxSize) {
    const debugId = state.order.shift();
    if (!debugId) {
      continue;
    }
    state.records.delete(debugId);
  }
}

function rememberAiDebug(payload) {
  const config = getDebugStoreConfig();
  const now = Date.now();
  cleanupExpired(now);

  const source = payload && typeof payload === "object" ? payload : {};
  const debugId = createDebugId();
  const record = {
    debugId,
    requestId: safeString(source.requestId, 120),
    clientRequestId: safeString(source.clientRequestId, 120),
    batchRunId: safeString(source.batchRunId, 120),
    batchProcessKey: safeString(source.batchProcessKey, 240),
    itemId: safeString(source.itemId, 120),
    textId: safeString(source.textId, 120),
    sentenceNumber:
      Number.isFinite(Number(source.sentenceNumber)) ? Number(source.sentenceNumber) : 0,
    stage: normalizeStage(source.stage),
    model: safeString(source.model, 160),
    provider: normalizeProvider(source.provider),
    providerCode: safeString(source.providerCode, 120),
    errorCode: safeString(source.errorCode, 120),
    errorMessage: safeString(source.errorMessage, 240),
    providerStatus:
      Number.isFinite(Number(source.providerStatus)) && Number(source.providerStatus) > 0
        ? Number(source.providerStatus)
        : 0,
    taskId: safeString(source.taskId, 160),
    taskStatus: safeString(source.taskStatus, 80),
    rawText: source.rawText ? sanitizeProviderDebugText(source.rawText, config.textLimit) : "",
    rawJson: source.rawJson
      ? sanitizeProviderDebugJson(source.rawJson, { textLimit: config.textLimit })
      : null,
    rawSseText: source.rawSseText
      ? sanitizeProviderDebugText(source.rawSseText, config.textLimit)
      : "",
    responseBody: source.responseBody
      ? sanitizeProviderDebugPayload(source.responseBody, { textLimit: config.textLimit })
      : null,
    usage: source.usage
      ? sanitizeProviderDebugJson(source.usage, { textLimit: 4000, maxDepth: 4, maxObjectKeys: 40 })
      : null,
    createdAt: safeString(source.createdAt || new Date(now).toISOString(), 80),
  };

  state.records.set(debugId, {
    record,
    expiresAt: now + config.ttlMs,
  });
  state.order.push(debugId);
  enforceMaxSize(config.maxSize);
  return record;
}

function getAiDebug(debugId) {
  const key = String(debugId || "").trim();
  cleanupExpired(Date.now());
  const entry = key ? state.records.get(key) : null;
  if (!entry) {
    const error = new Error("原始 AI 返回不存在或已过期。");
    error.code = "ai-debug-not-found";
    error.statusCode = 404;
    throw error;
  }
  return entry.record;
}

module.exports = {
  getAiDebug,
  getDebugStoreConfig,
  rememberAiDebug,
};

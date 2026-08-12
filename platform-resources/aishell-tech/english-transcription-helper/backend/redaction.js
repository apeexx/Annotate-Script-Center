"use strict";

const PUBLIC_ERROR_SUMMARY = "The provider request failed.";
const SAFE_PUBLIC_ERROR_CODES = new Set([
  "request-error",
  "request-failed",
  "invalid-json",
  "payload-too-large",
  "missing-audio-data-url",
  "invalid-audio-data-url",
  "invalid-segment-range",
  "invalid-segment-duration",
  "missing-task-item-id",
  "missing-task-context",
  "missing-segment-identity",
  "invalid-segment-identity",
  "provider-rate-limited",
  "provider-queue-full",
  "ai-job-timeout",
  "aborted",
  "client-disconnected",
  "timeout",
  "qwen-empty-response",
  "missing-api-key",
  "invalid-model",
  "model-runtime-unavailable",
]);
const SAFE_PUBLIC_PROVIDER_CODES = new Set([
  "limit_burst_rate",
  "throttling",
  "rate_limit",
  "limit_requests",
  "toomanyrequests",
]);

function normalizePublicKey(key) {
  return String(key || "").trim().toLowerCase().replace(/[\s_-]/g, "");
}

function getSensitiveKeyRedaction(key) {
  const normalized = normalizePublicKey(key);
  if (
    normalized.includes("audiobase64") ||
    normalized.includes("audiodataurl") ||
    normalized.includes("audiourl") ||
    normalized.includes("dataurl") ||
    normalized.includes("sourceurl")
  ) {
    return "[redacted-audio-source]";
  }
  if (normalized.includes("url")) {
    return "[redacted-url]";
  }
  if (
    normalized.includes("authorization") ||
    normalized.includes("cookie") ||
    normalized.includes("token") ||
    normalized.includes("apikey") ||
    normalized.includes("secret") ||
    normalized.includes("password") ||
    normalized.includes("signature") ||
    normalized.includes("credential") ||
    normalized.includes("message") ||
    normalized.includes("summary")
  ) {
    return "[redacted-sensitive-value]";
  }
  return "";
}

function isLikelyBase64Token(value) {
  const text = String(value || "").trim();
  const unpadded = text.replace(/=+$/, "");
  return (
    unpadded.length >= 48 &&
    unpadded.length % 4 !== 1 &&
    /^[a-z0-9+/_-]+={0,2}$/i.test(text)
  );
}

function containsLikelyBase64Token(value) {
  const tokens = String(value || "").match(/[a-z0-9+/_-]+={0,2}/gi) || [];
  return tokens.some(isLikelyBase64Token);
}

function containsDataUrl(value) {
  return /(?:^|[\s"'([{=:;,])data:[^\s"'<>]*,/i.test(String(value || ""));
}

function containsSerializedSensitiveField(value) {
  return /(?:["']?(?:audio[_-]?(?:base64|data[_-]?url|url)|audio(?:base64|dataurl|url)|data[_-]?url|source[_-]?url|access[_-]?token|refresh[_-]?token|api[_-]?key|authorization|cookie|signature|secret|credential)["']?\s*[:=])/i.test(
    String(value || "")
  );
}

function containsSensitiveText(value) {
  return /(?:bearer\s+|(?:authorization|cookie|token|api[_-]?key|secret|password|signature|credential|access[_-]?key)[\s"'=:])/i.test(
    String(value || "")
  );
}


function isCanonicalBase64Url(value) {
  const text = String(value || "");
  if (!text || text.length % 4 === 1 || !/^[A-Za-z0-9_-]+$/.test(text)) {
    return false;
  }
  try {
    return Buffer.from(text, "base64url").toString("base64url") === text;
  } catch (_error) {
    return false;
  }
}

function isCompleteJwt(value) {
  const parts = String(value || "").split(".");
  if (parts.length !== 3 || !parts.every(isCanonicalBase64Url)) {
    return false;
  }
  try {
    const header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return Boolean(
      header && typeof header === "object" && !Array.isArray(header) &&
      payload && typeof payload === "object" && !Array.isArray(payload) &&
      typeof header.alg === "string" && header.alg.trim() &&
      Buffer.from(parts[2], "base64url").length >= 8
    );
  } catch (_error) {
    return false;
  }
}

function containsCompleteJwt(value) {
  const matcher = /(?:^|[^A-Za-z0-9_-])([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)(?=$|[^A-Za-z0-9_-])/g;
  const text = String(value || "");
  let match;
  while ((match = matcher.exec(text))) {
    if (isCompleteJwt(match[1])) {
      return true;
    }
  }
  return false;
}

function tryParseSerializedJson(value) {
  const text = String(value || "").trim();
  if (!text.startsWith("{") && !text.startsWith("[")) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (_error) {
    return null;
  }
}

function sanitizePublicPayload(value, depth, seen) {
  const level = Number(depth || 0);
  if (level > 8) {
    return "[truncated]";
  }
  if (typeof value === "string") {
    const parsed = tryParseSerializedJson(value);
    if (parsed !== null) {
      return sanitizePublicPayload(parsed, level + 1, seen);
    }
    if (containsCompleteJwt(value)) {
      return "[redacted-jwt]";
    }
    if (containsDataUrl(value)) {
      return "[redacted-data-url]";
    }
    if (isLikelyBase64Token(value) || containsLikelyBase64Token(value)) {
      return "[redacted-base64-payload]";
    }
    if (/https?:\/\//i.test(value)) {
      return "[redacted-url]";
    }
    if (containsSerializedSensitiveField(value) || containsSensitiveText(value)) {
      return "[redacted-sensitive-text]";
    }
    return value.length > 20000 ? value.slice(0, 20000) + "..." : value;
  }
  if (value === null || value === undefined || typeof value !== "object") {
    return value;
  }
  if (!seen) {
    seen = new WeakSet();
  }
  if (seen.has(value)) {
    return "[circular]";
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return value.slice(0, 50).map(function (entry) {
      return sanitizePublicPayload(entry, level + 1, seen);
    });
  }
  const result = {};
  Object.keys(value).slice(0, 100).forEach(function (key) {
    const redaction = getSensitiveKeyRedaction(key);
    result[key] = redaction || sanitizePublicPayload(value[key], level + 1, seen);
  });
  return result;
}


function normalizePublicCode(value) {
  return String(value || "").trim().toLowerCase();
}

function sanitizePublicErrorCode(value) {
  const code = normalizePublicCode(value);
  return SAFE_PUBLIC_ERROR_CODES.has(code) ? code : "request-error";
}

function sanitizePublicProviderCode(value) {
  const code = normalizePublicCode(value);
  return SAFE_PUBLIC_PROVIDER_CODES.has(code) ? code : "";
}

function isRawProviderPayloadKey(key) {
  return [
    "raw",
    "rawresponse",
    "rawjson",
    "rawusage",
    "debugrawjson",
    "debugrawairesponse",
    "providerdebug",
    "providerraw",
  ].includes(normalizePublicKey(key));
}

function removeRawProviderPayloadFields(value) {
  if (Array.isArray(value)) {
    return value.map(removeRawProviderPayloadFields);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const result = {};
  Object.keys(value).forEach(function (key) {
    if (!isRawProviderPayloadKey(key)) {
      result[key] = removeRawProviderPayloadFields(value[key]);
    }
  });
  return result;
}

function sanitizePublicMeta(value) {
  return removeRawProviderPayloadFields(sanitizePublicPayload(value));
}
module.exports = {
  PUBLIC_ERROR_SUMMARY,
  sanitizePublicErrorCode,
  sanitizePublicMeta,
  sanitizePublicPayload,
  sanitizePublicProviderCode,
};

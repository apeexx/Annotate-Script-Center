"use strict";

function redactProviderText(text) {
  return String(text || "")
    .replace(/https?:\/\/[^\s"'\\]+/g, function (matchText) {
      try {
        const parsedUrl = new URL(matchText);
        return parsedUrl.protocol + "//" + parsedUrl.host + "/[redacted]";
      } catch (error) {
        return "[url-redacted]";
      }
    })
    .replace(/(access_token["'\s:=]+)([^\s",}]+)/gi, "$1[redacted]")
    .replace(/(refresh_token["'\s:=]+)([^\s",}]+)/gi, "$1[redacted]")
    .replace(/(cookie["'\s:=]+)([^\n\r]+)/gi, "$1[redacted]")
    .replace(/(ossaccesskeyid["'\s:=]+)([^\s",}]+)/gi, "$1[redacted]")
    .replace(/(signature["'\s:=]+)([^\s",}]+)/gi, "$1[redacted]")
    .replace(/(api[_-]?key["'\s:=]+)([^\s",}]+)/gi, "$1[redacted]")
    .replace(/(authorization["'\s:=]+)([^\s",}]+)/gi, "$1[redacted]");
}

function clampText(text, limit) {
  return String(text || "").slice(0, Math.max(40, Number(limit) || 240));
}

function sanitizeProviderText(text, limit) {
  return clampText(
    redactProviderText(String(text || ""))
      .replace(/\s+/g, " ")
      .trim(),
    limit
  );
}

function sanitizeProviderDebugText(text, limit) {
  return clampText(
    redactProviderText(String(text || ""))
      .replace(/\r\n/g, "\n")
      .trim(),
    limit
  );
}

function isSensitiveDebugKey(key) {
  const normalized = String(key || "").toLowerCase();
  return (
    normalized.indexOf("token") >= 0 ||
    normalized.indexOf("cookie") >= 0 ||
    normalized.indexOf("authorization") >= 0 ||
    normalized.indexOf("signature") >= 0 ||
    normalized.indexOf("api_key") >= 0 ||
    normalized.indexOf("apikey") >= 0 ||
    normalized.indexOf("audiourl") >= 0 ||
    normalized.indexOf("audio_url") >= 0
  );
}

function sanitizeProviderDebugValue(value, options, depth, seen) {
  const config = options && typeof options === "object" ? options : {};
  const currentDepth = Number(depth) || 0;
  const maxDepth = Math.max(1, Number(config.maxDepth) || 6);
  const maxArrayLength = Math.max(1, Number(config.maxArrayLength) || 30);
  const maxObjectKeys = Math.max(1, Number(config.maxObjectKeys) || 80);
  const textLimit = Math.max(40, Number(config.textLimit) || 20000);

  if (value === null || value === undefined) {
    return value === undefined ? null : value;
  }
  if (typeof value === "string") {
    return sanitizeProviderDebugText(value, textLimit);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (currentDepth >= maxDepth) {
    return {
      type: Array.isArray(value) ? "array" : typeof value,
      truncated: true,
    };
  }
  if (Array.isArray(value)) {
    return value.slice(0, maxArrayLength).map(function (item) {
      return sanitizeProviderDebugValue(item, config, currentDepth + 1, seen);
    });
  }
  if (typeof value === "object") {
    if (!seen) {
      seen = new WeakSet();
    }
    if (seen.has(value)) {
      return { circular: true };
    }
    seen.add(value);
    const keys = Object.keys(value).slice(0, maxObjectKeys);
    const next = {};
    keys.forEach(function (key) {
      if (isSensitiveDebugKey(key)) {
        next[key] = "[redacted]";
        return;
      }
      next[key] = sanitizeProviderDebugValue(value[key], config, currentDepth + 1, seen);
    });
    return next;
  }
  return sanitizeProviderDebugText(String(value || ""), textLimit);
}

function sanitizeProviderDebugJson(value, options) {
  return sanitizeProviderDebugValue(value, options, 0, new WeakSet());
}

function sanitizeProviderDebugPayload(value, options) {
  if (typeof value === "string") {
    return sanitizeProviderDebugText(value, options?.textLimit);
  }
  return sanitizeProviderDebugJson(value, options);
}

module.exports = {
  sanitizeProviderDebugJson,
  sanitizeProviderDebugPayload,
  sanitizeProviderDebugText,
  sanitizeProviderErrorSummary: sanitizeProviderText,
  sanitizeProviderText,
};

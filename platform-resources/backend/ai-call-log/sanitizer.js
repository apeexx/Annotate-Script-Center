"use strict";

const DEFAULT_TEXT_LIMIT = 500;
const DEFAULT_JSON_LIMIT = 4000;
const SENSITIVE_KEY_PATTERN =
  /(access[_-]?token|refresh[_-]?token|authorization|cookie|token|signature|api[_-]?key|secret|password|credential)/i;
const USAGE_TOKEN_KEY_PATTERN =
  /^(promptTokens|completionTokens|totalTokens|inputTokens|outputTokens|prompt_tokens|completion_tokens|total_tokens|input_tokens|output_tokens|prompt_tokens_details|completion_tokens_details)$/i;

function normalizeText(value, maxLength) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!Number.isFinite(Number(maxLength)) || Number(maxLength) <= 0) {
    return text;
  }
  const limit = Math.max(1, Math.floor(Number(maxLength)));
  if (text.length <= limit) {
    return text;
  }
  return text.slice(0, limit) + "...<truncated>";
}

function normalizeOptionalNumber(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "";
  }
  return String(numeric);
}

function sanitizeUrlText(value) {
  const text = normalizeText(value, 2000);
  if (!text) {
    return "";
  }
  try {
    const parsed = new URL(text);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const tail = parts.length > 0 ? parts[parts.length - 1] : "";
    return parsed.origin + "/<redacted>/" + tail;
  } catch (_error) {
    return "<url-redacted>";
  }
}

function sanitizeJsonValue(value, depth) {
  const level = Number(depth || 0);
  if (level > 6) {
    return "<max-depth>";
  }
  if (value === null || value === undefined) {
    return value ?? null;
  }
  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value)) {
      return sanitizeUrlText(value);
    }
    return normalizeText(value, 2000);
  }
  if (typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 60).map(function mapItem(item) {
      return sanitizeJsonValue(item, level + 1);
    });
  }

  const result = {};
  Object.keys(value)
    .slice(0, 120)
    .forEach(function mapKey(key) {
      const normalizedKey = String(key || "");
      if (
        SENSITIVE_KEY_PATTERN.test(normalizedKey) &&
        !USAGE_TOKEN_KEY_PATTERN.test(normalizedKey)
      ) {
        result[key] = "<redacted>";
        return;
      }
      result[key] = sanitizeJsonValue(value[key], level + 1);
    });
  return result;
}

function safeJsonStringify(value, maxLength) {
  try {
    return normalizeText(
      JSON.stringify(sanitizeJsonValue(value === undefined ? null : value, 0)),
      maxLength || DEFAULT_JSON_LIMIT
    );
  } catch (_error) {
    return "";
  }
}

function buildErrorSnapshot(error, requestId) {
  const source = error && typeof error === "object" ? error : {};
  return {
    requestId: normalizeText(source.requestId || requestId, 120),
    code: normalizeText(source.code, 120),
    stage: normalizeText(source.stage, 120),
    message: normalizeText(source.safeMessage || source.message, DEFAULT_TEXT_LIMIT),
    summary: normalizeText(source.summary, DEFAULT_TEXT_LIMIT),
    providerCode: normalizeText(source.providerCode, 120),
    providerStatus: normalizeOptionalNumber(source.providerStatus || source.statusCode),
    retryable: source.retryable === true,
    rawResponse: source.rawResponse && typeof source.rawResponse === "object" ? source.rawResponse : null,
    debugRawJson:
      source.debugRawJson && typeof source.debugRawJson === "object"
        ? source.debugRawJson
        : null,
    meta: source.meta && typeof source.meta === "object" ? source.meta : null,
  };
}

function pickTokenValue(usage, keys) {
  const source = usage && typeof usage === "object" ? usage : {};
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    if (!Object.prototype.hasOwnProperty.call(source, key)) {
      continue;
    }
    const value = normalizeOptionalNumber(source[key]);
    if (value !== "") {
      return value;
    }
  }
  return "";
}

function pickUsageCells(usage) {
  const totals = collectUsageTotals(usage);
  const promptTokens = normalizeOptionalNumber(totals.promptTokens);
  const completionTokens = normalizeOptionalNumber(totals.completionTokens);
  const totalTokens = normalizeOptionalNumber(
    promptTokens || completionTokens ? totals.promptTokens + totals.completionTokens : totals.totalTokens
  );

  return {
    promptTokens,
    completionTokens,
    totalTokens,
  };
}

function collectUsageTotals(usage) {
  const source = usage && typeof usage === "object" ? usage : null;
  if (!source) {
    return {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      found: false,
    };
  }

  const ownPromptTokens = Number(
    pickTokenValue(source, ["promptTokens", "prompt_tokens", "inputTokens", "input_tokens"]) || 0
  );
  const ownCompletionTokens = Number(
    pickTokenValue(source, [
      "completionTokens",
      "completion_tokens",
      "outputTokens",
      "output_tokens",
    ]) || 0
  );
  const ownTotalTokens = Number(pickTokenValue(source, ["totalTokens", "total_tokens"]) || 0);

  const childKeys = Object.keys(source).filter(function filterChildKey(key) {
    const value = source[key];
    return value && typeof value === "object";
  });
  const childTotals = childKeys.map(function mapChild(key) {
    return collectUsageTotals(source[key]);
  });
  const hasChildTotals = childTotals.some(function someChild(child) {
    return child.found;
  });

  if (hasChildTotals) {
    return childTotals.reduce(
      function reduceChild(result, child) {
        result.promptTokens += child.promptTokens;
        result.completionTokens += child.completionTokens;
        result.totalTokens += child.totalTokens;
        result.found = result.found || child.found;
        return result;
      },
      {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        found: false,
      }
    );
  }

  return {
    promptTokens: ownPromptTokens,
    completionTokens: ownCompletionTokens,
    totalTokens:
      ownPromptTokens || ownCompletionTokens ? ownPromptTokens + ownCompletionTokens : ownTotalTokens,
    found: Boolean(ownPromptTokens || ownCompletionTokens || ownTotalTokens),
  };
}

function coerceBooleanCell(value) {
  return value === true ? "true" : value === false ? "false" : "";
}

function parseBooleanCell(value) {
  const text = String(value || "").trim().toLowerCase();
  return text === "true" || text === "1" || text === "yes";
}

function resolveDurationMs() {
  for (let index = 0; index < arguments.length; index += 1) {
    const candidate = arguments[index];
    if (candidate === null || candidate === undefined || candidate === "") {
      continue;
    }
    if (typeof candidate === "object" && !Array.isArray(candidate)) {
      const value =
        candidate.totalDurationMs ??
        candidate.durationMs ??
        candidate.elapsedMs ??
        candidate.totalMs ??
        candidate.total_duration_ms;
      const normalized = normalizeOptionalNumber(value);
      if (normalized !== "") {
        return normalized;
      }
      continue;
    }
    const normalized = normalizeOptionalNumber(candidate);
    if (normalized !== "") {
      return normalized;
    }
  }
  return "";
}

function assertAiUsageOperatorName(rawBody) {
  const source = rawBody && typeof rawBody === "object" ? rawBody : {};
  const operatorName = normalizeText(source.aiUsageOperatorName, 40);
  if (operatorName) {
    return operatorName;
  }
  const error = new Error("请先在 options 首页填写 AI 调用使用人。");
  error.statusCode = 400;
  error.code = "missing-ai-usage-operator-name";
  throw error;
}

module.exports = {
  assertAiUsageOperatorName,
  buildErrorSnapshot,
  coerceBooleanCell,
  normalizeOptionalNumber,
  normalizeText,
  parseBooleanCell,
  pickUsageCells,
  resolveDurationMs,
  safeJsonStringify,
  sanitizeJsonValue,
};

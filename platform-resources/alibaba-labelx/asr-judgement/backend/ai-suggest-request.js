"use strict";

const { SUPPORTED_REQUEST_PARAMS, getClientConfig, sanitizeModelName } = require("./ai-client-qwen");
const { RULE_VERSION } = require("./ai-prompt");

const SCRIPT_ID = "judgement";
const DEFAULT_RULE_VERSION = RULE_VERSION;
const JUDGEMENT_AI_SUPPORTED_PARAMS = Object.assign({}, SUPPORTED_REQUEST_PARAMS, {
  response_format: false,
});

function createHttpError(statusCode, message, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code || "";
  return error;
}

function parseAudioHostname(audioUrl) {
  try {
    return new URL(audioUrl).hostname || "";
  } catch (_error) {
    return "";
  }
}

function isHttpUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_error) {
    return false;
  }
}

function normalizeBoolean(value, fallback) {
  if (typeof value === "boolean") {
    return value;
  }
  if (value === "1" || value === 1) {
    return true;
  }
  if (value === "0" || value === 0) {
    return false;
  }
  return fallback === true;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeContextText(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 1200);
}

function normalizePromptText(value) {
  return String(value || "").replace(/\r\n/g, "\n").trim().slice(0, 8000);
}

function normalizeNumberInRange(value, min, max) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return null;
  }
  if (numericValue < min || numericValue > max) {
    return null;
  }
  return numericValue;
}

function normalizeIntegerInRange(value, min, max) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return null;
  }
  const normalizedValue = Math.floor(numericValue);
  if (normalizedValue < min || normalizedValue > max) {
    return null;
  }
  return normalizedValue;
}

function normalizeStopSequences(value) {
  if (Array.isArray(value)) {
    return value
      .map(function (item) {
        return String(item || "").trim().slice(0, 80);
      })
      .filter(Boolean)
      .slice(0, 8);
  }
  if (typeof value === "string") {
    return value
      .split(/\r?\n/)
      .map(function (item) {
        return String(item || "").trim().slice(0, 80);
      })
      .filter(Boolean)
      .slice(0, 8);
  }
  return [];
}

function normalizeAiOptions(source, supportedParams) {
  const payload = source && typeof source === "object" ? source : {};
  const normalized = {};
  const listenPrompt = normalizePromptText(payload.listenPrompt);
  const comparePrompt = normalizePromptText(payload.comparePrompt);
  const listenModel = sanitizeModelName(payload.listenModel, "");
  const compareModel = sanitizeModelName(payload.compareModel, "");
  if (listenPrompt) {
    normalized.listenPrompt = listenPrompt;
  }
  if (comparePrompt) {
    normalized.comparePrompt = comparePrompt;
  }
  if (listenModel) {
    normalized.listenModel = listenModel;
  }
  if (compareModel) {
    normalized.compareModel = compareModel;
  }

  if (supportedParams.temperature === true) {
    const value = normalizeNumberInRange(payload.temperature, 0, 2);
    if (value !== null) {
      normalized.temperature = value;
    }
  }
  if (supportedParams.top_p === true) {
    const value = normalizeNumberInRange(payload.top_p, 0, 1);
    if (value !== null) {
      normalized.top_p = value;
    }
  }
  if (supportedParams.max_tokens === true) {
    const value = normalizeIntegerInRange(payload.max_tokens, 1, 8192);
    if (value !== null) {
      normalized.max_tokens = value;
    }
  }
  if (supportedParams.max_completion_tokens === true) {
    const value = normalizeIntegerInRange(payload.max_completion_tokens, 1, 8192);
    if (value !== null) {
      normalized.max_completion_tokens = value;
    }
  }
  if (supportedParams.presence_penalty === true) {
    const value = normalizeNumberInRange(payload.presence_penalty, -2, 2);
    if (value !== null) {
      normalized.presence_penalty = value;
    }
  }
  if (supportedParams.frequency_penalty === true) {
    const value = normalizeNumberInRange(payload.frequency_penalty, -2, 2);
    if (value !== null) {
      normalized.frequency_penalty = value;
    }
  }
  if (supportedParams.seed === true) {
    const value = normalizeIntegerInRange(payload.seed, 0, 2147483647);
    if (value !== null) {
      normalized.seed = value;
    }
  }
  if (supportedParams.stop === true) {
    const stop = normalizeStopSequences(payload.stop);
    if (stop.length > 0) {
      normalized.stop = stop;
    }
  }
  if (
    supportedParams.enable_thinking === true &&
    typeof payload.enable_thinking === "boolean"
  ) {
    normalized.enable_thinking = payload.enable_thinking === true;
  }
  if (
    supportedParams.web_search === true &&
    typeof payload.webSearchEnabled === "boolean"
  ) {
    normalized.webSearchEnabled = payload.webSearchEnabled === true;
  }
  return normalized;
}

function normalizeSuggestRequest(body) {
  const source = body && typeof body === "object" ? body : {};
  const config = getClientConfig();
  const aiOptions = normalizeAiOptions(source.aiOptions, JUDGEMENT_AI_SUPPORTED_PARAMS);
  const projectId = String(source.projectId || "").trim();
  const subTaskId = String(source.subTaskId || "").trim();
  const itemId = String(source.itemId || "").trim();
  const audioUrl = String(source.audioUrl || "").trim();
  const asrText1 = String(source.asrText1 || "").trim();
  const asrText2 = String(source.asrText2 || "").trim();
  const contextText = normalizeContextText(source.contextText);
  const contextAvailable = contextText.length > 0;
  const includeContext = contextAvailable ? normalizeBoolean(source.includeContext, true) : false;
  const ruleVersion = String(source.ruleVersion || DEFAULT_RULE_VERSION).trim();
  const clientVersion = String(source.clientVersion || "").trim();
  const rawItemIndex = source.itemIndex;
  const itemIndex =
    rawItemIndex === undefined || rawItemIndex === null || rawItemIndex === ""
      ? 0
      : Number(rawItemIndex);
  const requestedListenModel = sanitizeModelName(aiOptions.listenModel || source.listenModel, "");
  const requestedCompareModel = sanitizeModelName(
    aiOptions.compareModel || source.compareModel || source.model,
    ""
  );
  const listenModel = config.allowClientModelOverride
    ? sanitizeModelName(requestedListenModel, config.listenModel)
    : sanitizeModelName(config.listenModel, "");
  const compareModel = config.allowClientModelOverride
    ? sanitizeModelName(
        requestedCompareModel,
        config.compareModel || config.legacyModel
      )
    : sanitizeModelName(config.compareModel || config.legacyModel, "");
  const enableThinking = normalizeBoolean(
    aiOptions.enable_thinking,
    normalizeBoolean(source.enableThinking, config.enableThinkingDefault === true)
  );
  const webSearchEnabled = normalizeBoolean(
    aiOptions.webSearchEnabled,
    normalizeBoolean(source.webSearchEnabled, config.webSearchEnabledDefault !== false)
  );

  if (!projectId) {
    throw createHttpError(400, "projectId 不能为空。", "invalid-project-id");
  }
  if (!subTaskId) {
    throw createHttpError(400, "subTaskId 不能为空。", "invalid-subtask-id");
  }
  if (!isHttpUrl(audioUrl)) {
    throw createHttpError(400, "audioUrl 必须是 http/https。", "invalid-audio-url");
  }
  if (!asrText1 || !asrText2) {
    throw createHttpError(400, "asrText1/asrText2 不能为空。", "invalid-asr-text");
  }
  if (!Number.isFinite(itemIndex)) {
    throw createHttpError(400, "itemIndex 必须是数字。", "invalid-item-index");
  }

  return {
    projectId,
    subTaskId,
    itemId,
    itemIndex,
    audioUrl,
    asrText1,
    asrText2,
    contextText,
    contextAvailable,
    includeContext,
    listenModel,
    compareModel,
    enableThinking,
    webSearchEnabled,
    aiOptions,
    ruleVersion,
    clientVersion,
  };
}

function sanitizeLogSummary(text) {
  return String(text || "")
    .replace(/https?:\/\/[^\s"'\\]+/g, "[url-redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

module.exports = {
  DEFAULT_RULE_VERSION,
  JUDGEMENT_AI_SUPPORTED_PARAMS,
  SCRIPT_ID,
  createHttpError,
  normalizeAiOptions,
  normalizeSuggestRequest,
  normalizeText,
  parseAudioHostname,
  sanitizeLogSummary,
};

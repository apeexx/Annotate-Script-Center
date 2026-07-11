"use strict";

const {
  SUPPORTED_REQUEST_PARAMS,
  sanitizeModelName,
} = require("./ai-client-qwen");

const SCRIPT_ID = "magicDataAnnotatorAiReview";

function createHttpError(statusCode, message, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code || "";
  return error;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeNullableNumber(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function isHttpUrl(value) {
  try {
    const parsed = new URL(String(value || ""));
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (_error) {
    return false;
  }
}

function normalizePageType(value) {
  const text = String(value || "").trim().toLowerCase();
  if (text === "asrmarkcheck") {
    return "asrmarkCheck";
  }
  return "asrmark";
}

function normalizeRecognitionMode(value) {
  const text = String(value || "").trim().toLowerCase();
  if (text === "two_stage" || text === "omni_single" || text === "recognition_convert") {
    return text;
  }
  if (text === "fun_asr_compare" || text === "qwen_omni_compare" || text === "qwen_omni_two_stage") {
    return "two_stage";
  }
  if (text === "listen_only") {
    return "omni_single";
  }
  return "two_stage";
}

function normalizeModelMode(value, fallback) {
  const text = String(value || "").trim().toLowerCase();
  if (text === "two_stage" || text === "omni_single") {
    return text;
  }
  if (text === "recognition_convert") {
    return "two_stage";
  }
  return String(fallback || "two_stage").trim().toLowerCase() === "omni_single"
    ? "omni_single"
    : "two_stage";
}

function normalizeRecognitionStrategy(value, fallback) {
  const text = String(value || "").trim().toLowerCase();
  if (text === "mandarin_to_dialect" || text === "recognition_convert") {
    return "mandarin_to_dialect";
  }
  return String(fallback || "direct_dialect").trim().toLowerCase() === "mandarin_to_dialect"
    ? "mandarin_to_dialect"
    : "direct_dialect";
}

function deriveLegacyRecognitionMode(modelMode, recognitionStrategy) {
  if (normalizeRecognitionStrategy(recognitionStrategy, "direct_dialect") === "mandarin_to_dialect") {
    return "recognition_convert";
  }
  return normalizeModelMode(modelMode, "two_stage");
}

function normalizeReviewMode(value) {
  const text = String(value || "").trim().toLowerCase();
  if (text === "listen_assisted" || text === "strict_review" || text === "rule_first") {
    return text;
  }
  return "rule_first";
}

function normalizePromptText(value) {
  return String(value || "").replace(/\r\n/g, "\n").trim().slice(0, 8000);
}

function normalizeNumberInRange(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return null;
  }
  if (number < min || number > max) {
    return null;
  }
  return number;
}

function normalizeIntegerInRange(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return null;
  }
  const integerValue = Math.floor(number);
  if (integerValue < min || integerValue > max) {
    return null;
  }
  return integerValue;
}

function normalizeStopSequences(value) {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/\r?\n/)
      : [];
  const result = [];
  source.forEach(function (item) {
    const text = String(item || "").trim().slice(0, 80);
    if (!text || result.indexOf(text) >= 0 || result.length >= 8) {
      return;
    }
    result.push(text);
  });
  return result;
}

function normalizeAiOptions(value) {
  const source = value && typeof value === "object" ? value : {};
  const result = {};
  const listenPrompt = normalizePromptText(source.listenPrompt);
  const comparePrompt = normalizePromptText(source.comparePrompt || source.reviewPrompt);
  const listenModel = sanitizeModelName(source.listenModel, "");
  const compareModel = sanitizeModelName(source.compareModel || source.reviewModel, "");
  const singleModel = sanitizeModelName(source.singleModel, "");
  if (listenPrompt) {
    result.listenPrompt = listenPrompt;
  }
  if (comparePrompt) {
    result.comparePrompt = comparePrompt;
  }
  if (listenModel) {
    result.listenModel = listenModel;
  }
  if (compareModel) {
    result.compareModel = compareModel;
    result.reviewModel = compareModel;
  }
  if (singleModel) {
    result.singleModel = singleModel;
  }
  if (SUPPORTED_REQUEST_PARAMS.temperature === true) {
    const normalized = normalizeNumberInRange(source.temperature, 0, 2);
    if (normalized !== null) {
      result.temperature = normalized;
    }
  }
  if (SUPPORTED_REQUEST_PARAMS.top_p === true) {
    const normalized = normalizeNumberInRange(source.top_p, 0, 1);
    if (normalized !== null) {
      result.top_p = normalized;
    }
  }
  if (SUPPORTED_REQUEST_PARAMS.max_tokens === true) {
    const normalized = normalizeIntegerInRange(source.max_tokens, 1, 8192);
    if (normalized !== null) {
      result.max_tokens = normalized;
    }
  }
  if (SUPPORTED_REQUEST_PARAMS.max_completion_tokens === true) {
    const normalized = normalizeIntegerInRange(source.max_completion_tokens, 1, 8192);
    if (normalized !== null) {
      result.max_completion_tokens = normalized;
    }
  }
  if (SUPPORTED_REQUEST_PARAMS.presence_penalty === true) {
    const normalized = normalizeNumberInRange(source.presence_penalty, -2, 2);
    if (normalized !== null) {
      result.presence_penalty = normalized;
    }
  }
  if (SUPPORTED_REQUEST_PARAMS.frequency_penalty === true) {
    const normalized = normalizeNumberInRange(source.frequency_penalty, -2, 2);
    if (normalized !== null) {
      result.frequency_penalty = normalized;
    }
  }
  if (SUPPORTED_REQUEST_PARAMS.seed === true) {
    const normalized = normalizeIntegerInRange(source.seed, 0, 2147483647);
    if (normalized !== null) {
      result.seed = normalized;
    }
  }
  if (SUPPORTED_REQUEST_PARAMS.stop === true) {
    const stop = normalizeStopSequences(source.stop);
    if (stop.length > 0) {
      result.stop = stop;
    }
  }
  if (SUPPORTED_REQUEST_PARAMS.enable_thinking === true && typeof source.enable_thinking === "boolean") {
    result.enable_thinking = source.enable_thinking === true;
  }
  return result;
}

function normalizeReviewRequest(body) {
  const source = body && typeof body === "object" ? body : {};
  const aiOptions = normalizeAiOptions(source.aiOptions);
  const pageType = normalizePageType(source.pageType);
  const taskItemId = normalizeText(source.taskItemId);
  const samplingRecordId = normalizeText(source.samplingRecordId);
  const projectName = normalizeText(source.projectName);
  const audioUrl = normalizeText(source.audioUrl);
  const platformDialectText = normalizeText(source.platformDialectText);
  const platformMandarinText = normalizeText(source.platformMandarinText);

  if (!isHttpUrl(audioUrl)) {
    throw createHttpError(400, "audioUrl 必须是 http/https。", "invalid-audio-url");
  }
  if (!platformDialectText && !platformMandarinText) {
    throw createHttpError(
      400,
      "platformDialectText 和 platformMandarinText 不能同时为空。",
      "missing-platform-text"
    );
  }

  const effectiveTime = normalizeNullableNumber(source.effectiveTime);
  if (effectiveTime !== null && effectiveTime < 0) {
    throw createHttpError(400, "effectiveTime 必须是非负数字。", "invalid-effective-time");
  }

  const fallbackLegacyMode = normalizeRecognitionMode(
    source.aiReviewRecognitionMode || source.aiReviewPipelineMode || source.pipelineMode
  );
  const modelMode = normalizeModelMode(
    source.modelMode || source.aiReviewModelMode || fallbackLegacyMode,
    fallbackLegacyMode
  );
  const recognitionStrategy = normalizeRecognitionStrategy(
    source.recognitionStrategy || source.aiReviewRecognitionStrategy || fallbackLegacyMode,
    fallbackLegacyMode
  );
  const recognitionMode = deriveLegacyRecognitionMode(modelMode, recognitionStrategy);
  const listenModel = sanitizeModelName(
    aiOptions.listenModel || source.listenModel || source.aiReviewListenModel,
    ""
  );
  const compareModel = sanitizeModelName(
    aiOptions.compareModel ||
      aiOptions.reviewModel ||
      source.compareModel ||
      source.reviewModel ||
      source.aiReviewCompareModel,
    ""
  );
  const singleModel = sanitizeModelName(
    aiOptions.singleModel || source.singleModel || source.aiReviewSingleModel,
    ""
  );

  return {
    pageType,
    taskItemId,
    samplingRecordId,
    projectName,
    audioUrl,
    audioDuration: normalizeNullableNumber(source.audioDuration),
    effectiveStartTime: normalizeNullableNumber(source.effectiveStartTime),
    effectiveEndTime: normalizeNullableNumber(source.effectiveEndTime),
    effectiveTime,
    platformDialectText,
    platformMandarinText,
    speaker: {
      gender: normalizeText(source?.speaker?.gender),
      ageRange: normalizeText(source?.speaker?.ageRange),
    },
    modelMode: modelMode,
    recognitionStrategy: recognitionStrategy,
    recognitionMode: recognitionMode,
    pipelineMode: recognitionMode,
    rulesProfile: normalizeText(source.rulesProfile) || "hakka",
    clientVersion: normalizeText(source.clientVersion),
    listenModel: listenModel,
    compareModel: compareModel,
    singleModel: singleModel,
    reviewModel: compareModel,
    reviewMode: normalizeReviewMode(source.reviewMode),
    showHeardText: source.showHeardText !== false,
    enableThinking:
      typeof aiOptions.enable_thinking === "boolean"
        ? aiOptions.enable_thinking === true
        : source.aiReviewEnableThinking === true || source.enableThinking === true,
    aiOptions,
  };
}

module.exports = {
  SCRIPT_ID,
  deriveLegacyRecognitionMode,
  normalizeModelMode,
  normalizeRecognitionStrategy,
  normalizeReviewRequest,
};

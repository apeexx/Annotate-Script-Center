"use strict";

const { SUPPORTED_REQUEST_PARAMS, sanitizeModelName } = require("./ai-client-qwen");

const SCRIPT_ID = "transcription";

function createHttpError(statusCode, message, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code || "";
  return error;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function sanitizeErrorMessage(value) {
  return String(value || "")
    .replace(/https?:\/\/[^\s"'\\]+/g, "[url-redacted]")
    .replace(
      /(token|authorization|cookie|api[_-]?key|signature|ossaccesskeyid)\s*[:=]\s*[^\s,;]+/gi,
      "$1=[redacted]"
    )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

function isHttpUrl(value) {
  try {
    const parsed = new URL(String(value || ""));
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (_error) {
    return false;
  }
}

function parseAudioHostname(audioUrl) {
  try {
    return new URL(String(audioUrl || "")).hostname || "";
  } catch (_error) {
    return "";
  }
}

function normalizeAudioFormat(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) {
    return "wav";
  }
  return text.slice(0, 12);
}

function normalizeAudioCandidates(value) {
  const source = Array.isArray(value) ? value : [];
  const dedup = new Set();
  const list = [];
  source.forEach(function (item, index) {
    const id = normalizeText(item?.id || "") || String.fromCharCode(97 + index);
    const url = normalizeText(item?.url || "");
    const format = normalizeAudioFormat(item?.format || "wav");
    if (!url || dedup.has(url)) {
      return;
    }
    dedup.add(url);
    list.push({ id, url, format, valid: isHttpUrl(url) });
  });
  return list.slice(0, 2);
}

function normalizeTextCandidates(value) {
  const source = Array.isArray(value) ? value : [];
  const dedup = new Set();
  const list = [];
  source.forEach(function (item, index) {
    const id = normalizeText(item?.id || "") || String.fromCharCode(97 + index);
    const text = String(item?.text || "").replace(/\s+/g, " ").trim();
    if (!text || dedup.has(text)) {
      return;
    }
    dedup.add(text);
    list.push({ id, text: text.slice(0, 2000) });
  });
  return list.slice(0, 2);
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

function normalizePromptText(value) {
  return String(value || "").replace(/\r\n/g, "\n").trim().slice(0, 8000);
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
    if (!text || result.length >= 8 || result.indexOf(text) >= 0) {
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
  const comparePrompt = normalizePromptText(source.comparePrompt);
  const listenModel = sanitizeModelName(source.listenModel, "");
  const compareModel = sanitizeModelName(source.compareModel, "");
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
  if (
    SUPPORTED_REQUEST_PARAMS.enable_thinking === true &&
    typeof source.enable_thinking === "boolean"
  ) {
    result.enable_thinking = source.enable_thinking === true;
  }
  return result;
}

function normalizeSuggestRequest(body) {
  const source = body && typeof body === "object" ? body : {};
  const aiOptions = normalizeAiOptions(source.aiOptions);
  const rawAudioCandidates = normalizeAudioCandidates(source.audioCandidates);
  const validAudioCandidates = rawAudioCandidates.filter(function (item) {
    return item.valid === true;
  });
  const textCandidates = normalizeTextCandidates(source.textCandidates);
  const currentText = String(source.currentText || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2000);

  const itemIndex = Number(source.itemIndex);
  if (
    source.itemIndex !== undefined &&
    source.itemIndex !== null &&
    source.itemIndex !== "" &&
    !Number.isFinite(itemIndex)
  ) {
    throw createHttpError(400, "itemIndex 必须是数字。", "invalid-item-index");
  }

  if (validAudioCandidates.length === 0 && textCandidates.length === 0 && !currentText) {
    throw createHttpError(
      400,
      "audioCandidates 与 textCandidates 不能同时为空。",
      "missing-input-candidates"
    );
  }

  return {
    taskItemId: normalizeText(source.taskItemId),
    itemIndex: Number.isFinite(itemIndex) ? itemIndex : 0,
    projectName: normalizeText(source.projectName),
    audioCandidates: validAudioCandidates,
    invalidAudioCount: rawAudioCandidates.length - validAudioCandidates.length,
    textCandidates,
    currentText,
    clientVersion: normalizeText(source.clientVersion),
    listenModel: sanitizeModelName(aiOptions.listenModel || source.listenModel, ""),
    compareModel: sanitizeModelName(aiOptions.compareModel || source.compareModel, ""),
    enableThinking:
      typeof aiOptions.enable_thinking === "boolean"
        ? aiOptions.enable_thinking === true
        : source.enableThinking === true,
    aiOptions,
  };
}

module.exports = {
  SCRIPT_ID,
  createHttpError,
  normalizeAiOptions,
  normalizeSuggestRequest,
  normalizeText,
  parseAudioHostname,
  sanitizeErrorMessage,
};

"use strict";

const { estimateProjectCost } = require("../../../backend/ai/model-pricing");
const { sanitizeProviderDebugJson, sanitizeProviderErrorSummary } = require("../../../backend/ai/sanitizer");

const {
  PUBLIC_ERROR_SUMMARY,
  sanitizePublicErrorCode,
  sanitizePublicMeta,
  sanitizePublicPayload,
  sanitizePublicProviderCode,
} = require("./redaction");
const SCRIPT_ID = "aishellTechEnglishTranscriptionAssistant";
const DEFAULT_TIMEOUT_MS = 60000;
const MAX_CROPPED_WAV_BYTES = 2 * 1024 * 1024;
const DEFAULT_OMNI_MODEL = "qwen3.5-omni-plus";
const SUPPORTED_OMNI_MODELS = ["qwen3.5-omni-plus", "qwen3.5-omni-flash"];
const DEFAULT_OMNI_PARAMS = {
  temperature: 0.1,
  top_p: 0.8,
  max_tokens: 1200,
  max_completion_tokens: "",
  presence_penalty: "",
  frequency_penalty: "",
  seed: "",
  stop: "",
};
const DEFAULT_OMNI_PROMPT = [
  "You are an English audio transcription assistant. Transcribe only the original English spoken in the current clipped audio segment.",
  "Output only the final transcript. Do not output JSON, field names, Markdown, explanations, or any extra text.",
  "Keep the original English exactly as heard. Do not translate, paraphrase, rewrite, complete, delete, normalize punctuation, or infer missing words.",
  "If speakers overlap, the clip is silent, the audio is unclear, or any word cannot be verified, output only #N#.",
  "When outputting #N#, it must be exactly those three characters with no speaker labels, punctuation, or explanation.",
].join("\n");

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeListenText(value) {
  return typeof value === "string" ? value : "";
}

function sanitizeReflectedText(value) {
  const sanitized = sanitizePublicPayload(normalizeText(value));
  return typeof sanitized === "string" ? sanitized : "[redacted-serialized-value]";
}

function createHttpError(statusCode, message, code) {
  const error = new Error(String(message || "Request failed."));
  error.statusCode = Number(statusCode) || 500;
  error.code = normalizeText(code) || "request-failed";
  return error;
}

function normalizeNumber(value, min, max, integer) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    return null;
  }
  return integer === true ? Math.round(number) : number;
}

function normalizeOmniParams(value) {
  const source = value && typeof value === "object" ? value : {};
  const result = {};
  const definitions = [
    ["temperature", 0, 2, false],
    ["top_p", 0, 1, false],
    ["max_tokens", 1, 8192, true],
    ["max_completion_tokens", 1, 8192, true],
    ["presence_penalty", -2, 2, false],
    ["frequency_penalty", -2, 2, false],
    ["seed", 0, 2147483647, true],
  ];
  definitions.forEach(function (definition) {
    const normalized = normalizeNumber(source[definition[0]], definition[1], definition[2], definition[3]);
    if (normalized !== null) {
      result[definition[0]] = normalized;
    }
  });
  const stopSource = Array.isArray(source.stop)
    ? source.stop
    : typeof source.stop === "string"
      ? source.stop.split(/\r?\n|,/)
      : [];
  const stop = stopSource.map(normalizeText).filter(Boolean).slice(0, 8);
  if (stop.length > 0) {
    result.stop = stop;
  }
  return result;
}

function buildOmniDefaults() {
  return {
    model: DEFAULT_OMNI_MODEL,
    prompt: DEFAULT_OMNI_PROMPT,
    params: Object.assign({}, DEFAULT_OMNI_PARAMS),
    enableThinking: false,
  };
}

function normalizeOmniConfig(value) {
  const source = value && typeof value === "object" ? value : {};
  const defaults = buildOmniDefaults();
  const model = normalizeText(source.model);
  const prompt = typeof source.prompt === "string" ? source.prompt : "";
  const sourceParams = source.params && typeof source.params === "object" ? source.params : source;
  return {
    model: SUPPORTED_OMNI_MODELS.includes(model) ? model : defaults.model,
    prompt: normalizeText(prompt) ? prompt : defaults.prompt,
    params: normalizeOmniParams(Object.assign({}, defaults.params, sourceParams)),
    enableThinking: false,
  };
}

function normalizeSegmentNumber(value) {
  const number = Math.round(Number(value));
  return Number.isInteger(number) && number > 0 ? number : 0;
}

function normalizeSegmentRange(source) {
  const startMs = Math.round(Number(source?.startMs));
  const endMs = Math.round(Number(source?.endMs));
  const durationMs = Math.round(Number(source?.durationMs));
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || !Number.isFinite(durationMs) || startMs < 0 || endMs <= startMs) {
    throw createHttpError(400, "The segment start or end time is invalid.", "invalid-segment-range");
  }
  if (durationMs !== endMs - startMs) {
    throw createHttpError(400, "The segment duration does not match its range.", "invalid-segment-duration");
  }
  return { startMs, endMs, durationMs };
}

function createInvalidAudioDataUrlError() {
  return createHttpError(400, "The cropped audio must be a valid 16 kHz mono PCM WAV Data URL.", "invalid-audio-data-url");
}

function validateCroppedPcmWav(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 44 || bytes.length > MAX_CROPPED_WAV_BYTES) {
    throw createInvalidAudioDataUrlError();
  }
  if (bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WAVE") {
    throw createInvalidAudioDataUrlError();
  }
  if (bytes.readUInt32LE(4) !== bytes.length - 8) {
    throw createInvalidAudioDataUrlError();
  }

  let cursor = 12;
  let fmtChunk = null;
  let dataChunk = null;
  while (cursor < bytes.length) {
    if (cursor + 8 > bytes.length) {
      throw createInvalidAudioDataUrlError();
    }
    const id = bytes.toString("ascii", cursor, cursor + 4);
    const size = bytes.readUInt32LE(cursor + 4);
    const start = cursor + 8;
    const end = start + size;
    if (end > bytes.length) {
      throw createInvalidAudioDataUrlError();
    }
    if (id === "fmt ") {
      if (fmtChunk) throw createInvalidAudioDataUrlError();
      fmtChunk = { start, size };
    } else if (id === "data") {
      if (dataChunk) throw createInvalidAudioDataUrlError();
      dataChunk = { start, size };
    }
    cursor = end + (size % 2);
    if (cursor > bytes.length) {
      throw createInvalidAudioDataUrlError();
    }
  }
  if (cursor !== bytes.length || !fmtChunk || !dataChunk || fmtChunk.start > dataChunk.start || fmtChunk.size < 16 || dataChunk.size <= 0) {
    throw createInvalidAudioDataUrlError();
  }

  const format = bytes.readUInt16LE(fmtChunk.start);
  const channels = bytes.readUInt16LE(fmtChunk.start + 2);
  const sampleRate = bytes.readUInt32LE(fmtChunk.start + 4);
  const byteRate = bytes.readUInt32LE(fmtChunk.start + 8);
  const blockAlign = bytes.readUInt16LE(fmtChunk.start + 12);
  const bitsPerSample = bytes.readUInt16LE(fmtChunk.start + 14);
  const bytesPerSample = bitsPerSample / 8;
  if (
    format !== 1 ||
    channels !== 1 ||
    sampleRate !== 16000 ||
    ![8, 16, 24, 32].includes(bitsPerSample) ||
    !Number.isInteger(bytesPerSample) ||
    blockAlign !== channels * bytesPerSample ||
    byteRate !== sampleRate * blockAlign ||
    dataChunk.size % blockAlign !== 0
  ) {
    throw createInvalidAudioDataUrlError();
  }
}

function normalizeAudioDataUrl(value) {
  const audioDataUrl = normalizeText(value);
  if (!audioDataUrl) {
    throw createHttpError(400, "The cropped WAV audio is required.", "missing-audio-data-url");
  }
  const match = audioDataUrl.match(/^data:audio\/(?:wav|x-wav|wave);base64,([a-z0-9+/]+={0,2})$/i);
  if (!match || match[1].length % 4 !== 0) {
    throw createInvalidAudioDataUrlError();
  }
  let bytes;
  try {
    bytes = Buffer.from(match[1], "base64");
  } catch (_error) {
    throw createInvalidAudioDataUrlError();
  }
  if (bytes.length === 0 || bytes.toString("base64") !== match[1]) {
    throw createInvalidAudioDataUrlError();
  }
  validateCroppedPcmWav(bytes);
  return audioDataUrl;
}

function normalizeRecommendRequest(value) {
  const source = value && typeof value === "object" ? value : {};
  const taskId = normalizeText(source.taskId);
  const packageId = normalizeText(source.packageId);
  const taskItemId = normalizeText(source.taskItemId || source.itemId);
  const audioDataUrl = normalizeAudioDataUrl(source.audioDataUrl);
  const regionId = normalizeText(source.regionId);
  const segmentNumber = normalizeSegmentNumber(source.segmentNumber);
  const segmentRange = normalizeSegmentRange(source);
  const selectionKey = normalizeText(source.selectionKey);
  if (!taskItemId) {
    throw createHttpError(400, "taskItemId is required.", "missing-task-item-id");
  }
  if (!taskId || !packageId) {
    throw createHttpError(400, "The task and package identity are required.", "missing-task-context");
  }
  if (!regionId || !segmentNumber || !selectionKey) {
    throw createHttpError(400, "The selected segment identity is required.", "missing-segment-identity");
  }
  if (selectionKey !== regionId + ":" + String(segmentRange.startMs) + "-" + String(segmentRange.endMs)) {
    throw createHttpError(400, "The selected segment identity does not match its range.", "invalid-segment-identity");
  }
  return {
    requestId: normalizeText(source.requestId || source.clientRequestId),
    taskId,
    packageId,
    taskItemId,
    fileName: normalizeText(source.fileName),
    audioDataUrl,
    regionId,
    segmentNumber,
    startMs: segmentRange.startMs,
    endMs: segmentRange.endMs,
    durationMs: segmentRange.durationMs,
    selectionKey,
    referenceText: normalizeText(source.referenceText),
    existingMarkText: normalizeText(source.existingMarkText || source.currentInputText),
    duration: Math.max(0, Number(source.duration || 0) || 0),
    itemNumber: Math.max(0, Number(source.itemNumber ?? source.number) || 0),
    aiUsageOperatorName: normalizeText(source.aiUsageOperatorName).slice(0, 40),
    platformUserName: normalizeText(source.platformUserName).slice(0, 80),
    platformUserId: normalizeText(source.platformUserId).slice(0, 120),
    frontConcurrency: Math.max(0, Number(source.frontConcurrency || source.batchConcurrency) || 0),
    timeoutMs: Math.max(1000, Math.min(DEFAULT_TIMEOUT_MS, Number(source.timeoutMs) || DEFAULT_TIMEOUT_MS)),
    pipelineMode: "omni_single_raw_listen",
    recognitionStrategy: "english_raw_listen",
    aiOmni: normalizeOmniConfig(source.aiOmni),
  };
}

function buildUsageMeta(model, usage) {
  const source = usage && typeof usage === "object" ? usage : {};
  const promptTokens = Number(source.prompt_tokens || source.input_tokens || source.promptTokens || 0) || 0;
  const completionTokens = Number(source.completion_tokens || source.output_tokens || source.completionTokens || 0) || 0;
  const totalTokens = Number(source.total_tokens || source.totalTokens || 0) || promptTokens + completionTokens;
  const normalizedUsage = { promptTokens, completionTokens, totalTokens, raw: source };
  return {
    usage: normalizedUsage,
    cost: estimateProjectCost({ omni: { modelId: model, usage: normalizedUsage, outputMode: "text" } }),
  };
}

function createDefaultsPayload() {
  return {
    success: true,
    scriptId: SCRIPT_ID,
    defaults: { timeoutMs: DEFAULT_TIMEOUT_MS, aiOmni: buildOmniDefaults() },
    supportedModels: { omni: SUPPORTED_OMNI_MODELS.slice() },
    supportedParams: {
      temperature: true,
      top_p: true,
      max_tokens: true,
      max_completion_tokens: true,
      presence_penalty: true,
      frequency_penalty: true,
      seed: true,
      stop: true,
      enable_thinking: false,
    },
    contract: {
      stages: ["omni"],
      outputField: "listenText",
      outputMode: "raw-text",
      enableThinking: false,
    },
  };
}

function createHealthPayload() {
  return Object.assign({}, createDefaultsPayload(), {
    service: "aishell-tech-english-transcription-helper-ai-recommend",
    route: "aishell-tech/english-transcription-helper/ai/recommend",
  });
}

function buildRecommendSuccessBody(value) {
  const source = value && typeof value === "object" ? value : {};
  const data = source.data && typeof source.data === "object" ? source.data : {};
  const meta = source.meta && typeof source.meta === "object" ? source.meta : {};
  return {
    success: true,
    data: {
      taskId: sanitizeReflectedText(data.taskId),
      packageId: sanitizeReflectedText(data.packageId),
      taskItemId: sanitizeReflectedText(data.taskItemId),
      fileName: sanitizeReflectedText(data.fileName),
      referenceText: sanitizeReflectedText(data.referenceText),
      existingMarkText: sanitizeReflectedText(data.existingMarkText),
      regionId: sanitizeReflectedText(data.regionId),
      segmentNumber: normalizeSegmentNumber(data.segmentNumber),
      startMs: Math.max(0, Math.round(Number(data.startMs) || 0)),
      endMs: Math.max(0, Math.round(Number(data.endMs) || 0)),
      durationMs: Math.max(0, Math.round(Number(data.durationMs) || 0)),
      selectionKey: sanitizeReflectedText(data.selectionKey),
      listenText: normalizeListenText(data.listenText),
      needHumanReview: data.needHumanReview === true,
    },
    meta: sanitizePublicMeta(meta),
  };
}

function buildRecommendErrorBody(value) {
  const source = value && typeof value === "object" ? value : {};
  const error = source.error && typeof source.error === "object" ? source.error : {};
  return {
    success: false,
    error: {
      code: sanitizePublicErrorCode(error.code),
      message: "English transcription request failed.",
      stage: normalizeText(error.stage) || "recognize",
      retryable: error.retryable === true,
      providerStatus: Number(error.providerStatus || error.statusCode || 0) || 0,
      providerCode: sanitizePublicProviderCode(error.providerCode),
      summary: PUBLIC_ERROR_SUMMARY,
    },
    meta: sanitizePublicMeta(error.meta && typeof error.meta === "object" ? error.meta : {}),
  };
}

module.exports = {
  DEFAULT_OMNI_MODEL,
  DEFAULT_OMNI_PROMPT,
  DEFAULT_TIMEOUT_MS,
  SCRIPT_ID,
  SUPPORTED_OMNI_MODELS,
  buildOmniDefaults,
  buildRecommendErrorBody,
  buildRecommendSuccessBody,
  buildUsageMeta,
  createDefaultsPayload,
  createHealthPayload,
  createHttpError,
  normalizeOmniConfig,
  normalizeRecommendRequest,
};

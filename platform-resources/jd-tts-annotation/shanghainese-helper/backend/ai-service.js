"use strict";

const { estimateProjectCost } = require("../../../backend/ai/model-pricing");
const { DEFAULT_TIMEOUT_MS } = require("./config");

const SCRIPT_ID = "jdTtsShanghaineseAssistant";
const DEFAULT_OMNI_MODEL = "qwen3.5-omni-plus";
const SUPPORTED_OMNI_MODELS = ["qwen3.5-omni-plus", "qwen3.5-omni-flash"];
const DEFAULT_OMNI_PARAMS = { temperature: 0.1, top_p: 0.8, max_tokens: 1200 };
const DEFAULT_OMNI_PROMPT = [
  "你是上海话音频识别助手。只输出当前音频中实际听到的上海话文本。",
  "只输出最终转写文本；不得输出 JSON、字段名、Markdown、解释或额外文字。",
  "不翻译成普通话，不润色、不补写、不删减、不改数字、不转换繁简。",
  "纯静音或完全听不清时，直接输出空字符串。",
].join("\n");

function normalizeText(value) {
  return String(value || "").trim();
}

function createHttpError(statusCode, message, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function normalizeUtteranceId(value) {
  const text = normalizeText(value);
  if (!/^\d+$/.test(text)) {
    throw createHttpError(400, "utteranceId 必须是数字字符串。", "invalid-utterance-id");
  }
  return text;
}

function normalizeChecksum(value) {
  const text = normalizeText(value);
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(text)) {
    throw createHttpError(400, "checksum 无效。", "invalid-checksum");
  }
  return text;
}

function normalizeAudioDataUrl(value) {
  const text = normalizeText(value);
  if (!/^data:audio\/(?:wav|x-wav|wave);base64,[A-Za-z0-9+/=]+$/i.test(text)) {
    throw createHttpError(400, "音频必须是 WAV Base64 Data URL。", "invalid-audio-data-url");
  }
  return text;
}

function normalizeNumber(value, min, max, integer) {
  if (value === "" || value === undefined || value === null) {
    return null;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    return null;
  }
  return integer ? Math.round(number) : number;
}

function normalizeOmniParams(value) {
  const source = value && typeof value === "object" ? value : {};
  const result = {};
  [["temperature", 0, 2, false], ["top_p", 0, 1, false], ["max_tokens", 1, 8192, true], ["max_completion_tokens", 1, 8192, true], ["presence_penalty", -2, 2, false], ["frequency_penalty", -2, 2, false], ["seed", 0, 2147483647, true]].forEach(function (definition) {
    const normalized = normalizeNumber(source[definition[0]], definition[1], definition[2], definition[3]);
    if (normalized !== null) {
      result[definition[0]] = normalized;
    }
  });
  const stops = [];
  (Array.isArray(source.stop) ? source.stop : typeof source.stop === "string" ? source.stop.split(/\r?\n|,/) : [])
    .forEach(function (item) {
      const stop = normalizeText(item).slice(0, 80);
      if (stop && !stops.includes(stop) && stops.length < 8) {
        stops.push(stop);
      }
    });
  if (stops.length) {
    result.stop = stops;
  }
  return result;
}

function buildOmniDefaults() {
  return { model: DEFAULT_OMNI_MODEL, prompt: DEFAULT_OMNI_PROMPT, params: Object.assign({}, DEFAULT_OMNI_PARAMS), enableThinking: false };
}

function normalizeOmniConfig(value) {
  const source = value && typeof value === "object" ? value : {};
  const defaults = buildOmniDefaults();
  const model = normalizeText(source.model);
  return {
    model: SUPPORTED_OMNI_MODELS.includes(model) ? model : defaults.model,
    prompt: (normalizeText(source.prompt) || defaults.prompt).slice(0, 8000),
    params: normalizeOmniParams(Object.assign({}, defaults.params, source.params || source)),
    enableThinking: false,
  };
}

function normalizeRecommendRequest(value) {
  const source = value && typeof value === "object" ? value : {};
  if (Object.prototype.hasOwnProperty.call(source, "audioUrl")) {
    throw createHttpError(400, "请求不得携带音频地址。", "unexpected-audio-url");
  }
  return {
    requestId: normalizeText(source.requestId || source.clientRequestId),
    clientRequestId: normalizeText(source.clientRequestId),
    utteranceId: normalizeUtteranceId(source.utteranceId),
    checksum: normalizeChecksum(source.checksum),
    audioDataUrl: normalizeAudioDataUrl(source.audioDataUrl),
    aiOmni: normalizeOmniConfig(source.aiOmni),
    aiUsageOperatorName: normalizeText(source.aiUsageOperatorName).slice(0, 40),
    platformUserName: normalizeText(source.platformUserName).slice(0, 80),
    platformUserId: normalizeText(source.platformUserId).slice(0, 120),
    timeoutMs: DEFAULT_TIMEOUT_MS,
    pipelineMode: "omni_single_raw_listen",
  };
}

function buildUsageMeta(model, usage) {
  const source = usage && typeof usage === "object" ? usage : {};
  const promptTokens = Number(source.prompt_tokens || source.input_tokens || source.promptTokens || 0) || 0;
  const completionTokens = Number(source.completion_tokens || source.output_tokens || source.completionTokens || 0) || 0;
  const totalTokens = Number(source.total_tokens || source.totalTokens || 0) || promptTokens + completionTokens;
  const normalizedUsage = { promptTokens, completionTokens, totalTokens, raw: source };
  return { usage: normalizedUsage, cost: estimateProjectCost({ omni: { modelId: model, usage: normalizedUsage, outputMode: "text" } }) };
}

function createDefaultsPayload() {
  return {
    success: true,
    scriptId: SCRIPT_ID,
    defaults: { timeoutMs: DEFAULT_TIMEOUT_MS, aiOmni: buildOmniDefaults() },
    supportedModels: { omni: SUPPORTED_OMNI_MODELS.slice() },
    supportedParams: { temperature: true, top_p: true, max_tokens: true, max_completion_tokens: true, presence_penalty: true, frequency_penalty: true, seed: true, stop: true, enable_thinking: false },
    contract: { stages: ["omni"], outputField: "listenText", outputMode: "raw-text", enableThinking: false },
  };
}

function createHealthPayload() {
  return Object.assign({}, createDefaultsPayload(), { service: "jd-tts-shanghainese-helper-ai-recommend", route: "jd-tts-annotation/shanghainese-helper/ai/recommend" });
}

function buildRecommendSuccessBody(value) {
  const data = value?.data && typeof value.data === "object" ? value.data : {};
  return { success: true, data: { utteranceId: normalizeText(data.utteranceId), checksum: normalizeText(data.checksum), listenText: typeof data.listenText === "string" ? data.listenText : "", needHumanReview: data.needHumanReview === true }, meta: value?.meta && typeof value.meta === "object" ? value.meta : {} };
}

function buildRecommendErrorBody(value) {
  const error = value?.error && typeof value.error === "object" ? value.error : {};
  return { success: false, error: { code: normalizeText(error.code) || "request-error", message: normalizeText(error.safeMessage || error.message) || "京东 TTS 上海话识别失败。", stage: normalizeText(error.stage) || "recognize", retryable: error.retryable === true, providerStatus: Number(error.providerStatus || error.statusCode || 0) || 0 }, meta: error.meta && typeof error.meta === "object" ? error.meta : {} };
}

module.exports = { SCRIPT_ID, DEFAULT_TIMEOUT_MS, DEFAULT_OMNI_MODEL, DEFAULT_OMNI_PROMPT, SUPPORTED_OMNI_MODELS, createHttpError, buildOmniDefaults, normalizeOmniConfig, normalizeRecommendRequest, buildUsageMeta, createDefaultsPayload, createHealthPayload, buildRecommendSuccessBody, buildRecommendErrorBody };

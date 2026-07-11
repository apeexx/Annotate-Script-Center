"use strict";

const {
  DEFAULT_COMPARE_MODEL,
  DEFAULT_FUN_ASR_MODEL,
  DEFAULT_OMNI_MODEL,
  DATABAKER_COMPARE_MODEL_OPTIONS,
  DATABAKER_LISTEN_MODEL_OPTIONS,
  DATABAKER_SINGLE_MODEL_OPTIONS,
  DEFAULT_REQUEST_PARAMS,
  deriveDataBakerPipelineMode,
  getQwenProviderConfig,
  normalizeDataBakerCompareModel,
  normalizeDataBakerListenModel,
  normalizeDataBakerSingleModel,
} = require("../../../backend/ai/config");

const DEFAULT_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const AISHELL_DEFAULT_TIMEOUT_MS = 60000;
const DEFAULT_AUDIO_FIRST_REFERENCE_CORRECTION_THRESHOLD = 0.75;
const DEFAULT_QUEUE_MAX_SIZE = 600;
const DEFAULT_RETRY_MAX = 3;
const DEFAULT_QWEN_BURST_RETRY_MAX = 0;
const DEFAULT_RETRY_BASE_DELAY_MS = 1200;
const DEFAULT_RETRY_MAX_DELAY_MS = 12000;
const DEFAULT_GROUP_SETTINGS = {
  aishell_qwen_omni: {
    rpmKeys: ["AISHELL_AI_QWEN_OMNI_RPM_LIMIT", "DATABAKER_AI_QWEN_OMNI_RPM_LIMIT"],
    rpm: 45,
    concurrencyKeys: ["AISHELL_AI_QWEN_OMNI_CONCURRENCY", "DATABAKER_AI_QWEN_OMNI_CONCURRENCY"],
    maxConcurrent: 3,
  },
  aishell_fun_asr: {
    rpmKeys: ["AISHELL_AI_FUN_ASR_RPM_LIMIT", "DATABAKER_AI_FUN_ASR_RPM_LIMIT"],
    rpm: 500,
    concurrencyKeys: ["AISHELL_AI_FUN_ASR_CONCURRENCY", "DATABAKER_AI_FUN_ASR_CONCURRENCY"],
    maxConcurrent: 2,
  },
  aishell_text_compare: {
    rpmKeys: ["AISHELL_AI_TEXT_RPM_LIMIT", "DATABAKER_AI_TEXT_RPM_LIMIT"],
    rpm: 500,
    concurrencyKeys: ["AISHELL_AI_TEXT_CONCURRENCY", "DATABAKER_AI_TEXT_CONCURRENCY"],
    maxConcurrent: 5,
  },
};

function readEnvValue(keys, fallback) {
  const list = Array.isArray(keys) ? keys : [keys];
  for (let index = 0; index < list.length; index += 1) {
    const key = String(list[index] || "").trim();
    if (!key) {
      continue;
    }
    const value = process.env[key];
    if (value !== undefined && String(value).trim() !== "") {
      return value;
    }
  }
  return fallback;
}

function parsePositiveInteger(value, fallback, min, max) {
  const numericValue = Math.floor(Number(value));
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, numericValue));
}

function parseTimeoutMs() {
  const raw = readEnvValue(["AISHELL_AI_TIMEOUT_MS", "DATABAKER_AI_TIMEOUT_MS"], AISHELL_DEFAULT_TIMEOUT_MS);
  return parsePositiveInteger(raw, AISHELL_DEFAULT_TIMEOUT_MS, 1000, 300000);
}

function parseCacheTtlMs() {
  const raw = readEnvValue(["AISHELL_AI_CACHE_TTL_MS", "DATABAKER_AI_CACHE_TTL_MS"], DEFAULT_CACHE_TTL_MS);
  return parsePositiveInteger(raw, DEFAULT_CACHE_TTL_MS, 1000, 7 * 24 * 60 * 60 * 1000);
}

function getQueueMaxSize() {
  const raw = readEnvValue(["AISHELL_AI_QUEUE_MAX_SIZE", "DATABAKER_AI_QUEUE_MAX_SIZE"], DEFAULT_QUEUE_MAX_SIZE);
  return parsePositiveInteger(raw, DEFAULT_QUEUE_MAX_SIZE, 1, 5000);
}

function getRetryMax() {
  const raw = readEnvValue(["AISHELL_AI_PROVIDER_RETRY_MAX", "DATABAKER_AI_PROVIDER_RETRY_MAX"], DEFAULT_RETRY_MAX);
  return parsePositiveInteger(raw, DEFAULT_RETRY_MAX, 0, 10);
}

function getRetryBaseDelayMs() {
  const raw = readEnvValue(
    ["AISHELL_AI_PROVIDER_RETRY_BASE_DELAY_MS", "DATABAKER_AI_PROVIDER_RETRY_BASE_DELAY_MS"],
    DEFAULT_RETRY_BASE_DELAY_MS
  );
  return parsePositiveInteger(raw, DEFAULT_RETRY_BASE_DELAY_MS, 100, 60000);
}

function getRetryMaxDelayMs() {
  const raw = readEnvValue(
    ["AISHELL_AI_PROVIDER_RETRY_MAX_DELAY_MS", "DATABAKER_AI_PROVIDER_RETRY_MAX_DELAY_MS"],
    DEFAULT_RETRY_MAX_DELAY_MS
  );
  return parsePositiveInteger(raw, DEFAULT_RETRY_MAX_DELAY_MS, 100, 120000);
}

function getQwenBurstRetryMax() {
  const raw = readEnvValue(
    ["AISHELL_AI_QWEN_BURST_RETRY_MAX", "DATABAKER_AI_QWEN_BURST_RETRY_MAX"],
    DEFAULT_QWEN_BURST_RETRY_MAX
  );
  return parsePositiveInteger(raw, DEFAULT_QWEN_BURST_RETRY_MAX, 0, 10);
}

function getQwenBurstRetryBaseMs() {
  const raw = readEnvValue(
    ["AISHELL_AI_QWEN_BURST_RETRY_BASE_MS", "DATABAKER_AI_QWEN_BURST_RETRY_BASE_MS"],
    DEFAULT_RETRY_BASE_DELAY_MS
  );
  return parsePositiveInteger(raw, DEFAULT_RETRY_BASE_DELAY_MS, 100, 60000);
}

function getQueueGroupSettings(groupName) {
  const preset = DEFAULT_GROUP_SETTINGS[groupName] || DEFAULT_GROUP_SETTINGS.aishell_text_compare;
  const rpm = parsePositiveInteger(readEnvValue(preset.rpmKeys, preset.rpm), preset.rpm, 1, 10000);
  const maxConcurrent = parsePositiveInteger(
    readEnvValue(preset.concurrencyKeys, preset.maxConcurrent),
    preset.maxConcurrent,
    1,
    20
  );
  const isQwenGroup = groupName === "aishell_qwen_omni" || groupName === "aishell_text_compare";
  return {
    groupName,
    rpm,
    intervalMs: Math.max(1, Math.ceil(60000 / rpm)),
    maxConcurrent,
    maxSize: getQueueMaxSize(),
    retryMax: isQwenGroup ? getQwenBurstRetryMax() : getRetryMax(),
    retryBaseDelayMs: isQwenGroup ? getQwenBurstRetryBaseMs() : getRetryBaseDelayMs(),
    retryMaxDelayMs: getRetryMaxDelayMs(),
  };
}

function normalizeModelMode(value, fallback) {
  const text = String(value || "").trim().toLowerCase();
  if (text === "omni_single") {
    return "omni_single";
  }
  if (text === "two_stage") {
    return "two_stage";
  }
  return String(fallback || "two_stage").trim().toLowerCase() === "omni_single"
    ? "omni_single"
    : "two_stage";
}

function normalizeRecognitionStrategy(value, fallback) {
  const text = String(value || "").trim().toLowerCase();
  if (text === "audio_first_reference") {
    return "audio_first_reference";
  }
  if (
    text === "mandarin_to_dialect" ||
    text === "recognition_convert" ||
    text === "direct_dialect"
  ) {
    return "audio_first_reference";
  }
  return "audio_first_reference";
}

function resolveDefaultListenModel(modelMode) {
  const config = getQwenProviderConfig();
  if (normalizeModelMode(modelMode, "two_stage") === "omni_single") {
    return normalizeDataBakerListenModel(DEFAULT_OMNI_MODEL, config.omniModel || DEFAULT_OMNI_MODEL);
  }
  return normalizeDataBakerListenModel(config.omniModel || DEFAULT_OMNI_MODEL, DEFAULT_OMNI_MODEL);
}

function resolveDefaultCompareModel() {
  const compareModel = readEnvValue(
    ["AISHELL_AI_COMPARE_MODEL", "DATABAKER_AI_COMPARE_MODEL"],
    DEFAULT_COMPARE_MODEL
  );
  return normalizeDataBakerCompareModel(compareModel, DEFAULT_COMPARE_MODEL);
}

function resolveDefaultCandidateModel() {
  const candidateModel = readEnvValue(
    [
      "AISHELL_AI_CANDIDATE_MODEL",
      "DATABAKER_AI_CANDIDATE_MODEL",
      "AISHELL_AI_COMPARE_MODEL",
      "DATABAKER_AI_COMPARE_MODEL",
    ],
    DEFAULT_COMPARE_MODEL
  );
  return normalizeDataBakerCompareModel(candidateModel, DEFAULT_COMPARE_MODEL);
}

function resolveDefaultSingleModel() {
  const config = getQwenProviderConfig();
  return normalizeDataBakerSingleModel(config.omniModel || DEFAULT_OMNI_MODEL, DEFAULT_OMNI_MODEL);
}

function derivePipelineMode(modelMode, listenModel, singleModel) {
  return deriveDataBakerPipelineMode(
    normalizeModelMode(modelMode, "two_stage"),
    normalizeModelMode(modelMode, "two_stage") === "omni_single"
      ? normalizeDataBakerSingleModel(singleModel, DEFAULT_OMNI_MODEL)
      : normalizeDataBakerListenModel(listenModel, DEFAULT_OMNI_MODEL)
  );
}

function getQueueGroupsHealth() {
  return {
    qwen_omni: {
      name: "aishell_qwen_omni",
      settings: getQueueGroupSettings("aishell_qwen_omni"),
    },
    fun_asr: {
      name: "aishell_fun_asr",
      settings: getQueueGroupSettings("aishell_fun_asr"),
    },
    text_compare: {
      name: "aishell_text_compare",
      settings: getQueueGroupSettings("aishell_text_compare"),
    },
  };
}

module.exports = {
  DEFAULT_AUDIO_FIRST_REFERENCE_CORRECTION_THRESHOLD,
  DEFAULT_COMPARE_MODEL,
  DEFAULT_FUN_ASR_MODEL,
  DEFAULT_OMNI_MODEL,
  DEFAULT_REQUEST_PARAMS,
  DATABAKER_COMPARE_MODEL_OPTIONS,
  DATABAKER_LISTEN_MODEL_OPTIONS,
  DATABAKER_SINGLE_MODEL_OPTIONS,
  derivePipelineMode,
  getQueueGroupSettings,
  getQueueGroupsHealth,
  normalizeDataBakerCompareModel,
  normalizeDataBakerListenModel,
  normalizeDataBakerSingleModel,
  normalizeModelMode,
  normalizeRecognitionStrategy,
  parseCacheTtlMs,
  resolveDefaultCandidateModel,
  parseTimeoutMs,
  resolveDefaultCompareModel,
  resolveDefaultListenModel,
  resolveDefaultSingleModel,
};

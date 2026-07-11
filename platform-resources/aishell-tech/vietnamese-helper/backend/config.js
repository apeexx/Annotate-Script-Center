"use strict";

const {
  DEFAULT_OMNI_MODEL,
  DATABAKER_SINGLE_MODEL_OPTIONS,
  DEFAULT_REQUEST_PARAMS,
  getQwenProviderConfig,
  normalizeDataBakerSingleModel,
} = require("../../../backend/ai/config");

const DEFAULT_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const AISHELL_VIETNAMESE_DEFAULT_TIMEOUT_MS = 60000;
const DEFAULT_QUEUE_MAX_SIZE = 600;
const DEFAULT_RETRY_MAX = 1;
const DEFAULT_RETRY_BASE_DELAY_MS = 1200;
const DEFAULT_RETRY_MAX_DELAY_MS = 12000;
const DEFAULT_GROUP_SETTINGS = {
  aishell_qwen_omni: {
    rpmKeys: [
      "AISHELL_VIETNAMESE_AI_QWEN_OMNI_RPM_LIMIT",
      "AISHELL_AI_QWEN_OMNI_RPM_LIMIT",
      "DATABAKER_AI_QWEN_OMNI_RPM_LIMIT",
    ],
    rpm: 45,
    concurrencyKeys: [
      "AISHELL_VIETNAMESE_AI_QWEN_OMNI_CONCURRENCY",
      "AISHELL_AI_QWEN_OMNI_CONCURRENCY",
      "DATABAKER_AI_QWEN_OMNI_CONCURRENCY",
    ],
    maxConcurrent: 3,
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
  const raw = readEnvValue(
    [
      "AISHELL_VIETNAMESE_AI_TIMEOUT_MS",
      "AISHELL_AI_TIMEOUT_MS",
      "DATABAKER_AI_TIMEOUT_MS",
    ],
    AISHELL_VIETNAMESE_DEFAULT_TIMEOUT_MS
  );
  return parsePositiveInteger(raw, AISHELL_VIETNAMESE_DEFAULT_TIMEOUT_MS, 1000, 300000);
}

function parseCacheTtlMs() {
  const raw = readEnvValue(
    [
      "AISHELL_VIETNAMESE_AI_CACHE_TTL_MS",
      "AISHELL_AI_CACHE_TTL_MS",
      "DATABAKER_AI_CACHE_TTL_MS",
    ],
    DEFAULT_CACHE_TTL_MS
  );
  return parsePositiveInteger(raw, DEFAULT_CACHE_TTL_MS, 1000, 7 * 24 * 60 * 60 * 1000);
}

function getQueueMaxSize() {
  const raw = readEnvValue(
    [
      "AISHELL_VIETNAMESE_AI_QUEUE_MAX_SIZE",
      "AISHELL_AI_QUEUE_MAX_SIZE",
      "DATABAKER_AI_QUEUE_MAX_SIZE",
    ],
    DEFAULT_QUEUE_MAX_SIZE
  );
  return parsePositiveInteger(raw, DEFAULT_QUEUE_MAX_SIZE, 1, 5000);
}

function getRetryMax() {
  const raw = readEnvValue(
    [
      "AISHELL_VIETNAMESE_AI_PROVIDER_RETRY_MAX",
      "AISHELL_AI_PROVIDER_RETRY_MAX",
      "DATABAKER_AI_PROVIDER_RETRY_MAX",
    ],
    DEFAULT_RETRY_MAX
  );
  return parsePositiveInteger(raw, DEFAULT_RETRY_MAX, 0, 10);
}

function getRetryBaseDelayMs() {
  const raw = readEnvValue(
    [
      "AISHELL_VIETNAMESE_AI_PROVIDER_RETRY_BASE_DELAY_MS",
      "AISHELL_AI_PROVIDER_RETRY_BASE_DELAY_MS",
      "DATABAKER_AI_PROVIDER_RETRY_BASE_DELAY_MS",
    ],
    DEFAULT_RETRY_BASE_DELAY_MS
  );
  return parsePositiveInteger(raw, DEFAULT_RETRY_BASE_DELAY_MS, 100, 60000);
}

function getRetryMaxDelayMs() {
  const raw = readEnvValue(
    [
      "AISHELL_VIETNAMESE_AI_PROVIDER_RETRY_MAX_DELAY_MS",
      "AISHELL_AI_PROVIDER_RETRY_MAX_DELAY_MS",
      "DATABAKER_AI_PROVIDER_RETRY_MAX_DELAY_MS",
    ],
    DEFAULT_RETRY_MAX_DELAY_MS
  );
  return parsePositiveInteger(raw, DEFAULT_RETRY_MAX_DELAY_MS, 100, 120000);
}

function getQueueGroupSettings(groupName) {
  const preset = DEFAULT_GROUP_SETTINGS[groupName] || DEFAULT_GROUP_SETTINGS.aishell_qwen_omni;
  const rpm = parsePositiveInteger(readEnvValue(preset.rpmKeys, preset.rpm), preset.rpm, 1, 10000);
  const maxConcurrent = parsePositiveInteger(
    readEnvValue(preset.concurrencyKeys, preset.maxConcurrent),
    preset.maxConcurrent,
    1,
    20
  );
  return {
    groupName,
    rpm,
    intervalMs: Math.max(1, Math.ceil(60000 / rpm)),
    maxConcurrent,
    maxSize: getQueueMaxSize(),
    retryMax: getRetryMax(),
    retryBaseDelayMs: getRetryBaseDelayMs(),
    retryMaxDelayMs: getRetryMaxDelayMs(),
  };
}

function resolveDefaultSingleModel() {
  const config = getQwenProviderConfig();
  const model = readEnvValue(
    [
      "AISHELL_VIETNAMESE_AI_SINGLE_MODEL",
      "AISHELL_VIETNAMESE_AI_OMNI_MODEL",
      "AISHELL_AI_OMNI_MODEL",
      "DATABAKER_AI_OMNI_MODEL",
    ],
    config.omniModel || DEFAULT_OMNI_MODEL
  );
  return normalizeDataBakerSingleModel(model, config.omniModel || DEFAULT_OMNI_MODEL);
}

function getQueueGroupsHealth() {
  return {
    qwen_omni: {
      name: "aishell_qwen_omni",
      settings: getQueueGroupSettings("aishell_qwen_omni"),
    },
  };
}

module.exports = {
  AISHELL_VIETNAMESE_DEFAULT_TIMEOUT_MS,
  DEFAULT_OMNI_MODEL,
  DEFAULT_REQUEST_PARAMS,
  DATABAKER_SINGLE_MODEL_OPTIONS,
  getQueueGroupSettings,
  getQueueGroupsHealth,
  normalizeDataBakerSingleModel,
  parseCacheTtlMs,
  parseTimeoutMs,
  resolveDefaultSingleModel,
};

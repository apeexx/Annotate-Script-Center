"use strict";

const path = require("path");
const {
  buildModelOptionsByFamily,
  getModelDocs,
  getModelMeta,
  getRecommendedModelsByFamily,
  listAllModels,
  listModelIdsByFamily,
} = require("./model-catalog");

const DEFAULT_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";
const DEFAULT_OMNI_MODEL = "qwen3.5-omni-flash";
const DEFAULT_COMPARE_MODEL = "qwen3.5-plus";
const DEFAULT_FUN_ASR_MODEL = "fun-asr";
const DEFAULT_FUN_ASR_PROVIDER = "rest";
const DEFAULT_FUN_ASR_REST_POLL_INTERVAL_MS = 1000;
const DEFAULT_JOB_TIMEOUT_MS = 60000;
const DEFAULT_JOB_TTL_MS = 1800000;
const DATABAKER_FUN_ASR_AUTOFILL_RULE = {
  min: 1,
  max: 50,
  defaultValue: 5,
  modelType: "fun_asr",
};
const DATABAKER_OMNI_AUTOFILL_RULE = {
  min: 1,
  max: 25,
  defaultValue: 5,
  modelType: "omni",
};
const DATABAKER_OMNI_MODEL_OPTIONS = listModelIdsByFamily("omni");
const LEGACY_OMNI_COMPATIBILITY_MODEL_OPTIONS = [
  "qwen3.5-omni-flash-2026-03-15",
  "qwen3-omni-flash",
  "qwen3-omni-flash-2025-12-01",
  "qwen3-omni-flash-2025-09-15",
];
const DATABAKER_LISTEN_MODEL_OPTIONS = [
  "fun-asr",
].concat(DATABAKER_OMNI_MODEL_OPTIONS);
const DATABAKER_SINGLE_MODEL_OPTIONS = DATABAKER_OMNI_MODEL_OPTIONS.slice();
const DATABAKER_COMPARE_MODEL_OPTIONS = listModelIdsByFamily("text");
const DEFAULT_TIMEOUT_MS = 60000;
const DEFAULT_REQUEST_PARAMS = {
  temperature: 0.1,
  top_p: 0.8,
  max_tokens: 1200,
  max_completion_tokens: "",
  presence_penalty: 0,
  frequency_penalty: 0,
  seed: "",
  stop: "",
};
const SUPPORTED_REQUEST_PARAMS = {
  temperature: true,
  top_p: true,
  max_tokens: true,
  max_completion_tokens: true,
  presence_penalty: true,
  frequency_penalty: true,
  seed: true,
  stop: true,
  enable_thinking: true,
  reasoning_effort: false,
  response_format: false,
};
const DEFAULT_VENV_DIR = path.join(__dirname, "..", ".venv");
const DEFAULT_FUNASR_PYTHON_SCRIPT = path.join(__dirname, "python", "funasr_client.py");
const DEFAULT_QWEN_PYTHON_SCRIPT = path.join(__dirname, "python", "qwen_openai_client.py");

function trimSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function parseTimeoutMs() {
  const value = Number(process.env.DATABAKER_AI_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  if (!Number.isFinite(value)) {
    return DEFAULT_TIMEOUT_MS;
  }
  return Math.max(1000, Math.min(300000, Math.floor(value)));
}

function parseDataBakerJobTimeoutMs() {
  const value = Number(
    process.env.ASC_AI_JOB_TIMEOUT_MS ||
      process.env.DATABAKER_AI_JOB_TIMEOUT_MS ||
      DEFAULT_JOB_TIMEOUT_MS
  );
  if (!Number.isFinite(value)) {
    return DEFAULT_JOB_TIMEOUT_MS;
  }
  return Math.max(1000, Math.min(300000, Math.floor(value)));
}

function parseDataBakerJobTtlMs() {
  const value = Number(
    process.env.ASC_AI_JOB_TTL_MS || process.env.DATABAKER_AI_JOB_TTL_MS || DEFAULT_JOB_TTL_MS
  );
  if (!Number.isFinite(value)) {
    return DEFAULT_JOB_TTL_MS;
  }
  return Math.max(10000, Math.min(24 * 60 * 60 * 1000, Math.floor(value)));
}

function isMockEnabled() {
  return String(process.env.DATABAKER_AI_MOCK || "").trim() === "1";
}

function parseEnableThinkingDefault() {
  return String(process.env.DATABAKER_AI_ENABLE_THINKING || "0").trim() === "1";
}

function parseLanguageHints() {
  const raw = String(process.env.DATABAKER_AI_FUN_ASR_LANGUAGE_HINTS || "zh").trim();
  const values = raw
    .split(/[,\s]+/)
    .map(function (item) {
      return String(item || "").trim();
    })
    .filter(Boolean)
    .slice(0, 8);
  return values.length > 0 ? values : ["zh"];
}

function buildApiV1BaseUrl(baseUrl) {
  const normalizedBaseUrl = trimSlash(baseUrl || DEFAULT_BASE_URL);
  try {
    const parsedUrl = new URL(normalizedBaseUrl);
    if (/\/api\/v1$/i.test(parsedUrl.pathname || "")) {
      return parsedUrl.origin + parsedUrl.pathname.replace(/\/+$/, "");
    }
    return parsedUrl.origin + "/api/v1";
  } catch (error) {
    return "https://dashscope.aliyuncs.com/api/v1";
  }
}

function buildSdkBaseHttpApiUrl() {
  const baseUrl = trimSlash(process.env.DASHSCOPE_BASE_URL || DEFAULT_BASE_URL);
  return buildApiV1BaseUrl(baseUrl);
}

function parseFunAsrPollIntervalMs() {
  const value = Number(
    process.env.DATABAKER_AI_FUN_ASR_POLL_INTERVAL_MS || DEFAULT_FUN_ASR_REST_POLL_INTERVAL_MS
  );
  if (!Number.isFinite(value)) {
    return DEFAULT_FUN_ASR_REST_POLL_INTERVAL_MS;
  }
  return Math.max(200, Math.min(10000, Math.floor(value)));
}

function getFunAsrProviderMode() {
  const normalized = String(process.env.DATABAKER_AI_FUN_ASR_PROVIDER || DEFAULT_FUN_ASR_PROVIDER)
    .trim()
    .toLowerCase();
  return normalized === "python" ? "python" : "rest";
}

function getFunAsrProviderFallbackMode() {
  const normalized = String(process.env.DATABAKER_AI_FUN_ASR_PROVIDER_FALLBACK || "")
    .trim()
    .toLowerCase();
  return normalized === "python" ? "python" : "";
}

function getFunAsrRestBaseUrl() {
  const explicitBaseUrl = trimSlash(process.env.DATABAKER_AI_FUN_ASR_REST_BASE_URL || "");
  if (explicitBaseUrl) {
    return buildApiV1BaseUrl(explicitBaseUrl);
  }
  return buildApiV1BaseUrl(process.env.DASHSCOPE_BASE_URL || DEFAULT_BASE_URL);
}

function getDefaultPythonCandidates() {
  return [
    path.join(DEFAULT_VENV_DIR, "Scripts", "python.exe"),
    path.join(DEFAULT_VENV_DIR, "bin", "python"),
  ];
}

function isCompatibleLegacyOmniModel(value) {
  return LEGACY_OMNI_COMPATIBILITY_MODEL_OPTIONS.indexOf(String(value || "").trim()) >= 0;
}

function normalizeDataBakerListenModel(value, fallback) {
  const normalizedValue = String(value || "").trim();
  const normalizedFallback = String(fallback || DEFAULT_OMNI_MODEL).trim() || DEFAULT_OMNI_MODEL;
  if (
    DATABAKER_LISTEN_MODEL_OPTIONS.indexOf(normalizedValue) >= 0 ||
    isCompatibleLegacyOmniModel(normalizedValue)
  ) {
    return normalizedValue;
  }
  if (
    DATABAKER_LISTEN_MODEL_OPTIONS.indexOf(normalizedFallback) >= 0 ||
    isCompatibleLegacyOmniModel(normalizedFallback)
  ) {
    return normalizedFallback;
  }
  return DEFAULT_OMNI_MODEL;
}

function normalizeDataBakerCompareModel(value, fallback) {
  const normalizedValue = String(value || "").trim();
  const normalizedFallback = String(fallback || DEFAULT_COMPARE_MODEL).trim() || DEFAULT_COMPARE_MODEL;
  if (DATABAKER_COMPARE_MODEL_OPTIONS.indexOf(normalizedValue) >= 0) {
    return normalizedValue;
  }
  if (DATABAKER_COMPARE_MODEL_OPTIONS.indexOf(normalizedFallback) >= 0) {
    return normalizedFallback;
  }
  return DEFAULT_COMPARE_MODEL;
}

function normalizeDataBakerSingleModel(value, fallback) {
  const normalizedValue = String(value || "").trim();
  const normalizedFallback = String(fallback || DEFAULT_OMNI_MODEL).trim() || DEFAULT_OMNI_MODEL;
  if (
    DATABAKER_SINGLE_MODEL_OPTIONS.indexOf(normalizedValue) >= 0 ||
    isCompatibleLegacyOmniModel(normalizedValue)
  ) {
    return normalizedValue;
  }
  if (
    DATABAKER_SINGLE_MODEL_OPTIONS.indexOf(normalizedFallback) >= 0 ||
    isCompatibleLegacyOmniModel(normalizedFallback)
  ) {
    return normalizedFallback;
  }
  return DEFAULT_OMNI_MODEL;
}

function normalizeDataBakerRecognitionMode(value, fallback) {
  const text = String(value || "").trim().toLowerCase();
  if (text === "two_stage" || text === "omni_single") {
    return text;
  }
  if (text === "fun_asr_compare" || text === "qwen_omni_compare" || text === "qwen_omni_two_stage") {
    return "two_stage";
  }
  if (text === "listen_only") {
    return "omni_single";
  }
  return String(fallback || "two_stage").trim().toLowerCase() === "omni_single"
    ? "omni_single"
    : "two_stage";
}

function getDataBakerAiQualifiedAutofillConcurrencyRule(settings) {
  const source = settings && typeof settings === "object" ? settings : {};
  const recognitionMode = normalizeDataBakerRecognitionMode(
    source.recognitionMode || source.aiRecommendPipelineMode || source.pipelineMode,
    "two_stage"
  );
  const listenModel = normalizeDataBakerListenModel(
    source.listenModel || source.aiRecommendListenModel,
    DEFAULT_OMNI_MODEL
  );
  const singleModel = normalizeDataBakerSingleModel(
    source.singleModel || source.aiRecommendSingleModel || source.aiModel,
    DEFAULT_OMNI_MODEL
  );
  if (recognitionMode === "two_stage" && listenModel === DEFAULT_FUN_ASR_MODEL) {
    return Object.assign({}, DATABAKER_FUN_ASR_AUTOFILL_RULE);
  }
  if (recognitionMode === "omni_single" && DATABAKER_SINGLE_MODEL_OPTIONS.indexOf(singleModel) >= 0) {
    return Object.assign({}, DATABAKER_OMNI_AUTOFILL_RULE);
  }
  return Object.assign({}, DATABAKER_OMNI_AUTOFILL_RULE);
}

function normalizeDataBakerAiQualifiedAutofillConcurrency(value, settings) {
  const rule = getDataBakerAiQualifiedAutofillConcurrencyRule(settings);
  const number = Number(value);
  const base = Number.isFinite(number) ? Math.round(number) : rule.defaultValue;
  return Math.max(rule.min, Math.min(rule.max, base));
}

function deriveDataBakerPipelineMode(recognitionMode, model) {
  const normalizedRecognitionMode = normalizeDataBakerRecognitionMode(recognitionMode, "two_stage");
  if (normalizedRecognitionMode === "omni_single") {
    return "omni_single";
  }
  return String(model || "").trim() === DEFAULT_FUN_ASR_MODEL
    ? "fun_asr_compare"
    : "qwen_omni_compare";
}

function resolveDataBakerDefaultListenModel() {
  const legacyPipeline = normalizeDataBakerRecognitionMode(
    process.env.DATABAKER_AI_PIPELINE_MODE || "two_stage",
    "two_stage"
  );
  if (legacyPipeline === "omni_single") {
    return normalizeDataBakerListenModel(process.env.DATABAKER_AI_OMNI_MODEL || DEFAULT_OMNI_MODEL);
  }
  if (String(process.env.DATABAKER_AI_PIPELINE_MODE || "").trim().toLowerCase() === "fun_asr_compare") {
    return DEFAULT_FUN_ASR_MODEL;
  }
  return normalizeDataBakerListenModel(process.env.DATABAKER_AI_OMNI_MODEL || DEFAULT_OMNI_MODEL);
}

function resolveDataBakerDefaultSingleModel() {
  return normalizeDataBakerSingleModel(process.env.DATABAKER_AI_OMNI_MODEL || DEFAULT_OMNI_MODEL);
}

function getQwenProviderConfig() {
  const apiKey = String(process.env.DASHSCOPE_API_KEY || "").trim();
  const baseUrl = trimSlash(process.env.DASHSCOPE_BASE_URL || DEFAULT_BASE_URL);
  const omniModel = String(process.env.DATABAKER_AI_OMNI_MODEL || DEFAULT_OMNI_MODEL).trim();
  const compareModel = String(process.env.DATABAKER_AI_COMPARE_MODEL || DEFAULT_COMPARE_MODEL).trim();
  return {
    apiKey,
    baseUrl,
    omniModel: omniModel || DEFAULT_OMNI_MODEL,
    compareModel: compareModel || DEFAULT_COMPARE_MODEL,
    timeoutMs: parseTimeoutMs(),
    mockEnabled: isMockEnabled(),
    hasApiKey: Boolean(apiKey),
    enableThinkingDefault: parseEnableThinkingDefault(),
    singleModelOptions: DATABAKER_SINGLE_MODEL_OPTIONS.slice(),
    listenModelOptions: DATABAKER_LISTEN_MODEL_OPTIONS.slice(),
    compareModelOptions: DATABAKER_COMPARE_MODEL_OPTIONS.slice(),
  };
}

function getQwenPythonConfig() {
  const apiKey = String(process.env.DASHSCOPE_API_KEY || "").trim();
  const baseUrl = trimSlash(process.env.DASHSCOPE_BASE_URL || DEFAULT_BASE_URL);
  const pythonBin = String(
    process.env.DATABAKER_QWEN_PYTHON_BIN || process.env.DATABAKER_AI_QWEN_PYTHON_BIN || ""
  ).trim();
  return {
    apiKey,
    baseUrl,
    timeoutMs: parseTimeoutMs(),
    mockEnabled: isMockEnabled(),
    hasApiKey: Boolean(apiKey),
    pythonBin,
    defaultVenvDir: DEFAULT_VENV_DIR,
    defaultScriptPath: DEFAULT_QWEN_PYTHON_SCRIPT,
    defaultPythonCandidates: getDefaultPythonCandidates(),
    singleModelOptions: DATABAKER_SINGLE_MODEL_OPTIONS.slice(),
    listenModelOptions: DATABAKER_LISTEN_MODEL_OPTIONS.slice(),
    compareModelOptions: DATABAKER_COMPARE_MODEL_OPTIONS.slice(),
  };
}

function getFunAsrPythonConfig() {
  const apiKey = String(process.env.DASHSCOPE_API_KEY || "").trim();
  const model = String(process.env.DATABAKER_AI_FUN_ASR_MODEL || DEFAULT_FUN_ASR_MODEL).trim();
  const pythonBin = String(process.env.DATABAKER_FUNASR_PYTHON_BIN || "").trim();
  return {
    apiKey,
    model: model || DEFAULT_FUN_ASR_MODEL,
    timeoutMs: parseTimeoutMs(),
    mockEnabled: isMockEnabled(),
    hasApiKey: Boolean(apiKey),
    languageHints: parseLanguageHints(),
    pythonBin,
    sdkBaseHttpApiUrl: buildSdkBaseHttpApiUrl(),
    defaultVenvDir: DEFAULT_VENV_DIR,
    defaultScriptPath: DEFAULT_FUNASR_PYTHON_SCRIPT,
    defaultPythonCandidates: getDefaultPythonCandidates(),
    singleModelOptions: DATABAKER_SINGLE_MODEL_OPTIONS.slice(),
    listenModelOptions: DATABAKER_LISTEN_MODEL_OPTIONS.slice(),
    compareModelOptions: DATABAKER_COMPARE_MODEL_OPTIONS.slice(),
  };
}

function getFunAsrRestConfig() {
  const apiKey = String(process.env.DASHSCOPE_API_KEY || "").trim();
  const model = String(process.env.DATABAKER_AI_FUN_ASR_MODEL || DEFAULT_FUN_ASR_MODEL).trim();
  const apiBase = getFunAsrRestBaseUrl();
  return {
    apiKey,
    model: model || DEFAULT_FUN_ASR_MODEL,
    timeoutMs: parseTimeoutMs(),
    mockEnabled: isMockEnabled(),
    hasApiKey: Boolean(apiKey),
    languageHints: parseLanguageHints(),
    apiBase,
    pollIntervalMs: parseFunAsrPollIntervalMs(),
    singleModelOptions: DATABAKER_SINGLE_MODEL_OPTIONS.slice(),
    listenModelOptions: DATABAKER_LISTEN_MODEL_OPTIONS.slice(),
    compareModelOptions: DATABAKER_COMPARE_MODEL_OPTIONS.slice(),
  };
}

module.exports = {
  DEFAULT_BASE_URL,
  DEFAULT_COMPARE_MODEL,
  DEFAULT_FUN_ASR_MODEL,
  DEFAULT_FUN_ASR_PROVIDER,
  DEFAULT_FUN_ASR_REST_POLL_INTERVAL_MS,
  DEFAULT_JOB_TIMEOUT_MS,
  DEFAULT_JOB_TTL_MS,
  DEFAULT_OMNI_MODEL,
  DATABAKER_SINGLE_MODEL_OPTIONS,
  DATABAKER_COMPARE_MODEL_OPTIONS,
  DATABAKER_LISTEN_MODEL_OPTIONS,
  DEFAULT_REQUEST_PARAMS,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_VENV_DIR,
  DEFAULT_FUNASR_PYTHON_SCRIPT,
  DEFAULT_QWEN_PYTHON_SCRIPT,
  SUPPORTED_REQUEST_PARAMS,
  buildModelOptionsByFamily,
  buildApiV1BaseUrl,
  buildSdkBaseHttpApiUrl,
  deriveDataBakerPipelineMode,
  getAllSharedModelMeta: listAllModels,
  getDataBakerAiQualifiedAutofillConcurrencyRule,
  getDefaultPythonCandidates,
  getFunAsrProviderFallbackMode,
  getFunAsrProviderMode,
  getFunAsrPythonConfig,
  getFunAsrRestBaseUrl,
  getFunAsrRestConfig,
  getModelDocs,
  getModelMeta,
  getQwenProviderConfig,
  getQwenPythonConfig,
  getRecommendedModelsByFamily,
  normalizeDataBakerAiQualifiedAutofillConcurrency,
  normalizeDataBakerCompareModel,
  normalizeDataBakerListenModel,
  normalizeDataBakerRecognitionMode,
  normalizeDataBakerSingleModel,
  resolveDataBakerDefaultListenModel,
  resolveDataBakerDefaultSingleModel,
  isMockEnabled,
  parseDataBakerJobTimeoutMs,
  parseDataBakerJobTtlMs,
  parseEnableThinkingDefault,
  parseFunAsrPollIntervalMs,
  parseLanguageHints,
  parseTimeoutMs,
  trimSlash,
};

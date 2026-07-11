"use strict";

const crypto = require("crypto");
const path = require("path");

const {
  buildApiV1BaseUrl,
} = require("../../../backend/ai/config");
const {
  createJobTimeoutError,
  normalizeAbortError,
} = require("../../../backend/ai/errors");
const { estimateProjectCost } = require("../../../backend/ai/model-pricing");
const { buildAsyncJobRuntimeMeta } = require("../../../backend/ai-framework/runtime/ai-runtime-meta");
const {
  buildModelQueueKey,
  enqueueProviderTask,
  getGroupSettings,
  getGlobalQueueMaxSize,
  getGlobalRetryMax,
  getQueueSnapshots,
} = require("../../../backend/ai/provider-queue");
const {
  requestFunAsrRecognitionRest,
} = require("../../../backend/ai/providers/funasr-rest");
const {
  getFunAsrClientConfig: getFunAsrPythonClientConfig,
  requestFunAsrRecognitionPython,
} = require("../../../backend/ai/providers/funasr-python");
const { getLogDir } = require("./ai-call-log");
const {
  DEFAULT_COMPARE_MODEL,
  DEFAULT_LISTEN_MODEL,
  DEFAULT_REQUEST_PARAMS,
  SUPPORTED_REQUEST_PARAMS,
  requestCompare,
  requestListen,
  requestOmniSingle,
  sanitizeModelName,
} = require("./ai-client-qwen");
const { estimateIncome } = require("./ai-cost");
const {
  applyLexiconRewrite,
  buildLexiconContext,
  getLexiconState,
  normalizeToSimplifiedChinesePreservingLexicon,
} = require("./ai-lexicon");
const {
  buildComparePrompt,
  buildListenPrompt,
  buildOmniSinglePrompt,
  buildRecognitionConvertListenPrompt,
  buildRecognitionConvertComparePrompt,
  DEFAULT_COMPARE_TEMPLATE,
  DEFAULT_LISTEN_TEMPLATE,
  DEFAULT_OMNI_SINGLE_TEMPLATE,
  DEFAULT_RECOGNITION_CONVERT_LISTEN_TEMPLATE,
  DEFAULT_RECOGNITION_CONVERT_COMPARE_TEMPLATE,
  RULE_VERSION,
} = require("./ai-prompts");
const {
  normalizeListenResponse,
  normalizeOmniSingleComparison,
  normalizeRuleFirstComparison,
  normalizeUsage,
  parseModelJsonText,
} = require("./ai-response-schema");

const SERVICE_NAME = "magic-data-minnan-helper-ai-review-current";
const SCRIPT_ID = "magicDataMinnanAssistant";
const COMPONENT_NAME = "asr-voice-ai";
const MODEL_MODE_OPTIONS = [
  { value: "two_stage", label: "双模型：听音模型 + 比较/转换模型" },
  { value: "omni_single", label: "单模型：Omni 单模型" },
];
const RECOGNITION_STRATEGY_OPTIONS = [
  { value: "direct_dialect", label: "直接识别方言文本" },
  { value: "mandarin_to_dialect", label: "识别转换：先听成普通话，再按字词表转方言" },
];

const RECOGNITION_MODE_OPTIONS = [
  { value: "two_stage", label: "双模型：听音模型 + 比较模型" },
  { value: "omni_single", label: "单模型：Omni 单模型" },
  { value: "recognition_convert", label: "识别转换：先听成普通话，再按词表转闽南语" },
];
const SUPPORTED_PIPELINE_MODES = [
  { value: "fun_asr_compare", label: "Fun-ASR 听音 + 比较模型" },
  { value: "qwen_omni_compare", label: "Qwen Omni 听音 + 比较模型" },
  { value: "omni_single", label: "Qwen Omni 单模型" },
  { value: "recognition_convert", label: "识别转换（普通话识别 + 词表转换 + 质检）" },
];
const LEGACY_PIPELINE_MODE_MAP = {
  fun_asr_compare: "two_stage",
  qwen_omni_compare: "two_stage",
  qwen_omni_two_stage: "two_stage",
  listen_only: "omni_single",
  recognition_convert: "recognition_convert",
};
const LISTEN_MODEL_OPTIONS = [
  "fun-asr",
  "qwen3.5-omni-plus",
  "qwen3.5-omni-flash",
  "qwen3.5-omni-flash-2026-03-15",
  "qwen3-omni-flash",
  "qwen3-omni-flash-2025-12-01",
  "qwen3-omni-flash-2025-09-15",
];
const SINGLE_MODEL_OPTIONS = [
  "qwen3.5-omni-plus",
  "qwen3.5-omni-flash",
  "qwen3.5-omni-flash-2026-03-15",
  "qwen3-omni-flash",
  "qwen3-omni-flash-2025-12-01",
  "qwen3-omni-flash-2025-09-15",
];
const COMPARE_MODEL_OPTIONS = [
  "qwen3.6-plus",
  "qwen3.5-plus",
  "qwen3.6-flash",
  "qwen3.5-flash",
];
const DEFAULT_SINGLE_MODEL = "qwen3.5-omni-flash";
const DEFAULT_FUN_ASR_MODEL = "fun-asr";
const DEFAULT_TIMEOUT_MS = 60000;
const DEFAULT_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_BODY_BYTES = 3 * 1024 * 1024;

const responseCacheStore = new Map();
const responseCacheStats = {
  hitCount: 0,
  missCount: 0,
  setCount: 0,
  expiredCount: 0,
};

function readProfileEnv(suffix, fallback) {
  const scopedName = "MAGIC_DATA_MINNAN_AI_" + String(suffix || "");
  const legacyName = "MAGIC_DATA_AI_" + String(suffix || "");
  const scopedValue = process.env[scopedName];
  if (scopedValue !== undefined && scopedValue !== null && String(scopedValue).trim() !== "") {
    return scopedValue;
  }
  const legacyValue = process.env[legacyName];
  if (legacyValue !== undefined && legacyValue !== null && String(legacyValue).trim() !== "") {
    return legacyValue;
  }
  return fallback;
}

function parseBoolean(value, fallback) {
  const text = String(value === undefined || value === null ? "" : value).trim().toLowerCase();
  if (!text) {
    return fallback === true;
  }
  return text === "1" || text === "true" || text === "yes" || text === "on";
}

function parseTimeoutMs(value, fallback) {
  const number = Number(value);
  const base = Number.isFinite(number) ? number : Number(fallback);
  if (!Number.isFinite(base)) {
    return DEFAULT_TIMEOUT_MS;
  }
  return Math.max(1000, Math.min(300000, Math.floor(base)));
}

function parseCacheTtlMs(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return DEFAULT_CACHE_TTL_MS;
  }
  return Math.max(1000, Math.min(7 * 24 * 60 * 60 * 1000, Math.floor(number)));
}

function parsePollIntervalMs(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 1000;
  }
  return Math.max(200, Math.min(10000, Math.floor(number)));
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizePromptText(value) {
  return String(value || "").replace(/\r\n/g, "\n").trim().slice(0, 8000);
}

function sanitizeDebugText(value) {
  return String(value || "")
    .replace(/https?:\/\/([^\s"'?]+)\?[^ \n\r"']+/gi, "https://$1?<signed-query-redacted>")
    .replace(/(authorization|cookie|token|signature|ossaccesskeyid)\s*[:=]\s*([^\s,;]+)/gi, "$1=<redacted>");
}

function sanitizeDebugValue(value) {
  if (value === undefined || value === null) {
    return value;
  }
  if (typeof value === "string") {
    return sanitizeDebugText(value);
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeDebugValue);
  }
  if (typeof value === "object") {
    const next = {};
    Object.keys(value).forEach(function (key) {
      const lower = String(key || "").toLowerCase();
      if (
        lower.indexOf("authorization") >= 0 ||
        lower.indexOf("cookie") >= 0 ||
        lower.indexOf("token") >= 0 ||
        lower.indexOf("signature") >= 0 ||
        lower.indexOf("ossaccesskeyid") >= 0
      ) {
        next[key] = "<redacted>";
      } else {
        next[key] = sanitizeDebugValue(value[key]);
      }
    });
    return next;
  }
  return value;
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

function normalizeOptionalNumber(value, min, max) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    return null;
  }
  return number;
}

function normalizeOptionalInteger(value, min, max) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
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

function isHttpUrl(value) {
  try {
    const parsed = new URL(String(value || ""));
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (error) {
    return false;
  }
}

function parseAudioHostname(audioUrl) {
  try {
    return new URL(String(audioUrl || "")).hostname || "";
  } catch (error) {
    return "";
  }
}

function normalizeRecognitionMode(value, fallback) {
  const text = String(value || "").trim().toLowerCase();
  if (text === "two_stage" || text === "omni_single" || text === "recognition_convert") {
    return text;
  }
  if (text && LEGACY_PIPELINE_MODE_MAP[text]) {
    return LEGACY_PIPELINE_MODE_MAP[text];
  }
  const fallbackText = String(fallback || "two_stage").trim().toLowerCase();
  if (fallbackText === "omni_single" || fallbackText === "recognition_convert") {
    return fallbackText;
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
  const fallbackText = String(fallback || "two_stage").trim().toLowerCase();
  return fallbackText === "omni_single" ? "omni_single" : "two_stage";
}

function normalizeRecognitionStrategy(value, fallback) {
  const text = String(value || "").trim().toLowerCase();
  if (text === "mandarin_to_dialect") {
    return "mandarin_to_dialect";
  }
  if (text === "recognition_convert") {
    return "mandarin_to_dialect";
  }
  const fallbackText = String(fallback || "direct_dialect").trim().toLowerCase();
  return fallbackText === "mandarin_to_dialect" ? "mandarin_to_dialect" : "direct_dialect";
}

function deriveLegacyRecognitionMode(modelMode, recognitionStrategy) {
  const normalizedModelMode = normalizeModelMode(modelMode, "two_stage");
  const normalizedRecognitionStrategy = normalizeRecognitionStrategy(
    recognitionStrategy,
    "direct_dialect"
  );
  if (normalizedRecognitionStrategy === "mandarin_to_dialect") {
    return "recognition_convert";
  }
  return normalizedModelMode;
}

function derivePipelineMode(recognitionMode, listenModel) {
  const normalizedMode = normalizeRecognitionMode(recognitionMode, "two_stage");
  if (normalizedMode === "omni_single") {
    return "omni_single";
  }
  if (normalizedMode === "recognition_convert") {
    return "recognition_convert";
  }
  return String(listenModel || "").trim() === DEFAULT_FUN_ASR_MODEL
    ? "fun_asr_compare"
    : "qwen_omni_compare";
}

function normalizeListenModel(value, fallback) {
  const normalizedValue = String(value || "").trim();
  const normalizedFallback = String(fallback || DEFAULT_LISTEN_MODEL).trim() || DEFAULT_LISTEN_MODEL;
  if (LISTEN_MODEL_OPTIONS.indexOf(normalizedValue) >= 0) {
    return normalizedValue;
  }
  if (LISTEN_MODEL_OPTIONS.indexOf(normalizedFallback) >= 0) {
    return normalizedFallback;
  }
  return DEFAULT_LISTEN_MODEL;
}

function normalizeSingleModel(value, fallback) {
  const normalizedValue = String(value || "").trim();
  const normalizedFallback = String(fallback || DEFAULT_SINGLE_MODEL).trim() || DEFAULT_SINGLE_MODEL;
  if (SINGLE_MODEL_OPTIONS.indexOf(normalizedValue) >= 0) {
    return normalizedValue;
  }
  if (SINGLE_MODEL_OPTIONS.indexOf(normalizedFallback) >= 0) {
    return normalizedFallback;
  }
  return DEFAULT_SINGLE_MODEL;
}

function normalizeCompareModel(value, fallback) {
  const normalizedValue = String(value || "").trim();
  const normalizedFallback = String(fallback || DEFAULT_COMPARE_MODEL).trim() || DEFAULT_COMPARE_MODEL;
  if (COMPARE_MODEL_OPTIONS.indexOf(normalizedValue) >= 0) {
    return normalizedValue;
  }
  if (COMPARE_MODEL_OPTIONS.indexOf(normalizedFallback) >= 0) {
    return normalizedFallback;
  }
  return DEFAULT_COMPARE_MODEL;
}

function normalizeFunAsrProvider(value) {
  const text = String(value || "").trim().toLowerCase();
  return text === "python" ? "python" : "rest";
}

function normalizeFunAsrFallback(value) {
  const text = String(value || "").trim().toLowerCase();
  return text === "python" ? "python" : "";
}

function getProfileConfig() {
  const apiKey = String(process.env.DASHSCOPE_API_KEY || "").trim();
  const baseUrl = String(process.env.DASHSCOPE_BASE_URL || "").trim();
  const legacyRecognitionMode = normalizeRecognitionMode(
    readProfileEnv("PIPELINE_MODE", "two_stage"),
    "two_stage"
  );
  const modelMode = normalizeModelMode(
    readProfileEnv("MODEL_MODE", legacyRecognitionMode),
    legacyRecognitionMode
  );
  const recognitionStrategy = normalizeRecognitionStrategy(
    readProfileEnv("RECOGNITION_STRATEGY", legacyRecognitionMode),
    legacyRecognitionMode
  );
  const recognitionMode = deriveLegacyRecognitionMode(modelMode, recognitionStrategy);
  const omniModel = normalizeSingleModel(readProfileEnv("OMNI_MODEL", DEFAULT_SINGLE_MODEL), DEFAULT_SINGLE_MODEL);
  const listenModel = normalizeListenModel(
    readProfileEnv("LISTEN_MODEL", modelMode === "two_stage" ? omniModel : DEFAULT_FUN_ASR_MODEL),
    omniModel
  );
  const singleModel = normalizeSingleModel(
    readProfileEnv("SINGLE_MODEL", omniModel),
    omniModel
  );
  const compareModel = normalizeCompareModel(
    readProfileEnv("COMPARE_MODEL", DEFAULT_COMPARE_MODEL),
    DEFAULT_COMPARE_MODEL
  );
  const funAsrModel = normalizeListenModel(
    readProfileEnv("FUN_ASR_MODEL", DEFAULT_FUN_ASR_MODEL),
    DEFAULT_FUN_ASR_MODEL
  );
  const timeoutMs = parseTimeoutMs(readProfileEnv("TIMEOUT_MS", DEFAULT_TIMEOUT_MS), DEFAULT_TIMEOUT_MS);
  const mockEnabled = parseBoolean(readProfileEnv("MOCK", "0"), false);
  const allowClientModelOverride = parseBoolean(readProfileEnv("ALLOW_CLIENT_MODEL_OVERRIDE", "1"), true);
  const enableThinkingDefault = parseBoolean(readProfileEnv("ENABLE_THINKING", "0"), false);
  const funAsrProvider = normalizeFunAsrProvider(readProfileEnv("FUN_ASR_PROVIDER", "rest"));
  const funAsrProviderFallback = normalizeFunAsrFallback(readProfileEnv("FUN_ASR_PROVIDER_FALLBACK", ""));
  const funAsrApiBase = buildApiV1BaseUrl(
    readProfileEnv("FUN_ASR_REST_BASE_URL", baseUrl || "https://dashscope.aliyuncs.com/compatible-mode/v1")
  );
  const funAsrPollIntervalMs = parsePollIntervalMs(readProfileEnv("FUN_ASR_POLL_INTERVAL_MS", 1000));
  const lexiconRewriteMode = String(readProfileEnv("LEXICON_REWRITE_MODE", "off") || "off").trim().toLowerCase();
  const cacheTtlMs = parseCacheTtlMs(readProfileEnv("CACHE_TTL_MS", DEFAULT_CACHE_TTL_MS));
  const derivedPipelineMode = derivePipelineMode(recognitionMode, modelMode === "omni_single" ? singleModel : listenModel);

  return {
    apiKey,
    hasApiKey: Boolean(apiKey),
    baseUrl,
    modelMode,
    recognitionStrategy,
    recognitionMode,
    derivedPipelineMode,
    listenModel,
    singleModel,
    compareModel,
    funAsrModel: funAsrModel === "fun-asr" ? funAsrModel : "fun-asr",
    timeoutMs,
    mockEnabled,
    allowClientModelOverride,
    enableThinkingDefault,
    funAsrProvider,
    funAsrProviderFallback,
    funAsrApiBase,
    funAsrPollIntervalMs,
    lexiconRewriteMode: lexiconRewriteMode === "aggressive" ? "aggressive" : "off",
    cacheTtlMs,
  };
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value === undefined ? null : value));
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return "[" + value.map(stableStringify).join(",") + "]";
  }
  if (value && typeof value === "object") {
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map(function (key) {
          return JSON.stringify(key) + ":" + stableStringify(value[key]);
        })
        .join(",") +
      "}"
    );
  }
  return JSON.stringify(value === undefined ? null : value);
}

function buildCacheKey(value) {
  return crypto.createHash("sha256").update(stableStringify(value)).digest("hex");
}

function purgeExpiredCacheEntries() {
  const now = Date.now();
  Array.from(responseCacheStore.entries()).forEach(function (entry) {
    const key = entry && entry[0];
    const value = entry && entry[1];
    if (!value || Number(value.expiresAt) <= now) {
      responseCacheStore.delete(key);
      responseCacheStats.expiredCount += 1;
    }
  });
}

function getCachedResult(cacheKey) {
  purgeExpiredCacheEntries();
  const entry = responseCacheStore.get(String(cacheKey || ""));
  if (!entry) {
    responseCacheStats.missCount += 1;
    return null;
  }
  responseCacheStats.hitCount += 1;
  return cloneJson(entry.value);
}

function setCachedResult(cacheKey, value, ttlMs) {
  responseCacheStore.set(String(cacheKey || ""), {
    expiresAt: Date.now() + Math.max(1000, Number(ttlMs) || DEFAULT_CACHE_TTL_MS),
    value: cloneJson(value),
  });
  responseCacheStats.setCount += 1;
}

function getCacheSnapshot(config) {
  purgeExpiredCacheEntries();
  return {
    ttlMs: Math.max(1000, Number(config?.cacheTtlMs) || DEFAULT_CACHE_TTL_MS),
    size: responseCacheStore.size,
    stats: Object.assign({}, responseCacheStats),
  };
}

function buildReviewCacheKey(request, profileConfig) {
  return buildCacheKey({
    requestType: "magic-data-minnan-review-current",
    audioUrl: String(request.audioUrl || ""),
    effectiveStartTime: request.effectiveStartTime ?? null,
    effectiveEndTime: request.effectiveEndTime ?? null,
    effectiveTime: request.effectiveTime ?? null,
    modelMode: String(request.modelMode || ""),
    recognitionStrategy: String(request.recognitionStrategy || ""),
    recognitionMode: String(request.recognitionMode || ""),
    pipelineMode: String(request.pipelineMode || ""),
    listenModel: String(request.listenModel || ""),
    singleModel: String(request.singleModel || ""),
    compareModel: String(request.compareModel || ""),
    enableThinking: request.enableThinking === true,
    rulesProfile: String(request.rulesProfile || "minnan"),
    platformDialectText: String(request.platformDialectText || ""),
    platformMandarinText: String(request.platformMandarinText || ""),
    listenPrompt: String(request.aiOptions?.listenPrompt || ""),
    comparePrompt: String(request.aiOptions?.comparePrompt || ""),
    aiOptions: request.aiOptions || {},
    ruleVersion: RULE_VERSION,
    lexiconRewriteMode: profileConfig.lexiconRewriteMode,
  });
}

function createHttpError(statusCode, message, code) {
  const error = new Error(String(message || "请求失败。"));
  error.statusCode = Number(statusCode) || 500;
  error.code = String(code || "request-error");
  return error;
}

function normalizeNullableNumber(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeAiOptions(value) {
  const source = value && typeof value === "object" ? value : {};
  const result = {};
  const listenPrompt = normalizePromptText(source.listenPrompt || "");
  const comparePrompt = normalizePromptText(source.comparePrompt || source.reviewPrompt || "");
  const listenModel = sanitizeModelName(source.listenModel || "", "");
  const compareModel = sanitizeModelName(source.compareModel || source.reviewModel || "", "");
  const singleModel = sanitizeModelName(source.singleModel || source.omniModel || "", "");

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
    result.omniModel = singleModel;
  }

  if (SUPPORTED_REQUEST_PARAMS.temperature === true) {
    const value = normalizeOptionalNumber(source.temperature, 0, 2);
    if (value !== null) {
      result.temperature = value;
    }
  }
  if (SUPPORTED_REQUEST_PARAMS.top_p === true) {
    const value = normalizeOptionalNumber(source.top_p, 0, 1);
    if (value !== null) {
      result.top_p = value;
    }
  }
  if (SUPPORTED_REQUEST_PARAMS.max_tokens === true) {
    const value = normalizeOptionalInteger(source.max_tokens, 1, 8192);
    if (value !== null) {
      result.max_tokens = value;
    }
  }
  if (SUPPORTED_REQUEST_PARAMS.max_completion_tokens === true) {
    const value = normalizeOptionalInteger(source.max_completion_tokens, 1, 8192);
    if (value !== null) {
      result.max_completion_tokens = value;
    }
  }
  if (SUPPORTED_REQUEST_PARAMS.presence_penalty === true) {
    const value = normalizeOptionalNumber(source.presence_penalty, -2, 2);
    if (value !== null) {
      result.presence_penalty = value;
    }
  }
  if (SUPPORTED_REQUEST_PARAMS.frequency_penalty === true) {
    const value = normalizeOptionalNumber(source.frequency_penalty, -2, 2);
    if (value !== null) {
      result.frequency_penalty = value;
    }
  }
  if (SUPPORTED_REQUEST_PARAMS.seed === true) {
    const value = normalizeOptionalInteger(source.seed, 0, 2147483647);
    if (value !== null) {
      result.seed = value;
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

function resolveModelOverride(requestModel, defaultModel, allowOverride, normalizeFn) {
  const normalize = typeof normalizeFn === "function" ? normalizeFn : function (value, fallback) {
    return sanitizeModelName(value, fallback || defaultModel || "");
  };
  if (!allowOverride) {
    return normalize(defaultModel, defaultModel);
  }
  const normalizedRequestModel = sanitizeModelName(requestModel, "");
  if (!normalizedRequestModel) {
    return normalize(defaultModel, defaultModel);
  }
  return normalize(normalizedRequestModel, defaultModel);
}

function normalizeReviewRequest(body) {
  const source = body && typeof body === "object" ? body : {};
  const profileConfig = getProfileConfig();
  const aiOptions = normalizeAiOptions(source.aiOptions);
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
    source.recognitionMode || source.pipelineMode || source.aiReviewRecognitionMode,
    profileConfig.recognitionMode
  );
  const modelMode = normalizeModelMode(
    source.modelMode || source.aiReviewModelMode || fallbackLegacyMode,
    profileConfig.modelMode || fallbackLegacyMode
  );
  const recognitionStrategy = normalizeRecognitionStrategy(
    source.recognitionStrategy || source.aiReviewRecognitionStrategy || fallbackLegacyMode,
    profileConfig.recognitionStrategy || fallbackLegacyMode
  );
  const recognitionMode = deriveLegacyRecognitionMode(modelMode, recognitionStrategy);

  const requestedListenModel =
    aiOptions.listenModel || source.listenModel || source.aiReviewListenModel || "";
  const requestedCompareModel =
    aiOptions.compareModel ||
    aiOptions.reviewModel ||
    aiOptions.convertModel ||
    source.compareModel ||
    source.convertModel ||
    source.reviewModel ||
    source.aiReviewCompareModel ||
    "";
  const requestedSingleModel =
    aiOptions.singleModel ||
    aiOptions.omniModel ||
    source.singleModel ||
    source.aiReviewSingleModel ||
    source.aiModel ||
    "";

  const listenModel =
    recognitionMode === "two_stage" || recognitionMode === "recognition_convert"
      ? resolveModelOverride(
          requestedListenModel,
          profileConfig.listenModel,
          profileConfig.allowClientModelOverride,
          normalizeListenModel
        )
      : normalizeListenModel(profileConfig.listenModel, profileConfig.listenModel);
  const compareModel = resolveModelOverride(
    requestedCompareModel,
    profileConfig.compareModel,
    profileConfig.allowClientModelOverride,
    normalizeCompareModel
  );
  const singleModel = resolveModelOverride(
    requestedSingleModel,
    profileConfig.singleModel,
    profileConfig.allowClientModelOverride,
    normalizeSingleModel
  );

  return {
    taskItemId: taskItemId,
    samplingRecordId: samplingRecordId,
    projectName: projectName,
    audioUrl: audioUrl,
    audioDuration: normalizeNullableNumber(source.audioDuration),
    effectiveStartTime: normalizeNullableNumber(source.effectiveStartTime),
    effectiveEndTime: normalizeNullableNumber(source.effectiveEndTime),
    effectiveTime: effectiveTime,
    platformDialectText: platformDialectText,
    platformMandarinText: platformMandarinText,
    speaker: {
      gender: normalizeText(source?.speaker?.gender),
      ageRange: normalizeText(source?.speaker?.ageRange),
    },
    rulesProfile: normalizeText(source.rulesProfile) || "minnan",
    clientVersion: normalizeText(source.clientVersion),
    recognitionMode: recognitionMode,
    pipelineMode: derivePipelineMode(
    modelMode,
    recognitionStrategy,
    recognitionMode,
      recognitionMode === "omni_single" ? singleModel : listenModel
    ),
    listenModel: listenModel,
    compareModel: compareModel,
    reviewModel: compareModel,
    singleModel: singleModel,
    showHeardText: source.showHeardText !== false,
    reviewMode: normalizeText(source.reviewMode) || "rule_first",
    enableThinking:
      typeof aiOptions.enable_thinking === "boolean"
        ? aiOptions.enable_thinking === true
        : source.enableThinking === true || profileConfig.enableThinkingDefault === true,
    aiOptions: aiOptions,
  };
}

function computeEffectiveTimeSeconds(request) {
  if (request.effectiveTime !== null) {
    return Math.max(0, Number(request.effectiveTime) || 0);
  }
  if (request.effectiveStartTime !== null && request.effectiveEndTime !== null) {
    const diff = Number(request.effectiveEndTime) - Number(request.effectiveStartTime);
    return Math.max(0, Number.isFinite(diff) ? diff : 0);
  }
  return 0;
}

function sanitizeAudioCheckFromFunAsr(funAsrResult, request) {
  const heardDialectText = normalizeText(funAsrResult?.heardText);
  return {
    heardDialectText: heardDialectText,
    heardMandarinMeaning: "",
    isValidAudio: Boolean(heardDialectText),
    validityDecision: heardDialectText ? "valid" : "invalid",
    invalidReasons: heardDialectText ? [] : ["Fun-ASR 未返回可用听音文本。"],
    riskFlags: heardDialectText ? [] : ["heard_text_missing"],
    genderGuess: normalizeText(request?.speaker?.gender) || "uncertain",
    ageRangeGuess: normalizeText(request?.speaker?.ageRange) || "uncertain",
    confidence: Number(funAsrResult?.confidence || 0),
  };
}

function applyRecommendationNormalization(text, profileConfig) {
  const source = normalizeText(text || "");
  if (!source) {
    return {
      text: "",
      rewriteChanged: false,
      rewriteChanges: [],
    };
  }
  const simplified = normalizeToSimplifiedChinesePreservingLexicon(source);
  const rewriteResult = applyLexiconRewrite(simplified, {
    mode: profileConfig.lexiconRewriteMode,
  });
  const normalized = normalizeToSimplifiedChinesePreservingLexicon(rewriteResult.text);
  return {
    text: normalized,
    rewriteChanged: rewriteResult.changed === true,
    rewriteChanges: Array.isArray(rewriteResult.changes) ? rewriteResult.changes : [],
  };
}

function mergeLexiconIssues(baseIssues, rewriteChanges) {
  const issues = Array.isArray(baseIssues) ? baseIssues.slice() : [];
  (Array.isArray(rewriteChanges) ? rewriteChanges : []).forEach(function (change) {
    const fromText = String(change?.from || "").trim();
    const toText = String(change?.to || "").trim();
    if (!fromText || !toText) {
      return;
    }
    const summary = "词表建议替换：" + fromText + " -> " + toText;
    if (issues.indexOf(summary) < 0) {
      issues.push(summary);
    }
  });
  return issues;
}

function splitLexiconTerms(value) {
  return String(value || "")
    .split(/[,，、/｜|\s]+/)
    .map(function (item) {
      return String(item || "").trim();
    })
    .filter(Boolean);
}

function buildRecognitionConvertByLexicon(recognizedMandarinText, lexiconContext, platformDialectText) {
  const sourceText = normalizeText(recognizedMandarinText);
  const matches = Array.isArray(lexiconContext?.matches) ? lexiconContext.matches : [];
  if (!sourceText) {
    return {
      recognizedMandarinText: "",
      convertedDialectText: normalizeText(platformDialectText),
      lexiconMatches: [],
      conversionWarnings: ["未识别到普通话文本，保留平台闽南语并建议人工复核。"],
    };
  }

  let convertedText = sourceText;
  const lexiconMatches = [];
  matches.forEach(function (entry) {
    const target = normalizeText(entry?.unified || "");
    if (!target) {
      return;
    }
    splitLexiconTerms(entry?.mandarin || "").forEach(function (term) {
      if (!term || convertedText.indexOf(term) < 0) {
        return;
      }
      convertedText = convertedText.split(term).join(target);
      lexiconMatches.push({
        mandarin: term,
        dialect: target,
      });
    });
  });

  const deduped = [];
  const seen = new Set();
  lexiconMatches.forEach(function (item) {
    const key = String(item.mandarin || "") + "->" + String(item.dialect || "");
    if (!key || seen.has(key)) {
      return;
    }
    seen.add(key);
    deduped.push(item);
  });

  const warnings = [];
  if (deduped.length <= 0) {
    warnings.push("词表未命中，转换结果可能不稳定，建议人工复核。");
  }

  return {
    recognizedMandarinText: sourceText,
    convertedDialectText: normalizeText(convertedText || platformDialectText),
    lexiconMatches: deduped,
    conversionWarnings: warnings,
  };
}

function buildQueueSnapshotMap() {
  return getQueueSnapshots().reduce(function (result, item) {
    if (item && item.groupName) {
      result[item.groupName] = item;
    }
    return result;
  }, {});
}

function buildFunAsrRuntimeConfig(profileConfig) {
  const pythonDefaults = getFunAsrPythonClientConfig();
  const languageHintsRaw = String(
    readProfileEnv("FUN_ASR_LANGUAGE_HINTS", process.env.DATABAKER_AI_FUN_ASR_LANGUAGE_HINTS || "zh")
  ).trim();
  const languageHints = languageHintsRaw
    .split(/[,\s]+/)
    .map(function (item) {
      return String(item || "").trim();
    })
    .filter(Boolean)
    .slice(0, 8);
  const resolvedLanguageHints = languageHints.length > 0 ? languageHints : ["zh"];
  const pythonBin = String(
    process.env.MAGIC_DATA_MINNAN_FUNASR_PYTHON_BIN ||
      process.env.MAGIC_DATA_FUNASR_PYTHON_BIN ||
      process.env.DATABAKER_FUNASR_PYTHON_BIN ||
      pythonDefaults.pythonBin ||
      ""
  ).trim();
  return {
    providerMode: profileConfig.funAsrProvider,
    fallbackMode: profileConfig.funAsrProviderFallback,
    model: profileConfig.funAsrModel,
    timeoutMs: profileConfig.timeoutMs,
    mockEnabled: profileConfig.mockEnabled === true,
    hasApiKey: profileConfig.hasApiKey === true,
    languageHints: resolvedLanguageHints,
    apiBase: profileConfig.funAsrApiBase,
    pollIntervalMs: profileConfig.funAsrPollIntervalMs,
    pythonBin: pythonBin,
    pythonExists: pythonBin ? path.isAbsolute(pythonBin) || pythonBin.indexOf(".venv") >= 0 : false,
    pythonScriptPath: pythonDefaults.pythonScriptPath,
  };
}

async function runQueuedProviderTask(groupName, task, signal, options) {
  const normalizedModel = String(options?.model || "").trim();
  const queueKey = normalizedModel ? buildModelQueueKey(normalizedModel) : groupName;
  const queued = await enqueueProviderTask(queueKey, task, {
    signal: signal,
  });
  return {
    value: queued?.value,
    queueMeta: queued?.queueMeta || {},
  };
}

async function runFunAsrRecognition(request, profileConfig, requestId, signal) {
  const runtimeConfig = buildFunAsrRuntimeConfig(profileConfig);
  const baseInput = {
    audioUrl: request.audioUrl,
    pageText: request.platformDialectText || request.platformMandarinText || "",
  };
  const callRest = function () {
    return runQueuedProviderTask("fun_asr", function () {
      return requestFunAsrRecognitionRest(baseInput, {
        model: profileConfig.funAsrModel,
        timeoutMs: profileConfig.timeoutMs,
        requestId: requestId,
        signal: signal,
        clientConfig: {
          apiKey: profileConfig.apiKey,
          model: profileConfig.funAsrModel,
          timeoutMs: profileConfig.timeoutMs,
          mockEnabled: profileConfig.mockEnabled === true,
          hasApiKey: profileConfig.hasApiKey === true,
          languageHints: runtimeConfig.languageHints,
          apiBase: profileConfig.funAsrApiBase,
          pollIntervalMs: profileConfig.funAsrPollIntervalMs,
        },
      });
    }, signal, {
      model: profileConfig.funAsrModel,
    });
  };
  const callPython = function () {
    return runQueuedProviderTask("fun_asr", function () {
      return requestFunAsrRecognitionPython(baseInput, {
        model: profileConfig.funAsrModel,
        timeoutMs: profileConfig.timeoutMs,
        requestId: requestId,
        signal: signal,
        clientConfig: {
          apiKey: profileConfig.apiKey,
          model: profileConfig.funAsrModel,
          timeoutMs: profileConfig.timeoutMs,
          mockEnabled: profileConfig.mockEnabled === true,
          hasApiKey: profileConfig.hasApiKey === true,
          languageHints: runtimeConfig.languageHints,
          pythonBin: runtimeConfig.pythonBin,
          pythonScriptPath: runtimeConfig.pythonScriptPath,
        },
      });
    }, signal, {
      model: profileConfig.funAsrModel,
    });
  };

  if (runtimeConfig.providerMode === "python") {
    try {
      const primary = await callPython();
      return Object.assign({}, primary, { providerMode: "python", providerFallbackUsed: false });
    } catch (error) {
      if (runtimeConfig.fallbackMode !== "rest") {
        throw error;
      }
      const fallback = await callRest();
      return Object.assign({}, fallback, { providerMode: "rest", providerFallbackUsed: true });
    }
  }
  try {
    const primary = await callRest();
    return Object.assign({}, primary, { providerMode: "rest", providerFallbackUsed: false });
  } catch (error) {
    if (runtimeConfig.fallbackMode !== "python") {
      throw error;
    }
    const fallback = await callPython();
    return Object.assign({}, fallback, { providerMode: "python", providerFallbackUsed: true });
  }
}

function ensureApiKeyAvailable(profileConfig) {
  if (profileConfig.hasApiKey || profileConfig.mockEnabled) {
    return;
  }
  throw createHttpError(503, "missing-api-key", "missing-api-key");
}

function sanitizeError(error) {
  if (!error || typeof error !== "object") {
    return createHttpError(500, "unknown-error", "internal-error");
  }
  if (error.code === "ai-job-timeout") {
    return error;
  }
  if (error.name === "AbortError") {
    return normalizeAbortError(error, "当前任务超过60s，请重新请求。", "aborted", 504);
  }
  return error;
}

async function reviewCurrent(body, requestId) {
  const startedAtMs = Date.now();
  const profileConfig = getProfileConfig();
  const normalizedRequest = normalizeReviewRequest(body || {});
  const finalRequestId = normalizeText(requestId) || normalizeText(body?.requestId) || "";
  ensureApiKeyAvailable(profileConfig);

  const cacheKey = buildReviewCacheKey(normalizedRequest, profileConfig);
  const cached = getCachedResult(cacheKey);
  if (cached) {
    const cachedData = cloneJson(cached);
    cachedData.cacheHit = true;
    return {
      data: cachedData,
      cache: {
        hit: true,
      },
      backend: {
        baseUrl: profileConfig.baseUrl,
      },
    };
  }

  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timeoutTimer = controller
    ? setTimeout(function () {
        controller.abort(createJobTimeoutError());
      }, Math.max(1000, Number(profileConfig.timeoutMs) || DEFAULT_TIMEOUT_MS))
    : null;
  const signal = controller ? controller.signal : undefined;

  let listenDurationMs = 0;
  let compareDurationMs = 0;

  try {
    const baseLexiconContext = buildLexiconContext({
      platformDialectText: normalizedRequest.platformDialectText,
      platformMandarinText: normalizedRequest.platformMandarinText,
      heardDialectText: "",
      limit: 40,
    });

    let listen = null;
    let listenUsage = {};
    let compareUsage = {};
    let resultNormalized = null;
    let listenModelRuntime = normalizedRequest.listenModel;
    let compareModelRuntime = normalizedRequest.compareModel;
    let singleModelRuntime = normalizedRequest.singleModel;
    let queueMetaListen = {};
    let queueMetaCompare = {};
    let funAsrMeta = null;
    let recognitionConvertMeta = null;
    const rawModelText = {};
    const rawJson = {};
    const rawAiDebugStages = [];

    if (normalizedRequest.recognitionMode === "omni_single") {
      const omniPrompt = buildOmniSinglePrompt(normalizedRequest, baseLexiconContext);
      const omniStartedAt = Date.now();
      const queuedOmni = await runQueuedProviderTask("qwen_omni", function () {
        return requestOmniSingle(normalizedRequest, omniPrompt, {
          timeoutMs: profileConfig.timeoutMs,
          model: normalizedRequest.singleModel,
          enableThinking: normalizedRequest.enableThinking,
          aiOptions: normalizedRequest.aiOptions,
        });
      }, signal, {
        model: normalizedRequest.singleModel,
      });
      compareDurationMs = Date.now() - omniStartedAt;
      queueMetaCompare = queuedOmni.queueMeta || {};
      const omniResult = queuedOmni.value || {};
      const omniJson = parseModelJsonText(omniResult.rawText, finalRequestId);
      resultNormalized = normalizeOmniSingleComparison(omniJson, normalizedRequest);
      listen = resultNormalized.audioCheck;
      listenDurationMs = compareDurationMs;
      listenUsage = normalizeUsage(omniResult.usage);
      compareUsage = normalizeUsage(omniResult.usage);
      listenModelRuntime = normalizedRequest.singleModel;
      compareModelRuntime = normalizedRequest.singleModel;
      singleModelRuntime = normalizedRequest.singleModel;
      rawModelText.omniSingle = sanitizeDebugText(omniResult.rawText || "");
      rawJson.omniSingle = sanitizeDebugValue(omniJson || null);
      rawAiDebugStages.push({
        stage: "omni_single",
        provider: "qwen_omni",
        model: omniResult.model || normalizedRequest.singleModel || "",
        durationMs: compareDurationMs,
        queueMeta: queuedOmni.queueMeta || {},
        usage: normalizeUsage(omniResult.usage),
      });
    } else if (normalizedRequest.recognitionMode === "recognition_convert") {
      if (normalizedRequest.listenModel === "fun-asr") {
        const funAsrStartedAt = Date.now();
        const funAsrResult = await runFunAsrRecognition(
          normalizedRequest,
          profileConfig,
          finalRequestId,
          signal
        );
        listenDurationMs = Date.now() - funAsrStartedAt;
        queueMetaListen = funAsrResult.queueMeta || {};
        const funAsrValue = funAsrResult.value || {};
        listen = sanitizeAudioCheckFromFunAsr(funAsrValue, normalizedRequest);
        listenUsage = normalizeUsage(funAsrValue.usage);
        funAsrMeta = {
          providerMode: funAsrResult.providerMode || profileConfig.funAsrProvider,
          providerFallbackUsed: funAsrResult.providerFallbackUsed === true,
        };
        rawModelText.listen = sanitizeDebugValue(
          funAsrValue.rawText ||
            funAsrValue.heardText ||
            funAsrValue.heardDialectText ||
            ""
        );
        rawJson.listen = sanitizeDebugValue(
          funAsrValue.rawJson || {
            recognizedMandarinText: funAsrValue.heardText || "",
            isValidAudio: listen?.isValidAudio !== false,
          }
        );
        rawAiDebugStages.push({
          stage: "recognize_mandarin",
          provider: funAsrResult.providerMode || profileConfig.funAsrProvider || "fun-asr",
          model: profileConfig.funAsrModel || "fun-asr",
          durationMs: listenDurationMs,
          queueMeta: funAsrResult.queueMeta || {},
          fallbackUsed: funAsrResult.providerFallbackUsed === true,
          usage: normalizeUsage(funAsrValue.usage),
        });
      } else {
        const listenPrompt = buildRecognitionConvertListenPrompt(normalizedRequest, baseLexiconContext);
        const listenStartedAt = Date.now();
        const queuedListen = await runQueuedProviderTask("qwen_omni", function () {
          return requestListen(normalizedRequest, listenPrompt, {
            timeoutMs: profileConfig.timeoutMs,
            model: normalizedRequest.listenModel,
            enableThinking: normalizedRequest.enableThinking,
            aiOptions: normalizedRequest.aiOptions,
          });
        }, signal, {
          model: normalizedRequest.listenModel,
        });
        listenDurationMs = Date.now() - listenStartedAt;
        queueMetaListen = queuedListen.queueMeta || {};
        const listenResult = queuedListen.value || {};
        const listenJson = parseModelJsonText(listenResult.rawText, finalRequestId);
        listen = normalizeListenResponse(
          Object.assign({}, listenJson, {
            heardMandarinMeaning:
              normalizeText(listenJson?.recognizedMandarinText || listenJson?.heardMandarinMeaning || "") ||
              normalizeText(listenJson?.heardText || ""),
          })
        );
        listenUsage = normalizeUsage(listenResult.usage);
        listenModelRuntime = listenResult.model || listenModelRuntime;
        rawModelText.listen = sanitizeDebugText(listenResult.rawText || "");
        rawJson.listen = sanitizeDebugValue(listenJson || null);
        rawAiDebugStages.push({
          stage: "recognize_mandarin",
          provider: "qwen_omni",
          model: listenResult.model || normalizedRequest.listenModel || "",
          durationMs: listenDurationMs,
          queueMeta: queuedListen.queueMeta || {},
          usage: normalizeUsage(listenResult.usage),
        });
      }

      const recognizedMandarinText = normalizeText(
        listen?.heardMandarinMeaning || listen?.heardDialectText || ""
      );
      const conversion = buildRecognitionConvertByLexicon(
        recognizedMandarinText,
        baseLexiconContext,
        normalizedRequest.platformDialectText
      );
      recognitionConvertMeta = {
        recognizedMandarinText: conversion.recognizedMandarinText,
        convertedDialectText: conversion.convertedDialectText,
        lexiconMatches: conversion.lexiconMatches,
        conversionWarnings: conversion.conversionWarnings,
      };

      const compareLexiconContext = buildLexiconContext({
        platformDialectText: normalizedRequest.platformDialectText,
        platformMandarinText: normalizedRequest.platformMandarinText,
        heardDialectText: conversion.convertedDialectText || "",
        limit: 40,
      });
      const comparePrompt = buildRecognitionConvertComparePrompt(normalizedRequest, {
        recognizedMandarinText: conversion.recognizedMandarinText,
        convertedDialectText: conversion.convertedDialectText,
        listenEvidence: listen || {},
        lexiconContext: compareLexiconContext,
        lexiconMatches: conversion.lexiconMatches,
      });
      const compareStartedAt = Date.now();
      const queuedCompare = await runQueuedProviderTask("text_compare", function () {
        return requestCompare(
          {
            platformDialectText: normalizedRequest.platformDialectText,
            platformMandarinText: normalizedRequest.platformMandarinText,
            heardDialectText: conversion.convertedDialectText || "",
            heardMandarinMeaning: conversion.recognizedMandarinText || "",
            aiOptions: normalizedRequest.aiOptions,
          },
          comparePrompt,
          {
            timeoutMs: profileConfig.timeoutMs,
            model: normalizedRequest.compareModel,
            enableThinking: normalizedRequest.enableThinking,
            aiOptions: normalizedRequest.aiOptions,
          }
        );
      }, signal, {
        model: normalizedRequest.compareModel,
      });
      compareDurationMs = Date.now() - compareStartedAt;
      queueMetaCompare = queuedCompare.queueMeta || {};
      const compareResult = queuedCompare.value || {};
      const compareJson = parseModelJsonText(compareResult.rawText, finalRequestId);
      resultNormalized = normalizeRuleFirstComparison(compareJson, normalizedRequest, {
        heardDialectText: conversion.convertedDialectText || "",
        heardMandarinMeaning: conversion.recognizedMandarinText || "",
        isValidAudio: listen?.isValidAudio !== false,
        validityDecision: listen?.validityDecision || "uncertain",
        invalidReasons: Array.isArray(listen?.invalidReasons) ? listen.invalidReasons : [],
        riskFlags: Array.isArray(listen?.riskFlags) ? listen.riskFlags : [],
        genderGuess: listen?.genderGuess || "uncertain",
        ageRangeGuess: listen?.ageRangeGuess || "uncertain",
        confidence: Number(listen?.confidence || 0),
      });
      compareUsage = normalizeUsage(compareResult.usage);
      compareModelRuntime = compareResult.model || compareModelRuntime;
      rawModelText.compare = sanitizeDebugText(compareResult.rawText || "");
      rawJson.compare = sanitizeDebugValue(compareJson || null);
      rawAiDebugStages.push({
        stage: "convert_and_compare",
        provider: "text_compare",
        model: compareResult.model || normalizedRequest.compareModel || "",
        durationMs: compareDurationMs,
        queueMeta: queuedCompare.queueMeta || {},
        usage: normalizeUsage(compareResult.usage),
      });

      if (normalizeText(resultNormalized?.recommendations?.dialectText || "") === "") {
        resultNormalized.recommendations.dialectText = conversion.convertedDialectText || "";
      }
      if (Array.isArray(compareJson?.conversionWarnings) && compareJson.conversionWarnings.length > 0) {
        recognitionConvertMeta.conversionWarnings = compareJson.conversionWarnings
          .map(function (item) {
            return normalizeText(item);
          })
          .filter(Boolean);
      }
      if (Array.isArray(compareJson?.lexiconMatches) && compareJson.lexiconMatches.length > 0) {
        recognitionConvertMeta.lexiconMatches = sanitizeDebugValue(compareJson.lexiconMatches);
      }
      if (
        normalizeText(compareJson?.recognizedMandarinText || "") &&
        !recognitionConvertMeta.recognizedMandarinText
      ) {
        recognitionConvertMeta.recognizedMandarinText = normalizeText(compareJson.recognizedMandarinText);
      }
      if (
        normalizeText(compareJson?.convertedDialectText || "") &&
        !recognitionConvertMeta.convertedDialectText
      ) {
        recognitionConvertMeta.convertedDialectText = normalizeText(compareJson.convertedDialectText);
      }
      if (!listen?.isValidAudio) {
        resultNormalized.reviewConclusion = "risky";
        resultNormalized.shouldReview = true;
        if (resultNormalized.textRuleCheck.ruleIssues.indexOf("音频无效或不清晰，建议人工复核。") < 0) {
          resultNormalized.textRuleCheck.ruleIssues.push("音频无效或不清晰，建议人工复核。");
        }
      }
    } else {
      if (normalizedRequest.listenModel === "fun-asr") {
        const funAsrStartedAt = Date.now();
        const funAsrResult = await runFunAsrRecognition(
          normalizedRequest,
          profileConfig,
          finalRequestId,
          signal
        );
        listenDurationMs = Date.now() - funAsrStartedAt;
        queueMetaListen = funAsrResult.queueMeta || {};
        const funAsrValue = funAsrResult.value || {};
        listen = sanitizeAudioCheckFromFunAsr(funAsrValue, normalizedRequest);
        listenUsage = normalizeUsage(funAsrValue.usage);
        funAsrMeta = {
          providerMode: funAsrResult.providerMode || profileConfig.funAsrProvider,
          providerFallbackUsed: funAsrResult.providerFallbackUsed === true,
        };
        rawModelText.listen = sanitizeDebugValue(
          funAsrValue.rawText ||
            funAsrValue.heardText ||
            funAsrValue.heardDialectText ||
            ""
        );
        rawJson.listen = sanitizeDebugValue(
          funAsrValue.rawJson || {
            heardText: funAsrValue.heardText || "",
            heardDialectText: funAsrValue.heardDialectText || "",
            heardMandarinMeaning: funAsrValue.heardMandarinMeaning || "",
            isValidAudio: listen?.isValidAudio !== false,
          }
        );
        rawAiDebugStages.push({
          stage: "listen",
          provider: funAsrResult.providerMode || profileConfig.funAsrProvider || "fun-asr",
          model: profileConfig.funAsrModel || "fun-asr",
          durationMs: listenDurationMs,
          queueMeta: funAsrResult.queueMeta || {},
          fallbackUsed: funAsrResult.providerFallbackUsed === true,
          usage: normalizeUsage(funAsrValue.usage),
        });
      } else {
        const listenPrompt = buildListenPrompt(normalizedRequest, baseLexiconContext);
        const listenStartedAt = Date.now();
        const queuedListen = await runQueuedProviderTask("qwen_omni", function () {
          return requestListen(normalizedRequest, listenPrompt, {
            timeoutMs: profileConfig.timeoutMs,
            model: normalizedRequest.listenModel,
            enableThinking: normalizedRequest.enableThinking,
            aiOptions: normalizedRequest.aiOptions,
          });
        }, signal, {
          model: normalizedRequest.listenModel,
        });
        listenDurationMs = Date.now() - listenStartedAt;
        queueMetaListen = queuedListen.queueMeta || {};
        const listenResult = queuedListen.value || {};
        const listenJson = parseModelJsonText(listenResult.rawText, finalRequestId);
        listen = normalizeListenResponse(listenJson);
        listenUsage = normalizeUsage(listenResult.usage);
        listenModelRuntime = listenResult.model || listenModelRuntime;
        rawModelText.listen = sanitizeDebugText(listenResult.rawText || "");
        rawJson.listen = sanitizeDebugValue(listenJson || null);
        rawAiDebugStages.push({
          stage: "listen",
          provider: "qwen_omni",
          model: listenResult.model || normalizedRequest.listenModel || "",
          durationMs: listenDurationMs,
          queueMeta: queuedListen.queueMeta || {},
          usage: normalizeUsage(listenResult.usage),
        });
      }

      const compareLexiconContext = buildLexiconContext({
        platformDialectText: normalizedRequest.platformDialectText,
        platformMandarinText: normalizedRequest.platformMandarinText,
        heardDialectText: listen?.heardDialectText || "",
        limit: 40,
      });
      const comparePrompt = buildComparePrompt(
        normalizedRequest,
        listen || {
          heardDialectText: "",
          heardMandarinMeaning: "",
          isValidAudio: false,
          validityDecision: "uncertain",
          invalidReasons: [],
          riskFlags: [],
          genderGuess: "uncertain",
          ageRangeGuess: "uncertain",
          confidence: 0,
        },
        compareLexiconContext
      );
      const compareStartedAt = Date.now();
      const queuedCompare = await runQueuedProviderTask("text_compare", function () {
        return requestCompare(
          {
            platformDialectText: normalizedRequest.platformDialectText,
            platformMandarinText: normalizedRequest.platformMandarinText,
            heardDialectText: listen?.heardDialectText || "",
            heardMandarinMeaning: listen?.heardMandarinMeaning || "",
            aiOptions: normalizedRequest.aiOptions,
          },
          comparePrompt,
          {
            timeoutMs: profileConfig.timeoutMs,
            model: normalizedRequest.compareModel,
            enableThinking: normalizedRequest.enableThinking,
            aiOptions: normalizedRequest.aiOptions,
          }
        );
      }, signal, {
        model: normalizedRequest.compareModel,
      });
      compareDurationMs = Date.now() - compareStartedAt;
      queueMetaCompare = queuedCompare.queueMeta || {};
      const compareResult = queuedCompare.value || {};
      const compareJson = parseModelJsonText(compareResult.rawText, finalRequestId);
      resultNormalized = normalizeRuleFirstComparison(compareJson, normalizedRequest, listen);
      compareUsage = normalizeUsage(compareResult.usage);
      compareModelRuntime = compareResult.model || compareModelRuntime;
      rawModelText.compare = sanitizeDebugText(compareResult.rawText || "");
      rawJson.compare = sanitizeDebugValue(compareJson || null);
      rawAiDebugStages.push({
        stage: "compare",
        provider: "text_compare",
        model: compareResult.model || normalizedRequest.compareModel || "",
        durationMs: compareDurationMs,
        queueMeta: queuedCompare.queueMeta || {},
        usage: normalizeUsage(compareResult.usage),
      });

      if (!listen?.isValidAudio) {
        resultNormalized.reviewConclusion = "risky";
        resultNormalized.shouldReview = true;
        if (resultNormalized.textRuleCheck.ruleIssues.indexOf("音频无效或不清晰，建议人工复核。") < 0) {
          resultNormalized.textRuleCheck.ruleIssues.push("音频无效或不清晰，建议人工复核。");
        }
      }
    }

    const dialectRecommendation = applyRecommendationNormalization(
      resultNormalized.recommendations.dialectText,
      profileConfig
    );
    const mandarinRecommendation = normalizeToSimplifiedChinesePreservingLexicon(
      resultNormalized.recommendations.mandarinText
    );
    const totalDurationMs = Date.now() - startedAtMs;
    const effectiveTimeSeconds = computeEffectiveTimeSeconds(normalizedRequest);
    const estimatedIncome = estimateIncome(effectiveTimeSeconds);
    const showHeardText = normalizedRequest.showHeardText !== false;
    const normalizedSummary = normalizeText(
      resultNormalized?.overall?.summary || resultNormalized?.recommendations?.summary || ""
    );
    const speakerCheck = {
      gender: {
        isCorrect:
          resultNormalized?.speakerCheck?.gender?.isCorrect === true
            ? true
            : resultNormalized?.speakerCheck?.gender?.isCorrect === false
              ? false
              : null,
        platformValue: normalizeText(
          resultNormalized?.speakerCheck?.gender?.platformValue ||
            normalizedRequest?.speaker?.gender ||
            ""
        ),
        suggestedValue: normalizeText(
          resultNormalized?.speakerCheck?.gender?.suggestedValue ||
            listen?.genderGuess ||
            ""
        ),
        reason: normalizeText(resultNormalized?.speakerCheck?.gender?.reason || ""),
        confidence: Number(resultNormalized?.speakerCheck?.gender?.confidence || listen?.confidence || 0),
      },
      ageRange: {
        isCorrect:
          resultNormalized?.speakerCheck?.ageRange?.isCorrect === true
            ? true
            : resultNormalized?.speakerCheck?.ageRange?.isCorrect === false
              ? false
              : null,
        platformValue: normalizeText(
          resultNormalized?.speakerCheck?.ageRange?.platformValue ||
            normalizedRequest?.speaker?.ageRange ||
            ""
        ),
        suggestedValue: normalizeText(
          resultNormalized?.speakerCheck?.ageRange?.suggestedValue ||
            listen?.ageRangeGuess ||
            ""
        ),
        reason: normalizeText(resultNormalized?.speakerCheck?.ageRange?.reason || ""),
        confidence: Number(resultNormalized?.speakerCheck?.ageRange?.confidence || listen?.confidence || 0),
      },
    };
    const dialectTextCheck = {
      isCorrect:
        resultNormalized?.dialectTextCheck?.isCorrect === true
          ? true
          : resultNormalized?.dialectTextCheck?.isCorrect === false
            ? false
            : null,
      platformValue: normalizeText(
        resultNormalized?.dialectTextCheck?.platformValue || normalizedRequest.platformDialectText || ""
      ),
      suggestedValue: dialectRecommendation.text,
      reason: normalizeText(resultNormalized?.dialectTextCheck?.reason || ""),
      confidence: Number(resultNormalized?.dialectTextCheck?.confidence || 0),
    };
    const mandarinTextCheck = {
      isCorrect:
        resultNormalized?.mandarinTextCheck?.isCorrect === true
          ? true
          : resultNormalized?.mandarinTextCheck?.isCorrect === false
            ? false
            : null,
      platformValue: normalizeText(
        resultNormalized?.mandarinTextCheck?.platformValue || normalizedRequest.platformMandarinText || ""
      ),
      suggestedValue: normalizeToSimplifiedChinesePreservingLexicon(mandarinRecommendation),
      reason: normalizeText(resultNormalized?.mandarinTextCheck?.reason || ""),
      confidence: Number(resultNormalized?.mandarinTextCheck?.confidence || 0),
    };
    const rawAiDebug = sanitizeDebugValue({
      hasRaw:
        Object.keys(rawModelText).length > 0 ||
        Object.keys(rawJson).length > 0,
      modelMode: normalizedRequest.modelMode,
      recognitionStrategy: normalizedRequest.recognitionStrategy,
      recognitionMode: normalizedRequest.recognitionMode,
      derivedPipelineMode: normalizedRequest.pipelineMode,
      pipelineMode:
        normalizedRequest.recognitionMode === "recognition_convert"
          ? "recognition_convert"
          : normalizedRequest.pipelineMode,
      recognizedMandarinText: recognitionConvertMeta?.recognizedMandarinText || "",
      convertedDialectText: recognitionConvertMeta?.convertedDialectText || "",
      lexiconMatches: recognitionConvertMeta?.lexiconMatches || [],
      conversionWarnings: recognitionConvertMeta?.conversionWarnings || [],
      stages: rawAiDebugStages,
    });

    const responseData = {
      requestId: finalRequestId,
      reviewConclusion: resultNormalized.reviewConclusion,
      shouldReview: resultNormalized.shouldReview === true,
      modelMode: normalizedRequest.modelMode,
      recognitionStrategy: normalizedRequest.recognitionStrategy,
      recognitionMode: normalizedRequest.recognitionMode,
      pipelineMode:
        normalizedRequest.recognitionMode === "recognition_convert"
          ? "recognition_convert"
          : normalizedRequest.recognitionMode,
      derivedPipelineMode: normalizedRequest.pipelineMode,
      effectiveTime: effectiveTimeSeconds,
      estimatedIncome: estimatedIncome,
      platformBaseline: {
        dialectText: normalizedRequest.platformDialectText,
        mandarinText: normalizedRequest.platformMandarinText,
        gender: normalizedRequest?.speaker?.gender || "",
        ageRange: normalizedRequest?.speaker?.ageRange || "",
      },
      speakerCheck: speakerCheck,
      dialectTextCheck: dialectTextCheck,
      mandarinTextCheck: mandarinTextCheck,
      overall: {
        reviewConclusion: resultNormalized.reviewConclusion,
        shouldReview: resultNormalized.shouldReview === true,
        summary: normalizedSummary,
      },
      audioCheck: {
        isValidAudio: listen?.isValidAudio !== false,
        validityDecision: listen?.validityDecision || "uncertain",
        riskFlags: Array.isArray(listen?.riskFlags) ? listen.riskFlags : [],
        invalidReasons: Array.isArray(listen?.invalidReasons) ? listen.invalidReasons : [],
        genderGuess: listen?.genderGuess || "uncertain",
        ageRangeGuess: listen?.ageRangeGuess || "uncertain",
        heardDialectText: showHeardText ? normalizeText(listen?.heardDialectText || "") : "",
        heardMandarinMeaning: showHeardText ? normalizeText(listen?.heardMandarinMeaning || "") : "",
        confidence: Number(listen?.confidence || 0),
      },
      textRuleCheck: {
        dialectIssues: Array.isArray(resultNormalized?.textRuleCheck?.dialectIssues)
          ? resultNormalized.textRuleCheck.dialectIssues
          : [],
        mandarinIssues: Array.isArray(resultNormalized?.textRuleCheck?.mandarinIssues)
          ? resultNormalized.textRuleCheck.mandarinIssues
          : [],
        translationConsistencyIssues: Array.isArray(
          resultNormalized?.textRuleCheck?.translationConsistencyIssues
        )
          ? resultNormalized.textRuleCheck.translationConsistencyIssues
          : [],
        punctuationIssues: Array.isArray(resultNormalized?.textRuleCheck?.punctuationIssues)
          ? resultNormalized.textRuleCheck.punctuationIssues
          : [],
        speakerAttributeIssues: Array.isArray(resultNormalized?.textRuleCheck?.speakerAttributeIssues)
          ? resultNormalized.textRuleCheck.speakerAttributeIssues
          : [],
        lexiconIssues: mergeLexiconIssues(
          resultNormalized?.textRuleCheck?.lexiconIssues,
          dialectRecommendation.rewriteChanges
        ),
        ruleIssues: Array.isArray(resultNormalized?.textRuleCheck?.ruleIssues)
          ? resultNormalized.textRuleCheck.ruleIssues
          : [],
      },
      recommendations: {
        dialectText: dialectRecommendation.text,
        mandarinText: normalizeToSimplifiedChinesePreservingLexicon(mandarinRecommendation),
        summary: normalizedSummary,
      },
      lexicon: {
        enabled: baseLexiconContext.enabled === true,
        status: baseLexiconContext.status || "unknown",
        matchedCount: Number(baseLexiconContext.matchedCount || 0),
        matches: Array.isArray(baseLexiconContext.matches) ? baseLexiconContext.matches : [],
        rewriteMode: profileConfig.lexiconRewriteMode,
      },
      models: {
        listenModel: listenModelRuntime || "",
        compareModel: compareModelRuntime || "",
        conversionModel:
          normalizedRequest.recognitionMode === "recognition_convert"
            ? compareModelRuntime || ""
            : "",
        reviewModel: compareModelRuntime || "",
        singleModel: singleModelRuntime || "",
        funAsrModel: normalizedRequest.listenModel === "fun-asr" ? profileConfig.funAsrModel : "",
      },
      usage: {
        listen: normalizedRequest.recognitionMode === "omni_single" ? {} : listenUsage,
        compare: normalizedRequest.recognitionMode === "omni_single" ? {} : compareUsage,
        single: normalizedRequest.recognitionMode === "omni_single" ? listenUsage : {},
      },
      cost: estimateProjectCost({
        listen: {
          modelId: normalizedRequest.recognitionMode === "omni_single" ? "" : listenModelRuntime || "",
          usage: normalizedRequest.recognitionMode === "omni_single" ? {} : listenUsage,
          outputMode: "text",
        },
        compare: {
          modelId: normalizedRequest.recognitionMode === "omni_single" ? "" : compareModelRuntime || "",
          usage: normalizedRequest.recognitionMode === "omni_single" ? {} : compareUsage,
          outputMode: "text",
        },
        single: {
          modelId: singleModelRuntime || "",
          usage: normalizedRequest.recognitionMode === "omni_single" ? listenUsage : {},
          outputMode: "text",
        },
      }),
      queue: {
        listen: queueMetaListen || {},
        compare: queueMetaCompare || {},
      },
      timing: {
        listenDurationMs: listenDurationMs,
        compareDurationMs: compareDurationMs,
        totalDurationMs: totalDurationMs,
      },
      rawAiDebug: rawAiDebug,
      rawModelText: sanitizeDebugValue(rawModelText),
      rawJson: sanitizeDebugValue(rawJson),
      recognitionConvert:
        normalizedRequest.recognitionMode === "recognition_convert"
          ? {
              recognitionStrategy: "mandarin_to_dialect",
              pipelineMode: "recognition_convert",
              recognizedMandarinText: recognitionConvertMeta?.recognizedMandarinText || "",
              convertedDialectText: recognitionConvertMeta?.convertedDialectText || "",
              lexiconMatches: recognitionConvertMeta?.lexiconMatches || [],
              conversionWarnings: recognitionConvertMeta?.conversionWarnings || [],
            }
          : null,
      mock: Boolean(profileConfig.mockEnabled),
      funAsr: funAsrMeta,
      // Legacy compatibility for old panel fields.
      verdict: !listen?.isValidAudio
        ? "invalid_audio"
        : resultNormalized?.legacyComparison?.verdict || "uncertain",
      listen: {
        heardDialectText: showHeardText ? normalizeText(listen?.heardDialectText || "") : "",
        heardMandarinMeaning: showHeardText ? normalizeText(listen?.heardMandarinMeaning || "") : "",
        isValidAudio: listen?.isValidAudio !== false,
        invalidReasons: Array.isArray(listen?.invalidReasons) ? listen.invalidReasons : [],
        riskFlags: Array.isArray(listen?.riskFlags) ? listen.riskFlags : [],
        confidence: Number(listen?.confidence || 0),
      },
      comparison: {
        dialectLine: resultNormalized?.legacyComparison?.dialectLine || {
          decision: "uncertain",
          platformText: normalizeText(normalizedRequest.platformDialectText),
          aiText: "",
          recommendedText: normalizeText(resultNormalized.recommendations.dialectText || ""),
          issues: [],
        },
        mandarinLine: resultNormalized?.legacyComparison?.mandarinLine || {
          decision: "uncertain",
          platformText: normalizeText(normalizedRequest.platformMandarinText),
          recommendedText: normalizeText(resultNormalized.recommendations.mandarinText || ""),
          issues: [],
        },
        lexiconIssues: resultNormalized?.legacyComparison?.lexiconIssues || [],
        ruleIssues: resultNormalized?.legacyComparison?.ruleIssues || [],
      },
    };

    setCachedResult(cacheKey, responseData, profileConfig.cacheTtlMs);

    return {
      data: responseData,
      cache: {
        hit: false,
      },
      backend: {
        baseUrl: profileConfig.baseUrl,
      },
    };
  } catch (error) {
    const normalizedError = sanitizeError(error);
    throw normalizedError;
  } finally {
    if (timeoutTimer) {
      clearTimeout(timeoutTimer);
    }
  }
}

function createHealthPayload() {
  const profileConfig = getProfileConfig();
  const queueGroups = buildQueueSnapshotMap();
  const lexiconState = getLexiconState();
  const funAsrPythonConfig = getFunAsrPythonClientConfig();
  const runtime = buildAsyncJobRuntimeMeta();

  return {
    success: true,
    service: SERVICE_NAME,
    scriptId: SCRIPT_ID,
    component: COMPONENT_NAME,
    provider: "dashscope-qwen+fun-asr",
    ruleVersion: RULE_VERSION,
    status: profileConfig.hasApiKey || profileConfig.mockEnabled ? "ready" : "missing-api-key",
    mockEnabled: profileConfig.mockEnabled === true,
    hasApiKey: profileConfig.hasApiKey === true,
    modelMode: profileConfig.modelMode,
    recognitionStrategy: profileConfig.recognitionStrategy,
    recognitionMode: profileConfig.recognitionMode,
    pipelineMode: profileConfig.recognitionMode,
    derivedPipelineMode: profileConfig.derivedPipelineMode,
    recognitionModeOptions: RECOGNITION_MODE_OPTIONS.slice(),
    modelModeOptions: MODEL_MODE_OPTIONS.slice(),
    recognitionStrategyOptions: RECOGNITION_STRATEGY_OPTIONS.slice(),
    supportedPipelineModes: SUPPORTED_PIPELINE_MODES.slice(),
    listenModel: profileConfig.listenModel,
    listenModelOptions: LISTEN_MODEL_OPTIONS.slice(),
    singleModel: profileConfig.singleModel,
    singleModelOptions: SINGLE_MODEL_OPTIONS.slice(),
    compareModel: profileConfig.compareModel,
    compareModelOptions: COMPARE_MODEL_OPTIONS.slice(),
    funAsrModel: profileConfig.funAsrModel,
    funAsrProvider: profileConfig.funAsrProvider,
    funAsrProviderFallback: profileConfig.funAsrProviderFallback || "",
    funAsrRestConfigured: profileConfig.hasApiKey || profileConfig.mockEnabled,
    funAsrPythonConfigured: funAsrPythonConfig.pythonExists === true,
    funAsrApiBase: profileConfig.funAsrApiBase,
    omniModel: profileConfig.singleModel,
    timeoutMs: profileConfig.timeoutMs,
    enableThinking: profileConfig.enableThinkingDefault === true,
    lexiconRewriteMode: profileConfig.lexiconRewriteMode,
    allowClientModelOverride: profileConfig.allowClientModelOverride === true,
    defaultsPrompt: {
      listenPrompt: DEFAULT_LISTEN_TEMPLATE,
      comparePrompt: DEFAULT_COMPARE_TEMPLATE,
      omniSinglePrompt: DEFAULT_OMNI_SINGLE_TEMPLATE,
      recognitionConvertListenPrompt: DEFAULT_RECOGNITION_CONVERT_LISTEN_TEMPLATE,
      recognitionConvertComparePrompt: DEFAULT_RECOGNITION_CONVERT_COMPARE_TEMPLATE,
    },
    supportedParams: SUPPORTED_REQUEST_PARAMS,
    queue: {
      groups: queueGroups,
      settings: {
        qwenOmni: getGroupSettings("qwen_omni"),
        funAsr: getGroupSettings("fun_asr"),
        textCompare: getGroupSettings("text_compare"),
      },
      maxSize: getGlobalQueueMaxSize(),
      retryMax: getGlobalRetryMax(),
      modelPoolPolicy: runtime.queue.defaultModelPool,
    },
    jobs: runtime.jobs,
    runtime,
    cache: getCacheSnapshot(profileConfig),
    lexicon: {
      enabled: lexiconState.enabled === true,
      status: lexiconState.status || "unknown",
      source: lexiconState.source || "",
      rowCount: Array.isArray(lexiconState.rows) ? lexiconState.rows.length : 0,
      warningMessage: String(lexiconState.warningMessage || "").trim(),
    },
    callLogDir: getLogDir(),
    notes: {
      compatibility:
        "保留 legacy listen/comparison/verdict 字段；旧字段 reviewModel/listenModel 仍可兼容解析。",
      safetyBoundary: "AI 仅辅助建议，不自动保存、不自动提交、不自动审核、不自动领取、不自动流转。",
      envPriority:
        "优先读取 MAGIC_DATA_MINNAN_AI_*，未设置时回退 MAGIC_DATA_AI_*；不默认依赖 DATABAKER_AI_*。",
    },
  };
}

function createDefaultsPayload() {
  const profileConfig = getProfileConfig();
  const queueGroups = buildQueueSnapshotMap();
  const funAsrPythonConfig = getFunAsrPythonClientConfig();
  const runtime = buildAsyncJobRuntimeMeta();
  return {
    success: true,
    service: SERVICE_NAME,
    scriptId: SCRIPT_ID,
    component: COMPONENT_NAME,
    defaults: {
      modelMode: profileConfig.modelMode,
      recognitionStrategy: profileConfig.recognitionStrategy,
      recognitionMode: profileConfig.recognitionMode,
      pipelineMode: profileConfig.recognitionMode,
      derivedPipelineMode: profileConfig.derivedPipelineMode,
      recognitionModeOptions: RECOGNITION_MODE_OPTIONS.slice(),
      modelModeOptions: MODEL_MODE_OPTIONS.slice(),
      recognitionStrategyOptions: RECOGNITION_STRATEGY_OPTIONS.slice(),
      supportedPipelineModes: SUPPORTED_PIPELINE_MODES.slice(),
      listenModel: profileConfig.listenModel,
      listenModelOptions: LISTEN_MODEL_OPTIONS.slice(),
      singleModel: profileConfig.singleModel,
      singleModelOptions: SINGLE_MODEL_OPTIONS.slice(),
      compareModel: profileConfig.compareModel,
      compareModelOptions: COMPARE_MODEL_OPTIONS.slice(),
      funAsrModel: profileConfig.funAsrModel,
      funAsrProvider: profileConfig.funAsrProvider,
      funAsrProviderFallback: profileConfig.funAsrProviderFallback || "",
      funAsrRestConfigured: profileConfig.hasApiKey || profileConfig.mockEnabled,
      funAsrPythonConfigured: funAsrPythonConfig.pythonExists === true,
      funAsrApiBase: profileConfig.funAsrApiBase,
      omniModel: profileConfig.singleModel,
      timeoutMs: profileConfig.timeoutMs,
      enableThinking: profileConfig.enableThinkingDefault === true,
      temperature: DEFAULT_REQUEST_PARAMS.temperature,
      top_p: DEFAULT_REQUEST_PARAMS.top_p,
      max_tokens: DEFAULT_REQUEST_PARAMS.max_tokens,
      max_completion_tokens: DEFAULT_REQUEST_PARAMS.max_completion_tokens,
      presence_penalty: DEFAULT_REQUEST_PARAMS.presence_penalty,
      frequency_penalty: DEFAULT_REQUEST_PARAMS.frequency_penalty,
      seed: DEFAULT_REQUEST_PARAMS.seed,
      stop: DEFAULT_REQUEST_PARAMS.stop,
      listenPrompt: DEFAULT_LISTEN_TEMPLATE,
      comparePrompt: DEFAULT_COMPARE_TEMPLATE,
      omniSinglePrompt: DEFAULT_OMNI_SINGLE_TEMPLATE,
      recognitionConvertListenPrompt: DEFAULT_RECOGNITION_CONVERT_LISTEN_TEMPLATE,
      recognitionConvertComparePrompt: DEFAULT_RECOGNITION_CONVERT_COMPARE_TEMPLATE,
      lexiconRewriteMode: profileConfig.lexiconRewriteMode,
    },
    supportedParams: SUPPORTED_REQUEST_PARAMS,
    queue: {
      groups: queueGroups,
      settings: {
        qwenOmni: getGroupSettings("qwen_omni"),
        funAsr: getGroupSettings("fun_asr"),
        textCompare: getGroupSettings("text_compare"),
      },
      maxSize: getGlobalQueueMaxSize(),
      retryMax: getGlobalRetryMax(),
      modelPoolPolicy: runtime.queue.defaultModelPool,
    },
    jobs: runtime.jobs,
    runtime,
    cache: getCacheSnapshot(profileConfig),
    notes: {
      promptOverride: "Prompt 可在前端覆盖；空 override 使用后端默认。",
      responseFormat: "结构化输出由后端固定控制，前端不配置。",
      compatibility:
        "兼容 reviewModel/listenModel/enableThinking/reviewPrompt 旧字段；新字段优先 recognitionMode/listenModel/compareModel/singleModel。",
      requestMode:
        "默认短请求创建 /jobs 任务，再轮询 job 状态；同步 review-current 只保留兼容 / 调试入口。",
    },
  };
}

function readRequestBody(request) {
  return new Promise(function (resolve, reject) {
    let body = "";
    request.on("data", function (chunk) {
      body += chunk;
      if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) {
        const tooLargeError = createHttpError(413, "请求体超过 3MB。", "payload-too-large");
        reject(tooLargeError);
        request.destroy();
      }
    });
    request.on("end", function () {
      resolve(body);
    });
    request.on("error", reject);
  });
}

module.exports = {
  COMPONENT_NAME,
  DEFAULT_TIMEOUT_MS,
  RECOGNITION_MODE_OPTIONS,
  SCRIPT_ID,
  SERVICE_NAME,
  SUPPORTED_PIPELINE_MODES,
  createDefaultsPayload,
  createHealthPayload,
  normalizeReviewRequest,
  readRequestBody,
  reviewCurrent,
};

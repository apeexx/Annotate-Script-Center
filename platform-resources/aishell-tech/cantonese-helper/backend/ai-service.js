"use strict";

const { estimateProjectCost } = require("../../../backend/ai/model-pricing");

const SCRIPT_ID = "aishellTechCantoneseAssistant";
const DEFAULT_TIMEOUT_MS = 60000;
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
  "你是繁體粵語口語音頻識別助手。只寫出當前音頻中實際聽到的文本原文。",
  "只輸出當前音頻的最終轉寫文本；不得輸出 JSON、欄位名、Markdown、解釋或多餘文字。",
  "最終轉寫必須保留實際聽到的繁體粵語口語；不要翻譯成普通話，不要潤色、補寫、刪減、改數字、規整標點或轉換繁簡。",
  "純靜音或完全聽不清時，直接輸出空字符串。",
].join("\n");

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeListenText(value) {
  return typeof value === "string" ? value : "";
}

function createHttpError(statusCode, message, code) {
  const error = new Error(String(message || "请求失败。"));
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
  return {
    model: SUPPORTED_OMNI_MODELS.indexOf(model) >= 0 ? model : defaults.model,
    prompt: normalizeText(prompt) ? prompt : defaults.prompt,
    params: normalizeOmniParams(source.params),
    enableThinking: false,
  };
}

function normalizeRecommendRequest(value) {
  const source = value && typeof value === "object" ? value : {};
  const taskItemId = normalizeText(source.taskItemId || source.itemId);
  const audioUrl = normalizeText(source.audioUrl);
  const referenceText = normalizeText(source.referenceText);
  if (!taskItemId) {
    throw createHttpError(400, "缺少 taskItemId。", "missing-task-item-id");
  }
  if (!audioUrl) {
    throw createHttpError(400, "缺少可用音频地址。", "invalid-audio-url");
  }
  return {
    requestId: normalizeText(source.requestId || source.clientRequestId),
    taskId: normalizeText(source.taskId),
    packageId: normalizeText(source.packageId),
    taskItemId,
    fileName: normalizeText(source.fileName),
    audioUrl,
    referenceText,
    existingMarkText: normalizeText(source.existingMarkText || source.currentInputText),
    duration: Math.max(0, Number(source.duration || 0) || 0),
    itemNumber: Math.max(0, Number(source.itemNumber ?? source.number) || 0),
    aiUsageOperatorName: normalizeText(source.aiUsageOperatorName).slice(0, 40),
    platformUserName: normalizeText(source.platformUserName).slice(0, 80),
    platformUserId: normalizeText(source.platformUserId).slice(0, 120),
    frontConcurrency: Math.max(0, Number(source.frontConcurrency || source.batchConcurrency) || 0),
    timeoutMs: Math.max(1000, Math.min(DEFAULT_TIMEOUT_MS, Number(source.timeoutMs) || DEFAULT_TIMEOUT_MS)),
    pipelineMode: "omni_single_raw_listen",
    recognitionStrategy: "cantonese_raw_listen",
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
    cost: estimateProjectCost({
      omni: { modelId: model, usage: normalizedUsage, outputMode: "text" },
    }),
  };
}

function createDefaultsPayload() {
  return {
    success: true,
    scriptId: SCRIPT_ID,
    defaults: {
      timeoutMs: DEFAULT_TIMEOUT_MS,
      aiOmni: buildOmniDefaults(),
    },
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
    service: "aishell-tech-cantonese-helper-ai-recommend",
    route: "aishell-tech/cantonese-helper/ai/recommend",
  });
}

function buildRecommendSuccessBody(value) {
  const source = value && typeof value === "object" ? value : {};
  const data = source.data && typeof source.data === "object" ? source.data : {};
  const meta = source.meta && typeof source.meta === "object" ? source.meta : {};
  return {
    success: true,
    data: {
      taskId: normalizeText(data.taskId),
      packageId: normalizeText(data.packageId),
      taskItemId: normalizeText(data.taskItemId),
      fileName: normalizeText(data.fileName),
      referenceText: normalizeText(data.referenceText),
      existingMarkText: normalizeText(data.existingMarkText),
      listenText: normalizeListenText(data.listenText),
      needHumanReview: data.needHumanReview === true,
    },
    meta,
  };
}

function buildRecommendErrorBody(value) {
  const source = value && typeof value === "object" ? value : {};
  const error = source.error && typeof source.error === "object" ? source.error : {};
  return {
    success: false,
    error: {
      code: normalizeText(error.code) || "request-error",
      message: normalizeText(error.safeMessage || error.message || "希尔贝壳粤语助手请求失败。"),
      stage: normalizeText(error.stage) || "recognize",
      retryable: error.retryable === true,
      providerStatus: Number(error.providerStatus || error.statusCode || 0) || 0,
    },
    meta: error.meta && typeof error.meta === "object" ? error.meta : {},
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

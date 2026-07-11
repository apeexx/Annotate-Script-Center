"use strict";

const { buildAsyncJobRuntimeMeta } = require("../../../backend/ai-framework/runtime/ai-runtime-meta");
const {
  DEFAULT_REQUEST_PARAMS,
  DATABAKER_SINGLE_MODEL_OPTIONS,
  getQueueGroupsHealth,
  normalizeDataBakerSingleModel,
  parseTimeoutMs,
  resolveDefaultSingleModel,
} = require("./config");

const SERVICE_NAME = "aishell-tech-vietnamese-helper-ai-recommend";
const SCRIPT_ID = "aishellTechVietnameseAssistant";
const COMPONENT_NAME = "asr-voice-ai";
const DEFAULT_SINGLE_PROMPT = [
  "你正在处理越南语音频转写。",
  "请同时输出越南语文本和语速建议。",
  "只输出 JSON，不要输出 Markdown、解释、前缀或引号。",
  'JSON 固定字段：{"text":"...","speed":"slow|normal|fast"}。',
  'speed 只能返回 "slow"、"normal"、"fast" 三个值之一。',
  "保留越南语重音字符和正常单词空格。",
  "按越南语书写习惯处理标点与空格：去掉标点前多余空格，标点后保持单个空格。",
  "不要翻译成中文，不要改写成其他语言，不要补充词表写法。",
  "如果句末缺少终止标点，请补英文句号。",
].join("\n");

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizePromptText(value, fallback) {
  const text = String(value || "").replace(/\r\n/g, "\n").trim().slice(0, 8000);
  return text || String(fallback || "").trim();
}

function normalizeNullableNumber(value, min, max) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    return null;
  }
  return Number(number.toFixed(3));
}

function normalizeNullableInteger(value, min, max) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number) || number < min || number > max) {
    return null;
  }
  return number;
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

function createHttpError(statusCode, message, code) {
  const error = new Error(String(message || "请求失败。"));
  error.statusCode = Number(statusCode) || 500;
  error.code = normalizeText(code) || "request-error";
  return error;
}

function normalizeStageParams(value) {
  const source = value && typeof value === "object" ? value : {};
  const result = {};
  const temperature = normalizeNullableNumber(source.temperature, 0, 2);
  if (temperature !== null) {
    result.temperature = temperature;
  }
  const topP = normalizeNullableNumber(source.top_p, 0, 1);
  if (topP !== null) {
    result.top_p = topP;
  }
  const maxTokens = normalizeNullableInteger(source.max_tokens, 1, 8192);
  if (maxTokens !== null) {
    result.max_tokens = maxTokens;
  }
  const maxCompletionTokens = normalizeNullableInteger(source.max_completion_tokens, 1, 8192);
  if (maxCompletionTokens !== null) {
    result.max_completion_tokens = maxCompletionTokens;
  }
  const presencePenalty = normalizeNullableNumber(source.presence_penalty, -2, 2);
  if (presencePenalty !== null) {
    result.presence_penalty = presencePenalty;
  }
  const frequencyPenalty = normalizeNullableNumber(source.frequency_penalty, -2, 2);
  if (frequencyPenalty !== null) {
    result.frequency_penalty = frequencyPenalty;
  }
  const seed = normalizeNullableInteger(source.seed, 0, 2147483647);
  if (seed !== null) {
    result.seed = seed;
  }
  const stop = normalizeStopSequences(source.stop || source.stopSequences);
  if (stop.length > 0) {
    result.stop = stop;
  }
  return result;
}

function buildStageDefaults() {
  const singleModel = resolveDefaultSingleModel();
  return {
    recognize: {
      model: singleModel,
      modelOptions: DATABAKER_SINGLE_MODEL_OPTIONS.slice(),
      prompt: DEFAULT_SINGLE_PROMPT,
      temperature: DEFAULT_REQUEST_PARAMS.temperature,
      top_p: DEFAULT_REQUEST_PARAMS.top_p,
      max_tokens: DEFAULT_REQUEST_PARAMS.max_tokens,
      max_completion_tokens: "",
      presence_penalty: DEFAULT_REQUEST_PARAMS.presence_penalty,
      frequency_penalty: DEFAULT_REQUEST_PARAMS.frequency_penalty,
      seed: "",
      stop: "",
    },
  };
}

function normalizeRecommendRequest(input) {
  const source = input && typeof input === "object" ? input : {};
  const requestId = normalizeText(source.requestId || source.clientRequestId);
  const taskItemId = normalizeText(source.taskItemId || source.itemId);
  const audioUrl = normalizeText(source.audioUrl);
  if (!taskItemId) {
    throw createHttpError(400, "缺少 taskItemId。", "missing-task-item-id");
  }
  if (!audioUrl) {
    throw createHttpError(400, "缺少可用音频地址。", "invalid-audio-url");
  }

  const stageDefaults = buildStageDefaults();
  const recognizeStage =
    source.aiStages?.recognize && typeof source.aiStages.recognize === "object"
      ? source.aiStages.recognize
      : {};
  const requestParams = normalizeStageParams(
    recognizeStage.params && typeof recognizeStage.params === "object"
      ? recognizeStage.params
      : source.aiOptions
  );
  const singleModel = normalizeDataBakerSingleModel(
    recognizeStage.model || source.singleModel || source.aiRecommendSingleModel,
    stageDefaults.recognize.model
  );
  const singlePrompt = normalizePromptText(
    recognizeStage.prompt || source.singlePrompt || source.aiRecommendSinglePrompt,
    stageDefaults.recognize.prompt
  );

  return {
    requestId,
    taskId: normalizeText(source.taskId),
    packageId: normalizeText(source.packageId),
    taskItemId,
    fileName: normalizeText(source.fileName),
    audioUrl,
    referenceText: normalizeText(source.referenceText),
    existingMarkText: normalizeText(source.existingMarkText),
    duration: Number(source.duration || 0) || 0,
    itemNumber: Number(source.itemNumber || source.number || 0) || 0,
    batchRunId: normalizeText(source.batchRunId),
    batchItemIndex: Number(source.batchItemIndex || 0) || 0,
    batchProcessKey: normalizeText(source.batchProcessKey),
    frontConcurrency: Number(source.frontConcurrency || 0) || 0,
    clientVersion: normalizeText(source.clientVersion),
    aiUsageOperatorName: normalizeText(source.aiUsageOperatorName),
    platformUserName: normalizeText(source.platformUserName),
    platformUserId: normalizeText(source.platformUserId),
    modelMode: "omni_single",
    pipelineMode: "omni_single",
    recognitionStrategy: "vietnamese_transcription_speed",
    singleModel,
    singlePrompt,
    requestParams,
    aiStages: {
      recognize: {
        model: singleModel,
        prompt: singlePrompt,
        params: requestParams,
      },
    },
  };
}

function buildRecommendSuccessBody(result) {
  const source = result && typeof result === "object" ? result : {};
  const meta = source.meta && typeof source.meta === "object" ? source.meta : {};
  return {
    success: true,
    data: {
      taskItemId: normalizeText(source.taskItemId || meta.taskItemId),
      recommendedText: normalizeText(source.recommendedText),
      recommendedSpeed: normalizeText(source.recommendedSpeed),
      referenceText: normalizeText(source.referenceText),
    },
    meta,
  };
}

function buildRecommendErrorBody(input) {
  const source = input && typeof input === "object" ? input : {};
  const error = source.error instanceof Error ? source.error : createHttpError(500, "请求失败。");
  const meta = error.meta && typeof error.meta === "object" ? error.meta : {};
  return {
    success: false,
    error: {
      code: normalizeText(error.code) || "request-error",
      message: normalizeText(error.message) || "请求失败。",
      stage: normalizeText(error.stage || meta.stage || "recognize"),
      retryable: error.retryable === true,
      providerStatus: Number(error.providerStatus || error.statusCode || 0) || undefined,
      providerCode: normalizeText(error.providerCode) || "",
    },
    meta: Object.assign({}, meta, {
      requestId: normalizeText(source.requestId || meta.requestId || error.requestId),
      stage: normalizeText(error.stage || meta.stage || "recognize"),
      cancelled: meta.cancelled === true,
    }),
  };
}

function createDefaultsPayload() {
  const stageDefaults = buildStageDefaults();
  const runtime = buildAsyncJobRuntimeMeta({
    serviceName: SERVICE_NAME,
    scriptId: SCRIPT_ID,
    componentName: COMPONENT_NAME,
  });
  return {
    success: true,
    defaults: {
      singleModelOptions: stageDefaults.recognize.modelOptions,
      singleModel: stageDefaults.recognize.model,
      singlePrompt: stageDefaults.recognize.prompt,
      timeoutMs: parseTimeoutMs(),
      temperature: stageDefaults.recognize.temperature,
      top_p: stageDefaults.recognize.top_p,
      max_tokens: stageDefaults.recognize.max_tokens,
      max_completion_tokens: stageDefaults.recognize.max_completion_tokens,
      presence_penalty: stageDefaults.recognize.presence_penalty,
      frequency_penalty: stageDefaults.recognize.frequency_penalty,
      seed: stageDefaults.recognize.seed,
      stop: stageDefaults.recognize.stop,
      stages: stageDefaults,
      runtime,
    },
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
  };
}

function createHealthPayload() {
  const defaultsPayload = createDefaultsPayload();
  return {
    success: true,
    health: {
      serviceName: SERVICE_NAME,
      scriptId: SCRIPT_ID,
      timeoutMs: parseTimeoutMs(),
      queueGroups: getQueueGroupsHealth(),
      runtime: defaultsPayload.defaults.runtime,
    },
    defaults: defaultsPayload.defaults,
  };
}

module.exports = {
  COMPONENT_NAME,
  SCRIPT_ID,
  SERVICE_NAME,
  buildRecommendErrorBody,
  buildRecommendSuccessBody,
  createDefaultsPayload,
  createHealthPayload,
  normalizeRecommendRequest,
};

"use strict";

const path = require("path");

const { createAiCallLogger } = require("../../../backend/ai-call-log");
const { createStageLogSupport } = require("../../../backend/ai-call-log/stage-log-support");

const DEFAULT_LOG_DIR = path.join(__dirname, "logs");
const stageLogSupport = createStageLogSupport({
  stages: [
    {
      key: "listen",
      label: "听音",
      modelKeys: ["listenModel"],
    },
    {
      key: "compare",
      label: "比较",
      modelKeys: ["compareModel"],
    },
    {
      key: "single",
      label: "单模型",
      modelKeys: ["singleModel"],
    },
  ],
});

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getLogDir() {
  const customDir = normalizeText(process.env.DATABAKER_AI_CALL_LOG_DIR);
  return customDir || DEFAULT_LOG_DIR;
}

function parseAudioHostname(audioUrl) {
  try {
    return new URL(String(audioUrl || "")).hostname || "";
  } catch (_error) {
    return "";
  }
}

function buildCombinedUsage(usage) {
  const source = isPlainObject(usage) ? usage : {};
  const blocks = [source.listen, source.compare, source.single].filter(isPlainObject);
  if (blocks.length === 0) {
    return {
      promptTokens: normalizeNumber(source.promptTokens || source.prompt_tokens),
      completionTokens: normalizeNumber(source.completionTokens || source.completion_tokens),
      totalTokens: normalizeNumber(source.totalTokens || source.total_tokens),
    };
  }
  const promptTokens = blocks.reduce(function (total, block) {
    return total + normalizeNumber(block.promptTokens || block.prompt_tokens);
  }, 0);
  const completionTokens = blocks.reduce(function (total, block) {
    return total + normalizeNumber(block.completionTokens || block.completion_tokens);
  }, 0);
  const totalTokens =
    normalizeNumber(source.totalTokens || source.total_tokens) || promptTokens + completionTokens;
  const result = {
    promptTokens,
    completionTokens,
    totalTokens,
  };
  if (isPlainObject(source.listen)) {
    result.listen = source.listen;
  }
  if (isPlainObject(source.compare)) {
    result.compare = source.compare;
  }
  if (isPlainObject(source.single)) {
    result.single = source.single;
  }
  return result;
}

function buildModels(record) {
  const source = record && typeof record === "object" ? record : {};
  const response = isPlainObject(source.response) ? source.response : {};
  const model = isPlainObject(response.model) ? response.model : {};
  return {
    listenModel: normalizeText(model.listen || source.listenModel),
    compareModel: normalizeText(model.compare || source.compareModel),
    singleModel: normalizeText(model.single || source.singleModel),
    pipelineMode: normalizeText(response.pipelineMode || source.pipelineMode),
  };
}

function buildTiming(record) {
  const source = record && typeof record === "object" ? record : {};
  const response = isPlainObject(source.response) ? source.response : {};
  const timing = isPlainObject(response.timing) ? response.timing : {};
  return {
    totalDurationMs: normalizeNumber(source.durationMs || timing.totalDurationMs),
    listenDurationMs: normalizeNumber(source.listenDurationMs || timing.listenDurationMs),
    compareDurationMs: normalizeNumber(source.compareDurationMs || timing.compareDurationMs),
  };
}

function buildError(record) {
  const source = record && typeof record === "object" ? record : {};
  const models = buildModels(source);
  const timing = buildTiming(source);
  return {
    code: normalizeText(source.errorCode),
    message: normalizeText(source.errorMessage),
    requestId: normalizeText(source.requestId),
    meta: {
      usage: buildCombinedUsage(source.response && source.response.usage),
      timing,
      models,
      cost: isPlainObject(source.response?.cost) ? source.response.cost : {},
    },
  };
}

function toLoggerContext(record) {
  const source = record && typeof record === "object" ? record : {};
  const request = isPlainObject(source.request) ? source.request : {};
  const response = isPlainObject(source.response) ? source.response : {};
  const models = buildModels(source);
  const timing = buildTiming(source);
  return {
    createdAt: source.createdAt,
    requestId: source.requestId,
    rawBody: {
      aiUsageOperatorName: request.aiUsageOperatorName,
      platformUserName: request.platformUserName,
      platformUserId: request.platformUserId,
    },
    result:
      source.success === false
        ? null
        : {
            meta: {
              usage: buildCombinedUsage(response.usage),
              timing,
              models,
              cost: isPlainObject(response.cost) ? response.cost : {},
            },
            data: response,
          },
    error: source.success === false ? buildError(source) : null,
    request,
    response,
  };
}

const aiCallLogger = createAiCallLogger({
  logDir: getLogDir(),
  platformId: "dataBaker",
  scriptId: "dataBakerRoundOneQuality",
  extraColumns: [
    { key: "annotatorName", header: "标注员" },
    { key: "collectId", header: "采集ID" },
    { key: "itemId", header: "条目ID" },
    { key: "textId", header: "文本ID" },
    { key: "sentenceNumber", header: "句序号" },
    { key: "audioHostname", header: "音频域名" },
    { key: "pipelineMode", header: "流水线模式" },
    { key: "listenModel", header: "听音模型" },
    { key: "compareModel", header: "比较模型" },
    { key: "singleModel", header: "单模型" },
    ...stageLogSupport.extraColumns,
  ],
  buildExtendedRow(context) {
    const request = context?.request || {};
    const models = buildModels(context);
    return {
      annotatorName: normalizeText(request.annotatorName),
      collectId: normalizeText(request.collectId),
      itemId: normalizeText(request.itemId),
      textId: normalizeText(request.textId),
      sentenceNumber: normalizeText(request.sentenceNumber),
      audioHostname: parseAudioHostname(request.audioUrl),
      pipelineMode: normalizeText(context?.response?.pipelineMode || models.pipelineMode),
      listenModel: models.listenModel,
      compareModel: models.compareModel,
      singleModel: models.singleModel,
      ...stageLogSupport.buildRow(context),
    };
  },
  pickRawResponse(context) {
    return context?.response || {};
  },
  pickRawError(context) {
    return {
      requestId: normalizeText(context?.requestId),
      code: normalizeText(context?.errorCode),
      message: normalizeText(context?.errorMessage),
      response: context?.response || null,
    };
  },
});

function appendAiCallLog(record) {
  return aiCallLogger.append(toLoggerContext(record));
}

function appendAiCallLogSafe(record) {
  try {
    return appendAiCallLog(record);
  } catch (error) {
    console.warn("[databaker-ai-log] append failed:", error?.message || error);
    return null;
  }
}

module.exports = {
  aiCallLogger,
  appendAiCallLog,
  appendAiCallLogSafe,
  getLogDir,
  summarizeAiCallLogs: aiCallLogger.summarize,
};

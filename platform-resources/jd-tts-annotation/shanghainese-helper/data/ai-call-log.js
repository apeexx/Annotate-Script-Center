"use strict";

const path = require("path");

const { createAiCallLogger } = require("../../../backend/ai-call-log");
const { createStageLogSupport } = require("../../../backend/ai-call-log/stage-log-support");

const DEFAULT_LOG_DIR = path.join(__dirname, "runtime");
const stageLogSupport = createStageLogSupport({
  stages: [
    {
      key: "recognize",
      label: "识别",
      modelKeys: ["omniModel", "recognizeModel"],
      useTotalUsage: true,
    },
  ],
});

function normalizeText(value) {
  return String(value || "").trim();
}

const aiCallLogger = createAiCallLogger({
  logDir: DEFAULT_LOG_DIR,
  platformId: "jdTtsAnnotation",
  scriptId: "jdTtsShanghaineseAssistant",
  extraColumns: [
    { key: "cancelled", header: "是否取消" },
    { key: "stage", header: "阶段" },
    { key: "recognizeDurationMs", header: "识别耗时毫秒" },
    { key: "queueWaitMs", header: "排队等待毫秒" },
    { key: "retryCount", header: "重试次数" },
    { key: "cacheHit", header: "缓存命中" },
    { key: "utteranceId", header: "语句ID" },
    { key: "audioChecksumDigest", header: "音频校验摘要" },
    { key: "pipelineMode", header: "执行链路" },
    { key: "recognizeModel", header: "识别模型" },
    ...stageLogSupport.extraColumns,
  ],
  buildExtendedRow(context) {
    const request = context?.normalizedRequest || {};
    const meta =
      (context?.error && context.error.meta) ||
      (context?.result && context.result.meta) ||
      {};
    const timing = meta.timing || {};
    const queue = meta.queue || {};
    const cache = meta.cache || {};
    const models = meta.models || {};
    return {
      cancelled: meta.cancelled === true ? "true" : "false",
      stage: normalizeText(context?.error?.stage || meta.stage),
      recognizeDurationMs: normalizeText(timing.recognizeDurationMs || timing.totalDurationMs),
      queueWaitMs: normalizeText(queue.totalQueueWaitMs),
      retryCount: normalizeText(meta.retryCount),
      cacheHit: cache.hit === true ? "true" : "false",
      utteranceId: normalizeText(request.utteranceId),
      audioChecksumDigest: normalizeText(request.checksum),
      pipelineMode: normalizeText(request.pipelineMode || models.pipelineMode),
      recognizeModel: normalizeText(models.omniModel || models.recognizeModel || request.aiOmni?.model),
      ...stageLogSupport.buildRow(context),
    };
  },
  pickRawResponse() {
    return null;
  },
  pickRawError(context) {
    const error = context?.error || {};
    return {
      requestId: normalizeText(error.requestId || context?.requestId),
      code: normalizeText(error.code),
      stage: normalizeText(error.stage),
      message: normalizeText(error.safeMessage || error.message),
      providerStatus: Number(error.providerStatus || error.statusCode || 0) || 0,
    };
  },
});

function appendJdTtsShanghaineseAiCallLogSafe(input) {
  return aiCallLogger.appendSafe(input);
}

module.exports = {
  DEFAULT_LOG_DIR,
  CSV_COLUMNS: aiCallLogger.schema,
  aiCallLogger,
  appendJdTtsShanghaineseAiCallLogSafe,
};

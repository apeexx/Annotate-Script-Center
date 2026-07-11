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
      modelKeys: ["recognizeModel", "singleModel"],
      useTotalUsage: true,
    },
  ],
});

function normalizeText(value) {
  return String(value || "").trim();
}

function formatDatePart(input) {
  const date = input ? new Date(input) : new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

const aiCallLogger = createAiCallLogger({
  logDir: DEFAULT_LOG_DIR,
  platformId: "aishellTech",
  scriptId: "aishellTechThaiAssistant",
  extraColumns: [
    { key: "cancelled", header: "是否取消" },
    { key: "stage", header: "阶段" },
    { key: "recognizeDurationMs", header: "识别耗时毫秒" },
    { key: "queueWaitMs", header: "排队等待毫秒" },
    { key: "retryCount", header: "重试次数" },
    { key: "cacheHit", header: "缓存命中" },
    { key: "taskId", header: "任务ID" },
    { key: "packageId", header: "分包ID" },
    { key: "taskItemId", header: "条目ID" },
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
      recognizeDurationMs: normalizeText(
        timing.recognizeDurationMs || timing.listenDurationMs
      ),
      queueWaitMs: normalizeText(queue.totalQueueWaitMs),
      retryCount: normalizeText(meta.retryCount),
      cacheHit: cache.hit === true ? "true" : "false",
      taskId: normalizeText(request.taskId),
      packageId: normalizeText(request.packageId),
      taskItemId: normalizeText(request.taskItemId),
      pipelineMode: normalizeText(request.pipelineMode || models.pipelineMode),
      recognizeModel: normalizeText(
        models.recognizeModel || models.singleModel || request.singleModel
      ),
      ...stageLogSupport.buildRow(context),
    };
  },
  pickRawResponse(context) {
    return context?.result || null;
  },
  pickRawError(context) {
    return context?.error || null;
  },
});

function getAishellAiCallLogFilePath(logDir, createdAt) {
  return path.join(
    normalizeText(logDir) || DEFAULT_LOG_DIR,
    "ai-calls-" + formatDatePart(createdAt) + ".csv"
  );
}

function appendAishellAiCallLogSafe(input) {
  return aiCallLogger.appendSafe(input);
}

module.exports = {
  CSV_COLUMNS: aiCallLogger.schema,
  DEFAULT_LOG_DIR,
  aiCallLogger,
  appendAishellAiCallLogSafe,
  getAishellAiCallLogFilePath,
};

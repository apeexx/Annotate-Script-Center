"use strict";

const path = require("path");

const { createAiCallLogger } = require("../../../backend/ai-call-log");
const { createStageLogSupport } = require("../../../backend/ai-call-log/stage-log-support");

const DEFAULT_LOG_DIR = path.join(__dirname, "runtime");
const stageLogSupport = createStageLogSupport({
  stages: [
    {
      key: "convert",
      label: "转换",
      modelKeys: ["convertModel", "candidateModel"],
    },
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

function getLogDir() {
  return DEFAULT_LOG_DIR;
}

const aiCallLogger = createAiCallLogger({
  logDir: DEFAULT_LOG_DIR,
  platformId: "aishellTech",
  scriptId: "aishellTechMinnanAssistant",
  extraColumns: [
    { key: "cancelled", header: "是否取消" },
    { key: "stage", header: "阶段" },
    { key: "convertDurationMs", header: "转换耗时毫秒" },
    { key: "listenDurationMs", header: "听音耗时毫秒" },
    { key: "compareDurationMs", header: "比较耗时毫秒" },
    { key: "queueWaitMs", header: "排队等待毫秒" },
    { key: "retryCount", header: "重试次数" },
    { key: "cacheHit", header: "缓存命中" },
    { key: "taskId", header: "任务ID" },
    { key: "packageId", header: "分包ID" },
    { key: "taskItemId", header: "条目ID" },
    { key: "pipelineMode", header: "执行链路" },
    { key: "convertModel", header: "转换模型" },
    { key: "listenModel", header: "听音模型" },
    { key: "compareModelFamily", header: "比较方式" },
    { key: "compareModel", header: "比较模型" },
    ...stageLogSupport.extraColumns,
  ],
  buildExtendedRow(context) {
    const request = context?.normalizedRequest || {};
    const meta =
      (context?.error && context.error.meta) ||
      (context?.result && context.result.meta) ||
      {};
    const timing = meta.timing || context?.result?.timing || {};
    const queue = meta.queue || {};
    const cache = meta.cache || {};
    const models = meta.models || context?.result?.models || {};
    return {
      cancelled: meta.cancelled === true ? "true" : "false",
      stage: normalizeText(context?.error?.stage || meta.stage),
      convertDurationMs: normalizeText(timing.convertDurationMs || timing.candidateDurationMs),
      listenDurationMs: normalizeText(timing.listenDurationMs),
      compareDurationMs: normalizeText(timing.compareDurationMs),
      queueWaitMs: normalizeText(queue.totalQueueWaitMs),
      retryCount: normalizeText(meta.retryCount),
      cacheHit: cache.hit === true ? "true" : "false",
      taskId: normalizeText(request.taskId),
      packageId: normalizeText(request.packageId),
      taskItemId: normalizeText(request.taskItemId),
      pipelineMode: normalizeText(request.pipelineMode || models.pipelineMode),
      convertModel: normalizeText(
        models.convertModel || request.convertModel || models.candidateModel || request.candidateModel
      ),
      listenModel: normalizeText(models.listenModel || request.listenModel),
      compareModelFamily: normalizeText(
        models.compareModelFamily || request.compareFamily
      ),
      compareModel: normalizeText(models.compareModel || request.compareModel),
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

function buildAishellAiCallLogRow(input) {
  return aiCallLogger.buildRow(input);
}

function appendAishellAiCallLog(input) {
  return aiCallLogger.append(input);
}

function appendAishellAiCallLogSafe(input) {
  return aiCallLogger.appendSafe(input);
}

module.exports = {
  CSV_COLUMNS: aiCallLogger.schema,
  DEFAULT_LOG_DIR,
  aiCallLogger,
  appendAishellAiCallLog,
  appendAishellAiCallLogSafe,
  buildAishellAiCallLogRow,
  getAishellAiCallLogFilePath,
  getLogDir,
};

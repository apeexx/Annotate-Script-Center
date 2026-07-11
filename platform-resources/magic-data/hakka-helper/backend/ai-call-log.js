"use strict";

const path = require("path");

const {
  createAiCallLogger,
} = require("../../../backend/ai-call-log");
const { createStageLogSupport } = require("../../../backend/ai-call-log/stage-log-support");
const { SCRIPT_ID } = require("./ai-review-request");

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
      label: "文本修正",
      modelKeys: ["compareModel", "reviewModel"],
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

function parseAudioHostname(audioUrl) {
  try {
    return new URL(String(audioUrl || "")).hostname || "";
  } catch (_error) {
    return "";
  }
}

function getLogDir() {
  const customDir = normalizeText(
    process.env.MAGIC_DATA_HAKKA_AI_CALL_LOG_DIR || process.env.MAGIC_DATA_AI_CALL_LOG_DIR
  );
  return customDir || DEFAULT_LOG_DIR;
}

const aiCallLogger = createAiCallLogger({
  logDir: getLogDir(),
  platformId: "magicData",
  scriptId: SCRIPT_ID,
  extraColumns: [
    { key: "pageType", header: "页面类型" },
    { key: "taskItemId", header: "任务条目ID" },
    { key: "samplingRecordId", header: "抽样记录ID" },
    { key: "projectName", header: "项目名称" },
    { key: "audioHostname", header: "音频域名" },
    { key: "effectiveTime", header: "有效时长秒" },
    { key: "modelMode", header: "模型方案" },
    { key: "recognitionStrategy", header: "识别策略" },
    { key: "recognitionMode", header: "识别模式" },
    { key: "reviewMode", header: "审核模式" },
    { key: "listenModel", header: "听音模型" },
    { key: "compareModel", header: "比较模型" },
    { key: "singleModel", header: "单模型" },
    ...stageLogSupport.extraColumns,
  ],
  buildExtendedRow(context) {
    const normalizedRequest = context?.normalizedRequest || {};
    const input = normalizedRequest.input || {};
    const projectOptions = normalizedRequest.projectOptions || {};
    const models = context?.execution?.models || {};
    return {
      pageType: normalizeText(input.pageType),
      taskItemId: normalizeText(input.taskItemId),
      samplingRecordId: normalizeText(input.samplingRecordId),
      projectName: normalizeText(input.projectName || context?.rawBody?.projectName),
      audioHostname: parseAudioHostname(input.audioUrl),
      effectiveTime: normalizeText(input.effectiveTime),
      modelMode: normalizeText(projectOptions.modelMode),
      recognitionStrategy: normalizeText(projectOptions.recognitionStrategy),
      recognitionMode: normalizeText(projectOptions.recognitionMode || input.recognitionMode),
      reviewMode: normalizeText(input.reviewMode),
      listenModel: normalizeText(models.listenModel || projectOptions.listenModel),
      compareModel: normalizeText(models.compareModel || projectOptions.compareModel),
      singleModel: normalizeText(models.singleModel || projectOptions.singleModel),
      ...stageLogSupport.buildRow(context),
    };
  },
});

module.exports = {
  DEFAULT_LOG_DIR,
  aiCallLogger,
  appendAiCallLog: aiCallLogger.append,
  appendAiCallLogSafe: aiCallLogger.appendSafe,
  getLogDir,
  summarizeAiCallLogs: aiCallLogger.summarize,
};

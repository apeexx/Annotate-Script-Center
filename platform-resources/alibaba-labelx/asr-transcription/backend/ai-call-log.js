"use strict";

const path = require("path");

const {
  createAiCallLogger,
} = require("../../../backend/ai-call-log");
const { createStageLogSupport } = require("../../../backend/ai-call-log/stage-log-support");
const { SCRIPT_ID } = require("./ai-suggest-request");

const DEFAULT_LOG_DIR = path.join(__dirname, "logs");
const stageLogSupport = createStageLogSupport({
  stages: [
    {
      key: "recommend",
      label: "推荐",
      usageKeys: ["recommend"],
      modelKeys: ["activeModel", "model"],
    },
  ],
});

function normalizeText(value) {
  return String(value || "").trim();
}

const aiCallLogger = createAiCallLogger({
  logDir: DEFAULT_LOG_DIR,
  platformId: "alibabaLabelx",
  scriptId: SCRIPT_ID,
  extraColumns: [
    { key: "itemIndex", header: "条目序号" },
    { key: "audioCandidateCount", header: "音频候选数" },
    { key: "textCandidateCount", header: "文本候选数" },
    { key: "invalidAudioCount", header: "无效音频数" },
    { key: "currentTextLength", header: "当前文本长度" },
    { key: "listenModel", header: "听音模型" },
    { key: "compareModel", header: "比较模型" },
    { key: "activeModel", header: "实际调用模型" },
    { key: "enableThinking", header: "开启Thinking" },
    ...stageLogSupport.extraColumns,
  ],
  buildExtendedRow(context) {
    const input = context?.normalizedRequest?.input || {};
    const projectOptions = context?.normalizedRequest?.projectOptions || {};
    const projectResult = context?.execution?.projectResult || context?.execution?.pipelineResult || {};
    const models = context?.execution?.models || projectResult.models || {};
    return {
      itemIndex: normalizeText(input.itemIndex),
      audioCandidateCount: normalizeText(Array.isArray(input.audioCandidates) ? input.audioCandidates.length : 0),
      textCandidateCount: normalizeText(Array.isArray(input.textCandidates) ? input.textCandidates.length : 0),
      invalidAudioCount: normalizeText(input.invalidAudioCount),
      currentTextLength: normalizeText(String(input.currentText || "").length),
      listenModel: normalizeText(models.listenModel || projectOptions.listenModel),
      compareModel: normalizeText(models.compareModel || projectOptions.compareModel),
      activeModel: normalizeText(models.activeModel || projectResult.model),
      enableThinking: projectOptions.enableThinking === true ? "true" : "false",
      ...stageLogSupport.buildRow(context),
    };
  },
});

module.exports = {
  aiCallLogger,
  appendAiCallLog: aiCallLogger.append,
  appendAiCallLogSafe: aiCallLogger.appendSafe,
  getLogDir: aiCallLogger.getLogDir,
  summarizeAiCallLogs: aiCallLogger.summarize,
};

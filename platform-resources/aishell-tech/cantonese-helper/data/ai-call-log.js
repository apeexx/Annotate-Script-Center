"use strict";

const path = require("path");
const { createAiCallLogger } = require("../../../backend/ai-call-log");

const DEFAULT_LOG_DIR = path.join(__dirname, "runtime");
const aiCallLogger = createAiCallLogger({
  logDir: DEFAULT_LOG_DIR,
  platformId: "aishellTech",
  scriptId: "aishellTechCantoneseAssistant",
  extraColumns: [
    { key: "taskId", header: "任务ID" },
    { key: "packageId", header: "分包ID" },
    { key: "taskItemId", header: "条目ID" },
    { key: "recognizeModel", header: "识别模型" },
  ],
  buildExtendedRow(context) {
    const request = context?.normalizedRequest || {};
    const meta = context?.result?.meta || context?.error?.meta || {};
    return {
      taskId: String(request.taskId || ""),
      packageId: String(request.packageId || ""),
      taskItemId: String(request.taskItemId || ""),
      recognizeModel: String(meta?.models?.recognizeModel || request.singleModel || ""),
    };
  },
});

function appendAishellCantoneseAiCallLogSafe(input) {
  return aiCallLogger.appendSafe(input);
}

module.exports = {
  DEFAULT_LOG_DIR,
  aiCallLogger,
  appendAishellCantoneseAiCallLogSafe,
};

"use strict";

const { aiCallLogger } = require("../backend/ai-call-log");
const {
  SCRIPT_ID,
  normalizeReviewRequest,
} = require("../backend/ai-service");

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeInput(body) {
  const normalizedReviewRequest = normalizeReviewRequest(body || {});

  return {
    input: {
      taskItemId: normalizedReviewRequest.taskItemId,
      samplingRecordId: normalizedReviewRequest.samplingRecordId,
      audioUrl: normalizedReviewRequest.audioUrl,
      platformDialectText: normalizedReviewRequest.platformDialectText,
      platformMandarinText: normalizedReviewRequest.platformMandarinText,
      recognitionMode: normalizedReviewRequest.recognitionMode,
    },
    projectOptions: {
      modelMode:
        normalizedReviewRequest.recognitionMode === "omni_single"
          ? "omni_single"
          : "two_stage",
      recognitionStrategy:
        normalizedReviewRequest.recognitionMode === "recognition_convert"
          ? "mandarin_to_dialect"
          : "direct_dialect",
      recognitionMode: normalizedReviewRequest.recognitionMode,
      listenModel: normalizedReviewRequest.listenModel,
      compareModel: normalizedReviewRequest.compareModel,
      singleModel: normalizedReviewRequest.singleModel,
      enableThinking: normalizedReviewRequest.enableThinking === true,
    },
    runtimeContext: {
      normalizedReviewRequest,
    },
  };
}

function exposeProjectResult(pipelineResult) {
  if (pipelineResult && typeof pipelineResult === "object" && pipelineResult.data) {
    return pipelineResult.data;
  }
  return pipelineResult && typeof pipelineResult === "object" ? pipelineResult : null;
}

function buildReviewSuccessBody(context) {
  const pipelineResult = context?.execution?.pipelineResult || {};
  return {
    success: true,
    data: pipelineResult.data || {},
    cache: pipelineResult.cache || { hit: false },
    backend: pipelineResult.backend || {},
  };
}

function buildReviewErrorBody(context) {
  const error = context?.error || {};
  const responseBody = {
    success: false,
    requestId: normalizeText(context?.requestId || error?.requestId),
    code: normalizeText(error?.code) || "request-error",
    message: normalizeText(error?.message || "Magic Data 闽南语助手请求失败。").slice(0, 240),
    scriptId: SCRIPT_ID,
  };
  const summary = normalizeText(error?.summary);
  if (summary) {
    responseBody.summary = summary.slice(0, 200);
  }
  return responseBody;
}

module.exports = {
  projectId: "magic-data/minnan-helper",
  platform: "magic-data",
  scriptId: SCRIPT_ID,
  routeKey: "review-current",
  aiCallLogger,
  normalizeInput,
  exposeProjectResult,
  buildReviewSuccessBody,
  buildReviewErrorBody,
};

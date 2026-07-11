"use strict";

const { aiCallLogger } = require("../backend/ai-call-log");
const {
  SCRIPT_ID,
  normalizeReviewRequest,
} = require("../backend/ai-review-request");

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeInput(body) {
  const normalizedReviewRequest = normalizeReviewRequest(body || {});

  return {
    input: {
      pageType: normalizedReviewRequest.pageType,
      taskItemId: normalizedReviewRequest.taskItemId,
      samplingRecordId: normalizedReviewRequest.samplingRecordId,
      projectName: normalizedReviewRequest.projectName,
      audioUrl: normalizedReviewRequest.audioUrl,
      audioDuration: normalizedReviewRequest.audioDuration,
      effectiveStartTime: normalizedReviewRequest.effectiveStartTime,
      effectiveEndTime: normalizedReviewRequest.effectiveEndTime,
      effectiveTime: normalizedReviewRequest.effectiveTime,
      platformDialectText: normalizedReviewRequest.platformDialectText,
      platformMandarinText: normalizedReviewRequest.platformMandarinText,
      speaker: normalizedReviewRequest.speaker,
      recognitionMode: normalizedReviewRequest.recognitionMode,
      reviewMode: normalizedReviewRequest.reviewMode,
    },
    projectOptions: {
      modelMode: normalizedReviewRequest.modelMode,
      recognitionStrategy: normalizedReviewRequest.recognitionStrategy,
      recognitionMode: normalizedReviewRequest.recognitionMode,
      listenModel: normalizedReviewRequest.listenModel,
      compareModel: normalizedReviewRequest.compareModel,
      singleModel: normalizedReviewRequest.singleModel,
      reviewModel: normalizedReviewRequest.reviewModel,
      rulesProfile: normalizedReviewRequest.rulesProfile,
      showHeardText: normalizedReviewRequest.showHeardText === true,
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
  };
}

function buildReviewErrorBody(context) {
  const error = context?.error || {};
  const responseBody = {
    success: false,
    requestId: normalizeText(context?.requestId || error?.requestId),
    code: normalizeText(error?.code) || "request-error",
    message: normalizeText(error?.message || "Magic Data AI review-current 请求失败。").slice(0, 240),
  };
  if (normalizeText(error?.code) === "provider-http-error") {
    const summary = normalizeText(error?.summary);
    if (summary) {
      responseBody.summary = summary.slice(0, 200);
    }
  }
  return responseBody;
}

module.exports = {
  projectId: "magic-data/hakka-helper",
  platform: "magic-data",
  scriptId: SCRIPT_ID,
  routeKey: "review-current",
  routeAliases: ["magic-data/annotator"],
  aiCallLogger,
  normalizeInput,
  exposeProjectResult,
  buildReviewSuccessBody,
  buildReviewErrorBody,
};

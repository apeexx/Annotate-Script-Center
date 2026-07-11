"use strict";

const {
  SCRIPT_ID,
  buildRecommendErrorBody,
  buildRecommendSuccessBody,
  normalizeRecommendRequest,
} = require("../backend/ai-service");

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeInput(body) {
  const normalizedRecommendRequest = normalizeRecommendRequest(body || {});

  return {
    input: {
      taskId: normalizedRecommendRequest.taskId,
      packageId: normalizedRecommendRequest.packageId,
      taskItemId: normalizedRecommendRequest.taskItemId,
      fileName: normalizedRecommendRequest.fileName,
      audioUrl: normalizedRecommendRequest.audioUrl,
      referenceText: normalizedRecommendRequest.referenceText,
      existingMarkText: normalizedRecommendRequest.existingMarkText,
      duration: normalizedRecommendRequest.duration,
    },
    projectOptions: {
      modelMode: normalizedRecommendRequest.modelMode,
      recognitionStrategy: normalizedRecommendRequest.recognitionStrategy,
      pipelineMode: normalizedRecommendRequest.pipelineMode,
      listenModel: normalizedRecommendRequest.listenModel,
      compareModel: normalizedRecommendRequest.compareModel,
      singleModel: normalizedRecommendRequest.singleModel,
      enableThinking: normalizedRecommendRequest.enableThinking === true,
    },
    runtimeContext: {
      normalizedRecommendRequest,
    },
  };
}

function exposeProjectResult(pipelineResult) {
  return pipelineResult && typeof pipelineResult === "object" ? pipelineResult : null;
}

function buildRecommendSuccessBodyFromContext(context) {
  const source = context && typeof context === "object" ? context : {};
  return buildRecommendSuccessBody({
    requestId: normalizeText(source.requestId || source.normalizedRequest?.requestId),
    data: source.data || source.execution?.projectResult?.data,
    meta: source.meta || source.execution?.projectResult?.meta,
  });
}

function buildRecommendErrorBodyFromContext(context) {
  const source = context && typeof context === "object" ? context : {};
  return buildRecommendErrorBody({
    error: source.error,
    requestId: normalizeText(source.requestId || source.error?.requestId),
  });
}

module.exports = {
  projectId: "aishell-tech/minnan-helper",
  platform: "aishell-tech",
  scriptId: SCRIPT_ID,
  routeKey: "recommend",
  normalizeInput,
  exposeProjectResult,
  buildRecommendSuccessBody: buildRecommendSuccessBodyFromContext,
  buildRecommendErrorBody: buildRecommendErrorBodyFromContext,
};

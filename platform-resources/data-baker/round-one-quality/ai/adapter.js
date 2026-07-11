"use strict";

const {
  LEGACY_OMNI_COMMIT,
} = require("../backend/ai-legacy-omni-service");
const {
  normalizeRecommendRequest,
} = require("../backend/ai-service");

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeNullableInteger(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 0;
  }
  return number;
}

function normalizeInput(body) {
  const normalizedRecommendRequest = normalizeRecommendRequest(body || {});

  return {
    input: {
      collectId: normalizedRecommendRequest.collectId,
      itemId: normalizedRecommendRequest.itemId,
      textId: normalizedRecommendRequest.textId,
      audioUrl: normalizedRecommendRequest.audioUrl,
      pageText: normalizedRecommendRequest.pageText,
      sentenceNumber: normalizedRecommendRequest.sentenceNumber,
    },
    projectOptions: {
      recognitionMode: normalizedRecommendRequest.recognitionMode,
      listenModel: normalizedRecommendRequest.listenModel,
      compareModel: normalizedRecommendRequest.compareModel,
      singleModel: normalizedRecommendRequest.singleModel,
    },
    runtimeContext: {
      normalizedRecommendRequest,
    },
  };
}

function exposeProjectResult(pipelineResult) {
  if (pipelineResult && typeof pipelineResult === "object" && pipelineResult.value) {
    return pipelineResult.value;
  }
  return pipelineResult && typeof pipelineResult === "object" ? pipelineResult : null;
}

function buildRecommendSuccessBody(context) {
  const normalizedRequest = context?.normalizedRequest || {};
  const execution = context?.execution || {};
  const pipelineResult = execution.pipelineResult && typeof execution.pipelineResult === "object"
    ? execution.pipelineResult
    : {};

  return {
    success: true,
    requestId: normalizeString(normalizedRequest.requestId),
    data: execution.projectResult || null,
    dedupe: {
      enabled: pipelineResult.dedupeEnabled === true,
      joined: pipelineResult.joined === true,
      joinedInflight: pipelineResult.joinedInflight === true,
      keyShort: normalizeString(pipelineResult.dedupeKeyShort),
    },
    routing: {
      legacyOmniFastPath: pipelineResult.legacyOmniFastPath === true,
      omniLegacyCommit:
        pipelineResult.legacyOmniFastPath === true ? LEGACY_OMNI_COMMIT : "",
    },
  };
}

function buildRecommendErrorBody(context) {
  const error = context?.error || {};
  const requestId = normalizeString(context?.requestId || error?.requestId);
  const responseBody = {
    success: false,
    requestId,
    code: normalizeString(error?.code),
    message: normalizeString(error?.safeMessage || error?.message || "DataBaker AI recommend 请求失败。").slice(0, 240),
  };
  if (Number(error?.providerStatus) > 0) {
    responseBody.providerStatus = Number(error.providerStatus);
  } else if (Number(error?.statusCode) > 0) {
    responseBody.providerStatus = Number(error.statusCode);
  }
  if (normalizeString(error?.providerCode)) {
    responseBody.providerCode = normalizeString(error.providerCode);
  }
  if (normalizeString(error?.summary)) {
    responseBody.summary = normalizeString(error.summary).slice(0, 240);
  }
  if (error?.hasRawAiDebug === true || normalizeString(error?.debugId)) {
    responseBody.hasRawAiDebug = true;
    responseBody.debugId = normalizeString(error?.debugId);
    if (error?.rawAiDebug && typeof error.rawAiDebug === "object") {
      responseBody.rawAiDebug = error.rawAiDebug;
    }
  }
  if (error?.debugRawJson && typeof error.debugRawJson === "object") {
    responseBody.hasDebugRawJson = true;
    responseBody.debugRawJson = error.debugRawJson;
  }
  return responseBody;
}

module.exports = {
  projectId: "data-baker/round-one-quality",
  platform: "data-baker",
  scriptId: "round-one-quality",
  routeKey: "recommend",
  legacyOmniCommit: LEGACY_OMNI_COMMIT,
  normalizeInput,
  exposeProjectResult,
  buildRecommendSuccessBody,
  buildRecommendErrorBody,
  normalizeNullableInteger,
};

"use strict";

const { aiCallLogger } = require("../backend/ai-call-log");
const {
  DEFAULT_COMPARE_MODEL,
  DEFAULT_LISTEN_MODEL,
  getClientConfig,
} = require("../backend/ai-client-qwen");
const {
  SCRIPT_ID,
  normalizeSuggestRequest,
  normalizeText,
  sanitizeErrorMessage,
} = require("../backend/ai-suggest-request");

function normalizeInput(body) {
  const rawBody = body && typeof body === "object" ? body : {};
  const suggestRequest = normalizeSuggestRequest(rawBody);
  const config = getClientConfig();

  return {
    input: suggestRequest,
    projectOptions: {
      listenModel: suggestRequest.listenModel || config.listenModel || DEFAULT_LISTEN_MODEL,
      compareModel: suggestRequest.compareModel || config.compareModel || DEFAULT_COMPARE_MODEL,
      enableThinking: suggestRequest.enableThinking === true,
      timeoutMs: config.timeoutMs,
      allowClientModelOverride: config.allowClientModelOverride === true,
      aiOptions: suggestRequest.aiOptions || {},
    },
    runtimeContext: {
      suggestRequest,
    },
  };
}

function exposeProjectResult(pipelineResult) {
  return pipelineResult && typeof pipelineResult === "object" ? pipelineResult : null;
}

function buildSuggestSuccessBody(context) {
  return {
    success: true,
    data: context?.execution?.pipelineResult || {},
  };
}

function buildSuggestErrorBody(context) {
  const error = context?.error || {};
  const responseBody = {
    success: false,
    code: normalizeText(error?.code || "internal-error") || "internal-error",
    message:
      sanitizeErrorMessage(error?.message || "AI 推荐请求失败。") || "AI 推荐请求失败。",
    requestId: normalizeText(context?.requestId || error?.requestId),
  };
  if (error?.summary) {
    responseBody.summary = sanitizeErrorMessage(error.summary).slice(0, 200);
  }
  return responseBody;
}

module.exports = {
  projectId: "alibaba-labelx/asr-transcription",
  platform: "alibaba-labelx",
  scriptId: SCRIPT_ID,
  routeKey: "suggest-current",
  aiCallLogger,
  normalizeInput,
  exposeProjectResult,
  buildSuggestSuccessBody,
  buildSuggestErrorBody,
};

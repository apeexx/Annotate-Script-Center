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
  sanitizeLogSummary,
} = require("../backend/ai-suggest-request");

function normalizeInput(body) {
  const rawBody = body && typeof body === "object" ? body : {};
  const suggestRequest = normalizeSuggestRequest(rawBody);
  const config = getClientConfig();

  return {
    input: suggestRequest,
    projectOptions: {
      listenModel: suggestRequest.listenModel || config.listenModel || DEFAULT_LISTEN_MODEL,
      compareModel:
        suggestRequest.compareModel || config.compareModel || DEFAULT_COMPARE_MODEL,
      enableThinking: suggestRequest.enableThinking === true,
      webSearchEnabled: suggestRequest.webSearchEnabled === true,
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
    requestId: normalizeText(context?.requestId || error?.requestId),
    code: normalizeText(error?.code || "internal-error") || "internal-error",
    message: String(error?.message || "AI suggest 请求失败。").slice(0, 240),
  };
  const providerStatus = Number(error?.providerStatus || error?.statusCode || 0) || 0;
  if (providerStatus > 0) {
    responseBody.providerStatus = providerStatus;
  }
  const summaryText = sanitizeLogSummary(error?.summary || responseBody.message);
  if (summaryText) {
    responseBody.summary = summaryText;
  }
  return responseBody;
}

module.exports = {
  projectId: "alibaba-labelx/asr-judgement",
  platform: "alibaba-labelx",
  scriptId: SCRIPT_ID,
  routeKey: "suggest",
  aiCallLogger,
  normalizeInput,
  exposeProjectResult,
  buildSuggestSuccessBody,
  buildSuggestErrorBody,
};

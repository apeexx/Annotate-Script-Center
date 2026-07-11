"use strict";

const { aiCallLogger } = require("../backend/ai-call-log");
const { getClientConfig } = require("../backend/ai-client");
const {
  SCRIPT_ID,
  normalizeAnalyzeRequest,
  resolveRuntimeOptions,
} = require("../backend/ai-analyze-request");

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeInput(body) {
  const rawBody = body && typeof body === "object" ? body : {};
  const normalizedAnalyzeRequest = normalizeAnalyzeRequest(rawBody);
  const runtimeOptions = resolveRuntimeOptions(rawBody, getClientConfig());

  return {
    input: normalizedAnalyzeRequest,
    projectOptions: {
      analysisMode: runtimeOptions.analysisMode,
      visionModel: runtimeOptions.visionModel,
      ocrEnabled: runtimeOptions.ocrEnabled,
      ocrModel: runtimeOptions.ocrModel,
      reasoningModel: runtimeOptions.reasoningModel,
      singleModel: runtimeOptions.singleModel,
      enableThinking: runtimeOptions.enableThinking,
      timeoutMs: runtimeOptions.timeoutMs,
      allowClientModelOverride: runtimeOptions.allowClientModelOverride,
    },
    runtimeContext: {
      normalizedAnalyzeRequest,
      runtimeOptions,
    },
  };
}

function exposeProjectResult(pipelineResult) {
  if (pipelineResult && typeof pipelineResult === "object" && pipelineResult.result) {
    return pipelineResult.result;
  }
  return pipelineResult && typeof pipelineResult === "object" ? pipelineResult : null;
}

function buildAnalyzeSuccessBody(context) {
  const pipelineResult = context?.execution?.pipelineResult || {};
  return Object.assign(
    {
      success: true,
    },
    pipelineResult
  );
}

function buildAnalyzeErrorBody(context) {
  const error = context?.error || {};
  const responseBody = {
    success: false,
    requestId: normalizeString(context?.requestId || error?.requestId),
    code: normalizeString(error?.code) || "internal-error",
    message: normalizeString(error?.message || "Task21 AI analyze 请求失败。").slice(0, 300),
    elapsedMs: Number.isFinite(Number(error?.elapsedMs))
      ? Math.max(0, Math.floor(Number(error.elapsedMs)))
      : 0,
  };
  const summary = normalizeString(error?.summary);
  if (summary) {
    responseBody.summary = summary.slice(0, 300);
  }
  return responseBody;
}

module.exports = {
  projectId: "abaka-ai/task21",
  platform: "abaka-ai",
  scriptId: SCRIPT_ID,
  routeKey: "analyze",
  aiCallLogger,
  normalizeInput,
  exposeProjectResult,
  buildAnalyzeSuccessBody,
  buildAnalyzeErrorBody,
};

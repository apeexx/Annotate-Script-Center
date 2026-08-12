"use strict";

const { requestOmniInputAudio } = require("../../thai-helper/backend/dashscope-omni-client");
const { sanitizeProviderDebugJson } = require("../../../backend/ai/sanitizer");
const { buildUsageMeta } = require("./ai-service");
const { enqueueTask } = require("./queue");

const HUMAN_REVIEW_MARKER = "#N#";
const HUMAN_REVIEW_INSTRUCTION = [
  "Safety rule: if speakers overlap, the clip is silent, the audio is unclear, or any word cannot be verified, output only #N#.",
  "Never guess, complete, or infer text, and never add labels, punctuation, or explanations around #N#.",
].join("\n");

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeQueueMeta(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    groupName: normalizeText(source.groupName) || "aishell_english_transcription_qwen_omni",
    queueWaitMs: Math.max(0, Number(source.queueWaitMs) || 0),
    retryCount: Math.max(0, Number(source.retryCount) || 0),
  };
}

function unwrapQueuedTaskResult(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    value: source.value && typeof source.value === "object" ? source.value : source,
    queueMeta: normalizeQueueMeta(source.queueMeta),
  };
}

function attachQueueFailureMeta(error, requestId) {
  const sourceError = error && typeof error === "object" ? error : new Error(String(error || "Request failed."));
  const queueMeta = normalizeQueueMeta(sourceError.queueMeta);
  const providerDebug = sourceError.debugRawAiResponse && typeof sourceError.debugRawAiResponse === "object"
    ? sanitizeProviderDebugJson(sourceError.debugRawAiResponse, {
      textLimit: 4000,
      maxDepth: 6,
      maxObjectKeys: 60,
    })
    : null;
  sourceError.stage = normalizeText(sourceError.stage) || "recognize";
  sourceError.meta = Object.assign({}, sourceError.meta, {
    requestId: normalizeText(requestId),
    stage: sourceError.stage,
    queue: { totalQueueWaitMs: queueMeta.queueWaitMs, groups: [queueMeta.groupName] },
    retryCount: queueMeta.retryCount,
    cancelled: sourceError.code === "aborted" || sourceError.code === "ai-job-timeout",
  });
  if (providerDebug) {
    sourceError.meta.providerDebug = providerDebug;
  }
  return sourceError;
}

function buildRawListenPrompt(request) {
  return {
    systemPrompt: [String(request?.aiOmni?.prompt || "").trim(), HUMAN_REVIEW_INSTRUCTION].filter(Boolean).join("\n\n"),
    userPrompt: "Transcribe only the clipped audio.",
  };
}

function needsHumanReview(rawText) {
  const normalized = String(rawText || "").trim();
  return !normalized || normalized.includes(HUMAN_REVIEW_MARKER);
}

function normalizeHumanReviewText(rawText) {
  const source = typeof rawText === "string" ? rawText : "";
  return source.includes(HUMAN_REVIEW_MARKER) ? HUMAN_REVIEW_MARKER : source;
}

function createRecommendPipeline(overrides) {
  const deps = Object.assign({ enqueueTask, now: Date.now, requestOmniInputAudio }, overrides || {});

  async function run(input, runtime) {
    const request = input && typeof input === "object" ? input : {};
    const context = runtime && typeof runtime === "object" ? runtime : {};
    const requestId = normalizeText(context.requestId || request.requestId);
    const startedAt = deps.now();
    let queued;
    try {
      queued = await deps.enqueueTask(
        "aishell_english_transcription_qwen_omni",
        function () {
          return deps.requestOmniInputAudio(
            { audioUrl: normalizeText(request.audioDataUrl), aiOptions: request.aiOmni?.params || {} },
            buildRawListenPrompt(request),
            {
              model: normalizeText(request.aiOmni?.model),
              stage: "recognize",
              timeoutMs: Math.max(1000, Math.min(60000, Number(context.timeoutMs || request.timeoutMs) || 60000)),
              enableThinking: false,
              allowEmptyText: true,
              signal: context.signal || null,
            }
          );
        },
        { modelName: normalizeText(request.aiOmni?.model), signal: context.signal || null }
      );
    } catch (error) {
      throw attachQueueFailureMeta(error, requestId);
    }
    const queuedResult = unwrapQueuedTaskResult(queued);
    const result = queuedResult.value;
    const usageMeta = buildUsageMeta(normalizeText(result.model) || request.aiOmni?.model, result.usage);
    const listenText = normalizeHumanReviewText(typeof result.rawText === "string" ? result.rawText : "");
    return {
      data: {
        taskId: normalizeText(request.taskId),
        packageId: normalizeText(request.packageId),
        taskItemId: normalizeText(request.taskItemId),
        fileName: normalizeText(request.fileName),
        referenceText: normalizeText(request.referenceText),
        existingMarkText: normalizeText(request.existingMarkText),
        regionId: normalizeText(request.regionId),
        segmentNumber: Math.max(0, Number(request.segmentNumber || 0) || 0),
        startMs: Math.max(0, Number(request.startMs || 0) || 0),
        endMs: Math.max(0, Number(request.endMs || 0) || 0),
        durationMs: Math.max(0, Number(request.durationMs || 0) || 0),
        selectionKey: normalizeText(request.selectionKey),
        listenText,
        needHumanReview: needsHumanReview(listenText),
      },
      meta: {
        requestId,
        stage: "complete",
        models: {
          pipelineMode: "omni_single_raw_listen",
          recognitionStrategy: "english_raw_listen",
          omniModel: normalizeText(result.model) || normalizeText(request.aiOmni?.model),
          enableThinking: false,
        },
        timing: { totalDurationMs: Math.max(0, deps.now() - startedAt) },
        usage: usageMeta.usage,
        cost: usageMeta.cost,
        queue: { totalQueueWaitMs: queuedResult.queueMeta.queueWaitMs, groups: [queuedResult.queueMeta.groupName] },
        cache: { hit: false, sourceRequestId: "" },
        retryCount: queuedResult.queueMeta.retryCount,
        cancelled: false,
      },
    };
  }

  return { run };
}

module.exports = {
  buildRawListenPrompt,
  createRecommendPipeline,
  needsHumanReview,
  normalizeHumanReviewText,
};

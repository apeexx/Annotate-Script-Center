"use strict";

const { requestOmniInputAudio } = require("../../thai-helper/backend/dashscope-omni-client");
const { enqueueTask } = require("../../thai-helper/backend/queue");
const { buildUsageMeta } = require("./ai-service");

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeQueueMeta(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    groupName: normalizeText(source.groupName) || "aishell_qwen_omni",
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

function buildRawListenPrompt(request) {
  return {
    systemPrompt: String(request?.aiOmni?.prompt || "").trim(),
    userPrompt: [
      "单次全模态原始听音上下文：",
      JSON.stringify(
        {
          fileName: normalizeText(request?.fileName),
          duration: Math.max(0, Number(request?.duration || 0) || 0),
          itemNumber: Math.max(0, Number(request?.itemNumber || 0) || 0),
        },
        null,
        2
      ),
    ].join("\n"),
  };
}

function createRecommendPipeline(overrides) {
  const deps = Object.assign(
    {
      enqueueTask,
      now: Date.now,
      requestOmniInputAudio,
    },
    overrides || {}
  );

  async function run(input, runtime) {
    const request = input && typeof input === "object" ? input : {};
    const context = runtime && typeof runtime === "object" ? runtime : {};
    const requestId = normalizeText(context.requestId || request.requestId);
    const startedAt = deps.now();
    const queued = await deps.enqueueTask(
      "aishell_qwen_omni",
      function () {
        return deps.requestOmniInputAudio(
          {
            audioUrl: normalizeText(request.audioUrl),
            aiOptions: request.aiOmni?.params || {},
          },
          buildRawListenPrompt(request),
          {
            model: normalizeText(request.aiOmni?.model),
            stage: "recognize",
            timeoutMs: Math.max(1000, Number(context.timeoutMs || request.timeoutMs) || 60000),
            enableThinking: false,
            signal: context.signal || null,
          }
        );
      },
      {
        modelName: normalizeText(request.aiOmni?.model),
        signal: context.signal || null,
      }
    );
    const queuedResult = unwrapQueuedTaskResult(queued);
    const result = queuedResult.value;
    const usageMeta = buildUsageMeta(normalizeText(result.model) || request.aiOmni?.model, result.usage);
    const rawText = typeof result.rawText === "string" ? result.rawText : "";
    return {
      data: {
        taskId: normalizeText(request.taskId),
        packageId: normalizeText(request.packageId),
        taskItemId: normalizeText(request.taskItemId),
        fileName: normalizeText(request.fileName),
        referenceText: normalizeText(request.referenceText),
        existingMarkText: normalizeText(request.existingMarkText),
        listenText: rawText,
        needHumanReview: rawText === "",
      },
      meta: {
        requestId,
        stage: "complete",
        models: {
          pipelineMode: "omni_single_raw_listen",
          recognitionStrategy: "cantonese_raw_listen",
          omniModel: normalizeText(result.model) || normalizeText(request.aiOmni?.model),
          enableThinking: false,
        },
        timing: {
          totalDurationMs: Math.max(0, deps.now() - startedAt),
        },
        usage: usageMeta.usage,
        cost: usageMeta.cost,
        queue: {
          totalQueueWaitMs: queuedResult.queueMeta.queueWaitMs,
          groups: [queuedResult.queueMeta.groupName],
        },
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
};

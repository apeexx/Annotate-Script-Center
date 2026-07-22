"use strict";

const { requestOmniInputAudio } = require("../../../aishell-tech/thai-helper/backend/dashscope-omni-client");
const { enqueueTask } = require("../../../aishell-tech/thai-helper/backend/queue");
const { buildUsageMeta } = require("./ai-service");

function normalizeText(value) {
  return String(value || "").trim();
}

function createRecommendPipeline(overrides) {
  const deps = Object.assign({ enqueueTask, requestOmniInputAudio, now: Date.now }, overrides || {});
  async function run(request, runtime) {
    const input = request && typeof request === "object" ? request : {};
    const context = runtime && typeof runtime === "object" ? runtime : {};
    const startedAt = deps.now();
    let queued;
    try {
    queued = await deps.enqueueTask("jd_tts_qwen_omni", function () {
      return deps.requestOmniInputAudio(
        { audioUrl: input.audioDataUrl, aiOptions: input.aiOmni?.params || {} },
        { systemPrompt: normalizeText(input.aiOmni?.prompt), userPrompt: "单次完整上海话音频原始听写。" },
        { model: normalizeText(input.aiOmni?.model), stage: "recognize", timeoutMs: 60000, enableThinking: false, signal: context.signal || null }
      );
    }, { modelName: normalizeText(input.aiOmni?.model), signal: context.signal || null });
    } catch (error) {
      if (error?.code !== "qwen-empty-response") {
        throw error;
      }
      queued = {
        value: {
          rawText: "",
          model: normalizeText(input.aiOmni?.model),
          usage: error?.debugRawAiResponse?.usage || {},
        },
        queueMeta: {},
      };
    }
    const value = queued?.value && typeof queued.value === "object" ? queued.value : queued || {};
    const queueMeta = queued?.queueMeta && typeof queued.queueMeta === "object" ? queued.queueMeta : {};
    const usage = buildUsageMeta(normalizeText(value.model) || input.aiOmni?.model, value.usage);
    const listenText = typeof value.rawText === "string" ? value.rawText : "";
    return {
      data: { utteranceId: normalizeText(input.utteranceId), checksum: normalizeText(input.checksum), listenText, needHumanReview: listenText === "" },
      meta: { requestId: normalizeText(context.requestId || input.requestId), stage: "complete", models: { pipelineMode: "omni_single_raw_listen", omniModel: normalizeText(value.model) || normalizeText(input.aiOmni?.model), enableThinking: false }, timing: { totalDurationMs: Math.max(0, deps.now() - startedAt) }, usage: usage.usage, cost: usage.cost, queue: { totalQueueWaitMs: Math.max(0, Number(queueMeta.queueWaitMs) || 0), groups: [normalizeText(queueMeta.groupName) || "jd_tts_qwen_omni"] }, cache: { hit: false, sourceRequestId: "" }, retryCount: Math.max(0, Number(queueMeta.retryCount) || 0), cancelled: false },
    };
  }
  return { run };
}

module.exports = { createRecommendPipeline };

"use strict";

const { estimateProjectCost } = require("../../../backend/ai/model-pricing");
const { requestCompare } = require("../../../backend/ai/providers/qwen-openai-compatible");
const { requestFunAsrRecognition } = require("../../../backend/ai/providers/funasr");
const { enqueueProviderTask } = require("../../../backend/ai/provider-queue");
const { sanitizeProviderDebugText } = require("../../../backend/ai/sanitizer");
const { requestOmniInputAudio } = require("./dashscope-omni-client");
const {
  createHttpError,
  normalizeCantoneseText,
  normalizeSpeed,
  normalizeUsage,
  parseJsonText,
} = require("./ai-service");

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function createStageError(error, stage, requestId) {
  const result = error instanceof Error ? error : createHttpError(500, "request-error", "请求失败。");
  result.stage = normalizeText(result.stage || stage) || "post_process";
  result.requestId = normalizeText(result.requestId || requestId);
  if (Number(result.statusCode) === 429) result.retryable = true;
  if (Number(result.statusCode) === 504 || result.code === "timeout") result.retryable = true;
  return result;
}

function parseStageJson(result, stage, stageConfig, requestId) {
  try {
    return parseJsonText(result?.rawText);
  } catch (error) {
    const stageError = createStageError(error, stage, requestId);
    const rawText = String(result?.rawText || "");
    stageError.debugRawAiResponse = Object.assign(
      {
        provider: "aishell-cantonese-pipeline",
        stage,
        model: normalizeText(result?.model || stageConfig?.model),
        rawText: sanitizeProviderDebugText(rawText, 20000),
        rawTextLength: rawText.length,
        finishReason: sanitizeProviderDebugText(result?.finishReason || "", 120),
      },
      stageError.debugRawAiResponse && typeof stageError.debugRawAiResponse === "object"
        ? stageError.debugRawAiResponse
        : {}
    );
    throw stageError;
  }
}

function buildConvertPrompt(stagePrompt, referenceText) {
  return String(stagePrompt || "") + "\n\n页面参考文字：\n" + String(referenceText || "");
}

function buildComparePrompt(stagePrompt, convertedText, heardText) {
  return [
    String(stagePrompt || ""),
    "", "粵語候選文字：", String(convertedText || "（沒有候選）"),
    "", "真實聽音轉寫：", String(heardText || "（沒有聽音結果）"),
  ].join("\n");
}

function normalizeDecision(value) {
  const decision = normalizeText(value);
  return ["use_heard_text", "use_converted_text", "merge"].includes(decision) ? decision : "use_heard_text";
}

function normalizeConfidence(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, Number(number.toFixed(3)))) : null;
}

function normalizeAdoptionThreshold(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, Number(number.toFixed(3)))) : 0.75;
}

function applyAdoptionThreshold(compare, heardText, threshold) {
  const source = compare && typeof compare === "object" ? compare : {};
  const normalizedThreshold = normalizeAdoptionThreshold(threshold);
  const accepted = Number.isFinite(source.confidence) && source.confidence >= normalizedThreshold;
  const adoption = {
    threshold: normalizedThreshold,
    accepted,
    fallbackToHeard: !accepted,
  };
  if (accepted) {
    return Object.assign({}, source, { adoption });
  }
  return Object.assign({}, source, {
    text: normalizeCantoneseText(heardText),
    decision: "use_heard_text",
    needHumanReview: true,
    adoption,
  });
}

function normalizeChangePoints(value) {
  return Array.isArray(value) ? value.map(normalizeText).filter(Boolean).slice(0, 30) : [];
}

function extractText(source, fields, errorCode, message) {
  const value = fields.map(function (field) { return source?.[field]; }).find(function (item) { return normalizeText(item); });
  const text = normalizeCantoneseText(value);
  if (!text) throw createHttpError(502, errorCode, message);
  return text;
}

function zeroUsage() {
  return { promptTokens: 0, completionTokens: 0, totalTokens: 0, raw: {} };
}

function aggregateUsage(convert, listen, compare) {
  const stages = { convert, listen, compare };
  return {
    promptTokens: Object.values(stages).reduce(function (total, item) { return total + Number(item?.promptTokens || 0); }, 0),
    completionTokens: Object.values(stages).reduce(function (total, item) { return total + Number(item?.completionTokens || 0); }, 0),
    totalTokens: Object.values(stages).reduce(function (total, item) { return total + Number(item?.totalTokens || 0); }, 0),
    convert,
    candidate: convert,
    listen,
    compare,
  };
}

function createCantoneseRecommendPipeline(overrides) {
  const deps = Object.assign(
    {
      enqueueTask: function enqueueTask(group, task, options) {
        return enqueueProviderTask(group, task, { signal: options?.signal });
      },
      now: Date.now,
      requestCompare,
      requestFunAsrRecognition,
      requestOmniInputAudio,
    },
    overrides || {}
  );

  async function runStage(group, stage, request, runtime, task) {
    try {
      return await deps.enqueueTask(group, task, { signal: runtime.signal, modelName: request.aiStages?.[stage]?.model });
    } catch (error) {
      throw createStageError(error, stage, runtime.requestId || request.requestId);
    }
  }

  async function runConvert(request, runtime) {
    if (!request.referenceText) return { text: "", usage: zeroUsage(), durationMs: 0 };
    const startedAtMs = deps.now();
    const stage = request.aiStages.convert;
    const result = await runStage("aishell-cantonese-convert", "convert", request, runtime, function () {
      return deps.requestCompare(
        { pageText: request.referenceText, aiOptions: stage.params },
        { systemPrompt: "", userPrompt: buildConvertPrompt(stage.prompt, request.referenceText) },
        request.referenceText,
        Object.assign({}, stage.params, { model: stage.model, timeoutMs: runtime.timeoutMs, signal: runtime.signal, stage: "convert", enableThinking: false })
      );
    });
    const parsed = parseStageJson(result, "convert", stage, runtime.requestId);
    return {
      text: extractText(parsed, ["convertedText", "candidateText", "recommendedText", "text"], "empty-converted-text", "转换阶段未返回可用的粤语候选。"),
      usage: normalizeUsage(result?.usage),
      durationMs: Math.max(0, deps.now() - startedAtMs),
    };
  }

  async function runListen(request, runtime) {
    const startedAtMs = deps.now();
    const stage = request.aiStages.listen;
    if (stage.model === "fun-asr") {
      const result = await runStage("aishell-cantonese-fun-asr", "listen", request, runtime, function () {
        return deps.requestFunAsrRecognition(
          { audioUrl: request.audioUrl, aiOptions: stage.params },
          Object.assign({}, stage.params, { model: "fun-asr", timeoutMs: runtime.timeoutMs, signal: runtime.signal, languageHints: ["yue", "zh"] })
        );
      });
      return {
        text: extractText(result, ["text", "transcript", "rawText"], "empty-heard-text", "听音阶段未返回可用的粤语转写。"),
        speed: "",
        usage: normalizeUsage(result?.usage),
        durationMs: Math.max(0, deps.now() - startedAtMs),
      };
    }
    const result = await runStage("aishell-cantonese-omni", "listen", request, runtime, function () {
      return deps.requestOmniInputAudio(
        { audioUrl: request.audioUrl, aiOptions: stage.params },
        { systemPrompt: "", userPrompt: stage.prompt },
        Object.assign({}, stage.params, { model: stage.model, timeoutMs: runtime.timeoutMs, signal: runtime.signal, stage: "listen" })
      );
    });
    const parsed = parseStageJson(result, "listen", stage, runtime.requestId);
    return {
      text: extractText(parsed, ["heardText", "text", "transcription", "recommendedText"], "empty-heard-text", "听音阶段未返回可用的粤语转写。"),
      speed: normalizeSpeed(parsed.recommendedSpeed || parsed.speed || parsed.speechRate),
      usage: normalizeUsage(result?.usage),
      durationMs: Math.max(0, deps.now() - startedAtMs),
    };
  }

  async function runCompare(request, runtime, convertedText, heard) {
    const startedAtMs = deps.now();
    const stage = request.aiStages.compare;
    const prompt = buildComparePrompt(stage.prompt, convertedText, heard.text);
    if (stage.family === "omni") {
      const result = await runStage("aishell-cantonese-omni", "compare", request, runtime, function () {
        return deps.requestOmniInputAudio(
          { audioUrl: request.audioUrl, aiOptions: stage.params },
          { systemPrompt: "", userPrompt: prompt },
          Object.assign({}, stage.params, { model: stage.model, timeoutMs: runtime.timeoutMs, signal: runtime.signal, stage: "compare" })
        );
      });
      const parsed = parseStageJson(result, "compare", stage, runtime.requestId);
      return {
        text: extractText(parsed, ["recommendedText", "text", "heardText"], "empty-recommended-text", "比较阶段未返回最终粤语文本。"),
        speed: normalizeSpeed(parsed.recommendedSpeed || parsed.speed || parsed.speechRate),
        decision: normalizeDecision(parsed.decision), confidence: normalizeConfidence(parsed.confidence), needHumanReview: parsed.needHumanReview !== false,
        changePoints: normalizeChangePoints(parsed.changePoints), usage: normalizeUsage(result?.usage), durationMs: Math.max(0, deps.now() - startedAtMs),
      };
    }
    const result = await runStage("aishell-cantonese-compare", "compare", request, runtime, function () {
      return deps.requestCompare(
        { pageText: convertedText, heardText: heard.text, aiOptions: stage.params },
        { systemPrompt: "", userPrompt: prompt }, heard.text,
        Object.assign({}, stage.params, { model: stage.model, timeoutMs: runtime.timeoutMs, signal: runtime.signal, stage: "compare", enableThinking: false })
      );
    });
    const parsed = parseStageJson(result, "compare", stage, runtime.requestId);
    return {
      text: extractText(parsed, ["recommendedText", "text", "heardText"], "empty-recommended-text", "比较阶段未返回最终粤语文本。"),
      speed: heard.speed,
      decision: normalizeDecision(parsed.decision), confidence: normalizeConfidence(parsed.confidence), needHumanReview: parsed.needHumanReview !== false,
      changePoints: normalizeChangePoints(parsed.changePoints), usage: normalizeUsage(result?.usage), durationMs: Math.max(0, deps.now() - startedAtMs),
    };
  }

  async function run(request, runtime) {
    const context = Object.assign({ requestId: request.requestId, timeoutMs: 60000, signal: null, startedAtMs: deps.now() }, runtime || {});
    const startedAtMs = Number(context.startedAtMs) || deps.now();
    try {
      const stages = await Promise.all([runConvert(request, context), runListen(request, context)]);
      const converted = stages[0];
      const heard = stages[1];
      const compare = applyAdoptionThreshold(
        await runCompare(request, context, converted.text, heard),
        heard.text,
        request.aiStages.compare.adoptionThreshold
      );
      const usage = aggregateUsage(converted.usage, heard.usage, compare.usage);
      const cost = estimateProjectCost({
        convert: { modelId: request.aiStages.convert.model, usage: converted.usage, outputMode: "text" },
        listen: { modelId: request.aiStages.listen.model, usage: heard.usage, outputMode: "text" },
        compare: { modelId: request.aiStages.compare.model, usage: compare.usage, outputMode: "text" },
      });
      return {
        data: {
          taskId: request.taskId, packageId: request.packageId, taskItemId: request.taskItemId, fileName: request.fileName,
          referenceText: request.referenceText, convertedText: converted.text, heardText: heard.text,
          recommendedText: compare.text, recommendedSpeed: compare.speed, decision: compare.decision,
          confidence: compare.confidence, needHumanReview: compare.needHumanReview, changePoints: compare.changePoints,
        },
        meta: {
          requestId: context.requestId, taskItemId: request.taskItemId, stage: "complete", cancelled: false,
          models: { modelMode: "three_stage_parallel", pipelineMode: request.pipelineMode, convertModel: request.aiStages.convert.model, listenModel: request.aiStages.listen.model, compareModelFamily: request.aiStages.compare.family, compareModel: request.aiStages.compare.model },
          timing: {
            totalDurationMs: Math.max(0, deps.now() - startedAtMs),
            convertDurationMs: Number(converted.durationMs || 0),
            listenDurationMs: Number(heard.durationMs || 0),
            compareDurationMs: Number(compare.durationMs || 0),
          }, usage, cost,
          adoption: compare.adoption,
          queue: { cancelled: false }, cache: { hit: false, sourceRequestId: "" }, enableThinking: false,
        },
      };
    } catch (error) {
      throw createStageError(error, error?.stage || "post_process", context.requestId);
    }
  }

  return { run };
}

module.exports = { createCantoneseRecommendPipeline };

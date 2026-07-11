"use strict";

const { estimateProjectCost } = require("../../../backend/ai/model-pricing");
const { requestOmniInputAudio } = require("./dashscope-omni-client");
const { createStageError } = require("./errors");
const { enqueueTask } = require("./queue");

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function createStageResultError(statusCode, code, message, requestId) {
  const error = new Error(String(message || "模型返回结果无效。"));
  error.statusCode = Number(statusCode) || 502;
  error.code = normalizeText(code) || "invalid-model-result";
  error.requestId = normalizeText(requestId);
  return error;
}

function normalizeQueueMeta(queueMeta) {
  const source = queueMeta && typeof queueMeta === "object" ? queueMeta : {};
  return {
    groupName: normalizeText(source.groupName),
    queueWaitMs: Math.max(0, Number(source.queueWaitMs) || 0),
    retryCount: Math.max(0, Number(source.retryCount) || 0),
    durationMs: Math.max(0, Number(source.durationMs) || 0),
    activeCount: Math.max(0, Number(source.activeCount) || 0),
    maxConcurrent: Math.max(0, Number(source.maxConcurrent) || 0),
  };
}

function unwrapQueuedTaskResult(result, fallbackGroupName) {
  if (result && typeof result === "object" && Object.prototype.hasOwnProperty.call(result, "value")) {
    return {
      value: result.value,
      queueMeta: normalizeQueueMeta(result.queueMeta || {
        groupName: fallbackGroupName,
      }),
    };
  }
  return {
    value: result,
    queueMeta: normalizeQueueMeta(
      result && typeof result === "object"
        ? Object.assign(
            {
              groupName: fallbackGroupName,
            },
            result.queueMeta || {}
          )
        : {
            groupName: fallbackGroupName,
          }
    ),
  };
}

function normalizeVietnameseTranscriptionText(text) {
  const value = String(text || "").replace(/[\s\u3000]+/g, " ").trim();
  if (!value) {
    return "";
  }
  const normalized = value
    .replace(/\s+([,.;:!?)\]])/g, "$1")
    .replace(/([(\[])\s+/g, "$1")
    .replace(/([,.;:!?])(?=\S)/g, "$1 ")
    .replace(/([,.;:!?])\s+/g, "$1 ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return /[.!?…]$/.test(normalized) ? normalized : normalized + ".";
}

function parseModelJsonText(rawText, requestId) {
  const text = String(rawText || "").trim();
  if (!text) {
    throw createStageResultError(502, "empty-provider-response", "AI 模型未返回文本内容。", requestId);
  }
  const blockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const maybeJson = blockMatch ? blockMatch[1].trim() : text;
  try {
    return JSON.parse(maybeJson);
  } catch (_error) {
    const fallbackStart = maybeJson.indexOf("{");
    const fallbackEnd = maybeJson.lastIndexOf("}");
    if (fallbackStart >= 0 && fallbackEnd > fallbackStart) {
      try {
        return JSON.parse(maybeJson.slice(fallbackStart, fallbackEnd + 1));
      } catch (_innerError) {
        // fall through
      }
    }
  }
  throw createStageResultError(502, "invalid-model-json", "AI 模型输出不是有效 JSON。", requestId);
}

function normalizeVietnameseRecommendedSpeed(value) {
  const text = normalizeText(value)
    .replace(/^语速[:：]?\s*/i, "")
    .replace(/^speed[:：]?\s*/i, "")
    .toLowerCase();
  if (!text) {
    throw createStageResultError(502, "missing-recommended-speed", "模型未返回有效语速。");
  }
  if (text === "slow" || text === "慢" || text === "慢速") {
    return "slow";
  }
  if (text === "normal" || text === "正常" || text === "中速" || text === "适中") {
    return "normal";
  }
  if (text === "fast" || text === "快" || text === "快速") {
    return "fast";
  }
  throw createStageResultError(502, "invalid-recommended-speed", "模型返回的语速值无效: " + text);
}

function extractRecommendedFields(rawText, requestId) {
  const parsed = parseModelJsonText(rawText, requestId);
  const source = parsed && typeof parsed === "object" ? parsed : {};
  const recommendedText = normalizeVietnameseTranscriptionText(
    source.text ||
      source.recommendedText ||
      source.recommended_text ||
      source.transcription ||
      source.finalText ||
      source.final_text
  );
  if (!recommendedText) {
    throw createStageResultError(
      502,
      "empty-transcription",
      "Omni 未返回可用的越南语转写文本。",
      requestId
    );
  }
  const recommendedSpeed = normalizeVietnameseRecommendedSpeed(
    source.speed ||
      source.recommendedSpeed ||
      source.recommended_speed ||
      source.speechRate ||
      source.speech_rate ||
      source.rate
  );
  return { recommendedText, recommendedSpeed };
}

function createPromptObject(systemPrompt, userPrompt) {
  return {
    systemPrompt: String(systemPrompt || "").trim(),
    userPrompt: String(userPrompt || "").trim(),
  };
}

function buildRecognizePrompt(request) {
  const promptText = normalizeText(request?.singlePrompt);
  if (promptText) {
    return createPromptObject("", promptText);
  }
  const referenceText = normalizeText(request?.referenceText);
  const existingMarkText = normalizeText(request?.existingMarkText);
  const lines = [
    "你正在处理越南语音频转写。",
    "你必须同时返回最终越南语文本和语速建议。",
    "只输出 JSON，不要输出 Markdown、解释、前缀或引号。",
    'JSON 固定字段：{"text":"...","speed":"slow|normal|fast"}。',
    'speed 只能填写 "slow"、"normal"、"fast" 三个值之一。',
    "保留越南语重音字符和正常单词空格。",
    "按越南语书写习惯处理标点与空格：去掉标点前多余空格，标点后保持单个空格。",
    "不要翻译成中文，不要改写成其他语言，不要补充词表写法。",
    "如果句末缺少终止标点，请补英文句号。",
    referenceText ? "页面原始文本（仅作上下文参考，不要照抄）： " + referenceText : "",
    existingMarkText ? "当前页面已有文本（仅作参考）： " + existingMarkText : "",
  ].filter(Boolean);
  return createPromptObject("", lines.join("\n"));
}

function normalizeUsage(usage) {
  const source = usage && typeof usage === "object" ? usage : {};
  const promptTokens = Number(source.prompt_tokens || source.input_tokens || source.promptTokens || 0) || 0;
  const completionTokens =
    Number(source.completion_tokens || source.output_tokens || source.completionTokens || 0) || 0;
  const totalTokens = Number(source.total_tokens || source.totalTokens || 0) || 0;
  return {
    promptTokens,
    completionTokens,
    totalTokens: totalTokens || promptTokens + completionTokens,
    raw: source,
  };
}

function buildUsageMeta(model, usage) {
  const normalizedUsage = normalizeUsage(usage);
  const cost = estimateProjectCost({
    recognize: {
      modelId: normalizeText(model),
      usage: normalizedUsage,
      outputMode: "text",
    },
  });
  return {
    usage: {
      promptTokens: normalizedUsage.promptTokens,
      completionTokens: normalizedUsage.completionTokens,
      totalTokens: normalizedUsage.totalTokens,
      raw: normalizedUsage.raw,
      estimatedCostCny:
        Number.isFinite(Number(cost?.totalEstimatedCostCny)) && Number(cost.totalEstimatedCostCny) > 0
          ? Number(Number(cost.totalEstimatedCostCny).toFixed(6))
          : "",
    },
    cost,
  };
}

function createRecommendPipeline(overrides) {
  const deps = Object.assign(
    {
      enqueueTask,
      requestOmniInputAudio,
      createStageError,
    },
    overrides || {}
  );

  async function run(request, runtime) {
    const normalizedRequest = request && typeof request === "object" ? request : {};
    const context = runtime && typeof runtime === "object" ? runtime : {};
    const requestId = normalizeText(context.requestId);
    const signal = context.signal || null;
    const startedAtMs = Number(context.startedAtMs) || Date.now();
    const recognizeStartedAt = Date.now();

    try {
      const queuedRecognizeResult = await deps.enqueueTask(
        "aishell_qwen_omni",
        function () {
          return deps.requestOmniInputAudio(
            {
              audioUrl: normalizedRequest.audioUrl,
              aiOptions: normalizedRequest.requestParams || {},
            },
            buildRecognizePrompt(normalizedRequest),
            {
              model: normalizedRequest.singleModel,
              stage: "recognize",
              timeoutMs: context.timeoutMs,
              signal,
            }
          );
        },
        {
          modelName: normalizedRequest.singleModel,
          signal,
        }
      );
      const recognizeEntry = unwrapQueuedTaskResult(queuedRecognizeResult, "aishell_qwen_omni");
      const recognizeResult =
        recognizeEntry.value && typeof recognizeEntry.value === "object" ? recognizeEntry.value : {};
      const queueMeta = recognizeEntry.queueMeta;
      const recognizeDurationMs = Date.now() - recognizeStartedAt;
      const recommended = extractRecommendedFields(recognizeResult.rawText, requestId);

      const usageMeta = buildUsageMeta(normalizedRequest.singleModel, recognizeResult.usage);
      return {
        recommendedText: recommended.recommendedText,
        recommendedSpeed: recommended.recommendedSpeed,
        referenceText: normalizedRequest.referenceText,
        meta: {
          requestId,
          stage: "complete",
          models: {
            pipelineMode: "omni_single",
            recognitionStrategy: "vietnamese_transcription_speed",
            recognizeModel: normalizedRequest.singleModel,
            singleModel: normalizedRequest.singleModel,
          },
          timing: {
            totalDurationMs: Date.now() - startedAtMs,
            recognizeDurationMs,
          },
          usage: usageMeta.usage,
          cost: usageMeta.cost,
          queue: {
            totalQueueWaitMs: queueMeta.queueWaitMs,
            groups: [queueMeta.groupName || "aishell_qwen_omni"],
          },
          cache: {
            hit: false,
            sourceRequestId: "",
          },
          retryCount: queueMeta.retryCount,
          cancelled: false,
        },
      };
    } catch (error) {
      throw deps.createStageError("recognize", error, {
        requestId,
      });
    }
  }

  return {
    run,
  };
}

module.exports = {
  createRecommendPipeline,
  extractRecommendedFields,
  normalizeVietnameseRecommendedSpeed,
  normalizeVietnameseTranscriptionText,
};

"use strict";

const { estimateProjectCost } = require("../../../backend/ai/model-pricing");
const {
  DEFAULT_OMNI_MODEL,
  DEFAULT_REQUEST_PARAMS,
  DEFAULT_TIMEOUT_MS,
} = require("./config");
const { requestOmniInputAudio } = require("./dashscope-omni-client");

const SERVICE_NAME = "aishell-tech-cantonese-helper-ai-recommend";
const SCRIPT_ID = "aishellTechCantoneseAssistant";
const DEFAULT_SINGLE_PROMPT = [
  "你正在處理粵語音頻轉寫。",
  "請忠實轉寫粵語口語，不翻譯成普通話；保留合理的中英混說及繁體字寫法。",
  "請規範空白與常用全角中文標點，但不要補寫、刪改或改寫說話內容。",
  "同時判斷語速，只可回傳 slow、normal 或 fast。",
  "只回傳 JSON，不要 Markdown、解釋、前綴或引號。",
  '{"text":"...","speed":"slow|normal|fast"}',
].join("\n");

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function createHttpError(statusCode, code, message) {
  const error = new Error(String(message || "请求失败。"));
  error.statusCode = Number(statusCode) || 500;
  error.code = String(code || "request-error");
  return error;
}

function normalizeCantoneseText(value) {
  const compact = String(value || "")
    .replace(/\.\.\.+/g, "…")
    .replace(/[，、,]/g, "，")
    .replace(/[。｡.]/g, "。")
    .replace(/[？?]/g, "？")
    .replace(/[！!]/g, "！")
    .replace(/[：:]/g, "：")
    .replace(/[；;]/g, "；")
    .replace(/[\s\u3000]+/g, " ")
    .trim();
  return compact
    .replace(/[\u3400-\u9FFF]\s+(?=[\u3400-\u9FFF])/g, function (match) {
      return match.replace(/\s+/g, "");
    })
    .replace(/\s+([，。？！：；、…」』）】])/g, "$1")
    .replace(/([「『（【])\s+/g, "$1")
    .replace(/([，。？！：；、…])\s+/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizeSpeed(value) {
  const text = normalizeText(value).toLowerCase();
  if (text === "slow" || text === "慢" || text === "慢速") {
    return "slow";
  }
  if (text === "normal" || text === "正常" || text === "中速" || text === "適中") {
    return "normal";
  }
  if (text === "fast" || text === "快" || text === "快速") {
    return "fast";
  }
  throw createHttpError(502, "invalid-recommended-speed", "模型返回的语速值无效。");
}

function parseJsonText(rawText) {
  const text = String(rawText || "").trim();
  if (!text) {
    throw createHttpError(502, "empty-provider-response", "模型未返回文本内容。");
  }
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1] || text;
  try {
    return JSON.parse(fenced);
  } catch (_error) {
    const start = fenced.indexOf("{");
    const end = fenced.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(fenced.slice(start, end + 1));
      } catch (_nestedError) {
        // Preserve the contract error below.
      }
    }
  }
  throw createHttpError(502, "invalid-model-json", "模型输出不是有效 JSON。");
}

function buildInvalidModelJsonDiagnostics(rawText, providerResult) {
  const text = String(rawText || "").trim();
  const codePoints = Array.from(text);
  return {
    provider: "aishell-cantonese-dashscope-omni",
    finishReason: normalizeText(providerResult?.finishReason),
    rawTextLength: text.length,
    hasJsonObjectEnvelope: text.startsWith("{") && text.endsWith("}"),
    hasJsonFence: text.startsWith("```") && text.endsWith("```"),
    firstCharacterCode: codePoints.length > 0 ? codePoints[0].codePointAt(0) : undefined,
    lastCharacterCode:
      codePoints.length > 0 ? codePoints[codePoints.length - 1].codePointAt(0) : undefined,
  };
}

function extractRecommendedFields(rawText) {
  const source = parseJsonText(rawText);
  const recommendedText = normalizeCantoneseText(
    source.text || source.recommendedText || source.recommended_text || source.transcription
  );
  if (!recommendedText) {
    throw createHttpError(502, "empty-transcription", "模型未返回可用的粤语转写文本。");
  }
  return {
    recommendedText,
    recommendedSpeed: normalizeSpeed(
      source.speed || source.recommendedSpeed || source.recommended_speed || source.speechRate
    ),
  };
}

function normalizeRecommendRequest(input) {
  const source = input && typeof input === "object" ? input : {};
  const taskItemId = normalizeText(source.taskItemId || source.itemId);
  const audioUrl = normalizeText(source.audioUrl);
  if (!taskItemId) {
    throw createHttpError(400, "missing-task-item-id", "缺少 taskItemId。");
  }
  if (!audioUrl) {
    throw createHttpError(400, "invalid-audio-url", "缺少可用音频地址。");
  }
  return {
    requestId: normalizeText(source.requestId || source.clientRequestId),
    taskId: normalizeText(source.taskId),
    packageId: normalizeText(source.packageId),
    taskItemId,
    audioUrl,
    referenceText: normalizeText(source.referenceText),
    existingMarkText: normalizeText(source.existingMarkText || source.currentInputText),
    aiUsageOperatorName: normalizeText(source.aiUsageOperatorName),
    platformUserName: normalizeText(source.platformUserName),
    platformUserId: normalizeText(source.platformUserId),
    singleModel: DEFAULT_OMNI_MODEL,
    singlePrompt: normalizeText(source.aiStages?.recognize?.prompt || source.singlePrompt) || DEFAULT_SINGLE_PROMPT,
    requestParams:
      source.aiStages?.recognize?.params && typeof source.aiStages.recognize.params === "object"
        ? source.aiStages.recognize.params
        : source.aiOptions && typeof source.aiOptions === "object"
          ? source.aiOptions
          : {},
  };
}

function normalizeUsage(value) {
  const source = value && typeof value === "object" ? value : {};
  const promptTokens = Number(source.prompt_tokens || source.input_tokens || source.promptTokens || 0) || 0;
  const completionTokens = Number(source.completion_tokens || source.output_tokens || source.completionTokens || 0) || 0;
  const totalTokens = Number(source.total_tokens || source.totalTokens || 0) || promptTokens + completionTokens;
  return { promptTokens, completionTokens, totalTokens };
}

function normalizeProviderError(error, requestId) {
  const source = error instanceof Error ? error : createHttpError(500, "request-error", "请求失败。");
  const statusCode = Number(source.providerStatus || source.statusCode || 500) || 500;
  source.statusCode = statusCode;
  source.requestId = requestId;
  source.stage = "recognize";
  if (statusCode === 429) {
    source.code = "provider-rate-limited";
    source.retryable = true;
  } else if (statusCode === 504 || source.code === "timeout") {
    source.code = "timeout";
    source.retryable = true;
  }
  return source;
}

function createCantoneseRecommendService(overrides) {
  const deps = Object.assign({ requestOmniInputAudio }, overrides || {});
  async function run(input) {
    const request = normalizeRecommendRequest(input);
    const startedAt = Date.now();
    try {
      const providerResult = await deps.requestOmniInputAudio(
        {
          audioUrl: request.audioUrl,
          aiOptions: request.requestParams,
        },
        {
          systemPrompt: "",
          userPrompt: request.singlePrompt,
        },
        {
          model: DEFAULT_OMNI_MODEL,
          timeoutMs: DEFAULT_TIMEOUT_MS,
          stage: "recognize",
        }
      );
      let recommended;
      try {
        recommended = extractRecommendedFields(providerResult?.rawText);
      } catch (error) {
        if (error?.code === "invalid-model-json") {
          error.debugRawJson = buildInvalidModelJsonDiagnostics(providerResult?.rawText, providerResult);
        }
        throw error;
      }
      const usage = normalizeUsage(providerResult?.usage);
      const cost = estimateProjectCost({
        recognize: {
          modelId: DEFAULT_OMNI_MODEL,
          usage: Object.assign({ raw: providerResult?.usage || {} }, usage),
          outputMode: "text",
        },
      });
      return {
        recommendedText: recommended.recommendedText,
        recommendedSpeed: recommended.recommendedSpeed,
        referenceText: request.referenceText,
        meta: {
          requestId: request.requestId,
          taskItemId: request.taskItemId,
          service: SERVICE_NAME,
          scriptId: SCRIPT_ID,
          stage: "recognize",
          pipelineMode: "omni_single",
          timing: {
            totalDurationMs: Date.now() - startedAt,
          },
          models: {
            recognizeModel: DEFAULT_OMNI_MODEL,
          },
          usage,
          cost,
          enableThinking: false,
        },
      };
    } catch (error) {
      throw normalizeProviderError(error, request.requestId);
    }
  }
  return { run };
}

function createDefaultsPayload() {
  return {
    success: true,
    defaults: {
      singleModel: DEFAULT_OMNI_MODEL,
      singleModelOptions: [DEFAULT_OMNI_MODEL],
      singlePrompt: DEFAULT_SINGLE_PROMPT,
      timeoutMs: DEFAULT_TIMEOUT_MS,
      enableThinking: false,
      requestParams: DEFAULT_REQUEST_PARAMS,
    },
  };
}

function createHealthPayload() {
  return {
    success: true,
    service: SERVICE_NAME,
    scriptId: SCRIPT_ID,
    status: "ok",
    timeoutMs: DEFAULT_TIMEOUT_MS,
    model: DEFAULT_OMNI_MODEL,
    enableThinking: false,
  };
}

function buildRecommendSuccessBody(result) {
  const source = result && typeof result === "object" ? result : {};
  return {
    success: true,
    data: {
      recommendedText: normalizeText(source.recommendedText),
      recommendedSpeed: normalizeText(source.recommendedSpeed),
      referenceText: normalizeText(source.referenceText),
      taskItemId: normalizeText(source.meta?.taskItemId),
    },
    meta: source.meta || {},
  };
}

function buildRecommendErrorBody(error, requestId) {
  const source = error instanceof Error ? error : createHttpError(500, "request-error", "请求失败。");
  return {
    success: false,
    error: {
      code: normalizeText(source.code) || "request-error",
      message: normalizeText(source.message) || "请求失败。",
      stage: normalizeText(source.stage) || "recognize",
      retryable: Number(source.statusCode) === 429 || Number(source.statusCode) === 504,
      providerStatus: Number(source.providerStatus || source.statusCode || 0) || undefined,
      providerCode: normalizeText(source.providerCode),
    },
    meta: {
      requestId: normalizeText(requestId || source.requestId),
      stage: normalizeText(source.stage) || "recognize",
      cancelled: source.code === "aborted",
    },
  };
}

module.exports = {
  DEFAULT_OMNI_MODEL,
  DEFAULT_SINGLE_PROMPT,
  SERVICE_NAME,
  SCRIPT_ID,
  buildRecommendErrorBody,
  buildRecommendSuccessBody,
  createCantoneseRecommendService,
  createDefaultsPayload,
  createHealthPayload,
  normalizeCantoneseText,
  normalizeProviderError,
  normalizeRecommendRequest,
};

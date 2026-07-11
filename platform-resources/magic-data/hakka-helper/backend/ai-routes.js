"use strict";

const { sendJson } = require("../../../backend/response");
const { buildAiCallLogSummaryPayload } = require("../../../backend/ai-call-log");
const { createAiRoute } = require("../../../backend/ai-framework");
const { createAiJobRouteHandlers } = require("../../../backend/ai-framework/core/create-ai-job-routes");
const { buildAsyncJobRuntimeMeta } = require("../../../backend/ai-framework/runtime/ai-runtime-meta");
const { estimateProjectCost } = require("../../../backend/ai/model-pricing");
const {
  buildModelQueueKey,
  enqueueProviderTask,
} = require("../../../backend/ai/provider-queue");
const hakkaHelperAdapter = require("../ai/adapter");
const {
  DEFAULT_COMPARE_MODEL,
  DEFAULT_LISTEN_MODEL,
  DEFAULT_REQUEST_PARAMS,
  SUPPORTED_REQUEST_PARAMS,
  getClientConfig,
  requestCompare,
  requestListen,
  sanitizeModelName,
} = require("./ai-client-qwen");
const { getLogDir } = require("./ai-call-log");
const { estimateIncome } = require("./ai-cost");
const {
  buildLexiconContext,
  convertMandarinToDialectByLexicon,
  getLexiconState,
  normalizeFinalSuggestionText,
} = require("./ai-lexicon");
const {
  SCRIPT_ID,
  deriveLegacyRecognitionMode,
  normalizeModelMode,
  normalizeRecognitionStrategy,
  normalizeReviewRequest,
} = require("./ai-review-request");
const {
  buildComparePrompt,
  buildListenPrompt,
  buildRecognitionConvertComparePrompt,
  buildRecognitionConvertListenPrompt,
  DEFAULT_COMPARE_TEMPLATE,
  DEFAULT_LISTEN_TEMPLATE,
  RULE_VERSION,
} = require("./ai-prompts");
const {
  normalizeOmniSingleComparison,
  normalizeListenResponse,
  normalizeRuleFirstComparison,
  normalizeUsage,
  parseModelJsonText,
} = require("./ai-response-schema");

const HAKKA_AI_BASE_PATH = "/api/magic-data/hakka-helper/ai/review-current";
const LEGACY_AI_BASE_PATH = "/api/magic-data/annotator/ai/review-current";
const AI_HEALTH_PATH = HAKKA_AI_BASE_PATH + "/health";
const LEGACY_AI_HEALTH_PATH = LEGACY_AI_BASE_PATH + "/health";
const AI_DEFAULTS_PATH = "/api/magic-data/hakka-helper/ai/defaults";
const LEGACY_AI_DEFAULTS_PATH = "/api/magic-data/annotator/ai/defaults";
const HAKKA_AI_JOBS_PATH = HAKKA_AI_BASE_PATH + "/jobs";
const HAKKA_AI_JOB_DETAIL_PATH = HAKKA_AI_JOBS_PATH + "/:jobId";
const HAKKA_AI_JOB_DEBUG_PATH = HAKKA_AI_JOB_DETAIL_PATH + "/debug";
const LEGACY_AI_JOBS_PATH = LEGACY_AI_BASE_PATH + "/jobs";
const LEGACY_AI_JOB_DETAIL_PATH = LEGACY_AI_JOBS_PATH + "/:jobId";
const LEGACY_AI_JOB_DEBUG_PATH = LEGACY_AI_JOB_DETAIL_PATH + "/debug";
const AI_LOG_SUMMARY_PATH = HAKKA_AI_BASE_PATH + "/logs/summary";
const LEGACY_AI_LOG_SUMMARY_PATH = LEGACY_AI_BASE_PATH + "/logs/summary";
const MAX_BODY_BYTES = 3 * 1024 * 1024;
const MODEL_MODE_OPTIONS = [
  { value: "two_stage", label: "双模型：听音模型 + 比较/转换模型" },
  { value: "omni_single", label: "单模型：Omni 单模型" },
];
const RECOGNITION_STRATEGY_OPTIONS = [
  { value: "direct_dialect", label: "直接识别方言文本" },
  { value: "mandarin_to_dialect", label: "识别转换：先听成普通话，再按字词表转方言" },
];
const RECOGNITION_MODE_OPTIONS = [
  { value: "two_stage", label: "双模型：听音模型 + 比较模型" },
  { value: "omni_single", label: "单模型：Omni 单模型" },
  { value: "recognition_convert", label: "识别转换：先听成普通话，再按词表转客家话" },
];
const LISTEN_MODEL_OPTIONS = [
  "qwen3.5-omni-plus",
  "qwen3.5-omni-flash",
  "qwen3.5-omni-flash-2026-03-15",
  "qwen3-omni-flash",
  "qwen3-omni-flash-2025-12-01",
  "qwen3-omni-flash-2025-09-15",
];
const COMPARE_MODEL_OPTIONS = [
  "qwen3.6-plus",
  "qwen3.5-plus",
  "qwen3.6-flash",
  "qwen3.5-flash",
];
const SERVICE_NAME = "magic-data-hakka-helper-ai-review-current";
const COMPONENT_NAME = "asr-voice-ai";

function createRequestId() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const suffix = Math.random().toString(36).slice(2, 8);
  return String(yyyy) + mm + dd + "-" + hh + mi + ss + "-" + suffix;
}

function createHttpError(statusCode, message, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code || "";
  return error;
}

async function runQueuedModelTask(modelName, task) {
  const normalizedModel = sanitizeModelName(modelName, "");
  if (!normalizedModel) {
    return task();
  }
  const queued = await enqueueProviderTask(buildModelQueueKey(normalizedModel), task);
  return queued?.value;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function sanitizeDebugText(value) {
  return String(value || "")
    .replace(/https?:\/\/([^\s"'?]+)\?[^ \n\r"']+/gi, "https://$1?<signed-query-redacted>")
    .replace(/(authorization|cookie|token|signature|ossaccesskeyid)\s*[:=]\s*([^\s,;]+)/gi, "$1=<redacted>");
}

function sanitizeDebugValue(value) {
  if (value === undefined || value === null) {
    return value;
  }
  if (typeof value === "string") {
    return sanitizeDebugText(value);
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeDebugValue);
  }
  if (typeof value === "object") {
    const next = {};
    Object.keys(value).forEach(function (key) {
      const lower = String(key || "").toLowerCase();
      if (
        lower.indexOf("authorization") >= 0 ||
        lower.indexOf("cookie") >= 0 ||
        lower.indexOf("token") >= 0 ||
        lower.indexOf("signature") >= 0 ||
        lower.indexOf("ossaccesskeyid") >= 0
      ) {
        next[key] = "<redacted>";
      } else {
        next[key] = sanitizeDebugValue(value[key]);
      }
    });
    return next;
  }
  return value;
}

function parseAudioHostname(audioUrl) {
  try {
    return new URL(String(audioUrl || "")).hostname || "";
  } catch (error) {
    return "";
  }
}

function resolveModelOverride(requestModel, defaultModel, config) {
  if (!config.allowClientModelOverride) {
    return sanitizeModelName(defaultModel, defaultModel);
  }
  const normalizedRequestModel = sanitizeModelName(requestModel, "");
  if (!normalizedRequestModel) {
    return sanitizeModelName(defaultModel, defaultModel);
  }
  return normalizedRequestModel;
}

function computeEffectiveTimeSeconds(request) {
  if (request.effectiveTime !== null) {
    return Math.max(0, Number(request.effectiveTime) || 0);
  }
  if (request.effectiveStartTime !== null && request.effectiveEndTime !== null) {
    const diff = Number(request.effectiveEndTime) - Number(request.effectiveStartTime);
    return Math.max(0, Number.isFinite(diff) ? diff : 0);
  }
  return 0;
}

function buildHealthResponse() {
  const config = getClientConfig();
  const lexiconState = getLexiconState();
  const modelMode = normalizeModelMode(config.pipelineMode || "two_stage", "two_stage");
  const recognitionStrategy = normalizeRecognitionStrategy(
    config.pipelineMode || "direct_dialect",
    "direct_dialect"
  );
  const recognitionMode = deriveLegacyRecognitionMode(modelMode, recognitionStrategy);
  const runtime = buildAsyncJobRuntimeMeta({ includeQueueSnapshots: true });
  return {
    success: true,
    service: "magic-data-hakka-helper-ai-review-current",
    scriptId: "magicDataAnnotatorAiReview",
    component: "asr-voice-ai",
    provider: "dashscope-qwen",
    ruleVersion: RULE_VERSION,
    status: config.hasApiKey || config.mockEnabled ? "ready" : "missing-api-key",
    mockEnabled: config.mockEnabled,
    hasApiKey: config.hasApiKey,
    modelMode: modelMode,
    recognitionStrategy: recognitionStrategy,
    recognitionMode: recognitionMode,
    pipelineMode: recognitionMode,
    derivedPipelineMode: modelMode === "omni_single" ? "omni_single" : "qwen_omni_compare",
    modelModeOptions: MODEL_MODE_OPTIONS.slice(),
    recognitionStrategyOptions: RECOGNITION_STRATEGY_OPTIONS.slice(),
    recognitionModeOptions: RECOGNITION_MODE_OPTIONS.slice(),
    listenModel: config.listenModel || DEFAULT_LISTEN_MODEL,
    listenModelOptions: LISTEN_MODEL_OPTIONS.slice(),
    reviewModel: config.compareModel || DEFAULT_COMPARE_MODEL,
    compareModel: config.compareModel || DEFAULT_COMPARE_MODEL,
    compareModelOptions: COMPARE_MODEL_OPTIONS.slice(),
    singleModel: config.listenModel || DEFAULT_LISTEN_MODEL,
    singleModelOptions: LISTEN_MODEL_OPTIONS.slice(),
    allowClientModelOverride: config.allowClientModelOverride === true,
    enableThinkingDefault: config.enableThinkingDefault === true,
    enableThinking: config.enableThinkingDefault === true,
    timeoutMs: config.timeoutMs,
    lexiconRewriteMode: config.lexiconRewriteMode,
    lexicon: {
      enabled: lexiconState.enabled,
      status: lexiconState.status,
      source: lexiconState.source,
      rowCount: Array.isArray(lexiconState.rows) ? lexiconState.rows.length : 0,
      warningMessage: String(lexiconState.warningMessage || "").trim(),
    },
    evaluation: {
      sampleCount: 50,
      totalAudioSeconds: 398.932,
      recommendedDefault: "direct_dialect + qwen3.5-flash",
      estimatedCostPerHourCny: 27.71,
      estimatedCostPer10000HoursCny: 277100,
      note: "客家话文本质量优先，生产默认使用双模型+直接识别客家话，thinking 默认关闭。",
    },
    callLogDir: getLogDir(),
    jobs: runtime.jobs,
    runtime,
  };
}

function buildReviewLexiconMeta(baseLexicon, rewriteMode) {
  const source = baseLexicon && typeof baseLexicon === "object" ? baseLexicon : {};
  return Object.assign({}, source, {
    rewriteMode: sanitizeModelName(rewriteMode) || "exact",
  });
}

function applyFinalDialectNormalizationToResponseData(responseData, options) {
  const source = responseData && typeof responseData === "object" ? responseData : {};
  const rewriteMode = sanitizeModelName(options?.rewriteMode, "exact") || "exact";
  const dialectTextCheck =
    source.dialectTextCheck && typeof source.dialectTextCheck === "object"
      ? Object.assign({}, source.dialectTextCheck)
      : source.dialectTextCheck;
  const recommendations =
    source.recommendations && typeof source.recommendations === "object"
      ? Object.assign({}, source.recommendations)
      : source.recommendations;
  const recognitionConvert =
    source.recognitionConvert && typeof source.recognitionConvert === "object"
      ? Object.assign({}, source.recognitionConvert)
      : source.recognitionConvert;

  if (dialectTextCheck && typeof dialectTextCheck === "object") {
    dialectTextCheck.suggestedValue = normalizeFinalSuggestionText(
      dialectTextCheck.suggestedValue,
      { mode: rewriteMode }
    );
  }
  if (recommendations && typeof recommendations === "object") {
    recommendations.dialectText = normalizeFinalSuggestionText(recommendations.dialectText, {
      mode: rewriteMode,
    });
  }
  if (
    recognitionConvert &&
    typeof recognitionConvert === "object" &&
    normalizeText(recognitionConvert.recognitionStrategy) === "mandarin_to_dialect"
  ) {
    recognitionConvert.convertedDialectText = normalizeFinalSuggestionText(
      recognitionConvert.convertedDialectText,
      {
        mode: rewriteMode,
      }
    );
  }

  return Object.assign({}, source, {
    dialectTextCheck,
    recommendations,
    recognitionConvert,
  });
}

async function reviewCurrent(body, requestId) {
  const startedAtMs = Date.now();
  requestId = normalizeText(requestId) || createRequestId();
  let reviewRequest = null;
  let config = null;
  let listenDurationMs = 0;
  let compareDurationMs = 0;
  try {
    reviewRequest = normalizeReviewRequest(body || {});
    config = getClientConfig();
    if (!config.hasApiKey && !config.mockEnabled) {
      throw createHttpError(503, "missing-api-key", "missing-api-key");
    }

    const listenModel = resolveModelOverride(
      reviewRequest.modelMode === "omni_single"
        ? reviewRequest.singleModel || reviewRequest.listenModel
        : reviewRequest.listenModel,
      config.listenModel || DEFAULT_LISTEN_MODEL,
      config
    );
    const reviewModel = resolveModelOverride(
      reviewRequest.modelMode === "omni_single"
        ? reviewRequest.singleModel || reviewRequest.compareModel || reviewRequest.reviewModel
        : reviewRequest.compareModel || reviewRequest.reviewModel,
      config.compareModel || DEFAULT_COMPARE_MODEL,
      config
    );
    const isRecognitionConvert =
      reviewRequest.recognitionStrategy === "mandarin_to_dialect" ||
      reviewRequest.recognitionMode === "recognition_convert";

    const beforeListenLexicon = buildLexiconContext({
      platformDialectText: reviewRequest.platformDialectText,
      platformMandarinText: reviewRequest.platformMandarinText,
      heardDialectText: "",
    });
    const listenPrompt = isRecognitionConvert
      ? buildRecognitionConvertListenPrompt(reviewRequest, beforeListenLexicon)
      : buildListenPrompt(reviewRequest, beforeListenLexicon);

    const listenStartedAt = Date.now();
    const listenResult = await runQueuedModelTask(listenModel, function () {
      return requestListen(reviewRequest, listenPrompt, {
        timeoutMs: config.timeoutMs,
        model: listenModel,
        enableThinking: reviewRequest.enableThinking,
        aiOptions: reviewRequest.aiOptions,
      });
    });
    listenDurationMs = Date.now() - listenStartedAt;

    const listenJson = parseModelJsonText(listenResult.rawText, requestId);
    const listen = normalizeListenResponse(listenJson);
    const recognizedMandarinText = isRecognitionConvert
      ? normalizeText(listen.recognizedMandarinText || listen.heardMandarinMeaning || "")
      : "";

    const lexiconContext = buildLexiconContext({
      platformDialectText: reviewRequest.platformDialectText,
      platformMandarinText: reviewRequest.platformMandarinText,
      heardDialectText: isRecognitionConvert ? recognizedMandarinText : listen.heardDialectText,
    });
    const conversionContext = isRecognitionConvert
      ? convertMandarinToDialectByLexicon(recognizedMandarinText, {
          platformDialectText: reviewRequest.platformDialectText,
          lexiconState: getLexiconState(),
          rewriteMode: config.lexiconRewriteMode,
        })
      : null;

    const comparePrompt = isRecognitionConvert
      ? buildRecognitionConvertComparePrompt(reviewRequest, {
          recognizedMandarinText,
          convertedDialectText: conversionContext?.convertedDialectText || "",
          listenEvidence: {
            heardDialectText: listen.heardDialectText,
            heardMandarinMeaning: recognizedMandarinText || listen.heardMandarinMeaning,
            isValidAudio: listen.isValidAudio,
            validityDecision: listen.validityDecision,
            riskFlags: listen.riskFlags,
            genderGuess: listen.genderGuess,
            ageRangeGuess: listen.ageRangeGuess,
            confidence: listen.confidence,
          },
          lexiconMatches: conversionContext?.lexiconMatches || [],
          lexiconContext,
        })
      : buildComparePrompt(reviewRequest, listen, lexiconContext);
    const compareStartedAt = Date.now();
    const compareResult = await runQueuedModelTask(reviewModel, function () {
      return requestCompare(
        isRecognitionConvert
          ? {
              platformDialectText: reviewRequest.platformDialectText,
              platformMandarinText: reviewRequest.platformMandarinText,
              heardDialectText: listen.heardDialectText,
              heardMandarinMeaning: recognizedMandarinText || listen.heardMandarinMeaning,
              recognizedMandarinText,
              convertedDialectText: conversionContext?.convertedDialectText || "",
            }
          : {
              platformDialectText: reviewRequest.platformDialectText,
              platformMandarinText: reviewRequest.platformMandarinText,
              heardDialectText: listen.heardDialectText,
              heardMandarinMeaning: listen.heardMandarinMeaning,
            },
        comparePrompt,
        {
          timeoutMs: config.timeoutMs,
          model: reviewModel,
          enableThinking: reviewRequest.enableThinking,
          aiOptions: reviewRequest.aiOptions,
        }
      );
    });
    compareDurationMs = Date.now() - compareStartedAt;

    const compareJson = parseModelJsonText(compareResult.rawText, requestId);
    const normalizedResult =
      reviewRequest.modelMode === "omni_single"
        ? normalizeOmniSingleComparison(compareJson, reviewRequest)
        : normalizeRuleFirstComparison(
            compareJson,
            reviewRequest,
            Object.assign({}, listen, {
              heardMandarinMeaning: recognizedMandarinText || listen.heardMandarinMeaning,
            })
          );

    if (!listen.isValidAudio) {
      normalizedResult.reviewConclusion = "risky";
      normalizedResult.shouldReview = true;
      if (normalizedResult.textRuleCheck.ruleIssues.indexOf("音频无效或不清晰，建议人工复核。") < 0) {
        normalizedResult.textRuleCheck.ruleIssues.push("音频无效或不清晰，建议人工复核。");
      }
    }

    const effectiveTimeSeconds = computeEffectiveTimeSeconds(reviewRequest);
    const estimatedIncome = estimateIncome(effectiveTimeSeconds);
    const listenUsage = normalizeUsage(listenResult.usage);
    const compareUsage = normalizeUsage(compareResult.usage);
    const totalDurationMs = Date.now() - startedAtMs;
    const cost = estimateProjectCost({
      listen: {
        modelId: listenResult.model || listenModel || DEFAULT_LISTEN_MODEL,
        usage: listenUsage,
        outputMode: "text",
      },
      compare: {
        modelId: compareResult.model || reviewModel || DEFAULT_COMPARE_MODEL,
        usage: compareUsage,
        outputMode: "text",
      },
    });

    const showHeardText = reviewRequest.showHeardText !== false;
    const heardDialectText = showHeardText ? listen.heardDialectText : "";
    const heardMandarinMeaning = showHeardText
      ? isRecognitionConvert
        ? recognizedMandarinText || listen.heardMandarinMeaning
        : listen.heardMandarinMeaning
      : "";

    const speakerCheck = normalizedResult?.speakerCheck || {};
    const dialectTextCheck = normalizedResult?.dialectTextCheck || {};
    const mandarinTextCheck = normalizedResult?.mandarinTextCheck || {};
    const overall = normalizedResult?.overall || {};
    const recognitionConvertMeta =
      isRecognitionConvert
        ? {
            recognizedMandarinText: normalizeText(
              compareJson?.recognizedMandarinText ||
                recognizedMandarinText ||
                listen?.heardMandarinMeaning ||
                ""
            ),
            convertedDialectText: normalizeText(
              compareJson?.convertedDialectText ||
                normalizedResult?.recommendations?.dialectText ||
                conversionContext?.convertedDialectText ||
                ""
            ),
            lexiconMatches: Array.isArray(compareJson?.lexiconMatches)
              ? compareJson.lexiconMatches
              : conversionContext?.lexiconMatches || [],
            conversionWarnings: Array.isArray(compareJson?.conversionWarnings)
              ? compareJson.conversionWarnings
              : conversionContext?.conversionWarnings || [],
          }
        : null;
    const normalizedSummary = normalizeText(
      overall.summary || normalizedResult?.recommendations?.summary || ""
    );
    const responseData = applyFinalDialectNormalizationToResponseData({
      requestId,
      service: SERVICE_NAME,
      scriptId: SCRIPT_ID,
      component: COMPONENT_NAME,
      pageType: reviewRequest.pageType || "asrmark",
      taskItemId: reviewRequest.taskItemId || "",
      samplingRecordId: reviewRequest.samplingRecordId || "",
      reviewConclusion: normalizedResult.reviewConclusion,
      shouldReview: normalizedResult.shouldReview === true,
      modelMode: reviewRequest.modelMode,
      recognitionStrategy: reviewRequest.recognitionStrategy,
      recognitionMode: reviewRequest.recognitionMode,
      pipelineMode: reviewRequest.recognitionMode,
      derivedPipelineMode: reviewRequest.modelMode === "omni_single" ? "omni_single" : "qwen_omni_compare",
      effectiveTime: effectiveTimeSeconds,
      estimatedIncome,
      platformBaseline: {
        dialectText: reviewRequest.platformDialectText,
        mandarinText: reviewRequest.platformMandarinText,
        gender: reviewRequest?.speaker?.gender || "",
        ageRange: reviewRequest?.speaker?.ageRange || "",
      },
      speakerCheck: speakerCheck,
      dialectTextCheck: dialectTextCheck,
      mandarinTextCheck: mandarinTextCheck,
      overall: {
        reviewConclusion: overall.reviewConclusion || normalizedResult.reviewConclusion,
        shouldReview: overall.shouldReview === true || normalizedResult.shouldReview === true,
        summary: normalizedSummary,
      },
      audioCheck: {
        isValidAudio: listen.isValidAudio,
        validityDecision: listen.validityDecision,
        riskFlags: listen.riskFlags,
        invalidReasons: listen.invalidReasons,
        genderGuess: listen.genderGuess,
        ageRangeGuess: listen.ageRangeGuess,
        heardDialectText,
        heardMandarinMeaning,
        confidence: listen.confidence,
      },
      textRuleCheck: normalizedResult.textRuleCheck,
      recommendations: {
        dialectText: normalizeText(
          normalizedResult?.recommendations?.dialectText ||
            dialectTextCheck?.suggestedValue ||
            listen.heardDialectText ||
            reviewRequest.platformDialectText
        ),
        mandarinText: normalizeText(
          normalizedResult?.recommendations?.mandarinText ||
            mandarinTextCheck?.suggestedValue ||
            listen.heardMandarinMeaning ||
            reviewRequest.platformMandarinText
        ),
        summary: normalizedSummary,
      },
      lexicon: buildReviewLexiconMeta(
        {
          enabled: lexiconContext.enabled,
          status: lexiconContext.status,
          matchedCount: lexiconContext.matchedCount,
          matches: lexiconContext.matches,
        },
        config.lexiconRewriteMode
      ),
      models: {
        listenModel: listenResult.model || listenModel || DEFAULT_LISTEN_MODEL,
        reviewModel: compareResult.model || reviewModel || DEFAULT_COMPARE_MODEL,
        compareModel: compareResult.model || reviewModel || DEFAULT_COMPARE_MODEL,
        singleModel: reviewRequest.singleModel || "",
      },
      usage: {
        listen: listenUsage,
        compare: compareUsage,
      },
      cost,
      thinking: {
        requested: reviewRequest.enableThinking === true,
        listen: {
          enableThinking: listenResult.enableThinking === true,
          fallbackUsed: listenResult.thinkingFallbackUsed === true,
          fallbackMode: listenResult.thinkingFallbackMode || "",
        },
        compare: {
          enableThinking: compareResult.enableThinking === true,
          fallbackUsed: compareResult.thinkingFallbackUsed === true,
          fallbackMode: compareResult.thinkingFallbackMode || "",
        },
      },
      timing: {
        listenDurationMs,
        compareDurationMs,
        totalDurationMs,
      },
      rawAiDebug: sanitizeDebugValue({
        hasRaw:
          Boolean(String(listenResult.rawText || "").trim()) ||
          Boolean(String(compareResult.rawText || "").trim()),
        modelMode: reviewRequest.modelMode,
        recognitionStrategy: reviewRequest.recognitionStrategy,
        recognitionMode: reviewRequest.recognitionMode,
        derivedPipelineMode:
          reviewRequest.modelMode === "omni_single" ? "omni_single" : "qwen_omni_compare",
        recognizedMandarinText: recognitionConvertMeta?.recognizedMandarinText || recognizedMandarinText || "",
        convertedDialectText: recognitionConvertMeta?.convertedDialectText || "",
        lexiconMatches: recognitionConvertMeta?.lexiconMatches || [],
        conversionWarnings: recognitionConvertMeta?.conversionWarnings || [],
      }),
      rawModelText: sanitizeDebugValue({
        listen: listenResult.rawText || "",
        compare: compareResult.rawText || "",
      }),
      rawJson: sanitizeDebugValue({
        listen: listenJson,
        compare: compareJson,
      }),
      recognitionConvert: recognitionConvertMeta
        ? Object.assign(
            {
              recognitionStrategy: "mandarin_to_dialect",
              pipelineMode: "recognition_convert",
            },
            recognitionConvertMeta
          )
        : null,
      mock: Boolean(config.mockEnabled || listenResult.mock || compareResult.mock),

      // Legacy compatibility for previous frontend fields.
      verdict: !listen.isValidAudio ? "invalid_audio" : normalizedResult.legacyComparison.verdict,
      listen: {
        heardDialectText,
        heardMandarinMeaning,
        isValidAudio: listen.isValidAudio,
        invalidReasons: listen.invalidReasons,
        riskFlags: listen.riskFlags,
        confidence: listen.confidence,
      },
      comparison: {
        dialectLine: normalizedResult.legacyComparison.dialectLine,
        mandarinLine: normalizedResult.legacyComparison.mandarinLine,
        lexiconIssues: normalizedResult.legacyComparison.lexiconIssues,
        ruleIssues: normalizedResult.legacyComparison.ruleIssues,
      },
    }, {
      rewriteMode: config.lexiconRewriteMode,
    });

    return {
      data: responseData,
    };
  } catch (error) {
    const statusCode = Number(error?.statusCode) || (error?.code === "timeout" ? 504 : 500);
    const responseBody = {
      success: false,
      requestId,
      code: normalizeText(error?.code || "internal-error"),
      message: normalizeText(error?.message || "Magic Data AI review-current 请求失败。").slice(0, 240),
    };
    if (error?.code === "provider-http-error" && error?.summary) {
      responseBody.summary = normalizeText(error.summary).slice(0, 200);
    }
    if (!responseBody.code) {
      responseBody.code = statusCode >= 500 ? "internal-error" : "request-error";
    }

    const propagatedError =
      error instanceof Error
        ? error
        : new Error(normalizeText(error) || "Magic Data AI review-current 请求失败。");
    propagatedError.statusCode = statusCode;
    propagatedError.requestId = requestId;
    propagatedError.code = responseBody.code;
    propagatedError.message = responseBody.message;
    if (responseBody.summary) {
      propagatedError.summary = responseBody.summary;
    }

    throw propagatedError;
  }
}

const reviewCurrentRouteOptions = {
  maxBodyBytes: MAX_BODY_BYTES,
  run(context) {
    const requestId = normalizeText(context?.normalizedRequest?.requestId || createRequestId());
    const body = context?.runtimeContext?.rawBody || {};
    return reviewCurrent(body, requestId);
  },
  createSuccessBody(context) {
    return hakkaHelperAdapter.buildReviewSuccessBody(context);
  },
  createErrorBody(context) {
    const error = context?.error || {};
    if (error?.code === "timeout" && !error.statusCode) {
      error.statusCode = 504;
    }
    return hakkaHelperAdapter.buildReviewErrorBody(context);
  },
};
const handleReviewCurrent = createAiRoute(hakkaHelperAdapter, reviewCurrentRouteOptions);
const reviewCurrentJobHandlers = createAiJobRouteHandlers(
  hakkaHelperAdapter,
  reviewCurrentRouteOptions
);
function registerAiRoutes(router) {
  function buildDefaultsPayload(config) {
    const modelMode = normalizeModelMode(config.pipelineMode || "two_stage", "two_stage");
    const recognitionStrategy = normalizeRecognitionStrategy(
      config.pipelineMode || "direct_dialect",
      "direct_dialect"
    );
    const recognitionMode = deriveLegacyRecognitionMode(modelMode, recognitionStrategy);
    const runtime = buildAsyncJobRuntimeMeta();
    return {
      success: true,
      service: "magic-data-hakka-helper-ai-review-current",
      scriptId: "magicDataAnnotatorAiReview",
      component: "asr-voice-ai",
      defaults: {
        modelMode: modelMode,
        recognitionStrategy: recognitionStrategy,
        recognitionMode: recognitionMode,
        pipelineMode: recognitionMode,
        derivedPipelineMode: modelMode === "omni_single" ? "omni_single" : "qwen_omni_compare",
        modelModeOptions: MODEL_MODE_OPTIONS.slice(),
        recognitionStrategyOptions: RECOGNITION_STRATEGY_OPTIONS.slice(),
        recognitionModeOptions: RECOGNITION_MODE_OPTIONS.slice(),
        listenModel: config.listenModel || DEFAULT_LISTEN_MODEL,
        listenModelOptions: LISTEN_MODEL_OPTIONS.slice(),
        compareModel: config.compareModel || DEFAULT_COMPARE_MODEL,
        compareModelOptions: COMPARE_MODEL_OPTIONS.slice(),
        singleModel: config.listenModel || DEFAULT_LISTEN_MODEL,
        singleModelOptions: LISTEN_MODEL_OPTIONS.slice(),
        reviewModel: config.compareModel || DEFAULT_COMPARE_MODEL,
        timeoutMs: config.timeoutMs,
        enableThinking: config.enableThinkingDefault === true,
        temperature: DEFAULT_REQUEST_PARAMS.temperature,
        top_p: DEFAULT_REQUEST_PARAMS.top_p,
        max_tokens: DEFAULT_REQUEST_PARAMS.max_tokens,
        max_completion_tokens: DEFAULT_REQUEST_PARAMS.max_completion_tokens,
        presence_penalty: DEFAULT_REQUEST_PARAMS.presence_penalty,
        frequency_penalty: DEFAULT_REQUEST_PARAMS.frequency_penalty,
        seed: DEFAULT_REQUEST_PARAMS.seed,
        stop: DEFAULT_REQUEST_PARAMS.stop,
        listenPrompt: DEFAULT_LISTEN_TEMPLATE,
        comparePrompt: "",
        reviewPrompt: DEFAULT_COMPARE_TEMPLATE,
      },
      supportedParams: SUPPORTED_REQUEST_PARAMS,
      jobs: runtime.jobs,
      runtime,
      evaluation: {
        sampleCount: 50,
        totalAudioSeconds: 398.932,
        recommendedDefault: "direct_dialect + qwen3.5-flash",
        highQualityCandidate: "direct_dialect + qwen3.5-plus",
        mandarinPriorityCandidate: "mandarin_to_dialect + qwen3.5-plus",
        costPer10000HoursCny: {
          directFlash: 277100,
          directPlus: 287500,
          convertFlash: 273600,
          convertPlus: 284200,
        },
        note: "评测口径：50条样本，398.932秒；默认强制 enable_thinking=false。",
      },
      notes: {
        promptOverride: "Prompt 可在前端覆盖；空 override 使用后端默认。",
        responseFormat: "结构化输出由后端固定控制，前端不配置。",
        requestMode:
          "默认短请求创建 /jobs 任务，再轮询 job 状态；同步 review-current 仅保留兼容 / 调试入口。",
        compatibility:
          "兼容旧字段 listenModel/reviewModel/enableThinking/reviewPrompt；新字段优先 modelMode/recognitionStrategy/listenModel/compareModel/singleModel。",
      },
    };
  }

  router.get(AI_HEALTH_PATH, function ({ response }) {
    sendJson(response, 200, buildHealthResponse());
  });
  router.get(AI_DEFAULTS_PATH, function ({ response }) {
    const config = getClientConfig();
    sendJson(response, 200, buildDefaultsPayload(config));
  });

  router.get(LEGACY_AI_HEALTH_PATH, function ({ response }) {
    sendJson(response, 200, buildHealthResponse());
  });
  router.get(LEGACY_AI_DEFAULTS_PATH, function ({ response }) {
    const config = getClientConfig();
    sendJson(response, 200, buildDefaultsPayload(config));
  });

  router.post(HAKKA_AI_BASE_PATH, function (routeContext) {
    return handleReviewCurrent(routeContext);
  });
  router.post(HAKKA_AI_JOBS_PATH, function (routeContext) {
    return reviewCurrentJobHandlers.handleCreateJob(routeContext);
  });
  router.get(HAKKA_AI_JOB_DETAIL_PATH, function (routeContext) {
    return reviewCurrentJobHandlers.handleGetJobStatus(routeContext);
  });
  router.get(HAKKA_AI_JOB_DEBUG_PATH, function (routeContext) {
    return reviewCurrentJobHandlers.handleGetJobDebug(routeContext);
  });
  router.post(LEGACY_AI_BASE_PATH, function (routeContext) {
    return handleReviewCurrent(routeContext);
  });
  router.post(LEGACY_AI_JOBS_PATH, function (routeContext) {
    return reviewCurrentJobHandlers.handleCreateJob(routeContext);
  });
  router.get(LEGACY_AI_JOB_DETAIL_PATH, function (routeContext) {
    return reviewCurrentJobHandlers.handleGetJobStatus(routeContext);
  });
  router.get(LEGACY_AI_JOB_DEBUG_PATH, function (routeContext) {
    return reviewCurrentJobHandlers.handleGetJobDebug(routeContext);
  });
  router.get(AI_LOG_SUMMARY_PATH, function ({ response, query }) {
    sendJson(
      response,
      200,
      buildAiCallLogSummaryPayload({
        service: SERVICE_NAME,
        scriptId: SCRIPT_ID,
        logger: hakkaHelperAdapter.aiCallLogger,
        query,
      })
    );
  });
  router.get(LEGACY_AI_LOG_SUMMARY_PATH, function ({ response, query }) {
    sendJson(
      response,
      200,
      buildAiCallLogSummaryPayload({
        service: SERVICE_NAME,
        scriptId: SCRIPT_ID,
        logger: hakkaHelperAdapter.aiCallLogger,
        query,
      })
    );
  });
}

module.exports = {
  AI_BASE_PATH: HAKKA_AI_BASE_PATH,
  AI_DEFAULTS_PATH,
  AI_HEALTH_PATH,
  AI_JOB_DEBUG_PATH: HAKKA_AI_JOB_DEBUG_PATH,
  AI_JOB_DETAIL_PATH: HAKKA_AI_JOB_DETAIL_PATH,
  AI_JOBS_PATH: HAKKA_AI_JOBS_PATH,
  AI_LOG_SUMMARY_PATH,
  handleReviewCurrent,
  LEGACY_AI_JOB_DEBUG_PATH,
  LEGACY_AI_JOB_DETAIL_PATH,
  LEGACY_AI_JOBS_PATH,
  LEGACY_AI_LOG_SUMMARY_PATH,
  normalizeReviewRequest,
  reviewCurrent,
  registerAiRoutes,
  __test__: {
    applyFinalDialectNormalizationToResponseData,
    buildReviewLexiconMeta,
  },
};

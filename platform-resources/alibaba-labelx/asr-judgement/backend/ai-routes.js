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
const judgementAdapter = require("../ai/adapter");
const { getLogDir } = require("./ai-call-log");
const {
  DEFAULT_REQUEST_PARAMS,
  DEFAULT_COMPARE_MODEL,
  DEFAULT_LISTEN_MODEL,
  getClientConfig,
  requestCompare,
  requestListen,
} = require("./ai-client-qwen");
const {
  buildComparePrompt,
  buildListenPrompt,
  loadCompareTemplateText,
  loadListenTemplateText,
} = require("./ai-prompt");
const {
  buildSuggestResponse,
  normalizeCompareResponse,
  normalizeListenResponse,
  parseModelJsonText,
} = require("./ai-response-schema");
const {
  DEFAULT_RULE_VERSION,
  JUDGEMENT_AI_SUPPORTED_PARAMS,
  SCRIPT_ID,
  createHttpError,
  normalizeSuggestRequest,
  normalizeText,
  parseAudioHostname,
  sanitizeLogSummary,
} = require("./ai-suggest-request");

const AI_BASE_PATH = "/api/alibaba-labelx/asr-judgement/ai";
const AI_HEALTH_PATH = AI_BASE_PATH + "/health";
const AI_DEFAULTS_PATH = AI_BASE_PATH + "/defaults";
const AI_SUGGEST_PATH = AI_BASE_PATH + "/suggest";
const AI_JOBS_PATH = AI_SUGGEST_PATH + "/jobs";
const AI_JOB_DETAIL_PATH = AI_JOBS_PATH + "/:jobId";
const AI_JOB_DEBUG_PATH = AI_JOB_DETAIL_PATH + "/debug";
const AI_LOG_SUMMARY_PATH = AI_SUGGEST_PATH + "/logs/summary";
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const SERVICE_NAME = "asr-judgement-ai";

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

function buildHealthResponse() {
  const config = getClientConfig();
  const runtime = buildAsyncJobRuntimeMeta({ includeQueueSnapshots: true });
  return {
    success: true,
    service: SERVICE_NAME,
    provider: "dashscope-qwen",
    listenModel: config.listenModel || DEFAULT_LISTEN_MODEL,
    compareModel: config.compareModel || DEFAULT_COMPARE_MODEL,
    legacyModel: config.legacyModel || "",
    allowClientModelOverride: config.allowClientModelOverride === true,
    enableThinkingDefault: config.enableThinkingDefault === true,
    webSearchEnabledDefault: config.webSearchEnabledDefault !== false,
    timeoutMs: config.timeoutMs,
    supportedParams: JUDGEMENT_AI_SUPPORTED_PARAMS,
    mockEnabled: config.mockEnabled,
    hasApiKey: config.hasApiKey,
    callLogDir: getLogDir(),
    ruleVersion: DEFAULT_RULE_VERSION,
    status: config.hasApiKey || config.mockEnabled ? "ready" : "missing-api-key",
    jobs: runtime.jobs,
    runtime,
  };
}

function buildDefaultsResponse() {
  const config = getClientConfig();
  const runtime = buildAsyncJobRuntimeMeta();
  return {
    success: true,
    service: SERVICE_NAME,
    scriptId: SCRIPT_ID,
    component: "asr-voice-ai",
    defaults: {
      listenModel: config.listenModel || DEFAULT_LISTEN_MODEL,
      compareModel: config.compareModel || DEFAULT_COMPARE_MODEL,
      reviewModel: "",
      timeoutMs: config.timeoutMs,
      enableThinking: config.enableThinkingDefault === true,
      webSearchEnabled: config.webSearchEnabledDefault !== false,
      temperature: DEFAULT_REQUEST_PARAMS.temperature,
      top_p: DEFAULT_REQUEST_PARAMS.top_p,
      max_tokens: DEFAULT_REQUEST_PARAMS.max_tokens,
      max_completion_tokens: DEFAULT_REQUEST_PARAMS.max_completion_tokens,
      presence_penalty: DEFAULT_REQUEST_PARAMS.presence_penalty,
      frequency_penalty: DEFAULT_REQUEST_PARAMS.frequency_penalty,
      seed: DEFAULT_REQUEST_PARAMS.seed,
      stop: DEFAULT_REQUEST_PARAMS.stop,
      listenPrompt: loadListenTemplateText(),
      comparePrompt: loadCompareTemplateText(),
      reviewPrompt: "",
    },
    supportedParams: JUDGEMENT_AI_SUPPORTED_PARAMS,
    jobs: runtime.jobs,
    runtime,
    notes: {
      promptOverride: "Prompt 可在前端覆盖；空 override 使用后端默认。",
      responseFormat: "结构化输出由后端固定控制，前端不配置。",
      requestMode: "默认短请求创建 /jobs 任务，再轮询 job 状态；同步 suggest 仅保留兼容 / 调试入口。",
    },
  };
}

async function suggestRequest(body, requestId) {
  const startedAtMs = Date.now();
  let normalizedRequest = null;
  let listenDurationMs = 0;
  let compareDurationMs = 0;
  requestId = normalizeText(body?.requestId || requestId) || createRequestId();

  try {
    const rawBody = body && typeof body === "object" ? body : {};
    normalizedRequest = normalizeSuggestRequest(rawBody);
    const config = getClientConfig();
    if (!config.hasApiKey && !config.mockEnabled) {
      throw createHttpError(
        503,
        "后端未读取到 DASHSCOPE_API_KEY，请检查 config/env/ai.env 或环境变量。",
        "missing-api-key"
      );
    }

    const hostname = parseAudioHostname(normalizedRequest.audioUrl);
    const timeoutMs = Math.max(1000, Number(config.timeoutMs || 60000));

    console.info("[ASR Judgement][ai] suggest start", {
      requestId,
      hostname,
      itemIndex: normalizedRequest.itemIndex,
      listenModel: normalizedRequest.listenModel,
      compareModel: normalizedRequest.compareModel,
      includeContext: normalizedRequest.includeContext === true,
      contextLength: normalizedRequest.contextText.length,
      webSearchEnabled: normalizedRequest.webSearchEnabled === true,
    });

    console.info("[ASR Judgement][ai] listen start", {
      requestId,
      hostname,
      itemIndex: normalizedRequest.itemIndex,
      listenModel: normalizedRequest.listenModel,
    });
    const listenPrompt = buildListenPrompt(normalizedRequest);
    const listenStartedAtMs = Date.now();
    const listenResult = await runQueuedModelTask(normalizedRequest.listenModel, function () {
      return requestListen(normalizedRequest, listenPrompt, {
        model: normalizedRequest.listenModel,
        timeoutMs: timeoutMs,
        requestId,
        hostname,
        itemIndex: normalizedRequest.itemIndex,
        enableThinking: normalizedRequest.enableThinking,
        aiOptions: normalizedRequest.aiOptions,
      });
    });
    listenDurationMs = Math.max(0, Date.now() - listenStartedAtMs);
    const listenJson = parseModelJsonText(listenResult.rawText, requestId);
    const normalizedListen = normalizeListenResponse(listenJson);
    console.info("[ASR Judgement][ai] listen success", {
      requestId,
      hostname,
      itemIndex: normalizedRequest.itemIndex,
      listenModel: listenResult.model,
      durationMs: listenDurationMs,
      providerStatus: Number(listenResult.providerStatus || 0),
      chunkCount: Number(listenResult.chunkCount || 0),
      usage: listenResult.usage || {},
      summary: "validAudio=" + String(normalizedListen.isValidAudio !== false),
    });

    console.info("[ASR Judgement][ai] compare start", {
      requestId,
      hostname,
      itemIndex: normalizedRequest.itemIndex,
      compareModel: normalizedRequest.compareModel,
      includeContext: normalizedRequest.includeContext === true,
      contextLength: normalizedRequest.contextText.length,
      webSearchEnabled: normalizedRequest.webSearchEnabled === true,
    });
    const comparePrompt = buildComparePrompt(normalizedRequest, normalizedListen);
    const compareStartedAtMs = Date.now();
    const compareResult = await runQueuedModelTask(normalizedRequest.compareModel, function () {
      return requestCompare(
        Object.assign({}, normalizedRequest, {
          heardText: normalizedListen.heardText,
        }),
        comparePrompt,
        {
          model: normalizedRequest.compareModel,
          timeoutMs: timeoutMs,
          requestId,
          hostname,
          itemIndex: normalizedRequest.itemIndex,
          enableThinking: normalizedRequest.enableThinking,
          webSearchEnabled: normalizedRequest.webSearchEnabled === true,
          aiOptions: normalizedRequest.aiOptions,
        }
      );
    });
    compareDurationMs = Math.max(0, Date.now() - compareStartedAtMs);
    const compareJson = parseModelJsonText(compareResult.rawText, requestId);
    const normalizedCompare = normalizeCompareResponse(compareJson, {
      contextAvailable: normalizedRequest.contextAvailable,
      contextIncluded: normalizedRequest.includeContext,
      heardText: normalizedListen.heardText,
    });
    console.info("[ASR Judgement][ai] compare success", {
      requestId,
      hostname,
      itemIndex: normalizedRequest.itemIndex,
      compareModel: compareResult.model,
      durationMs: compareDurationMs,
      providerStatus: Number(compareResult.providerStatus || 0),
      chunkCount: Number(compareResult.chunkCount || 0),
      usage: compareResult.usage || {},
      webSearchEnabled: compareResult.webSearchEnabled === true,
      webSearchUsed: compareResult.webSearchUsed === true,
      webSearchFallbackUsed: compareResult.webSearchFallbackUsed === true,
      summary: "answer=" + String(normalizedCompare.answer || ""),
    });

    const totalDurationMs = Math.max(0, Date.now() - startedAtMs);
    const responseData = buildSuggestResponse({
      requestId: requestId,
      request: {
        contextAvailable: normalizedRequest.contextAvailable,
        contextIncluded: normalizedRequest.includeContext,
      },
      listen: normalizedListen,
      compare: normalizedCompare,
      listenModel: listenResult.model,
      compareModel: compareResult.model,
      listenUsage: listenResult.usage,
      compareUsage: compareResult.usage,
      listenDurationMs: listenDurationMs,
      compareDurationMs: compareDurationMs,
      totalDurationMs: totalDurationMs,
      thinking: {
        requested: normalizedRequest.enableThinking === true,
        listenFallbackUsed: listenResult.thinkingFallbackUsed === true,
        compareFallbackUsed: compareResult.thinkingFallbackUsed === true,
      },
      webSearch: {
        enabled: normalizedRequest.webSearchEnabled === true,
        used: compareResult.webSearchUsed === true,
        fallbackUsed: compareResult.webSearchFallbackUsed === true,
        fallbackReason: String(compareResult.webSearchFallbackReason || ""),
      },
      ruleVersion: normalizedRequest.ruleVersion || DEFAULT_RULE_VERSION,
      mock: Boolean(config.mockEnabled || listenResult.mock || compareResult.mock),
    });
    responseData.cost = estimateProjectCost({
      listen: {
        modelId: listenResult.model || normalizedRequest.listenModel || DEFAULT_LISTEN_MODEL,
        usage: listenResult.usage || {},
        outputMode: "text",
      },
      compare: {
        modelId: compareResult.model || normalizedRequest.compareModel || DEFAULT_COMPARE_MODEL,
        usage: compareResult.usage || {},
        outputMode: "text",
      },
    });

    console.info("[ASR Judgement][ai] suggest success", {
      requestId,
      hostname,
      itemIndex: normalizedRequest.itemIndex,
      listenModel: listenResult.model,
      compareModel: compareResult.model,
      includeContext: normalizedRequest.includeContext === true,
      contextLength: normalizedRequest.contextText.length,
      webSearchEnabled: normalizedRequest.webSearchEnabled === true,
      webSearchUsed: compareResult.webSearchUsed === true,
      webSearchFallbackUsed: compareResult.webSearchFallbackUsed === true,
      durationMs: totalDurationMs,
      providerStatus: Number(compareResult.providerStatus || listenResult.providerStatus || 0),
      chunkCount:
        Number(listenResult.chunkCount || 0) + Number(compareResult.chunkCount || 0),
      usage: responseData.usage || {},
      summary: "answer=" + String(responseData.answer || ""),
    });

    return responseData;
  } catch (error) {
    const statusCode = Number(error?.statusCode) || (error?.code === "timeout" ? 504 : 500);
    const providerStatus = Number(error?.providerStatus || error?.statusCode || 0) || undefined;
    const code = String(error?.code || "internal-error");
    const message = String(error?.message || "AI suggest 请求失败。").slice(0, 240);
    const summaryText = sanitizeLogSummary(error?.summary || message);

    console.info("[ASR Judgement][ai] suggest failed", {
      requestId,
      hostname: parseAudioHostname(normalizedRequest?.audioUrl || ""),
      itemIndex: Number(normalizedRequest?.itemIndex || 0),
      listenModel: String(normalizedRequest?.listenModel || ""),
      compareModel: String(normalizedRequest?.compareModel || ""),
      includeContext: normalizedRequest?.includeContext === true,
      contextLength: Number(normalizedRequest?.contextText?.length || 0),
      webSearchEnabled: normalizedRequest?.webSearchEnabled === true,
      durationMs: Math.max(0, Date.now() - startedAtMs),
      providerStatus: Number(providerStatus || 0),
      errorCode: code,
      summary: summaryText || "ai suggest failed",
    });

    const propagatedError =
      error instanceof Error ? error : new Error(message || "AI suggest 请求失败。");
    propagatedError.statusCode = statusCode;
    propagatedError.requestId = requestId;
    propagatedError.code = code;
    propagatedError.message = message;
    if (providerStatus) {
      propagatedError.providerStatus = providerStatus;
    }
    if (summaryText) {
      propagatedError.summary = summaryText;
    }
    throw propagatedError;
  }
}

const suggestRouteOptions = {
  maxBodyBytes: MAX_BODY_BYTES,
  run(context) {
    const requestId =
      normalizeText(context?.runtimeContext?.rawBody?.requestId) || createRequestId();
    const body = context?.runtimeContext?.rawBody || {};
    return suggestRequest(body, requestId);
  },
  createSuccessBody(context) {
    return judgementAdapter.buildSuggestSuccessBody(context);
  },
  createErrorBody(context) {
    return judgementAdapter.buildSuggestErrorBody(context);
  },
};
const handleSuggest = createAiRoute(judgementAdapter, suggestRouteOptions);
const suggestJobHandlers = createAiJobRouteHandlers(judgementAdapter, suggestRouteOptions);
function registerAiRoutes(router) {
  router.get(AI_HEALTH_PATH, function ({ response }) {
    sendJson(response, 200, buildHealthResponse());
  });
  router.get(AI_DEFAULTS_PATH, function ({ response }) {
    sendJson(response, 200, buildDefaultsResponse());
  });
  router.post(AI_SUGGEST_PATH, function (routeContext) {
    return handleSuggest(routeContext);
  });
  router.post(AI_JOBS_PATH, function (routeContext) {
    return suggestJobHandlers.handleCreateJob(routeContext);
  });
  router.get(AI_JOB_DETAIL_PATH, function (routeContext) {
    return suggestJobHandlers.handleGetJobStatus(routeContext);
  });
  router.get(AI_JOB_DEBUG_PATH, function (routeContext) {
    return suggestJobHandlers.handleGetJobDebug(routeContext);
  });
  router.get(AI_LOG_SUMMARY_PATH, function ({ response, query }) {
    sendJson(
      response,
      200,
      buildAiCallLogSummaryPayload({
        service: SERVICE_NAME,
        scriptId: SCRIPT_ID,
        logger: judgementAdapter.aiCallLogger,
        query,
      })
    );
  });
}

async function runQueuedModelTask(modelName, task) {
  const normalizedModel = String(modelName || "").trim();
  if (!normalizedModel) {
    return task();
  }
  const queued = await enqueueProviderTask(buildModelQueueKey(normalizedModel), task);
  return queued?.value;
}

module.exports = {
  AI_BASE_PATH,
  AI_DEFAULTS_PATH,
  AI_HEALTH_PATH,
  AI_JOB_DEBUG_PATH,
  AI_JOB_DETAIL_PATH,
  AI_JOBS_PATH,
  AI_LOG_SUMMARY_PATH,
  AI_SUGGEST_PATH,
  DEFAULT_RULE_VERSION,
  handleSuggest,
  normalizeSuggestRequest,
  registerAiRoutes,
  suggestRequest,
};

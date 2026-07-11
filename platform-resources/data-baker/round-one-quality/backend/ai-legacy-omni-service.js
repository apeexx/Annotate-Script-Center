"use strict";

const {
  DEFAULT_COMPARE_MODEL,
  DEFAULT_LISTEN_MODEL,
  getClientConfig,
  requestCompare,
  requestListen,
} = require("./ai-client-qwen-legacy");
const {
  appendAiCallLog,
  applyLexiconRewrite,
  buildLexiconContext,
  buildRecommendResponse,
  estimateCost,
  normalizeRecommendRequest,
  normalizeToSimplifiedChinesePreservingLexicon,
  normalizeUsage,
  parseModelJsonText,
  removeTextSpaces,
} = require("./ai-service");
const {
  buildModelQueueKey,
  enqueueProviderTask,
} = require("../../../backend/ai/provider-queue");
const { rememberAiDebug } = require("./ai-debug-store");

const LEGACY_OMNI_COMMIT = "9677e4cea98de222b70f89c9e0af1d89971dc471";
const OMNI_LEGACY_MODELS = new Set([
  "qwen3.5-omni-plus",
  "qwen3.5-omni-flash",
  "qwen3.5-omni-flash-2026-03-15",
  "qwen3-omni-flash",
  "qwen3-omni-flash-2025-12-01",
  "qwen3-omni-flash-2025-09-15",
]);
const RULE_VERSION = "data-baker-round-one-quality-ai-legacy-omni-" + LEGACY_OMNI_COMMIT.slice(0, 7);
const DEFAULT_LISTEN_TEMPLATE = [
  "请听音频并输出本句话实际发声文本。",
  "页面候选文本只作为参考，实际发声优先。",
  "不要自动改成普通话含义，不要因为词表存在就强行改写。",
  "heardText 的普通中文字符统一使用简体中文；若听到的是繁体对应的普通中文，也输出简体。",
  "但命中闽南方言业务词表 JSON 的建议用字属于保留项，不参与普通简繁转换。",
  "词表建议用字优先级高于普通简繁转换，不要因为简繁转换改变实际发声含义。",
  "后端还会对普通中文执行简体归一化，词表建议用字除外。",
  "只输出 JSON，字段为 heardText、confidence、isValid、invalidReasons。",
].join("\n");
const DEFAULT_COMPARE_TEMPLATE = [
  "请比较页面候选文本和 AI 听音文本，生成单条 AI 推荐文本。",
  "以实际发声为主，不因词表存在就无依据改写。",
  "recommendedText 的普通中文字符统一使用简体中文；pageText/heardText 中的普通繁体字应转换为简体。",
  "但命中闽南方言业务词表 JSON 的建议用字必须保持不变，不参与普通简繁转换。",
  "词表建议用字优先于普通简繁转换，不要把方言建议用字改回普通话同义词。",
  "后端还会对普通中文执行简体归一化，词表建议用字除外。",
  "输出 JSON 字段：recommendedText、decision、changePoints、confidence、needHumanReview。",
  "只输出 JSON，不输出额外解释。",
].join("\n");

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

function normalizeConfidence(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }
  return Math.max(0, Math.min(1, numericValue));
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map(function (item) {
      if (typeof item === "string") {
        return item.trim();
      }
      if (item && typeof item === "object") {
        return JSON.stringify(item);
      }
      return String(item || "").trim();
    })
    .filter(Boolean)
    .slice(0, 20);
}

function normalizeChangePoints(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.slice(0, 30).map(function (item) {
    if (typeof item === "string") {
      return {
        summary: item.trim(),
      };
    }
    const source = item && typeof item === "object" ? item : {};
    return {
      type: String(source.type || "").trim(),
      pageText: String(source.pageText || source.before || "").trim(),
      heardText: String(source.heardText || source.after || "").trim(),
      summary: String(source.summary || source.reason || "").trim(),
    };
  });
}

function normalizeListenResponse(modelJson) {
  const source = modelJson && typeof modelJson === "object" ? modelJson : {};
  const heardText = removeTextSpaces(source.heardText || source.text || "");
  if (!heardText && source.isValid !== false) {
    throw new Error("听音模型未返回 heardText。");
  }
  return {
    heardText,
    confidence: normalizeConfidence(source.confidence),
    isValid: source.isValid !== false,
    invalidReasons: normalizeStringArray(source.invalidReasons),
  };
}

function normalizeCompareResponse(modelJson, context) {
  const source = modelJson && typeof modelJson === "object" ? modelJson : {};
  const pageText = String(context?.pageText || "");
  const heardText = removeTextSpaces(context?.heardText || "");
  const recommendedText = removeTextSpaces(
    source.recommendedText === undefined || source.recommendedText === null
      ? heardText || pageText
      : source.recommendedText
  );
  const decision = String(source.decision || "").trim() || "need_human_review";
  const confidence = normalizeConfidence(source.confidence);
  const needHumanReview =
    source.needHumanReview === true || confidence < 0.75 || !recommendedText;
  return {
    recommendedText,
    decision,
    changePoints: normalizeChangePoints(source.changePoints),
    confidence,
    needHumanReview,
  };
}

function getLexiconText(lexiconContext) {
  return String(lexiconContext?.text || "").trim();
}

function normalizePromptTemplate(value, fallback) {
  const text = String(value || "").replace(/\r\n/g, "\n").trim();
  if (!text) {
    return String(fallback || "");
  }
  return text.slice(0, 8000);
}

function buildListenPrompt(request, lexiconContext) {
  const template = normalizePromptTemplate(
    request?.aiOptions?.listenPrompt,
    DEFAULT_LISTEN_TEMPLATE
  );
  const meta = {
    sentenceNumber: request.sentenceNumber,
    readRequire: request.readRequire,
    pageText: request.pageText,
    effectiveStartTime: request.effectiveStartTime,
    effectiveEndTime: request.effectiveEndTime,
    effectiveTime: request.effectiveTime,
    audioDuration: request.audioDuration,
  };
  const lexiconText = getLexiconText(lexiconContext);
  const promptLines = [
    template,
    "对“的/诶”“很/真”“喜欢/欢喜”“这位/即个”“我/阮”“你/汝”“他/伊”等易混词必须按实际发声判断。",
  ];
  if (lexiconText) {
    promptLines.push(
      "以下是官方闽南方言字词表上下文：",
      lexiconText,
      "词表使用规则：",
      "1. 如果实际发声明显符合建议用字，请优先使用建议用字。",
      "2. 如果实际发声就是普通话词，不要因为词表存在就强行改写。",
      "3. 例如听到“伊”写“伊”，听到“你”写“你”；听到“诶”写“诶”，听到“的”写“的”。",
      "4. 词表建议用字不参与普通简繁转换；命中后按词表建议用字保留。"
    );
  }
  promptLines.push(
    "如果音频无效、无法听清或无法判断，请 isValid=false 并给出 invalidReasons。",
    "只输出 JSON，字段为 heardText、confidence、isValid、invalidReasons。",
    "输入元信息：",
    JSON.stringify(meta, null, 2)
  );
  return {
    ruleVersion: RULE_VERSION,
    systemPrompt:
      "你是 DataBaker 质检听音助手。只根据实际音频发声输出 JSON，不要输出 Markdown 或 JSON 以外文本。",
    userPrompt: promptLines.join("\n"),
  };
}

function buildComparePrompt(request, heardText, lexiconContext) {
  const template = normalizePromptTemplate(
    request?.aiOptions?.comparePrompt,
    DEFAULT_COMPARE_TEMPLATE
  );
  const input = {
    pageText: request.pageText,
    heardText,
    readRequire: request.readRequire,
    sentenceNumber: request.sentenceNumber,
  };
  const lexiconText = getLexiconText(lexiconContext);
  const promptLines = [
    template,
    "规则：",
    "1. 以实际发声为主。",
    "2. 页面候选文本只是参考。",
    "3. 不自动改成普通话含义。",
    "4. 不因为词表存在就强行改写。",
    "5. 如果实际发声和页面候选文本一致，recommendedText 保留页面候选文本。",
    "6. 如果实际发声明显不同，recommendedText 按实际发声输出。",
    "7. 只生成推荐文本，不自动提交。",
    "8. 对“的/诶”“很/真”“喜欢/欢喜”“这位/即个”“我/阮”“你/汝”“他/伊”等要按实际发声判断。",
  ];
  if (lexiconText) {
    promptLines.push(
      "以下是官方闽南方言字词表上下文：",
      lexiconText,
      "词表使用规则：",
      "1. 推荐文本以实际发声为主。",
      "2. 词表用于选择字形，不用于无依据改写。",
      "3. 如果听音文本命中词表建议用字，优先保留。",
      "4. 如果听音文本明显被页面文本保守覆盖，要按听音文本和词表修正。",
      "5. recommendedText 最终应对普通中文做简体化，但词表建议用字是保留项，不能被普通简繁转换覆盖。",
      "6. 如果听音文本命中词表建议用字，应先保留词表建议用字，再处理其他普通繁体字为简体。"
    );
  }
  promptLines.push(
    "输出 JSON 字段：recommendedText、decision、changePoints、confidence、needHumanReview。",
    "decision 可用值建议：keep_page_text、use_heard_text、minor_edit、uncertain。",
    "输入：",
    JSON.stringify(input, null, 2)
  );
  return {
    ruleVersion: RULE_VERSION,
    systemPrompt:
      "你是 DataBaker 质检文本复核助手。只输出 JSON，不要输出 Markdown 或 JSON 以外文本。",
    userPrompt: promptLines.join("\n"),
  };
}

function summarizeQueueMeta(queueMeta) {
  const source = queueMeta && typeof queueMeta === "object" ? queueMeta : {};
  return {
    groupName: String(source.groupName || ""),
    queueWaitMs: Math.max(0, Number(source.queueWaitMs) || 0),
    retryCount: Math.max(0, Number(source.retryCount) || 0),
    retryDelaysMs: Array.isArray(source.retryDelaysMs) ? source.retryDelaysMs.slice(0, 6) : [],
    durationMs: Math.max(0, Number(source.durationMs) || 0),
    activeCount: Math.max(0, Number(source.activeCount) || 0),
    maxConcurrent: Math.max(0, Number(source.maxConcurrent) || 0),
  };
}

async function runLegacyQueuedProviderCall(groupName, task, options) {
  if (!isQwenSmoothEnabled()) {
    const startedAtMs = Date.now();
    const value = await task();
    return {
      value,
      queueMeta: {
        groupName: String(groupName || ""),
        queueWaitMs: 0,
        retryCount: 0,
        retryDelaysMs: [],
        durationMs: Date.now() - startedAtMs,
        activeCount: 0,
        maxConcurrent: 0,
      },
    };
  }
  const normalizedModel = String(options?.model || "").trim();
  const queueKey = normalizedModel ? buildModelQueueKey(normalizedModel) : groupName;
  return enqueueProviderTask(queueKey, task, {
    signal: options?.signal,
    onRetry: function (meta) {
      const error = meta?.error;
      console.info("[DataBaker][legacy-omni] qwen burst retry", {
        requestId: String(options?.requestId || ""),
        stage: String(options?.stage || ""),
        model: String(options?.model || ""),
        providerCode: String(error?.providerCode || ""),
        retryIndex: Math.max(1, Number(meta?.attemptIndex) || 1),
        delayMs: Math.max(0, Number(meta?.delayMs) || 0),
      });
    },
  });
}

function isQwenSmoothEnabled() {
  const rawValue = String(process.env.DATABAKER_AI_QWEN_SMOOTH_ENABLED || "0")
    .trim()
    .toLowerCase();
  return rawValue === "1" || rawValue === "true" || rawValue === "on";
}

function isOmniLegacyFastPathEnabled() {
  const rawValue = String(process.env.DATABAKER_AI_OMNI_LEGACY_FAST_PATH || "1")
    .trim()
    .toLowerCase();
  return !(rawValue === "0" || rawValue === "false" || rawValue === "off");
}

function isLegacyOmniModel(model) {
  return OMNI_LEGACY_MODELS.has(String(model || "").trim());
}

function resolveRequestedRecognitionMode(recommendRequest) {
  const text = String(recommendRequest?.recognitionMode || recommendRequest?.pipelineMode || "two_stage")
    .trim()
    .toLowerCase();
  if (text === "omni_single" || text === "listen_only") {
    return "omni_single";
  }
  return "two_stage";
}

function shouldUseLegacyOmniFastPath(recommendRequestLike) {
  const config = getClientConfig();
  const recommendRequest =
    recommendRequestLike && typeof recommendRequestLike === "object"
      ? recommendRequestLike
      : normalizeRecommendRequest(recommendRequestLike || {});
  const recognitionMode = resolveRequestedRecognitionMode(recommendRequest);
  const listenModel = String(
    recommendRequest.aiOptions?.listenModel ||
      recommendRequest.listenModel ||
      config.listenModel ||
      DEFAULT_LISTEN_MODEL
  ).trim();
  const singleModel = String(
    recommendRequest.aiOptions?.singleModel ||
      recommendRequest.singleModel ||
      listenModel ||
      config.listenModel ||
      DEFAULT_LISTEN_MODEL
  ).trim();
  if (recognitionMode === "two_stage") {
    return isLegacyOmniModel(listenModel);
  }
  return isOmniLegacyFastPathEnabled() && isLegacyOmniModel(singleModel);
}

function appendCallLogSafe(record) {
  try {
    appendAiCallLog(record);
  } catch (error) {
    console.warn("[DataBaker][round-one-quality][ai] 写入调用日志失败", {
      requestId: record?.requestId,
      message: error && error.message ? error.message : String(error),
    });
  }
}

function buildAiDebugPayloadFromError(error, context) {
  const source = error && typeof error === "object" ? error : {};
  const meta = context && typeof context === "object" ? context : {};
  const request = meta.request && typeof meta.request === "object" ? meta.request : {};
  const raw = source.debugRawAiResponse && typeof source.debugRawAiResponse === "object"
    ? source.debugRawAiResponse
    : source.debugRawJson && typeof source.debugRawJson === "object"
      ? source.debugRawJson
      : null;
  if (!raw) {
    return null;
  }
  return {
    requestId: String(source.requestId || meta.requestId || ""),
    clientRequestId: String(request.clientRequestId || meta.clientRequestId || ""),
    batchRunId: String(request.batchRunId || meta.batchRunId || ""),
    batchProcessKey: String(request.batchProcessKey || meta.batchProcessKey || ""),
    itemId: String(request.itemId || meta.itemId || raw.itemId || ""),
    textId: String(request.textId || meta.textId || raw.textId || ""),
    sentenceNumber:
      request.sentenceNumber !== undefined && request.sentenceNumber !== null
        ? Number(request.sentenceNumber) || 0
        : Number(meta.sentenceNumber || raw.sentenceNumber) || 0,
    stage: String(source.stage || meta.stage || raw.stage || "unknown"),
    model: String(source.model || meta.model || raw.model || ""),
    provider: String(raw.provider || meta.provider || "legacy-omni"),
    providerCode: String(raw.providerCode || source.providerCode || meta.providerCode || ""),
    errorCode: String(source.code || raw.errorCode || ""),
    errorMessage: String(source.safeMessage || source.message || raw.errorMessage || ""),
    providerStatus: Number(source.providerStatus || source.statusCode || raw.providerStatus) || 0,
    rawText: String(raw.rawText || raw.rawModelText || ""),
    rawJson: raw.rawJson && typeof raw.rawJson === "object" ? raw.rawJson : raw,
    rawSseText: String(raw.rawSseText || raw.rawResponseText || ""),
    responseBody: raw.responseBody || null,
    usage: raw.usage && typeof raw.usage === "object" ? raw.usage : null,
    createdAt: String(meta.createdAt || raw.createdAt || new Date().toISOString()),
  };
}

function attachRawAiDebugToError(error, context) {
  const source = error && typeof error === "object" ? error : null;
  if (!source) {
    return "";
  }
  if (source.debugId) {
    source.hasRawAiDebug = true;
    return String(source.debugId || "");
  }
  const payload = buildAiDebugPayloadFromError(source, context);
  if (!payload) {
    return "";
  }
  const stored = rememberAiDebug(payload);
  source.debugId = stored.debugId;
  source.hasRawAiDebug = true;
  source.rawAiDebug = stored;
  return stored.debugId;
}

async function recommendLegacyOmni(body, requestIdHint, runtimeOptions) {
  const startedAtMs = Date.now();
  let requestId = String(requestIdHint || createRequestId());
  let recommendRequest = null;
  let config = null;
  let listenDurationMs = 0;
  let compareDurationMs = 0;
  const queueMetas = [];
  const runtimeSignal = runtimeOptions?.signal;
  try {
    recommendRequest = normalizeRecommendRequest(body || {});
    requestId = String(body?.requestId || requestId);
    config = getClientConfig();
    if (!config.hasApiKey && !config.mockEnabled) {
      const missingApiKeyError = new Error("missing-api-key");
      missingApiKeyError.code = "missing-api-key";
      missingApiKeyError.statusCode = 503;
      throw missingApiKeyError;
    }

    const recognitionMode = resolveRequestedRecognitionMode(recommendRequest);
    const listenModel = String(
      recommendRequest.aiOptions.listenModel ||
        recommendRequest.listenModel ||
        config.listenModel ||
        DEFAULT_LISTEN_MODEL
    ).trim() || DEFAULT_LISTEN_MODEL;
    const compareModel = String(
      recommendRequest.aiOptions.compareModel ||
        recommendRequest.compareModel ||
        config.compareModel ||
        DEFAULT_COMPARE_MODEL
    ).trim() || DEFAULT_COMPARE_MODEL;
    const effectiveEnableThinking =
      typeof recommendRequest.aiOptions.enable_thinking === "boolean"
        ? recommendRequest.aiOptions.enable_thinking === true
        : config.enableThinkingDefault === true;

    console.info("[DataBaker][round-one-quality][ai] legacy omni fast path start", {
      requestId,
      hostname: (() => {
        try {
          return new URL(String(recommendRequest.audioUrl || "")).hostname || "";
        } catch (error) {
          return "";
        }
      })(),
      sentenceNumber: recommendRequest.sentenceNumber,
      recognitionMode,
      pipelineMode: "qwen_omni_compare_legacy",
      listenModel,
      compareModel,
      batchRunId: String(recommendRequest.batchRunId || ""),
      batchItemIndex: Number(recommendRequest.batchItemIndex) || 0,
      batchProcessKey: String(recommendRequest.batchProcessKey || ""),
      clientRequestId: String(recommendRequest.clientRequestId || ""),
      enableThinking: effectiveEnableThinking,
      mock: config.mockEnabled,
      legacyCommit: LEGACY_OMNI_COMMIT,
    });

    const listenLexiconContext = buildLexiconContext({
      pageText: recommendRequest.pageText,
      heardText: "",
      limit: 40,
    });
    const listenPrompt = buildListenPrompt(recommendRequest, listenLexiconContext);
    const listenStartedAtMs = Date.now();
    let listenResult = null;
    try {
      const listenQueueResult = await runLegacyQueuedProviderCall(
        "qwen_omni",
        function () {
          return requestListen(recommendRequest, listenPrompt, {
            model: listenModel,
            timeoutMs: config.timeoutMs,
            enableThinking: effectiveEnableThinking,
            signal: runtimeSignal,
          });
        },
        {
          signal: runtimeSignal,
          requestId,
          stage: "listen",
          model: listenModel,
        }
      );
      listenResult = listenQueueResult.value;
      queueMetas.push(listenQueueResult.queueMeta);
    } finally {
      listenDurationMs = Date.now() - listenStartedAtMs;
    }

    const listenJson = parseModelJsonText(listenResult.rawText, {
      requestId,
      itemId: recommendRequest.itemId,
      sentenceNumber: recommendRequest.sentenceNumber,
      stage: "listen",
      model: listenResult.model,
      createdAt: runtimeOptions?.createdAt || new Date().toISOString(),
    });
    const normalizedListen = normalizeListenResponse(listenJson);
    normalizedListen.heardText = normalizeToSimplifiedChinesePreservingLexicon(
      removeTextSpaces(normalizedListen.heardText)
    );

    const compareLexiconContext = buildLexiconContext({
      pageText: recommendRequest.pageText,
      heardText: normalizedListen.heardText,
      limit: 60,
    });
    const comparePrompt = buildComparePrompt(
      recommendRequest,
      normalizedListen.heardText,
      compareLexiconContext
    );
    const compareStartedAtMs = Date.now();
    let compareResult = null;
    try {
      const compareQueueResult = await runLegacyQueuedProviderCall(
        "text_compare",
        function () {
          return requestCompare(
            recommendRequest,
            comparePrompt,
            normalizedListen.heardText,
            {
              model: compareModel,
              timeoutMs: config.timeoutMs,
              enableThinking: effectiveEnableThinking,
              signal: runtimeSignal,
            }
          );
        },
        {
          signal: runtimeSignal,
          requestId,
          stage: "compare",
          model: compareModel,
        }
      );
      compareResult = compareQueueResult.value;
      queueMetas.push(compareQueueResult.queueMeta);
    } finally {
      compareDurationMs = Date.now() - compareStartedAtMs;
    }

    const compareJson = parseModelJsonText(compareResult.rawText, {
      requestId,
      itemId: recommendRequest.itemId,
      sentenceNumber: recommendRequest.sentenceNumber,
      stage: "compare",
      model: compareResult.model,
      createdAt: runtimeOptions?.createdAt || new Date().toISOString(),
    });
    const normalizedCompare = normalizeCompareResponse(compareJson, {
      pageText: recommendRequest.pageText,
      heardText: normalizedListen.heardText,
    });
    normalizedCompare.recommendedText = normalizeToSimplifiedChinesePreservingLexicon(
      removeTextSpaces(normalizedCompare.recommendedText)
    );

    const rewriteMode = String(process.env.DATABAKER_AI_LEXICON_REWRITE_MODE || "aggressive").trim() || "aggressive";
    const rewriteResult = applyLexiconRewrite(normalizedCompare.recommendedText, {
      pageText: recommendRequest.pageText,
      heardText: normalizedListen.heardText,
      mode: rewriteMode,
    });
    if (rewriteResult.changed) {
      normalizedCompare.recommendedText = rewriteResult.text;
      normalizedCompare.needHumanReview = true;
    }
    normalizedCompare.recommendedText = normalizeToSimplifiedChinesePreservingLexicon(
      removeTextSpaces(normalizedCompare.recommendedText)
    );

    const listenUsage = normalizeUsage(listenResult.usage);
    const compareUsage = normalizeUsage(compareResult.usage);
    const responseData = buildRecommendResponse({
      requestId,
      request: recommendRequest,
      listen: normalizedListen,
      compare: normalizedCompare,
      listenModel: listenResult.model,
      compareModel: compareResult.model,
      listenUsage,
      compareUsage,
      cost: estimateCost({
        effectiveTime: recommendRequest.effectiveTime,
        listenModel: listenResult.model,
        compareModel: compareResult.model,
        listenUsage,
        compareUsage,
      }),
    });
    responseData.lexicon = {
      enabled: Boolean(
        listenLexiconContext.enabled || compareLexiconContext.enabled || rewriteMode !== "off"
      ),
      rewriteMode,
      matchedCount: Number(compareLexiconContext.matchedCount || 0),
      rewriteChanged: rewriteResult.changed === true,
      rewriteChanges: rewriteResult.changes,
    };
    responseData.timing = {
      listenDurationMs,
      compareDurationMs,
      totalDurationMs: Date.now() - startedAtMs,
    };
    responseData.recognitionMode = recognitionMode;
    responseData.pipelineMode = recognitionMode;
    responseData.derivedPipelineMode = "qwen_omni_compare_legacy";
    responseData.runtime = {
      cache: {
        hit: false,
        ttlMs: 0,
        sourceRequestId: "",
      },
      queue: {
        enabled: isQwenSmoothEnabled(),
        groups: queueMetas.map(summarizeQueueMeta),
        totalQueueWaitMs: queueMetas.reduce(function (total, item) {
          return total + Math.max(0, Number(item?.queueWaitMs) || 0);
        }, 0),
        totalRetryCount: queueMetas.reduce(function (total, item) {
          return total + Math.max(0, Number(item?.retryCount) || 0);
        }, 0),
      },
      requestMode: "sync-recommend",
      funAsrProvider: "",
      omniLegacyFastPath: true,
      omniLegacyCommit: LEGACY_OMNI_COMMIT,
      qwenSmoothEnabled: isQwenSmoothEnabled(),
    };
    responseData.thinking = {
      enableThinking: effectiveEnableThinking,
      fallbackUsed: Boolean(
        listenResult.thinkingFallbackUsed || compareResult.thinkingFallbackUsed
      ),
      fallbackMode:
        String(listenResult.thinkingFallbackMode || "") ||
        String(compareResult.thinkingFallbackMode || ""),
      disabledRequested: Boolean(
        listenResult.thinkingDisabledRequested || compareResult.thinkingDisabledRequested
      ),
      disableFallbackUsed: Boolean(
        listenResult.thinkingDisableFallbackUsed || compareResult.thinkingDisableFallbackUsed
      ),
    };
    responseData.normalization = {
      simplifiedChineseApplied: true,
      lexiconTermsPreserved: true,
    };
    responseData.modelSelection = {
      recognitionMode,
      listenModel,
      compareModel,
      singleModel: listenModel,
      funAsrProvider: "",
      derivedPipelineMode: "qwen_omni_compare_legacy",
    };

    appendCallLogSafe({
      createdAt: new Date().toISOString(),
      requestId,
      success: true,
      durationMs: Date.now() - startedAtMs,
      listenDurationMs,
      compareDurationMs,
      request: recommendRequest,
      response: responseData,
      listenModel: listenResult.model,
      compareModel: compareResult.model,
      pipelineMode: "qwen_omni_compare_legacy",
      audioHostname: (() => {
        try {
          return new URL(String(recommendRequest.audioUrl || "")).hostname || "";
        } catch (error) {
          return "";
        }
      })(),
      mock: Boolean(config.mockEnabled || listenResult.mock || compareResult.mock),
    });

    return responseData;
  } catch (error) {
    const debugId = attachRawAiDebugToError(error, {
      requestId,
      request: recommendRequest || {},
      provider: "legacy-omni",
      createdAt: runtimeOptions?.createdAt || new Date().toISOString(),
    });
    appendCallLogSafe({
      createdAt: new Date().toISOString(),
      requestId,
      success: false,
      durationMs: Date.now() - startedAtMs,
      listenDurationMs,
      compareDurationMs,
      request: recommendRequest || {},
      response: {},
      listenModel: config?.listenModel || DEFAULT_LISTEN_MODEL,
      compareModel: config?.compareModel || DEFAULT_COMPARE_MODEL,
      pipelineMode: "qwen_omni_compare_legacy",
      audioHostname: (() => {
        try {
          return new URL(String(recommendRequest?.audioUrl || "")).hostname || "";
        } catch (parseError) {
          return "";
        }
      })(),
      mock: Boolean(config?.mockEnabled),
      debugId,
      errorCode: String(error?.code || ""),
      errorMessage: String(error?.safeMessage || error?.message || "DataBaker AI recommend 请求失败。").slice(0, 240),
    });
    error.requestId = String(error?.requestId || requestId || "");
    throw error;
  }
}

module.exports = {
  DEFAULT_COMPARE_TEMPLATE,
  DEFAULT_LISTEN_TEMPLATE,
  LEGACY_OMNI_COMMIT,
  RULE_VERSION,
  isOmniLegacyFastPathEnabled,
  isQwenSmoothEnabled,
  recommendLegacyOmni,
  shouldUseLegacyOmniFastPath,
};

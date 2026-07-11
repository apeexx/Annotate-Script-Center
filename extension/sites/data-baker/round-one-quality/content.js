(function () {
  const CHECK_INTERVAL_MS = 1000;
  const DEFAULT_AI_REQUEST_TIMEOUT_MS = 60000;
  const DEFAULT_AI_ASYNC_JOBS_ENABLED = false;
  const DEFAULT_AI_REQUEST_STAGGER_MS = 50;
  const PAGE_SIZE_OPTIONS = ["5条/页", "10条/页", "20条/页", "50条/页", "100条/页"];
  const SHORTCUT_KEYS = [
    "aiRecommendCurrentItem",
    "autoFillQualifiedItem",
    "copyAiHeardText",
    "copyRecommendedText",
    "fillRecommendedText",
    "ignoreAiResult",
    "sentenceQualified",
    "sentenceUnqualified",
    "taskPass",
    "taskPartialReject",
    "taskFullReject",
  ];
  const CONSTANTS = globalThis.ASREdgeConstants || {};
  const BACKEND_MODE_LOCAL = CONSTANTS.BACKEND_ENDPOINT_MODE_LOCAL || "local";
  const DATABAKER_AI_RECOMMEND_PATH =
    CONSTANTS.DATABAKER_AI_RECOMMEND_PATH || "/api/data-baker/round-one-quality/ai/recommend";
  const BATCH_LOCK_KEY = "__ASC_DATABAKER_ROUND_ONE_BATCH_LOCK__";
  const BATCH_LOCK_STALE_MS = 5 * 60 * 1000;
  const BATCH_LOCK_HEARTBEAT_MS = 2000;
  const BATCH_TOGGLE_DEBOUNCE_MS = 500;
  const MOUNT_RETRY_DELAY_MS = 300;
  const MAX_MOUNT_RETRY_COUNT = 4;
  const concurrentRequestStreamFactory = globalThis.ASREdgeConcurrentAiRequestStream || null;
  const aiBatchSummary =
    globalThis.ASREdgeAiBatchSummary ||
    (typeof module !== "undefined" && module.exports
      ? require("../../../shared/ai-batch-summary.js")
      : {});
  const createBatchSummaryAccumulator =
    typeof aiBatchSummary.createBatchSummaryAccumulator === "function"
      ? aiBatchSummary.createBatchSummaryAccumulator
      : function () {
          return {
            addResult: function () {},
            getSnapshot: function () {
              return {
                batchResultCount: 0,
                batchPromptTokens: null,
                batchCompletionTokens: null,
                batchTotalTokens: null,
                batchEstimatedCostCny: null,
                batchHasUsageData: false,
                batchHasPriceData: false,
              };
            },
          };
        };
  const DATABAKER_LISTEN_MODEL_OPTIONS = Array.isArray(CONSTANTS.DATABAKER_AI_LISTEN_MODEL_OPTIONS)
    ? CONSTANTS.DATABAKER_AI_LISTEN_MODEL_OPTIONS
        .map(function (item) {
          return String(item && typeof item === "object" ? item.value : item || "").trim();
        })
        .filter(Boolean)
    : [
        "fun-asr",
        "qwen3.5-omni-plus",
        "qwen3.5-omni-flash",
        "qwen3.5-omni-flash-2026-03-15",
        "qwen3-omni-flash",
        "qwen3-omni-flash-2025-12-01",
        "qwen3-omni-flash-2025-09-15",
      ];
  const DATABAKER_COMPARE_MODEL_OPTIONS = Array.isArray(CONSTANTS.DATABAKER_AI_COMPARE_MODEL_OPTIONS)
    ? CONSTANTS.DATABAKER_AI_COMPARE_MODEL_OPTIONS
        .map(function (item) {
          return String(item && typeof item === "object" ? item.value : item || "").trim();
        })
        .filter(Boolean)
    : ["qwen3.6-plus", "qwen3.5-plus", "qwen3.6-flash", "qwen3.5-flash"];
  const DATABAKER_SINGLE_MODEL_OPTIONS = Array.isArray(CONSTANTS.DATABAKER_AI_SINGLE_MODEL_OPTIONS)
    ? CONSTANTS.DATABAKER_AI_SINGLE_MODEL_OPTIONS
        .map(function (item) {
          return String(item && typeof item === "object" ? item.value : item || "").trim();
        })
        .filter(Boolean)
    : [
        "qwen3.5-omni-plus",
        "qwen3.5-omni-flash",
        "qwen3.5-omni-flash-2026-03-15",
        "qwen3-omni-flash",
        "qwen3-omni-flash-2025-12-01",
        "qwen3-omni-flash-2025-09-15",
      ];

  let runtime = null;
  let runtimeConfigKey = "";
  let pageTimer = null;
  let observer = null;
  let evaluating = false;
  let pendingEvaluate = false;
  let mountRetryTimer = null;

  function normalizeEndpoint(value, fallback) {
    const normalized = normalizeEndpointUrl(value);
    if (normalized) {
      return normalized;
    }
    return normalizeEndpointUrl(fallback) || "";
  }

  function normalizeEndpointUrl(value) {
    try {
      const url = new URL(String(value || "").trim());
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return "";
      }
      return url.toString();
    } catch (error) {
      return "";
    }
  }

  function normalizeTimeout(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return DEFAULT_AI_REQUEST_TIMEOUT_MS;
    }
    return Math.min(300000, Math.max(1000, Math.round(number)));
  }

  function normalizeRequestStaggerMs(value) {
    const number = Math.round(Number(value));
    if (!Number.isFinite(number)) {
      return DEFAULT_AI_REQUEST_STAGGER_MS;
    }
    return Math.min(1000, Math.max(DEFAULT_AI_REQUEST_STAGGER_MS, number));
  }

  function getDataBakerAiQualifiedAutofillConcurrencyRule(configLike) {
    const helper =
      typeof CONSTANTS.getDataBakerAiQualifiedAutofillConcurrencyRule === "function"
        ? CONSTANTS.getDataBakerAiQualifiedAutofillConcurrencyRule
        : null;
    if (helper) {
      return helper(configLike || {});
    }
    const source = configLike && typeof configLike === "object" ? configLike : {};
    const recognitionMode = normalizePipelineMode(
      source.recognitionMode || source.aiRecommendPipelineMode || source.pipelineMode,
      "two_stage"
    );
    const listenModel = getDataBakerModelText(source.listenModel || source.aiRecommendListenModel);
    if (recognitionMode === "two_stage" && listenModel === "fun-asr") {
      return { min: 1, max: 50, defaultValue: 5, modelType: "fun_asr" };
    }
    return { min: 1, max: 25, defaultValue: 5, modelType: "omni" };
  }

  function normalizeAutofillConcurrency(value, configLike) {
    const helper =
      typeof CONSTANTS.normalizeDataBakerAiQualifiedAutofillConcurrency === "function"
        ? CONSTANTS.normalizeDataBakerAiQualifiedAutofillConcurrency
        : null;
    const rule =
      configLike?.aiQualifiedAutofillConcurrencyRule &&
      typeof configLike.aiQualifiedAutofillConcurrencyRule === "object"
        ? configLike.aiQualifiedAutofillConcurrencyRule
        : getDataBakerAiQualifiedAutofillConcurrencyRule(configLike);
    if (helper && !configLike?.aiQualifiedAutofillConcurrencyRule) {
      return helper(value, configLike || {});
    }
    const number = Number(value);
    const base = Number.isFinite(number) ? Math.round(number) : rule.defaultValue;
    return Math.max(rule.min, Math.min(rule.max, base));
  }

  function normalizePipelineMode(value) {
    const text = String(value || "").trim().toLowerCase();
    if (text === "two_stage" || text === "omni_single") {
      return text;
    }
    if (text === "fun_asr_compare" || text === "qwen_omni_compare" || text === "qwen_omni_two_stage") {
      return "two_stage";
    }
    if (text === "listen_only") {
      return "omni_single";
    }
    return "two_stage";
  }

  function normalizeAutofillWaitAll(value) {
    return value === true;
  }

  function normalizePageSize(value) {
    const text = String(value || "").replace(/\s+/g, "");
    return PAGE_SIZE_OPTIONS.indexOf(text) >= 0 ? text : "50条/页";
  }

  function normalizeShortcut(shortcut) {
    if (!shortcut || typeof shortcut !== "object") {
      return null;
    }
    const hasKey = typeof shortcut.key === "string" && shortcut.key.length > 0;
    const hasButton = typeof shortcut.button === "number";
    if (!hasKey && !hasButton) {
      return null;
    }
    return {
      ctrl: shortcut.ctrl === true,
      alt: shortcut.alt === true,
      shift: shortcut.shift === true,
      meta: shortcut.meta === true,
      key: hasKey ? shortcut.key : null,
      button: hasButton ? shortcut.button : null,
    };
  }

  function normalizePromptText(value) {
    return String(value || "").replace(/\r\n/g, "\n").trim().slice(0, 8000);
  }

  function getDataBakerModelText(value) {
    if (value && typeof value === "object") {
      if (typeof value.value === "string") {
        return String(value.value || "").trim();
      }
      if (typeof value.label === "string") {
        return String(value.label || "").trim();
      }
      return "";
    }
    const text = String(value || "").replace(/[\r\n]+/g, " ").trim();
    return text === "[object Object]" ? "" : text;
  }

  function normalizeDataBakerListenModel(value, fallback) {
    const normalizedValue = getDataBakerModelText(value);
    if (DATABAKER_LISTEN_MODEL_OPTIONS.indexOf(normalizedValue) >= 0) {
      return normalizedValue;
    }
    const normalizedFallback = getDataBakerModelText(fallback || "qwen3.5-omni-flash");
    if (DATABAKER_LISTEN_MODEL_OPTIONS.indexOf(normalizedFallback) >= 0) {
      return normalizedFallback;
    }
    return "qwen3.5-omni-flash";
  }

  function normalizeDataBakerCompareModel(value) {
    const normalizedValue = getDataBakerModelText(value);
    if (DATABAKER_COMPARE_MODEL_OPTIONS.indexOf(normalizedValue) >= 0) {
      return normalizedValue;
    }
    return "qwen3.5-plus";
  }

  function normalizeDataBakerSingleModel(value, fallback) {
    const normalizedValue = getDataBakerModelText(value);
    if (DATABAKER_SINGLE_MODEL_OPTIONS.indexOf(normalizedValue) >= 0) {
      return normalizedValue;
    }
    const normalizedFallback = getDataBakerModelText(fallback || "qwen3.5-omni-flash");
    if (DATABAKER_SINGLE_MODEL_OPTIONS.indexOf(normalizedFallback) >= 0) {
      return normalizedFallback;
    }
    return "qwen3.5-omni-flash";
  }

  function derivePipelineMode(recognitionMode, model) {
    if (normalizePipelineMode(recognitionMode) === "omni_single") {
      return "omni_single";
    }
    return getDataBakerModelText(model) === "fun-asr" ? "fun_asr_compare" : "qwen_omni_compare";
  }

  function buildAiDisplayMeta(configLike) {
    const source = configLike && typeof configLike === "object" ? configLike : {};
    const recognitionMode = normalizePipelineMode(
      source.recognitionMode || source.aiRecommendPipelineMode || source.pipelineMode
    );
    const listenModel = getDataBakerModelText(source.listenModel || source.aiRecommendListenModel);
    const compareModel = getDataBakerModelText(source.compareModel || source.aiRecommendCompareModel);
    const singleModel = getDataBakerModelText(source.singleModel || source.aiRecommendSingleModel);
    const rule = getDataBakerAiQualifiedAutofillConcurrencyRule({
      recognitionMode,
      aiRecommendPipelineMode: recognitionMode,
      listenModel,
      aiRecommendListenModel: listenModel,
      singleModel,
      aiRecommendSingleModel: singleModel,
    });
    const isFunAsrTwoStage = recognitionMode === "two_stage" && listenModel === "fun-asr";
    const isOmniSingle = recognitionMode === "omni_single";
    const isOmniTwoStage = recognitionMode === "two_stage" && !isFunAsrTwoStage;
    const fallbackModels = [listenModel, compareModel, singleModel].filter(Boolean).join(" + ");

    if (isOmniSingle) {
      return {
        aiPipelineDisplayName: "Omni 单模型",
        aiModelDisplayName: singleModel || listenModel || "qwen3.5-omni-flash",
        concurrencyRuleText:
          "Omni 默认" + String(rule.defaultValue || 5) + "，范围" + String(rule.min || 1) + "~" + String(rule.max || 25),
        concurrencyModelType: "omni",
      };
    }
    if (isFunAsrTwoStage) {
      return {
        aiPipelineDisplayName: "Fun-ASR + 比较模型",
        aiModelDisplayName: "fun-asr + " + String(compareModel || "qwen3.5-plus"),
        concurrencyRuleText:
          "Fun-ASR 默认" + String(rule.defaultValue || 5) + "，范围" + String(rule.min || 1) + "~" + String(rule.max || 50),
        concurrencyModelType: "fun_asr",
      };
    }
    if (isOmniTwoStage) {
      return {
        aiPipelineDisplayName: "Omni 听音 + 比较模型",
        aiModelDisplayName:
          String(listenModel || "qwen3.5-omni-flash") + " + " + String(compareModel || "qwen3.5-plus"),
        concurrencyRuleText:
          "Omni 默认" + String(rule.defaultValue || 5) + "，范围" + String(rule.min || 1) + "~" + String(rule.max || 25),
        concurrencyModelType: "omni",
      };
    }
    return {
      aiPipelineDisplayName: "AI 推荐",
      aiModelDisplayName: fallbackModels || "当前模型字段未配置",
      concurrencyRuleText: "按当前配置归一",
      concurrencyModelType: String(rule.modelType || "omni"),
    };
  }

  function normalizeOptionalNumber(value, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < min || number > max) {
      return null;
    }
    return number;
  }

  function normalizeOptionalInteger(value, min, max) {
    const number = Math.floor(Number(value));
    if (!Number.isFinite(number) || number < min || number > max) {
      return null;
    }
    return number;
  }

  function normalizeShortcuts(shortcuts) {
    const source = shortcuts && typeof shortcuts === "object" ? shortcuts : {};
    const result = {};
    SHORTCUT_KEYS.forEach(function (key) {
      result[key] = normalizeShortcut(source[key]);
    });
    return result;
  }

  function getDefaultRoundOneConfig() {
    return (
      CONSTANTS.DEFAULT_SETTINGS?.platforms?.dataBaker?.scripts?.roundOneQuality || {
        id: CONSTANTS.DATA_BAKER_ROUND_ONE_QUALITY_SCRIPT_ID || "dataBakerRoundOneQuality",
        enabled: true,
        aiRecommendEnabled: true,
        aiRecommendRequestTimeoutMs: DEFAULT_AI_REQUEST_TIMEOUT_MS,
        aiRecommendPipelineMode: "two_stage",
        aiQualifiedAutofillConcurrency: 5,
        aiQualifiedAutofillWaitAllBeforeFill: false,
        aiRecommendListenModel: "qwen3.5-omni-flash",
        aiRecommendCompareModel: "qwen3.5-plus",
        aiRecommendSingleModel: "qwen3.5-omni-flash",
        autoPageSizeEnabled: true,
        defaultPageSize: "50条/页",
        shortcuts: {},
      }
    );
  }

  async function loadRuntimeConfig() {
    const storage = globalThis.ASREdgeStorage || null;
    const defaultPlatform =
      CONSTANTS.DEFAULT_SETTINGS?.platforms?.dataBaker || {
        enabled: true,
        scripts: {
          roundOneQuality: getDefaultRoundOneConfig(),
        },
      };
    let settings = null;

    if (storage && typeof storage.getSettings === "function") {
      try {
        settings = await storage.getSettings();
      } catch (error) {
        settings = null;
      }
    }

    const platform = Object.assign(
      {},
      defaultPlatform,
      settings?.platforms?.dataBaker || {}
    );
    const script = Object.assign(
      {},
      getDefaultRoundOneConfig(),
      platform?.scripts?.roundOneQuality || {}
    );
    const backendMode =
      typeof CONSTANTS.getBackendEndpointModeFromSettings === "function"
        ? CONSTANTS.getBackendEndpointModeFromSettings(settings || {})
        : String(settings?.meta?.backendEndpointMode || "").trim().toLowerCase() === BACKEND_MODE_LOCAL
          ? BACKEND_MODE_LOCAL
          : "server";
    const endpoint = normalizeEndpoint(
      typeof CONSTANTS.buildBackendUrl === "function"
        ? CONSTANTS.buildBackendUrl(DATABAKER_AI_RECOMMEND_PATH, backendMode)
        : String(
            (
              backendMode === BACKEND_MODE_LOCAL
                ? CONSTANTS.DEFAULT_BACKEND_BASE_URLS?.local
        : CONSTANTS.DEFAULT_BACKEND_BASE_URLS?.server
            ) || ""
          ).replace(/\/+$/, "") + DATABAKER_AI_RECOMMEND_PATH,
      String(CONSTANTS.DEFAULT_BACKEND_BASE_URLS?.server || "").replace(/\/+$/, "") +
        DATABAKER_AI_RECOMMEND_PATH
    );
    const timeoutMs = normalizeTimeout(script.aiRecommendRequestTimeoutMs);
    const recognitionMode = normalizePipelineMode(script.aiRecommendPipelineMode);
    const listenModel = normalizeDataBakerListenModel(
      script.aiRecommendListenModel,
      recognitionMode === "two_stage" &&
        getDataBakerModelText(script.aiRecommendListenModel) === "fun-asr"
        ? "fun-asr"
        : "qwen3.5-omni-flash"
    );
    const singleModel = normalizeDataBakerSingleModel(
      script.aiRecommendSingleModel ||
        (recognitionMode === "omni_single" ? script.aiRecommendListenModel : ""),
      "qwen3.5-omni-flash"
    );
    const pipelineMode = derivePipelineMode(
      recognitionMode,
      recognitionMode === "omni_single" ? singleModel : listenModel
    );
    const aiQualifiedAutofillConcurrencyRule = getDataBakerAiQualifiedAutofillConcurrencyRule({
      aiRecommendPipelineMode: recognitionMode,
      aiRecommendListenModel: listenModel,
      aiRecommendSingleModel: singleModel,
    });
    const aiQualifiedAutofillConcurrency = normalizeAutofillConcurrency(
      script.aiQualifiedAutofillConcurrency,
      {
        aiQualifiedAutofillConcurrencyRule,
        aiRecommendPipelineMode: recognitionMode,
        aiRecommendListenModel: listenModel,
        aiRecommendSingleModel: singleModel,
      }
    );
    const aiQualifiedAutofillWaitAllBeforeFill = normalizeAutofillWaitAll(
      script.aiQualifiedAutofillWaitAllBeforeFill
    );
    const aiAsyncJobsEnabled = script.aiAsyncJobsEnabled === true && DEFAULT_AI_ASYNC_JOBS_ENABLED === true;
    const aiRequestStaggerMs = normalizeRequestStaggerMs(
      script.aiRequestStaggerMs || CONSTANTS.DATABAKER_AI_REQUEST_STAGGER_MS
    );
    const defaultPageSize = normalizePageSize(script.defaultPageSize);
    const shortcuts = normalizeShortcuts(script.shortcuts);

    const aiOptions = {};
    const listenPrompt = normalizePromptText(script.aiRecommendListenPrompt || "");
    const comparePrompt = normalizePromptText(script.aiRecommendComparePrompt || "");
    if (listenPrompt) {
      aiOptions.listenPrompt = listenPrompt;
    }
    if (comparePrompt) {
      aiOptions.comparePrompt = comparePrompt;
    }
    const temperature = normalizeOptionalNumber(script.aiRecommendTemperature, 0, 2);
    if (Number.isFinite(temperature)) {
      aiOptions.temperature = temperature;
    }
    const topP = normalizeOptionalNumber(script.aiRecommendTopP, 0, 1);
    if (Number.isFinite(topP)) {
      aiOptions.top_p = topP;
    }
    const maxTokens = normalizeOptionalInteger(script.aiRecommendMaxTokens, 1, 8192);
    if (Number.isFinite(maxTokens)) {
      aiOptions.max_tokens = maxTokens;
    }
    const maxCompletionTokens = normalizeOptionalInteger(
      script.aiRecommendMaxCompletionTokens,
      1,
      8192
    );
    if (Number.isFinite(maxCompletionTokens)) {
      aiOptions.max_completion_tokens = maxCompletionTokens;
    }
    const presencePenalty = normalizeOptionalNumber(script.aiRecommendPresencePenalty, -2, 2);
    if (Number.isFinite(presencePenalty)) {
      aiOptions.presence_penalty = presencePenalty;
    }
    const frequencyPenalty = normalizeOptionalNumber(script.aiRecommendFrequencyPenalty, -2, 2);
    if (Number.isFinite(frequencyPenalty)) {
      aiOptions.frequency_penalty = frequencyPenalty;
    }
    const seed = normalizeOptionalInteger(script.aiRecommendSeed, 0, 2147483647);
    if (Number.isFinite(seed)) {
      aiOptions.seed = seed;
    }
    const stop = String(script.aiRecommendStopSequences || "")
      .split(/\r?\n/)
      .map(function (item) {
        return String(item || "").trim().slice(0, 80);
      })
      .filter(Boolean)
      .slice(0, 8);
    if (stop.length > 0) {
      aiOptions.stop = stop;
    }
    const compareModel =
      recognitionMode === "two_stage"
        ? normalizeDataBakerCompareModel(script.aiRecommendCompareModel)
        : "";
    aiOptions.listenModel = recognitionMode === "omni_single" ? singleModel : listenModel;
    aiOptions.compareModel = compareModel;
    aiOptions.singleModel = singleModel;
    aiOptions.omniModel = singleModel;
    aiOptions.enable_thinking = script.aiRecommendEnableThinking === true;

    return {
      scriptEnabled: platform.enabled !== false && script.enabled !== false,
      aiRecommendEnabled: script.aiRecommendEnabled !== false,
      autoPageSizeEnabled: script.autoPageSizeEnabled !== false,
      defaultPageSize,
      shortcuts,
      endpoint,
      timeoutMs,
      recognitionMode,
      pipelineMode,
      aiQualifiedAutofillConcurrency,
      aiQualifiedAutofillConcurrencyRule,
      aiQualifiedAutofillModelType: String(aiQualifiedAutofillConcurrencyRule.modelType || "omni"),
      aiQualifiedAutofillWaitAllBeforeFill,
      aiAsyncJobsEnabled,
      aiRequestStaggerMs,
      listenModel: recognitionMode === "omni_single" ? singleModel : listenModel,
      compareModel,
      singleModel: singleModel,
      enableThinking: script.aiRecommendEnableThinking === true,
      aiOptions,
      settings: settings || {},
      key: [
        platform.enabled !== false ? "1" : "0",
        script.enabled !== false ? "1" : "0",
        script.aiRecommendEnabled !== false ? "1" : "0",
        script.autoPageSizeEnabled !== false ? "1" : "0",
        defaultPageSize,
        endpoint,
        String(timeoutMs),
        recognitionMode,
        pipelineMode,
        String(aiQualifiedAutofillConcurrency),
        aiQualifiedAutofillWaitAllBeforeFill ? "1" : "0",
        aiAsyncJobsEnabled ? "1" : "0",
        String(aiRequestStaggerMs),
        listenModel,
        normalizeDataBakerCompareModel(script.aiRecommendCompareModel),
        singleModel,
        script.aiRecommendEnableThinking === true ? "1" : "0",
        JSON.stringify(aiOptions),
        JSON.stringify(shortcuts),
      ].join("|"),
    };
  }

  function createRuntime(config) {
    const dataApiFactory = globalThis.__ASREdgeDataBakerRoundOneDataApi;
    const aiFactory = globalThis.__ASREdgeDataBakerRoundOneAiRecommendation;
    const uiFactory = globalThis.__ASREdgeDataBakerRoundOneUiPanel;
    const pageSizeFactory = globalThis.__ASREdgeDataBakerRoundOnePageSizeController;
    const shortcutsFactory = globalThis.__ASREdgeDataBakerRoundOneShortcuts;

    if (!dataApiFactory || !aiFactory || !uiFactory) {
      return null;
    }

    const dataApi = dataApiFactory.createRuntime();
    const ai = aiFactory.createRuntime({
      endpoint: config.endpoint,
      timeoutMs: config.timeoutMs,
      settings: config.settings || {},
      recognitionMode: config.recognitionMode,
      pipelineMode: config.pipelineMode,
      listenModel: config.listenModel,
      compareModel: config.compareModel,
      singleModel: config.singleModel,
      enableThinking: config.enableThinking === true,
      aiOptions: config.aiOptions || {},
    });
    const processedQualifiedItemIds = new Set();
    const batchLockOwnerId =
      "data-baker-runtime-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
    let batchQualifiedAutofillRunning = false;
    let batchQualifiedAutofillCancelRequested = false;
    let batchAutofillPhase = "idle";
    let currentBatchFailures = [];
    let currentRetryableFillFailures = [];
    let lastBatchSummary = null;
    let batchLockHeartbeatTimer = null;
    let activeBatchRunId = "";
    let activeBatchRequestStream = null;
    let lastBatchToggleAt = 0;
    let batchStartedAtMs = 0;
    let batchElapsedTimer = null;
    const aiDisplayMeta = buildAiDisplayMeta(config);

    function getRecordProcessKey(record) {
      const id = String(record?.id || "").trim();
      if (id) {
        return "id:" + id;
      }
      const sentenceNumber = Number(record?.sentenceNumber);
      if (Number.isFinite(sentenceNumber)) {
        return "sentence:" + String(sentenceNumber);
      }
      const index = Number(record?.__index);
      if (Number.isFinite(index)) {
        return "index:" + String(index);
      }
      return "";
    }

    function createBatchRunId() {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      const hh = String(now.getHours()).padStart(2, "0");
      const mi = String(now.getMinutes()).padStart(2, "0");
      const ss = String(now.getSeconds()).padStart(2, "0");
      const suffix = Math.random().toString(36).slice(2, 8);
      return "data-baker-batch-" + yyyy + mm + dd + "-" + hh + mi + ss + "-" + suffix;
    }

    function createClientRequestId(batchRunId, batchItemIndex) {
      return (
        String(batchRunId || "data-baker-batch") +
        "-" +
        String(batchItemIndex || 0) +
        "-" +
        Math.random().toString(36).slice(2, 7)
      );
    }

    function readPageBatchLock() {
      const lock = window[BATCH_LOCK_KEY];
      return lock && typeof lock === "object" ? lock : null;
    }

    function clearPageBatchLockHeartbeat() {
      if (batchLockHeartbeatTimer) {
        window.clearInterval(batchLockHeartbeatTimer);
        batchLockHeartbeatTimer = null;
      }
    }

    function writePageBatchLock(lock) {
      if (lock && typeof lock === "object") {
        window[BATCH_LOCK_KEY] = Object.assign({}, lock);
        return;
      }
      try {
        delete window[BATCH_LOCK_KEY];
      } catch (error) {
        window[BATCH_LOCK_KEY] = null;
      }
    }

    function refreshPageBatchLockHeartbeat(batchRunId) {
      const existing = readPageBatchLock();
      if (!existing || existing.ownerId !== batchLockOwnerId) {
        return;
      }
      if (batchRunId && String(existing.batchRunId || "") !== String(batchRunId || "")) {
        return;
      }
      writePageBatchLock({
        ownerId: batchLockOwnerId,
        batchRunId: String(existing.batchRunId || batchRunId || ""),
        startedAt: Number(existing.startedAt) || Date.now(),
        lastHeartbeatAt: Date.now(),
      });
    }

    function tryAcquirePageBatchLock(batchRunId) {
      const now = Date.now();
      const existing = readPageBatchLock();
      const existingHeartbeatAt = Math.max(
        0,
        Number(existing?.lastHeartbeatAt) || Number(existing?.startedAt) || 0
      );
      const isFresh =
        existing && existingHeartbeatAt > 0 && now - existingHeartbeatAt < BATCH_LOCK_STALE_MS;
      if (existing && existing.ownerId !== batchLockOwnerId && isFresh) {
        return {
          ok: false,
          message: "当前页面已有 AI连续填入任务运行，请先停止或刷新页面后重试。",
        };
      }
      if (existing && existing.ownerId !== batchLockOwnerId && !isFresh) {
        console.warn("[DataBaker][batch] stale page lock overwritten", {
          previousOwnerId: String(existing.ownerId || ""),
          previousBatchRunId: String(existing.batchRunId || ""),
          lastHeartbeatAt: existingHeartbeatAt,
        });
      }
      activeBatchRunId = String(batchRunId || "");
      writePageBatchLock({
        ownerId: batchLockOwnerId,
        batchRunId: activeBatchRunId,
        startedAt: now,
        lastHeartbeatAt: now,
      });
      clearPageBatchLockHeartbeat();
      batchLockHeartbeatTimer = window.setInterval(function () {
        refreshPageBatchLockHeartbeat(activeBatchRunId);
      }, BATCH_LOCK_HEARTBEAT_MS);
      return { ok: true };
    }

    function releasePageBatchLock(batchRunId) {
      clearPageBatchLockHeartbeat();
      const existing = readPageBatchLock();
      if (!existing) {
        if (!batchRunId || String(batchRunId) === String(activeBatchRunId || "")) {
          activeBatchRunId = "";
        }
        return;
      }
      const matchesOwner = existing.ownerId === batchLockOwnerId;
      const matchesBatch = !batchRunId || String(existing.batchRunId || "") === String(batchRunId || "");
      if (matchesOwner && matchesBatch) {
        writePageBatchLock(null);
      }
      if (!batchRunId || String(batchRunId || "") === String(activeBatchRunId || "")) {
        activeBatchRunId = "";
      }
    }

    function dedupeBatchTasks(tasks, batchRunId) {
      const source = Array.isArray(tasks) ? tasks : [];
      const seen = new Set();
      const uniqueTasks = [];
      let duplicateSkippedCount = 0;
      source.forEach(function (task, index) {
        const processKey = String(task?.processKey || getRecordProcessKey(task?.record) || "").trim();
        const normalizedProcessKey = processKey || "fallback-index:" + String(index);
        if (seen.has(normalizedProcessKey)) {
          duplicateSkippedCount += 1;
          console.warn("[DataBaker][batch] duplicate task skipped", {
            batchRunId: String(batchRunId || ""),
            processKey: normalizedProcessKey,
            displayName: String(task?.displayName || ""),
          });
          return;
        }
        seen.add(normalizedProcessKey);
        uniqueTasks.push(
          Object.assign({}, task || {}, {
            processKey: normalizedProcessKey,
          })
        );
      });
      return {
        uniqueTasks,
        duplicateSkippedCount,
      };
    }

    function attachBatchRequestMeta(tasks, batchRunId) {
      const source = Array.isArray(tasks) ? tasks : [];
      return source.map(function (task, index) {
        const batchItemIndex = index + 1;
        const batchProcessKey = String(task?.processKey || getRecordProcessKey(task?.record) || "").trim();
        const clientRequestId = createClientRequestId(batchRunId, batchItemIndex);
        const item = Object.assign({}, task?.item || {}, {
          batchRunId: String(batchRunId || ""),
          batchItemIndex,
          batchProcessKey,
          clientRequestId,
        });
        return Object.assign({}, task || {}, {
          batchRunId: String(batchRunId || ""),
          batchItemIndex,
          batchProcessKey,
          clientRequestId,
          item,
        });
      });
    }

    function waitBetweenBatchItems() {
      const delayMs = 300 + Math.floor(Math.random() * 500);
      return new Promise(function (resolve) {
        window.setTimeout(resolve, delayMs);
      });
    }

    function setBatchButtonState(isRunning, isStopping) {
      if (typeof ui.setBatchAutofillPhase === "function") {
        ui.setBatchAutofillPhase(batchAutofillPhase);
      }
      if (typeof ui.setBatchAutofillRunning === "function") {
        ui.setBatchAutofillRunning(isRunning === true);
      }
      if (typeof ui.setBatchAutofillStopping === "function") {
        ui.setBatchAutofillStopping(isStopping === true);
      }
    }

    function getBatchElapsedMs() {
      if (batchStartedAtMs > 0) {
        return Math.max(0, Date.now() - batchStartedAtMs);
      }
      return Math.max(0, Number(lastBatchSummary?.elapsedMs) || 0);
    }

    function stopBatchElapsedTimer() {
      if (batchElapsedTimer) {
        window.clearInterval(batchElapsedTimer);
        batchElapsedTimer = null;
      }
    }

    function startBatchElapsedTimer() {
      stopBatchElapsedTimer();
      if (batchStartedAtMs <= 0) {
        return;
      }
      batchElapsedTimer = window.setInterval(function () {
        if (!batchQualifiedAutofillRunning || batchStartedAtMs <= 0) {
          stopBatchElapsedTimer();
          return;
        }
        updateFloatingProgress({
          batchStartedAt: batchStartedAtMs,
          elapsedMs: Date.now() - batchStartedAtMs,
        });
      }, 1000);
    }

    function buildFloatingSnapshot(extra) {
      const summary = Object.assign(
        {
          phase: batchAutofillPhase || "idle",
          running: batchQualifiedAutofillRunning,
          stopping: batchQualifiedAutofillCancelRequested,
          batchStartedAt: batchStartedAtMs || 0,
          elapsedMs: getBatchElapsedMs(),
          recognitionMode: String(config.recognitionMode || ""),
          listenModel: String(config.listenModel || ""),
          compareModel: String(config.compareModel || ""),
          singleModel: String(config.singleModel || ""),
          aiPipelineDisplayName: aiDisplayMeta.aiPipelineDisplayName,
          aiModelDisplayName: aiDisplayMeta.aiModelDisplayName,
          concurrencyRuleText: aiDisplayMeta.concurrencyRuleText,
          concurrencyModelType: aiDisplayMeta.concurrencyModelType,
          frontConcurrency: normalizeAutofillConcurrency(config.aiQualifiedAutofillConcurrency, config),
          totalCount: 0,
          launchedCount: 0,
          activeAiCount: 0,
          completedAiCount: 0,
          plannedSendCount: Math.max(0, Number(extra?.plannedSendCount ?? lastBatchSummary?.plannedSendCount ?? lastBatchSummary?.totalCount ?? 0) || 0),
          requestStaggerMs: normalizeRequestStaggerMs(config.aiRequestStaggerMs),
          analysisSuccessCount: 0,
          analysisFailCount: 0,
          queueCount: 0,
          fillStartedCount: 0,
          fillSuccessCount: 0,
          fillFailCount: 0,
          fillSkipCount: 0,
          currentDisplayName: "",
          failures: currentBatchFailures.slice(),
          retryableFailuresCount: currentRetryableFillFailures.length,
        },
        lastBatchSummary || {},
        extra || {}
      );
      lastBatchSummary = summary;
      return summary;
    }

    function updateFloatingProgress(extra) {
      if (typeof ui.updateBatchFloatingProgress !== "function") {
        return;
      }
      ui.updateBatchFloatingProgress(buildFloatingSnapshot(extra));
    }

    function finishFloatingProgress(extra) {
      if (typeof ui.finishBatchFloatingProgress !== "function") {
        return;
      }
      const finalElapsedMs = Math.max(0, Number(extra?.elapsedMs) || getBatchElapsedMs());
      stopBatchElapsedTimer();
      const finalSummary = buildFloatingSnapshot(
        Object.assign(
          {
            running: false,
            autoHideMs: 60000,
            batchStartedAt: batchStartedAtMs || 0,
            elapsedMs: finalElapsedMs,
          },
          extra || {}
        )
      );
      ui.finishBatchFloatingProgress(finalSummary);
    }

    function pushBatchFailure(entry) {
      const failure = Object.assign(
        {
          type: "unknown",
          retryable: false,
          displayName: "未命名条目",
          errorMessage: "",
          errorCode: "",
          requestId: "",
          jobId: "",
          hasRawAiDebug: false,
          debugId: "",
          rawAiDebug: null,
          hasDebugRawJson: false,
          debugRawJson: null,
          result: null,
        },
        entry || {}
      );
      currentBatchFailures.push(failure);
      if (failure.retryable && failure.type === "fill_failed" && failure.result?.recommendation) {
        currentRetryableFillFailures.push(failure);
      }
    }

    async function stopBatchQualifiedAutofill() {
      if (!batchQualifiedAutofillRunning) {
        ui.setStatus("当前没有正在运行的连续填入任务。", "info");
        return { ok: false, message: "not-running" };
      }
      batchQualifiedAutofillCancelRequested = true;
      if (activeBatchRequestStream?.cancelPending) {
        activeBatchRequestStream.cancelPending("连续填入已手动停止。");
      }
      setBatchButtonState(true, true);
      ui.setStatus("连续填入停止中，详情见顶部统计悬浮窗。", "info");
      updateFloatingProgress({
        stopping: true,
        running: true,
      });
      return { ok: true, message: "stop-requested" };
    }

    async function fillOneAnalyzedResult(result, fillIndex, totalCount) {
      const record = result?.record || null;
      const displayName = String(result?.displayName || "未命名条目");

      if (typeof dataApi.isRecordQualified === "function" && !dataApi.isRecordQualified(record)) {
        return {
          outcome: "skip",
          failureType: "skipped",
          errorMessage: "当前状态不是质检合格。",
          retryable: false,
          result: result,
          displayName,
        };
      }

      const selected = await dataApi.selectRecord(record);
      if (!selected?.ok) {
        return {
          outcome: "fail",
          failureType: "fill_failed",
          errorMessage: "选中失败：" + (selected?.message || "未知错误"),
          retryable: true,
          result: result,
          displayName,
        };
      }

      const ready = await dataApi.waitForPageTextReady(record, 3000);
      if (!ready?.ok) {
        return {
          outcome: "fail",
          failureType: "fill_failed",
          errorMessage: "页面文本同步失败：" + (ready?.message || "超时"),
          retryable: true,
          result: result,
          displayName,
        };
      }

      const recommendation =
        result?.recommendation && typeof result.recommendation === "object"
          ? result.recommendation
          : null;
      const recommendedText = String(recommendation?.recommendedText || "").trim();
      if (!recommendedText) {
        return {
          outcome: "fail",
          failureType: "fill_failed",
          errorMessage: "推荐文本为空。",
          retryable: true,
          result: result,
          displayName,
        };
      }

      ui.renderResult(recommendation);
      const fillResult = dataApi.fillPageText(recommendedText);
      if (fillResult?.ok === false) {
        return {
          outcome: "fail",
          failureType: "fill_failed",
          errorMessage: "填入失败：" + (fillResult?.message || "未知错误"),
          retryable: true,
          result: result,
          displayName,
        };
      }

      const processKey = String(result?.processKey || "");
      if (processKey) {
        processedQualifiedItemIds.add(processKey);
      }
      return {
        outcome: "success",
        failureType: "",
        errorMessage: "",
        retryable: false,
        result: result,
        displayName,
      };
    }

    async function runConcurrentAiAndSequentialFill(tasks, concurrency, batchContext) {
      if (
        !concurrentRequestStreamFactory ||
        typeof concurrentRequestStreamFactory.createConcurrentAiRequestStream !== "function"
      ) {
        throw new Error("共享并发 AI 请求流未加载。");
      }

      const sourceTasks = Array.isArray(tasks) ? tasks : [];
      const context = batchContext && typeof batchContext === "object" ? batchContext : {};
      const totalCount = Math.max(0, Number(context.totalCount) || sourceTasks.length);
      const uniqueTaskCount = Math.max(0, Number(context.uniqueTaskCount) || sourceTasks.length);
      const duplicateSkippedCount = Math.max(0, Number(context.duplicateSkippedCount) || 0);
      const batchRunId = String(
        context.batchRunId || sourceTasks[0]?.batchRunId || sourceTasks[0]?.item?.batchRunId || ""
      ).trim();
      const maxConcurrency = normalizeAutofillConcurrency(concurrency, {
        aiQualifiedAutofillConcurrencyRule:
          context.aiQualifiedAutofillConcurrencyRule || context.concurrencyRule || null,
      });
      const requestStaggerMs = normalizeRequestStaggerMs(context.requestStaggerMs);
      const plannedSendCount = uniqueTaskCount;
      let requestStream = null;
      let fillStartedCount = 0;
      let fillSuccessCount = 0;
      let fillFailCount = 0;
      let fillSkipCount = 0;
      const batchSummaryAccumulator = createBatchSummaryAccumulator();

      function updateProgressStatus(currentDisplayName) {
        if (!requestStream) {
          return;
        }
        const snapshot = requestStream.getSnapshot();
        updateFloatingProgress({
          phase: batchAutofillPhase,
          running: true,
          stopping: batchQualifiedAutofillCancelRequested === true,
          batchRunId,
          totalCount,
          uniqueTaskCount,
          duplicateSkippedCount,
          plannedSendCount,
          requestStaggerMs,
          frontConcurrency: maxConcurrency,
          launchedCount: snapshot.launchedCount,
          activeAiCount: snapshot.activeAiCount,
          completedAiCount: snapshot.completedAiCount,
          analysisSuccessCount: snapshot.succeededCount,
          analysisFailCount: snapshot.failedCount,
          queueCount: snapshot.bufferedCount,
          fillStartedCount,
          fillSuccessCount,
          fillFailCount,
          fillSkipCount,
          currentDisplayName: String(currentDisplayName || ""),
          failures: currentBatchFailures.slice(),
          retryableFailuresCount: currentRetryableFillFailures.length,
          ...batchSummaryAccumulator.getSnapshot(),
        });
      }

      requestStream = concurrentRequestStreamFactory.createConcurrentAiRequestStream({
        tasks: sourceTasks,
        concurrency: maxConcurrency,
        staggerMs: requestStaggerMs,
        onStateChange: function () {
          updateProgressStatus("");
        },
        runTask: function (task, index) {
          const batchItemIndex = Number(task?.batchItemIndex) || index + 1;
          const batchProcessKey = String(task?.batchProcessKey || task?.processKey || "");
          const clientRequestId = String(task?.clientRequestId || task?.item?.clientRequestId || "");
          console.info("[DataBaker][batch] launch ai request", {
            batchRunId,
            batchItemIndex,
            batchProcessKey,
            clientRequestId,
            displayName: String(task?.displayName || ""),
            frontConcurrency: maxConcurrency,
            requestStaggerMs,
          });
          return ai.recommend(
            Object.assign({}, task.item || {}, {
              frontConcurrency: maxConcurrency,
              batchConcurrency: maxConcurrency,
              concurrencyModelType: String(
                context.concurrencyModelType || context.aiQualifiedAutofillModelType || "omni"
              ),
            })
          );
        },
      });
      activeBatchRequestStream = requestStream;

      async function fillLoop() {
        while (true) {
          if (batchQualifiedAutofillCancelRequested === true) {
            break;
          }

          const streamEntry = await requestStream.nextResult();
          if (!streamEntry) {
            break;
          }

          const task = streamEntry.task;
          const batchItemIndex = Number(task?.batchItemIndex) || Number(streamEntry.index || 0) + 1;
          const batchProcessKey = String(task?.batchProcessKey || task?.processKey || "");
          const clientRequestId = String(task?.clientRequestId || task?.item?.clientRequestId || "");
          const result = streamEntry.ok
            ? {
                ok: true,
                index: streamEntry.index,
                record: task?.record,
                item: task?.item,
                recommendation: streamEntry.value,
                processKey: task?.processKey,
                batchRunId,
                batchItemIndex,
                batchProcessKey,
                clientRequestId,
                displayName: task?.displayName,
                completedAt: streamEntry.completedAt,
              }
            : {
                ok: false,
                index: streamEntry.index,
                record: task?.record,
                item: task?.item,
                processKey: task?.processKey,
                batchRunId,
                batchItemIndex,
                batchProcessKey,
                clientRequestId,
                displayName: task?.displayName,
                errorMessage: streamEntry.error?.message || String(streamEntry.error),
                errorCode: String(streamEntry.error?.code || ""),
                requestId: String(streamEntry.error?.requestId || ""),
                jobId: String(streamEntry.error?.jobId || ""),
                hasRawAiDebug: streamEntry.error?.hasRawAiDebug === true,
                debugId: String(streamEntry.error?.debugId || ""),
                rawAiDebug:
                  streamEntry.error?.rawAiDebug && typeof streamEntry.error.rawAiDebug === "object"
                    ? streamEntry.error.rawAiDebug
                    : null,
                hasDebugRawJson: streamEntry.error?.hasDebugRawJson === true,
                debugRawJson:
                  streamEntry.error?.debugRawJson &&
                  typeof streamEntry.error.debugRawJson === "object"
                    ? streamEntry.error.debugRawJson
                    : null,
                completedAt: streamEntry.completedAt,
              };
          if (batchQualifiedAutofillCancelRequested === true) {
            break;
          }

          batchAutofillPhase = "fill";
          setBatchButtonState(true, batchQualifiedAutofillCancelRequested === true);
          if (!result?.ok) {
            pushBatchFailure({
              type: "ai_failed",
              retryable: false,
              displayName: String(result?.displayName || "未命名条目"),
              errorMessage: String(result?.errorMessage || "AI 推荐失败"),
              errorCode: String(result?.errorCode || ""),
              requestId: String(result?.requestId || ""),
              jobId: String(result?.jobId || ""),
              hasRawAiDebug: result?.hasRawAiDebug === true,
              debugId: String(result?.debugId || ""),
              rawAiDebug:
                result?.rawAiDebug && typeof result.rawAiDebug === "object"
                  ? result.rawAiDebug
                  : null,
              hasDebugRawJson: result?.hasDebugRawJson === true,
              debugRawJson:
                result?.debugRawJson && typeof result.debugRawJson === "object"
                  ? result.debugRawJson
                  : null,
              result: null,
            });
          } else {
            batchSummaryAccumulator.addResult(result.recommendation);
            fillStartedCount += 1;
            updateProgressStatus(String(result?.displayName || ""));
            const fillOutcome = await fillOneAnalyzedResult(
              result,
              fillStartedCount - 1,
              totalCount
            );
            if (fillOutcome.outcome === "success") {
              fillSuccessCount += 1;
            } else if (fillOutcome.outcome === "skip") {
              fillSkipCount += 1;
              pushBatchFailure({
                type: "skipped",
                retryable: false,
                displayName: fillOutcome.displayName,
                errorMessage: fillOutcome.errorMessage,
                result: null,
              });
            } else {
              fillFailCount += 1;
              pushBatchFailure({
                type: fillOutcome.failureType || "fill_failed",
                retryable: fillOutcome.retryable === true,
                displayName: fillOutcome.displayName,
                errorMessage: fillOutcome.errorMessage,
                result: fillOutcome.result || null,
              });
            }
          }

          updateProgressStatus(String(result?.displayName || ""));
          if (
            !batchQualifiedAutofillCancelRequested &&
            (requestStream.getSnapshot().producersDone !== true ||
              requestStream.getSnapshot().bufferedCount > 0)
          ) {
            await waitBetweenBatchItems();
          }
        }
      }

      await fillLoop();
      await requestStream.whenProducersDone;
      const finalSnapshot = requestStream.getSnapshot();

      return {
        batchRunId,
        totalCount,
        uniqueTaskCount,
        duplicateSkippedCount,
        plannedSendCount,
        requestStaggerMs,
        frontConcurrency: maxConcurrency,
        launchedCount: finalSnapshot.launchedCount,
        activeAiCount: finalSnapshot.activeAiCount,
        completedAiCount: finalSnapshot.completedAiCount,
        analysisSuccessCount: finalSnapshot.succeededCount,
        analysisFailCount: finalSnapshot.failedCount,
        fillStartedCount,
        fillSuccessCount,
        fillFailCount,
        fillSkipCount,
        bufferedCount: finalSnapshot.bufferedCount,
        failures: currentBatchFailures.slice(),
        retryableFailuresCount: currentRetryableFillFailures.length,
        stopped: batchQualifiedAutofillCancelRequested === true,
        ...batchSummaryAccumulator.getSnapshot(),
      };
    }

    async function retryFailedFillResults() {

      if (batchQualifiedAutofillRunning) {
        ui.setStatus("连续填入运行中，请先停止或等待完成后再重试失败项。", "info");
        return { ok: false, message: "batch-running" };
      }
      const retryTargets = currentRetryableFillFailures.slice();
      if (retryTargets.length <= 0) {
        ui.setStatus("当前没有可重试的填入失败项。", "info");
        return { ok: false, message: "no-retry-target" };
      }

      batchAutofillPhase = "retry";
      batchQualifiedAutofillRunning = true;
      batchQualifiedAutofillCancelRequested = false;
      batchStartedAtMs = Date.now();
      startBatchElapsedTimer();
      setBatchButtonState(true, false);
      ui.setStatus("正在重试填写失败内容，详情见顶部统计悬浮窗。", "info");
      updateFloatingProgress({
        phase: "retry",
        running: true,
        stopping: false,
        batchStartedAt: batchStartedAtMs,
        elapsedMs: 0,
      });

      let retrySuccessCount = 0;
      let retryFailCount = 0;
      const nextRetryableFailures = [];
      try {
        for (let index = 0; index < retryTargets.length; index += 1) {
          if (batchQualifiedAutofillCancelRequested === true) {
            nextRetryableFailures.push.apply(nextRetryableFailures, retryTargets.slice(index));
            break;
          }
          const failure = retryTargets[index];
          const result = failure?.result || null;
          if (!result?.recommendation) {
            retryFailCount += 1;
            nextRetryableFailures.push(failure);
            continue;
          }
          updateFloatingProgress({
            phase: "retry",
            currentDisplayName: String(failure.displayName || ""),
            queueCount: 0,
          });
          const retryOutcome = await fillOneAnalyzedResult(result, index, retryTargets.length);
          if (retryOutcome.outcome === "success") {
            retrySuccessCount += 1;
          } else {
            retryFailCount += 1;
            nextRetryableFailures.push({
              type: "fill_failed",
              retryable: true,
              displayName: retryOutcome.displayName || failure.displayName,
              errorMessage: retryOutcome.errorMessage || "重试填入失败",
              result: result,
            });
          }
          if (index < retryTargets.length - 1) {
            await waitBetweenBatchItems();
          }
        }

        currentRetryableFillFailures = nextRetryableFailures;
        currentBatchFailures = currentBatchFailures.filter(function (failure) {
          return !(failure.type === "fill_failed" && failure.retryable === true);
        });
        currentBatchFailures.push.apply(currentBatchFailures, nextRetryableFailures);
        ui.setStatus(
          "失败项重试完成：成功 " +
            String(retrySuccessCount) +
            " 条，失败 " +
            String(retryFailCount) +
            " 条。",
          retryFailCount > 0 ? "info" : "success"
        );
        finishFloatingProgress({
          phase: batchQualifiedAutofillCancelRequested ? "stopped" : "completed",
          failures: currentBatchFailures.slice(),
          retryableFailuresCount: currentRetryableFillFailures.length,
        });
        return { ok: true };
      } finally {
        stopBatchElapsedTimer();
        batchStartedAtMs = 0;
        batchQualifiedAutofillRunning = false;
        batchQualifiedAutofillCancelRequested = false;
        batchAutofillPhase = "idle";
        setBatchButtonState(false, false);
      }
    }

    async function loadFailureDebugJson(failure) {
      const source = failure && typeof failure === "object" ? failure : {};
      if (source.rawAiDebug && typeof source.rawAiDebug === "object") {
        return source.rawAiDebug;
      }
      if (source.debugRawJson && typeof source.debugRawJson === "object") {
        return source.debugRawJson;
      }
      const debugId = String(source.debugId || "").trim();
      if (debugId) {
        if (!ai || typeof ai.getRawAiDebug !== "function") {
          throw new Error("当前失败项没有可查看的原始AI返回。");
        }
        return ai.getRawAiDebug(debugId);
      }
      const jobId = String(source.jobId || "").trim();
      if (!jobId) {
        throw new Error("当前失败项没有可查看的原始AI返回。");
      }
      const recommendEndpoint = String(config.endpoint || "").trim();
      if (!recommendEndpoint) {
        throw new Error("当前失败项没有可查看的原始AI返回。");
      }
      const controller = typeof AbortController === "function" ? new AbortController() : null;
      const timer = controller
        ? window.setTimeout(function () {
            controller.abort();
          }, Math.max(1000, Math.min(30000, Number(config.timeoutMs) || DEFAULT_AI_REQUEST_TIMEOUT_MS)))
        : null;
      try {
        const response = await fetch(
          recommendEndpoint.replace(/\/+$/, "") + "/jobs/" + encodeURIComponent(jobId) + "/debug",
          {
            method: "GET",
            signal: controller ? controller.signal : undefined,
          }
        );
        const body = await response.json().catch(function () {
          return null;
        });
        if (!response.ok || body?.success !== true || !body?.debug) {
          throw new Error(
            String(body?.message || "").trim() || "当前失败项没有可查看的原始AI返回。"
          );
        }
        return body.debug;
      } catch (error) {
        if (error?.name === "AbortError") {
          throw new Error("获取原始 JSON 超时，请稍后重试。");
        }
        if (error instanceof TypeError) {
          throw new Error("后端连接中断，请稍后重试。");
        }
        throw error;
      } finally {
        if (timer) {
          clearTimeout(timer);
        }
      }
    }

    async function autoFillQualifiedItemsBatch() {
      ui.ensureMounted();
      if (config.aiRecommendEnabled === false) {
        ui.setStatus("AI 推荐已在 DataBaker 设置中关闭。", "error");
        return { ok: false, message: "ai-disabled" };
      }
      if (batchQualifiedAutofillRunning) {
        return stopBatchQualifiedAutofill();
      }
      const now = Date.now();
      if (now - lastBatchToggleAt < BATCH_TOGGLE_DEBOUNCE_MS) {
        console.warn("[DataBaker][batch] duplicate start click ignored", {
          withinMs: now - lastBatchToggleAt,
        });
        return { ok: false, message: "start-debounced" };
      }
      lastBatchToggleAt = now;

      let batchRunId = createBatchRunId();
      const lockOutcome = tryAcquirePageBatchLock(batchRunId);
      if (!lockOutcome.ok) {
        ui.setStatus(lockOutcome.message, "error");
        return { ok: false, message: "batch-locked" };
      }

      batchAutofillPhase = "analysis";
      batchQualifiedAutofillRunning = true;
      batchQualifiedAutofillCancelRequested = false;
      currentBatchFailures = [];
      currentRetryableFillFailures = [];
      lastBatchSummary = null;
      batchStartedAtMs = Date.now();
      startBatchElapsedTimer();
      setBatchButtonState(true, false);

      try {
        ui.showBatchFloatingPanel?.();
        ui.setStatus("连续填入运行中，详情见顶部统计悬浮窗。", "info");
        updateFloatingProgress({
          phase: "fetching",
          running: true,
          stopping: false,
          batchRunId,
          batchStartedAt: batchStartedAtMs,
          elapsedMs: 0,
          requestStaggerMs: config.aiRequestStaggerMs,
        });
        const refreshed = await dataApi.refreshCurrentPageData({
          pageSize: 50,
          forcePageSize: true,
        });
        if (!refreshed?.ok) {
          const message = refreshed?.message || "刷新当前页列表失败。";
          ui.setStatus(message, "error");
          currentBatchFailures.push({
            type: "refresh_failed",
            retryable: false,
            displayName: "列表刷新",
            errorMessage: message,
            result: null,
          });
          finishFloatingProgress({
            phase: "stopped",
            running: false,
            batchRunId,
            failures: currentBatchFailures.slice(),
            retryableFailuresCount: 0,
          });
          return { ok: false, message: "refresh-failed" };
        }

        const qualifiedRecords = dataApi.getQualifiedRecords(refreshed.entry).filter(function (record) {
          const key = getRecordProcessKey(record);
          if (!key) {
            return true;
          }
          return !processedQualifiedItemIds.has(key);
        });
        if (qualifiedRecords.length <= 0) {
          ui.setStatus("当前页没有可处理的质检合格数据。", "info");
          finishFloatingProgress({
            phase: "completed",
            running: false,
            batchRunId,
            totalCount: 0,
            uniqueTaskCount: 0,
            duplicateSkippedCount: 0,
            plannedSendCount: 0,
            failures: [],
            retryableFailuresCount: 0,
          });
          return { ok: true, message: "no-qualified" };
        }

        const rawTasks = dataApi.createItemsFromQualifiedRecords(qualifiedRecords, refreshed.entry);
        const deduped = dedupeBatchTasks(rawTasks, batchRunId);
        const uniqueTasks = attachBatchRequestMeta(deduped.uniqueTasks, batchRunId);
        const duplicateSkippedCount = deduped.duplicateSkippedCount;
        const uniqueTaskCount = uniqueTasks.length;
        if (uniqueTaskCount <= 0) {
          ui.setStatus("当前页没有可处理的唯一合格项。", "info");
          finishFloatingProgress({
            phase: "completed",
            running: false,
            batchRunId,
            totalCount: qualifiedRecords.length,
            uniqueTaskCount: 0,
            duplicateSkippedCount,
            plannedSendCount: 0,
            failures: currentBatchFailures.slice(),
            retryableFailuresCount: currentRetryableFillFailures.length,
          });
          return { ok: true, message: "no-unique-qualified" };
        }

        const concurrency = normalizeAutofillConcurrency(
          config.aiQualifiedAutofillConcurrency,
          config
        );
        console.info("[DataBaker][batch] start", {
          batchRunId,
          totalCount: qualifiedRecords.length,
          uniqueTaskCount,
          duplicateSkippedCount,
          frontConcurrency: concurrency,
          requestStaggerMs: config.aiRequestStaggerMs,
          listenModel: String(config.listenModel || ""),
          compareModel: String(config.compareModel || ""),
          asyncJobMode: true,
        });
        updateFloatingProgress({
          phase: "analysis",
          running: true,
          stopping: false,
          batchRunId,
          totalCount: qualifiedRecords.length,
          uniqueTaskCount,
          duplicateSkippedCount,
          plannedSendCount: uniqueTaskCount,
          requestStaggerMs: config.aiRequestStaggerMs,
          frontConcurrency: concurrency,
          launchedCount: 0,
          activeAiCount: 0,
          completedAiCount: 0,
        });
        const streamSummary = await runConcurrentAiAndSequentialFill(uniqueTasks, concurrency, {
          batchRunId,
          totalCount: qualifiedRecords.length,
          uniqueTaskCount,
          duplicateSkippedCount,
          concurrencyRule: config.aiQualifiedAutofillConcurrencyRule,
          concurrencyModelType: config.aiQualifiedAutofillModelType,
          requestStaggerMs: config.aiRequestStaggerMs,
        });
        if (streamSummary.stopped) {
          ui.setStatus(
            "已停止：AI 已完成 " +
              String(streamSummary.completedAiCount) +
              "/" +
              String(streamSummary.uniqueTaskCount) +
              "，已填入 " +
              String(streamSummary.fillSuccessCount) +
              " 条，填入失败 " +
              String(streamSummary.fillFailCount) +
              " 条，跳过 " +
              String(streamSummary.fillSkipCount) +
              " 条，缓冲区剩余 " +
              String(streamSummary.bufferedCount) +
              " 条未填。",
            "info"
          );
          finishFloatingProgress({
            phase: "stopped",
            running: false,
            batchRunId,
            totalCount: streamSummary.totalCount,
            uniqueTaskCount: streamSummary.uniqueTaskCount,
            duplicateSkippedCount: streamSummary.duplicateSkippedCount,
            plannedSendCount: streamSummary.plannedSendCount,
            requestStaggerMs: streamSummary.requestStaggerMs,
            frontConcurrency: concurrency,
            launchedCount: streamSummary.launchedCount,
            activeAiCount: streamSummary.activeAiCount,
            completedAiCount: streamSummary.completedAiCount,
            analysisSuccessCount: streamSummary.analysisSuccessCount,
            analysisFailCount: streamSummary.analysisFailCount,
            queueCount: streamSummary.bufferedCount,
            fillStartedCount: streamSummary.fillStartedCount,
            fillSuccessCount: streamSummary.fillSuccessCount,
            fillFailCount: streamSummary.fillFailCount,
            fillSkipCount: streamSummary.fillSkipCount,
            failures: currentBatchFailures.slice(),
            retryableFailuresCount: currentRetryableFillFailures.length,
          });
          return { ok: true, message: "stopped" };
        }

        ui.setStatus(
          "当前页合格项处理完成：AI 成功 " +
            String(streamSummary.analysisSuccessCount) +
            " 条，AI 失败 " +
            String(streamSummary.analysisFailCount) +
            " 条；填入成功 " +
            String(streamSummary.fillSuccessCount) +
            " 条，填入失败 " +
            String(streamSummary.fillFailCount) +
            " 条，跳过 " +
            String(streamSummary.fillSkipCount) +
            " 条。请人工复核后保存。",
          "success"
        );
        finishFloatingProgress({
          phase: "completed",
          running: false,
          batchRunId,
          totalCount: streamSummary.totalCount,
          uniqueTaskCount: streamSummary.uniqueTaskCount,
          duplicateSkippedCount: streamSummary.duplicateSkippedCount,
          plannedSendCount: streamSummary.plannedSendCount,
          requestStaggerMs: streamSummary.requestStaggerMs,
          frontConcurrency: concurrency,
          launchedCount: streamSummary.launchedCount,
          activeAiCount: streamSummary.activeAiCount,
          completedAiCount: streamSummary.completedAiCount,
          analysisSuccessCount: streamSummary.analysisSuccessCount,
          analysisFailCount: streamSummary.analysisFailCount,
          queueCount: streamSummary.bufferedCount,
          fillStartedCount: streamSummary.fillStartedCount,
          fillSuccessCount: streamSummary.fillSuccessCount,
          fillFailCount: streamSummary.fillFailCount,
          fillSkipCount: streamSummary.fillSkipCount,
          failures: currentBatchFailures.slice(),
          retryableFailuresCount: currentRetryableFillFailures.length,
        });
        return { ok: true, message: "completed" };
      } catch (error) {
        const message = "连续处理失败：" + (error?.message || String(error));
        ui.setStatus(message, "error");
        currentBatchFailures.push({
          type: "runtime_failed",
          retryable: false,
          displayName: "连续处理",
          errorMessage: message,
          result: null,
        });
        finishFloatingProgress({
          phase: "stopped",
          running: false,
          batchRunId,
          failures: currentBatchFailures.slice(),
          retryableFailuresCount: currentRetryableFillFailures.length,
        });
        return { ok: false, message: "batch-failed" };
      } finally {
        stopBatchElapsedTimer();
        batchStartedAtMs = 0;
        releasePageBatchLock(batchRunId || activeBatchRunId);
        activeBatchRequestStream = null;
        batchQualifiedAutofillRunning = false;
        batchQualifiedAutofillCancelRequested = false;
        batchAutofillPhase = "idle";
        setBatchButtonState(false, false);
      }
    }

    const ui = uiFactory.createRuntime(
{
      canFillPageText: dataApi.canFillPageText,
      fillPageText: dataApi.fillPageText,
      onAutoFillQualifiedItemsBatch: autoFillQualifiedItemsBatch,
      onStopAutoFillQualifiedItemsBatch: stopBatchQualifiedAutofill,
      onAutoFillQualifiedItem: autoFillQualifiedItemsBatch,
      onRetryFailedQualifiedFillItems: retryFailedFillResults,
      onLoadFailureDebugJson: loadFailureDebugJson,
      onRecommend: async function () {
        const item = await dataApi.getCurrentItem();
        ui.updateCurrentItemKey(item.key);
        return ai.recommend(item);
      },
    });
    if (typeof ui.setBatchFailureRetryHandler === "function") {
      ui.setBatchFailureRetryHandler(retryFailedFillResults);
    }
    const pageSize = pageSizeFactory?.createRuntime?.({
      defaultPageSize: config.defaultPageSize,
    });
    let mountRetryCount = 0;

    function clearMountRetryTimer() {
      if (mountRetryTimer) {
        window.clearTimeout(mountRetryTimer);
        mountRetryTimer = null;
      }
    }

    function scheduleMountRetry() {
      if (mountRetryCount >= MAX_MOUNT_RETRY_COUNT || mountRetryTimer) {
        return;
      }
      mountRetryCount += 1;
      mountRetryTimer = window.setTimeout(function () {
        mountRetryTimer = null;
        refresh();
      }, MOUNT_RETRY_DELAY_MS);
    }

    function ensurePanelMounted() {
      const mountedRoot = ui.ensureMounted();
      if (mountedRoot) {
        mountRetryCount = 0;
        clearMountRetryTimer();
        return mountedRoot;
      }
      scheduleMountRetry();
      return null;
    }

    function showShortcutStatus(message, tone) {
      if (config.aiRecommendEnabled !== false) {
        ui.ensureMounted();
        ui.setStatus(message, tone);
        return;
      }
      if (typeof console !== "undefined" && typeof console.debug === "function") {
        console.debug("[DataBaker][round-one-quality][shortcut] " + String(message || ""));
      }
    }

    const shortcutActions = {
      requestAiRecommend: function () {
        if (config.aiRecommendEnabled === false) {
          showShortcutStatus("AI 推荐已在 DataBaker 设置中关闭。", "error");
          return Promise.resolve({ ok: false });
        }
        return ui.requestAiRecommend();
      },
      copyHeardText: function () {
        return ui.copyHeardText();
      },
      copyRecommendedText: function () {
        return ui.copyRecommendedText();
      },
      fillRecommendedText: function () {
        return ui.fillRecommendedText();
      },
      ignoreAiResult: function () {
        return ui.ignoreAiResult();
      },
      autoFillQualifiedItem: function () {
        return autoFillQualifiedItemsBatch();
      },
      showStatus: showShortcutStatus,
    };
    const shortcuts = shortcutsFactory?.createRuntime?.({
      shortcuts: config.shortcuts,
      actions: shortcutActions,
    });

    function refresh() {
      if (!dataApiFactory.isRoundOneCollectPage()) {
        return;
      }
      if (config.aiRecommendEnabled !== false) {
        ensurePanelMounted();
      } else {
        clearMountRetryTimer();
        mountRetryCount = 0;
        ui.remove();
      }
      if (config.autoPageSizeEnabled !== false) {
        pageSize?.refresh?.({
          defaultPageSize: config.defaultPageSize,
        });
      }
      shortcuts?.refresh?.({
        shortcuts: config.shortcuts,
        actions: shortcutActions,
      });
      dataApi
        .getCurrentItem({ allowFetch: false })
        .then(function (item) {
          ui.updateCurrentItemKey(item.key);
        })
        .catch(function () {
          // Keep UI available; click handler will show actionable error.
        });
    }

    function start() {
      dataApi.start();
      if (config.aiRecommendEnabled !== false) {
        ensurePanelMounted();
        void ai.notifyLexiconWarning?.();
      }
      if (config.autoPageSizeEnabled !== false) {
        pageSize?.start?.();
      }
      shortcuts?.start?.();
      observer = new MutationObserver(function () {
        window.clearTimeout(pageTimer);
        pageTimer = window.setTimeout(refresh, 150);
      });
      observer.observe(document.documentElement || document.body, {
        childList: true,
        subtree: true,
      });
      refresh();
    }

    function stop() {
      stopBatchElapsedTimer();
      batchStartedAtMs = 0;
      clearMountRetryTimer();
      mountRetryCount = 0;
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      if (pageTimer) {
        window.clearTimeout(pageTimer);
        pageTimer = null;
      }
      dataApi.stop();
      pageSize?.stop?.();
      shortcuts?.stop?.();
      ui.remove();
    }

    return {
      refresh,
      start,
      stop,
    };
  }

  function shouldRun() {
    const dataApiFactory = globalThis.__ASREdgeDataBakerRoundOneDataApi;
    return Boolean(dataApiFactory?.isRoundOneCollectPage?.());
  }

  function stopRuntime() {
    if (runtime) {
      runtime.stop();
      runtime = null;
      runtimeConfigKey = "";
    }
  }

  async function evaluatePage() {
    if (evaluating) {
      pendingEvaluate = true;
      return;
    }

    evaluating = true;
    try {
      if (!shouldRun()) {
        stopRuntime();
        return;
      }

      const config = await loadRuntimeConfig();
      if (!config.scriptEnabled) {
        stopRuntime();
        return;
      }

      if (runtime && runtimeConfigKey !== config.key) {
        stopRuntime();
      }

      if (!runtime) {
        runtime = createRuntime(config);
        if (runtime) {
          runtimeConfigKey = config.key;
          runtime.start();
        }
        return;
      }

      runtime.refresh();
    } finally {
      evaluating = false;
      if (pendingEvaluate) {
        pendingEvaluate = false;
        window.setTimeout(function () {
          void evaluatePage();
        }, 0);
      }
    }
  }

  function scheduleEvaluatePage() {
    void evaluatePage();
  }

  function installRouteWatch() {
    window.addEventListener("hashchange", scheduleEvaluatePage);
    window.addEventListener("popstate", scheduleEvaluatePage);
    window.setInterval(scheduleEvaluatePage, CHECK_INTERVAL_MS);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleEvaluatePage, { once: true });
  } else {
    scheduleEvaluatePage();
  }
  installRouteWatch();
})();


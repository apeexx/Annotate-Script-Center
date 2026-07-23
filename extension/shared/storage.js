/**
 * @fileoverview Shared chrome.storage helpers with legacy-settings compatibility.
 */

(function () {

  function getConstants() {
    return globalThis.ASREdgeConstants || {
      STORAGE_KEY: "asrEdgeSettings",
      DEFAULT_SETTINGS: {
        platforms: {
          alibabaLabelx: {
            enabled: true,
            scriptCenter: {
              activeProjectId: "transcription",
              projects: {},
            },
            annotation: {
              shortcuts: {},
              customReplacements: [],
              customRates: [],
            },
            automation: {},
            aiPunctuation: {},
            dictionary: {},
            safety: {},
            legacyServer: {},
            reporting: {},
          },
          lightwheel: {
            enabled: false,
            scripts: {
              viewPanel: {
                id: "lightwheelViewPanel",
                enabled: false,
              },
            },
          },
          dataBaker: {
            enabled: true,
            scripts: {
              roundOneQuality: {
                id: "dataBakerRoundOneQuality",
                enabled: true,
                aiRecommendEnabled: true,
                aiRecommendEndpoint:
                  "https://script.aisiyunling.com/api/data-baker/round-one-quality/ai/recommend",
                aiRecommendRequestTimeoutMs: DEFAULT_AI_REQUEST_TIMEOUT_MS,
                aiRecommendPipelineMode: "two_stage",
                aiQualifiedAutofillConcurrency: 5,
                aiQualifiedAutofillWaitAllBeforeFill: false,
                aiRecommendListenModel: "qwen3.5-omni-flash",
                aiRecommendCompareModel: "qwen3.5-plus",
                aiRecommendSingleModel: "qwen3.5-omni-flash",
                autoPageSizeEnabled: true,
                defaultPageSize: "50?/?",
                shortcuts: {},
              },
            },
          },
          aishellTech: {
            enabled: true,
            scripts: {
              minnanHelper: {
                id: "aishellTechMinnanAssistant",
                enabled: true,
                aiRecommendEnabled: true,
                aiRecommendEndpoint:
                  "https://script.aisiyunling.com/api/aishell-tech/minnan-helper/ai/recommend",
                aiRecommendRequestTimeoutMs: DEFAULT_AI_REQUEST_TIMEOUT_MS,
                shortcuts: {},
              },
            },
          },
          abakaAi: {
            enabled: true,
            scripts: {
              taskPageCapture: {
                id: "abakaAiTaskPageCapture",
                enabled: true,
              },
            },
          },
          haitianUtrans: {
            enabled: true,
            scripts: {
              audioDownloadHelper: {
                id: "haitianUtransAudioDownloadHelper",
                enabled: true,
              },
            },
          },
          magicData: {
            enabled: true,
            activeScriptId: "magicDataAnnotatorAiReview",
            scripts: {
              hakkaHelper: {
                id: "magicDataAnnotatorAiReview",
                enabled: true,
                aiReviewEnabled: true,
              },
              minnanHelper: {
                id: "magicDataMinnanAssistant",
                enabled: false,
                aiReviewEnabled: false,
              },
            },
          },
        },
        asr: {},
        debug: { enabled: false },
        cache: {},
        meta: {
          schemaVersion: 26,
          backendEndpointMode: "server",
          backendBaseUrls: {
            server: "https://script.aisiyunling.com",
            local: "http://127.0.0.1:3333",
          },
          aiUsageOperatorName: "",
          publicCenterPlatformOrder: [],
        },
      },
      DEFAULT_ASR_CONFIG: {},
      DEFAULT_JUDGEMENT_ASR_CONFIG: {},
      DEFAULT_LIGHTWHEEL_PLATFORM_SETTINGS: {},
      DEFAULT_AISHELL_TECH_PLATFORM_SETTINGS: {},
      DEFAULT_ABAKA_AI_PLATFORM_SETTINGS: {},
      DEFAULT_HAITIAN_UTRANS_PLATFORM_SETTINGS: {},
      SCRIPT_PROJECTS: {},
      SCRIPT_LIBRARY: {},
      TRANSCRIPTION_PROJECT_ID: "transcription",
      JUDGEMENT_PROJECT_ID: "judgement",
      LIGHTWHEEL_VIEW_PANEL_SCRIPT_ID: "lightwheelViewPanel",
      DATA_BAKER_ROUND_ONE_QUALITY_SCRIPT_ID: "dataBakerRoundOneQuality",
      MAGIC_DATA_ANNOTATOR_SCRIPT_ID: "magicDataAnnotatorAiReview",
      MAGIC_DATA_MINNAN_SCRIPT_ID: "magicDataMinnanAssistant",
      AISHELL_TECH_PLATFORM_ID: "aishellTech",
      AISHELL_TECH_MINNAN_SCRIPT_ID: "aishellTechMinnanAssistant",
      JD_TTS_ANNOTATION_PLATFORM_ID: "jdTtsAnnotation",
      JD_TTS_SHANGHAINESE_SCRIPT_ID: "jdTtsShanghaineseAssistant",
      ABAKA_AI_PLATFORM_ID: "abakaAi",
      ABAKA_AI_TASK_PAGE_CAPTURE_SCRIPT_ID: "abakaAiTaskPageCapture",
      HAITIAN_UTRANS_PLATFORM_ID: "haitianUtrans",
      HAITIAN_UTRANS_AUDIO_DOWNLOAD_HELPER_SCRIPT_ID: "haitianUtransAudioDownloadHelper",
      DATABAKER_AI_RECOMMEND_SERVER_ENDPOINT:
        "https://script.aisiyunling.com/api/data-baker/round-one-quality/ai/recommend",
      DATABAKER_AI_RECOMMEND_LOCAL_ENDPOINT:
        "http://127.0.0.1:3333/api/data-baker/round-one-quality/ai/recommend",
      AISHELL_TECH_AI_RECOMMEND_SERVER_ENDPOINT:
        "https://script.aisiyunling.com/api/aishell-tech/minnan-helper/ai/recommend",
      AISHELL_TECH_AI_RECOMMEND_LOCAL_ENDPOINT:
        "http://127.0.0.1:3333/api/aishell-tech/minnan-helper/ai/recommend",
      JD_TTS_SHANGHAINESE_AI_RECOMMEND_SERVER_ENDPOINT:
        "https://script.aisiyunling.com/api/jd-tts-annotation/shanghainese-helper/ai/recommend",
      JD_TTS_SHANGHAINESE_AI_RECOMMEND_LOCAL_ENDPOINT:
        "http://127.0.0.1:3333/api/jd-tts-annotation/shanghainese-helper/ai/recommend",
      TRANSCRIPTION_STATS_SERVER_ENDPOINT:
        "https://script.aisiyunling.com/api/alibaba-labelx/asr-transcription/statistics/upload",
      TRANSCRIPTION_STATS_LOCAL_ENDPOINT:
        "http://127.0.0.1:3333/api/alibaba-labelx/asr-transcription/statistics/upload",
      BACKEND_ENDPOINT_MODE_SERVER: "server",
      BACKEND_ENDPOINT_MODE_LOCAL: "local",
      DEFAULT_BACKEND_BASE_URLS: {
        server: "https://script.aisiyunling.com",
        local: "http://127.0.0.1:3333",
      },
      DATABAKER_PAGE_SIZE_OPTIONS: ["5?/?", "10?/?", "20?/?", "50?/?", "100?/?"],
      DATABAKER_AI_PIPELINE_MODE_OPTIONS: [
        { value: "two_stage", label: "???????? + ????" },
        { value: "omni_single", label: "????Omni ???" },
      ],
      DATABAKER_AI_LISTEN_MODEL_OPTIONS: [
        { value: "fun-asr", label: "fun-asr" },
        { value: "qwen3.5-omni-plus", label: "qwen3.5-omni-plus" },
        { value: "qwen3.5-omni-flash", label: "qwen3.5-omni-flash" },
      ],
      DATABAKER_AI_SINGLE_MODEL_OPTIONS: [
        { value: "qwen3.5-omni-plus", label: "qwen3.5-omni-plus" },
        { value: "qwen3.5-omni-flash", label: "qwen3.5-omni-flash" },
      ],
      DATABAKER_AI_OMNI_MODEL_OPTIONS: [
        { value: "qwen3.5-omni-plus", label: "qwen3.5-omni-plus" },
        { value: "qwen3.5-omni-flash", label: "qwen3.5-omni-flash" },
      ],
      DATABAKER_AI_FUN_ASR_MODEL_OPTIONS: [{ value: "fun-asr", label: "fun-asr" }],
      DATABAKER_AI_COMPARE_MODEL_OPTIONS: [
        { value: "qwen3.6-plus", label: "qwen3.6-plus" },
        { value: "qwen3.5-plus", label: "qwen3.5-plus" },
      ],
      DATABAKER_ROUND_ONE_SHORTCUT_ACTIONS: [],
      ABAKA_AI_TASK21_SHORTCUT_ACTIONS: [],
      ABAKA_AI_TASK21_AI_MODEL_OPTIONS: [],
      ABAKA_AI_TASK21_AI_ANALYSIS_MODES: [],
      ABAKA_AI_TASK21_VISION_MODEL_OPTIONS: [],
      ABAKA_AI_TASK21_OCR_MODEL_OPTIONS: [],
      ABAKA_AI_TASK21_REASONING_MODEL_OPTIONS: [],
      ABAKA_AI_TASK21_SINGLE_MODEL_OPTIONS: [],
      JUDGEMENT_PROJECT_ASR_KEYS: [],
    };
  }

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  const EXTENSION_CONTEXT_INVALIDATED_CODE = "EXTENSION_CONTEXT_INVALIDATED";
  const DEFAULT_AI_REQUEST_TIMEOUT_MS = 60000;
  const LEGACY_DEFAULT_AI_REQUEST_TIMEOUT_MS = 60 * 1000;

  function isExtensionContextInvalidatedError(error) {
    const message = String((error && (error.message || error)) || "").toLowerCase();
    return (
      message.indexOf("extension context invalidated") >= 0 ||
      message.indexOf("context invalidated") >= 0
    );
  }

  function createExtensionContextInvalidatedError(rawError) {
    const error = new Error("Extension context invalidated");
    error.code = EXTENSION_CONTEXT_INVALIDATED_CODE;
    if (rawError && rawError !== error) {
      error.cause = rawError;
    }
    return error;
  }

  function isChromeExtensionContextAvailable() {
    try {
      return Boolean(
        globalThis.chrome &&
          chrome.runtime &&
          typeof chrome.runtime.id === "string" &&
          chrome.runtime.id &&
          chrome.storage &&
          chrome.storage.local
      );
    } catch (error) {
      return false;
    }
  }

  function isPlainObject(value) {
    return Object.prototype.toString.call(value) === "[object Object]";
  }

  function hasOwn(target, key) {
    return Object.prototype.hasOwnProperty.call(target, key);
  }

  function deepMerge(base, override) {
    const source = isPlainObject(base) ? base : {};
    const patch = isPlainObject(override) ? override : {};
    const result = { ...source };

    Object.keys(patch).forEach(function (key) {
      if (isPlainObject(source[key]) && isPlainObject(patch[key])) {
        result[key] = deepMerge(source[key], patch[key]);
        return;
      }

      result[key] = clone(patch[key]);
    });

    return result;
  }

  function normalizeStringList(value) {
    const input = Array.isArray(value) ? value : [];
    const result = [];
    const seen = new Set();
    input.forEach(function (item) {
      const text = String(item || "").trim();
      if (!text || seen.has(text)) {
        return;
      }
      seen.add(text);
      result.push(text);
    });
    return result;
  }

  function normalizeShortcut(shortcut, fallback) {
    const base = isPlainObject(fallback) ? fallback : {};
    const input = isPlainObject(shortcut) ? shortcut : {};

    return {
      ctrl: input.ctrl === true || base.ctrl === true,
      alt: input.alt === true || base.alt === true,
      shift: input.shift === true || base.shift === true,
      meta: input.meta === true || base.meta === true,
      key:
        typeof input.key === "string"
          ? input.key
          : typeof base.key === "string"
            ? base.key
            : null,
      button:
        typeof input.button === "number"
          ? input.button
          : typeof base.button === "number"
            ? base.button
            : null,
    };
  }

  function normalizeReplacementRules(rules) {
    return Array.isArray(rules)
      ? rules
          .map(function (rule) {
            return {
              from: typeof rule?.from === "string" ? rule.from : "",
              to: typeof rule?.to === "string" ? rule.to : "",
            };
          })
          .filter(function (rule) {
            return rule.from.trim().length > 0 || rule.to.trim().length > 0;
          })
      : [];
  }

  function normalizeCustomRates(rates, fallback) {
    const defaults = Array.isArray(fallback) ? fallback : [];
    const source = Array.isArray(rates) ? rates : defaults;
    return source.map(function (entry, index) {
      const base = defaults[index] || {};
      const rateValue =
        typeof entry?.rate === "number"
          ? entry.rate
          : typeof base.rate === "number"
            ? base.rate
            : 1.0;

      return {
        rate: Math.max(0.1, Math.min(8, Number(rateValue) || 1.0)),
        shortcut:
          entry?.shortcut === null
            ? null
            : normalizeShortcut(entry?.shortcut, base.shortcut || null),
      };
    });
  }

  function normalizeNumber(value, fallback) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : fallback;
  }

  function normalizeBackendEndpointMode(value, fallback) {
    const constants = getConstants();
    const localMode = constants.BACKEND_ENDPOINT_MODE_LOCAL || "local";
    const serverMode = constants.BACKEND_ENDPOINT_MODE_SERVER || "server";
    const fallbackText = String(fallback || "").trim().toLowerCase();
    const fallbackMode = fallbackText === localMode ? localMode : serverMode;
    const text = String(value || "").trim().toLowerCase();
    if (text === localMode || text === "localhost" || text === "127.0.0.1") {
      return localMode;
    }
    if (text === serverMode) {
      return serverMode;
    }
    return fallbackMode;
  }

  function inferBackendModeFromEndpoint(value) {
    const text = String(value || "").trim().toLowerCase();
    if (!text) {
      return "";
    }
    if (text.indexOf("127.0.0.1") >= 0 || text.indexOf("localhost") >= 0) {
      return "local";
    }
    if (text.indexOf("http://") === 0 || text.indexOf("https://") === 0) {
      return "server";
    }
    return "";
  }

  function normalizeBackendBaseUrl(value, fallback) {
    const constants = getConstants();
    if (typeof constants.normalizeBackendBaseUrl === "function") {
      return constants.normalizeBackendBaseUrl(value, fallback);
    }
    const text = String(value || "").trim().replace(/\/+$/, "");
    if (/^https?:\/\//i.test(text)) {
      return text;
    }
    const fallbackText = String(fallback || "").trim().replace(/\/+$/, "");
    return /^https?:\/\//i.test(fallbackText) ? fallbackText : "";
  }

  function getBackendBaseUrlsFromSettingsLocal(settings, defaults) {
    const constants = getConstants();
    const defaultBaseUrls =
      defaults?.meta?.backendBaseUrls ||
      constants.DEFAULT_BACKEND_BASE_URLS || {
        server: "https://script.aisiyunling.com",
        local: "http://127.0.0.1:3333",
      };
    const storedBaseUrls =
      settings?.meta?.backendBaseUrls && typeof settings.meta.backendBaseUrls === "object"
        ? settings.meta.backendBaseUrls
        : {};
    return {
      server: normalizeBackendBaseUrl(storedBaseUrls.server, defaultBaseUrls.server),
      local: normalizeBackendBaseUrl(storedBaseUrls.local, defaultBaseUrls.local),
    };
  }

  function getLegacyServerBaseUrl(input) {
    const candidates = [
      input?.platforms?.alibabaLabelx?.scriptCenter?.projects?.transcription?.asrConfig?.statsUploadEndpoint,
      input?.platforms?.alibabaLabelx?.scriptCenter?.projects?.judgement?.asrConfig?.statsUploadEndpoint,
      input?.platforms?.alibabaLabelx?.scriptCenter?.projects?.judgement?.asrConfig?.aiSuggestionEndpoint,
      input?.platforms?.dataBaker?.scripts?.roundOneQuality?.aiRecommendEndpoint,
      input?.platforms?.aishellTech?.scripts?.minnanHelper?.aiRecommendEndpoint,
      input?.platforms?.aishellTech?.scripts?.vietnameseHelper?.aiRecommendEndpoint,
      input?.platforms?.aishellTech?.scripts?.thaiHelper?.aiRecommendEndpoint,
      input?.platforms?.aishellTech?.scripts?.cantoneseHelper?.aiRecommendEndpoint,
      input?.asr?.statsUploadEndpoint,
      input?.asr?.aiSuggestionEndpoint,
    ];

    for (const candidate of candidates) {
      if (inferBackendModeFromEndpoint(candidate) !== "server") {
        continue;
      }
      try {
        return normalizeBackendBaseUrl(new URL(String(candidate).trim()).origin, "");
      } catch (error) {
        // 忽略无法解析的旧 endpoint，继续使用后续候选或新版默认地址。
      }
    }
    return "";
  }

  function ensureGlobalBackendBaseUrls(settings, input, defaults) {
    settings.meta = deepMerge(defaults?.meta || {}, settings.meta || {});
    const inputBaseUrls =
      input?.meta?.backendBaseUrls && typeof input.meta.backendBaseUrls === "object"
        ? input.meta.backendBaseUrls
        : {};
    const baseUrls = Object.assign({}, settings.meta.backendBaseUrls || {}, inputBaseUrls);
    if (!normalizeBackendBaseUrl(inputBaseUrls.server, "")) {
      const legacyServerBaseUrl = getLegacyServerBaseUrl(input);
      if (legacyServerBaseUrl) {
        baseUrls.server = legacyServerBaseUrl;
      }
    }
    settings.meta.backendBaseUrls = getBackendBaseUrlsFromSettingsLocal(
      {
        meta: Object.assign({}, settings.meta || {}, {
          backendBaseUrls: baseUrls,
        }),
      },
      defaults
    );
  }

  function buildBackendUrlFromSettingsLocal(path, settings) {
    const constants = getConstants();
    if (typeof constants.buildBackendUrl === "function") {
      return constants.buildBackendUrl(path, settings || {});
    }
    const normalizedPath = String(path || "").charAt(0) === "/" ? String(path || "") : "/" + String(path || "");
    const mode = normalizeBackendEndpointMode(
      settings?.meta?.backendEndpointMode,
      "server"
    );
    const baseUrls = getBackendBaseUrlsFromSettingsLocal(settings || {}, { meta: {} });
    const baseUrl =
      mode === (constants.BACKEND_ENDPOINT_MODE_LOCAL || "local")
        ? baseUrls.local
        : baseUrls.server;
    return String(baseUrl || "").replace(/\/+$/, "") + normalizedPath;
  }

  function ensureGlobalBackendEndpointMode(settings, input, defaults) {
    const constants = getConstants();
    const defaultMode = normalizeBackendEndpointMode(
      defaults?.meta?.backendEndpointMode,
      constants.BACKEND_ENDPOINT_MODE_SERVER || "server"
    );
    settings.meta = deepMerge(defaults?.meta || {}, settings.meta || {});
    const existingMode = normalizeBackendEndpointMode(
      settings.meta.backendEndpointMode,
      defaultMode
    );
    const inputMeta = isPlainObject(input?.meta) ? input.meta : {};
    const hasExplicitInputMode = hasOwn(inputMeta, "backendEndpointMode");
    if (hasExplicitInputMode) {
      settings.meta.backendEndpointMode = existingMode;
      return;
    }

    const candidates = [
      input?.platforms?.alibabaLabelx?.scriptCenter?.projects?.transcription?.asrConfig?.statsUploadEndpoint,
      input?.platforms?.alibabaLabelx?.scriptCenter?.projects?.judgement?.asrConfig?.statsUploadEndpoint,
      input?.platforms?.alibabaLabelx?.scriptCenter?.projects?.judgement?.asrConfig?.aiSuggestionEndpoint,
      input?.platforms?.dataBaker?.scripts?.roundOneQuality?.aiRecommendEndpoint,
      input?.asr?.statsUploadEndpoint,
      input?.asr?.aiSuggestionEndpoint,
      settings?.platforms?.alibabaLabelx?.scriptCenter?.projects?.transcription?.asrConfig?.statsUploadEndpoint,
      settings?.platforms?.alibabaLabelx?.scriptCenter?.projects?.judgement?.asrConfig?.statsUploadEndpoint,
      settings?.platforms?.alibabaLabelx?.scriptCenter?.projects?.judgement?.asrConfig?.aiSuggestionEndpoint,
      settings?.platforms?.dataBaker?.scripts?.roundOneQuality?.aiRecommendEndpoint,
    ];

    const inferredMode =
      candidates
        .map(inferBackendModeFromEndpoint)
        .find(function (mode) {
          return mode === "local" || mode === "server";
        }) || defaultMode;
    settings.meta.backendEndpointMode = normalizeBackendEndpointMode(inferredMode, defaultMode);
  }

  const JUDGEMENT_ITEMS_PER_PAGE_VALUES = [
    "1 条/页",
    "2 条/页",
    "3 条/页",
    "4 条/页",
    "5 条/页",
    "10 条/页",
    "20 条/页",
    "30 条/页",
    "40 条/页",
    "50 条/页",
    "400 条/页",
  ];

  function normalizeJudgementItemsPerPage(value, fallback) {
    const text = typeof value === "string" ? value.trim() : "";
    if (
      text === "all" ||
      text === "全部" ||
      text === "全部/400条" ||
      text === "全部（400 条）" ||
      text === "全部（400条）" ||
      text === "400 条/页" ||
      text === "400条/页"
    ) {
      return "400 条/页";
    }

    if (
      text === "100 条/页" ||
      text === "100条/页" ||
      text === "150 条/页" ||
      text === "150条/页" ||
      text === "200 条/页" ||
      text === "200条/页"
    ) {
      return "50 条/页";
    }

    if (JUDGEMENT_ITEMS_PER_PAGE_VALUES.indexOf(text) >= 0) {
      return text;
    }

    return JUDGEMENT_ITEMS_PER_PAGE_VALUES.indexOf(fallback) >= 0 ? fallback : "50 条/页";
  }

  function normalizeHexColor(value, fallback) {
    const text = typeof value === "string" ? value.trim() : "";
    if (/^#[0-9a-fA-F]{6}$/.test(text)) {
      return text.toLowerCase();
    }

    return fallback;
  }

  function normalizeJudgementAsrDiffColors(value) {
    const constants = getConstants();
    const defaults = constants.DEFAULT_JUDGEMENT_ASR_CONFIG?.asrDiffColors || {
      changeBackground: "#fef3c7",
      gapBackground: "#fee2e2",
      punctuationBackground: "#ede9fe",
    };
    const source = isPlainObject(value) ? value : {};
    const result = {};
    Object.keys(defaults).forEach(function (key) {
      result[key] = normalizeHexColor(source[key], defaults[key]);
    });
    return result;
  }

  function normalizeTimeList(value, fallback) {
    const source = Array.isArray(value)
      ? value
      : typeof value === "string"
        ? value.split(/[,，\n]/)
        : Array.isArray(fallback)
          ? fallback
          : [];
    const result = [];

    source.forEach(function (item) {
      const text = String(item || "").trim();
      const match = text.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
      if (!match) {
        return;
      }

      const normalized = String(Number(match[1])).padStart(2, "0") + ":" + match[2];
      if (result.indexOf(normalized) < 0) {
        result.push(normalized);
      }
    });

    return result.length > 0 ? result : ["10:00", "16:00"];
  }

  function normalizeJudgementStatsEndpoint(value, fallback) {
    const text = typeof value === "string" ? value.trim() : "";
    const defaultEndpoint = typeof fallback === "string" ? fallback : "";
    const localEndpoint =
      "http://127.0.0.1:3333/api/alibaba-labelx/asr-judgement/statistics/upload";

    if (!text) {
      return defaultEndpoint;
    }
    if (text.indexOf("127.0.0.1:3333") >= 0 || text.indexOf("localhost:3333") >= 0) {
      return localEndpoint;
    }
    if (
      text.indexOf("47.108.254.138:3333") >= 0 ||
      text.indexOf("/api/asr-judgement/statistics/upload") >= 0
    ) {
      return defaultEndpoint;
    }
    return text;
  }

  function normalizeJudgementStatsConfig(config) {
    const defaults = getConstants().DEFAULT_JUDGEMENT_ASR_CONFIG || {};
    const nextConfig = isPlainObject(config) ? config : {};
    nextConfig.statsUploadEnabled = true;
    nextConfig.statsUploadEndpoint = normalizeJudgementStatsEndpoint(
      nextConfig.statsUploadEndpoint,
      defaults.statsUploadEndpoint
    );
    nextConfig.statsScheduleUrl = "";
    nextConfig.statsUploadTimes = normalizeTimeList(
      nextConfig.statsUploadTimes,
      defaults.statsUploadTimes
    );
    nextConfig.statsUploadJitterMinutes = Math.max(
      0,
      Math.min(120, normalizeNumber(nextConfig.statsUploadJitterMinutes, defaults.statsUploadJitterMinutes || 10))
    );
    nextConfig.statsAutoUploadOnSubtaskOpen = false;
    nextConfig.statsAutoUploadOnSchedule = true;
    nextConfig.statsUploadRequestTimeoutMs = Math.max(
      1000,
      Math.min(
        120000,
        normalizeNumber(
          nextConfig.statsUploadRequestTimeoutMs,
          defaults.statsUploadRequestTimeoutMs || 20000
        )
      )
    );
    return nextConfig;
  }

  function normalizeJudgementAiEndpoint(value, fallback) {
    const text = typeof value === "string" ? value.trim() : "";
    const fallbackEndpoint = typeof fallback === "string" ? fallback.trim() : "";
    if (!text) {
      return fallbackEndpoint;
    }

    try {
      const url = new URL(text);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return fallbackEndpoint;
      }
      return url.toString();
    } catch (error) {
      return fallbackEndpoint;
    }
  }

  function normalizeJudgementAiAvailableModels(value, fallback) {
    const constants = getConstants();
    const whitelist = Array.isArray(constants.JUDGEMENT_AI_AVAILABLE_MODELS)
      ? constants.JUDGEMENT_AI_AVAILABLE_MODELS
      : ["qwen3.5-plus", "qwen-plus", "qwen-turbo"];
    const source = Array.isArray(value) ? value : Array.isArray(fallback) ? fallback : whitelist;
    const result = [];

    source.forEach(function (item) {
      const model = String(item || "").trim();
      if (!model || whitelist.indexOf(model) < 0 || result.indexOf(model) >= 0) {
        return;
      }
      result.push(model);
    });

    return result.length > 0 ? result : whitelist.slice();
  }

  function normalizeJudgementAiModel(value, fallback, availableModels) {
    const source = String(value || "").trim();
    const models = Array.isArray(availableModels) ? availableModels : [];
    if (source && models.indexOf(source) >= 0) {
      return source;
    }

    const fallbackModel = String(fallback || "").trim();
    if (fallbackModel && models.indexOf(fallbackModel) >= 0) {
      return fallbackModel;
    }

    return models[0] || "qwen3.5-plus";
  }

  function normalizeJudgementAiModelText(value, fallback) {
    const text = String(value || "").replace(/[\r\n]+/g, " ").trim();
    if (!text) {
      return String(fallback || "").trim();
    }
    return text.slice(0, 80);
  }

  function normalizeJudgementAiPrompt(value) {
    return String(value || "").replace(/\r\n/g, "\n").trim().slice(0, 8000);
  }

  function normalizeJudgementAiOptionalNumberText(value, min, max, precision) {
    const text = String(value || "").trim();
    if (!text) {
      return "";
    }
    const numericValue = Number(text);
    if (!Number.isFinite(numericValue)) {
      return "";
    }
    const clamped = Math.max(min, Math.min(max, numericValue));
    return String(
      typeof precision === "number" ? Number(clamped.toFixed(precision)) : clamped
    );
  }

  function normalizeJudgementAiOptionalIntegerText(value, min, max) {
    const text = String(value || "").trim();
    if (!text) {
      return "";
    }
    const numericValue = Number(text);
    if (!Number.isFinite(numericValue)) {
      return "";
    }
    const normalized = Math.floor(Math.max(min, Math.min(max, numericValue)));
    return String(normalized);
  }

  function normalizeJudgementAiResponseFormat(value, fallback) {
    const text = String(value || "").trim().toLowerCase();
    if (text === "json_object" || text === "text") {
      return text;
    }
    const fallbackText = String(fallback || "").trim().toLowerCase();
    if (fallbackText === "json_object" || fallbackText === "text") {
      return fallbackText;
    }
    return "json_object";
  }

  function normalizeJudgementAiReasoningEffort(value) {
    const text = String(value || "").trim().toLowerCase();
    if (text === "low" || text === "medium" || text === "high") {
      return text;
    }
    return "";
  }

  function normalizeJudgementAiStopSequences(value) {
    const source = String(value || "");
    if (!source.trim()) {
      return "";
    }
    const list = source
      .split(/\r?\n/)
      .map(function (item) {
        return String(item || "").trim().slice(0, 80);
      })
      .filter(Boolean);
    const result = [];
    list.forEach(function (item) {
      if (result.length >= 8) {
        return;
      }
      if (result.indexOf(item) >= 0) {
        return;
      }
      result.push(item);
    });
    return result.join("\n");
  }

  function normalizeClampedNumber(value, fallback, min, max, precision) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return fallback;
    }

    const clamped = Math.max(min, Math.min(max, numericValue));
    return typeof precision === "number" ? Number(clamped.toFixed(precision)) : clamped;
  }

  function normalizeJudgementRateStep(value, fallback) {
    const allowedValues = [0.1, 0.25, 0.5, 1];
    const numericValue = Number(value);
    if (allowedValues.indexOf(numericValue) >= 0) {
      return numericValue;
    }

    return allowedValues.indexOf(fallback) >= 0 ? fallback : 0.25;
  }

  function normalizeJudgementSeekStep(value, fallback) {
    const allowedValues = [0.1, 0.25, 0.5, 1];
    const numericValue = Number(value);
    if (allowedValues.indexOf(numericValue) >= 0) {
      return numericValue;
    }

    return allowedValues.indexOf(fallback) >= 0 ? fallback : 0.5;
  }

  function normalizeJudgementAsrConfig(config) {
    const constants = getConstants();
    const defaults = constants.DEFAULT_JUDGEMENT_ASR_CONFIG || {};
    const fallback = defaults.itemsPerPage || "50 条/页";
    const nextConfig = isPlainObject(config) ? config : {};
    nextConfig.itemsPerPage = normalizeJudgementItemsPerPage(
      nextConfig.itemsPerPage,
      fallback
    );
    const defaultPlaybackRate = normalizeClampedNumber(
      hasOwn(nextConfig, "resetRateValue") ? nextConfig.resetRateValue : nextConfig.playbackRateValue,
      defaults.resetRateValue || defaults.playbackRateValue || 1,
      0.25,
      5,
      2
    );
    nextConfig.autoResetRate = true;
    nextConfig.resetRateValue = defaultPlaybackRate;
    nextConfig.playbackRateValue = defaultPlaybackRate;
    nextConfig.rateStepValue = normalizeJudgementRateStep(
      nextConfig.rateStepValue,
      defaults.rateStepValue || 0.25
    );
    nextConfig.seekStepSeconds = normalizeJudgementSeekStep(
      nextConfig.seekStepSeconds,
      defaults.seekStepSeconds || 0.5
    );
    nextConfig.volumeValue = normalizeClampedNumber(
      nextConfig.volumeValue,
      defaults.volumeValue || 100,
      0,
      1000,
      0
    );
    nextConfig.asrDiffColors = normalizeJudgementAsrDiffColors(nextConfig.asrDiffColors);
    nextConfig.thunderQuestionEnabled = nextConfig.thunderQuestionEnabled !== false;
    if (!isPlainObject(nextConfig.shortcuts)) {
      nextConfig.shortcuts = {};
    }

    const legacyAiShortcut = hasOwn(nextConfig, "aiSuggestionShortcut")
      ? nextConfig.aiSuggestionShortcut
      : null;
    const aiShortcut = normalizeShortcut(
      hasOwn(nextConfig.shortcuts, "aiSuggestCurrentItem")
        ? nextConfig.shortcuts.aiSuggestCurrentItem
        : legacyAiShortcut,
      null
    );
    nextConfig.shortcuts.aiSuggestCurrentItem = aiShortcut;
    nextConfig.shortcuts.applyAiSuggestion = normalizeShortcut(
      hasOwn(nextConfig.shortcuts, "applyAiSuggestion")
        ? nextConfig.shortcuts.applyAiSuggestion
        : null,
      null
    );
    nextConfig.shortcuts.retryAiSuggestion = normalizeShortcut(
      hasOwn(nextConfig.shortcuts, "retryAiSuggestion")
        ? nextConfig.shortcuts.retryAiSuggestion
        : null,
      null
    );
    nextConfig.shortcuts.ignoreAiSuggestion = normalizeShortcut(
      hasOwn(nextConfig.shortcuts, "ignoreAiSuggestion")
        ? nextConfig.shortcuts.ignoreAiSuggestion
        : null,
      null
    );
    nextConfig.shortcuts.copyAsrTextPair = normalizeShortcut(
      hasOwn(nextConfig.shortcuts, "copyAsrTextPair")
        ? nextConfig.shortcuts.copyAsrTextPair
        : null,
      null
    );
    nextConfig.shortcuts.submitTask = normalizeShortcut(
      hasOwn(nextConfig.shortcuts, "submitTask")
        ? nextConfig.shortcuts.submitTask
        : null,
      null
    );
    nextConfig.shortcuts.submitTaskAndFinish = normalizeShortcut(
      hasOwn(nextConfig.shortcuts, "submitTaskAndFinish")
        ? nextConfig.shortcuts.submitTaskAndFinish
        : null,
      null
    );
    delete nextConfig.aiSuggestionShortcut;

    const normalizedStatsConfig = normalizeJudgementStatsConfig(nextConfig);
    normalizedStatsConfig.aiSuggestionEnabled = true;
    normalizedStatsConfig.aiSuggestionEndpoint = normalizeJudgementAiEndpoint(
      normalizedStatsConfig.aiSuggestionEndpoint,
      defaults.aiSuggestionEndpoint ||
        "http://127.0.0.1:3333/api/alibaba-labelx/asr-judgement/ai/suggest"
    );
    normalizedStatsConfig.aiSuggestionRequestTimeoutMs = Math.max(
      1000,
      Math.min(
        180000,
        normalizeNumber(
          normalizedStatsConfig.aiSuggestionRequestTimeoutMs,
          defaults.aiSuggestionRequestTimeoutMs || DEFAULT_AI_REQUEST_TIMEOUT_MS
        )
      )
    );
    normalizedStatsConfig.aiSuggestionAvailableModels = normalizeJudgementAiAvailableModels(
      normalizedStatsConfig.aiSuggestionAvailableModels,
      defaults.aiSuggestionAvailableModels
    );
    const legacyCompareModel = normalizeJudgementAiModelText(
      normalizedStatsConfig.aiSuggestionModel,
      defaults.aiSuggestionModel || defaults.aiSuggestionCompareModel || "qwen3.5-plus"
    );
    normalizedStatsConfig.aiSuggestionListenModel = normalizeJudgementAiModelText(
      normalizedStatsConfig.aiSuggestionListenModel,
      defaults.aiSuggestionListenModel || "qwen3.5-omni-flash"
    );
    normalizedStatsConfig.aiSuggestionCompareModel = normalizeJudgementAiModelText(
      normalizedStatsConfig.aiSuggestionCompareModel || legacyCompareModel,
      defaults.aiSuggestionCompareModel || defaults.aiSuggestionModel || "qwen3.5-plus"
    );
    normalizedStatsConfig.aiSuggestionListenPrompt = normalizeJudgementAiPrompt(
      normalizedStatsConfig.aiSuggestionListenPrompt
    );
    normalizedStatsConfig.aiSuggestionComparePrompt = normalizeJudgementAiPrompt(
      normalizedStatsConfig.aiSuggestionComparePrompt
    );
    normalizedStatsConfig.aiSuggestionTemperature = normalizeJudgementAiOptionalNumberText(
      normalizedStatsConfig.aiSuggestionTemperature,
      0,
      2,
      3
    );
    normalizedStatsConfig.aiSuggestionTopP = normalizeJudgementAiOptionalNumberText(
      normalizedStatsConfig.aiSuggestionTopP,
      0,
      1,
      3
    );
    normalizedStatsConfig.aiSuggestionMaxTokens = normalizeJudgementAiOptionalIntegerText(
      normalizedStatsConfig.aiSuggestionMaxTokens,
      1,
      8192
    );
    normalizedStatsConfig.aiSuggestionMaxCompletionTokens = normalizeJudgementAiOptionalIntegerText(
      normalizedStatsConfig.aiSuggestionMaxCompletionTokens,
      1,
      8192
    );
    normalizedStatsConfig.aiSuggestionPresencePenalty = normalizeJudgementAiOptionalNumberText(
      normalizedStatsConfig.aiSuggestionPresencePenalty,
      -2,
      2,
      3
    );
    normalizedStatsConfig.aiSuggestionFrequencyPenalty = normalizeJudgementAiOptionalNumberText(
      normalizedStatsConfig.aiSuggestionFrequencyPenalty,
      -2,
      2,
      3
    );
    normalizedStatsConfig.aiSuggestionSeed = normalizeJudgementAiOptionalIntegerText(
      normalizedStatsConfig.aiSuggestionSeed,
      0,
      2147483647
    );
    normalizedStatsConfig.aiSuggestionResponseFormat = normalizeJudgementAiResponseFormat(
      normalizedStatsConfig.aiSuggestionResponseFormat,
      defaults.aiSuggestionResponseFormat || "json_object"
    );
    normalizedStatsConfig.aiSuggestionReasoningEffort = normalizeJudgementAiReasoningEffort(
      normalizedStatsConfig.aiSuggestionReasoningEffort
    );
    normalizedStatsConfig.aiSuggestionStopSequences = normalizeJudgementAiStopSequences(
      normalizedStatsConfig.aiSuggestionStopSequences
    );
    normalizedStatsConfig.aiSuggestionEnableThinking = false;
    normalizedStatsConfig.aiSuggestionWebSearchEnabled =
      normalizedStatsConfig.aiSuggestionWebSearchEnabled !== false;
    // legacy compatibility: keep single model field aligned with compare model.
    normalizedStatsConfig.aiSuggestionModel = normalizedStatsConfig.aiSuggestionCompareModel;
    return normalizedStatsConfig;
  }

  function createStoragePromise(method, payload) {
    if (!isChromeExtensionContextAvailable()) {
      return Promise.reject(createExtensionContextInvalidatedError());
    }

    if (!chrome?.storage?.local?.[method]) {
      return Promise.reject(createExtensionContextInvalidatedError());
    }

    return new Promise(function (resolve, reject) {
      try {
        chrome.storage.local[method](payload, function (result) {
          const runtimeLastError = chrome?.runtime?.lastError || null;
          if (runtimeLastError) {
            const runtimeError = new Error(runtimeLastError.message || "chrome.runtime.lastError");
            if (isExtensionContextInvalidatedError(runtimeError)) {
              reject(createExtensionContextInvalidatedError(runtimeError));
              return;
            }
            reject(runtimeError);
            return;
          }

          resolve(result);
        });
      } catch (error) {
        if (isExtensionContextInvalidatedError(error) || !isChromeExtensionContextAvailable()) {
          reject(createExtensionContextInvalidatedError(error));
          return;
        }
        reject(error);
      }
    });
  }

  async function getStoredValue() {
    const constants = getConstants();
    const result = await createStoragePromise("get", constants.STORAGE_KEY);
    return result?.[constants.STORAGE_KEY] || {};
  }

  async function setStoredValue(settings) {
    const constants = getConstants();
    await createStoragePromise("set", {
      [constants.STORAGE_KEY]: settings,
    });
    return settings;
  }

  function ensurePlatformRoot(settings) {
    if (!isPlainObject(settings.platforms)) {
      settings.platforms = {};
    }

    if (!isPlainObject(settings.platforms.alibabaLabelx)) {
      settings.platforms.alibabaLabelx = {};
    }

    return settings.platforms.alibabaLabelx;
  }

  function ensureLightwheelRoot(settings) {
    const constants = getConstants();
    const defaults = clone(constants.DEFAULT_SETTINGS || {});

    if (!isPlainObject(settings.platforms)) {
      settings.platforms = {};
    }

    settings.platforms.lightwheel = deepMerge(
      defaults?.platforms?.lightwheel || constants.DEFAULT_LIGHTWHEEL_PLATFORM_SETTINGS || {},
      settings.platforms.lightwheel || {}
    );

    return settings.platforms.lightwheel;
  }

  function normalizeDataBakerAiEndpoint(value, fallback) {
    const constants = getConstants();
    const serverEndpoint =
      constants.DATABAKER_AI_RECOMMEND_SERVER_ENDPOINT ||
      "https://script.aisiyunling.com/api/data-baker/round-one-quality/ai/recommend";
    const localEndpoint =
      constants.DATABAKER_AI_RECOMMEND_LOCAL_ENDPOINT ||
      "http://127.0.0.1:3333/api/data-baker/round-one-quality/ai/recommend";
    const fallbackEndpoint =
      normalizeDataBakerAiEndpointUrl(fallback) === normalizeDataBakerAiEndpointUrl(localEndpoint)
        ? localEndpoint
        : serverEndpoint;
    const normalized = normalizeDataBakerAiEndpointUrl(value);

    if (normalized && normalized === normalizeDataBakerAiEndpointUrl(localEndpoint)) {
      return localEndpoint;
    }
    if (normalized && normalized === normalizeDataBakerAiEndpointUrl(serverEndpoint)) {
      return serverEndpoint;
    }

    return fallbackEndpoint;
  }

  function normalizeAishellTechAiEndpoint(value, fallback) {
    const constants = getConstants();
    const serverEndpoint =
      constants.AISHELL_TECH_AI_RECOMMEND_SERVER_ENDPOINT ||
      "https://script.aisiyunling.com/api/aishell-tech/minnan-helper/ai/recommend";
    const localEndpoint =
      constants.AISHELL_TECH_AI_RECOMMEND_LOCAL_ENDPOINT ||
      "http://127.0.0.1:3333/api/aishell-tech/minnan-helper/ai/recommend";
    const fallbackEndpoint =
      normalizeDataBakerAiEndpointUrl(fallback) === normalizeDataBakerAiEndpointUrl(localEndpoint)
        ? localEndpoint
        : serverEndpoint;
    const normalized = normalizeDataBakerAiEndpointUrl(value);

    if (normalized && normalized === normalizeDataBakerAiEndpointUrl(localEndpoint)) {
      return localEndpoint;
    }
    if (normalized && normalized === normalizeDataBakerAiEndpointUrl(serverEndpoint)) {
      return serverEndpoint;
    }

    return fallbackEndpoint;
  }

  function normalizeAishellTechVietnameseAiEndpoint(value, fallback) {
    const constants = getConstants();
    const serverEndpoint =
      constants.AISHELL_TECH_VIETNAMESE_AI_RECOMMEND_SERVER_ENDPOINT ||
      "https://script.aisiyunling.com/api/aishell-tech/vietnamese-helper/ai/recommend";
    const localEndpoint =
      constants.AISHELL_TECH_VIETNAMESE_AI_RECOMMEND_LOCAL_ENDPOINT ||
      "http://127.0.0.1:3333/api/aishell-tech/vietnamese-helper/ai/recommend";
    const fallbackEndpoint =
      normalizeDataBakerAiEndpointUrl(fallback) === normalizeDataBakerAiEndpointUrl(localEndpoint)
        ? localEndpoint
        : serverEndpoint;
    const normalized = normalizeDataBakerAiEndpointUrl(value);

    if (normalized && normalized === normalizeDataBakerAiEndpointUrl(localEndpoint)) {
      return localEndpoint;
    }
    if (normalized && normalized === normalizeDataBakerAiEndpointUrl(serverEndpoint)) {
      return serverEndpoint;
    }

    return fallbackEndpoint;
  }

  function normalizeAishellTechThaiAiEndpoint(value, fallback) {
    const constants = getConstants();
    const serverEndpoint =
      constants.AISHELL_TECH_THAI_AI_RECOMMEND_SERVER_ENDPOINT ||
      "https://script.aisiyunling.com/api/aishell-tech/thai-helper/ai/recommend";
    const localEndpoint =
      constants.AISHELL_TECH_THAI_AI_RECOMMEND_LOCAL_ENDPOINT ||
      "http://127.0.0.1:3333/api/aishell-tech/thai-helper/ai/recommend";
    const fallbackEndpoint =
      normalizeDataBakerAiEndpointUrl(fallback) === normalizeDataBakerAiEndpointUrl(localEndpoint)
        ? localEndpoint
        : serverEndpoint;
    const normalized = normalizeDataBakerAiEndpointUrl(value);

    if (normalized && normalized === normalizeDataBakerAiEndpointUrl(localEndpoint)) {
      return localEndpoint;
    }
    if (normalized && normalized === normalizeDataBakerAiEndpointUrl(serverEndpoint)) {
      return serverEndpoint;
    }

    return fallbackEndpoint;
  }

  function normalizeAishellTechCantoneseAiEndpoint(value, fallback) {
    const constants = getConstants();
    const serverEndpoint =
      constants.AISHELL_TECH_CANTONESE_AI_RECOMMEND_SERVER_ENDPOINT ||
      "https://script.aisiyunling.com/api/aishell-tech/cantonese-helper/ai/recommend";
    const localEndpoint =
      constants.AISHELL_TECH_CANTONESE_AI_RECOMMEND_LOCAL_ENDPOINT ||
      "http://127.0.0.1:3333/api/aishell-tech/cantonese-helper/ai/recommend";
    const fallbackEndpoint =
      normalizeDataBakerAiEndpointUrl(fallback) === normalizeDataBakerAiEndpointUrl(localEndpoint)
        ? localEndpoint
        : serverEndpoint;
    const normalized = normalizeDataBakerAiEndpointUrl(value);
    if (normalized === normalizeDataBakerAiEndpointUrl(localEndpoint)) return localEndpoint;
    if (normalized === normalizeDataBakerAiEndpointUrl(serverEndpoint)) return serverEndpoint;
    return fallbackEndpoint;
  }

  function normalizeJdTtsShanghaineseAiEndpoint(value, fallback) {
    const constants = getConstants();
    const serverEndpoint =
      constants.JD_TTS_SHANGHAINESE_AI_RECOMMEND_SERVER_ENDPOINT ||
      "https://script.aisiyunling.com/api/jd-tts-annotation/shanghainese-helper/ai/recommend";
    const localEndpoint =
      constants.JD_TTS_SHANGHAINESE_AI_RECOMMEND_LOCAL_ENDPOINT ||
      "http://127.0.0.1:3333/api/jd-tts-annotation/shanghainese-helper/ai/recommend";
    const normalized = normalizeDataBakerAiEndpointUrl(value);
    const fallbackEndpoint =
      normalizeDataBakerAiEndpointUrl(fallback) === normalizeDataBakerAiEndpointUrl(localEndpoint)
        ? localEndpoint
        : serverEndpoint;
    if (normalized === normalizeDataBakerAiEndpointUrl(localEndpoint)) return localEndpoint;
    if (normalized === normalizeDataBakerAiEndpointUrl(serverEndpoint)) return serverEndpoint;
    return fallbackEndpoint;
  }

  function normalizeDataBakerAiEndpointUrl(value) {
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

  function normalizeHttpEndpoint(value, fallback) {
    const normalized = normalizeDataBakerAiEndpointUrl(value);
    return normalized || normalizeDataBakerAiEndpointUrl(fallback) || "";
  }

  function normalizeAiRequestTimeoutValue(value, fallback) {
    const numericValue = Number(value);
    const fallbackNumber = Number(fallback);
    let resolved = Number.isFinite(numericValue) ? numericValue : fallbackNumber;
    if (!Number.isFinite(resolved)) {
      resolved = DEFAULT_AI_REQUEST_TIMEOUT_MS;
    }
    if (Math.round(resolved) === LEGACY_DEFAULT_AI_REQUEST_TIMEOUT_MS) {
      resolved = DEFAULT_AI_REQUEST_TIMEOUT_MS;
    }
    return Math.max(1000, Math.min(300000, Math.floor(resolved)));
  }

  function normalizeDataBakerTimeout(value, fallback) {
    return normalizeAiRequestTimeoutValue(value, fallback);
  }

  function normalizeDataBakerPageSize(value, fallback) {
    const constants = getConstants();
    const options = Array.isArray(constants.DATABAKER_PAGE_SIZE_OPTIONS)
      ? constants.DATABAKER_PAGE_SIZE_OPTIONS
      : ["5条/页", "10条/页", "20条/页", "50条/页", "100条/页"];
    const normalizedOptions = options.map(function (item) {
      return String(item || "").replace(/\s+/g, "");
    });
    const text = String(value || "").replace(/\s+/g, "");
    const fallbackText = String(fallback || "50条/页").replace(/\s+/g, "");

    if (normalizedOptions.indexOf(text) >= 0) {
      return options[normalizedOptions.indexOf(text)];
    }
    if (normalizedOptions.indexOf(fallbackText) >= 0) {
      return options[normalizedOptions.indexOf(fallbackText)];
    }
    return "50条/页";
  }

  function getDataBakerAiQualifiedAutofillConcurrencyRule(settings, constants) {
    const helper =
      constants && typeof constants.getDataBakerAiQualifiedAutofillConcurrencyRule === "function"
        ? constants.getDataBakerAiQualifiedAutofillConcurrencyRule
        : null;
    if (helper) {
      return helper(settings || {});
    }
    const source = settings && typeof settings === "object" ? settings : {};
    const recognitionMode = normalizeDataBakerPipelineMode(
      source.recognitionMode || source.aiRecommendPipelineMode || source.pipelineMode,
      "two_stage"
    );
    const listenModel = getDataBakerModelText(source.listenModel || source.aiRecommendListenModel);
    const singleModel = getDataBakerModelText(
      source.singleModel || source.aiRecommendSingleModel || source.aiModel
    );
    if (recognitionMode === "two_stage" && listenModel === "fun-asr") {
      return { min: 1, max: 50, defaultValue: 5, modelType: "fun_asr" };
    }
    if (
      recognitionMode === "omni_single" &&
      normalizeDataBakerSingleModel(singleModel, "qwen3.5-omni-flash", constants)
    ) {
      return { min: 1, max: 25, defaultValue: 5, modelType: "omni" };
    }
    return { min: 1, max: 25, defaultValue: 5, modelType: "omni" };
  }

  function normalizeDataBakerConcurrency(value, fallback, settings, constants) {
    const rule = getDataBakerAiQualifiedAutofillConcurrencyRule(settings, constants);
    const numeric = Number(value);
    const fallbackNumeric = Number(fallback);
    const base = Number.isFinite(numeric)
      ? Math.round(numeric)
      : Number.isFinite(fallbackNumeric)
        ? Math.round(fallbackNumeric)
        : rule.defaultValue;
    return Math.max(rule.min, Math.min(rule.max, base));
  }

  function normalizeDataBakerPipelineMode(value, fallback) {
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
    return String(fallback || "two_stage").trim().toLowerCase() === "omni_single"
      ? "omni_single"
      : "two_stage";
  }

  function getDataBakerListenModelOptions(constants) {
    const values = Array.isArray(constants?.DATABAKER_AI_LISTEN_MODEL_OPTIONS)
      ? constants.DATABAKER_AI_LISTEN_MODEL_OPTIONS
          .map(function (item) {
            return getDataBakerModelText(item && typeof item === "object" ? item.value : item);
          })
          .filter(Boolean)
      : [];
    if (values.length > 0) {
      return values;
    }
    return [
      "fun-asr",
      "qwen3.5-omni-plus",
      "qwen3.5-omni-flash",
      "qwen3.5-omni-flash-2026-03-15",
      "qwen3-omni-flash",
      "qwen3-omni-flash-2025-12-01",
      "qwen3-omni-flash-2025-09-15",
    ];
  }

  function getDataBakerSingleModelOptions(constants) {
    const values = Array.isArray(constants?.DATABAKER_AI_SINGLE_MODEL_OPTIONS)
      ? constants.DATABAKER_AI_SINGLE_MODEL_OPTIONS
          .map(function (item) {
            return getDataBakerModelText(item && typeof item === "object" ? item.value : item);
          })
          .filter(Boolean)
      : [];
    if (values.length > 0) {
      return values;
    }
    return [
      "qwen3.5-omni-plus",
      "qwen3.5-omni-flash",
      "qwen3.5-omni-flash-2026-03-15",
      "qwen3-omni-flash",
      "qwen3-omni-flash-2025-12-01",
      "qwen3-omni-flash-2025-09-15",
    ];
  }

  function deriveDataBakerPipelineModeFromListenModel(listenModel) {
    return getDataBakerModelText(listenModel) === "fun-asr"
      ? "fun_asr_compare"
      : "qwen_omni_compare";
  }

  function normalizeDataBakerListenModel(value, fallback, constants) {
    const listenOptions = getDataBakerListenModelOptions(constants);
    const normalizedFallback =
      listenOptions.indexOf(getDataBakerModelText(fallback || "")) >= 0
        ? getDataBakerModelText(fallback || "")
        : "qwen3.5-omni-flash";
    const normalizedValue = getDataBakerModelText(value);
    if (listenOptions.indexOf(normalizedValue) >= 0) {
      return normalizedValue;
    }
    return normalizedFallback;
  }

  function normalizeDataBakerSingleModel(value, fallback, constants) {
    const singleOptions = getDataBakerSingleModelOptions(constants);
    const normalizedFallback =
      singleOptions.indexOf(getDataBakerModelText(fallback || "")) >= 0
        ? getDataBakerModelText(fallback || "")
        : "qwen3.5-omni-flash";
    const normalizedValue = getDataBakerModelText(value);
    if (singleOptions.indexOf(normalizedValue) >= 0) {
      return normalizedValue;
    }
    return normalizedFallback;
  }

  function resolveDataBakerListenModel(value, pipelineMode, fallback, constants) {
    const normalizedValue = getDataBakerModelText(value);
    if (normalizedValue) {
      return normalizeDataBakerListenModel(normalizedValue, fallback, constants);
    }
    const rawPipelineMode = String(pipelineMode || "").trim().toLowerCase();
    if (rawPipelineMode === "fun_asr_compare") {
      return "fun-asr";
    }
    if (rawPipelineMode === "qwen_omni_compare" || rawPipelineMode === "qwen_omni_two_stage") {
      return normalizeDataBakerListenModel("qwen3.5-omni-flash", fallback || "qwen3.5-omni-flash", constants);
    }
    return normalizeDataBakerListenModel("", fallback || "qwen3.5-omni-flash", constants);
  }

  function normalizeDataBakerOmniModel(value, fallback, constants) {
    const normalized = normalizeDataBakerListenModel(value, fallback, constants);
    if (normalized === "fun-asr") {
      return normalizeDataBakerListenModel(fallback, "qwen3.5-omni-flash", constants);
    }
    return normalized;
  }

  function getDataBakerModelText(value) {
    if (isPlainObject(value)) {
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

  function getDataBakerCompareModelOptions(constants) {
    const values = Array.isArray(constants?.DATABAKER_AI_COMPARE_MODEL_OPTIONS)
      ? constants.DATABAKER_AI_COMPARE_MODEL_OPTIONS
          .map(function (item) {
            return getDataBakerModelText(item && typeof item === "object" ? item.value : item);
          })
          .filter(Boolean)
      : [];
    if (values.length > 0) {
      return values;
    }
    return ["qwen3.6-plus", "qwen3.5-plus", "qwen3.6-flash", "qwen3.5-flash"];
  }

  function normalizeDataBakerOmniModel(value, fallback, constants) {
    const omniOptions = Array.isArray(constants?.DATABAKER_AI_OMNI_MODEL_OPTIONS)
      ? constants.DATABAKER_AI_OMNI_MODEL_OPTIONS
          .map(function (item) {
            return getDataBakerModelText(item && typeof item === "object" ? item.value : item);
          })
          .filter(Boolean)
      : [];
    const normalizedFallback =
      getDataBakerModelText(fallback || "qwen3.5-omni-flash") || "qwen3.5-omni-flash";
    const normalizedValue = getDataBakerModelText(value);
    if (omniOptions.length > 0) {
      if (normalizedValue && omniOptions.indexOf(normalizedValue) >= 0) {
        return normalizedValue;
      }
      if (omniOptions.indexOf(normalizedFallback) >= 0) {
        return normalizedFallback;
      }
      return omniOptions[0];
    }
    return normalizedValue || normalizedFallback;
  }

  function normalizeDataBakerCompareModel(value, fallback, constants) {
    const compareOptions = getDataBakerCompareModelOptions(constants);
    const normalizedFallback =
      compareOptions.indexOf(getDataBakerModelText(fallback || "")) >= 0
        ? getDataBakerModelText(fallback || "")
        : "qwen3.5-plus";
    const normalizedValue = getDataBakerModelText(value);
    if (compareOptions.indexOf(normalizedValue) >= 0) {
      return normalizedValue;
    }
    return normalizedFallback;
  }

  function normalizeDataBakerWaitAllBeforeFill(value, fallback) {
    if (value === true || value === false) {
      return value;
    }
    return fallback === false ? false : true;
  }

  function normalizeNullableShortcut(shortcut, fallback) {
    if (shortcut === null) {
      return null;
    }
    const normalized = normalizeShortcut(shortcut, fallback || null);
    return normalized.key || typeof normalized.button === "number" ? normalized : null;
  }

  function normalizeDataBakerShortcuts(value, fallback) {
    const constants = getConstants();
    const actions = Array.isArray(constants.DATABAKER_ROUND_ONE_SHORTCUT_ACTIONS)
        ? constants.DATABAKER_ROUND_ONE_SHORTCUT_ACTIONS
        : [
          { key: "aiRecommendCurrentItem" },
          { key: "autoFillQualifiedItem" },
          { key: "copyAiHeardText" },
          { key: "copyRecommendedText" },
          { key: "fillRecommendedText" },
          { key: "ignoreAiResult" },
          { key: "sentenceQualified" },
          { key: "sentenceUnqualified" },
          { key: "taskPass" },
          { key: "taskPartialReject" },
          { key: "taskFullReject" },
        ];
    const source = isPlainObject(value) ? value : {};
    const fallbackSource = isPlainObject(fallback) ? fallback : {};
    const result = {};

    actions.forEach(function (action) {
      const key = action.key;
      result[key] = hasOwn(source, key)
        ? normalizeNullableShortcut(source[key], fallbackSource[key] || null)
        : normalizeNullableShortcut(fallbackSource[key] || null, null);
    });

    return result;
  }

  function normalizeAishellTechShortcuts(value, fallback) {
    const constants = getConstants();
    const actions = Array.isArray(constants.AISHELL_TECH_MINNAN_SHORTCUT_ACTIONS)
      ? constants.AISHELL_TECH_MINNAN_SHORTCUT_ACTIONS
      : [
          { key: "aiRecommendCurrentItem" },
          { key: "autoFillQualifiedItem" },
          { key: "copyAiHeardText" },
          { key: "copyRecommendedText" },
          { key: "fillRecommendedText" },
          { key: "ignoreAiResult" },
        ];
    const source = isPlainObject(value) ? value : {};
    const fallbackSource = isPlainObject(fallback) ? fallback : {};
    const result = {};

    actions.forEach(function (action) {
      const key = action.key;
      result[key] = hasOwn(source, key)
        ? normalizeNullableShortcut(source[key], fallbackSource[key] || null)
        : normalizeNullableShortcut(fallbackSource[key] || null, null);
    });

    return result;
  }

  function normalizeAbakaAiTask21Shortcuts(value, fallback) {
    const constants = getConstants();
    const actions = Array.isArray(constants.ABAKA_AI_TASK21_SHORTCUT_ACTIONS)
      ? constants.ABAKA_AI_TASK21_SHORTCUT_ACTIONS
      : [
          { key: "sameFontTrue" },
          { key: "sameFontFalse" },
          { key: "sameFontArtisticEffect" },
          { key: "imageBTextsRemovedSpecify" },
          { key: "otherChangesSpecify" },
          { key: "stashSave" },
          { key: "submitReview" },
          { key: "aiAnalyzeSameFont" },
          { key: "aiAnalyzeImageBTextsRemoved" },
          { key: "aiAnalyzeOtherChanges" },
          { key: "aiAnalyzeOverall" },
        ];
    const source = isPlainObject(value) ? value : {};
    const fallbackSource = isPlainObject(fallback) ? fallback : {};
    const result = {};

    actions.forEach(function (action) {
      const key = action.key;
      result[key] = hasOwn(source, key)
        ? normalizeNullableShortcut(source[key], fallbackSource[key] || null)
        : normalizeNullableShortcut(fallbackSource[key] || null, null);
    });

    return result;
  }

  function mapLegacyAbakaAiModelName(modelName) {
    const text = String(modelName || "").trim();
    const lower = text.toLowerCase();
    if (!text) {
      return "";
    }
    if (lower === "qwen3.6plus") {
      return "qwen3.6-plus";
    }
    if (lower === "qwen-vl-max-latest") {
      return "qwen-vl-max";
    }
    if (lower === "qwen-vl-plus-latest") {
      return "qwen-vl-plus";
    }
    if (lower === "qwen-vl-ocr-latest") {
      return "";
    }
    if (lower === "qvq-plus-latest") {
      return "qwen3.6-plus";
    }
    return text;
  }

  function normalizeAbakaAiModel(value, fallback, options) {
    const allowed = Array.isArray(options)
      ? options
          .map(function (item) {
            return mapLegacyAbakaAiModelName(String(item?.value || "").trim());
          })
          .filter(Boolean)
      : [];
    const rawFallback = fallback === undefined ? "qwen3.6-plus" : String(fallback || "");
    const fallbackModel = mapLegacyAbakaAiModelName(rawFallback).trim();
    const text = mapLegacyAbakaAiModelName(
      String(value || "")
        .replace(/[\r\n]+/g, " ")
        .trim()
    );
    if (!text) {
      if (allowed.length > 0) {
        if (fallbackModel && allowed.indexOf(fallbackModel) >= 0) {
          return fallbackModel;
        }
        return allowed[0];
      }
      return fallbackModel;
    }
    const normalized = text.slice(0, 80);
    if (allowed.length <= 0 || allowed.indexOf(normalized) >= 0) {
      return normalized;
    }
    if (fallbackModel && allowed.indexOf(fallbackModel) >= 0) {
      return fallbackModel;
    }
    return allowed[0];
  }

  function normalizeAbakaAiAnalysisMode(value, fallback) {
    const text = String(value || "").trim().toLowerCase();
    if (text === "single_model") {
      return "single_model";
    }
    if (text === "two_stage") {
      return "two_stage";
    }
    return String(fallback || "two_stage").trim().toLowerCase() === "single_model"
      ? "single_model"
      : "two_stage";
  }

  function normalizeAbakaAiRequestTimeout(value, fallback) {
    return normalizeAiRequestTimeoutValue(value, fallback);
  }

  function normalizeDataBakerRoundOneQualityConfig(config, defaults) {
    const source = isPlainObject(config) ? config : {};
    const defaultConfig = isPlainObject(defaults) ? defaults : {};
    const result = deepMerge(defaultConfig, source);
    const constants = getConstants();

    result.id =
      constants.DATA_BAKER_ROUND_ONE_QUALITY_SCRIPT_ID ||
      result.id ||
      "dataBakerRoundOneQuality";
    result.enabled = result.enabled !== false;
    result.aiRecommendEnabled = result.aiRecommendEnabled !== false;
    result.aiRecommendEndpoint = normalizeDataBakerAiEndpoint(
      result.aiRecommendEndpoint,
      defaultConfig.aiRecommendEndpoint ||
        constants.DATABAKER_AI_RECOMMEND_SERVER_ENDPOINT
    );
    result.aiRecommendRequestTimeoutMs = normalizeDataBakerTimeout(
      result.aiRecommendRequestTimeoutMs,
      defaultConfig.aiRecommendRequestTimeoutMs || DEFAULT_AI_REQUEST_TIMEOUT_MS
    );
    const defaultPipelineMode = normalizeDataBakerPipelineMode(
      defaultConfig.aiRecommendPipelineMode || "two_stage",
      "two_stage"
    );
    const defaultListenModel = resolveDataBakerListenModel(
      defaultConfig.aiRecommendListenModel,
      defaultPipelineMode,
      "qwen3.5-omni-flash",
      constants
    );
    const defaultSingleModel = normalizeDataBakerSingleModel(
      defaultConfig.aiRecommendSingleModel || defaultConfig.aiRecommendListenModel,
      "qwen3.5-omni-flash",
      constants
    );
    const rawPipelineMode = getDataBakerModelText(result.aiRecommendPipelineMode);
    const normalizedPipelineMode = normalizeDataBakerPipelineMode(
      result.aiRecommendPipelineMode,
      defaultPipelineMode
    );
    result.aiRecommendListenModel = resolveDataBakerListenModel(
      result.aiRecommendListenModel,
      rawPipelineMode || (normalizedPipelineMode === "omni_single" ? "" : normalizedPipelineMode),
      defaultListenModel,
      constants
    );
    result.aiRecommendSingleModel = normalizeDataBakerSingleModel(
      result.aiRecommendSingleModel ||
        (normalizedPipelineMode === "omni_single"
          ? result.aiRecommendListenModel === "fun-asr"
            ? "qwen3.5-omni-flash"
            : result.aiRecommendListenModel
          : ""),
      defaultSingleModel,
      constants
    );
    result.aiRecommendPipelineMode = normalizedPipelineMode;
    result.aiQualifiedAutofillConcurrency = normalizeDataBakerConcurrency(
      result.aiQualifiedAutofillConcurrency,
      defaultConfig.aiQualifiedAutofillConcurrency || 5,
      {
        aiRecommendPipelineMode: result.aiRecommendPipelineMode,
        aiRecommendListenModel: result.aiRecommendListenModel,
        aiRecommendSingleModel: result.aiRecommendSingleModel,
      },
      constants
    );
    result.aiQualifiedAutofillWaitAllBeforeFill = normalizeDataBakerWaitAllBeforeFill(
      result.aiQualifiedAutofillWaitAllBeforeFill,
      defaultConfig.aiQualifiedAutofillWaitAllBeforeFill === true
    );
    result.aiRecommendCompareModel = normalizeDataBakerCompareModel(
      result.aiRecommendCompareModel,
      defaultConfig.aiRecommendCompareModel || "qwen3.5-plus",
      constants
    );
    result.aiRecommendEnableThinking = false;
    result.aiRecommendListenPrompt = normalizeJudgementAiPrompt(result.aiRecommendListenPrompt);
    result.aiRecommendComparePrompt = normalizeJudgementAiPrompt(result.aiRecommendComparePrompt);
    result.aiRecommendTemperature = normalizeJudgementAiOptionalNumberText(
      result.aiRecommendTemperature,
      0,
      2,
      3
    );
    result.aiRecommendTopP = normalizeJudgementAiOptionalNumberText(
      result.aiRecommendTopP,
      0,
      1,
      3
    );
    result.aiRecommendMaxTokens = normalizeJudgementAiOptionalIntegerText(
      result.aiRecommendMaxTokens,
      1,
      8192
    );
    result.aiRecommendMaxCompletionTokens = normalizeJudgementAiOptionalIntegerText(
      result.aiRecommendMaxCompletionTokens,
      1,
      8192
    );
    result.aiRecommendPresencePenalty = normalizeJudgementAiOptionalNumberText(
      result.aiRecommendPresencePenalty,
      -2,
      2,
      3
    );
    result.aiRecommendFrequencyPenalty = normalizeJudgementAiOptionalNumberText(
      result.aiRecommendFrequencyPenalty,
      -2,
      2,
      3
    );
    result.aiRecommendSeed = normalizeJudgementAiOptionalIntegerText(
      result.aiRecommendSeed,
      0,
      2147483647
    );
    result.aiRecommendStopSequences = normalizeJudgementAiStopSequences(
      result.aiRecommendStopSequences
    );
    result.autoPageSizeEnabled = result.autoPageSizeEnabled !== false;
    result.defaultPageSize = normalizeDataBakerPageSize(
      result.defaultPageSize,
      defaultConfig.defaultPageSize || "50条/页"
    );
    result.shortcuts = normalizeDataBakerShortcuts(
      result.shortcuts,
      defaultConfig.shortcuts || {}
    );

    return result;
  }

  function normalizeAishellTechMinnanConfig(config, defaults, rawConfig) {
    const source = isPlainObject(config) ? config : {};
    const rawSource = isPlainObject(rawConfig) ? rawConfig : source;
    const defaultConfig = isPlainObject(defaults) ? defaults : {};
    const result = deepMerge(defaultConfig, source);
    const constants = getConstants();
    const useThreeStageSource = hasAishellTechThreeStageMarkers(rawSource);
    const stageSource = useThreeStageSource ? rawSource : {};
    const defaultCompareFamily = normalizeAishellTechCompareFamily(
      defaultConfig.aiRecommendCompareFamily,
      "qwen"
    );

    result.id =
      constants.AISHELL_TECH_MINNAN_SCRIPT_ID || result.id || "aishellTechMinnanAssistant";
    result.enabled = result.enabled !== false;
    result.aiRecommendEnabled = result.aiRecommendEnabled !== false;
    result.aiRecommendEndpoint = normalizeAishellTechAiEndpoint(
      result.aiRecommendEndpoint,
      defaultConfig.aiRecommendEndpoint ||
        constants.AISHELL_TECH_AI_RECOMMEND_SERVER_ENDPOINT ||
        "https://script.aisiyunling.com/api/aishell-tech/minnan-helper/ai/recommend"
    );
    result.aiRecommendRequestTimeoutMs = normalizeDataBakerTimeout(
      result.aiRecommendRequestTimeoutMs,
      defaultConfig.aiRecommendRequestTimeoutMs || DEFAULT_AI_REQUEST_TIMEOUT_MS
    );
    const defaultListenModel = resolveDataBakerListenModel(
      defaultConfig.aiRecommendListenModel,
      "two_stage",
      "qwen3.5-omni-flash",
      constants
    );
    result.aiRecommendConvertModel = normalizeDataBakerCompareModel(
      stageSource.aiRecommendConvertModel,
      defaultConfig.aiRecommendConvertModel || "qwen3.5-plus",
      constants
    );
    result.aiRecommendConvertPrompt = normalizeJudgementAiPrompt(
      stageSource.aiRecommendConvertPrompt
    );
    normalizeAishellTechStageParams(result, "aiRecommendConvert");
    result.aiRecommendListenModel = resolveDataBakerListenModel(
      stageSource.aiRecommendListenModel,
      "two_stage",
      defaultListenModel,
      constants
    );
    result.aiRecommendListenPrompt = normalizeJudgementAiPrompt(
      stageSource.aiRecommendListenPrompt
    );
    normalizeAishellTechStageParams(result, "aiRecommendListen");
    result.aiRecommendCompareFamily = normalizeAishellTechCompareFamily(
      stageSource.aiRecommendCompareFamily,
      defaultCompareFamily
    );
    result.aiQualifiedAutofillConcurrency = normalizeDataBakerConcurrency(
      result.aiQualifiedAutofillConcurrency,
      defaultConfig.aiQualifiedAutofillConcurrency || 5,
      {
        aiRecommendPipelineMode: "two_stage",
        aiRecommendListenModel: result.aiRecommendListenModel,
        aiRecommendSingleModel:
          result.aiRecommendCompareFamily === "omni"
            ? normalizeDataBakerSingleModel(
                stageSource.aiRecommendCompareModel,
                defaultConfig.aiRecommendCompareFamily === "omni"
                  ? defaultConfig.aiRecommendCompareModel
                  : "qwen3.5-omni-flash",
                constants
              )
            : "qwen3.5-omni-flash",
      },
      constants
    );
    result.aiRecommendCompareModel =
      result.aiRecommendCompareFamily === "omni"
        ? normalizeDataBakerSingleModel(
            stageSource.aiRecommendCompareModel,
            defaultConfig.aiRecommendCompareFamily === "omni"
              ? defaultConfig.aiRecommendCompareModel
              : "qwen3.5-omni-flash",
            constants
          )
        : normalizeDataBakerCompareModel(
            stageSource.aiRecommendCompareModel,
            defaultConfig.aiRecommendCompareFamily === "qwen"
              ? defaultConfig.aiRecommendCompareModel
              : "qwen3.5-plus",
            constants
          );
    result.aiRecommendCompareQwenPrompt = normalizeJudgementAiPrompt(
      stageSource.aiRecommendCompareQwenPrompt
    );
    result.aiRecommendCompareOmniPrompt = normalizeJudgementAiPrompt(
      stageSource.aiRecommendCompareOmniPrompt
    );
    result.aiRecommendCompareAdoptionThreshold = normalizeAishellTechCompareAdoptionThreshold(
      stageSource.aiRecommendCompareAdoptionThreshold,
      defaultConfig.aiRecommendCompareAdoptionThreshold || 0.75
    );
    result.aiRecommendEnableThinking = false;
    normalizeAishellTechStageParams(result, "aiRecommendCompare");
    result.shortcuts = normalizeAishellTechShortcuts(
      result.shortcuts,
      defaultConfig.shortcuts || {}
    );
    delete result.aiRecommendPipelineMode;
    delete result.aiRecommendRecognitionStrategy;
    delete result.aiRecommendCandidateModel;
    delete result.aiRecommendSingleModel;
    delete result.aiRecommendCandidatePrompt;
    delete result.aiRecommendComparePrompt;
    delete result.aiRecommendAudioFirstReferenceCorrectionThreshold;
    delete result.aiRecommendTemperature;
    delete result.aiRecommendTopP;
    delete result.aiRecommendMaxTokens;
    delete result.aiRecommendMaxCompletionTokens;
    delete result.aiRecommendPresencePenalty;
    delete result.aiRecommendFrequencyPenalty;
    delete result.aiRecommendSeed;
    delete result.aiRecommendStopSequences;
    delete result.recognitionStrategy;
    delete result.recognitionMode;
    delete result.pipelineMode;
    delete result.candidateModel;
    delete result.compareModel;

    return result;
  }

  function normalizeAishellTechVietnameseConfig(config, defaults) {
    const source = isPlainObject(config) ? config : {};
    const defaultConfig = isPlainObject(defaults) ? defaults : {};
    const result = deepMerge(defaultConfig, source);
    const constants = getConstants();

    result.id =
      constants.AISHELL_TECH_VIETNAMESE_SCRIPT_ID ||
      result.id ||
      "aishellTechVietnameseAssistant";
    result.enabled = result.enabled === true;
    result.aiRecommendEnabled = result.aiRecommendEnabled === true;
    result.aiRecommendEndpoint = normalizeAishellTechVietnameseAiEndpoint(
      result.aiRecommendEndpoint,
      defaultConfig.aiRecommendEndpoint ||
        constants.AISHELL_TECH_VIETNAMESE_AI_RECOMMEND_SERVER_ENDPOINT ||
        "https://script.aisiyunling.com/api/aishell-tech/vietnamese-helper/ai/recommend"
    );
    result.aiRecommendRequestTimeoutMs = normalizeDataBakerTimeout(
      result.aiRecommendRequestTimeoutMs,
      defaultConfig.aiRecommendRequestTimeoutMs || DEFAULT_AI_REQUEST_TIMEOUT_MS
    );
    result.aiRecommendSingleModel = normalizeDataBakerOmniModel(
      result.aiRecommendSingleModel,
      defaultConfig.aiRecommendSingleModel || "qwen3.5-omni-flash",
      constants
    );
    result.aiRecommendSinglePrompt = normalizeJudgementAiPrompt(
      result.aiRecommendSinglePrompt
    );
    result.aiQualifiedAutofillConcurrency = normalizeDataBakerConcurrency(
      result.aiQualifiedAutofillConcurrency,
      defaultConfig.aiQualifiedAutofillConcurrency || 5,
      {
        aiRecommendPipelineMode: "omni_single",
        aiRecommendSingleModel: result.aiRecommendSingleModel,
      },
      constants
    );
    result.aiRecommendEnableThinking = false;
    normalizeAishellTechStageParams(result, "aiRecommend");
    result.shortcuts = normalizeAishellTechVietnameseShortcuts(
      result.shortcuts,
      defaultConfig.shortcuts || {}
    );

    delete result.aiRecommendPipelineMode;
    delete result.aiRecommendRecognitionStrategy;
    delete result.aiRecommendCandidateModel;
    delete result.aiRecommendCandidatePrompt;
    delete result.aiRecommendComparePrompt;
    delete result.aiRecommendAudioFirstReferenceCorrectionThreshold;
    delete result.aiRecommendConvertModel;
    delete result.aiRecommendConvertPrompt;
    delete result.aiRecommendConvertTemperature;
    delete result.aiRecommendConvertTopP;
    delete result.aiRecommendConvertMaxTokens;
    delete result.aiRecommendConvertMaxCompletionTokens;
    delete result.aiRecommendConvertPresencePenalty;
    delete result.aiRecommendConvertFrequencyPenalty;
    delete result.aiRecommendConvertSeed;
    delete result.aiRecommendConvertStopSequences;
    delete result.aiRecommendListenModel;
    delete result.aiRecommendListenPrompt;
    delete result.aiRecommendListenTemperature;
    delete result.aiRecommendListenTopP;
    delete result.aiRecommendListenMaxTokens;
    delete result.aiRecommendListenMaxCompletionTokens;
    delete result.aiRecommendListenPresencePenalty;
    delete result.aiRecommendListenFrequencyPenalty;
    delete result.aiRecommendListenSeed;
    delete result.aiRecommendListenStopSequences;
    delete result.aiRecommendCompareFamily;
    delete result.aiRecommendCompareModel;
    delete result.aiRecommendCompareQwenPrompt;
    delete result.aiRecommendCompareOmniPrompt;
    delete result.aiRecommendCompareTemperature;
    delete result.aiRecommendCompareTopP;
    delete result.aiRecommendCompareMaxTokens;
    delete result.aiRecommendCompareMaxCompletionTokens;
    delete result.aiRecommendComparePresencePenalty;
    delete result.aiRecommendCompareFrequencyPenalty;
    delete result.aiRecommendCompareSeed;
    delete result.aiRecommendCompareStopSequences;
    delete result.aiRecommendCompareAdoptionThreshold;
    delete result.recognitionStrategy;
    delete result.recognitionMode;
    delete result.pipelineMode;
    delete result.candidateModel;
    delete result.compareModel;

    return result;
  }

  function normalizeAishellTechVietnameseShortcuts(value, fallback) {
    const constants = getConstants();
    const actions = Array.isArray(constants.AISHELL_TECH_VIETNAMESE_SHORTCUT_ACTIONS)
      ? constants.AISHELL_TECH_VIETNAMESE_SHORTCUT_ACTIONS
      : [
          { key: "aiRecommendCurrentItem" },
          { key: "autoFillQualifiedItem" },
          { key: "copyRecommendedText" },
          { key: "fillRecommendedText" },
          { key: "ignoreAiResult" },
        ];
    const source = isPlainObject(value) ? value : {};
    const fallbackSource = isPlainObject(fallback) ? fallback : {};
    const result = {};

    actions.forEach(function (action) {
      const key = action.key;
      result[key] = hasOwn(source, key)
        ? normalizeNullableShortcut(source[key], fallbackSource[key] || null)
        : normalizeNullableShortcut(fallbackSource[key] || null, null);
    });

    return result;
  }

  function normalizeAishellTechThaiConfig(config, defaults) {
    const source = isPlainObject(config) ? config : {};
    const defaultConfig = isPlainObject(defaults) ? defaults : {};
    const result = deepMerge(defaultConfig, source);
    const constants = getConstants();

    result.id =
      constants.AISHELL_TECH_THAI_SCRIPT_ID ||
      result.id ||
      "aishellTechThaiAssistant";
    result.enabled = result.enabled === true;
    result.aiRecommendEnabled = result.aiRecommendEnabled === true;
    result.aiRecommendEndpoint = normalizeAishellTechThaiAiEndpoint(
      result.aiRecommendEndpoint,
      defaultConfig.aiRecommendEndpoint ||
        constants.AISHELL_TECH_THAI_AI_RECOMMEND_SERVER_ENDPOINT ||
        "https://script.aisiyunling.com/api/aishell-tech/thai-helper/ai/recommend"
    );
    result.aiRecommendRequestTimeoutMs = normalizeDataBakerTimeout(
      result.aiRecommendRequestTimeoutMs,
      defaultConfig.aiRecommendRequestTimeoutMs || DEFAULT_AI_REQUEST_TIMEOUT_MS
    );
    result.aiRecommendSingleModel = normalizeDataBakerSingleModel(
      result.aiRecommendSingleModel,
      defaultConfig.aiRecommendSingleModel || "qwen3.5-omni-flash",
      constants
    );
    result.aiRecommendSinglePrompt = normalizeJudgementAiPrompt(
      result.aiRecommendSinglePrompt
    );
    result.aiQualifiedAutofillConcurrency = normalizeDataBakerConcurrency(
      result.aiQualifiedAutofillConcurrency,
      defaultConfig.aiQualifiedAutofillConcurrency || 5,
      {
        aiRecommendPipelineMode: "omni_single",
        aiRecommendSingleModel: result.aiRecommendSingleModel,
      },
      constants
    );
    result.aiRecommendEnableThinking = false;
    normalizeAishellTechStageParams(result, "aiRecommend");
    result.shortcuts = normalizeAishellTechThaiShortcuts(
      result.shortcuts,
      defaultConfig.shortcuts || {}
    );

    delete result.aiRecommendPipelineMode;
    delete result.aiRecommendRecognitionStrategy;
    delete result.aiRecommendCandidateModel;
    delete result.aiRecommendCandidatePrompt;
    delete result.aiRecommendComparePrompt;
    delete result.aiRecommendAudioFirstReferenceCorrectionThreshold;
    delete result.aiRecommendConvertModel;
    delete result.aiRecommendConvertPrompt;
    delete result.aiRecommendConvertTemperature;
    delete result.aiRecommendConvertTopP;
    delete result.aiRecommendConvertMaxTokens;
    delete result.aiRecommendConvertMaxCompletionTokens;
    delete result.aiRecommendConvertPresencePenalty;
    delete result.aiRecommendConvertFrequencyPenalty;
    delete result.aiRecommendConvertSeed;
    delete result.aiRecommendConvertStopSequences;
    delete result.aiRecommendListenModel;
    delete result.aiRecommendListenPrompt;
    delete result.aiRecommendListenTemperature;
    delete result.aiRecommendListenTopP;
    delete result.aiRecommendListenMaxTokens;
    delete result.aiRecommendListenMaxCompletionTokens;
    delete result.aiRecommendListenPresencePenalty;
    delete result.aiRecommendListenFrequencyPenalty;
    delete result.aiRecommendListenSeed;
    delete result.aiRecommendListenStopSequences;
    delete result.aiRecommendCompareFamily;
    delete result.aiRecommendCompareModel;
    delete result.aiRecommendCompareQwenPrompt;
    delete result.aiRecommendCompareOmniPrompt;
    delete result.aiRecommendCompareTemperature;
    delete result.aiRecommendCompareTopP;
    delete result.aiRecommendCompareMaxTokens;
    delete result.aiRecommendCompareMaxCompletionTokens;
    delete result.aiRecommendComparePresencePenalty;
    delete result.aiRecommendCompareFrequencyPenalty;
    delete result.aiRecommendCompareSeed;
    delete result.aiRecommendCompareStopSequences;
    delete result.aiRecommendCompareAdoptionThreshold;
    delete result.recognitionStrategy;
    delete result.recognitionMode;
    delete result.pipelineMode;
    delete result.candidateModel;
    delete result.compareModel;

    return result;
  }

  function normalizeAishellTechCantoneseConfig(config, defaults) {
    const source = isPlainObject(config) ? config : {};
    const defaultConfig = isPlainObject(defaults) ? defaults : {};
    const result = deepMerge(defaultConfig, source);
    const constants = getConstants();
    result.id = constants.AISHELL_TECH_CANTONESE_SCRIPT_ID || "aishellTechCantoneseAssistant";
    result.enabled = result.enabled === true;
    result.aiRecommendEnabled = result.aiRecommendEnabled === true;
    result.aiRecommendEndpoint = normalizeAishellTechCantoneseAiEndpoint(
      result.aiRecommendEndpoint,
      defaultConfig.aiRecommendEndpoint
    );
    result.aiRecommendRequestTimeoutMs = normalizeDataBakerTimeout(
      result.aiRecommendRequestTimeoutMs,
      defaultConfig.aiRecommendRequestTimeoutMs || DEFAULT_AI_REQUEST_TIMEOUT_MS
    );
    result.aiRecommendSingleModel = normalizeDataBakerOmniModel(
      result.aiRecommendSingleModel,
      defaultConfig.aiRecommendSingleModel || "qwen3.5-omni-plus",
      constants
    );
    result.aiRecommendSinglePrompt =
      normalizeJudgementAiPrompt(result.aiRecommendSinglePrompt) ||
      normalizeJudgementAiPrompt(defaultConfig.aiRecommendSinglePrompt) ||
      String(constants.AISHELL_TECH_CANTONESE_DEFAULT_SINGLE_PROMPT || "");
    result.aiQualifiedAutofillConcurrency = normalizeDataBakerConcurrency(
      result.aiQualifiedAutofillConcurrency,
      defaultConfig.aiQualifiedAutofillConcurrency || 5,
      { aiRecommendPipelineMode: "omni_single", aiRecommendSingleModel: result.aiRecommendSingleModel },
      constants
    );
    result.aiRecommendEnableThinking = false;
    normalizeAishellTechStageParams(result, "aiRecommend");
    result.shortcuts = normalizeAishellTechCantoneseShortcuts(result.shortcuts, defaultConfig.shortcuts);
    return result;
  }

  function normalizeAishellTechCantoneseShortcuts(value, fallback) {
    const constants = getConstants();
    const actions = constants.AISHELL_TECH_CANTONESE_SHORTCUT_ACTIONS || [];
    const source = isPlainObject(value) ? value : {};
    const base = isPlainObject(fallback) ? fallback : {};
    const result = {};
    actions.forEach(function (action) {
      result[action.key] = hasOwn(source, action.key)
        ? normalizeNullableShortcut(source[action.key], base[action.key] || null)
        : normalizeNullableShortcut(base[action.key] || null, null);
    });
    return result;
  }

  function normalizeJdTtsShanghaineseConfig(config, defaults) {
    const source = isPlainObject(config) ? config : {};
    const defaultConfig = isPlainObject(defaults) ? defaults : {};
    const constants = getConstants();
    const result = {
      id: constants.JD_TTS_SHANGHAINESE_SCRIPT_ID || "jdTtsShanghaineseAssistant",
      enabled: source.enabled === true,
      aiRecommendEnabled: source.aiRecommendEnabled === true,
      aiRecommendEndpoint: normalizeJdTtsShanghaineseAiEndpoint(
        source.aiRecommendEndpoint,
        defaultConfig.aiRecommendEndpoint
      ),
      aiRecommendRequestTimeoutMs: normalizeDataBakerTimeout(
        source.aiRecommendRequestTimeoutMs,
        defaultConfig.aiRecommendRequestTimeoutMs || DEFAULT_AI_REQUEST_TIMEOUT_MS
      ),
      aiRecommendSingleModel: normalizeDataBakerOmniModel(
        source.aiRecommendSingleModel,
        defaultConfig.aiRecommendSingleModel || "qwen3.5-omni-plus",
        constants
      ),
      aiRecommendSinglePrompt: normalizeJudgementAiPrompt(source.aiRecommendSinglePrompt),
      aiRecommendTemperature: source.aiRecommendTemperature,
      aiRecommendTopP: source.aiRecommendTopP,
      aiRecommendMaxTokens: source.aiRecommendMaxTokens,
      aiRecommendMaxCompletionTokens: source.aiRecommendMaxCompletionTokens,
      aiRecommendPresencePenalty: source.aiRecommendPresencePenalty,
      aiRecommendFrequencyPenalty: source.aiRecommendFrequencyPenalty,
      aiRecommendSeed: source.aiRecommendSeed,
      aiRecommendStopSequences: source.aiRecommendStopSequences,
      aiRecommendEnableThinking: false,
    };
    normalizeAishellTechStageParams(result, "aiRecommend");
    return result;
  }

  function normalizeAishellTechCnEnShortDramaConfig(config, defaults) {
    const source = isPlainObject(config) ? config : {};
    const defaultConfig = isPlainObject(defaults) ? defaults : {};
    const result = deepMerge(defaultConfig, source);
    const constants = getConstants();

    result.id =
      constants.AISHELL_TECH_CN_EN_SHORT_DRAMA_SCRIPT_ID ||
      result.id ||
      "aishellTechCnEnShortDrama";
    result.enabled = result.enabled === true;
    result.aiRecommendEnabled = false;
    result.shortcuts = {};

    return result;
  }

  function normalizeAishellTechThaiShortcuts(value, fallback) {
    const constants = getConstants();
    const actions = Array.isArray(constants.AISHELL_TECH_THAI_SHORTCUT_ACTIONS)
      ? constants.AISHELL_TECH_THAI_SHORTCUT_ACTIONS
      : [
          { key: "aiRecommendCurrentItem" },
          { key: "autoFillQualifiedItem" },
          { key: "copyRecommendedText" },
          { key: "fillRecommendedText" },
          { key: "ignoreAiResult" },
        ];
    const source = isPlainObject(value) ? value : {};
    const fallbackSource = isPlainObject(fallback) ? fallback : {};
    const result = {};

    actions.forEach(function (action) {
      const key = action.key;
      result[key] = hasOwn(source, key)
        ? normalizeNullableShortcut(source[key], fallbackSource[key] || null)
        : normalizeNullableShortcut(fallbackSource[key] || null, null);
    });

    return result;
  }

  function ensureDataBakerRoot(settings) {
    const constants = getConstants();
    const defaults = clone(constants.DEFAULT_SETTINGS || {});
    const defaultPlatform =
      defaults?.platforms?.dataBaker || constants.DEFAULT_DATA_BAKER_PLATFORM_SETTINGS || {
        enabled: true,
        scripts: {
          roundOneQuality: {
            id: constants.DATA_BAKER_ROUND_ONE_QUALITY_SCRIPT_ID || "dataBakerRoundOneQuality",
            enabled: true,
            aiRecommendEnabled: true,
            aiRecommendEndpoint:
              constants.DATABAKER_AI_RECOMMEND_SERVER_ENDPOINT ||
              "https://script.aisiyunling.com/api/data-baker/round-one-quality/ai/recommend",
            aiRecommendRequestTimeoutMs: DEFAULT_AI_REQUEST_TIMEOUT_MS,
            aiRecommendPipelineMode: "two_stage",
                aiQualifiedAutofillConcurrency: 5,
            aiQualifiedAutofillWaitAllBeforeFill: false,
            aiRecommendListenModel: "qwen3.5-omni-flash",
            aiRecommendCompareModel: "qwen3.5-plus",
            aiRecommendSingleModel: "qwen3.5-omni-flash",
            autoPageSizeEnabled: true,
            defaultPageSize: "50条/页",
            shortcuts: {
              aiRecommendCurrentItem: null,
              autoFillQualifiedItem: null,
              copyAiHeardText: null,
              copyRecommendedText: null,
              fillRecommendedText: null,
              ignoreAiResult: null,
              sentenceQualified: null,
              sentenceUnqualified: null,
              taskPass: null,
              taskPartialReject: null,
              taskFullReject: null,
            },
          },
        },
      };

    if (!isPlainObject(settings.platforms)) {
      settings.platforms = {};
    }

    settings.platforms.dataBaker = deepMerge(
      defaultPlatform,
      settings.platforms.dataBaker || {}
    );

    if (!isPlainObject(settings.platforms.dataBaker.scripts)) {
      settings.platforms.dataBaker.scripts = {};
    }

    settings.platforms.dataBaker.enabled = settings.platforms.dataBaker.enabled !== false;
    settings.platforms.dataBaker.scripts.roundOneQuality =
      normalizeDataBakerRoundOneQualityConfig(
        settings.platforms.dataBaker.scripts.roundOneQuality,
        defaultPlatform.scripts?.roundOneQuality || {}
      );

    return settings.platforms.dataBaker;
  }

  function ensureAishellTechRoot(settings, rawInput) {
    const constants = getConstants();
    const defaults = clone(constants.DEFAULT_SETTINGS || {});
    const rawPlatform = isPlainObject(rawInput?.platforms?.aishellTech)
      ? rawInput.platforms.aishellTech
      : {};
    const rawMinnanHelperConfig = isPlainObject(rawPlatform.scripts?.minnanHelper)
      ? rawPlatform.scripts.minnanHelper
      : {};
    const rawVietnameseHelperConfig = isPlainObject(rawPlatform.scripts?.vietnameseHelper)
      ? rawPlatform.scripts.vietnameseHelper
      : {};
    const rawThaiHelperConfig = isPlainObject(rawPlatform.scripts?.thaiHelper)
      ? rawPlatform.scripts.thaiHelper
      : {};
    const rawCantoneseHelperConfig = isPlainObject(rawPlatform.scripts?.cantoneseHelper)
      ? rawPlatform.scripts.cantoneseHelper
      : {};
    const rawCnEnShortDramaConfig = isPlainObject(rawPlatform.scripts?.cnEnShortDrama)
      ? rawPlatform.scripts.cnEnShortDrama
      : {};
    const defaultPlatform =
      defaults?.platforms?.aishellTech || constants.DEFAULT_AISHELL_TECH_PLATFORM_SETTINGS || {
        enabled: true,
        activeScriptId: constants.AISHELL_TECH_MINNAN_SCRIPT_ID || "aishellTechMinnanAssistant",
        scripts: {
          minnanHelper: {
            id: constants.AISHELL_TECH_MINNAN_SCRIPT_ID || "aishellTechMinnanAssistant",
            enabled: true,
            aiRecommendEnabled: true,
            aiRecommendEndpoint:
              constants.AISHELL_TECH_AI_RECOMMEND_SERVER_ENDPOINT ||
              "https://script.aisiyunling.com/api/aishell-tech/minnan-helper/ai/recommend",
            aiRecommendRequestTimeoutMs: DEFAULT_AI_REQUEST_TIMEOUT_MS,
            aiQualifiedAutofillConcurrency: 5,
            aiRecommendConvertModel: "qwen3.5-plus",
            aiRecommendConvertPrompt: "",
            aiRecommendConvertTemperature: "",
            aiRecommendConvertTopP: "",
            aiRecommendConvertMaxTokens: "",
            aiRecommendConvertMaxCompletionTokens: "",
            aiRecommendConvertPresencePenalty: "",
            aiRecommendConvertFrequencyPenalty: "",
            aiRecommendConvertSeed: "",
            aiRecommendConvertStopSequences: "",
            aiRecommendListenModel: "qwen3.5-omni-flash",
            aiRecommendListenPrompt: "",
            aiRecommendListenTemperature: "",
            aiRecommendListenTopP: "",
            aiRecommendListenMaxTokens: "",
            aiRecommendListenMaxCompletionTokens: "",
            aiRecommendListenPresencePenalty: "",
            aiRecommendListenFrequencyPenalty: "",
            aiRecommendListenSeed: "",
            aiRecommendListenStopSequences: "",
            aiRecommendCompareFamily: "qwen",
            aiRecommendCompareModel: "qwen3.5-plus",
            aiRecommendCompareQwenPrompt: "",
            aiRecommendCompareOmniPrompt: "",
            aiRecommendCompareTemperature: "",
            aiRecommendCompareTopP: "",
            aiRecommendCompareMaxTokens: "",
            aiRecommendCompareMaxCompletionTokens: "",
            aiRecommendComparePresencePenalty: "",
            aiRecommendCompareFrequencyPenalty: "",
            aiRecommendCompareSeed: "",
            aiRecommendCompareStopSequences: "",
            aiRecommendCompareAdoptionThreshold: 0.75,
            aiRecommendEnableThinking: false,
            shortcuts: {
              aiRecommendCurrentItem: null,
              autoFillQualifiedItem: null,
              copyAiHeardText: null,
              copyRecommendedText: null,
              fillRecommendedText: null,
              ignoreAiResult: null,
            },
          },
          vietnameseHelper: {
            id:
              constants.AISHELL_TECH_VIETNAMESE_SCRIPT_ID || "aishellTechVietnameseAssistant",
            enabled: false,
            aiRecommendEnabled: false,
            aiRecommendEndpoint:
              constants.AISHELL_TECH_VIETNAMESE_AI_RECOMMEND_SERVER_ENDPOINT ||
              "https://script.aisiyunling.com/api/aishell-tech/vietnamese-helper/ai/recommend",
            aiRecommendRequestTimeoutMs: DEFAULT_AI_REQUEST_TIMEOUT_MS,
            aiQualifiedAutofillConcurrency: 5,
            aiRecommendSingleModel: "qwen3.5-omni-flash",
            aiRecommendSinglePrompt: "",
            aiRecommendTemperature: "",
            aiRecommendTopP: "",
            aiRecommendMaxTokens: "",
            aiRecommendMaxCompletionTokens: "",
            aiRecommendPresencePenalty: "",
            aiRecommendFrequencyPenalty: "",
            aiRecommendSeed: "",
            aiRecommendStopSequences: "",
            aiRecommendEnableThinking: false,
            shortcuts: {
              aiRecommendCurrentItem: null,
              autoFillQualifiedItem: null,
              copyRecommendedText: null,
              fillRecommendedText: null,
              ignoreAiResult: null,
            },
          },
          thaiHelper: {
            id: constants.AISHELL_TECH_THAI_SCRIPT_ID || "aishellTechThaiAssistant",
            enabled: false,
            aiRecommendEnabled: false,
            aiRecommendEndpoint:
              constants.AISHELL_TECH_THAI_AI_RECOMMEND_SERVER_ENDPOINT ||
              "https://script.aisiyunling.com/api/aishell-tech/thai-helper/ai/recommend",
            aiRecommendRequestTimeoutMs: DEFAULT_AI_REQUEST_TIMEOUT_MS,
            aiQualifiedAutofillConcurrency: 5,
            aiRecommendSingleModel: "qwen3.5-omni-flash",
            aiRecommendSinglePrompt: "",
            aiRecommendTemperature: "",
            aiRecommendTopP: "",
            aiRecommendMaxTokens: "",
            aiRecommendMaxCompletionTokens: "",
            aiRecommendPresencePenalty: "",
            aiRecommendFrequencyPenalty: "",
            aiRecommendSeed: "",
            aiRecommendStopSequences: "",
            aiRecommendEnableThinking: false,
            shortcuts: {
              aiRecommendCurrentItem: null,
              autoFillQualifiedItem: null,
              copyRecommendedText: null,
              fillRecommendedText: null,
              ignoreAiResult: null,
            },
          },
          cnEnShortDrama: {
            id:
              constants.AISHELL_TECH_CN_EN_SHORT_DRAMA_SCRIPT_ID || "aishellTechCnEnShortDrama",
            enabled: false,
            aiRecommendEnabled: false,
            shortcuts: {},
          },
        },
      };
    const minnanId = constants.AISHELL_TECH_MINNAN_SCRIPT_ID || "aishellTechMinnanAssistant";
    const vietnameseId =
      constants.AISHELL_TECH_VIETNAMESE_SCRIPT_ID || "aishellTechVietnameseAssistant";
    const thaiId = constants.AISHELL_TECH_THAI_SCRIPT_ID || "aishellTechThaiAssistant";
    const cantoneseId =
      constants.AISHELL_TECH_CANTONESE_SCRIPT_ID || "aishellTechCantoneseAssistant";
    const cnEnShortDramaId =
      constants.AISHELL_TECH_CN_EN_SHORT_DRAMA_SCRIPT_ID || "aishellTechCnEnShortDrama";

    if (!isPlainObject(settings.platforms)) {
      settings.platforms = {};
    }

    settings.platforms.aishellTech = deepMerge(
      defaultPlatform,
      rawPlatform
    );

    if (!isPlainObject(settings.platforms.aishellTech.scripts)) {
      settings.platforms.aishellTech.scripts = {};
    }

    settings.platforms.aishellTech.enabled = settings.platforms.aishellTech.enabled !== false;
    settings.platforms.aishellTech.scripts.minnanHelper =
      normalizeAishellTechMinnanConfig(
        settings.platforms.aishellTech.scripts.minnanHelper,
        defaultPlatform.scripts?.minnanHelper || {},
        rawMinnanHelperConfig
      );
    settings.platforms.aishellTech.scripts.vietnameseHelper =
      normalizeAishellTechVietnameseConfig(
        settings.platforms.aishellTech.scripts.vietnameseHelper,
        defaultPlatform.scripts?.vietnameseHelper || {},
        rawVietnameseHelperConfig
      );
    settings.platforms.aishellTech.scripts.thaiHelper =
      normalizeAishellTechThaiConfig(
        settings.platforms.aishellTech.scripts.thaiHelper,
        defaultPlatform.scripts?.thaiHelper || {},
        rawThaiHelperConfig
      );
    settings.platforms.aishellTech.scripts.cantoneseHelper =
      normalizeAishellTechCantoneseConfig(
        settings.platforms.aishellTech.scripts.cantoneseHelper,
        defaultPlatform.scripts?.cantoneseHelper || {},
        rawCantoneseHelperConfig
      );
    settings.platforms.aishellTech.scripts.cnEnShortDrama =
      normalizeAishellTechCnEnShortDramaConfig(
        settings.platforms.aishellTech.scripts.cnEnShortDrama,
        defaultPlatform.scripts?.cnEnShortDrama || {},
        rawCnEnShortDramaConfig
      );

    let minnanEnabled =
      settings.platforms.aishellTech.scripts.minnanHelper.enabled !== false &&
      settings.platforms.aishellTech.scripts.minnanHelper.aiRecommendEnabled !== false;
    let vietnameseEnabled =
      settings.platforms.aishellTech.scripts.vietnameseHelper.enabled !== false &&
      settings.platforms.aishellTech.scripts.vietnameseHelper.aiRecommendEnabled !== false;
    let thaiEnabled =
      settings.platforms.aishellTech.scripts.thaiHelper.enabled !== false &&
      settings.platforms.aishellTech.scripts.thaiHelper.aiRecommendEnabled !== false;
    let cantoneseEnabled =
      settings.platforms.aishellTech.scripts.cantoneseHelper.enabled !== false &&
      settings.platforms.aishellTech.scripts.cantoneseHelper.aiRecommendEnabled !== false;
    let cnEnShortDramaEnabled =
      settings.platforms.aishellTech.scripts.cnEnShortDrama.enabled !== false;
    let activeScriptId = normalizeAishellTechActiveScriptId(
      settings.platforms.aishellTech.activeScriptId
    );

    if (activeScriptId === minnanId && !minnanEnabled) {
      activeScriptId = "";
    } else if (activeScriptId === vietnameseId && !vietnameseEnabled) {
      activeScriptId = "";
    } else if (activeScriptId === thaiId && !thaiEnabled) {
      activeScriptId = "";
    } else if (activeScriptId === cantoneseId && !cantoneseEnabled) {
      activeScriptId = "";
    } else if (activeScriptId === cnEnShortDramaId && !cnEnShortDramaEnabled) {
      activeScriptId = "";
    }

    if (!activeScriptId) {
      if (minnanEnabled && !vietnameseEnabled && !thaiEnabled && !cantoneseEnabled && !cnEnShortDramaEnabled) {
        activeScriptId = minnanId;
      } else if (!minnanEnabled && vietnameseEnabled && !thaiEnabled && !cantoneseEnabled && !cnEnShortDramaEnabled) {
        activeScriptId = vietnameseId;
      } else if (!minnanEnabled && !vietnameseEnabled && thaiEnabled && !cantoneseEnabled && !cnEnShortDramaEnabled) {
        activeScriptId = thaiId;
      } else if (!minnanEnabled && !vietnameseEnabled && !thaiEnabled && cantoneseEnabled && !cnEnShortDramaEnabled) {
        activeScriptId = cantoneseId;
      } else if (!minnanEnabled && !vietnameseEnabled && !thaiEnabled && cnEnShortDramaEnabled) {
        activeScriptId = cnEnShortDramaId;
      } else if (minnanEnabled || vietnameseEnabled || thaiEnabled || cantoneseEnabled || cnEnShortDramaEnabled) {
        activeScriptId = normalizeAishellTechActiveScriptId(defaultPlatform.activeScriptId);
        if (
          !activeScriptId ||
          (activeScriptId === minnanId && !minnanEnabled) ||
          (activeScriptId === vietnameseId && !vietnameseEnabled) ||
          (activeScriptId === thaiId && !thaiEnabled) ||
          (activeScriptId === cantoneseId && !cantoneseEnabled) ||
          (activeScriptId === cnEnShortDramaId && !cnEnShortDramaEnabled)
        ) {
          activeScriptId = minnanEnabled
            ? minnanId
            : vietnameseEnabled
              ? vietnameseId
              : thaiEnabled
                ? thaiId
                : cantoneseEnabled
                  ? cantoneseId
                  : cnEnShortDramaEnabled
                  ? cnEnShortDramaId
                  : "";
        }
      }
    }

    if (activeScriptId === minnanId) {
      minnanEnabled = true;
      vietnameseEnabled = false;
      thaiEnabled = false;
      cantoneseEnabled = false;
      cnEnShortDramaEnabled = false;
    } else if (activeScriptId === vietnameseId) {
      minnanEnabled = false;
      vietnameseEnabled = true;
      thaiEnabled = false;
      cantoneseEnabled = false;
      cnEnShortDramaEnabled = false;
    } else if (activeScriptId === thaiId) {
      minnanEnabled = false;
      vietnameseEnabled = false;
      thaiEnabled = true;
      cantoneseEnabled = false;
      cnEnShortDramaEnabled = false;
    } else if (activeScriptId === cantoneseId) {
      minnanEnabled = false;
      vietnameseEnabled = false;
      thaiEnabled = false;
      cantoneseEnabled = true;
      cnEnShortDramaEnabled = false;
    } else if (activeScriptId === cnEnShortDramaId) {
      minnanEnabled = false;
      vietnameseEnabled = false;
      thaiEnabled = false;
      cantoneseEnabled = false;
      cnEnShortDramaEnabled = true;
    } else if (
      (minnanEnabled ? 1 : 0) +
        (vietnameseEnabled ? 1 : 0) +
        (thaiEnabled ? 1 : 0) +
        (cantoneseEnabled ? 1 : 0) +
        (cnEnShortDramaEnabled ? 1 : 0) >
      1
    ) {
      activeScriptId = minnanId;
      minnanEnabled = true;
      vietnameseEnabled = false;
      thaiEnabled = false;
      cantoneseEnabled = false;
      cnEnShortDramaEnabled = false;
    }

    settings.platforms.aishellTech.scripts.minnanHelper.enabled = minnanEnabled;
    settings.platforms.aishellTech.scripts.minnanHelper.aiRecommendEnabled = minnanEnabled;
    settings.platforms.aishellTech.scripts.vietnameseHelper.enabled = vietnameseEnabled;
    settings.platforms.aishellTech.scripts.vietnameseHelper.aiRecommendEnabled = vietnameseEnabled;
    settings.platforms.aishellTech.scripts.thaiHelper.enabled = thaiEnabled;
    settings.platforms.aishellTech.scripts.thaiHelper.aiRecommendEnabled = thaiEnabled;
    settings.platforms.aishellTech.scripts.cantoneseHelper.enabled = cantoneseEnabled;
    settings.platforms.aishellTech.scripts.cantoneseHelper.aiRecommendEnabled = cantoneseEnabled;
    settings.platforms.aishellTech.scripts.cnEnShortDrama.enabled = cnEnShortDramaEnabled;
    settings.platforms.aishellTech.scripts.cnEnShortDrama.aiRecommendEnabled = false;
    settings.platforms.aishellTech.activeScriptId = activeScriptId || "";

    return settings.platforms.aishellTech;
  }

  function normalizeAishellTechActiveScriptId(value) {
    const constants = getConstants();
    const minnanId = constants.AISHELL_TECH_MINNAN_SCRIPT_ID || "aishellTechMinnanAssistant";
    const vietnameseId =
      constants.AISHELL_TECH_VIETNAMESE_SCRIPT_ID || "aishellTechVietnameseAssistant";
    const thaiId = constants.AISHELL_TECH_THAI_SCRIPT_ID || "aishellTechThaiAssistant";
    const cantoneseId =
      constants.AISHELL_TECH_CANTONESE_SCRIPT_ID || "aishellTechCantoneseAssistant";
    const cnEnShortDramaId =
      constants.AISHELL_TECH_CN_EN_SHORT_DRAMA_SCRIPT_ID || "aishellTechCnEnShortDrama";
    const text = String(value || "").trim();
    if (
      text === minnanId ||
      text === vietnameseId ||
      text === thaiId ||
      text === cantoneseId ||
      text === cnEnShortDramaId
    ) {
      return text;
    }
    return "";
  }

  function normalizeMagicDataActiveScriptId(value) {
    const constants = getConstants();
    const hakkaId = constants.MAGIC_DATA_ANNOTATOR_SCRIPT_ID || "magicDataAnnotatorAiReview";
    const minnanId = constants.MAGIC_DATA_MINNAN_SCRIPT_ID || "magicDataMinnanAssistant";
    const text = String(value || "").trim();
    if (text === hakkaId || text === minnanId) {
      return text;
    }
    return "";
  }

  function getMagicDataScriptDefinitions(constants) {
    return [
      {
        scriptId: constants.MAGIC_DATA_ANNOTATOR_SCRIPT_ID || "magicDataAnnotatorAiReview",
        scriptKey: "hakkaHelper",
        legacyKey: "magicDataAnnotator",
      },
      {
        scriptId: constants.MAGIC_DATA_MINNAN_SCRIPT_ID || "magicDataMinnanAssistant",
        scriptKey: "minnanHelper",
        legacyKey: "magicDataMinnanAssistant",
      },
    ];
  }

  function normalizeMagicDataModelMode(value, fallback) {
    const text = String(value || "").trim().toLowerCase();
    if (text === "two_stage" || text === "omni_single") {
      return text;
    }
    const fallbackText = String(fallback || "two_stage").trim().toLowerCase();
    return fallbackText === "omni_single" ? "omni_single" : "two_stage";
  }

  function normalizeMagicDataRecognitionStrategy(value, fallback) {
    const text = String(value || "").trim().toLowerCase();
    if (text === "direct_dialect" || text === "mandarin_to_dialect") {
      return text;
    }
    const fallbackText = String(fallback || "direct_dialect").trim().toLowerCase();
    return fallbackText === "mandarin_to_dialect" ? "mandarin_to_dialect" : "direct_dialect";
  }

  function hasValidMagicDataRecognitionStrategy(value) {
    const text = String(value || "").trim().toLowerCase();
    return text === "direct_dialect" || text === "mandarin_to_dialect";
  }

  function normalizeAishellTechRecognitionStrategy(value, fallback) {
    const text = String(value || "").trim().toLowerCase();
    if (text === "audio_first_reference") {
      return "audio_first_reference";
    }
    return "audio_first_reference";
  }

  function normalizeAishellTechCompareFamily(value, fallback) {
    const text = String(value || "").trim().toLowerCase();
    if (text === "omni") {
      return "omni";
    }
    if (text === "qwen") {
      return "qwen";
    }
    return String(fallback || "qwen").trim().toLowerCase() === "omni" ? "omni" : "qwen";
  }

  function normalizeAishellTechCompareAdoptionThreshold(value, fallback) {
    const fallbackNumber = Number(fallback);
    const normalizedFallback = Number.isFinite(fallbackNumber)
      ? Math.max(0, Math.min(1, Number(fallbackNumber.toFixed(3))))
      : 0.75;
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return normalizedFallback;
    }
    return Math.max(0, Math.min(1, Number(numericValue.toFixed(3))));
  }

  function hasValidAishellTechRecognitionStrategy(value) {
    const text = String(value || "").trim().toLowerCase();
    return text === "audio_first_reference";
  }

  function hasAishellTechThreeStageMarkers(config) {
    const source = isPlainObject(config) ? config : {};
    return [
      "aiRecommendConvertModel",
      "aiRecommendConvertPrompt",
      "aiRecommendConvertTemperature",
      "aiRecommendConvertTopP",
      "aiRecommendConvertMaxTokens",
      "aiRecommendConvertMaxCompletionTokens",
      "aiRecommendConvertPresencePenalty",
      "aiRecommendConvertFrequencyPenalty",
      "aiRecommendConvertSeed",
      "aiRecommendConvertStopSequences",
      "aiRecommendCompareFamily",
      "aiRecommendCompareQwenPrompt",
      "aiRecommendCompareOmniPrompt",
      "aiRecommendCompareAdoptionThreshold",
      "aiRecommendCompareTemperature",
      "aiRecommendCompareTopP",
      "aiRecommendCompareMaxTokens",
      "aiRecommendCompareMaxCompletionTokens",
      "aiRecommendComparePresencePenalty",
      "aiRecommendCompareFrequencyPenalty",
      "aiRecommendCompareSeed",
      "aiRecommendCompareStopSequences",
    ].some(function (key) {
      return hasOwn(source, key);
    });
  }

  function normalizeAishellTechStageParams(result, prefix) {
    result[prefix + "Temperature"] = normalizeJudgementAiOptionalNumberText(
      result[prefix + "Temperature"],
      0,
      2,
      3
    );
    result[prefix + "TopP"] = normalizeJudgementAiOptionalNumberText(
      result[prefix + "TopP"],
      0,
      1,
      3
    );
    result[prefix + "MaxTokens"] = normalizeJudgementAiOptionalIntegerText(
      result[prefix + "MaxTokens"],
      1,
      8192
    );
    result[prefix + "MaxCompletionTokens"] = normalizeJudgementAiOptionalIntegerText(
      result[prefix + "MaxCompletionTokens"],
      1,
      8192
    );
    result[prefix + "PresencePenalty"] = normalizeJudgementAiOptionalNumberText(
      result[prefix + "PresencePenalty"],
      -2,
      2,
      3
    );
    result[prefix + "FrequencyPenalty"] = normalizeJudgementAiOptionalNumberText(
      result[prefix + "FrequencyPenalty"],
      -2,
      2,
      3
    );
    result[prefix + "Seed"] = normalizeJudgementAiOptionalIntegerText(
      result[prefix + "Seed"],
      0,
      2147483647
    );
    result[prefix + "StopSequences"] = normalizeJudgementAiStopSequences(
      result[prefix + "StopSequences"]
    );
  }

  function resolveMagicDataModeAndStrategy(currentScript, legacyScript, defaultScript) {
    const sourceCurrent = isPlainObject(currentScript) ? currentScript : {};
    const sourceLegacy = isPlainObject(legacyScript) ? legacyScript : {};
    const sourceDefault = isPlainObject(defaultScript) ? defaultScript : {};
    const rawRecognitionMode =
      sourceCurrent.aiReviewRecognitionMode ||
      sourceCurrent.aiReviewPipelineMode ||
      sourceCurrent.pipelineMode ||
      sourceLegacy.aiReviewRecognitionMode ||
      sourceLegacy.aiReviewPipelineMode ||
      sourceLegacy.pipelineMode;
    const legacyRecognition = String(rawRecognitionMode || "").trim().toLowerCase();
    const defaultModelMode = normalizeMagicDataModelMode(
      sourceDefault.aiReviewModelMode || sourceDefault.aiReviewRecognitionMode || "two_stage",
      "two_stage"
    );
    const defaultStrategy = hasValidMagicDataRecognitionStrategy(
      sourceDefault.aiReviewRecognitionStrategy
    )
      ? normalizeMagicDataRecognitionStrategy(sourceDefault.aiReviewRecognitionStrategy, "direct_dialect")
      : "direct_dialect";
    const hasExplicitModelMode = (function () {
      const currentMode = String(sourceCurrent.aiReviewModelMode || "").trim().toLowerCase();
      const legacyMode = String(sourceLegacy.aiReviewModelMode || "").trim().toLowerCase();
      return (
        currentMode === "two_stage" ||
        currentMode === "omni_single" ||
        legacyMode === "two_stage" ||
        legacyMode === "omni_single"
      );
    })();
    const hasExplicitStrategy = (function () {
      const currentStrategy = String(sourceCurrent.aiReviewRecognitionStrategy || "")
        .trim()
        .toLowerCase();
      const currentCompatStrategy = String(sourceCurrent.recognitionStrategy || "")
        .trim()
        .toLowerCase();
      const legacyStrategy = String(sourceLegacy.aiReviewRecognitionStrategy || "")
        .trim()
        .toLowerCase();
      const legacyCompatStrategy = String(sourceLegacy.recognitionStrategy || "")
        .trim()
        .toLowerCase();
      return (
        currentStrategy === "direct_dialect" ||
        currentStrategy === "mandarin_to_dialect" ||
        currentCompatStrategy === "direct_dialect" ||
        currentCompatStrategy === "mandarin_to_dialect" ||
        legacyStrategy === "direct_dialect" ||
        legacyStrategy === "mandarin_to_dialect" ||
        legacyCompatStrategy === "direct_dialect" ||
        legacyCompatStrategy === "mandarin_to_dialect"
      );
    })();
    let modelMode = normalizeMagicDataModelMode(
      sourceCurrent.aiReviewModelMode || sourceLegacy.aiReviewModelMode,
      defaultModelMode
    );
    let recognitionStrategy = (function () {
      if (hasValidMagicDataRecognitionStrategy(sourceCurrent.aiReviewRecognitionStrategy)) {
        return normalizeMagicDataRecognitionStrategy(sourceCurrent.aiReviewRecognitionStrategy, defaultStrategy);
      }
      if (hasValidMagicDataRecognitionStrategy(sourceCurrent.recognitionStrategy)) {
        return normalizeMagicDataRecognitionStrategy(sourceCurrent.recognitionStrategy, defaultStrategy);
      }
      if (hasValidMagicDataRecognitionStrategy(sourceLegacy.aiReviewRecognitionStrategy)) {
        return normalizeMagicDataRecognitionStrategy(sourceLegacy.aiReviewRecognitionStrategy, defaultStrategy);
      }
      if (hasValidMagicDataRecognitionStrategy(sourceLegacy.recognitionStrategy)) {
        return normalizeMagicDataRecognitionStrategy(sourceLegacy.recognitionStrategy, defaultStrategy);
      }
      return "";
    })();
    if (!recognitionStrategy) {
      recognitionStrategy = defaultStrategy;
    }
    if (legacyRecognition === "recognition_convert") {
      if (!hasExplicitStrategy) {
        recognitionStrategy = "mandarin_to_dialect";
      }
      if (!hasExplicitModelMode) {
        const singleModel = String(
          sourceCurrent.aiReviewSingleModel ||
            sourceLegacy.aiReviewSingleModel ||
            sourceCurrent.singleModel ||
            sourceLegacy.singleModel ||
            ""
        ).trim();
        modelMode = singleModel ? "omni_single" : "two_stage";
      }
    } else if (legacyRecognition === "omni_single") {
      if (!hasExplicitModelMode) {
        modelMode = "omni_single";
      }
    } else if (legacyRecognition === "two_stage" || legacyRecognition === "fun_asr_compare" || legacyRecognition === "qwen_omni_compare" || legacyRecognition === "qwen_omni_two_stage") {
      if (!hasExplicitModelMode) {
        modelMode = "two_stage";
      }
    }
    return {
      modelMode: modelMode,
      recognitionStrategy: recognitionStrategy,
      legacyRecognitionMode:
        recognitionStrategy === "mandarin_to_dialect" ? "recognition_convert" : modelMode,
    };
  }

  function readMagicDataScriptFlag(currentScript, legacyScript, key, fallback) {
    if (isPlainObject(currentScript) && hasOwn(currentScript, key)) {
      return currentScript[key] !== false;
    }
    if (isPlainObject(legacyScript) && hasOwn(legacyScript, key)) {
      return legacyScript[key] !== false;
    }
    return fallback !== false;
  }

  function normalizeMagicDataExclusiveScripts(settings) {
    const constants = getConstants();
    const definitions = getMagicDataScriptDefinitions(constants);
    const platform = settings?.platforms?.magicData;
    if (!isPlainObject(platform)) {
      return;
    }
    if (!isPlainObject(platform.scripts)) {
      platform.scripts = {};
    }
    let activeScriptId = normalizeMagicDataActiveScriptId(platform.activeScriptId);
    const enabledMap = {};

    definitions.forEach(function (definition) {
      const currentScript = isPlainObject(platform.scripts[definition.scriptKey])
        ? platform.scripts[definition.scriptKey]
        : {};
      platform.scripts[definition.scriptKey] = Object.assign({}, currentScript, {
        id: definition.scriptId,
      });
      enabledMap[definition.scriptId] =
        platform.scripts[definition.scriptKey].enabled !== false &&
        platform.scripts[definition.scriptKey].aiReviewEnabled !== false;
    });

    if (activeScriptId && enabledMap[activeScriptId] !== true) {
      activeScriptId = "";
    }

    if (!activeScriptId) {
      const firstEnabledDefinition = definitions.find(function (definition) {
        return enabledMap[definition.scriptId] === true;
      });
      if (firstEnabledDefinition) {
        activeScriptId = firstEnabledDefinition.scriptId;
      }
    }

    definitions.forEach(function (definition) {
      const scriptEnabled = activeScriptId === definition.scriptId;
      platform.scripts[definition.scriptKey].enabled = scriptEnabled;
      platform.scripts[definition.scriptKey].aiReviewEnabled = scriptEnabled;
    });
    platform.activeScriptId = activeScriptId || "";

    if (!isPlainObject(settings.scriptCenter)) {
      settings.scriptCenter = {};
    }
    if (!isPlainObject(settings.scriptCenter.projects)) {
      settings.scriptCenter.projects = {};
    }

    definitions.forEach(function (definition) {
      const scriptSettings = settings?.platforms?.magicData?.scripts?.[definition.scriptKey] || {};
      const scriptEnabled = platform.activeScriptId === definition.scriptId;
      settings.scriptCenter.projects[definition.legacyKey] = Object.assign(
        {},
        settings.scriptCenter.projects[definition.legacyKey] || {},
        {
          enabled: scriptEnabled,
          aiReviewEnabled: scriptEnabled,
          aiReviewModelMode: scriptSettings.aiReviewModelMode || "two_stage",
          aiReviewRecognitionStrategy:
            scriptSettings.aiReviewRecognitionStrategy || "direct_dialect",
          aiReviewRecognitionMode: scriptSettings.aiReviewRecognitionMode || "two_stage",
          recognitionStrategy: scriptSettings.aiReviewRecognitionStrategy || "direct_dialect",
          recognitionMode: scriptSettings.aiReviewRecognitionMode || "two_stage",
          pipelineMode: scriptSettings.aiReviewRecognitionMode || "two_stage",
        }
      );
    });
  }

  function ensureMagicDataRoot(settings) {
    const constants = getConstants();
    const defaults = clone(constants.DEFAULT_SETTINGS || {});
    const defaultPlatform = defaults?.platforms?.magicData || {
      enabled: true,
      activeScriptId: constants.MAGIC_DATA_ANNOTATOR_SCRIPT_ID || "magicDataAnnotatorAiReview",
      scripts: {
        hakkaHelper: {
          id: constants.MAGIC_DATA_ANNOTATOR_SCRIPT_ID || "magicDataAnnotatorAiReview",
          enabled: true,
          aiReviewEnabled: true,
        },
        minnanHelper: {
          id: constants.MAGIC_DATA_MINNAN_SCRIPT_ID || "magicDataMinnanAssistant",
          enabled: false,
          aiReviewEnabled: false,
        },
      },
    };

    if (!isPlainObject(settings.platforms)) {
      settings.platforms = {};
    }

    settings.platforms.magicData = deepMerge(defaultPlatform, settings.platforms.magicData || {});
    if (!isPlainObject(settings.platforms.magicData.scripts)) {
      settings.platforms.magicData.scripts = {};
    }

    const legacyHakka = settings?.scriptCenter?.projects?.magicDataAnnotator || {};
    const legacyMinnan = settings?.scriptCenter?.projects?.magicDataMinnanAssistant || {};
    const defaultHakkaScript = isPlainObject(defaultPlatform.scripts?.hakkaHelper)
      ? defaultPlatform.scripts.hakkaHelper
      : {};
    const defaultMinnanScript = isPlainObject(defaultPlatform.scripts?.minnanHelper)
      ? defaultPlatform.scripts.minnanHelper
      : {};
    const currentHakkaScript = isPlainObject(settings.platforms.magicData.scripts.hakkaHelper)
      ? settings.platforms.magicData.scripts.hakkaHelper
      : {};
    const currentMinnanScript = isPlainObject(settings.platforms.magicData.scripts.minnanHelper)
      ? settings.platforms.magicData.scripts.minnanHelper
      : {};
    const hakkaModeAndStrategy = resolveMagicDataModeAndStrategy(
      currentHakkaScript,
      legacyHakka,
      defaultHakkaScript
    );
    const minnanModeAndStrategy = resolveMagicDataModeAndStrategy(
      currentMinnanScript,
      legacyMinnan,
      defaultMinnanScript
    );

    settings.platforms.magicData.enabled = settings.platforms.magicData.enabled !== false;
    settings.platforms.magicData.activeScriptId = normalizeMagicDataActiveScriptId(
      settings.platforms.magicData.activeScriptId
    );
    settings.platforms.magicData.scripts.hakkaHelper = Object.assign(
      {},
      defaultHakkaScript,
      currentHakkaScript,
      {
        id: constants.MAGIC_DATA_ANNOTATOR_SCRIPT_ID || "magicDataAnnotatorAiReview",
        enabled: readMagicDataScriptFlag(
          currentHakkaScript,
          legacyHakka,
          "enabled",
          defaultHakkaScript.enabled
        ),
        aiReviewEnabled: readMagicDataScriptFlag(
          currentHakkaScript,
          legacyHakka,
          "aiReviewEnabled",
          defaultHakkaScript.aiReviewEnabled
        ),
        aiReviewModelMode: hakkaModeAndStrategy.modelMode,
        aiReviewRecognitionStrategy: hakkaModeAndStrategy.recognitionStrategy,
        aiReviewRecognitionMode: hakkaModeAndStrategy.legacyRecognitionMode,
        recognitionStrategy: hakkaModeAndStrategy.recognitionStrategy,
        recognitionMode: hakkaModeAndStrategy.legacyRecognitionMode,
        pipelineMode: hakkaModeAndStrategy.legacyRecognitionMode,
      }
    );
    settings.platforms.magicData.scripts.minnanHelper = Object.assign(
      {},
      defaultMinnanScript,
      currentMinnanScript,
      {
        id: constants.MAGIC_DATA_MINNAN_SCRIPT_ID || "magicDataMinnanAssistant",
        enabled: readMagicDataScriptFlag(
          currentMinnanScript,
          legacyMinnan,
          "enabled",
          defaultMinnanScript.enabled
        ),
        aiReviewEnabled: readMagicDataScriptFlag(
          currentMinnanScript,
          legacyMinnan,
          "aiReviewEnabled",
          defaultMinnanScript.aiReviewEnabled
        ),
        aiReviewModelMode: minnanModeAndStrategy.modelMode,
        aiReviewRecognitionStrategy: minnanModeAndStrategy.recognitionStrategy,
        aiReviewRecognitionMode: minnanModeAndStrategy.legacyRecognitionMode,
        recognitionStrategy: minnanModeAndStrategy.recognitionStrategy,
        recognitionMode: minnanModeAndStrategy.legacyRecognitionMode,
        pipelineMode: minnanModeAndStrategy.legacyRecognitionMode,
      }
    );
    settings.platforms.magicData.scripts.hakkaHelper.aiReviewEnableThinking = false;
    settings.platforms.magicData.scripts.hakkaHelper.enableThinking = false;
    settings.platforms.magicData.scripts.minnanHelper.aiReviewEnableThinking = false;
    settings.platforms.magicData.scripts.minnanHelper.enableThinking = false;
    if (isPlainObject(settings.scriptCenter?.projects?.magicDataAnnotator)) {
      settings.scriptCenter.projects.magicDataAnnotator.aiReviewEnableThinking = false;
      settings.scriptCenter.projects.magicDataAnnotator.enableThinking = false;
    }
    if (isPlainObject(settings.scriptCenter?.projects?.magicDataMinnanAssistant)) {
      settings.scriptCenter.projects.magicDataMinnanAssistant.aiReviewEnableThinking = false;
      settings.scriptCenter.projects.magicDataMinnanAssistant.enableThinking = false;
    }
    normalizeMagicDataExclusiveScripts(settings);

    return settings.platforms.magicData;
  }

  function ensureAbakaAiRoot(settings) {
    const constants = getConstants();
    const defaults = clone(constants.DEFAULT_SETTINGS || {});
    const defaultPlatform =
      defaults?.platforms?.abakaAi || constants.DEFAULT_ABAKA_AI_PLATFORM_SETTINGS || {
        enabled: true,
        scripts: {
          taskPageCapture: {
            id: constants.ABAKA_AI_TASK_PAGE_CAPTURE_SCRIPT_ID || "abakaAiTaskPageCapture",
            enabled: true,
              stage: "task21-inline-ai-analysis-debug",
              autoSelectSpecifyOnSameFontTrue: true,
              aiAnalysisMode: "two_stage",
              aiVisionModel: "qwen3.6-plus",
              aiOcrEnabled: false,
              aiOcrModel: "",
              aiReasoningModel: "qwen3.6-plus",
              aiSingleModel: "qwen3.6-plus",
              aiEnableThinking: false,
              aiRequestTimeoutMs: DEFAULT_AI_REQUEST_TIMEOUT_MS,
              shortcuts: {},
          },
        },
      };

    if (!isPlainObject(settings.platforms)) {
      settings.platforms = {};
    }

    settings.platforms.abakaAi = deepMerge(defaultPlatform, settings.platforms.abakaAi || {});
    if (!isPlainObject(settings.platforms.abakaAi.scripts)) {
      settings.platforms.abakaAi.scripts = {};
    }

    const defaultScript = isPlainObject(defaultPlatform.scripts?.taskPageCapture)
      ? defaultPlatform.scripts.taskPageCapture
      : {};
    const currentScript = isPlainObject(settings.platforms.abakaAi.scripts.taskPageCapture)
      ? settings.platforms.abakaAi.scripts.taskPageCapture
      : {};
      const legacyAiDebugModel = normalizeAbakaAiModel(
        currentScript.aiDebugModel,
        defaultScript.aiSingleModel || "qwen3.6-plus"
      );
    settings.platforms.abakaAi.enabled = settings.platforms.abakaAi.enabled !== false;
    settings.platforms.abakaAi.scripts.taskPageCapture = Object.assign({}, defaultScript, currentScript, {
      id: constants.ABAKA_AI_TASK_PAGE_CAPTURE_SCRIPT_ID || "abakaAiTaskPageCapture",
      enabled: currentScript.enabled !== false,
      stage: String(
        currentScript.stage || defaultScript.stage || "task21-inline-ai-analysis-debug"
      ),
      autoSelectSpecifyOnSameFontTrue:
        currentScript.autoSelectSpecifyOnSameFontTrue !== false,
      aiAnalysisMode: normalizeAbakaAiAnalysisMode(
        currentScript.aiAnalysisMode,
        defaultScript.aiAnalysisMode || "two_stage"
      ),
        aiVisionModel: normalizeAbakaAiModel(
          currentScript.aiVisionModel,
          defaultScript.aiVisionModel || "qwen3.6-plus",
          constants.ABAKA_AI_TASK21_VISION_MODEL_OPTIONS || []
        ),
        aiOcrEnabled:
          typeof currentScript.aiOcrEnabled === "boolean"
            ? currentScript.aiOcrEnabled === true
            : defaultScript.aiOcrEnabled === true,
        aiOcrModel: normalizeAbakaAiModel(
          currentScript.aiOcrModel,
          defaultScript.aiOcrModel || "",
          constants.ABAKA_AI_TASK21_OCR_MODEL_OPTIONS || []
        ),
        aiReasoningModel: normalizeAbakaAiModel(
          currentScript.aiReasoningModel,
          defaultScript.aiReasoningModel || "qwen3.6-plus",
          constants.ABAKA_AI_TASK21_REASONING_MODEL_OPTIONS || []
        ),
        aiSingleModel: normalizeAbakaAiModel(
          currentScript.aiSingleModel || legacyAiDebugModel,
          defaultScript.aiSingleModel || "qwen3.6-plus",
          constants.ABAKA_AI_TASK21_SINGLE_MODEL_OPTIONS || []
        ),
      aiEnableThinking: false,
      aiRequestTimeoutMs: normalizeAbakaAiRequestTimeout(
        currentScript.aiRequestTimeoutMs,
        defaultScript.aiRequestTimeoutMs || DEFAULT_AI_REQUEST_TIMEOUT_MS
      ),
      shortcuts: normalizeAbakaAiTask21Shortcuts(
        currentScript.shortcuts,
        defaultScript.shortcuts || {}
      ),
    });

    return settings.platforms.abakaAi;
  }

  function ensureHaitianUtransRoot(settings) {
    const constants = getConstants();
    const defaults = clone(constants.DEFAULT_SETTINGS || {});
    const defaultPlatform =
      defaults?.platforms?.haitianUtrans || constants.DEFAULT_HAITIAN_UTRANS_PLATFORM_SETTINGS || {
        enabled: true,
        scripts: {
          audioDownloadHelper: {
            id:
              constants.HAITIAN_UTRANS_AUDIO_DOWNLOAD_HELPER_SCRIPT_ID ||
              "haitianUtransAudioDownloadHelper",
            enabled: true,
          },
        },
      };

    if (!isPlainObject(settings.platforms)) {
      settings.platforms = {};
    }

    settings.platforms.haitianUtrans = deepMerge(
      defaultPlatform,
      settings.platforms.haitianUtrans || {}
    );
    if (!isPlainObject(settings.platforms.haitianUtrans.scripts)) {
      settings.platforms.haitianUtrans.scripts = {};
    }

    const defaultScript = isPlainObject(defaultPlatform.scripts?.audioDownloadHelper)
      ? defaultPlatform.scripts.audioDownloadHelper
      : {};
    const currentScript = isPlainObject(settings.platforms.haitianUtrans.scripts.audioDownloadHelper)
      ? settings.platforms.haitianUtrans.scripts.audioDownloadHelper
      : {};

    settings.platforms.haitianUtrans.enabled =
      settings.platforms.haitianUtrans.enabled !== false;
    settings.platforms.haitianUtrans.scripts.audioDownloadHelper = Object.assign(
      {},
      defaultScript,
      currentScript,
      {
        id:
          constants.HAITIAN_UTRANS_AUDIO_DOWNLOAD_HELPER_SCRIPT_ID ||
          "haitianUtransAudioDownloadHelper",
        enabled: currentScript.enabled !== false,
      }
    );

    return settings.platforms.haitianUtrans;
  }

  function getProjectDefinitions(constants) {
    return isPlainObject(constants?.SCRIPT_PROJECTS) ? constants.SCRIPT_PROJECTS : {};
  }

  function normalizeProjectId(projectId, constants) {
    const definitions = getProjectDefinitions(constants);
    if (typeof projectId === "string" && hasOwn(definitions, projectId)) {
      return projectId;
    }

    return String(constants?.TRANSCRIPTION_PROJECT_ID || "transcription");
  }

  function pickAsrFields(source, allowedKeys) {
    const result = {};
    const input = isPlainObject(source) ? source : {};
    const keys = Array.isArray(allowedKeys) ? allowedKeys : [];

    keys.forEach(function (key) {
      if (hasOwn(input, key)) {
        result[key] = clone(input[key]);
      }
    });

    return result;
  }

  function sanitizeTranscriptionAsrConfig(config, fallback) {
    const defaults = isPlainObject(fallback) ? fallback : {};
    const next = deepMerge(defaults, isPlainObject(config) ? config : {});

    next.autoAssignCheckTasks = false;
    next.autoAssignTaskKeyword = "";
    next.autoAssignTargetUser = "";
    next.autoAssignBatchSize = 0;
    next.autoAssignAllTasks = false;
    next.autoAssignFetchAll = false;
    next.autoBatchSubmit = false;
    next.autoReceiveOnSubmit = false;
    next.validateBeforeSubmit = false;
    next.autoSubmitAfterValidation = false;
    next.qwenApiKey = "";
    next.useAdvancedRules = false;
    next.qwenModel = "";

    next.shortcutSubmit = null;
    next.shortcutFixPunctuationAll = null;
    next.shortcutToggleAutoBatchSubmit = null;
    next.shortcutToggleAutoSubmitAfterValidation = null;
    next.shortcutLeaderboard = null;
    next.shortcutAllValid = null;
    next.shortcutValidateItems = null;
    next.shortcutRemoveAllSpaces = null;

    next.resetRateValue = normalizeClampedNumber(next.resetRateValue, 1.5, 0.25, 8, 2);
    next.playbackRateValue = normalizeClampedNumber(
      hasOwn(next, "playbackRateValue") ? next.playbackRateValue : next.resetRateValue,
      next.resetRateValue,
      0.25,
      8,
      2
    );
    next.rateStepValue = normalizeClampedNumber(next.rateStepValue, 0.25, 0.05, 2, 2);
    next.seekStepSeconds = normalizeClampedNumber(next.seekStepSeconds, 0.5, 0.1, 10, 2);
    next.volumeValue = normalizeClampedNumber(next.volumeValue, 100, 0, 1000, 0);
    next.statsUploadEnabled = true;
    next.statsUploadTimes = normalizeTimeList(next.statsUploadTimes, ["10:00", "16:00"]);
    next.statsUploadJitterMinutes = Math.max(
      0,
      Math.min(120, normalizeNumber(next.statsUploadJitterMinutes, 10))
    );
    next.statsAutoUploadOnSchedule = true;
    next.statsUploadRequestTimeoutMs = Math.max(
      1000,
      Math.min(120000, normalizeNumber(next.statsUploadRequestTimeoutMs, 20000))
    );
    next.statsUploadEndpoint = (function () {
      const text = String(next.statsUploadEndpoint || "").trim();
      const constants = getConstants();
      const serverEndpoint =
        constants.TRANSCRIPTION_STATS_SERVER_ENDPOINT ||
        "https://script.aisiyunling.com/api/alibaba-labelx/asr-transcription/statistics/upload";
      const localEndpoint =
        constants.TRANSCRIPTION_STATS_LOCAL_ENDPOINT ||
        "http://127.0.0.1:3333/api/alibaba-labelx/asr-transcription/statistics/upload";
      if (!text) {
        return serverEndpoint;
      }
      if (text.indexOf("127.0.0.1:3333") >= 0 || text.indexOf("localhost:3333") >= 0) {
        return localEndpoint;
      }
      if (text.indexOf("/api/asr-transcription/statistics/upload") >= 0) {
        return text;
      }
      if (text.indexOf("/api/alibaba-labelx/asr-transcription/statistics/upload") >= 0) {
        return text;
      }
      return serverEndpoint;
    })();

    return next;
  }

  function ensureScriptCenter(settings) {
    const constants = getConstants();
    const defaults = clone(constants.DEFAULT_SETTINGS || {});
    const platform = ensurePlatformRoot(settings);
    const defaultCenter = defaults?.platforms?.alibabaLabelx?.scriptCenter || {
      activeProjectId: constants.TRANSCRIPTION_PROJECT_ID || "transcription",
      projects: {},
    };
    const activeProjectId = normalizeProjectId(
      platform?.scriptCenter?.activeProjectId || defaultCenter.activeProjectId,
      constants
    );
    const definitions = getProjectDefinitions(constants);

    platform.scriptCenter = deepMerge(defaultCenter, platform.scriptCenter || {});
    platform.scriptCenter.activeProjectId = activeProjectId;

    if (!isPlainObject(platform.scriptCenter.projects)) {
      platform.scriptCenter.projects = {};
    }

    Object.keys(definitions).forEach(function (projectId) {
      const definition = definitions[projectId];
      const defaultProject = defaultCenter?.projects?.[projectId] || {};
      const nextProject = deepMerge(defaultProject, platform.scriptCenter.projects[projectId] || {});

      nextProject.id = definition.id;
      nextProject.label = definition.label;
      nextProject.shortLabel = definition.shortLabel;
      nextProject.description = definition.description;
      nextProject.note = definition.note;
      nextProject.capabilityScope = definition.capabilityScope;
      nextProject.active = projectId === activeProjectId;

      if (projectId === constants.JUDGEMENT_PROJECT_ID) {
        nextProject.asrConfig = normalizeJudgementAsrConfig(
          deepMerge(
            constants.DEFAULT_JUDGEMENT_ASR_CONFIG || {},
            nextProject.asrConfig || {}
          )
        );
      } else {
        const fallbackAsrConfig =
          isPlainObject(nextProject.asrConfig) && Object.keys(nextProject.asrConfig).length > 0
            ? nextProject.asrConfig
            : settings.asr || {};
        nextProject.asrConfig = sanitizeTranscriptionAsrConfig(
          fallbackAsrConfig,
          constants.DEFAULT_ASR_CONFIG || {}
        );
      }

      platform.scriptCenter.projects[projectId] = nextProject;
    });

    return platform.scriptCenter;
  }

  function resolveProjectAsrConfig(settings, projectId) {
    const constants = getConstants();
    const scriptCenter = ensureScriptCenter(settings);
    const normalizedProjectId = normalizeProjectId(projectId, constants);
    const projectConfig = scriptCenter?.projects?.[normalizedProjectId]?.asrConfig || {};
    const defaultProjectConfig =
      normalizedProjectId === constants.JUDGEMENT_PROJECT_ID
        ? constants.DEFAULT_JUDGEMENT_ASR_CONFIG || {}
        : constants.DEFAULT_ASR_CONFIG || {};

    const nextConfig = deepMerge(defaultProjectConfig, projectConfig);
    return normalizedProjectId === constants.JUDGEMENT_PROJECT_ID
      ? normalizeJudgementAsrConfig(nextConfig)
      : sanitizeTranscriptionAsrConfig(nextConfig, constants.DEFAULT_ASR_CONFIG || {});
  }

  function syncProjectCenterFromActiveAsr(settings) {
    const constants = getConstants();
    const scriptCenter = ensureScriptCenter(settings);
    const activeProjectId = normalizeProjectId(scriptCenter.activeProjectId, constants);

    Object.keys(scriptCenter.projects || {}).forEach(function (projectId) {
      scriptCenter.projects[projectId].active = projectId === activeProjectId;
    });

    if (activeProjectId === constants.JUDGEMENT_PROJECT_ID) {
      scriptCenter.projects[activeProjectId].asrConfig = normalizeJudgementAsrConfig(
        deepMerge(
          constants.DEFAULT_JUDGEMENT_ASR_CONFIG || {},
          pickAsrFields(settings.asr || {}, constants.JUDGEMENT_PROJECT_ASR_KEYS || [])
        )
      );
      return;
    }

    scriptCenter.projects[activeProjectId].asrConfig = sanitizeTranscriptionAsrConfig(
      settings.asr || {},
      constants.DEFAULT_ASR_CONFIG || {}
    );
  }

  function getPatchedActiveProjectId(patch) {
    const projectId = patch?.platforms?.alibabaLabelx?.scriptCenter?.activeProjectId;
    return typeof projectId === "string" ? projectId : null;
  }

  function syncNestedFromAsr(settings) {
    const constants = getConstants();
    const defaults = clone(constants.DEFAULT_SETTINGS || {});
    const defaultPlatform = defaults?.platforms?.alibabaLabelx || {};
    const defaultAsr = defaults?.asr || constants.DEFAULT_ASR_CONFIG || {};
    const platform = ensurePlatformRoot(settings);
    const asr = sanitizeTranscriptionAsrConfig(settings.asr || {}, defaultAsr);
    const debug = deepMerge(defaults.debug || { enabled: false }, settings.debug || {});

    platform.annotation = deepMerge(defaultPlatform.annotation || {}, platform.annotation || {});
    platform.automation = deepMerge(defaultPlatform.automation || {}, platform.automation || {});
    platform.aiPunctuation = deepMerge(
      defaultPlatform.aiPunctuation || {},
      platform.aiPunctuation || {}
    );
    platform.dictionary = deepMerge(defaultPlatform.dictionary || {}, platform.dictionary || {});
    platform.safety = deepMerge(defaultPlatform.safety || {}, platform.safety || {});
    platform.legacyServer = deepMerge(
      defaultPlatform.legacyServer || {},
      platform.legacyServer || {}
    );
    platform.reporting = deepMerge(defaultPlatform.reporting || {}, platform.reporting || {});

    platform.annotation.itemsPerPage = asr.itemsPerPage || platform.annotation.itemsPerPage;
    platform.annotation.autoPlay = asr.autoPlay === true;
    platform.annotation.defaultValid = asr.defaultValid === true;
    platform.annotation.fillOnValid = asr.fillOnValid !== false;
    platform.annotation.clearOnInvalid = asr.clearOnInvalid !== false;
    platform.annotation.autoNext = asr.autoNext === true;
    platform.annotation.autoResetRate = asr.autoResetRate === true;
    platform.annotation.resetRateValue = normalizeNumber(asr.resetRateValue, 1.5);
    platform.annotation.playbackRateValue = normalizeNumber(
      hasOwn(asr, "playbackRateValue") ? asr.playbackRateValue : asr.resetRateValue,
      platform.annotation.resetRateValue || 1.5
    );
    platform.annotation.rateStepValue = normalizeNumber(asr.rateStepValue, 0.25);
    platform.annotation.seekStepSeconds = normalizeNumber(asr.seekStepSeconds, 0.5);
    platform.annotation.volumeValue = normalizeNumber(asr.volumeValue, 100);
    platform.annotation.autoClearInvalidValidation = asr.autoClearInvalidValidation === true;
    platform.annotation.autoFillOnValidValidation = asr.autoFillOnValidValidation === true;
    platform.annotation.autoFillOnLoad = asr.autoFillOnLoad === true;
    platform.annotation.numConvertMode =
      asr.numConvertMode === "蜂鸟众包" ? "蜂鸟众包" : "千问";
    platform.annotation.customReplacements = normalizeReplacementRules(
      asr.customReplacements || platform.annotation.customReplacements
    );
    platform.annotation.customRates = normalizeCustomRates(
      asr.customRates,
      defaultPlatform.annotation?.customRates || []
    );

    const defaultShortcuts = defaultPlatform.annotation?.shortcuts || {};
    const compatibilityMap = constants.SHORTCUT_COMPATIBILITY_MAP || {};
    platform.annotation.shortcuts = deepMerge(defaultShortcuts, platform.annotation.shortcuts || {});
    Object.keys(compatibilityMap).forEach(function (shortcutKey) {
      const asrKey = compatibilityMap[shortcutKey];
      platform.annotation.shortcuts[shortcutKey] = normalizeShortcut(
        asr[asrKey],
        platform.annotation.shortcuts[shortcutKey]
      );
    });
    delete platform.annotation.shortcuts.markAllValidFill;
    delete platform.annotation.shortcuts.validatePage;
    delete platform.annotation.shortcuts.removeAllSpaces;

    platform.automation.autoAssignCheckTasks = false;
    platform.automation.autoAssignTaskKeyword = "";
    platform.automation.autoAssignTargetUser = "";
    platform.automation.autoAssignBatchSize = 0;
    platform.automation.autoAssignAllTasks = false;
    platform.automation.autoAssignFetchAll = false;
    platform.automation.autoAssignPollIntervalMs = Math.max(
      5000,
      normalizeNumber(asr.autoAssignPollIntervalMs, platform.automation.autoAssignPollIntervalMs || 60000)
    );
    platform.automation.autoBatchSubmit = false;
    platform.automation.autoFillOnLoad = asr.autoFillOnLoad === true;
    platform.automation.validateBeforeSubmit = false;
    platform.automation.autoSubmitAfterValidation = false;
    platform.automation.autoReceiveOnSubmit = false;
    platform.automation.autoNavigateNextTask = false;
    platform.automation.autoPlay = asr.autoPlay === true;
    platform.automation.autoNext = asr.autoNext === true;
    platform.automation.defaultValid = asr.defaultValid === true;

    platform.aiPunctuation.apiKey = "";
    platform.aiPunctuation.useAdvancedRules = false;
    platform.aiPunctuation.model = "";

    platform.dictionary.customReplacements = normalizeReplacementRules(
      asr.customReplacements || platform.dictionary.customReplacements
    );
    platform.reporting.itemsPerPage = asr.itemsPerPage || platform.reporting.itemsPerPage;
    if (platform.reporting.exportUploadEnabled !== false) {
      platform.reporting.exportUploadEnabled = true;
    }

    platform.legacyServer.useDebugApiBaseUrl = debug.enabled === true;
    settings.debug = debug;
  }

  function syncCompatibilityFromNested(settings) {
    const constants = getConstants();
    const defaults = clone(constants.DEFAULT_SETTINGS || {});
    const defaultAsr = defaults?.asr || constants.DEFAULT_ASR_CONFIG || {};
    const platform = ensurePlatformRoot(settings);
    const annotation = platform.annotation || {};
    const automation = platform.automation || {};
    const aiPunctuation = platform.aiPunctuation || platform.ai || {};
    const dictionary = platform.dictionary || {};
    const legacyServer = platform.legacyServer || {};
    const reporting = platform.reporting || {};
    const compatibilityMap = constants.SHORTCUT_COMPATIBILITY_MAP || {};
    const nextAsr = sanitizeTranscriptionAsrConfig(settings.asr || {}, defaultAsr);

    nextAsr.itemsPerPage = reporting.itemsPerPage || annotation.itemsPerPage || nextAsr.itemsPerPage;
    nextAsr.autoPlay = annotation.autoPlay === true || automation.autoPlay === true;
    nextAsr.defaultValid =
      annotation.defaultValid === true || automation.defaultValid === true;
    nextAsr.fillOnValid = annotation.fillOnValid !== false;
    nextAsr.clearOnInvalid = annotation.clearOnInvalid !== false;
    nextAsr.autoNext = annotation.autoNext === true || automation.autoNext === true;
    nextAsr.autoAssignCheckTasks = false;
    nextAsr.autoAssignTaskKeyword = "";
    nextAsr.autoAssignTargetUser = "";
    nextAsr.autoAssignBatchSize = 0;
    nextAsr.autoAssignAllTasks = false;
    nextAsr.autoAssignFetchAll = false;
    nextAsr.autoAssignPollIntervalMs = 60000;
    nextAsr.autoBatchSubmit = false;
    nextAsr.autoResetRate = annotation.autoResetRate === true;
    nextAsr.resetRateValue = normalizeNumber(annotation.resetRateValue, 1.5);
    nextAsr.playbackRateValue = normalizeNumber(
      annotation.playbackRateValue,
      nextAsr.resetRateValue
    );
    nextAsr.rateStepValue = normalizeNumber(annotation.rateStepValue, 0.25);
    nextAsr.seekStepSeconds = normalizeNumber(annotation.seekStepSeconds, 0.5);
    nextAsr.volumeValue = normalizeNumber(annotation.volumeValue, 100);
    nextAsr.autoReceiveOnSubmit = false;
    nextAsr.validateBeforeSubmit = false;
    nextAsr.autoClearInvalidValidation = annotation.autoClearInvalidValidation === true;
    nextAsr.autoFillOnValidValidation = annotation.autoFillOnValidValidation === true;
    nextAsr.autoSubmitAfterValidation = false;
    nextAsr.autoFillOnLoad =
      annotation.autoFillOnLoad === true || automation.autoFillOnLoad === true;
    nextAsr.qwenApiKey = "";
    nextAsr.useAdvancedRules = false;
    nextAsr.qwenModel = "";
    nextAsr.numConvertMode =
      annotation.numConvertMode === "蜂鸟众包" ? "蜂鸟众包" : "千问";
    nextAsr.customReplacements = normalizeReplacementRules(
      dictionary.customReplacements || annotation.customReplacements
    );
    nextAsr.customRates = normalizeCustomRates(
      annotation.customRates,
      defaults?.platforms?.alibabaLabelx?.annotation?.customRates || []
    );

    Object.keys(compatibilityMap).forEach(function (shortcutKey) {
      const asrKey = compatibilityMap[shortcutKey];
      nextAsr[asrKey] = normalizeShortcut(
        annotation.shortcuts?.[shortcutKey],
        nextAsr[asrKey]
      );
    });
    if (isPlainObject(annotation.shortcuts)) {
      delete annotation.shortcuts.markAllValidFill;
      delete annotation.shortcuts.validatePage;
      delete annotation.shortcuts.removeAllSpaces;
    }

    settings.asr = sanitizeTranscriptionAsrConfig(nextAsr, defaultAsr);
    settings.debug = deepMerge(defaults.debug || {}, settings.debug || {});
    settings.debug.enabled = legacyServer.useDebugApiBaseUrl === true;
    settings.cache = deepMerge(defaults.cache || {}, settings.cache || {});
    settings.meta = deepMerge(defaults.meta || {}, settings.meta || {});
  }

  function syncGlobalBackendDerivedEndpoints(settings) {
    const constants = getConstants();
    const transcriptionProjectId = constants.TRANSCRIPTION_PROJECT_ID || "transcription";
    const judgementProjectId = constants.JUDGEMENT_PROJECT_ID || "judgement";
    const activeProjectId =
      settings?.platforms?.alibabaLabelx?.scriptCenter?.activeProjectId || transcriptionProjectId;
    const transcriptionConfig =
      settings?.platforms?.alibabaLabelx?.scriptCenter?.projects?.[transcriptionProjectId]?.asrConfig;
    const judgementConfig =
      settings?.platforms?.alibabaLabelx?.scriptCenter?.projects?.[judgementProjectId]?.asrConfig;
    const dataBakerScript = settings?.platforms?.dataBaker?.scripts?.roundOneQuality;
    const aishellMinnanScript = settings?.platforms?.aishellTech?.scripts?.minnanHelper;
    const aishellVietnameseScript = settings?.platforms?.aishellTech?.scripts?.vietnameseHelper;
    const aishellThaiScript = settings?.platforms?.aishellTech?.scripts?.thaiHelper;

    if (transcriptionConfig && typeof transcriptionConfig === "object") {
      transcriptionConfig.statsUploadEndpoint = buildBackendUrlFromSettingsLocal(
        constants.TRANSCRIPTION_STATS_UPLOAD_PATH ||
          "/api/alibaba-labelx/asr-transcription/statistics/upload",
        settings
      );
    }
    if (judgementConfig && typeof judgementConfig === "object") {
      judgementConfig.statsUploadEndpoint = buildBackendUrlFromSettingsLocal(
        constants.JUDGEMENT_STATS_UPLOAD_PATH ||
          "/api/alibaba-labelx/asr-judgement/statistics/upload",
        settings
      );
      judgementConfig.aiSuggestionEndpoint = buildBackendUrlFromSettingsLocal(
        constants.JUDGEMENT_AI_SUGGEST_PATH ||
          "/api/alibaba-labelx/asr-judgement/ai/suggest",
        settings
      );
    }
    if (settings.asr && typeof settings.asr === "object") {
      settings.asr.statsUploadEndpoint = buildBackendUrlFromSettingsLocal(
        activeProjectId === judgementProjectId
          ? constants.JUDGEMENT_STATS_UPLOAD_PATH ||
              "/api/alibaba-labelx/asr-judgement/statistics/upload"
          : constants.TRANSCRIPTION_STATS_UPLOAD_PATH ||
              "/api/alibaba-labelx/asr-transcription/statistics/upload",
        settings
      );
      if (activeProjectId === judgementProjectId) {
        settings.asr.aiSuggestionEndpoint = buildBackendUrlFromSettingsLocal(
          constants.JUDGEMENT_AI_SUGGEST_PATH ||
            "/api/alibaba-labelx/asr-judgement/ai/suggest",
          settings
        );
      }
    }
    if (dataBakerScript && typeof dataBakerScript === "object") {
      dataBakerScript.aiRecommendEndpoint = buildBackendUrlFromSettingsLocal(
        constants.DATABAKER_AI_RECOMMEND_PATH ||
          "/api/data-baker/round-one-quality/ai/recommend",
        settings
      );
    }
    if (aishellMinnanScript && typeof aishellMinnanScript === "object") {
      aishellMinnanScript.aiRecommendEndpoint = buildBackendUrlFromSettingsLocal(
        constants.AISHELL_TECH_AI_RECOMMEND_PATH ||
          "/api/aishell-tech/minnan-helper/ai/recommend",
        settings
      );
    }
    if (aishellVietnameseScript && typeof aishellVietnameseScript === "object") {
      aishellVietnameseScript.aiRecommendEndpoint = buildBackendUrlFromSettingsLocal(
        constants.AISHELL_TECH_VIETNAMESE_AI_RECOMMEND_PATH ||
          "/api/aishell-tech/vietnamese-helper/ai/recommend",
        settings
      );
    }
    if (aishellThaiScript && typeof aishellThaiScript === "object") {
      aishellThaiScript.aiRecommendEndpoint = buildBackendUrlFromSettingsLocal(
        constants.AISHELL_TECH_THAI_AI_RECOMMEND_PATH ||
          "/api/aishell-tech/thai-helper/ai/recommend",
        settings
      );
    }
  }

  function ensureJdTtsAnnotationRoot(settings) {
    const constants = getConstants();
    const defaults = clone(constants.DEFAULT_SETTINGS || {});
    const defaultPlatform =
      defaults?.platforms?.jdTtsAnnotation ||
      constants.DEFAULT_JD_TTS_ANNOTATION_PLATFORM_SETTINGS || {
        enabled: false,
        activeScriptId: "",
        scripts: {
          shanghaineseHelper: {
            id: constants.JD_TTS_SHANGHAINESE_SCRIPT_ID || "jdTtsShanghaineseAssistant",
            enabled: false,
            aiRecommendEnabled: false,
            aiRecommendEndpoint:
              constants.JD_TTS_SHANGHAINESE_AI_RECOMMEND_SERVER_ENDPOINT ||
              "https://script.aisiyunling.com/api/jd-tts-annotation/shanghainese-helper/ai/recommend",
            aiRecommendRequestTimeoutMs: DEFAULT_AI_REQUEST_TIMEOUT_MS,
            aiRecommendSingleModel: "qwen3.5-omni-plus",
            aiRecommendSinglePrompt: "",
          },
        },
      };
    if (!isPlainObject(settings.platforms)) settings.platforms = {};
    const sourcePlatform = isPlainObject(settings.platforms.jdTtsAnnotation)
      ? settings.platforms.jdTtsAnnotation
      : {};
    const scriptId = constants.JD_TTS_SHANGHAINESE_SCRIPT_ID || "jdTtsShanghaineseAssistant";
    const platform = {
      enabled: sourcePlatform.enabled === true,
      activeScriptId: "",
      scripts: {
        shanghaineseHelper: normalizeJdTtsShanghaineseConfig(
          sourcePlatform.scripts?.shanghaineseHelper,
          defaultPlatform.scripts?.shanghaineseHelper || {}
        ),
      },
    };
    platform.activeScriptId =
      platform.enabled && platform.scripts.shanghaineseHelper.enabled ? scriptId : "";
    settings.platforms.jdTtsAnnotation = platform;
    return platform;
  }

  function normalizeSettings(input) {
    const constants = getConstants();
    const defaults = clone(constants.DEFAULT_SETTINGS || {});
    const settings = deepMerge(defaults, input || {});
    const currentSchemaVersion = Number(input?.meta?.schemaVersion || 0);

    ensureScriptCenter(settings);
    ensureLightwheelRoot(settings);
    ensureDataBakerRoot(settings);
    ensureAishellTechRoot(settings, input || {});
    ensureMagicDataRoot(settings);
    ensureAbakaAiRoot(settings);
    ensureHaitianUtransRoot(settings);
    ensureJdTtsAnnotationRoot(settings);
    ensureGlobalBackendEndpointMode(settings, input || {}, defaults);
    ensureGlobalBackendBaseUrls(settings, input || {}, defaults);

    const activeProjectId =
      settings?.platforms?.alibabaLabelx?.scriptCenter?.activeProjectId ||
      constants.TRANSCRIPTION_PROJECT_ID ||
      "transcription";
    const storedJudgementConfig =
      input?.platforms?.alibabaLabelx?.scriptCenter?.projects?.[
        constants.JUDGEMENT_PROJECT_ID
      ]?.asrConfig || {};
    if (
      activeProjectId === constants.JUDGEMENT_PROJECT_ID &&
      !hasOwn(storedJudgementConfig, "itemsPerPage")
    ) {
      settings.asr = isPlainObject(settings.asr) ? settings.asr : {};
      settings.asr.itemsPerPage =
        constants.DEFAULT_JUDGEMENT_ASR_CONFIG?.itemsPerPage || "50 条/页";
    }

    if (currentSchemaVersion < 12) {
      const judgementProject =
        settings?.platforms?.alibabaLabelx?.scriptCenter?.projects?.[constants.JUDGEMENT_PROJECT_ID] || null;
      const judgementConfigsToPatch = [];
      if (judgementProject && isPlainObject(judgementProject.asrConfig)) {
        judgementConfigsToPatch.push(judgementProject.asrConfig);
      }
      if (activeProjectId === constants.JUDGEMENT_PROJECT_ID && isPlainObject(settings.asr)) {
        judgementConfigsToPatch.push(settings.asr);
      }

      judgementConfigsToPatch.forEach(function (asrConfig) {
        if (!hasOwn(asrConfig, "compactCardEnabled")) {
          asrConfig.compactCardEnabled =
            constants.DEFAULT_JUDGEMENT_ASR_CONFIG?.compactCardEnabled !== false;
        }

        if (!isPlainObject(asrConfig.shortcuts)) {
          asrConfig.shortcuts = {};
        }

        ["volumeUp", "volumeDown", "volumeReset"].forEach(function (shortcutKey) {
          if (
            !hasOwn(asrConfig.shortcuts, shortcutKey) ||
            asrConfig.shortcuts[shortcutKey] === null
          ) {
            asrConfig.shortcuts[shortcutKey] = clone(
              constants.DEFAULT_JUDGEMENT_ASR_CONFIG?.shortcuts?.[shortcutKey] || null
            );
          }
        });
      });
    }

    if (currentSchemaVersion < 13) {
      const judgementProject =
        settings?.platforms?.alibabaLabelx?.scriptCenter?.projects?.[constants.JUDGEMENT_PROJECT_ID] || null;
      const judgementConfigsToPatch = [];
      if (judgementProject && isPlainObject(judgementProject.asrConfig)) {
        judgementConfigsToPatch.push(judgementProject.asrConfig);
      }
      if (activeProjectId === constants.JUDGEMENT_PROJECT_ID && isPlainObject(settings.asr)) {
        judgementConfigsToPatch.push(settings.asr);
      }

      judgementConfigsToPatch.forEach(function (asrConfig) {
        asrConfig.asrDiffColors = normalizeJudgementAsrDiffColors(asrConfig.asrDiffColors);
      });
    }

    if (currentSchemaVersion < 6) {
      const judgementProject =
        settings?.platforms?.alibabaLabelx?.scriptCenter?.projects?.[constants.JUDGEMENT_PROJECT_ID] || null;
      if (judgementProject && isPlainObject(judgementProject.asrConfig)) {
        if (!isPlainObject(judgementProject.asrConfig.shortcuts)) {
          judgementProject.asrConfig.shortcuts = {};
        }

        [
          "choiceFirstBetter",
          "choiceSecondBetter",
          "choiceBothBad",
          "choiceUnsure",
          "choiceOtherDialect",
          "playPause",
        ].forEach(function (shortcutKey) {
          if (
            !hasOwn(judgementProject.asrConfig.shortcuts, shortcutKey) ||
            judgementProject.asrConfig.shortcuts[shortcutKey] === null
          ) {
            judgementProject.asrConfig.shortcuts[shortcutKey] = clone(
              constants.DEFAULT_JUDGEMENT_ASR_CONFIG?.shortcuts?.[shortcutKey] || null
            );
          }
        });
      }
    }

    syncNestedFromAsr(settings);
    syncCompatibilityFromNested(settings);
    syncProjectCenterFromActiveAsr(settings);
    settings.stage = defaults.stage || settings.stage || "mv3-legacy-migration";
    settings.meta = deepMerge(defaults.meta || {}, settings.meta || {});
    settings.meta.backendEndpointMode = normalizeBackendEndpointMode(
      settings.meta.backendEndpointMode,
      defaults?.meta?.backendEndpointMode || "server"
    );
    settings.meta.backendBaseUrls = getBackendBaseUrlsFromSettingsLocal(settings, defaults);
    settings.meta.publicCenterPlatformOrder = normalizeStringList(
      settings.meta.publicCenterPlatformOrder
    );
    syncGlobalBackendDerivedEndpoints(settings);
    settings.meta.schemaVersion = constants.SCHEMA_VERSION || 7;
    return settings;
  }

  function normalizeAiUsageOperatorName(value) {
    return String(value === undefined || value === null ? "" : value)
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 40);
  }

  function getExtensionRuntimeInfo() {
    let extensionId = "";
    let extensionVersion = "";
    try {
      extensionId = String(chrome?.runtime?.id || "").trim().slice(0, 80);
      extensionVersion = String(chrome?.runtime?.getManifest?.()?.version || "").trim().slice(0, 32);
    } catch (_error) {
      extensionId = "";
      extensionVersion = "";
    }
    return { extensionId, extensionVersion };
  }

  function getAiUsageStorageStatus(error) {
    return isExtensionContextInvalidatedError(error)
      ? "extension-context-invalidated"
      : "unavailable";
  }

  async function readAiUsageOperatorState() {
    const runtimeInfo = getExtensionRuntimeInfo();
    try {
      const settings = await getSettings();
      const operatorName = normalizeAiUsageOperatorName(settings?.meta?.aiUsageOperatorName);
      return Object.assign({}, runtimeInfo, {
        operatorName,
        configured: Boolean(operatorName),
        storageStatus: "ready",
      });
    } catch (error) {
      return Object.assign({}, runtimeInfo, {
        operatorName: "",
        configured: false,
        storageStatus: getAiUsageStorageStatus(error),
      });
    }
  }

  async function saveAiUsageOperatorName(operatorName) {
    const expectedOperatorName = normalizeAiUsageOperatorName(operatorName);
    try {
      await patchSettings({
        meta: {
          aiUsageOperatorName: expectedOperatorName,
        },
      });
    } catch (error) {
      return Object.assign({}, getExtensionRuntimeInfo(), {
        operatorName: "",
        configured: false,
        persisted: false,
        storageStatus: getAiUsageStorageStatus(error),
      });
    }

    const state = await readAiUsageOperatorState();
    return Object.assign({}, state, {
      persisted:
        state.storageStatus === "ready" && state.operatorName === expectedOperatorName,
    });
  }

  async function getSettings() {
    const stored = await getStoredValue();
    return normalizeSettings(stored);
  }

  async function saveSettings(nextSettings) {
    const normalized = normalizeSettings(nextSettings);
    await setStoredValue(normalized);
    return normalized;
  }

  async function patchSettings(patch) {
    const current = await getSettings();
    const next = deepMerge(current, patch || {});
    const constants = getConstants();
    const patchedProjectId = getPatchedActiveProjectId(patch);

    if (patchedProjectId && !isPlainObject(patch?.asr)) {
      next.asr = resolveProjectAsrConfig(next, normalizeProjectId(patchedProjectId, constants));
    }

    return saveSettings(next);
  }

  async function isPlatformEnabled(platformId) {
    const settings = await getSettings();
    return Boolean(settings.platforms?.[platformId || "alibabaLabelx"]?.enabled);
  }

  async function setDebugMode(enabled) {
    const nextSettings = await patchSettings({
      debug: {
        enabled: enabled === true,
        lastToggledAt: new Date().toISOString(),
      },
      platforms: {
        alibabaLabelx: {
          legacyServer: {
            useDebugApiBaseUrl: enabled === true,
          },
        },
      },
    });

    return clone(nextSettings.debug);
  }

  async function clearRuntimeCache() {
    const constants = getConstants();
    const nextSettings = await patchSettings({
      cache: clone(constants.DEFAULT_SETTINGS?.cache || {}),
    });
    return clone(nextSettings.cache);
  }

  async function resetSettings(options) {
    const constants = getConstants();
    const preservePlatformEnabled = options?.preservePlatformEnabled === true;
    const current = preservePlatformEnabled ? await getSettings() : null;
    const nextSettings = clone(constants.DEFAULT_SETTINGS || {});

    if (preservePlatformEnabled && current?.platforms?.alibabaLabelx) {
      nextSettings.platforms.alibabaLabelx.enabled = Boolean(
        current.platforms.alibabaLabelx.enabled
      );
    }

    if (preservePlatformEnabled && current?.platforms?.lightwheel) {
      nextSettings.platforms.lightwheel.enabled = Boolean(current.platforms.lightwheel.enabled);
      nextSettings.platforms.lightwheel.scripts = clone(current.platforms.lightwheel.scripts || {});
    }

    if (preservePlatformEnabled && current?.platforms?.dataBaker) {
      nextSettings.platforms.dataBaker.enabled = Boolean(current.platforms.dataBaker.enabled);
      nextSettings.platforms.dataBaker.scripts = clone(current.platforms.dataBaker.scripts || {});
    }

    if (preservePlatformEnabled && current?.platforms?.aishellTech) {
      nextSettings.platforms.aishellTech.enabled = Boolean(current.platforms.aishellTech.enabled);
      nextSettings.platforms.aishellTech.scripts = clone(
        current.platforms.aishellTech.scripts || {}
      );
    }

    if (preservePlatformEnabled && current?.platforms?.magicData) {
      nextSettings.platforms.magicData.enabled = Boolean(current.platforms.magicData.enabled);
      nextSettings.platforms.magicData.scripts = clone(current.platforms.magicData.scripts || {});
    }

    if (preservePlatformEnabled && current?.platforms?.abakaAi) {
      nextSettings.platforms.abakaAi.enabled = Boolean(current.platforms.abakaAi.enabled);
      nextSettings.platforms.abakaAi.scripts = clone(current.platforms.abakaAi.scripts || {});
    }

    return saveSettings(nextSettings);
  }

  async function setActiveProject(projectId) {
    const constants = getConstants();
    const normalizedProjectId = normalizeProjectId(projectId, constants);
    return patchSettings({
      platforms: {
        alibabaLabelx: {
          scriptCenter: {
            activeProjectId: normalizedProjectId,
          },
        },
      },
    });
  }

  async function saveProjectSettings(projectId, patch) {
    const constants = getConstants();
    const normalizedProjectId = normalizeProjectId(projectId, constants);
    const current = await getSettings();
    const next = clone(current);
    const platform = ensurePlatformRoot(next);
    const scriptCenter = ensureScriptCenter(next);
    const targetProject = scriptCenter.projects[normalizedProjectId];
    const currentProjectConfig = targetProject?.asrConfig || {};
    const projectPatch = isPlainObject(patch) ? patch : {};
    const defaultProjectConfig =
      normalizedProjectId === constants.JUDGEMENT_PROJECT_ID
        ? constants.DEFAULT_JUDGEMENT_ASR_CONFIG || {}
        : constants.DEFAULT_ASR_CONFIG || {};

    targetProject.asrConfig = deepMerge(
      deepMerge(defaultProjectConfig, currentProjectConfig),
      projectPatch
    );
    if (normalizedProjectId === constants.JUDGEMENT_PROJECT_ID) {
      targetProject.asrConfig = normalizeJudgementAsrConfig(targetProject.asrConfig);
    } else {
      targetProject.asrConfig = sanitizeTranscriptionAsrConfig(
        targetProject.asrConfig,
        constants.DEFAULT_ASR_CONFIG || {}
      );
    }

    if (scriptCenter.activeProjectId === normalizedProjectId) {
      next.asr = resolveProjectAsrConfig(next, normalizedProjectId);
    }

    return saveSettings(next);
  }

  async function setScriptEnabled(scriptId, enabled) {
    const constants = getConstants();
    const nextEnabled = enabled === true;

    if (
      scriptId === constants.TRANSCRIPTION_PROJECT_ID ||
      scriptId === constants.JUDGEMENT_PROJECT_ID
    ) {
      return patchSettings({
        platforms: {
          alibabaLabelx: {
            enabled: nextEnabled,
            scriptCenter: {
              activeProjectId: scriptId,
            },
          },
        },
      });
    }

    if (scriptId === constants.LIGHTWHEEL_VIEW_PANEL_SCRIPT_ID) {
      return patchSettings({
        platforms: {
          lightwheel: {
            enabled: nextEnabled,
            scripts: {
              viewPanel: {
                enabled: nextEnabled,
              },
            },
          },
        },
      });
    }

    if (scriptId === constants.DATA_BAKER_ROUND_ONE_QUALITY_SCRIPT_ID) {
      return patchSettings({
        platforms: {
          dataBaker: {
            enabled: nextEnabled,
            scripts: {
              roundOneQuality: {
                id:
                  constants.DATA_BAKER_ROUND_ONE_QUALITY_SCRIPT_ID ||
                  "dataBakerRoundOneQuality",
                enabled: nextEnabled,
              },
            },
          },
        },
      });
    }

    if (
      scriptId === constants.AISHELL_TECH_MINNAN_SCRIPT_ID ||
      scriptId === constants.AISHELL_TECH_VIETNAMESE_SCRIPT_ID ||
      scriptId === constants.AISHELL_TECH_THAI_SCRIPT_ID ||
      scriptId === constants.AISHELL_TECH_CANTONESE_SCRIPT_ID ||
      scriptId === constants.AISHELL_TECH_CN_EN_SHORT_DRAMA_SCRIPT_ID
    ) {
      const minnanId = constants.AISHELL_TECH_MINNAN_SCRIPT_ID || "aishellTechMinnanAssistant";
      const vietnameseId =
        constants.AISHELL_TECH_VIETNAMESE_SCRIPT_ID || "aishellTechVietnameseAssistant";
      const thaiId = constants.AISHELL_TECH_THAI_SCRIPT_ID || "aishellTechThaiAssistant";
      const cantoneseId =
        constants.AISHELL_TECH_CANTONESE_SCRIPT_ID || "aishellTechCantoneseAssistant";
      const cnEnShortDramaId =
        constants.AISHELL_TECH_CN_EN_SHORT_DRAMA_SCRIPT_ID || "aishellTechCnEnShortDrama";
      const scriptPatch = nextEnabled
        ? {
            minnanHelper: {
              id: minnanId,
              enabled: scriptId === minnanId,
              aiRecommendEnabled: scriptId === minnanId,
            },
            vietnameseHelper: {
              id: vietnameseId,
              enabled: scriptId === vietnameseId,
              aiRecommendEnabled: scriptId === vietnameseId,
            },
            thaiHelper: {
              id: thaiId,
              enabled: scriptId === thaiId,
              aiRecommendEnabled: scriptId === thaiId,
            },
            cantoneseHelper: {
              id: cantoneseId,
              enabled: scriptId === cantoneseId,
              aiRecommendEnabled: scriptId === cantoneseId,
            },
            cnEnShortDrama: {
              id: cnEnShortDramaId,
              enabled: scriptId === cnEnShortDramaId,
              aiRecommendEnabled: false,
            },
          }
        : {
            minnanHelper: { id: minnanId, enabled: false, aiRecommendEnabled: false },
            vietnameseHelper: { id: vietnameseId, enabled: false, aiRecommendEnabled: false },
            thaiHelper: { id: thaiId, enabled: false, aiRecommendEnabled: false },
            cantoneseHelper: { id: cantoneseId, enabled: false, aiRecommendEnabled: false },
            cnEnShortDrama: { id: cnEnShortDramaId, enabled: false, aiRecommendEnabled: false },
          };

      return patchSettings({
        platforms: {
          aishellTech: {
            enabled: true,
            activeScriptId: nextEnabled ? scriptId : "",
            scripts: scriptPatch,
          },
        },
      });
    }

    if (
      scriptId === constants.MAGIC_DATA_ANNOTATOR_SCRIPT_ID ||
      scriptId === constants.MAGIC_DATA_MINNAN_SCRIPT_ID
    ) {
      const definitions = getMagicDataScriptDefinitions(constants);
      const scriptPatch = {};
      const legacyPatch = {};
      definitions.forEach(function (definition) {
        const isTargetScript = definition.scriptId === scriptId;
        const scriptEnabled = nextEnabled ? isTargetScript : isTargetScript ? false : undefined;
        if (typeof scriptEnabled === "boolean") {
          scriptPatch[definition.scriptKey] = {
            id: definition.scriptId,
            enabled: scriptEnabled,
            aiReviewEnabled: scriptEnabled,
          };
          legacyPatch[definition.legacyKey] = {
            enabled: scriptEnabled,
            aiReviewEnabled: scriptEnabled,
          };
        }
      });

      return patchSettings({
        platforms: {
          magicData: {
            enabled: true,
            activeScriptId: nextEnabled ? scriptId : "",
            scripts: scriptPatch,
          },
        },
        scriptCenter: {
          projects: legacyPatch,
        },
      });
    }

    if (scriptId === constants.ABAKA_AI_TASK_PAGE_CAPTURE_SCRIPT_ID) {
      return patchSettings({
        platforms: {
          abakaAi: {
            enabled: nextEnabled,
            scripts: {
              taskPageCapture: {
                id:
                  constants.ABAKA_AI_TASK_PAGE_CAPTURE_SCRIPT_ID ||
                  "abakaAiTaskPageCapture",
                enabled: nextEnabled,
              },
            },
          },
        },
      });
    }

    if (scriptId === constants.HAITIAN_UTRANS_AUDIO_DOWNLOAD_HELPER_SCRIPT_ID) {
      return patchSettings({
        platforms: {
          haitianUtrans: {
            enabled: nextEnabled,
            scripts: {
              audioDownloadHelper: {
                id:
                  constants.HAITIAN_UTRANS_AUDIO_DOWNLOAD_HELPER_SCRIPT_ID ||
                  "haitianUtransAudioDownloadHelper",
                enabled: nextEnabled,
              },
            },
          },
        },
      });
    }

    if (scriptId === constants.JD_TTS_SHANGHAINESE_SCRIPT_ID) {
      return patchSettings({
        platforms: {
          jdTtsAnnotation: {
            enabled: nextEnabled,
            activeScriptId: nextEnabled ? scriptId : "",
            scripts: {
              shanghaineseHelper: {
                id: constants.JD_TTS_SHANGHAINESE_SCRIPT_ID || "jdTtsShanghaineseAssistant",
                enabled: nextEnabled,
                aiRecommendEnabled: nextEnabled,
              },
            },
          },
        },
      });
    }

    return getSettings();
  }

  globalThis.ASREdgeStorage = {
    getSettings: getSettings,
    saveSettings: saveSettings,
    patchSettings: patchSettings,
    readAiUsageOperatorState: readAiUsageOperatorState,
    saveAiUsageOperatorName: saveAiUsageOperatorName,
    isPlatformEnabled: isPlatformEnabled,
    setDebugMode: setDebugMode,
    clearRuntimeCache: clearRuntimeCache,
    resetSettings: resetSettings,
    setActiveProject: setActiveProject,
    saveProjectSettings: saveProjectSettings,
    setScriptEnabled: setScriptEnabled,
    EXTENSION_CONTEXT_INVALIDATED_CODE: EXTENSION_CONTEXT_INVALIDATED_CODE,
    isExtensionContextInvalidatedError: isExtensionContextInvalidatedError,
    isChromeExtensionContextAvailable: isChromeExtensionContextAvailable,
  };
})();

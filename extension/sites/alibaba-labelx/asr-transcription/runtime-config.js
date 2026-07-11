(function () {
  const STORAGE_KEY =
    (globalThis.ASREdgeConstants && globalThis.ASREdgeConstants.STORAGE_KEY) || "asrEdgeSettings";
  const PROJECT_ID =
    (globalThis.ASREdgeConstants && globalThis.ASREdgeConstants.TRANSCRIPTION_PROJECT_ID) ||
    "transcription";
  const STATS_UPLOAD_PATH =
    (globalThis.ASREdgeConstants &&
      globalThis.ASREdgeConstants.TRANSCRIPTION_STATS_UPLOAD_PATH) ||
    "/api/alibaba-labelx/asr-transcription/statistics/upload";
  const BACKEND_MODE_SERVER =
    (globalThis.ASREdgeConstants &&
      globalThis.ASREdgeConstants.BACKEND_ENDPOINT_MODE_SERVER) ||
    "server";
  const BACKEND_MODE_LOCAL =
    (globalThis.ASREdgeConstants &&
      globalThis.ASREdgeConstants.BACKEND_ENDPOINT_MODE_LOCAL) ||
    "local";
  const DEFAULT_ASR_CONFIG =
    (globalThis.ASREdgeConstants && globalThis.ASREdgeConstants.DEFAULT_ASR_CONFIG) || {};
  const SHORTCUT_COMPATIBILITY_MAP =
    (globalThis.ASREdgeConstants && globalThis.ASREdgeConstants.SHORTCUT_COMPATIBILITY_MAP) || {};

  const SAFE_SHORTCUT_KEYS = [
    "shortcutPlayPause",
    "shortcutValid",
    "shortcutInvalid",
    "shortcutFill",
    "shortcutRemoveSpaces",
    "shortcutConvertNum",
    "shortcutToggleFocus",
    "shortcutBackward",
    "shortcutForward",
    "shortcutSpeedDown",
    "shortcutSpeedUp",
    "shortcutResetSpeed",
    "shortcutVolDown",
    "shortcutVolUp",
    "shortcutResetVol",
    "shortcutCopyDuration",
    "shortcutUploadStats",
    "shortcutAiSuggest",
    "shortcutApplyAiSuggestion",
    "shortcutSubmitTask",
    "shortcutSubmitTaskAndFinish",
  ];

  const FIXED_DEFAULTS = {
    autoPlay: true,
    playbackRateValue: 1.5,
    resetRateValue: 1.5,
    rateStepValue: 0.25,
    seekStepSeconds: 0.5,
    volumeValue: 100,
    fillOnValid: true,
    clearOnInvalid: true,
    defaultValid: false,
    shortcutPlayPause: null,
    shortcutValid: null,
    shortcutInvalid: null,
    shortcutFill: null,
    shortcutRemoveSpaces: null,
    shortcutConvertNum: null,
    shortcutToggleFocus: null,
    shortcutBackward: null,
    shortcutForward: null,
    shortcutSpeedDown: null,
    shortcutSpeedUp: null,
    shortcutResetSpeed: null,
    shortcutVolDown: null,
    shortcutVolUp: null,
    shortcutResetVol: null,
    shortcutCopyDuration: null,
    shortcutUploadStats: null,
    shortcutAiSuggest: null,
    shortcutApplyAiSuggestion: null,
    shortcutSubmitTask: null,
    shortcutSubmitTaskAndFinish: null,
    aiSuggestionRequestTimeoutMs: 60000,
  };
  const FIXED_STATS_DEFAULTS = {
    statsUploadEnabled: true,
    statsUploadEndpoint: "",
    statsUploadTimes: ["10:00", "16:00"],
    statsUploadJitterMinutes: 10,
    statsAutoUploadOnSchedule: true,
    statsUploadRequestTimeoutMs: 20000,
  };

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function describeError(error) {
    if (error instanceof Error) {
      return {
        message: error.message || error.name || "unknown error",
        stack:
          typeof error.stack === "string" && error.stack.length > 0
            ? error.stack.slice(0, 500)
            : "",
      };
    }
    try {
      return {
        message: JSON.stringify(error),
        stack: "",
      };
    } catch (stringifyError) {
      return {
        message: String(error),
        stack: "",
      };
    }
  }

  function isExtensionContextInvalidatedError(storage, error) {
    if (storage && typeof storage.isExtensionContextInvalidatedError === "function") {
      try {
        if (storage.isExtensionContextInvalidatedError(error)) {
          return true;
        }
      } catch (innerError) {
        // Ignore checker failures and continue with local fallback.
      }
    }
    if (String(error?.code || "") === "EXTENSION_CONTEXT_INVALIDATED") {
      return true;
    }
    const message = String((error && (error.message || error)) || "").toLowerCase();
    return (
      message.indexOf("extension context invalidated") >= 0 ||
      message.indexOf("context invalidated") >= 0
    );
  }

  function createSafeSettingsFallback() {
    const constants = globalThis.ASREdgeConstants || {};
    const defaults =
      (constants.DEFAULT_SETTINGS && typeof constants.DEFAULT_SETTINGS === "object"
        ? constants.DEFAULT_SETTINGS
        : {}) || {};
    const next = clone(defaults);
    if (
      next &&
      next.platforms &&
      next.platforms.alibabaLabelx &&
      next.platforms.alibabaLabelx.scriptCenter &&
      next.platforms.alibabaLabelx.scriptCenter.projects &&
      next.platforms.alibabaLabelx.scriptCenter.projects[PROJECT_ID]
    ) {
      const currentConfig =
        next.platforms.alibabaLabelx.scriptCenter.projects[PROJECT_ID].asrConfig || {};
      next.platforms.alibabaLabelx.scriptCenter.projects[PROJECT_ID].asrConfig = Object.assign(
        {},
        currentConfig,
        FIXED_DEFAULTS,
        FIXED_STATS_DEFAULTS
      );
    }
    return next;
  }

  function toNumber(value, fallback, min, max, precision) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return fallback;
    }
    const bounded = Math.max(min, Math.min(max, numeric));
    return typeof precision === "number" ? Number(bounded.toFixed(precision)) : bounded;
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
      key: hasKey ? String(shortcut.key) : null,
      button: hasButton ? shortcut.button : null,
    };
  }

  function normalizeTimeList(value, fallback) {
    const source = Array.isArray(value)
      ? value
      : typeof value === "string"
        ? value.split(/[,，\n]/)
        : Array.isArray(fallback)
          ? fallback
          : FIXED_STATS_DEFAULTS.statsUploadTimes;
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
    return result.length > 0 ? result : FIXED_STATS_DEFAULTS.statsUploadTimes.slice();
  }

  function getShortcutFromSource(source, shortcutKey) {
    if (source && Object.prototype.hasOwnProperty.call(source, shortcutKey)) {
      return source[shortcutKey];
    }

    const compatEntry = Object.entries(SHORTCUT_COMPATIBILITY_MAP).find(function (entry) {
      return entry[1] === shortcutKey;
    });
    const compatKey = compatEntry ? compatEntry[0] : "";
    if (
      compatKey &&
      source &&
      source.shortcuts &&
      Object.prototype.hasOwnProperty.call(source.shortcuts, compatKey)
    ) {
      return source.shortcuts[compatKey];
    }

    return null;
  }

  function normalizeRuntimeConfig(config) {
    const source = config && typeof config === "object" ? config : {};
    const shortcuts = {};
    SAFE_SHORTCUT_KEYS.forEach(function (shortcutKey) {
      shortcuts[shortcutKey] = normalizeShortcut(getShortcutFromSource(source, shortcutKey));
    });

    const resetRateValue = toNumber(
      hasOwn(source, "resetRateValue") ? source.resetRateValue : source.playbackRateValue,
      1,
      0.25,
      5,
      2
    );

    return {
      autoPlay: source.autoPlay === true,
      playbackRateValue: toNumber(
        hasOwn(source, "playbackRateValue") ? source.playbackRateValue : resetRateValue,
        resetRateValue,
        0.25,
        5,
        2
      ),
      resetRateValue: resetRateValue,
      rateStepValue: toNumber(source.rateStepValue, 0.25, 0.05, 2, 2),
      seekStepSeconds: toNumber(source.seekStepSeconds, 0.5, 0.1, 10, 2),
      volumeValue: toNumber(source.volumeValue, 100, 0, 1000, 0),
      fillOnValid: source.fillOnValid !== false,
      clearOnInvalid: source.clearOnInvalid !== false,
      defaultValid: source.defaultValid === true,
      shortcuts: shortcuts,
      shortcutPlayPause: shortcuts.shortcutPlayPause,
      shortcutValid: shortcuts.shortcutValid,
      shortcutInvalid: shortcuts.shortcutInvalid,
      shortcutFill: shortcuts.shortcutFill,
      shortcutRemoveSpaces: shortcuts.shortcutRemoveSpaces,
      shortcutConvertNum: shortcuts.shortcutConvertNum,
      shortcutToggleFocus: shortcuts.shortcutToggleFocus,
      shortcutBackward: shortcuts.shortcutBackward,
      shortcutForward: shortcuts.shortcutForward,
      shortcutSpeedDown: shortcuts.shortcutSpeedDown,
      shortcutSpeedUp: shortcuts.shortcutSpeedUp,
      shortcutResetSpeed: shortcuts.shortcutResetSpeed,
      shortcutVolDown: shortcuts.shortcutVolDown,
      shortcutVolUp: shortcuts.shortcutVolUp,
      shortcutResetVol: shortcuts.shortcutResetVol,
      shortcutCopyDuration: shortcuts.shortcutCopyDuration,
      shortcutUploadStats: shortcuts.shortcutUploadStats,
      shortcutAiSuggest: shortcuts.shortcutAiSuggest,
      shortcutApplyAiSuggestion: shortcuts.shortcutApplyAiSuggestion,
      shortcutSubmitTask: shortcuts.shortcutSubmitTask,
      shortcutSubmitTaskAndFinish: shortcuts.shortcutSubmitTaskAndFinish,
      aiSuggestionRequestTimeoutMs: toNumber(source.aiSuggestionRequestTimeoutMs, 60000, 1000, 300000, 0),
    };
  }

  function inferModeFromEndpoint(endpointText) {
    const text = String(endpointText || "").trim().toLowerCase();
    if (text.indexOf("127.0.0.1") >= 0 || text.indexOf("localhost") >= 0) {
      return BACKEND_MODE_LOCAL;
    }
    return BACKEND_MODE_SERVER;
  }

  function normalizeStatsConfig(config, settings) {
    const constants = globalThis.ASREdgeConstants || {};
    const source = config && typeof config === "object" ? config : {};
    const modeFromSettings =
      typeof constants.getBackendEndpointModeFromSettings === "function"
        ? constants.getBackendEndpointModeFromSettings(settings || {})
        : String(settings?.meta?.backendEndpointMode || "").trim().toLowerCase() === BACKEND_MODE_LOCAL
          ? BACKEND_MODE_LOCAL
          : "";
    const endpointMode = modeFromSettings || inferModeFromEndpoint(source.statsUploadEndpoint);
    const endpoint =
      typeof constants.buildBackendUrl === "function"
        ? constants.buildBackendUrl(STATS_UPLOAD_PATH, endpointMode)
        : String(
            (
              endpointMode === BACKEND_MODE_LOCAL
                ? constants.DEFAULT_BACKEND_BASE_URLS?.local
        : constants.DEFAULT_BACKEND_BASE_URLS?.server
            ) || ""
          ).replace(/\/+$/, "") + STATS_UPLOAD_PATH;

    return {
      statsUploadEnabled: true,
      statsUploadEndpoint: endpoint,
      backendEndpointMode: endpointMode,
      statsUploadTimes: normalizeTimeList(
        source.statsUploadTimes,
        FIXED_STATS_DEFAULTS.statsUploadTimes
      ),
      statsUploadJitterMinutes: toNumber(source.statsUploadJitterMinutes, 10, 0, 120, 0),
      statsAutoUploadOnSchedule: true,
      statsUploadRequestTimeoutMs: toNumber(source.statsUploadRequestTimeoutMs, 20000, 1000, 120000, 0),
    };
  }

  function hasOwn(target, key) {
    return Boolean(target) && Object.prototype.hasOwnProperty.call(target, key);
  }

  function getActiveProjectId(settings) {
    return settings?.platforms?.alibabaLabelx?.scriptCenter?.activeProjectId || "";
  }

  function isProjectEnabled(settings) {
    const platformEnabled = settings?.platforms?.alibabaLabelx?.enabled === true;
    return platformEnabled && getActiveProjectId(settings) === PROJECT_ID;
  }

  let contextInvalidatedLogEmitted = false;

  async function loadSettings() {
    const storage = globalThis.ASREdgeStorage || null;
    if (!storage || typeof storage.getSettings !== "function") {
      return {
        settings: createSafeSettingsFallback(),
        contextInvalidated: false,
      };
    }

    try {
      return {
        settings: await storage.getSettings(),
        contextInvalidated: false,
      };
    } catch (error) {
      if (isExtensionContextInvalidatedError(storage, error)) {
        if (!contextInvalidatedLogEmitted) {
          contextInvalidatedLogEmitted = true;
          console.info(
            "[ASR Edge][transcription] extension context invalidated; waiting for page refresh."
          );
        }
        return {
          settings: createSafeSettingsFallback(),
          contextInvalidated: true,
        };
      }
      const details = describeError(error);
      console.warn(
        "[ASR Edge][transcription] load settings failed",
        details.message + (details.stack ? " | " + details.stack : "")
      );
      return {
        settings: createSafeSettingsFallback(),
        contextInvalidated: false,
      };
    }
  }

  async function loadConfig() {
    const loaded = await loadSettings();
    const settings = loaded.settings;
    const projectAsrConfig =
      settings?.platforms?.alibabaLabelx?.scriptCenter?.projects?.[PROJECT_ID]?.asrConfig || {};
    const defaultRuntime = Object.assign({}, DEFAULT_ASR_CONFIG || {}, FIXED_DEFAULTS);
    return {
      settings: settings,
      activeProjectId: getActiveProjectId(settings),
      enabledBySettings: isProjectEnabled(settings),
      config: normalizeRuntimeConfig(Object.assign({}, defaultRuntime, projectAsrConfig)),
      statsConfig: Object.assign(
        {
          settings: settings,
        },
        normalizeStatsConfig(
          Object.assign({}, DEFAULT_ASR_CONFIG || {}, FIXED_STATS_DEFAULTS, projectAsrConfig),
          settings
        )
      ),
      storageKey: STORAGE_KEY,
      contextInvalidated: loaded.contextInvalidated === true,
      status: loaded.contextInvalidated === true ? "extension-context-invalidated" : "ok",
    };
  }

  globalThis.__ASREdgeAlibabaLabelxTranscriptionRuntimeConfig = {
    PROJECT_ID: PROJECT_ID,
    FIXED_DEFAULTS: clone(FIXED_DEFAULTS),
    FIXED_STATS_DEFAULTS: clone(FIXED_STATS_DEFAULTS),
    normalizeRuntimeConfig: normalizeRuntimeConfig,
    normalizeStatsConfig: normalizeStatsConfig,
    loadConfig: loadConfig,
  };
})();

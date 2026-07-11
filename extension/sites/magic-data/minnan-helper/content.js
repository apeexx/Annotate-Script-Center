(function () {
  const CHECK_INTERVAL_MS = 1000;
  const MOUNT_RETRY_MS = 220;
  const MOUNT_RETRY_LIMIT = 30;
  const MAGIC_DATA_MINNAN_SCRIPT_ID =
    globalThis.ASREdgeConstants?.MAGIC_DATA_MINNAN_SCRIPT_ID || "magicDataMinnanAssistant";
  const PANEL_ROOT_SELECTOR = "[data-asc-magic-data-minnan-review-inline]";
  const INLINE_SUGGESTION_SELECTOR = "[data-asc-magic-data-minnan-inline-suggestion]";
  const SPEAKER_SUGGESTION_SELECTOR = "[data-asc-magic-data-minnan-speaker-suggestion]";
  const RAW_MODAL_SELECTOR = "[data-asc-magic-data-minnan-raw-modal]";
  const DEFAULT_SETTINGS = {
    enabled: false,
    aiReviewEnabled: false,
    aiReviewModelMode: "two_stage",
    aiReviewRecognitionStrategy: "direct_dialect",
    aiReviewRecognitionMode: "two_stage",
    aiReviewListenModel: "qwen3.5-omni-flash",
    aiReviewCompareModel: "qwen3.5-plus",
    aiReviewSingleModel: "qwen3.5-omni-flash",
    aiReviewEnableThinking: false,
    listenModel: "qwen3.5-omni-flash",
    reviewModel: "qwen3.5-plus",
    reviewMode: "rule_first",
    showHeardText: true,
    showEstimatedIncome: true,
    enableThinking: false,
    aiReviewListenPrompt: "",
    aiReviewComparePrompt: "",
    aiReviewTemperature: "",
    aiReviewTopP: "",
    aiReviewMaxTokens: "",
    aiReviewMaxCompletionTokens: "",
    aiReviewPresencePenalty: "",
    aiReviewFrequencyPenalty: "",
    aiReviewSeed: "",
    aiReviewStopSequences: "",
    shortcuts: {},
  };

  let runtime = null;
  let observer = null;
  let pageTimer = null;
  let evaluating = false;
  let pendingEvaluate = false;
  let contextInvalidated = false;
  let mountRetryCount = 0;
  let startLogged = false;
  let lastRouteLog = "";
  let runtimeSettings = Object.assign({}, DEFAULT_SETTINGS);

  function safeInfo(text) {
    if (typeof console !== "undefined" && typeof console.info === "function") {
      console.info(text);
    }
  }

  function safeWarn(text) {
    if (typeof console !== "undefined" && typeof console.warn === "function") {
      console.warn(text);
    }
  }

  function isContextInvalidatedError(error) {
    try {
      const storage = globalThis.ASREdgeStorage || {};
      if (typeof storage.isExtensionContextInvalidatedError === "function") {
        return storage.isExtensionContextInvalidatedError(error);
      }
    } catch (ignoreError) {
      // ignore
    }
    const message = String(error?.message || "");
    return message.indexOf("Extension context invalidated") >= 0;
  }

  function isContextAvailable() {
    try {
      const storage = globalThis.ASREdgeStorage || {};
      if (typeof storage.isChromeExtensionContextAvailable === "function") {
        return storage.isChromeExtensionContextAvailable();
      }
      return Boolean(globalThis.chrome?.runtime?.id);
    } catch (error) {
      return false;
    }
  }

  function normalizeModelName(value, fallback) {
    const text = String(value || "").replace(/[\r\n]+/g, " ").trim();
    if (!text) {
      return fallback;
    }
    return text.slice(0, 80);
  }

  function normalizeReviewMode(value) {
    const text = String(value || "").trim().toLowerCase();
    if (text === "strict" || text === "strict_review") {
      return "strict_review";
    }
    if (text === "listen_first" || text === "listen_assisted") {
      return "listen_assisted";
    }
    return "rule_first";
  }

  function normalizeModelMode(value) {
    const text = String(value || "").trim().toLowerCase();
    if (text === "two_stage" || text === "omni_single") {
      return text;
    }
    return "two_stage";
  }

  function normalizeRecognitionStrategy(value) {
    const text = String(value || "").trim().toLowerCase();
    if (text === "mandarin_to_dialect") {
      return "mandarin_to_dialect";
    }
    return "direct_dialect";
  }

  function normalizeRecognitionMode(value) {
    const text = String(value || "").trim().toLowerCase();
    if (text === "two_stage" || text === "omni_single" || text === "recognition_convert") {
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

  function deriveLegacyRecognitionMode(modelMode, recognitionStrategy) {
    if (normalizeRecognitionStrategy(recognitionStrategy) === "mandarin_to_dialect") {
      return "recognition_convert";
    }
    return normalizeModelMode(modelMode);
  }

  function normalizePromptText(value) {
    return String(value || "").replace(/\r\n/g, "\n").trim().slice(0, 8000);
  }

  function normalizeSettings(value) {
    const source = value && typeof value === "object" ? value : {};
    const shortcuts = source.shortcuts && typeof source.shortcuts === "object" ? source.shortcuts : {};
    const legacyRecognitionMode = normalizeRecognitionMode(
      source.aiReviewRecognitionMode || source.aiReviewPipelineMode || source.pipelineMode
    );
    const modelMode = normalizeModelMode(
      source.aiReviewModelMode || legacyRecognitionMode
    );
    const recognitionStrategy = normalizeRecognitionStrategy(
      source.aiReviewRecognitionStrategy ||
        (legacyRecognitionMode === "recognition_convert" ? "mandarin_to_dialect" : "direct_dialect")
    );
    const recognitionMode = deriveLegacyRecognitionMode(modelMode, recognitionStrategy);
    const listenModel = normalizeModelName(
      source.aiReviewListenModel || source.listenModel,
      DEFAULT_SETTINGS.aiReviewListenModel
    );
    const compareModel = normalizeModelName(
      source.aiReviewCompareModel || source.reviewModel,
      DEFAULT_SETTINGS.aiReviewCompareModel
    );
    const singleModel = normalizeModelName(
      source.aiReviewSingleModel || source.singleModel || source.aiReviewModel,
      DEFAULT_SETTINGS.aiReviewSingleModel
    );
    const enableThinking =
      typeof source.aiReviewEnableThinking === "boolean"
        ? source.aiReviewEnableThinking === true
        : source.enableThinking === true;
    return {
      enabled: source.enabled !== false,
      aiReviewEnabled: source.aiReviewEnabled !== false,
      aiReviewModelMode: modelMode,
      aiReviewRecognitionStrategy: recognitionStrategy,
      aiReviewRecognitionMode: recognitionMode,
      aiReviewListenModel: listenModel,
      aiReviewCompareModel: compareModel,
      aiReviewSingleModel: singleModel,
      aiReviewEnableThinking: enableThinking,
      listenModel: listenModel,
      reviewModel: compareModel,
      reviewMode: normalizeReviewMode(source.reviewMode),
      showHeardText: source.showHeardText !== false,
      showEstimatedIncome: source.showEstimatedIncome !== false,
      enableThinking: enableThinking,
      aiReviewListenPrompt: normalizePromptText(source.aiReviewListenPrompt || ""),
      aiReviewComparePrompt: normalizePromptText(source.aiReviewComparePrompt || ""),
      aiReviewTemperature: String(source.aiReviewTemperature || "").trim(),
      aiReviewTopP: String(source.aiReviewTopP || "").trim(),
      aiReviewMaxTokens: String(source.aiReviewMaxTokens || "").trim(),
      aiReviewMaxCompletionTokens: String(source.aiReviewMaxCompletionTokens || "").trim(),
      aiReviewPresencePenalty: String(source.aiReviewPresencePenalty || "").trim(),
      aiReviewFrequencyPenalty: String(source.aiReviewFrequencyPenalty || "").trim(),
      aiReviewSeed: String(source.aiReviewSeed || "").trim(),
      aiReviewStopSequences: String(source.aiReviewStopSequences || "").trim().slice(0, 960),
      shortcuts: shortcuts,
    };
  }

  async function loadMagicDataSettings() {
    const storage = globalThis.ASREdgeStorage || {};
    if (typeof storage.getSettings !== "function") {
      runtimeSettings = Object.assign({}, DEFAULT_SETTINGS);
      return runtimeSettings;
    }
    try {
      const settings = await storage.getSettings();
      const platformEnabled = settings?.platforms?.magicData?.enabled !== false;
      const activeScriptId = String(settings?.platforms?.magicData?.activeScriptId || "").trim();
      const projectSettings =
        settings?.platforms?.magicData?.scripts?.minnanHelper ||
        settings?.scriptCenter?.projects?.magicDataMinnanAssistant ||
        settings?.projects?.magicDataMinnanAssistant ||
        {};
      runtimeSettings = normalizeSettings(projectSettings);
      if (!platformEnabled) {
        runtimeSettings.enabled = false;
        runtimeSettings.aiReviewEnabled = false;
      }
      if (activeScriptId && activeScriptId !== MAGIC_DATA_MINNAN_SCRIPT_ID) {
        runtimeSettings.enabled = false;
        runtimeSettings.aiReviewEnabled = false;
      }
      return runtimeSettings;
    } catch (error) {
      runtimeSettings = Object.assign({}, DEFAULT_SETTINGS);
      return runtimeSettings;
    }
  }

  function createRuntime() {
    const detector = globalThis.__ASREdgeMagicDataAnnotatorPageDetector;
    const collector = globalThis.__ASREdgeMagicDataAnnotatorDataCollector;
    const aiClient = globalThis.__ASREdgeMagicDataMinnanAiReviewClient;
    const panelFactory = globalThis.__ASREdgeMagicDataMinnanInlinePanel;
    const shortcutsFactory = globalThis.__ASREdgeMagicDataMinnanShortcuts;
    if (!detector || !collector || !aiClient || !panelFactory) {
      return null;
    }

    const panel = panelFactory.createRuntime({
      collectCurrentItem: collector.collectCurrentItem,
      fillDialectLine: collector.fillDialectLine,
      fillMandarinLine: collector.fillMandarinLine,
      getClientVersion: aiClient.getClientVersion,
      refreshCurrentItem: collector.refreshCurrentItem,
      reviewCurrent: aiClient.reviewCurrent,
      selectSpeakerValue: collector.selectSpeakerValue,
    });

    const shortcutsRuntime = shortcutsFactory?.createRuntime
      ? shortcutsFactory.createRuntime({
          actions: {},
        })
      : null;

    let lastTaskKey = "";

    function isInsideOwnUi(node) {
      if (!(node instanceof Node)) {
        return false;
      }
      const element = node instanceof HTMLElement ? node : node.parentElement;
      if (!(element instanceof HTMLElement)) {
        return false;
      }
      return Boolean(
        element.closest(PANEL_ROOT_SELECTOR) ||
          element.closest(INLINE_SUGGESTION_SELECTOR) ||
          element.closest(SPEAKER_SUGGESTION_SELECTOR) ||
          element.closest(RAW_MODAL_SELECTOR)
      );
    }

    function shouldIgnoreMutation(mutations) {
      if (!Array.isArray(mutations) || mutations.length === 0) {
        return false;
      }
      return mutations.every(function (mutation) {
        if (!isInsideOwnUi(mutation.target)) {
          return false;
        }
        const added = Array.from(mutation.addedNodes || []);
        const removed = Array.from(mutation.removedNodes || []);
        return (
          added.every(isInsideOwnUi) &&
          removed.every(isInsideOwnUi)
        );
      });
    }

    function runActionResult(result) {
      if (result && typeof result.then === "function") {
        return result
          .then(function (finalResult) {
            if (finalResult?.message) {
              panel.setMessage(finalResult.message);
            }
          })
          .catch(function (error) {
            panel.setMessage(error?.message || "快捷键执行失败。");
          });
      }
      if (result?.message) {
        panel.setMessage(result.message);
      }
      return Promise.resolve();
    }

    function wireShortcutsActions() {
      if (!shortcutsRuntime) {
        return;
      }
      shortcutsRuntime.setActions({
        age0To5: function () {
          return runActionResult(collector.selectSpeakerValue("0-5"));
        },
        age6To12: function () {
          return runActionResult(collector.selectSpeakerValue("6-12"));
        },
        age13To18: function () {
          return runActionResult(collector.selectSpeakerValue("13-18"));
        },
        age19To25: function () {
          return runActionResult(collector.selectSpeakerValue("19-25"));
        },
        age26To36: function () {
          return runActionResult(collector.selectSpeakerValue("26-36"));
        },
        age37To50: function () {
          return runActionResult(collector.selectSpeakerValue("37-50"));
        },
        age51To65: function () {
          return runActionResult(collector.selectSpeakerValue("51-65"));
        },
        age65Plus: function () {
          return runActionResult(collector.selectSpeakerValue("65以上"));
        },
        copySummary: function () {
          return runActionResult(panel.triggerCopySummary());
        },
        fillAllAiSuggestions: function () {
          return runActionResult(panel.triggerFillAllSuggestions());
        },
        genderFemale: function () {
          return runActionResult(collector.selectSpeakerValue("女"));
        },
        genderMale: function () {
          return runActionResult(collector.selectSpeakerValue("男"));
        },
        refreshCollection: function () {
          return runActionResult(panel.triggerRefreshCollection());
        },
        resetPanelHeight: function () {
          return runActionResult(panel.triggerResetPanelHeight());
        },
        showRawAiOutput: function () {
          return runActionResult(panel.triggerShowRawOutput());
        },
        toggleDialectDetail: function () {
          return runActionResult(panel.triggerToggleDialectDetail());
        },
        toggleMandarinDetail: function () {
          return runActionResult(panel.triggerToggleMandarinDetail());
        },
        toggleSpeakerDetail: function () {
          return runActionResult(panel.triggerToggleSpeakerDetail());
        },
        onMissingAction: function (actionKey) {
          panel.setMessage("未实现的快捷键动作：" + actionKey);
        },
        reviewCurrent: function () {
          if (runtimeSettings.aiReviewEnabled === false) {
            panel.setMessage("闽南语助手已在 options 中关闭。");
            return Promise.resolve();
          }
          return runActionResult(panel.triggerReview());
        },
        save: function () {
          return runActionResult(collector.clickOperationButton("保存"));
        },
        submit: function () {
          return runActionResult(collector.clickOperationButton("提交"));
        },
      });
    }

    function refresh() {
      if (!detector.isMagicDataHost()) {
        panel.remove();
        return;
      }
      const pageType = detector.getPageType();
      if (pageType !== lastRouteLog) {
        lastRouteLog = pageType;
        safeInfo("[MagicData][Minnan] route detected: " + pageType);
      }

      if (pageType === "asrmark") {
        const mounted = panel.ensureMounted();
        if (!mounted) {
          return;
        }
        let snapshot = null;
        try {
          snapshot = collector.collectCurrentItem();
        } catch (error) {
          panel.setMessage("页面采集异常，请点击刷新采集后重试。");
        }
        snapshot = snapshot || {};
        snapshot.pageType = pageType;
        const nextTaskKey = String(snapshot.taskItemId || snapshot.samplingRecordId || "");
        if (nextTaskKey && lastTaskKey && nextTaskKey !== lastTaskKey) {
          panel.clearResult();
          panel.setMessage("当前条已变化，请重新点击 AI 质检当前条。");
        }
        lastTaskKey = nextTaskKey;
        panel.setRuntimeSettings(runtimeSettings);
        panel.refreshPageSnapshot(snapshot, null, runtimeSettings);
        if (
          snapshot.taskItemId &&
          typeof collector.getCachedDetail === "function" &&
          typeof collector.refreshCurrentItem === "function" &&
          !collector.getCachedDetail(snapshot.taskItemId)
        ) {
          collector
            .refreshCurrentItem({ taskItemId: snapshot.taskItemId })
            .then(function (latestSnapshot) {
              const nextSnapshot = latestSnapshot && typeof latestSnapshot === "object" ? latestSnapshot : snapshot;
              nextSnapshot.pageType = "asrmark";
              panel.refreshPageSnapshot(nextSnapshot, null, runtimeSettings);
            })
            .catch(function () {
              // Keep DOM snapshot when API warmup fails.
            });
        }
        return;
      }
      if (pageType === "asrmarkCheck") {
        lastTaskKey = "";
        panel.setRuntimeSettings(runtimeSettings);
        panel.showAsrmarkCheckNotice();
        return;
      }
      lastTaskKey = "";
      panel.remove();
    }

    function ensurePanelMountedWithRetry() {
      if (!detector.isMagicDataHost()) {
        return;
      }
      if (detector.getPageType() !== "asrmark") {
        return;
      }
      const mounted = panel.ensureMounted();
      if (mounted) {
        mountRetryCount = 0;
        refresh();
        return;
      }
      if (mountRetryCount >= MOUNT_RETRY_LIMIT) {
        safeWarn("[MagicData][Minnan] panel mount retry exhausted");
        return;
      }
      mountRetryCount += 1;
      window.setTimeout(function () {
        ensurePanelMountedWithRetry();
      }, MOUNT_RETRY_MS);
    }

    async function start() {
      await loadMagicDataSettings();
      panel.setRuntimeSettings(runtimeSettings);
      wireShortcutsActions();
      if (shortcutsRuntime) {
        await shortcutsRuntime.start();
      }
      void aiClient.notifyLexiconWarning?.();
      refresh();
      ensurePanelMountedWithRetry();
      observer = new MutationObserver(function (mutations) {
        const mutationList = Array.from(mutations || []);
        if (shouldIgnoreMutation(mutationList)) {
          return;
        }
        window.clearTimeout(pageTimer);
        pageTimer = window.setTimeout(function () {
          refresh();
        }, 180);
      });
      observer.observe(document.documentElement || document.body, {
        childList: true,
        subtree: true,
      });
    }

    function stop() {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      if (pageTimer) {
        window.clearTimeout(pageTimer);
        pageTimer = null;
      }
      if (shortcutsRuntime) {
        shortcutsRuntime.stop();
      }
      panel.remove();
    }

    return {
      refresh: refresh,
      start: start,
      stop: stop,
    };
  }

  function stopRuntime() {
    if (runtime) {
      runtime.stop();
      runtime = null;
    }
  }

  async function evaluatePage() {
    if (contextInvalidated) {
      return;
    }
    if (evaluating) {
      pendingEvaluate = true;
      return;
    }
    evaluating = true;
    try {
      if (!isContextAvailable()) {
        contextInvalidated = true;
        stopRuntime();
        return;
      }
      const detector = globalThis.__ASREdgeMagicDataAnnotatorPageDetector;
      if (!detector?.isMagicDataHost?.()) {
        stopRuntime();
        return;
      }
      await loadMagicDataSettings();
      if (runtimeSettings.enabled === false || runtimeSettings.aiReviewEnabled === false) {
        stopRuntime();
        return;
      }
      if (!runtime) {
        runtime = createRuntime();
        if (!runtime) {
          safeWarn("[MagicData][Minnan] runtime dependencies missing");
          return;
        }
        await runtime.start();
        return;
      }
      runtime.refresh();
    } catch (error) {
      if (isContextInvalidatedError(error)) {
        contextInvalidated = true;
        stopRuntime();
        return;
      }
      safeWarn("[MagicData][Minnan] runtime error: " + String(error?.message || error || "unknown"));
      if (runtime) {
        runtime.refresh();
      }
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

  if (!startLogged) {
    startLogged = true;
    safeInfo("[MagicData][Minnan] content started");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleEvaluatePage, { once: true });
  } else {
    scheduleEvaluatePage();
  }
  installRouteWatch();
})();

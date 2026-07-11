(function () {
  const CHECK_INTERVAL_MS = 1000;
  const MOUNT_RETRY_MS = 220;
  const MOUNT_RETRY_LIMIT = 30;
  const MAGIC_DATA_HAKKA_SCRIPT_ID =
    globalThis.ASREdgeConstants?.MAGIC_DATA_HAKKA_SCRIPT_ID || "magicDataAnnotatorAiReview";
  const PANEL_ROOT_SELECTOR = "[data-asc-magic-data-hakka-review-inline]";
  const INLINE_SUGGESTION_SELECTOR = "[data-asc-magic-data-hakka-inline-suggestion]";
  const SPEAKER_SUGGESTION_SELECTOR = "[data-asc-magic-data-hakka-speaker-suggestion]";
  const RAW_MODAL_SELECTOR = "[data-asc-magic-data-hakka-raw-modal]";
  const AUTO_READY_TIMEOUT_MS = 15000;
  const AUTO_NEXT_TIMEOUT_MS = 20000;
  const DEFAULT_SETTINGS = {
    enabled: true,
    aiReviewEnabled: true,
    aiReviewModelMode: "two_stage",
    aiReviewRecognitionStrategy: "direct_dialect",
    aiReviewRecognitionMode: "two_stage",
    aiReviewListenModel: "qwen3.5-omni-flash",
    aiReviewCompareModel: "qwen3.5-flash",
    aiReviewSingleModel: "qwen3.5-omni-flash",
    aiReviewEnableThinking: false,
    listenModel: "qwen3.5-omni-flash",
    reviewModel: "qwen3.5-flash",
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
        settings?.platforms?.magicData?.scripts?.hakkaHelper ||
        settings?.scriptCenter?.projects?.magicDataAnnotator ||
        settings?.projects?.magicDataAnnotator ||
        {};
      runtimeSettings = normalizeSettings(projectSettings);
      if (!platformEnabled) {
        runtimeSettings.enabled = false;
        runtimeSettings.aiReviewEnabled = false;
      }
      if (activeScriptId && activeScriptId !== MAGIC_DATA_HAKKA_SCRIPT_ID) {
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
    const aiClient = globalThis.__ASREdgeMagicDataAnnotatorAiReviewClient;
    const panelFactory = globalThis.__ASREdgeMagicDataHakkaInlinePanel;
    const shortcutsFactory = globalThis.__ASREdgeMagicDataHakkaShortcuts;
    if (!detector || !collector || !aiClient || !panelFactory) {
      return null;
    }

    let autoRunner = null;
    const panel = panelFactory.createRuntime({
      collectCurrentItem: collector.collectCurrentItem,
      fillDialectLine: collector.fillDialectLine,
      fillMandarinLine: collector.fillMandarinLine,
      getClientVersion: aiClient.getClientVersion,
      refreshCurrentItem: collector.refreshCurrentItem,
      reviewCurrent: aiClient.reviewCurrent,
      selectSpeakerValue: collector.selectSpeakerValue,
      startAutoRun: function () {
        autoRunner?.start();
      },
      stopAutoRun: function () {
        autoRunner?.stop("stopped", "已停止。");
      },
    });

    const shortcutsRuntime = shortcutsFactory?.createRuntime
      ? shortcutsFactory.createRuntime({
          actions: {},
        })
      : null;

    let lastTaskKey = "";
    let lastRouteKey = "";

    function createAutoRunner() {
      const state = {
        enabled: false,
        status: "idle",
        statusText: "关闭",
        runId: 0,
        controller: null,
      };

      function syncState(extra) {
        Object.assign(state, extra || {});
        panel.setAutoRunState({
          enabled: state.enabled,
          status: state.status,
          statusText: state.statusText,
          pageSupported: detector.getPageType() === "asrmark",
        });
      }

      function createAbortError() {
        const error = new Error("已停止自动流程。");
        error.code = "user-aborted";
        return error;
      }

      function ensureActive(runId) {
        if (state.enabled !== true || state.runId !== runId || state.controller?.signal?.aborted) {
          throw createAbortError();
        }
      }

      async function waitForNextReady(currentTaskItemId, runId) {
        const signal = state.controller?.signal || null;
        const deadlineAt = Date.now() + AUTO_NEXT_TIMEOUT_MS;
        while (Date.now() < deadlineAt) {
          ensureActive(runId);
          const routeTaskItemId = normalizeText(detector.parseHashParams?.().taskItemId || "");
          if (routeTaskItemId && routeTaskItemId !== currentTaskItemId) {
            return collector.waitForAsrmarkReady({
              taskItemId: routeTaskItemId,
              signal: signal,
              timeoutMs: AUTO_READY_TIMEOUT_MS,
            });
          }
          await new Promise(function (resolve, reject) {
            let onAbort = null;
            const timer = window.setTimeout(function () {
              if (signal && onAbort) {
                signal.removeEventListener("abort", onAbort);
              }
              resolve();
            }, 120);
            if (signal && typeof signal.addEventListener === "function") {
              onAbort = function () {
                window.clearTimeout(timer);
                signal.removeEventListener("abort", onAbort);
                reject(createAbortError());
              };
              signal.addEventListener("abort", onAbort, { once: true });
            }
          });
        }
        const error = new Error("等待下一条任务加载超时。");
        error.code = "wait-next-timeout";
        throw error;
      }

      async function runLoop(runId) {
        const signal = state.controller?.signal || null;
        while (true) {
          ensureActive(runId);
          syncState({ status: "waiting_ready", statusText: "等待加载" });
          const routeTaskItemId = normalizeText(detector.parseHashParams?.().taskItemId || "");
          const readySnapshot = await collector.waitForAsrmarkReady({
            taskItemId: routeTaskItemId,
            signal: signal,
            timeoutMs: AUTO_READY_TIMEOUT_MS,
          });
          ensureActive(runId);
          panel.refreshPageSnapshot(readySnapshot, null, runtimeSettings);

          syncState({ status: "reviewing", statusText: "AI处理中" });
          const reviewResult = await panel.triggerReview({ signal: signal });
          ensureActive(runId);
          if (!reviewResult?.ok) {
            throw new Error(reviewResult?.message || "AI 质检失败。");
          }

          syncState({ status: "filling", statusText: "正在填入" });
          const fillResult = panel.triggerFillAllSuggestions();
          ensureActive(runId);
          if (!fillResult?.ok) {
            throw new Error(fillResult?.message || "填入失败。");
          }

          syncState({ status: "submitting", statusText: "正在提交" });
          const submitResult = collector.clickOperationButton("提交");
          ensureActive(runId);
          if (!submitResult?.ok) {
            throw new Error(submitResult?.message || "提交失败。");
          }

          syncState({ status: "waiting_next", statusText: "等待下一条" });
          const nextSnapshot = await waitForNextReady(normalizeText(readySnapshot.taskItemId), runId);
          ensureActive(runId);
          panel.refreshPageSnapshot(nextSnapshot, null, runtimeSettings);
        }
      }

      function start() {
        if (detector.getPageType() !== "asrmark") {
          syncState({
            enabled: false,
            status: "idle",
            statusText: "仅标注单条页支持",
          });
          return;
        }
        if (state.enabled) {
          return;
        }
        state.runId += 1;
        state.controller = typeof AbortController === "function" ? new AbortController() : null;
        syncState({
          enabled: true,
          status: "waiting_ready",
          statusText: "等待加载",
        });
        const currentRunId = state.runId;
        void runLoop(currentRunId).catch(function (error) {
          if (error?.code === "user-aborted") {
            if (state.runId === currentRunId) {
              syncState({
                enabled: false,
                status: "stopped",
                statusText: "已停止",
              });
            }
            return;
          }
          if (state.runId === currentRunId) {
            syncState({
              enabled: false,
              status: "error",
              statusText: "失败停机",
            });
            panel.setMessage(error?.message || "全自动执行失败。");
          }
        });
      }

      function stop(nextStatus, nextText) {
        state.runId += 1;
        if (state.controller) {
          state.controller.abort();
        }
        state.controller = null;
        syncState({
          enabled: false,
          status: nextStatus || "stopped",
          statusText: nextText || "已停止",
        });
      }

      function isEnabled() {
        return state.enabled === true;
      }

      function syncPageSupport(pageType) {
        panel.setAutoRunState({
          pageSupported: pageType === "asrmark",
        });
      }

      return {
        isEnabled: isEnabled,
        start: start,
        stop: stop,
        syncPageSupport: syncPageSupport,
      };
    }

    autoRunner = createAutoRunner();

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
        toggleAutoRun: function () {
          if (autoRunner?.isEnabled()) {
            autoRunner.stop("stopped", "已停止");
            return Promise.resolve();
          }
          autoRunner?.start();
          return Promise.resolve();
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
            panel.setMessage("客家话助手已在 options 中关闭。");
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
      autoRunner?.syncPageSupport(pageType);
      if (pageType !== lastRouteLog) {
        lastRouteLog = pageType;
        safeInfo("[MagicData][Hakka] route detected: " + pageType);
      }

      if (pageType === "asrmark" || pageType === "asrmarkCheck") {
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
        const nextRouteKey = [
          pageType,
          String(snapshot.taskItemId || ""),
          String(snapshot.samplingRecordId || ""),
        ].join(":");
        if (nextRouteKey && lastRouteKey && nextRouteKey !== lastRouteKey) {
          panel.clearResult();
          panel.setMessage("当前条已变化，请重新点击 AI 质检当前条。");
        }
        lastRouteKey = nextRouteKey;
        lastTaskKey = nextTaskKey;
        panel.setRuntimeSettings(runtimeSettings);
        panel.refreshPageSnapshot(snapshot, null, runtimeSettings);
        if (
          pageType === "asrmark" &&
          snapshot.taskItemId &&
          typeof collector.getCachedDetail === "function" &&
          typeof collector.refreshCurrentItem === "function" &&
          !collector.getCachedDetail(snapshot.taskItemId)
        ) {
          collector
            .refreshCurrentItem({
              pageType: pageType,
              taskItemId: snapshot.taskItemId,
              samplingRecordId: snapshot.samplingRecordId,
            })
            .then(function (latestSnapshot) {
              const nextSnapshot = latestSnapshot && typeof latestSnapshot === "object" ? latestSnapshot : snapshot;
              nextSnapshot.pageType = pageType;
              panel.refreshPageSnapshot(nextSnapshot, null, runtimeSettings);
            })
            .catch(function () {
              // Keep DOM snapshot when API warmup fails.
            });
        }
        return;
      }
      if (pageType !== "asrmark") {
        autoRunner?.stop("stopped", "仅标注单条页支持");
      }
      lastTaskKey = "";
      lastRouteKey = "";
      panel.remove();
    }

    function ensurePanelMountedWithRetry() {
      if (!detector.isMagicDataHost()) {
        return;
      }
      const pageType = detector.getPageType();
      if (pageType !== "asrmark" && pageType !== "asrmarkCheck") {
        return;
      }
      const mounted = panel.ensureMounted();
      if (mounted) {
        mountRetryCount = 0;
        refresh();
        return;
      }
      if (mountRetryCount >= MOUNT_RETRY_LIMIT) {
        safeWarn("[MagicData][Hakka] panel mount retry exhausted");
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
      autoRunner?.stop("stopped", "已停止");
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
          safeWarn("[MagicData][Hakka] runtime dependencies missing");
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
      safeWarn("[MagicData][Hakka] runtime error: " + String(error?.message || error || "unknown"));
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
    safeInfo("[MagicData][Hakka] content started");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleEvaluatePage, { once: true });
  } else {
    scheduleEvaluatePage();
  }
  installRouteWatch();
})();


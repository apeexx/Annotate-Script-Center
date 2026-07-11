(function () {
  const LOG_PREFIX = "[ASR Edge][judgement-content]";
  const constants = globalThis.ASREdgeConstants || {};
  const storage = globalThis.ASREdgeStorage || null;
  const detector = globalThis.__ASREdgeAlibabaLabelxJudgementPageDetector || null;
  const audioController = globalThis.__ASREdgeAlibabaLabelxJudgementAudioController || null;
  const pageSizeModule = globalThis.__ASREdgeAlibabaLabelxJudgementPageSize || null;
  const durationSummaryModule = globalThis.__ASREdgeAlibabaLabelxJudgementDurationSummary || null;
  const virtualWindowModule = globalThis.__ASREdgeAlibabaLabelxJudgementVirtualWindow || null;
  const diffViewModule = globalThis.__ASREdgeAlibabaLabelxJudgementAsrDiffView || null;
  const thunderQuestionModule = globalThis.__ASREdgeAlibabaLabelxJudgementThunderQuestion || null;
  const compactCardModule = globalThis.__ASREdgeAlibabaLabelxJudgementCompactCard || null;
  const aiSuggestionModule = globalThis.__ASREdgeAlibabaLabelxJudgementAiSuggestion || null;
  const judgementServerModule = globalThis.__ASREdgeAlibabaLabelxJudgementServer || null;
  const autoAdvanceModule = globalThis.__ASREdgeAlibabaLabelxJudgementAutoAdvance || null;
  const actionModule = globalThis.__ASREdgeAlibabaLabelxJudgementActions || null;
  const toastModule = globalThis.__ASREdgeAlibabaLabelxJudgementToast || null;
  const shortcutModule = globalThis.__ASREdgeAlibabaLabelxJudgementShortcuts || null;
  const toolbarModule = globalThis.__ASREdgeAlibabaLabelxJudgementToolbar || null;
  const messageTypes = constants.MESSAGE_TYPES || {};
  const defaultBackendBaseUrls = constants.DEFAULT_BACKEND_BASE_URLS || {};
  const judgementStatsUploadMessageType =
    messageTypes.JUDGEMENT_STATS_UPLOAD || "ASR_EDGE_JUDGEMENT_STATS_UPLOAD";
  const storageKey = constants.STORAGE_KEY || "asrEdgeSettings";
  const judgementProjectId = constants.JUDGEMENT_PROJECT_ID || "judgement";
  const networkMessageSource = "ASR_EDGE_JUDGEMENT_PAGE_WORLD";
  const contentMessageSource = "ASR_EDGE_JUDGEMENT_CONTENT";
  const networkConfigMessageType = "ASR_EDGE_JUDGEMENT_NETWORK_CONFIG";
  const networkSummaryMessageType = "ASR_EDGE_JUDGEMENT_SUBTASK_DATA_SUMMARY";
  const statsUploadActionKey = "statsUpload";
  const aiSuggestActionKey = "aiSuggestCurrentItem";
  const aiApplyActionKey = "applyAiSuggestion";
  const aiRetryActionKey = "retryAiSuggestion";
  const aiIgnoreActionKey = "ignoreAiSuggestion";
  const aiCopyAsrTextPairActionKey = "copyAsrTextPair";
  const submitTaskActionKey = "submitTask";
  const submitTaskAndFinishActionKey = "submitTaskAndFinish";
  const maxCustomPageSizeValue = 400;
  let settings = null;
  let runtimeEnabled = false;
  let messageBridgeBound = false;
  let networkBridgeBound = false;
  let refreshPromise = null;
  let shortcutRuntime = null;
  let toastRuntime = null;
  let toolbarRuntime = null;
  let virtualWindowRuntime = null;
  let diffViewRuntime = null;
  let thunderQuestionRuntime = null;
  let compactCardRuntime = null;
  let aiSuggestionRuntime = null;
  let judgementServerRuntime = null;
  let autoAdvanceRuntime = null;
  let durationSummary = {
    status: "idle",
    totalSeconds: 0,
    itemCount: 0,
    durationCount: 0,
    expectedCount: 0,
    source: "",
    updatedAt: null,
    error: "",
  };
  let durationFetchPromise = null;
  let durationFetchKey = "";
  let pageSizeRuntime = null;
  let lastStatus = {
    ok: false,
    scriptId: judgementProjectId,
    pageType: "not-started",
    enabled: false,
    reason: "not-started",
  };

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function isTopLevelContext() {
    return window.top === window.self;
  }

  function deepMerge(base, override) {
    const source = base && typeof base === "object" && !Array.isArray(base) ? base : {};
    const patch = override && typeof override === "object" && !Array.isArray(override) ? override : {};
    const result = Object.assign({}, source);

    Object.keys(patch).forEach(function (key) {
      if (
        source[key] &&
        typeof source[key] === "object" &&
        !Array.isArray(source[key]) &&
        patch[key] &&
        typeof patch[key] === "object" &&
        !Array.isArray(patch[key])
      ) {
        result[key] = deepMerge(source[key], patch[key]);
      } else {
        result[key] = clone(patch[key]);
      }
    });

    return result;
  }

  function getPlatformSettings(nextSettings) {
    return nextSettings?.platforms?.alibabaLabelx || {};
  }

  function getActiveProjectId(nextSettings) {
    return (
      getPlatformSettings(nextSettings)?.scriptCenter?.activeProjectId ||
      constants.TRANSCRIPTION_PROJECT_ID ||
      "transcription"
    );
  }

  function getGlobalBackendEndpointMode(nextSettings) {
    if (typeof constants.getBackendEndpointModeFromSettings === "function") {
      return constants.getBackendEndpointModeFromSettings(nextSettings || {});
    }
    const mode = String(nextSettings?.meta?.backendEndpointMode || "").trim().toLowerCase();
    return mode === "local" ? "local" : "server";
  }

  function getJudgementConfig(nextSettings) {
    const defaults = constants.DEFAULT_JUDGEMENT_ASR_CONFIG || {
      itemsPerPage: "50 条/页",
      autoPlay: true,
      autoResetRate: true,
      resetRateValue: 1.0,
      playbackRateValue: 1.0,
      rateStepValue: 0.25,
      seekStepSeconds: 0.5,
      volumeValue: 100,
      virtualWindowEnabled: false,
      asrDiffViewEnabled: true,
      asrDiffColors: {
        changeBackground: "#fef3c7",
        gapBackground: "#fee2e2",
        punctuationBackground: "#ede9fe",
      },
      compactCardEnabled: true,
      thunderQuestionEnabled: true,
      autoAdvanceAfterChoice: false,
      statsUploadEnabled: true,
      statsUploadEndpoint:
        String(defaultBackendBaseUrls.server || "").replace(/\/+$/, "") +
        "/api/alibaba-labelx/asr-judgement/statistics/upload",
      statsScheduleUrl: "",
      statsUploadTimes: ["10:00", "16:00"],
      statsUploadJitterMinutes: 10,
      statsAutoUploadOnSubtaskOpen: false,
      statsAutoUploadOnSchedule: true,
      statsUploadRequestTimeoutMs: 20000,
      aiSuggestionEnabled: true,
      aiSuggestionEndpoint:
        String(defaultBackendBaseUrls.server || "").replace(/\/+$/, "") +
        "/api/alibaba-labelx/asr-judgement/ai/suggest",
      aiSuggestionRequestTimeoutMs: 60000,
      aiSuggestionListenModel: "qwen3.5-omni-flash",
      aiSuggestionCompareModel: "qwen3.5-plus",
      aiSuggestionListenPrompt: "",
      aiSuggestionComparePrompt: "",
      aiSuggestionTemperature: "",
      aiSuggestionTopP: "",
      aiSuggestionMaxTokens: "",
      aiSuggestionMaxCompletionTokens: "",
      aiSuggestionPresencePenalty: "",
      aiSuggestionFrequencyPenalty: "",
      aiSuggestionSeed: "",
      aiSuggestionResponseFormat: "json_object",
      aiSuggestionReasoningEffort: "",
      aiSuggestionStopSequences: "",
      aiSuggestionEnableThinking: false,
      aiSuggestionWebSearchEnabled: true,
      aiSuggestionModel: "qwen3.5-plus",
      aiSuggestionAvailableModels: ["qwen3.5-plus", "qwen-plus", "qwen-turbo"],
      shortcuts: {
        volumeUp: {
          ctrl: false,
          alt: false,
          shift: false,
          meta: false,
          key: "[",
          button: null,
        },
        volumeDown: {
          ctrl: false,
          alt: false,
          shift: false,
          meta: false,
          key: "]",
          button: null,
        },
        volumeReset: {
          ctrl: false,
          alt: false,
          shift: false,
          meta: false,
          key: "\\",
          button: null,
        },
        seekBackward: {
          ctrl: false,
          alt: false,
          shift: false,
          meta: false,
          key: "ArrowLeft",
          button: null,
        },
        seekForward: {
          ctrl: false,
          alt: false,
          shift: false,
          meta: false,
          key: "ArrowRight",
          button: null,
        },
        playPause: {
          ctrl: false,
          alt: false,
          shift: false,
          meta: false,
          key: "Space",
          button: null,
        },
        aiSuggestCurrentItem: null,
        applyAiSuggestion: null,
        retryAiSuggestion: null,
        ignoreAiSuggestion: null,
        copyAsrTextPair: null,
        submitTask: null,
        submitTaskAndFinish: null,
      },
    };
    const projectConfig =
      getPlatformSettings(nextSettings)?.scriptCenter?.projects?.[judgementProjectId]?.asrConfig || {};

    return Object.assign(deepMerge(defaults, projectConfig), {
      virtualWindowEnabled: false,
      aiSuggestionEnabled: true,
      backendEndpointMode: getGlobalBackendEndpointMode(nextSettings),
    });
  }

  function getJudgementServerConfig() {
    return Object.assign({}, getJudgementConfig(settings), {
      legacyServer: clone(getPlatformSettings(settings)?.legacyServer || {}),
      settings: clone(settings || {}),
    });
  }

  function normalizePageSizeSetting(value) {
    if (pageSizeModule && typeof pageSizeModule.normalizePageSizeSetting === "function") {
      return pageSizeModule.normalizePageSizeSetting(value, maxCustomPageSizeValue);
    }

    return {
      mode: "native",
      pageSize: 50,
      label: "50 条/页",
      nativeLabel: "50 条/页",
    };
  }

  function getConfiguredPageSize(nextSettings) {
    return normalizePageSizeSetting(getJudgementConfig(nextSettings || settings).itemsPerPage);
  }

  function formatDuration(totalSeconds) {
    if (durationSummaryModule && typeof durationSummaryModule.formatDuration === "function") {
      return durationSummaryModule.formatDuration(totalSeconds);
    }

    return "--";
  }

  function normalizeUrlParam(value) {
    try {
      return decodeURIComponent(String(value || "")).trim();
    } catch (error) {
      return String(value || "").trim();
    }
  }

  function getCurrentSubTaskId() {
    const params = new URLSearchParams(location.search || "");
    return normalizeUrlParam(params.get("subTaskId") || "");
  }

  function shouldUseDurationSummary(nextSummary) {
    if (!nextSummary || nextSummary.status === "empty") {
      return false;
    }

    if (nextSummary.status === "ready") {
      return true;
    }

    if (durationSummary.status !== "ready") {
      return (nextSummary.durationCount || 0) >= (durationSummary.durationCount || 0);
    }

    return false;
  }

  function setDurationSummary(nextSummary) {
    if (!shouldUseDurationSummary(nextSummary)) {
      return;
    }

    durationSummary = Object.assign({}, durationSummary, nextSummary);
    updateToolbarRuntimeStats();
  }

  function setDurationError(message) {
    durationSummary = Object.assign({}, durationSummary, {
      status: "error",
      error: String(message || "总时长读取失败。"),
      updatedAt: new Date().toISOString(),
    });
    updateToolbarRuntimeStats();
  }

  async function fetchCompleteSubtaskDurationSummary(subTaskId) {
    if (
      durationSummaryModule &&
      typeof durationSummaryModule.fetchCompleteSubtaskDurationSummary === "function"
    ) {
      return durationSummaryModule.fetchCompleteSubtaskDurationSummary(subTaskId, maxCustomPageSizeValue);
    }

    throw new Error("总时长模块未加载。");
  }

  function refreshDurationSummary(reason) {
    if (!runtimeEnabled || !isTopLevelContext()) {
      return;
    }

    const subTaskId = getCurrentSubTaskId();
    if (!subTaskId) {
      setDurationError("URL 中未找到 subTaskId。");
      return;
    }

    const cacheKey = subTaskId + "|" + String(maxCustomPageSizeValue);
    if (
      durationFetchPromise ||
      (durationFetchKey === cacheKey && durationSummary.status === "ready")
    ) {
      return;
    }

    durationFetchKey = cacheKey;
    durationSummary = Object.assign({}, durationSummary, {
      status: "loading",
      source: reason || "runtime",
      error: "",
    });
    updateToolbarRuntimeStats();

    durationFetchPromise = fetchCompleteSubtaskDurationSummary(subTaskId)
      .then(function (summary) {
        setDurationSummary(summary);
      })
      .catch(function (error) {
        durationFetchKey = "";
        setDurationError(error && error.message ? error.message : String(error));
      })
      .finally(function () {
        durationFetchPromise = null;
      });
  }

  function getChoiceAction(actionKey) {
    if (actionModule && typeof actionModule.getChoiceAction === "function") {
      return actionModule.getChoiceAction(actionKey);
    }

    return null;
  }

  function buildActionResult(action, ok, extra) {
    if (actionModule && typeof actionModule.buildActionResult === "function") {
      return actionModule.buildActionResult(action, ok, extra);
    }

    return Object.assign(
      {
        action: action,
        ok: ok === true,
        at: new Date().toISOString(),
      },
      extra || {}
    );
  }

  function runRuntimeAction(actionKey, source) {
    if (actionKey === statsUploadActionKey) {
      return uploadJudgementStats(source);
    }

    if (actionKey === aiSuggestActionKey) {
      return suggestCurrentItemWithAi(source);
    }
    if (actionKey === aiApplyActionKey) {
      return applyCurrentAiSuggestion(source);
    }
    if (actionKey === aiRetryActionKey) {
      return retryCurrentAiSuggestion(source);
    }
    if (actionKey === aiIgnoreActionKey) {
      return ignoreCurrentAiSuggestion(source);
    }
    if (actionKey === aiCopyAsrTextPairActionKey) {
      return copyCurrentAsrTextPair(source);
    }
    if (actionKey === submitTaskActionKey && actionModule && typeof actionModule.submitTask === "function") {
      return Promise.resolve(actionModule.submitTask());
    }
    if (
      actionKey === submitTaskAndFinishActionKey &&
      actionModule &&
      typeof actionModule.submitTaskAndFinish === "function"
    ) {
      return Promise.resolve(actionModule.submitTaskAndFinish());
    }

    if (getChoiceAction(actionKey) && actionModule && typeof actionModule.selectJudgementChoice === "function") {
      return Promise.resolve(actionModule.selectJudgementChoice(actionKey));
    }

    if (audioController && typeof audioController.runAction === "function") {
      return audioController.runAction(actionKey);
    }

    return Promise.resolve(
      buildActionResult(actionKey, false, {
        reason: "action-controller-missing",
        source: source || "unknown",
        message: "当前动作控制器不可用。",
      })
    );
  }

  function isChoiceAction(actionKey) {
    return Boolean(getChoiceAction(actionKey));
  }

  function ensureAutoAdvanceRuntime() {
    if (
      autoAdvanceRuntime ||
      !autoAdvanceModule ||
      typeof autoAdvanceModule.createRuntime !== "function"
    ) {
      return autoAdvanceRuntime;
    }

    autoAdvanceRuntime = autoAdvanceModule.createRuntime({
      shouldApply: function () {
        return Boolean(runtimeEnabled && isTopLevelContext());
      },
    });
    return autoAdvanceRuntime;
  }

  function maybeAutoAdvanceAfterChoice(actionKey, result) {
    if (!isChoiceAction(actionKey) || result?.ok !== true) {
      return Promise.resolve(null);
    }

    if (getJudgementConfig(settings).autoAdvanceAfterChoice !== true) {
      return Promise.resolve(null);
    }

    const runtime = ensureAutoAdvanceRuntime();
    if (!runtime || typeof runtime.advance !== "function") {
      return Promise.resolve(null);
    }

    return Promise.resolve(runtime.advance(result));
  }

  function ensureToastRuntime() {
    if (toastRuntime || !toastModule || typeof toastModule.createRuntime !== "function") {
      return toastRuntime;
    }

    toastRuntime = toastModule.createRuntime({
      isTopLevelContext: isTopLevelContext,
    });
    return toastRuntime;
  }

  function showRuntimeToast(message, tone) {
    const runtime = ensureToastRuntime();
    if (!runtime || typeof runtime.show !== "function") {
      return;
    }

    runtime.show(message, tone);
  }

  function runActionWithFeedback(actionKey, source, statusReason, statusKey) {
    if (actionKey === aiSuggestActionKey) {
      showRuntimeToast("AI 分析已开始，请等待结果。", "info");
    } else if (actionKey === aiRetryActionKey) {
      showRuntimeToast("AI 重新分析已开始，请等待结果。", "info");
    }

    void runRuntimeAction(actionKey, source)
      .then(function (result) {
        return maybeAutoAdvanceAfterChoice(actionKey, result).then(function (advanceResult) {
          lastStatus = buildStatus(statusReason + actionKey);
          lastStatus[statusKey] = {
            actionKey: actionKey,
            result: result || null,
            advance: advanceResult || null,
          };
          showRuntimeToast(
            advanceResult?.message ||
              result?.message ||
              (source === "shortcut" ? "快捷键已执行。" : "操作已执行。"),
            result?.ok === false || advanceResult?.ok === false ? "error" : "info"
          );
          updateToolbarRuntimeStats();
        });
      })
      .catch(function (error) {
        showRuntimeToast(
          (source === "shortcut" ? "快捷键执行失败：" : "操作失败：") +
            (error && error.message ? error.message : String(error)),
          "error"
        );
      });
  }

  function ensureShortcutRuntime() {
    if (shortcutRuntime || !shortcutModule || typeof shortcutModule.createRuntime !== "function") {
      return shortcutRuntime;
    }

    shortcutRuntime = shortcutModule.createRuntime({
      getShortcuts: function () {
        return getJudgementConfig(settings).shortcuts || {};
      },
      getShortcutActionOrder: function () {
        const baseOrder = (actionModule && actionModule.shortcutActionOrder) || [];
        const aiOrder = [
          aiSuggestActionKey,
          aiApplyActionKey,
          aiRetryActionKey,
          aiIgnoreActionKey,
          aiCopyAsrTextPairActionKey,
        ];
        const merged = baseOrder.slice();
        aiOrder.forEach(function (actionKey) {
          if (merged.indexOf(actionKey) < 0) {
            merged.push(actionKey);
          }
        });
        return merged;
      },
      isEnabled: function () {
        return Boolean(runtimeEnabled && settings);
      },
      runActionWithFeedback: runActionWithFeedback,
    });
    return shortcutRuntime;
  }

  function bindShortcutListeners() {
    const runtime = ensureShortcutRuntime();
    if (!runtime || typeof runtime.bind !== "function") {
      return;
    }

    runtime.bind();
  }

  function shouldShowToolbar() {
    const pageInfo = detector && typeof detector.detect === "function" ? detector.detect() : null;
    return Boolean(
      runtimeEnabled &&
        isTopLevelContext() &&
        location.hostname === constants?.TARGET_PLATFORM?.host &&
        String(location.pathname || "").toLowerCase().indexOf("/corpora/labeling/sdk") >= 0 &&
        (!pageInfo || pageInfo.isJudgementDetail || pageInfo.pageType === "judgement-detail-pending")
    );
  }

  function isLabelingCenterHome() {
    const path = String(location.pathname || "").toLowerCase();
    return Boolean(
      runtimeEnabled &&
        isTopLevelContext() &&
        location.hostname === constants?.TARGET_PLATFORM?.host &&
        (path.indexOf("/corpora/labeling/labelingtask") >= 0 ||
          path.indexOf("/corpora/labeling/checktask") >= 0)
    );
  }

  function getDurationSummaryText() {
    if (durationSummary.status === "ready" || durationSummary.status === "partial") {
      const countText = durationSummary.expectedCount
        ? String(durationSummary.durationCount || durationSummary.itemCount || 0) + "/" + String(durationSummary.expectedCount)
        : String(durationSummary.durationCount || durationSummary.itemCount || 0);
      return "总时长 " + formatDuration(durationSummary.totalSeconds) + " (" + countText + "条)";
    }

    if (durationSummary.status === "loading") {
      return "总时长 读取中";
    }

    if (durationSummary.status === "error") {
      return "总时长 读取失败";
    }

    return "总时长 --";
  }

  function getDurationSummaryTitle() {
    if (durationSummary.status === "error") {
      return durationSummary.error || "总时长读取失败。";
    }

    return [
      "来源：" + String(durationSummary.source || "未读取"),
      "样本：" + String(durationSummary.durationCount || durationSummary.itemCount || 0) + "/" + String(durationSummary.expectedCount || 0),
      "更新时间：" + String(durationSummary.updatedAt || "--"),
    ].join("\n");
  }

  function getPageSizeStatText() {
    const pageSize = getConfiguredPageSize(settings);
    return "每页 " + pageSize.label;
  }

  function getPageSizeStatTitle() {
    const pageSize = getConfiguredPageSize(settings);
    return pageSize.mode === "custom"
      ? "自定义页数会尝试把 LabelX data 请求 pageSize 改为 " + String(pageSize.pageSize) + "。数值越大，页面渲染压力越高。"
      : "进入页面后会尝试切换原生分页选择器。";
  }

  function formatPlaybackRate(rateValue) {
    const numericValue = Number(rateValue);
    if (!Number.isFinite(numericValue)) {
      return "1x";
    }

    return Number.isInteger(numericValue)
      ? String(numericValue) + "x"
      : Number(numericValue.toFixed(2)).toString() + "x";
  }

  function getAudioDefaultStatText() {
    const config = getJudgementConfig(settings);
    return [
      "默认倍速 " + formatPlaybackRate(config.resetRateValue ?? config.playbackRateValue),
      "默认音量 " + String(config.volumeValue) + "%",
    ].join(" / ");
  }

  function getAudioDefaultStatTitle() {
    const config = getJudgementConfig(settings);
    return [
      "默认倍速：" + formatPlaybackRate(config.resetRateValue ?? config.playbackRateValue),
      "倍速步进：" + String(config.rateStepValue || 0.25),
      "默认音量：" + String(config.volumeValue) + "%",
      "前进 / 后退步长：" + String(config.seekStepSeconds || 0.5) + " 秒",
    ].join("\n");
  }

  function getTopSummaryText() {
    return [getDurationSummaryText(), getPageSizeStatText(), getAudioDefaultStatText()].join(" | ");
  }

  function getTopSummaryTitle() {
    return [getDurationSummaryTitle(), getPageSizeStatTitle(), getAudioDefaultStatTitle()].join("\n\n");
  }

  function ensureToolbarRuntime() {
    if (toolbarRuntime || !toolbarModule || typeof toolbarModule.createRuntime !== "function") {
      return toolbarRuntime;
    }

    toolbarRuntime = toolbarModule.createRuntime({
      shouldShowToolbar: shouldShowToolbar,
      getChoiceActions: function () {
        return (actionModule && actionModule.choiceActions) || [];
      },
      getAudioActionLabels: function () {
        return (actionModule && actionModule.audioActionLabels) || {};
      },
      getDurationSummaryText: getDurationSummaryText,
      getDurationSummaryTitle: getDurationSummaryTitle,
      getPageSizeStatText: getPageSizeStatText,
      getPageSizeStatTitle: getPageSizeStatTitle,
      getTopSummaryText: getTopSummaryText,
      getTopSummaryTitle: getTopSummaryTitle,
      getExtraActionGroups: function () {
        return [
          {
            label: "AI",
            actions: [
              {
                key: aiSuggestActionKey,
                label: "AI 分析当前题",
                shortLabel: "AI 分析",
              },
              {
                key: aiCopyAsrTextPairActionKey,
                label: "复制两条 ASR 文本",
                shortLabel: "复制ASR",
              },
            ],
          },
        ];
      },
      runActionWithFeedback: runActionWithFeedback,
    });
    return toolbarRuntime;
  }

  function updateToolbarRuntimeStats() {
    const runtime = ensureToolbarRuntime();
    if (!runtime || typeof runtime.update !== "function") {
      return;
    }

    runtime.update();
  }

  function startToolbar() {
    const runtime = ensureToolbarRuntime();
    if (!runtime || typeof runtime.start !== "function") {
      return;
    }

    runtime.start();
  }

  function stopToolbar() {
    if (toolbarRuntime && typeof toolbarRuntime.stop === "function") {
      toolbarRuntime.stop();
    }
  }

  function ensurePageSizeRuntime() {
    if (pageSizeRuntime || !pageSizeModule || typeof pageSizeModule.createRuntime !== "function") {
      return pageSizeRuntime;
    }

    pageSizeRuntime = pageSizeModule.createRuntime({
      getPageSize: function () {
        return getConfiguredPageSize(settings);
      },
      shouldApply: function () {
        return Boolean(runtimeEnabled && settings && shouldShowToolbar());
      },
    });
    return pageSizeRuntime;
  }

  function scheduleConfiguredPageSizeApply(reason) {
    const runtime = ensurePageSizeRuntime();
    if (!runtime || typeof runtime.scheduleApply !== "function") {
      return;
    }

    runtime.scheduleApply(reason);
  }

  function stopConfiguredPageSizeApply() {
    if (pageSizeRuntime && typeof pageSizeRuntime.stop === "function") {
      pageSizeRuntime.stop();
    }
  }

  function ensureVirtualWindowRuntime() {
    if (
      virtualWindowRuntime ||
      !virtualWindowModule ||
      typeof virtualWindowModule.createRuntime !== "function"
    ) {
      return virtualWindowRuntime;
    }

    virtualWindowRuntime = virtualWindowModule.createRuntime({
      shouldApply: function () {
        return Boolean(runtimeEnabled && isTopLevelContext());
      },
    });
    return virtualWindowRuntime;
  }

  function startVirtualWindow() {
    const runtime = ensureVirtualWindowRuntime();
    if (!runtime || typeof runtime.start !== "function") {
      return;
    }

    runtime.start(getJudgementConfig(settings));
  }

  function stopVirtualWindow() {
    if (virtualWindowRuntime && typeof virtualWindowRuntime.stop === "function") {
      virtualWindowRuntime.stop();
    }
  }

  function ensureDiffViewRuntime() {
    if (diffViewRuntime || !diffViewModule || typeof diffViewModule.createRuntime !== "function") {
      return diffViewRuntime;
    }

    diffViewRuntime = diffViewModule.createRuntime({
      shouldApply: function () {
        return Boolean(runtimeEnabled && isTopLevelContext());
      },
      getColors: function () {
        return getJudgementConfig(settings).asrDiffColors;
      },
    });
    return diffViewRuntime;
  }

  function startDiffView() {
    if (getJudgementConfig(settings).asrDiffViewEnabled === false) {
      stopDiffView();
      return;
    }

    const runtime = ensureDiffViewRuntime();
    if (runtime && typeof runtime.start === "function") {
      runtime.start();
    }
  }

  function stopDiffView() {
    if (diffViewRuntime && typeof diffViewRuntime.stop === "function") {
      diffViewRuntime.stop();
    }
  }

  function ensureThunderQuestionRuntime() {
    if (
      thunderQuestionRuntime ||
      !thunderQuestionModule ||
      typeof thunderQuestionModule.createRuntime !== "function"
    ) {
      return thunderQuestionRuntime;
    }

    thunderQuestionRuntime = thunderQuestionModule.createRuntime({
      shouldApply: function () {
        return Boolean(runtimeEnabled && isTopLevelContext());
      },
      getConfig: function () {
        return getJudgementConfig(settings);
      },
      showToast: showRuntimeToast,
    });
    return thunderQuestionRuntime;
  }

  function startThunderQuestion() {
    const runtime = ensureThunderQuestionRuntime();
    if (runtime && typeof runtime.start === "function") {
      runtime.start();
    }
  }

  function stopThunderQuestion() {
    if (thunderQuestionRuntime && typeof thunderQuestionRuntime.stop === "function") {
      thunderQuestionRuntime.stop();
    }
  }

  function ensureCompactCardRuntime() {
    if (compactCardRuntime || !compactCardModule || typeof compactCardModule.createRuntime !== "function") {
      return compactCardRuntime;
    }

    compactCardRuntime = compactCardModule.createRuntime({
      shouldApply: function () {
        return Boolean(runtimeEnabled && isTopLevelContext());
      },
      shouldRenderDiff: function () {
        return getJudgementConfig(settings).asrDiffViewEnabled !== false;
      },
      getDiffColors: function () {
        return getJudgementConfig(settings).asrDiffColors;
      },
    });
    return compactCardRuntime;
  }

  function startCompactCard() {
    if (getJudgementConfig(settings).compactCardEnabled === false) {
      stopCompactCard();
      return;
    }

    const runtime = ensureCompactCardRuntime();
    if (runtime && typeof runtime.start === "function") {
      runtime.start();
    }
  }

  function stopCompactCard() {
    if (compactCardRuntime && typeof compactCardRuntime.stop === "function") {
      compactCardRuntime.stop();
    }
  }

  function ensureJudgementServerRuntime() {
    if (
      judgementServerRuntime ||
      !judgementServerModule ||
      typeof judgementServerModule.createRuntime !== "function"
    ) {
      return judgementServerRuntime;
    }

    judgementServerRuntime = judgementServerModule.createRuntime({
      shouldApply: function () {
        return Boolean(runtimeEnabled && isTopLevelContext() && (shouldShowToolbar() || isLabelingCenterHome()));
      },
      getConfig: getJudgementServerConfig,
      showToast: showRuntimeToast,
      onStateChange: updateToolbarRuntimeStats,
    });
    return judgementServerRuntime;
  }

  function startJudgementServer() {
    const runtime = ensureJudgementServerRuntime();
    if (runtime && typeof runtime.start === "function") {
      runtime.start();
    }
  }

  function stopJudgementServer() {
    if (judgementServerRuntime && typeof judgementServerRuntime.stop === "function") {
      judgementServerRuntime.stop();
    }
  }

  function uploadJudgementStats(source) {
    const runtime = ensureJudgementServerRuntime();
    if (!runtime || typeof runtime.uploadNow !== "function") {
      return Promise.resolve(
        buildActionResult(statsUploadActionKey, false, {
          reason: "stats-uploader-missing",
          source: source || "unknown",
          message: "统计上传模块不可用。",
        })
      );
    }

    return Promise.resolve(runtime.uploadNow(source || "manual"));
  }

  async function getThunderInfoForItem(item) {
    if (!item || !thunderQuestionModule || typeof thunderQuestionModule.getItemInfo !== "function") {
      return null;
    }
    if (getJudgementConfig(settings).thunderQuestionEnabled === false) {
      return null;
    }

    if (typeof thunderQuestionModule.ensureBankLoaded === "function") {
      await thunderQuestionModule.ensureBankLoaded();
    }
    return thunderQuestionModule.getItemInfo(item);
  }

  function ensureAiSuggestionRuntime() {
    if (
      aiSuggestionRuntime ||
      !aiSuggestionModule ||
      typeof aiSuggestionModule.createRuntime !== "function"
    ) {
      return aiSuggestionRuntime;
    }

    aiSuggestionRuntime = aiSuggestionModule.createRuntime({
      shouldApply: function () {
        return Boolean(runtimeEnabled && isTopLevelContext() && shouldShowToolbar());
      },
      getConfig: function () {
        return getJudgementConfig(settings);
      },
      applySuggestion: function (choiceActionKey) {
        if (!actionModule || typeof actionModule.selectJudgementChoice !== "function") {
          return buildActionResult(choiceActionKey, false, {
            reason: "judgement-action-missing",
            message: "判别动作不可用。",
          });
        }
        return actionModule.selectJudgementChoice(choiceActionKey);
      },
      getThunderInfo: getThunderInfoForItem,
      showToast: showRuntimeToast,
      onResult: function (info) {
        if (!info) {
          return;
        }
        console.info(LOG_PREFIX, "AI suggest completed.", {
          requestId: info.requestId || "",
          hostname: info.hostname || "",
          itemIndex: Number(info.itemIndex),
          listenModel: info.listenModel || "",
          compareModel: info.compareModel || "",
          includeContext: info.includeContext === true,
        });
      },
    });
    return aiSuggestionRuntime;
  }

  function startAiSuggestion() {
    const runtime = ensureAiSuggestionRuntime();
    if (runtime && typeof runtime.start === "function") {
      runtime.start();
    }
  }

  function stopAiSuggestion() {
    if (aiSuggestionRuntime && typeof aiSuggestionRuntime.stop === "function") {
      aiSuggestionRuntime.stop();
    }
  }

  function suggestCurrentItemWithAi(source) {
    const runtime = ensureAiSuggestionRuntime();
    if (!runtime || typeof runtime.suggestCurrentItem !== "function") {
      return Promise.resolve(
        buildActionResult(aiSuggestActionKey, false, {
          reason: "ai-suggestion-module-missing",
          source: source || "unknown",
          message: "AI 建议模块不可用。",
        })
      );
    }

    return Promise.resolve(runtime.suggestCurrentItem(source || "manual"));
  }

  function applyCurrentAiSuggestion(source) {
    const runtime = ensureAiSuggestionRuntime();
    if (!runtime || typeof runtime.applyCurrentSuggestion !== "function") {
      return Promise.resolve(
        buildActionResult(aiApplyActionKey, false, {
          reason: "ai-suggestion-module-missing",
          source: source || "unknown",
          message: "AI 建议模块不可用。",
        })
      );
    }
    return Promise.resolve(runtime.applyCurrentSuggestion(source || "manual"));
  }

  function retryCurrentAiSuggestion(source) {
    const runtime = ensureAiSuggestionRuntime();
    if (!runtime || typeof runtime.retryCurrentSuggestion !== "function") {
      return Promise.resolve(
        buildActionResult(aiRetryActionKey, false, {
          reason: "ai-suggestion-module-missing",
          source: source || "unknown",
          message: "AI 建议模块不可用。",
        })
      );
    }
    return Promise.resolve(runtime.retryCurrentSuggestion(source || "manual"));
  }

  function ignoreCurrentAiSuggestion(source) {
    const runtime = ensureAiSuggestionRuntime();
    if (!runtime || typeof runtime.ignoreCurrentSuggestion !== "function") {
      return Promise.resolve(
        buildActionResult(aiIgnoreActionKey, false, {
          reason: "ai-suggestion-module-missing",
          source: source || "unknown",
          message: "AI 建议模块不可用。",
        })
      );
    }
    return Promise.resolve(runtime.ignoreCurrentSuggestion(source || "manual"));
  }

  function copyCurrentAsrTextPair(source) {
    const runtime = ensureAiSuggestionRuntime();
    if (!runtime || typeof runtime.copyCurrentAsrTextPair !== "function") {
      return Promise.resolve(
        buildActionResult(aiCopyAsrTextPairActionKey, false, {
          reason: "ai-suggestion-module-missing",
          source: source || "unknown",
          message: "AI 建议模块不可用。",
        })
      );
    }
    return Promise.resolve(runtime.copyCurrentAsrTextPair(source || "manual"));
  }

  function getMissingRequiredModules() {
    return [
      { name: "page-detector", value: detector },
      { name: "audio-controller", value: audioController },
      { name: "judgement-page-size", value: pageSizeModule },
      { name: "judgement-duration-summary", value: durationSummaryModule },
      { name: "judgement-virtual-window", value: virtualWindowModule },
      { name: "judgement-asr-diff-view", value: diffViewModule },
      { name: "judgement-thunder-question", value: thunderQuestionModule },
      { name: "judgement-compact-card", value: compactCardModule },
      { name: "judgement-ai-suggestion", value: aiSuggestionModule },
      { name: "asr-judgement-server", value: judgementServerModule },
      { name: "judgement-auto-advance", value: autoAdvanceModule },
      { name: "judgement-actions", value: actionModule },
      { name: "judgement-toast", value: toastModule },
      { name: "judgement-shortcuts", value: shortcutModule },
      { name: "judgement-toolbar", value: toolbarModule },
    ]
      .filter(function (entry) {
        return !entry.value;
      })
      .map(function (entry) {
        return entry.name;
      });
  }

  async function loadSettings() {
    if (storage && typeof storage.getSettings === "function") {
      return storage.getSettings();
    }

    return constants.DEFAULT_SETTINGS || {};
  }

  function buildStatus(reason) {
    const pageInfo = detector && typeof detector.detect === "function"
      ? detector.detect()
      : {
          isTargetSite: location.hostname === constants?.TARGET_PLATFORM?.host,
          pageType: "unknown",
          reason: "page-detector-missing",
          counts: {},
        };
    const platformEnabled = getPlatformSettings(settings).enabled !== false;
    const activeProjectId = getActiveProjectId(settings);
    const active = activeProjectId === judgementProjectId;
    const enabled = Boolean(platformEnabled && active && runtimeEnabled);

    return {
      ok: active,
      scriptId: judgementProjectId,
      pageType: pageInfo.pageType || "unknown",
      enabled: enabled,
      reason:
        reason ||
        (!platformEnabled
          ? "platform-disabled"
          : !active
          ? "active-project-" + activeProjectId
          : enabled
          ? "judgement-runtime-active"
          : "judgement-runtime-not-started"),
      platformEnabled: platformEnabled,
      activeProjectId: activeProjectId,
      page: {
        isTargetSite: pageInfo.isTargetSite === true,
        isJudgementDetail: pageInfo.isJudgementDetail === true,
        reason: pageInfo.reason || "",
        counts: pageInfo.counts || {},
      },
      audio: audioController && typeof audioController.getState === "function"
        ? audioController.getState()
        : null,
      duration: clone(durationSummary),
      pageSize: getConfiguredPageSize(settings),
      virtualWindow:
        virtualWindowRuntime && typeof virtualWindowRuntime.getState === "function"
          ? virtualWindowRuntime.getState()
          : null,
      diffView:
        diffViewRuntime && typeof diffViewRuntime.getState === "function"
          ? diffViewRuntime.getState()
          : null,
      compactCard:
        compactCardRuntime && typeof compactCardRuntime.getState === "function"
          ? compactCardRuntime.getState()
          : null,
      thunderQuestion:
        thunderQuestionRuntime && typeof thunderQuestionRuntime.getState === "function"
          ? thunderQuestionRuntime.getState()
          : null,
      aiSuggestion:
        aiSuggestionRuntime && typeof aiSuggestionRuntime.getState === "function"
          ? aiSuggestionRuntime.getState()
          : null,
      statsUpload:
        judgementServerRuntime && typeof judgementServerRuntime.getState === "function"
          ? judgementServerRuntime.getState()
          : null,
      autoAdvance:
        autoAdvanceRuntime && typeof autoAdvanceRuntime.getState === "function"
          ? autoAdvanceRuntime.getState()
          : null,
    };
  }

  function postNetworkConfig(reason) {
    const pageSize = getConfiguredPageSize(settings);
    const enabled = Boolean(runtimeEnabled && isTopLevelContext());

    window.postMessage(
      {
        source: contentMessageSource,
        type: networkConfigMessageType,
        payload: {
          enabled: enabled,
          pageSizeOverride: enabled && pageSize.mode === "custom" ? pageSize.pageSize : null,
          reason: reason || "",
        },
      },
      "*"
    );
  }

  function normalizeNetworkDurationSummary(summary) {
    if (durationSummaryModule && typeof durationSummaryModule.normalizeNetworkDurationSummary === "function") {
      return durationSummaryModule.normalizeNetworkDurationSummary(summary);
    }

    return null;
  }

  function handleNetworkMessage(event) {
    const message = event && event.data && typeof event.data === "object" ? event.data : null;
    if (!runtimeEnabled) {
      return;
    }

    if (
      !message ||
      message.source !== networkMessageSource ||
      message.type !== networkSummaryMessageType
    ) {
      return;
    }

    const summary = normalizeNetworkDurationSummary(message.payload?.summary);
    setDurationSummary(summary);
  }

  function bindNetworkBridge() {
    if (networkBridgeBound) {
      return;
    }

    window.addEventListener("message", handleNetworkMessage);
    networkBridgeBound = true;
  }

  function stopRuntime(reason) {
    runtimeEnabled = false;
    postNetworkConfig(reason || "runtime-stopped");
    stopToolbar();
    stopConfiguredPageSizeApply();
    stopVirtualWindow();
    stopDiffView();
    stopThunderQuestion();
    stopCompactCard();
    stopAiSuggestion();
    stopJudgementServer();
    if (audioController && typeof audioController.stop === "function") {
      audioController.stop();
    }
    lastStatus = buildStatus(reason || "runtime-stopped");
  }

  async function refreshRuntime(reason) {
    if (refreshPromise) {
      return refreshPromise;
    }

    refreshPromise = loadSettings()
      .then(function (nextSettings) {
        settings = nextSettings;

        if (!isTopLevelContext()) {
          stopRuntime("iframe-context");
          return lastStatus;
        }

        const platformEnabled = getPlatformSettings(settings).enabled !== false;
        const activeProjectId = getActiveProjectId(settings);
        if (!platformEnabled) {
          stopRuntime("platform-disabled");
          return lastStatus;
        }

        if (activeProjectId !== judgementProjectId) {
          stopRuntime("active-project-" + activeProjectId);
          return lastStatus;
        }

        const missingModules = getMissingRequiredModules();
        if (missingModules.length > 0) {
          runtimeEnabled = false;
          lastStatus = Object.assign(buildStatus("required-module-missing"), {
            missingModules: missingModules,
          });
          return lastStatus;
        }

        runtimeEnabled = true;
        audioController.start(getJudgementConfig(settings));
        bindShortcutListeners();
        startToolbar();
        startVirtualWindow();
        startDiffView();
        startThunderQuestion();
        startCompactCard();
        startAiSuggestion();
        startJudgementServer();
        postNetworkConfig(reason || "runtime-started");
        refreshDurationSummary(reason || "runtime-started");
        scheduleConfiguredPageSizeApply(reason || "runtime-started");
        lastStatus = buildStatus(reason || "runtime-started");
        console.info(LOG_PREFIX, "Judgement runtime refreshed.", lastStatus);
        return lastStatus;
      })
      .catch(function (error) {
        runtimeEnabled = false;
        lastStatus = Object.assign({}, lastStatus, {
          ok: false,
          enabled: false,
          reason: "settings-load-failed",
          message: error && error.message ? error.message : String(error),
        });
        console.warn(LOG_PREFIX, "Failed to refresh runtime:", error);
        return lastStatus;
      })
      .finally(function () {
        refreshPromise = null;
      });

    return refreshPromise;
  }

  function bindMessageBridge() {
    if (
      messageBridgeBound ||
      typeof chrome === "undefined" ||
      !chrome.runtime ||
      !chrome.runtime.onMessage
    ) {
      return;
    }

    chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
      if (!message || typeof message !== "object") {
        return undefined;
      }

      if (message.type !== messageTypes.PANEL_PING) {
        if (message.type !== judgementStatsUploadMessageType) {
          return undefined;
        }

        refreshRuntime("stats-upload-message")
          .then(function () {
            return uploadJudgementStats(message.source || "options-panel");
          })
          .then(function (result) {
            sendResponse(result);
          })
          .catch(function (error) {
            sendResponse(
              buildActionResult(statsUploadActionKey, false, {
                reason: "stats-upload-message-failed",
                source: message.source || "options-panel",
                message: error && error.message ? error.message : String(error),
              })
            );
          });
        return true;
      }

      if (lastStatus.activeProjectId !== judgementProjectId && !runtimeEnabled) {
        return undefined;
      }

      sendResponse(buildStatus("panel-ping"));
      return false;
    });

    messageBridgeBound = true;
  }

  function bindStorageRefresh() {
    if (
      typeof chrome === "undefined" ||
      !chrome.storage ||
      !chrome.storage.onChanged
    ) {
      return;
    }

    chrome.storage.onChanged.addListener(function (changes, areaName) {
      if (areaName !== "local" || !changes || !changes[storageKey]) {
        return;
      }

      void refreshRuntime("storage-changed");
    });
  }

  bindMessageBridge();
  bindNetworkBridge();
  bindStorageRefresh();
  void refreshRuntime("script-load");

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      function () {
        void refreshRuntime("dom-content-loaded");
      },
      { once: true }
    );
  } else {
    void refreshRuntime("dom-ready");
  }
})();

(function () {
  const LOG_PREFIX = "[ASR Edge][transcription]";
  const constants = globalThis.ASREdgeConstants || {};
  const configApi = globalThis.__ASREdgeAlibabaLabelxTranscriptionRuntimeConfig || null;
  const activeItemApi = globalThis.__ASREdgeAlibabaLabelxTranscriptionActiveItem || null;
  const itemActions = globalThis.__ASREdgeAlibabaLabelxTranscriptionItemActions || null;
  const audioApi = globalThis.__ASREdgeAlibabaLabelxTranscriptionAudioController || null;
  const toolbarApi = globalThis.__ASREdgeAlibabaLabelxTranscriptionToolbar || null;
  const statsApi = globalThis.__ASREdgeAlibabaLabelxTranscriptionStatsClient || null;
  const shortcutApi = globalThis.__ASREdgeAlibabaLabelxTranscriptionShortcutBus || null;
  const aiSuggestionClientApi =
    globalThis.__ASREdgeAlibabaLabelxTranscriptionAiSuggestionClient || null;
  const aiSuggestionCollectorApi =
    globalThis.__ASREdgeAlibabaLabelxTranscriptionAiSuggestionCollector || null;
  const aiSuggestionPanelApi =
    globalThis.__ASREdgeAlibabaLabelxTranscriptionAiSuggestionPanel || null;
  const submitActionsApi = globalThis.__ASREdgeAlibabaLabelxSubmitActions || null;
  const messageTypes = constants.MESSAGE_TYPES || {};
  const PANEL_PING = messageTypes.PANEL_PING || "ASR_EDGE_SETTINGS_PANEL_PING";
  const PROJECT_ID = configApi?.PROJECT_ID || "transcription";
  const TARGET_HOST = constants?.TARGET_PLATFORM?.host || "labelx.alibaba-inc.com";
  const ACTION_GROUPS = [
    {
      label: "当前题",
      actions: [
        { key: "quickFill", label: "填入当前题源文本", shortLabel: "填入" },
        { key: "markValid", label: "标记当前题为有效", shortLabel: "有效" },
        { key: "markInvalid", label: "标记当前题为无效", shortLabel: "无效" },
      ],
    },
    {
      label: "文本",
      actions: [
        { key: "removeSpaces", label: "当前题去空格", shortLabel: "去空格" },
        { key: "convertNumbers", label: "当前题数字转换", shortLabel: "转数字" },
        { key: "toggleFocus", label: "切换当前题焦点", shortLabel: "焦点" },
      ],
    },
    {
      label: "音频",
      actions: [
        { key: "playPause", label: "播放或暂停当前音频", shortLabel: "播/停" },
        { key: "seekBackward", label: "当前音频后退", shortLabel: "后退" },
        { key: "seekForward", label: "当前音频前进", shortLabel: "前进" },
      ],
    },
    {
      label: "倍速",
      actions: [
        { key: "speedDown", label: "降低倍速", shortLabel: "减速" },
        { key: "speedUp", label: "提高倍速", shortLabel: "加速" },
        { key: "speedReset", label: "重置倍速", shortLabel: "重置" },
      ],
    },
    {
      label: "音量",
      actions: [
        { key: "volumeDown", label: "降低音量", shortLabel: "减音" },
        { key: "volumeUp", label: "提高音量", shortLabel: "加音" },
        { key: "volumeReset", label: "重置音量", shortLabel: "重置" },
      ],
    },
    {
      label: "辅助",
      actions: [
        { key: "copyDuration", label: "复制当前音频时长", shortLabel: "复制时长" },
        { key: "uploadStats", label: "上传转写统计", shortLabel: "上传统计" },
        { key: "aiSuggestCurrent", label: "AI 推荐当前题", shortLabel: "AI推荐" },
        { key: "applyAiSuggestion", label: "填入AI推荐", shortLabel: "填入AI" },
      ],
    },
  ];

  const runtime = {
    injected: true,
    enabled: false,
    matched: false,
    reason: "waiting-for-transcription-detail",
    config: null,
    toolbarRuntime: null,
    refreshTimer: null,
    refreshInFlight: false,
    refreshQueued: false,
    mutationObserver: null,
    pollTimer: null,
    lastHref: String(location.href || ""),
    lastActionText: "最近操作：--",
    scriptActive: false,
    statsConfig: null,
    statsRuntime: null,
    statsState: null,
    aiSuggestionRuntime: null,
    shortcutRuntime: null,
    contextInvalidated: false,
    contextInvalidatedNotified: false,
  };

  function warn(message, extra) {
    if (extra) {
      console.warn(LOG_PREFIX, message, extra);
      return;
    }
    console.warn(LOG_PREFIX, message);
  }

  function createToast() {
    let node = document.getElementById("asr-edge-transcription-toast");
    if (!node) {
      node = document.createElement("div");
      node.id = "asr-edge-transcription-toast";
      node.style.position = "fixed";
      node.style.top = "16px";
      node.style.right = "16px";
      node.style.zIndex = "2147483647";
      node.style.background = "rgba(17,24,39,.9)";
      node.style.color = "#fff";
      node.style.fontSize = "12px";
      node.style.padding = "8px 10px";
      node.style.borderRadius = "6px";
      node.style.display = "none";
      document.documentElement.appendChild(node);
    }
    return node;
  }

  function showToast(message) {
    const node = createToast();
    node.textContent = String(message || "");
    node.style.display = "block";
    clearTimeout(node.__hideTimer);
    node.__hideTimer = setTimeout(function () {
      node.style.display = "none";
    }, 1600);
  }

  function isVisibleEditableTextarea(node) {
    if (!(node instanceof HTMLTextAreaElement) || node.disabled || node.readOnly) {
      return false;
    }
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function hasJudgementHint() {
    if (document.querySelector("#asr-edge-judgement-toolbar")) {
      return true;
    }
    const nodes = Array.from(document.querySelectorAll(".mark-toolbox, .labelRender-item, body")).slice(0, 8);
    return nodes.some(function (node) {
      const text = String(node.textContent || "").replace(/\s+/g, "");
      return text.includes("哪个ASR更优");
    });
  }

  function evaluatePageMatch() {
    if (location.hostname !== TARGET_HOST) {
      return { matched: false, reason: "host-not-matched" };
    }

    const path = String(location.pathname || "").toLowerCase();
    if (!path.includes("/corpora/labeling/")) {
      return { matched: false, reason: "waiting-for-transcription-detail" };
    }

    if (hasJudgementHint()) {
      return { matched: false, reason: "judgement-page" };
    }

    const hasItemTextarea = Boolean(document.querySelector(".labelRender-item textarea"));
    const hasEditableTextarea = Array.from(document.querySelectorAll("textarea")).some(
      isVisibleEditableTextarea
    );

    if (!hasItemTextarea && !hasEditableTextarea) {
      return { matched: false, reason: "waiting-for-transcription-detail" };
    }

    return { matched: true, reason: "matched" };
  }

  function ensureToolbarRuntime() {
    if (runtime.toolbarRuntime || !toolbarApi || typeof toolbarApi.createRuntime !== "function") {
      return runtime.toolbarRuntime;
    }
    runtime.toolbarRuntime = toolbarApi.createRuntime({
      shouldShowToolbar: function () {
        return runtime.enabled === true && runtime.matched === true;
      },
      getActionGroups: function () {
        return ACTION_GROUPS;
      },
      getStatus: getToolbarStatus,
      onAction: function (actionKey) {
        return runAction(actionKey);
      },
    });
    return runtime.toolbarRuntime;
  }

  function isStatsCandidatePage() {
    if (location.hostname !== TARGET_HOST) {
      return false;
    }
    const path = String(location.pathname || "").toLowerCase();
    if (path.indexOf("/corpora/labeling/") < 0) {
      return false;
    }
    if (hasJudgementHint()) {
      return false;
    }
    return true;
  }

  function shouldRunStatsRuntime() {
    return runtime.scriptActive === true && isStatsCandidatePage();
  }

  function syncStatsState(nextState) {
    runtime.statsState = nextState && typeof nextState === "object" ? nextState : null;
    updateToolbarStatus();
  }

  function ensureStatsRuntime() {
    if (runtime.statsRuntime || !statsApi || typeof statsApi.createRuntime !== "function") {
      return runtime.statsRuntime;
    }

    runtime.statsRuntime = statsApi.createRuntime({
      shouldApply: shouldRunStatsRuntime,
      getConfig: function () {
        return runtime.statsConfig || {};
      },
      showToast: function (message) {
        showToast(message);
      },
      onStateChange: syncStatsState,
    });
    return runtime.statsRuntime;
  }

  function ensureShortcutRuntime() {
    if (runtime.shortcutRuntime || !shortcutApi || typeof shortcutApi.createRuntime !== "function") {
      return runtime.shortcutRuntime;
    }

    runtime.shortcutRuntime = shortcutApi.createRuntime({
      isEnabled: function () {
        return runtime.enabled === true && runtime.matched === true;
      },
      getConfig: function () {
        return runtime.config || {};
      },
      runAction: function (actionName) {
        return runAction(actionName, "shortcut");
      },
    });
    return runtime.shortcutRuntime;
  }

  function ensureAiSuggestionRuntime() {
    if (
      runtime.aiSuggestionRuntime ||
      !aiSuggestionPanelApi ||
      typeof aiSuggestionPanelApi.createRuntime !== "function"
    ) {
      return runtime.aiSuggestionRuntime;
    }
    if (
      !aiSuggestionCollectorApi ||
      typeof aiSuggestionCollectorApi.collectCurrentPayload !== "function"
    ) {
      return null;
    }
    if (
      !aiSuggestionClientApi ||
      typeof aiSuggestionClientApi.suggestCurrent !== "function"
    ) {
      return null;
    }

    runtime.aiSuggestionRuntime = aiSuggestionPanelApi.createRuntime({
      shouldShow: function () {
        return runtime.enabled === true && runtime.matched === true;
      },
      collectCurrentPayload: function () {
        return aiSuggestionCollectorApi.collectCurrentPayload();
      },
      requestCurrentSuggestion: function (payload) {
        const config = runtime.config || {};
        const aiOptions = {};
        const listenPrompt = String(config.aiSuggestionListenPrompt || "").trim();
        const comparePrompt = String(config.aiSuggestionComparePrompt || "").trim();
        if (listenPrompt) {
          aiOptions.listenPrompt = listenPrompt.slice(0, 8000);
        }
        if (comparePrompt) {
          aiOptions.comparePrompt = comparePrompt.slice(0, 8000);
        }
        const temperature = Number(config.aiSuggestionTemperature);
        if (Number.isFinite(temperature) && temperature >= 0 && temperature <= 2) {
          aiOptions.temperature = temperature;
        }
        const topP = Number(config.aiSuggestionTopP);
        if (Number.isFinite(topP) && topP >= 0 && topP <= 1) {
          aiOptions.top_p = topP;
        }
        const maxTokens = Math.floor(Number(config.aiSuggestionMaxTokens));
        if (Number.isFinite(maxTokens) && maxTokens >= 1 && maxTokens <= 8192) {
          aiOptions.max_tokens = maxTokens;
        }
        const maxCompletionTokens = Math.floor(Number(config.aiSuggestionMaxCompletionTokens));
        if (
          Number.isFinite(maxCompletionTokens) &&
          maxCompletionTokens >= 1 &&
          maxCompletionTokens <= 8192
        ) {
          aiOptions.max_completion_tokens = maxCompletionTokens;
        }
        const presencePenalty = Number(config.aiSuggestionPresencePenalty);
        if (
          Number.isFinite(presencePenalty) &&
          presencePenalty >= -2 &&
          presencePenalty <= 2
        ) {
          aiOptions.presence_penalty = presencePenalty;
        }
        const frequencyPenalty = Number(config.aiSuggestionFrequencyPenalty);
        if (
          Number.isFinite(frequencyPenalty) &&
          frequencyPenalty >= -2 &&
          frequencyPenalty <= 2
        ) {
          aiOptions.frequency_penalty = frequencyPenalty;
        }
        const seed = Math.floor(Number(config.aiSuggestionSeed));
        if (Number.isFinite(seed) && seed >= 0 && seed <= 2147483647) {
          aiOptions.seed = seed;
        }
        const stop = String(config.aiSuggestionStopSequences || "")
          .split(/\r?\n/)
          .map(function (item) {
            return String(item || "").trim().slice(0, 80);
          })
          .filter(Boolean)
          .slice(0, 8);
        if (stop.length > 0) {
          aiOptions.stop = stop;
        }
        aiOptions.listenModel = String(config.aiSuggestionListenModel || "").trim();
        aiOptions.compareModel = String(config.aiSuggestionCompareModel || "").trim();
        aiOptions.enable_thinking = config.aiSuggestionEnableThinking === true;
        const requestPayload = Object.assign({}, payload || {}, {
          listenModel: String(config.aiSuggestionListenModel || "").trim(),
          compareModel: String(config.aiSuggestionCompareModel || "").trim(),
          enableThinking: config.aiSuggestionEnableThinking === true,
          aiOptions: aiOptions,
        });
        return aiSuggestionClientApi.suggestCurrent(requestPayload, {
          timeoutMs: Number(runtime.config?.aiSuggestionRequestTimeoutMs || 60000) || 60000,
        });
      },
      applySuggestionText: function (text) {
        return itemActions.applyTextToCurrentItem(text);
      },
    });
    return runtime.aiSuggestionRuntime;
  }

  function startStatsRuntime() {
    const runtimeInstance = ensureStatsRuntime();
    if (runtimeInstance && typeof runtimeInstance.start === "function") {
      runtimeInstance.start();
    }
  }

  function stopStatsRuntime() {
    if (runtime.statsRuntime && typeof runtime.statsRuntime.stop === "function") {
      runtime.statsRuntime.stop();
    }
    syncStatsState(null);
  }

  function syncAiSuggestionRuntime() {
    const aiRuntime = ensureAiSuggestionRuntime();
    if (aiRuntime && typeof aiRuntime.syncCurrentItem === "function") {
      aiRuntime.syncCurrentItem();
    }
  }

  function clearAiSuggestionRuntime() {
    if (runtime.aiSuggestionRuntime && typeof runtime.aiSuggestionRuntime.clearAll === "function") {
      runtime.aiSuggestionRuntime.clearAll();
    }
  }

  function getCurrentItemText() {
    if (!activeItemApi || typeof activeItemApi.getCurrentContext !== "function") {
      return "当前题：未定位";
    }
    const context = activeItemApi.getCurrentContext();
    if (!context || !context.item) {
      return "当前题：未定位";
    }
    const index = Number(context.item.getAttribute("data-index"));
    if (Number.isFinite(index) && index >= 0) {
      return "当前题：第 " + String(index + 1) + " 条";
    }
    if (context.source === "fallback-first-visible") {
      return "当前题：兜底首条可见题";
    }
    return "当前题：已定位";
  }

  function formatRate(rate) {
    const number = Number(rate);
    if (!Number.isFinite(number)) {
      return "1x";
    }
    return Number.isInteger(number)
      ? String(number) + "x"
      : Number(number.toFixed(2)).toString() + "x";
  }

  function getAudioText() {
    if (!audioApi || typeof audioApi.getCurrentAudioSnapshot !== "function") {
      return "音频：--";
    }
    const snapshot = audioApi.getCurrentAudioSnapshot();
    if (!snapshot || snapshot.found !== true) {
      return "音频：未定位";
    }
    const playText = snapshot.paused === true ? "暂停" : "播放";
    const rateText = formatRate(snapshot.playbackRate);
    const volumeValue = Number(snapshot.volumePercent);
    const volumeText = Number.isFinite(volumeValue) ? String(Math.round(volumeValue)) + "%" : "--";
    return "音频：" + playText + " " + rateText + " / " + volumeText;
  }

  function getToolbarStatus() {
    const statsState = runtime.statsState || {};
    const statsSummary =
      statsState.uploading === true
        ? "（统计上传中）"
        : statsState.lastUploadOk === true
          ? "（统计上传成功）"
          : statsState.lastUploadOk === false
            ? "（统计上传失败）"
            : "";
    const aiSummary =
      runtime.aiSuggestionRuntime &&
      typeof runtime.aiSuggestionRuntime.getStateSummary === "function"
        ? runtime.aiSuggestionRuntime.getStateSummary()
        : "AI 推荐：未加载";
    return {
      enabledText: runtime.enabled
        ? "转写工具栏已启用" + statsSummary
        : "转写工具栏待命中" + statsSummary,
      itemText: getCurrentItemText(),
      audioText: getAudioText() + " | " + aiSummary,
      lastActionText: runtime.lastActionText || "最近操作：--",
    };
  }

  function updateToolbarStatus() {
    const runtimeInstance = ensureToolbarRuntime();
    if (runtimeInstance && typeof runtimeInstance.update === "function") {
      runtimeInstance.update();
    }
  }

  function setLastActionText(message) {
    runtime.lastActionText = "最近操作：" + String(message || "--");
    updateToolbarStatus();
  }

  async function runAction(action) {
    if (!runtime.config) {
      setLastActionText("当前配置未初始化。");
      return;
    }

    let result = null;
    switch (action) {
      case "quickFill":
        result = itemActions.quickFillCurrentItem();
        break;
      case "markValid":
        result = itemActions.markCurrentItemValid();
        break;
      case "markInvalid":
        result = itemActions.markCurrentItemInvalid();
        break;
      case "removeSpaces":
        result = itemActions.removeSpacesCurrentItem();
        break;
      case "convertNumbers":
        result = itemActions.convertNumberCurrentItem(runtime.config);
        break;
      case "toggleFocus":
        result = itemActions.toggleFocusCurrentItem();
        break;
      case "playPause":
        result = await audioApi.playPauseCurrentAudio();
        break;
      case "seekForward":
        result = audioApi.seekCurrentAudio(runtime.config.seekStepSeconds);
        break;
      case "seekBackward":
        result = audioApi.seekCurrentAudio(-runtime.config.seekStepSeconds);
        break;
      case "speedUp":
        result = audioApi.adjustPlaybackRate(runtime.config.rateStepValue);
        break;
      case "speedDown":
        result = audioApi.adjustPlaybackRate(-runtime.config.rateStepValue);
        break;
      case "speedReset":
        result = audioApi.setPlaybackRate(
          Number(runtime.config.playbackRateValue || runtime.config.resetRateValue || 1)
        );
        break;
      case "volumeUp":
        result = audioApi.adjustVolumePercent(10);
        break;
      case "volumeDown":
        result = audioApi.adjustVolumePercent(-10);
        break;
      case "volumeReset":
        result = audioApi.setVolumePercent(runtime.config.volumeValue);
        break;
      case "copyDuration":
        result = await audioApi.copyCurrentAudioDuration();
        break;
      case "uploadStats":
        if (runtime.statsRuntime && typeof runtime.statsRuntime.uploadNow === "function") {
          result = await runtime.statsRuntime.uploadNow("toolbar-manual");
          if (result && result.ok === true) {
            result.message = "转写统计已上传。";
          } else if (result && result.message) {
            result.message = "转写统计上传失败：" + result.message;
          } else {
            result = { ok: false, message: "转写统计上传失败。" };
          }
        } else {
          result = { ok: false, message: "统计上传模块未加载。" };
        }
        break;
      case "aiSuggestCurrent":
        if (
          runtime.aiSuggestionRuntime &&
          typeof runtime.aiSuggestionRuntime.requestCurrentSuggestion === "function"
        ) {
          result = await runtime.aiSuggestionRuntime.requestCurrentSuggestion("toolbar");
        } else {
          result = { ok: false, message: "AI 推荐模块未加载。" };
        }
        break;
      case "applyAiSuggestion":
        if (
          runtime.aiSuggestionRuntime &&
          typeof runtime.aiSuggestionRuntime.applyCurrentSuggestion === "function"
        ) {
          result = await runtime.aiSuggestionRuntime.applyCurrentSuggestion();
        } else {
          result = { ok: false, message: "AI 推荐模块未加载。" };
        }
        break;
      case "submitTask":
        if (submitActionsApi && typeof submitActionsApi.runAction === "function") {
          result = submitActionsApi.runAction("submitTask");
        } else {
          result = { ok: false, message: "提交模块未加载。" };
        }
        break;
      case "submitTaskAndFinish":
        if (submitActionsApi && typeof submitActionsApi.runAction === "function") {
          result = submitActionsApi.runAction("submitTaskAndFinish");
        } else {
          result = { ok: false, message: "提交模块未加载。" };
        }
        break;
      default:
        result = { ok: false, message: "未知动作。" };
        break;
    }

    if (result && result.message) {
      showToast(result.message);
      setLastActionText(result.message);
    } else {
      setLastActionText("操作已执行。");
    }
  }

  function disableRuntime(reason) {
    runtime.enabled = false;
    if (runtime.shortcutRuntime && typeof runtime.shortcutRuntime.unbind === "function") {
      runtime.shortcutRuntime.unbind();
    }
    if (audioApi && typeof audioApi.stop === "function") {
      audioApi.stop();
    }
    if (runtime.toolbarRuntime && typeof runtime.toolbarRuntime.stop === "function") {
      runtime.toolbarRuntime.stop();
    }
    clearAiSuggestionRuntime();
    runtime.reason = reason || runtime.reason || "waiting-for-transcription-detail";
  }

  function stopRetryWatchers() {
    clearTimeout(runtime.refreshTimer);
    runtime.refreshTimer = null;
    if (runtime.mutationObserver) {
      runtime.mutationObserver.disconnect();
      runtime.mutationObserver = null;
    }
    if (runtime.pollTimer) {
      clearInterval(runtime.pollTimer);
      runtime.pollTimer = null;
    }
  }

  function stopRuntime(reason, options) {
    stopStatsRuntime();
    disableRuntime(reason);
    if (options && options.stopWatchers === true) {
      stopRetryWatchers();
    }
  }

  function enableRuntime() {
    runtime.enabled = true;
    runtime.reason = "matched";
    const toolbarRuntime = ensureToolbarRuntime();
    if (toolbarRuntime && typeof toolbarRuntime.start === "function") {
      toolbarRuntime.start();
    }
    updateToolbarStatus();
    if (audioApi && typeof audioApi.start === "function") {
      audioApi.start(runtime.config || {});
    }
    const shortcutRuntime = ensureShortcutRuntime();
    if (shortcutRuntime && typeof shortcutRuntime.bind === "function") {
      shortcutRuntime.bind();
    }
    syncAiSuggestionRuntime();
    if (audioApi && typeof audioApi.scan === "function") {
      audioApi.scan("transcription-enable-runtime");
    } else {
      void audioApi.autoPlayCurrentAudioIfNeeded(runtime.config?.autoPlay === true);
    }
  }

  function scheduleRefresh(trigger, delay) {
    if (runtime.contextInvalidated === true) {
      return;
    }
    clearTimeout(runtime.refreshTimer);
    runtime.refreshTimer = setTimeout(function () {
      void refreshRuntime(trigger || "retry");
    }, typeof delay === "number" ? delay : 120);
  }

  async function refreshRuntime(trigger) {
    if (runtime.refreshInFlight) {
      runtime.refreshQueued = true;
      return;
    }
    runtime.refreshInFlight = true;

    try {
      if (!configApi || !activeItemApi || !itemActions || !audioApi) {
        stopRuntime("module-missing");
        warn("required module missing");
        return;
      }
      if (!toolbarApi || typeof toolbarApi.createRuntime !== "function") {
        stopRuntime("module-missing-toolbar");
        warn("toolbar module missing");
        return;
      }

      const loaded = await configApi.loadConfig();
      runtime.contextInvalidated = loaded.contextInvalidated === true;
      runtime.config = loaded.config;
      runtime.statsConfig = loaded.statsConfig || null;
      runtime.scriptActive = loaded.enabledBySettings === true && loaded.activeProjectId === PROJECT_ID;

      if (runtime.contextInvalidated) {
        stopRuntime("extension-context-invalidated", { stopWatchers: true });
        if (!runtime.contextInvalidatedNotified) {
          runtime.contextInvalidatedNotified = true;
          showToast("扩展上下文已失效，请刷新页面。");
        }
        return;
      }
      runtime.contextInvalidatedNotified = false;

      if (runtime.scriptActive) {
        startStatsRuntime();
      } else {
        stopStatsRuntime();
      }

      if (loaded.enabledBySettings !== true) {
        runtime.matched = false;
        disableRuntime("script-disabled");
        return;
      }

      if (loaded.activeProjectId !== PROJECT_ID) {
        runtime.matched = false;
        disableRuntime("inactive-project");
        return;
      }

      const page = evaluatePageMatch();
      runtime.matched = page.matched;
      runtime.reason = page.reason;

      if (!page.matched) {
        disableRuntime(page.reason);
        updateToolbarStatus();
        return;
      }

      enableRuntime();
    } catch (error) {
      stopRuntime("runtime-error");
      warn("runtime refresh failed", {
        trigger: trigger,
        message: error && error.message ? error.message : String(error),
      });
    } finally {
      runtime.refreshInFlight = false;
      if (runtime.refreshQueued) {
        runtime.refreshQueued = false;
        scheduleRefresh("queued-refresh", 0);
      }
    }
  }

  function patchHistoryForSpa() {
    if (window.__asrEdgeTranscriptionHistoryPatched) {
      return;
    }
    window.__asrEdgeTranscriptionHistoryPatched = true;

    ["pushState", "replaceState"].forEach(function (methodName) {
      const original = history[methodName];
      if (typeof original !== "function") {
        return;
      }

      history[methodName] = function () {
        const result = original.apply(this, arguments);
        scheduleRefresh("history-" + methodName, 30);
        return result;
      };
    });

    window.addEventListener("popstate", function () {
      scheduleRefresh("history-popstate", 30);
    });
  }

  function startRetryWatchers() {
    document.addEventListener("DOMContentLoaded", function () {
      scheduleRefresh("dom-content-loaded", 0);
    });

    window.addEventListener("load", function () {
      scheduleRefresh("window-load", 0);
    });

    if (runtime.mutationObserver) {
      runtime.mutationObserver.disconnect();
    }

    runtime.mutationObserver = new MutationObserver(function () {
      scheduleRefresh("dom-mutated", 80);
    });

    runtime.mutationObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    patchHistoryForSpa();

    runtime.pollTimer = setInterval(function () {
      const href = String(location.href || "");
      if (href !== runtime.lastHref) {
        runtime.lastHref = href;
        scheduleRefresh("href-changed", 30);
      }
    }, 1200);
  }

  function bindMessageBridge() {
    if (!chrome?.runtime?.onMessage) {
      return;
    }

    chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
      if (!message || typeof message !== "object") {
        return undefined;
      }

      if (message.type === PANEL_PING) {
        if (runtime.contextInvalidated === true) {
          sendResponse({
            ok: false,
            scriptId: PROJECT_ID,
            injected: false,
            enabled: false,
            matched: false,
            reason: "extension-context-invalidated",
            message: "扩展上下文已失效，请刷新页面。",
          });
          return false;
        }
        sendResponse({
          ok: true,
          scriptId: PROJECT_ID,
          injected: true,
          enabled: runtime.enabled === true,
          matched: runtime.matched === true,
          reason:
            runtime.matched === true
              ? "matched"
              : runtime.reason || "waiting-for-transcription-detail",
        });
        return false;
      }

      return undefined;
    });
  }

  bindMessageBridge();
  startRetryWatchers();
  scheduleRefresh("script-load", 0);
})();

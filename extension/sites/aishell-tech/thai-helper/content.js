(function () {
  if (globalThis.__ASREdgeAishellTechThaiContentInstalled === true) {
    return;
  }
  globalThis.__ASREdgeAishellTechThaiContentInstalled = true;

  const CONSTANTS = globalThis.ASREdgeConstants || {};
  const STORAGE = globalThis.ASREdgeStorage || null;
  const DEFAULT_TIMEOUT_MS = Number(CONSTANTS.DEFAULT_AI_REQUEST_TIMEOUT_MS || 60000) || 60000;
  const SCRIPT_ID =
    CONSTANTS.AISHELL_TECH_THAI_SCRIPT_ID || "aishellTechThaiAssistant";
  const RECOMMEND_PATH =
    CONSTANTS.AISHELL_TECH_THAI_AI_RECOMMEND_PATH ||
    "/api/aishell-tech/thai-helper/ai/recommend";
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

  let activeRuntime = null;
  let currentUrl = location.href;
  let routeTimer = null;

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function createBatchRunId() {
    return [
      "aishell",
      Date.now().toString(36),
      Math.random().toString(36).slice(2, 8),
    ].join("-");
  }

  function normalizeBatchMode(value) {
    return String(value || "").trim().toLowerCase() === "all" ? "all" : "pending";
  }

  function normalizePromptText(value) {
    return String(value || "").replace(/\r\n/g, "\n").trim();
  }

  function getBatchModeMeta(value) {
    const mode = normalizeBatchMode(value);
    if (mode === "all") {
      return {
        mode: "all",
        label: "全部AI批量识别",
        emptyMessage: "当前分包没有可识别条目。",
      };
    }
    return {
      mode: "pending",
      label: "未完成的AI批量识别",
      emptyMessage: "当前分包没有可识别的未完成条目。",
    };
  }

  function normalizeOptionalNumber(value, min, max) {
    if (value === undefined || value === null || value === "") {
      return "";
    }
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < min || numeric > max) {
      return "";
    }
    return numeric;
  }

  function normalizeOptionalInteger(value, min, max) {
    if (value === undefined || value === null || value === "") {
      return "";
    }
    const numeric = Math.floor(Number(value));
    if (!Number.isFinite(numeric) || numeric < min || numeric > max) {
      return "";
    }
    return numeric;
  }

  function normalizeStopSequences(value) {
    const source = Array.isArray(value)
      ? value
      : typeof value === "string"
        ? value.split(/\r?\n/)
        : [];
    const result = [];
    source.forEach(function (item) {
      const text = String(item || "").trim().slice(0, 80);
      if (!text || result.indexOf(text) >= 0 || result.length >= 8) {
        return;
      }
      result.push(text);
    });
    return result;
  }

  function buildStageParams(config, prefix) {
    const params = {};
    const temperature = normalizeOptionalNumber(config[prefix + "Temperature"], 0, 2);
    if (temperature !== "") {
      params.temperature = temperature;
    }
    const topP = normalizeOptionalNumber(config[prefix + "TopP"], 0, 1);
    if (topP !== "") {
      params.top_p = topP;
    }
    const maxTokens = normalizeOptionalInteger(config[prefix + "MaxTokens"], 1, 8192);
    if (maxTokens !== "") {
      params.max_tokens = maxTokens;
    }
    const maxCompletionTokens = normalizeOptionalInteger(
      config[prefix + "MaxCompletionTokens"],
      1,
      8192
    );
    if (maxCompletionTokens !== "") {
      params.max_completion_tokens = maxCompletionTokens;
    }
    const presencePenalty = normalizeOptionalNumber(
      config[prefix + "PresencePenalty"],
      -2,
      2
    );
    if (presencePenalty !== "") {
      params.presence_penalty = presencePenalty;
    }
    const frequencyPenalty = normalizeOptionalNumber(
      config[prefix + "FrequencyPenalty"],
      -2,
      2
    );
    if (frequencyPenalty !== "") {
      params.frequency_penalty = frequencyPenalty;
    }
    const seed = normalizeOptionalInteger(config[prefix + "Seed"], 0, 2147483647);
    if (seed !== "") {
      params.seed = seed;
    }
    const stop = normalizeStopSequences(config[prefix + "StopSequences"]);
    if (stop.length > 0) {
      params.stop = stop;
    }
    return params;
  }

  function buildAiStages(config) {
    return {
      recognize: {
        model: normalizeText(config.aiRecommendSingleModel),
        prompt: normalizePromptText(config.aiRecommendSinglePrompt),
        params: buildStageParams(config, "aiRecommend"),
      },
    };
  }

  function isMarkPage() {
    return (
      location.hostname === "mark.aishelltech.com" &&
      String(location.pathname || "").toLowerCase() === "/mytask/mark"
    );
  }

  function getDefaultConfig() {
    const defaults =
      CONSTANTS.DEFAULT_SETTINGS?.platforms?.aishellTech?.scripts?.thaiHelper || {};
    return Object.assign(
      {
        id: SCRIPT_ID,
        enabled: false,
        aiRecommendEnabled: false,
        aiRecommendRequestTimeoutMs: DEFAULT_TIMEOUT_MS,
        aiQualifiedAutofillConcurrency: 5,
        aiRecommendSingleModel: "qwen3.5-omni-flash",
        aiRecommendSinglePrompt: "",
        aiRecommendEnableThinking: false,
        aiRecommendTemperature: "",
        aiRecommendTopP: "",
        aiRecommendMaxTokens: "",
        aiRecommendMaxCompletionTokens: "",
        aiRecommendPresencePenalty: "",
        aiRecommendFrequencyPenalty: "",
        aiRecommendSeed: "",
        aiRecommendStopSequences: "",
        shortcuts: {},
      },
      defaults || {}
    );
  }

  async function loadRuntimeConfig() {
    const defaults = getDefaultConfig();
    const settings = STORAGE && typeof STORAGE.getSettings === "function"
      ? await STORAGE.getSettings()
      : { platforms: {}, meta: {} };
    const scriptConfig = settings?.platforms?.aishellTech?.scripts?.thaiHelper || {};
    const endpoint =
      typeof CONSTANTS.buildBackendUrl === "function"
        ? CONSTANTS.buildBackendUrl(RECOMMEND_PATH, settings)
        : String(CONSTANTS.DEFAULT_BACKEND_BASE_URLS?.server || "").replace(/\/+$/, "") +
          RECOMMEND_PATH;
    const merged = Object.assign({}, defaults, scriptConfig, {
      id: SCRIPT_ID,
      aiRecommendEndpoint: endpoint,
    });
    merged.aiQualifiedAutofillConcurrency = Math.max(
      1,
      Math.floor(Number(merged.aiQualifiedAutofillConcurrency || 5) || 5)
    );
    merged.aiRecommendRequestTimeoutMs = Math.max(
      1000,
      Number(merged.aiRecommendRequestTimeoutMs || DEFAULT_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS
    );
    return {
      config: merged,
      settings: settings || {},
      enabled:
        settings?.platforms?.aishellTech?.enabled !== false &&
        merged.enabled !== false &&
        merged.aiRecommendEnabled !== false,
    };
  }

  function createRuntime(config) {
    const dataApiFactory = globalThis.__ASREdgeAishellTechThaiDataApi;
    const aiFactory = globalThis.__ASREdgeAishellTechThaiAiRecommendation;
    const diagnosticsFactory = globalThis.__ASREdgeAishellTechThaiDiagnostics || {};
    const uiFactory = globalThis.__ASREdgeAishellTechThaiUiPanel;
    const shortcutsFactory = globalThis.__ASREdgeAishellTechThaiShortcuts;
    const buildBatchFailureEntry =
      typeof diagnosticsFactory.buildBatchFailureEntry === "function"
        ? diagnosticsFactory.buildBatchFailureEntry
        : function (input) {
            const source = input && typeof input === "object" ? input : {};
            return {
              displayName: source.task?.displayName || "未知条目",
              message: source.message || "失败",
              stage: source.stage || "unknown",
              stageLabel: source.stage || "unknown",
              detailRows: [],
              rawJson:
                source.error?.rawResponse && typeof source.error.rawResponse === "object"
                  ? source.error.rawResponse
                  : {},
            };
          };

    if (
      !dataApiFactory?.createRuntime ||
      !aiFactory?.createRuntime ||
      !concurrentRequestStreamFactory?.createConcurrentAiRequestStream ||
      !uiFactory?.createRuntime
    ) {
      return null;
    }

    const dataApi = dataApiFactory.createRuntime();
    const aiClient = aiFactory.createRuntime({
      endpoint: config.aiRecommendEndpoint,
      timeoutMs: config.aiRecommendRequestTimeoutMs,
      settings: config.settings || {},
      aiStages: buildAiStages(config),
    });

    const panel = uiFactory.createRuntime({
      onRecommend: handleRecommend,
      onBatchRecommendAll: handleBatchRecommendAll,
      onBatchRecommendPending: handleBatchRecommendPending,
      onBatchStop: handleBatchStop,
      canFillPageText: dataApi.canFillPageText,
      fillPageText: dataApi.fillPageText,
      fillAndSaveCurrent: dataApi.fillAndSaveCurrent,
    });
    const shortcuts = shortcutsFactory?.createRuntime
      ? shortcutsFactory.createRuntime({
          shortcuts: config.shortcuts || {},
          actions: {
            requestAiRecommend: handleRecommend,
            autoFillQualifiedItem: handleBatchRecommendPending,
            copyRecommendedText: panel.copyRecommendedText,
            fillRecommendedText: panel.fillRecommendedText,
            ignoreAiResult: panel.ignoreAiResult,
            showStatus: panel.setStatus,
          },
        })
      : null;

    let mountTimer = null;
    let currentBusyState = {
      single: false,
      batch: false,
    };
    let batchStopRequested = false;
    let activeBatchContext = null;

    function syncBusyState(nextState) {
      currentBusyState = Object.assign({}, currentBusyState, nextState || {});
      panel.setBusy(currentBusyState);
    }

    async function handleRecommend() {
      syncBusyState({ single: true });
      panel.setStatus("正在识别当前条...", "info");
      try {
        const item = await dataApi.getCurrentItem();
        if (!item) {
          throw new Error("当前页面还没有定位到选中条目。");
        }
        panel.updateCurrentItemKey(item.key);
        const result = await aiClient.recommend(item);
        const renderMeta = panel.renderResult(
          Object.assign({}, result, {
            currentText: item.existingDisplayText || item.existingMarkText,
            currentSpeed: item.existingDisplaySpeed || item.existingMarkSpeed,
          })
        ) || {};
        panel.setStatus("当前条识别完成。", "success");
      } catch (error) {
        panel.setStatus(error?.message || String(error), "error", error?.rawResponse || null);
      } finally {
        syncBusyState({ single: false });
      }
    }

    async function handleBatchStop() {
      if (currentBusyState.batch !== true) {
        panel.setStatus("当前没有正在运行的批量识别。", "warning");
        return;
      }
      batchStopRequested = true;
      if (activeBatchContext?.requestStream?.cancelPending) {
        activeBatchContext.requestStream.cancelPending("批量识别已手动停止。");
      }
      if (typeof activeBatchContext?.notifyStopSignal === "function") {
        activeBatchContext.notifyStopSignal();
      }
      const batchMeta = getBatchModeMeta(activeBatchContext?.mode);
      panel.setStatus(
        "已请求停止，将在当前条完成后结束本轮" + batchMeta.label + "。",
        "warning"
      );
      panel.updateBatch({
        phaseText: batchMeta.label + "停止中",
        running: true,
      });
    }

    async function runBatchRecommend(mode) {
      const batchMeta = getBatchModeMeta(mode);
      let batchClosed = false;
      syncBusyState({ batch: true });
      batchStopRequested = false;
      panel.setStatus("正在准备" + batchMeta.label + "...", "info");
      try {
        const tasks = await dataApi.getBatchTasksForPackage({
          mode: batchMeta.mode,
        });
        if (!tasks.length) {
          throw new Error(batchMeta.emptyMessage);
        }
        const batchRunId = createBatchRunId();
        const batchConcurrency = Math.max(
          1,
          Number(config.aiQualifiedAutofillConcurrency || 5) || 5
        );
        const failures = [];
        const batchSummaryAccumulator = createBatchSummaryAccumulator();
        let consumedCount = 0;
        let currentPhaseText = batchMeta.label + "开始";
        let currentDisplayText = tasks[0].displayName || "";
        let requestStream = null;
        let resolveStopSignal = null;
        const stopSignalPromise = new Promise(function (resolve) {
          resolveStopSignal = resolve;
        });

        function notifyStopSignal() {
          if (typeof resolveStopSignal === "function") {
            resolveStopSignal({ type: "stop" });
            resolveStopSignal = null;
          }
        }

        function updateBatchSnapshot(phaseText, currentText, running) {
          if (!requestStream) {
            return;
          }
          if (typeof phaseText === "string" && phaseText) {
            currentPhaseText = phaseText;
          }
          if (currentText !== undefined) {
            currentDisplayText = String(currentText || "");
          }
          const snapshot = requestStream.getSnapshot();
          panel.updateBatch({
            phaseText: currentPhaseText,
            total: tasks.length,
            completed: consumedCount,
            failed: failures.length,
            currentText: currentDisplayText,
            failures: failures,
            running: running !== false,
            frontConcurrency: snapshot.frontConcurrency,
            requestStaggerMs: snapshot.requestStaggerMs,
            launchedCount: snapshot.launchedCount,
            activeAiCount: snapshot.activeAiCount,
            completedAiCount: snapshot.completedAiCount,
            bufferedCount: snapshot.bufferedCount,
            ...batchSummaryAccumulator.getSnapshot(),
          });
        }

        requestStream = concurrentRequestStreamFactory.createConcurrentAiRequestStream({
          tasks: tasks,
          concurrency: batchConcurrency,
          staggerMs: 50,
          onStateChange: function () {
            if (batchClosed === true) {
              return;
            }
            updateBatchSnapshot(currentPhaseText, currentDisplayText, true);
          },
          runTask: async function (task, index) {
            const item = await dataApi.getItemByTask(task, {
              includeCurrentInput: false,
            });
            if (!item) {
              throw new Error("无法定位批量条目。");
            }
            item.batchRunId = batchRunId;
            item.batchItemIndex = Number(task.index || 0) || index + 1;
            item.batchProcessKey =
              "task-item:" + String(item.taskItemId || task.taskItemId || task.index || "unknown");
            item.clientRequestId = [
              batchRunId,
              String(item.batchItemIndex + 1),
              String(item.taskItemId || "unknown"),
            ].join(":");
            item.frontConcurrency = batchConcurrency;
            return aiClient.recommend(item);
          },
        });

        activeBatchContext = {
          mode: batchMeta.mode,
          requestStream: requestStream,
          batchRunId: batchRunId,
          notifyStopSignal: notifyStopSignal,
        };

        updateBatchSnapshot(batchMeta.label + "开始", tasks[0].displayName, true);

        while (consumedCount < tasks.length) {
          const outcome = batchStopRequested === true
            ? { type: "stop" }
            : await Promise.race([
                requestStream.nextResult().then(function (entry) {
                  return {
                    type: "result",
                    entry: entry,
                  };
                }),
                stopSignalPromise,
              ]);

          if (outcome?.type === "stop") {
            break;
          }
          const entry = outcome?.entry || null;
          if (!entry) {
            break;
          }
          const task = entry.task;
          updateBatchSnapshot(
            entry.ok === true ? batchMeta.label + "回填保存中" : batchMeta.label + "当前条失败",
            task.displayName,
            true
          );
          if (entry.ok !== true) {
            consumedCount += 1;
            failures.push(
              buildBatchFailureEntry({
                task: task,
                stage: "ai_request",
                message: entry.error?.message || String(entry.error),
                error: entry.error,
                batchConcurrency: batchConcurrency,
              })
            );
            updateBatchSnapshot(batchMeta.label + "当前条失败", task.displayName, true);
          } else {
            batchSummaryAccumulator.addResult(entry.value);
            let switchResult = null;
            let saveResult = null;
            let failureStage = "select_task";
            try {
              switchResult = await dataApi.selectTask(task, {
                timeoutMs: 12000,
                maxAttempts: 4,
              });
              if (switchResult?.ok === false) {
                throw new Error(switchResult.message || "切换批量条目失败。");
              }
              panel.renderResult(
                Object.assign({}, entry.value, {
                  currentText:
                    dataApi.getCurrentInputDisplayValue?.() || dataApi.getCurrentInputValue?.() || "",
                  currentSpeed:
                    dataApi.getCurrentSpeedDisplayValue?.() || dataApi.getCurrentSpeedValue?.() || "",
                })
              );
              failureStage = "save_current";
              saveResult = await dataApi.fillAndSaveCurrent(
                {
                  text: entry.value.recommendedText || "",
                  speed: entry.value.recommendedSpeed || "",
                },
                {
                  timeoutMs: 15000,
                }
              );
              if (saveResult?.ok === false) {
                throw new Error(saveResult.message || "填入并保存失败。");
              }
              consumedCount += 1;
              updateBatchSnapshot(batchMeta.label + "已识别并保存", task.displayName, true);
            } catch (error) {
              consumedCount += 1;
              failures.push(
                buildBatchFailureEntry({
                  task: task,
                  stage: failureStage,
                  message: error?.message || String(error),
                  error: error,
                  result: entry.value,
                  switchResult: switchResult,
                  saveResult: saveResult,
                  batchConcurrency: batchConcurrency,
                })
              );
              updateBatchSnapshot(batchMeta.label + "当前条失败", task.displayName, true);
            }
          }
        }

        if (batchStopRequested === true) {
          updateBatchSnapshot(batchMeta.label + "已停止", "", false);
          panel.setStatus("本轮" + batchMeta.label + "已按请求停止。", "warning");
          return;
        }

        await requestStream.whenProducersDone;
        updateBatchSnapshot(batchMeta.label + "已完成", "", false);
        panel.setStatus(
          failures.length > 0
            ? "当前分包" + batchMeta.label + "完成，存在失败条目。"
            : "当前分包" + batchMeta.label + "完成。",
          failures.length > 0 ? "warning" : "success"
        );
      } catch (error) {
        panel.setStatus(error?.message || String(error), "error");
      } finally {
        batchClosed = true;
        activeBatchContext = null;
        batchStopRequested = false;
        syncBusyState({ batch: false });
      }
    }

    async function handleBatchRecommendAll() {
      return runBatchRecommend("all");
    }

    async function handleBatchRecommendPending() {
      return runBatchRecommend("pending");
    }

    function ensureMounted() {
      panel.ensureMounted();
      void dataApi
        .getCurrentItem()
        .then(function (item) {
          panel.updateCurrentItemKey(item?.key || "");
        })
        .catch(function () {});
    }

    function start() {
      dataApi.start();
      shortcuts?.start?.();
      ensureMounted();
      mountTimer = window.setInterval(ensureMounted, 1200);
      panel.setStatus("泰语助手已就绪。", "success");
    }

    function stop() {
      if (mountTimer) {
        window.clearInterval(mountTimer);
        mountTimer = null;
      }
      shortcuts?.stop?.();
      dataApi.stop();
      panel.remove();
    }

    return {
      start,
      stop,
    };
  }

  function stopRuntime() {
    if (activeRuntime) {
      activeRuntime.stop();
      activeRuntime = null;
    }
  }

  async function evaluatePage() {
    if (!isMarkPage()) {
      stopRuntime();
      return;
    }
    const runtimeConfig = await loadRuntimeConfig();
    if (!runtimeConfig.enabled) {
      stopRuntime();
      return;
    }
    if (!activeRuntime) {
      const runtime = createRuntime(
        Object.assign({}, runtimeConfig.config || {}, {
          settings: runtimeConfig.settings || {},
        })
      );
      if (!runtime) {
        return;
      }
      activeRuntime = runtime;
      activeRuntime.start();
    }
  }

  function startRouteWatch() {
    if (routeTimer) {
      return;
    }
    routeTimer = window.setInterval(function () {
      if (location.href !== currentUrl) {
        currentUrl = location.href;
        void evaluatePage().catch(function (error) {
          console.warn("[Aishell][thai-helper] route evaluate failed", error?.message || error);
        });
      }
    }, 300);
  }

  function bootstrap() {
    startRouteWatch();
    void evaluatePage().catch(function (error) {
      console.warn("[Aishell][thai-helper] bootstrap failed", error?.message || error);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
  } else {
    bootstrap();
  }
})();

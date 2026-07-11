(function () {
  if (globalThis.__ASREdgeAishellTechThaiDiagnosticsInstalled === true) {
    return;
  }
  globalThis.__ASREdgeAishellTechThaiDiagnosticsInstalled = true;
  const errorDisplay = globalThis.ASREdgeAiErrorDisplay || {};
  const buildAiErrorDisplay =
    typeof errorDisplay.buildAiErrorDisplay === "function"
      ? errorDisplay.buildAiErrorDisplay
      : function (input) {
          const source = input && typeof input === "object" ? input : {};
          return {
            category: "unknown",
            summary: normalizeText(source.message || "失败"),
            inference: "",
            detailRows: [["错误解读", normalizeText(source.message || "失败") || "-"]],
            rawJson:
              source.rawResponse && typeof source.rawResponse === "object" ? source.rawResponse : {},
          };
        };

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function createStageLabel(stage) {
    if (stage === "ai_request") {
      return "AI请求";
    }
    if (stage === "select_task") {
      return "切换条目";
    }
    if (stage === "save_current") {
      return "保存当前条";
    }
    return "未知阶段";
  }

  function formatDurationMs(value) {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return "-";
    }
    if (numeric >= 1000) {
      return (numeric / 1000).toFixed(1).replace(/\.0$/, "") + "s";
    }
    return Math.round(numeric) + "ms";
  }

  function formatTimingSummary(timing) {
    const source = timing && typeof timing === "object" ? timing : {};
    const total = Number(source.totalDurationMs || 0);
    const recognize = Number(
      source.recognizeDurationMs || source.listenDurationMs || 0
    );
    if (total <= 0 && recognize <= 0) {
      return "-";
    }
    if (total > 0 && recognize > 0) {
      return formatDurationMs(total) + "（识别 " + formatDurationMs(recognize) + "）";
    }
    if (total > 0) {
      return formatDurationMs(total);
    }
    return "识别 " + formatDurationMs(recognize);
  }

  function formatModelSelection(models) {
    const source = models && typeof models === "object" ? models : {};
    return normalizeText(source.recognizeModel || source.singleModel) || "-";
  }

  function formatModeSummary(models) {
    void models;
    return "单阶段 Omni 识别";
  }

  function formatConcurrency(debug, fallbackFrontConcurrency) {
    const source = debug && typeof debug === "object" ? debug : {};
    const normalized = Number(source.frontConcurrencyNormalized || 0);
    const original = Number(source.frontConcurrencyOriginal || 0);
    const fallback = Number(fallbackFrontConcurrency || 0);
    if (normalized > 0 && original > 0 && normalized !== original) {
      return "原始 " + String(original) + " / 生效 " + String(normalized);
    }
    if (normalized > 0) {
      return String(normalized);
    }
    if (original > 0) {
      return String(original);
    }
    if (fallback > 0) {
      return String(fallback);
    }
    return "-";
  }

  function formatTokenSummary(usage) {
    const source = usage && typeof usage === "object" ? usage : {};
    const promptTokens = Number(source.promptTokens || 0);
    const completionTokens = Number(source.completionTokens || 0);
    const totalTokens = Number(source.totalTokens || 0);
    if (promptTokens <= 0 && completionTokens <= 0 && totalTokens <= 0) {
      return "-";
    }
    return [
      "输入 " + String(promptTokens || 0),
      "输出 " + String(completionTokens || 0),
      "合计 " + String(totalTokens || 0),
    ].join(" / ");
  }

  function formatOptionalConfidence(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return "-";
    }
    return String(Number(numeric.toFixed(3)));
  }

  function formatEstimatedCostCny(value) {
    if (value === null || value === undefined || value === "") {
      return "";
    }
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return "";
    }
    return String(numeric.toFixed(6)).replace(/0+$/, "").replace(/\.$/, "") + " 元";
  }

  function formatEstimatedCostSummary(cost, usage) {
    const costSource = cost && typeof cost === "object" ? cost : {};
    const usageSource = usage && typeof usage === "object" ? usage : {};
    const totalFormatted = formatEstimatedCostCny(costSource.totalEstimatedCostCny);
    if (totalFormatted) {
      return totalFormatted;
    }
    const stageFormatted = formatEstimatedCostCny(
      costSource.recognize?.estimatedCostCny ?? usageSource.estimatedCostCny
    );
    if (stageFormatted) {
      return stageFormatted;
    }
    if (normalizeText(costSource.recognize?.reason) === "没有数据源") {
      return "没有数据源";
    }
    return normalizeText(costSource.note || costSource.recognize?.reason) || "-";
  }

  function formatQueueWaitSummary(queue) {
    const source = queue && typeof queue === "object" ? queue : {};
    const totalQueueWaitMs = Number(source.totalQueueWaitMs || 0);
    if (totalQueueWaitMs <= 0) {
      return "-";
    }
    return formatDurationMs(totalQueueWaitMs);
  }

  function formatCacheSummary(cache) {
    const source = cache && typeof cache === "object" ? cache : {};
    return source.hit === true ? "是" : "否";
  }

  function pickDiagnosticsMeta(result) {
    const source = result && typeof result === "object" ? result : {};
    return source.meta && typeof source.meta === "object"
      ? source.meta
      : {
          models: source.models && typeof source.models === "object" ? source.models : {},
          usage: source.usage && typeof source.usage === "object" ? source.usage : {},
          cost: source.cost && typeof source.cost === "object" ? source.cost : {},
          timing: source.timing && typeof source.timing === "object" ? source.timing : {},
          queue: {},
          cache: {},
          debugId: normalizeText(source.debug?.debugId),
          requestId: normalizeText(source.debug?.requestId),
          retryCount: Number(source.debug?.totalRetryCount || 0) || 0,
          cancelled: source.debug?.cancelled === true,
          debug: source.debug && typeof source.debug === "object" ? source.debug : {},
        };
  }

  function buildCurrentResultDiagnostics(result, options) {
    const source = result && typeof result === "object" ? result : {};
    const sourceOptions = options && typeof options === "object" ? options : {};
    const meta = pickDiagnosticsMeta(source);
    const models = meta.models && typeof meta.models === "object" ? meta.models : {};
    const usage = meta.usage && typeof meta.usage === "object" ? meta.usage : {};
    const cost = meta.cost && typeof meta.cost === "object" ? meta.cost : {};
    const timing = meta.timing && typeof meta.timing === "object" ? meta.timing : {};
    const queue = meta.queue && typeof meta.queue === "object" ? meta.queue : {};
    const cache = meta.cache && typeof meta.cache === "object" ? meta.cache : {};
    const debug = meta.debug && typeof meta.debug === "object" ? meta.debug : {};
    const rows = [
      ["执行链路", formatModeSummary(models)],
      ["模型选择", formatModelSelection(models)],
      ["AI耗时", formatTimingSummary(timing)],
      ["前端并发", formatConcurrency(debug, sourceOptions.fallbackFrontConcurrency)],
      ["Token", formatTokenSummary(usage)],
      ["预估人民币", formatEstimatedCostSummary(cost, usage)],
      ["排队等待", formatQueueWaitSummary(queue)],
      ["缓存命中", formatCacheSummary(cache)],
      ["后端模式", normalizeText(debug.clientBackendMode) || "-"],
      ["后端地址", normalizeText(debug.clientBackendEndpoint) || "-"],
      ["自动回退", debug.clientFallbackUsed === true ? "是" : "否"],
      ["requestId", normalizeText(meta.requestId || debug.requestId) || "-"],
      ["debugId", normalizeText(meta.debugId || debug.debugId) || "-"],
    ];
    return {
      rows: rows,
    };
  }

  function buildRawFailureJson(input) {
    const source = input && typeof input === "object" ? input : {};
    const error = source.error && typeof source.error === "object" ? source.error : null;
    if (error?.rawResponse && typeof error.rawResponse === "object") {
      return buildAiErrorDisplay({
        message: source.message || error.message,
        rawResponse: error.rawResponse,
      }).rawJson;
    }
    return {
      stage: normalizeText(source.stage),
      message: normalizeText(source.message),
      task: {
        displayName: normalizeText(source.task?.displayName),
        taskItemId: normalizeText(source.task?.taskItemId),
      },
      saveResult:
        source.saveResult && typeof source.saveResult === "object" ? source.saveResult : null,
      switchResult:
        source.switchResult && typeof source.switchResult === "object" ? source.switchResult : null,
      aiDebug:
        source.result?.debug && typeof source.result.debug === "object"
          ? source.result.debug
          : null,
    };
  }

  function buildBatchFailureEntry(input) {
    const source = input && typeof input === "object" ? input : {};
    const task = source.task && typeof source.task === "object" ? source.task : {};
    const stage = normalizeText(source.stage);
    const message = normalizeText(source.message || source.error?.message || "失败");
    const rawJson = buildRawFailureJson(source);
    const errorDisplayInfo = buildAiErrorDisplay({
      message: message,
      rawResponse:
        source.error?.rawResponse && typeof source.error.rawResponse === "object"
          ? source.error.rawResponse
          : null,
    });
    const errorStage = normalizeText(
      rawJson?.error?.stage ||
      rawJson?.saveResult?.responseBody?.error?.stage ||
      rawJson?.aiDebug?.stage
    );
    const diagnostics = buildCurrentResultDiagnostics(source.result, {
      fallbackFrontConcurrency: source.batchConcurrency,
    });
    return {
      displayName: normalizeText(task.displayName) || "未知条目",
      message: message,
      stage: stage,
      stageLabel: createStageLabel(stage),
      detailRows: [
        ["失败阶段", createStageLabel(stage)],
        ["模型阶段", errorStage || "-"],
        ["错误摘要", message || "-"],
      ].concat(errorDisplayInfo.detailRows || [], diagnostics.rows),
      rawJson: rawJson,
    };
  }

  const api = {
    buildBatchFailureEntry,
    buildCurrentResultDiagnostics,
    createStageLabel,
    formatConcurrency,
    formatDurationMs,
    formatModelSelection,
    formatOptionalConfidence,
    formatQueueWaitSummary,
    formatTimingSummary,
    formatTokenSummary,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalThis.__ASREdgeAishellTechThaiDiagnostics = api;
})();

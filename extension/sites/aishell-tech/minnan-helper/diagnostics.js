(function () {
  if (globalThis.__ASREdgeAishellTechMinnanDiagnosticsInstalled === true) {
    return;
  }
  globalThis.__ASREdgeAishellTechMinnanDiagnosticsInstalled = true;
  const errorDisplay = globalThis.ASREdgeAiErrorDisplay || {};
  const lexiconDisplay =
    globalThis.ASREdgeLexiconDisplay ||
    (typeof module !== "undefined" && module.exports
      ? require("../../../shared/lexicon-display.js")
      : {});
  const aiCostDisplay =
    globalThis.ASREdgeAiCostDisplay ||
    (typeof module !== "undefined" && module.exports
      ? require("../../../shared/ai-cost-display.js")
      : {});
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
  const formatLexiconStatusAndMode =
    typeof lexiconDisplay.formatLexiconStatusAndMode === "function"
      ? lexiconDisplay.formatLexiconStatusAndMode
      : function () {
          return "";
        };
  const buildCostRows =
    typeof aiCostDisplay.buildCostRows === "function"
      ? aiCostDisplay.buildCostRows
      : function () {
          return [];
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
    const listen = Number(source.listenDurationMs || 0);
    const convert = Number(source.convertDurationMs || source.candidateDurationMs || 0);
    const compare = Number(source.compareDurationMs || 0);
    if (total <= 0 && listen <= 0 && convert <= 0 && compare <= 0) {
      return "-";
    }
    const detailParts = [];
    if (convert > 0) {
      detailParts.push("转换 " + formatDurationMs(convert));
    }
    if (listen > 0) {
      detailParts.push("听音 " + formatDurationMs(listen));
    }
    if (compare > 0) {
      detailParts.push("比较 " + formatDurationMs(compare));
    }
    if (total > 0 && detailParts.length > 0) {
      return formatDurationMs(total) + "（" + detailParts.join(" / ") + "）";
    }
    if (total > 0) {
      return formatDurationMs(total);
    }
    return detailParts.join(" / ");
  }

  function formatModelSelection(models) {
    const source = models && typeof models === "object" ? models : {};
    const parts = [];
    if (normalizeText(source.convertModel || source.candidateModel)) {
      parts.push("转换 " + normalizeText(source.convertModel || source.candidateModel));
    }
    if (normalizeText(source.listenModel)) {
      parts.push("听音 " + normalizeText(source.listenModel));
    }
    if (normalizeText(source.compareModel)) {
      const family = normalizeText(source.compareModelFamily || "qwen").toLowerCase() === "omni"
        ? "Omni"
        : "Qwen";
      parts.push("比较 " + family + " " + normalizeText(source.compareModel));
    }
    return parts.length > 0 ? parts.join(" / ") : "-";
  }

  function formatModeSummary(models) {
    const source = models && typeof models === "object" ? models : {};
    const compareFamily = normalizeText(source.compareModelFamily).toLowerCase() === "omni"
      ? "Omni 比较"
      : normalizeText(source.compareModelFamily)
        ? "Qwen 比较"
        : "";
    const parts = ["转换+听音并行", compareFamily].filter(Boolean);
    return parts.length > 0 ? parts.join(" / ") : "-";
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
    if (source.meta && typeof source.meta === "object") {
      return Object.assign({}, source.meta, {
        cost:
          source.meta.cost && typeof source.meta.cost === "object"
            ? source.meta.cost
            : source.cost && typeof source.cost === "object"
              ? source.cost
              : {},
      });
    }
    return {
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
    const lexicon = meta.lexicon && typeof meta.lexicon === "object" ? meta.lexicon : null;
    const audioFirstReference =
      meta.audioFirstReference && typeof meta.audioFirstReference === "object"
        ? meta.audioFirstReference
        : {};
    const rows = [
      ["执行链路", formatModeSummary(models)],
      ["模型选择", formatModelSelection(models)],
      ["AI耗时", formatTimingSummary(timing)],
      ["前端并发", formatConcurrency(debug, sourceOptions.fallbackFrontConcurrency)],
      ["Token", formatTokenSummary(usage)],
    ].concat(
      buildCostRows({
        cost: cost,
        stageDefinitions: [
          {
            key: "convert",
            label: "转换预估人民币",
          },
          {
            key: "listen",
            label: "听音预估人民币",
          },
          {
            key: "compare",
            label: "比较预估人民币",
          },
        ],
        totalLabel: "总预估人民币",
      }),
      [
      ["FunASR", normalizeText(models.funAsrProvider) || "-"],
      ["排队等待", formatQueueWaitSummary(queue)],
      ["缓存命中", formatCacheSummary(cache)],
      ["后端模式", normalizeText(debug.clientBackendMode) || "-"],
      ["后端地址", normalizeText(debug.clientBackendEndpoint) || "-"],
      ["自动回退", debug.clientFallbackUsed === true ? "是" : "否"],
      ["requestId", normalizeText(meta.requestId || debug.requestId) || "-"],
      ["debugId", normalizeText(meta.debugId || debug.debugId) || "-"],
      ]
    );
    const lexiconSummary = formatLexiconStatusAndMode(lexicon, {
      scriptType: "default",
    });
    if (lexiconSummary) {
      rows.splice(rows.length - 2, 0, ["词表状态与模式", lexiconSummary]);
    }
    if (normalizeText(audioFirstReference.convertedText || audioFirstReference.candidateText)) {
      rows.splice(2, 0,
        [
          "采纳阈值",
          formatOptionalConfidence(audioFirstReference.correctionThreshold),
        ],
        [
          "校正置信度",
          formatOptionalConfidence(audioFirstReference.correctionConfidence),
        ]
      );
    }
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

  globalThis.__ASREdgeAishellTechMinnanDiagnostics = api;
})();

(function () {
  const aiCostDisplay =
    globalThis.ASREdgeAiCostDisplay ||
    (typeof module !== "undefined" && module.exports
      ? require("./ai-cost-display.js")
      : {});
  const formatEstimatedCostCny =
    typeof aiCostDisplay.formatEstimatedCostCny === "function"
      ? aiCostDisplay.formatEstimatedCostCny
      : function (value) {
          if (value === null || value === undefined || value === "") {
            return "";
          }
          const numeric = Number(value);
          if (!Number.isFinite(numeric)) {
            return "";
          }
          return String(numeric.toFixed(6)).replace(/0+$/, "").replace(/\.$/, "") + " 元";
        };

  function roundCost(value) {
    return Number(Number(value || 0).toFixed(6));
  }

  function readUsageNumber(source, keys) {
    const input = source && typeof source === "object" ? source : {};
    for (let index = 0; index < keys.length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(input, keys[index])) {
        continue;
      }
      const numeric = Number(input[keys[index]]);
      if (Number.isFinite(numeric)) {
        return {
          found: true,
          value: numeric,
        };
      }
    }
    return {
      found: false,
      value: 0,
    };
  }

  function collectUsageTotals(usage) {
    const source = usage && typeof usage === "object" ? usage : null;
    if (!source) {
      return {
        found: false,
        complete: false,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      };
    }

    const childTotals = Object.keys(source)
      .filter(function (key) {
        return source[key] && typeof source[key] === "object";
      })
      .map(function (key) {
        return collectUsageTotals(source[key]);
      })
      .filter(function (item) {
        return item.found;
      });

    if (childTotals.length > 0) {
      return childTotals.reduce(
        function (result, item) {
          result.found = true;
          result.complete = result.complete && item.complete;
          result.promptTokens += item.promptTokens;
          result.completionTokens += item.completionTokens;
          result.totalTokens += item.totalTokens;
          return result;
        },
        {
          found: false,
          complete: true,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        }
      );
    }

    const promptTokens = readUsageNumber(source, [
      "promptTokens",
      "prompt_tokens",
      "inputTokens",
      "input_tokens",
    ]);
    const completionTokens = readUsageNumber(source, [
      "completionTokens",
      "completion_tokens",
      "outputTokens",
      "output_tokens",
    ]);
    const totalTokens = readUsageNumber(source, ["totalTokens", "total_tokens"]);
    const found = promptTokens.found || completionTokens.found || totalTokens.found;
    const complete = promptTokens.found && completionTokens.found;

    return {
      found: found,
      complete: complete,
      promptTokens: complete ? promptTokens.value : 0,
      completionTokens: complete ? completionTokens.value : 0,
      totalTokens: complete
        ? totalTokens.found
          ? totalTokens.value
          : promptTokens.value + completionTokens.value
        : 0,
    };
  }

  function resolveUsageTotals(result) {
    const source = result && typeof result === "object" ? result : {};
    const usageSource =
      source.usage && typeof source.usage === "object"
        ? source.usage
        : source;
    return collectUsageTotals(usageSource);
  }

  function resolveEstimatedCost(result) {
    const source = result && typeof result === "object" ? result : {};
    const cost = source.cost && typeof source.cost === "object" ? source.cost : {};
    const totalEstimatedCostCny = Number(cost.totalEstimatedCostCny);
    if (Number.isFinite(totalEstimatedCostCny)) {
      return {
        found: true,
        value: roundCost(totalEstimatedCostCny),
      };
    }
    const estimatedCostCny = Number(cost.estimatedCostCny);
    if (Number.isFinite(estimatedCostCny)) {
      return {
        found: true,
        value: roundCost(estimatedCostCny),
      };
    }
    return {
      found: false,
      value: 0,
    };
  }

  function createBatchSummaryAccumulator() {
    let batchResultCount = 0;
    let usageComplete = true;
    let priceComplete = true;
    let promptTokens = 0;
    let completionTokens = 0;
    let totalTokens = 0;
    let estimatedCostCny = 0;

    function addResult(result) {
      batchResultCount += 1;
      const usageTotals = resolveUsageTotals(result);
      if (usageTotals.complete) {
        promptTokens += usageTotals.promptTokens;
        completionTokens += usageTotals.completionTokens;
        totalTokens += usageTotals.totalTokens;
      } else {
        usageComplete = false;
      }

      const estimatedCost = resolveEstimatedCost(result);
      if (estimatedCost.found) {
        estimatedCostCny += estimatedCost.value;
      } else {
        priceComplete = false;
      }
    }

    function reset() {
      batchResultCount = 0;
      usageComplete = true;
      priceComplete = true;
      promptTokens = 0;
      completionTokens = 0;
      totalTokens = 0;
      estimatedCostCny = 0;
    }

    function getSnapshot() {
      return {
        batchResultCount: batchResultCount,
        batchPromptTokens: batchResultCount > 0 && usageComplete ? promptTokens : null,
        batchCompletionTokens: batchResultCount > 0 && usageComplete ? completionTokens : null,
        batchTotalTokens: batchResultCount > 0 && usageComplete ? totalTokens : null,
        batchEstimatedCostCny:
          batchResultCount > 0 && priceComplete ? roundCost(estimatedCostCny) : null,
        batchHasUsageData: batchResultCount > 0 && usageComplete,
        batchHasPriceData: batchResultCount > 0 && priceComplete,
      };
    }

    return {
      addResult,
      getSnapshot,
      reset,
    };
  }

  function buildBatchSummaryRows(snapshot) {
    const source = snapshot && typeof snapshot === "object" ? snapshot : {};
    const batchResultCount = Math.max(0, Number(source.batchResultCount || 0) || 0);
    const hasUsageData = source.batchHasUsageData === true;
    const hasPriceData = source.batchHasPriceData === true;
    const formattedCost = formatEstimatedCostCny(source.batchEstimatedCostCny);

    return [
      ["批量输入Token", hasUsageData ? String(Number(source.batchPromptTokens || 0) || 0) : "-"],
      ["批量输出Token", hasUsageData ? String(Number(source.batchCompletionTokens || 0) || 0) : "-"],
      ["批量总Token", hasUsageData ? String(Number(source.batchTotalTokens || 0) || 0) : "-"],
      [
        "批量预估人民币",
        batchResultCount <= 0 ? "-" : hasPriceData ? formattedCost || "-" : "没有数据源",
      ],
    ];
  }

  const api = {
    buildBatchSummaryRows,
    collectUsageTotals,
    createBatchSummaryAccumulator,
    resolveEstimatedCost,
    resolveUsageTotals,
  };

  globalThis.ASREdgeAiBatchSummary = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();

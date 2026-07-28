(function () {
  if (globalThis.__ASREdgeAishellTechCantoneseBatchWindowInstalled === true) {
    return;
  }
  globalThis.__ASREdgeAishellTechCantoneseBatchWindowInstalled = true;

  function normalizeConcurrency(value) {
    const numeric = Math.floor(Number(value) || 0);
    return numeric > 0 ? numeric : 1;
  }

  function resolveBatchRequestPolicy(config) {
    const source = config && typeof config === "object" ? config : {};
    return {
      configuredConcurrency: normalizeConcurrency(source.aiQualifiedAutofillConcurrency),
      frontConcurrency: 1,
      requestStaggerMs: 0,
    };
  }

  function shouldPauseAfterAiError(error) {
    const source = error && typeof error === "object" ? error : {};
    const code = String(source.code || "").trim().toLowerCase();
    const providerCode = String(source.providerCode || "").trim().toLowerCase();
    const providerStatus = Number(source.providerStatus || source.statusCode || 0) || 0;
    return (
      code === "provider-rate-limited" ||
      code === "qwen-burst-rate-limited" ||
      providerStatus === 429 ||
      ["limit_burst_rate", "throttling", "rate_limit", "limit_requests", "toomanyrequests"].includes(providerCode)
    );
  }

  function createRollingBatchWindow(tasks, concurrency) {
    const source = Array.isArray(tasks) ? tasks.slice() : [];
    const limit = normalizeConcurrency(concurrency);
    let nextIndex = 0;
    let launchedCount = 0;
    let consumedCount = 0;

    function takeUntilCapacity() {
      const launchedTasks = [];
      while (nextIndex < source.length && launchedCount - consumedCount < limit) {
        launchedTasks.push(source[nextIndex]);
        nextIndex += 1;
        launchedCount += 1;
      }
      return launchedTasks;
    }

    function markConsumed() {
      if (consumedCount < launchedCount) {
        consumedCount += 1;
      }
      return takeUntilCapacity();
    }

    function getSnapshot() {
      return {
        total: source.length,
        concurrency: limit,
        launchedCount: launchedCount,
        consumedCount: consumedCount,
        nextIndex: nextIndex,
        outstandingCount: launchedCount - consumedCount,
        done: consumedCount >= source.length && nextIndex >= source.length,
      };
    }

    return {
      takeUntilCapacity: takeUntilCapacity,
      markConsumed: markConsumed,
      getSnapshot: getSnapshot,
    };
  }

  const api = {
    createRollingBatchWindow: createRollingBatchWindow,
    resolveBatchRequestPolicy: resolveBatchRequestPolicy,
    shouldPauseAfterAiError: shouldPauseAfterAiError,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

globalThis.__ASREdgeAishellTechCantoneseBatchWindow = api;
})();

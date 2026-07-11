(function () {
  if (globalThis.__ASREdgeAishellTechVietnameseBatchWindowInstalled === true) {
    return;
  }
  globalThis.__ASREdgeAishellTechVietnameseBatchWindowInstalled = true;

  function normalizeConcurrency(value) {
    const numeric = Math.floor(Number(value) || 0);
    return numeric > 0 ? numeric : 1;
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
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalThis.__ASREdgeAishellTechVietnameseBatchWindow = api;
})();

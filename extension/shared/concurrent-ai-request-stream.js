"use strict";

(function initConcurrentAiRequestStream(globalObject) {
  function normalizeTaskList(tasks) {
    return Array.isArray(tasks) ? tasks.slice() : [];
  }

  function normalizeConcurrency(value) {
    const numeric = Math.floor(Number(value) || 0);
    return numeric > 0 ? numeric : 1;
  }

  function normalizeStaggerMs(value) {
    const numeric = Math.floor(Number(value) || 0);
    return numeric >= 0 ? numeric : 0;
  }

  function createConcurrentAiRequestStream(options) {
    const config = options && typeof options === "object" ? options : {};
    const tasks = normalizeTaskList(config.tasks);
    const frontConcurrency = normalizeConcurrency(config.concurrency);
    const requestStaggerMs = normalizeStaggerMs(config.staggerMs);
    const runTask = typeof config.runTask === "function" ? config.runTask : null;
    const onStateChange = typeof config.onStateChange === "function" ? config.onStateChange : null;

    if (!runTask) {
      throw new Error("runTask 必须是函数。");
    }

    const state = {
      nextLaunchIndex: 0,
      nextDispatchAt: 0,
      launchedCount: 0,
      activeAiCount: 0,
      completedAiCount: 0,
      succeededCount: 0,
      failedCount: 0,
      bufferedResults: [],
      waitingResolvers: [],
      producersDone: false,
      cancelled: false,
      cancelReason: null,
      launchTimer: null,
    };

    let resolveProducersDone = null;
    const whenProducersDone = new Promise(function (resolve) {
      resolveProducersDone = resolve;
    });

    function clearLaunchTimer() {
      if (state.launchTimer) {
        globalObject.clearTimeout(state.launchTimer);
        state.launchTimer = null;
      }
    }

    function getSnapshot() {
      return {
        totalCount: tasks.length,
        launchedCount: state.launchedCount,
        activeAiCount: state.activeAiCount,
        completedAiCount: state.completedAiCount,
        succeededCount: state.succeededCount,
        failedCount: state.failedCount,
        bufferedCount: state.bufferedResults.length,
        remainingToLaunchCount: Math.max(0, tasks.length - state.nextLaunchIndex),
        frontConcurrency: frontConcurrency,
        requestStaggerMs: requestStaggerMs,
        producersDone: state.producersDone === true,
        cancelled: state.cancelled === true,
      };
    }

    function emitStateChange() {
      if (typeof onStateChange !== "function") {
        return;
      }
      try {
        onStateChange(getSnapshot());
      } catch (error) {}
    }

    function flushWaitingResolversWithNull() {
      while (state.waitingResolvers.length > 0) {
        const resolve = state.waitingResolvers.shift();
        resolve(null);
      }
    }

    function markProducersDone() {
      if (state.producersDone === true) {
        return;
      }
      state.producersDone = true;
      clearLaunchTimer();
      if (typeof resolveProducersDone === "function") {
        resolveProducersDone();
        resolveProducersDone = null;
      }
      if (state.bufferedResults.length <= 0) {
        flushWaitingResolversWithNull();
      }
      emitStateChange();
    }

    function enqueueResult(entry) {
      if (state.waitingResolvers.length > 0) {
        const resolve = state.waitingResolvers.shift();
        resolve(entry);
        emitStateChange();
        return;
      }
      state.bufferedResults.push(entry);
      emitStateChange();
    }

    function scheduleNextLaunch(waitMs) {
      if (state.producersDone === true) {
        return;
      }
      clearLaunchTimer();
      state.launchTimer = globalObject.setTimeout(function () {
        state.launchTimer = null;
        processLaunchLoop();
      }, Math.max(0, Number(waitMs) || 0));
    }

    function maybeFinishProducers() {
      if (
        state.producersDone !== true &&
        (state.cancelled === true || state.nextLaunchIndex >= tasks.length) &&
        state.activeAiCount <= 0
      ) {
        markProducersDone();
      }
    }

    function launchOneTask(task, index) {
      state.activeAiCount += 1;
      state.launchedCount += 1;
      const startedAt = Date.now();
      state.nextDispatchAt = startedAt + requestStaggerMs;
      emitStateChange();

      Promise.resolve()
        .then(function () {
          return runTask(task, index, {
            frontConcurrency: frontConcurrency,
            requestStaggerMs: requestStaggerMs,
          });
        })
        .then(function (value) {
          state.succeededCount += 1;
          enqueueResult({
            ok: true,
            task: task,
            index: index,
            value: value,
            completedAt: Date.now(),
          });
        })
        .catch(function (error) {
          state.failedCount += 1;
          enqueueResult({
            ok: false,
            task: task,
            index: index,
            error: error,
            completedAt: Date.now(),
          });
        })
        .finally(function () {
          state.activeAiCount = Math.max(0, state.activeAiCount - 1);
          state.completedAiCount += 1;
          emitStateChange();
          if (state.cancelled !== true && state.nextLaunchIndex < tasks.length) {
            processLaunchLoop();
          }
          maybeFinishProducers();
        });
    }

    function processLaunchLoop() {
      if (state.producersDone === true) {
        return;
      }
      if (state.cancelled === true) {
        maybeFinishProducers();
        return;
      }

      while (state.activeAiCount < frontConcurrency && state.nextLaunchIndex < tasks.length) {
        const now = Date.now();
        const waitMs = Math.max(0, state.nextDispatchAt - now);
        if (waitMs > 0) {
          scheduleNextLaunch(waitMs);
          return;
        }

        const index = state.nextLaunchIndex;
        const task = tasks[index];
        state.nextLaunchIndex += 1;
        launchOneTask(task, index);
      }

      maybeFinishProducers();
    }

    function nextResult() {
      if (state.bufferedResults.length > 0) {
        const entry = state.bufferedResults.shift();
        emitStateChange();
        return Promise.resolve(entry);
      }
      if (state.producersDone === true) {
        return Promise.resolve(null);
      }
      return new Promise(function (resolve) {
        state.waitingResolvers.push(resolve);
      });
    }

    function cancelPending(reason) {
      state.cancelled = true;
      state.cancelReason =
        reason instanceof Error ? reason : new Error(String(reason || "调度已取消。"));
      clearLaunchTimer();
      emitStateChange();
      maybeFinishProducers();
    }

    if (tasks.length <= 0) {
      markProducersDone();
    } else {
      processLaunchLoop();
    }

    emitStateChange();

    return {
      nextResult: nextResult,
      cancelPending: cancelPending,
      getSnapshot: getSnapshot,
      whenProducersDone: whenProducersDone,
    };
  }

  const api = {
    createConcurrentAiRequestStream: createConcurrentAiRequestStream,
  };

  globalObject.ASREdgeConcurrentAiRequestStream = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);

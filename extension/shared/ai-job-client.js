(function () {
  "use strict";

  if (globalThis.ASREdgeAiJobClient) {
    return;
  }

  function normalizeText(value) {
    return String(value || "").trim();
  }

  function createError(message, details) {
    const error = new Error(String(message || "AI 任务请求失败。"));
    Object.assign(error, details || {});
    return error;
  }

  function createUserAbortedError(phase) {
    return createError("已停止自动流程。", {
      code: "user-aborted",
      phase: normalizeText(phase) || "request",
    });
  }

  function delay(ms, signal, phase) {
    return new Promise(function (resolve, reject) {
      const timeout = globalThis.setTimeout(function () {
        cleanup();
        resolve();
      }, Math.max(0, Number(ms) || 0));

      function onAbort() {
        cleanup();
        reject(createUserAbortedError(phase));
      }

      function cleanup() {
        globalThis.clearTimeout(timeout);
        if (signal && typeof signal.removeEventListener === "function") {
          signal.removeEventListener("abort", onAbort);
        }
      }

      if (signal?.aborted) {
        onAbort();
        return;
      }

      if (signal && typeof signal.addEventListener === "function") {
        signal.addEventListener("abort", onAbort, { once: true });
      }
    });
  }

  function buildEndpoint(baseEndpoint) {
    try {
      return new URL(String(baseEndpoint || "")).toString();
    } catch (_error) {
      return normalizeText(baseEndpoint);
    }
  }

  function buildJobsEndpoint(baseEndpoint) {
    return buildEndpoint(baseEndpoint).replace(/\/+$/, "") + "/jobs";
  }

  function buildJobDetailEndpoint(baseEndpoint, jobId) {
    return buildJobsEndpoint(baseEndpoint) + "/" + encodeURIComponent(String(jobId || "").trim());
  }

  function buildJobDebugEndpoint(baseEndpoint, jobId) {
    return buildJobDetailEndpoint(baseEndpoint, jobId) + "/debug";
  }

  async function requestJson(options) {
    const config = options && typeof options === "object" ? options : {};
    const fetchImpl =
      typeof config.fetchImpl === "function"
        ? config.fetchImpl
        : typeof fetch === "function"
          ? fetch.bind(globalThis)
          : null;
    if (!fetchImpl) {
      throw createError("当前环境不支持 fetch。", {
        code: "fetch-unavailable",
      });
    }

    const timeoutMs = Math.max(1000, Number(config.timeoutMs) || 10000);
    const externalSignal = config.signal || null;
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    let timedOut = false;
    const timer = globalThis.setTimeout(function () {
      timedOut = true;
      if (controller) {
        controller.abort();
      }
    }, timeoutMs);

    try {
      const response = await Promise.race([
        fetchImpl(config.url, Object.assign(
          {
            method: config.method || "GET",
            signal: externalSignal || (controller ? controller.signal : undefined),
          },
          config.requestInit || {},
          config.body !== undefined
            ? {
                body: typeof config.body === "string" ? config.body : JSON.stringify(config.body),
              }
            : null
        )),
        new Promise(function (_resolve, reject) {
          globalThis.setTimeout(function () {
            if (timedOut) {
              reject(createError("AI 任务请求超时。", {
                code: "timeout",
                phase: normalizeText(config.phase) || "request",
              }));
            }
          }, timeoutMs);
        }),
      ]);
      const responseText = await response.text();
      let body = null;
      try {
        body = JSON.parse(responseText || "{}");
      } catch (_error) {
        body = null;
      }
      return {
        response,
        body,
        responseText,
      };
    } finally {
      globalThis.clearTimeout(timer);
    }
  }

  function defaultBuildApiError(responseBody, statusCode, phase) {
    const body = responseBody && typeof responseBody === "object" ? responseBody : {};
    return createError(
      normalizeText(body?.message) || "AI 任务请求失败（HTTP " + String(statusCode || 0) + "）。",
      {
        code: normalizeText(body?.code) || "request-error",
        phase: normalizeText(phase) || "request",
        requestId: normalizeText(body?.requestId || body?.meta?.requestId),
        statusCode: Number(statusCode) || 0,
        rawResponse: body,
      }
    );
  }

  function defaultBuildTerminalError(jobBody) {
    const body = jobBody && typeof jobBody === "object" ? jobBody : {};
    const errorBody = body.error && typeof body.error === "object" ? body.error : {};
    return createError(
      normalizeText(errorBody.message) || "AI 任务执行失败。",
      {
        code: normalizeText(errorBody.code) || "job-failed",
        phase: "job",
        requestId: normalizeText(body.requestId),
        jobId: normalizeText(body.jobId),
        rawResponse: body,
      }
    );
  }

  function defaultCreateTimeoutError(phase) {
    return createError("AI 任务请求超时。", {
      code: "timeout",
      phase: normalizeText(phase) || "request",
    });
  }

  async function runJobLifecycle(options) {
    const config = options && typeof options === "object" ? options : {};
    const externalSignal = config.signal || null;
    const endpoint = buildEndpoint(config.endpoint);
    const timeoutMs = Math.max(1000, Number(config.timeoutMs) || 60000);
    const pollIntervalMs = Math.max(100, Number(config.pollIntervalMs) || 800);
    const perRequestTimeoutMs = Math.max(
      1000,
      Number(config.perRequestTimeoutMs) || Math.min(timeoutMs, 10000)
    );
    const deadlineAt = Date.now() + timeoutMs;
    const buildApiError =
      typeof config.buildApiError === "function" ? config.buildApiError : defaultBuildApiError;
    const buildTerminalError =
      typeof config.buildTerminalError === "function"
        ? config.buildTerminalError
        : defaultBuildTerminalError;
    const createTimeoutError =
      typeof config.createTimeoutError === "function"
        ? config.createTimeoutError
        : defaultCreateTimeoutError;
    const isTerminalSuccess =
      typeof config.isTerminalSuccess === "function"
        ? config.isTerminalSuccess
        : function (jobBody) {
            return normalizeText(jobBody?.status) === "succeeded";
          };
    const isTerminalFailure =
      typeof config.isTerminalFailure === "function"
        ? config.isTerminalFailure
        : function (jobBody) {
            const status = normalizeText(jobBody?.status);
            return status === "failed" || status === "expired";
          };
    const mapSuccess =
      typeof config.mapSuccess === "function"
        ? config.mapSuccess
        : function (jobBody) {
            return jobBody?.data;
          };

    async function requestPhase(url, method, body, phase) {
      if (externalSignal?.aborted) {
        throw createUserAbortedError(phase);
      }
      const remainingMs = deadlineAt - Date.now();
      if (remainingMs <= 0) {
        throw createTimeoutError(phase);
      }
      try {
        return await requestJson({
          fetchImpl: config.fetchImpl,
          url,
          method,
          body,
          timeoutMs: Math.min(remainingMs, perRequestTimeoutMs),
          signal: externalSignal,
          phase: phase,
          requestInit: config.requestInit,
        });
      } catch (error) {
        if (externalSignal?.aborted) {
          throw createUserAbortedError(phase);
        }
        if (error?.name === "AbortError") {
          throw createTimeoutError(phase);
        }
        if (error && typeof error === "object" && !error.phase) {
          error.phase = phase;
        }
        throw error;
      }
    }

    const createResponse = await requestPhase(
      buildJobsEndpoint(endpoint),
      "POST",
      config.body,
      "create"
    );
    if (
      !createResponse.response.ok ||
      createResponse.body?.success !== true ||
      !normalizeText(createResponse.body?.jobId)
    ) {
      throw buildApiError(createResponse.body, createResponse.response.status, "create");
    }

    let jobBody = createResponse.body;
    while (true) {
      if (externalSignal?.aborted) {
        throw createUserAbortedError("poll");
      }
      if (isTerminalSuccess(jobBody)) {
        return {
          job: jobBody,
          data: mapSuccess(jobBody),
          createResponse,
        };
      }
      if (isTerminalFailure(jobBody)) {
        throw buildTerminalError(jobBody);
      }
      const remainingMs = deadlineAt - Date.now();
      if (remainingMs <= 0) {
        throw createTimeoutError("poll");
      }
      await delay(Math.min(pollIntervalMs, remainingMs), externalSignal, "poll");
      const statusResponse = await requestPhase(
        buildJobDetailEndpoint(endpoint, jobBody.jobId),
        "GET",
        undefined,
        "poll"
      );
      if (!statusResponse.response.ok || statusResponse.body?.success !== true) {
        throw buildApiError(statusResponse.body, statusResponse.response.status, "poll");
      }
      jobBody = statusResponse.body;
    }
  }

  async function getJobDebug(options) {
    const config = options && typeof options === "object" ? options : {};
    const endpoint = buildEndpoint(config.endpoint);
    const jobId = normalizeText(config.jobId);
    if (!jobId) {
      throw createError("缺少 jobId，无法获取调试信息。", {
        code: "missing-job-id",
      });
    }
    const result = await requestJson({
      fetchImpl: config.fetchImpl,
      url: buildJobDebugEndpoint(endpoint, jobId),
      method: "GET",
      timeoutMs: Math.max(1000, Number(config.timeoutMs) || 10000),
      requestInit: config.requestInit,
    });
    if (!result.response.ok || result.body?.success !== true || result.body?.debug === undefined) {
      throw (
        typeof config.buildApiError === "function"
          ? config.buildApiError(result.body, result.response.status, "debug")
          : defaultBuildApiError(result.body, result.response.status, "debug")
      );
    }
    return result.body.debug;
  }

  const api = {
    buildEndpoint,
    buildJobDebugEndpoint,
    buildJobDetailEndpoint,
    buildJobsEndpoint,
    createError,
    defaultBuildApiError,
    defaultBuildTerminalError,
    defaultCreateTimeoutError,
    delay,
    createUserAbortedError,
    getJobDebug,
    normalizeText,
    requestJson,
    runJobLifecycle,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalThis.ASREdgeAiJobClient = api;
})();

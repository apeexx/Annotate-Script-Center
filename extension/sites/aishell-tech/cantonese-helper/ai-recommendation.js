(function () {
  if (globalThis.__ASREdgeAishellTechCantoneseAiRecommendationInstalled === true) {
    return;
  }
  globalThis.__ASREdgeAishellTechCantoneseAiRecommendationInstalled = true;
  const constants = globalThis.ASREdgeConstants || {};
  const storage = globalThis.ASREdgeStorage || null;
  const DEFAULT_ENDPOINT =
    String(constants.DEFAULT_BACKEND_BASE_URLS?.server || "").replace(/\/+$/, "") +
    "/api/aishell-tech/cantonese-helper/ai/recommend";
  const RECOMMEND_PATH =
    constants.AISHELL_TECH_CANTONESE_AI_RECOMMEND_PATH ||
    "/api/aishell-tech/cantonese-helper/ai/recommend";
  const BACKEND_MODE_SERVER = constants.BACKEND_ENDPOINT_MODE_SERVER || "server";
  const BACKEND_MODE_LOCAL = constants.BACKEND_ENDPOINT_MODE_LOCAL || "local";
  const DEFAULT_TIMEOUT_MS = 60000;
  const aiUsageMeta = globalThis.ASREdgeAiUsageMeta || {};
  const buildAiUsageRequestMeta =
    typeof aiUsageMeta.buildAiUsageRequestMeta === "function"
      ? aiUsageMeta.buildAiUsageRequestMeta
      : function (input) {
          const source = input && typeof input === "object" ? input : {};
          return {
            aiUsageOperatorName: normalizeText(source.settings?.meta?.aiUsageOperatorName).slice(0, 40),
            platformUserName: normalizeText(source.platformUserName).slice(0, 80),
            platformUserId: normalizeText(source.platformUserId).slice(0, 120),
          };
        };
  const assertAiUsageOperatorConfigured =
    typeof aiUsageMeta.assertAiUsageOperatorConfigured === "function"
      ? aiUsageMeta.assertAiUsageOperatorConfigured
      : function (requestMeta) {
          if (!normalizeText(requestMeta?.aiUsageOperatorName)) {
            const error = new Error("请先在 options 首页填写 AI 调用使用人。");
            error.code = "missing-ai-usage-operator-name";
            throw error;
          }
          return requestMeta;
        };

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function createClientError(message, details) {
    const error = new Error(String(message || "请求失败。"));
    Object.assign(error, details || {});
    return error;
  }

  function isExtensionContextInvalidatedError(error) {
    if (storage && typeof storage.isExtensionContextInvalidatedError === "function") {
      try {
        if (storage.isExtensionContextInvalidatedError(error)) {
          return true;
        }
      } catch (_innerError) {
        // Ignore storage helper failures and fall back to text matching.
      }
    }
    if (String(error?.code || "") === "EXTENSION_CONTEXT_INVALIDATED") {
      return true;
    }
    const message = String(error?.message || error || "").toLowerCase();
    return (
      message.indexOf("extension context invalidated") >= 0 ||
      message.indexOf("context invalidated") >= 0
    );
  }

  function inferBackendModeFromEndpoint(endpoint, fallbackMode) {
    const text = String(endpoint || "").trim().toLowerCase();
    if (text.indexOf("127.0.0.1") >= 0 || text.indexOf("localhost") >= 0) {
      return BACKEND_MODE_LOCAL;
    }
    if (text.indexOf("http://") === 0 || text.indexOf("https://") === 0) {
      return BACKEND_MODE_SERVER;
    }
    return fallbackMode === BACKEND_MODE_LOCAL ? BACKEND_MODE_LOCAL : BACKEND_MODE_SERVER;
  }

  function getBackendModeFromSettings(settings, endpoint) {
    if (typeof constants.getBackendEndpointModeFromSettings === "function") {
      const resolved = normalizeText(constants.getBackendEndpointModeFromSettings(settings || {}));
      if (
        resolved === BACKEND_MODE_LOCAL ||
        resolved === BACKEND_MODE_SERVER
      ) {
        return resolved;
      }
    }
    const rawMode = normalizeText(
      settings?.meta?.backendEndpointMode ||
        settings?.backend?.endpointMode ||
        settings?.backendEndpointMode
    ).toLowerCase();
    if (rawMode === BACKEND_MODE_LOCAL || rawMode === "localhost" || rawMode === "127.0.0.1") {
      return BACKEND_MODE_LOCAL;
    }
    if (rawMode === BACKEND_MODE_SERVER) {
      return BACKEND_MODE_SERVER;
    }
    return inferBackendModeFromEndpoint(endpoint, BACKEND_MODE_SERVER);
  }

  function buildBackendUrl(path, mode) {
    if (typeof constants.buildBackendUrl === "function") {
      const built = normalizeText(constants.buildBackendUrl(path, mode));
      if (built) {
        return built;
      }
    }
    const baseUrl =
      mode === BACKEND_MODE_LOCAL
        ? constants.DEFAULT_BACKEND_BASE_URLS?.local
        : constants.DEFAULT_BACKEND_BASE_URLS?.server;
    return String(baseUrl || "").replace(/\/+$/, "") + String(path || "");
  }

  function getOnlineState() {
    if (typeof navigator !== "undefined" && typeof navigator.onLine === "boolean") {
      return navigator.onLine;
    }
    return null;
  }

  function createNetworkErrorMeta(input) {
    const source = input && typeof input === "object" ? input : {};
    return {
      type: "client-network-error",
      backendMode: normalizeText(source.backendMode),
      endpoint: normalizeText(source.endpoint),
      fallbackEndpoint: normalizeText(source.fallbackEndpoint),
      fallbackAttempted: source.fallbackAttempted === true,
      originalErrorName: normalizeText(source.error?.name),
      originalErrorMessage: normalizeText(source.error?.message || source.error),
      online: getOnlineState(),
    };
  }

  function createDetailedClientError(message, code, meta) {
    const error = createClientError(message, {
      code: normalizeText(code) || "request-error",
      rawResponse: meta && typeof meta === "object" ? meta : null,
    });
    return error;
  }

  function attachClientDebug(result, meta) {
    const source = result && typeof result === "object" ? result : {};
    const responseMeta = source.meta && typeof source.meta === "object" ? source.meta : {};
    const responseDebug =
      responseMeta.debug && typeof responseMeta.debug === "object" ? responseMeta.debug : {};
    const debug = source.debug && typeof source.debug === "object" ? source.debug : {};
    return Object.assign({}, source, {
      meta: responseMeta,
      models: source.models || responseMeta.models || {},
      timing: source.timing || responseMeta.timing || {},
      usage: source.usage || responseMeta.usage || {},
      cost: source.cost || responseMeta.cost || {},
      debug: Object.assign({}, debug, {
        requestId: normalizeText(responseMeta.requestId) || normalizeText(debug.requestId),
        debugId: normalizeText(responseMeta.debugId) || normalizeText(debug.debugId),
        cacheHit:
          responseMeta.cache?.hit === true ||
          debug.cacheHit === true,
        cacheSourceRequestId:
          normalizeText(responseMeta.cache?.sourceRequestId) ||
          normalizeText(debug.cacheSourceRequestId),
        totalQueueWaitMs:
          Number(responseMeta.queue?.totalQueueWaitMs || 0) ||
          Number(debug.totalQueueWaitMs || 0),
        totalRetryCount:
          Number(responseMeta.retryCount || 0) ||
          Number(debug.totalRetryCount || 0),
        queueGroups:
          Array.isArray(responseMeta.queue?.groups)
            ? responseMeta.queue.groups.length
            : Number(debug.queueGroups || 0),
        cancelled:
          responseMeta.cancelled === true || debug.cancelled === true,
        stage:
          normalizeText(responseMeta.stage) || normalizeText(debug.stage),
        frontConcurrencyOriginal:
          responseDebug.frontConcurrencyOriginal ?? debug.frontConcurrencyOriginal ?? null,
        frontConcurrencyNormalized:
          responseDebug.frontConcurrencyNormalized ?? debug.frontConcurrencyNormalized ?? null,
        concurrencyModelType:
          normalizeText(responseDebug.concurrencyModelType || debug.concurrencyModelType),
        clientBackendMode: normalizeText(meta?.backendMode),
        clientBackendEndpoint: normalizeText(meta?.endpoint),
        clientFallbackUsed: meta?.fallbackUsed === true,
        clientPrimaryBackendMode: normalizeText(meta?.primaryBackendMode),
        clientPrimaryBackendEndpoint: normalizeText(meta?.primaryEndpoint),
      }),
    });
  }

  function buildApiError(responseBody, statusCode) {
    const body = responseBody && typeof responseBody === "object" ? responseBody : {};
    const errorBody = body.error && typeof body.error === "object" ? body.error : {};
    const metaBody = body.meta && typeof body.meta === "object" ? body.meta : {};
    const code = normalizeText(errorBody.code || body.code);
    const providerCode = normalizeText(errorBody.providerCode || body.providerCode);
    const providerStatus =
      Number(errorBody.providerStatus || body.providerStatus || statusCode || 0) || 0;
    let message =
      normalizeText(errorBody.message || body.message) ||
      "Aishell AI 推荐接口请求失败（HTTP " + String(statusCode) + "）。";

    if (code === "provider-queue-full") {
      message = "后端 AI 队列已满，请稍后重试。";
    } else if (code === "timeout") {
      message = "AI 推荐接口请求超时。";
    } else if (code === "network-disconnected") {
      message = "后端连接中断，请稍后重试。";
    } else if (code === "provider-rate-limited" || providerCode === "limit_burst_rate") {
      message = "上游模型限流，请降低并发或稍后重试。";
    } else if (code === "invalid-reference-text") {
      message = "当前条缺少平台参考文本，无法生成推荐文本。";
    } else if (code === "invalid-audio-url") {
      message = "当前条缺少可用音频地址，请先重新点击条目。";
    }

    if (body.summary) {
      message += "：" + String(body.summary || "").slice(0, 120);
    }

    const error = createClientError(message, {
      code: code,
      providerCode: providerCode,
      providerStatus: providerStatus,
      statusCode: Number(statusCode) || 0,
      requestId: normalizeText(metaBody.requestId || body.requestId),
      debugId: normalizeText(metaBody.debugId || body.debugId),
      stage: normalizeText(errorBody.stage),
      retryable: errorBody.retryable === true,
    });
    error.rawResponse = body;
    return error;
  }

  function getClientVersion() {
    try {
      const manifest = chrome?.runtime?.getManifest ? chrome.runtime.getManifest() : null;
      return String(manifest?.version || "unknown");
    } catch (_error) {
      return "unknown";
    }
  }

  function createRuntime(options) {
    const config = options && typeof options === "object" ? options : {};
    const fetchImpl =
      typeof config.fetchImpl === "function"
        ? config.fetchImpl
        : typeof fetch === "function"
          ? fetch.bind(globalThis)
          : null;
    const jobClient = config.jobClient || globalThis.ASREdgeAiJobClient || null;

    function getEndpoint() {
      try {
        return new URL(String(config.endpoint || DEFAULT_ENDPOINT)).toString();
      } catch (_error) {
        return DEFAULT_ENDPOINT;
      }
    }

    function buildHealthEndpoint(endpoint) {
      const text = normalizeText(endpoint);
      if (!text) {
        return "";
      }
      if (/\/health$/i.test(text)) {
        return text;
      }
      return text.replace(/\/+$/, "") + "/health";
    }

    function getPlatformUserMeta(item) {
      const source = item && typeof item === "object" ? item : {};
      return {
        platformUserName: normalizeText(source.platformUserName),
        platformUserId: normalizeText(source.platformUserId),
      };
    }

    function normalizeStagePrompt(value) {
      return String(value || "").replace(/\r\n/g, "\n").trim();
    }

    function normalizeStageParams(value) {
      const source = value && typeof value === "object" ? value : {};
      const result = {};
      [
        "temperature",
        "top_p",
        "max_tokens",
        "max_completion_tokens",
        "presence_penalty",
        "frequency_penalty",
        "seed",
      ].forEach(function (key) {
        if (source[key] !== undefined && source[key] !== null && source[key] !== "") {
          result[key] = source[key];
        }
      });
      if (Array.isArray(source.stop) && source.stop.length > 0) {
        result.stop = source.stop.slice();
      }
      return result;
    }

    function resolveAiStages() {
      if (config.aiStages && typeof config.aiStages === "object") {
        const convertStage = config.aiStages.convert && typeof config.aiStages.convert === "object" ? config.aiStages.convert : {};
        const listenStage = config.aiStages.listen && typeof config.aiStages.listen === "object" ? config.aiStages.listen : {};
        const compareStage = config.aiStages.compare && typeof config.aiStages.compare === "object" ? config.aiStages.compare : {};
        return {
          convert: {
            model: normalizeText(convertStage.model),
            prompt: normalizeStagePrompt(convertStage.prompt),
            params: normalizeStageParams(convertStage.params),
          },
          listen: {
            model: normalizeText(listenStage.model),
            prompt: normalizeStagePrompt(listenStage.prompt),
            params: normalizeStageParams(listenStage.params),
          },
          compare: {
            family: normalizeText(compareStage.family || config.compareFamily).toLowerCase() === "omni" ? "omni" : "qwen",
            model: normalizeText(compareStage.model),
            prompt: normalizeStagePrompt(compareStage.prompt),
            params: normalizeStageParams(compareStage.params),
            adoptionThreshold: compareStage.adoptionThreshold,
          },
        };
      }
      return {
        convert: {
          model: normalizeText(config.convertModel || config.aiOptions?.candidateModel),
          prompt: normalizeStagePrompt(config.aiOptions?.candidatePrompt),
          params: normalizeStageParams(config.aiOptions),
        },
        listen: {
          model: normalizeText(config.listenModel || config.singleModel),
          prompt: normalizeStagePrompt(config.aiOptions?.listenPrompt || config.aiOptions?.singlePrompt),
          params: normalizeStageParams(config.aiOptions),
        },
        compare: {
          family: normalizeText(config.compareFamily).toLowerCase() === "omni" ? "omni" : "qwen",
          model: normalizeText(config.compareModel || config.singleModel),
          prompt: normalizeStagePrompt(config.aiOptions?.comparePrompt),
          params: normalizeStageParams(config.aiOptions),
          adoptionThreshold: config.aiOptions?.audioFirstReferenceCorrectionThreshold,
        },
      };
    }

    function createRequestBody(item) {
      const source = item && typeof item === "object" ? item : {};
      const userMeta = getPlatformUserMeta(source);
      const aiStages = resolveAiStages();
      const requestMeta = buildAiUsageRequestMeta({
        settings: config.settings,
        platformUserName: userMeta.platformUserName,
        platformUserId: userMeta.platformUserId,
      });
      assertAiUsageOperatorConfigured(requestMeta);
      const requestBody = {
        taskId: normalizeText(source.taskId),
        packageId: normalizeText(source.packageId),
        taskItemId: normalizeText(source.taskItemId),
        fileName: normalizeText(source.fileName),
        audioUrl: normalizeText(source.audioUrl),
        referenceText: normalizeText(source.referenceText),
        existingMarkText: normalizeText(source.existingMarkText || source.currentInputText),
        duration: source.duration,
        itemNumber: source.number,
        clientVersion: getClientVersion(),
        batchRunId: normalizeText(source.batchRunId),
        batchItemIndex: source.batchItemIndex,
        batchProcessKey: normalizeText(source.batchProcessKey),
        clientRequestId: normalizeText(source.clientRequestId),
        frontConcurrency: source.frontConcurrency,
        aiUsageOperatorName: requestMeta.aiUsageOperatorName,
        platformUserName: requestMeta.platformUserName,
        platformUserId: requestMeta.platformUserId,
      };
      requestBody.enableThinking = false;
      requestBody.aiStages = {
        convert: {
          model: aiStages.convert.model,
          prompt: aiStages.convert.prompt,
          params: aiStages.convert.params,
        },
        listen: {
          model: aiStages.listen.model,
          prompt: aiStages.listen.prompt,
          params: aiStages.listen.params,
        },
        compare: {
          family: aiStages.compare.family,
          model: aiStages.compare.model,
          prompt: aiStages.compare.prompt,
          params: aiStages.compare.params,
          adoptionThreshold: aiStages.compare.adoptionThreshold,
        },
      };
      return requestBody;
    }

    async function sendRequest(endpoint, requestBody, timeoutMs, signal) {
      if (jobClient && typeof jobClient.runJobLifecycle === "function") {
        const jobResult = await jobClient.runJobLifecycle({
          endpoint: endpoint,
          body: requestBody,
          timeoutMs: timeoutMs,
          signal: signal || undefined,
          fetchImpl: fetchImpl,
          pollIntervalMs: Math.max(200, Number(config.jobPollIntervalMs) || 800),
          buildApiError: function (responseBody, statusCode) { return buildApiError(responseBody, statusCode); },
          buildTerminalError: function (jobBody) {
            const errorBody = jobBody?.error && typeof jobBody.error === "object" ? jobBody.error : jobBody;
            const providerStatus = Number(errorBody?.error?.providerStatus || errorBody?.providerStatus || 500) || 500;
            return buildApiError(errorBody, providerStatus);
          },
          mapSuccess: function (jobBody) {
            const payload = jobBody?.data && typeof jobBody.data === "object" ? jobBody.data : {};
            return Object.assign({}, payload.data || {}, { meta: payload.meta && typeof payload.meta === "object" ? payload.meta : {} });
          },
        });
        return jobResult.data;
      }
      if (typeof fetchImpl !== "function") {
        throw createClientError("当前环境不支持 fetch，无法调用 AI 推荐接口。", {
          code: "fetch-unavailable",
        });
      }
      const controller = typeof AbortController === "function" ? new AbortController() : null;
      const onAbort = function () {
        if (controller) {
          controller.abort();
        }
      };
      if (signal?.aborted) {
        onAbort();
      } else if (signal && typeof signal.addEventListener === "function") {
        signal.addEventListener("abort", onAbort, { once: true });
      }
      const timer = controller
        ? globalThis.setTimeout(function () {
            controller.abort();
          }, timeoutMs)
        : null;

      try {
        const response = await fetchImpl(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
          signal: controller ? controller.signal : signal || undefined,
        });
        const responseBody = await response.json().catch(function () {
          return null;
        });
        if (!response.ok || responseBody?.success !== true || !responseBody?.data) {
          throw buildApiError(responseBody, response.status);
        }
        return Object.assign({}, responseBody.data || {}, {
          meta: responseBody.meta && typeof responseBody.meta === "object" ? responseBody.meta : {},
        });
      } finally {
        if (timer) {
          clearTimeout(timer);
        }
        if (signal && typeof signal.removeEventListener === "function") {
          signal.removeEventListener("abort", onAbort);
        }
      }
    }

    async function probeHealthEndpoint(endpoint, timeoutMs) {
      const healthEndpoint = buildHealthEndpoint(endpoint);
      if (!healthEndpoint || typeof fetchImpl !== "function") {
        return {
          ok: false,
          endpoint: healthEndpoint,
          reason: "health-probe-unavailable",
        };
      }

      const controller = typeof AbortController === "function" ? new AbortController() : null;
      const timer = controller
        ? globalThis.setTimeout(function () {
            controller.abort();
          }, Math.max(1000, Math.min(Number(timeoutMs) || 8000, 8000)))
        : null;

      try {
        const response = await fetchImpl(healthEndpoint, {
          method: "GET",
          signal: controller ? controller.signal : undefined,
        });
        let body = null;
        try {
          body = await response.json();
        } catch (_error) {
          body = null;
        }
        return {
          ok: response.ok && body?.success === true,
          endpoint: healthEndpoint,
          statusCode: Number(response.status) || 0,
          body: body,
        };
      } catch (error) {
        return {
          ok: false,
          endpoint: healthEndpoint,
          errorName: normalizeText(error?.name),
          errorMessage: normalizeText(error?.message || error),
        };
      } finally {
        if (timer) {
          clearTimeout(timer);
        }
      }
    }

    async function recommend(item, requestOptions) {
      const source = item && typeof item === "object" ? item : {};
      const signal = requestOptions?.signal || null;
      if (!source.taskId) {
        throw new Error("缺少 taskId，无法调用 AI 推荐。");
      }
      if (!source.packageId) {
        throw new Error("缺少 packageId，无法调用 AI 推荐。");
      }
      if (!source.taskItemId) {
        throw new Error("缺少 taskItemId，请重新点击条目后再试。");
      }
      if (!source.audioUrl) {
        throw new Error("缺少当前条音频地址，请重新点击当前条后再试。");
      }
      const timeoutMs = Math.max(1000, Number(config.timeoutMs) || DEFAULT_TIMEOUT_MS);
      const requestBody = createRequestBody(source);
      const endpoint = getEndpoint();
      const backendMode = getBackendModeFromSettings(config.settings || {}, endpoint);

      try {
        const result = await sendRequest(endpoint, requestBody, timeoutMs, signal);
        return attachClientDebug(result, {
          backendMode: backendMode,
          endpoint: endpoint,
          fallbackUsed: false,
        });
      } catch (error) {
        if (signal?.aborted || error?.code === "user-aborted") {
          throw createClientError("已停止自动流程。", { code: "user-aborted" });
        }
        if (error?.name === "AbortError") {
          throw createClientError("AI 推荐接口请求超时。", { code: "timeout" });
        }
        if (isExtensionContextInvalidatedError(error)) {
          throw createDetailedClientError(
            "扩展上下文已失效，请刷新当前业务页面后重试。",
            "extension-context-invalidated",
            createNetworkErrorMeta({
              backendMode: backendMode,
              endpoint: endpoint,
              error,
            })
          );
        }
        if (error instanceof TypeError) {
          const healthCheck = await probeHealthEndpoint(endpoint, timeoutMs);
          throw createDetailedClientError(
            healthCheck.ok === true
              ? "当前模式后端 health 可达，但 AI recommend 请求在网络层被中断。请检查当前环境的 Nginx、PM2 和后端日志。"
              : "后端连接中断，请稍后重试。",
            "network-disconnected",
            Object.assign(createNetworkErrorMeta({
              backendMode: backendMode,
              endpoint: endpoint,
              error,
            }), {
              healthCheck: healthCheck,
            })
          );
        }
        throw error;
      }
    }

    return {
      recommend,
    };
  }

  const api = {
    DEFAULT_ENDPOINT,
    DEFAULT_TIMEOUT_MS,
    createRuntime,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalThis.__ASREdgeAishellTechCantoneseAiRecommendation = api;
})();

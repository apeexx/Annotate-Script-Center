(function () {
  "use strict";

  const RECOMMEND_PATH = "/api/jd-tts-annotation/shanghainese-helper/ai/recommend";
  const DEFAULT_TIMEOUT_MS = 60000;
  const aiUsageMeta = globalThis.ASREdgeAiUsageMeta || {};

  function normalizeText(value) { return String(value || "").trim(); }

  function createError(message, details) {
    const error = new Error(normalizeText(message) || "AI 请求失败。");
    Object.assign(error, details || {});
    return error;
  }

  function createClientRequestId() {
    if (globalThis.crypto?.randomUUID) { return globalThis.crypto.randomUUID(); }
    return "jdtts-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  function getClientVersion() {
    try { return String(chrome?.runtime?.getManifest?.().version || "unknown"); } catch (_error) { return "unknown"; }
  }

  function normalizeAiOmni(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      model: normalizeText(source.model),
      prompt: typeof source.prompt === "string" ? source.prompt.trim() : "",
      params: source.params && typeof source.params === "object" ? source.params : {},
    };
  }

  function normalizeOptionalNumber(value, min, max) {
    if (value === undefined || value === null || value === "") { return undefined; }
    const number = Number(value);
    return Number.isFinite(number) && number >= min && number <= max ? number : undefined;
  }

  function normalizeOptionalInteger(value, min, max) {
    if (value === undefined || value === null || value === "") { return undefined; }
    const number = Math.floor(Number(value));
    return Number.isFinite(number) && number >= min && number <= max ? number : undefined;
  }

  function normalizeStopSequences(value) {
    const values = Array.isArray(value) ? value : typeof value === "string" ? value.split(/\r?\n/) : [];
    return values.reduce(function (result, item) {
      const text = String(item || "").trim().slice(0, 80);
      if (text && result.indexOf(text) < 0 && result.length < 8) { result.push(text); }
      return result;
    }, []);
  }

  function buildFlatParams(source) {
    const params = {};
    const definitions = [
      ["Temperature", "temperature", normalizeOptionalNumber, 0, 2],
      ["TopP", "top_p", normalizeOptionalNumber, 0, 1],
      ["MaxTokens", "max_tokens", normalizeOptionalInteger, 1, 8192],
      ["MaxCompletionTokens", "max_completion_tokens", normalizeOptionalInteger, 1, 8192],
      ["PresencePenalty", "presence_penalty", normalizeOptionalNumber, -2, 2],
      ["FrequencyPenalty", "frequency_penalty", normalizeOptionalNumber, -2, 2],
      ["Seed", "seed", normalizeOptionalInteger, 0, 2147483647],
    ];
    definitions.forEach(function (definition) {
      const value = definition[2](source["aiRecommend" + definition[0]], definition[3], definition[4]);
      if (value !== undefined) { params[definition[1]] = value; }
    });
    const stop = normalizeStopSequences(source.aiRecommendStopSequences);
    if (stop.length > 0) { params.stop = stop; }
    return params;
  }

  function buildSafeMeta(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      aiUsageOperatorName: normalizeText(source.aiUsageOperatorName).slice(0, 40),
      platformUserName: normalizeText(source.platformUserName).slice(0, 80),
      platformUserId: normalizeText(source.platformUserId).slice(0, 120),
    };
  }

  function createMissingUsageOperatorError() {
    if (typeof aiUsageMeta.createMissingAiUsageOperatorError === "function") {
      return aiUsageMeta.createMissingAiUsageOperatorError();
    }
    return createError("请先在 options 首页填写 AI 调用使用人。", { code: "missing-ai-usage-operator-name" });
  }

  function buildUsageMeta(settings, fallback) {
    const source = fallback && typeof fallback === "object" ? fallback : {};
    const built = typeof aiUsageMeta.buildAiUsageRequestMeta === "function"
      ? aiUsageMeta.buildAiUsageRequestMeta({ settings, platformUserName: source.platformUserName, platformUserId: source.platformUserId })
      : {};
    return buildSafeMeta({
      aiUsageOperatorName: built.aiUsageOperatorName || source.aiUsageOperatorName,
      platformUserName: built.platformUserName || source.platformUserName,
      platformUserId: built.platformUserId || source.platformUserId,
    });
  }

  function assertUsageMeta(requestMeta) {
    try {
      if (typeof aiUsageMeta.assertAiUsageOperatorConfigured === "function") {
        aiUsageMeta.assertAiUsageOperatorConfigured(requestMeta);
      } else if (!normalizeText(requestMeta?.aiUsageOperatorName)) {
        throw createMissingUsageOperatorError();
      }
    } catch (error) {
      error.stage = error.stage || "validate";
      throw error;
    }
    return requestMeta;
  }

  function buildRequestBody(snapshot, config) {
    const source = snapshot && typeof snapshot === "object" ? snapshot : {};
    const requestMeta = buildSafeMeta(config?.requestMeta);
    return {
      utteranceId: normalizeText(source.utteranceId),
      checksum: normalizeText(source.checksum),
      audioDataUrl: normalizeText(source.audioDataUrl),
      aiOmni: normalizeAiOmni(config?.aiOmni),
      clientRequestId: createClientRequestId(),
      clientVersion: getClientVersion(),
      aiUsageOperatorName: requestMeta.aiUsageOperatorName,
      platformUserName: requestMeta.platformUserName,
      platformUserId: requestMeta.platformUserId,
    };
  }

  function buildApiError(body, statusCode, phase) {
    const errorBody = body?.error && typeof body.error === "object" ? body.error : body || {};
    return createError(normalizeText(errorBody.message) || "AI 服务不可用。", {
      code: normalizeText(errorBody.code) || "request-error",
      statusCode: Number(statusCode) || 0,
      phase: normalizeText(phase) || normalizeText(errorBody.stage) || "request",
      requestId: normalizeText(body?.meta?.requestId || body?.requestId),
      rawResponse: errorBody,
    });
  }

  function sanitizeMeta(value) {
    const source = value && typeof value === "object" ? value : {};
    const result = {};
    Object.keys(source).forEach(function (key) {
      if (!/(?:jobid|audio|url|cookie|authorization|token|secret|signature)/i.test(key)) { result[key] = source[key]; }
    });
    return result;
  }

  function mapSuccess(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      utteranceId: normalizeText(source.utteranceId),
      checksum: normalizeText(source.checksum),
      listenText: typeof source.listenText === "string" ? source.listenText : "",
      needHumanReview: source.needHumanReview === true,
      meta: sanitizeMeta(source.meta),
    };
  }

  function getBackendMode(settings) {
    return normalizeText(settings?.meta?.backendEndpointMode).toLowerCase() === "local" ? "local" : "server";
  }

  function resolveEndpointForMode(constants, settings, mode) {
    const endpointSettings = Object.assign({}, settings || {}, {
      meta: Object.assign({}, settings?.meta || {}, { backendEndpointMode: mode }),
    });
    if (typeof constants?.buildBackendUrl === "function") {
      const endpoint = normalizeText(constants.buildBackendUrl(RECOMMEND_PATH, endpointSettings));
      if (/^https?:\/\//i.test(endpoint)) { return endpoint; }
    }
    const baseUrl = normalizeText(constants?.DEFAULT_BACKEND_BASE_URLS?.[mode]);
    if (/^https?:\/\//i.test(baseUrl)) { return baseUrl.replace(/\/+$/, "") + RECOMMEND_PATH; }
    throw createError("未配置统一后端地址。", { code: "backend-endpoint-unavailable" });
  }

  function resolveEndpoint(constants, settings, configuredEndpoint) {
    const explicit = normalizeText(configuredEndpoint);
    if (/^https?:\/\//i.test(explicit)) { return explicit; }
    return resolveEndpointForMode(constants, settings, getBackendMode(settings));
  }

  function getSavedAiOmni(settings, fallback) {
    const saved = settings?.platforms?.jdTtsAnnotation?.scripts?.shanghaineseHelper?.aiOmni;
    const script = settings?.platforms?.jdTtsAnnotation?.scripts?.shanghaineseHelper || {};
    if (Object.prototype.hasOwnProperty.call(script, "aiRecommendSingleModel") || Object.prototype.hasOwnProperty.call(script, "aiRecommendSinglePrompt")) {
      return {
        model: normalizeText(script.aiRecommendSingleModel),
        prompt: typeof script.aiRecommendSinglePrompt === "string" ? script.aiRecommendSinglePrompt.trim() : "",
        params: buildFlatParams(script),
      };
    }
    return normalizeAiOmni(saved && typeof saved === "object" ? saved : fallback);
  }

  function buildHealthEndpoint(endpoint) { return normalizeText(endpoint).replace(/\/+$/, "") + "/health"; }

  function isNetworkError(error) {
    return error?.name === "TypeError" || error?.code === "network-error" || /network|failed to fetch/i.test(String(error?.message || error));
  }

  function createRuntime(options) {
    const config = options && typeof options === "object" ? options : {};
    const jobClient = config.jobClient || globalThis.ASREdgeAiJobClient;
    const fetchImpl = config.fetchImpl || (typeof fetch === "function" ? fetch.bind(globalThis) : null);
    const constants = config.constants || globalThis.ASREdgeConstants || {};
    const getSettings = typeof config.getSettings === "function"
      ? config.getSettings
      : typeof globalThis.ASREdgeStorage?.getSettings === "function"
        ? globalThis.ASREdgeStorage.getSettings
        : async function () { return {}; };

    async function prepareRun() {
      const settings = await getSettings();
      const requestMeta = assertUsageMeta(buildUsageMeta(settings, config.requestMeta));
      const endpoint = resolveEndpoint(constants, settings, config.endpoint);
      const fallbackMode = getBackendMode(settings) === "local" ? "server" : "local";
      let fallbackEndpoint = "";
      try { fallbackEndpoint = resolveEndpointForMode(constants, settings, fallbackMode); } catch (_error) { fallbackEndpoint = ""; }
      return { settings, requestMeta, aiOmni: getSavedAiOmni(settings, config.aiOmni), endpoint, fallbackEndpoint };
    }

    async function run(endpoint, body, signal, onStage) {
      if (!jobClient || typeof jobClient.runJobLifecycle !== "function") {
        throw createError("当前环境不支持 AI jobs 客户端。", { code: "jobs-client-unavailable" });
      }
      const result = await jobClient.runJobLifecycle({
        endpoint,
        body,
        fetchImpl,
        signal: signal || undefined,
        timeoutMs: DEFAULT_TIMEOUT_MS,
        pollIntervalMs: 800,
        onPhase: function (phase) {
          if (normalizeText(phase).toLowerCase() === "poll") {
            onStage?.({ key: "poll", label: "等待识别结果" });
          }
        },
        buildApiError,
        buildTerminalError: function (jobBody) { return buildApiError(jobBody?.error || jobBody, 500); },
        mapSuccess: function (jobBody) {
          const payload = jobBody?.data && typeof jobBody.data === "object" ? jobBody.data : {};
          return Object.assign({}, payload, { meta: jobBody?.meta && typeof jobBody.meta === "object" ? jobBody.meta : {} });
        },
      });
      return mapSuccess(result?.data);
    }

    async function probeHealth(endpoint, signal) {
      const healthEndpoint = buildHealthEndpoint(endpoint);
      if (!healthEndpoint || typeof fetchImpl !== "function") { return { ok: false, endpoint: healthEndpoint, reason: "health-probe-unavailable" }; }
      const controller = typeof AbortController === "function" ? new AbortController() : null;
      const abort = function () { controller?.abort?.(); };
      if (signal?.aborted) { abort(); } else { signal?.addEventListener?.("abort", abort, { once: true }); }
      const timer = controller ? globalThis.setTimeout(abort, 8000) : null;
      try {
        const response = await fetchImpl(healthEndpoint, { method: "GET", signal: controller ? controller.signal : signal || undefined });
        const body = await response.json().catch(function () { return null; });
        return { ok: response.ok === true && body?.success === true, endpoint: healthEndpoint, statusCode: Number(response.status) || 0 };
      } catch (error) {
        return { ok: false, endpoint: healthEndpoint, errorName: normalizeText(error?.name) };
      } finally {
        if (timer) { globalThis.clearTimeout(timer); }
        signal?.removeEventListener?.("abort", abort);
      }
    }

    function createNetworkError(primaryEndpoint, fallbackEndpoint, healthCheck) {
      return createError("后端连接中断，请稍后重试。", {
        code: "network-disconnected",
        rawResponse: {
          type: "client-network-error",
          endpoint: primaryEndpoint,
          fallbackEndpoint,
          fallbackAttempted: Boolean(fallbackEndpoint),
          healthCheck: { ok: healthCheck?.ok === true, statusCode: Number(healthCheck?.statusCode) || 0 },
        },
      });
    }

    async function selectEndpointBeforeJob(primaryEndpoint, fallbackEndpoint, signal) {
      const primaryHealth = await probeHealth(primaryEndpoint, signal);
      if (signal?.aborted || primaryHealth.ok === true || primaryHealth.reason === "health-probe-unavailable" || !fallbackEndpoint || fallbackEndpoint === primaryEndpoint) {
        return { endpoint: primaryEndpoint, primaryHealth, fallbackSelected: false };
      }
      const fallbackHealth = await probeHealth(fallbackEndpoint, signal);
      if (fallbackHealth.ok === true) {
        return { endpoint: fallbackEndpoint, primaryHealth, fallbackSelected: true };
      }
      return { endpoint: primaryEndpoint, primaryHealth, fallbackSelected: false };
    }

    async function recommend(snapshot, requestOptions) {
      const prepared = requestOptions?.preparedRun || await prepareRun();
      const endpoint = prepared.endpoint;
      const fallbackEndpoint = prepared.fallbackEndpoint;
      const requestMeta = prepared.requestMeta;
      const body = buildRequestBody(snapshot, { aiOmni: prepared.aiOmni, requestMeta });
      const signal = requestOptions?.signal;
      requestOptions?.onStage?.({ key: "health", label: "后端健康检查" });
      const selection = await selectEndpointBeforeJob(endpoint, fallbackEndpoint, signal);
      if (signal?.aborted) { throw createError("请求已取消。", { code: "user-aborted" }); }
      requestOptions?.onStage?.({ key: "create", label: "创建识别任务" });
      try {
        return await run(selection.endpoint, body, signal, requestOptions?.onStage);
      } catch (error) {
        if (signal?.aborted || error?.name === "AbortError" || !isNetworkError(error)) { throw error; }
        throw createNetworkError(endpoint, selection.fallbackSelected ? selection.endpoint : "", selection.primaryHealth);
      }
    }

    return { prepareRun, recommend, probeHealth: function (endpoint, signal) { return probeHealth(endpoint, signal); }, buildRequestBody: function (snapshot) { return buildRequestBody(snapshot, config); } };
  }

  const api = { createRuntime, mapSuccess, buildRequestBody, resolveEndpoint };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; }
  globalThis.ASREdgeJdTtsShanghaiAiRecommendation = api;
})();

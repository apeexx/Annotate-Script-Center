(function () {
  "use strict";

  const RECOMMEND_PATH = "/api/jd-tts-annotation/shanghainese-helper/ai/recommend";
  const DEFAULT_TIMEOUT_MS = 60000;

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

  function buildSafeMeta(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      aiUsageOperatorName: normalizeText(source.aiUsageOperatorName).slice(0, 40),
      platformUserName: normalizeText(source.platformUserName).slice(0, 80),
      platformUserId: normalizeText(source.platformUserId).slice(0, 120),
    };
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

  function buildApiError(body, statusCode) {
    const errorBody = body?.error && typeof body.error === "object" ? body.error : body || {};
    return createError(normalizeText(errorBody.message) || "AI 服务不可用。", {
      code: normalizeText(errorBody.code) || "request-error",
      statusCode: Number(statusCode) || 0,
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

  function resolveEndpoint(constants, settings, configuredEndpoint) {
    const explicit = normalizeText(configuredEndpoint);
    if (/^https?:\/\//i.test(explicit)) { return explicit; }
    if (typeof constants?.buildBackendUrl === "function") {
      const endpoint = normalizeText(constants.buildBackendUrl(RECOMMEND_PATH, settings || {}));
      if (/^https?:\/\//i.test(endpoint)) { return endpoint; }
    }
    const mode = normalizeText(settings?.meta?.backendEndpointMode).toLowerCase() === "local" ? "local" : "server";
    const baseUrl = normalizeText(constants?.DEFAULT_BACKEND_BASE_URLS?.[mode]);
    if (/^https?:\/\//i.test(baseUrl)) { return baseUrl.replace(/\/+$/, "") + RECOMMEND_PATH; }
    throw createError("未配置统一后端地址。", { code: "backend-endpoint-unavailable" });
  }

  function getSavedAiOmni(settings, fallback) {
    const saved = settings?.platforms?.jdTtsAnnotation?.scripts?.shanghaineseHelper?.aiOmni;
    return normalizeAiOmni(saved && typeof saved === "object" ? saved : fallback);
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

    async function run(endpoint, body, signal) {
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
        buildApiError,
        buildTerminalError: function (jobBody) { return buildApiError(jobBody?.error || jobBody, 500); },
        mapSuccess: function (jobBody) {
          const payload = jobBody?.data && typeof jobBody.data === "object" ? jobBody.data : {};
          return Object.assign({}, payload, { meta: jobBody?.meta && typeof jobBody.meta === "object" ? jobBody.meta : {} });
        },
      });
      return mapSuccess(result?.data);
    }

    async function recommend(snapshot, requestOptions) {
      const settings = await getSettings();
      const endpoint = resolveEndpoint(constants, settings, config.endpoint);
      const requestMeta = Object.assign({}, config.requestMeta || {}, {
        aiUsageOperatorName: normalizeText(settings?.meta?.aiUsageOperatorName) || config?.requestMeta?.aiUsageOperatorName,
      });
      const body = buildRequestBody(snapshot, { aiOmni: getSavedAiOmni(settings, config.aiOmni), requestMeta });
      return run(endpoint, body, requestOptions?.signal);
    }

    return { recommend, buildRequestBody: function (snapshot) { return buildRequestBody(snapshot, config); } };
  }

  const api = { createRuntime, mapSuccess, buildRequestBody, resolveEndpoint };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; }
  globalThis.ASREdgeJdTtsShanghaiAiRecommendation = api;
})();

(function () {
  "use strict";

  const DEFAULT_ENDPOINT = "/api/jd-tts-annotation/shanghainese-helper/ai/recommend";
  const DEFAULT_TIMEOUT_MS = 60000;

  function normalizeText(value) { return String(value || "").trim(); }

  function createError(message, details) {
    const error = new Error(normalizeText(message) || "上海话识别请求失败。");
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
    const requestMeta = buildSafeMeta(config.requestMeta);
    return {
      utteranceId: normalizeText(source.utteranceId),
      checksum: normalizeText(source.checksum),
      audioDataUrl: normalizeText(source.audioDataUrl),
      aiOmni: config.aiOmni && typeof config.aiOmni === "object" ? config.aiOmni : {},
      clientRequestId: createClientRequestId(),
      clientVersion: getClientVersion(),
      aiUsageOperatorName: requestMeta.aiUsageOperatorName,
      platformUserName: requestMeta.platformUserName,
      platformUserId: requestMeta.platformUserId,
    };
  }

  function buildApiError(body, statusCode) {
    const errorBody = body?.error && typeof body.error === "object" ? body.error : body || {};
    return createError(normalizeText(errorBody.message) || "上海话识别服务不可用。", {
      code: normalizeText(errorBody.code) || "request-error",
      statusCode: Number(statusCode) || 0,
    });
  }

  function sanitizeMeta(value) {
    const source = value && typeof value === "object" ? value : {};
    const result = {};
    Object.keys(source).forEach(function (key) {
      if (!/(?:jobid|audio|url|cookie|authorization|token|secret|signature)/i.test(key)) {
        result[key] = source[key];
      }
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

  function isNetworkError(error) {
    return error?.name === "TypeError" || error?.code === "network-error" || /network|failed to fetch/i.test(String(error?.message || error));
  }

  function createRuntime(options) {
    const config = options && typeof options === "object" ? options : {};
    const jobClient = config.jobClient || globalThis.ASREdgeAiJobClient;
    const fetchImpl = config.fetchImpl || (typeof fetch === "function" ? fetch.bind(globalThis) : null);
    const endpoint = normalizeText(config.endpoint) || DEFAULT_ENDPOINT;
    const fallbackEndpoint = normalizeText(config.fallbackEndpoint);

    async function probeHealth(target, signal) {
      if (typeof fetchImpl !== "function") { return false; }
      try {
        const response = await fetchImpl(target.replace(/\/+$/, "") + "/health", { method: "GET", signal: signal });
        return response.ok === true;
      } catch (_error) { return false; }
    }

    async function run(target, body, signal) {
      if (!jobClient || typeof jobClient.runJobLifecycle !== "function") {
        throw createError("当前环境不支持 AI jobs 客户端。", { code: "jobs-client-unavailable" });
      }
      const result = await jobClient.runJobLifecycle({
        endpoint: target,
        body: body,
        fetchImpl: fetchImpl,
        signal: signal || undefined,
        timeoutMs: DEFAULT_TIMEOUT_MS,
        pollIntervalMs: 800,
        buildApiError: buildApiError,
        buildTerminalError: function (jobBody) { return buildApiError(jobBody?.error || jobBody, 500); },
        mapSuccess: function (jobBody) {
          const payload = jobBody?.data && typeof jobBody.data === "object" ? jobBody.data : {};
          return Object.assign({}, payload, { meta: jobBody?.meta && typeof jobBody.meta === "object" ? jobBody.meta : {} });
        },
      });
      return mapSuccess(result?.data);
    }

    async function recommend(snapshot, requestOptions) {
      const signal = requestOptions?.signal;
      const body = buildRequestBody(snapshot, config);
      try {
        return await run(endpoint, body, signal);
      } catch (error) {
        if (!fallbackEndpoint || fallbackEndpoint === endpoint || !isNetworkError(error) || signal?.aborted) { throw error; }
        await probeHealth(endpoint, signal);
        return run(fallbackEndpoint, body, signal);
      }
    }

    return { recommend, probeHealth: function (signal) { return probeHealth(endpoint, signal); }, buildRequestBody: function (snapshot) { return buildRequestBody(snapshot, config); } };
  }

  const api = { createRuntime, mapSuccess, buildRequestBody };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; }
  globalThis.ASREdgeJdTtsShanghaiAiRecommendation = api;
})();

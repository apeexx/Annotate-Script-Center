(function () {
  const API_PATH = "/api/magic-data/minnan-helper/ai/review-current";
  const DEFAULT_TIMEOUT_MS = 60000;
  const constants = globalThis.ASREdgeConstants || {};
  const DEFAULT_LOCAL_BASE_URL = constants.DEFAULT_BACKEND_BASE_URLS?.local || "";
  const DEFAULT_SERVER_BASE_URL = constants.DEFAULT_BACKEND_BASE_URLS?.server || "";
  const jobClient = globalThis.ASREdgeAiJobClient || null;
  const aiUsageMeta = globalThis.ASREdgeAiUsageMeta || {};
  const buildAiUsageRequestMeta =
    typeof aiUsageMeta.buildAiUsageRequestMeta === "function"
      ? aiUsageMeta.buildAiUsageRequestMeta
      : function (input) {
          const source = input && typeof input === "object" ? input : {};
          return {
            aiUsageOperatorName: String(source.settings?.meta?.aiUsageOperatorName || "").replace(/\s+/g, " ").trim().slice(0, 40),
            platformUserName: String(source.platformUserName || "").replace(/\s+/g, " ").trim().slice(0, 80),
            platformUserId: String(source.platformUserId || "").replace(/\s+/g, " ").trim().slice(0, 120),
          };
        };
  const appendAiUsageRequestMeta =
    typeof aiUsageMeta.appendAiUsageRequestMeta === "function"
      ? aiUsageMeta.appendAiUsageRequestMeta
      : function (payload, requestMeta) {
          return Object.assign({}, payload || {}, {
            aiUsageOperatorName: String(requestMeta?.aiUsageOperatorName || "").replace(/\s+/g, " ").trim().slice(0, 40),
            platformUserName: String(requestMeta?.platformUserName || "").replace(/\s+/g, " ").trim().slice(0, 80),
            platformUserId: String(requestMeta?.platformUserId || "").replace(/\s+/g, " ").trim().slice(0, 120),
          });
        };
  const assertAiUsageOperatorConfigured =
    typeof aiUsageMeta.assertAiUsageOperatorConfigured === "function"
      ? aiUsageMeta.assertAiUsageOperatorConfigured
      : function (requestMeta) {
          if (!String(requestMeta?.aiUsageOperatorName || "").replace(/\s+/g, " ").trim()) {
            const error = new Error("请先在 options 首页填写 AI 调用使用人。");
            error.code = "missing-ai-usage-operator-name";
            throw error;
          }
          return requestMeta;
        };

  function sanitizeMessage(value, maxLength) {
    return String(value || "")
      .replace(/https?:\/\/[^\s"'\\]+/g, "[url-redacted]")
      .replace(/(ossaccesskeyid|signature|token|authorization|cookie|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi, "$1=[redacted]")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxLength || 240);
  }

  function getClientVersion() {
    try {
      const manifest = chrome?.runtime?.getManifest ? chrome.runtime.getManifest() : null;
      return String(manifest?.version || "0.3.0");
    } catch (error) {
      return "0.3.0";
    }
  }

  function normalizeBaseUrl(value, fallback) {
    try {
      const url = new URL(String(value || "").trim());
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return fallback;
      }
      return url.origin;
    } catch (error) {
      return fallback;
    }
  }

  async function resolveBackendConfig() {
    const storage = globalThis.ASREdgeStorage || {};
    let settings = null;
    try {
      if (typeof storage.getSettings === "function") {
        settings = await storage.getSettings();
      }
    } catch (error) {
      settings = null;
    }

    const localMode = constants.BACKEND_ENDPOINT_MODE_LOCAL || "local";
    const serverMode = constants.BACKEND_ENDPOINT_MODE_SERVER || "server";
    const mode = typeof constants.getBackendEndpointModeFromSettings === "function"
      ? constants.getBackendEndpointModeFromSettings(settings || {})
      : String(settings?.meta?.backendEndpointMode || "").trim().toLowerCase() === localMode
        ? localMode
        : serverMode;

    const baseUrl =
      typeof constants.getBackendBaseUrlByMode === "function"
        ? constants.getBackendBaseUrlByMode(mode, settings || {})
        : mode === localMode
          ? DEFAULT_LOCAL_BASE_URL
        : DEFAULT_SERVER_BASE_URL;
    const normalizedBaseUrl = normalizeBaseUrl(
      baseUrl,
      mode === localMode
        ? DEFAULT_LOCAL_BASE_URL
        : DEFAULT_SERVER_BASE_URL
    );
    const endpoint =
      typeof constants.buildBackendUrl === "function"
        ? constants.buildBackendUrl(API_PATH, mode)
        : normalizedBaseUrl.replace(/\/+$/, "") + API_PATH;

    return {
      mode,
      baseUrl: normalizedBaseUrl,
      endpoint,
      settings,
    };
  }

  function buildHealthEndpoint(endpoint) {
    const text = String(endpoint || "").trim();
    if (!text) {
      return "";
    }
    return /\/health$/i.test(text) ? text : text.replace(/\/+$/, "") + "/health";
  }

  function readLexiconWarning(body) {
    const source = body && typeof body === "object" ? body : {};
    const lexicon = source.lexicon && typeof source.lexicon === "object" ? source.lexicon : {};
    if (String(lexicon.status || "").trim() !== "reference_only") {
      return "";
    }
    return String(lexicon.warningMessage || lexicon.message || "").trim();
  }

  let lexiconWarningChecked = false;

  async function notifyLexiconWarning() {
    if (lexiconWarningChecked) {
      return false;
    }
    lexiconWarningChecked = true;
    const backend = await resolveBackendConfig();
    const healthEndpoint = buildHealthEndpoint(backend.endpoint);
    if (!healthEndpoint) {
      return false;
    }
    try {
      const response = await fetch(healthEndpoint, {
        method: "GET",
      });
      const body = await response.json().catch(function () {
        return null;
      });
      const warningMessage = readLexiconWarning(body);
      if (!warningMessage) {
        return false;
      }
      return globalThis.ASREdgeLexiconToast?.show?.(warningMessage, "warn", 1000) === true;
    } catch (_error) {
      return false;
    }
  }

  function resolvePlatformUserId() {
    const detector = globalThis.__ASREdgeMagicDataAnnotatorPageDetector || {};
    if (typeof detector.parseHashParams !== "function") {
      return "";
    }
    const params = detector.parseHashParams() || {};
    return String(params.userId || "").replace(/\s+/g, " ").trim().slice(0, 120);
  }

function mapErrorMessage(code, message, summary, statusCode) {
  const mappedCode = String(code || "").trim();
  if (mappedCode === "request-error" && Number(statusCode) === 404) {
    return "Magic Data 闽南语助手后端接口不存在，请确认已启动 node platform-resources\\backend\\server.js。";
  }
  if (mappedCode === "missing-api-key") {
    return "后端未读取到 DASHSCOPE_API_KEY，请检查 config/env/ai.env 或环境变量。";
  }
    if (mappedCode === "empty-provider-response") {
      return "Qwen 未返回有效文本，可能是音频 URL 过期或模型无法访问该音频，请刷新页面后重试。";
    }
    if (mappedCode === "invalid-audio-url") {
      return "未获取到音频 URL，请先播放一次音频后再点击 AI 复核。";
    }
    if (mappedCode === "fun-asr-auth-error" || mappedCode === "fun-asr-forbidden") {
      return "Fun-ASR 调用被拒绝，请检查 DashScope 权限、地域或 API Key，并确认音频 URL 对模型服务可访问。";
    }
    if (mappedCode === "fun-asr-audio-url-unreachable") {
      return "Fun-ASR 无法访问当前音频 URL，请刷新任务后重试，或切换到 Qwen Omni 听音。";
    }
    if (mappedCode === "fun-asr-rate-limited") {
      return "Fun-ASR 上游限流，请稍后重试或切换到 Qwen Omni 听音。";
    }
    if (mappedCode) {
      const detail = sanitizeMessage(message || "", 180);
      const extra = sanitizeMessage(summary || "", 120);
      return mappedCode + (detail ? "：" + detail : "") + (extra ? "（" + extra + "）" : "");
    }
    return sanitizeMessage(message || "AI 复核调用失败。", 220);
  }

  async function reviewCurrent(payload, options) {
    const config = options && typeof options === "object" ? options : {};
    const backend = await resolveBackendConfig();
    const timeoutMs = Math.max(1000, Number(config.timeoutMs) || DEFAULT_TIMEOUT_MS);
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timer = controller
      ? setTimeout(function () {
          controller.abort();
        }, timeoutMs)
      : null;

    const requestMeta = assertAiUsageOperatorConfigured(
      buildAiUsageRequestMeta({
        settings: config.settings || backend.settings || {},
        platformUserName: "",
        platformUserId: resolvePlatformUserId(),
      })
    );
    const requestBody = appendAiUsageRequestMeta(Object.assign({}, payload || {}, {
      clientVersion: payload?.clientVersion || getClientVersion(),
    }), requestMeta);

    try {
      let json = null;
      if (jobClient && typeof jobClient.runJobLifecycle === "function") {
        const jobResult = await jobClient.runJobLifecycle({
          endpoint: backend.endpoint,
          body: requestBody,
          timeoutMs: timeoutMs,
          fetchImpl: fetch.bind(globalThis),
          pollIntervalMs: Math.max(200, Number(config.jobPollIntervalMs) || 800),
          buildApiError: function (responseBody, requestStatusCode) {
            const body = responseBody && typeof responseBody === "object" ? responseBody : {};
            const errorBody = body.error && typeof body.error === "object" ? body.error : body;
            const code =
              errorBody.code || (requestStatusCode >= 500 ? "provider-http-error" : "request-error");
            const message = mapErrorMessage(
              code,
              errorBody.message || body.message || "AI 复核失败。",
              errorBody.summary || body.summary || "",
              requestStatusCode
            );
            const error = new Error(message);
            error.code = code;
            error.requestId = body?.requestId || body?.meta?.requestId || "";
            error.jobId = body?.jobId || "";
            throw error;
          },
          buildTerminalError: function (jobBody) {
            const errorBody = jobBody?.error && typeof jobBody.error === "object" ? jobBody.error : {};
            const code = errorBody.code || "job-failed";
            const message = mapErrorMessage(
              code,
              errorBody.message || "AI 复核失败。",
              errorBody.summary || "",
              errorBody.providerStatus || 500
            );
            const error = new Error(message);
            error.code = code;
            error.requestId = jobBody?.requestId || "";
            error.jobId = jobBody?.jobId || "";
            throw error;
          },
          mapSuccess: function (jobBody) {
            return jobBody?.data?.data || jobBody?.data;
          },
        });
        json = {
          success: true,
          data: jobResult.data,
        };
      } else {
        const response = await fetch(backend.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
          signal: controller ? controller.signal : undefined,
        });
        const responseText = await response.text();
        try {
          json = JSON.parse(responseText || "{}");
        } catch (error) {
          json = null;
        }

        if (!response.ok || !json || json.success !== true || !json.data) {
          const code = json?.code || (response.status >= 500 ? "provider-http-error" : "request-error");
          const message = mapErrorMessage(
            code,
            json?.message || "AI 复核失败。",
            json?.summary || "",
            response.status
          );
          const error = new Error(message);
          error.code = code;
          error.requestId = json?.requestId || "";
          throw error;
        }
      }

      return {
        backend,
        data: json.data,
      };
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error("AI 后端请求超时，请稍后重试。");
      }
      if (error?.code) {
        throw error;
      }
      throw new Error(
        "AI 后端连接失败，请确认已启动 node platform-resources\\backend\\server.js。"
      );
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  globalThis.__ASREdgeMagicDataMinnanAiReviewClient = {
    API_PATH,
    getClientVersion,
    notifyLexiconWarning,
    resolveBackendConfig,
    reviewCurrent,
  };
})();

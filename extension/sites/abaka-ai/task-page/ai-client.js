(function () {
  const ANALYZE_PATH = "/api/abaka-ai/task21/ai/analyze";
  const DEFAULT_TIMEOUT_MS = 60000;
  const DEFAULT_ANALYSIS_MODE = "two_stage";
  const DEFAULT_VISION_MODEL = "qwen3.6-plus";
  const DEFAULT_OCR_MODEL = "";
  const DEFAULT_REASONING_MODEL = "qwen3.6-plus";
  const DEFAULT_SINGLE_MODEL = "qwen3.6-plus";
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

  function sanitizeText(value, maxLength) {
    return String(value || "")
      .replace(/https?:\/\/[^\s"'\\]+/g, "[url-redacted]")
      .replace(
        /(access_token|refresh_token|authorization|token|cookie|password|secret|signature|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi,
        "$1=[redacted]"
      )
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxLength || 280);
  }

  function buildEndpoint(settingsOrMode) {
    const constants = globalThis.ASREdgeConstants || {};
    if (typeof constants.buildBackendUrl === "function") {
      return constants.buildBackendUrl(ANALYZE_PATH, settingsOrMode || {});
    }
    const defaultBackendBaseUrls = constants.DEFAULT_BACKEND_BASE_URLS || {};
    const mode = typeof settingsOrMode === "string" ? String(settingsOrMode).trim().toLowerCase() : "";
    const baseUrl =
      mode === (constants.BACKEND_ENDPOINT_MODE_LOCAL || "local")
        ? defaultBackendBaseUrls.local
        : defaultBackendBaseUrls.server;
    return String(baseUrl || "").replace(/\/+$/, "") + ANALYZE_PATH;
  }

  function normalizeModelName(value, fallback) {
    const text = String(value || "").replace(/[\r\n]+/g, " ").trim();
    if (text === "qwen3.6plus") {
      return "qwen3.6-plus";
    }
    if (!text) {
      const fallbackText = String(fallback || DEFAULT_SINGLE_MODEL).trim();
      return fallbackText === "qwen3.6plus" ? "qwen3.6-plus" : fallbackText || DEFAULT_SINGLE_MODEL;
    }
    return text.slice(0, 80);
  }

  function normalizeAnalysisMode(value, fallback) {
    const text = String(value || "").trim().toLowerCase();
    if (text === "single_model") {
      return "single_model";
    }
    if (text === "two_stage") {
      return "two_stage";
    }
    return String(fallback || DEFAULT_ANALYSIS_MODE).trim().toLowerCase() === "single_model"
      ? "single_model"
      : "two_stage";
  }

  function normalizeTimeoutMs(value, fallback) {
    const number = Number(value);
    const base = Number.isFinite(number) ? number : Number(fallback);
    const safe = Number.isFinite(base) ? base : DEFAULT_TIMEOUT_MS;
    return Math.max(1000, Math.min(300000, Math.floor(safe)));
  }

  function normalizeModelFromOptions(value, fallback, options) {
    const source = Array.isArray(options) ? options : [];
    const allowed = source
      .map(function (item) {
        return String(item?.value || "").trim();
      })
      .filter(Boolean);
    const model = normalizeModelName(value, fallback);
    if (allowed.length <= 0 || allowed.indexOf(model) >= 0) {
      return model;
    }
    return normalizeModelName(fallback, model);
  }

  function getAbakaAiTaskConfig(settings) {
    const constants = globalThis.ASREdgeConstants || {};
    const defaultConfig =
      constants.DEFAULT_SETTINGS?.platforms?.abakaAi?.scripts?.taskPageCapture || {};
    const currentConfig = settings?.platforms?.abakaAi?.scripts?.taskPageCapture || {};
    const legacyModel = normalizeModelName(currentConfig.aiDebugModel, DEFAULT_SINGLE_MODEL);
    const visionOptions = Array.isArray(constants.ABAKA_AI_TASK21_VISION_MODEL_OPTIONS)
      ? constants.ABAKA_AI_TASK21_VISION_MODEL_OPTIONS
      : [{ value: DEFAULT_VISION_MODEL }];
    const reasoningOptions = Array.isArray(constants.ABAKA_AI_TASK21_REASONING_MODEL_OPTIONS)
      ? constants.ABAKA_AI_TASK21_REASONING_MODEL_OPTIONS
      : [{ value: DEFAULT_REASONING_MODEL }];
    const ocrOptions = Array.isArray(constants.ABAKA_AI_TASK21_OCR_MODEL_OPTIONS)
      ? constants.ABAKA_AI_TASK21_OCR_MODEL_OPTIONS
      : [{ value: DEFAULT_OCR_MODEL }];
    const singleOptions = Array.isArray(constants.ABAKA_AI_TASK21_SINGLE_MODEL_OPTIONS)
      ? constants.ABAKA_AI_TASK21_SINGLE_MODEL_OPTIONS
      : [{ value: DEFAULT_SINGLE_MODEL }];

    return {
      analysisMode: normalizeAnalysisMode(
        currentConfig.aiAnalysisMode,
        defaultConfig.aiAnalysisMode || DEFAULT_ANALYSIS_MODE
      ),
      visionModel: normalizeModelFromOptions(
        currentConfig.aiVisionModel,
        defaultConfig.aiVisionModel || DEFAULT_VISION_MODEL,
        visionOptions
      ),
      ocrEnabled: currentConfig.aiOcrEnabled === true,
      ocrModel: normalizeModelFromOptions(
        currentConfig.aiOcrModel,
        defaultConfig.aiOcrModel || DEFAULT_OCR_MODEL,
        ocrOptions
      ),
      reasoningModel: normalizeModelFromOptions(
        currentConfig.aiReasoningModel,
        defaultConfig.aiReasoningModel || DEFAULT_REASONING_MODEL,
        reasoningOptions
      ),
      singleModel: normalizeModelFromOptions(
        currentConfig.aiSingleModel || legacyModel,
        defaultConfig.aiSingleModel || DEFAULT_SINGLE_MODEL,
        singleOptions
      ),
      enableThinking: currentConfig.aiEnableThinking === true,
      timeoutMs: normalizeTimeoutMs(
        currentConfig.aiRequestTimeoutMs,
        normalizeTimeoutMs(defaultConfig.aiRequestTimeoutMs, DEFAULT_TIMEOUT_MS)
      ),
    };
  }

  function buildAnalyzeOptionsPayload(taskConfig, timeoutMs) {
    const config = taskConfig || {};
    return {
      analysisMode: normalizeAnalysisMode(config.analysisMode, DEFAULT_ANALYSIS_MODE),
      visionModel: normalizeModelName(config.visionModel, DEFAULT_VISION_MODEL),
      ocrEnabled: config.ocrEnabled === true,
      ocrModel: normalizeModelName(config.ocrModel, DEFAULT_OCR_MODEL),
      reasoningModel: normalizeModelName(config.reasoningModel, DEFAULT_REASONING_MODEL),
      singleModel: normalizeModelName(config.singleModel, DEFAULT_SINGLE_MODEL),
      enableThinking: config.enableThinking === true,
      timeoutMs: normalizeTimeoutMs(timeoutMs, config.timeoutMs || DEFAULT_TIMEOUT_MS),
    };
  }

  function createTimeoutController(timeoutMs) {
    const safeTimeout = Math.max(1000, Number(timeoutMs) || DEFAULT_TIMEOUT_MS);
    if (typeof AbortController !== "function") {
      return {
        signal: undefined,
        dispose: function () {},
      };
    }
    const controller = new AbortController();
    const timer = window.setTimeout(function () {
      controller.abort();
    }, safeTimeout);
    return {
      signal: controller.signal,
      dispose: function () {
        window.clearTimeout(timer);
      },
    };
  }

  function mapErrorMessage(statusCode, code, message) {
    const normalizedCode = String(code || "").trim();
    if (normalizedCode === "missing-api-key") {
      return "后端未配置 DASHSCOPE_API_KEY 或 mock 未开启。";
    }
    if (normalizedCode === "unsupported-target") {
      return "分析目标不支持，请刷新页面后重试。";
    }
    if (normalizedCode === "invalid-request") {
      return "请求参数无效，请检查页面采集是否完整。";
    }
    if (statusCode === 404) {
      return "AI 后端接口不存在，请确认已启动统一后端并拉取最新代码。";
    }
    if (statusCode >= 500) {
      return "AI 后端服务异常，请稍后重试。";
    }
    return sanitizeText(message || "AI 分析失败。", 220);
  }

  async function analyze(payload, options) {
    const config = options && typeof options === "object" ? options : {};
    const taskConfig = getAbakaAiTaskConfig(config.settings || {});
    const timeoutMs = normalizeTimeoutMs(config.timeoutMs, taskConfig.timeoutMs);
    const analyzeOptions = buildAnalyzeOptionsPayload(taskConfig, timeoutMs);
    const endpoint = buildEndpoint(config.settings || null);
    const controller = createTimeoutController(timeoutMs);
    const requestMeta = assertAiUsageOperatorConfigured(
      buildAiUsageRequestMeta({
        settings: config.settings || {},
        platformUserName: payload?.platformUserName || "",
        platformUserId: payload?.platformUserId || "",
      })
    );
    const requestPayload = appendAiUsageRequestMeta(Object.assign({}, payload || {}, {
      options: Object.assign({}, analyzeOptions),
      debugConfig: Object.assign({}, analyzeOptions),
    }), requestMeta);

    try {
      let body = null;
      if (jobClient && typeof jobClient.runJobLifecycle === "function") {
        const jobResult = await jobClient.runJobLifecycle({
          endpoint: endpoint,
          body: requestPayload,
          timeoutMs: timeoutMs,
          fetchImpl: fetch.bind(globalThis),
          pollIntervalMs: Math.max(200, Number(config.jobPollIntervalMs) || 800),
          buildApiError: function (responseBody, requestStatusCode) {
            const payload = responseBody && typeof responseBody === "object" ? responseBody : {};
            const errorBody = payload.error && typeof payload.error === "object" ? payload.error : payload;
            const code = errorBody.code || payload.code || "request-error";
            const requestError = new Error(
              mapErrorMessage(requestStatusCode, code, errorBody.message || payload.message)
            );
            requestError.code = code;
            requestError.statusCode = requestStatusCode;
            requestError.requestId = payload?.requestId || payload?.meta?.requestId || "";
            requestError.jobId = payload?.jobId || "";
            throw requestError;
          },
          buildTerminalError: function (jobBody) {
            const errorBody = jobBody?.error && typeof jobBody.error === "object" ? jobBody.error : {};
            const code = errorBody.code || "job-failed";
            const requestError = new Error(
              mapErrorMessage(errorBody.providerStatus || 500, code, errorBody.message)
            );
            requestError.code = code;
            requestError.statusCode = Number(errorBody.providerStatus || 500) || 500;
            requestError.requestId = jobBody?.requestId || "";
            requestError.jobId = jobBody?.jobId || "";
            throw requestError;
          },
          mapSuccess: function (jobBody) {
            return jobBody?.data;
          },
        });
        body = jobResult.data;
      } else {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestPayload),
          signal: controller.signal,
        });

        const text = await response.text();
        try {
          body = JSON.parse(text || "{}");
        } catch (error) {
          body = null;
        }

        if (!response.ok || !body || body.success !== true) {
          const code = body && body.code ? body.code : "request-error";
          const requestError = new Error(mapErrorMessage(response.status, code, body && body.message));
          requestError.code = code;
          requestError.statusCode = response.status;
          requestError.requestId = body && body.requestId ? body.requestId : "";
          throw requestError;
        }
      }

      return {
        endpoint: endpoint,
        data: body,
        requestDebug: {
          analysisMode: analyzeOptions.analysisMode,
          visionModel: analyzeOptions.visionModel,
          ocrEnabled: analyzeOptions.ocrEnabled === true,
          ocrModel: analyzeOptions.ocrModel,
          reasoningModel: analyzeOptions.reasoningModel,
          singleModel: analyzeOptions.singleModel,
          enableThinking: analyzeOptions.enableThinking === true,
          timeoutMs: timeoutMs,
        },
      };
    } catch (error) {
      if (error && error.name === "AbortError") {
        const timeoutError = new Error("AI 分析超时，请稍后重试。", { cause: error });
        timeoutError.code = "timeout";
        throw timeoutError;
      }
      if (error && error.code) {
        throw error;
      }
      throw new Error("AI 后端连接失败，请确认已启动 node platform-resources\\backend\\server.js。");
    } finally {
      controller.dispose();
    }
  }

  globalThis.__ASCEdgeAbakaAiTask21AiClient = {
    ANALYZE_PATH: ANALYZE_PATH,
    analyze: analyze,
    buildEndpoint: buildEndpoint,
    sanitizeText: sanitizeText,
  };
})();

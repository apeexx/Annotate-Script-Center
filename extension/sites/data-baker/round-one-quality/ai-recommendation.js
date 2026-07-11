(function () {
  const constants = globalThis.ASREdgeConstants || {};
  const DEFAULT_ENDPOINT =
    String(constants.DEFAULT_BACKEND_BASE_URLS?.server || "").replace(/\/+$/, "") +
    "/api/data-baker/round-one-quality/ai/recommend";
  const DEFAULT_TIMEOUT_MS = 60000;
  const DEFAULT_REQUEST_STAGGER_MS = 50;
  const jobClient = globalThis.ASREdgeAiJobClient || null;
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

  function getClientVersion() {
    try {
      const manifest = chrome?.runtime?.getManifest ? chrome.runtime.getManifest() : null;
      return String(manifest?.version || "unknown");
    } catch (error) {
      return "unknown";
    }
  }

  function normalizeText(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  function getAnnotatorName() {
    const rightMenu = document.querySelector(".right-menu");
    if (!rightMenu) {
      return "";
    }

    const candidates = Array.from(
      rightMenu.querySelectorAll(
        ".avatar-container.el-dropdown > .el-dropdown-selfdefine, .avatar-container.el-dropdown [role='button']"
      )
    )
      .map(function (node) {
        return normalizeText(node.textContent || "");
      })
      .filter(function (text) {
        return text && text !== "帮助文档" && text !== "简体中文" && text !== "English";
      });

    return candidates.length > 0 ? candidates[candidates.length - 1].slice(0, 40) : "";
  }

  function createClientError(message, details) {
    const error = new Error(String(message || "请求失败。"));
    Object.assign(error, details || {});
    return error;
  }

  function buildApiError(responseBody, statusCode) {
    const body = responseBody && typeof responseBody === "object" ? responseBody : {};
    const errorBody = body.error && typeof body.error === "object" ? body.error : body;
    const metaBody = body.meta && typeof body.meta === "object" ? body.meta : {};
    const code = String(errorBody.code || body.code || "").trim();
    const providerCode = String(errorBody.providerCode || body.providerCode || "").trim();
    const providerStatus =
      Number(errorBody.providerStatus || body.providerStatus) || Number(statusCode) || 0;
    let message = String(
      errorBody.message || body.message || "AI 推荐接口请求失败（HTTP " + String(statusCode) + "）。"
    ).trim();
    if (code === "provider-queue-full") {
      message = "后端 AI 队列已满，请稍后重试。";
    } else if (code === "network-disconnected") {
      message = "后端连接中断，请稍后重试。";
    } else if (code === "timeout") {
      message = "AI 推荐接口请求超时。";
    } else if (code === "qwen-burst-rate-limited" || providerCode === "limit_burst_rate") {
      message = "Qwen 请求突增限流，接口返回请求增长过快，可降低并发或稍后重试。";
    } else if (code === "provider-rate-limited" && Number(body.providerStatus) === 429) {
      message = "上游模型限流，后端已重试仍失败，请稍后重试。";
    } else if (code === "qwen-empty-response") {
      message = "Qwen 接口未返回有效文本，可查看原始AI返回排查。";
    } else if (code === "model-json-parse-failed") {
      message = "模型输出 JSON 解析失败，可查看原始AI返回。";
    } else if (code === "fun-asr-auth-error") {
      message = "Fun-ASR 鉴权或权限错误，请检查 DASHSCOPE_API_KEY、服务开通与地域。";
    } else if (code === "fun-asr-forbidden") {
      message = "Fun-ASR 鉴权或权限错误，请检查 DASHSCOPE_API_KEY、服务开通与地域。";
    } else if (code === "fun-asr-audio-url-unreachable") {
      message = "Fun-ASR 无法下载平台音频，请确认 audioUrl 对阿里云服务可访问或签名未过期。";
    } else if (code === "invalid-fun-asr-model") {
      message = "Fun-ASR 模型名错误，应为 fun-asr。";
    } else if (code === "fun-asr-rate-limited") {
      message = "Fun-ASR 上游限流，请稍后重试。";
    } else if (code === "fun-asr-task-failed") {
      message = "Fun-ASR 任务失败，可查看原始AI返回。";
    } else if (code === "fun-asr-transcription-download-failed") {
      message = "Fun-ASR 识别结果下载失败，可查看原始AI返回。";
    } else if (code === "fun-asr-provider-error") {
      if (providerCode === "InvalidFile.DownloadFailed" || providerCode === "DownloadFailed") {
        message = "Fun-ASR 无法下载平台音频，请确认 audioUrl 对阿里云服务可访问或签名未过期。";
      } else if (providerStatus === 403) {
        message = "Fun-ASR 调用被拒绝，请检查权限、地域配置，或确认平台 audioUrl 对阿里云服务可访问。";
      } else if (providerStatus === 401) {
        message = "Fun-ASR 鉴权或权限错误，请检查 DASHSCOPE_API_KEY、服务开通与地域。";
      } else if (providerStatus === 429) {
        message = "Fun-ASR 上游限流，请稍后重试。";
      } else {
        message = "Fun-ASR 上游模型接口返回错误，可查看原始AI返回。";
      }
    } else if (code === "provider-http-error") {
      message = "上游模型接口返回错误，可查看原始AI返回。";
    }
    if (body.summary) {
      message += "：" + String(body.summary || "").slice(0, 120);
    }
    return createClientError(message, {
      code,
      providerCode,
      providerStatus,
      statusCode: Number(statusCode) || 0,
      hasRawAiDebug: body.hasRawAiDebug === true,
      debugId: String(body.debugId || ""),
      rawAiDebug: body.rawAiDebug || null,
      hasDebugRawJson: body.hasDebugRawJson === true,
      debugRawJson: body.debugRawJson || null,
      requestId: String(body.requestId || metaBody.requestId || ""),
      jobId: String(body.jobId || ""),
    });
  }

  function createRuntime(options) {
    const config = options && typeof options === "object" ? options : {};
    let lexiconWarningChecked = false;

    function getEndpoint() {
      try {
        return new URL(String(config.endpoint || DEFAULT_ENDPOINT)).toString();
      } catch (error) {
        return DEFAULT_ENDPOINT;
      }
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

    async function notifyLexiconWarning() {
      if (lexiconWarningChecked) {
        return false;
      }
      lexiconWarningChecked = true;
      const healthEndpoint = buildHealthEndpoint(getEndpoint());
      if (!healthEndpoint || typeof fetch !== "function") {
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

    function createRequestBody(source) {
      const platformUserName = String(source.annotatorName || getAnnotatorName() || "");
      const requestMeta = buildAiUsageRequestMeta({
        settings: config.settings,
        platformUserName: platformUserName,
        platformUserId: "",
      });
      assertAiUsageOperatorConfigured(requestMeta);
      const requestBody = {
        collectId: String(source.collectId || ""),
        itemId: String(source.itemId || ""),
        textId: String(source.textId || ""),
        sentenceNumber: source.sentenceNumber,
        readRequire: String(source.readRequire || ""),
        audioUrl: String(source.audioUrl || ""),
        pageText: String(source.pageText || ""),
        annotatorName: platformUserName,
        aiUsageOperatorName: requestMeta.aiUsageOperatorName,
        platformUserName: requestMeta.platformUserName,
        platformUserId: requestMeta.platformUserId,
        effectiveStartTime: source.effectiveStartTime,
        effectiveEndTime: source.effectiveEndTime,
        effectiveTime: source.effectiveTime,
        audioDuration: source.audioDuration,
        clientVersion: getClientVersion(),
        batchRunId: String(source.batchRunId || ""),
        batchItemIndex: source.batchItemIndex,
        batchProcessKey: String(source.batchProcessKey || ""),
        clientRequestId: String(source.clientRequestId || ""),
        frontConcurrency: source.frontConcurrency,
        batchConcurrency: source.batchConcurrency,
        concurrencyModelType: String(source.concurrencyModelType || ""),
      };
      if (config.recognitionMode) {
        requestBody.recognitionMode = String(config.recognitionMode).trim();
      }
      if (config.pipelineMode) {
        requestBody.pipelineMode = String(config.pipelineMode).trim();
      }
      if (config.listenModel) {
        requestBody.listenModel = String(config.listenModel).trim();
      }
      if (config.compareModel) {
        requestBody.compareModel = String(config.compareModel).trim();
      }
      if (config.singleModel) {
        requestBody.singleModel = String(config.singleModel).trim();
      }
      if (typeof config.enableThinking === "boolean") {
        requestBody.enableThinking = config.enableThinking === true;
      }
      if (config.aiOptions && typeof config.aiOptions === "object") {
        requestBody.aiOptions = Object.assign({}, config.aiOptions);
      }
      if (
        requestBody.frontConcurrency === undefined &&
        Number.isFinite(Number(config.aiQualifiedAutofillConcurrency))
      ) {
        requestBody.frontConcurrency = Number(config.aiQualifiedAutofillConcurrency);
      }
      if (
        requestBody.batchConcurrency === undefined &&
        Number.isFinite(Number(requestBody.frontConcurrency))
      ) {
        requestBody.batchConcurrency = Number(requestBody.frontConcurrency);
      }
      if (
        !requestBody.concurrencyModelType &&
        String(config.aiQualifiedAutofillModelType || "").trim()
      ) {
        requestBody.concurrencyModelType = String(config.aiQualifiedAutofillModelType).trim();
      }
      return requestBody;
    }

    async function recommend(item) {
      const source = item && typeof item === "object" ? item : {};
      if (!source.collectId) {
        throw new Error("缺少 collectId，无法调用 AI 推荐。");
      }
      if (!source.itemId) {
        throw new Error("缺少当前题 itemId，请刷新或重新点击题目后再试。");
      }
      if (!source.audioUrl) {
        throw new Error("缺少当前题 audioUrl，请等待列表接口加载完成后再试。");
      }
      if (!String(source.pageText || "").trim()) {
        throw new Error("缺少页面候选文本。");
      }

      const controller = typeof AbortController === "function" ? new AbortController() : null;
      const timeoutMs = Math.max(1000, Number(config.timeoutMs) || DEFAULT_TIMEOUT_MS);
      const timer = controller
        ? window.setTimeout(function () {
            controller.abort();
          }, timeoutMs)
        : null;
      const requestBody = createRequestBody(source);

      try {
        if (!jobClient || typeof jobClient.runJobLifecycle !== "function") {
          const response = await fetch(getEndpoint(), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
            signal: controller ? controller.signal : undefined,
          });
          const responseBody = await response.json().catch(function () {
            return null;
          });
          if (!response.ok || responseBody?.success !== true || !responseBody?.data) {
            throw buildApiError(responseBody, response.status);
          }
          return responseBody.data;
        }
        const jobResult = await jobClient.runJobLifecycle({
          endpoint: getEndpoint(),
          body: requestBody,
          timeoutMs: timeoutMs,
          fetchImpl: fetch.bind(globalThis),
          pollIntervalMs: Math.max(200, Number(config.jobPollIntervalMs) || 800),
          buildApiError: function (responseBody, requestStatusCode) {
            return buildApiError(responseBody, requestStatusCode);
          },
          buildTerminalError: function (jobBody) {
            return buildApiError(jobBody, Number(jobBody?.error?.providerStatus || jobBody?.providerStatus || 500));
          },
          mapSuccess: function (jobBody) {
            return jobBody?.data;
          },
        });
        return jobResult.data;
      } catch (error) {
        if (error?.name === "AbortError") {
          throw createClientError("AI 推荐接口请求超时。", { code: "timeout" });
        }
        if (error instanceof TypeError) {
          throw createClientError("后端连接中断，请稍后重试。", {
            code: "network-disconnected",
          });
        }
        throw error;
      } finally {
        if (timer) {
          clearTimeout(timer);
        }
      }
    }

    async function getRawAiDebug(debugId) {
      const key = String(debugId || "").trim();
      if (!key) {
        throw createClientError("当前失败项没有可查看的原始 AI 返回。", {
          code: "ai-debug-not-found",
        });
      }
      const controller = typeof AbortController === "function" ? new AbortController() : null;
      const timeoutMs = Math.max(1000, Number(config.timeoutMs) || DEFAULT_TIMEOUT_MS);
      const timer = controller
        ? window.setTimeout(function () {
            controller.abort();
          }, timeoutMs)
        : null;
      try {
        const response = await fetch(getEndpoint().replace(/\/+$/, "") + "/debug/" + encodeURIComponent(key), {
          method: "GET",
          signal: controller ? controller.signal : undefined,
        });
        const responseBody = await response.json().catch(function () {
          return null;
        });
        if (!response.ok || responseBody?.success !== true || !responseBody?.debug) {
          throw buildApiError(responseBody, response.status);
        }
        return responseBody.debug;
      } catch (error) {
        if (error?.name === "AbortError") {
          throw createClientError("获取原始 AI 返回超时，请稍后重试。", { code: "timeout" });
        }
        if (error instanceof TypeError) {
          throw createClientError("后端连接中断，请稍后重试。", {
            code: "network-disconnected",
          });
        }
        throw error;
      } finally {
        if (timer) {
          clearTimeout(timer);
        }
      }
    }

    return {
      getRawAiDebug,
      notifyLexiconWarning,
      recommend,
      defaultRequestStaggerMs: DEFAULT_REQUEST_STAGGER_MS,
    };
  }

  globalThis.__ASREdgeDataBakerRoundOneAiRecommendation = {
    DEFAULT_ENDPOINT,
    DEFAULT_TIMEOUT_MS,
    DEFAULT_REQUEST_STAGGER_MS,
    createRuntime,
    getAnnotatorName,
  };
})();

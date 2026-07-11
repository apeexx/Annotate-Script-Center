(function () {
  const API_PATH = "/api/alibaba-labelx/asr-transcription/ai/suggest-current";
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

  function getClientVersion() {
    try {
      const manifest = chrome?.runtime?.getManifest ? chrome.runtime.getManifest() : null;
      return String(manifest?.version || "0.3.0");
    } catch (error) {
      return "0.3.0";
    }
  }

  function isIgnoredUserText(text) {
    return (
      !text ||
      text === "填写问卷" ||
      text === "退出登录" ||
      text === "标注中心" ||
      text === "帮助文档" ||
      text === "智能标注" ||
      text.indexOf("总时长") >= 0 ||
      text.indexOf("上传统计") >= 0 ||
      text.indexOf("上传转写统计") >= 0
    );
  }

  function getCurrentUserText() {
    const candidates = Array.from(
      document.querySelectorAll(
        ".header-component-container .ant-v5-select-selection-item, .header-component-container [title], .header-component-container"
      )
    );

    for (let index = 0; index < candidates.length; index += 1) {
      const text = String(candidates[index].textContent || candidates[index].getAttribute("title") || "")
        .replace(/\s+/g, " ")
        .trim();
      if (!isIgnoredUserText(text) && text.length <= 40) {
        return text;
      }
    }

    return "";
  }

  function delay(ms) {
    return new Promise(function (resolve) {
      window.setTimeout(resolve, ms);
    });
  }

  function getVisibleText(node) {
    return String(node?.textContent || "").replace(/\s+/g, " ").trim();
  }

  function dispatchMouseEvent(element, type) {
    if (!element) {
      return;
    }

    element.dispatchEvent(
      new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        view: window,
      })
    );
  }

  function findAvatarTrigger() {
    return (
      document.querySelector(
        ".ant-v5-dropdown-trigger[class*='NavAvatar-module__userInfoWrapper'], .ant-v5-dropdown-trigger.avatar, [class*='NavAvatar-module__userInfoWrapper'], .header-component-container .ant-v5-avatar"
      ) || null
    );
  }

  function readVisibleAvatarDropdownUserText() {
    const menuItems = Array.from(
      document.querySelectorAll(
        ".ant-v5-dropdown:not(.ant-v5-dropdown-hidden) .ant-v5-dropdown-menu-item, .ant-v5-dropdown-menu:not(.ant-v5-dropdown-menu-hidden) .ant-v5-dropdown-menu-item"
      )
    );

    const userItem =
      menuItems.find(function (item) {
        return String(item.className || "").indexOf("NavAvatar-module__userAvatar") >= 0;
      }) || menuItems[0] || null;
    const candidates = userItem
      ? Array.from(
          userItem.querySelectorAll(
            ".ant-v5-dropdown-menu-title-content, [class*='title-content'], span, div"
          )
        )
      : [];
    if (userItem) {
      candidates.unshift(userItem);
    }

    for (let index = 0; index < candidates.length; index += 1) {
      const text = getVisibleText(candidates[index]);
      if (!isIgnoredUserText(text) && text.length <= 50) {
        return text;
      }
    }

    return "";
  }

  async function resolveCurrentUserText() {
    const avatar = findAvatarTrigger();
    if (avatar) {
      dispatchMouseEvent(avatar, "mouseenter");
      dispatchMouseEvent(avatar, "mouseover");
      dispatchMouseEvent(avatar, "mousemove");
      await delay(180);
      const dropdownText = readVisibleAvatarDropdownUserText();
      dispatchMouseEvent(avatar, "mouseleave");
      if (dropdownText) {
        return dropdownText;
      }
    }

    return getCurrentUserText();
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

  function mapErrorMessage(code, message, summary, statusCode) {
    const mappedCode = String(code || "").trim();
    if (mappedCode === "request-error" && Number(statusCode) === 404) {
      return "转写 AI 后端接口不存在，请确认后端已启动并包含最新路由。";
    }
    if (mappedCode === "missing-api-key") {
      return "后端未读取到 DASHSCOPE_API_KEY，请检查 config/env/ai.env 或环境变量。";
    }
    if (mappedCode === "invalid-audio-url") {
      return "当前题音频 URL 无效，请先播放一次音频后重试。";
    }
    if (mappedCode === "empty-provider-response") {
      return "Qwen 未返回有效文本，请稍后重试。";
    }
    if (mappedCode) {
      const detail = sanitizeMessage(message || "", 180);
      const extra = sanitizeMessage(summary || "", 120);
      return mappedCode + (detail ? "：" + detail : "") + (extra ? "（" + extra + "）" : "");
    }
    return sanitizeMessage(message || "AI 推荐调用失败。", 220);
  }

  async function suggestCurrent(payload, options) {
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
        platformUserName: await resolveCurrentUserText(),
        platformUserId: payload?.platformUserId || "",
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
              errorBody.message || body.message || "AI 推荐失败。",
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
              errorBody.message || "AI 推荐失败。",
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
            return jobBody?.data;
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
            json?.message || "AI 推荐失败。",
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
      throw new Error("AI 后端连接失败，请确认已启动 node platform-resources\\backend\\server.js。");
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  globalThis.__ASREdgeAlibabaLabelxTranscriptionAiSuggestionClient = {
    API_PATH,
    getClientVersion,
    resolveBackendConfig,
    suggestCurrent,
  };
})();

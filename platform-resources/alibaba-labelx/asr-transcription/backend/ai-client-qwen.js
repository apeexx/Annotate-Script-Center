"use strict";

const DEFAULT_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";
const DEFAULT_LISTEN_MODEL = "qwen3.5-omni-flash";
const DEFAULT_COMPARE_MODEL = "qwen3.5-plus";
const DEFAULT_REQUEST_PARAMS = {
  temperature: 0.1,
  top_p: 0.8,
  max_tokens: 1200,
  max_completion_tokens: "",
  presence_penalty: 0,
  frequency_penalty: 0,
  seed: "",
  stop: "",
};
const SUPPORTED_REQUEST_PARAMS = {
  temperature: true,
  top_p: true,
  max_tokens: true,
  max_completion_tokens: true,
  presence_penalty: true,
  frequency_penalty: true,
  seed: true,
  stop: true,
  enable_thinking: true,
  reasoning_effort: false,
  response_format: false,
};

function trimSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function sanitizeModelName(value, fallback) {
  const text = String(value || "").replace(/[\r\n]+/g, " ").trim();
  if (!text) {
    return String(fallback || "").trim();
  }
  return text.slice(0, 80);
}

function parseBooleanEnv(name, fallback) {
  const text = String(process.env[name] || "").trim().toLowerCase();
  if (!text) {
    return fallback === true;
  }
  return text === "1" || text === "true" || text === "yes" || text === "on";
}

function parseTimeoutMs() {
  const value = Number(process.env.ASR_TRANSCRIPTION_AI_TIMEOUT_MS || 60000);
  if (!Number.isFinite(value)) {
    return 60000;
  }
  return Math.max(1000, Math.min(300000, value));
}

function isMockEnabled() {
  return parseBooleanEnv("ASR_TRANSCRIPTION_AI_MOCK", false);
}

function parseEnableThinkingDefault() {
  return parseBooleanEnv("ASR_TRANSCRIPTION_AI_ENABLE_THINKING", false);
}

function getClientConfig() {
  const apiKey = String(process.env.DASHSCOPE_API_KEY || "").trim();
  return {
    apiKey,
    baseUrl: trimSlash(process.env.DASHSCOPE_BASE_URL || DEFAULT_BASE_URL),
    timeoutMs: parseTimeoutMs(),
    mockEnabled: isMockEnabled(),
    hasApiKey: Boolean(apiKey),
    listenModel: sanitizeModelName(process.env.ASR_TRANSCRIPTION_AI_LISTEN_MODEL, DEFAULT_LISTEN_MODEL),
    compareModel: sanitizeModelName(process.env.ASR_TRANSCRIPTION_AI_COMPARE_MODEL, DEFAULT_COMPARE_MODEL),
    enableThinkingDefault: parseEnableThinkingDefault(),
    allowClientModelOverride: parseBooleanEnv("ASR_TRANSCRIPTION_AI_ALLOW_CLIENT_MODEL_OVERRIDE", true),
  };
}

function sanitizeProviderErrorSummary(text) {
  return String(text || "")
    .replace(/https?:\/\/[^\s"'\\]+/g, function (urlText) {
      try {
        const parsed = new URL(urlText);
        return parsed.protocol + "//" + parsed.host + "/[redacted]";
      } catch (error) {
        return "[url-redacted]";
      }
    })
    .replace(/(access_token["'\s:=]+)([^\s"',}]+)/gi, "$1[redacted]")
    .replace(/(refresh_token["'\s:=]+)([^\s"',}]+)/gi, "$1[redacted]")
    .replace(/(token["'\s:=]+)([^\s"',}]+)/gi, "$1[redacted]")
    .replace(/(cookie["'\s:=]+)([^\n\r]+)/gi, "$1[redacted]")
    .replace(/(authorization["'\s:=]+)([^\s"',}]+)/gi, "$1[redacted]")
    .replace(/(ossaccesskeyid["'\s:=]+)([^\s"',}]+)/gi, "$1[redacted]")
    .replace(/(signature["'\s:=]+)([^\s"',}]+)/gi, "$1[redacted]")
    .replace(/(api[_-]?key["'\s:=]+)([^\s"',}]+)/gi, "$1[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
}

function buildMockSuggestion(request, model) {
  const textCandidates = Array.isArray(request?.textCandidates) ? request.textCandidates : [];
  const candidateA = String(textCandidates[0]?.text || "").trim();
  const candidateB = String(textCandidates[1]?.text || "").trim();
  const fallbackText = String(request?.currentText || "").trim() || candidateA || candidateB;
  const decision = candidateA && !candidateB ? "candidate_a" : candidateB && !candidateA ? "candidate_b" : "merged";

  return JSON.stringify({
    decision,
    recommendedText: fallbackText,
    confidence: 0.66,
    reasonSummary: "Mock 模式：示例推荐，仅用于联调。",
    riskFlags: ["mock_mode"],
    applyAdvice: "manual_confirm",
    model,
  });
}

function extractMessageText(content) {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map(function (part) {
        if (typeof part === "string") {
          return part;
        }
        if (part && typeof part.text === "string") {
          return part.text;
        }
        return "";
      })
      .join("");
  }
  return "";
}

function resolveThinkingPreference(options, config) {
  void options;
  void config;
  return {
    source: "forced-off",
    enabled: false,
  };
}

function removeThinkingField(requestBody) {
  const next = Object.assign({}, requestBody || {});
  delete next.enable_thinking;
  return next;
}

function withThinking(requestBody, thinkingPreference) {
  const next = Object.assign({}, requestBody || {});
  next.enable_thinking = thinkingPreference?.enabled === true;
  return next;
}

function isEnableThinkingUnsupportedError(error) {
  if (!error || error.code !== "provider-http-error") {
    return false;
  }
  const summary = String(error.summary || error.message || "").toLowerCase();
  return (
    summary.indexOf("enable_thinking") >= 0 ||
    (summary.indexOf("unsupported") >= 0 && summary.indexOf("parameter") >= 0) ||
    (summary.indexOf("invalid") >= 0 && summary.indexOf("parameter") >= 0)
  );
}

async function requestChatCompletion(requestBody, options, config) {
  if (!config.hasApiKey) {
    const error = new Error("missing-api-key");
    error.code = "missing-api-key";
    error.statusCode = 503;
    throw error;
  }
  if (typeof fetch !== "function") {
    throw new Error("当前 Node 运行时不支持 fetch。", "request-error");
  }

  const timeoutMs = Math.max(1000, Number(options?.timeoutMs) || config.timeoutMs);
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timer = controller
    ? setTimeout(function () {
        controller.abort();
      }, timeoutMs)
    : null;

  try {
    const response = await fetch(config.baseUrl + "/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + config.apiKey,
      },
      body: JSON.stringify(requestBody),
      signal: controller ? controller.signal : undefined,
    });

    const rawText = await response.text();
    let json = null;
    try {
      json = JSON.parse(rawText || "{}");
    } catch (error) {
      json = null;
    }

    if (!response.ok) {
      const providerError = new Error("Qwen 接口请求失败（HTTP " + String(response.status) + "）。");
      providerError.code = "provider-http-error";
      providerError.statusCode = response.status;
      providerError.summary = sanitizeProviderErrorSummary(rawText);
      throw providerError;
    }

    const choice = Array.isArray(json?.choices) ? json.choices[0] : null;
    const messageText = extractMessageText(choice?.message?.content || choice?.delta?.content || "");
    if (!String(messageText || "").trim()) {
      const emptyError = new Error("Qwen 接口未返回有效文本。");
      emptyError.code = "empty-provider-response";
      throw emptyError;
    }

    return {
      rawText: messageText,
      usage: json?.usage || {},
      model: String(json?.model || requestBody?.model || ""),
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("Qwen 请求超时。");
      timeoutError.code = "timeout";
      timeoutError.statusCode = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

async function requestChatCompletionWithFallback(requestBody, options, config) {
  const thinkingPreference = resolveThinkingPreference(options, config);
  const initialBody = withThinking(requestBody, thinkingPreference);
  try {
    const result = await requestChatCompletion(initialBody, options || {}, config);
    return Object.assign({}, result, {
      enableThinking: thinkingPreference.enabled === true,
      thinkingPreferenceSource: thinkingPreference.source,
      thinkingFallbackUsed: false,
      thinkingFallbackMode: "",
    });
  } catch (error) {
    if (!isEnableThinkingUnsupportedError(error)) {
      throw error;
    }

    const fallbackBody = removeThinkingField(initialBody);
    const fallbackMode = "remove";
    const fallbackResult = await requestChatCompletion(fallbackBody, options || {}, config);
    return Object.assign({}, fallbackResult, {
      enableThinking: thinkingPreference.enabled === true,
      thinkingPreferenceSource: thinkingPreference.source,
      thinkingFallbackUsed: true,
      thinkingFallbackMode: fallbackMode,
    });
  }
}

function toSafeAudioCandidates(audioCandidates) {
  return (Array.isArray(audioCandidates) ? audioCandidates : []).filter(function (item) {
    return item && typeof item === "object" && String(item.url || "").trim();
  });
}

function buildUserContent(prompt, request, options) {
  const list = [
    {
      type: "text",
      text: String(prompt?.userPrompt || ""),
    },
  ];

  if (options?.includeAudio !== false) {
    toSafeAudioCandidates(request?.audioCandidates).forEach(function (item) {
      list.push({
        type: "input_audio",
        input_audio: {
          data: String(item.url || "").trim(),
          format: String(item.format || "wav").trim() || "wav",
        },
      });
    });
  }

  return list;
}

function buildRequestBody(prompt, request, options) {
  const model = sanitizeModelName(options?.model, DEFAULT_LISTEN_MODEL) || DEFAULT_LISTEN_MODEL;
  const requestBody = {
    model,
    temperature: DEFAULT_REQUEST_PARAMS.temperature,
    top_p: DEFAULT_REQUEST_PARAMS.top_p,
    max_tokens: DEFAULT_REQUEST_PARAMS.max_tokens,
    presence_penalty: DEFAULT_REQUEST_PARAMS.presence_penalty,
    frequency_penalty: DEFAULT_REQUEST_PARAMS.frequency_penalty,
    response_format: {
      type: "json_object",
    },
    messages: [
      {
        role: "system",
        content: String(prompt?.systemPrompt || ""),
      },
      {
        role: "user",
        content: buildUserContent(prompt, request, options),
      },
    ],
  };
  applyAiOptionsToRequestBody(requestBody, request?.aiOptions);
  return requestBody;
}

function normalizeNumberInRange(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return null;
  }
  if (number < min || number > max) {
    return null;
  }
  return number;
}

function normalizeIntegerInRange(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return null;
  }
  const integerValue = Math.floor(number);
  if (integerValue < min || integerValue > max) {
    return null;
  }
  return integerValue;
}

function normalizeStopSequences(value) {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
    ? value.split(/\r?\n/)
    : [];
  const result = [];
  source.forEach(function (item) {
    const text = String(item || "").trim().slice(0, 80);
    if (!text || result.indexOf(text) >= 0 || result.length >= 8) {
      return;
    }
    result.push(text);
  });
  return result;
}

function applyAiOptionsToRequestBody(requestBody, aiOptions) {
  const source = aiOptions && typeof aiOptions === "object" ? aiOptions : {};
  if (SUPPORTED_REQUEST_PARAMS.temperature === true) {
    const value = normalizeNumberInRange(source.temperature, 0, 2);
    if (value !== null) {
      requestBody.temperature = value;
    }
  }
  if (SUPPORTED_REQUEST_PARAMS.top_p === true) {
    const value = normalizeNumberInRange(source.top_p, 0, 1);
    if (value !== null) {
      requestBody.top_p = value;
    }
  }
  if (SUPPORTED_REQUEST_PARAMS.max_completion_tokens === true) {
    const value = normalizeIntegerInRange(source.max_completion_tokens, 1, 8192);
    if (value !== null) {
      requestBody.max_completion_tokens = value;
      delete requestBody.max_tokens;
    }
  }
  if (
    SUPPORTED_REQUEST_PARAMS.max_tokens === true &&
    !Number.isFinite(requestBody.max_completion_tokens)
  ) {
    const value = normalizeIntegerInRange(source.max_tokens, 1, 8192);
    if (value !== null) {
      requestBody.max_tokens = value;
    }
  }
  if (SUPPORTED_REQUEST_PARAMS.presence_penalty === true) {
    const value = normalizeNumberInRange(source.presence_penalty, -2, 2);
    if (value !== null) {
      requestBody.presence_penalty = value;
    }
  }
  if (SUPPORTED_REQUEST_PARAMS.frequency_penalty === true) {
    const value = normalizeNumberInRange(source.frequency_penalty, -2, 2);
    if (value !== null) {
      requestBody.frequency_penalty = value;
    }
  }
  if (SUPPORTED_REQUEST_PARAMS.seed === true) {
    const value = normalizeIntegerInRange(source.seed, 0, 2147483647);
    if (value !== null) {
      requestBody.seed = value;
    }
  }
  if (SUPPORTED_REQUEST_PARAMS.stop === true) {
    const stop = normalizeStopSequences(source.stop);
    if (stop.length > 0) {
      requestBody.stop = stop;
    }
  }
}

function resolveModel(requestModel, defaultModel, config) {
  if (!config.allowClientModelOverride) {
    return sanitizeModelName(defaultModel, defaultModel);
  }
  const normalized = sanitizeModelName(requestModel, "");
  if (!normalized) {
    return sanitizeModelName(defaultModel, defaultModel);
  }
  return normalized;
}

async function requestCurrentSuggestion(request, prompt, options) {
  const config = getClientConfig();
  const resolvedModel = resolveModel(options?.model, config.listenModel || DEFAULT_LISTEN_MODEL, config);

  if (config.mockEnabled) {
    return {
      provider: "dashscope-qwen",
      model: resolvedModel,
      rawText: buildMockSuggestion(request, resolvedModel),
      usage: {},
      mock: true,
      enableThinking: resolveThinkingPreference(options, config).enabled,
      thinkingFallbackUsed: false,
      thinkingFallbackMode: "",
    };
  }

  const requestBody = buildRequestBody(prompt, request, {
    model: resolvedModel,
    includeAudio: options?.includeAudio !== false,
  });

  const result = await requestChatCompletionWithFallback(requestBody, options || {}, config);
  return {
    provider: "dashscope-qwen",
    model: result.model || resolvedModel,
    rawText: result.rawText,
    usage: result.usage || {},
    mock: false,
    enableThinking: result.enableThinking === true,
    thinkingPreferenceSource: result.thinkingPreferenceSource || "",
    thinkingFallbackUsed: result.thinkingFallbackUsed === true,
    thinkingFallbackMode: result.thinkingFallbackMode || "",
  };
}

module.exports = {
  DEFAULT_BASE_URL,
  DEFAULT_LISTEN_MODEL,
  DEFAULT_COMPARE_MODEL,
  DEFAULT_REQUEST_PARAMS,
  SUPPORTED_REQUEST_PARAMS,
  getClientConfig,
  requestCurrentSuggestion,
  sanitizeModelName,
};

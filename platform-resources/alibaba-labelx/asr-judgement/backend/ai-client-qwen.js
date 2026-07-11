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
  response_format: false,
  stop: true,
  enable_thinking: true,
  web_search: true,
  reasoning_effort: false,
};

function trimSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function parseBoolean(value, fallback) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) {
    return fallback === true;
  }
  return text === "1" || text === "true" || text === "yes" || text === "on";
}

function isMockEnabled() {
  return String(process.env.ASR_JUDGEMENT_AI_MOCK || "").trim() === "1";
}

function parseTimeoutMs() {
  const value = Number(process.env.ASR_JUDGEMENT_AI_TIMEOUT_MS || 60000);
  if (!Number.isFinite(value)) {
    return 60000;
  }
  return Math.max(1000, Math.min(300000, Math.floor(value)));
}

function sanitizeModelName(value, fallback) {
  const text = String(value || "").replace(/[\r\n]+/g, " ").trim();
  if (!text) {
    return String(fallback || "").trim();
  }
  return text.slice(0, 80);
}

function getClientConfig() {
  const apiKey = String(process.env.DASHSCOPE_API_KEY || "").trim();
  const baseUrl = trimSlash(process.env.DASHSCOPE_BASE_URL || DEFAULT_BASE_URL);
  const legacyModel = sanitizeModelName(process.env.ASR_JUDGEMENT_AI_MODEL, "");
  const listenModel = sanitizeModelName(
    process.env.ASR_JUDGEMENT_AI_LISTEN_MODEL,
    DEFAULT_LISTEN_MODEL
  );
  const compareModel = sanitizeModelName(
    process.env.ASR_JUDGEMENT_AI_COMPARE_MODEL,
    legacyModel || DEFAULT_COMPARE_MODEL
  );
  return {
    apiKey,
    baseUrl,
    hasApiKey: Boolean(apiKey),
    mockEnabled: isMockEnabled(),
    timeoutMs: parseTimeoutMs(),
    listenModel: listenModel || DEFAULT_LISTEN_MODEL,
    compareModel: compareModel || DEFAULT_COMPARE_MODEL,
    legacyModel: legacyModel || "",
    enableThinkingDefault: parseBoolean(process.env.ASR_JUDGEMENT_AI_ENABLE_THINKING, false),
    webSearchEnabledDefault: parseBoolean(
      process.env.ASR_JUDGEMENT_AI_WEB_SEARCH_ENABLED,
      true
    ),
    allowClientModelOverride: parseBoolean(
      process.env.ASR_JUDGEMENT_AI_ALLOW_CLIENT_MODEL_OVERRIDE,
      true
    ),
  };
}

function inferAudioFormat(audioUrl) {
  let pathname = "";
  try {
    pathname = new URL(String(audioUrl || "")).pathname || "";
  } catch (error) {
    pathname = String(audioUrl || "").split("?")[0] || "";
  }

  const lowerPathname = pathname.toLowerCase();
  const matched = lowerPathname.match(/\.([a-z0-9]+)$/);
  const ext = matched ? matched[1] : "";
  const supportedFormats = {
    wav: "wav",
    mp3: "mp3",
    aac: "aac",
    m4a: "m4a",
    amr: "amr",
    "3gp": "3gp",
    "3gpp": "3gpp",
  };
  return supportedFormats[ext] || "wav";
}

function normalizeNumberInRange(value, min, max) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return null;
  }
  if (numericValue < min || numericValue > max) {
    return null;
  }
  return numericValue;
}

function normalizeIntegerInRange(value, min, max) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return null;
  }
  const normalizedValue = Math.floor(numericValue);
  if (normalizedValue < min || normalizedValue > max) {
    return null;
  }
  return normalizedValue;
}

function sanitizeStopSequences(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  const result = [];
  value.forEach(function (item) {
    const text = String(item || "").trim().slice(0, 80);
    if (!text) {
      return;
    }
    if (result.indexOf(text) >= 0) {
      return;
    }
    if (result.length >= 8) {
      return;
    }
    result.push(text);
  });
  return result;
}

function sanitizeAiOptions(rawOptions) {
  const source = rawOptions && typeof rawOptions === "object" ? rawOptions : {};
  const sanitized = {};
  if (SUPPORTED_REQUEST_PARAMS.temperature === true) {
    const value = normalizeNumberInRange(source.temperature, 0, 2);
    if (value !== null) {
      sanitized.temperature = value;
    }
  }
  if (SUPPORTED_REQUEST_PARAMS.top_p === true) {
    const value = normalizeNumberInRange(source.top_p, 0, 1);
    if (value !== null) {
      sanitized.top_p = value;
    }
  }
  if (SUPPORTED_REQUEST_PARAMS.max_completion_tokens === true) {
    const value = normalizeIntegerInRange(source.max_completion_tokens, 1, 8192);
    if (value !== null) {
      sanitized.max_completion_tokens = value;
    }
  }
  if (SUPPORTED_REQUEST_PARAMS.max_tokens === true) {
    const value = normalizeIntegerInRange(source.max_tokens, 1, 8192);
    if (value !== null && !Number.isFinite(sanitized.max_completion_tokens)) {
      sanitized.max_tokens = value;
    }
  }
  if (SUPPORTED_REQUEST_PARAMS.presence_penalty === true) {
    const value = normalizeNumberInRange(source.presence_penalty, -2, 2);
    if (value !== null) {
      sanitized.presence_penalty = value;
    }
  }
  if (SUPPORTED_REQUEST_PARAMS.frequency_penalty === true) {
    const value = normalizeNumberInRange(source.frequency_penalty, -2, 2);
    if (value !== null) {
      sanitized.frequency_penalty = value;
    }
  }
  if (SUPPORTED_REQUEST_PARAMS.seed === true) {
    const value = normalizeIntegerInRange(source.seed, 0, 2147483647);
    if (value !== null) {
      sanitized.seed = value;
    }
  }
  if (SUPPORTED_REQUEST_PARAMS.stop === true) {
    const stop = sanitizeStopSequences(source.stop);
    if (stop.length > 0) {
      sanitized.stop = stop;
    }
  }
  if (
    SUPPORTED_REQUEST_PARAMS.enable_thinking === true &&
    typeof source.enable_thinking === "boolean"
  ) {
    sanitized.enable_thinking = false;
  }
  if (
    SUPPORTED_REQUEST_PARAMS.web_search === true &&
    typeof source.webSearchEnabled === "boolean"
  ) {
    sanitized.webSearchEnabled = source.webSearchEnabled === true;
  }
  return sanitized;
}

function applyAiOptionsToRequestBody(requestBody, aiOptions) {
  const options = sanitizeAiOptions(aiOptions);
  if (Number.isFinite(options.temperature)) {
    requestBody.temperature = options.temperature;
  }
  if (Number.isFinite(options.top_p)) {
    requestBody.top_p = options.top_p;
  }
  if (Number.isFinite(options.max_completion_tokens)) {
    requestBody.max_completion_tokens = options.max_completion_tokens;
    delete requestBody.max_tokens;
  } else if (Number.isFinite(options.max_tokens)) {
    requestBody.max_tokens = options.max_tokens;
  }
  if (Number.isFinite(options.presence_penalty)) {
    requestBody.presence_penalty = options.presence_penalty;
  }
  if (Number.isFinite(options.frequency_penalty)) {
    requestBody.frequency_penalty = options.frequency_penalty;
  }
  if (Number.isFinite(options.seed)) {
    requestBody.seed = options.seed;
  }
  if (Array.isArray(options.stop) && options.stop.length > 0) {
    requestBody.stop = options.stop;
  }
  return options;
}

function sanitizeProviderErrorSummary(text) {
  return String(text || "")
    .replace(/https?:\/\/[^\s"'\\]+/g, function (matchText) {
      try {
        const parsedUrl = new URL(matchText);
        return parsedUrl.protocol + "//" + parsedUrl.host + "/[redacted]";
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
    .slice(0, 200);
}

function extractTextFromContent(content) {
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }

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

function extractCompletionText(payload) {
  const choice = Array.isArray(payload?.choices) ? payload.choices[0] : null;
  if (!choice) {
    return "";
  }
  const deltaText = extractTextFromContent(choice?.delta?.content);
  if (deltaText) {
    return deltaText;
  }
  const messageText = extractTextFromContent(choice?.message?.content);
  if (messageText) {
    return messageText;
  }
  return "";
}

async function readStreamCompletion(response, options) {
  const startedAtMs = Number(options?.startedAtMs) || Date.now();
  let aggregatedText = "";
  let usage = {};
  let firstChunkAtMs = 0;
  let chunkCount = 0;

  function applyPayload(payload) {
    if (!payload || typeof payload !== "object") {
      return;
    }
    chunkCount += 1;
    const chunkText = extractCompletionText(payload);
    if (chunkText) {
      aggregatedText += chunkText;
      if (firstChunkAtMs <= 0) {
        firstChunkAtMs = Math.max(0, Date.now() - startedAtMs);
      }
    }
    if (payload.usage && typeof payload.usage === "object") {
      usage = payload.usage;
    }
  }

  if (!response.body || typeof response.body.getReader !== "function") {
    const rawText = await response.text();
    try {
      const parsed = JSON.parse(rawText);
      applyPayload(parsed);
      if (!aggregatedText) {
        aggregatedText = extractTextFromContent(parsed?.output_text) || "";
      }
    } catch (error) {
      aggregatedText = rawText;
    }
    return {
      text: aggregatedText,
      usage,
      firstChunkAtMs,
      chunkCount,
    };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf8");
  let buffer = "";

  function consumeLine(line) {
    const trimmed = String(line || "").trim();
    if (!trimmed || !trimmed.startsWith("data:")) {
      return;
    }
    const payloadText = trimmed.slice(5).trim();
    if (!payloadText || payloadText === "[DONE]") {
      return;
    }
    try {
      const payload = JSON.parse(payloadText);
      applyPayload(payload);
    } catch (error) {
      // ignore malformed data lines
    }
  }

  while (true) {
    const result = await reader.read();
    if (result.done) {
      break;
    }
    buffer += decoder.decode(result.value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";
    lines.forEach(consumeLine);
  }

  buffer += decoder.decode();
  buffer.split(/\r?\n/).forEach(consumeLine);

  return {
    text: aggregatedText,
    usage,
    firstChunkAtMs,
    chunkCount,
  };
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

function isWebSearchUnsupportedError(error) {
  if (!error || error.code !== "provider-http-error") {
    return false;
  }
  const summary = String(error.summary || error.message || "").toLowerCase();
  const hasWebSearchKey =
    summary.indexOf("enable_search") >= 0 ||
    summary.indexOf("search_options") >= 0 ||
    summary.indexOf("forced_search") >= 0 ||
    summary.indexOf("search_strategy") >= 0;
  if (!hasWebSearchKey) {
    return false;
  }
  return (
    summary.indexOf("unsupported") >= 0 ||
    summary.indexOf("invalid") >= 0 ||
    summary.indexOf("unknown") >= 0
  );
}

function removeWebSearchFields(requestBody) {
  const nextBody = Object.assign({}, requestBody);
  delete nextBody.enable_search;
  delete nextBody.search_options;
  delete nextBody.forced_search;
  delete nextBody.search_strategy;
  return nextBody;
}

async function requestChatCompletion(config, requestBody, options) {
  if (typeof fetch !== "function") {
    throw new Error("当前 Node 运行时不支持 fetch。");
  }

  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timeoutMs = Math.max(1000, Number(options?.timeoutMs) || config.timeoutMs || 60000);
  const timer = controller
    ? setTimeout(function () {
        controller.abort();
      }, timeoutMs)
    : null;

  const endpoint = config.baseUrl + "/chat/completions";
  const providerRequestStartedAt = Date.now();

  console.info("[ASR Judgement][ai] provider request start", {
    requestId: String(options?.requestId || ""),
    hostname: String(options?.hostname || ""),
    itemIndex: Number(options?.itemIndex || 0),
    model: String(options?.model || ""),
    stage: String(options?.stage || ""),
    enableThinking:
      Object.prototype.hasOwnProperty.call(requestBody || {}, "enable_thinking") &&
      typeof requestBody.enable_thinking === "boolean"
        ? requestBody.enable_thinking === true
        : null,
    webSearchEnabled:
      Object.prototype.hasOwnProperty.call(requestBody || {}, "enable_search") &&
      requestBody.enable_search === true,
  });

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + config.apiKey,
      },
      body: JSON.stringify(requestBody),
      signal: controller ? controller.signal : undefined,
    });

    const providerStatus = Number(response.status) || 0;
    console.info("[ASR Judgement][ai] provider response", {
      requestId: String(options?.requestId || ""),
      hostname: String(options?.hostname || ""),
      itemIndex: Number(options?.itemIndex || 0),
      model: String(options?.model || ""),
      stage: String(options?.stage || ""),
      providerStatus,
      durationMs: Math.max(0, Date.now() - providerRequestStartedAt),
    });

    if (!response.ok) {
      const bodyText = await response.text();
      const providerError = new Error(
        "Qwen 接口请求失败（HTTP " + String(response.status) + "）。"
      );
      providerError.code = "provider-http-error";
      providerError.statusCode = response.status;
      providerError.providerStatus = response.status;
      providerError.summary = sanitizeProviderErrorSummary(bodyText);
      throw providerError;
    }

    const completion = await readStreamCompletion(response, {
      startedAtMs: providerRequestStartedAt,
    });
    const text = String(completion.text || "");
    if (!text.trim()) {
      const emptyError = new Error("Qwen 接口未返回有效文本。");
      emptyError.code = "empty-provider-response";
      emptyError.statusCode = 502;
      throw emptyError;
    }

    console.info("[ASR Judgement][ai] provider stream complete", {
      requestId: String(options?.requestId || ""),
      hostname: String(options?.hostname || ""),
      itemIndex: Number(options?.itemIndex || 0),
      model: String(options?.model || ""),
      stage: String(options?.stage || ""),
      providerStatus,
      chunkCount: Number(completion.chunkCount || 0),
      rawTextLength: text.length,
      usage: completion.usage || {},
      durationMs: Math.max(0, Date.now() - providerRequestStartedAt),
    });

    return {
      text,
      usage: completion.usage || {},
      firstChunkAtMs: Number(completion.firstChunkAtMs || 0),
      chunkCount: Number(completion.chunkCount || 0),
      providerStatus,
      durationMs: Math.max(0, Date.now() - providerRequestStartedAt),
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("Qwen 请求超时。");
      timeoutError.code = "timeout";
      timeoutError.statusCode = 504;
      timeoutError.summary = "provider request aborted by timeout";
      throw timeoutError;
    }
    throw error;
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

async function requestWithThinkingFallback(config, requestBody, options) {
  const enableThinking = false;
  const webSearchEnabled = options?.webSearchEnabled === true;
  let currentBody = Object.assign({}, requestBody, {
    enable_thinking: enableThinking === true,
  });
  if (webSearchEnabled) {
    currentBody.enable_search = true;
  }

  let thinkingFallbackUsed = false;
  let thinkingFallbackMode = "";
  let webSearchFallbackUsed = false;
  let webSearchFallbackReason = "";
  const fallbackState = {
    thinking: false,
    webSearch: false,
  };

  while (true) {
    try {
      const completion = await requestChatCompletion(config, currentBody, options);
      const webSearchUsed = webSearchEnabled === true && currentBody.enable_search === true;
      return Object.assign({}, completion, {
        thinkingRequested: true,
        enableThinking: enableThinking,
        thinkingFallbackUsed: thinkingFallbackUsed,
        thinkingFallbackMode: thinkingFallbackMode,
        webSearchEnabled: webSearchEnabled,
        webSearchUsed: webSearchUsed,
        webSearchFallbackUsed: webSearchFallbackUsed,
        webSearchFallbackReason: webSearchFallbackReason,
      });
    } catch (error) {
      if (!fallbackState.thinking && isEnableThinkingUnsupportedError(error)) {
        fallbackState.thinking = true;
        thinkingFallbackUsed = true;
        thinkingFallbackMode = "remove";
        currentBody = Object.assign({}, currentBody);
        delete currentBody.enable_thinking;
        continue;
      }
      if (!fallbackState.webSearch && isWebSearchUnsupportedError(error)) {
        fallbackState.webSearch = true;
        webSearchFallbackUsed = true;
        webSearchFallbackReason = "provider unsupported";
        currentBody = removeWebSearchFields(currentBody);
        continue;
      }
      throw error;
    }
  }
}

function buildMockListenResponse(input) {
  return JSON.stringify({
    heardText: String(input?.asrText1 || "").trim(),
    confidence: 0.61,
    isValidAudio: true,
    invalidReasons: [],
    uncertainParts: [],
    audioNotes: "mock",
  });
}

function buildMockCompareResponse(input) {
  const answer =
    String(input?.asrText1 || "").length >= String(input?.asrText2 || "").length
      ? "first_better"
      : "second_better";
  return JSON.stringify({
    answer,
    answerText: answer === "first_better" ? "第一个更好" : "第二个更好",
    confidence: 0.62,
    reasonSummary: "Mock 模式输出，仅用于链路联调。",
    riskLevel: "medium",
    needManualSearch: false,
    shouldWarnBeforeApply: true,
    contextUsed: input?.includeContext === true,
    evidence: {
      heardText: String(input?.heardText || ""),
      asrText1Match: "medium",
      asrText2Match: "medium",
      contextHint: "",
    },
  });
}

async function requestListen(input, prompt, options) {
  const config = getClientConfig();
  const model = sanitizeModelName(options?.model, config.listenModel || DEFAULT_LISTEN_MODEL);
  const normalizedAiOptions = sanitizeAiOptions(options?.aiOptions);
  const enableThinking = false;
  const webSearchEnabled =
    typeof options?.webSearchEnabled === "boolean"
      ? options.webSearchEnabled === true
      : typeof options?.aiOptions?.webSearchEnabled === "boolean"
      ? options.aiOptions.webSearchEnabled === true
      : config.webSearchEnabledDefault === true;

  if (config.mockEnabled) {
    return {
      provider: "dashscope-qwen",
      model,
      rawText: buildMockListenResponse(input),
      usage: {},
      chunkCount: 0,
      firstChunkAtMs: 0,
      providerStatus: 200,
      durationMs: 0,
      mock: true,
      thinkingRequested: true,
      enableThinking,
      thinkingFallbackUsed: false,
      thinkingFallbackMode: "",
      webSearchEnabled: false,
      webSearchUsed: false,
      webSearchFallbackUsed: false,
      webSearchFallbackReason: "",
    };
  }

  if (!config.apiKey) {
    const error = new Error("missing-api-key");
    error.code = "missing-api-key";
    error.statusCode = 503;
    throw error;
  }

  const requestBody = {
    model,
    stream: true,
    stream_options: {
      include_usage: true,
    },
    modalities: ["text"],
    messages: [
      {
        role: "system",
        content: String(prompt?.systemPrompt || ""),
      },
      {
        role: "user",
        content: [
          {
            type: "input_audio",
            input_audio: {
              data: String(input?.audioUrl || ""),
              format: inferAudioFormat(input?.audioUrl || ""),
            },
          },
          {
            type: "text",
            text: String(prompt?.userPrompt || ""),
          },
        ],
      },
    ],
    response_format: {
      type: "json_object",
    },
    temperature: DEFAULT_REQUEST_PARAMS.temperature,
    top_p: DEFAULT_REQUEST_PARAMS.top_p,
    max_tokens: DEFAULT_REQUEST_PARAMS.max_tokens,
    presence_penalty: DEFAULT_REQUEST_PARAMS.presence_penalty,
    frequency_penalty: DEFAULT_REQUEST_PARAMS.frequency_penalty,
  };
  applyAiOptionsToRequestBody(requestBody, normalizedAiOptions);

  const completion = await requestWithThinkingFallback(config, requestBody, {
    requestId: options?.requestId,
    hostname: options?.hostname,
    itemIndex: options?.itemIndex,
    model,
    timeoutMs: options?.timeoutMs,
    stage: "listen",
    enableThinking,
    webSearchEnabled: false,
  });

  return {
    provider: "dashscope-qwen",
    model,
    rawText: completion.text,
    usage: completion.usage || {},
    chunkCount: completion.chunkCount,
    firstChunkAtMs: completion.firstChunkAtMs,
    providerStatus: completion.providerStatus,
    durationMs: completion.durationMs,
    mock: false,
    thinkingRequested: completion.thinkingRequested === true,
    enableThinking: completion.enableThinking === true,
    thinkingFallbackUsed: completion.thinkingFallbackUsed === true,
    thinkingFallbackMode: String(completion.thinkingFallbackMode || ""),
    webSearchEnabled: false,
    webSearchUsed: false,
    webSearchFallbackUsed: false,
    webSearchFallbackReason: "",
  };
}

async function requestCompare(input, prompt, options) {
  const config = getClientConfig();
  const model = sanitizeModelName(options?.model, config.compareModel || DEFAULT_COMPARE_MODEL);
  const normalizedAiOptions = sanitizeAiOptions(options?.aiOptions);
  const enableThinking = false;
  const webSearchEnabled =
    typeof options?.webSearchEnabled === "boolean"
      ? options.webSearchEnabled === true
      : typeof normalizedAiOptions.webSearchEnabled === "boolean"
      ? normalizedAiOptions.webSearchEnabled === true
      : typeof options?.aiOptions?.webSearchEnabled === "boolean"
      ? options.aiOptions.webSearchEnabled === true
      : typeof input?.aiOptions?.webSearchEnabled === "boolean"
      ? input.aiOptions.webSearchEnabled === true
      : config.webSearchEnabledDefault === true;

  if (config.mockEnabled) {
    return {
      provider: "dashscope-qwen",
      model,
      rawText: buildMockCompareResponse(input),
      usage: {},
      chunkCount: 0,
      firstChunkAtMs: 0,
      providerStatus: 200,
      durationMs: 0,
      mock: true,
      thinkingRequested: true,
      enableThinking,
      thinkingFallbackUsed: false,
      thinkingFallbackMode: "",
      webSearchEnabled: webSearchEnabled,
      webSearchUsed: webSearchEnabled,
      webSearchFallbackUsed: false,
      webSearchFallbackReason: "",
    };
  }

  if (!config.apiKey) {
    const error = new Error("missing-api-key");
    error.code = "missing-api-key";
    error.statusCode = 503;
    throw error;
  }

  const requestBody = {
    model,
    stream: true,
    stream_options: {
      include_usage: true,
    },
    modalities: ["text"],
    messages: [
      {
        role: "system",
        content: String(prompt?.systemPrompt || ""),
      },
      {
        role: "user",
        content: String(prompt?.userPrompt || ""),
      },
    ],
    response_format: {
      type: "json_object",
    },
    temperature: DEFAULT_REQUEST_PARAMS.temperature,
    top_p: DEFAULT_REQUEST_PARAMS.top_p,
    max_tokens: DEFAULT_REQUEST_PARAMS.max_tokens,
    presence_penalty: DEFAULT_REQUEST_PARAMS.presence_penalty,
    frequency_penalty: DEFAULT_REQUEST_PARAMS.frequency_penalty,
  };
  applyAiOptionsToRequestBody(requestBody, normalizedAiOptions);

  const completion = await requestWithThinkingFallback(config, requestBody, {
    requestId: options?.requestId,
    hostname: options?.hostname,
    itemIndex: options?.itemIndex,
    model,
    timeoutMs: options?.timeoutMs,
    stage: "compare",
    enableThinking,
    webSearchEnabled,
  });

  return {
    provider: "dashscope-qwen",
    model,
    rawText: completion.text,
    usage: completion.usage || {},
    chunkCount: completion.chunkCount,
    firstChunkAtMs: completion.firstChunkAtMs,
    providerStatus: completion.providerStatus,
    durationMs: completion.durationMs,
    mock: false,
    thinkingRequested: completion.thinkingRequested === true,
    enableThinking: completion.enableThinking === true,
    thinkingFallbackUsed: completion.thinkingFallbackUsed === true,
    thinkingFallbackMode: String(completion.thinkingFallbackMode || ""),
    webSearchEnabled: completion.webSearchEnabled === true,
    webSearchUsed: completion.webSearchUsed === true,
    webSearchFallbackUsed: completion.webSearchFallbackUsed === true,
    webSearchFallbackReason: String(completion.webSearchFallbackReason || ""),
  };
}

module.exports = {
  DEFAULT_BASE_URL,
  DEFAULT_LISTEN_MODEL,
  DEFAULT_COMPARE_MODEL,
  DEFAULT_REQUEST_PARAMS,
  SUPPORTED_REQUEST_PARAMS,
  getClientConfig,
  inferAudioFormat,
  isEnableThinkingUnsupportedError,
  isMockEnabled,
  readStreamCompletion,
  requestListen,
  requestCompare,
  sanitizeModelName,
};

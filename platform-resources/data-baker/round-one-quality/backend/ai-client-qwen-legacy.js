"use strict";

const {
  createProviderHttpError,
  createRateLimitError,
  createTimeoutError,
  isRateLimitProviderCode,
  normalizeAbortError,
} = require("../../../backend/ai/errors");
const {
  sanitizeProviderDebugJson,
  sanitizeProviderDebugPayload,
  sanitizeProviderDebugText,
  sanitizeProviderErrorSummary,
} = require("../../../backend/ai/sanitizer");

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

function isMockEnabled() {
  return String(process.env.DATABAKER_AI_MOCK || "").trim() === "1";
}

function parseTimeoutMs() {
  const value = Number(process.env.DATABAKER_AI_TIMEOUT_MS || 60000);
  if (!Number.isFinite(value)) {
    return 60000;
  }
  return Math.max(1000, Math.min(300000, Math.floor(value)));
}

function parseEnableThinkingDefault() {
  return String(process.env.DATABAKER_AI_ENABLE_THINKING || "0").trim() === "1";
}

function resolveThinkingPreference(options, config) {
  void options;
  void config;
  return {
    source: "forced-off",
    enabled: false,
  };
}

function withThinkingPreference(requestBody, preference) {
  return Object.assign({}, requestBody || {}, {
    enable_thinking: preference?.enabled === true,
  });
}

function withoutThinkingPreference(requestBody) {
  const nextBody = Object.assign({}, requestBody || {});
  delete nextBody.enable_thinking;
  return nextBody;
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

function inferAudioFormat(audioUrl) {
  let pathname = "";
  try {
    pathname = new URL(String(audioUrl || "")).pathname || "";
  } catch (error) {
    pathname = String(audioUrl || "").split("?")[0] || "";
  }
  const matched = String(pathname || "").toLowerCase().match(/\.([a-z0-9]+)$/);
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
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    return null;
  }
  return number;
}

function normalizeIntegerInRange(value, min, max) {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number) || number < min || number > max) {
    return null;
  }
  return number;
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

function getClientConfig() {
  const apiKey = String(process.env.DASHSCOPE_API_KEY || "").trim();
  const baseUrl = trimSlash(process.env.DASHSCOPE_BASE_URL || DEFAULT_BASE_URL);
  const listenModel = String(
    process.env.DATABAKER_AI_LISTEN_MODEL || process.env.DATABAKER_AI_OMNI_MODEL || DEFAULT_LISTEN_MODEL
  ).trim();
  const compareModel = String(
    process.env.DATABAKER_AI_COMPARE_MODEL || DEFAULT_COMPARE_MODEL
  ).trim();
  return {
    apiKey,
    baseUrl,
    listenModel: listenModel || DEFAULT_LISTEN_MODEL,
    compareModel: compareModel || DEFAULT_COMPARE_MODEL,
    timeoutMs: parseTimeoutMs(),
    mockEnabled: isMockEnabled(),
    hasApiKey: Boolean(apiKey),
    enableThinkingDefault: parseEnableThinkingDefault(),
  };
}

function buildMockListenResponse(input) {
  return JSON.stringify({
    heardText: String(input?.pageText || "").trim() || "mock 听音文本",
    confidence: 0.82,
    isValid: true,
    invalidReasons: [],
  });
}

function buildMockCompareResponse(input, heardText) {
  const pageText = String(input?.pageText || "").trim();
  const recommendedText = String(heardText || pageText || "mock 推荐文本").trim();
  return JSON.stringify({
    recommendedText,
    decision: recommendedText === pageText ? "keep_page_text" : "use_heard_text",
    changePoints: recommendedText === pageText ? [] : ["Mock 模式：推荐文本与页面候选文本不同。"],
    confidence: 0.8,
    needHumanReview: true,
  });
}

function buildMockProviderErrorBody() {
  return '{"error":"mock provider http error","audioUrl":"https://example.com/audio.wav?token=secret"}';
}

function extractDeltaText(chunk) {
  const choice = Array.isArray(chunk?.choices) ? chunk.choices[0] : null;
  if (!choice) {
    return "";
  }
  const deltaContent = choice?.delta?.content;
  if (typeof deltaContent === "string") {
    return deltaContent;
  }
  if (Array.isArray(deltaContent)) {
    return deltaContent
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
  const messageContent = choice?.message?.content;
  if (typeof messageContent === "string") {
    return messageContent;
  }
  if (Array.isArray(messageContent)) {
    return messageContent
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

function summarizeLastChunk(payload) {
  const source = payload && typeof payload === "object" ? payload : {};
  const choice = Array.isArray(source.choices) ? source.choices[0] : null;
  return {
    hasChoices: Boolean(choice),
    finishReason: String(choice?.finish_reason || ""),
    deltaKeys:
      choice?.delta && typeof choice.delta === "object"
        ? Object.keys(choice.delta).slice(0, 12)
        : [],
    usageKeys:
      source.usage && typeof source.usage === "object"
        ? Object.keys(source.usage).slice(0, 12)
        : [],
  };
}

function createQwenEmptyResponseError(model, stage, result) {
  const error = new Error("Qwen 接口未返回有效文本。");
  error.code = "qwen-empty-response";
  error.statusCode = 502;
  error.debugRawAiResponse = {
    provider: "legacy-omni",
    model: String(model || ""),
    stage: String(stage || "unknown"),
    rawSseText: sanitizeProviderDebugText(result?.rawSseText || "", 20000),
    rawResponseText: sanitizeProviderDebugText(result?.rawResponseText || "", 20000),
    usage: sanitizeProviderDebugJson(result?.usage || {}, {
      textLimit: 4000,
      maxDepth: 4,
      maxObjectKeys: 40,
    }),
    parsedChunksCount: Number(result?.parsedChunksCount) || 0,
    extractedTextLength: Number(result?.extractedTextLength) || 0,
    finishReason: String(result?.finishReason || ""),
    lastChunkSummary: sanitizeProviderDebugJson(result?.lastChunkSummary || {}, {
      textLimit: 4000,
      maxDepth: 4,
      maxObjectKeys: 40,
    }),
  };
  return error;
}

function createQwenSseProviderError(model, stage, providerError, result) {
  const code = String(providerError?.code || providerError?.type || "").trim();
  const message = String(providerError?.message || "").trim();
  const isBurstRateLimited = isRateLimitProviderCode(code);
  const error = isBurstRateLimited
    ? createRateLimitError(message, {
        code: "qwen-burst-rate-limited",
        message: "Qwen 请求突增限流，接口返回请求增长过快。",
        providerCode: code,
        providerStatus: 429,
      })
    : createProviderHttpError(
        429,
        message || JSON.stringify(providerError || {}),
        "Qwen SSE 返回错误。"
      );
  error.providerStatus = 429;
  error.providerCode = code;
  error.summary = sanitizeProviderErrorSummary(message || JSON.stringify(providerError || {}));
  error.debugRawAiResponse = {
    provider: "legacy-omni",
    model: String(model || ""),
    stage: String(stage || "unknown"),
    providerStatus: 429,
    providerCode: code,
    error: sanitizeProviderDebugJson(providerError || {}, {
      textLimit: 4000,
      maxDepth: 4,
      maxObjectKeys: 40,
    }),
    rawSseText: sanitizeProviderDebugText(result?.rawSseText || "", 20000),
    rawResponseText: sanitizeProviderDebugText(result?.rawResponseText || "", 20000),
    usage: sanitizeProviderDebugJson(result?.usage || {}, {
      textLimit: 4000,
      maxDepth: 4,
      maxObjectKeys: 40,
    }),
    parsedChunksCount: Number(result?.parsedChunksCount) || 0,
    extractedTextLength: Number(result?.extractedTextLength) || 0,
    finishReason: String(result?.finishReason || ""),
    lastChunkSummary: sanitizeProviderDebugJson(result?.lastChunkSummary || {}, {
      textLimit: 4000,
      maxDepth: 4,
      maxObjectKeys: 40,
    }),
  };
  return error;
}

async function readStreamCompletion(response) {
  if (!response.body || typeof response.body.getReader !== "function") {
    const text = await response.text();
    try {
      const parsed = JSON.parse(text);
      return {
        text: extractDeltaText(parsed) || text,
        usage: parsed.usage || {},
        rawSseText: text,
        rawResponseText: text,
        parsedChunksCount: 1,
        extractedTextLength: String(extractDeltaText(parsed) || text || "").trim().length,
        finishReason: String(parsed?.choices?.[0]?.finish_reason || ""),
        lastChunkSummary: summarizeLastChunk(parsed),
        providerError: parsed?.error && typeof parsed.error === "object" ? parsed.error : null,
      };
    } catch (error) {
      return {
        text,
        usage: {},
        rawSseText: text,
        rawResponseText: text,
        parsedChunksCount: 0,
        extractedTextLength: String(text || "").trim().length,
        finishReason: "",
        lastChunkSummary: null,
      };
    }
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf8");
  let buffer = "";
  let aggregatedText = "";
  let usage = {};
  let rawSseText = "";
  let parsedChunksCount = 0;
  let finishReason = "";
  let lastChunkSummary = null;
  let providerError = null;

  function consumeLine(line) {
    const trimmed = String(line || "").trim();
    if (!trimmed || !trimmed.startsWith("data:")) {
      return;
    }
    rawSseText += String(line || "") + "\n";
    const payloadText = trimmed.slice(5).trim();
    if (!payloadText || payloadText === "[DONE]") {
      return;
    }
    try {
      const payload = JSON.parse(payloadText);
      parsedChunksCount += 1;
      if (payload?.error && typeof payload.error === "object") {
        providerError = payload.error;
      }
      aggregatedText += extractDeltaText(payload);
      if (payload.usage && typeof payload.usage === "object") {
        usage = payload.usage;
      }
      if (payload?.choices?.[0]?.finish_reason) {
        finishReason = String(payload.choices[0].finish_reason || "");
      }
      lastChunkSummary = summarizeLastChunk(payload);
    } catch (error) {
      // ignore non-json chunks
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
    rawSseText,
    rawResponseText: rawSseText,
    parsedChunksCount,
    extractedTextLength: String(aggregatedText || "").trim().length,
    finishReason,
    lastChunkSummary,
    providerError,
  };
}

function isAbortSignalAborted(signal) {
  return Boolean(signal && signal.aborted === true);
}

function bindAbortSignal(controller, signal) {
  if (!controller || !signal || typeof signal.addEventListener !== "function") {
    return function () {};
  }
  if (signal.aborted) {
    try {
      controller.abort(signal.reason);
    } catch (error) {
      controller.abort();
    }
    return function () {};
  }
  const onAbort = function () {
    try {
      controller.abort(signal.reason);
    } catch (error) {
      controller.abort();
    }
  };
  signal.addEventListener("abort", onAbort, { once: true });
  return function () {
    signal.removeEventListener("abort", onAbort);
  };
}

async function requestChatCompletion(requestBody, options) {
  const config = getClientConfig();
  if (!config.apiKey) {
    const error = new Error("missing-api-key");
    error.code = "missing-api-key";
    error.statusCode = 503;
    throw error;
  }
  if (typeof fetch !== "function") {
    throw new Error("当前 Node 运行时不支持 fetch。");
  }
  const signal = options?.signal;
  if (isAbortSignalAborted(signal)) {
    throw normalizeAbortError(signal.reason, "当前任务超过60s，请重新请求。", "aborted", 504);
  }

  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const unbindAbort = bindAbortSignal(controller, signal);
  const timeoutMs = Math.max(1000, Number(options?.timeoutMs) || config.timeoutMs);
  const timer = controller
    ? setTimeout(function () {
        controller.abort();
      }, timeoutMs)
    : null;

  try {
    const model = String(requestBody?.model || options?.model || "").trim();
    const stage = String(options?.stage || "unknown").trim() || "unknown";
    const response = await fetch(config.baseUrl + "/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + config.apiKey,
      },
      body: JSON.stringify(requestBody),
      signal: controller ? controller.signal : undefined,
    });

    if (!response.ok) {
      const bodyText = await response.text();
      const error = createProviderHttpError(
        response.status,
        bodyText,
        "Qwen 接口请求失败（HTTP " + String(response.status) + "）。"
      );
      error.providerStatus = Number(response.status) || 0;
      error.debugRawAiResponse = {
        provider: "legacy-omni",
        model,
        stage,
        providerStatus: Number(response.status) || 0,
        responseBody: sanitizeProviderDebugPayload(bodyText || "", { textLimit: 20000 }),
      };
      throw error;
    }

    const result = await readStreamCompletion(response);
    if (result?.providerError && typeof result.providerError === "object") {
      throw createQwenSseProviderError(model, stage, result.providerError, result);
    }
    if (!String(result.text || "").trim()) {
      throw createQwenEmptyResponseError(model, stage, result);
    }
    return result;
  } catch (error) {
    if (error?.name === "AbortError") {
      if (isAbortSignalAborted(signal)) {
        throw normalizeAbortError(signal.reason, "当前任务超过60s，请重新请求。", "aborted", 504);
      }
      throw createTimeoutError("Qwen 请求超时。");
    }
    throw error;
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
    unbindAbort();
  }
}

async function requestChatCompletionWithThinkingFallback(requestBody, options) {
  const config = getClientConfig();
  const thinkingPreference = resolveThinkingPreference(options, config);
  const initialBody = withThinkingPreference(requestBody, thinkingPreference);
  try {
    const result = await requestChatCompletion(initialBody, options);
    return Object.assign({}, result, {
      enableThinkingRequested: true,
      enableThinking: thinkingPreference.enabled === true,
      thinkingPreferenceSource: thinkingPreference.source,
      thinkingFallbackUsed: false,
      thinkingFallbackMode: "",
      thinkingDisabledRequested: thinkingPreference.enabled !== true,
      thinkingDisableFallbackUsed: false,
    });
  } catch (error) {
    if (!isEnableThinkingUnsupportedError(error)) {
      throw error;
    }
    const fallbackResult = await requestChatCompletion(
      withoutThinkingPreference(initialBody),
      options
    );
    return Object.assign({}, fallbackResult, {
      enableThinkingRequested: true,
      enableThinking: thinkingPreference.enabled === true,
      thinkingPreferenceSource: thinkingPreference.source,
      thinkingFallbackUsed: true,
      thinkingFallbackMode: "remove",
      thinkingDisabledRequested: thinkingPreference.enabled !== true,
      thinkingDisableFallbackUsed: true,
    });
  }
}

async function requestListen(input, prompt, options) {
  const config = getClientConfig();
  const model = String(options?.model || config.listenModel || DEFAULT_LISTEN_MODEL).trim() || DEFAULT_LISTEN_MODEL;
  const mockResponseMode = String(input?.aiOptions?.mockResponseMode || "").trim().toLowerCase();
    if (config.mockEnabled) {
      if (mockResponseMode === "provider-http-error") {
      const error = createProviderHttpError(502, "mock qwen provider http error", "Qwen 接口请求失败（HTTP 502）。");
      error.providerStatus = 502;
      error.debugRawAiResponse = {
        provider: "legacy-omni",
        model,
        stage: "listen",
        providerStatus: 502,
        responseBody: sanitizeProviderDebugPayload(buildMockProviderErrorBody(), { textLimit: 20000 }),
        };
        throw error;
      }
      if (mockResponseMode === "qwen-burst-rate-limited") {
        throw createQwenSseProviderError(
          model,
          "listen",
          {
            code: "limit_burst_rate",
            message: "Request rate increased too quickly.",
            type: "limit_burst_rate",
          },
          {
            rawSseText:
              'data: {"error":{"code":"limit_burst_rate","message":"Request rate increased too quickly.","type":"limit_burst_rate"}}\n',
            rawResponseText:
              'data: {"error":{"code":"limit_burst_rate","message":"Request rate increased too quickly.","type":"limit_burst_rate"}}\n',
            parsedChunksCount: 1,
            extractedTextLength: 0,
            finishReason: "",
            lastChunkSummary: { hasChoices: false, finishReason: "", deltaKeys: [], usageKeys: [] },
            usage: null,
          }
        );
      }
      if (mockResponseMode === "qwen-empty-response") {
        throw createQwenEmptyResponseError(model, "listen", {
          rawSseText: "data: [DONE]",
          rawResponseText: "",
          parsedChunksCount: 0,
          extractedTextLength: 0,
          finishReason: "stop",
          lastChunkSummary: null,
          usage: null,
        });
      }
      const preference = resolveThinkingPreference(options, config);
      return {
        model,
        rawText:
          mockResponseMode === "model-json-parse-failed"
            ? "mock-not-json-response"
            : buildMockListenResponse(input),
      usage: {
        prompt_tokens: 120,
        completion_tokens: 40,
        total_tokens: 160,
      },
      mock: true,
      enableThinkingRequested: true,
      enableThinking: preference.enabled === true,
      thinkingPreferenceSource: preference.source,
      thinkingFallbackUsed: false,
      thinkingFallbackMode: "",
      thinkingDisabledRequested: preference.enabled !== true,
      thinkingDisableFallbackUsed: false,
    };
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
    temperature: DEFAULT_REQUEST_PARAMS.temperature,
    top_p: DEFAULT_REQUEST_PARAMS.top_p,
    max_tokens: DEFAULT_REQUEST_PARAMS.max_tokens,
    presence_penalty: DEFAULT_REQUEST_PARAMS.presence_penalty,
    frequency_penalty: DEFAULT_REQUEST_PARAMS.frequency_penalty,
  };
  applyAiOptionsToRequestBody(requestBody, input?.aiOptions);
  const result = await requestChatCompletionWithThinkingFallback(
    requestBody,
    Object.assign({}, options || {}, { stage: "listen" })
  );
  return {
    model,
    rawText: result.text,
    usage: result.usage,
    rawSseText: result.rawSseText || "",
    rawResponseText: result.rawResponseText || "",
    parsedChunksCount: Number(result.parsedChunksCount) || 0,
    extractedTextLength: Number(result.extractedTextLength) || 0,
    finishReason: String(result.finishReason || ""),
    lastChunkSummary: result.lastChunkSummary || null,
    mock: false,
    enableThinkingRequested: result.enableThinkingRequested === true,
    enableThinking: result.enableThinking === true,
    thinkingPreferenceSource: result.thinkingPreferenceSource || "",
    thinkingFallbackUsed: result.thinkingFallbackUsed === true,
    thinkingFallbackMode: result.thinkingFallbackMode || "",
    thinkingDisabledRequested: result.thinkingDisabledRequested,
    thinkingDisableFallbackUsed: result.thinkingDisableFallbackUsed,
  };
}

async function requestCompare(input, prompt, heardText, options) {
  const config = getClientConfig();
  const model = String(options?.model || config.compareModel || DEFAULT_COMPARE_MODEL).trim() || DEFAULT_COMPARE_MODEL;
  const mockResponseMode = String(input?.aiOptions?.mockResponseMode || "").trim().toLowerCase();
    if (config.mockEnabled) {
      if (mockResponseMode === "provider-http-error") {
      const error = createProviderHttpError(502, "mock qwen provider http error", "Qwen 接口请求失败（HTTP 502）。");
      error.providerStatus = 502;
      error.debugRawAiResponse = {
        provider: "legacy-omni",
        model,
        stage: "compare",
        providerStatus: 502,
        responseBody: sanitizeProviderDebugPayload(buildMockProviderErrorBody(), { textLimit: 20000 }),
        };
        throw error;
      }
      if (mockResponseMode === "qwen-burst-rate-limited") {
        throw createQwenSseProviderError(
          model,
          "compare",
          {
            code: "limit_burst_rate",
            message: "Request rate increased too quickly.",
            type: "limit_burst_rate",
          },
          {
            rawSseText:
              'data: {"error":{"code":"limit_burst_rate","message":"Request rate increased too quickly.","type":"limit_burst_rate"}}\n',
            rawResponseText:
              'data: {"error":{"code":"limit_burst_rate","message":"Request rate increased too quickly.","type":"limit_burst_rate"}}\n',
            parsedChunksCount: 1,
            extractedTextLength: 0,
            finishReason: "",
            lastChunkSummary: { hasChoices: false, finishReason: "", deltaKeys: [], usageKeys: [] },
            usage: null,
          }
        );
      }
      if (mockResponseMode === "qwen-empty-response") {
        throw createQwenEmptyResponseError(model, "compare", {
          rawSseText: "data: [DONE]",
          rawResponseText: "",
          parsedChunksCount: 0,
          extractedTextLength: 0,
          finishReason: "stop",
          lastChunkSummary: null,
          usage: null,
        });
      }
      const preference = resolveThinkingPreference(options, config);
      return {
        model,
        rawText:
          mockResponseMode === "model-json-parse-failed"
            ? "mock-not-json-response"
            : buildMockCompareResponse(input, heardText),
      usage: {
        prompt_tokens: 180,
        completion_tokens: 70,
        total_tokens: 250,
      },
      mock: true,
      enableThinkingRequested: true,
      enableThinking: preference.enabled === true,
      thinkingPreferenceSource: preference.source,
      thinkingFallbackUsed: false,
      thinkingFallbackMode: "",
      thinkingDisabledRequested: preference.enabled !== true,
      thinkingDisableFallbackUsed: false,
    };
  }

  const requestBody = {
    model,
    stream: true,
    stream_options: {
      include_usage: true,
    },
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
  applyAiOptionsToRequestBody(requestBody, input?.aiOptions);
  const result = await requestChatCompletionWithThinkingFallback(
    requestBody,
    Object.assign({}, options || {}, { stage: "compare" })
  );
  return {
    model,
    rawText: result.text,
    usage: result.usage,
    rawSseText: result.rawSseText || "",
    rawResponseText: result.rawResponseText || "",
    parsedChunksCount: Number(result.parsedChunksCount) || 0,
    extractedTextLength: Number(result.extractedTextLength) || 0,
    finishReason: String(result.finishReason || ""),
    lastChunkSummary: result.lastChunkSummary || null,
    mock: false,
    enableThinkingRequested: result.enableThinkingRequested === true,
    enableThinking: result.enableThinking === true,
    thinkingPreferenceSource: result.thinkingPreferenceSource || "",
    thinkingFallbackUsed: result.thinkingFallbackUsed === true,
    thinkingFallbackMode: result.thinkingFallbackMode || "",
    thinkingDisabledRequested: result.thinkingDisabledRequested,
    thinkingDisableFallbackUsed: result.thinkingDisableFallbackUsed,
  };
}

module.exports = {
  DEFAULT_BASE_URL,
  DEFAULT_COMPARE_MODEL,
  DEFAULT_LISTEN_MODEL,
  DEFAULT_REQUEST_PARAMS,
  SUPPORTED_REQUEST_PARAMS,
  getClientConfig,
  inferAudioFormat,
  isEnableThinkingUnsupportedError,
  requestChatCompletionWithThinkingFallback,
  requestCompare,
  requestListen,
  resolveThinkingPreference,
  sanitizeProviderErrorSummary,
  withThinkingPreference,
};

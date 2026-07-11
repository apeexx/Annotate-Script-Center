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

function readProfileEnv(suffix, fallback) {
  const scopedName = "MAGIC_DATA_MINNAN_" + String(suffix || "");
  const legacyName = "MAGIC_DATA_AI_" + String(suffix || "");
  const scopedValue = process.env[scopedName];
  if (scopedValue !== undefined && scopedValue !== null && String(scopedValue).trim() !== "") {
    return scopedValue;
  }
  const legacyValue = process.env[legacyName];
  if (legacyValue !== undefined && legacyValue !== null && String(legacyValue).trim() !== "") {
    return legacyValue;
  }
  return fallback;
}

function isMockEnabled() {
  return String(readProfileEnv("MOCK", "0")).trim() === "1";
}

function removeThinkingField(requestBody) {
  const nextBody = Object.assign({}, requestBody || {});
  delete nextBody.enable_thinking;
  return nextBody;
}

function parseEnableThinkingDefault() {
  return String(readProfileEnv("ENABLE_THINKING", "0")).trim() === "1";
}

function resolveThinkingPreference(options) {
  void options;
  return {
    source: "forced-off",
    enabled: false,
  };
}

function withThinkingPreference(requestBody, preference) {
  const nextBody = Object.assign({}, requestBody || {});
  nextBody.enable_thinking = preference?.enabled === true;
  return nextBody;
}

function parseTimeoutMs() {
  const value = Number(readProfileEnv("TIMEOUT_MS", 60000));
  if (!Number.isFinite(value)) {
    return 60000;
  }
  return Math.max(1000, Math.min(300000, value));
}

function parseBooleanProfileEnv(suffix, fallback) {
  const value = String(readProfileEnv(suffix, "") || "").trim().toLowerCase();
  if (!value) {
    return fallback === true;
  }
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

function sanitizeModelName(value, fallback) {
  const text = String(value || "").replace(/[\r\n]+/g, " ").trim();
  if (!text) {
    return String(fallback || "").trim();
  }
  return text.slice(0, 80);
}

function inferAudioFormat(audioUrl) {
  let pathname = "";
  try {
    pathname = new URL(String(audioUrl || "")).pathname || "";
  } catch (error) {
    pathname = String(audioUrl || "").split("?")[0] || "";
  }
  const matched = pathname.toLowerCase().match(/\.([a-z0-9]+)$/);
  const ext = matched ? matched[1] : "";
  const map = {
    wav: "wav",
    mp3: "mp3",
    aac: "aac",
    m4a: "m4a",
    amr: "amr",
    "3gp": "3gp",
    "3gpp": "3gpp",
  };
  return map[ext] || "wav";
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

function getClientConfig() {
  const apiKey = String(process.env.DASHSCOPE_API_KEY || "").trim();
  const baseUrl = trimSlash(process.env.DASHSCOPE_BASE_URL || DEFAULT_BASE_URL);
  const listenModel = sanitizeModelName(readProfileEnv("LISTEN_MODEL", ""), DEFAULT_LISTEN_MODEL);
  const compareModel = sanitizeModelName(readProfileEnv("COMPARE_MODEL", ""), DEFAULT_COMPARE_MODEL);
  const pipelineMode = String(readProfileEnv("PIPELINE_MODE", "two_stage") || "two_stage").trim();
  const lexiconRewriteMode = String(readProfileEnv("LEXICON_REWRITE_MODE", "off") || "off").trim();
  const allowClientModelOverride = parseBooleanProfileEnv("ALLOW_CLIENT_MODEL_OVERRIDE", true);
  const enableThinkingDefault = parseEnableThinkingDefault();
  return {
    apiKey,
    baseUrl,
    listenModel: listenModel || DEFAULT_LISTEN_MODEL,
    compareModel: compareModel || DEFAULT_COMPARE_MODEL,
    timeoutMs: parseTimeoutMs(),
    mockEnabled: isMockEnabled(),
    hasApiKey: Boolean(apiKey),
    pipelineMode: pipelineMode === "listen_only" ? "listen_only" : "two_stage",
    lexiconRewriteMode: lexiconRewriteMode || "off",
    allowClientModelOverride,
    enableThinkingDefault,
  };
}

function sanitizeProviderErrorSummary(text) {
  return String(text || "")
    .replace(/https?:\/\/[^\s"'\\]+/g, function (urlText) {
      try {
        const parsedUrl = new URL(urlText);
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

async function readStreamCompletion(response) {
  if (!response.body || typeof response.body.getReader !== "function") {
    const text = await response.text();
    try {
      const parsed = JSON.parse(text);
      return {
        text: extractDeltaText(parsed) || text,
        usage: parsed.usage || {},
      };
    } catch (error) {
      return {
        text,
        usage: {},
      };
    }
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf8");
  let buffer = "";
  let aggregatedText = "";
  let usage = {};

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
      aggregatedText += extractDeltaText(payload);
      if (payload.usage && typeof payload.usage === "object") {
        usage = payload.usage;
      }
    } catch (error) {
      // ignore malformed data line
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
  };
}

async function requestChatCompletion(requestBody, options) {
  const config = getClientConfig();
  if (!config.apiKey) {
    const missingKeyError = new Error("missing-api-key");
    missingKeyError.code = "missing-api-key";
    missingKeyError.statusCode = 503;
    throw missingKeyError;
  }
  if (typeof fetch !== "function") {
    throw new Error("当前 Node 运行时不支持 fetch。");
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

    if (!response.ok) {
      const bodyText = await response.text();
      const providerError = new Error(
        "Qwen 接口请求失败（HTTP " + String(response.status) + "）。"
      );
      providerError.code = "provider-http-error";
      providerError.statusCode = response.status;
      providerError.summary = sanitizeProviderErrorSummary(bodyText);
      throw providerError;
    }

    const result = await readStreamCompletion(response);
    if (!String(result.text || "").trim()) {
      const emptyError = new Error("Qwen 接口未返回有效文本。");
      emptyError.code = "empty-provider-response";
      throw emptyError;
    }
    return result;
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

async function requestChatCompletionWithFallback(requestBody, options) {
  const thinkingPreference = resolveThinkingPreference(options);
  const initialBody = withThinkingPreference(requestBody, thinkingPreference);
  try {
    const result = await requestChatCompletion(initialBody, options || {});
    return Object.assign({}, result, {
      enableThinkingRequested: true,
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
    const fallbackResult = await requestChatCompletion(fallbackBody, options || {});
    return Object.assign({}, fallbackResult, {
      enableThinkingRequested: true,
      enableThinking: thinkingPreference.enabled === true,
      thinkingPreferenceSource: thinkingPreference.source,
      thinkingFallbackUsed: true,
      thinkingFallbackMode: fallbackMode,
    });
  }
}

function buildMockListenResponse(input) {
  return JSON.stringify({
    heardDialectText: String(input?.platformDialectText || "").trim() || "mock 听音文本",
    heardMandarinMeaning: String(input?.platformMandarinText || "").trim() || "mock 普通话意思",
    isValidAudio: true,
    invalidReasons: [],
    riskFlags: [],
    confidence: 0.82,
  });
}

function buildMockCompareResponse(input) {
  const dialectText = String(input?.platformDialectText || "").trim();
  const mandarinText = String(input?.platformMandarinText || "").trim();
  return JSON.stringify({
    verdict: "mostly_same",
    shouldReview: true,
    confidence: 0.78,
    dialectLine: {
      decision: "minor_diff",
      platformText: dialectText,
      aiText: dialectText,
      recommendedText: dialectText,
      issues: [],
    },
    mandarinLine: {
      decision: "same",
      platformText: mandarinText,
      recommendedText: mandarinText,
      issues: [],
    },
    lexiconIssues: [],
    ruleIssues: [],
  });
}

async function requestListen(input, prompt, options) {
  const config = getClientConfig();
  const model = sanitizeModelName(options?.model, config.listenModel || DEFAULT_LISTEN_MODEL);
  if (config.mockEnabled) {
    return {
      model,
      rawText: buildMockListenResponse(input),
      usage: {
        prompt_tokens: 160,
        completion_tokens: 80,
        total_tokens: 240,
      },
      mock: true,
      enableThinkingRequested: true,
      enableThinking: resolveThinkingPreference(options).enabled === true,
      thinkingPreferenceSource: resolveThinkingPreference(options).source,
      thinkingFallbackUsed: false,
      thinkingFallbackMode: "",
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
  const result = await requestChatCompletionWithFallback(requestBody, options);
  return {
    model,
    rawText: result.text,
    usage: result.usage,
    mock: false,
    enableThinkingRequested: result.enableThinkingRequested,
    enableThinking: result.enableThinking,
    thinkingPreferenceSource: result.thinkingPreferenceSource,
    thinkingFallbackUsed: result.thinkingFallbackUsed,
    thinkingFallbackMode: result.thinkingFallbackMode,
  };
}

async function requestOmniSingle(input, prompt, options) {
  return requestListen(input, prompt, options);
}

async function requestCompare(input, prompt, options) {
  const config = getClientConfig();
  const model = sanitizeModelName(options?.model, config.compareModel || DEFAULT_COMPARE_MODEL);
  if (config.mockEnabled) {
    return {
      model,
      rawText: buildMockCompareResponse(input),
      usage: {
        prompt_tokens: 220,
        completion_tokens: 90,
        total_tokens: 310,
      },
      mock: true,
      enableThinkingRequested: true,
      enableThinking: resolveThinkingPreference(options).enabled === true,
      thinkingPreferenceSource: resolveThinkingPreference(options).source,
      thinkingFallbackUsed: false,
      thinkingFallbackMode: "",
    };
  }

  const requestBody = {
    model,
    stream: true,
    stream_options: {
      include_usage: true,
    },
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
        content: String(prompt?.userPrompt || ""),
      },
    ],
    temperature: DEFAULT_REQUEST_PARAMS.temperature,
    top_p: DEFAULT_REQUEST_PARAMS.top_p,
    max_tokens: DEFAULT_REQUEST_PARAMS.max_tokens,
    presence_penalty: DEFAULT_REQUEST_PARAMS.presence_penalty,
    frequency_penalty: DEFAULT_REQUEST_PARAMS.frequency_penalty,
  };
  applyAiOptionsToRequestBody(requestBody, input?.aiOptions);
  const result = await requestChatCompletionWithFallback(requestBody, options);
  return {
    model,
    rawText: result.text,
    usage: result.usage,
    mock: false,
    enableThinkingRequested: result.enableThinkingRequested,
    enableThinking: result.enableThinking,
    thinkingPreferenceSource: result.thinkingPreferenceSource,
    thinkingFallbackUsed: result.thinkingFallbackUsed,
    thinkingFallbackMode: result.thinkingFallbackMode,
  };
}

module.exports = {
  DEFAULT_COMPARE_MODEL,
  DEFAULT_LISTEN_MODEL,
  DEFAULT_REQUEST_PARAMS,
  SUPPORTED_REQUEST_PARAMS,
  getClientConfig,
  inferAudioFormat,
  sanitizeModelName,
  requestCompare,
  requestListen,
  requestOmniSingle,
};

"use strict";

const {
  DEFAULT_OMNI_MODEL,
  DEFAULT_REQUEST_PARAMS,
  getQwenProviderConfig,
} = require("../../../backend/ai/config");
const {
  createProviderHttpError,
  createTimeoutError,
  normalizeAbortError,
} = require("../../../backend/ai/errors");
const {
  sanitizeProviderDebugJson,
  sanitizeProviderDebugPayload,
  sanitizeProviderDebugText,
} = require("../../../backend/ai/sanitizer");

function inferAudioFormat(audioUrl) {
  let pathname = "";
  try {
    pathname = new URL(String(audioUrl || "")).pathname || "";
  } catch (_error) {
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

function applyRequestParams(requestBody, requestParams) {
  const source = requestParams && typeof requestParams === "object" ? requestParams : {};
  const temperature = normalizeNumberInRange(source.temperature, 0, 2);
  if (temperature !== null) {
    requestBody.temperature = temperature;
  }
  const topP = normalizeNumberInRange(source.top_p, 0, 1);
  if (topP !== null) {
    requestBody.top_p = topP;
  }
  const maxCompletionTokens = normalizeIntegerInRange(source.max_completion_tokens, 1, 8192);
  if (maxCompletionTokens !== null) {
    requestBody.max_completion_tokens = maxCompletionTokens;
    delete requestBody.max_tokens;
  }
  const maxTokens = normalizeIntegerInRange(source.max_tokens, 1, 8192);
  if (maxTokens !== null && !Number.isFinite(requestBody.max_completion_tokens)) {
    requestBody.max_tokens = maxTokens;
  }
  const presencePenalty = normalizeNumberInRange(source.presence_penalty, -2, 2);
  if (presencePenalty !== null) {
    requestBody.presence_penalty = presencePenalty;
  }
  const frequencyPenalty = normalizeNumberInRange(source.frequency_penalty, -2, 2);
  if (frequencyPenalty !== null) {
    requestBody.frequency_penalty = frequencyPenalty;
  }
  const seed = normalizeIntegerInRange(source.seed, 0, 2147483647);
  if (seed !== null) {
    requestBody.seed = seed;
  }
  const stop = normalizeStopSequences(source.stop);
  if (stop.length > 0) {
    requestBody.stop = stop;
  }
}

function buildDashScopeOmniRequestBody(input) {
  const source = input && typeof input === "object" ? input : {};
  const requestBody = {
    model: String(source.model || DEFAULT_OMNI_MODEL).trim() || DEFAULT_OMNI_MODEL,
    stream: true,
    stream_options: {
      include_usage: true,
    },
    enable_thinking: false,
    modalities:
      Array.isArray(source.modalities) && source.modalities.length > 0
        ? source.modalities.slice()
        : ["text"],
    messages: [
      {
        role: "system",
        content: String(source.systemPrompt || "").trim(),
      },
      {
        role: "user",
        content: [
          {
            type: "input_audio",
            input_audio: {
              data: String(source.audioUrl || "").trim(),
              format: inferAudioFormat(source.audioUrl || ""),
            },
          },
          {
            type: "text",
            text: String(source.userPrompt || "").trim(),
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
  if (source.audio && typeof source.audio === "object") {
    requestBody.audio = Object.assign({}, source.audio);
  }
  applyRequestParams(requestBody, source.requestParams);
  return requestBody;
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
      };
    } catch (_error) {
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
      aggregatedText += extractDeltaText(payload);
      if (payload.usage && typeof payload.usage === "object") {
        usage = payload.usage;
      }
      if (payload?.choices?.[0]?.finish_reason) {
        finishReason = String(payload.choices[0].finish_reason || "");
      }
      lastChunkSummary = summarizeLastChunk(payload);
    } catch (_error) {
      // Ignore malformed SSE lines.
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
    } catch (_error) {
      controller.abort();
    }
    return function () {};
  }
  const onAbort = function () {
    try {
      controller.abort(signal.reason);
    } catch (_error) {
      controller.abort();
    }
  };
  signal.addEventListener("abort", onAbort, { once: true });
  return function () {
    signal.removeEventListener("abort", onAbort);
  };
}

async function requestDashScopeOmniAudioText(input, prompt, options) {
  const config = getQwenProviderConfig();
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
  const model =
    String(options?.model || config.omniModel || DEFAULT_OMNI_MODEL).trim() || DEFAULT_OMNI_MODEL;
  const stage = String(options?.stage || "omni_single").trim() || "omni_single";
  const requestBody = buildDashScopeOmniRequestBody({
    model,
    audioUrl: String(input?.audioUrl || "").trim(),
    systemPrompt: String(prompt?.systemPrompt || "").trim(),
    userPrompt: String(prompt?.userPrompt || "").trim(),
    requestParams: input?.aiOptions,
  });

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
      const error = createProviderHttpError(
        response.status,
        bodyText,
        "DashScope Omni 接口请求失败（HTTP " + String(response.status) + "）。"
      );
      error.providerStatus = Number(response.status) || 0;
      error.debugRawAiResponse = {
        provider: "aishell-dashscope-omni",
        model,
        stage,
        providerStatus: Number(response.status) || 0,
        responseBody: sanitizeProviderDebugPayload(bodyText || "", { textLimit: 20000 }),
      };
      throw error;
    }

    const result = await readStreamCompletion(response);
    if (!String(result.text || "").trim()) {
      const error = new Error("DashScope Omni 接口未返回有效文本。");
      error.code = "qwen-empty-response";
      error.statusCode = 502;
      error.debugRawAiResponse = {
        provider: "aishell-dashscope-omni",
        model,
        stage,
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
      throw error;
    }

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
      enableThinkingRequested: true,
      enableThinking: false,
      thinkingPreferenceSource: "forced-off",
      thinkingFallbackUsed: false,
      thinkingFallbackMode: "",
      thinkingDisabledRequested: true,
      thinkingDisableFallbackUsed: false,
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      if (isAbortSignalAborted(signal)) {
        throw normalizeAbortError(signal.reason, "当前任务超过60s，请重新请求。", "aborted", 504);
      }
      throw createTimeoutError("DashScope Omni 请求超时。");
    }
    throw error;
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
    unbindAbort();
  }
}

module.exports = {
  buildDashScopeOmniRequestBody,
  inferAudioFormat,
  requestDashScopeOmniAudioText,
  requestOmniInputAudio: requestDashScopeOmniAudioText,
};

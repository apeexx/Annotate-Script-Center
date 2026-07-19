"use strict";

const {
  createProviderHttpError,
  createTimeoutError,
  normalizeAbortError,
} = require("../../../backend/ai/errors");
const {
  sanitizeProviderDebugPayload,
  sanitizeProviderDebugText,
} = require("../../../backend/ai/sanitizer");
const {
  DEFAULT_OMNI_MODEL,
  DEFAULT_REQUEST_PARAMS,
  DEFAULT_TIMEOUT_MS,
  getCantoneseProviderConfig,
} = require("./config");

function inferAudioFormat(audioUrl) {
  let pathname = "";
  try {
    pathname = new URL(String(audioUrl || "")).pathname || "";
  } catch (_error) {
    pathname = String(audioUrl || "").split("?")[0] || "";
  }
  const extension = String(pathname).toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || "";
  return {
    wav: "wav",
    mp3: "mp3",
    aac: "aac",
    m4a: "m4a",
    amr: "amr",
    "3gp": "3gp",
    "3gpp": "3gpp",
  }[extension] || "wav";
}

function normalizeNumberInRange(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

function applyRequestParams(body, value) {
  const source = value && typeof value === "object" ? value : {};
  const temperature = normalizeNumberInRange(source.temperature, 0, 2);
  const topP = normalizeNumberInRange(source.top_p, 0, 1);
  const maxTokens = Math.floor(Number(source.max_tokens));
  const maxCompletionTokens = Math.floor(Number(source.max_completion_tokens));
  const presencePenalty = normalizeNumberInRange(source.presence_penalty, -2, 2);
  const frequencyPenalty = normalizeNumberInRange(source.frequency_penalty, -2, 2);
  const seed = Math.floor(Number(source.seed));
  if (temperature !== null) {
    body.temperature = temperature;
  }
  if (topP !== null) {
    body.top_p = topP;
  }
  if (Number.isFinite(maxTokens) && maxTokens >= 1 && maxTokens <= 8192) {
    body.max_tokens = maxTokens;
  }
  if (Number.isFinite(maxCompletionTokens) && maxCompletionTokens >= 1 && maxCompletionTokens <= 8192) {
    body.max_completion_tokens = maxCompletionTokens;
    delete body.max_tokens;
  }
  if (presencePenalty !== null) {
    body.presence_penalty = presencePenalty;
  }
  if (frequencyPenalty !== null) {
    body.frequency_penalty = frequencyPenalty;
  }
  if (Number.isFinite(seed) && seed >= 0 && seed <= 2147483647) {
    body.seed = seed;
  }
  if (Array.isArray(source.stop) && source.stop.length > 0) {
    body.stop = source.stop.map(function (item) { return String(item || "").trim(); }).filter(Boolean).slice(0, 8);
  }
}

function buildDashScopeOmniRequestBody(input) {
  const source = input && typeof input === "object" ? input : {};
  const body = {
    model: String(source.model || DEFAULT_OMNI_MODEL).trim() || DEFAULT_OMNI_MODEL,
    stream: true,
    stream_options: { include_usage: true },
    enable_thinking: false,
    modalities: ["text"],
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
              format: inferAudioFormat(source.audioUrl),
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
  applyRequestParams(body, source.requestParams);
  return body;
}

function extractText(payload) {
  const choice = Array.isArray(payload?.choices) ? payload.choices[0] : null;
  const content = choice?.delta?.content ?? choice?.message?.content;
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .map(function (part) {
      return typeof part === "string" ? part : String(part?.text || "");
    })
    .join("");
}

async function readCompletion(response) {
  if (!response.body || typeof response.body.getReader !== "function") {
    const rawText = await response.text();
    try {
      const payload = JSON.parse(rawText);
      return {
        rawText,
        text: extractText(payload),
        usage: payload.usage || {},
        finishReason: String(payload?.choices?.[0]?.finish_reason || ""),
      };
    } catch (_error) {
      return { rawText, text: rawText, usage: {}, finishReason: "" };
    }
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf8");
  let buffer = "";
  let rawText = "";
  let text = "";
  let usage = {};
  let finishReason = "";
  function consume(line) {
    const value = String(line || "").trim();
    if (!value.startsWith("data:")) {
      return;
    }
    rawText += String(line || "") + "\n";
    const jsonText = value.slice(5).trim();
    if (!jsonText || jsonText === "[DONE]") {
      return;
    }
    try {
      const payload = JSON.parse(jsonText);
      text += extractText(payload);
      if (payload.usage && typeof payload.usage === "object") {
        usage = payload.usage;
      }
      if (payload?.choices?.[0]?.finish_reason) {
        finishReason = String(payload.choices[0].finish_reason || "");
      }
    } catch (_error) {
      // Ignore malformed streaming frames and retain successfully parsed content.
    }
  }
  while (true) {
    const read = await reader.read();
    if (read.done) {
      break;
    }
    buffer += decoder.decode(read.value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";
    lines.forEach(consume);
  }
  buffer += decoder.decode();
  buffer.split(/\r?\n/).forEach(consume);
  return { rawText, text, usage, finishReason };
}

function bindSignal(controller, signal) {
  if (!controller || !signal || typeof signal.addEventListener !== "function") {
    return function () {};
  }
  const abort = function () {
    controller.abort(signal.reason);
  };
  if (signal.aborted) {
    abort();
    return function () {};
  }
  signal.addEventListener("abort", abort, { once: true });
  return function () {
    signal.removeEventListener("abort", abort);
  };
}

async function requestOmniInputAudio(input, prompt, options) {
  const config = getCantoneseProviderConfig();
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
  if (signal?.aborted) {
    throw normalizeAbortError(signal.reason, "当前同步请求已取消。", "aborted", 504);
  }
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const unbind = bindSignal(controller, signal);
  const timeoutMs = Math.max(1000, Number(options?.timeoutMs) || DEFAULT_TIMEOUT_MS);
  const requestedModel = String(options?.model || config.omniModel || DEFAULT_OMNI_MODEL).trim() || DEFAULT_OMNI_MODEL;
  const timer = controller ? setTimeout(function () { controller.abort(); }, timeoutMs) : null;
  try {
    const response = await fetch(config.baseUrl + "/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + config.apiKey,
      },
      body: JSON.stringify(
        buildDashScopeOmniRequestBody({
          model: requestedModel,
          audioUrl: input?.audioUrl,
          systemPrompt: prompt?.systemPrompt,
          userPrompt: prompt?.userPrompt,
          requestParams: input?.aiOptions,
        })
      ),
      signal: controller ? controller.signal : undefined,
    });
    if (!response.ok) {
      const bodyText = await response.text();
      const error = createProviderHttpError(response.status, bodyText, "DashScope Omni 请求失败。");
      error.providerStatus = Number(response.status) || 0;
      error.debugRawAiResponse = {
        provider: "aishell-cantonese-dashscope-omni",
        model: DEFAULT_OMNI_MODEL,
        providerStatus: Number(response.status) || 0,
        responseBody: sanitizeProviderDebugPayload(bodyText, { textLimit: 20000 }),
      };
      throw error;
    }
    const result = await readCompletion(response);
    if (!String(result.text || "").trim()) {
      const error = new Error("DashScope Omni 未返回有效文本。");
      error.code = "qwen-empty-response";
      error.statusCode = 502;
      error.debugRawAiResponse = {
        provider: "aishell-cantonese-dashscope-omni",
        model: DEFAULT_OMNI_MODEL,
        rawResponseText: sanitizeProviderDebugText(result.rawText, 20000),
      };
      throw error;
    }
    return {
      model: requestedModel,
      rawText: result.text,
      usage: result.usage,
      finishReason: result.finishReason,
      enableThinking: false,
      thinkingDisabledRequested: true,
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      if (signal?.aborted) {
        throw normalizeAbortError(signal.reason, "当前同步请求已取消。", "aborted", 504);
      }
      throw createTimeoutError("DashScope Omni 请求超时。");
    }
    throw error;
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
    unbind();
  }
}

module.exports = {
  buildDashScopeOmniRequestBody,
  inferAudioFormat,
  requestOmniInputAudio,
};

"use strict";

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { TextDecoder } = require("util");

const {
  DEFAULT_COMPARE_MODEL,
  DEFAULT_OMNI_MODEL,
  DEFAULT_REQUEST_PARAMS,
  getQwenProviderConfig,
  getQwenPythonConfig,
} = require("../config");
const {
  createProviderHttpError,
  createPythonRuntimeError,
  createRateLimitError,
  createTimeoutError,
  isRateLimitProviderCode,
  normalizeAbortError,
} = require("../errors");
const {
  sanitizeProviderDebugJson,
  sanitizeProviderDebugPayload,
  sanitizeProviderDebugText,
  sanitizeProviderErrorSummary,
} = require("../sanitizer");
const {
  applyAiOptionsToRequestBody,
  inferAudioFormat,
  isEnableThinkingUnsupportedError,
  resolveThinkingPreference,
  withThinkingPreference,
  withoutThinkingPreference,
} = require("./qwen-openai-compatible");

const UTF8_DECODER = new TextDecoder("utf-8", { fatal: false });

function decodeUtf8Chunks(chunks) {
  const buffers = Array.isArray(chunks) ? chunks.filter(Buffer.isBuffer) : [];
  if (buffers.length <= 0) {
    return "";
  }
  return UTF8_DECODER.decode(Buffer.concat(buffers));
}

function resolvePythonBin() {
  const config = getQwenPythonConfig();
  if (config.pythonBin) {
    return {
      pythonBin: config.pythonBin,
      source: "env",
      exists: fs.existsSync(config.pythonBin),
    };
  }
  const candidate = config.defaultPythonCandidates.find(function (item) {
    return fs.existsSync(item);
  });
  if (candidate) {
    return {
      pythonBin: candidate,
      source: "venv",
      exists: true,
    };
  }
  return {
    pythonBin: "",
    source: "missing",
    exists: false,
  };
}

function getQwenPythonClientConfig() {
  const config = getQwenPythonConfig();
  const pythonResolution = resolvePythonBin();
  return Object.assign({}, config, {
    pythonBin: pythonResolution.pythonBin,
    pythonSource: pythonResolution.source,
    pythonExists: pythonResolution.exists,
    pythonScriptPath: config.defaultScriptPath,
  });
}

function createPythonEnvironmentMissingError() {
  return createPythonRuntimeError(
    "Qwen Python 环境未配置，请在 platform-resources/backend/.venv 创建统一 Python 虚拟环境。",
    "qwen-python-not-configured",
    503
  );
}

function createJsonParseError(stdoutText, stderrText) {
  return createPythonRuntimeError(
    "Qwen Python 输出解析失败。",
    "qwen-python-invalid-output",
    502,
    stdoutText || stderrText || ""
  );
}

function buildProviderError(model, stage, parsed) {
  const code = String(parsed?.code || "provider-http-error");
  const summary = sanitizeProviderErrorSummary(parsed?.summary || parsed?.message || "");
  if (isRateLimitProviderCode(parsed?.providerCode || code)) {
    const error = createRateLimitError(summary, {
      code: "qwen-burst-rate-limited",
      message: "Qwen 请求突增限流，接口返回请求增长过快。",
      providerCode: parsed?.providerCode || code,
      providerStatus: Number(parsed?.providerStatus || parsed?.statusCode || 429) || 429,
    });
    error.debugRawAiResponse = {
      provider: "qwen",
      model: String(model || ""),
      stage: String(stage || "unknown"),
      providerStatus: Number(parsed?.providerStatus || parsed?.statusCode || 429) || 429,
      providerCode: String(parsed?.providerCode || code || ""),
      responseBody: sanitizeProviderDebugPayload(parsed?.responseBody || "", { textLimit: 20000 }),
    };
    return error;
  }
  const error = createProviderHttpError(
    Number(parsed?.providerStatus || parsed?.statusCode || 502) || 502,
    parsed?.summary || parsed?.message || "",
    parsed?.message || "Qwen 接口请求失败。"
  );
  error.providerStatus = Number(parsed?.providerStatus || parsed?.statusCode || error.statusCode || 502) || 502;
  error.providerCode = String(parsed?.providerCode || "").trim();
  error.debugRawAiResponse = {
    provider: "qwen",
    model: String(model || ""),
    stage: String(stage || "unknown"),
    providerStatus: error.providerStatus,
    providerCode: error.providerCode,
    responseBody: sanitizeProviderDebugPayload(parsed?.responseBody || "", { textLimit: 20000 }),
  };
  return error;
}

function buildSseProviderError(model, stage, providerError, parsed) {
  const code = String(providerError?.code || providerError?.type || "").trim();
  const summary = sanitizeProviderErrorSummary(providerError?.message || JSON.stringify(providerError || {}));
  const error = isRateLimitProviderCode(code)
    ? createRateLimitError(summary, {
        code: "qwen-burst-rate-limited",
        message: "Qwen 请求突增限流，接口返回请求增长过快。",
        providerCode: code,
        providerStatus: 429,
      })
    : createProviderHttpError(429, summary, "Qwen SSE 返回错误。");
  error.providerStatus = 429;
  error.providerCode = code;
  error.summary = summary;
  error.debugRawAiResponse = {
    provider: "qwen",
    model: String(model || ""),
    stage: String(stage || "unknown"),
    providerStatus: 429,
    providerCode: code,
    error: sanitizeProviderDebugJson(providerError || {}, {
      textLimit: 4000,
      maxDepth: 4,
      maxObjectKeys: 40,
    }),
    rawSseText: sanitizeProviderDebugText(parsed?.rawSseText || "", 20000),
    rawResponseText: sanitizeProviderDebugText(parsed?.rawResponseText || "", 20000),
    usage: sanitizeProviderDebugJson(parsed?.usage || {}, {
      textLimit: 4000,
      maxDepth: 4,
      maxObjectKeys: 40,
    }),
    parsedChunksCount: Number(parsed?.parsedChunksCount) || 0,
    extractedTextLength: Number(parsed?.extractedTextLength) || 0,
    finishReason: String(parsed?.finishReason || ""),
    lastChunkSummary: sanitizeProviderDebugJson(parsed?.lastChunkSummary || {}, {
      textLimit: 4000,
      maxDepth: 4,
      maxObjectKeys: 40,
    }),
  };
  return error;
}

function buildEmptyResponseError(model, stage, parsed) {
  const error = new Error("Qwen 接口未返回有效文本。");
  error.code = "qwen-empty-response";
  error.statusCode = 502;
  error.debugRawAiResponse = {
    provider: "qwen",
    model: String(model || ""),
    stage: String(stage || "unknown"),
    rawSseText: sanitizeProviderDebugText(parsed?.rawSseText || "", 20000),
    rawResponseText: sanitizeProviderDebugText(parsed?.rawResponseText || "", 20000),
    usage: sanitizeProviderDebugJson(parsed?.usage || {}, {
      textLimit: 4000,
      maxDepth: 4,
      maxObjectKeys: 40,
    }),
    parsedChunksCount: Number(parsed?.parsedChunksCount) || 0,
    extractedTextLength: Number(parsed?.extractedTextLength) || 0,
    finishReason: String(parsed?.finishReason || ""),
    lastChunkSummary: sanitizeProviderDebugJson(parsed?.lastChunkSummary || {}, {
      textLimit: 4000,
      maxDepth: 4,
      maxObjectKeys: 40,
    }),
  };
  return error;
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

function buildMockOmniSingleResponse(input) {
  const pageText = String(input?.pageText || "").trim();
  return JSON.stringify({
    heardText: pageText || "mock 听音文本",
    recommendedText: pageText || "mock 推荐文本",
    decision: "keep_page_text",
    changePoints: [],
    confidence: 0.84,
    needHumanReview: true,
  });
}

function bindAbortSignal(child, signal, onAbort) {
  if (!signal || typeof signal.addEventListener !== "function") {
    return function () {};
  }
  function handleAbort() {
    try {
      child.kill("SIGTERM");
    } catch (_error) {}
    if (typeof onAbort === "function") {
      onAbort();
    }
  }
  signal.addEventListener("abort", handleAbort, { once: true });
  return function () {
    try {
      signal.removeEventListener("abort", handleAbort);
    } catch (_error) {}
  };
}

function runPythonClient(payload, timeoutMs, clientConfig, options) {
  const config = clientConfig && typeof clientConfig === "object" ? clientConfig : getQwenPythonClientConfig();
  if (!config.pythonBin) {
    return Promise.reject(createPythonEnvironmentMissingError());
  }
  if (config.pythonSource === "env" && !config.pythonExists) {
    return Promise.reject(
      createPythonRuntimeError(
        "DATABAKER_QWEN_PYTHON_BIN 指向的 Python 不存在，请检查路径。",
        "qwen-python-not-configured",
        503
      )
    );
  }
  const stage = String(options?.stage || "unknown");
  const model = String(payload?.requestBody?.model || "");
  return new Promise(function (resolve, reject) {
    let settled = false;
    const child = spawn(config.pythonBin, [config.pythonScriptPath], {
      cwd: path.dirname(config.pythonScriptPath),
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      env: Object.assign({}, process.env, {
        PYTHONIOENCODING: "utf-8",
        PYTHONUTF8: "1",
      }),
    });
    const stdoutChunks = [];
    const stderrChunks = [];
    const finish = function (handler) {
      return function () {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        unbindAbort();
        handler.apply(null, arguments);
      };
    };
    const timer = setTimeout(
      finish(function () {
        try {
          child.kill("SIGTERM");
        } catch (_error) {}
        reject(createTimeoutError("Qwen 请求超时。"));
      }),
      Math.max(1000, Number(timeoutMs) || config.timeoutMs)
    );
    const unbindAbort = bindAbortSignal(child, options?.signal, function () {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      reject(normalizeAbortError(options.signal.reason, "当前任务超过60s，请重新请求。", "aborted", 504));
    });

    child.stdout.on("data", function (chunk) {
      stdoutChunks.push(Buffer.from(chunk || ""));
    });
    child.stderr.on("data", function (chunk) {
      stderrChunks.push(Buffer.from(chunk || ""));
    });
    child.on(
      "error",
      finish(function (error) {
        if (error?.code === "ENOENT") {
          reject(createPythonEnvironmentMissingError());
          return;
        }
        reject(
          createPythonRuntimeError(
            "Qwen Python 进程启动失败。",
            "qwen-python-launch-failed",
            502,
            error?.message || ""
          )
        );
      })
    );
    child.on(
      "close",
      finish(function () {
        const stdoutText = decodeUtf8Chunks(stdoutChunks).trim();
        const stderrText = sanitizeProviderErrorSummary(decodeUtf8Chunks(stderrChunks));
        let parsed = null;
        try {
          parsed = JSON.parse(stdoutText || "{}");
        } catch (_error) {
          reject(createJsonParseError(stdoutText, stderrText));
          return;
        }
        if (!parsed || parsed.success !== true) {
          reject(buildProviderError(model, stage, parsed || {}));
          return;
        }
        if (parsed.providerError && typeof parsed.providerError === "object") {
          reject(buildSseProviderError(model, stage, parsed.providerError, parsed));
          return;
        }
        if (!String(parsed.text || "").trim()) {
          reject(buildEmptyResponseError(model, stage, parsed));
          return;
        }
        resolve(parsed);
      })
    );
    child.stdin.end(JSON.stringify(payload || {}));
  });
}

function normalizeModelResult(model, result) {
  return {
    model,
    rawText: result.text,
    usage: result.usage || {},
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

async function requestChatCompletion(requestBody, options) {
  const config = getQwenProviderConfig();
  const pythonConfig = getQwenPythonClientConfig();
  if (!config.apiKey) {
    const error = new Error("missing-api-key");
    error.code = "missing-api-key";
    error.statusCode = 503;
    throw error;
  }
  const signal = options?.signal;
  if (signal && signal.aborted === true) {
    throw normalizeAbortError(signal.reason, "当前任务超过60s，请重新请求。", "aborted", 504);
  }
  return runPythonClient(
    {
      apiBase: config.baseUrl,
      apiKey: config.apiKey,
      requestBody,
      timeoutMs: Math.max(1000, Number(options?.timeoutMs) || config.timeoutMs),
    },
    Math.max(1000, Number(options?.timeoutMs) || config.timeoutMs),
    pythonConfig,
    options
  );
}

async function requestChatCompletionWithThinkingFallback(requestBody, options) {
  const config = getQwenProviderConfig();
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
    const fallbackResult = await requestChatCompletion(withoutThinkingPreference(initialBody), options);
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

async function requestTextCompareJson(input, prompt, options) {
  const config = getQwenProviderConfig();
  const model = String(options?.model || config.compareModel || DEFAULT_COMPARE_MODEL).trim() || DEFAULT_COMPARE_MODEL;
  const heardText = String(options?.heardText || input?.heardText || "").trim();
  if (config.mockEnabled) {
    const thinkingPreference = resolveThinkingPreference(options, config);
    return {
      model,
      rawText: buildMockCompareResponse(input, heardText),
      usage: {
        prompt_tokens: 180,
        completion_tokens: 70,
        total_tokens: 250,
      },
      mock: true,
      enableThinkingRequested: true,
      enableThinking: thinkingPreference.enabled === true,
      thinkingPreferenceSource: thinkingPreference.source,
      thinkingFallbackUsed: false,
      thinkingFallbackMode: "",
      thinkingDisabledRequested: thinkingPreference.enabled !== true,
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
  return normalizeModelResult(model, result);
}

async function requestOmniInputAudio(input, prompt, options) {
  const config = getQwenProviderConfig();
  const model = String(options?.model || config.omniModel || DEFAULT_OMNI_MODEL).trim() || DEFAULT_OMNI_MODEL;
  if (config.mockEnabled) {
    const thinkingPreference = resolveThinkingPreference(options, config);
    return {
      model,
      rawText: buildMockOmniSingleResponse(input),
      usage: {
        prompt_tokens: 220,
        completion_tokens: 90,
        total_tokens: 310,
      },
      mock: true,
      enableThinkingRequested: true,
      enableThinking: thinkingPreference.enabled === true,
      thinkingPreferenceSource: thinkingPreference.source,
      thinkingFallbackUsed: false,
      thinkingFallbackMode: "",
      thinkingDisabledRequested: thinkingPreference.enabled !== true,
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
    Object.assign({}, options || {}, { stage: "omni_single" })
  );
  return normalizeModelResult(model, result);
}

module.exports = {
  getQwenPythonClientConfig,
  requestChatCompletion,
  requestChatCompletionWithFallback: requestChatCompletionWithThinkingFallback,
  requestChatCompletionWithThinkingFallback,
  requestOmniInputAudio,
  requestOmniSingle: requestOmniInputAudio,
  requestTextCompareJson,
};

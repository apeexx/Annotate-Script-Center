"use strict";

const {
  buildModelQueueKey,
  enqueueProviderTask,
} = require("../../../backend/ai/provider-queue");

const DEFAULT_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";
const DEFAULT_ANALYSIS_MODE = "two_stage";
const DEFAULT_VISION_MODEL = "qwen3.6-plus";
const DEFAULT_OCR_MODEL = "";
const DEFAULT_REASONING_MODEL = "qwen3.6-plus";
const DEFAULT_SINGLE_MODEL = "qwen3.6-plus";
const THINKING_PARAM_NAME = "enable_thinking";
const THINKING_PARAM_LOCATION = "root";
const DEFAULT_CALL_MODE = "openai-compatible-chat";

const MODEL_PROFILE_TABLE = {
  "qwen3.6-plus": {
    role: "vision",
    callMode: DEFAULT_CALL_MODE,
    supportsThinking: true,
    supportsJsonObject: true,
  },
  "qwen3.6-flash": {
    role: "vision",
    callMode: DEFAULT_CALL_MODE,
    supportsThinking: true,
    supportsJsonObject: true,
  },
  "qwen3-vl-plus": {
    role: "vision",
    callMode: DEFAULT_CALL_MODE,
    supportsThinking: "unknown",
    supportsJsonObject: true,
  },
  "qwen3-vl-flash": {
    role: "vision",
    callMode: DEFAULT_CALL_MODE,
    supportsThinking: "unknown",
    supportsJsonObject: true,
  },
  "qwen3.5-plus": {
    role: "reasoning",
    callMode: DEFAULT_CALL_MODE,
    supportsThinking: true,
    supportsJsonObject: true,
  },
  "qwen3.5-flash": {
    role: "reasoning",
    callMode: DEFAULT_CALL_MODE,
    supportsThinking: true,
    supportsJsonObject: true,
  },
  "qwen-vl-max": {
    role: "vision",
    callMode: DEFAULT_CALL_MODE,
    supportsThinking: "unknown",
    supportsJsonObject: true,
  },
  "qwen-vl-plus": {
    role: "vision",
    callMode: DEFAULT_CALL_MODE,
    supportsThinking: "unknown",
    supportsJsonObject: true,
  },
  "qwen3.6-35b-a3b": {
    role: "reasoning",
    callMode: DEFAULT_CALL_MODE,
    supportsThinking: true,
    supportsJsonObject: true,
  },
  "qwen3.5-397b-a17b": {
    role: "reasoning",
    callMode: DEFAULT_CALL_MODE,
    supportsThinking: true,
    supportsJsonObject: true,
  },
  "qwen3.5-122b-a10b": {
    role: "reasoning",
    callMode: DEFAULT_CALL_MODE,
    supportsThinking: true,
    supportsJsonObject: true,
  },
  "qwen3.5-27b": {
    role: "reasoning",
    callMode: DEFAULT_CALL_MODE,
    supportsThinking: true,
    supportsJsonObject: true,
  },
  "qwen3.5-35b-a3b": {
    role: "reasoning",
    callMode: DEFAULT_CALL_MODE,
    supportsThinking: true,
    supportsJsonObject: true,
  },
};

function trimSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function parseBooleanEnv(name, fallback) {
  const value = String(process.env[name] || "").trim().toLowerCase();
  if (!value) {
    return fallback === true;
  }
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

function mapLegacyAbakaAiModelName(value) {
  const text = String(value || "").trim();
  const lower = text.toLowerCase();
  if (!text) {
    return "";
  }
  if (lower === "qwen3.6plus") {
    return "qwen3.6-plus";
  }
  if (lower === "qwen-vl-max-latest") {
    return "qwen-vl-max";
  }
  if (lower === "qwen-vl-plus-latest") {
    return "qwen-vl-plus";
  }
  if (lower === "qwen-vl-ocr-latest") {
    return "";
  }
  if (lower === "qvq-plus-latest") {
    return "qwen3.6-plus";
  }
  return text;
}

function sanitizeModelName(value, fallback) {
  const text = mapLegacyAbakaAiModelName(String(value || "").replace(/[\r\n]+/g, " ").trim());
  if (!text) {
    return mapLegacyAbakaAiModelName(String(fallback || "").trim());
  }
  return text.slice(0, 80);
}

function parseTimeoutMs(value, fallback) {
  const number = Number(value);
  const base = Number.isFinite(number) ? number : Number(fallback);
  const safe = Number.isFinite(base) ? base : 60000;
  return Math.max(1000, Math.min(300000, Math.floor(safe)));
}

function parseAllowedModels(value, fallbackList) {
  const source = String(value || "").trim();
  const fallback = Array.isArray(fallbackList) ? fallbackList : [];
  if (!source) {
    return fallback.slice();
  }
  const parsed = source
    .split(/[,\n]/)
    .map(function (item) {
      return sanitizeModelName(item, "");
    })
    .filter(Boolean);
  return parsed.length > 0 ? parsed : fallback.slice();
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

function getModelProfile(modelName) {
  const key = sanitizeModelName(modelName, "");
  if (!key) {
    return {
      callMode: DEFAULT_CALL_MODE,
      supportsThinking: "unknown",
      supportsJsonObject: true,
    };
  }
  return (
    MODEL_PROFILE_TABLE[key] || {
      callMode: DEFAULT_CALL_MODE,
      supportsThinking: "unknown",
      supportsJsonObject: true,
    }
  );
}

function getClientConfig() {
  const apiKey = String(process.env.DASHSCOPE_API_KEY || "").trim();
  const legacyModel = sanitizeModelName(process.env.ABAKA_TASK21_AI_MODEL, DEFAULT_SINGLE_MODEL);
  const singleModel = sanitizeModelName(
    process.env.ABAKA_TASK21_AI_SINGLE_MODEL,
    legacyModel || DEFAULT_SINGLE_MODEL
  );
  const ocrModel = sanitizeModelName(process.env.ABAKA_TASK21_AI_OCR_MODEL, DEFAULT_OCR_MODEL);
  const visionModel = sanitizeModelName(
    process.env.ABAKA_TASK21_AI_VISION_MODEL,
    DEFAULT_VISION_MODEL
  );
  const reasoningModel = sanitizeModelName(
    process.env.ABAKA_TASK21_AI_REASONING_MODEL,
    DEFAULT_REASONING_MODEL
  );
  const allowedVisionModels = parseAllowedModels(
    process.env.ABAKA_TASK21_AI_ALLOWED_VISION_MODELS,
    [visionModel || DEFAULT_VISION_MODEL]
  );
  const allowedReasoningModels = parseAllowedModels(
    process.env.ABAKA_TASK21_AI_ALLOWED_REASONING_MODELS,
    [reasoningModel || DEFAULT_REASONING_MODEL]
  );
  const allowedOcrModels = parseAllowedModels(
    process.env.ABAKA_TASK21_AI_ALLOWED_OCR_MODELS,
    [ocrModel || DEFAULT_OCR_MODEL].filter(Boolean)
  );
  const allowedSingleModels = parseAllowedModels(
    process.env.ABAKA_TASK21_AI_ALLOWED_SINGLE_MODELS || process.env.ABAKA_TASK21_AI_ALLOWED_MODELS,
    [singleModel || DEFAULT_SINGLE_MODEL]
  );

  return {
    apiKey,
    hasApiKey: Boolean(apiKey),
    baseUrl: trimSlash(process.env.DASHSCOPE_BASE_URL || DEFAULT_BASE_URL),
    mockEnabled: parseBooleanEnv("ABAKA_TASK21_AI_MOCK", false),
    analysisMode: normalizeAnalysisMode(
      process.env.ABAKA_TASK21_AI_ANALYSIS_MODE,
      DEFAULT_ANALYSIS_MODE
    ),
    visionModel: visionModel || DEFAULT_VISION_MODEL,
    ocrEnabled: parseBooleanEnv("ABAKA_TASK21_AI_OCR_ENABLED", false),
    ocrModel: ocrModel || DEFAULT_OCR_MODEL,
    reasoningModel: reasoningModel || DEFAULT_REASONING_MODEL,
    singleModel: singleModel || DEFAULT_SINGLE_MODEL,
    timeoutMs: parseTimeoutMs(process.env.ABAKA_TASK21_AI_TIMEOUT_MS, 60000),
    allowClientModelOverride: parseBooleanEnv("ABAKA_TASK21_AI_ALLOW_CLIENT_MODEL_OVERRIDE", false),
    allowThinkingParamFallback: parseBooleanEnv(
      "ABAKA_TASK21_AI_ALLOW_THINKING_PARAM_FALLBACK",
      false
    ),
    defaultEnableThinking: parseBooleanEnv("ABAKA_TASK21_AI_ENABLE_THINKING", false),
    allowedVisionModels,
    allowedOcrModels,
    allowedReasoningModels,
    allowedSingleModels,
  };
}

function sanitizeProviderErrorSummary(text) {
  return String(text || "")
    .replace(/https?:\/\/[^\s"'\\]+/g, function (inputUrl) {
      try {
        const parsed = new URL(inputUrl);
        return parsed.protocol + "//" + parsed.host + "/[redacted]";
      } catch (error) {
        return "[url-redacted]";
      }
    })
    .replace(
      /(access_token|refresh_token|authorization|token|cookie|password|secret|signature|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi,
      "$1=[redacted]"
    )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 260);
}

function extractChoiceText(payload) {
  const choice = Array.isArray(payload?.choices) ? payload.choices[0] : null;
  if (!choice) {
    return "";
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
  const text = choice?.text;
  return typeof text === "string" ? text : "";
}

function buildImageContent(images) {
  const source = Array.isArray(images) ? images : [];
  const result = [];
  source.forEach(function (item) {
    const url = String(item?.dataUrl || item?.imageUrl || "").trim();
    if (!url) {
      return;
    }
    result.push({
      type: "image_url",
      image_url: {
        url,
      },
    });
  });
  return result;
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

function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

async function requestChatCompletion(requestBody, options) {
  const config = getClientConfig();
  if (!config.hasApiKey) {
    const missingApiKeyError = new Error("missing-api-key");
    missingApiKeyError.code = "missing-api-key";
    missingApiKeyError.statusCode = 503;
    throw missingApiKeyError;
  }
  if (typeof fetch !== "function") {
    throw new Error("当前 Node 运行时不支持 fetch。");
  }

  const timeoutMs = parseTimeoutMs(options?.timeoutMs, config.timeoutMs);
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

    if (!response.ok) {
      const providerError = new Error("DashScope 请求失败（HTTP " + String(response.status) + "）。");
      providerError.code = "provider-http-error";
      providerError.statusCode = response.status;
      providerError.summary = sanitizeProviderErrorSummary(rawText);
      throw providerError;
    }

    const parsed = safeParseJson(rawText || "{}");
    if (!parsed) {
      const invalidJsonError = new Error("provider-invalid-json");
      invalidJsonError.code = "provider-invalid-json";
      throw invalidJsonError;
    }

    return {
      model: String(parsed.model || requestBody.model || ""),
      rawText: extractChoiceText(parsed),
      usage: parsed.usage || {},
      rawResponse: parsed,
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("DashScope 请求超时。", { cause: error });
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

async function requestChatCompletionWithThinking(requestBody, options) {
  const normalizedModelName = sanitizeModelName(options?.model || requestBody?.model, "");
  const runRequest = async function runRequest() {
  const config = getClientConfig();
  const enableThinking = false;
  const timeoutMs = parseTimeoutMs(options?.timeoutMs, config.timeoutMs);
  const modelName = normalizedModelName;
  const profile = getModelProfile(modelName);
  const supportsThinking = profile.supportsThinking;
  if (supportsThinking !== true) {
    const passthroughResponse = await requestChatCompletion(Object.assign({}, requestBody), {
      timeoutMs,
    });
    return Object.assign({}, passthroughResponse, {
      callMode: profile.callMode || DEFAULT_CALL_MODE,
      thinking: {
        enableThinking: false,
        explicitDisableSent: false,
        paramName: THINKING_PARAM_NAME,
        paramLocation: THINKING_PARAM_LOCATION,
        fallbackUsed: false,
        notApplicable: true,
        reason:
          supportsThinking === false
            ? "model-does-not-support-thinking-param"
            : "model-thinking-support-unknown",
      },
    });
  }

  const requestWithThinking = Object.assign({}, requestBody);
  requestWithThinking[THINKING_PARAM_NAME] = enableThinking;

  try {
    const response = await requestChatCompletion(requestWithThinking, {
      timeoutMs,
    });
    return Object.assign({}, response, {
      callMode: profile.callMode || DEFAULT_CALL_MODE,
      thinking: {
        enableThinking,
        explicitDisableSent: enableThinking !== true,
        paramName: THINKING_PARAM_NAME,
        paramLocation: THINKING_PARAM_LOCATION,
        fallbackUsed: false,
      },
    });
  } catch (error) {
    if (!isEnableThinkingUnsupportedError(error)) {
      throw error;
    }
    if (config.allowThinkingParamFallback !== true) {
      const unsupportedError = new Error(
        "模型或接口不支持 enable_thinking 参数；默认不会自动移除。可设置 ABAKA_TASK21_AI_ALLOW_THINKING_PARAM_FALLBACK=true 允许回退。"
      );
      unsupportedError.code = "thinking-param-unsupported";
      unsupportedError.statusCode = error.statusCode || 400;
      unsupportedError.summary = sanitizeProviderErrorSummary(error.summary || error.message);
      throw unsupportedError;
    }
    const requestWithoutThinking = Object.assign({}, requestBody);
    delete requestWithoutThinking[THINKING_PARAM_NAME];
    const fallbackResponse = await requestChatCompletion(requestWithoutThinking, {
      timeoutMs,
    });
    return Object.assign({}, fallbackResponse, {
      callMode: profile.callMode || DEFAULT_CALL_MODE,
      thinking: {
        enableThinking,
        explicitDisableSent: enableThinking !== true,
        paramName: THINKING_PARAM_NAME,
        paramLocation: THINKING_PARAM_LOCATION,
        fallbackUsed: true,
      },
    });
  }
  };
  if (!normalizedModelName) {
    return runRequest();
  }
  const queued = await enqueueProviderTask(buildModelQueueKey(normalizedModelName), runRequest);
  return queued?.value;
}

function createProviderUsage(usage) {
  const source = usage && typeof usage === "object" ? usage : {};
  const inputTokens = Number(source.prompt_tokens ?? source.inputTokens ?? 0);
  const outputTokens = Number(source.completion_tokens ?? source.outputTokens ?? 0);
  const totalTokens = Number(source.total_tokens ?? source.totalTokens ?? inputTokens + outputTokens);
  return {
    inputTokens: Number.isFinite(inputTokens) ? Math.max(0, Math.floor(inputTokens)) : 0,
    outputTokens: Number.isFinite(outputTokens) ? Math.max(0, Math.floor(outputTokens)) : 0,
    totalTokens: Number.isFinite(totalTokens) ? Math.max(0, Math.floor(totalTokens)) : 0,
    source: "provider",
  };
}

function sumUsageBlocks(left, right) {
  const a = createProviderUsage(left);
  const b = createProviderUsage(right);
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    totalTokens: a.totalTokens + b.totalTokens,
    source: "provider",
  };
}

function buildMockFinalResult(target) {
  const normalizedTarget = String(target || "overall");
  return {
    target: normalizedTarget,
    same_font: {
      applicable: true,
      choice:
        normalizedTarget === "image_b_texts_removed" || normalizedTarget === "other_changes"
          ? "not_applicable"
          : "true",
      value:
        normalizedTarget === "image_b_texts_removed" || normalizedTarget === "other_changes"
          ? "not_applicable"
          : "true",
      confidence: 0.62,
      reason_cn: "mock 模式返回：用于调试面板渲染。",
      evidence: ["mock evidence"],
      warnings: ["mock-response"],
    },
    image_b_texts_removed: {
      applicable: normalizedTarget !== "same_font",
      choice: normalizedTarget === "same_font" ? "not_applicable" : "null",
      value_type: normalizedTarget === "same_font" ? "not_applicable" : "blank",
      value: "",
      lines: [],
      segment_count: 0,
      reason_cn: "mock 模式返回。",
      evidence: [],
      warnings: [],
    },
    other_changes: {
      applicable: normalizedTarget !== "same_font",
      choice: normalizedTarget === "same_font" ? "not_applicable" : "null",
      value_type: normalizedTarget === "same_font" ? "not_applicable" : "blank",
      value: "",
      word_count: 0,
      reason_cn: "mock 模式返回。",
      evidence: [],
      warnings: [],
    },
    workflow: {
      skip_later_fields: false,
      skip_reason: "",
    },
  };
}

function buildMockVisualObservations(target) {
  return {
    target: String(target || "overall"),
    visual_observations: {
      image_a_text_regions: ["mock:image_a_region_1"],
      image_b_text_regions: ["mock:image_b_region_1"],
      font_evidence: ["mock:font-stroke"],
      font_similarity_observations: ["mock:font-style-similar"],
      deleted_text_candidates: [],
      other_visual_change_candidates: [],
      uncertainties: [],
    },
  };
}

function createVisionRequestBody(model, systemPrompt, userPrompt, images) {
  const profile = getModelProfile(model);
  const requestBody = {
    model,
    messages: [
      {
        role: "system",
        content: String(systemPrompt || ""),
      },
      {
        role: "user",
        content: buildImageContent(images).concat([
          {
            type: "text",
            text: String(userPrompt || ""),
          },
        ]),
      },
    ],
    temperature: 0,
    top_p: 0.1,
    max_tokens: 1800,
  };
  if (profile.supportsJsonObject !== false) {
    requestBody.response_format = {
      type: "json_object",
    };
  }
  return requestBody;
}

function createTextRequestBody(model, systemPrompt, userPrompt) {
  const profile = getModelProfile(model);
  const requestBody = {
    model,
    messages: [
      {
        role: "system",
        content: String(systemPrompt || ""),
      },
      {
        role: "user",
        content: String(userPrompt || ""),
      },
    ],
    temperature: 0,
    top_p: 0.1,
    max_tokens: 1800,
  };
  if (profile.supportsJsonObject !== false) {
    requestBody.response_format = {
      type: "json_object",
    };
  }
  return requestBody;
}

function resolveModelOverride(requestedModel, allowClientOverride, allowedModels, defaultModel) {
  const model = sanitizeModelName(requestedModel, "");
  if (!allowClientOverride || !model) {
    return {
      selected: defaultModel,
      override: "",
    };
  }
  const allowed = Array.isArray(allowedModels) ? allowedModels : [];
  if (allowed.indexOf(model) >= 0) {
    return {
      selected: model,
      override: model,
    };
  }
  return {
    selected: defaultModel,
    override: "",
  };
}

async function analyzeTask21SingleModel(input, prompts, options, config) {
  const payload = input && typeof input === "object" ? input : {};
  const promptConfig = prompts && typeof prompts === "object" ? prompts : {};
  const runtimeOptions = options && typeof options === "object" ? options : {};
  const singleModelResolved = resolveModelOverride(
    runtimeOptions.singleModel,
    runtimeOptions.allowClientModelOverride === true,
    runtimeOptions.allowedSingleModels,
    runtimeOptions.defaultSingleModel || config.singleModel
  );
  const model = singleModelResolved.selected || config.singleModel || DEFAULT_SINGLE_MODEL;
  const enableThinking = runtimeOptions.enableThinking === true;
  const timeoutMs = parseTimeoutMs(runtimeOptions.timeoutMs, config.timeoutMs);

  const modelProfile = getModelProfile(model);
  if (config.mockEnabled) {
    const mockUsage = {
      inputTokens: 420,
      outputTokens: 180,
      totalTokens: 600,
      source: "provider",
    };
    return {
      analysisMode: "single_model",
      model,
      rawText: JSON.stringify(buildMockFinalResult(payload.target), null, 2),
      usage: mockUsage,
      stages: {
        single: {
          model,
          callMode: modelProfile.callMode || DEFAULT_CALL_MODE,
          elapsedMs: 120,
          usage: mockUsage,
          thinking: {
            enableThinking,
            explicitDisableSent: enableThinking !== true,
            paramName: THINKING_PARAM_NAME,
            paramLocation: THINKING_PARAM_LOCATION,
            fallbackUsed: false,
            notApplicable: modelProfile.supportsThinking !== true,
          },
        },
      },
      thinking: {
        enableThinking,
        explicitDisableSent: enableThinking !== true,
        paramName: THINKING_PARAM_NAME,
        paramLocation: THINKING_PARAM_LOCATION,
        fallbackUsed: false,
      },
      mock: true,
      selectedModels: {
        singleModel: model,
      },
    };
  }

  const requestBody = createVisionRequestBody(
      model,
      promptConfig.singleSystemPrompt,
      promptConfig.singleUserPrompt,
      payload.images
    );
  const startedAt = Date.now();
  const completion = await requestChatCompletionWithThinking(requestBody, {
    enableThinking,
    timeoutMs,
    model,
  });
  const usage = createProviderUsage(completion.usage);
  return {
    analysisMode: "single_model",
    model: completion.model || model,
    rawText: completion.rawText || "",
    usage,
    stages: {
      single: {
        model: completion.model || model,
        callMode: completion.callMode || modelProfile.callMode || DEFAULT_CALL_MODE,
        elapsedMs: Date.now() - startedAt,
        usage,
        thinking: completion.thinking || {},
      },
    },
    thinking: completion.thinking,
    mock: false,
    selectedModels: {
      singleModel: model,
    },
  };
}

async function analyzeTask21TwoStage(input, prompts, options, config) {
  const payload = input && typeof input === "object" ? input : {};
  const promptConfig = prompts && typeof prompts === "object" ? prompts : {};
  const runtimeOptions = options && typeof options === "object" ? options : {};
  const visionModelResolved = resolveModelOverride(
    runtimeOptions.visionModel,
    runtimeOptions.allowClientModelOverride === true,
    runtimeOptions.allowedVisionModels,
    runtimeOptions.defaultVisionModel || config.visionModel
  );
  const reasoningModelResolved = resolveModelOverride(
    runtimeOptions.reasoningModel,
    runtimeOptions.allowClientModelOverride === true,
    runtimeOptions.allowedReasoningModels,
    runtimeOptions.defaultReasoningModel || config.reasoningModel
  );
  const ocrModelResolved = resolveModelOverride(
    runtimeOptions.ocrModel,
    runtimeOptions.allowClientModelOverride === true,
    runtimeOptions.allowedOcrModels,
    runtimeOptions.defaultOcrModel || config.ocrModel
  );
  const visionModel = visionModelResolved.selected || config.visionModel || DEFAULT_VISION_MODEL;
  const ocrModel = ocrModelResolved.selected || config.ocrModel || DEFAULT_OCR_MODEL;
  const reasoningModel =
    reasoningModelResolved.selected || config.reasoningModel || DEFAULT_REASONING_MODEL;
  const ocrEnabled = runtimeOptions.ocrEnabled === true;
  const enableThinking = runtimeOptions.enableThinking === true;
  const timeoutMs = parseTimeoutMs(runtimeOptions.timeoutMs, config.timeoutMs);
  const visionProfile = getModelProfile(visionModel);
  const ocrProfile = getModelProfile(ocrModel);
  const reasoningProfile = getModelProfile(reasoningModel);

  if (config.mockEnabled) {
    const visual = buildMockVisualObservations(payload.target);
    const ocrObservations = {
      image_a_texts: [],
      image_b_texts: [],
      image_b_removed_texts: [],
      matched_pairs: [],
      uncertainties: [],
    };
    const finalResult = buildMockFinalResult(payload.target);
    const visionUsage = {
      inputTokens: 300,
      outputTokens: 110,
      totalTokens: 410,
      source: "provider",
    };
    const reasoningUsage = {
      inputTokens: 220,
      outputTokens: 170,
      totalTokens: 390,
      source: "provider",
    };
    const ocrUsage = {
      inputTokens: 120,
      outputTokens: 70,
      totalTokens: 190,
      source: "provider",
    };
    return {
      analysisMode: "two_stage",
      model: reasoningModel,
      rawText: JSON.stringify(finalResult, null, 2),
      usage: ocrEnabled ? sumUsageBlocks(sumUsageBlocks(visionUsage, ocrUsage), reasoningUsage) : sumUsageBlocks(visionUsage, reasoningUsage),
      stages: {
        vision: {
          model: visionModel,
          callMode: visionProfile.callMode || DEFAULT_CALL_MODE,
          elapsedMs: 110,
          usage: visionUsage,
          thinking: {
            enableThinking,
            explicitDisableSent: enableThinking !== true,
            paramName: THINKING_PARAM_NAME,
            paramLocation: THINKING_PARAM_LOCATION,
            fallbackUsed: false,
            notApplicable: visionProfile.supportsThinking !== true,
          },
        },
        ocr: ocrEnabled
          ? {
              model: ocrModel,
              callMode: ocrProfile.callMode || DEFAULT_CALL_MODE,
              elapsedMs: 95,
              usage: ocrUsage,
              thinking: {
                enableThinking: false,
                explicitDisableSent: false,
                paramName: THINKING_PARAM_NAME,
                paramLocation: THINKING_PARAM_LOCATION,
                fallbackUsed: false,
                notApplicable: true,
                reason: "model-does-not-support-thinking-param",
              },
            }
          : undefined,
        reasoning: {
          model: reasoningModel,
          callMode: reasoningProfile.callMode || DEFAULT_CALL_MODE,
          elapsedMs: 130,
          usage: reasoningUsage,
          thinking: {
            enableThinking,
            explicitDisableSent: enableThinking !== true,
            paramName: THINKING_PARAM_NAME,
            paramLocation: THINKING_PARAM_LOCATION,
            fallbackUsed: false,
            notApplicable: reasoningProfile.supportsThinking !== true,
          },
        },
      },
      thinking: {
        enableThinking,
        explicitDisableSent: enableThinking !== true,
        paramName: THINKING_PARAM_NAME,
        paramLocation: THINKING_PARAM_LOCATION,
        fallbackUsed: false,
      },
      visualObservations: visual.visual_observations,
      ocrObservations: ocrEnabled ? ocrObservations : {},
      mock: true,
      selectedModels: {
        visionModel,
        ocrModel,
        reasoningModel,
      },
    };
  }

  const visionRequestBody = createVisionRequestBody(
    visionModel,
    promptConfig.visionSystemPrompt,
    promptConfig.visionUserPrompt,
    payload.images
  );
  const visionStartedAt = Date.now();
  const visionCompletion = await requestChatCompletionWithThinking(visionRequestBody, {
    enableThinking,
    timeoutMs,
    model: visionModel,
  });
  const visionElapsedMs = Date.now() - visionStartedAt;
  const visionUsage = createProviderUsage(visionCompletion.usage);
  const visionParsed = safeParseJson(String(visionCompletion.rawText || "").trim());
  if (!visionParsed || typeof visionParsed !== "object") {
    const parseError = new Error("视觉阶段返回非 JSON，无法解析 visual_observations。");
    parseError.code = "vision-invalid-json";
    parseError.statusCode = 502;
    throw parseError;
  }
  const visualObservations = visionParsed.visual_observations || visionParsed;

  let ocrObservations = {};
  let ocrStage = null;
  if (ocrEnabled) {
    const ocrRequestBody = createVisionRequestBody(
      ocrModel,
      promptConfig.ocrSystemPrompt,
      promptConfig.ocrUserPrompt,
      payload.images
    );
    const ocrStartedAt = Date.now();
    const ocrCompletion = await requestChatCompletionWithThinking(ocrRequestBody, {
      enableThinking,
      timeoutMs,
      model: ocrModel,
    });
    const ocrElapsedMs = Date.now() - ocrStartedAt;
    const ocrUsage = createProviderUsage(ocrCompletion.usage);
    const ocrParsed = safeParseJson(String(ocrCompletion.rawText || "").trim());
    if (!ocrParsed || typeof ocrParsed !== "object") {
      const ocrParseError = new Error("OCR 阶段返回非 JSON，无法解析 ocr_observations。");
      ocrParseError.code = "ocr-invalid-json";
      ocrParseError.statusCode = 502;
      throw ocrParseError;
    }
    ocrObservations = ocrParsed.ocr_observations || ocrParsed;
    ocrStage = {
      model: ocrCompletion.model || ocrModel,
      callMode: ocrCompletion.callMode || ocrProfile.callMode || DEFAULT_CALL_MODE,
      elapsedMs: ocrElapsedMs,
      usage: ocrUsage,
      thinking: ocrCompletion.thinking || {},
    };
  }

  const reasoningRequestBody = createTextRequestBody(
    reasoningModel,
    promptConfig.reasoningSystemPrompt,
    promptConfig.buildReasoningUserPrompt(visualObservations, ocrObservations)
  );
  const reasoningStartedAt = Date.now();
  const reasoningCompletion = await requestChatCompletionWithThinking(reasoningRequestBody, {
    enableThinking,
    timeoutMs,
    model: reasoningModel,
  });
  const reasoningElapsedMs = Date.now() - reasoningStartedAt;
  const reasoningUsage = createProviderUsage(reasoningCompletion.usage);

  const totalUsage = ocrStage
    ? sumUsageBlocks(sumUsageBlocks(visionUsage, ocrStage.usage), reasoningUsage)
    : sumUsageBlocks(visionUsage, reasoningUsage);

  return {
    analysisMode: "two_stage",
    model: reasoningCompletion.model || reasoningModel,
    rawText: reasoningCompletion.rawText || "",
    usage: totalUsage,
    stages: {
      vision: {
        model: visionCompletion.model || visionModel,
        callMode: visionCompletion.callMode || visionProfile.callMode || DEFAULT_CALL_MODE,
        elapsedMs: visionElapsedMs,
        usage: visionUsage,
        thinking: visionCompletion.thinking || {},
      },
      ocr: ocrStage || undefined,
      reasoning: {
        model: reasoningCompletion.model || reasoningModel,
        callMode: reasoningCompletion.callMode || reasoningProfile.callMode || DEFAULT_CALL_MODE,
        elapsedMs: reasoningElapsedMs,
        usage: reasoningUsage,
        thinking: reasoningCompletion.thinking || {},
      },
    },
    thinking: {
      enableThinking,
      explicitDisableSent: enableThinking !== true,
      paramName: THINKING_PARAM_NAME,
      paramLocation: THINKING_PARAM_LOCATION,
      fallbackUsed:
        visionCompletion?.thinking?.fallbackUsed === true ||
        ocrStage?.thinking?.fallbackUsed === true ||
        reasoningCompletion?.thinking?.fallbackUsed === true,
    },
    visualObservations,
    ocrObservations,
    mock: false,
    selectedModels: {
      visionModel,
      ocrModel,
      reasoningModel,
    },
  };
}

async function analyzeTask21(input, prompts, options) {
  const runtimeOptions = options && typeof options === "object" ? options : {};
  const config = getClientConfig();
  const analysisMode = normalizeAnalysisMode(runtimeOptions.analysisMode, config.analysisMode);
    const requestOptions = {
      analysisMode,
      allowClientModelOverride: runtimeOptions.allowClientModelOverride === true,
      allowedVisionModels: Array.isArray(runtimeOptions.allowedVisionModels)
        ? runtimeOptions.allowedVisionModels
        : config.allowedVisionModels,
      allowedOcrModels: Array.isArray(runtimeOptions.allowedOcrModels)
        ? runtimeOptions.allowedOcrModels
        : config.allowedOcrModels,
      allowedReasoningModels: Array.isArray(runtimeOptions.allowedReasoningModels)
        ? runtimeOptions.allowedReasoningModels
        : config.allowedReasoningModels,
    allowedSingleModels: Array.isArray(runtimeOptions.allowedSingleModels)
      ? runtimeOptions.allowedSingleModels
      : config.allowedSingleModels,
      visionModel: sanitizeModelName(runtimeOptions.visionModel, ""),
      ocrEnabled:
        typeof runtimeOptions.ocrEnabled === "boolean"
          ? runtimeOptions.ocrEnabled === true
          : config.ocrEnabled === true,
      ocrModel: sanitizeModelName(runtimeOptions.ocrModel, ""),
      reasoningModel: sanitizeModelName(runtimeOptions.reasoningModel, ""),
      singleModel: sanitizeModelName(runtimeOptions.singleModel, ""),
      defaultVisionModel: config.visionModel,
      defaultOcrModel: config.ocrModel,
      defaultReasoningModel: config.reasoningModel,
      defaultSingleModel: config.singleModel,
    enableThinking: false,
    timeoutMs: parseTimeoutMs(runtimeOptions.timeoutMs, config.timeoutMs),
  };

  if (analysisMode === "single_model") {
    return analyzeTask21SingleModel(input, prompts, requestOptions, config);
  }
  return analyzeTask21TwoStage(input, prompts, requestOptions, config);
}

module.exports = {
  DEFAULT_ANALYSIS_MODE,
  DEFAULT_OCR_MODEL,
  DEFAULT_REASONING_MODEL,
  DEFAULT_SINGLE_MODEL,
  DEFAULT_VISION_MODEL,
  THINKING_PARAM_NAME,
  THINKING_PARAM_LOCATION,
  analyzeTask21,
  getClientConfig,
  isEnableThinkingUnsupportedError,
  normalizeAnalysisMode,
  parseAllowedModels,
  sanitizeModelName,
};

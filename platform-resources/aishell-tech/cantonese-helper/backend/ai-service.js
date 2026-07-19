"use strict";

const {
  DEFAULT_CONVERT_MODEL,
  DEFAULT_LISTEN_MODEL,
  DEFAULT_OMNI_MODEL,
  DEFAULT_QWEN_COMPARE_MODEL,
  DEFAULT_REQUEST_PARAMS,
  DEFAULT_TIMEOUT_MS,
  LISTEN_MODEL_OPTIONS,
  OMNI_MODEL_OPTIONS,
  TEXT_MODEL_OPTIONS,
} = require("./config");

const SERVICE_NAME = "aishell-tech-cantonese-helper-ai-recommend";
const SCRIPT_ID = "aishellTechCantoneseAssistant";
const DEFAULT_COMPARE_ADOPTION_THRESHOLD = 0.75;

const DEFAULT_CONVERT_PROMPT = [
  "你正在處理粵語標註的參考文字。",
  "只把參考文字轉成自然、忠實的繁體粵語口語候選；不可翻譯成普通話，保留合理中英混說。",
  "這個候選只供後續聽音比較，不能視為音頻事實，不可補寫資訊。",
  "只回傳 JSON：{\"convertedText\":\"...\"}。",
].join("\n");
const DEFAULT_LISTEN_PROMPT = [
  "你正在處理粵語音頻轉寫。",
  "請忠實轉寫音頻中的繁體粵語口語，不翻譯成普通話；保留合理中英混說。",
  "請規範空白與常用全角中文標點，但不要補寫、刪改或改寫說話內容。",
  "同時根據真實音頻判斷語速，只可回傳 slow、normal 或 fast。",
  "只回傳 JSON：{\"heardText\":\"...\",\"recommendedSpeed\":\"slow|normal|fast\"}。",
].join("\n");
const DEFAULT_QWEN_COMPARE_PROMPT = [
  "你正在比較粵語候選文字與真實聽音轉寫。",
  "最終文字必須忠實於音頻，使用繁體粵語口語；候選文字只作參考。",
  "不要把粵語翻譯為普通話，不可憑候選補寫音頻沒有的內容。",
  "請回傳 JSON：{\"recommendedText\":\"...\",\"decision\":\"use_heard_text|use_converted_text|merge\",\"confidence\":0-1,\"needHumanReview\":true|false,\"changePoints\":[]}。",
].join("\n");
const DEFAULT_OMNI_COMPARE_PROMPT = [
  "你正在比較粵語候選、聽音轉寫與真實音頻。",
  "以真實音頻為準，輸出繁體粵語口語與語速；候選與聽音文字只作參考。",
  "只回傳 JSON：{\"recommendedText\":\"...\",\"recommendedSpeed\":\"slow|normal|fast\",\"decision\":\"use_heard_text|use_converted_text|merge\",\"confidence\":0-1,\"needHumanReview\":true|false,\"changePoints\":[]}。",
].join("\n");
const DEFAULT_SINGLE_PROMPT = DEFAULT_LISTEN_PROMPT;

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function createHttpError(statusCode, code, message) {
  const error = new Error(String(message || "请求失败。"));
  error.statusCode = Number(statusCode) || 500;
  error.code = String(code || "request-error");
  return error;
}

function normalizeCantoneseText(value) {
  const compact = String(value || "")
    .replace(/\.\.\.+/g, "…")
    .replace(/[，、,]/g, "，")
    .replace(/[。｡.]/g, "。")
    .replace(/[？?]/g, "？")
    .replace(/[！!]/g, "！")
    .replace(/[：:]/g, "：")
    .replace(/[；;]/g, "；")
    .replace(/[\s\u3000]+/g, " ")
    .trim();
  return compact
    .replace(/[\u3400-\u9FFF]\s+(?=[\u3400-\u9FFF])/g, function (match) {
      return match.replace(/\s+/g, "");
    })
    .replace(/\s+([，。？！：；、…」』）】])/g, "$1")
    .replace(/([「『（【])\s+/g, "$1")
    .replace(/([，。？！：；、…])\s+/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizeSpeed(value) {
  const text = normalizeText(value).toLowerCase();
  if (text === "slow" || text === "慢" || text === "慢速") return "slow";
  if (text === "normal" || text === "正常" || text === "中速" || text === "適中") return "normal";
  if (text === "fast" || text === "快" || text === "快速") return "fast";
  throw createHttpError(502, "invalid-recommended-speed", "模型返回的语速值无效。");
}

function parseJsonText(rawText) {
  const text = String(rawText || "").trim();
  if (!text) throw createHttpError(502, "empty-provider-response", "模型未返回文本内容。");
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1] || text;
  try {
    return JSON.parse(fenced);
  } catch (_error) {
    const start = fenced.indexOf("{");
    const end = fenced.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(fenced.slice(start, end + 1));
      } catch (_nestedError) {
        // Use the common contract error below.
      }
    }
  }
  throw createHttpError(502, "invalid-model-json", "模型输出不是有效 JSON。");
}

function normalizeUsage(value) {
  const source = value && typeof value === "object" ? value : {};
  const promptTokens = Number(source.prompt_tokens || source.input_tokens || source.promptTokens || 0) || 0;
  const completionTokens = Number(source.completion_tokens || source.output_tokens || source.completionTokens || 0) || 0;
  return {
    promptTokens,
    completionTokens,
    totalTokens: Number(source.total_tokens || source.totalTokens || 0) || promptTokens + completionTokens,
    raw: source,
  };
}

function normalizeStageParams(value) {
  const source = value && typeof value === "object" ? value : {};
  const result = {};
  ["temperature", "top_p", "max_tokens", "max_completion_tokens", "presence_penalty", "frequency_penalty", "seed"].forEach(
    function (key) {
      if (source[key] !== undefined && source[key] !== null && source[key] !== "") result[key] = source[key];
    }
  );
  if (Array.isArray(source.stop) && source.stop.length > 0) result.stop = source.stop.slice(0, 8);
  return result;
}

function normalizeTextModel(value, fallback) {
  const model = normalizeText(value);
  return TEXT_MODEL_OPTIONS.includes(model) ? model : fallback;
}

function normalizeOmniModel(value, fallback) {
  const model = normalizeText(value);
  return OMNI_MODEL_OPTIONS.includes(model) ? model : fallback;
}

function normalizeListenModel(value) {
  const model = normalizeText(value);
  return LISTEN_MODEL_OPTIONS.includes(model) ? model : DEFAULT_LISTEN_MODEL;
}

function normalizeCompareFamily(value, fallback) {
  const normalized = normalizeText(value).toLowerCase();
  return normalized === "omni" || normalized === "qwen"
    ? normalized
    : String(fallback || "qwen").toLowerCase() === "omni"
      ? "omni"
      : "qwen";
}

function normalizeThreshold(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 1
    ? Number(number.toFixed(3))
    : DEFAULT_COMPARE_ADOPTION_THRESHOLD;
}

function buildStageDefaults() {
  return {
    convert: { model: DEFAULT_CONVERT_MODEL, prompt: DEFAULT_CONVERT_PROMPT, params: Object.assign({}, DEFAULT_REQUEST_PARAMS) },
    listen: { model: DEFAULT_LISTEN_MODEL, prompt: DEFAULT_LISTEN_PROMPT, params: Object.assign({}, DEFAULT_REQUEST_PARAMS) },
    compare: {
      family: "qwen",
      qwenModel: DEFAULT_QWEN_COMPARE_MODEL,
      omniModel: DEFAULT_OMNI_MODEL,
      prompt: DEFAULT_QWEN_COMPARE_PROMPT,
      qwenPrompt: DEFAULT_QWEN_COMPARE_PROMPT,
      omniPrompt: DEFAULT_OMNI_COMPARE_PROMPT,
      params: Object.assign({}, DEFAULT_REQUEST_PARAMS),
      adoptionThreshold: DEFAULT_COMPARE_ADOPTION_THRESHOLD,
    },
  };
}

function normalizeRecommendRequest(input) {
  const source = input && typeof input === "object" ? input : {};
  const taskItemId = normalizeText(source.taskItemId || source.itemId);
  const audioUrl = normalizeText(source.audioUrl);
  if (!taskItemId) throw createHttpError(400, "missing-task-item-id", "缺少 taskItemId。");
  if (!audioUrl) throw createHttpError(400, "invalid-audio-url", "缺少可用音频地址。");

  const defaults = buildStageDefaults();
  const rawStages = source.aiStages && typeof source.aiStages === "object" ? source.aiStages : {};
  const rawConvert = rawStages.convert && typeof rawStages.convert === "object" ? rawStages.convert : {};
  const rawListen = rawStages.listen && typeof rawStages.listen === "object" ? rawStages.listen : {};
  const rawRecognize = rawStages.recognize && typeof rawStages.recognize === "object" ? rawStages.recognize : {};
  const rawCompare = rawStages.compare && typeof rawStages.compare === "object" ? rawStages.compare : {};
  const legacyParams = normalizeStageParams(source.aiOptions);
  const listenModel = normalizeListenModel(
    rawListen.model || rawRecognize.model || source.listenModel || source.singleModel
  );
  let compareFamily = normalizeCompareFamily(rawCompare.family || source.compareFamily, "qwen");
  if (listenModel === "fun-asr" && compareFamily === "qwen") compareFamily = "omni";
  const compareModel = compareFamily === "omni"
    ? normalizeOmniModel(rawCompare.model || rawCompare.omniModel || source.compareModel || source.singleModel, DEFAULT_OMNI_MODEL)
    : normalizeTextModel(rawCompare.model || rawCompare.qwenModel || source.compareModel, DEFAULT_QWEN_COMPARE_MODEL);
  const comparePrompt = normalizeText(
    rawCompare.prompt || (compareFamily === "omni" ? rawCompare.omniPrompt : rawCompare.qwenPrompt) || source.aiOptions?.comparePrompt
  ) || (compareFamily === "omni" ? defaults.compare.omniPrompt : defaults.compare.qwenPrompt);

  return {
    requestId: normalizeText(source.requestId || source.clientRequestId),
    taskId: normalizeText(source.taskId),
    packageId: normalizeText(source.packageId),
    taskItemId,
    fileName: normalizeText(source.fileName),
    audioUrl,
    referenceText: normalizeText(source.referenceText),
    existingMarkText: normalizeText(source.existingMarkText || source.currentInputText),
    aiUsageOperatorName: normalizeText(source.aiUsageOperatorName),
    platformUserName: normalizeText(source.platformUserName),
    platformUserId: normalizeText(source.platformUserId),
    frontConcurrency: Number(source.frontConcurrency) || null,
    modelMode: "three_stage_parallel",
    pipelineMode: listenModel === "fun-asr" ? "fun_asr_omni_compare" : compareFamily === "omni" ? "omni_omni_compare" : "omni_text_compare",
    enableThinking: false,
    aiStages: {
      convert: {
        model: normalizeTextModel(rawConvert.model || source.convertModel || source.candidateModel, DEFAULT_CONVERT_MODEL),
        prompt: normalizeText(rawConvert.prompt || rawConvert.convertPrompt || source.aiOptions?.candidatePrompt) || defaults.convert.prompt,
        params: Object.keys(rawConvert.params || {}).length ? normalizeStageParams(rawConvert.params) : legacyParams,
      },
      listen: {
        model: listenModel,
        prompt: normalizeText(
          rawListen.prompt ||
            rawListen.listenPrompt ||
            rawRecognize.prompt ||
            rawRecognize.listenPrompt ||
            source.aiOptions?.listenPrompt ||
            source.singlePrompt
        ) || defaults.listen.prompt,
        params: Object.keys(rawListen.params || {}).length
          ? normalizeStageParams(rawListen.params)
          : Object.keys(rawRecognize.params || {}).length
            ? normalizeStageParams(rawRecognize.params)
            : legacyParams,
      },
      compare: {
        family: compareFamily,
        model: compareModel,
        prompt: comparePrompt,
        params: Object.keys(rawCompare.params || {}).length ? normalizeStageParams(rawCompare.params) : legacyParams,
        adoptionThreshold: normalizeThreshold(rawCompare.adoptionThreshold ?? source.aiOptions?.audioFirstReferenceCorrectionThreshold),
        speedSource: compareFamily === "omni" ? "omni-compare" : "listen",
      },
    },
  };
}

function normalizeProviderError(error, requestId, stage) {
  const source = error instanceof Error ? error : createHttpError(500, "request-error", "请求失败。");
  const statusCode = Number(source.providerStatus || source.statusCode || 500) || 500;
  source.statusCode = statusCode;
  source.requestId = requestId;
  source.stage = normalizeText(source.stage || stage) || "post_process";
  if (statusCode === 429) { source.code = "provider-rate-limited"; source.retryable = true; }
  if (statusCode === 504 || source.code === "timeout") { source.code = "timeout"; source.retryable = true; }
  return source;
}

function createCantoneseRecommendService(overrides) {
  const deps = overrides && typeof overrides === "object" ? overrides : {};
  const pipeline = deps.pipeline && typeof deps.pipeline.run === "function"
    ? deps.pipeline
    : require("./pipeline").createCantoneseRecommendPipeline(deps);
  return {
    run: async function run(input, runtime) {
      const request = normalizeRecommendRequest(input);
      try {
        return await pipeline.run(request, Object.assign({}, runtime || {}, { requestId: request.requestId }));
      } catch (error) {
        throw normalizeProviderError(error, request.requestId, error?.stage);
      }
    },
  };
}

function createDefaultsPayload() {
  const stages = buildStageDefaults();
  return {
    success: true,
    service: SERVICE_NAME,
    scriptId: SCRIPT_ID,
    defaults: {
      timeoutMs: DEFAULT_TIMEOUT_MS,
      modelMode: "three_stage_parallel",
      enableThinking: false,
      stages,
      singleModel: stages.listen.model,
      convertModelOptions: TEXT_MODEL_OPTIONS.slice(),
      candidateModelOptions: TEXT_MODEL_OPTIONS.slice(),
      listenModelOptions: LISTEN_MODEL_OPTIONS.slice(),
      qwenCompareModelOptions: TEXT_MODEL_OPTIONS.slice(),
      compareModelOptions: TEXT_MODEL_OPTIONS.slice(),
      omniCompareModelOptions: OMNI_MODEL_OPTIONS.slice(),
      singleModelOptions: OMNI_MODEL_OPTIONS.slice(),
      singlePrompt: stages.listen.prompt,
      requestParams: Object.assign({}, stages.listen.params),
      compareFamilyOptions: ["qwen", "omni"],
    },
  };
}

function createHealthPayload() {
  return {
    success: true,
    service: SERVICE_NAME,
    scriptId: SCRIPT_ID,
    status: "ok",
    timeoutMs: DEFAULT_TIMEOUT_MS,
    model: DEFAULT_OMNI_MODEL,
    enableThinking: false,
    stages: buildStageDefaults(),
    jobMode: "async",
  };
}

function buildRecommendSuccessBody(result) {
  const source = result && typeof result === "object" ? result : {};
  const data = source.data && typeof source.data === "object" ? source.data : source;
  return { success: true, data, meta: source.meta && typeof source.meta === "object" ? source.meta : {} };
}

function buildRecommendErrorBody(input, requestId) {
  const source = input && input.error instanceof Error ? input.error : input instanceof Error ? input : createHttpError(500, "request-error", "请求失败。");
  const resolvedRequestId = normalizeText(requestId || input?.requestId || source.requestId);
  const stage = normalizeText(source.stage) || "post_process";
  return {
    success: false,
    error: {
      code: normalizeText(source.code) || "request-error",
      message: normalizeText(source.safeMessage || source.message) || "请求失败。",
      stage,
      retryable: source.retryable === true || Number(source.statusCode) === 429 || Number(source.statusCode) === 504,
      providerStatus: Number(source.providerStatus || source.statusCode || 0) || 0,
      providerCode: normalizeText(source.providerCode),
    },
    meta: Object.assign({ requestId: resolvedRequestId, stage, cancelled: source.code === "aborted" || source.cancelled === true }, source.meta || {}),
  };
}

module.exports = {
  DEFAULT_COMPARE_ADOPTION_THRESHOLD,
  DEFAULT_CONVERT_PROMPT,
  DEFAULT_LISTEN_PROMPT,
  DEFAULT_OMNI_COMPARE_PROMPT,
  DEFAULT_QWEN_COMPARE_PROMPT,
  DEFAULT_SINGLE_PROMPT,
  SERVICE_NAME,
  SCRIPT_ID,
  buildRecommendErrorBody,
  buildRecommendSuccessBody,
  buildStageDefaults,
  createCantoneseRecommendService,
  createHealthPayload,
  createDefaultsPayload,
  createHttpError,
  normalizeCantoneseText,
  normalizeProviderError,
  normalizeRecommendRequest,
  normalizeSpeed,
  normalizeUsage,
  parseJsonText,
};

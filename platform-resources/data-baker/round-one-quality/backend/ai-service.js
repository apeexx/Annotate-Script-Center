"use strict";

const fs = require("fs");
const path = require("path");

const {
  DATABAKER_COMPARE_MODEL_OPTIONS,
  DATABAKER_LISTEN_MODEL_OPTIONS,
  DATABAKER_SINGLE_MODEL_OPTIONS,
  DEFAULT_COMPARE_MODEL,
  DEFAULT_FUN_ASR_MODEL,
  DEFAULT_OMNI_MODEL,
  DEFAULT_REQUEST_PARAMS,
  SUPPORTED_REQUEST_PARAMS,
  deriveDataBakerPipelineMode,
  getDataBakerAiQualifiedAutofillConcurrencyRule,
  normalizeDataBakerAiQualifiedAutofillConcurrency,
  normalizeDataBakerCompareModel,
  normalizeDataBakerListenModel,
  normalizeDataBakerRecognitionMode,
  normalizeDataBakerSingleModel,
  resolveDataBakerDefaultListenModel,
  resolveDataBakerDefaultSingleModel,
} = require("../../../backend/ai/config");
const {
  listModelsByFamily,
} = require("../../../backend/ai/model-dispatcher");
const {
  estimateProjectCost,
} = require("../../../backend/ai/model-pricing");
const {
  getClientConfig,
  requestCompare,
  requestOmniInputAudio,
} = require("../../../backend/ai/providers/qwen-openai-compatible");
const {
  getFunAsrClientConfig,
  requestFunAsrRecognition,
} = require("../../../backend/ai/providers/funasr");
const {
  buildModelQueueKey,
  enqueueProviderTask,
  getGroupSettings,
  getGlobalQueueMaxSize,
  getGlobalRetryMax,
  getQueueSnapshots,
} = require("../../../backend/ai/provider-queue");
const {
  buildRecommendCacheKey,
  getCacheSnapshot,
  getCachedRecommendResult,
  setCachedRecommendResult,
} = require("../../../backend/ai/result-cache");
const { createJobTimeoutError, normalizeAbortError } = require("../../../backend/ai/errors");
const { sanitizeProviderText } = require("../../../backend/ai/sanitizer");
const {
  getAiJobStoreConfig,
  getAiJobStoreSnapshot,
} = require("./ai-job-store");
const { rememberAiDebug } = require("./ai-debug-store");
const { buildAsyncJobRuntimeMeta } = require("../../../backend/ai-framework/runtime/ai-runtime-meta");
const {
  loadBusinessLexiconSource,
  normalizeText: normalizeBusinessLexiconText,
} = require("../../../backend/business-lexicon");

const RULE_VERSION = "data-baker-round-one-quality-ai-v11-direct-recommend-60s";
const DEFAULT_OMNI_SINGLE_TEMPLATE = [
  "你要一次完成：听音、对比页面候选文本、输出最终推荐文本。",
  "页面候选文本只作为参考，实际发声优先。",
  "输出 JSON 字段必须包含 recommendedText、heardText、decision、changePoints、confidence、needHumanReview。",
  "recommendedText 与 heardText 的普通中文统一输出简体；命中闽南业务词表 JSON 的建议用字必须保留。",
  "不要把方言建议用字改回普通话同义词。",
  "只输出 JSON，不要输出 Markdown 或解释文字。",
].join("\n");
const DEFAULT_OMNI_LISTEN_TEMPLATE = [
  "你只负责听音转写，不负责生成最终推荐文本。",
  "页面候选文本、朗读要求和有效时间只用于辅助你更稳定地识别音频内容。",
  "输出 JSON 字段必须包含 heardText、confidence、needHumanReview。",
  "heardText 的普通中文统一输出简体。",
  "只输出 JSON，不要输出 Markdown 或解释文字。",
].join("\n");
const DEFAULT_COMPARE_TEMPLATE = [
  "听音阶段已经完成音频转写；你现在只负责比较 heardText 与页面候选文本，输出最终推荐文本。",
  "以实际发声为主，不因词表存在就无依据改写。",
  "recommendedText 的普通中文统一使用简体；pageText/heardText 中的普通繁体字应转换为简体。",
  "但命中闽南业务词表 JSON 的建议用字必须保持不变，不参与普通简繁转换。",
  "输出 JSON 字段：recommendedText、decision、changePoints、confidence、needHumanReview。",
  "只输出 JSON，不输出额外解释。",
].join("\n");
const ESTIMATE_NOTE = "价格按共享百炼官方文档配置估算，仅覆盖当前已配置模型。";
const EFFECTIVE_REVENUE_CNY_PER_HOUR = 350;
const DEFAULT_LOG_DIR = path.join(__dirname, "logs");
const JSONL_FILE_NAME = "recommend-calls.jsonl";
const CSV_FILE_NAME = "recommend-calls.csv";
const MINNAN_LEXICON_JSON_PATH = path.join(__dirname, "reference", "minnan-lexicon.json");
const MINNAN_LEXICON_REFERENCE_CSV_PATH = path.join(__dirname, "reference", "minnan-lexicon.csv");
const DEFAULT_CONTEXT_LIMIT = 40;
const RECOGNITION_MODE_OPTIONS = [
  { value: "two_stage", label: "双模型：听音模型 + 比较模型" },
  { value: "omni_single", label: "单模型：Omni 单模型" },
];
const SUPPORTED_PIPELINE_MODES = [
  { value: "fun_asr_compare", label: "Fun-ASR 听音 + 比较模型" },
  { value: "qwen_omni_compare", label: "Qwen Omni 听音 + 比较模型" },
  { value: "omni_single", label: "Qwen Omni 单模型" },
];
const LEGACY_PIPELINE_MODE_MAP = {
  qwen_omni_two_stage: "two_stage",
  listen_only: "omni_single",
  fun_asr_compare: "two_stage",
  qwen_omni_compare: "two_stage",
};
const deprecatedModeLogKeys = new Set();
const BASE_ENTRIES = [
  { mandarin: "我/我们", suggested: "阮、咱" },
  { mandarin: "你/你们", suggested: "汝、恁" },
  { mandarin: "他/她/它/他们/她们", suggested: "伊、因" },
  { mandarin: "这位", suggested: "即个" },
  { mandarin: "现在", suggested: "即阵" },
  { mandarin: "的", suggested: "诶" },
  { mandarin: "很", suggested: "真" },
  { mandarin: "喜欢", suggested: "欢喜" },
  { mandarin: "吃", suggested: "食" },
  { mandarin: "整天", suggested: "规日" },
  { mandarin: "门儿清", suggested: "门理清" },
  { mandarin: "那些事儿", suggested: "迄代志" },
];
const TRADITIONAL_TO_SIMPLIFIED_PHRASES = [
  ["這個", "这个"],
  ["音樂", "音乐"],
  ["放鬆", "放松"],
  ["聽聽", "听听"],
  ["聽音", "听音"],
  ["問題", "问题"],
  ["時間", "时间"],
  ["標註", "标注"],
  ["檢質", "检质"],
  ["錄音", "录音"],
  ["頁面", "页面"],
  ["裡面", "里面"],
  ["後面", "后面"],
  ["發聲", "发声"],
  ["輸入", "输入"],
  ["輸出", "输出"],
  ["開關", "开关"],
  ["車門", "车门"],
  ["麵體", "面体"],
  ["聽起來", "听起来"],
  ["說話", "说话"],
  ["語音", "语音"],
];
const TRADITIONAL_TO_SIMPLIFIED_MAP = {
  "這": "这",
  "個": "个",
  "問": "问",
  "題": "题",
  "複": "复",
  "雜": "杂",
  "聽": "听",
  "說": "说",
  "語": "语",
  "體": "体",
  "廢": "废",
  "殘": "残",
  "覺": "觉",
  "認": "认",
  "識": "识",
  "實": "实",
  "際": "际",
  "發": "发",
  "聲": "声",
  "優": "优",
  "輸": "输",
  "資": "资",
  "訊": "讯",
  "轉": "转",
  "換": "换",
  "後": "后",
  "裡": "里",
  "還": "还",
  "點": "点",
  "會": "会",
  "應": "应",
  "對": "对",
  "讓": "让",
  "與": "与",
  "為": "为",
  "無": "无",
  "詞": "词",
  "標": "标",
  "註": "注",
  "檢": "检",
  "稱": "称",
  "錯": "错",
  "過": "过",
  "進": "进",
  "選": "选",
  "擇": "择",
  "寫": "写",
  "虛": "虚",
  "該": "该",
  "嗎": "吗",
  "麼": "么",
  "開": "开",
  "關": "关",
  "頁": "页",
  "錄": "录",
  "樂": "乐",
  "鬆": "松",
  "氣": "气",
  "車": "车",
  "邊": "边",
  "麵": "面",
  "滿": "满",
  "裝": "装",
  "臺": "台",
  "網": "网",
  "電": "电",
  "將": "将",
  "衛": "卫",
  "術": "术",
  "萬": "万",
  "時": "时",
  "間": "间",
  "長": "长",
  "變": "变",
  "號": "号",
  "門": "门",
  "員": "员",
  "線": "线",
  "響": "响",
  "讀": "读",
  "歡": "欢",
  "講": "讲",
  "來": "来",
  "頭": "头",
  "見": "见",
  "愛": "爱",
  "燈": "灯",
  "觀": "观",
  "點": "点",
  "場": "场",
  "風": "风",
  "國": "国",
  "機": "机",
  "將": "将",
  "變": "变",
  "萬": "万",
  "產": "产",
  "業": "业",
  "內": "内",
  "廣": "广",
  "復": "复",
  "雜": "杂",
};
const CSV_COLUMNS = [
  { key: "createdAt", header: "创建时间" },
  { key: "requestId", header: "请求ID" },
  { key: "success", header: "是否成功" },
  { key: "durationMs", header: "耗时毫秒" },
  { key: "listenDurationMs", header: "听音耗时毫秒" },
  { key: "compareDurationMs", header: "对比耗时毫秒" },
  { key: "pipelineMode", header: "流水线模式" },
  { key: "annotatorName", header: "标注员" },
  { key: "collectId", header: "采集ID" },
  { key: "itemId", header: "记录ID" },
  { key: "textId", header: "文本ID" },
  { key: "sentenceNumber", header: "句子编号" },
  { key: "readRequire", header: "朗读要求" },
  { key: "audioHostname", header: "音频域名" },
  { key: "pageText", header: "页面候选文本" },
  { key: "heardText", header: "AI听音文本" },
  { key: "recommendedText", header: "AI推荐文本" },
  { key: "isChanged", header: "是否变更" },
  { key: "needHumanReview", header: "需要人工复核" },
  { key: "decision", header: "决策" },
  { key: "lexiconEnabled", header: "是否启用词表" },
  { key: "lexiconRewriteMode", header: "词表替换模式" },
  { key: "lexiconRewriteChanged", header: "词表是否改写" },
  { key: "lexiconRewriteChangeCount", header: "词表改写数量" },
  { key: "lexiconRewriteChanges", header: "词表改写明细" },
  { key: "listenConfidence", header: "听音置信度" },
  { key: "compareConfidence", header: "对比置信度" },
  { key: "listenModel", header: "听音模型" },
  { key: "compareModel", header: "对比模型" },
  { key: "listenPromptTokens", header: "听音输入Token" },
  { key: "listenCompletionTokens", header: "听音输出Token" },
  { key: "listenTotalTokens", header: "听音总Token" },
  { key: "comparePromptTokens", header: "对比输入Token" },
  { key: "compareCompletionTokens", header: "对比输出Token" },
  { key: "compareTotalTokens", header: "对比总Token" },
  { key: "totalTokens", header: "总Token" },
  { key: "estimatedCostCny", header: "预估AI成本人民币" },
  { key: "effectiveRevenueCny", header: "有效时长收入人民币" },
  { key: "grossProfitCny", header: "预估毛利润人民币" },
  { key: "effectiveStartTime", header: "有效开始时间" },
  { key: "effectiveEndTime", header: "有效结束时间" },
  { key: "effectiveTime", header: "有效时长" },
  { key: "audioDuration", header: "音频总时长" },
  { key: "clientVersion", header: "扩展版本" },
  { key: "frontConcurrencyOriginal", header: "前端并发原始值" },
  { key: "frontConcurrencyNormalized", header: "前端并发归一值" },
  { key: "concurrencyModelType", header: "前端并发模型类型" },
  { key: "mock", header: "是否Mock" },
  { key: "errorCode", header: "错误码" },
  { key: "errorMessage", header: "错误信息" },
];

let lexiconCache = null;
let warnedMissing = false;
let warnedReadFailure = false;

function createRequestId() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const suffix = Math.random().toString(36).slice(2, 8);
  return String(yyyy) + mm + dd + "-" + hh + mi + ss + "-" + suffix;
}

function createHttpError(statusCode, message, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code || "";
  return error;
}

function isHttpUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (error) {
    return false;
  }
}

function parseAudioHostname(audioUrl) {
  try {
    return new URL(audioUrl).hostname || "";
  } catch (error) {
    return "";
  }
}

function normalizeNullableNumber(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function normalizeAnnotatorName(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.slice(0, 40);
}

function resolvePipelineMode(value, fallbackMode, sourceLabel) {
  const fallbackText = String(fallbackMode || "qwen_omni_compare").trim().toLowerCase();
  const normalizedFallback =
    fallbackText === "fun_asr_compare" ||
    fallbackText === "omni_single"
      ? fallbackText
      : "qwen_omni_compare";
  const rawText = String(value || "").trim().toLowerCase();
  if (!rawText) {
    return {
      mode: normalizedFallback,
      deprecatedFrom: "",
      source: sourceLabel || "env",
      warning: "",
    };
  }
  if (rawText === "fun_asr_compare" || rawText === "qwen_omni_compare" || rawText === "omni_single") {
    return {
      mode: rawText,
      deprecatedFrom: "",
      source: sourceLabel || "env",
      warning: "",
    };
  }
  if (LEGACY_PIPELINE_MODE_MAP[rawText]) {
    const normalizedRecognitionMode = normalizeDataBakerRecognitionMode(LEGACY_PIPELINE_MODE_MAP[rawText], "two_stage");
    const targetMode =
      normalizedRecognitionMode === "omni_single"
        ? "omni_single"
        : normalizedFallback;
    return {
      mode: targetMode,
      deprecatedFrom: rawText,
      source: sourceLabel || "env",
      warning: "deprecated pipeline mode " + rawText + " 已迁移为 " + targetMode,
    };
  }
  return {
    mode: normalizedFallback,
    deprecatedFrom: "",
    source: sourceLabel || "env",
    warning: "",
  };
}

function getEnvPipelineResolution() {
  return resolvePipelineMode(
    process.env.DATABAKER_AI_PIPELINE_MODE || "qwen_omni_compare",
    "qwen_omni_compare",
    "env"
  );
}

function getEnvRecognitionMode() {
  return normalizeDataBakerRecognitionMode(process.env.DATABAKER_AI_PIPELINE_MODE || "two_stage", "two_stage");
}

function logDeprecatedPipelineOnce(resolution) {
  if (!resolution?.deprecatedFrom || !resolution.warning) {
    return;
  }
  const key = resolution.source + ":" + resolution.deprecatedFrom + ":" + resolution.mode;
  if (deprecatedModeLogKeys.has(key)) {
    return;
  }
  deprecatedModeLogKeys.add(key);
  console.warn("[DataBaker][round-one-quality][ai]", resolution.warning);
}

function normalizePromptText(value) {
  return String(value || "").replace(/\r\n/g, "\n").trim().slice(0, 8000);
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
    if (!text || result.length >= 8 || result.indexOf(text) >= 0) {
      return;
    }
    result.push(text);
  });
  return result;
}

function normalizeModelText(value) {
  return String(value || "").replace(/[\r\n]+/g, " ").trim().slice(0, 80);
}

function normalizeAiOptions(value) {
  const source = value && typeof value === "object" ? value : {};
  const result = {};
  const listenPrompt = normalizePromptText(source.listenPrompt);
  const comparePrompt = normalizePromptText(source.comparePrompt);
  const listenModel = normalizeModelText(source.listenModel);
  const compareModel = normalizeModelText(source.compareModel);
  if (listenPrompt) {
    result.listenPrompt = listenPrompt;
  }
  if (comparePrompt) {
    result.comparePrompt = comparePrompt;
  }
  if (listenModel) {
    result.listenModel = listenModel;
  }
  if (compareModel) {
    result.compareModel = compareModel;
  }
  if (SUPPORTED_REQUEST_PARAMS.temperature === true) {
    const normalized = normalizeNumberInRange(source.temperature, 0, 2);
    if (normalized !== null) {
      result.temperature = normalized;
    }
  }
  if (SUPPORTED_REQUEST_PARAMS.top_p === true) {
    const normalized = normalizeNumberInRange(source.top_p, 0, 1);
    if (normalized !== null) {
      result.top_p = normalized;
    }
  }
  if (SUPPORTED_REQUEST_PARAMS.max_tokens === true) {
    const normalized = normalizeIntegerInRange(source.max_tokens, 1, 8192);
    if (normalized !== null) {
      result.max_tokens = normalized;
    }
  }
  if (SUPPORTED_REQUEST_PARAMS.max_completion_tokens === true) {
    const normalized = normalizeIntegerInRange(source.max_completion_tokens, 1, 8192);
    if (normalized !== null) {
      result.max_completion_tokens = normalized;
    }
  }
  if (SUPPORTED_REQUEST_PARAMS.presence_penalty === true) {
    const normalized = normalizeNumberInRange(source.presence_penalty, -2, 2);
    if (normalized !== null) {
      result.presence_penalty = normalized;
    }
  }
  if (SUPPORTED_REQUEST_PARAMS.frequency_penalty === true) {
    const normalized = normalizeNumberInRange(source.frequency_penalty, -2, 2);
    if (normalized !== null) {
      result.frequency_penalty = normalized;
    }
  }
  if (SUPPORTED_REQUEST_PARAMS.seed === true) {
    const normalized = normalizeIntegerInRange(source.seed, 0, 2147483647);
    if (normalized !== null) {
      result.seed = normalized;
    }
  }
  if (SUPPORTED_REQUEST_PARAMS.stop === true) {
    const normalized = normalizeStopSequences(source.stop);
    if (normalized.length > 0) {
      result.stop = normalized;
    }
  }
  if (typeof source.enable_thinking === "boolean") {
    result.enable_thinking = source.enable_thinking === true;
  } else if (typeof source.enableThinking === "boolean") {
    result.enable_thinking = source.enableThinking === true;
  }
  if (String(process.env.DATABAKER_AI_MOCK || "").trim() === "1") {
    const mockResponseMode = normalizeModelText(source.mockResponseMode);
    if (mockResponseMode) {
      result.mockResponseMode = mockResponseMode;
    }
  }
  return result;
}

function normalizeRecommendRequest(body) {
  const source = body && typeof body === "object" ? body : {};
  const aiOptions = normalizeAiOptions(source.aiOptions);
  const collectId = String(source.collectId || "").trim();
  const itemId = String(source.itemId || "").trim();
  const textId = String(source.textId || "").trim();
  const audioUrl = String(source.audioUrl || "").trim();
  const pageText = String(source.pageText || "").trim();
  const readRequire = String(source.readRequire || "").trim();
  const clientVersion = String(source.clientVersion || "").trim();
  const sentenceNumber = normalizeNullableNumber(source.sentenceNumber);
  const annotatorName = normalizeAnnotatorName(source.annotatorName);

  if (!collectId) {
    throw createHttpError(400, "collectId 不能为空。", "invalid-collect-id");
  }
  if (!itemId) {
    throw createHttpError(400, "itemId 不能为空。", "invalid-item-id");
  }
  if (!isHttpUrl(audioUrl)) {
    throw createHttpError(400, "audioUrl 必须是 http/https。", "invalid-audio-url");
  }
  if (!pageText) {
    throw createHttpError(400, "pageText 不能为空。", "invalid-page-text");
  }

  const recognitionMode = normalizeDataBakerRecognitionMode(
    source.recognitionMode || source.pipelineMode,
    "two_stage"
  );
  const listenModel = normalizeDataBakerListenModel(
    source.listenModel || aiOptions.listenModel,
    DEFAULT_OMNI_MODEL
  );
  const singleModel = normalizeDataBakerSingleModel(
    source.singleModel || aiOptions.singleModel || aiOptions.omniModel,
    DEFAULT_OMNI_MODEL
  );
  const concurrencyOriginalRaw =
    source.frontConcurrency !== undefined && source.frontConcurrency !== null
      ? source.frontConcurrency
      : source.batchConcurrency !== undefined && source.batchConcurrency !== null
        ? source.batchConcurrency
        : source.aiOptions?.frontConcurrency !== undefined && source.aiOptions?.frontConcurrency !== null
          ? source.aiOptions.frontConcurrency
          : source.aiOptions?.batchConcurrency;
  const concurrencyRule = getDataBakerAiQualifiedAutofillConcurrencyRule({
    recognitionMode,
    listenModel,
    singleModel,
    concurrencyModelType: source.concurrencyModelType || source.aiOptions?.concurrencyModelType,
  });
  const frontConcurrencyOriginal = Number.isFinite(Number(concurrencyOriginalRaw))
    ? Math.round(Number(concurrencyOriginalRaw))
    : null;
  const frontConcurrencyNormalized = normalizeDataBakerAiQualifiedAutofillConcurrency(
    concurrencyOriginalRaw,
    {
      recognitionMode,
      listenModel,
      singleModel,
      concurrencyModelType: source.concurrencyModelType || source.aiOptions?.concurrencyModelType,
    }
  );

  return {
    collectId,
    itemId,
    textId,
    sentenceNumber,
    readRequire,
    audioUrl,
    pageText,
    annotatorName,
    effectiveStartTime: normalizeNullableNumber(source.effectiveStartTime),
    effectiveEndTime: normalizeNullableNumber(source.effectiveEndTime),
    effectiveTime: normalizeNullableNumber(source.effectiveTime),
    audioDuration: normalizeNullableNumber(source.audioDuration),
    clientVersion,
    batchRunId: String(source.batchRunId || "").trim().slice(0, 160),
    batchItemIndex: normalizeNullableNumber(source.batchItemIndex),
    batchProcessKey: String(source.batchProcessKey || "").trim().slice(0, 240),
    clientRequestId: String(source.clientRequestId || "").trim().slice(0, 200),
    recognitionMode,
    pipelineMode: normalizeModelText(source.pipelineMode),
    listenModel,
    compareModel: normalizeModelText(source.compareModel),
    singleModel,
    frontConcurrencyOriginal,
    frontConcurrencyNormalized,
    concurrencyModelType: String(concurrencyRule.modelType || "omni"),
    aiOptions,
  };
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value === undefined ? null : value));
}

function resolveRequestedListenModel(recommendRequest, defaultListenModel) {
  const explicitListenModel =
    recommendRequest.aiOptions.listenModel || recommendRequest.listenModel || "";
  return normalizeDataBakerListenModel(explicitListenModel, defaultListenModel);
}

function resolveRequestedCompareModel(recommendRequest, defaultCompareModel) {
  const explicitCompareModel =
    recommendRequest.aiOptions.compareModel || recommendRequest.compareModel || "";
  return normalizeDataBakerCompareModel(explicitCompareModel, defaultCompareModel);
}

function resolveRequestedSingleModel(recommendRequest, defaultSingleModel) {
  const explicitSingleModel =
    recommendRequest.aiOptions.singleModel ||
    recommendRequest.aiOptions.omniModel ||
    recommendRequest.singleModel ||
    "";
  return normalizeDataBakerSingleModel(explicitSingleModel, defaultSingleModel);
}

function normalizeConfidence(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }
  return Math.max(0, Math.min(1, numericValue));
}

function ensureChineseSentencePunctuation(text) {
  const value = String(text || "").trim();
  if (!value) {
    return "";
  }
  const last = value[value.length - 1];
  if ("。！？；…".includes(last)) {
    return value;
  }
  if (last === ".") {
    return value.slice(0, -1) + "。";
  }
  if (last === "?") {
    return value.slice(0, -1) + "？";
  }
  if (last === "!") {
    return value.slice(0, -1) + "！";
  }
  if (last === ";") {
    return value.slice(0, -1) + "；";
  }
  return value + "。";
}

function removeTextSpaces(text) {
  return String(text || "").replace(/[\s\u3000]+/g, "");
}

function normalizeParseDebugContext(requestIdOrContext) {
  if (requestIdOrContext && typeof requestIdOrContext === "object") {
    return {
      requestId: String(requestIdOrContext.requestId || "").trim(),
      jobId: String(requestIdOrContext.jobId || "").trim(),
      itemId: String(requestIdOrContext.itemId || "").trim(),
      sentenceNumber: Number(requestIdOrContext.sentenceNumber) || 0,
      stage: String(requestIdOrContext.stage || "").trim(),
      model: String(requestIdOrContext.model || "").trim(),
      createdAt: String(requestIdOrContext.createdAt || new Date().toISOString()).trim(),
    };
  }
  return {
    requestId: String(requestIdOrContext || "").trim(),
    jobId: "",
    itemId: "",
    sentenceNumber: 0,
    stage: "",
    model: "",
    createdAt: new Date().toISOString(),
  };
}

function createModelJsonParseError(rawText, requestIdOrContext) {
  const context = normalizeParseDebugContext(requestIdOrContext);
  const sanitizedRawModelText = sanitizeProviderText(String(rawText || ""), 4000);
  const error = createHttpError(
    502,
    "模型输出 JSON 解析失败，可查看原始AI返回。",
    "model-json-parse-failed"
  );
  error.requestId = context.requestId;
  error.stage = context.stage;
  error.model = context.model;
  error.rawModelText = sanitizedRawModelText;
  error.debugRawJson = {
    requestId: context.requestId,
    jobId: context.jobId,
    itemId: context.itemId,
    sentenceNumber: context.sentenceNumber,
    stage: context.stage,
    model: context.model,
      errorCode: "model-json-parse-failed",
      errorMessage: "模型输出 JSON 解析失败，可查看原始AI返回。",
    rawModelText: sanitizedRawModelText,
    createdAt: context.createdAt,
  };
  error.hasDebugRawJson = true;
  return error;
}

function buildAiDebugPayloadFromError(error, context) {
  const source = error && typeof error === "object" ? error : {};
  const meta = context && typeof context === "object" ? context : {};
  const request = meta.request && typeof meta.request === "object" ? meta.request : {};
  const raw = source.debugRawAiResponse && typeof source.debugRawAiResponse === "object"
    ? source.debugRawAiResponse
    : source.debugRawJson && typeof source.debugRawJson === "object"
      ? source.debugRawJson
      : null;
  if (!raw) {
    return null;
  }
  return {
    requestId: String(source.requestId || meta.requestId || ""),
    clientRequestId: String(request.clientRequestId || meta.clientRequestId || ""),
    batchRunId: String(request.batchRunId || meta.batchRunId || ""),
    batchProcessKey: String(request.batchProcessKey || meta.batchProcessKey || ""),
    itemId: String(request.itemId || meta.itemId || raw.itemId || ""),
    textId: String(request.textId || meta.textId || raw.textId || ""),
    sentenceNumber:
      request.sentenceNumber !== undefined && request.sentenceNumber !== null
        ? request.sentenceNumber
        : meta.sentenceNumber !== undefined && meta.sentenceNumber !== null
          ? meta.sentenceNumber
          : raw.sentenceNumber,
    stage: String(raw.stage || source.stage || meta.stage || "unknown"),
    model: String(raw.model || source.model || meta.model || ""),
    provider: String(raw.provider || meta.provider || "unknown"),
    providerCode: String(raw.providerCode || source.providerCode || meta.providerCode || ""),
    errorCode: String(source.code || raw.errorCode || meta.errorCode || ""),
    errorMessage: String(source.safeMessage || source.message || raw.errorMessage || meta.errorMessage || ""),
    providerStatus: Number(source.providerStatus || source.statusCode || raw.providerStatus || 0) || 0,
    taskId: String(raw.taskId || source.taskId || meta.taskId || ""),
    taskStatus: String(raw.taskStatus || source.taskStatus || source.rawStatus || meta.taskStatus || ""),
    rawText: raw.rawText || raw.rawModelText || "",
    rawJson: raw.rawJson || null,
    rawSseText: raw.rawSseText || "",
    responseBody: raw.responseBody || null,
    usage: raw.usage || null,
    createdAt: String(raw.createdAt || meta.createdAt || new Date().toISOString()),
  };
}

function attachRawAiDebugToError(error, context) {
  const source = error && typeof error === "object" ? error : null;
  if (!source) {
    return "";
  }
  if (source.debugId) {
    source.hasRawAiDebug = true;
    return String(source.debugId || "");
  }
  const payload = buildAiDebugPayloadFromError(source, context);
  if (!payload) {
    return "";
  }
  const stored = rememberAiDebug(payload);
  source.debugId = stored.debugId;
  source.hasRawAiDebug = true;
  source.rawAiDebug = stored;
  return stored.debugId;
}

function parseModelJsonText(rawText, requestIdOrContext) {
  const source = String(rawText || "").trim();
  if (!source) {
    throw createModelJsonParseError(rawText, requestIdOrContext);
  }
  const withoutCodeFence = source.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const attempts = [withoutCodeFence];
  const firstBrace = withoutCodeFence.indexOf("{");
  const lastBrace = withoutCodeFence.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    attempts.push(withoutCodeFence.slice(firstBrace, lastBrace + 1));
  }
  for (let index = 0; index < attempts.length; index += 1) {
    try {
      return JSON.parse(attempts[index]);
    } catch (error) {
      // continue
    }
  }
  throw createModelJsonParseError(rawText, requestIdOrContext);
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map(function (item) {
      if (typeof item === "string") {
        return item.trim();
      }
      if (item && typeof item === "object") {
        return JSON.stringify(item);
      }
      return String(item || "").trim();
    })
    .filter(Boolean)
    .slice(0, 20);
}

function normalizeChangePoints(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.slice(0, 30).map(function (item) {
    if (typeof item === "string") {
      return { summary: item.trim() };
    }
    const source = item && typeof item === "object" ? item : {};
    return {
      type: String(source.type || "").trim(),
      pageText: String(source.pageText || source.before || "").trim(),
      heardText: String(source.heardText || source.after || "").trim(),
      summary: String(source.summary || source.reason || "").trim(),
    };
  });
}

function normalizeCompareResponse(modelJson, context) {
  const source = modelJson && typeof modelJson === "object" ? modelJson : {};
  const pageText = String(context?.pageText || "");
  const heardText = normalizeToSimplifiedChinesePreservingLexicon(
    removeTextSpaces(context?.heardText || "")
  );
  const recommendedText = normalizeToSimplifiedChinesePreservingLexicon(removeTextSpaces(
    source.recommendedText === undefined || source.recommendedText === null
      ? heardText || pageText
      : source.recommendedText
  ));
  const decision = String(source.decision || "").trim() || "need_human_review";
  const confidence = normalizeConfidence(source.confidence);
  const needHumanReview = source.needHumanReview === true || confidence < 0.75 || !recommendedText;
  return {
    recommendedText,
    decision,
    changePoints: normalizeChangePoints(source.changePoints),
    confidence,
    needHumanReview,
  };
}

function normalizeOmniSingleResponse(modelJson, context) {
  const source = modelJson && typeof modelJson === "object" ? modelJson : {};
  const pageText = String(context?.pageText || "");
  const heardText = normalizeToSimplifiedChinesePreservingLexicon(
    removeTextSpaces(source.heardText || source.text || "")
  );
  const recommendedText = normalizeToSimplifiedChinesePreservingLexicon(removeTextSpaces(
    source.recommendedText === undefined || source.recommendedText === null
      ? heardText || pageText
      : source.recommendedText
  ));
  const confidence = normalizeConfidence(source.confidence);
  return {
    heardText,
    recommendedText,
    decision:
      String(source.decision || "").trim() ||
      (recommendedText === pageText ? "keep_page_text" : "use_heard_text"),
    changePoints: normalizeChangePoints(source.changePoints),
    confidence,
    needHumanReview: source.needHumanReview === true || confidence < 0.75 || !recommendedText,
  };
}

function normalizeUsage(usage) {
  const source = usage && typeof usage === "object" ? usage : {};
  const promptTokens = Number(source.promptTokens || source.prompt_tokens || source.input_tokens || 0);
  const completionTokens = Number(
    source.completionTokens || source.completion_tokens || source.output_tokens || 0
  );
  const totalTokens = Number(
    source.totalTokens || source.total_tokens || promptTokens + completionTokens || 0
  );
  return {
    promptTokens: Number.isFinite(promptTokens) ? promptTokens : 0,
    completionTokens: Number.isFinite(completionTokens) ? completionTokens : 0,
    totalTokens: Number.isFinite(totalTokens) ? totalTokens : 0,
    raw: source,
  };
}

function normalizeOmniListenStageResult(parsed) {
  const source = parsed && typeof parsed === "object" ? parsed : {};
  const heardText = normalizeToSimplifiedChinesePreservingLexicon(
    removeTextSpaces(String(source.heardText || source.text || source.transcript || ""))
  );
  const confidenceNumber = Number(source.confidence);
  const needHumanReview = source.needHumanReview === true || !heardText;
  return {
    heardText,
    confidence: Number.isFinite(confidenceNumber)
      ? Math.max(0, Math.min(1, confidenceNumber))
      : heardText
      ? 0.8
      : 0,
    needHumanReview,
    raw: source,
  };
}

function buildRecommendResponse(parts) {
  const listen = parts?.listen || {};
  const compare = parts?.compare || {};
  const request = parts?.request || {};
  const requestId = String(parts?.requestId || "");
  const pageText = String(request.pageText || "");
  const recommendedText = ensureChineseSentencePunctuation(
    normalizeFieldToSimplified(
      requestId,
      "recommendedText",
      removeTextSpaces(compare.recommendedText || listen.heardText || pageText)
    )
  );
  const listenUsage = normalizeUsage(parts?.listenUsage);
  const compareUsage = normalizeUsage(parts?.compareUsage);
  const singleUsage = normalizeUsage(parts?.singleUsage);
  const listenConfidence = parts?.listenConfidence;
  const compareConfidence = parts?.compareConfidence;
  return {
    recommendedText,
    heardText: normalizeFieldToSimplified(
      requestId,
      "heardText",
      removeTextSpaces(listen.heardText || "")
    ),
    pageText,
    isChanged: recommendedText.trim() !== pageText.trim(),
    needHumanReview: compare.needHumanReview !== false || listen.isValid === false,
    listenConfidence: normalizeConfidence(
      listenConfidence !== undefined ? listenConfidence : listen.confidence
    ),
    compareConfidence: normalizeConfidence(
      compareConfidence !== undefined ? compareConfidence : compare.confidence
    ),
    decision: String(compare.decision || ""),
    changePoints: Array.isArray(compare.changePoints) ? compare.changePoints : [],
    invalidReasons: normalizeStringArray(listen.invalidReasons),
    model: {
      listen: String(parts?.listenModel || ""),
      compare: String(parts?.compareModel || ""),
      single: String(parts?.singleModel || ""),
    },
    usage: {
      listen: listenUsage,
      compare: compareUsage,
      single: singleUsage,
      totalTokens: listenUsage.totalTokens + compareUsage.totalTokens + singleUsage.totalTokens,
    },
    cost:
      parts?.cost || {
        estimatedCostCny: 0,
        totalEstimatedCostCny: 0,
        effectiveRevenueCny: 0,
        grossProfitCny: 0,
        note: ESTIMATE_NOTE,
      },
    requestId: String(parts?.requestId || ""),
  };
}

function safeNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function roundMoney(value) {
  return Number(safeNumber(value).toFixed(6));
}

function estimateCost(input) {
  const effectiveTime = safeNumber(input?.effectiveTime);
  const listenUsage = input?.listenUsage && typeof input.listenUsage === "object" ? input.listenUsage : {};
  const compareUsage = input?.compareUsage && typeof input.compareUsage === "object" ? input.compareUsage : {};
  const singleUsage = input?.singleUsage && typeof input.singleUsage === "object" ? input.singleUsage : {};
  const effectiveRevenueCny = (effectiveTime / 3600) * EFFECTIVE_REVENUE_CNY_PER_HOUR;
  const estimatedCost = estimateProjectCost({
    listen: {
      modelId: input?.listenModel,
      usage: listenUsage,
      outputMode: "text",
    },
    compare: {
      modelId: input?.compareModel,
      usage: compareUsage,
      outputMode: "text",
    },
    single: {
      modelId: input?.singleModel,
      usage: singleUsage,
      outputMode: "text",
    },
  });
  const totalEstimatedCostCny = safeNumber(estimatedCost.totalEstimatedCostCny);
  const hasUsage =
    safeNumber(listenUsage.totalTokens) > 0 ||
    safeNumber(compareUsage.totalTokens) > 0 ||
    safeNumber(singleUsage.totalTokens) > 0;

  return Object.assign({}, estimatedCost, {
    estimatedCostCny: estimatedCost.totalEstimatedCostCny,
    effectiveRevenueCny: roundMoney(effectiveRevenueCny),
    grossProfitCny: roundMoney(effectiveRevenueCny - totalEstimatedCostCny),
    note: hasUsage
      ? estimatedCost.note || ESTIMATE_NOTE
      : ESTIMATE_NOTE + " 模型 usage 未返回或未解析，成本可能低估。",
  });
}

function getLogDir() {
  return require("./ai-call-log").getLogDir();
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function safeString(value) {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value);
}

function safeBoolean(value) {
  return value === true;
}

function safeJsonStringify(value) {
  try {
    return JSON.stringify(value === undefined ? null : value);
  } catch (error) {
    return "";
  }
}

function getUsageValue(usage, key) {
  const source = usage && typeof usage === "object" ? usage : {};
  return safeNumber(source[key]);
}

function sanitizeForLog(record) {
  const source = record && typeof record === "object" ? record : {};
  const request = source.request && typeof source.request === "object" ? source.request : {};
  const response = source.response && typeof source.response === "object" ? source.response : {};
  const usage = response.usage && typeof response.usage === "object" ? response.usage : {};
  const listenUsage = usage.listen && typeof usage.listen === "object" ? usage.listen : {};
  const compareUsage = usage.compare && typeof usage.compare === "object" ? usage.compare : {};
  const cost = response.cost && typeof response.cost === "object" ? response.cost : {};
  const model = response.model && typeof response.model === "object" ? response.model : {};
  const lexicon = response.lexicon && typeof response.lexicon === "object" ? response.lexicon : {};
  const timing = response.timing && typeof response.timing === "object" ? response.timing : {};
  const rewriteChanges = Array.isArray(lexicon.rewriteChanges)
    ? lexicon.rewriteChanges.map(function (item) {
        const change = item && typeof item === "object" ? item : {};
        return {
          from: safeString(change.from),
          to: safeString(change.to),
          source: safeString(change.source),
          reason: safeString(change.reason),
        };
      })
    : [];

  return {
    createdAt: safeString(source.createdAt || new Date().toISOString()),
    requestId: safeString(source.requestId),
    success: safeBoolean(source.success),
    durationMs: safeNumber(source.durationMs),
    listenDurationMs: safeNumber(source.listenDurationMs || timing.listenDurationMs),
    compareDurationMs: safeNumber(source.compareDurationMs || timing.compareDurationMs),
    pipelineMode: safeString(response.pipelineMode || source.pipelineMode),
    annotatorName: safeString(request.annotatorName),
    collectId: safeString(request.collectId),
    itemId: safeString(request.itemId),
    textId: safeString(request.textId),
    sentenceNumber: request.sentenceNumber === null ? "" : safeString(request.sentenceNumber),
    readRequire: safeString(request.readRequire),
    audioHostname: safeString(source.audioHostname || parseAudioHostname(request.audioUrl)),
    pageText: safeString(response.pageText || request.pageText),
    heardText: safeString(response.heardText),
    recommendedText: safeString(response.recommendedText),
    isChanged: response.isChanged === true,
    needHumanReview: response.needHumanReview === true,
    decision: safeString(response.decision),
    lexiconEnabled: lexicon.enabled === true,
    lexiconRewriteMode: safeString(lexicon.rewriteMode),
    lexiconRewriteChanged: lexicon.rewriteChanged === true,
    lexiconRewriteChangeCount: rewriteChanges.length,
    lexiconRewriteChanges: safeJsonStringify(rewriteChanges),
    listenConfidence: safeNumber(response.listenConfidence),
    compareConfidence: safeNumber(response.compareConfidence),
    listenModel: safeString(model.listen || source.listenModel),
    compareModel: safeString(model.compare || source.compareModel),
    listenPromptTokens: getUsageValue(listenUsage, "promptTokens"),
    listenCompletionTokens: getUsageValue(listenUsage, "completionTokens"),
    listenTotalTokens: getUsageValue(listenUsage, "totalTokens"),
    comparePromptTokens: getUsageValue(compareUsage, "promptTokens"),
    compareCompletionTokens: getUsageValue(compareUsage, "completionTokens"),
    compareTotalTokens: getUsageValue(compareUsage, "totalTokens"),
    totalTokens: safeNumber(usage.totalTokens),
    estimatedCostCny: safeNumber(cost.estimatedCostCny),
    effectiveRevenueCny: safeNumber(cost.effectiveRevenueCny),
    grossProfitCny: safeNumber(cost.grossProfitCny),
    effectiveStartTime: request.effectiveStartTime === null ? "" : safeString(request.effectiveStartTime),
    effectiveEndTime: request.effectiveEndTime === null ? "" : safeString(request.effectiveEndTime),
    effectiveTime: request.effectiveTime === null ? "" : safeString(request.effectiveTime),
    audioDuration: request.audioDuration === null ? "" : safeString(request.audioDuration),
    clientVersion: safeString(request.clientVersion),
    frontConcurrencyOriginal:
      request.frontConcurrencyOriginal === null ? "" : safeString(request.frontConcurrencyOriginal),
    frontConcurrencyNormalized:
      request.frontConcurrencyNormalized === null
        ? ""
        : safeString(request.frontConcurrencyNormalized),
    concurrencyModelType: safeString(request.concurrencyModelType),
    mock: source.mock === true,
    debugId: safeString(source.debugId || response.debugId),
    errorCode: safeString(source.errorCode),
    errorMessage: safeString(source.errorMessage),
  };
}

function escapeCsvCell(value) {
  const text = safeString(value);
  if (/[",\r\n]/.test(text)) {
    return '"' + text.replace(/"/g, '""') + '"';
  }
  return text;
}

function toCsvLine(record) {
  return CSV_COLUMNS.map(function (column) {
    return escapeCsvCell(record[column.key]);
  }).join(",") + "\n";
}

function appendJsonl(filePath, record) {
  fs.appendFileSync(filePath, JSON.stringify(record, null, 0) + "\n", "utf8");
}

function appendCsv(filePath, record) {
  if (!fs.existsSync(filePath)) {
    const headerLine =
      CSV_COLUMNS.map(function (column) {
        return escapeCsvCell(column.header);
      }).join(",") + "\n";
    fs.writeFileSync(filePath, headerLine, "utf8");
  }
  fs.appendFileSync(filePath, toCsvLine(record), "utf8");
}

function appendAiCallLog(record) {
  return require("./ai-call-log").appendAiCallLog(record);
}

function normalizeText(value) {
  return String(value || "")
    .replace(/^\uFEFF/, "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHeader(value) {
  return normalizeText(value).replace(/\s+/g, "");
}

function cleanLexiconTerm(value) {
  return normalizeText(value)
    .replace(/（[^）]*）/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/[（(][^、，,；;／/\s]*/g, "")
    .replace(/[A-Za-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüńňǹḿ]+/gi, "")
    .replace(/\d+/g, "")
    .replace(/[-_.：:]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitTerms(value) {
  const text = cleanLexiconTerm(value);
  if (!text) {
    return [];
  }
  return text
    .split(/[、，,；;／/\s]+/)
    .map(cleanLexiconTerm)
    .filter(Boolean);
}

function parseCsvRecords(text) {
  const source = String(text || "").replace(/^\uFEFF/, "");
  const records = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (inQuotes) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (char === "\r" || char === "\n") {
      if (char === "\r" && source[index + 1] === "\n") {
        index += 1;
      }
      row.push(cell);
      cell = "";
      if (row.some(function (value) { return normalizeText(value); })) {
        records.push(row);
      }
      row = [];
      continue;
    }
    cell += char;
  }

  row.push(cell);
  if (row.some(function (value) { return normalizeText(value); })) {
    records.push(row);
  }
  return records;
}

function parseLexiconCsv(text) {
  const records = parseCsvRecords(text);
  if (records.length < 2) {
    return [];
  }
  const headers = records[0].map(normalizeHeader);
  return records
    .slice(1)
    .map(function (record) {
      const row = {};
      headers.forEach(function (header, index) {
        if (header) {
          row[header] = normalizeText(record[index]);
        }
      });
      const id = normalizeText(row["编号"]);
      const suggested = normalizeText(row["建议用字"]);
      const mandarin = normalizeText(row["对应华语"]);
      if (!splitTerms(suggested).length || !splitTerms(mandarin).length) {
        return null;
      }
      return { id, suggested, mandarin };
    })
    .filter(Boolean);
}

function mapLexiconEntryFromBusinessJson(entry) {
  const source = entry && typeof entry === "object" ? entry : {};
  const id = normalizeBusinessLexiconText(source.id);
  const suggested = normalizeBusinessLexiconText(source.display || source.normalized);
  const mandarin = normalizeBusinessLexiconText(source.mandarin);
  if (!splitTerms(suggested).length || !splitTerms(mandarin).length) {
    return null;
  }
  return { id, suggested, mandarin };
}

function getLexiconState() {
  if (lexiconCache) {
    return lexiconCache;
  }
  const loaded = loadBusinessLexiconSource(MINNAN_LEXICON_JSON_PATH, {
    referencePaths: [MINNAN_LEXICON_REFERENCE_CSV_PATH],
    warningMessage: "没有字词对应表",
  });
  if (loaded.status === "reference_only") {
    if (!warnedMissing) {
      warnedMissing = true;
      console.warn("[DataBaker][round-one-quality][ai] 没有字词对应表，检测到本地参考 CSV，已按无词表模式继续返回。", {
        fileName: path.basename(MINNAN_LEXICON_JSON_PATH),
        referenceFileName: path.basename(loaded.referenceFilePath || MINNAN_LEXICON_REFERENCE_CSV_PATH),
      });
    }
    lexiconCache = {
      exists: false,
      status: "reference_only",
      source: "json",
      rows: [],
      warningMessage: loaded.warningMessage,
      referenceExists: true,
      referenceFilePath: loaded.referenceFilePath,
    };
    return lexiconCache;
  }
  if (loaded.status === "missing") {
    lexiconCache = {
      exists: false,
      status: "missing",
      source: "json",
      rows: [],
      warningMessage: "",
      referenceExists: false,
      referenceFilePath: "",
    };
    return lexiconCache;
  }
  if (!loaded.enabled || loaded.status !== "ready") {
    if (!warnedReadFailure) {
      warnedReadFailure = true;
      console.warn("[DataBaker][round-one-quality][ai] 闽南业务词表 JSON 读取失败，已跳过词表上下文。", {
        fileName: path.basename(MINNAN_LEXICON_JSON_PATH),
        status: loaded.status,
        message: loaded.errorMessage || "",
      });
    }
    lexiconCache = {
      exists: false,
      status: loaded.status || "error",
      source: "json",
      rows: [],
      warningMessage: "",
      referenceExists: Boolean(loaded.referenceExists),
      referenceFilePath: loaded.referenceFilePath || "",
    };
    return lexiconCache;
  }
  lexiconCache = {
    exists: true,
    status: "ready",
    source: "json",
    rows: loaded.entries.map(mapLexiconEntryFromBusinessJson).filter(Boolean),
    warningMessage: "",
    referenceExists: Boolean(loaded.referenceExists),
    referenceFilePath: loaded.referenceFilePath || "",
  };
  return lexiconCache;
}

function loadMinnanLexicon() {
  return getLexiconState().rows.slice();
}

function buildLexiconResultMeta(lexiconState, runtimeLexicon) {
  const source = lexiconState && typeof lexiconState === "object" ? lexiconState : {};
  const runtime = runtimeLexicon && typeof runtimeLexicon === "object" ? runtimeLexicon : {};
  const rows = Array.isArray(source.rows) ? source.rows : [];
  const rowCount = Number(source.rowCount);
  return {
    enabled: runtime.enabled === true,
    status: String(source.status || "missing"),
    source: String(source.source || "json"),
    sourceFile: path.basename(source.filePath || MINNAN_LEXICON_JSON_PATH),
    referenceSourceFile: path.basename(
      source.referenceFilePath || MINNAN_LEXICON_REFERENCE_CSV_PATH
    ),
    rowCount: Number.isFinite(rowCount) ? rowCount : rows.length,
    warningMessage: String(source.warningMessage || ""),
    rewriteMode: String(runtime.rewriteMode || "off"),
    matchedCount: Number(runtime.matchedCount || 0),
    rewriteChanged: runtime.rewriteChanged === true,
    rewriteChanges: Array.isArray(runtime.rewriteChanges) ? runtime.rewriteChanges : [],
  };
}

function normalizeLimit(value) {
  const number = Number(value || DEFAULT_CONTEXT_LIMIT);
  if (!Number.isFinite(number)) {
    return DEFAULT_CONTEXT_LIMIT;
  }
  return Math.max(1, Math.min(120, Math.round(number)));
}

function getEntryKey(entry) {
  return splitTerms(entry.mandarin).join("/") + "\u0000" + splitTerms(entry.suggested).join("/");
}

function entryMatchesText(entry, text) {
  const source = normalizeText(text);
  if (!source) {
    return false;
  }
  const terms = splitTerms(entry.mandarin).concat(splitTerms(entry.suggested));
  return terms.some(function (term) {
    return term && source.indexOf(term) >= 0;
  });
}

function formatEntry(entry) {
  const mandarin = splitTerms(entry.mandarin).join("、");
  const suggested = splitTerms(entry.suggested).join("、");
  if (!mandarin || !suggested) {
    return "";
  }
  return "- 对应华语：" + mandarin + "；建议用字：" + suggested;
}

function getSuggestedTermForFrom(suggested, from) {
  return (
    splitTerms(suggested).find(function (term) {
      return term && term !== from;
    }) || ""
  );
}

function addRewriteRule(rules, seen, mandarin, suggested, source) {
  splitTerms(mandarin).forEach(function (from) {
    if (!from || (source === "json" && from.length < 2)) {
      return;
    }
    const to = getSuggestedTermForFrom(suggested, from);
    if (!to || from === to) {
      return;
    }
    const key = from + "\u0000" + to;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    rules.push({
      from,
      to,
      source,
      reason: "命中闽南方言词表",
    });
  });
}

function buildRewriteRules() {
  const state = getLexiconState();
  const rules = [];
  const seen = new Set();
  BASE_ENTRIES.forEach(function (entry) {
    addRewriteRule(rules, seen, entry.mandarin, entry.suggested, "base");
  });
  state.rows.forEach(function (entry) {
    addRewriteRule(rules, seen, entry.mandarin, entry.suggested, "json");
  });
  return rules.sort(function (left, right) {
    return right.from.length - left.from.length;
  });
}

function countOccurrences(text, searchText) {
  if (!searchText) {
    return 0;
  }
  let count = 0;
  let index = 0;
  while (index < text.length) {
    const foundIndex = text.indexOf(searchText, index);
    if (foundIndex < 0) {
      break;
    }
    count += 1;
    index = foundIndex + searchText.length;
  }
  return count;
}

function applyLexiconRewrite(text, options) {
  const source = options && typeof options === "object" ? options : {};
  const mode = String(source.mode || "aggressive").trim() || "aggressive";
  const originalText = String(text || "");
  if (mode === "off" || !originalText) {
    return {
      text: originalText,
      changed: false,
      changes: [],
    };
  }

  let rewrittenText = originalText;
  const changes = [];
  buildRewriteRules().forEach(function (rule) {
    if (!rule.from || !rule.to || rewrittenText.indexOf(rule.from) < 0) {
      return;
    }
    if (rewrittenText.indexOf(rule.to) >= 0) {
      return;
    }
    const occurrenceCount = countOccurrences(rewrittenText, rule.from);
    if (occurrenceCount <= 0) {
      return;
    }
    rewrittenText = rewrittenText.split(rule.from).join(rule.to);
    for (let index = 0; index < occurrenceCount; index += 1) {
      changes.push({
        from: rule.from,
        to: rule.to,
        source: rule.source,
        reason: rule.reason,
      });
    }
  });

  return {
    text: rewrittenText,
    changed: rewrittenText !== originalText,
    changes,
  };
}

function buildLexiconContext(options) {
  const source = options && typeof options === "object" ? options : {};
  const state = getLexiconState();
  if (!state.exists) {
    return {
      enabled: false,
      matchedCount: 0,
      items: [],
      text: "",
    };
  }
  const limit = normalizeLimit(source.limit);
  const targetText = [source.pageText, source.heardText]
    .map(normalizeText)
    .filter(Boolean)
    .join("\n");
  const items = [];
  const seen = new Set();

  BASE_ENTRIES.forEach(function (entry) {
    const key = getEntryKey(entry);
    if (!seen.has(key)) {
      seen.add(key);
      items.push({
        mandarin: entry.mandarin,
        suggested: entry.suggested,
        source: "base",
      });
    }
  });

  const matchedRows = state.rows.filter(function (entry) {
    return entryMatchesText(entry, targetText);
  });

  matchedRows.forEach(function (entry) {
    if (items.length >= limit) {
      return;
    }
    const key = getEntryKey(entry);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    items.push({
      id: entry.id,
      mandarin: entry.mandarin,
      suggested: entry.suggested,
      source: "json",
    });
  });

  return {
    enabled: true,
    matchedCount: matchedRows.length,
    items,
    text: items.map(formatEntry).filter(Boolean).join("\n"),
  };
}

function splitSuggestedTerms(text) {
  return splitTerms(text);
}

function getProtectedLexiconTerms() {
  const terms = new Set();
  BASE_ENTRIES.forEach(function (value) {
    splitSuggestedTerms(value.suggested).forEach(function (term) {
      if (term) {
        terms.add(term);
      }
    });
  });
  loadMinnanLexicon().forEach(function (entry) {
    splitSuggestedTerms(entry && entry.suggested).forEach(function (term) {
      if (term) {
        terms.add(term);
      }
    });
  });
  return Array.from(terms).sort(function (left, right) {
    return right.length - left.length;
  });
}

function protectLexiconTerms(text, protectedTerms) {
  const replacements = [];
  let output = String(text || "");
  protectedTerms.forEach(function (term, index) {
    if (!term || output.indexOf(term) < 0) {
      return;
    }
    const token = "__ASC_LEXICON_TOKEN_" + String(index) + "__";
    output = output.split(term).join(token);
    replacements.push({ token: token, value: term });
  });
  return { text: output, replacements: replacements };
}

function convertTraditionalToSimplified(text) {
  let output = String(text || "");
  TRADITIONAL_TO_SIMPLIFIED_PHRASES.forEach(function (entry) {
    const traditional = entry && entry[0];
    const simplified = entry && entry[1];
    if (!traditional || !simplified || output.indexOf(traditional) < 0) {
      return;
    }
    output = output.split(traditional).join(simplified);
  });
  const source = output;
  output = "";
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    output += TRADITIONAL_TO_SIMPLIFIED_MAP[char] || char;
  }
  return output;
}

function containsTraditionalChinese(text) {
  const source = String(text || "");
  if (!source) {
    return false;
  }
  for (let index = 0; index < TRADITIONAL_TO_SIMPLIFIED_PHRASES.length; index += 1) {
    const traditional = TRADITIONAL_TO_SIMPLIFIED_PHRASES[index][0];
    if (traditional && source.indexOf(traditional) >= 0) {
      return true;
    }
  }
  for (let index = 0; index < source.length; index += 1) {
    if (TRADITIONAL_TO_SIMPLIFIED_MAP[source[index]]) {
      return true;
    }
  }
  return false;
}

function restoreLexiconTerms(text, replacements) {
  let output = String(text || "");
  (Array.isArray(replacements) ? replacements : []).forEach(function (entry) {
    if (!entry || !entry.token) {
      return;
    }
    output = output.split(entry.token).join(entry.value || "");
  });
  return output;
}

function normalizeToSimplifiedChinesePreservingLexicon(text) {
  const source = String(text || "");
  if (!source) {
    return "";
  }
  const protectedTerms = getProtectedLexiconTerms();
  const protectedResult = protectLexiconTerms(source, protectedTerms);
  const simplified = convertTraditionalToSimplified(protectedResult.text);
  return restoreLexiconTerms(simplified, protectedResult.replacements);
}

function summarizeNormalizedText(text) {
  return String(text || "").replace(/\s+/g, " ").trim().slice(0, 80);
}

function normalizeFieldToSimplified(requestId, fieldName, text) {
  const source = String(text || "");
  if (!source) {
    return "";
  }
  const normalized = normalizeToSimplifiedChinesePreservingLexicon(source);
  if (normalized !== source && containsTraditionalChinese(source)) {
    console.info("[DataBaker][round-one-quality][ai] simplified chinese normalized", {
      requestId: String(requestId || ""),
      field: String(fieldName || ""),
      changed: true,
      beforePreview: summarizeNormalizedText(source),
      afterPreview: summarizeNormalizedText(normalized),
    });
  }
  return normalized;
}

function getLexiconText(lexiconContext) {
  return String(lexiconContext?.text || "").trim();
}

function normalizePromptTemplate(value, fallback) {
  const text = String(value || "").replace(/\r\n/g, "\n").trim();
  if (!text) {
    return String(fallback || "");
  }
  return text.slice(0, 8000);
}

function buildOmniSinglePrompt(request, lexiconContext) {
  const template = normalizePromptTemplate(
    request?.aiOptions?.listenPrompt,
    DEFAULT_OMNI_SINGLE_TEMPLATE
  );
  const lexiconText = getLexiconText(lexiconContext);
  const input = {
    pageText: request.pageText,
    readRequire: request.readRequire,
    sentenceNumber: request.sentenceNumber,
    effectiveStartTime: request.effectiveStartTime,
    effectiveEndTime: request.effectiveEndTime,
    effectiveTime: request.effectiveTime,
    audioDuration: request.audioDuration,
  };
  const promptLines = [
    template,
    "规则：",
    "1. 一个请求完成听音 + 对比 + 推荐文本，不要要求第二个模型继续判断。",
    "2. 页面候选文本只是参考，实际发声优先。",
    "3. 不自动改成普通话含义，不因为词表存在就强行改写。",
    "4. 如果实际发声和页面候选文本一致，recommendedText 保留页面候选文本。",
    "5. 如果实际发声明显不同，recommendedText 按实际发声输出。",
    "6. 对‘的/诶’‘很/真’‘喜欢/欢喜’‘这位/即个’‘我/阮’‘你/汝’‘他/伊’等易混词必须按实际发声判断。",
    "7. confidence 取 0 到 1；无法完全确认时 needHumanReview=true。",
    "8. changePoints 可写字符串数组或对象数组；推荐至少说明页面文本与听到文本的关键差异。",
  ];
  if (lexiconText) {
    promptLines.push(
      "以下是官方闽南方言字词表上下文：",
      lexiconText,
      "词表使用规则：",
      "1. 词表只用于选择字形，不用于无依据改写。",
      "2. 如果实际发声明显符合建议用字，请优先使用建议用字。",
      "3. 如果实际发声就是普通话词，不要因为词表存在就强行改写。",
      "4. 命中词表建议用字后，后端仍会做普通中文简体归一化，但不会覆盖词表建议用字。"
    );
  }
  promptLines.push(
    "输出 JSON 字段：recommendedText、heardText、decision、changePoints、confidence、needHumanReview。",
    "decision 可用值建议：keep_page_text、use_heard_text、minor_edit、uncertain。",
    "输入：",
    JSON.stringify(input, null, 2)
  );
  return {
    ruleVersion: RULE_VERSION,
    systemPrompt:
      "你是 DataBaker 质检推荐助手。你会接收音频和页面上下文，必须只输出 JSON，不要输出 Markdown 或 JSON 以外文本。",
    userPrompt: promptLines.join("\n"),
  };
}

function buildOmniListenPrompt(request) {
  const template = normalizePromptTemplate(
    request?.aiOptions?.listenPrompt,
    DEFAULT_OMNI_LISTEN_TEMPLATE
  );
  const input = {
    pageText: request.pageText,
    readRequire: request.readRequire,
    sentenceNumber: request.sentenceNumber,
    effectiveStartTime: request.effectiveStartTime,
    effectiveEndTime: request.effectiveEndTime,
    effectiveTime: request.effectiveTime,
    audioDuration: request.audioDuration,
  };
  return {
    ruleVersion: RULE_VERSION,
    systemPrompt:
      "你是 DataBaker 听音助手。你会接收音频和页面上下文，必须只输出 JSON，不要输出 Markdown 或 JSON 以外文本。",
    userPrompt: [
      template,
      "规则：",
      "1. 你只负责输出 heardText，不负责生成 recommendedText。",
      "2. pageText 只是辅助，不要机械照抄页面文本。",
      "3. 以实际发声为主；听不清时 needHumanReview=true。",
      "4. confidence 取 0 到 1。",
      "5. 输出 JSON 字段：heardText、confidence、needHumanReview。",
      "输入：",
      JSON.stringify(input, null, 2),
    ].join("\n"),
  };
}

function buildComparePrompt(request, heardText, lexiconContext) {
  const template = normalizePromptTemplate(
    request?.aiOptions?.comparePrompt,
    DEFAULT_COMPARE_TEMPLATE
  );
  const input = {
    pageText: request.pageText,
    heardText,
    readRequire: request.readRequire,
    sentenceNumber: request.sentenceNumber,
    effectiveStartTime: request.effectiveStartTime,
    effectiveEndTime: request.effectiveEndTime,
    effectiveTime: request.effectiveTime,
    audioDuration: request.audioDuration,
  };
  const lexiconText = getLexiconText(lexiconContext);
  const promptLines = [
    template,
    "规则：",
    "1. 以实际发声为主。",
    "2. 页面候选文本只是参考。",
    "3. 不自动改成普通话含义。",
    "4. 不因为词表存在就强行改写。",
    "5. 如果实际发声和页面候选文本一致，recommendedText 保留页面候选文本。",
    "6. 如果实际发声明显不同，recommendedText 按实际发声输出。",
    "7. 只生成推荐文本，不自动提交。",
    "8. 对‘的/诶’‘很/真’‘喜欢/欢喜’‘这位/即个’‘我/阮’‘你/汝’‘他/伊’等要按实际发声判断。",
  ];
  if (lexiconText) {
    promptLines.push(
      "以下是官方闽南方言字词表上下文：",
      lexiconText,
      "词表使用规则：",
      "1. 推荐文本以实际发声为主。",
      "2. 词表用于选择字形，不用于无依据改写。",
      "3. 如果 heardText 命中词表建议用字，优先保留。",
      "4. 如果 heardText 明显被页面文本保守覆盖，要按 heardText 和词表修正。",
      "5. recommendedText 最终应对普通中文做简体化，但词表建议用字是保留项，不能被普通简繁转换覆盖。"
    );
  }
  promptLines.push(
    "输出 JSON 字段：recommendedText、decision、changePoints、confidence、needHumanReview。",
    "decision 可用值建议：keep_page_text、use_heard_text、minor_edit、uncertain。",
    "输入：",
    JSON.stringify(input, null, 2)
  );
  return {
    ruleVersion: RULE_VERSION,
    systemPrompt:
      "你是 DataBaker 质检文本复核助手。只输出 JSON，不要输出 Markdown 或 JSON 以外文本。",
    userPrompt: promptLines.join("\n"),
  };
}

function summarizeQueueMeta(queueMeta) {
  const source = queueMeta && typeof queueMeta === "object" ? queueMeta : {};
  return {
    groupName: String(source.groupName || ""),
    queueWaitMs: Math.max(0, Number(source.queueWaitMs) || 0),
    retryCount: Math.max(0, Number(source.retryCount) || 0),
    retryDelaysMs: Array.isArray(source.retryDelaysMs) ? source.retryDelaysMs.slice(0, 6) : [],
    durationMs: Math.max(0, Number(source.durationMs) || 0),
    activeCount: Math.max(0, Number(source.activeCount) || 0),
    maxConcurrent: Math.max(0, Number(source.maxConcurrent) || 0),
  };
}

function appendCallLogSafe(record) {
  try {
    appendAiCallLog(record);
  } catch (error) {
    console.warn("[DataBaker][round-one-quality][ai] append log failed", String(error?.message || error));
  }
}

function sanitizeStageTiming(stageTiming) {
  const source = stageTiming && typeof stageTiming === "object" ? stageTiming : {};
  const result = {};
  [
    "listenQueuedAt",
    "listenStartedAt",
    "listenFinishedAt",
    "compareQueuedAt",
    "compareStartedAt",
    "compareFinishedAt",
  ].forEach(function (key) {
    const value = Number(source[key]);
    if (Number.isFinite(value) && value > 0) {
      result[key] = value;
    }
  });
  return result;
}

function logStageEvent(requestId, stage, phase, extra) {
  console.info("[DataBaker][round-one-quality][ai] stage", Object.assign({
    requestId: String(requestId || ""),
    stage: String(stage || ""),
    phase: String(phase || ""),
  }, extra || {}));
}

function createHealthPayload() {
  const qwenConfig = getClientConfig();
  const funAsrConfig = getFunAsrClientConfig();
  const envPipeline = getEnvPipelineResolution();
  const recognitionMode = getEnvRecognitionMode();
  const defaultListenModel = resolveDataBakerDefaultListenModel();
  const defaultSingleModel = resolveDataBakerDefaultSingleModel();
  const derivedPipelineMode = deriveDataBakerPipelineMode(
    recognitionMode,
    recognitionMode === "omni_single" ? defaultSingleModel : defaultListenModel
  );
  const frontConcurrencyRule = getDataBakerAiQualifiedAutofillConcurrencyRule({
    recognitionMode,
    listenModel: defaultListenModel,
    singleModel: defaultSingleModel,
  });
  const funAsrQueue = getGroupSettings("fun_asr");
  const textCompareQueue = getGroupSettings("text_compare");
  const qwenOmniQueue = getGroupSettings("qwen_omni");
  const jobStoreConfig = getAiJobStoreConfig();
  const jobSnapshot = getAiJobStoreSnapshot();
  const runtime = buildAsyncJobRuntimeMeta();
  const lexiconState = getLexiconState();
  const modelCatalog = {
    text: listModelsByFamily("text"),
    omni: listModelsByFamily("omni"),
    asr: listModelsByFamily("asr"),
  };
  logDeprecatedPipelineOnce(envPipeline);
  return {
    success: true,
    service: "data-baker-round-one-quality-ai-recommend",
    provider: "dashscope-fun-asr-and-qwen",
    ruleVersion: RULE_VERSION,
    recognitionMode,
    pipelineMode: recognitionMode,
    derivedPipelineMode,
    deprecatedPipelineMode: envPipeline.deprecatedFrom || "",
    recognitionModeOptions: RECOGNITION_MODE_OPTIONS.slice(),
    pipelineModeOptions: RECOGNITION_MODE_OPTIONS.slice(),
    supportedPipelineModes: SUPPORTED_PIPELINE_MODES,
    listenModelOptions: DATABAKER_LISTEN_MODEL_OPTIONS.slice(),
    singleModelOptions: DATABAKER_SINGLE_MODEL_OPTIONS.slice(),
    compareModelOptions: DATABAKER_COMPARE_MODEL_OPTIONS.slice(),
    listenModel: defaultListenModel,
    singleModel: defaultSingleModel,
    funAsrModel: funAsrConfig.model || DEFAULT_FUN_ASR_MODEL,
    funAsrProvider: funAsrConfig.providerMode || "rest",
    funAsrRestConfigured: funAsrConfig.funAsrRestConfigured === true,
    funAsrPythonConfigured: funAsrConfig.pythonExists === true,
    funAsrApiBase: funAsrConfig.funAsrApiHost || "",
    omniModel: qwenConfig.omniModel || DEFAULT_OMNI_MODEL,
    compareModel: qwenConfig.compareModel || DEFAULT_COMPARE_MODEL,
    mockEnabled: qwenConfig.mockEnabled || funAsrConfig.mockEnabled,
    hasApiKey: qwenConfig.hasApiKey || funAsrConfig.hasApiKey,
    modelCatalog,
    callLogDir: getLogDir(),
    cache: getCacheSnapshot(),
    queue: {
      maxSize: getGlobalQueueMaxSize(),
      retryMax: getGlobalRetryMax(),
      groups: getQueueSnapshots(),
      modelPoolPolicy: runtime.queue.defaultModelPool,
    },
    jobs: Object.assign({}, jobSnapshot, {
      enabled: jobStoreConfig.enabled === true,
      mode: jobStoreConfig.enabled === true ? "async-job-default" : "disabled",
    }),
    runtime,
    lexicon: {
      enabled: lexiconState.exists === true,
      status: String(lexiconState.status || "missing"),
      source: "json",
      sourceFile: path.basename(MINNAN_LEXICON_JSON_PATH),
      referenceSourceFile: path.basename(MINNAN_LEXICON_REFERENCE_CSV_PATH),
      rowCount: Array.isArray(lexiconState.rows) ? lexiconState.rows.length : 0,
      warningMessage: String(lexiconState.warningMessage || ""),
    },
    notes: {
      defaultResultMode: "async-job-default",
      asyncJobsDefaultEnabled: jobStoreConfig.enabled === true,
      requestStaggerMs: 50,
      timeoutPolicy: "ai-model-timeout-60000ms",
      queueKeyStrategy: "concrete-model-name",
      frontEndBatchConcurrency:
        "Omni 默认 5、范围 1~25；Fun-ASR 默认 5、范围 1~50；前后端都会归一超范围值。",
    },
    concurrency: {
      frontEndBatch: {
        defaultValue: frontConcurrencyRule.defaultValue,
        min: frontConcurrencyRule.min,
        max: frontConcurrencyRule.max,
        modelType: frontConcurrencyRule.modelType,
      },
      qwenOmni: {
        maxConcurrent: qwenOmniQueue.maxConcurrent,
        rpm: qwenOmniQueue.rpm,
      },
      funAsr: {
        maxConcurrent: funAsrQueue.maxConcurrent,
        rpm: funAsrQueue.rpm,
      },
      textCompare: {
        maxConcurrent: textCompareQueue.maxConcurrent,
        rpm: textCompareQueue.rpm,
      },
    },
    status: qwenConfig.hasApiKey || qwenConfig.mockEnabled ? "ready" : "missing-api-key",
  };
}

function createDefaultsPayload() {
  const qwenConfig = getClientConfig();
  const funAsrConfig = getFunAsrClientConfig();
  const envPipeline = getEnvPipelineResolution();
  const recognitionMode = getEnvRecognitionMode();
  const defaultListenModel = resolveDataBakerDefaultListenModel();
  const defaultSingleModel = resolveDataBakerDefaultSingleModel();
  const derivedPipelineMode = deriveDataBakerPipelineMode(
    recognitionMode,
    recognitionMode === "omni_single" ? defaultSingleModel : defaultListenModel
  );
  const frontConcurrencyRule = getDataBakerAiQualifiedAutofillConcurrencyRule({
    recognitionMode,
    listenModel: defaultListenModel,
    singleModel: defaultSingleModel,
  });
  const funAsrQueue = getGroupSettings("fun_asr");
  const textCompareQueue = getGroupSettings("text_compare");
  const qwenOmniQueue = getGroupSettings("qwen_omni");
  const jobStoreConfig = getAiJobStoreConfig();
  const jobSnapshot = getAiJobStoreSnapshot();
  const runtime = buildAsyncJobRuntimeMeta();
  const modelCatalog = {
    text: listModelsByFamily("text"),
    omni: listModelsByFamily("omni"),
    asr: listModelsByFamily("asr"),
  };
  logDeprecatedPipelineOnce(envPipeline);
  return {
    success: true,
    service: "data-baker-round-one-quality-ai-recommend",
    scriptId: "dataBakerRoundOneQuality",
    component: "asr-voice-ai",
    defaults: {
      recognitionMode,
      pipelineMode: recognitionMode,
      derivedPipelineMode,
      recognitionModeOptions: RECOGNITION_MODE_OPTIONS.slice(),
      pipelineModeOptions: RECOGNITION_MODE_OPTIONS.slice(),
      supportedPipelineModes: SUPPORTED_PIPELINE_MODES,
      listenModel: defaultListenModel,
      listenModelOptions: DATABAKER_LISTEN_MODEL_OPTIONS.slice(),
      singleModel: defaultSingleModel,
      singleModelOptions: DATABAKER_SINGLE_MODEL_OPTIONS.slice(),
      compareModelOptions: DATABAKER_COMPARE_MODEL_OPTIONS.slice(),
      compareModel: qwenConfig.compareModel || DEFAULT_COMPARE_MODEL,
      funAsrModel: funAsrConfig.model || DEFAULT_FUN_ASR_MODEL,
      funAsrProvider: funAsrConfig.providerMode || "rest",
      funAsrRestConfigured: funAsrConfig.funAsrRestConfigured === true,
      funAsrPythonConfigured: funAsrConfig.pythonExists === true,
      funAsrApiBase: funAsrConfig.funAsrApiHost || "",
      omniModel: qwenConfig.omniModel || DEFAULT_OMNI_MODEL,
      reviewModel: "",
      timeoutMs: qwenConfig.timeoutMs,
      enableThinking: qwenConfig.enableThinkingDefault === true,
      temperature: DEFAULT_REQUEST_PARAMS.temperature,
      top_p: DEFAULT_REQUEST_PARAMS.top_p,
      max_tokens: DEFAULT_REQUEST_PARAMS.max_tokens,
      max_completion_tokens: DEFAULT_REQUEST_PARAMS.max_completion_tokens,
      presence_penalty: DEFAULT_REQUEST_PARAMS.presence_penalty,
      frequency_penalty: DEFAULT_REQUEST_PARAMS.frequency_penalty,
      seed: DEFAULT_REQUEST_PARAMS.seed,
      stop: DEFAULT_REQUEST_PARAMS.stop,
      listenPrompt: DEFAULT_OMNI_LISTEN_TEMPLATE,
      comparePrompt: DEFAULT_COMPARE_TEMPLATE,
      reviewPrompt: "",
      modelCatalog,
    },
    supportedParams: SUPPORTED_REQUEST_PARAMS,
    queue: {
      maxSize: getGlobalQueueMaxSize(),
      retryMax: getGlobalRetryMax(),
      groups: getQueueSnapshots(),
      modelPoolPolicy: runtime.queue.defaultModelPool,
    },
    jobs: Object.assign({}, jobSnapshot, {
      enabled: jobStoreConfig.enabled === true,
      mode: jobStoreConfig.enabled === true ? "async-job-default" : "disabled",
    }),
    runtime,
    concurrency: {
      frontEndBatchDefault: frontConcurrencyRule.defaultValue,
      frontEndBatchMin: frontConcurrencyRule.min,
      frontEndBatchMax: frontConcurrencyRule.max,
      frontEndBatchModelType: frontConcurrencyRule.modelType,
      qwenOmni: {
        maxConcurrent: qwenOmniQueue.maxConcurrent,
        rpm: qwenOmniQueue.rpm,
      },
      funAsr: {
        maxConcurrent: funAsrQueue.maxConcurrent,
        rpm: funAsrQueue.rpm,
      },
      textCompare: {
        maxConcurrent: textCompareQueue.maxConcurrent,
        rpm: textCompareQueue.rpm,
      },
    },
    cache: getCacheSnapshot(),
    deprecated: envPipeline.deprecatedFrom
      ? [
          {
            from: envPipeline.deprecatedFrom,
            to: derivedPipelineMode,
          },
        ]
      : [],
    notes: {
      promptOverride:
        "听音阶段 Prompt 只用于产出 heardText；比较阶段 Prompt 负责结合 heardText 与页面候选文本生成 recommendedText。",
      responseFormat: "结构化输出由后端固定控制，前端不配置。",
      funAsr:
        "Fun-ASR 默认通过 Node RESTful API 调用：先提交异步任务，再轮询任务状态；Python SDK 仅保留为显式 fallback/调试方案，不默认使用。",
      qwenOmni:
        "qwen3.5-omni-plus / qwen3.5-omni-flash 在双模型下会先通过 input_audio 产出 heardText 再调用比较模型；在单模型下会一次完成听音和推荐文本。",
      queue: "所有 Fun-ASR / Omni / compare 调用都会先进入后端统一限流队列；Fun-ASR 并发由 DATABAKER_AI_FUN_ASR_CONCURRENCY 控制。",
      batchConcurrency:
        "前端批量并发在 Omni 下默认 5、范围 1~25，在 Fun-ASR 下默认 5、范围 1~50；前后端都会归一。后端 Fun-ASR / compare 仍按各 provider 自身策略处理。",
      restProvider:
        "当前 Fun-ASR 只实现单条 REST 调用；file_urls batch 后续再测试，本轮不启用。",
      asyncJobs:
        "批量连续填入默认先创建 /jobs 任务，再轮询 job 状态；同步 recommend 仅保留为兼容 / 调试入口。",
      jobPolling:
        "异步 job 默认 TTL " +
        String(jobStoreConfig.ttlMs) +
        "ms，轮询间隔默认 " +
        String(jobStoreConfig.pollIntervalMs) +
        "ms；默认前端错峰统一为 50ms，Node 进程重启后内存 job 会失效。",
    },
  };
}

function buildCacheKeyInput(
  recommendRequest,
  recognitionMode,
  pipelineMode,
  listenModel,
  compareModel,
  singleModel,
  funAsrProvider
) {
  return {
    audioUrl: recommendRequest.audioUrl,
    effectiveStartTime: recommendRequest.effectiveStartTime,
    effectiveEndTime: recommendRequest.effectiveEndTime,
    recognitionMode,
    pipelineMode,
    listenModel,
    compareModel,
    singleModel,
    funAsrProvider,
    ruleVersion: RULE_VERSION,
    listenPrompt: recommendRequest.aiOptions.listenPrompt || "",
    comparePrompt: recommendRequest.aiOptions.comparePrompt || "",
  };
}

function throwIfSignalAborted(signal) {
  if (signal && signal.aborted === true) {
    throw normalizeAbortError(signal.reason, "当前任务超过60s，请重新请求。", "aborted", 504);
  }
}

async function runQueuedProviderCall(groupName, task, options) {
  const normalizedModel = String(options?.model || "").trim();
  const queueKey = normalizedModel ? buildModelQueueKey(normalizedModel) : groupName;
  return enqueueProviderTask(queueKey, task, {
    signal: options?.signal,
  });
}

function getLexiconRewriteMode() {
  const mode = String(process.env.DATABAKER_AI_LEXICON_REWRITE_MODE || "aggressive").trim();
  return mode === "off" ? "off" : "aggressive";
}

function rewriteRecommendedText(recommendedText, request, heardText) {
  const rewriteMode = getLexiconRewriteMode();
  const rewriteResult = applyLexiconRewrite(recommendedText, {
    pageText: request.pageText,
    heardText: heardText,
    mode: rewriteMode,
  });
  let nextText = rewriteResult.changed ? rewriteResult.text : recommendedText;
  nextText = normalizeToSimplifiedChinesePreservingLexicon(nextText);
  nextText = removeTextSpaces(nextText);
  nextText = ensureChineseSentencePunctuation(nextText);
  return {
    rewriteMode,
    rewriteResult,
    text: nextText,
  };
}

function createRuntimeMeta(options) {
  const queueMetas = Array.isArray(options?.queueMetas) ? options.queueMetas : [];
  return {
    cache: {
      hit: options?.cacheHit === true,
      ttlMs: Number(options?.cacheTtlMs) || 0,
      sourceRequestId: String(options?.cacheSourceRequestId || ""),
    },
    deprecatedMode: String(options?.deprecatedMode || ""),
    concurrencyDiagnostic:
      options?.concurrencyDiagnostic && typeof options.concurrencyDiagnostic === "object"
        ? {
            frontConcurrencyOriginal:
              options.concurrencyDiagnostic.frontConcurrencyOriginal === null
                ? null
                : Number(options.concurrencyDiagnostic.frontConcurrencyOriginal) || 0,
            frontConcurrencyNormalized:
              Number(options.concurrencyDiagnostic.frontConcurrencyNormalized) || 0,
            concurrencyModelType: String(
              options.concurrencyDiagnostic.concurrencyModelType || "omni"
            ),
          }
        : null,
    queue: {
      groups: queueMetas.map(summarizeQueueMeta),
      totalQueueWaitMs: queueMetas.reduce(function (total, item) {
        return total + Math.max(0, Number(item?.queueWaitMs) || 0);
      }, 0),
      totalRetryCount: queueMetas.reduce(function (total, item) {
        return total + Math.max(0, Number(item?.retryCount) || 0);
      }, 0),
    },
    stageTiming: sanitizeStageTiming(options?.stageTiming),
  };
}

async function recommend(body, requestIdHint, runtimeOptions) {
  const startedAtMs = Date.now();
  let requestId = String(requestIdHint || createRequestId());
  let recommendRequest = null;
  let qwenConfig = null;
  let funAsrConfig = null;
  let recognitionMode = "two_stage";
  let pipelineMode = "qwen_omni_compare";
  let deprecatedMode = "";
  let listenDurationMs = 0;
  let compareDurationMs = 0;
  let stageTiming = {};
  let activeListenModel = "";
  let activeCompareModel = "";
  let activeSingleModel = "";
  let activeFunAsrProvider = "rest";
  let cacheKey = "";
  const runtimeConfig = runtimeOptions && typeof runtimeOptions === "object" ? runtimeOptions : {};
  const runtimeSignal = runtimeConfig.signal || null;
  const runtimeJobId = String(runtimeConfig.jobId || "").trim();
  const runtimeCreatedAt = String(runtimeConfig.createdAt || new Date().toISOString()).trim();
  try {
    throwIfSignalAborted(runtimeSignal);
    recommendRequest = normalizeRecommendRequest(body || {});
    requestId = String(body?.requestId || requestId);

    qwenConfig = getClientConfig();
    funAsrConfig = getFunAsrClientConfig();
    activeFunAsrProvider = String(funAsrConfig.providerMode || "rest").trim() || "rest";
    const envPipeline = getEnvPipelineResolution();
    const defaultRecognitionMode = getEnvRecognitionMode();
    const defaultListenModel = resolveDataBakerDefaultListenModel();
    const defaultSingleModel = resolveDataBakerDefaultSingleModel();
    recognitionMode = normalizeDataBakerRecognitionMode(
      recommendRequest.recognitionMode || recommendRequest.pipelineMode,
      defaultRecognitionMode
    );
    const requestedListenModel = resolveRequestedListenModel(recommendRequest, defaultListenModel);
    const requestedCompareModel = resolveRequestedCompareModel(
      recommendRequest,
      qwenConfig.compareModel || DEFAULT_COMPARE_MODEL
    );
    const requestedSingleModel = resolveRequestedSingleModel(
      recommendRequest,
      defaultSingleModel
    );
    const requestPipeline = resolvePipelineMode(
      recommendRequest.pipelineMode,
      deriveDataBakerPipelineMode(
        recognitionMode,
        recognitionMode === "omni_single" ? requestedSingleModel : requestedListenModel
      ),
      "request"
    );
    logDeprecatedPipelineOnce(envPipeline);
    logDeprecatedPipelineOnce(requestPipeline);
    pipelineMode = deriveDataBakerPipelineMode(
      recognitionMode,
      recognitionMode === "omni_single" ? requestedSingleModel : requestedListenModel
    );
    deprecatedMode = requestPipeline.deprecatedFrom || envPipeline.deprecatedFrom || "";

    if (!qwenConfig.hasApiKey && !qwenConfig.mockEnabled) {
      throw createHttpError(503, "缺少 DASHSCOPE_API_KEY。", "missing-api-key");
    }

    const effectiveEnableThinking =
      typeof recommendRequest.aiOptions.enable_thinking === "boolean"
        ? recommendRequest.aiOptions.enable_thinking === true
        : qwenConfig.enableThinkingDefault === true;

    if (pipelineMode === "omni_single") {
      activeSingleModel = normalizeDataBakerSingleModel(
        requestedSingleModel,
        qwenConfig.omniModel || DEFAULT_OMNI_MODEL
      );
      activeListenModel = activeSingleModel;
      activeCompareModel = "";
    } else {
      activeListenModel =
        pipelineMode === "fun_asr_compare"
          ? DEFAULT_FUN_ASR_MODEL
          : normalizeDataBakerListenModel(
              requestedListenModel,
              qwenConfig.omniModel || DEFAULT_OMNI_MODEL
            );
      activeCompareModel = normalizeDataBakerCompareModel(
        requestedCompareModel,
        qwenConfig.compareModel || DEFAULT_COMPARE_MODEL
      );
    }

    cacheKey = buildRecommendCacheKey(
      buildCacheKeyInput(
        recommendRequest,
        recognitionMode,
        pipelineMode,
        activeListenModel,
        activeCompareModel,
        activeSingleModel,
        activeFunAsrProvider
      )
    );
    const cached = getCachedRecommendResult(cacheKey);
    if (cached) {
      const cacheSnapshot = getCacheSnapshot();
      const responseData = cloneJson(cached);
      const cacheSourceRequestId = responseData.requestId || "";
      responseData.requestId = requestId;
      responseData.runtime = createRuntimeMeta({
        cacheHit: true,
        cacheTtlMs: cacheSnapshot.ttlMs,
        cacheSourceRequestId,
        deprecatedMode,
        queueMetas: [],
        concurrencyDiagnostic: {
          frontConcurrencyOriginal: recommendRequest.frontConcurrencyOriginal,
          frontConcurrencyNormalized: recommendRequest.frontConcurrencyNormalized,
          concurrencyModelType: recommendRequest.concurrencyModelType,
        },
      });
      appendCallLogSafe({
        createdAt: new Date().toISOString(),
        requestId,
        success: true,
        durationMs: Date.now() - startedAtMs,
        listenDurationMs: 0,
        compareDurationMs: 0,
        request: recommendRequest,
        response: responseData,
        listenModel: activeListenModel,
        compareModel: activeCompareModel,
        pipelineMode,
        audioHostname: parseAudioHostname(recommendRequest.audioUrl),
        mock: Boolean(qwenConfig.mockEnabled),
      });
      return responseData;
    }

    console.info("[DataBaker][round-one-quality][ai] recommend start", {
      requestId,
      hostname: parseAudioHostname(recommendRequest.audioUrl),
      sentenceNumber: recommendRequest.sentenceNumber,
      recognitionMode,
      pipelineMode,
      frontConcurrencyOriginal: recommendRequest.frontConcurrencyOriginal,
      frontConcurrencyNormalized: recommendRequest.frontConcurrencyNormalized,
      concurrencyModelType: recommendRequest.concurrencyModelType,
      listenModel: activeListenModel,
      compareModel: activeCompareModel,
      singleModel: activeSingleModel,
      funAsrProvider: activeFunAsrProvider,
      enableThinking: effectiveEnableThinking,
      mock: qwenConfig.mockEnabled,
    });

    const queueMetas = [];
    let responseData = null;

    if (pipelineMode === "omni_single") {
      const lexiconContext = buildLexiconContext({
        pageText: recommendRequest.pageText,
        heardText: "",
        limit: 60,
      });
      const singlePrompt = buildOmniSinglePrompt(recommendRequest, lexiconContext);
      const listenStartedAtMs = Date.now();
      let omniSingleResult = null;
      try {
        const queued = await runQueuedProviderCall("qwen_omni", function () {
          return requestOmniInputAudio(recommendRequest, singlePrompt, {
            model: activeSingleModel,
            timeoutMs: qwenConfig.timeoutMs,
            enableThinking: effectiveEnableThinking,
            signal: runtimeSignal,
          });
        }, {
          model: activeSingleModel,
          signal: runtimeSignal,
        });
        omniSingleResult = queued.value;
        queueMetas.push(queued.queueMeta);
      } finally {
        listenDurationMs = Date.now() - listenStartedAtMs;
      }

      const omniSingleJson = parseModelJsonText(omniSingleResult.rawText, {
        requestId,
        jobId: runtimeJobId,
        itemId: recommendRequest.itemId,
        sentenceNumber: recommendRequest.sentenceNumber,
        stage: "omni_single",
        model: omniSingleResult.model,
        createdAt: runtimeCreatedAt,
      });
      const normalizedSingle = normalizeOmniSingleResponse(omniSingleJson, {
        pageText: recommendRequest.pageText,
      });
      const rewriteState = rewriteRecommendedText(
        normalizeToSimplifiedChinesePreservingLexicon(
          removeTextSpaces(normalizedSingle.recommendedText)
        ),
        recommendRequest,
        normalizedSingle.heardText
      );
      normalizedSingle.recommendedText = rewriteState.text;
      if (rewriteState.rewriteResult.changed) {
        normalizedSingle.needHumanReview = true;
      }

      responseData = buildRecommendResponse({
        requestId,
        request: recommendRequest,
        listen: {
          heardText: normalizedSingle.heardText,
          confidence: normalizedSingle.confidence,
          isValid: Boolean(normalizedSingle.heardText),
          invalidReasons: normalizedSingle.heardText ? [] : ["missing-heard-text"],
        },
        compare: normalizedSingle,
        listenModel: "",
        compareModel: "",
        singleModel: omniSingleResult.model,
        listenUsage: {},
        compareUsage: {},
        singleUsage: normalizeUsage(omniSingleResult.usage),
        cost: estimateCost({
          effectiveTime: recommendRequest.effectiveTime,
          singleModel: omniSingleResult.model,
          listenUsage: {},
          compareUsage: {},
          singleUsage: normalizeUsage(omniSingleResult.usage),
        }),
        listenConfidence: normalizedSingle.confidence,
        compareConfidence: normalizedSingle.confidence,
      });
      responseData.lexicon = buildLexiconResultMeta(getLexiconState(), {
        enabled: Boolean(lexiconContext.enabled || rewriteState.rewriteMode !== "off"),
        rewriteMode: rewriteState.rewriteMode,
        matchedCount: Number(lexiconContext.matchedCount || 0),
        rewriteChanged: rewriteState.rewriteResult.changed === true,
        rewriteChanges: rewriteState.rewriteResult.changes,
      });
      responseData.timing = {
        listenDurationMs,
        compareDurationMs: 0,
        totalDurationMs: Date.now() - startedAtMs,
      };
    } else if (pipelineMode === "fun_asr_compare") {
      const listenStartedAtMs = Date.now();
      let funAsrResult = null;
      try {
        stageTiming.listenQueuedAt = Date.now();
        logStageEvent(requestId, "listen", "queued", {
          groupName: "fun_asr",
          pipelineMode,
          listenModel: activeListenModel,
          funAsrProvider: activeFunAsrProvider,
        });
        const queued = await runQueuedProviderCall("fun_asr", function () {
          return requestFunAsrRecognition(recommendRequest, {
            model: activeListenModel,
            timeoutMs: qwenConfig.timeoutMs,
            requestId,
            signal: runtimeSignal,
          });
        }, {
          model: activeListenModel,
          signal: runtimeSignal,
        });
        funAsrResult = queued.value;
        activeFunAsrProvider = String(funAsrResult?.providerMode || activeFunAsrProvider || "rest").trim() || "rest";
        queueMetas.push(queued.queueMeta);
        stageTiming.listenQueuedAt = Number(queued.queueMeta?.queuedAt) || stageTiming.listenQueuedAt;
        stageTiming.listenStartedAt = Number(queued.queueMeta?.startedAt) || Date.now();
        stageTiming.listenFinishedAt = Number(queued.queueMeta?.finishedAt) || Date.now();
        logStageEvent(requestId, "listen", "start", {
          groupName: "fun_asr",
          queueWaitMs: Math.max(0, Number(queued.queueMeta?.queueWaitMs) || 0),
          activeCount: Math.max(0, Number(queued.queueMeta?.activeCount) || 0),
          maxConcurrent: Math.max(0, Number(queued.queueMeta?.maxConcurrent) || 0),
        });
        logStageEvent(requestId, "listen", "end", {
          groupName: "fun_asr",
          durationMs: Math.max(0, Number(queued.queueMeta?.durationMs) || 0),
          rawStatus: String(funAsrResult?.rawStatus || ""),
          funAsrProvider: activeFunAsrProvider,
        });
      } finally {
        listenDurationMs = Date.now() - listenStartedAtMs;
      }

      const rawFunAsrHeardText = removeTextSpaces(funAsrResult.heardText || "");
      const heardText = normalizeFieldToSimplified(requestId, "heardText", rawFunAsrHeardText);
      if (funAsrResult.simplifiedChineseNormalized === true && heardText) {
        console.info("[DataBaker][round-one-quality][ai] simplified chinese normalized", {
          requestId,
          field: "heardText",
          changed: true,
          source: String(funAsrResult.simplifiedChineseSource || "python"),
          afterPreview: summarizeNormalizedText(heardText),
        });
      }
      const listenData = {
        heardText,
        confidence: Number(funAsrResult.confidence || 0),
        isValid: Boolean(heardText),
        invalidReasons: [],
      };
      const compareLexiconContext = buildLexiconContext({
        pageText: recommendRequest.pageText,
        heardText: heardText,
        limit: 60,
      });
      const comparePrompt = buildComparePrompt(recommendRequest, heardText, compareLexiconContext);
      const compareStartedAtMs = Date.now();
      let compareResult = null;
      try {
        stageTiming.compareQueuedAt = Date.now();
        logStageEvent(requestId, "compare", "queued", {
          groupName: "text_compare",
          pipelineMode,
          compareModel: activeCompareModel,
          enableThinking: effectiveEnableThinking,
        });
        const queued = await runQueuedProviderCall("text_compare", function () {
          return requestCompare(recommendRequest, comparePrompt, heardText, {
            model: activeCompareModel,
            timeoutMs: qwenConfig.timeoutMs,
            enableThinking: effectiveEnableThinking,
            signal: runtimeSignal,
          });
        }, {
          model: activeCompareModel,
          signal: runtimeSignal,
        });
        compareResult = queued.value;
        queueMetas.push(queued.queueMeta);
        stageTiming.compareQueuedAt = Number(queued.queueMeta?.queuedAt) || stageTiming.compareQueuedAt;
        stageTiming.compareStartedAt = Number(queued.queueMeta?.startedAt) || Date.now();
        stageTiming.compareFinishedAt = Number(queued.queueMeta?.finishedAt) || Date.now();
        logStageEvent(requestId, "compare", "start", {
          groupName: "text_compare",
          queueWaitMs: Math.max(0, Number(queued.queueMeta?.queueWaitMs) || 0),
          activeCount: Math.max(0, Number(queued.queueMeta?.activeCount) || 0),
          maxConcurrent: Math.max(0, Number(queued.queueMeta?.maxConcurrent) || 0),
          enableThinking: effectiveEnableThinking,
        });
        logStageEvent(requestId, "compare", "end", {
          groupName: "text_compare",
          durationMs: Math.max(0, Number(queued.queueMeta?.durationMs) || 0),
          model: String(compareResult?.model || activeCompareModel),
        });
      } finally {
        compareDurationMs = Date.now() - compareStartedAtMs;
      }
      const compareJson = parseModelJsonText(compareResult.rawText, {
        requestId,
        jobId: runtimeJobId,
        itemId: recommendRequest.itemId,
        sentenceNumber: recommendRequest.sentenceNumber,
        stage: "compare",
        model: compareResult.model,
        createdAt: runtimeCreatedAt,
      });
      const normalizedCompare = normalizeCompareResponse(compareJson, {
        pageText: recommendRequest.pageText,
        heardText,
      });
      const rewriteState = rewriteRecommendedText(
        normalizeToSimplifiedChinesePreservingLexicon(removeTextSpaces(normalizedCompare.recommendedText)),
        recommendRequest,
        heardText
      );
      normalizedCompare.recommendedText = rewriteState.text;
      if (rewriteState.rewriteResult.changed) {
        normalizedCompare.needHumanReview = true;
      }

      responseData = buildRecommendResponse({
        requestId,
        request: recommendRequest,
        listen: listenData,
        compare: normalizedCompare,
        listenModel: funAsrResult.model,
        compareModel: compareResult.model,
        listenUsage: normalizeUsage(funAsrResult.usage),
        compareUsage: normalizeUsage(compareResult.usage),
        cost: estimateCost({
          effectiveTime: recommendRequest.effectiveTime,
          listenModel: funAsrResult.model,
          compareModel: compareResult.model,
          listenUsage: {},
          compareUsage: normalizeUsage(compareResult.usage),
        }),
        listenConfidence: listenData.confidence,
        compareConfidence: normalizedCompare.confidence,
      });
      responseData.lexicon = buildLexiconResultMeta(getLexiconState(), {
        enabled: Boolean(compareLexiconContext.enabled || rewriteState.rewriteMode !== "off"),
        rewriteMode: rewriteState.rewriteMode,
        matchedCount: Number(compareLexiconContext.matchedCount || 0),
        rewriteChanged: rewriteState.rewriteResult.changed === true,
        rewriteChanges: rewriteState.rewriteResult.changes,
      });
      responseData.timing = {
        listenDurationMs,
        compareDurationMs,
        totalDurationMs: Date.now() - startedAtMs,
      };
    } else {
      const listenPrompt = buildOmniListenPrompt(recommendRequest);
      const listenStartedAtMs = Date.now();
      let omniListenResult = null;
      try {
        const queued = await runQueuedProviderCall("qwen_omni", function () {
          return requestOmniInputAudio(recommendRequest, listenPrompt, {
            model: activeListenModel,
            timeoutMs: qwenConfig.timeoutMs,
            enableThinking: effectiveEnableThinking,
            signal: runtimeSignal,
          });
        }, {
          model: activeListenModel,
          signal: runtimeSignal,
        });
        omniListenResult = queued.value;
        queueMetas.push(queued.queueMeta);
      } finally {
        listenDurationMs = Date.now() - listenStartedAtMs;
      }

      const listenJson = parseModelJsonText(omniListenResult.rawText, {
        requestId,
        jobId: runtimeJobId,
        itemId: recommendRequest.itemId,
        sentenceNumber: recommendRequest.sentenceNumber,
        stage: "listen",
        model: omniListenResult.model,
        createdAt: runtimeCreatedAt,
      });
      const normalizedListen = normalizeOmniListenStageResult(listenJson);
      const compareLexiconContext = buildLexiconContext({
        pageText: recommendRequest.pageText,
        heardText: normalizedListen.heardText,
        limit: 60,
      });
      const comparePrompt = buildComparePrompt(
        recommendRequest,
        normalizedListen.heardText,
        compareLexiconContext
      );
      const compareStartedAtMs = Date.now();
      let compareResult = null;
      try {
        const queued = await runQueuedProviderCall("text_compare", function () {
          return requestCompare(recommendRequest, comparePrompt, normalizedListen.heardText, {
            model: activeCompareModel,
            timeoutMs: qwenConfig.timeoutMs,
            enableThinking: effectiveEnableThinking,
            signal: runtimeSignal,
          });
        }, {
          model: activeCompareModel,
          signal: runtimeSignal,
        });
        compareResult = queued.value;
        queueMetas.push(queued.queueMeta);
      } finally {
        compareDurationMs = Date.now() - compareStartedAtMs;
      }

      const compareJson = parseModelJsonText(compareResult.rawText, {
        requestId,
        jobId: runtimeJobId,
        itemId: recommendRequest.itemId,
        sentenceNumber: recommendRequest.sentenceNumber,
        stage: "compare",
        model: compareResult.model,
        createdAt: runtimeCreatedAt,
      });
      const normalizedCompare = normalizeCompareResponse(compareJson, {
        pageText: recommendRequest.pageText,
        heardText: normalizedListen.heardText,
      });
      const rewriteState = rewriteRecommendedText(
        normalizeToSimplifiedChinesePreservingLexicon(
          removeTextSpaces(normalizedCompare.recommendedText)
        ),
        recommendRequest,
        normalizedListen.heardText
      );
      normalizedCompare.recommendedText = rewriteState.text;
      if (rewriteState.rewriteResult.changed) {
        normalizedCompare.needHumanReview = true;
      }
      if (normalizedListen.needHumanReview) {
        normalizedCompare.needHumanReview = true;
      }

      responseData = buildRecommendResponse({
        requestId,
        request: recommendRequest,
        listen: {
          heardText: normalizedListen.heardText,
          confidence: normalizedListen.confidence,
          isValid: Boolean(normalizedListen.heardText),
          invalidReasons: normalizedListen.heardText ? [] : ["missing-heard-text"],
        },
        compare: normalizedCompare,
        listenModel: omniListenResult.model,
        compareModel: compareResult.model,
        listenUsage: normalizeUsage(omniListenResult.usage),
        compareUsage: normalizeUsage(compareResult.usage),
        cost: estimateCost({
          effectiveTime: recommendRequest.effectiveTime,
          listenModel: omniListenResult.model,
          compareModel: compareResult.model,
          listenUsage: normalizeUsage(omniListenResult.usage),
          compareUsage: normalizeUsage(compareResult.usage),
        }),
        listenConfidence: normalizedListen.confidence,
        compareConfidence: normalizedCompare.confidence,
      });
      responseData.lexicon = buildLexiconResultMeta(getLexiconState(), {
        enabled: Boolean(compareLexiconContext.enabled || rewriteState.rewriteMode !== "off"),
        rewriteMode: rewriteState.rewriteMode,
        matchedCount: Number(compareLexiconContext.matchedCount || 0),
        rewriteChanged: rewriteState.rewriteResult.changed === true,
        rewriteChanges: rewriteState.rewriteResult.changes,
      });
      responseData.timing = {
        listenDurationMs,
        compareDurationMs,
        totalDurationMs: Date.now() - startedAtMs,
      };
    }

    responseData.recognitionMode = recognitionMode;
    responseData.pipelineMode = recognitionMode;
    responseData.derivedPipelineMode = pipelineMode;
    responseData.runtime = createRuntimeMeta({
      cacheHit: false,
      cacheTtlMs: setCachedRecommendResult(cacheKey, responseData),
      deprecatedMode,
      queueMetas,
      stageTiming,
      concurrencyDiagnostic: {
        frontConcurrencyOriginal: recommendRequest.frontConcurrencyOriginal,
        frontConcurrencyNormalized: recommendRequest.frontConcurrencyNormalized,
        concurrencyModelType: recommendRequest.concurrencyModelType,
      },
    });
    responseData.runtime.funAsrProvider = activeFunAsrProvider;
    responseData.thinking = {
      enableThinking: effectiveEnableThinking,
      compareStageOnly: pipelineMode === "fun_asr_compare" || pipelineMode === "qwen_omni_compare",
    };
    responseData.normalization = {
      simplifiedChineseApplied: true,
      lexiconTermsPreserved: true,
    };
    responseData.modelSelection = {
      recognitionMode,
      listenModel: activeListenModel,
      compareModel: activeCompareModel,
      singleModel: activeSingleModel,
      funAsrProvider: activeFunAsrProvider,
      derivedPipelineMode: pipelineMode,
    };

    appendCallLogSafe({
      createdAt: new Date().toISOString(),
      requestId,
      success: true,
      durationMs: Date.now() - startedAtMs,
      listenDurationMs,
      compareDurationMs,
      request: recommendRequest,
      response: responseData,
      listenModel: activeListenModel,
      compareModel: activeCompareModel,
      pipelineMode,
      audioHostname: parseAudioHostname(recommendRequest.audioUrl),
      mock: Boolean(qwenConfig.mockEnabled),
      debugId: safeString(responseData?.debugId),
    });

    return responseData;
  } catch (error) {
    const responseMessage = String(error?.message || "DataBaker AI recommend 请求失败。").slice(0, 240);
    const debugId = attachRawAiDebugToError(error, {
      requestId,
      request: recommendRequest || {},
      createdAt: runtimeCreatedAt,
    });
    appendCallLogSafe({
      createdAt: new Date().toISOString(),
      requestId,
      success: false,
      durationMs: Date.now() - startedAtMs,
      listenDurationMs,
      compareDurationMs,
      request: recommendRequest || {},
      response: {},
      listenModel: activeListenModel || qwenConfig?.omniModel || funAsrConfig?.model || DEFAULT_OMNI_MODEL,
      compareModel: activeCompareModel || qwenConfig?.compareModel || DEFAULT_COMPARE_MODEL,
      pipelineMode,
      audioHostname: parseAudioHostname(recommendRequest?.audioUrl || ""),
      mock: Boolean(qwenConfig?.mockEnabled || funAsrConfig?.mockEnabled),
      debugId,
      errorCode: String(error?.code || ""),
      errorMessage: responseMessage,
    });
    error.requestId = requestId;
    error.safeMessage = responseMessage;
    throw error;
  }
}

module.exports = {
  CSV_COLUMNS,
  DEFAULT_COMPARE_TEMPLATE,
  DEFAULT_OMNI_LISTEN_TEMPLATE,
  DEFAULT_OMNI_SINGLE_TEMPLATE,
  MINNAN_LEXICON_JSON_PATH,
  MINNAN_LEXICON_REFERENCE_CSV_PATH,
  RULE_VERSION,
  SUPPORTED_PIPELINE_MODES,
  buildLexiconResultMeta,
  __testOnly: {
    cleanLexiconTerm,
    splitTerms,
  },
  appendAiCallLog,
  applyLexiconRewrite,
  buildComparePrompt,
  buildLexiconContext,
  buildOmniListenPrompt,
  buildOmniSinglePrompt,
  buildRecommendResponse,
  createDefaultsPayload,
  createHealthPayload,
  ensureChineseSentencePunctuation,
  estimateCost,
  getLogDir,
  loadMinnanLexicon,
  normalizeAnnotatorName,
  normalizeCompareResponse,
  normalizeOmniSingleResponse,
  normalizeRecommendRequest,
  normalizeToSimplifiedChinesePreservingLexicon,
  normalizeUsage,
  parseLexiconCsv,
  parseModelJsonText,
  recommend,
  removeTextSpaces,
};






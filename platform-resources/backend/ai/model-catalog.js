"use strict";

const MODEL_MARKET_URL =
  "https://bailian.console.aliyun.com/cn-beijing?tab=model#/model-market/all";
const OPENAI_COMPATIBLE_API_DOC_URL =
  "https://bailian.console.aliyun.com/cn-beijing?tab=api#/api/?type=model&url=3016807";
const MODEL_PRICING_DOC_URL = "https://help.aliyun.com/zh/model-studio/model-pricing";
const QWEN_TEXT_DOC_URL =
  "https://bailian.console.aliyun.com/cn-beijing?tab=doc#/doc/?type=model&url=2841718";
const QWEN_OMNI_DOC_URL =
  "https://bailian.console.aliyun.com/cn-beijing?tab=doc#/doc/?type=model&url=2867839";
const FUN_ASR_DOC_URL =
  "https://bailian.console.aliyun.com/cn-beijing?tab=doc#/doc/?type=model&url=2880903";
const RECORDING_FILE_API_DOC_URL =
  "https://help.aliyun.com/zh/model-studio/recording-file-recognition-api-details";
const MODEL_PRICING_CONFIG_PATH = "config/aliyun-bailian-model-pricing.json";

const MODEL_ENTRIES = [
  {
    id: "qwen3.6-plus",
    family: "text",
    tier: "plus",
    transport: "openai-compatible-chat",
    supportsInputAudio: false,
    supportsThinking: true,
    defaultThinking: false,
    runtimeOrder: ["js", "python"],
    jsHandler: "qwen-openai-compatible.requestTextCompareJson",
    pythonHandler: "qwen-python.requestTextCompareJson",
    docs: {
      categoryDocUrl: QWEN_TEXT_DOC_URL,
      apiDocUrl: OPENAI_COMPATIBLE_API_DOC_URL,
      marketUrl: MODEL_MARKET_URL,
    },
    pricing: {
      pricingUrl: MODEL_PRICING_DOC_URL,
      pricingConfigPath: MODEL_PRICING_CONFIG_PATH,
    },
    recommendedUsage: "质量优先文本比较/转换。",
  },
  {
    id: "qwen3.5-plus",
    family: "text",
    tier: "plus",
    transport: "openai-compatible-chat",
    supportsInputAudio: false,
    supportsThinking: true,
    defaultThinking: false,
    runtimeOrder: ["js", "python"],
    jsHandler: "qwen-openai-compatible.requestTextCompareJson",
    pythonHandler: "qwen-python.requestTextCompareJson",
    docs: {
      categoryDocUrl: QWEN_TEXT_DOC_URL,
      apiDocUrl: OPENAI_COMPATIBLE_API_DOC_URL,
      marketUrl: MODEL_MARKET_URL,
    },
    pricing: {
      pricingUrl: MODEL_PRICING_DOC_URL,
      pricingConfigPath: MODEL_PRICING_CONFIG_PATH,
    },
    recommendedUsage: "稳妥文本比较/转换，兼顾质量与成本。",
  },
  {
    id: "qwen3.6-flash",
    family: "text",
    tier: "flash",
    transport: "openai-compatible-chat",
    supportsInputAudio: false,
    supportsThinking: true,
    defaultThinking: false,
    runtimeOrder: ["js", "python"],
    jsHandler: "qwen-openai-compatible.requestTextCompareJson",
    pythonHandler: "qwen-python.requestTextCompareJson",
    docs: {
      categoryDocUrl: QWEN_TEXT_DOC_URL,
      apiDocUrl: OPENAI_COMPATIBLE_API_DOC_URL,
      marketUrl: MODEL_MARKET_URL,
    },
    pricing: {
      pricingUrl: MODEL_PRICING_DOC_URL,
      pricingConfigPath: MODEL_PRICING_CONFIG_PATH,
    },
    recommendedUsage: "更快的文本比较/转换。",
  },
  {
    id: "qwen3.5-flash",
    family: "text",
    tier: "flash",
    transport: "openai-compatible-chat",
    supportsInputAudio: false,
    supportsThinking: true,
    defaultThinking: false,
    runtimeOrder: ["js", "python"],
    jsHandler: "qwen-openai-compatible.requestTextCompareJson",
    pythonHandler: "qwen-python.requestTextCompareJson",
    docs: {
      categoryDocUrl: QWEN_TEXT_DOC_URL,
      apiDocUrl: OPENAI_COMPATIBLE_API_DOC_URL,
      marketUrl: MODEL_MARKET_URL,
    },
    pricing: {
      pricingUrl: MODEL_PRICING_DOC_URL,
      pricingConfigPath: MODEL_PRICING_CONFIG_PATH,
    },
    recommendedUsage: "速度优先文本比较/转换默认候选。",
  },
  {
    id: "qwen3.5-omni-plus",
    family: "omni",
    tier: "plus",
    transport: "openai-compatible-chat",
    supportsInputAudio: true,
    supportsThinking: true,
    defaultThinking: false,
    runtimeOrder: ["js", "python"],
    jsHandler: "qwen-openai-compatible.requestOmniInputAudio",
    pythonHandler: "qwen-python.requestOmniInputAudio",
    docs: {
      categoryDocUrl: QWEN_OMNI_DOC_URL,
      apiDocUrl: OPENAI_COMPATIBLE_API_DOC_URL,
      marketUrl: MODEL_MARKET_URL,
    },
    pricing: {
      pricingUrl: MODEL_PRICING_DOC_URL,
      pricingConfigPath: MODEL_PRICING_CONFIG_PATH,
    },
    recommendedUsage: "质量优先音频理解/听音。",
  },
  {
    id: "qwen3.5-omni-flash",
    family: "omni",
    tier: "flash",
    transport: "openai-compatible-chat",
    supportsInputAudio: true,
    supportsThinking: true,
    defaultThinking: false,
    runtimeOrder: ["js", "python"],
    jsHandler: "qwen-openai-compatible.requestOmniInputAudio",
    pythonHandler: "qwen-python.requestOmniInputAudio",
    docs: {
      categoryDocUrl: QWEN_OMNI_DOC_URL,
      apiDocUrl: OPENAI_COMPATIBLE_API_DOC_URL,
      marketUrl: MODEL_MARKET_URL,
    },
    pricing: {
      pricingUrl: MODEL_PRICING_DOC_URL,
      pricingConfigPath: MODEL_PRICING_CONFIG_PATH,
    },
    recommendedUsage: "速度优先音频理解/听音默认候选。",
  },
  {
    id: "fun-asr",
    family: "asr",
    tier: "flash",
    transport: "funasr-rest",
    supportsInputAudio: true,
    supportsThinking: false,
    defaultThinking: false,
    runtimeOrder: ["js", "python"],
    jsHandler: "funasr.requestFunAsrRecognitionRest",
    pythonHandler: "funasr.requestFunAsrRecognitionPython",
    docs: {
      categoryDocUrl: FUN_ASR_DOC_URL,
      apiDocUrl: RECORDING_FILE_API_DOC_URL,
      marketUrl: MODEL_MARKET_URL,
    },
    pricing: {
      pricingUrl: MODEL_PRICING_DOC_URL,
      pricingConfigPath: MODEL_PRICING_CONFIG_PATH,
    },
    recommendedUsage: "速度优先录音文件识别默认候选。",
  },
];

const MODEL_INDEX = Object.create(null);
MODEL_ENTRIES.forEach(function (entry) {
  MODEL_INDEX[entry.id] = Object.freeze(Object.assign({}, entry));
});

const RECOMMENDED_BY_FAMILY = Object.freeze({
  text: {
    lightweight: "qwen3.5-flash",
    quality: "qwen3.6-plus",
  },
  omni: {
    lightweight: "qwen3.5-omni-flash",
    quality: "qwen3.5-omni-plus",
  },
  asr: {
    lightweight: "fun-asr",
    quality: "fun-asr",
  },
});

function cloneEntry(entry) {
  return entry ? JSON.parse(JSON.stringify(entry)) : null;
}

function listAllModels() {
  return MODEL_ENTRIES.map(cloneEntry);
}

function getModelMeta(modelId) {
  return cloneEntry(MODEL_INDEX[String(modelId || "").trim()]);
}

function listModelsByFamily(family) {
  const normalizedFamily = String(family || "").trim().toLowerCase();
  return MODEL_ENTRIES.filter(function (entry) {
    return entry.family === normalizedFamily;
  }).map(cloneEntry);
}

function listModelIdsByFamily(family) {
  return listModelsByFamily(family).map(function (entry) {
    return entry.id;
  });
}

function getModelDocs(modelId) {
  const entry = getModelMeta(modelId);
  if (!entry) {
    return null;
  }
  return {
    modelId: entry.id,
    docs: Object.assign({}, entry.docs),
    pricing: Object.assign({}, entry.pricing),
  };
}

function getRecommendedModelsByFamily() {
  return JSON.parse(JSON.stringify(RECOMMENDED_BY_FAMILY));
}

function buildModelOptionsByFamily(family) {
  return listModelsByFamily(family).map(function (entry) {
    return {
      value: entry.id,
      label: entry.id,
      family: entry.family,
      tier: entry.tier,
      supportsThinking: entry.supportsThinking === true,
      defaultThinking: false,
      categoryDocUrl: entry.docs.categoryDocUrl,
      apiDocUrl: entry.docs.apiDocUrl,
      pricingUrl: entry.pricing.pricingUrl,
      pricingConfigPath: entry.pricing.pricingConfigPath,
      marketUrl: entry.docs.marketUrl,
      recommendedUsage: entry.recommendedUsage,
    };
  });
}

module.exports = {
  MODEL_MARKET_URL,
  MODEL_PRICING_CONFIG_PATH,
  MODEL_PRICING_DOC_URL,
  OPENAI_COMPATIBLE_API_DOC_URL,
  QWEN_TEXT_DOC_URL,
  QWEN_OMNI_DOC_URL,
  FUN_ASR_DOC_URL,
  RECORDING_FILE_API_DOC_URL,
  buildModelOptionsByFamily,
  getModelDocs,
  getModelMeta,
  getRecommendedModelsByFamily,
  listAllModels,
  listModelIdsByFamily,
  listModelsByFamily,
};

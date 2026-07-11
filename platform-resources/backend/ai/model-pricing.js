"use strict";

const path = require("path");

const PRICING_CONFIG_PATH = path.resolve(
  __dirname,
  "../../../config/aliyun-bailian-model-pricing.json"
);
const PRICING_CONFIG = require(PRICING_CONFIG_PATH);

function cloneValue(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function normalizeText(value) {
  return String(value || "").trim();
}

function roundCostCny(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return null;
  }
  return Math.round(number * 1000000) / 1000000;
}

function getFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatUnitPrice(value) {
  const number = Number(value);
  return Number.isFinite(number) ? String(number) + " 元/百万Token" : "";
}

function readFirstFiniteNumber(source, keys) {
  const input = source && typeof source === "object" ? source : {};
  for (let index = 0; index < keys.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(input, keys[index])) {
      continue;
    }
    const number = getFiniteNumber(input[keys[index]]);
    if (number !== null) {
      return number;
    }
  }
  return null;
}

function getPromptDetails(usage) {
  const raw = usage?.raw && typeof usage.raw === "object" ? usage.raw : usage;
  return raw?.prompt_tokens_details || raw?.promptTokensDetails || null;
}

function getCompletionDetails(usage) {
  const raw = usage?.raw && typeof usage.raw === "object" ? usage.raw : usage;
  return raw?.completion_tokens_details || raw?.completionTokensDetails || null;
}

function pickPromptTokens(usage) {
  return readFirstFiniteNumber(usage, [
    "promptTokens",
    "prompt_tokens",
    "inputTokens",
    "input_tokens",
  ]);
}

function pickCompletionTokens(usage) {
  return readFirstFiniteNumber(usage, [
    "completionTokens",
    "completion_tokens",
    "outputTokens",
    "output_tokens",
  ]);
}

function pickDetailTokens(details, keys) {
  return readFirstFiniteNumber(details, keys) || 0;
}

function getPricingCatalog() {
  return cloneValue(PRICING_CONFIG);
}

function getModelPricing(modelId) {
  const normalizedModelId = normalizeText(modelId);
  const modelConfig = PRICING_CONFIG.models?.[normalizedModelId];
  return modelConfig ? cloneValue(modelConfig) : null;
}

function buildMissingSourceStage(modelId) {
  return {
    modelId: normalizeText(modelId),
    pricingStatus: "missing_source",
    hasPriceData: false,
    hasUsageDetail: false,
    reason: "没有数据源",
    inputPriceLabel: "",
    outputPriceLabel: "",
    estimatedCostCny: null,
  };
}

function buildInsufficientUsageStage(modelId, inputPriceLabel, outputPriceLabel, reason) {
  return {
    modelId: normalizeText(modelId),
    pricingStatus: "insufficient_usage_detail",
    hasPriceData: true,
    hasUsageDetail: false,
    reason: normalizeText(reason) || "缺少 Token 数据，无法估算",
    inputPriceLabel: normalizeText(inputPriceLabel),
    outputPriceLabel: normalizeText(outputPriceLabel),
    estimatedCostCny: null,
  };
}

function buildEstimatedStage(modelId, inputPriceLabel, outputPriceLabel, estimatedCostCny) {
  return {
    modelId: normalizeText(modelId),
    pricingStatus: "estimated",
    hasPriceData: true,
    hasUsageDetail: true,
    reason: "",
    inputPriceLabel: normalizeText(inputPriceLabel),
    outputPriceLabel: normalizeText(outputPriceLabel),
    estimatedCostCny: roundCostCny(estimatedCostCny),
  };
}

function pickTextModelTier(entry, promptTokens) {
  const tiers = Array.isArray(entry?.tiers) ? entry.tiers : [];
  const matchedTier = tiers.find(function (tier) {
    const maxPromptTokens = Number(tier?.maxPromptTokens || 0);
    return maxPromptTokens > 0 && promptTokens > 0 && promptTokens <= maxPromptTokens;
  });
  return matchedTier || null;
}

function estimateOmniStageCost(modelId, entry, usage, outputMode) {
  const inputPriceLabel =
    "文本/图片/视频 " +
    formatUnitPrice(entry.input?.textImageVideoCnyPerMillionTokens) +
    "；音频 " +
    formatUnitPrice(entry.input?.audioCnyPerMillionTokens);
  const resolvedOutputMode = normalizeText(outputMode) === "text_audio" ? "text_audio" : "text";
  const outputUnitPrice =
    resolvedOutputMode === "text_audio"
      ? entry.output?.textAudioCnyPerMillionTokens
      : entry.output?.textCnyPerMillionTokens;
  const outputLabelPrefix = resolvedOutputMode === "text_audio" ? "文本+音频 " : "文本 ";
  const outputPriceLabel = outputLabelPrefix + formatUnitPrice(outputUnitPrice);

  const promptDetails = getPromptDetails(usage);
  const completionTokens = pickCompletionTokens(usage);
  if (!promptDetails || completionTokens === null) {
    return buildInsufficientUsageStage(
      modelId,
      inputPriceLabel,
      outputPriceLabel,
      "缺少音频/文本输入明细，无法估算"
    );
  }

  const textTokens = pickDetailTokens(promptDetails, ["text_tokens", "textTokens"]);
  const imageTokens = pickDetailTokens(promptDetails, ["image_tokens", "imageTokens"]);
  const videoTokens = pickDetailTokens(promptDetails, ["video_tokens", "videoTokens"]);
  const audioTokens = pickDetailTokens(promptDetails, ["audio_tokens", "audioTokens"]);
  const totalInputTokens = textTokens + imageTokens + videoTokens + audioTokens;

  if (totalInputTokens <= 0) {
    return buildInsufficientUsageStage(
      modelId,
      inputPriceLabel,
      outputPriceLabel,
      "缺少音频/文本输入明细，无法估算"
    );
  }

  const inputCostCny =
    ((textTokens + imageTokens + videoTokens) * Number(entry.input?.textImageVideoCnyPerMillionTokens || 0) +
      audioTokens * Number(entry.input?.audioCnyPerMillionTokens || 0)) /
    1000000;
  const outputCostCny = (completionTokens * Number(outputUnitPrice || 0)) / 1000000;

  return buildEstimatedStage(modelId, inputPriceLabel, outputPriceLabel, inputCostCny + outputCostCny);
}

function estimateTextStageCost(modelId, entry, usage) {
  const promptTokens = pickPromptTokens(usage);
  const completionTokens = pickCompletionTokens(usage);
  if (promptTokens === null || promptTokens <= 0 || completionTokens === null) {
    return buildInsufficientUsageStage(modelId, "", "", "缺少 Token 数据，无法估算");
  }

  const tier = pickTextModelTier(entry, promptTokens);
  if (!tier) {
    return buildMissingSourceStage(modelId);
  }

  const inputPriceLabel = String(tier.label || "") + "：" + formatUnitPrice(tier.inputCnyPerMillionTokens);
  const outputPriceLabel = String(tier.label || "") + "：" + formatUnitPrice(tier.outputCnyPerMillionTokens);
  const estimatedCostCny =
    (promptTokens * Number(tier.inputCnyPerMillionTokens || 0) +
      completionTokens * Number(tier.outputCnyPerMillionTokens || 0)) /
    1000000;

  return buildEstimatedStage(modelId, inputPriceLabel, outputPriceLabel, estimatedCostCny);
}

function estimateStageCost(options) {
  const source = options && typeof options === "object" ? options : {};
  const modelId = normalizeText(source.modelId);
  const usage = source.usage && typeof source.usage === "object" ? source.usage : {};
  const entry = getModelPricing(modelId);
  if (!entry) {
    return buildMissingSourceStage(modelId);
  }
  if (entry.family === "omni") {
    return estimateOmniStageCost(modelId, entry, usage, source.outputMode);
  }
  if (entry.family === "text") {
    return estimateTextStageCost(modelId, entry, usage);
  }
  return buildMissingSourceStage(modelId);
}

function buildPricingNote(stageKeys, stageResults) {
  const hasEstimated = stageKeys.some(function (key) {
    return stageResults[key]?.pricingStatus === "estimated";
  });
  const hasNonEstimated = stageKeys.some(function (key) {
    return stageResults[key]?.pricingStatus && stageResults[key]?.pricingStatus !== "estimated";
  });
  if (hasEstimated && hasNonEstimated) {
    return "价格按官方公开文档估算，仅汇总可估算阶段。";
  }
  if (hasEstimated) {
    return "价格按官方公开文档估算，仅覆盖当前已配置模型。";
  }
  return "价格按官方公开文档估算；当前阶段没有可估算数据。";
}

function estimateProjectCost(stageMap) {
  const source = stageMap && typeof stageMap === "object" ? stageMap : {};
  const stageKeys = Object.keys(source);
  const result = {
    currency: normalizeText(PRICING_CONFIG.currency),
    pricingSourceUrl: normalizeText(PRICING_CONFIG.sourceUrl),
    pricingRegion: normalizeText(PRICING_CONFIG.region),
    modelListUrl: normalizeText(PRICING_CONFIG.modelListUrl),
    verifiedAt: normalizeText(PRICING_CONFIG.verifiedAt),
  };
  let totalEstimatedCostCny = 0;
  let hasEstimatedCost = false;

  stageKeys.forEach(function (stageKey) {
    const stageOptions = source[stageKey] && typeof source[stageKey] === "object" ? source[stageKey] : {};
    const stageResult = estimateStageCost(stageOptions);
    result[stageKey] = stageResult;
    if (stageResult.estimatedCostCny !== null) {
      totalEstimatedCostCny += stageResult.estimatedCostCny;
      hasEstimatedCost = true;
    }
  });

  result.totalEstimatedCostCny = hasEstimatedCost ? roundCostCny(totalEstimatedCostCny) : null;
  result.note = buildPricingNote(stageKeys, result);
  return result;
}

function buildPricingAvailabilitySummary(stageModelMap) {
  const source = stageModelMap && typeof stageModelMap === "object" ? stageModelMap : {};
  const summary = {
    currency: normalizeText(PRICING_CONFIG.currency),
    region: normalizeText(PRICING_CONFIG.region),
    sourceUrl: normalizeText(PRICING_CONFIG.sourceUrl),
    modelListUrl: normalizeText(PRICING_CONFIG.modelListUrl),
    verifiedAt: normalizeText(PRICING_CONFIG.verifiedAt),
    supportedModelAvailability: {},
  };

  Object.keys(source).forEach(function (stageKey) {
    const models = Array.isArray(source[stageKey]) ? source[stageKey] : [];
    summary.supportedModelAvailability[stageKey] = {};
    models.forEach(function (modelId) {
      summary.supportedModelAvailability[stageKey][modelId] = Boolean(getModelPricing(modelId));
    });
  });

  return summary;
}

module.exports = {
  PRICING_CONFIG_PATH,
  buildPricingAvailabilitySummary,
  estimateProjectCost,
  estimateStageCost,
  getModelPricing,
  getPricingCatalog,
};

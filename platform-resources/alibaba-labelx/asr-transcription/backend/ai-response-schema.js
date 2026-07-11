"use strict";

const DECISIONS = ["candidate_a", "candidate_b", "merged", "uncertain", "invalid_audio"];
const DEFAULT_DECISION = "uncertain";
const DEFAULT_APPLY_ADVICE = "manual_confirm";

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeDecision(value) {
  const text = normalizeText(value).toLowerCase();
  return DECISIONS.indexOf(text) >= 0 ? text : DEFAULT_DECISION;
}

function normalizeConfidence(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return 0;
  }
  return Math.max(0, Math.min(1, Number(num.toFixed(4))));
}

function normalizeRiskFlags(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  const next = value
    .map(function (item) {
      return normalizeText(item).slice(0, 80);
    })
    .filter(Boolean);
  return Array.from(new Set(next));
}

function parseModelJsonText(rawText, requestId) {
  const text = String(rawText || "").trim();
  if (!text) {
    const error = new Error("AI 模型未返回文本内容。");
    error.code = "empty-provider-response";
    error.requestId = requestId || "";
    throw error;
  }

  const blockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const maybeJson = blockMatch ? blockMatch[1].trim() : text;

  try {
    return JSON.parse(maybeJson);
  } catch (error) {
    const fallbackStart = maybeJson.indexOf("{");
    const fallbackEnd = maybeJson.lastIndexOf("}");
    if (fallbackStart >= 0 && fallbackEnd > fallbackStart) {
      const fallbackText = maybeJson.slice(fallbackStart, fallbackEnd + 1);
      try {
        return JSON.parse(fallbackText);
      } catch (innerError) {
        // continue to throw below
      }
    }

    const parseError = new Error("AI 模型输出不是有效 JSON。");
    parseError.code = "invalid-model-json";
    parseError.requestId = requestId || "";
    throw parseError;
  }
}

function normalizeUsage(usage) {
  const source = usage && typeof usage === "object" ? usage : {};
  return {
    promptTokens: Number(source.prompt_tokens || source.promptTokens || 0) || 0,
    completionTokens: Number(source.completion_tokens || source.completionTokens || 0) || 0,
    totalTokens: Number(source.total_tokens || source.totalTokens || 0) || 0,
  };
}

function normalizeSuggestionResponse(modelJson) {
  const source = modelJson && typeof modelJson === "object" ? modelJson : {};
  const recommendedText = normalizeText(source.recommendedText || source.recommended_text || "");
  const decision = normalizeDecision(source.decision);

  return {
    decision,
    recommendedText,
    confidence: normalizeConfidence(source.confidence),
    reasonSummary: normalizeText(source.reasonSummary || source.reason_summary || "").slice(0, 120),
    riskFlags: normalizeRiskFlags(source.riskFlags || source.risk_flags),
    applyAdvice: DEFAULT_APPLY_ADVICE,
  };
}

module.exports = {
  DECISIONS,
  DEFAULT_APPLY_ADVICE,
  parseModelJsonText,
  normalizeSuggestionResponse,
  normalizeUsage,
};

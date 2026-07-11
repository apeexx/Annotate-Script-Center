"use strict";

function toNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeUsage(usage, fallback) {
  const defaults = fallback && typeof fallback === "object" ? fallback : {};
  const source = usage && typeof usage === "object" ? usage : {};

  const inputTokens =
    toNumber(source.inputTokens, NaN) ||
    toNumber(source.prompt_tokens, NaN) ||
    toNumber(defaults.inputTokens, 0);
  const outputTokens =
    toNumber(source.outputTokens, NaN) ||
    toNumber(source.completion_tokens, NaN) ||
    toNumber(defaults.outputTokens, 0);
  const totalTokens =
    toNumber(source.totalTokens, NaN) ||
    toNumber(source.total_tokens, NaN) ||
    toNumber(defaults.totalTokens, inputTokens + outputTokens);

  return {
    inputTokens: Math.max(0, Math.floor(inputTokens || 0)),
    outputTokens: Math.max(0, Math.floor(outputTokens || 0)),
    totalTokens: Math.max(0, Math.floor(totalTokens || 0)),
    source: String(source.source || defaults.source || "unavailable"),
  };
}

function estimateUsageFromTexts(inputText, outputText) {
  const inputChars = String(inputText || "").length;
  const outputChars = String(outputText || "").length;
  const inputTokens = Math.max(1, Math.ceil(inputChars / 4));
  const outputTokens = Math.max(1, Math.ceil(outputChars / 4));
  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    source: "estimated",
  };
}

module.exports = {
  estimateUsageFromTexts,
  normalizeUsage,
};

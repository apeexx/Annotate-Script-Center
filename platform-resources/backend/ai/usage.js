"use strict";

function normalizeUsage(usage) {
  const source = usage && typeof usage === "object" ? usage : {};
  const promptTokens = Number(source.promptTokens || source.prompt_tokens || source.input_tokens || 0);
  const completionTokens = Number(source.completionTokens || source.completion_tokens || source.output_tokens || 0);
  const totalTokens = Number(source.totalTokens || source.total_tokens || promptTokens + completionTokens || 0);
  return {
    promptTokens: Number.isFinite(promptTokens) ? promptTokens : 0,
    completionTokens: Number.isFinite(completionTokens) ? completionTokens : 0,
    totalTokens: Number.isFinite(totalTokens) ? totalTokens : 0,
    raw: source,
  };
}

module.exports = {
  normalizeUsage,
};

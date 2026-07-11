"use strict";

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function pickEnvelopeValue(source, key) {
  if (!isPlainObject(source)) {
    return null;
  }
  const value = source[key];
  return isPlainObject(value) ? value : null;
}

function normalizeNotes(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map(function mapNote(item) {
      return String(item || "").trim();
    })
    .filter(Boolean);
}

async function executeProjectPipeline(input) {
  const source = input && typeof input === "object" ? input : {};
  const adapter = source.adapter && typeof source.adapter === "object" ? source.adapter : {};
  const runner = source.runner;
  if (typeof runner !== "function") {
    const error = new Error("AI framework runner 未配置。");
    error.statusCode = 500;
    error.code = "ai-framework-runner-missing";
    throw error;
  }

  const normalizedRequest = isPlainObject(source.normalizedRequest)
    ? source.normalizedRequest
    : {};
  const assets = isPlainObject(source.assets) ? source.assets : {};
  const runtimeContext = isPlainObject(source.runtimeContext)
    ? source.runtimeContext
    : {};

  const assetsContext =
    typeof adapter.buildAssetsContext === "function"
      ? await adapter.buildAssetsContext(normalizedRequest, assets, runtimeContext)
      : assets;

  const pipelineResult = await runner({
    adapter,
    normalizedRequest,
    assets,
    assetsContext,
    runtimeContext,
  });

  const postProcessedResult =
    typeof adapter.postProcessResult === "function"
      ? await adapter.postProcessResult(pipelineResult, {
          normalizedRequest,
          assets,
          assetsContext,
          runtimeContext,
        })
      : pipelineResult;

  const projectResult =
    typeof adapter.exposeProjectResult === "function"
      ? await adapter.exposeProjectResult(postProcessedResult, {
          normalizedRequest,
          assets,
          assetsContext,
          runtimeContext,
        })
      : postProcessedResult;

  return {
    assetsContext: isPlainObject(assetsContext) ? assetsContext : assets,
    pipelineResult,
    postProcessedResult,
    projectResult: isPlainObject(projectResult) ? projectResult : null,
    models: pickEnvelopeValue(postProcessedResult, "models"),
    usage: pickEnvelopeValue(postProcessedResult, "usage"),
    cost: pickEnvelopeValue(postProcessedResult, "cost"),
    timing: pickEnvelopeValue(postProcessedResult, "timing"),
    cache: pickEnvelopeValue(postProcessedResult, "cache"),
    debug: pickEnvelopeValue(postProcessedResult, "debug"),
    notes: normalizeNotes(postProcessedResult && postProcessedResult.notes),
  };
}

module.exports = {
  executeProjectPipeline,
};

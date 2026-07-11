"use strict";

const { estimateProjectCost } = require("../ai/model-pricing");

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeIntegerCell(value, options) {
  const source = options && typeof options === "object" ? options : {};
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "";
  }
  if (number === 0 && source.allowZero !== true) {
    return "";
  }
  return String(Math.round(number));
}

function normalizeCostCell(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(6) : "";
}

function pickPlainObject() {
  for (let index = 0; index < arguments.length; index += 1) {
    const candidate = arguments[index];
    if (isPlainObject(candidate)) {
      return candidate;
    }
  }
  return {};
}

function pickContextMeta(context) {
  const source = isPlainObject(context) ? context : {};
  const result = pickPlainObject(source.result);
  const error = pickPlainObject(source.error);
  const execution = pickPlainObject(source.execution);
  const projectResult = pickPlainObject(
    execution.projectResult,
    execution.postProcessedResult,
    execution.pipelineResult,
    result
  );
  const errorMeta = pickPlainObject(error.meta);
  const resultMeta = pickPlainObject(result.meta);
  const normalizedRequest = pickPlainObject(source.normalizedRequest);

  return {
    context: source,
    normalizedRequest,
    input: pickPlainObject(normalizedRequest.input),
    projectOptions: pickPlainObject(normalizedRequest.projectOptions),
    request: pickPlainObject(source.request),
    response: pickPlainObject(source.response),
    projectResult,
    models: pickPlainObject(
      projectResult.models,
      execution.models,
      result.models,
      errorMeta.models,
      resultMeta.models
    ),
    usage: pickPlainObject(
      projectResult.usage,
      execution.usage,
      result.usage,
      error.usage,
      errorMeta.usage,
      resultMeta.usage
    ),
    cost: pickPlainObject(
      projectResult.cost,
      execution.cost,
      result.cost,
      error.cost,
      errorMeta.cost,
      resultMeta.cost
    ),
  };
}

function pickObjectByKeys(objects, keys) {
  const safeKeys = Array.isArray(keys) ? keys : [];
  for (let objectIndex = 0; objectIndex < objects.length; objectIndex += 1) {
    const current = objects[objectIndex];
    if (!isPlainObject(current)) {
      continue;
    }
    for (let keyIndex = 0; keyIndex < safeKeys.length; keyIndex += 1) {
      const key = safeKeys[keyIndex];
      if (!Object.prototype.hasOwnProperty.call(current, key)) {
        continue;
      }
      const value = current[key];
      if (isPlainObject(value)) {
        return value;
      }
    }
  }
  return null;
}

function pickTextByKeys(objects, keys) {
  const safeKeys = Array.isArray(keys) ? keys : [];
  for (let objectIndex = 0; objectIndex < objects.length; objectIndex += 1) {
    const current = objects[objectIndex];
    if (!isPlainObject(current)) {
      continue;
    }
    for (let keyIndex = 0; keyIndex < safeKeys.length; keyIndex += 1) {
      const key = safeKeys[keyIndex];
      if (!Object.prototype.hasOwnProperty.call(current, key)) {
        continue;
      }
      const value = normalizeText(current[key]);
      if (value) {
        return value;
      }
    }
  }
  return "";
}

function resolveStageUsage(stage, meta) {
  if (typeof stage.getUsage === "function") {
    const customUsage = stage.getUsage(meta);
    return isPlainObject(customUsage) ? customUsage : {};
  }

  if (stage.useTotalUsage === true) {
    return isPlainObject(meta.usage) ? meta.usage : {};
  }

  const usageKeys = Array.isArray(stage.usageKeys)
    ? stage.usageKeys
    : Array.isArray(stage.usageKey)
      ? stage.usageKey
      : [stage.usageKey || stage.key];
  return pickObjectByKeys([meta.usage, meta.projectResult, meta.response], usageKeys) || {};
}

function resolveStageModelId(stage, meta) {
  if (typeof stage.getModelId === "function") {
    return normalizeText(stage.getModelId(meta));
  }
  const modelKeys = Array.isArray(stage.modelKeys)
    ? stage.modelKeys
    : Array.isArray(stage.modelKey)
      ? stage.modelKey
      : [stage.modelKey || stage.key + "Model"];
  return pickTextByKeys(
    [
      meta.models,
      meta.projectResult,
      meta.projectOptions,
      meta.input,
      meta.request,
      meta.response,
    ],
    modelKeys
  );
}

function pickStageCost(cost, stageKey) {
  const stageCost = isPlainObject(cost) ? cost[stageKey] : null;
  return isPlainObject(stageCost) ? stageCost : {};
}

function mergeCostPayload(providedCost, estimatedCost) {
  const fallback = isPlainObject(estimatedCost) ? estimatedCost : {};
  const provided = isPlainObject(providedCost) ? providedCost : {};
  const result = Object.assign({}, fallback, provided);

  Object.keys(fallback).forEach(function (stageKey) {
    if (!isPlainObject(fallback[stageKey])) {
      return;
    }
    result[stageKey] = Object.assign({}, fallback[stageKey], provided[stageKey]);
  });

  return result;
}

function buildStageEstimateInput(stages, meta) {
  return stages.reduce(function (result, stage) {
    const modelId = resolveStageModelId(stage, meta);
    const usage = resolveStageUsage(stage, meta);
    if (!modelId && Object.keys(usage).length === 0) {
      return result;
    }
    result[stage.key] = {
      modelId,
      usage,
      outputMode: normalizeText(
        typeof stage.getOutputMode === "function" ? stage.getOutputMode(meta) : stage.outputMode
      ) || "text",
    };
    return result;
  }, {});
}

function createStageColumnKey(stage, suffix) {
  return String(stage.key || "") + suffix;
}

function buildStageColumns(stages) {
  const result = [];
  stages.forEach(function (stage) {
    if (stage.includeColumns === false) {
      return;
    }
    result.push(
      { key: createStageColumnKey(stage, "PromptTokens"), header: stage.label + "输入Token" },
      { key: createStageColumnKey(stage, "CompletionTokens"), header: stage.label + "输出Token" },
      { key: createStageColumnKey(stage, "TotalTokens"), header: stage.label + "总Token" },
      { key: createStageColumnKey(stage, "EstimatedCostCny"), header: stage.label + "预估人民币" }
    );
  });
  return result;
}

function buildStageRow(stages, meta, cost) {
  return stages.reduce(function (result, stage) {
    if (stage.includeColumns === false) {
      return result;
    }

    const usage = resolveStageUsage(stage, meta);
    const stageCost = pickStageCost(cost, stage.key);
    const promptTokens =
      usage.promptTokens ?? usage.prompt_tokens ?? usage.inputTokens ?? usage.input_tokens;
    const completionTokens =
      usage.completionTokens ?? usage.completion_tokens ?? usage.outputTokens ?? usage.output_tokens;
    const totalTokens =
      usage.totalTokens ??
      usage.total_tokens ??
      (Number(promptTokens || 0) + Number(completionTokens || 0));

    result[createStageColumnKey(stage, "PromptTokens")] = normalizeIntegerCell(promptTokens);
    result[createStageColumnKey(stage, "CompletionTokens")] = normalizeIntegerCell(completionTokens, {
      allowZero: true,
    });
    result[createStageColumnKey(stage, "TotalTokens")] = normalizeIntegerCell(totalTokens);
    result[createStageColumnKey(stage, "EstimatedCostCny")] = normalizeCostCell(
      stageCost.estimatedCostCny
    );
    return result;
  }, {});
}

function normalizeStageConfig(stage) {
  const source = isPlainObject(stage) ? stage : {};
  const key = normalizeText(source.key);
  const label = normalizeText(source.label);
  if (!key || !label) {
    return null;
  }
  return Object.assign({}, source, {
    key,
    label,
  });
}

function createStageLogSupport(options) {
  const source = isPlainObject(options) ? options : {};
  const stages = Array.isArray(source.stages)
    ? source.stages.map(normalizeStageConfig).filter(Boolean)
    : [];
  const includeTotalCost = source.includeTotalCost !== false;

  return {
    extraColumns: buildStageColumns(stages).concat(
      includeTotalCost ? [{ key: "totalEstimatedCostCny", header: "总预估人民币" }] : []
    ),
    buildRow(context) {
      const meta = pickContextMeta(context);
      const estimatedCost = estimateProjectCost(buildStageEstimateInput(stages, meta));
      const mergedCost = mergeCostPayload(meta.cost, estimatedCost);
      const row = buildStageRow(stages, meta, mergedCost);

      if (includeTotalCost) {
        row.totalEstimatedCostCny = normalizeCostCell(mergedCost.totalEstimatedCostCny);
      }

      return row;
    },
  };
}

module.exports = {
  createStageLogSupport,
};

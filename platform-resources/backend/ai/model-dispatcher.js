"use strict";

const {
  getModelDocs,
  getModelMeta: getCatalogModelMeta,
  listModelsByFamily: listCatalogModelsByFamily,
} = require("./model-catalog");
const {
  getFunAsrClientConfig,
  requestFunAsrRecognitionPython,
  requestFunAsrRecognitionRest,
} = require("./providers/funasr");
const {
  getClientConfig: getQwenJsClientConfig,
  requestOmniInputAudio: requestQwenJsOmniInputAudio,
  requestTextCompareJson: requestQwenJsTextCompareJson,
} = require("./providers/qwen-openai-compatible");
const {
  getQwenPythonClientConfig,
  requestOmniInputAudio: requestQwenPythonOmniInputAudio,
  requestTextCompareJson: requestQwenPythonTextCompareJson,
} = require("./providers/qwen-python");

function getRuntimeAvailability(entry) {
  const source = entry && typeof entry === "object" ? entry : null;
  if (!source) {
    return {
      js: false,
      python: false,
    };
  }
  if (source.family === "asr") {
    const config = getFunAsrClientConfig();
    return {
      js: true,
      python: config.pythonExists === true,
    };
  }
  const qwenPythonConfig = getQwenPythonClientConfig();
  return {
    js: true,
    python: qwenPythonConfig.pythonExists === true,
  };
}

function enrichMeta(entry) {
  if (!entry) {
    return null;
  }
  return Object.assign({}, entry, {
    runtimeAvailability: getRuntimeAvailability(entry),
  });
}

function getModelMeta(modelId) {
  return enrichMeta(getCatalogModelMeta(modelId));
}

function listModelsByFamily(family) {
  return listCatalogModelsByFamily(family).map(enrichMeta);
}

function resolveQwenJsInvoker(entry) {
  if (entry.family === "omni") {
    return requestQwenJsOmniInputAudio;
  }
  if (entry.family === "text") {
    return function invokeText(input, prompt, options) {
      return requestQwenJsTextCompareJson(
        input,
        prompt,
        Object.assign({}, options || {}, {
          heardText: options?.heardText || input?.heardText,
        })
      );
    };
  }
  return null;
}

function resolveQwenPythonInvoker(entry) {
  if (entry.family === "omni") {
    return requestQwenPythonOmniInputAudio;
  }
  if (entry.family === "text") {
    return function invokeText(input, prompt, options) {
      return requestQwenPythonTextCompareJson(
        input,
        prompt,
        Object.assign({}, options || {}, {
          heardText: options?.heardText || input?.heardText,
        })
      );
    };
  }
  return null;
}

function resolveRuntimeInvoker(entry, runtime) {
  if (!entry) {
    return null;
  }
  if (entry.family === "asr") {
    if (runtime === "js") {
      return requestFunAsrRecognitionRest;
    }
    if (runtime === "python") {
      return requestFunAsrRecognitionPython;
    }
    return null;
  }
  if (runtime === "js") {
    return resolveQwenJsInvoker(entry);
  }
  if (runtime === "python") {
    return resolveQwenPythonInvoker(entry);
  }
  return null;
}

function buildUnavailableRuntimeError(modelId) {
  const error = new Error("该模型当前无可用运行时。");
  error.code = "model-runtime-unavailable";
  error.statusCode = 503;
  error.modelId = String(modelId || "");
  return error;
}

function invokeModel(modelId, normalizedInput, options) {
  const entry = getCatalogModelMeta(modelId);
  if (!entry) {
    const error = new Error("不支持的模型：" + String(modelId || ""));
    error.code = "invalid-model";
    error.statusCode = 400;
    throw error;
  }
  const runtimeAvailability = getRuntimeAvailability(entry);
  const runtimeOrder = Array.isArray(entry.runtimeOrder) ? entry.runtimeOrder.slice() : ["js"];
  const prompt = options?.prompt || {};
  for (const runtime of runtimeOrder) {
    if (runtimeAvailability[runtime] !== true) {
      continue;
    }
    const invoker = resolveRuntimeInvoker(entry, runtime);
    if (typeof invoker !== "function") {
      continue;
    }
    return invoker(
      normalizedInput,
      prompt,
      Object.assign({}, options || {}, {
        model: entry.id,
      })
    );
  }
  throw buildUnavailableRuntimeError(modelId);
}

module.exports = {
  getModelDocs,
  getModelMeta,
  invokeModel,
  listModelsByFamily,
};

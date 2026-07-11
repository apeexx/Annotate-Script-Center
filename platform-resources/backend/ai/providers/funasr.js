"use strict";

const {
  DEFAULT_FUN_ASR_MODEL,
  getFunAsrProviderFallbackMode,
  getFunAsrProviderMode,
  getFunAsrPythonConfig,
  getFunAsrRestConfig,
} = require("../config");
const {
  getFunAsrClientConfig: getFunAsrPythonClientConfig,
  requestFunAsrRecognitionPython,
} = require("./funasr-python");
const {
  requestFunAsrRecognitionRest,
} = require("./funasr-rest");

function extractApiHost(apiBase) {
  try {
    return new URL(String(apiBase || "")).host || "";
  } catch (error) {
    return "";
  }
}

function getFunAsrClientConfig() {
  const providerMode = getFunAsrProviderMode();
  const fallbackMode = getFunAsrProviderFallbackMode();
  const restConfig = getFunAsrRestConfig();
  const pythonConfig = getFunAsrPythonClientConfig();
  return {
    providerMode,
    fallbackMode,
    model: String(restConfig.model || pythonConfig.model || DEFAULT_FUN_ASR_MODEL).trim() || DEFAULT_FUN_ASR_MODEL,
    timeoutMs: Number(restConfig.timeoutMs || pythonConfig.timeoutMs || 0) || 60000,
    mockEnabled: restConfig.mockEnabled === true || pythonConfig.mockEnabled === true,
    hasApiKey: restConfig.hasApiKey === true || pythonConfig.hasApiKey === true,
    languageHints: Array.isArray(restConfig.languageHints) ? restConfig.languageHints.slice() : [],
    funAsrRestConfigured: restConfig.hasApiKey === true || restConfig.mockEnabled === true,
    funAsrPythonConfigured: pythonConfig.pythonExists === true,
    funAsrApiBase: String(restConfig.apiBase || "").trim(),
    funAsrApiHost: extractApiHost(restConfig.apiBase),
    pollIntervalMs: Number(restConfig.pollIntervalMs || 0) || 1000,
    pythonBin: String(pythonConfig.pythonBin || "").trim(),
    pythonSource: String(pythonConfig.pythonSource || "").trim(),
    pythonExists: pythonConfig.pythonExists === true,
    pythonScriptPath: String(pythonConfig.pythonScriptPath || "").trim(),
  };
}

async function requestFunAsrRecognition(input, options) {
  const config = getFunAsrClientConfig();
  const requestOptions = Object.assign({}, options || {});
  if (config.providerMode === "python") {
    const result = await requestFunAsrRecognitionPython(input, requestOptions);
    return Object.assign({}, result, {
      providerMode: "python",
      providerFallbackUsed: false,
    });
  }
  try {
    const result = await requestFunAsrRecognitionRest(input, requestOptions);
    return Object.assign({}, result, {
      providerMode: "rest",
      providerFallbackUsed: false,
    });
  } catch (error) {
    if (config.fallbackMode !== "python") {
      throw error;
    }
    console.warn("[FunASR] provider fallback", {
      from: "rest",
      to: "python",
      code: String(error?.code || ""),
      statusCode: Number(error?.statusCode || 0) || undefined,
    });
    const result = await requestFunAsrRecognitionPython(input, requestOptions);
    return Object.assign({}, result, {
      providerMode: "python",
      providerFallbackUsed: true,
    });
  }
}

module.exports = {
  DEFAULT_FUN_ASR_MODEL,
  getFunAsrClientConfig,
  requestFunAsrRecognition,
  requestFunAsrRecognitionPython,
  requestFunAsrRecognitionRest,
};

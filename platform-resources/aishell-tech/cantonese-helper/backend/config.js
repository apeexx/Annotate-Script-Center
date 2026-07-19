"use strict";

const {
  DEFAULT_BASE_URL,
  DEFAULT_REQUEST_PARAMS,
} = require("../../../backend/ai/config");

const DEFAULT_OMNI_MODEL = "qwen3.5-omni-flash";
const DEFAULT_TIMEOUT_MS = 60000;

function normalizeText(value) {
  return String(value || "").trim();
}

function trimSlash(value) {
  return normalizeText(value).replace(/\/+$/, "");
}

function readFirstEnv(keys, fallback) {
  for (let index = 0; index < keys.length; index += 1) {
    const value = normalizeText(process.env[keys[index]]);
    if (value) {
      return value;
    }
  }
  return normalizeText(fallback);
}

function getCantoneseProviderConfig() {
  return {
    apiKey: readFirstEnv(
      [
        "AISHELL_CANTONESE_AI_API_KEY",
        "AISHELL_AI_API_KEY",
        "DASHSCOPE_API_KEY",
        "DATABAKER_AI_API_KEY",
      ],
      ""
    ),
    baseUrl: trimSlash(
      readFirstEnv(
        [
          "AISHELL_CANTONESE_AI_BASE_URL",
          "AISHELL_AI_BASE_URL",
          "DASHSCOPE_BASE_URL",
          "DATABAKER_AI_BASE_URL",
        ],
        DEFAULT_BASE_URL
      )
    ),
    omniModel: DEFAULT_OMNI_MODEL,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };
}

module.exports = {
  DEFAULT_OMNI_MODEL,
  DEFAULT_REQUEST_PARAMS,
  DEFAULT_TIMEOUT_MS,
  getCantoneseProviderConfig,
};

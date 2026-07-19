"use strict";

const DEFAULT_TIMEOUT_MS = 60000;
const DEFAULT_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

function parseInteger(value, fallback, min, max) {
  const numericValue = Math.floor(Number(value));
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, numericValue));
}

function readEnv(keys, fallback) {
  for (const key of keys) {
    if (process.env[key] !== undefined && String(process.env[key]).trim() !== "") {
      return process.env[key];
    }
  }
  return fallback;
}

function parseTimeoutMs() {
  return parseInteger(
    readEnv(
      ["AISHELL_CANTONESE_AI_TIMEOUT_MS", "AISHELL_AI_TIMEOUT_MS", "DATABAKER_AI_TIMEOUT_MS"],
      DEFAULT_TIMEOUT_MS
    ),
    DEFAULT_TIMEOUT_MS,
    1000,
    DEFAULT_TIMEOUT_MS
  );
}

function parseCacheTtlMs() {
  return parseInteger(
    readEnv(
      ["AISHELL_CANTONESE_AI_CACHE_TTL_MS", "AISHELL_AI_CACHE_TTL_MS", "DATABAKER_AI_CACHE_TTL_MS"],
      DEFAULT_CACHE_TTL_MS
    ),
    DEFAULT_CACHE_TTL_MS,
    1000,
    7 * 24 * 60 * 60 * 1000
  );
}

module.exports = {
  DEFAULT_CACHE_TTL_MS,
  DEFAULT_TIMEOUT_MS,
  parseCacheTtlMs,
  parseTimeoutMs,
};

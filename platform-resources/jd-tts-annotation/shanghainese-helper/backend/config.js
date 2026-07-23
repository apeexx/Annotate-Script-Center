"use strict";

const DEFAULT_TIMEOUT_MS = 60000;
const DEFAULT_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const DEFAULT_CACHE_MAX_ENTRIES = 100;

function parseInteger(value, fallback, min, max) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function parseTimeoutMs() {
  return parseInteger(process.env.JD_TTS_SHANGHAINESE_AI_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 1000, DEFAULT_TIMEOUT_MS);
}

function parseCacheTtlMs() {
  return parseInteger(process.env.JD_TTS_SHANGHAINESE_AI_CACHE_TTL_MS, DEFAULT_CACHE_TTL_MS, 1000, 7 * 24 * 60 * 60 * 1000);
}

function parseCacheMaxEntries() {
  return parseInteger(process.env.JD_TTS_SHANGHAINESE_AI_CACHE_MAX_ENTRIES, DEFAULT_CACHE_MAX_ENTRIES, 1, 1000);
}

module.exports = { DEFAULT_TIMEOUT_MS, DEFAULT_CACHE_TTL_MS, DEFAULT_CACHE_MAX_ENTRIES, parseTimeoutMs, parseCacheTtlMs, parseCacheMaxEntries };

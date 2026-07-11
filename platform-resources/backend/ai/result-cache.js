"use strict";

const crypto = require("crypto");

const DEFAULT_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const cacheStore = new Map();
const cacheStats = {
  hitCount: 0,
  missCount: 0,
  setCount: 0,
  expiredCount: 0,
};

function getCacheTtlMs() {
  const numericValue = Number(process.env.DATABAKER_AI_CACHE_TTL_MS || DEFAULT_CACHE_TTL_MS);
  if (!Number.isFinite(numericValue)) {
    return DEFAULT_CACHE_TTL_MS;
  }
  return Math.max(1000, Math.min(7 * 24 * 60 * 60 * 1000, Math.floor(numericValue)));
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return "[" + value.map(stableStringify).join(",") + "]";
  }
  if (value && typeof value === "object") {
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map(function (key) {
          return JSON.stringify(key) + ":" + stableStringify(value[key]);
        })
        .join(",") +
      "}"
    );
  }
  return JSON.stringify(value === undefined ? null : value);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value === undefined ? null : value));
}

function buildCacheKey(value) {
  return crypto.createHash("sha256").update(stableStringify(value)).digest("hex");
}

function buildRecommendCacheKey(parts) {
  return buildCacheKey({
    audioUrl: String(parts?.audioUrl || ""),
    effectiveStartTime: parts?.effectiveStartTime ?? null,
    effectiveEndTime: parts?.effectiveEndTime ?? null,
    pipelineMode: String(parts?.pipelineMode || ""),
    listenModel: String(parts?.listenModel || ""),
    compareModel: String(parts?.compareModel || ""),
    ruleVersion: String(parts?.ruleVersion || ""),
    listenPrompt: String(parts?.listenPrompt || ""),
    comparePrompt: String(parts?.comparePrompt || ""),
  });
}

function purgeExpiredEntries() {
  const now = Date.now();
  Array.from(cacheStore.entries()).forEach(function ([key, entry]) {
    if (!entry || Number(entry.expiresAt) <= now) {
      cacheStore.delete(key);
      cacheStats.expiredCount += 1;
    }
  });
}

function getCachedResult(cacheKey) {
  purgeExpiredEntries();
  const entry = cacheStore.get(String(cacheKey || ""));
  if (!entry) {
    cacheStats.missCount += 1;
    return null;
  }
  cacheStats.hitCount += 1;
  return cloneJson(entry.value);
}

function setCachedResult(cacheKey, value) {
  const ttlMs = getCacheTtlMs();
  cacheStore.set(String(cacheKey || ""), {
    expiresAt: Date.now() + ttlMs,
    value: cloneJson(value),
  });
  cacheStats.setCount += 1;
  return ttlMs;
}

function getCacheSnapshot() {
  purgeExpiredEntries();
  return {
    ttlMs: getCacheTtlMs(),
    size: cacheStore.size,
    stats: Object.assign({}, cacheStats),
  };
}

module.exports = {
  buildCacheKey,
  buildRecommendCacheKey,
  getCacheSnapshot,
  getCachedRecommendResult: getCachedResult,
  getCachedResult,
  getCacheTtlMs,
  setCachedRecommendResult: setCachedResult,
  setCachedResult,
};

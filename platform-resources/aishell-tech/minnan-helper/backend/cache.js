"use strict";

const crypto = require("crypto");

const { parseCacheTtlMs } = require("./config");

const cacheStore = new Map();
const cacheStats = {
  hitCount: 0,
  missCount: 0,
  setCount: 0,
  expiredCount: 0,
};

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

function purgeExpiredEntries() {
  const now = Date.now();
  Array.from(cacheStore.entries()).forEach(function ([key, entry]) {
    if (!entry || Number(entry.expiresAt) <= now) {
      cacheStore.delete(key);
      cacheStats.expiredCount += 1;
    }
  });
}

function buildCacheKey(value) {
  return crypto.createHash("sha256").update(stableStringify(value)).digest("hex");
}

function buildRecommendCacheKey(parts) {
  return buildCacheKey({
    taskItemId: String(parts?.taskItemId || ""),
    audioUrl: String(parts?.audioUrl || ""),
    referenceText: String(parts?.referenceText || ""),
    modelMode: String(parts?.modelMode || ""),
    recognitionStrategy: String(parts?.recognitionStrategy || ""),
    pipelineMode: String(parts?.pipelineMode || ""),
    compareFamily: String(parts?.compareFamily || ""),
    convertModel: String(parts?.convertModel || parts?.candidateModel || ""),
    listenModel: String(parts?.listenModel || ""),
    compareModel: String(parts?.compareModel || ""),
    singleModel: String(parts?.singleModel || ""),
    convertPrompt: String(parts?.convertPrompt || parts?.candidatePrompt || ""),
    listenPrompt: String(parts?.listenPrompt || ""),
    comparePrompt: String(parts?.comparePrompt || ""),
    audioFirstReferenceCorrectionThreshold: String(
      parts?.audioFirstReferenceCorrectionThreshold || ""
    ),
  });
}

function getCachedRecommendResult(cacheKey) {
  purgeExpiredEntries();
  const entry = cacheStore.get(String(cacheKey || ""));
  if (!entry) {
    cacheStats.missCount += 1;
    return null;
  }
  cacheStats.hitCount += 1;
  return cloneJson(entry.value);
}

function setCachedRecommendResult(cacheKey, value) {
  const ttlMs = parseCacheTtlMs();
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
    ttlMs: parseCacheTtlMs(),
    size: cacheStore.size,
    stats: Object.assign({}, cacheStats),
  };
}

module.exports = {
  buildRecommendCacheKey,
  getCacheSnapshot,
  getCachedRecommendResult,
  setCachedRecommendResult,
};

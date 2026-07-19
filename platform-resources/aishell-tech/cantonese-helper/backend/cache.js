"use strict";

const crypto = require("crypto");
const { parseCacheTtlMs } = require("./config");

const cacheStore = new Map();

function stableStringify(value) {
  if (Array.isArray(value)) {
    return "[" + value.map(stableStringify).join(",") + "]";
  }
  if (value && typeof value === "object") {
    return "{" + Object.keys(value).sort().map(function (key) {
      return JSON.stringify(key) + ":" + stableStringify(value[key]);
    }).join(",") + "}";
  }
  return JSON.stringify(value === undefined ? null : value);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildRecommendCacheKey(parts) {
  return crypto.createHash("sha256").update(stableStringify({
    taskItemId: String(parts?.taskItemId || ""),
    audioUrl: String(parts?.audioUrl || ""),
    referenceText: String(parts?.referenceText || ""),
    pipelineMode: String(parts?.pipelineMode || ""),
    omniModel: String(parts?.aiOmni?.model || ""),
    omniPrompt: String(parts?.aiOmni?.prompt || ""),
    omniParams: parts?.aiOmni?.params || {},
  })).digest("hex");
}

function getCachedRecommendResult(key) {
  const entry = cacheStore.get(String(key || ""));
  if (!entry || entry.expiresAt <= Date.now()) {
    if (entry) {
      cacheStore.delete(String(key || ""));
    }
    return null;
  }
  return cloneJson(entry.value);
}

function setCachedRecommendResult(key, value) {
  cacheStore.set(String(key || ""), {
    expiresAt: Date.now() + parseCacheTtlMs(),
    value: cloneJson(value),
  });
}

module.exports = {
  buildRecommendCacheKey,
  getCachedRecommendResult,
  setCachedRecommendResult,
};

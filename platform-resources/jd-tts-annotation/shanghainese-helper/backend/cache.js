"use strict";

const crypto = require("crypto");
const { parseCacheTtlMs, parseCacheMaxEntries } = require("./config");

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

function buildRecommendCacheKey(request) {
  return crypto.createHash("sha256").update(stableStringify({
    utteranceId: String(request?.utteranceId || ""),
    checksum: String(request?.checksum || ""),
    audioDigest: crypto.createHash("sha256").update(String(request?.audioDataUrl || ""), "utf8").digest("hex"),
    pipelineMode: String(request?.pipelineMode || ""),
    model: String(request?.aiOmni?.model || ""),
    prompt: String(request?.aiOmni?.prompt || ""),
    params: request?.aiOmni?.params || {},
  })).digest("hex");
}

function createRecommendCache(options) {
  const source = options && typeof options === "object" ? options : {};
  const store = new Map();
  const now = typeof source.now === "function" ? source.now : Date.now;
  const ttlMs = Number(source.ttlMs) > 0 ? Number(source.ttlMs) : parseCacheTtlMs();
  const maxEntries = Number(source.maxEntries) > 0 ? Math.floor(Number(source.maxEntries)) : parseCacheMaxEntries();

  function clearExpired() {
    const currentTime = now();
    store.forEach(function (entry, key) {
      if (!entry || entry.expiresAt <= currentTime) {
        store.delete(key);
      }
    });
  }

  function get(key) {
    clearExpired();
    const entry = store.get(String(key || ""));
    return entry ? cloneJson(entry.value) : null;
  }

  function set(key, value) {
    clearExpired();
    const normalizedKey = String(key || "");
    store.delete(normalizedKey);
    store.set(normalizedKey, { expiresAt: now() + ttlMs, value: cloneJson(value) });
    while (store.size > maxEntries) {
      store.delete(store.keys().next().value);
    }
  }

  return { get, set, clearExpired, size: function () { clearExpired(); return store.size; } };
}

const defaultRecommendCache = createRecommendCache();

function getCachedRecommendResult(key) {
  return defaultRecommendCache.get(key);
}

function setCachedRecommendResult(key, value) {
  defaultRecommendCache.set(key, value);
}

module.exports = { buildRecommendCacheKey, createRecommendCache, getCachedRecommendResult, setCachedRecommendResult };

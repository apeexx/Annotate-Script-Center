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

function hashCroppedAudio(value) {
  return crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

function buildRecommendCacheKey(parts) {
  const taskId = String(parts?.taskId || "").trim();
  const packageId = String(parts?.packageId || "").trim();
  if (!taskId || !packageId) {
    return "";
  }
  return crypto.createHash("sha256").update(stableStringify({
    taskId,
    packageId,
    taskItemId: String(parts?.taskItemId || ""),
    regionId: String(parts?.regionId || ""),
    segmentNumber: Number(parts?.segmentNumber || 0) || 0,
    startMs: Number(parts?.startMs || 0) || 0,
    endMs: Number(parts?.endMs || 0) || 0,
    durationMs: Number(parts?.durationMs || 0) || 0,
    selectionKey: String(parts?.selectionKey || ""),
    croppedAudioDigest: hashCroppedAudio(parts?.audioDataUrl),
    pipelineMode: String(parts?.pipelineMode || ""),
    omniModel: String(parts?.aiOmni?.model || ""),
    omniPrompt: String(parts?.aiOmni?.prompt || ""),
    omniParams: parts?.aiOmni?.params || {},
  })).digest("hex");
}

function getCachedRecommendResult(key) {
  const cacheKey = String(key || "");
  if (!cacheKey) {
    return null;
  }
  const entry = cacheStore.get(cacheKey);
  if (!entry || entry.expiresAt <= Date.now()) {
    if (entry) {
      cacheStore.delete(cacheKey);
    }
    return null;
  }
  return cloneJson(entry.value);
}

function setCachedRecommendResult(key, value) {
  const cacheKey = String(key || "");
  if (!cacheKey) {
    return;
  }
  cacheStore.set(cacheKey, {
    expiresAt: Date.now() + parseCacheTtlMs(),
    value: cloneJson(value),
  });
}

module.exports = {
  buildRecommendCacheKey,
  getCachedRecommendResult,
  hashCroppedAudio,
  setCachedRecommendResult,
};

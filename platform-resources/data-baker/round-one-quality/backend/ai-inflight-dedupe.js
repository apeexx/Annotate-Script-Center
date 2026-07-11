"use strict";

const crypto = require("crypto");

const DEFAULT_TTL_MS = 300000;
const DEFAULT_MAX_SIZE = 1000;
const RECENT_REUSE_MS = 30000;

const inflightEntries = new Map();
const stats = {
  joinedCount: 0,
  completedCount: 0,
  failedCount: 0,
};

function parsePositiveInteger(value, fallback, min, max) {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, number));
}

function getDedupeConfig() {
  return {
    ttlMs: parsePositiveInteger(
      process.env.DATABAKER_AI_INFLIGHT_DEDUPE_TTL_MS,
      DEFAULT_TTL_MS,
      1000,
      24 * 60 * 60 * 1000
    ),
    maxSize: parsePositiveInteger(
      process.env.DATABAKER_AI_INFLIGHT_DEDUPE_MAX_SIZE,
      DEFAULT_MAX_SIZE,
      1,
      10000
    ),
  };
}

function cleanupExpiredEntries(now) {
  const currentTime = Number(now) || Date.now();
  inflightEntries.forEach(function (entry, key) {
    if (!entry || Number(entry.expiresAt) <= currentTime) {
      inflightEntries.delete(key);
    }
  });
}

function trimMapSize(maxSize) {
  if (inflightEntries.size < maxSize) {
    return;
  }
  const sortedEntries = Array.from(inflightEntries.entries()).sort(function (a, b) {
    return (Number(a[1]?.lastAccessAt) || 0) - (Number(b[1]?.lastAccessAt) || 0);
  });
  while (inflightEntries.size >= maxSize && sortedEntries.length > 0) {
    const next = sortedEntries.shift();
    if (!next) {
      break;
    }
    inflightEntries.delete(next[0]);
  }
}

function normalizeKeyText(value, maxLength) {
  return String(value || "").replace(/[\r\n]+/g, " ").trim().slice(0, maxLength);
}

function shouldEnableInFlightDedupe(meta) {
  const source = meta && typeof meta === "object" ? meta : {};
  return Boolean(
    normalizeKeyText(source.batchRunId, 120) && normalizeKeyText(source.batchProcessKey, 160)
  );
}

function buildInFlightDedupeKey(meta) {
  const source = meta && typeof meta === "object" ? meta : {};
  const batchRunId = normalizeKeyText(source.batchRunId, 120);
  const batchProcessKey = normalizeKeyText(source.batchProcessKey, 160);
  if (!batchRunId || !batchProcessKey) {
    return {
      enabled: false,
      key: "",
      keyShort: "",
    };
  }
  const recognitionMode = normalizeKeyText(source.recognitionMode, 60);
  const listenModel = normalizeKeyText(source.listenModel, 80);
  const compareModel = normalizeKeyText(source.compareModel, 80);
  const singleModel = normalizeKeyText(source.singleModel, 80);
  const rawKey = [
    batchRunId,
    batchProcessKey,
    recognitionMode,
    listenModel,
    compareModel,
    singleModel,
  ].join("|");
  const key = crypto.createHash("sha256").update(rawKey).digest("hex");
  return {
    enabled: true,
    key,
    keyShort: key.slice(0, 12),
    batchRunId,
    batchProcessKey,
  };
}

function getInFlightDedupeHealth() {
  cleanupExpiredEntries(Date.now());
  let activeCount = 0;
  inflightEntries.forEach(function (entry) {
    if (entry?.state === "running") {
      activeCount += 1;
    }
  });
  const config = getDedupeConfig();
  return {
    activeCount,
    joinedCount: stats.joinedCount,
    completedCount: stats.completedCount,
    failedCount: stats.failedCount,
    maxSize: config.maxSize,
    ttlMs: config.ttlMs,
  };
}

function runWithInFlightDedupe(meta, factory) {
  const keyInfo = buildInFlightDedupeKey(meta);
  if (!keyInfo.enabled) {
    return Promise.resolve()
      .then(factory)
      .then(function (value) {
        return {
          value,
          dedupeEnabled: false,
          joined: false,
          joinedInflight: false,
          dedupeKeyShort: "",
        };
      });
  }

  const config = getDedupeConfig();
  const now = Date.now();
  cleanupExpiredEntries(now);
  const existing = inflightEntries.get(keyInfo.key);
  if (existing && Number(existing.expiresAt) > now) {
    stats.joinedCount += 1;
    existing.lastAccessAt = now;
    return existing.promise.then(function (value) {
      return {
        value,
        dedupeEnabled: true,
        joined: true,
        joinedInflight: existing.state === "running",
        dedupeKeyShort: keyInfo.keyShort,
      };
    });
  }

  trimMapSize(config.maxSize);
  let entry = null;
  const promise = Promise.resolve()
    .then(factory)
    .then(function (value) {
      stats.completedCount += 1;
      entry.state = "succeeded";
      entry.lastAccessAt = Date.now();
      entry.expiresAt = entry.lastAccessAt + Math.min(RECENT_REUSE_MS, config.ttlMs);
      return value;
    })
    .catch(function (error) {
      stats.failedCount += 1;
      entry.state = "failed";
      entry.lastAccessAt = Date.now();
      entry.expiresAt = entry.lastAccessAt + Math.min(RECENT_REUSE_MS, config.ttlMs);
      throw error;
    });
  entry = {
    key: keyInfo.key,
    keyShort: keyInfo.keyShort,
    batchRunId: keyInfo.batchRunId,
    batchProcessKey: keyInfo.batchProcessKey,
    state: "running",
    createdAt: now,
    lastAccessAt: now,
    expiresAt: now + config.ttlMs,
    promise,
  };
  inflightEntries.set(keyInfo.key, entry);
  return promise.then(function (value) {
    return {
      value,
      dedupeEnabled: true,
      joined: false,
      joinedInflight: false,
      dedupeKeyShort: keyInfo.keyShort,
    };
  });
}

module.exports = {
  buildInFlightDedupeKey,
  getInFlightDedupeHealth,
  runWithInFlightDedupe,
  shouldEnableInFlightDedupe,
};

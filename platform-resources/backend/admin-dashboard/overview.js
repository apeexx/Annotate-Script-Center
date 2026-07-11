"use strict";

const { ADMIN_SESSION_TTL_SECONDS, getAdminAuthConfig, isAdminAuthConfigured } = require("../admin-auth");
const { buildAsyncJobRuntimeMeta } = require("../ai-framework/runtime/ai-runtime-meta");
const { listAiCallLogDatasets } = require("../ai-call-log-download/routes");
const { listProjectDataDownloadDatasets } = require("../project-data-download/routes");
const { summarizeRuntimeLogs } = require("../runtime-log-store");

const FALLBACK_SCRIPT_DOWNLOAD_CENTER_URL = "https://script.xiangtianzhen.store/downloads/";

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeBaseUrl(value) {
  const text = normalizeText(value);
  if (!text) {
    return "";
  }
  return text.endsWith("/") ? text : `${text}/`;
}

function resolveScriptDownloadCenterUrl(options) {
  const config = options && typeof options === "object" ? options : {};
  return (
    normalizeBaseUrl(config.scriptCenterUrl) ||
    normalizeBaseUrl(process.env.ASC_DOWNLOAD_BASE_URL) ||
    FALLBACK_SCRIPT_DOWNLOAD_CENTER_URL
  );
}

function toPoolDisplayName(groupName) {
  const text = normalizeText(groupName);
  return text.indexOf("model:") === 0 ? text.slice("model:".length) : text;
}

function normalizeRuntime(runtime) {
  const source = runtime && typeof runtime === "object" ? runtime : {};
  const jobs = source.jobs && typeof source.jobs === "object" ? source.jobs : {};
  const queue = source.queue && typeof source.queue === "object" ? source.queue : {};
  const activePools = Array.isArray(queue.activePools) ? queue.activePools : [];
  const pendingCount = Number(jobs.pendingCount || 0) || 0;
  const runningCount = Number(jobs.runningCount || 0) || 0;
  const succeededCount = Number(jobs.succeededCount || 0) || 0;
  const failedCount = Number(jobs.failedCount || 0) || 0;
  const usedCount =
    Number(jobs.usedCount || pendingCount + runningCount + succeededCount + failedCount) || 0;
  const capacity =
    Number(jobs.capacity || jobs.maxSize || 0) || 0;
  const availableCount = Math.max(
    0,
    Number(jobs.availableCount || capacity - usedCount) || 0
  );
  return {
    jobs: Object.assign({}, jobs, {
      pendingCount,
      runningCount,
      succeededCount,
      failedCount,
      expiredCount: Math.max(0, Number(jobs.expiredCount || 0) || 0),
      activeCount: Number(jobs.activeCount || pendingCount + runningCount) || 0,
      usedCount,
      capacity,
      availableCount,
      isFull: jobs.isFull === true || (capacity > 0 && usedCount >= capacity),
      utilizationPercent:
        capacity > 0
          ? Math.round((usedCount / capacity) * 100)
          : 0,
    }),
    queue: {
      keyStrategy: normalizeText(queue.keyStrategy) || "concrete-model-name",
      defaultModelPool:
        queue.defaultModelPool && typeof queue.defaultModelPool === "object"
          ? queue.defaultModelPool
          : {},
      activePools: activePools
        .map(function mapPool(pool) {
          const activeCount = Number(pool.activeCount || 0) || 0;
          const pendingCount = Number(pool.pendingCount || 0) || 0;
          const capacity = Number(pool.totalCapacity || pool.maxConcurrent || 0) || 0;
          const usedCount = Number(pool.usedCount || activeCount + pendingCount) || 0;
          const availableCount = Math.max(
            0,
            Number(pool.availableCount || capacity - usedCount) || 0
          );
          return Object.assign({}, pool, {
            displayName: toPoolDisplayName(pool.groupName),
            capacity,
            usedCount,
            availableCount,
            isFull: pool.isFull === true || (capacity > 0 && usedCount >= capacity),
            utilizationPercent:
              capacity > 0
                ? Math.round((usedCount / capacity) * 100)
                : 0,
          });
        })
        .sort(function sortPools(left, right) {
          if (Number(left.usedCount || 0) !== Number(right.usedCount || 0)) {
            return Number(right.usedCount || 0) - Number(left.usedCount || 0);
          }
          if (Number(left.activeCount || 0) !== Number(right.activeCount || 0)) {
            return Number(right.activeCount || 0) - Number(left.activeCount || 0);
          }
          return String(left.displayName || "").localeCompare(String(right.displayName || ""));
        }),
    },
  };
}

function normalizeLogsSummary(input) {
  const source = input && typeof input === "object" ? input : {};
  const recent24Hours =
    source.recent24Hours && typeof source.recent24Hours === "object"
      ? source.recent24Hours
      : {};
  const latestFailure =
    source.latestFailure && typeof source.latestFailure === "object"
      ? source.latestFailure
      : null;
  return {
    retentionDays: Math.max(1, Number(source.retentionDays || 7) || 7),
    recent24Hours: {
      successCount: Math.max(0, Number(recent24Hours.successCount || 0) || 0),
      warnCount: Math.max(0, Number(recent24Hours.warnCount || 0) || 0),
      errorCount: Math.max(0, Number(recent24Hours.errorCount || 0) || 0),
    },
    latestFailure: latestFailure
      ? {
          createdAt: normalizeText(latestFailure.createdAt),
          level: normalizeText(latestFailure.level) || "error",
          scope: normalizeText(latestFailure.scope) || "backend",
          message: normalizeText(latestFailure.message) || "最近失败事件",
          requestId: normalizeText(latestFailure.requestId),
        }
      : null,
  };
}

function buildAdminDashboardOverview(input) {
  const source = input && typeof input === "object" ? input : {};
  const sourceDownloads =
    source.downloads && typeof source.downloads === "object" ? source.downloads : {};
  return {
    success: true,
    data: {
      generatedAt: normalizeText(source.now) || new Date().toISOString(),
      backend: {
        service: "platform-resources-backend",
        status: source.adminAuthConfigured === false ? "auth-not-configured" : "ready",
        adminAuthConfigured: source.adminAuthConfigured !== false,
        sessionTtlSeconds:
          Number.isFinite(Number(source.sessionTtlSeconds)) && Number(source.sessionTtlSeconds) > 0
            ? Math.floor(Number(source.sessionTtlSeconds))
            : ADMIN_SESSION_TTL_SECONDS,
      },
      runtime: normalizeRuntime(source.runtime),
      downloads: Object.assign(
        {
          projectDataDatasets: [],
          aiCallLogDatasets: [],
        },
        sourceDownloads,
        {
          scriptCenterUrl:
            normalizeBaseUrl(sourceDownloads.scriptCenterUrl) || FALLBACK_SCRIPT_DOWNLOAD_CENTER_URL,
        }
      ),
      logsSummary: normalizeLogsSummary(source.logsSummary),
    },
  };
}

function createLiveAdminDashboardOverview(options) {
  const config = options && typeof options === "object" ? options : {};
  const scriptCenterUrl = resolveScriptDownloadCenterUrl(config);
  return buildAdminDashboardOverview({
    now: new Date().toISOString(),
    adminAuthConfigured: isAdminAuthConfigured(getAdminAuthConfig()),
    sessionTtlSeconds: ADMIN_SESSION_TTL_SECONDS,
    runtime: buildAsyncJobRuntimeMeta({
      includeQueueSnapshots: true,
    }),
    downloads: {
      scriptCenterUrl,
      projectDataDatasets: listProjectDataDownloadDatasets(config.projectDataDownload || {}),
      aiCallLogDatasets: listAiCallLogDatasets(config.aiCallLogDownload || {}),
    },
    logsSummary: summarizeRuntimeLogs(),
  });
}

module.exports = {
  buildAdminDashboardOverview,
  createLiveAdminDashboardOverview,
  resolveScriptDownloadCenterUrl,
};

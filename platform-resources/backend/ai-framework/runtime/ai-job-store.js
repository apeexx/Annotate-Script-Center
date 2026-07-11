"use strict";

const crypto = require("crypto");

const { createJobTimeoutError } = require("../../ai/errors");

const DEFAULT_JOB_TIMEOUT_MS = 60000;
const DEFAULT_JOB_TTL_MS = 30 * 60 * 1000;
const DEFAULT_JOB_MAX_SIZE = 600;
const DEFAULT_JOB_POLL_INTERVAL_MS = 1000;

function parseIntegerInRange(value, fallback, min, max) {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, number));
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeInteger(value) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) ? number : 0;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value === undefined ? null : value));
}

function createStoreFullError() {
  const error = new Error("后端 AI 任务队列已满，请稍后重试。");
  error.code = "ai-job-store-full";
  error.statusCode = 503;
  return error;
}

function createJobNotFoundError() {
  const error = new Error("后端任务不存在或已过期，请重试。");
  error.code = "ai-job-not-found";
  error.statusCode = 404;
  return error;
}

function createJobDebugNotFoundError() {
  const error = new Error("当前任务没有可复制的原始 JSON 调试信息。");
  error.code = "ai-job-debug-not-found";
  error.statusCode = 404;
  return error;
}

function createJobsDisabledError() {
  const error = new Error("当前后端未启用 AI 异步任务接口。");
  error.code = "ai-jobs-disabled";
  error.statusCode = 503;
  return error;
}

function createExpiredJob(job) {
  const source = job && typeof job === "object" ? job : {};
  return Object.assign({}, source, {
    status: "expired",
    updatedAt: Number(source.updatedAt || 0),
  });
}

function isTerminalStatus(status) {
  return status === "succeeded" || status === "failed" || status === "expired";
}

function getJobSortTimestamp(job) {
  return (
    Number(job?.updatedAt || 0) ||
    Number(job?.finishedAt || 0) ||
    Number(job?.createdAt || 0) ||
    0
  );
}

function getDefaultAiJobStoreConfig() {
  return {
    enabled: String(process.env.ASC_AI_ASYNC_JOBS_ENABLED || "1").trim() !== "0",
    ttlMs: parseIntegerInRange(
      process.env.ASC_AI_JOB_TTL_MS || process.env.DATABAKER_AI_JOB_TTL_MS,
      DEFAULT_JOB_TTL_MS,
      10000,
      24 * 60 * 60 * 1000
    ),
    timeoutMs: parseIntegerInRange(
      process.env.ASC_AI_JOB_TIMEOUT_MS || process.env.DATABAKER_AI_JOB_TIMEOUT_MS,
      DEFAULT_JOB_TIMEOUT_MS,
      1000,
      300000
    ),
    maxSize: parseIntegerInRange(
      process.env.ASC_AI_JOB_MAX_SIZE || process.env.DATABAKER_AI_JOB_MAX_SIZE,
      DEFAULT_JOB_MAX_SIZE,
      1,
      10000
    ),
    pollIntervalMs: parseIntegerInRange(
      process.env.ASC_AI_JOB_POLL_INTERVAL_MS || process.env.DATABAKER_AI_JOB_POLL_INTERVAL_MS,
      DEFAULT_JOB_POLL_INTERVAL_MS,
      200,
      10000
    ),
  };
}

class AiJobStore {
  constructor(options) {
    this.options = Object.assign({}, options || {});
    this.jobs = new Map();
    this.controls = new Map();
    this.debugByJobId = new Map();
  }

  now() {
    return typeof this.options.now === "function" ? this.options.now() : Date.now();
  }

  getConfig() {
    const defaults = getDefaultAiJobStoreConfig();
    return {
      enabled:
        typeof this.options.enabled === "boolean" ? this.options.enabled === true : defaults.enabled,
      ttlMs: parseIntegerInRange(
        this.options.ttlMs,
        defaults.ttlMs,
        1,
        24 * 60 * 60 * 1000
      ),
      timeoutMs: parseIntegerInRange(
        this.options.timeoutMs,
        defaults.timeoutMs,
        1000,
        300000
      ),
      maxSize: parseIntegerInRange(
        this.options.maxSize,
        defaults.maxSize,
        1,
        10000
      ),
      pollIntervalMs: parseIntegerInRange(
        this.options.pollIntervalMs,
        defaults.pollIntervalMs,
        200,
        10000
      ),
    };
  }

  clearControl(jobId) {
    const control = this.controls.get(jobId);
    if (!control) {
      return;
    }
    if (control.timeoutTimer) {
      clearTimeout(control.timeoutTimer);
    }
    control.timeoutTimer = null;
  }

  removeJob(jobId) {
    const normalizedJobId = normalizeText(jobId);
    if (!normalizedJobId) {
      return false;
    }
    this.clearControl(normalizedJobId);
    this.controls.delete(normalizedJobId);
    this.debugByJobId.delete(normalizedJobId);
    return this.jobs.delete(normalizedJobId);
  }

  pruneExpired(now) {
    const currentTime = Number(now) || this.now();
    const ttlMs = this.getConfig().ttlMs;
    this.jobs.forEach(
      function (job, jobId) {
        if (!job || isTerminalStatus(job.status) === false) {
          return;
        }
        if (currentTime - Number(job.updatedAt || 0) <= ttlMs) {
          return;
        }
        this.clearControl(jobId);
        this.controls.delete(jobId);
        this.debugByJobId.delete(jobId);
        this.jobs.set(jobId, createExpiredJob(job));
      }.bind(this)
    );
  }

  cleanupExpired(now) {
    const currentTime = Number(now) || this.now();
    const ttlMs = this.getConfig().ttlMs;
    this.jobs.forEach(
      function (job, jobId) {
        if (!job || !job.updatedAt) {
          return;
        }
        if (currentTime - Number(job.updatedAt || 0) <= ttlMs) {
          return;
        }
        this.clearControl(jobId);
        this.controls.delete(jobId);
        this.debugByJobId.delete(jobId);
        this.jobs.set(jobId, createExpiredJob(job));
      }.bind(this)
    );
  }

  ensureCapacity() {
    this.cleanupExpired(this.now());
    const config = this.getConfig();
    let activeSize = 0;
    this.jobs.forEach(function (job) {
      if (job?.status !== "expired") {
        activeSize += 1;
      }
    });
    if (activeSize < config.maxSize) {
      return;
    }
    const candidates = Array.from(this.jobs.values())
      .filter(function (job) {
        return job && isTerminalStatus(job.status);
      })
      .sort(function (left, right) {
        return getJobSortTimestamp(left) - getJobSortTimestamp(right);
      });
    while (activeSize >= config.maxSize && candidates.length > 0) {
      const oldest = candidates.shift();
      if (!oldest?.jobId) {
        continue;
      }
      if (this.removeJob(oldest.jobId)) {
        activeSize -= 1;
      }
    }
    if (activeSize >= config.maxSize) {
      throw createStoreFullError();
    }
  }

  handleTimeout(jobId) {
    const control = this.controls.get(jobId);
    const job = this.jobs.get(jobId);
    if (!control || !job || isTerminalStatus(job.status)) {
      return;
    }
    control.timedOut = true;
    control.timeoutTimer = null;
    if (control.controller && typeof control.controller.abort === "function") {
      try {
        control.controller.abort(createJobTimeoutError());
      } catch (_error) {
        control.controller.abort();
      }
    }
    this.updateJob(jobId, function (mutableJob) {
      if (isTerminalStatus(mutableJob.status)) {
        return { ignored: true };
      }
      mutableJob.status = "failed";
      mutableJob.finishedAt = Date.now();
      mutableJob.responseBody = null;
      mutableJob.errorBody = {
        success: false,
        code: "ai-job-timeout",
        message: "当前任务超过60s，请重新请求。",
      };
      return { ignored: false };
    });
  }

  createJob(meta) {
    const config = this.getConfig();
    if (!config.enabled) {
      throw createJobsDisabledError();
    }
    this.ensureCapacity();
    const currentTime = this.now();
    const source = meta && typeof meta === "object" ? meta : {};
    const jobId =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : crypto.randomBytes(16).toString("hex");
    const job = {
      jobId,
      requestId: normalizeText(source.requestId),
      routeKey: normalizeText(source.routeKey),
      status: "pending",
      createdAt: currentTime,
      updatedAt: currentTime,
      startedAt: 0,
      finishedAt: 0,
      itemId: normalizeText(source.itemId),
      textId: normalizeText(source.textId),
      sentenceNumber: normalizeInteger(source.sentenceNumber),
      responseBody: null,
      errorBody: null,
      hasDebugPayload: false,
    };
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const control = {
      controller,
      timeoutTimer: null,
      timedOut: false,
    };
    control.timeoutTimer = setTimeout(
      this.handleTimeout.bind(this, jobId),
      Math.max(1000, Number(config.timeoutMs) || DEFAULT_JOB_TIMEOUT_MS)
    );
    this.jobs.set(jobId, job);
    this.controls.set(jobId, control);
    return cloneJson(job);
  }

  getJob(jobId) {
    this.cleanupExpired(this.now());
    const normalizedJobId = normalizeText(jobId);
    const job = this.jobs.get(normalizedJobId);
    if (!job) {
      throw createJobNotFoundError();
    }
    return cloneJson(job);
  }

  getJobSignal(jobId) {
    const normalizedJobId = normalizeText(jobId);
    const job = this.jobs.get(normalizedJobId);
    if (!job) {
      throw createJobNotFoundError();
    }
    const control = this.controls.get(normalizedJobId);
    return control?.controller?.signal || null;
  }

  getJobDebug(jobId) {
    this.cleanupExpired(this.now());
    const normalizedJobId = normalizeText(jobId);
    const job = this.jobs.get(normalizedJobId);
    if (!job) {
      throw createJobNotFoundError();
    }
    const debug = this.debugByJobId.get(normalizedJobId);
    if (!debug) {
      throw createJobDebugNotFoundError();
    }
    return cloneJson(debug);
  }

  updateJob(jobId, updater) {
    const normalizedJobId = normalizeText(jobId);
    const job = this.jobs.get(normalizedJobId);
    if (!job) {
      throw createJobNotFoundError();
    }
    const outcome = updater(job) || {};
    job.updatedAt = this.now();
    this.jobs.set(normalizedJobId, job);
    return {
      job: cloneJson(job),
      ignored: outcome.ignored === true,
    };
  }

  saveDebug(jobId, debugPayload) {
    const normalizedJobId = normalizeText(jobId);
    if (!debugPayload || typeof debugPayload !== "object") {
      return;
    }
    this.debugByJobId.set(normalizedJobId, cloneJson(debugPayload));
    const job = this.jobs.get(normalizedJobId);
    if (job) {
      job.hasDebugPayload = true;
      job.updatedAt = this.now();
      this.jobs.set(normalizedJobId, job);
    }
  }

  markJobRunning(jobId) {
    return this.updateJob(jobId, function (job) {
      if (isTerminalStatus(job.status)) {
        return { ignored: true };
      }
      if (!job.startedAt) {
        job.startedAt = Date.now();
      }
      job.status = "running";
      return { ignored: false };
    });
  }

  markJobSucceeded(jobId, payload) {
    const source = payload && typeof payload === "object" ? payload : {};
    const outcome = this.updateJob(jobId, function (job) {
      if (isTerminalStatus(job.status)) {
        return { ignored: true };
      }
      job.status = "succeeded";
      job.finishedAt = Date.now();
      job.responseBody = source.responseBody || null;
      job.errorBody = null;
      return { ignored: false };
    });
    if (!outcome.ignored) {
      this.clearControl(jobId);
    }
    return outcome;
  }

  markJobFailed(jobId, payload) {
    const source = payload && typeof payload === "object" ? payload : {};
    if (source.debugPayload && typeof source.debugPayload === "object") {
      this.saveDebug(jobId, source.debugPayload);
    }
    const outcome = this.updateJob(jobId, function (job) {
      if (isTerminalStatus(job.status)) {
        return { ignored: true };
      }
      job.status = "failed";
      job.finishedAt = Date.now();
      job.responseBody = null;
      job.errorBody = source.errorBody || null;
      return { ignored: false };
    });
    if (!outcome.ignored) {
      this.clearControl(jobId);
    }
    return outcome;
  }

  getSnapshot() {
    this.cleanupExpired(this.now());
    const config = this.getConfig();
    let pendingCount = 0;
    let runningCount = 0;
    let succeededCount = 0;
    let failedCount = 0;
    let expiredCount = 0;
    this.jobs.forEach(function (job) {
      if (!job) {
        return;
      }
      if (job.status === "pending") {
        pendingCount += 1;
      } else if (job.status === "running") {
        runningCount += 1;
      } else if (job.status === "succeeded") {
        succeededCount += 1;
      } else if (job.status === "failed") {
        failedCount += 1;
      } else if (job.status === "expired") {
        expiredCount += 1;
      }
    });
    const usedCount = pendingCount + runningCount + succeededCount + failedCount;
    const capacity = Math.max(0, Number(config.maxSize || 0) || 0);
    const availableCount = Math.max(0, capacity - usedCount);
    return {
      enabled: config.enabled,
      ttlMs: config.ttlMs,
      timeoutMs: config.timeoutMs,
      maxSize: config.maxSize,
      pollIntervalMs: config.pollIntervalMs,
      capacity,
      pendingCount,
      runningCount,
      succeededCount,
      failedCount,
      expiredCount,
      activeCount: pendingCount + runningCount,
      usedCount,
      availableCount,
      isFull: capacity > 0 && usedCount >= capacity,
      utilizationPercent: capacity > 0 ? Math.round((usedCount / capacity) * 100) : 0,
    };
  }
}

const sharedAiJobStore = new AiJobStore();

function createAiJobStore(options) {
  return new AiJobStore(options);
}

module.exports = {
  DEFAULT_JOB_MAX_SIZE,
  DEFAULT_JOB_POLL_INTERVAL_MS,
  DEFAULT_JOB_TIMEOUT_MS,
  DEFAULT_JOB_TTL_MS,
  createAiJobStore,
  createJobDebugNotFoundError,
  createJobNotFoundError,
  createJobsDisabledError,
  createStoreFullError,
  getDefaultAiJobStoreConfig,
  sharedAiJobStore,
};

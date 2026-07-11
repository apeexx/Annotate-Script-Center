"use strict";

const {
  DEFAULT_JOB_MAX_SIZE,
  DEFAULT_JOB_POLL_INTERVAL_MS,
  DEFAULT_JOB_TIMEOUT_MS,
  DEFAULT_JOB_TTL_MS,
  createJobDebugNotFoundError,
  createJobNotFoundError,
  createJobsDisabledError,
  createStoreFullError,
  getDefaultAiJobStoreConfig,
  sharedAiJobStore,
} = require("../../../backend/ai-framework/runtime/ai-job-store");

function getAiJobStoreConfig() {
  return getDefaultAiJobStoreConfig();
}

function translateJob(jobLike) {
  const job = jobLike && typeof jobLike === "object" ? jobLike : {};
  const successBody =
    job.responseBody && typeof job.responseBody === "object" ? job.responseBody : null;
  const errorBody = job.errorBody && typeof job.errorBody === "object" ? job.errorBody : null;
  const successMeta =
    successBody?.meta && typeof successBody.meta === "object" ? successBody.meta : {};
  const errorMeta =
    errorBody?.meta && typeof errorBody.meta === "object" ? errorBody.meta : {};
  const errorDetail =
    errorBody?.error && typeof errorBody.error === "object" ? errorBody.error : errorBody || {};
  const runtime =
    successMeta.runtime && typeof successMeta.runtime === "object"
      ? successMeta.runtime
      : errorMeta.runtime && typeof errorMeta.runtime === "object"
        ? errorMeta.runtime
        : null;
  const providerStatus =
    Number(errorDetail.providerStatus || errorBody?.providerStatus || successMeta.providerStatus) || 0;

  return {
    jobId: String(job.jobId || ""),
    requestId: String(job.requestId || ""),
    status: String(job.status || "pending"),
    createdAt: Number(job.createdAt || 0),
    updatedAt: Number(job.updatedAt || 0),
    startedAt: Number(job.startedAt || 0),
    finishedAt: Number(job.finishedAt || 0),
    itemId: String(job.itemId || ""),
    textId: String(job.textId || ""),
    sentenceNumber: Number(job.sentenceNumber || successMeta.sentenceNumber || errorMeta.sentenceNumber) || 0,
    hasDebugRawJson: job.hasDebugPayload === true,
    providerStatus,
    runtime,
    result: successBody?.data || null,
    errorCode: String(errorDetail.code || errorBody?.code || "").trim(),
    errorMessage: String(errorDetail.message || errorBody?.message || "").trim(),
  };
}

function createAiRecommendJob(meta) {
  const source = meta && typeof meta === "object" ? meta : {};
  return translateJob(
    sharedAiJobStore.createJob({
      routeKey: "data-baker-round-one-quality-ai-recommend",
      requestId: source.requestId,
      itemId: source.itemId,
      textId: source.textId,
      sentenceNumber: source.sentenceNumber,
    })
  );
}

function getAiRecommendJob(jobId) {
  return translateJob(sharedAiJobStore.getJob(jobId));
}

function getAiRecommendJobSignal(jobId) {
  return sharedAiJobStore.getJobSignal(jobId);
}

function getAiRecommendJobDebug(jobId) {
  return sharedAiJobStore.getJobDebug(jobId);
}

function markAiRecommendJobRunning(jobId) {
  return sharedAiJobStore.markJobRunning(jobId);
}

function markAiRecommendJobSucceeded(jobId, payload) {
  const source = payload && typeof payload === "object" ? payload : {};
  return sharedAiJobStore.markJobSucceeded(jobId, {
    responseBody: {
      success: true,
      data: source.result || null,
      meta: {
        runtime: source.runtime || null,
        providerStatus: Number(source.providerStatus) || 0,
      },
    },
  });
}

function markAiRecommendJobFailed(jobId, errorLike) {
  const source = errorLike && typeof errorLike === "object" ? errorLike : {};
  return sharedAiJobStore.markJobFailed(jobId, {
    errorBody: {
      success: false,
      error: {
        code: String(source.code || "").trim(),
        message: String(source.message || "DataBaker AI recommend 失败。").trim().slice(0, 240),
        providerStatus: Number(source.providerStatus) || 0,
      },
      meta: {
        runtime: source.runtime || null,
      },
    },
    debugPayload:
      source.debugRawJson && typeof source.debugRawJson === "object" ? source.debugRawJson : null,
  });
}

function getAiJobStoreSnapshot() {
  return sharedAiJobStore.getSnapshot();
}

module.exports = {
  DEFAULT_JOB_MAX_SIZE,
  DEFAULT_JOB_POLL_INTERVAL_MS,
  DEFAULT_JOB_TIMEOUT_MS,
  DEFAULT_JOB_TTL_MS,
  createAiRecommendJob,
  createJobDebugNotFoundError,
  createJobNotFoundError,
  createJobsDisabledError,
  createStoreFullError,
  getAiJobStoreConfig,
  getAiJobStoreSnapshot,
  getAiRecommendJob,
  getAiRecommendJobDebug,
  getAiRecommendJobSignal,
  markAiRecommendJobFailed,
  markAiRecommendJobRunning,
  markAiRecommendJobSucceeded,
};

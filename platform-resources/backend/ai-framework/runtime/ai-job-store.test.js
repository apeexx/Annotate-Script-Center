"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { createAiJobStore } = require("./ai-job-store");

test("AI job store cancels a pending job and aborts its provider signal", function () {
  const store = createAiJobStore({ enabled: true, timeoutMs: 60000, maxSize: 5 });
  const job = store.createJob({ requestId: "cancel-job", routeKey: "/test" });
  const signal = store.getJobSignal(job.jobId);
  try {
    const cancelled = store.cancelJob(job.jobId, { requestId: "cancel-job" });
    assert.equal(signal.aborted, true);
    assert.equal(cancelled.status, "failed");
    assert.equal(cancelled.errorBody.error.code, "aborted");
    assert.equal(cancelled.errorBody.meta.cancelled, true);
  } finally {
    if (typeof store.cancelJob === "function") {
      store.cancelJob(job.jobId, { requestId: "cancel-job" });
    } else {
      store.markJobFailed(job.jobId, { errorBody: { success: false } });
    }
  }
});

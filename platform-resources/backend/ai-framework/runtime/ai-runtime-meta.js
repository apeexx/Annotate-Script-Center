"use strict";

const { getModelQueuePolicy, getQueueSnapshots } = require("../../ai/provider-queue");
const { sharedAiJobStore } = require("./ai-job-store");

function buildAsyncJobRuntimeMeta(options) {
  const config = options && typeof options === "object" ? options : {};
  const runtime = {
    requestMode: "async-job-default",
    responseTransport: "post-jobs-then-poll",
    jobs: sharedAiJobStore.getSnapshot(),
    queue: {
      keyStrategy: "concrete-model-name",
      defaultModelPool: getModelQueuePolicy(),
    },
  };
  if (config.includeQueueSnapshots === true) {
    runtime.queue.activePools = getQueueSnapshots();
  }
  return runtime;
}

module.exports = {
  buildAsyncJobRuntimeMeta,
};

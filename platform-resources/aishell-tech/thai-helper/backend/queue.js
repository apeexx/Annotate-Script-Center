"use strict";

const {
  buildModelQueueKey,
  enqueueProviderTask,
  getQueueSnapshots,
} = require("../../../backend/ai/provider-queue");

function resolveQueueKey(groupName, options) {
  const normalizedModelName = String(options?.modelName || "").trim();
  if (normalizedModelName) {
    return buildModelQueueKey(normalizedModelName);
  }
  return String(groupName || "").trim() || "aishell_qwen_omni";
}

function enqueueTask(groupName, task, options) {
  return enqueueProviderTask(resolveQueueKey(groupName, options), task, {
    signal: options?.signal,
    onRetry: typeof options?.onRetry === "function" ? options.onRetry : undefined,
  });
}

module.exports = {
  enqueueTask,
  getQueueSnapshots,
};

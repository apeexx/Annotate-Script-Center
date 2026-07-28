"use strict";

const {
  enqueueProviderTask,
  getQueueSnapshots,
} = require("../../../backend/ai/provider-queue");

const CANTONESE_QWEN_QUEUE_GROUP = "aishell_cantonese_qwen_omni";

function enqueueTask(_groupName, task, options) {
  return enqueueProviderTask(CANTONESE_QWEN_QUEUE_GROUP, task, {
    signal: options?.signal,
    onRetry: typeof options?.onRetry === "function" ? options.onRetry : undefined,
  });
}

module.exports = {
  CANTONESE_QWEN_QUEUE_GROUP,
  enqueueTask,
  getQueueSnapshots,
};

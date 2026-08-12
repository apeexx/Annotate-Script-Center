"use strict";

const { enqueueProviderTask, getQueueSnapshots } = require("../../../backend/ai/provider-queue");

const ENGLISH_TRANSCRIPTION_QWEN_QUEUE_GROUP = "aishell_english_transcription_qwen_omni";

function enqueueTask(_groupName, task, options) {
  return enqueueProviderTask(ENGLISH_TRANSCRIPTION_QWEN_QUEUE_GROUP, task, {
    signal: options?.signal,
    onRetry: typeof options?.onRetry === "function" ? options.onRetry : undefined,
  });
}

module.exports = {
  ENGLISH_TRANSCRIPTION_QWEN_QUEUE_GROUP,
  enqueueTask,
  getQueueSnapshots,
};

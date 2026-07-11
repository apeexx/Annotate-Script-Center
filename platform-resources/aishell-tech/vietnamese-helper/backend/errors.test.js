"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { createStageError } = require("./errors");

test("Aishell Vietnamese stage errors keep message and status from plain objects", function () {
  const error = createStageError(
    "recognize",
    {
      code: "empty-transcription",
      statusCode: 502,
      message: "Omni 未返回可用的越南语转写文本。",
    },
    {
      requestId: "req-stage-error",
    }
  );

  assert.equal(error.message, "Omni 未返回可用的越南语转写文本。");
  assert.equal(error.code, "empty-transcription");
  assert.equal(error.statusCode, 502);
  assert.equal(error.providerStatus, 502);
  assert.equal(error.stage, "recognize");
  assert.equal(error.requestId, "req-stage-error");
});

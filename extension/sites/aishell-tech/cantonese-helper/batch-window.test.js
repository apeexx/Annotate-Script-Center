"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const batchWindow = require("./batch-window.js");

test("Cantonese batch policy serializes requests even when an older user setting is higher", function () {
  const policy = batchWindow.resolveBatchRequestPolicy({
    aiQualifiedAutofillConcurrency: 5,
  });

  assert.deepEqual(policy, {
    configuredConcurrency: 5,
    frontConcurrency: 1,
    requestStaggerMs: 0,
  });
});

test("Cantonese batch policy pauses remaining segments after an exhausted provider rate limit", function () {
  assert.equal(
    batchWindow.shouldPauseAfterAiError({
      code: "provider-rate-limited",
      providerStatus: 429,
    }),
    true
  );
  assert.equal(
    batchWindow.shouldPauseAfterAiError({
      code: "qwen-empty-response",
      providerStatus: 502,
    }),
    false
  );
});

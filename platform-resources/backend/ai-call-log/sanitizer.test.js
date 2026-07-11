"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { pickUsageCells, safeJsonStringify } = require("./sanitizer");

test("ai call log sanitizer aggregates staged usage into visible token cells", function () {
  const usageCells = pickUsageCells({
    listen: {
      promptTokens: 120,
      completionTokens: 30,
      totalTokens: 150,
    },
    refine: {
      prompt_tokens: 80,
      completion_tokens: 20,
      total_tokens: 100,
    },
  });

  assert.deepEqual(usageCells, {
    promptTokens: "200",
    completionTokens: "50",
    totalTokens: "250",
  });
});

test("ai call log sanitizer keeps usage token counts while redacting auth tokens", function () {
  const jsonText = safeJsonStringify({
    usage: {
      listen: {
        promptTokens: 120,
        completionTokens: 30,
        totalTokens: 150,
      },
      refine: {
        prompt_tokens: 80,
        completion_tokens: 20,
        total_tokens: 100,
      },
    },
    access_token: "secret-token",
  });

  assert.match(jsonText, /"promptTokens":120/);
  assert.match(jsonText, /"completion_tokens":20/);
  assert.match(jsonText, /"access_token":"<redacted>"/);
});

"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const client = require("./dashscope-omni-client");

function createStreamResponse(sseText) {
  const bytes = new TextEncoder().encode(sseText);
  let sent = false;
  return {
    ok: true,
    body: {
      getReader: function () {
        return {
          read: async function () {
            if (sent) {
              return { done: true, value: undefined };
            }
            sent = true;
            return { done: false, value: bytes };
          },
        };
      },
    },
  };
}

async function withDashScopeStream(sseText, callback) {
  const previousApiKey = process.env.DASHSCOPE_API_KEY;
  const previousFetch = global.fetch;
  process.env.DASHSCOPE_API_KEY = "test-key";
  global.fetch = async function () {
    return createStreamResponse(sseText);
  };
  try {
    return await callback();
  } finally {
    if (previousApiKey === undefined) {
      delete process.env.DASHSCOPE_API_KEY;
    } else {
      process.env.DASHSCOPE_API_KEY = previousApiKey;
    }
    global.fetch = previousFetch;
  }
}

const NORMAL_EMPTY_SSE = [
  'data: {"choices":[{"delta":{"content":""},"finish_reason":"stop"}]}',
  "",
  "data: [DONE]",
  "",
].join("\n");

test("DashScope Omni returns a normally completed blank response only when the caller allows human review", async function () {
  await withDashScopeStream(NORMAL_EMPTY_SSE, async function () {
    const result = await client.requestDashScopeOmniAudioText(
      { audioUrl: "data:audio/wav;base64,UklGRg==" },
      { systemPrompt: "transcribe", userPrompt: "segment" },
      { allowEmptyText: true }
    );

    assert.equal(result.rawText, "");
    assert.equal(result.streamCompleted, true);
  });
});

test("DashScope Omni keeps an unrequested blank response as an upstream failure", async function () {
  await withDashScopeStream(NORMAL_EMPTY_SSE, async function () {
    await assert.rejects(
      client.requestDashScopeOmniAudioText(
        { audioUrl: "data:audio/wav;base64,UklGRg==" },
        { systemPrompt: "transcribe", userPrompt: "segment" }
      ),
      function (error) {
        return error?.code === "qwen-empty-response";
      }
    );
  });
});

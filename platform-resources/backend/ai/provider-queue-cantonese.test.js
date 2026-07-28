"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const queue = require("./provider-queue");

function withEnvironment(values, callback) {
  const previous = new Map();
  Object.keys(values).forEach(function (key) {
    previous.set(key, process.env[key]);
    const value = values[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = String(value);
    }
  });
  return Promise.resolve()
    .then(callback)
    .finally(function () {
      previous.forEach(function (value, key) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      });
    });
}

function createRateLimitError() {
  return Object.assign(new Error("上游模型限流"), {
    code: "provider-rate-limited",
    providerCode: "limit_burst_rate",
    providerStatus: 429,
    statusCode: 429,
  });
}

function wait(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

test("Cantonese Qwen queue defaults to the safe 20 RPM single-request policy", function () {
  return withEnvironment(
    {
      AISHELL_CANTONESE_AI_QWEN_OMNI_RPM_LIMIT: undefined,
      AISHELL_CANTONESE_AI_QWEN_OMNI_CONCURRENCY: undefined,
      AISHELL_CANTONESE_AI_QWEN_OMNI_BURST_RETRY_MAX: undefined,
      AISHELL_CANTONESE_AI_QWEN_OMNI_BURST_RETRY_BASE_MS: undefined,
      AISHELL_CANTONESE_AI_QWEN_BURST_RETRY_MAX: undefined,
      AISHELL_CANTONESE_AI_QWEN_BURST_RETRY_BASE_MS: undefined,
    },
    function () {
      const settings = queue.getGroupSettings("aishell_cantonese_qwen_omni");
      assert.equal(settings.rpm, 20);
      assert.equal(settings.maxConcurrent, 1);
      assert.equal(settings.retryMax, 3);
    }
  );
});

test("Cantonese Qwen queue honors its retry cap for upstream 429 errors", async function () {
  await withEnvironment(
    {
      AISHELL_CANTONESE_AI_QWEN_OMNI_RPM_LIMIT: 10000,
      AISHELL_CANTONESE_AI_QWEN_OMNI_CONCURRENCY: 1,
      AISHELL_CANTONESE_AI_QWEN_OMNI_BURST_RETRY_MAX: 1,
      AISHELL_CANTONESE_AI_QWEN_OMNI_BURST_RETRY_BASE_MS: 100,
      AISHELL_CANTONESE_AI_QWEN_BURST_RETRY_MAX: 1,
      AISHELL_CANTONESE_AI_QWEN_BURST_RETRY_BASE_MS: 100,
      ASC_AI_PROVIDER_RETRY_BASE_MS: 100,
      ASC_AI_PROVIDER_RETRY_MAX_DELAY_MS: 100,
    },
    async function () {
      let attempts = 0;
      await assert.rejects(
        queue.enqueueProviderTask("aishell_cantonese_qwen_omni", async function () {
          attempts += 1;
          throw createRateLimitError();
        }),
        function (error) {
          return error?.code === "provider-rate-limited";
        }
      );
      assert.equal(attempts, 2);
    }
  );
});

test("Cantonese Qwen queue accepts later front-window requests and runs them after the active request", async function () {
  await withEnvironment(
    {
      AISHELL_CANTONESE_AI_QWEN_OMNI_RPM_LIMIT: 10000,
      AISHELL_CANTONESE_AI_QWEN_OMNI_CONCURRENCY: 1,
    },
    async function () {
      const started = [];
      let resolveFirstTask = null;
      const first = queue.enqueueProviderTask("aishell_cantonese_qwen_omni", function () {
        started.push("first");
        return new Promise(function (resolve) {
          resolveFirstTask = resolve;
        });
      });
      const second = queue.enqueueProviderTask("aishell_cantonese_qwen_omni", function () {
        started.push("second");
        return Promise.resolve("second-result");
      });

      await wait(30);
      assert.deepEqual(started, ["first"]);
      resolveFirstTask("first-result");
      await Promise.all([first, second]);
      assert.deepEqual(started, ["first", "second"]);
    }
  );
});

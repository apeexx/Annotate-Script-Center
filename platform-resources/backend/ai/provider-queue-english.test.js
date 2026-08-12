"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const queue = require("./provider-queue");

function withEnvironment(values, callback) {
  const previous = new Map();
  Object.keys(values).forEach(function (key) {
    previous.set(key, process.env[key]);
    if (values[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = String(values[key]);
    }
  });
  return Promise.resolve().then(callback).finally(function () {
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
  return Object.assign(new Error("upstream rate limited"), {
    code: "provider-rate-limited",
    providerStatus: 429,
    statusCode: 429,
  });
}

test("English transcription Qwen queue defaults to 8 RPM and one concurrent request", function () {
  return withEnvironment(
    {
      AISHELL_ENGLISH_TRANSCRIPTION_AI_QWEN_OMNI_RPM_LIMIT: undefined,
      AISHELL_ENGLISH_TRANSCRIPTION_AI_QWEN_OMNI_CONCURRENCY: undefined,
    },
    function () {
      const settings = queue.getGroupSettings("aishell_english_transcription_qwen_omni");
      assert.equal(settings.rpm, 8);
      assert.equal(settings.maxConcurrent, 1);
      assert.equal(Object.hasOwn(settings, "rpmLimit"), false);
      assert.equal(Object.hasOwn(settings, "concurrency"), false);
    }
  );
});

test("English transcription queues a second request behind one active request", async function () {
  await withEnvironment(
    {
      ASC_AI_QUEUE_MAX_SIZE: 2,
      AISHELL_ENGLISH_TRANSCRIPTION_AI_QWEN_OMNI_RPM_LIMIT: 10000,
      AISHELL_ENGLISH_TRANSCRIPTION_AI_QWEN_OMNI_CONCURRENCY: 1,
    },
    async function () {
      let releaseFirst = null;
      let resolveFirstStarted = null;
      const firstStarted = new Promise(function (resolve) {
        resolveFirstStarted = resolve;
      });
      const first = queue.enqueueProviderTask(
        "aishell_english_transcription_qwen_omni",
        function () {
          resolveFirstStarted();
          return new Promise(function (resolve) {
            releaseFirst = resolve;
          });
        }
      );
      let second = null;

      try {
        await firstStarted;
        second = queue.enqueueProviderTask(
          "aishell_english_transcription_qwen_omni",
          async function () {
            return "second";
          }
        );
        second.catch(function () {});
        await new Promise(function (resolve) { setImmediate(resolve); });

        const snapshot = queue.getQueueSnapshots().find(function (entry) {
          return entry.groupName === "aishell_english_transcription_qwen_omni";
        });
        assert.equal(snapshot.totalCapacity, 2);
        assert.equal(snapshot.pendingCount, 1);

        releaseFirst("first");
        const results = await Promise.all([first, second]);
        assert.equal(results[0].value, "first");
        assert.equal(results[1].value, "second");
      } finally {
        if (typeof releaseFirst === "function") {
          releaseFirst("first");
        }
        await first.catch(function () {});
        if (second) {
          await second.catch(function () {});
        }
      }
    }
  );
});

test("English transcription queue paces a 429 retry before the next upstream attempt", async function () {
  await withEnvironment(
    {
      AISHELL_ENGLISH_TRANSCRIPTION_AI_QWEN_OMNI_RPM_LIMIT: 300,
      AISHELL_ENGLISH_TRANSCRIPTION_AI_QWEN_OMNI_CONCURRENCY: 1,
      AISHELL_ENGLISH_TRANSCRIPTION_AI_QWEN_OMNI_BURST_RETRY_MAX: 1,
      AISHELL_ENGLISH_TRANSCRIPTION_AI_QWEN_OMNI_BURST_RETRY_BASE_MS: 100,
    },
    async function () {
      const startedAt = [];
      const result = await queue.enqueueProviderTask("aishell_english_transcription_qwen_omni", async function () {
        startedAt.push(Date.now());
        if (startedAt.length === 1) {
          throw createRateLimitError();
        }
        return "retried";
      });

      assert.equal(result.value, "retried");
      assert.equal(startedAt.length, 2);
      assert.ok(startedAt[1] - startedAt[0] >= 170, "429 retry must wait for the English queue interval");
    }
  );
});

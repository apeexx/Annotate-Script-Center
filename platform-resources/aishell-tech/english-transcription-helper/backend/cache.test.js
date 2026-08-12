"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const cache = require(path.resolve(__dirname, "cache.js"));

const common = {
  taskId: "task-cache-a",
  packageId: "package-cache-a",
  taskItemId: "item-safe-fixture",
  regionId: "region-safe-fixture",
  segmentNumber: 7,
  startMs: 1200,
  endMs: 2600,
  pipelineMode: "omni_single_raw_listen",
  aiOmni: { model: "qwen3.5-omni-plus", prompt: "Keep original English.", params: {} },
};

test("English cache hashes cropped WAV content without retaining its raw Data URL", function () {
  const first = cache.buildRecommendCacheKey(Object.assign({}, common, {
    audioDataUrl: "data:audio/wav;base64,UklGRjYAAABXQVZF",
  }));
  const second = cache.buildRecommendCacheKey(Object.assign({}, common, {
    audioDataUrl: "data:audio/wav;base64,UklGRjYAAABXQVZFAAAA",
  }));

  assert.match(first, /^[a-f0-9]{64}$/);
  assert.notEqual(first, second);
  assert.doesNotMatch(first, /UklGR/);
});


test("English cache isolates identical cropped clips across task and package identities", function () {
  const baseRequest = Object.assign({}, common, {
    taskId: "task-cache-a",
    packageId: "package-cache-a",
    audioDataUrl: "data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQIAAAAAAA==",
  });
  const sameKey = cache.buildRecommendCacheKey(baseRequest);
  const sameRequestKey = cache.buildRecommendCacheKey(Object.assign({}, baseRequest));
  const otherTaskKey = cache.buildRecommendCacheKey(Object.assign({}, baseRequest, { taskId: "task-cache-b" }));
  const otherPackageKey = cache.buildRecommendCacheKey(Object.assign({}, baseRequest, { packageId: "package-cache-b" }));

  assert.equal(sameKey, sameRequestKey);
  assert.notEqual(sameKey, otherTaskKey);
  assert.notEqual(sameKey, otherPackageKey);
  cache.setCachedRecommendResult(sameKey, { data: { taskId: "task-cache-a", packageId: "package-cache-a" } });
  assert.deepEqual(cache.getCachedRecommendResult(sameKey), { data: { taskId: "task-cache-a", packageId: "package-cache-a" } });
  assert.equal(cache.getCachedRecommendResult(otherTaskKey), null);
  assert.equal(cache.getCachedRecommendResult(otherPackageKey), null);
});

test("English cache refuses entries without a task and package identity", function () {
  const invalidKeys = [
    cache.buildRecommendCacheKey(Object.assign({}, common, {
      taskId: "",
      packageId: "package-cache-a",
      audioDataUrl: "data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQIAAAAAAA==",
    })),
    cache.buildRecommendCacheKey(Object.assign({}, common, {
      taskId: "task-cache-a",
      packageId: "",
      audioDataUrl: "data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQIAAAAAAA==",
    })),
    cache.buildRecommendCacheKey(Object.assign({}, common, {
      taskId: " ",
      packageId: "package-cache-a",
      audioDataUrl: "data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQIAAAAAAA==",
    })),
    cache.buildRecommendCacheKey(Object.assign({}, common, {
      taskId: "task-cache-a",
      packageId: "\t",
      audioDataUrl: "data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQIAAAAAAA==",
    })),
  ];

  invalidKeys.forEach(function (cacheKey) {
    assert.equal(cacheKey, "");
    cache.setCachedRecommendResult(cacheKey, { data: { taskId: "wrong-task" } });
    assert.equal(cache.getCachedRecommendResult(cacheKey), null);
  });
});

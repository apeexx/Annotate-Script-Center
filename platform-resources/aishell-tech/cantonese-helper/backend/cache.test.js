"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const cache = require(path.resolve(__dirname, "cache.js"));

test("Aishell Cantonese cache separates two cropped regions from the same source audio", function () {
  const common = {
    taskItemId: "item-1",
    audioUrl: "https://oss.example.test/audio.wav",
    pipelineMode: "omni_single_raw_listen",
    aiOmni: { model: "qwen3.5-omni-plus", prompt: "只輸出粵語", params: {} },
  };
  const first = cache.buildRecommendCacheKey(Object.assign({}, common, {
    regionId: "region-1",
    startMs: 1830,
    endMs: 2990,
  }));
  const second = cache.buildRecommendCacheKey(Object.assign({}, common, {
    regionId: "region-2",
    startMs: 3150,
    endMs: 6510,
  }));

  assert.notEqual(first, second);
});

test("Aishell Cantonese cache key isolates different cropped WAV payloads without retaining their raw data", function () {
  const common = {
    taskItemId: "item-1",
    regionId: "region-1",
    segmentNumber: 1,
    startMs: 1830,
    endMs: 2990,
    pipelineMode: "omni_single_raw_listen",
    aiOmni: { model: "qwen3.5-omni-plus", prompt: "只輸出粵語", params: {} },
  };
  const first = cache.buildRecommendCacheKey(Object.assign({}, common, {
    audioUrl: "https://oss.example.test/first.wav?temporary=1",
    audioDataUrl: "data:audio/wav;base64,UklGRkE=",
  }));
  const second = cache.buildRecommendCacheKey(Object.assign({}, common, {
    audioUrl: "https://oss.example.test/second.wav?temporary=2",
    audioDataUrl: "data:audio/wav;base64,UklGRkI=",
  }));

  assert.notEqual(first, second);
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(first, /UklGR/);
  assert.doesNotMatch(first, /oss\.example\.test/);
});

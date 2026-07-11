"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const modulePath = path.resolve(__dirname, "thai-helper", "backend", "ai-service.js");

function loadModule() {
  delete require.cache[modulePath];
  return require(modulePath);
}

test("Aishell Thai success body includes recommendedSpeed", function () {
  const api = loadModule();
  const body = api.buildRecommendSuccessBody({
    taskItemId: "task-1",
    referenceText: "ตั้งนาฬิกาปลุกเวลาหนึ่งโมงบ่าย",
    recommendedText: "ตั้งนาฬิกาปลุกเวลาหนึ่งโมงบ่าย",
    recommendedSpeed: "normal",
    meta: {
      requestId: "req-1",
    },
  });

  assert.equal(body.success, true);
  assert.equal(body.data.taskItemId, "task-1");
  assert.equal(body.data.recommendedText, "ตั้งนาฬิกาปลุกเวลาหนึ่งโมงบ่าย");
  assert.equal(body.data.recommendedSpeed, "normal");
  assert.equal(body.data.referenceText, "ตั้งนาฬิกาปลุกเวลาหนึ่งโมงบ่าย");
});

test("Aishell Thai request normalization keeps single-stage text plus speed mode", function () {
  const api = loadModule();
  const request = api.normalizeRecommendRequest({
    taskItemId: "task-1",
    audioUrl: "https://example.com/audio.wav",
  });

  assert.equal(request.pipelineMode, "omni_single");
  assert.equal(request.modelMode, "omni_single");
  assert.equal(request.recognitionStrategy, "thai_transcription_speed");
  assert.match(request.singlePrompt, /slow\|normal\|fast/);
});

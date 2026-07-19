"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const modulePath = path.resolve(__dirname, "ai-service.js");

test("Aishell Cantonese AI service is available", function () {
  assert.equal(fs.existsSync(modulePath), true);
});

function loadModule() {
  delete require.cache[modulePath];
  return require(modulePath);
}

test("Aishell Cantonese defaults use a direct raw-listen Omni contract", function () {
  const api = loadModule();
  const defaults = api.createDefaultsPayload();

  assert.equal(defaults.defaults.aiOmni.model, "qwen3.5-omni-plus");
  assert.match(defaults.defaults.aiOmni.prompt, /繁體粵語口語/);
  assert.equal(defaults.contract.stages[0], "omni");
  assert.equal(defaults.contract.outputField, "listenText");
  assert.equal(defaults.contract.enableThinking, false);
});

test("Aishell Cantonese request keeps a saved prompt but always disables thinking", function () {
  const api = loadModule();
  const request = api.normalizeRecommendRequest({
    taskItemId: "item-1",
    audioUrl: "https://example.com/audio.wav",
    referenceText: "平台参考文本",
    aiOmni: {
      model: "qwen3.5-omni-flash",
      prompt: "只输出原始繁體粵語。",
      enableThinking: true,
    },
  });

  assert.equal(request.aiOmni.model, "qwen3.5-omni-flash");
  assert.equal(request.aiOmni.prompt, "只输出原始繁體粵語。");
  assert.equal(request.aiOmni.enableThinking, false);
  assert.equal(request.pipelineMode, "omni_single_raw_listen");
});

test("Aishell Cantonese success body preserves raw listenText", function () {
  const api = loadModule();
  const rawListenText = "冇問題 ！";
  const body = api.buildRecommendSuccessBody({
    data: {
      taskItemId: "item-1",
      referenceText: "没有问题。",
      listenText: rawListenText,
    },
    meta: { requestId: "req-1" },
  });

  assert.equal(body.success, true);
  assert.equal(body.data.listenText, rawListenText);
  assert.equal(body.data.referenceText, "没有问题。");
});

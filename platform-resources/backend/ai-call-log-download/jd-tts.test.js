"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const routes = require(path.resolve(__dirname, "routes.js"));

test("AI call-log downloads include the JD TTS Shanghai dataset", function () {
  const datasets = routes.listAiCallLogDatasets();
  assert.ok(datasets.some(function (item) {
    return item.id === "jd-tts-shanghainese-helper-ai";
  }));
});

"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { listAiCallLogDatasets } = require("./routes");

test("AI call-log download lists the Cantonese Aishell dataset", function () {
  const datasets = listAiCallLogDatasets();
  const cantonese = datasets.find(function (item) {
    return item.id === "aishell-tech-cantonese-helper-ai";
  });

  assert.ok(cantonese);
  assert.equal(cantonese.label, "Aishell Tech 粤语助手 AI 调用记录");
});

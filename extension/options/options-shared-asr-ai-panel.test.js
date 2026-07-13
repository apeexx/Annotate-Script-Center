"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildSharedAsrAiPanelSpec,
  buildSharedAsrAutofillConcurrencyHelp,
  renderSharedAsrAutofillConcurrencyField,
} = require("./options-shared-asr-ai-panel");

test("shared AI panel spec keeps DataBaker concurrency field in the fixed model section order", function () {
  const spec = buildSharedAsrAiPanelSpec("dataBakerRoundOneQuality");

  assert.equal(spec.showAutofillConcurrency, true);
  assert.equal(spec.showRecognitionStrategy, false);
  assert.equal(spec.concurrencyInputId, "data-baker-qualified-autofill-concurrency");
  assert.deepEqual(spec.modelFieldOrder, [
    "enabled",
    "pipelineMode",
    "listenModel",
    "listenModelNote",
    "singleModel",
    "compareModel",
    "autofillConcurrency",
    "timeout",
    "thinking",
  ]);
});

test("shared AI panel spec marks Aishell as a standalone three-stage layout", function () {
  const spec = buildSharedAsrAiPanelSpec("aishellTechMinnanAssistant");

  assert.equal(spec.useStandaloneLayout, true);
  assert.equal(spec.showAutofillConcurrency, true);
  assert.equal(spec.showPipelineMode, false);
  assert.equal(spec.showRecognitionStrategy, false);
  assert.equal(spec.concurrencyInputId, "aishell-tech-qualified-autofill-concurrency");
  assert.deepEqual(spec.modelFieldOrder, [
    "enabled",
    "autofillConcurrency",
    "timeout",
    "thinking",
  ]);
});

test("shared AI panel spec marks CVPC as a standalone two-stage layout without concurrency field", function () {
  const spec = buildSharedAsrAiPanelSpec("dataBakerCvpcLiuzhouAssistant");

  assert.equal(spec.useStandaloneLayout, true);
  assert.equal(spec.showAutofillConcurrency, false);
  assert.equal(spec.showPipelineMode, false);
  assert.equal(spec.showRecognitionStrategy, false);
  assert.equal(spec.concurrencyInputId, "");
  assert.deepEqual(spec.modelFieldOrder, [
    "enabled",
    "timeout",
    "thinking",
  ]);
});

test("shared AI panel spec treats Hangzhou helper as a Magic Data script", function () {
  const spec = buildSharedAsrAiPanelSpec("magicDataHangzhouAssistant");

  assert.equal(spec.prefix, "magic-data-ai");
  assert.equal(spec.showPipelineMode, true);
  assert.equal(spec.showRecognitionStrategy, true);
  assert.equal(spec.showAutofillConcurrency, false);
  assert.equal(spec.enableFieldLabel, "启用 AI 质检助手");
  assert.equal(spec.enableFieldHelp, "关闭后不显示 AI 质检建议");
  assert.deepEqual(spec.modelFieldOrder, [
    "enabled",
    "pipelineMode",
    "recognitionStrategy",
    "listenModel",
    "listenModelNote",
    "singleModel",
    "compareModel",
    "timeout",
    "thinking",
    "showHeardText",
    "showEstimatedIncome",
  ]);
});

test("shared AI panel renders the shared autofill concurrency field with the expected ids", function () {
  const html = renderSharedAsrAutofillConcurrencyField("aishellTechMinnanAssistant");

  assert.match(html, /AI 连续填入并发数量/);
  assert.match(html, /id="aishell-tech-qualified-autofill-concurrency"/);
  assert.match(html, /id="aishell-tech-qualified-autofill-concurrency-help"/);
});

test("shared AI panel builds script-specific concurrency help with the unified default value", function () {
  const dataBakerHelp = buildSharedAsrAutofillConcurrencyHelp("dataBakerRoundOneQuality", {
    min: 1,
    max: 25,
    defaultValue: 5,
    modelType: "omni",
  });
  const aishellHelp = buildSharedAsrAutofillConcurrencyHelp("aishellTechMinnanAssistant", {
    min: 1,
    max: 50,
    defaultValue: 5,
    modelType: "fun_asr",
  });

  assert.match(dataBakerHelp, /默认 5，范围 1~25/);
  assert.match(dataBakerHelp, /统一后端/);
  assert.match(aishellHelp, /默认 5，范围 1~50/);
  assert.match(aishellHelp, /当前分包/);
});

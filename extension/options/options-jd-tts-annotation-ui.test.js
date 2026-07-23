"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("JD TTS options provide a dedicated flat single-stage settings panel", function () {
  const script = fs.readFileSync(path.resolve(__dirname, "options.js"), "utf8");
  const html = fs.readFileSync(path.resolve(__dirname, "options.html"), "utf8");

  assert.match(html, /detail-jd-tts-shanghainese-helper-panel/);
  assert.match(html, /save-jd-tts-shanghainese-settings/);
  assert.match(script, /const jdTtsShanghaineseScriptId =/);
  assert.match(script, /jdTtsShanghaineseAssistant: "\/api\/jd-tts-annotation\/shanghainese-helper\/ai\/recommend\/defaults"/);
  assert.match(script, /jdTtsShanghaineseAssistant: "\/api\/jd-tts-annotation\/shanghainese-helper\/ai\/recommend\/health"/);
  assert.match(script, /function getJdTtsShanghaineseConfig\(/);
  assert.match(script, /function applyJdTtsShanghaineseForm\(/);
  assert.match(script, /async function saveJdTtsShanghaineseSettings\(/);
  assert.match(script, /qwen3\.5-omni-plus/);
  assert.match(script, /qwen3\.5-omni-flash/);
  assert.match(html, /京东 TTS 上海话识别必须先填写并保存/);
});

test("JD TTS shared AI settings dispatcher renders the Shanghai panel with fixed safety controls", function () {
  const script = fs.readFileSync(path.resolve(__dirname, "options.js"), "utf8");
  const dispatcherStart = script.indexOf("function renderAsrVoiceAiSettingsSection(settings, scriptId) {");
  const dispatcherEnd = script.indexOf("  function isScriptEnabled", dispatcherStart);
  const dispatcher = dispatcherStart >= 0 && dispatcherEnd > dispatcherStart ? script.slice(dispatcherStart, dispatcherEnd) : "";
  const rendererStart = script.indexOf("function renderJdTtsShanghaineseAiSettingsSection(");
  const rendererEnd = script.indexOf("  function renderDataBakerCvpcAiSettingsSection", rendererStart);
  const renderer = rendererStart >= 0 && rendererEnd > rendererStart ? script.slice(rendererStart, rendererEnd) : "";

  assert.ok(dispatcher);
  assert.match(
    dispatcher,
    /if \(isJdTtsShanghaineseScript\(scriptId\)\) \{\s*renderJdTtsShanghaineseAiSettingsSection\(panel, headerHtml, defaultsTipId\);\s*return;/
  );
  assert.ok(renderer);
  assert.match(renderer, /jd-tts-ai-recommend-enabled/);
  assert.match(renderer, /60000ms/);
  assert.match(renderer, /jd-tts-ai-enable-thinking/);
  assert.match(renderer, /disabled/);
  assert.match(renderer, /jd-tts-ai-single-model-select/);
  assert.match(renderer, /jd-tts-ai-single-prompt/);
  assert.match(renderer, /aishellTechStageParamDefinitions/);
});

test("JD TTS options map backend aiOmni defaults to flat persisted fields", function () {
  const script = fs.readFileSync(path.resolve(__dirname, "options.js"), "utf8");
  const start = script.indexOf("if (isJdTtsShanghaineseScript(scriptId)) {");
  const end = script.indexOf("    } else if", start);
  const block = start >= 0 && end > start ? script.slice(start, end) : "";

  assert.ok(block);
  assert.match(block, /defaults\.aiOmni/);
  assert.match(block, /normalizedDefaults\.singleModel/);
  assert.match(block, /normalizedDefaults\.singlePrompt/);
  assert.doesNotMatch(block, /normalizedDefaults\.stages\.(convert|listen|compare)/);
});

test("JD TTS defaults loader keeps the defaults endpoint separate from its status target", function () {
  const script = fs.readFileSync(path.resolve(__dirname, "options.js"), "utf8");
  const start = script.indexOf("function getAsrVoiceAiDefaultsPath(scriptId) {");
  const end = script.indexOf("  function getAsrVoiceAiHealthPath", start);
  const block = start >= 0 && end > start ? script.slice(start, end) : "";

  assert.ok(block);
  assert.match(block, /return asrVoiceAiDefaultsPaths\.jdTtsShanghaineseAssistant/);
  assert.doesNotMatch(block, /jd-tts-shanghainese-status/);
});

test("JD TTS script-center enablement reads the persisted platform and helper state", function () {
  const script = fs.readFileSync(path.resolve(__dirname, "options.js"), "utf8");
  const start = script.indexOf("function isScriptEnabled(settings, scriptId) {");
  const end = script.indexOf("  function getScriptStatus", start);
  const block = start >= 0 && end > start ? script.slice(start, end) : "";

  assert.ok(block);
  assert.match(block, /if \(isJdTtsShanghaineseScript\(scriptId\)\) \{/);
  assert.match(block, /settings\?\.platforms\?\.jdTtsAnnotation\?\.enabled === true/);
  assert.match(
    block,
    /settings\?\.platforms\?\.jdTtsAnnotation\?\.activeScriptId === jdTtsShanghaineseScriptId/
  );
  assert.match(block, /scripts\?\.shanghaineseHelper\?\.enabled === true/);
  assert.match(block, /scripts\?\.shanghaineseHelper\?\.aiRecommendEnabled === true/);
});

test("JD TTS script-center displays the enabled state instead of the LabelX fallback", function () {
  const script = fs.readFileSync(path.resolve(__dirname, "options.js"), "utf8");
  const start = script.indexOf("function getScriptStatus(settings, scriptId) {");
  const end = script.indexOf("  function getScriptHostText", start);
  const block = start >= 0 && end > start ? script.slice(start, end) : "";

  assert.ok(block);
  assert.match(block, /if \(isJdTtsShanghaineseScript\(scriptId\)\) \{/);
  assert.match(block, /return isScriptEnabled\(settings, scriptId\)/);
});

test("workspace AI usage operator save verifies the persisted shared state", function () {
  const script = fs.readFileSync(path.resolve(__dirname, "options.js"), "utf8");
  const start = script.indexOf("async function saveWorkspaceAiUsageOperatorName() {");
  const end = script.indexOf("  function getProjectDataDownloadDatasetById", start);
  const block = start >= 0 && end > start ? script.slice(start, end) : "";

  assert.ok(block);
  assert.match(block, /storage\.saveAiUsageOperatorName\(operatorName\)/);
  assert.match(block, /verification\.persisted === true/);
  assert.match(block, /刷新当前标注页/);
  const unavailableCheck = block.indexOf('if (verification.storageStatus !== "ready")');
  const settingsRead = block.indexOf("currentSettings = await storage.getSettings();");
  assert.ok(unavailableCheck >= 0);
  assert.ok(settingsRead >= 0);
  assert.ok(unavailableCheck < settingsRead);
});

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("Aishell options source uses standalone convert/listen/compare cards", function () {
  const script = fs.readFileSync(path.resolve(__dirname, "options.js"), "utf8");

  assert.match(script, /aishell-tech-ai-convert-model-select/);
  assert.match(script, /aishell-tech-ai-listen-model-select/);
  assert.match(script, /aishell-tech-ai-compare-family-select/);
  assert.match(script, /aishell-tech-ai-convert-model-select" data-options-custom-select="true"/);
  assert.match(script, /aishell-tech-ai-listen-model-select" data-options-custom-select="true"/);
  assert.match(script, /aishell-tech-ai-compare-family-select" data-options-custom-select="true"/);
  assert.match(script, /aishell-tech-ai-compare-model-select" data-options-custom-select="true"/);
  assert.match(script, /aishell-tech-ai-compare-qwen-prompt/);
  assert.match(script, /aishell-tech-ai-compare-omni-prompt/);
  assert.match(script, /Qwen 文本比较/);
  assert.match(script, /Omni 听音比较/);
});

test("Aishell Vietnamese fallback defaults keep wrapped single-stage config", function () {
  const script = fs.readFileSync(path.resolve(__dirname, "options.js"), "utf8");
  const start = script.indexOf("if (scriptId === aishellTechVietnameseScriptId) {");
  const end = script.indexOf("    if (isAishellTechScript(scriptId)) {", start);
  const block = start >= 0 && end > start ? script.slice(start, end) : "";

  assert.ok(block);
  assert.match(block, /baseDefaults\.pipelineMode = "omni_single"/);
  assert.match(block, /baseDefaults\.singlePrompt = aishellTechVietnameseDefaultSinglePrompt/);
  assert.match(block, /recognize:/);
  assert.match(block, /prompt: aishellTechVietnameseDefaultSinglePrompt/);
  assert.match(block, /return \{\s*defaults: baseDefaults,\s*supportedParams: supportedParams,\s*loadedFromBackend: false,\s*error: "",\s*\}/s);

  const promptStart = script.indexOf("const aishellTechVietnameseDefaultSinglePrompt = [");
  const promptEnd = script.indexOf("  ].join(\"\\n\");", promptStart);
  const promptBlock = promptStart >= 0 && promptEnd > promptStart
    ? script.slice(promptStart, promptEnd)
    : "";
  assert.match(promptBlock, /text.*speed.*slow\|normal\|fast/s);
});

test("Aishell Thai fallback defaults keep wrapped single-stage config", function () {
  const script = fs.readFileSync(path.resolve(__dirname, "options.js"), "utf8");
  const start = script.indexOf("if (scriptId === aishellTechThaiScriptId) {");
  const end = script.indexOf("    if (isAishellTechScript(scriptId)) {", start);
  const block = start >= 0 && end > start ? script.slice(start, end) : "";

  assert.ok(block);
  assert.match(block, /baseDefaults\.pipelineMode = "omni_single"/);
  assert.match(block, /baseDefaults\.singlePrompt = aishellTechThaiDefaultSinglePrompt/);
  assert.match(block, /recognize:/);
  assert.match(block, /prompt: aishellTechThaiDefaultSinglePrompt/);
  assert.match(
    block,
    /return \{\s*defaults: baseDefaults,\s*supportedParams: supportedParams,\s*loadedFromBackend: false,\s*error: "",\s*\}/s
  );
});

test("Aishell Thai detail panel exists in options html", function () {
  const html = fs.readFileSync(path.resolve(__dirname, "options.html"), "utf8");

  assert.match(html, /detail-aishell-tech-thai-helper-panel/);
  assert.match(html, /希尔贝壳泰语助手/);
  assert.match(html, /save-aishell-tech-thai-settings/);
});

test("Aishell Cantonese detail panel and settings flow exist", function () {
  const html = fs.readFileSync(path.resolve(__dirname, "options.html"), "utf8");
  const script = fs.readFileSync(path.resolve(__dirname, "options.js"), "utf8");

  assert.match(html, /detail-aishell-tech-cantonese-helper-panel/);
  assert.match(html, /save-aishell-tech-cantonese-settings/);
  assert.match(script, /aishellTechCantoneseScriptId/);
  assert.match(script, /aishell-tech\/cantonese-helper\/ai\/recommend\/defaults/);
  assert.match(script, /getAishellTechCantoneseConfig/);
  assert.match(script, /applyAishellTechCantoneseForm/);
  assert.match(script, /saveAishellTechCantoneseSettings/);
  assert.match(script, /cantoneseHelper/);
  assert.match(script, /qwen3\.5-omni-plus/);
  assert.match(script, /qwen3\.5-omni-flash/);
});

test("Aishell Cantonese config dispatch uses its own settings", function () {
  const script = fs.readFileSync(path.resolve(__dirname, "options.js"), "utf8");
  const start = script.indexOf("function getAishellTechConfig(settings, scriptId) {");
  const end = script.indexOf("  function getAbakaAiTaskPageConfig", start);
  const block = start >= 0 && end > start ? script.slice(start, end) : "";

  assert.ok(block);
  assert.match(
    block,
    /if\s*\(isAishellTechCantoneseScript\(scriptId\)\)\s*\{\s*return getAishellTechCantoneseConfig\(settings\);\s*\}/
  );
});

test("Aishell Cantonese backend defaults map aiOmni to the single-stage Options contract", function () {
  const script = fs.readFileSync(path.resolve(__dirname, "options.js"), "utf8");
  const start = script.indexOf("function normalizeAsrVoiceAiDefaultsPayload(payload, scriptId) {");
  const end = script.indexOf("  function getAsrVoiceAiDefaultsCached", start);
  const block = start >= 0 && end > start ? script.slice(start, end) : "";

  assert.ok(block);
  assert.match(block, /isAishellTechCantoneseScript\(scriptId\)/);
  assert.match(block, /defaults\.aiOmni/);
  assert.match(block, /normalizedDefaults\.singleModel/);
  assert.match(block, /normalizedDefaults\.singlePrompt/);
  assert.match(block, /normalizedDefaults\.temperature/);
  assert.match(block, /normalizedDefaults\.top_p/);
  assert.match(block, /normalizedDefaults\.max_tokens/);
  const cantoneseStart = block.indexOf("if (isAishellTechCantoneseScript(scriptId)) {");
  const cantoneseEnd = block.indexOf("    } else if", cantoneseStart);
  const cantoneseBlock =
    cantoneseStart >= 0 && cantoneseEnd > cantoneseStart
      ? block.slice(cantoneseStart, cantoneseEnd)
      : "";
  assert.ok(cantoneseBlock);
  assert.doesNotMatch(cantoneseBlock, /normalizedDefaults\.stages\.(convert|listen|compare)/);
});

test("Aishell Cantonese Options renders its own raw listenText single-stage settings", function () {
  const script = fs.readFileSync(path.resolve(__dirname, "options.js"), "utf8");
  const start = script.indexOf("function renderAishellTechCantoneseAiSettingsSection(");
  const end = script.indexOf("  function renderDataBakerCvpcAiSettingsSection", start);
  const block = start >= 0 && end > start ? script.slice(start, end) : "";

  assert.ok(block);
  assert.doesNotMatch(block, /renderAishellTechThaiAiSettingsSection/);
  assert.match(block, /原始听写/);
  assert.match(block, /listenText/);
  assert.match(block, /aishell-tech-ai-single-model-select/);
  assert.match(block, /aishell-tech-ai-single-prompt/);
  assert.match(block, /buildAishellTechStageParamFieldsMarkup\("single", false\)/);
  assert.match(block, /renderSharedAsrAutofillConcurrencyField\(aishellTechCantoneseScriptId\)/);
  assert.doesNotMatch(block, /语速|speed|泰语/i);

  const formStart = script.indexOf("function applyAishellTechCantoneseForm(");
  const formEnd = script.indexOf("  async function saveDataBakerSettings", formStart);
  const formBlock = formStart >= 0 && formEnd > formStart ? script.slice(formStart, formEnd) : "";
  assert.ok(formBlock);
  assert.match(formBlock, /renderAishellTechShortcutGrid\(\)/);
});

test("Aishell Cantonese Options keeps the AI timeout fixed at 60000ms", function () {
  const script = fs.readFileSync(path.resolve(__dirname, "options.js"), "utf8");
  const renderStart = script.indexOf("function renderAishellTechCantoneseAiSettingsSection(");
  const renderEnd = script.indexOf("  function renderDataBakerCvpcAiSettingsSection", renderStart);
  const renderBlock = renderStart >= 0 && renderEnd > renderStart ? script.slice(renderStart, renderEnd) : "";
  assert.ok(renderBlock);
  assert.match(renderBlock, /60000/);
  assert.doesNotMatch(renderBlock, /aishell-tech-ai-timeout/);

  const configStart = script.indexOf("function getAishellTechCantoneseConfig(");
  const configEnd = script.indexOf("  function getAishellTechConfig", configStart);
  const configBlock = configStart >= 0 && configEnd > configStart ? script.slice(configStart, configEnd) : "";
  assert.ok(configBlock);
  assert.match(configBlock, /config\.aiRecommendRequestTimeoutMs = DEFAULT_AI_REQUEST_TIMEOUT_MS;/);

  const saveStart = script.indexOf("async function saveAishellTechCantoneseSettings(");
  const saveEnd = script.indexOf("  async function saveAishellTech", saveStart + 1);
  const saveBlock = saveStart >= 0 && saveEnd > saveStart ? script.slice(saveStart, saveEnd) : "";
  assert.ok(saveBlock);
  assert.match(saveBlock, /const timeoutMs = DEFAULT_AI_REQUEST_TIMEOUT_MS;/);
  assert.doesNotMatch(saveBlock, /getElement\("aishell-tech-ai-timeout"\)/);
});

test("Aishell Cantonese manifest injects batch summary after its shared dependencies", function () {
  const manifest = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "..", "manifest.json"), "utf8")
  );
  const cantoneseEntry = manifest.content_scripts.find((entry) =>
    entry.js.includes("sites/aishell-tech/cantonese-helper/content.js")
  );

  assert.ok(cantoneseEntry);
  const batchSummaryIndex = cantoneseEntry.js.indexOf("shared/ai-batch-summary.js");
  const constantsIndex = cantoneseEntry.js.indexOf("shared/constants.js");
  const storageIndex = cantoneseEntry.js.indexOf("shared/storage.js");
  const contentIndex = cantoneseEntry.js.indexOf("sites/aishell-tech/cantonese-helper/content.js");

  assert.ok(batchSummaryIndex >= 0);
  assert.ok(batchSummaryIndex > constantsIndex);
  assert.ok(batchSummaryIndex > storageIndex);
  assert.ok(batchSummaryIndex < contentIndex);
});

test("Aishell cn-en short drama detail panel exists in options html", function () {
  const html = fs.readFileSync(path.resolve(__dirname, "options.html"), "utf8");

  assert.match(html, /detail-aishell-tech-cn-en-short-drama-panel/);
  assert.match(html, /中英短剧脚本/);
  assert.match(html, /当前版本无额外设置项/);
});

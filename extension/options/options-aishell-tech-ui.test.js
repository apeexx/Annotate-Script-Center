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

test("Aishell cn-en short drama detail panel exists in options html", function () {
  const html = fs.readFileSync(path.resolve(__dirname, "options.html"), "utf8");

  assert.match(html, /detail-aishell-tech-cn-en-short-drama-panel/);
  assert.match(html, /中英短剧脚本/);
  assert.match(html, /当前版本无额外设置项/);
});

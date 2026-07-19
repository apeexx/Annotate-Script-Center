"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const extensionRoot = path.resolve(__dirname, "..", "..", "..");
const helperRoot = path.resolve(__dirname);
const runtimeFiles = [
  "data-api.js",
  "ai-recommendation.js",
  "batch-window.js",
  "diagnostics.js",
  "ui-panel.js",
  "shortcuts.js",
  "content.js",
];

test("Cantonese helper is registered as a complete isolated Aishell content-script bundle", function () {
  const manifest = JSON.parse(fs.readFileSync(path.join(extensionRoot, "manifest.json"), "utf8"));
  const bundle = manifest.content_scripts.find(function (entry) {
    return Array.isArray(entry.js) && entry.js.includes("sites/aishell-tech/cantonese-helper/content.js");
  });

  assert.ok(bundle, "manifest must register the Cantonese content-script bundle");
  assert.ok(
    bundle.js.includes("shared/ai-batch-summary.js"),
    "manifest must load the shared batch usage and cost accumulator before the Cantonese runtime"
  );
  runtimeFiles.forEach(function (fileName) {
    assert.ok(
      bundle.js.includes("sites/aishell-tech/cantonese-helper/" + fileName),
      "manifest must load " + fileName
    );
    assert.equal(fs.existsSync(path.join(helperRoot, fileName)), true, fileName + " must exist");
  });

  const contentSource = fs.readFileSync(path.join(helperRoot, "content.js"), "utf8");
  const recommendSource = fs.readFileSync(path.join(helperRoot, "ai-recommendation.js"), "utf8");
  assert.match(contentSource, /aishellTechCantoneseAssistant/);
  assert.match(contentSource, /cantonese-helper/);
  assert.match(contentSource, /AISHELL_TECH_CANTONESE_SCRIPT_ID/);
  assert.match(contentSource, /AISHELL_TECH_CANTONESE_AI_RECOMMEND_PATH/);
  assert.doesNotMatch(contentSource, /AISHELL_TECH_THAI_(SCRIPT_ID|AI_RECOMMEND_PATH)/);
  assert.match(recommendSource, /AISHELL_TECH_CANTONESE_AI_RECOMMEND_PATH/);
  assert.doesNotMatch(recommendSource, /AISHELL_TECH_THAI_AI_RECOMMEND_PATH/);
  assert.doesNotMatch(
    recommendSource,
    /runJobLifecycle/,
    "Cantonese recommend requests must use the direct POST endpoint, not the async job protocol"
  );
});

test("Cantonese runtime AI call logs are excluded from Git", function () {
  const projectRoot = path.resolve(extensionRoot, "..");
  const ignoreRules = fs.readFileSync(path.join(projectRoot, ".gitignore"), "utf8");

  assert.match(
    ignoreRules,
    /^\/platform-resources\/aishell-tech\/cantonese-helper\/data\/runtime\/\*\.csv$/m,
    "runtime AI call logs must remain local-only"
  );
});

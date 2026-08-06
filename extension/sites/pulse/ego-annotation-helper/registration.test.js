"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const extensionRoot = path.resolve(__dirname, "..", "..", "..");

function readExtensionFile(relativePath) {
  return fs.readFileSync(path.resolve(extensionRoot, relativePath), "utf8");
}

test("Pulse 脚本默认关闭且常量库注册了精确平台与脚本", function () {
  const constants = readExtensionFile("shared/constants.js");

  assert.match(constants, /PULSE_PLATFORM_ID\s*=\s*"pulse"/);
  assert.match(constants, /PULSE_EGO_ANNOTATION_HELPER_SCRIPT_ID\s*=\s*"pulseEgoAnnotationHelper"/);
  assert.match(constants, /pulse:\s*\{[\s\S]*?host:\s*PULSE_PLATFORM\.host/);
  assert.match(constants, /pulseEgoAnnotationHelper:\s*\{[\s\S]*?platformId:\s*PULSE_PLATFORM_ID/);
  assert.match(constants, /pulse:\s*createDefaultPulsePlatformSettings\(\)/);
  assert.match(constants, /enabled:\s*false,[\s\S]*?egoAnnotationHelper:[\s\S]*?enabled:\s*false/);
});

test("存储、设置页和弹窗都通过 Pulse 的独立启停状态读取", function () {
  const storage = readExtensionFile("shared/storage.js");
  const options = readExtensionFile("options/options.js");
  const popup = readExtensionFile("popup/popup.js");

  assert.match(storage, /ensurePulseRoot\(settings\)/);
  assert.match(storage, /PULSE_EGO_ANNOTATION_HELPER_SCRIPT_ID/);
  assert.match(storage, /egoAnnotationHelper/);
  assert.match(options, /pulseEgoAnnotationScriptId/);
  assert.match(options, /isPulseEgoAnnotationScript/);
  const enabledStart = options.indexOf("function isScriptEnabled(settings, scriptId) {");
  const enabledEnd = options.indexOf("  function getScriptStatus(settings, scriptId) {", enabledStart);
  const enabledBlock = enabledStart >= 0 && enabledEnd > enabledStart
    ? options.slice(enabledStart, enabledEnd)
    : "";
  assert.match(enabledBlock, /isPulseEgoAnnotationScript\(scriptId\)/);
  const defaultsStart = options.indexOf("function normalizeAsrVoiceAiDefaultsPayload(");
  const defaultsEnd = options.indexOf("  function getAsrVoiceAiDefaultsCached", defaultsStart);
  const defaultsBlock = defaultsStart >= 0 && defaultsEnd > defaultsStart
    ? options.slice(defaultsStart, defaultsEnd)
    : "";
  assert.doesNotMatch(defaultsBlock, /isPulseEgoAnnotationScript\(scriptId\)/);
  assert.match(popup, /pulseEgoAnnotationScriptId/);
  assert.match(popup, /PULSE_PLATFORM/);
});

test("manifest 只在 ego-annotation-gui 标注路由注入 Pulse 隔离脚本和内置词表", function () {
  const manifest = JSON.parse(readExtensionFile("manifest.json"));
  const match = "https://pulse.xdof.cn/annotation/my/corrector/ego-annotation-gui/*";
  const entry = manifest.content_scripts.find((item) => item.matches.includes(match));

  assert.ok(manifest.host_permissions.includes("https://pulse.xdof.cn/*"));
  assert.ok(entry);
  assert.equal(entry.run_at, "document_idle");
  assert.equal(entry.world, "ISOLATED");
  assert.deepEqual(entry.js.slice(-4), [
    "sites/pulse/ego-annotation-helper/forbidden-terms.js",
    "sites/pulse/ego-annotation-helper/timeline-timer.js",
    "sites/pulse/ego-annotation-helper/ui-panel.js",
    "sites/pulse/ego-annotation-helper/content.js",
  ]);
  assert.ok(
    manifest.web_accessible_resources.some(
      (resource) =>
        resource.resources.includes("sites/pulse/ego-annotation-helper/data/forbidden-terms.json") &&
        resource.matches.includes("https://pulse.xdof.cn/*")
    )
  );
});

test("内容脚本只读页面、在路由离开或关闭时移除自身 UI", function () {
  const contentPath = path.resolve(extensionRoot, "sites/pulse/ego-annotation-helper/content.js");
  const content = fs.existsSync(contentPath) ? fs.readFileSync(contentPath, "utf8") : "";

  assert.match(content, /isTargetRoute/);
  assert.match(content, /isScriptRuntimeAccessible/);
  assert.match(content, /loadMatcherFromExtension/);
  assert.match(content, /isCustomTermsStorageChange/);
  assert.match(content, /resetForbiddenTermsCheck/);
  assert.match(content, /MutationObserver/);
  assert.match(content, /removeAll/);
  assert.doesNotMatch(content, /fetch\s*\(\s*["']https?:\/\//);
  assert.doesNotMatch(content, /XMLHttpRequest/);
});

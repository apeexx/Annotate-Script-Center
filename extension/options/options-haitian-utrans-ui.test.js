"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("Haitian uTrans options expose a dedicated single-toggle detail panel", function () {
  const script = fs.readFileSync(path.resolve(__dirname, "options.js"), "utf8");
  const html = fs.readFileSync(path.resolve(__dirname, "options.html"), "utf8");

  assert.match(script, /const haitianUtransAudioDownloadHelperScriptId =/);
  assert.match(script, /function isHaitianUtransScript\(/);
  assert.match(script, /function getHaitianUtransAudioDownloadHelperConfig\(/);
  assert.match(script, /function applyHaitianUtransAudioDownloadHelperForm\(/);
  assert.match(script, /async function saveHaitianUtransAudioDownloadHelperSettings\(/);
  assert.match(script, /settings\?\.platforms\?\.haitianUtrans\?\.enabled !== false/);
  assert.match(script, /settings\?\.platforms\?\.haitianUtrans\?\.scripts\?\.audioDownloadHelper\?\.enabled !== false/);
  assert.match(script, /setStatus\("haitian-utrans-status", "正在保存 uTrans 音频下载设置\.\.\."\)/);
  assert.match(script, /setStatus\("haitian-utrans-status", "uTrans 音频下载设置已保存。"\)/);
  assert.match(script, /detail-haitian-utrans-audio-download-panel/);
  assert.match(script, /save-haitian-utrans-settings/);
  assert.match(script, /haitian-utrans-audio-download-enabled/);

  assert.match(html, /id="detail-haitian-utrans-audio-download-panel"/);
  assert.match(html, /id="haitian-utrans-audio-download-enabled"/);
  assert.match(html, /id="save-haitian-utrans-settings"/);
  assert.match(html, /id="haitian-utrans-status"/);
  assert.match(html, /开启悬浮窗下载功能/);
  assert.doesNotMatch(
    html,
    /detail-haitian-utrans-audio-download-panel[\s\S]*快捷键[\s\S]*detail-haitian-utrans-audio-download-panel/
  );
  assert.doesNotMatch(
    html,
    /detail-haitian-utrans-audio-download-panel[\s\S]*AI 设置[\s\S]*detail-haitian-utrans-audio-download-panel/
  );
});

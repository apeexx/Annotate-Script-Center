"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("options backend panel exposes public server and local root url inputs", function () {
  const html = fs.readFileSync(path.resolve(__dirname, "options.html"), "utf8");
  const script = fs.readFileSync(path.resolve(__dirname, "options.js"), "utf8");

  assert.match(html, /id="home-endpoint-server-url"/);
  assert.match(html, /id="home-endpoint-local-url"/);
  assert.doesNotMatch(html, /home-endpoint-beta/);
  assert.match(html, />服务器</);
  assert.match(html, />本机</);
  assert.match(html, /id="home-endpoint-expand-toggle"/);
  assert.match(html, /id="home-endpoint-config-panel"/);
  assert.match(script, /backendBaseUrls/);
  assert.match(script, /buildDownloadUrl/);
  assert.match(script, /backendConfigExpanded/);
});

test("backend mode switch stays available before administrator authentication", function () {
  const script = fs.readFileSync(path.resolve(__dirname, "options.js"), "utf8");

  assert.match(
    script,
    /adminStage\.insertBefore\(homeEndpointCard, authGate\)/,
    "the local/server switch must be usable when the current server endpoint cannot unlock admin"
  );
});

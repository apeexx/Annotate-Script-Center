"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("public workbench does not expose beta channel controls", function () {
  const html = fs.readFileSync(path.resolve(__dirname, "options.html"), "utf8");

  assert.doesNotMatch(html, /workspace-beta-exit/);
  assert.doesNotMatch(html, /home-endpoint-beta/);
  assert.doesNotMatch(html, /build-meta\.local\.js/);
});

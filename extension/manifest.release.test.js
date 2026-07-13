"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const manifestPath = path.resolve(__dirname, "manifest.json");

test("public release manifest targets the new domain and retains the legacy host permission", function () {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  assert.equal(manifest.version, "0.4.1");
  assert.equal(
    manifest.update_url,
    "https://script.aisiyunling.com/downloads/annotation-script-center-update.xml"
  );
  assert.ok(manifest.host_permissions.includes("https://script.xiangtianzhen.store/*"));
  assert.ok(manifest.host_permissions.includes("https://script.aisiyunling.com/*"));
});

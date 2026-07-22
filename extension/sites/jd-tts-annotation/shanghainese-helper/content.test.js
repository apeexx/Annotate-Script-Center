"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const content = require(path.resolve(__dirname, "content.js"));

test("JD Shanghai content starts only on annotation route when enabled and cancels on route exit", async function () {
  let aborted = false;
  let mounted = 0;
  const runtime = content.createRuntime({
    location: { hash: "#/annotation/dataset/annotate" },
    isEnabled: async function () { return true; },
    createPanel: function () { return { ensureMounted() { mounted += 1; }, remove() {} }; },
    createDataApi: function () { return { start() {}, stop() {}, getCurrentAudio: async function () { return null; } }; },
    createAiClient: function () { return { recommend: async function () { return null; } }; },
  });
  await runtime.evaluatePage();
  assert.equal(mounted, 1);
  runtime.setActiveAbortController({ abort() { aborted = true; } });
  runtime.location.hash = "#/annotation/dataset/list";
  await runtime.evaluatePage();
  assert.equal(aborted, true);
});

test("JD Shanghai content does not fill after cancellation, identity change, or API failure", async function () {
  const writes = [];
  const controller = new AbortController();
  const runtime = content.createRuntime({
    location: { hash: "#/annotation/dataset/annotate" },
    isEnabled: async function () { return true; },
    createPanel: function () { return { ensureMounted() {}, setBusy() {}, setStatus() {}, fillRecommendedText(value, current) { writes.push(value); return current(); }, remove() {} }; },
    createDataApi: function () { return { start() {}, stop() {}, getCurrentAudio: async function () { return { utteranceId: "1", checksum: "a".repeat(32), audioDataUrl: "data:audio/wav;base64,UklGRg==" }; }, isCurrentSnapshot() { return false; } }; },
    createAiClient: function () { return { recommend: async function () { return { utteranceId: "1", checksum: "a".repeat(32), listenText: "不应回填", needHumanReview: false, meta: {} }; } }; },
  });
  await runtime.evaluatePage();
  await runtime.handleRecommend({ signal: controller.signal });
  assert.equal(writes.length, 0);
});

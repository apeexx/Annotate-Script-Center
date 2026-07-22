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

test("JD Shanghai content keeps a newer request busy when an aborted older request finishes late", async function () {
  let resolveFirst;
  let recommendCount = 0;
  const busy = [];
  const runtime = content.createRuntime({
    location: { hash: "#/annotation/dataset/annotate" }, isEnabled: async function () { return true; },
    createPanel: function () { return { ensureMounted() {}, setBusy(value) { busy.push(value); }, setStatus() {}, fillRecommendedText() {}, remove() {} }; },
    createDataApi: function () { return { start() {}, stop() {}, getCurrentAudio: async function () { return { utteranceId: "1", checksum: "a".repeat(32), audioDataUrl: "data:audio/wav;base64,UklGRg==" }; }, isCurrentSnapshot() { return true; } }; },
    createAiClient: function () { return { recommend: function () { recommendCount += 1; return recommendCount === 1 ? new Promise(function (resolve) { resolveFirst = resolve; }) : new Promise(function () {}); } }; },
  });
  await runtime.evaluatePage();
  const first = runtime.handleRecommend();
  await Promise.resolve();
  await Promise.resolve();
  runtime.stop();
  await runtime.evaluatePage();
  void runtime.handleRecommend();
  resolveFirst({ utteranceId: "1", checksum: "a".repeat(32), listenText: "late", needHumanReview: false, meta: {} });
  await first;
  assert.equal(busy.at(-1), true);
  runtime.stop();
});

test("JD Shanghai content ignores an older enabled evaluation after a newer route exit", async function () {
  let resolveEnabled;
  let mounted = 0;
  const runtime = content.createRuntime({
    location: { hash: "#/annotation/dataset/annotate" }, isEnabled: function () { return new Promise(function (resolve) { resolveEnabled = resolve; }); },
    createPanel: function () { return { ensureMounted() { mounted += 1; }, remove() {} }; }, createDataApi: function () { return { start() {}, stop() {} }; }, createAiClient: function () { return {}; },
  });
  const oldEvaluation = runtime.evaluatePage();
  runtime.location.hash = "#/annotation/dataset/list";
  assert.equal(await runtime.evaluatePage(), false);
  resolveEnabled(true);
  assert.equal(await oldEvaluation, false);
  assert.equal(mounted, 0);
});

test("JD Shanghai content watches only the text field container and removes sensitive error values", async function () {
  const priorObserver = globalThis.MutationObserver;
  let observedTarget = null;
  globalThis.MutationObserver = class { observe(target) { observedTarget = target; } disconnect() {} };
  try {
    const textContainer = { id: "text-container" };
    const runtime = content.createRuntime({
      document: { documentElement: { id: "document-root" } }, location: { hash: "#/annotation/dataset/annotate" }, isEnabled: async function () { return true; },
      createPanel: function () { return { ensureMounted() {}, getMountTarget() { return textContainer; }, remove() {} }; }, createDataApi: function () { return { start() {}, stop() {} }; }, createAiClient: function () { return {}; },
    });
    await runtime.evaluatePage();
    assert.equal(observedTarget, textContainer);
    const message = content.sanitizeError({ message: "data:audio/x-wav;base64,SECRET cookie=COOKIE authorization: Bearer TOKEN signature=SIG https://host.example/file?token=TOKEN secretKey=KEY" });
    assert.equal(/SECRET|COOKIE|TOKEN|SIG|KEY|host\.example/i.test(message), false);
  } finally { globalThis.MutationObserver = priorObserver; }
});

test("JD Shanghai content reports an API failure safely and never fills text", async function () {
  const status = [];
  let writes = 0;
  const runtime = content.createRuntime({
    location: { hash: "#/annotation/dataset/annotate" }, isEnabled: async function () { return true; },
    createPanel: function () { return { ensureMounted() {}, setBusy() {}, setStatus(value) { status.push(value); }, fillRecommendedText() { writes += 1; }, remove() {} }; },
    createDataApi: function () { return { start() {}, stop() {}, getCurrentAudio: async function () { return { utteranceId: "1", checksum: "a".repeat(32), audioDataUrl: "data:audio/wav;base64,UklGRg==" }; }, isCurrentSnapshot() { return true; } }; },
    createAiClient: function () { return { recommend: async function () { throw new Error("authorization=PRIVATE data:audio/x-wav;base64,PRIVATE"); } }; },
  });
  await runtime.evaluatePage();
  await runtime.handleRecommend();
  assert.equal(writes, 0);
  assert.equal(/PRIVATE/i.test(status.join(" ")), false);
});

test("JD Shanghai content never fills a late result after the active request is aborted", async function () {
  let resolveRecommendation;
  let writes = 0;
  const runtime = content.createRuntime({
    location: { hash: "#/annotation/dataset/annotate" }, isEnabled: async function () { return true; },
    createPanel: function () { return { ensureMounted() {}, setBusy() {}, setStatus() {}, fillRecommendedText() { writes += 1; }, remove() {} }; },
    createDataApi: function () { return { start() {}, stop() {}, getCurrentAudio: async function () { return { utteranceId: "1", checksum: "a".repeat(32), audioDataUrl: "data:audio/wav;base64,UklGRg==" }; }, isCurrentSnapshot() { return true; } }; },
    createAiClient: function () { return { recommend: function () { return new Promise(function (resolve) { resolveRecommendation = resolve; }); } }; },
  });
  await runtime.evaluatePage();
  const pending = runtime.handleRecommend();
  await Promise.resolve();
  await Promise.resolve();
  runtime.stop();
  resolveRecommendation({ utteranceId: "1", checksum: "a".repeat(32), listenText: "late", needHumanReview: false, meta: {} });
  await pending;
  assert.equal(writes, 0);
});

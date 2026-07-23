"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const content = require(path.resolve(__dirname, "content.js"));

test("JD Shanghai content reports the preflight step before requesting current WAV", async function () {
  const updates = [];
  let audioCalls = 0;
  const runtime = content.createRuntime({
    location: { hash: "#/annotation/dataset/annotate" },
    isEnabled: async function () { return true; },
    createPanel: function () {
      return {
        ensureMounted() {}, setBusy() {}, setStatus() {}, remove() {},
        updateInfo(value) { updates.push(value); },
      };
    },
    createDataApi: function () {
      return {
        start() {}, stop() {},
        getCurrentAudio: async function () { audioCalls += 1; return null; },
      };
    },
    createAiClient: function () {
      return {
        prepareRun: async function () {
          const error = new Error("请先在 options 首页填写 AI 调用使用人。");
          error.code = "missing-ai-usage-operator-name";
          throw error;
        },
      };
    },
  });

  await runtime.evaluatePage();
  await runtime.handleRecommend();

  assert.equal(audioCalls, 0);
  assert.equal(updates.at(-1).stage, "使用人检查");
  assert.equal(updates.at(-1).status, "失败");
  assert.equal(updates.at(-1).error.code, "missing-ai-usage-operator-name");
});

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

test("JD Shanghai content reports visible success after it fills the current text field", async function () {
  const statuses = [];
  let writes = 0;
  const runtime = content.createRuntime({
    location: { hash: "#/annotation/dataset/annotate" },
    isEnabled: async function () { return true; },
    createPanel: function () {
      return {
        ensureMounted() {}, setBusy() {}, setStatus(message) { statuses.push(message); },
        fillRecommendedText() { writes += 1; return true; }, remove() {},
      };
    },
    createDataApi: function () {
      return {
        start() {}, stop() {},
        getCurrentAudio: async function () { return { utteranceId: "1", checksum: "a".repeat(32), audioDataUrl: "data:audio/wav;base64,UklGRg==" }; },
        isCurrentSnapshot() { return true; },
      };
    },
    createAiClient: function () { return { recommend: async function () { return { utteranceId: "1", checksum: "a".repeat(32), listenText: "侬好", needHumanReview: false, meta: {} }; } }; },
  });

  await runtime.evaluatePage();
  await runtime.handleRecommend();

  assert.equal(writes, 1);
  assert.equal(statuses.at(-1), "识别完成，已回填文本。");
});

test("JD Shanghai content stops at usage-operator validation before fetching WAV or creating a job", async function () {
  let audioCalls = 0;
  let jobCalls = 0;
  const updates = [];
  const runtime = content.createRuntime({
    location: { hash: "#/annotation/dataset/annotate" },
    isEnabled: async function () { return true; },
    createPanel: function () {
      return {
        ensureMounted() {}, setBusy() {}, setStatus() {}, updateInfo(value) { updates.push(value); }, fillRecommendedText() { throw new Error("must not fill"); }, remove() {},
      };
    },
    createDataApi: function () {
      return {
        start() {}, stop() {},
        getCurrentAudio: async function () { audioCalls += 1; return null; },
        isCurrentSnapshot() { return true; },
      };
    },
    createAiClient: function () {
      return {
        prepareRun: async function () {
          const error = new Error("请先填写 AI 调用使用人。");
          error.code = "missing-ai-usage-operator-name";
          error.stage = "validate";
          throw error;
        },
        recommend: async function () { jobCalls += 1; return null; },
      };
    },
  });

  await runtime.evaluatePage();
  await runtime.handleRecommend();

  assert.equal(audioCalls, 0);
  assert.equal(jobCalls, 0);
  assert.equal(updates.at(-1).status, "失败");
  assert.equal(updates.at(-1).stage, "使用人检查");
  assert.equal(updates.at(-1).error.code, "missing-ai-usage-operator-name");
  assert.equal(updates.at(-1).error.summary, "请先填写 AI 调用使用人。");
});

test("JD Shanghai content keeps the current named step when recognition times out before WAV retrieval", async function () {
  const priorSetTimeout = globalThis.setTimeout;
  const priorClearTimeout = globalThis.clearTimeout;
  let timeoutCallback = null;
  let resolvePrepareRun;
  const updates = [];
  const timeoutHandle = { id: "jd-timeout" };
  globalThis.setTimeout = function (callback, delay) {
    if (delay === 60000) {
      timeoutCallback = callback;
      return timeoutHandle;
    }
    return priorSetTimeout(callback, delay);
  };
  globalThis.clearTimeout = function (handle) {
    if (handle !== timeoutHandle) { return priorClearTimeout(handle); }
  };
  try {
    const runtime = content.createRuntime({
      location: { hash: "#/annotation/dataset/annotate" },
      isEnabled: async function () { return true; },
      createPanel: function () {
        return {
          ensureMounted() {}, setBusy() {}, setStatus() {}, updateInfo(value) { updates.push(value); }, fillRecommendedText() { throw new Error("must not fill"); }, remove() {},
        };
      },
      createDataApi: function () { return { start() {}, stop() {}, getCurrentAudio() { throw new Error("must not fetch WAV"); }, isCurrentSnapshot() { return true; } }; },
      createAiClient: function () {
        return {
          prepareRun: function () { return new Promise(function (resolve) { resolvePrepareRun = resolve; }); },
          recommend() { throw new Error("must not create job"); },
        };
      },
    });
    await runtime.evaluatePage();
    const pending = runtime.handleRecommend();
    await Promise.resolve();
    assert.equal(typeof timeoutCallback, "function");
    timeoutCallback();
    resolvePrepareRun({ requestMeta: { aiUsageOperatorName: "测试使用人" } });
    await pending;

    assert.equal(updates.at(-1).status, "失败");
    assert.equal(updates.at(-1).stage, "使用人检查");
    assert.equal(updates.at(-1).error.code, "timeout");
  } finally {
    globalThis.setTimeout = priorSetTimeout;
    globalThis.clearTimeout = priorClearTimeout;
  }
});

test("JD Shanghai content reports all seven safe runtime stages before filling the current text field", async function () {
  const stages = [];
  const updates = [];
  const runtime = content.createRuntime({
    location: { hash: "#/annotation/dataset/annotate" },
    isEnabled: async function () { return true; },
    createPanel: function () {
      return {
        ensureMounted() {}, setBusy() {}, setStatus() {},
        updateInfo(value) { updates.push(value); stages.push(value.stage); },
        fillRecommendedText() { return true; }, remove() {},
      };
    },
    createDataApi: function () {
      return {
        start() {}, stop() {},
        getCurrentAudio: async function () { return { utteranceId: "1", checksum: "a".repeat(32), audioDataUrl: "data:audio/wav;base64,UklGRg==" }; },
        isCurrentSnapshot() { return true; },
      };
    },
    createAiClient: function () {
      return {
        prepareRun: async function () { return { requestMeta: { aiUsageOperatorName: "测试使用人" } }; },
        recommend: async function (_snapshot, options) {
          options.onStage({ key: "create" });
          options.onStage({ key: "poll" });
          return { utteranceId: "1", checksum: "a".repeat(32), listenText: "侬好", needHumanReview: false, meta: {} };
        },
      };
    },
  });

  await runtime.evaluatePage();
  await runtime.handleRecommend();

  assert.deepEqual(stages, ["使用人检查", "获取当前 WAV", "后端健康检查", "创建识别任务", "等待识别结果", "校验当前条", "写入文本框", "写入文本框"]);
  assert.equal(updates.at(-1).status, "成功");
  assert.equal(updates.at(-1).resultText, "侬好");
  assert.equal(updates.at(-1).fillState, "已回填文本");
});

test("JD Shanghai content explains an empty recognition result without filling text", async function () {
  const statuses = [];
  let writes = 0;
  const runtime = content.createRuntime({
    location: { hash: "#/annotation/dataset/annotate" },
    isEnabled: async function () { return true; },
    createPanel: function () {
      return {
        ensureMounted() {}, setBusy() {}, setStatus(message) { statuses.push(message); },
        fillRecommendedText() { writes += 1; return false; }, remove() {},
      };
    },
    createDataApi: function () {
      return {
        start() {}, stop() {},
        getCurrentAudio: async function () { return { utteranceId: "1", checksum: "a".repeat(32), audioDataUrl: "data:audio/wav;base64,UklGRg==" }; },
        isCurrentSnapshot() { return true; },
      };
    },
    createAiClient: function () { return { recommend: async function () { return { utteranceId: "1", checksum: "a".repeat(32), listenText: "", needHumanReview: true, meta: {} }; } }; },
  });

  await runtime.evaluatePage();
  await runtime.handleRecommend();

  assert.equal(writes, 1);
  assert.equal(statuses.at(-1), "未识别到有效文本，请人工复核。");
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

test("JD Shanghai content watches the toolbar container and removes sensitive error values", async function () {
  const priorObserver = globalThis.MutationObserver;
  let observedTarget = null;
  globalThis.MutationObserver = class { observe(target) { observedTarget = target; } disconnect() {} };
  try {
    const toolbarContainer = { id: "toolbar-container" };
    const runtime = content.createRuntime({
      document: { documentElement: { id: "document-root" } }, location: { hash: "#/annotation/dataset/annotate" }, isEnabled: async function () { return true; },
      createPanel: function () { return { ensureMounted() {}, getMountTarget() { return toolbarContainer; }, remove() {} }; }, createDataApi: function () { return { start() {}, stop() {} }; }, createAiClient: function () { return {}; },
    });
    await runtime.evaluatePage();
    assert.equal(observedTarget, toolbarContainer);
    const message = content.sanitizeError({ message: "data:audio/x-wav;base64,SECRET cookie=COOKIE authorization: Bearer TOKEN signature=SIG https://host.example/file?token=TOKEN secretKey=KEY" });
    assert.equal(/SECRET|COOKIE|TOKEN|SIG|KEY|host\.example/i.test(message), false);
  } finally { globalThis.MutationObserver = priorObserver; }
});

test("JD Shanghai content rebinds its observer after the panel falls back to the text field", async function () {
  const priorObserver = globalThis.MutationObserver;
  const observedTargets = [];
  const observers = [];
  globalThis.MutationObserver = class {
    constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
    observe(target) { observedTargets.push(target); }
    disconnect() { this.disconnected = true; }
  };
  try {
    const toolbar = { id: "toolbar" };
    const textField = { id: "text-field" };
    let currentParent = toolbar;
    const runtime = content.createRuntime({
      document: { documentElement: { id: "document-root" } },
      location: { hash: "#/annotation/dataset/annotate" },
      isEnabled: async function () { return true; },
      createPanel: function () {
        return {
          ensureMounted() {},
          getMountTarget() { return currentParent; },
          remove() {},
        };
      },
      createDataApi: function () { return { start() {}, stop() {} }; },
      createAiClient: function () { return {}; },
    });

    await runtime.evaluatePage();
    currentParent = textField;
    observers[0].callback();

    assert.deepEqual(observedTargets, [toolbar, textField]);
    assert.equal(observers[0].disconnected, true);
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

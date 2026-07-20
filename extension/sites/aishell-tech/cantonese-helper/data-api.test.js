"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const modulePath = path.resolve(__dirname, "data-api.js");

function loadApi() {
  delete require.cache[modulePath];
  delete globalThis.__ASREdgeAishellTechCantoneseDataApiInstalled;
  delete globalThis.__ASREdgeAishellTechCantoneseDataApi;
  const api = require(modulePath);
  return {
    api,
    cleanup: function () {
      delete require.cache[modulePath];
      delete globalThis.__ASREdgeAishellTechCantoneseDataApiInstalled;
      delete globalThis.__ASREdgeAishellTechCantoneseDataApi;
    },
  };
}

test("Aishell Cantonese listenText is kept byte-for-byte when building a save payload", function () {
  const harness = loadApi();
  try {
    const listenText = "  廣 東 話　唔好改。  ";
    assert.equal(harness.api.normalizeCantoneseListenText(listenText), listenText);

    const payload = harness.api.buildSaveShortMarkPayload(
      { taskItemId: "mark-item-1", spendTime: 4, duration: 6.3 },
      listenText
    );

    assert.equal(payload.taskItemId, "mark-item-1");
    assert.equal(payload.mark, JSON.stringify({ text: listenText }));
  } finally {
    harness.cleanup();
  }
});

test("Aishell Cantonese reads only the text input and exposes no speed-field API", function () {
  const harness = loadApi();
  try {
    const listenText = "  廣 東 話　唔好改。  ";
    const textInput = {
      tagName: "INPUT",
      value: listenText,
    };
    const speedInput = {
      tagName: "INPUT",
      get value() {
        throw new Error("粤语助手不应读取第二个语速输入框。");
      },
    };
    const createRow = function (labelFor, labelText, input) {
      return {
        textContent: labelText,
        querySelector(selector) {
          if (selector === "label[for]") {
            return {
              textContent: labelText,
              getAttribute(attribute) {
                return attribute === "for" ? labelFor : null;
              },
            };
          }
          if (selector === "input.el-input__inner[type='text']") {
            return input;
          }
          return null;
        },
      };
    };
    const documentLike = {
      querySelectorAll(selector) {
        return selector === ".mark-area .el-form-item"
          ? [
              createRow("text", "文本", textInput),
              createRow("speed", "语速", speedInput),
            ]
          : [];
      },
    };

    assert.equal(harness.api.readDisplayedMarkText(documentLike), listenText);
    assert.equal(harness.api.normalizeCantoneseSpeedValue, undefined);
    assert.equal(harness.api.extractSavedMarkSpeed, undefined);
  } finally {
    harness.cleanup();
  }
});

test("Aishell Cantonese builds an audio URL from dataRoot and url", function () {
  const harness = loadApi();
  try {
    assert.equal(
      harness.api.buildAudioUrl("https://audio.example.test/root/", "/clips/a.wav"),
      "https://audio.example.test/root/clips/a.wav"
    );
  } finally {
    harness.cleanup();
  }
});

test("Aishell Cantonese binds an item key to the exact selected blue segment", function () {
  const harness = loadApi();
  try {
    const item = harness.api.createSegmentBoundItem(
      {
        taskId: "task-1",
        packageId: "package-1",
        taskItemId: "item-1",
        fileName: "sample.wav",
        key: "task-1|package-1|item-1|sample.wav",
      },
      {
        regionId: "region-3",
        segmentNumber: 3,
        startMs: 4650,
        endMs: 5120,
        durationMs: 470,
        selectionKey: "region-3:4650-5120",
      },
      "已填文本"
    );

    assert.equal(item.key, "task-1|package-1|item-1|sample.wav|region-3:4650-5120");
    assert.equal(item.selectionKey, "region-3:4650-5120");
    assert.equal(item.existingMarkText, "已填文本");
  } finally {
    harness.cleanup();
  }
});

test("Aishell Cantonese batches every numbered blue segment in catalog order", async function () {
  const previousGlobals = {
    HTMLElement: globalThis.HTMLElement,
    HTMLInputElement: globalThis.HTMLInputElement,
    document: globalThis.document,
    fetch: globalThis.fetch,
    location: globalThis.location,
    window: globalThis.window,
    __ASREdgeAishellTechCantoneseSegmentAudioClipper: globalThis.__ASREdgeAishellTechCantoneseSegmentAudioClipper,
  };
  class FakeElement {
    constructor() {
      this.classList = { contains: function () { return false; } };
    }
  }
  class FakeInput extends FakeElement {
    constructor() {
      super();
      this.tagName = "INPUT";
      this.value = "";
    }
  }
  class FakeButton extends FakeElement {
    constructor(number, parent) {
      super();
      this.textContent = String(number);
      this.parentElement = parent;
      this.number = number;
    }
    click() {
      selectedNumber = this.number;
    }
  }

  let selectedNumber = 1;
  const catalog = Array.from({ length: 150 }, function (_value, index) {
    const number = index + 1;
    const startMs = number * 1000;
    return {
      regionId: "region-" + number,
      segmentNumber: number,
      startMs,
      endMs: startMs + 500,
      durationMs: 500,
      selectionKey: "region-" + number + ":" + startMs + "-" + (startMs + 500),
    };
  });
  const buttonContainer = { querySelectorAll: function () { return buttons; } };
  const buttons = Array.from({ length: 150 }, function (_value, index) {
    return new FakeButton(index + 1, buttonContainer);
  });
  const input = new FakeInput();
  const textRow = {
    textContent: "文本",
    querySelector(selector) {
      if (selector === "label[for]") {
        return { textContent: "文本", getAttribute(attribute) { return attribute === "for" ? "text" : null; } };
      }
      return selector === "input.el-input__inner[type='text']" ? input : null;
    },
  };
  const listItem = new FakeElement();
  listItem.textContent = "1: sample.wav";
  listItem.querySelector = function () { return new FakeElement(); };
  listItem.classList = { contains: function (name) { return name === "list-item-selected"; } };

  globalThis.HTMLElement = FakeElement;
  globalThis.HTMLInputElement = FakeInput;
  globalThis.location = { hostname: "mark.aishelltech.com", pathname: "/mytask/mark", search: "?taskId=task-1&packageId=package-1" };
  globalThis.window = {
    localStorage: { length: 1, key() { return "token"; }, getItem() { return "a.b.c"; } },
    sessionStorage: { length: 0, key() { return null; }, getItem() { return null; } },
    setTimeout: globalThis.setTimeout,
  };
  globalThis.document = {
    querySelector(selector) {
      return selector === "button.regionSelected" ? buttons[selectedNumber - 1] : null;
    },
    querySelectorAll(selector) {
      if (selector === ".list .list-item, .list .list-item-selected, .list .list-item-finshed") return [listItem];
      if (selector === ".mark-area .el-form-item") return [textRow];
      return [];
    },
  };
  globalThis.fetch = async function (url) {
    if (String(url).endsWith("/api/task/detail/task-1")) {
      return { ok: true, status: 200, json: async function () { return { data: { result: { project: { dataRoot: "https://audio.example.test" } } } }; } };
    }
    if (String(url).endsWith("/api/taskItem/packageItemList/package-1")) {
      return { ok: true, status: 200, json: async function () { return { data: { result: { items: [{ id: "item-1", fileName: "sample.wav", url: "/sample.wav" }] } } }; } };
    }
    throw new Error("unexpected request: " + url);
  };
  globalThis.__ASREdgeAishellTechCantoneseSegmentAudioClipper = {
    getCurrentSegment() { return catalog[selectedNumber - 1]; },
    getSegmentCatalog() { return catalog; },
  };

  const harness = loadApi();
  try {
    const tasks = await harness.api.createRuntime().getBatchSegmentsForCurrentAudio({ mode: "all" });
    assert.equal(tasks.length, 150);
    assert.equal(tasks[0].segmentNumber, 1);
    assert.equal(tasks[2].regionId, "region-3");
    assert.equal(tasks[149].segmentNumber, 150);
  } finally {
    harness.cleanup();
    Object.assign(globalThis, previousGlobals);
  }
});

test("Aishell Cantonese batches sparse catalog numbers through their matching buttons", async function () {
  const previousGlobals = {
    HTMLElement: globalThis.HTMLElement,
    HTMLInputElement: globalThis.HTMLInputElement,
    document: globalThis.document,
    fetch: globalThis.fetch,
    location: globalThis.location,
    window: globalThis.window,
    __ASREdgeAishellTechCantoneseSegmentAudioClipper: globalThis.__ASREdgeAishellTechCantoneseSegmentAudioClipper,
  };
  class FakeElement {
    constructor() {
      this.classList = { contains: function () { return false; } };
    }
  }
  class FakeInput extends FakeElement {
    constructor() {
      super();
      this.tagName = "INPUT";
      this.value = "";
    }
  }
  class FakeButton extends FakeElement {
    constructor(number, parent) {
      super();
      this.textContent = String(number);
      this.parentElement = parent;
      this.number = number;
    }
    click() {
      selectedNumber = this.number;
      clickedNumbers.push(this.number);
    }
  }

  let selectedNumber = 1;
  const clickedNumbers = [];
  const catalog = [1, 3].map(function (number) {
    const startMs = number * 1000;
    return {
      regionId: "region-" + number,
      segmentNumber: number,
      startMs,
      endMs: startMs + 500,
      durationMs: 500,
      selectionKey: "region-" + number + ":" + startMs + "-" + (startMs + 500),
    };
  });
  const buttonContainer = { querySelectorAll: function () { return buttons; } };
  const buttons = [1, 2, 3].map(function (number) {
    return new FakeButton(number, buttonContainer);
  });
  const input = new FakeInput();
  const textRow = {
    textContent: "text",
    querySelector(selector) {
      if (selector === "label[for]") {
        return { textContent: "text", getAttribute(attribute) { return attribute === "for" ? "text" : null; } };
      }
      return selector === "input.el-input__inner[type='text']" ? input : null;
    },
  };
  const listItem = new FakeElement();
  listItem.textContent = "1: sample.wav";
  listItem.querySelector = function () { return new FakeElement(); };
  listItem.classList = { contains: function (name) { return name === "list-item-selected"; } };

  globalThis.HTMLElement = FakeElement;
  globalThis.HTMLInputElement = FakeInput;
  globalThis.location = { hostname: "mark.aishelltech.com", pathname: "/mytask/mark", search: "?taskId=task-1&packageId=package-1" };
  globalThis.window = {
    localStorage: { length: 1, key() { return "token"; }, getItem() { return "a.b.c"; } },
    sessionStorage: { length: 0, key() { return null; }, getItem() { return null; } },
    setTimeout: globalThis.setTimeout,
  };
  globalThis.document = {
    querySelector(selector) {
      return selector === "button.regionSelected" ? buttons.find(function (button) { return button.number === selectedNumber; }) : null;
    },
    querySelectorAll(selector) {
      if (selector === ".list .list-item, .list .list-item-selected, .list .list-item-finshed") return [listItem];
      if (selector === ".mark-area .el-form-item") return [textRow];
      return [];
    },
  };
  globalThis.fetch = async function (url) {
    if (String(url).endsWith("/api/task/detail/task-1")) {
      return { ok: true, status: 200, json: async function () { return { data: { result: { project: { dataRoot: "https://audio.example.test" } } } }; } };
    }
    if (String(url).endsWith("/api/taskItem/packageItemList/package-1")) {
      return { ok: true, status: 200, json: async function () { return { data: { result: { items: [{ id: "item-1", fileName: "sample.wav", url: "/sample.wav" }] } } }; } };
    }
    throw new Error("unexpected request: " + url);
  };
  globalThis.__ASREdgeAishellTechCantoneseSegmentAudioClipper = {
    getCurrentSegment() { return catalog.find(function (segment) { return segment.segmentNumber === selectedNumber; }); },
    getSegmentCatalog() { return catalog; },
  };

  const harness = loadApi();
  try {
    const tasks = await harness.api.createRuntime().getBatchSegmentsForCurrentAudio({ mode: "pending" });
    assert.deepEqual(tasks.map(function (task) { return task.segmentNumber; }), [1, 3]);
    assert.deepEqual(tasks.map(function (task) { return task.index; }), [0, 0]);
    assert.deepEqual(clickedNumbers, [3]);
  } finally {
    harness.cleanup();
    Object.assign(globalThis, previousGlobals);
  }
});

test("Aishell Cantonese does not fill or save when stopped while current-item loading is pending", async function () {
  const previousGlobals = {
    HTMLElement: globalThis.HTMLElement,
    HTMLButtonElement: globalThis.HTMLButtonElement,
    HTMLInputElement: globalThis.HTMLInputElement,
    document: globalThis.document,
    fetch: globalThis.fetch,
    location: globalThis.location,
    window: globalThis.window,
  };
  class FakeElement {
    constructor() {
      this.classList = { contains: function () { return false; } };
    }
  }
  class FakeButton extends FakeElement {
    constructor() {
      super();
      this.disabled = false;
      this.textContent = "保存";
      this.clickCount = 0;
    }
    focus() {}
    click() {
      this.clickCount += 1;
    }
  }
  class FakeInput extends FakeElement {
    constructor() {
      super();
      this.tagName = "INPUT";
      this.value = "未写入";
    }
    focus() {}
    dispatchEvent() {}
  }

  const input = new FakeInput();
  const saveButton = new FakeButton();
  let resolveTaskDetail;
  const taskDetailPending = new Promise(function (resolve) {
    resolveTaskDetail = resolve;
  });
  const textRow = {
    textContent: "文本",
    querySelector(selector) {
      if (selector === "label[for]") {
        return {
          textContent: "文本",
          getAttribute(attribute) {
            return attribute === "for" ? "text" : null;
          },
        };
      }
      return selector === "input.el-input__inner[type='text']" ? input : null;
    },
  };
  const listItem = new FakeElement();
  listItem.textContent = "1: sample.wav";
  listItem.classList = { contains: function (name) { return name === "list-item-selected"; } };
  listItem.querySelector = function () {
    return new FakeElement();
  };

  globalThis.HTMLElement = FakeElement;
  globalThis.HTMLButtonElement = FakeButton;
  globalThis.HTMLInputElement = FakeInput;
  globalThis.location = {
    hostname: "mark.aishelltech.com",
    pathname: "/mytask/mark",
    search: "?taskId=task-1&packageId=package-1",
  };
  globalThis.window = {
    localStorage: {
      length: 1,
      key: function () { return "token"; },
      getItem: function () { return "a.b.c"; },
    },
    sessionStorage: { length: 0, key: function () { return null; }, getItem: function () { return null; } },
    setTimeout: globalThis.setTimeout,
  };
  globalThis.document = {
    querySelector: function () { return null; },
    querySelectorAll(selector) {
      if (selector === ".list .list-item, .list .list-item-selected, .list .list-item-finshed") {
        return [listItem];
      }
      if (selector === ".mark-area .el-form-item") {
        return [textRow];
      }
      if (selector === ".mark-area button.el-button--primary") {
        return [saveButton];
      }
      return [];
    },
  };
  globalThis.fetch = async function (url) {
    if (String(url).endsWith("/api/task/detail/task-1")) {
      return taskDetailPending;
    }
    if (String(url).endsWith("/api/taskItem/packageItemList/package-1")) {
      return {
        ok: true,
        status: 200,
        json: async function () {
          return { data: { result: { items: [{ id: "item-1", fileName: "sample.wav" }] } } };
        },
      };
    }
    throw new Error("unexpected request: " + url);
  };

  const harness = loadApi();
  try {
    const controller = new AbortController();
    const savePromise = harness.api.createRuntime().fillAndSaveCurrent("新的粤语文本", {
      signal: controller.signal,
      postFillDelayMs: 1,
    });
    controller.abort();
    resolveTaskDetail({
      ok: true,
      status: 200,
      json: async function () {
        return { data: { result: { project: { dataRoot: "https://audio.example.test" } } } };
      },
    });

    const result = await savePromise;
    assert.equal(result.ok, false);
    assert.equal(input.value, "未写入");
    assert.equal(saveButton.clickCount, 0);
  } finally {
    harness.cleanup();
    Object.assign(globalThis, previousGlobals);
  }
});

test("Aishell Cantonese validates the selected item and blue segment again immediately before native save", function () {
  const source = fs.readFileSync(path.resolve(__dirname, "data-api.js"), "utf8");
  const fillStart = source.indexOf("async function fillAndSaveCurrent(value, options)");
  const fillBlock = source.slice(fillStart, source.indexOf("function stop()", fillStart));
  const saveStart = source.indexOf("async function clickSaveAndWait(options)");
  const saveBlock = source.slice(saveStart, fillStart);

  assert.match(fillBlock, /expectedSelectedIndex/);
  assert.match(fillBlock, /validateBeforeSave/);
  assert.match(saveBlock, /validateBeforeSave/);
  assert.match(saveBlock, /options\.validateBeforeSave\(\)/);
});

test("Aishell Cantonese rechecks the actual task item after a same-index route change before native save", function () {
  const source = fs.readFileSync(path.resolve(__dirname, "data-api.js"), "utf8");
  const targetStart = source.indexOf("async function assertExpectedSaveTarget(options)");
  const targetBlock = source.slice(targetStart, source.indexOf("async function clickSaveAndWait(options)", targetStart));
  const saveStart = source.indexOf("async function clickSaveAndWait(options)");
  const saveBlock = source.slice(saveStart, source.indexOf("async function fillAndSaveCurrent(value, options)", saveStart));

  assert.match(targetBlock, /async function assertExpectedSaveTarget\(options\)/);
  assert.match(targetBlock, /await getCurrentBaseItem\(\)/);
  assert.match(targetBlock, /currentItem\?\.taskItemId !== expectedTaskItemId/);
  assert.match(saveBlock, /await options\.validateBeforeSave\(\)/);
});

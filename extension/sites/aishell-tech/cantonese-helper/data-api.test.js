"use strict";

const assert = require("node:assert/strict");
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

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const dataApiModulePath = path.resolve(__dirname, "data-api.js");

function loadApi() {
  delete require.cache[dataApiModulePath];
  delete globalThis.__ASREdgeAishellTechVietnameseDataApiInstalled;
  delete globalThis.__ASREdgeAishellTechVietnameseDataApi;
  const api = require(dataApiModulePath);
  return {
    api,
    cleanup: function () {
      delete require.cache[dataApiModulePath];
      delete globalThis.__ASREdgeAishellTechVietnameseDataApiInstalled;
      delete globalThis.__ASREdgeAishellTechVietnameseDataApi;
    },
  };
}

function createLabel(forValue, text) {
  return {
    textContent: text,
    getAttribute: function (name) {
      return String(name) === "for" ? forValue : "";
    },
  };
}

function createRow(labelFor, labelText, inputNode) {
  return {
    textContent: labelText,
    querySelector: function (selector) {
      if (selector === "label[for]") {
        return createLabel(labelFor, labelText);
      }
      if (selector === "input.el-input__inner[type='text']") {
        return inputNode;
      }
      return null;
    },
  };
}

test("Aishell Vietnamese text normalization keeps words and fixes punctuation spacing", function () {
  const harness = loadApi();

  try {
    const normalize = harness.api.normalizeVietnameseTranscriptionText;
    assert.equal(normalize("  Tiếng   từ máy chiếu  . "), "Tiếng từ máy chiếu.");
    assert.equal(normalize("Xin chào ,tôi là AI"), "Xin chào, tôi là AI.");
    assert.equal(normalize(" ( xin  chào ) "), "(xin chào).");
  } finally {
    harness.cleanup();
  }
});

test("Aishell Vietnamese speed normalization keeps the shared platform enum", function () {
  const harness = loadApi();

  try {
    const normalize = harness.api.normalizeVietnameseSpeedValue;
    assert.equal(normalize("slow"), "slow");
    assert.equal(normalize("慢速"), "slow");
    assert.equal(normalize("正常"), "normal");
    assert.equal(normalize("快速"), "fast");
  } finally {
    harness.cleanup();
  }
});

test("Aishell Vietnamese field lookup resolves text and speed inputs by for attribute", function () {
  const harness = loadApi();

  try {
    const textInput = { id: "text-input" };
    const speedInput = { id: "speed-input" };
    const documentLike = {
      querySelectorAll: function (selector) {
        assert.equal(selector, ".mark-area .el-form-item");
        return [
          createRow("text", "文本", textInput),
          createRow("speed", "语速", speedInput),
        ];
      },
    };

    const fields = harness.api.findMarkFieldInputs(documentLike);
    assert.equal(fields.text, textInput);
    assert.equal(fields.speed, speedInput);
  } finally {
    harness.cleanup();
  }
});

test("Aishell Vietnamese displayed fields keep raw speed text for result hints", function () {
  const harness = loadApi();

  try {
    const documentLike = {
      querySelectorAll: function () {
        return [
          createRow("text", "文本", { value: "Xin chào.", tagName: "INPUT" }),
          createRow("speed", "语速", { value: "正常", tagName: "INPUT" }),
        ];
      },
    };

    assert.deepEqual(harness.api.readDisplayedMarkFieldValues(documentLike), {
      text: "Xin chào.",
      speed: "正常",
    });
  } finally {
    harness.cleanup();
  }
});

test("Aishell Vietnamese save payload keeps normalized text and speed fields", function () {
  const harness = loadApi();

  try {
    const payload = harness.api.buildSaveShortMarkPayload(
      {
        taskItemId: "mark-item-1",
        spendTime: 4,
        duration: 6.3,
      },
      {
        text: " Xin  chào ",
        speed: "正常",
      }
    );

    assert.equal(
      payload.mark,
      JSON.stringify({
        text: "Xin chào.",
        speed: "normal",
      })
    );
    assert.equal(payload.taskItemId, "mark-item-1");
  } finally {
    harness.cleanup();
  }
});

test("Aishell Vietnamese route params expose the check scene", function () {
  const previousLocation = globalThis.location;
  globalThis.location = {
    search: "?taskId=task-1&packageId=package-1&scene=check",
  };
  const harness = loadApi();

  try {
    assert.deepEqual(harness.api.parseRouteParams(), {
      taskId: "task-1",
      packageId: "package-1",
      scene: "check",
    });
  } finally {
    harness.cleanup();
    if (previousLocation === undefined) {
      delete globalThis.location;
    } else {
      globalThis.location = previousLocation;
    }
  }
});

test("Aishell Vietnamese package list path follows the page scene", function () {
  const harness = loadApi();

  try {
    assert.equal(
      harness.api.buildPackageItemsPath("package 1", "mark"),
      "/api/taskItem/packageItemList/package%201"
    );
    assert.equal(
      harness.api.buildPackageItemsPath("package 1", "check"),
      "/api/taskItem/checkPackageItemList/package%201"
    );
  } finally {
    harness.cleanup();
  }
});

test("Aishell Vietnamese check records use markTaskItemId and keep sparse numbers", function () {
  const harness = loadApi();

  try {
    const first = harness.api.normalizePackageItemRecord(
      {
        id: "check-item-1",
        markTaskItemId: "mark-item-1",
        number: 3,
        fileName: "sample-003.wav",
        url: "/sample/sample-003.wav",
        dataRoot: "https://item-audio.example.test",
        text: "",
        dataStatus: 0,
        checkStatus: 1,
      },
      0,
      "check"
    );
    const second = harness.api.normalizePackageItemRecord(
      {
        id: "check-item-2",
        markTaskItemId: "mark-item-2",
        number: 5,
        fileName: "sample-005.wav",
        url: "/sample/sample-005.wav",
        dataStatus: 0,
        checkStatus: 0,
      },
      1,
      "check"
    );

    assert.equal(first.id, "mark-item-1");
    assert.equal(first.taskItemId, "mark-item-1");
    assert.equal(first.sourceItemId, "check-item-1");
    assert.equal(first.scene, "check");
    assert.equal(first.number, 3);
    assert.equal(first.dataRoot, "https://item-audio.example.test");

    assert.deepEqual(
      harness.api.createBatchTasksFromPackageItems([first, second], { mode: "all" }).map(
        function (task) {
          return {
            index: task.index,
            taskItemId: task.taskItemId,
            number: task.number,
          };
        }
      ),
      [
        { index: 0, taskItemId: "mark-item-1", number: 3 },
        { index: 1, taskItemId: "mark-item-2", number: 5 },
      ]
    );
  } finally {
    harness.cleanup();
  }
});

test("Aishell Vietnamese check records never use the check item id for writes", function () {
  const harness = loadApi();

  try {
    const record = harness.api.normalizePackageItemRecord(
      {
        id: "check-only-id",
        markTaskItemId: "",
        number: 1,
        fileName: "sample.wav",
        url: "/sample.wav",
      },
      0,
      "check"
    );

    assert.equal(record.sourceItemId, "check-only-id");
    assert.equal(record.id, "");
    assert.equal(record.taskItemId, "");
  } finally {
    harness.cleanup();
  }
});

test("Aishell Vietnamese audio URL joins and encodes a relative Unicode path", function () {
  const harness = loadApi();

  try {
    assert.equal(
      harness.api.buildAudioUrl(
        "https://audio.example.test",
        "/三语种-越南语/sample.wav"
      ),
      "https://audio.example.test/%E4%B8%89%E8%AF%AD%E7%A7%8D-%E8%B6%8A%E5%8D%97%E8%AF%AD/sample.wav"
    );
  } finally {
    harness.cleanup();
  }
});

test("Aishell Vietnamese audio root prefers the item then task then platform default", function () {
  const harness = loadApi();

  try {
    assert.equal(
      harness.api.resolveAudioRoot(
        "https://item-audio.example.test",
        "https://task-audio.example.test"
      ),
      "https://item-audio.example.test"
    );
    assert.equal(
      harness.api.resolveAudioRoot("", "https://task-audio.example.test"),
      "https://task-audio.example.test"
    );
    assert.equal(
      harness.api.resolveAudioRoot("", ""),
      "https://bpp-collect.oss-cn-hangzhou.aliyuncs.com"
    );
  } finally {
    harness.cleanup();
  }
});

test("Aishell Vietnamese reference text falls back to the rendered page", function () {
  const harness = loadApi();

  try {
    assert.equal(
      harness.api.resolveReferenceText("", "  Vui lòng bật tất cả đèn.  "),
      "Vui lòng bật tất cả đèn."
    );
    assert.equal(
      harness.api.resolveReferenceText("Dữ liệu phản hồi", "Dữ liệu trang"),
      "Dữ liệu phản hồi"
    );
  } finally {
    harness.cleanup();
  }
});

test("Aishell Vietnamese pending batch uses scene-specific completion status", function () {
  const harness = loadApi();

  try {
    const tasks = harness.api.createBatchTasksFromPackageItems(
      [
        { id: "check-pass", number: 3, scene: "check", checkStatus: 1, dataStatus: 0 },
        { id: "check-fail", number: 5, scene: "check", checkStatus: 2, dataStatus: 0 },
        { id: "check-pending", number: 8, scene: "check", checkStatus: 0, dataStatus: 0 },
        { id: "mark-done", number: 1, scene: "mark", checkStatus: 0, dataStatus: 2 },
        { id: "mark-pending", number: 2, scene: "mark", checkStatus: 0, dataStatus: 0 },
      ],
      { mode: "pending" }
    );

    assert.deepEqual(
      tasks.map(function (task) {
        return task.taskItemId;
      }),
      ["check-pending", "mark-pending"]
    );
  } finally {
    harness.cleanup();
  }
});

test("Aishell Vietnamese save lookup stays inside the mark area", function () {
  const harness = loadApi();
  const markSaveButton = { textContent: "保存" };
  const checkSaveButton = { textContent: "保存" };
  const selectors = [];
  const documentLike = {
    querySelectorAll(selector) {
      selectors.push(selector);
      if (selector === ".mark-area button.el-button--primary") {
        return [markSaveButton];
      }
      if (selector === "button") {
        return [markSaveButton, checkSaveButton];
      }
      return [];
    },
  };

  try {
    assert.equal(harness.api.findMarkSaveButton(documentLike), markSaveButton);
    assert.deepEqual(selectors, [".mark-area button.el-button--primary"]);
  } finally {
    harness.cleanup();
  }
});

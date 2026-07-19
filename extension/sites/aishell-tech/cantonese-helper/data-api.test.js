"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const modulePath = path.resolve(__dirname, "data-api.js");

function loadDataApi() {
  delete globalThis.__ASREdgeAishellTechCantoneseDataApiInstalled;
  delete globalThis.__ASREdgeAishellTechCantoneseDataApi;
  delete require.cache[modulePath];
  require(modulePath);
  return globalThis.__ASREdgeAishellTechCantoneseDataApi;
}

test.afterEach(function () {
  delete globalThis.__ASREdgeAishellTechCantoneseDataApiInstalled;
  delete globalThis.__ASREdgeAishellTechCantoneseDataApi;
  delete require.cache[modulePath];
});

test("Cantonese data API keeps Traditional Cantonese wording and normalizes CJK punctuation", function () {
  const api = loadDataApi();

  assert.equal(
    api.normalizeCantoneseTranscriptionText("  佢哋\u3000話 ：\u3000「hello  ,world! 」  "),
    "佢哋話：「hello，world！」"
  );
  assert.equal(api.normalizeCantoneseTranscriptionText("唔該晒...\n下次見"), "唔該晒…下次見");
});

test("Cantonese data API maps localized speed labels to the three persisted values", function () {
  const api = loadDataApi();

  assert.equal(api.normalizeCantoneseSpeedValue("慢速"), "slow");
  assert.equal(api.normalizeCantoneseSpeedValue("正常"), "normal");
  assert.equal(api.normalizeCantoneseSpeedValue("快"), "fast");
});

test("Cantonese data API locates text and speed fields and saves both values", function () {
  const api = loadDataApi();
  const textInput = { id: "text-input", value: "" };
  const speedInput = { id: "speed-input", value: "" };
  const documentLike = {
    querySelectorAll: function (selector) {
      assert.equal(selector, ".mark-area .el-form-item");
      return [
        {
          textContent: "文本",
          querySelector: function (query) {
            if (query === "label[for]") {
              return {
                getAttribute: function () { return "text"; },
                textContent: "文本",
              };
            }
            return query === "input.el-input__inner[type='text']" ? textInput : null;
          },
        },
        {
          textContent: "语速",
          querySelector: function (query) {
            if (query === "label[for]") {
              return {
                getAttribute: function () { return "speed"; },
                textContent: "语速",
              };
            }
            return query === "input.el-input__inner[type='text']" ? speedInput : null;
          },
        },
      ];
    },
  };

  const fields = api.findMarkFieldInputs(documentLike);
  const payload = api.buildSaveShortMarkPayload(
    { taskItemId: "item-cantonese", spendTime: 2, duration: 5.1 },
    { text: "佢哋話：hello，world！", speed: "快" }
  );

  assert.equal(fields.text, textInput);
  assert.equal(fields.speed, speedInput);
  assert.equal(
    payload.mark,
    JSON.stringify({ text: "佢哋話：hello，world！", speed: "fast" })
  );
  assert.equal(payload.scene, "mark");
});

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

require("./shortcuts-runtime.js");

test("Magic Data hakka shortcut actions include toggle auto run", function () {
  const actionDefinitions =
    globalThis.__ASREdgeMagicDataHakkaShortcuts?.ACTION_DEFINITIONS || [];

  assert.equal(
    actionDefinitions.some(function (item) {
      return item?.key === "toggleAutoRun";
    }),
    true
  );
});

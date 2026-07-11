"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { formatLexiconStatusAndMode } = require("./lexicon-display.js");

test("lexicon display formats default status and rewrite mode", function () {
  assert.equal(
    formatLexiconStatusAndMode(
      {
        status: "ready",
        rewriteMode: "aggressive",
      },
      {
        scriptType: "default",
      }
    ),
    "主词表已加载 / 固定携带 / 改写模式 aggressive"
  );
});

test("lexicon display returns empty string when lexicon payload is absent", function () {
  assert.equal(
    formatLexiconStatusAndMode(null, {
      scriptType: "default",
    }),
    ""
  );
});

"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const lexiconModule = require("./ai-lexicon.js");

test("Magic Data Hakka runtime lexicon JSON loads as ready", function () {
  lexiconModule.__test__?.resetLexiconStateCache?.();
  const state = lexiconModule.getLexiconState();
  assert.equal(state.status, "ready");
  assert.equal(state.enabled, true);
  assert.ok(Array.isArray(state.rows));
  assert.ok(state.rows.length > 0);
});

test("Magic Data Hakka exact rewrite prefers lexicon rules over fallback mappings", function () {
  const helper = lexiconModule.__test__?.applyFinalSuggestionRewrite;
  assert.equal(typeof helper, "function");

  const result = helper("嘅", {
    mode: "exact",
    lexiconEntries: [
      {
        id: "custom-1",
        normalized: "該",
        display: "該",
        mandarin: "那",
        aliases: ["嘅"],
        notes: [],
        tags: [],
        attributes: {},
      },
    ],
  });

  assert.equal(result.text, "該");
  assert.equal(result.changed, true);
  assert.deepEqual(result.changes[0], {
    from: "嘅",
    to: "該",
    source: "lexicon",
    reason: "命中客家话词表精确正字归一化",
  });
});

test("Magic Data Hakka exact rewrite uses longest match first", function () {
  const helper = lexiconModule.__test__?.applyFinalSuggestionRewrite;
  assert.equal(typeof helper, "function");

  const result = helper("這個", {
    mode: "exact",
    lexiconEntries: [],
    fallbackRules: [
      {
        from: "這個",
        to: "𠮶个",
      },
      {
        from: "這",
        to: "𠮶",
      },
    ],
  });

  assert.equal(result.text, "𠮶个");
  assert.equal(result.changed, true);
  assert.equal(result.changes.length, 1);
});

test("Magic Data Hakka exact rewrite fixes known orthography mismatches", function () {
  const helper = lexiconModule.__test__?.applyFinalSuggestionRewrite;
  assert.equal(typeof helper, "function");

  const result = helper("涯系嘅没给这很", {
    mode: "exact",
  });

  assert.equal(result.text, "𠊎係个冇畀𠮶咹");
  assert.equal(result.changed, true);
});

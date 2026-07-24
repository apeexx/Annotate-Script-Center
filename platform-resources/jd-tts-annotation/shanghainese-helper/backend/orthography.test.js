"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const orthography = require(path.resolve(__dirname, "orthography.js"));

function createLexicon(entries) {
  return {
    schemaVersion: 1,
    language: "shanghainese",
    mode: "exact_alias_to_canonical",
    sourceFiles: ["上海方言正字表最新.xlsx#分类汇总表"],
    updatedAt: "2026-07-24T00:00:00.000Z",
    entries,
  };
}

function createEntry(id, canonical, aliases) {
  return {
    id,
    normalized: canonical,
    display: canonical,
    mandarin: "",
    aliases,
    notes: [],
    tags: [],
    attributes: {},
  };
}

function createRuntimeWithLexicon(lexicon) {
  return orthography.createOrthographyRuntime({
    readFileSync: function () { return JSON.stringify(lexicon); },
    lexiconPath: "memory.json",
  });
}

test("Shanghai orthography replaces only explicit aliases with longest match first", function () {
  const runtime = createRuntimeWithLexicon(createLexicon([
    createEntry("word-1", "讲闲话", ["闲话体"]),
    createEntry("word-2", "闲字", ["闲"]),
  ]));

  assert.deepEqual(runtime.normalizeListenText("闲话体闲"), {
    rawListenText: "闲话体闲",
    listenText: "讲闲话闲字",
    orthography: { status: "applied", replacementCount: 2 },
  });
});

test("Shanghai orthography preserves unmatched whitespace, punctuation, Unicode, and the raw provider text", function () {
  const runtime = createRuntimeWithLexicon(createLexicon([
    createEntry("word-1", "侬", ["农"]),
  ]));

  assert.deepEqual(runtime.normalizeListenText(" 农，\nＡ🙂！ "), {
    rawListenText: " 农，\nＡ🙂！ ",
    listenText: " 侬，\nＡ🙂！ ",
    orthography: { status: "applied", replacementCount: 1 },
  });
});

test("Shanghai orthography keeps text unchanged when a valid lexicon has no matching alias", function () {
  const runtime = createRuntimeWithLexicon(createLexicon([
    createEntry("word-1", "侬", ["农"]),
  ]));

  assert.deepEqual(runtime.normalizeListenText("你好，上海！"), {
    rawListenText: "你好，上海！",
    listenText: "你好，上海！",
    orthography: { status: "no-match", replacementCount: 0 },
  });
});

test("Shanghai orthography safely keeps the provider text when the lexicon is missing or invalid", function () {
  const missingRuntime = orthography.createOrthographyRuntime({
    readFileSync: function () {
      const error = new Error("missing");
      error.code = "ENOENT";
      throw error;
    },
    lexiconPath: "missing.json",
  });
  const invalidRuntime = createRuntimeWithLexicon(createLexicon([
    createEntry("word-1", "侬", ["农"]),
    createEntry("word-2", "倷", ["农"]),
  ]));

  assert.deepEqual(missingRuntime.normalizeListenText("原样 文本"), {
    rawListenText: "原样 文本",
    listenText: "原样 文本",
    orthography: { status: "missing", replacementCount: 0 },
  });
  assert.deepEqual(invalidRuntime.normalizeListenText("农"), {
    rawListenText: "农",
    listenText: "农",
    orthography: { status: "invalid", replacementCount: 0 },
  });
});

test("Shanghai orthography rejects whitespace-only aliases without changing provider spaces", function () {
  const runtime = createRuntimeWithLexicon(createLexicon([
    createEntry("word-1", "侬", [" "]),
  ]));

  assert.deepEqual(runtime.normalizeListenText("甲 乙"), {
    rawListenText: "甲 乙",
    listenText: "甲 乙",
    orthography: { status: "invalid", replacementCount: 0 },
  });
});

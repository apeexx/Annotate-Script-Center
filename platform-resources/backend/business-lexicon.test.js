"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  findFirstExistingReferenceFile,
  loadBusinessLexiconSource,
  loadBusinessLexiconJson,
  validateBusinessLexiconDocument,
} = require("./business-lexicon");

function createTempJsonFile(content) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "asc-business-lexicon-"));
  const filePath = path.join(tempDir, "lexicon.json");
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2), "utf8");
  return filePath;
}

test("validateBusinessLexiconDocument accepts normalized JSON lexicon entries", function () {
  const result = validateBusinessLexiconDocument({
    schemaVersion: "1",
    language: "minnan",
    mode: "rule_lexicon",
    sourceFiles: ["reference/minnan-lexicon.csv"],
    updatedAt: "2026-06-09T00:00:00.000Z",
    entries: [
      {
        id: "mn-001",
        normalized: "伊",
        display: "伊",
        mandarin: "他",
        aliases: ["  㑛  ", "伊"],
        notes: ["第三人称"],
        tags: ["pronoun"],
      },
    ],
  });

  assert.equal(result.entries.length, 1);
  assert.deepEqual(result.entries[0], {
    id: "mn-001",
    normalized: "伊",
    display: "伊",
    mandarin: "他",
    aliases: ["㑛", "伊"],
    notes: ["第三人称"],
    tags: ["pronoun"],
    attributes: {},
  });
});

test("validateBusinessLexiconDocument rejects duplicate ids and empty mandarin", function () {
  assert.throws(function () {
    validateBusinessLexiconDocument({
      schemaVersion: "1",
      language: "sample_dialect",
      mode: "rule_lexicon",
      sourceFiles: ["reference/sample-pronunciation-reference.csv"],
      updatedAt: "2026-06-09T00:00:00.000Z",
      entries: [
        {
          id: "sample-001",
          normalized: "挨",
          display: "挨",
          mandarin: "被",
          aliases: [],
          notes: [],
          tags: [],
        },
        {
          id: "sample-001",
          normalized: "吗喽",
          display: "吗喽",
          mandarin: "",
          aliases: [],
          notes: [],
          tags: [],
        },
      ],
    });
  }, /duplicate entry id|mandarin/i);
});

test("loadBusinessLexiconJson reports invalid schema errors with stable status", function () {
  const filePath = createTempJsonFile({
    schemaVersion: "1",
    language: "hakka",
    mode: "rule_lexicon",
    sourceFiles: [],
    updatedAt: "2026-06-09T00:00:00.000Z",
    entries: [
      {
        id: "hk-001",
        normalized: "你",
        display: "你",
        mandarin: "你",
        aliases: "not-an-array",
        notes: [],
        tags: [],
      },
    ],
  });

  const state = loadBusinessLexiconJson(filePath);
  assert.equal(state.enabled, false);
  assert.equal(state.status, "invalid");
  assert.match(state.errorMessage || "", /aliases/i);
});

test("findFirstExistingReferenceFile returns the first local reference source", function () {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "asc-business-lexicon-ref-"));
  const csvPath = path.join(tempDir, "reference.csv");
  fs.writeFileSync(csvPath, "词,义\n", "utf8");

  assert.equal(
    findFirstExistingReferenceFile([
      path.join(tempDir, "missing.csv"),
      csvPath,
    ]),
    csvPath
  );
});

test("loadBusinessLexiconSource degrades to reference_only only when local csv exists", function () {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "asc-business-lexicon-source-"));
  const csvPath = path.join(tempDir, "reference.csv");
  fs.writeFileSync(csvPath, "词,义\n", "utf8");
  const missingJsonPath = path.join(tempDir, "missing.json");

  const referenceOnlyState = loadBusinessLexiconSource(missingJsonPath, {
    referencePaths: [csvPath],
    warningMessage: "没有字词对应表",
  });
  const missingState = loadBusinessLexiconSource(missingJsonPath, {
    referencePaths: [path.join(tempDir, "missing-reference.csv")],
    warningMessage: "没有字词对应表",
  });

  assert.equal(referenceOnlyState.enabled, false);
  assert.equal(referenceOnlyState.status, "reference_only");
  assert.equal(referenceOnlyState.referenceExists, true);
  assert.equal(referenceOnlyState.referenceFilePath, csvPath);
  assert.equal(referenceOnlyState.warningMessage, "没有字词对应表");
  assert.equal(missingState.status, "missing");
  assert.equal(missingState.referenceExists, false);
  assert.equal(missingState.warningMessage, "");
});

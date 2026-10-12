"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { DatabaseSync } = require("node:sqlite");
const { importLexicons, loadLexicon } = require("./lexicon-database");
const { defaultSources, minnanCsvDocument, parseCsv } = require("../../scripts/import-lexicons");

function tempDb(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asc-sqlite-test-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return path.join(directory, "lexicons.sqlite");
}

test("all source fields, order and platform identities survive SQLite round trip", (t) => {
  const dbPath = tempDb(t);
  const items = defaultSources().map((item) => ({ key: item.key, document: item.load() }));
  assert.deepEqual(importLexicons(items, { dbPath }).map((row) => row.count), [529, 529, 690, 562, 0]);
  for (const item of items) {
    const actual = loadLexicon(item.key, { dbPath });
    assert.equal(actual.status, "ready");
    assert.deepEqual(actual.document, item.document);
  }
  assert.equal(loadLexicon("unregistered-platform", { dbPath }).status, "missing");
  const csvEntry = loadLexicon("magic-data/minnan-helper", { dbPath }).entries.find((entry) => entry.id === "mn-552");
  assert.equal(csvEntry.mandarin, "");
  assert.equal(csvEntry.display, "安怎=按怎");
});

test("repeat imports skip source reads; explicit replacement is isolated and failures roll back", (t) => {
  const dbPath = tempDb(t);
  const items = defaultSources().slice(0, 2).map((item) => ({ key: item.key, document: item.load() }));
  importLexicons(items, { dbPath });
  assert.equal(importLexicons([{ key: items[0].key, load() { throw new Error("must not read"); } }], { dbPath })[0].status, "skipped");
  const changed = structuredClone(items[0]);
  changed.document.entries[0].display = "测试用字";
  const invalid = structuredClone(items[1]);
  invalid.document.entries.push(invalid.document.entries[0]);
  assert.throws(() => importLexicons([changed, invalid], { dbPath, replace: true }), /duplicate/i);
  assert.deepEqual(loadLexicon(items[0].key, { dbPath }).document, items[0].document);
  importLexicons([changed], { dbPath, replace: true });
  assert.equal(loadLexicon(items[0].key, { dbPath }).entries[0].display, "测试用字");
  assert.deepEqual(loadLexicon(items[1].key, { dbPath }).document, items[1].document);
});

test("missing, corrupt and invalid database contents degrade without creating or reading sources", (t) => {
  const dbPath = tempDb(t);
  assert.equal(loadLexicon("test", { dbPath }).status, "missing");
  assert.equal(fs.existsSync(dbPath), false);
  fs.writeFileSync(dbPath, "not a database");
  assert.equal(loadLexicon("test", { dbPath }).status, "error");
  fs.unlinkSync(dbPath);
  importLexicons(defaultSources().slice(0, 1), { dbPath });
  const db = new DatabaseSync(dbPath);
  db.prepare("UPDATE lexicon_entries SET aliases_json = ?").run("bad json");
  db.close();
  assert.equal(loadLexicon("data-baker/round-one-quality", { dbPath }).status, "error");
});

test("CSV handles BOM, quotes and multiline fields without changing content", () => {
  const doc = minnanCsvDocument('\uFEFF编号,建议用字,对应华语\r\n1,"词,字","释义\n第二行"\r\n2,"双""引号",\r\n', "source.csv");
  assert.equal(doc.entries[0].display, "词,字");
  assert.equal(doc.entries[0].mandarin, "释义\n第二行");
  assert.equal(doc.entries[1].display, '双"引号');
  assert.equal(doc.entries[1].mandarin, "");
  const converted = minnanCsvDocument("序号,注音,语料统一用字,其他可接受的写法,辞典将来用字参考,普通话,优先级\n7,foo,词,别名,备注,释义,2", "converted.csv");
  assert.deepEqual(converted.entries[0].aliases, ["别名"]);
  assert.equal(converted.entries[0].attributes.pinyin, "foo");
  assert.equal(converted.entries[0].attributes.priority, "2");
  assert.throws(() => parseCsv('"unclosed'), /unclosed/);
  assert.throws(() => minnanCsvDocument("错误,表头\n1,2", "source.csv"), /columns/);
});

test("five business consumers use SQLite with all original lexicon files inaccessible", (t) => {
  const dbPath = tempDb(t);
  importLexicons(defaultSources(), { dbPath });
  const previous = process.env.ASC_LEXICON_DB_PATH;
  process.env.ASC_LEXICON_DB_PATH = dbPath;
  t.after(() => {
    if (previous === undefined) delete process.env.ASC_LEXICON_DB_PATH;
    else process.env.ASC_LEXICON_DB_PATH = previous;
  });
  const readFileSync = fs.readFileSync;
  const existsSync = fs.existsSync;
  const isSource = (file) => /lexicon\.(json|csv)$|正字表\.xlsx$/.test(String(file));
  fs.readFileSync = function (file, ...args) {
    if (isSource(file)) throw new Error("Source file access forbidden: " + file);
    return readFileSync.call(this, file, ...args);
  };
  fs.existsSync = function (file) { return isSource(file) ? false : existsSync.call(this, file); };
  try {
    const baker = require("../data-baker/round-one-quality/backend/ai-service");
    const aishell = require("../aishell-tech/minnan-helper/backend/lexicon");
    const hakka = require("../magic-data/hakka-helper/backend/ai-lexicon");
    const minnan = require("../magic-data/minnan-helper/backend/ai-lexicon");
    const shanghai = require("../jd-tts-annotation/shanghainese-helper/backend/orthography");
    assert.equal(baker.loadMinnanLexicon().length, 529);
    assert.equal(aishell.getLexiconState().source, "sqlite");
    assert.equal(aishell.getLexiconState().rowCount, 529);
    const health = require("../aishell-tech/minnan-helper/backend/ai-service").createHealthPayload();
    assert.equal(health.lexicon.source, "sqlite");
    assert.equal(health.lexicon.sourceFile, "lexicons.sqlite");
    assert.ok(aishell.buildRuleFirstConvertPlan("我").matchedCount > 0);
    assert.equal(hakka.getLexiconState().entries.length, 690);
    assert.equal(hakka.normalizeFinalSuggestionText("涯系嘅没给这很"), "𠊎係个冇畀𠮶咹");
    assert.equal(minnan.getLexiconState().source, "sqlite");
    assert.equal(minnan.getLexiconState().status, "ready");
    assert.equal(minnan.getLexiconState().rows.length, 562);
    assert.ok(minnan.buildLexiconContext({ platformDialectText: "先生" }).matchedCount > 0);
    const rewritten = minnan.applyLexiconRewrite("老师", { mode: "aggressive" });
    assert.equal(rewritten.text, "先生");
    assert.equal(shanghai.createOrthographyRuntime().normalizeListenText("原样 文本").orthography.status, "no-match");
  } finally {
    fs.readFileSync = readFileSync;
    fs.existsSync = existsSync;
  }
});

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const DEFAULT_DB_PATH = path.join(__dirname, "runtime-data", "lexicons.sqlite");
const warned = new Set();

function resolveLexiconDbPath() {
  return path.resolve(process.env.ASC_LEXICON_DB_PATH || DEFAULT_DB_PATH);
}

function validateDocument(key, document) {
  if (key === "jd-tts-annotation/shanghainese-helper") {
    const { validateLexicon } = require("../jd-tts-annotation/shanghainese-helper/backend/orthography");
    if (!validateLexicon(document).valid) throw new Error("Invalid Shanghai lexicon");
    const ids = document.entries.map((entry) => entry.id);
    if (new Set(ids).size !== ids.length) throw new Error("Duplicate entry id");
  } else {
    require("./business-lexicon").validateBusinessLexiconDocument(document, { allowEmptyMandarin: key === "magic-data/minnan-helper" });
  }
}

// All selected lexicons are committed together; a failed import leaves existing data intact.
function importLexicons(items, { dbPath = resolveLexiconDbPath(), replace = false } = {}) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  try {
    db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; BEGIN IMMEDIATE");
    db.exec(`
      CREATE TABLE IF NOT EXISTS lexicons (
        lexicon_key TEXT PRIMARY KEY, metadata_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS lexicon_entries (
        lexicon_key TEXT NOT NULL REFERENCES lexicons(lexicon_key) ON DELETE CASCADE,
        id TEXT NOT NULL, position INTEGER NOT NULL,
        normalized TEXT NOT NULL, display TEXT NOT NULL, mandarin TEXT NOT NULL,
        aliases_json TEXT NOT NULL, notes_json TEXT NOT NULL,
        tags_json TEXT NOT NULL, attributes_json TEXT NOT NULL,
        PRIMARY KEY (lexicon_key, id), UNIQUE (lexicon_key, position)
      );
    `);
    const insert = db.prepare("INSERT INTO lexicon_entries VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    const results = [];
    for (const item of items) {
      const { key } = item;
      if (!key || typeof key !== "string") throw new Error("Missing lexicon key");
      if (!replace && db.prepare("SELECT 1 FROM lexicons WHERE lexicon_key = ?").get(key)) {
        results.push({ key, status: "skipped" });
        continue;
      }
      const document = item.load ? item.load() : item.document;
      validateDocument(key, document);
      const { entries, ...metadata } = document;
      db.prepare("DELETE FROM lexicons WHERE lexicon_key = ?").run(key);
      db.prepare("INSERT INTO lexicons VALUES (?, ?)").run(key, JSON.stringify(metadata));
      entries.forEach((entry, index) => insert.run(key, entry.id, index,
        entry.normalized, entry.display, entry.mandarin,
        JSON.stringify(entry.aliases || []), JSON.stringify(entry.notes || []),
        JSON.stringify(entry.tags || []), JSON.stringify(entry.attributes || {})));
      results.push({ key, status: "imported", count: entries.length });
    }
    db.exec("COMMIT");
    return results;
  } catch (error) {
    if (db.isTransaction) db.exec("ROLLBACK");
    throw error;
  } finally {
    db.close();
  }
}

function loadLexicon(key, { dbPath = resolveLexiconDbPath() } = {}) {
  const result = {
    enabled: false, status: "missing", source: "sqlite", filePath: dbPath,
    document: null, entries: [], errorMessage: "", warningMessage: "",
    referenceExists: false, referenceFilePath: "",
  };
  let db;
  try {
    if (fs.existsSync(dbPath)) {
      db = new DatabaseSync(dbPath, { readOnly: true });
      const row = db.prepare("SELECT metadata_json FROM lexicons WHERE lexicon_key = ?").get(key);
      if (row) {
        const entries = db.prepare("SELECT * FROM lexicon_entries WHERE lexicon_key = ? ORDER BY position").all(key).map((entry) => ({
          id: entry.id, normalized: entry.normalized, display: entry.display, mandarin: entry.mandarin,
          aliases: JSON.parse(entry.aliases_json), notes: JSON.parse(entry.notes_json),
          tags: JSON.parse(entry.tags_json), attributes: JSON.parse(entry.attributes_json),
        }));
        const document = { ...JSON.parse(row.metadata_json), entries };
        validateDocument(key, document);
        return { ...result, enabled: true, status: "ready", document, entries };
      }
    }
    result.errorMessage = "正字表数据库或词表未初始化，请执行 scripts/import-lexicons.js";
  } catch (_) {
    result.status = "error";
    result.errorMessage = "正字表数据库不可用，请检查数据库文件或从备份恢复";
  } finally {
    if (db) db.close();
  }
  result.warningMessage = result.errorMessage;
  const warningKey = dbPath + ":" + key + ":" + result.status;
  if (!warned.has(warningKey)) {
    warned.add(warningKey);
    console.warn("[lexicon][sqlite]", key, result.errorMessage);
  }
  return result;
}

module.exports = { DEFAULT_DB_PATH, resolveLexiconDbPath, importLexicons, loadLexicon };

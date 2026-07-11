"use strict";

const fs = require("node:fs");

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeText(value) {
  return String(value || "")
    .replace(/^\uFEFF/, "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeStringArray(values, fieldName, entryId) {
  if (!Array.isArray(values)) {
    throw new Error(
      entryId
        ? 'entry "' + entryId + '" field "' + fieldName + '" must be an array'
        : 'field "' + fieldName + '" must be an array'
    );
  }
  const result = [];
  values.forEach(function (value) {
    const text = normalizeText(value);
    if (!text || result.indexOf(text) >= 0) {
      return;
    }
    result.push(text);
  });
  return result;
}

function normalizeAttributes(value, entryId) {
  if (value == null) {
    return {};
  }
  if (!isPlainObject(value)) {
    throw new Error('entry "' + entryId + '" field "attributes" must be an object');
  }
  return Object.assign({}, value);
}

function validateLexiconEntry(entry, index, seenIds) {
  if (!isPlainObject(entry)) {
    throw new Error("entry at index " + String(index) + " must be an object");
  }
  const id = normalizeText(entry.id);
  const normalized = normalizeText(entry.normalized);
  const display = normalizeText(entry.display);
  const mandarin = normalizeText(entry.mandarin);
  if (!id) {
    throw new Error("entry at index " + String(index) + ' is missing required field "id"');
  }
  if (seenIds.has(id)) {
    throw new Error('duplicate entry id "' + id + '"');
  }
  seenIds.add(id);
  if (!normalized) {
    throw new Error('entry "' + id + '" is missing required field "normalized"');
  }
  if (!display) {
    throw new Error('entry "' + id + '" is missing required field "display"');
  }
  if (!mandarin) {
    throw new Error('entry "' + id + '" is missing required field "mandarin"');
  }
  return {
    id,
    normalized,
    display,
    mandarin,
    aliases: normalizeStringArray(entry.aliases || [], "aliases", id),
    notes: normalizeStringArray(entry.notes || [], "notes", id),
    tags: normalizeStringArray(entry.tags || [], "tags", id),
    attributes: normalizeAttributes(entry.attributes, id),
  };
}

function validateBusinessLexiconDocument(document) {
  if (!isPlainObject(document)) {
    throw new Error("business lexicon document must be an object");
  }
  const schemaVersion = normalizeText(document.schemaVersion);
  const language = normalizeText(document.language);
  const mode = normalizeText(document.mode);
  const updatedAt = normalizeText(document.updatedAt);
  if (!schemaVersion) {
    throw new Error('business lexicon document is missing required field "schemaVersion"');
  }
  if (!language) {
    throw new Error('business lexicon document is missing required field "language"');
  }
  if (!mode) {
    throw new Error('business lexicon document is missing required field "mode"');
  }
  if (!updatedAt) {
    throw new Error('business lexicon document is missing required field "updatedAt"');
  }
  const sourceFiles = normalizeStringArray(document.sourceFiles || [], "sourceFiles", "");
  if (!Array.isArray(document.entries)) {
    throw new Error('business lexicon document field "entries" must be an array');
  }
  const seenIds = new Set();
  const entries = document.entries.map(function (entry, index) {
    return validateLexiconEntry(entry, index, seenIds);
  });
  return {
    schemaVersion,
    language,
    mode,
    sourceFiles,
    updatedAt,
    entries,
  };
}

function loadBusinessLexiconJson(filePath) {
  const safePath = normalizeText(filePath);
  if (!safePath || !fs.existsSync(safePath)) {
    return {
      enabled: false,
      status: "missing",
      filePath: safePath,
      document: null,
      entries: [],
      errorMessage: "",
    };
  }

  try {
    const document = validateBusinessLexiconDocument(
      JSON.parse(fs.readFileSync(safePath, "utf8"))
    );
    return {
      enabled: true,
      status: "ready",
      filePath: safePath,
      document,
      entries: document.entries.slice(),
      errorMessage: "",
    };
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    const status =
      error instanceof SyntaxError ? "parse_error" : message.toLowerCase().includes("entry") ||
        message.toLowerCase().includes("field") ||
        message.toLowerCase().includes("schema")
        ? "invalid"
        : "error";
    return {
      enabled: false,
      status,
      filePath: safePath,
      document: null,
      entries: [],
      errorMessage: message,
    };
  }
}

function findFirstExistingReferenceFile(referencePaths) {
  const source = Array.isArray(referencePaths) ? referencePaths : [referencePaths];
  for (let index = 0; index < source.length; index += 1) {
    const candidatePath = normalizeText(source[index]);
    if (candidatePath && fs.existsSync(candidatePath)) {
      return candidatePath;
    }
  }
  return "";
}

function loadBusinessLexiconSource(filePath, options) {
  const source = options && typeof options === "object" ? options : {};
  const referenceFilePath = findFirstExistingReferenceFile(source.referencePaths || []);
  const loaded = loadBusinessLexiconJson(filePath);
  if (loaded.status === "missing" && referenceFilePath) {
    return Object.assign({}, loaded, {
      status: "reference_only",
      referenceExists: true,
      referenceFilePath,
      warningMessage: normalizeText(source.warningMessage || "没有字词对应表"),
    });
  }
  return Object.assign({}, loaded, {
    referenceExists: Boolean(referenceFilePath),
    referenceFilePath,
    warningMessage: "",
  });
}

module.exports = {
  findFirstExistingReferenceFile,
  loadBusinessLexiconSource,
  loadBusinessLexiconJson,
  normalizeText,
  validateBusinessLexiconDocument,
};

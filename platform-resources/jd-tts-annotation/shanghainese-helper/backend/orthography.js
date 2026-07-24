"use strict";

const fs = require("fs");
const path = require("path");

const DEFAULT_LEXICON_PATH = path.join(__dirname, "lexicon", "shanghainese-lexicon.json");

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

function isNonBlankString(value) {
  return isNonEmptyString(value) && value.trim().length > 0;
}

function compareRules(left, right) {
  const lengthDifference = Array.from(right.from).length - Array.from(left.from).length;
  if (lengthDifference !== 0) {
    return lengthDifference;
  }
  return left.order - right.order;
}

function validateLexicon(value) {
  if (!isPlainObject(value) || value.schemaVersion !== 1 || value.language !== "shanghainese" || value.mode !== "exact_alias_to_canonical" || !Array.isArray(value.sourceFiles) || value.sourceFiles.length === 0 || value.sourceFiles.some(function (sourceFile) { return !isNonBlankString(sourceFile); }) || !isNonBlankString(value.updatedAt) || !Array.isArray(value.entries)) {
    return { valid: false, rules: [] };
  }

  const aliases = new Map();
  let order = 0;
  for (const entry of value.entries) {
    if (!isPlainObject(entry) || !isNonEmptyString(entry.id) || !isNonEmptyString(entry.normalized) || !isNonEmptyString(entry.display) || entry.normalized !== entry.display || typeof entry.mandarin !== "string" || !Array.isArray(entry.aliases) || !Array.isArray(entry.notes) || !Array.isArray(entry.tags) || !isPlainObject(entry.attributes)) {
      return { valid: false, rules: [] };
    }
    for (const alias of entry.aliases) {
      if (!isNonBlankString(alias) || alias === entry.display) {
        return { valid: false, rules: [] };
      }
      const existing = aliases.get(alias);
      if (existing && existing.to !== entry.display) {
        return { valid: false, rules: [] };
      }
      if (!existing) {
        aliases.set(alias, { from: alias, to: entry.display, order: order++ });
      }
    }
  }
  return { valid: true, rules: Array.from(aliases.values()).sort(compareRules) };
}

function rewriteText(text, rules) {
  let cursor = 0;
  let replacementCount = 0;
  let output = "";
  while (cursor < text.length) {
    const rule = rules.find(function (candidate) { return text.startsWith(candidate.from, cursor); });
    if (!rule) {
      output += text[cursor];
      cursor += 1;
      continue;
    }
    output += rule.to;
    cursor += rule.from.length;
    replacementCount += 1;
  }
  return { text: output, replacementCount };
}

function createOrthographyRuntime(overrides) {
  const deps = Object.assign({ readFileSync: fs.readFileSync, lexiconPath: DEFAULT_LEXICON_PATH }, overrides || {});

  function readRules() {
    try {
      const raw = deps.readFileSync(deps.lexiconPath, "utf8");
      const validated = validateLexicon(JSON.parse(raw));
      return validated.valid ? { status: "ready", rules: validated.rules } : { status: "invalid", rules: [] };
    } catch (error) {
      return { status: error?.code === "ENOENT" ? "missing" : "invalid", rules: [] };
    }
  }

  function normalizeListenText(value) {
    const rawListenText = typeof value === "string" ? value : "";
    const lexicon = readRules();
    if (lexicon.status !== "ready") {
      return { rawListenText, listenText: rawListenText, orthography: { status: lexicon.status, replacementCount: 0 } };
    }
    const rewritten = rewriteText(rawListenText, lexicon.rules);
    return {
      rawListenText,
      listenText: rewritten.text,
      orthography: { status: rewritten.replacementCount > 0 ? "applied" : "no-match", replacementCount: rewritten.replacementCount },
    };
  }

  return { normalizeListenText };
}

module.exports = { DEFAULT_LEXICON_PATH, createOrthographyRuntime, rewriteText, validateLexicon };

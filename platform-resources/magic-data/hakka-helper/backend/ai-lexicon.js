"use strict";

const path = require("path");
const {
  loadBusinessLexiconSource,
  normalizeText: normalizeBusinessLexiconText,
} = require("../../../backend/business-lexicon");

const HAKKA_XLSX_PATH = path.join(__dirname, "lexicon", "客家话-正字表.xlsx");
const HAKKA_JSON_PATH = path.join(__dirname, "lexicon", "hakka-lexicon.json");
const HAKKA_CSV_PATH = path.join(__dirname, "lexicon", "hakka-lexicon.csv");
const DEFAULT_LIMIT = 30;
const EXACT_REWRITE_REASON = "命中客家话词表精确正字归一化";
const FALLBACK_REWRITE_REASON = "命中客家话高频正字兜底映射";
const CONVERT_REWRITE_REASON = "命中客家话词表普通话转写";
const FINAL_SUGGESTION_FALLBACK_RULES = [
  { from: "這個", to: "𠮶个" },
  { from: "这个", to: "𠮶个" },
  { from: "那個", to: "个" },
  { from: "那个", to: "个" },
  { from: "沒有", to: "冇" },
  { from: "没有", to: "冇" },
  { from: "這", to: "𠮶" },
  { from: "这", to: "𠮶" },
  { from: "該", to: "个" },
  { from: "该", to: "个" },
  { from: "那", to: "个" },
  { from: "給", to: "畀" },
  { from: "给", to: "畀" },
  { from: "很", to: "咹" },
  { from: "是", to: "係" },
  { from: "系", to: "係" },
  { from: "我", to: "𠊎" },
  { from: "涯", to: "𠊎" },
  { from: "無", to: "冇" },
  { from: "无", to: "冇" },
  { from: "没", to: "冇" },
  { from: "嘅", to: "个" },
];

let cachedState = null;
let warnedMissing = false;
let warnedError = false;

function normalizeText(value) {
  return String(value || "")
    .replace(/^\uFEFF/, "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHeader(value) {
  return normalizeText(value).replace(/\s+/g, "");
}

function parsePriority(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 9999;
}

function uniqueTerms(values) {
  const source = Array.isArray(values) ? values : [values];
  const result = [];
  source.forEach(function (value) {
    const text = normalizeText(value);
    if (!text || result.indexOf(text) >= 0) {
      return;
    }
    result.push(text);
  });
  return result;
}

function splitTerms(value) {
  const text = normalizeText(value);
  if (!text) {
    return [];
  }
  return text
    .split(/[、，,；;\/\s]+/)
    .map(normalizeText)
    .filter(Boolean);
}

function parseCsvRecords(text) {
  const source = String(text || "").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (inQuotes) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }

    if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") {
        index += 1;
      }
      row.push(cell);
      cell = "";
      if (row.some(function (value) { return normalizeText(value); })) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some(function (value) { return normalizeText(value); })) {
    rows.push(row);
  }
  return rows;
}

function parseLexiconCsv(text) {
  const rows = parseCsvRecords(text);
  if (!rows.length) {
    return [];
  }
  const headers = rows[0].map(normalizeHeader);
  return rows
    .slice(1)
    .map(function (cells) {
      const row = {};
      headers.forEach(function (header, index) {
        if (header) {
          row[header] = normalizeText(cells[index]);
        }
      });
      const unifiedText = row["语料统一用字"] || row["统一用字"] || "";
      const mandarinText = row["普通话"] || row["对应华语"] || "";
      if (!unifiedText && !mandarinText) {
        return null;
      }
      return {
        serial: row["序号"] || "",
        phonetic: row["注音"] || "",
        unified: unifiedText,
        acceptable: row["其他可接受的写法"] || row["可接受写法"] || "",
        dictionaryRef: row["辞典将来用字参考"] || row["辞典参考"] || "",
        mandarin: mandarinText,
        priority: parsePriority(row["优先级"]),
      };
    })
    .filter(Boolean);
}

function mapBusinessLexiconEntries(entries) {
  return (Array.isArray(entries) ? entries : [])
    .map(function (entry) {
      const id = normalizeBusinessLexiconText(entry?.id);
      const unifiedText = normalizeBusinessLexiconText(entry?.display || entry?.normalized);
      const mandarinText = normalizeBusinessLexiconText(entry?.mandarin);
      const aliases = Array.isArray(entry?.aliases) ? entry.aliases.map(normalizeText) : [];
      const priority = parsePriority(
        entry?.attributes?.priority ?? entry?.attributes?.sourceIndex ?? entry?.priority
      );
      if (!unifiedText && !mandarinText) {
        return null;
      }
      return {
        serial: id,
        phonetic: "",
        unified: unifiedText,
        acceptable: uniqueTerms(aliases).join("、"),
        dictionaryRef: "",
        mandarin: mandarinText,
        priority: priority,
      };
    })
    .filter(Boolean);
}

function addRewriteRule(rules, seen, rule) {
  const from = normalizeText(rule?.from);
  const to = normalizeText(rule?.to);
  if (!from || !to || from === to) {
    return;
  }
  const key = from + "\u0000" + to + "\u0000" + String(rule?.source || "");
  if (seen.has(key)) {
    return;
  }
  seen.add(key);
  rules.push({
    from,
    to,
    source: normalizeText(rule?.source) || "fallback",
    reason: normalizeText(rule?.reason) || "",
    priority: Number(rule?.priority) || 0,
  });
}

function sortRewriteRules(left, right) {
  if (right.from.length !== left.from.length) {
    return right.from.length - left.from.length;
  }
  if (left.priority !== right.priority) {
    return left.priority - right.priority;
  }
  if (left.source !== right.source) {
    return left.source === "lexicon" ? -1 : 1;
  }
  return left.from.localeCompare(right.from, "zh-Hans-CN");
}

function buildLexiconExactRewriteRules(entries) {
  const rules = [];
  const seen = new Set();
  (Array.isArray(entries) ? entries : []).forEach(function (entry) {
    const canonical = normalizeBusinessLexiconText(entry?.display || entry?.normalized);
    uniqueTerms([entry?.normalized, entry?.display].concat(entry?.aliases || [])).forEach(function (term) {
      if (!term || term === canonical) {
        return;
      }
      addRewriteRule(rules, seen, {
        from: term,
        to: canonical,
        source: "lexicon",
        reason: EXACT_REWRITE_REASON,
        priority: 0,
      });
    });
  });
  return rules.sort(sortRewriteRules);
}

function buildFallbackExactRewriteRules(fallbackRules) {
  const rules = [];
  const seen = new Set();
  (Array.isArray(fallbackRules) && fallbackRules.length > 0
    ? fallbackRules
    : FINAL_SUGGESTION_FALLBACK_RULES
  ).forEach(function (rule) {
    addRewriteRule(rules, seen, {
      from: rule?.from,
      to: rule?.to,
      source: "fallback",
      reason: FALLBACK_REWRITE_REASON,
      priority: 1,
    });
  });
  return rules.sort(sortRewriteRules);
}

function rewriteTextByRules(text, rules) {
  const originalText = String(text || "");
  if (!originalText.trim() || !Array.isArray(rules) || rules.length === 0) {
    return {
      text: originalText,
      changed: false,
      changes: [],
    };
  }
  let index = 0;
  let rewritten = "";
  const changes = [];

  while (index < originalText.length) {
    const matchedRule = rules.find(function (rule) {
      return rule?.from && originalText.startsWith(rule.from, index);
    });

    if (matchedRule) {
      rewritten += matchedRule.to;
      changes.push({
        from: matchedRule.from,
        to: matchedRule.to,
        source: matchedRule.source,
        reason: matchedRule.reason,
      });
      index += matchedRule.from.length;
      continue;
    }

    const current = String.fromCodePoint(originalText.codePointAt(index));
    rewritten += current;
    index += current.length;
  }

  return {
    text: rewritten,
    changed: rewritten !== originalText,
    changes,
  };
}

function buildMandarinToDialectRules(rows) {
  const rules = [];
  const seen = new Set();
  (Array.isArray(rows) ? rows : []).forEach(function (entry) {
    const target = normalizeText(entry?.unified);
    splitTerms(entry?.mandarin).forEach(function (term) {
      if (!term || !target || term === target) {
        return;
      }
      addRewriteRule(rules, seen, {
        from: term,
        to: target,
        source: "lexicon",
        reason: CONVERT_REWRITE_REASON,
        priority: Number(entry?.priority) || 9999,
      });
    });
  });
  return rules.sort(sortRewriteRules);
}

function dedupeLexiconMatches(changes) {
  const result = [];
  const seen = new Set();
  (Array.isArray(changes) ? changes : []).forEach(function (change) {
    const mandarin = normalizeText(change?.from);
    const dialect = normalizeText(change?.to);
    if (!mandarin || !dialect) {
      return;
    }
    const key = mandarin + "\u0000" + dialect;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    result.push({
      mandarin,
      dialect,
    });
  });
  return result;
}

function applyFinalSuggestionRewrite(text, options) {
  const source = options && typeof options === "object" ? options : {};
  const mode = normalizeText(source.mode || "exact").toLowerCase();
  const originalText = String(text || "");
  if (!originalText.trim() || mode === "off") {
    return {
      text: originalText,
      changed: false,
      changes: [],
    };
  }
  const state = source.lexiconEntries ? null : getLexiconState();
  const lexiconEntries = Array.isArray(source.lexiconEntries)
    ? source.lexiconEntries
    : Array.isArray(state?.entries)
      ? state.entries
      : [];
  const lexiconRules = buildLexiconExactRewriteRules(lexiconEntries);
  const fallbackRules = buildFallbackExactRewriteRules(source.fallbackRules);
  return rewriteTextByRules(originalText, lexiconRules.concat(fallbackRules).sort(sortRewriteRules));
}

function normalizeFinalSuggestionText(text, options) {
  return applyFinalSuggestionRewrite(text, options).text;
}

function convertMandarinToDialectByLexicon(recognizedMandarinText, options) {
  const source = options && typeof options === "object" ? options : {};
  const sourceText = normalizeText(recognizedMandarinText);
  const platformDialectText = normalizeText(source.platformDialectText);
  const lexiconState = source.lexiconState && typeof source.lexiconState === "object"
    ? source.lexiconState
    : getLexiconState();

  if (!sourceText) {
    return {
      recognizedMandarinText: "",
      convertedDialectText: platformDialectText,
      lexiconMatches: [],
      conversionWarnings: [
        platformDialectText
          ? "未识别到普通话文本，暂时保留平台客家话文本。"
          : "未识别到普通话文本，建议人工复核。",
      ],
    };
  }

  if (!lexiconState.enabled || lexiconState.status !== "ready") {
    return {
      recognizedMandarinText: sourceText,
      convertedDialectText: sourceText,
      lexiconMatches: [],
      conversionWarnings: ["客家话词表未就绪，普通话转客家话已降级为原文输出。"],
    };
  }

  const convertRules = buildMandarinToDialectRules(lexiconState.rows);
  const converted = rewriteTextByRules(sourceText, convertRules);
  const finalized = applyFinalSuggestionRewrite(converted.text, {
    mode: source.rewriteMode || "exact",
    lexiconEntries: lexiconState.entries,
    fallbackRules: source.fallbackRules,
  });
  const lexiconMatches = dedupeLexiconMatches(converted.changes);
  const conversionWarnings = [];
  if (lexiconMatches.length === 0) {
    conversionWarnings.push("词表未命中普通话关键词，建议人工复核客家话建议文本。");
  }

  return {
    recognizedMandarinText: sourceText,
    convertedDialectText: finalized.text,
    lexiconMatches,
    conversionWarnings,
  };
}

function resetLexiconStateCache() {
  cachedState = null;
  warnedMissing = false;
  warnedError = false;
}

function getLexiconState() {
  if (cachedState) {
    return cachedState;
  }
  const loaded = loadBusinessLexiconSource(HAKKA_JSON_PATH, {
    referencePaths: [HAKKA_CSV_PATH],
    warningMessage: "没有字词对应表",
  });
  if (loaded.status === "reference_only") {
    if (!warnedMissing) {
      warnedMissing = true;
      console.warn("[MagicData][hakka][ai] 没有字词对应表，检测到本地参考 CSV，复核将按无词表模式继续。", {
        referenceCsvExists: true,
      });
    }
    cachedState = {
      enabled: false,
      status: "reference_only",
      entries: [],
      rows: [],
      source: "json",
    };
    return cachedState;
  }
  if (loaded.status === "missing") {
    cachedState = {
      enabled: false,
      status: "missing",
      entries: [],
      rows: [],
      source: "json",
    };
    return cachedState;
  }
  if (!loaded.enabled || loaded.status !== "ready") {
    if (!warnedError) {
      warnedError = true;
      console.warn("[MagicData][hakka][ai] 客家话词表 JSON 读取失败，复核将降级为无词表模式。", {
        message: loaded.errorMessage || "",
        status: loaded.status,
      });
    }
    cachedState = {
      enabled: false,
      status: loaded.status || "error",
      entries: [],
      rows: [],
      source: "json",
    };
    return cachedState;
  }
  cachedState = {
    enabled: true,
    status: "ready",
    entries: loaded.entries.slice(),
    rows: mapBusinessLexiconEntries(loaded.entries),
    source: "json",
  };
  return cachedState;
}

function getEntryTerms(entry) {
  const unifiedTerms = splitTerms(entry.unified);
  const acceptableTerms = splitTerms(entry.acceptable);
  const mandarinTerms = splitTerms(entry.mandarin);
  return unifiedTerms.concat(acceptableTerms, mandarinTerms).filter(Boolean);
}

function normalizeLimit(value) {
  const number = Number(value || DEFAULT_LIMIT);
  if (!Number.isFinite(number)) {
    return DEFAULT_LIMIT;
  }
  return Math.max(1, Math.min(100, Math.round(number)));
}

function buildLexiconContext(input) {
  const request = input && typeof input === "object" ? input : {};
  const state = getLexiconState();
  if (!state.enabled || state.status !== "ready") {
    return {
      enabled: false,
      status: state.status,
      matchedCount: 0,
      matches: [],
      text: "",
    };
  }

  const targetText = [
    normalizeText(request.platformDialectText),
    normalizeText(request.platformMandarinText),
    normalizeText(request.heardDialectText),
  ]
    .filter(Boolean)
    .join("\n");

  const limit = normalizeLimit(request.limit);
  const matches = state.rows
    .filter(function (entry) {
      const terms = getEntryTerms(entry);
      return terms.some(function (term) {
        return term && targetText.indexOf(term) >= 0;
      });
    })
    .map(function (entry) {
      const terms = getEntryTerms(entry);
      const maxTermLength = terms.reduce(function (maxLength, term) {
        return Math.max(maxLength, term.length);
      }, 0);
      return Object.assign({}, entry, { maxTermLength });
    })
    .sort(function (left, right) {
      if (right.maxTermLength !== left.maxTermLength) {
        return right.maxTermLength - left.maxTermLength;
      }
      return left.priority - right.priority;
    });

  const limitedMatches = matches.slice(0, limit).map(function (entry) {
    return {
      serial: entry.serial,
      unified: entry.unified,
      acceptable: entry.acceptable,
      mandarin: entry.mandarin,
      priority: entry.priority,
      note:
        entry.acceptable && entry.unified
          ? "命中可接受写法时可保留，但建议统一为语料统一用字。"
          : "",
    };
  });

  const contextText = limitedMatches
    .map(function (entry) {
      return [
        "- 统一用字：" + entry.unified,
        entry.acceptable ? "可接受写法：" + entry.acceptable : "",
        entry.mandarin ? "普通话：" + entry.mandarin : "",
        entry.priority !== 9999 ? "优先级：" + String(entry.priority) : "",
      ]
        .filter(Boolean)
        .join("；");
    })
    .join("\n");

  return {
    enabled: true,
    status: "ready",
    matchedCount: matches.length,
    matches: limitedMatches,
    text: contextText,
  };
}

module.exports = {
  HAKKA_CSV_PATH,
  HAKKA_JSON_PATH,
  HAKKA_XLSX_PATH,
  applyFinalSuggestionRewrite,
  buildLexiconContext,
  convertMandarinToDialectByLexicon,
  getLexiconState,
  normalizeFinalSuggestionText,
  parseLexiconCsv,
  __test__: {
    FINAL_SUGGESTION_FALLBACK_RULES,
    applyFinalSuggestionRewrite,
    buildFallbackExactRewriteRules,
    buildLexiconExactRewriteRules,
    buildMandarinToDialectRules,
    convertMandarinToDialectByLexicon,
    resetLexiconStateCache,
    rewriteTextByRules,
  },
};

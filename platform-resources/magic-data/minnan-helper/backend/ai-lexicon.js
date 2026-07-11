"use strict";

const fs = require("fs");
const path = require("path");
const {
  loadBusinessLexiconSource,
  normalizeText: normalizeBusinessLexiconText,
} = require("../../../backend/business-lexicon");

const MINNAN_XLSX_PATH = path.join(__dirname, "lexicon", "闽南语-推荐词表.xlsx");
const MINNAN_JSON_PATH = path.join(__dirname, "lexicon", "minnan-lexicon.json");
const MINNAN_CSV_PATH = path.join(__dirname, "lexicon", "minnan-lexicon.csv");
const DEFAULT_LIMIT = 30;
const BASE_ENTRIES = [
  { mandarin: "我/我们", suggested: "阮、咱" },
  { mandarin: "你/你们", suggested: "汝、恁" },
  { mandarin: "他/她/它/他们/她们", suggested: "伊、因" },
  { mandarin: "这位", suggested: "即个" },
  { mandarin: "现在", suggested: "即阵" },
  { mandarin: "的", suggested: "诶" },
  { mandarin: "很", suggested: "真" },
  { mandarin: "喜欢", suggested: "欢喜" },
  { mandarin: "吃", suggested: "食" },
];
const TRADITIONAL_TO_SIMPLIFIED_MAP = {
  "這": "这",
  "個": "个",
  "問": "问",
  "題": "题",
  "聽": "听",
  "說": "说",
  "語": "语",
  "體": "体",
  "發": "发",
  "聲": "声",
  "輸": "输",
  "資": "资",
  "訊": "讯",
  "轉": "转",
  "換": "换",
  "後": "后",
  "裡": "里",
  "還": "还",
  "點": "点",
  "會": "会",
  "應": "应",
  "對": "对",
  "讓": "让",
  "與": "与",
  "為": "为",
  "無": "无",
  "詞": "词",
  "標": "标",
  "註": "注",
  "檢": "检",
};

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

function getProtectedLexiconTerms() {
  const terms = new Set();
  BASE_ENTRIES.forEach(function (entry) {
    splitTerms(entry.suggested).forEach(function (term) {
      if (term) {
        terms.add(term);
      }
    });
  });
  getLexiconState().rows.forEach(function (entry) {
    splitTerms(entry.unified).forEach(function (term) {
      if (term) {
        terms.add(term);
      }
    });
  });
  return Array.from(terms).sort(function (left, right) {
    return right.length - left.length;
  });
}

function protectLexiconTerms(text, protectedTerms) {
  let output = String(text || "");
  const replacements = [];
  protectedTerms.forEach(function (term, index) {
    if (!term || output.indexOf(term) < 0) {
      return;
    }
    const token = "__ASC_MINNAN_LEXICON_TOKEN_" + String(index) + "__";
    output = output.split(term).join(token);
    replacements.push({ token: token, value: term });
  });
  return { text: output, replacements: replacements };
}

function restoreLexiconTerms(text, replacements) {
  let output = String(text || "");
  (Array.isArray(replacements) ? replacements : []).forEach(function (entry) {
    if (!entry || !entry.token) {
      return;
    }
    output = output.split(entry.token).join(entry.value || "");
  });
  return output;
}

function convertTraditionalToSimplified(text) {
  const source = String(text || "");
  let output = "";
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    output += TRADITIONAL_TO_SIMPLIFIED_MAP[char] || char;
  }
  return output;
}

function normalizeToSimplifiedChinesePreservingLexicon(text) {
  const source = String(text || "");
  if (!source) {
    return "";
  }
  const protectedTerms = getProtectedLexiconTerms();
  const protectedResult = protectLexiconTerms(source, protectedTerms);
  const simplified = convertTraditionalToSimplified(protectedResult.text);
  return restoreLexiconTerms(simplified, protectedResult.replacements);
}

function getSuggestedTermForFrom(suggested, from) {
  return (
    splitTerms(suggested).find(function (term) {
      return term && term !== from;
    }) || ""
  );
}

function addRewriteRule(rules, seen, mandarin, suggested, sourceTag) {
  splitTerms(mandarin).forEach(function (from) {
    if (!from || (sourceTag === "csv" && from.length < 2)) {
      return;
    }
    const to = getSuggestedTermForFrom(suggested, from);
    if (!to || to === from) {
      return;
    }
    const key = from + "\u0000" + to;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    rules.push({
      from: from,
      to: to,
      source: sourceTag,
      reason: "命中闽南词表建议用字",
    });
  });
}

function buildRewriteRules() {
  const rules = [];
  const seen = new Set();
  BASE_ENTRIES.forEach(function (entry) {
    addRewriteRule(rules, seen, entry.mandarin, entry.suggested, "base");
  });
  getLexiconState().rows.forEach(function (entry) {
    addRewriteRule(rules, seen, entry.mandarin, entry.unified, "csv");
  });
  return rules.sort(function (left, right) {
    return right.from.length - left.from.length;
  });
}

function countOccurrences(text, searchText) {
  if (!searchText) {
    return 0;
  }
  let count = 0;
  let index = 0;
  while (index < text.length) {
    const foundIndex = text.indexOf(searchText, index);
    if (foundIndex < 0) {
      break;
    }
    count += 1;
    index = foundIndex + searchText.length;
  }
  return count;
}

function applyLexiconRewrite(text, options) {
  const source = options && typeof options === "object" ? options : {};
  const mode = String(source.mode || "off").trim().toLowerCase();
  const originalText = String(text || "");
  if (!originalText || mode === "off") {
    return {
      text: originalText,
      changed: false,
      changes: [],
    };
  }

  let rewrittenText = originalText;
  const changes = [];
  buildRewriteRules().forEach(function (rule) {
    if (!rule.from || !rule.to || rewrittenText.indexOf(rule.from) < 0) {
      return;
    }
    if (rewrittenText.indexOf(rule.to) >= 0) {
      return;
    }
    const occurrenceCount = countOccurrences(rewrittenText, rule.from);
    if (occurrenceCount <= 0) {
      return;
    }
    rewrittenText = rewrittenText.split(rule.from).join(rule.to);
    for (let index = 0; index < occurrenceCount; index += 1) {
      changes.push({
        from: rule.from,
        to: rule.to,
        source: rule.source,
        reason: rule.reason,
      });
    }
  });

  return {
    text: rewrittenText,
    changed: rewrittenText !== originalText,
    changes: changes,
  };
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
        priority: parsePriority(entry?.attributes?.priority),
      };
    })
    .filter(Boolean);
}

function getLexiconState() {
  if (cachedState) {
    return cachedState;
  }
  const loaded = loadBusinessLexiconSource(MINNAN_JSON_PATH, {
    referencePaths: [MINNAN_CSV_PATH],
    warningMessage: "没有字词对应表",
  });
  if (loaded.status === "reference_only") {
    if (!warnedMissing) {
      warnedMissing = true;
      console.warn("[MagicData][minnan][ai] 没有字词对应表，检测到本地参考 CSV，复核将按无词表模式继续。", {
        referenceCsvExists: true,
      });
    }
    cachedState = {
      enabled: false,
      status: "reference_only",
      rows: [],
      source: "json",
    };
    return cachedState;
  }
  if (loaded.status === "missing") {
    cachedState = {
      enabled: false,
      status: "missing",
      rows: [],
      source: "json",
    };
    return cachedState;
  }
  if (!loaded.enabled || loaded.status !== "ready") {
    if (!warnedError) {
      warnedError = true;
      console.warn("[MagicData][minnan][ai] 闽南语词表 JSON 读取失败，复核将降级为无词表模式。", {
        message: loaded.errorMessage || "",
        status: loaded.status,
      });
    }
    cachedState = {
      enabled: false,
      status: loaded.status || "error",
      rows: [],
      source: "json",
    };
    return cachedState;
  }
  cachedState = {
    enabled: true,
    status: "ready",
    rows: mapBusinessLexiconEntries(loaded.entries),
    source: "json",
  };
  return cachedState;
}

function getEntryTerms(entry) {
  const unifiedTerms = splitTerms(entry.unified);
  const acceptableTerms = splitTerms(entry.acceptable);
  return unifiedTerms.concat(acceptableTerms).filter(Boolean);
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
  BASE_ENTRIES,
  MINNAN_CSV_PATH,
  MINNAN_JSON_PATH,
  MINNAN_XLSX_PATH,
  applyLexiconRewrite,
  buildLexiconContext,
  getLexiconState,
  normalizeToSimplifiedChinesePreservingLexicon,
  parseLexiconCsv,
};

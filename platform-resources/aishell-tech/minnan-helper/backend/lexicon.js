"use strict";

const path = require("node:path");
const {
  loadBusinessLexiconSource,
  normalizeText: normalizeBusinessLexiconText,
} = require("../../../backend/business-lexicon");

const LEXICON_JSON_PATH = path.join(__dirname, "reference", "minnan-lexicon.json");
const LEXICON_REFERENCE_CSV_PATH = path.join(__dirname, "reference", "minnan-lexicon.csv");

let cachedLexiconState = null;
let warnedReferenceOnly = false;
let warnedReadFailure = false;

function normalizeText(value) {
  return String(value || "")
    .replace(/^\uFEFF/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanLexiconTerm(value) {
  return normalizeText(value)
    .replace(/（[^）]*）/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/[（(][^、，,；;／/\s]*/g, "")
    .replace(/[A-Za-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüńňǹḿ]+/gi, "")
    .replace(/\d+/g, "")
    .replace(/[-_.：:]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitLexiconTerms(value) {
  const text = cleanLexiconTerm(value);
  if (!text) {
    return [];
  }
  return text
    .split(/[、，,；;／/\s]+/)
    .map(cleanLexiconTerm)
    .filter(Boolean);
}

function uniqueTerms(values) {
  const result = [];
  (Array.isArray(values) ? values : []).forEach(function (item) {
    const text = normalizeText(item);
    if (!text || result.indexOf(text) >= 0) {
      return;
    }
    result.push(text);
  });
  return result;
}

function resolveLexiconJsonPath() {
  return normalizeBusinessLexiconText(process.env.ASC_AISHELL_MINNAN_LEXICON_JSON_PATH) || LEXICON_JSON_PATH;
}

function parseStructuredLexiconRows(entries) {
  return (Array.isArray(entries) ? entries : [])
    .map(function (entry) {
      const id = normalizeBusinessLexiconText(entry?.id);
      const suggested = normalizeBusinessLexiconText(entry?.display || entry?.normalized);
      const mandarin = normalizeBusinessLexiconText(entry?.mandarin);
      const matchTerms = uniqueTerms(
        [entry?.normalized, entry?.display]
          .concat(Array.isArray(entry?.aliases) ? entry.aliases : [])
          .map(splitLexiconTerms)
          .flat()
      );
      const suggestedVariants = uniqueTerms(
        [suggested]
          .concat(Array.isArray(entry?.aliases) ? entry.aliases : [])
          .map(splitLexiconTerms)
          .flat()
      );
      const mandarinVariants = uniqueTerms(splitLexiconTerms(mandarin));
      const inputVariants = uniqueTerms(matchTerms.concat(mandarinVariants));
      if (!suggestedVariants.length || !mandarinVariants.length) {
        return null;
      }
      return {
        id,
        suggested,
        mandarin,
        rawRow: {
          id,
          normalized: normalizeBusinessLexiconText(entry?.normalized),
          display: normalizeBusinessLexiconText(entry?.display),
          mandarin,
          aliases: uniqueTerms(Array.isArray(entry?.aliases) ? entry.aliases : []),
          notes: uniqueTerms(Array.isArray(entry?.notes) ? entry.notes : []),
          tags: uniqueTerms(Array.isArray(entry?.tags) ? entry.tags : []),
        },
        suggestedVariants,
        mandarinVariants,
        inputVariants,
      };
    })
    .filter(Boolean);
}

function buildLexiconState(rows, status, source, errorMessage, filePath) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const indexByMandarin = new Map();
  safeRows.forEach(function (row) {
    row.inputVariants.forEach(function (variant) {
      const list = indexByMandarin.get(variant) || [];
      list.push(row);
      indexByMandarin.set(variant, list);
    });
  });
  const mandarinVariants = Array.from(indexByMandarin.keys()).sort(function (left, right) {
    return right.length - left.length || left.localeCompare(right, "zh-Hans-CN");
  });
  return {
    exists: safeRows.length > 0,
    rowCount: safeRows.length,
    status: normalizeText(status) || (safeRows.length > 0 ? "ready" : "missing"),
    source: normalizeText(source) || "json",
    errorMessage: normalizeText(errorMessage),
    filePath: normalizeText(filePath),
    rows: safeRows,
    indexByMandarin,
    mandarinVariants,
  };
}

function getLexiconState() {
  const lexiconJsonPath = resolveLexiconJsonPath();
  if (cachedLexiconState && cachedLexiconState.filePath === lexiconJsonPath) {
    return cachedLexiconState;
  }
  const loaded = loadBusinessLexiconSource(lexiconJsonPath, {
    referencePaths: [LEXICON_REFERENCE_CSV_PATH],
    warningMessage: "没有字词对应表",
  });
  if (loaded.status === "reference_only" && !warnedReferenceOnly) {
    warnedReferenceOnly = true;
    console.warn("[Aishell][minnan-helper][ai] 没有字词对应表，检测到本地参考 CSV，已按无词表模式继续返回。", {
      fileName: path.basename(lexiconJsonPath),
      referenceFileName: path.basename(loaded.referenceFilePath || LEXICON_REFERENCE_CSV_PATH),
    });
  }
  if (!loaded.enabled && loaded.status !== "missing" && loaded.status !== "reference_only" && !warnedReadFailure) {
    warnedReadFailure = true;
    console.warn("[Aishell][minnan-helper][ai] 闽南语词表 JSON 读取失败，已按无词表模式继续返回。", {
      fileName: path.basename(lexiconJsonPath),
      status: loaded.status,
      message: loaded.errorMessage || "",
    });
  }
  cachedLexiconState = buildLexiconState(
    parseStructuredLexiconRows(loaded.entries),
    loaded.status,
    "json",
    loaded.warningMessage || loaded.errorMessage,
    lexiconJsonPath
  );
  return cachedLexiconState;
}

function findMatchesAt(referenceText, startIndex, state) {
  const sourceText = String(referenceText || "");
  if (!sourceText || !state?.indexByMandarin || !Array.isArray(state?.mandarinVariants)) {
    return [];
  }
  const matches = [];
  state.mandarinVariants.forEach(function (variant) {
    if (!variant || !sourceText.startsWith(variant, startIndex)) {
      return;
    }
    const rows = state.indexByMandarin.get(variant) || [];
    if (!rows.length) {
      return;
    }
    matches.push({
      start: startIndex,
      end: startIndex + variant.length,
      sourceText: variant,
      mandarinVariant: variant,
      rows,
      candidateOptions: uniqueTerms(
        rows.flatMap(function (row) {
          return row.suggestedVariants;
        })
      ),
      entryIds: uniqueTerms(
        rows.map(function (row) {
          return row.id;
        })
      ),
    });
  });
  return matches.sort(function (left, right) {
    const lengthDelta = (right.end - right.start) - (left.end - left.start);
    if (lengthDelta !== 0) {
      return lengthDelta;
    }
    return left.sourceText.localeCompare(right.sourceText, "zh-Hans-CN");
  });
}

function buildRuleFirstConvertPlan(referenceText, customState) {
  const sourceText = String(referenceText || "");
  const state = customState && typeof customState === "object" ? customState : getLexiconState();
  const fragments = [];
  const ambiguousSegments = [];
  const matchedEntries = [];
  const seenMatchedEntryKeys = new Set();
  let cursor = 0;

  while (cursor < sourceText.length) {
    const matches = findMatchesAt(sourceText, cursor, state);
    if (!matches.length) {
      fragments.push({
        type: "plain",
        text: sourceText[cursor],
        sourceText: sourceText[cursor],
        start: cursor,
        end: cursor + 1,
      });
      cursor += 1;
      continue;
    }

    const longestLength = matches.reduce(function (maxLength, item) {
      return Math.max(maxLength, item.end - item.start);
    }, 0);
    const longestMatches = matches.filter(function (item) {
      return item.end - item.start === longestLength;
    });
    const selectedMatch = longestMatches[0];
    const candidateOptions = uniqueTerms(
      longestMatches.flatMap(function (item) {
        return item.candidateOptions;
      })
    );
    const entryIds = uniqueTerms(
      longestMatches.flatMap(function (item) {
        return item.entryIds;
      })
    );
    const matchedMandarinVariants = uniqueTerms(
      longestMatches.map(function (item) {
        return item.mandarinVariant;
      })
    );
    const sharedFragmentBase = {
      sourceText: selectedMatch.sourceText,
      start: selectedMatch.start,
      end: selectedMatch.end,
      entryIds,
      candidateOptions,
      matchedMandarinVariants,
    };

    longestMatches.forEach(function (item) {
      item.rows.forEach(function (row) {
        const key = String(row.id || "") + "\u0000" + selectedMatch.sourceText;
        if (seenMatchedEntryKeys.has(key)) {
          return;
        }
        seenMatchedEntryKeys.add(key);
        matchedEntries.push({
          id: row.id,
          suggested: row.suggested,
          mandarin: row.mandarin,
          rawRow: row.rawRow,
          suggestedVariants: row.suggestedVariants.slice(),
          mandarinVariants: row.mandarinVariants.slice(),
        });
      });
    });

    if (candidateOptions.length > 1) {
      const segmentIndex = ambiguousSegments.length;
      const ambiguousSegment = Object.assign({}, sharedFragmentBase, {
        segmentIndex,
        currentText: selectedMatch.sourceText,
        reason:
          longestMatches.length > 1 ? "overlapping_conflict" : "multiple_candidate_options",
      });
      ambiguousSegments.push(ambiguousSegment);
      fragments.push(
        Object.assign(
          {
            type: "ambiguous",
            text: selectedMatch.sourceText,
          },
          ambiguousSegment
        )
      );
      cursor = selectedMatch.end;
      continue;
    }

    fragments.push(
      Object.assign(
        {
          type: "fixed",
          text: candidateOptions[0] || selectedMatch.sourceText,
        },
        sharedFragmentBase
      )
    );
    cursor = selectedMatch.end;
  }

  return {
    referenceText: sourceText,
    convertedText: fragments
      .map(function (fragment) {
        return fragment.text;
      })
      .join(""),
    fragments,
    ambiguousSegments,
    matchedEntries,
    matchedCount: matchedEntries.length,
    requiresModelFallback: ambiguousSegments.length > 0,
  };
}

function composeResolvedConvertText(plan, resolvedSegments) {
  const safePlan = plan && typeof plan === "object" ? plan : {};
  const fragments = Array.isArray(safePlan.fragments) ? safePlan.fragments : [];
  if (!fragments.length) {
    return String(safePlan.convertedText || safePlan.referenceText || "");
  }
  const segmentChoiceMap = new Map();
  (Array.isArray(resolvedSegments) ? resolvedSegments : []).forEach(function (item) {
    const source = item && typeof item === "object" ? item : {};
    const segmentIndex = Number.isFinite(Number(source.segmentIndex))
      ? Math.floor(Number(source.segmentIndex))
      : Number.isFinite(Number(source.index))
        ? Math.floor(Number(source.index))
        : -1;
    if (segmentIndex < 0) {
      return;
    }
    const selectedText = normalizeText(
      source.selectedText || source.chosenText || source.resolvedText || source.text
    );
    if (!selectedText) {
      return;
    }
    segmentChoiceMap.set(segmentIndex, selectedText);
  });
  return fragments
    .map(function (fragment) {
      if (fragment?.type !== "ambiguous") {
        return String(fragment?.text || "");
      }
      const segmentIndex = Number(fragment.segmentIndex);
      const selectedText = segmentChoiceMap.get(segmentIndex);
      if (
        selectedText &&
        Array.isArray(fragment.candidateOptions) &&
        fragment.candidateOptions.indexOf(selectedText) >= 0
      ) {
        return selectedText;
      }
      return String(fragment.currentText || fragment.text || fragment.sourceText || "");
    })
    .join("");
}

module.exports = {
  LEXICON_JSON_PATH,
  LEXICON_REFERENCE_CSV_PATH,
  buildRuleFirstConvertPlan,
  composeResolvedConvertText,
  getLexiconState,
  resolveLexiconJsonPath,
};

(function () {
  const DIGITS = {
    零: 0,
    〇: 0,
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  };
  const UNITS = {
    十: 10,
    百: 100,
    千: 1000,
    万: 10000,
    萬: 10000,
    亿: 100000000,
    億: 100000000,
  };

  function removeAllSpaces(text) {
    return String(text || "").replace(/[ \u3000\t\r\n]+/g, "");
  }

  function normalizeText(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  function parseChineseNumber(token) {
    let result = 0;
    let section = 0;
    let current = 0;

    for (let i = 0; i < token.length; i += 1) {
      const char = token[i];
      if (Object.prototype.hasOwnProperty.call(DIGITS, char)) {
        current = DIGITS[char];
        continue;
      }
      const unit = UNITS[char];
      if (!unit) {
        return null;
      }
      if (unit < 10000) {
        if (current === 0) {
          current = 1;
        }
        section += current * unit;
        current = 0;
        continue;
      }
      section = (section + current) * unit;
      result += section;
      section = 0;
      current = 0;
    }

    return result + section + current;
  }

  function convertChineseNumbersToArabic(text) {
    const input = String(text || "");
    return input.replace(/[零〇一二两三四五六七八九十百千万萬亿億]+/g, function (token) {
      if (token.length === 1 && !UNITS[token]) {
        return token;
      }
      const value = parseChineseNumber(token);
      if (value === null || !Number.isFinite(value)) {
        return token;
      }
      return String(value);
    });
  }

  function buildPattern(fromText) {
    const escaped = String(fromText || "")
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .trim();
    if (!escaped) {
      return null;
    }
    return new RegExp(escaped, "g");
  }

  function applyCustomReplacements(text, replacements) {
    let result = String(text || "");
    const list = Array.isArray(replacements) ? replacements : [];
    list.forEach(function (entry) {
      const to = String(entry?.to || "");
      String(entry?.from || "")
        .split(/[,\n，]/)
        .map(function (part) {
          return part.trim();
        })
        .filter(Boolean)
        .forEach(function (from) {
          const pattern = buildPattern(from);
          if (pattern) {
            result = result.replace(pattern, to);
          }
        });
    });
    return result;
  }

  function transformForNumberConvert(text, config) {
    const replaced = applyCustomReplacements(text, config?.customReplacements);
    return convertChineseNumbersToArabic(replaced);
  }

  globalThis.__ASREdgeAlibabaLabelxTranscriptionTextUtils = {
    removeAllSpaces: removeAllSpaces,
    normalizeText: normalizeText,
    applyCustomReplacements: applyCustomReplacements,
    convertChineseNumbersToArabic: convertChineseNumbersToArabic,
    transformForNumberConvert: transformForNumberConvert,
  };
})();

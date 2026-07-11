(function () {
  const UNKNOWN_SUPPLIER_NAME = "未识别供应商";
  const KNOWN_SUPPLIERS = ["希尔贝壳", "棋燊"];
  const REPLACEMENT_CHAR = "\uFFFD";
  const SENSITIVE_SUPPLIER_PATTERN =
    /(https?:\/\/|cookie|authorization|access[_-]?token|bearer|signature=|ossaccesskeyid=)/i;

  function normalizeWhitespace(value) {
    return String(value || "")
      .replace(/\uFEFF/g, "")
      .replace(/[\u200B-\u200D\u2060]/g, "")
      .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000\t\r\n\f\v]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function cleanCsvValue(value) {
    return normalizeWhitespace(value);
  }

  function hasReplacementChar(value) {
    return String(value || "").indexOf(REPLACEMENT_CHAR) >= 0;
  }

  function isCorruptedText(value) {
    const text = cleanCsvValue(value);
    return Boolean(text) && hasReplacementChar(text);
  }

  function stripReplacementChars(value) {
    return String(value || "").replace(/\uFFFD+/g, "");
  }

  function cleanHealthyCsvValue(value) {
    return cleanCsvValue(stripReplacementChars(value));
  }

  function preferHealthyText(primary, fallback) {
    const first = cleanCsvValue(primary);
    const second = cleanCsvValue(fallback);
    if (first && !isCorruptedText(first)) {
      return first;
    }
    if (second && !isCorruptedText(second)) {
      return second;
    }
    return cleanHealthyCsvValue(first || second || "");
  }

  function safeDecodeText(value) {
    const text = String(value || "");
    if (!text) {
      return "";
    }
    if (!/%[0-9a-fA-F]{2}/.test(text)) {
      return text;
    }
    try {
      const decoded = decodeURIComponent(text);
      if (hasReplacementChar(decoded) && !hasReplacementChar(text)) {
        return text;
      }
      return decoded;
    } catch (error) {
      return text;
    }
  }

  function normalizeTaskNameForSupplier(value) {
    return normalizeWhitespace(safeDecodeText(value));
  }

  function compactTaskNameForSupplier(value) {
    return normalizeTaskNameForSupplier(value).replace(
      /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000\s]+/g,
      ""
    );
  }

  function normalizeSupplierName(value) {
    const text = normalizeWhitespace(value);
    if (isCorruptedText(text)) {
      return UNKNOWN_SUPPLIER_NAME;
    }
    return text || UNKNOWN_SUPPLIER_NAME;
  }

  function isUnknownSupplierName(value) {
    const normalized = normalizeSupplierName(value);
    if (!normalized) {
      return true;
    }
    if (isCorruptedText(normalized)) {
      return true;
    }
    const compact = normalized.replace(/\s+/g, "").toLowerCase();
    return (
      normalized === UNKNOWN_SUPPLIER_NAME ||
      compact === "unknown-supplier" ||
      compact === "unknownsupplier"
    );
  }

  function getSupplierKey(value) {
    const normalized = normalizeSupplierName(value);
    if (isUnknownSupplierName(normalized)) {
      return "unknown-supplier";
    }
    return normalized.replace(/\s+/g, "").toLowerCase();
  }

  function sanitizeSupplierPathSegment(value) {
    const normalized = normalizeSupplierName(value);
    if (isUnknownSupplierName(normalized)) {
      return UNKNOWN_SUPPLIER_NAME;
    }
    if (SENSITIVE_SUPPLIER_PATTERN.test(normalized)) {
      return UNKNOWN_SUPPLIER_NAME;
    }
    const safe = normalized
      .replace(/[\/\\:\*\?"<>\|]/g, "_")
      .replace(/^\.+/, "")
      .replace(/\.+$/, "")
      .trim();
    return safe || UNKNOWN_SUPPLIER_NAME;
  }

  function inferSupplierFromTaskName(taskName) {
    const text = normalizeTaskNameForSupplier(taskName);
    if (!text) {
      return { name: UNKNOWN_SUPPLIER_NAME, source: "fallback" };
    }
    const compactText = compactTaskNameForSupplier(text);

    for (let index = 0; index < KNOWN_SUPPLIERS.length; index += 1) {
      const known = KNOWN_SUPPLIERS[index];
      if (text.indexOf(known) >= 0 || compactText.indexOf(known) >= 0) {
        return { name: known, source: "task-name-rule" };
      }
    }

    if (isCorruptedText(text)) {
      return { name: UNKNOWN_SUPPLIER_NAME, source: "fallback" };
    }

    const separatorMatch = text.match(/^(.+?)[\-－—]/);
    if (separatorMatch && separatorMatch[1] && separatorMatch[1].trim()) {
      const prefix = cleanHealthyCsvValue(separatorMatch[1]);
      if (prefix) {
        return { name: prefix, source: "task-name-prefix" };
      }
    }

    const plainAsrIndex = text.indexOf("中文普通话");
    if (plainAsrIndex > 0) {
      const prefix = cleanHealthyCsvValue(text.slice(0, plainAsrIndex));
      if (prefix) {
        return { name: prefix, source: "task-name-prefix" };
      }
    }

    return { name: UNKNOWN_SUPPLIER_NAME, source: "fallback" };
  }

  function extractSupplierValue(value) {
    if (value && typeof value === "object") {
      return value.name || value.label || value.value || "";
    }
    return value || "";
  }

  function resolveSupplierInfo(input) {
    const options = input && typeof input === "object" ? input : {};
    const payload = options.payload && typeof options.payload === "object" ? options.payload : {};
    const csvPatch = options.csvPatch && typeof options.csvPatch === "object" ? options.csvPatch : {};

    const payloadCandidates = [
      extractSupplierValue(payload.supplier),
      extractSupplierValue(payload.vendor),
      extractSupplierValue(options.supplier),
      extractSupplierValue(options.vendor),
    ];
    for (let index = 0; index < payloadCandidates.length; index += 1) {
      const candidate = cleanCsvValue(payloadCandidates[index]);
      if (!candidate) {
        continue;
      }
      if (isCorruptedText(candidate)) {
        continue;
      }
      const name = normalizeSupplierName(candidate);
      if (isUnknownSupplierName(name)) {
        continue;
      }
      const safeName = sanitizeSupplierPathSegment(name);
      const finalName = safeName === UNKNOWN_SUPPLIER_NAME ? UNKNOWN_SUPPLIER_NAME : name;
      return {
        key: getSupplierKey(finalName),
        name: finalName,
        safeName: safeName,
        source: "payload",
      };
    }

    const csvSupplier = cleanCsvValue(csvPatch["供应商"] || "");
    if (csvSupplier) {
      if (!isCorruptedText(csvSupplier)) {
      const name = normalizeSupplierName(csvSupplier);
      if (!isUnknownSupplierName(name)) {
        const safeName = sanitizeSupplierPathSegment(name);
        const finalName = safeName === UNKNOWN_SUPPLIER_NAME ? UNKNOWN_SUPPLIER_NAME : name;
        return {
          key: getSupplierKey(finalName),
          name: finalName,
          safeName: safeName,
          source: "csv-patch",
        };
      }
      }
    }

    const inferred = inferSupplierFromTaskName(
      preferHealthyText(options.taskName || options.name, csvPatch["任务名称"] || "")
    );
    const inferredName = normalizeSupplierName(inferred.name);
    const inferredSafe = sanitizeSupplierPathSegment(inferredName);
    const finalName = inferredSafe === UNKNOWN_SUPPLIER_NAME ? UNKNOWN_SUPPLIER_NAME : inferredName;
    return {
      key: getSupplierKey(finalName),
      name: finalName,
      safeName: inferredSafe,
      source: inferred.source || "fallback",
    };
  }

  globalThis.ASREdgeStatisticsSupplier = {
    UNKNOWN_SUPPLIER_NAME: UNKNOWN_SUPPLIER_NAME,
    cleanCsvValue: cleanCsvValue,
    cleanHealthyCsvValue: cleanHealthyCsvValue,
    hasReplacementChar: hasReplacementChar,
    isCorruptedText: isCorruptedText,
    preferHealthyText: preferHealthyText,
    normalizeSupplierName: normalizeSupplierName,
    isUnknownSupplierName: isUnknownSupplierName,
    normalizeTaskNameForSupplier: normalizeTaskNameForSupplier,
    compactTaskNameForSupplier: compactTaskNameForSupplier,
    inferSupplierFromTaskName: inferSupplierFromTaskName,
    resolveSupplierInfo: resolveSupplierInfo,
    sanitizeSupplierPathSegment: sanitizeSupplierPathSegment,
    getSupplierKey: getSupplierKey,
  };
})();

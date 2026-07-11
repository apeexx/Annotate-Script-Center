"use strict";

const ANSWER_CHOICE_MAP = {
  first_better: "choiceFirstBetter",
  second_better: "choiceSecondBetter",
  both_bad: "choiceBothBad",
  uncertain_or_similar: "choiceUnsure",
  other_dialect_or_language: "choiceOtherDialect",
};

const ANSWER_TEXT_MAP = {
  first_better: "第一个更好",
  second_better: "第二个更好",
  both_bad: "都不好",
  uncertain_or_similar: "不确定或差不多",
  other_dialect_or_language: "其他方言或语种",
};

const RISK_LEVELS = ["low", "medium", "high"];

function createSchemaError(message, code) {
  const error = new Error(message);
  error.code = String(code || "invalid-model-schema");
  error.statusCode = 502;
  return error;
}

function normalizeConfidence(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }
  return Math.max(0, Math.min(1, numericValue));
}

function normalizeShortText(value, limit) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, Number(limit) || 120);
}

function normalizeStringArray(value, limit, itemLimit) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .slice(0, Number(limit) || 20)
    .map(function (item) {
      return normalizeShortText(item, itemLimit || 80);
    })
    .filter(Boolean);
}

function parseModelJsonText(rawText, requestId) {
  const source = String(rawText || "").trim();
  if (!source) {
    const error = new Error("模型未返回文本结果。");
    error.code = "empty-provider-response";
    error.statusCode = 502;
    throw error;
  }

  const withoutCodeFence = source
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const attempts = [withoutCodeFence];
  const firstBrace = withoutCodeFence.indexOf("{");
  const lastBrace = withoutCodeFence.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    attempts.push(withoutCodeFence.slice(firstBrace, lastBrace + 1));
  }

  for (let index = 0; index < attempts.length; index += 1) {
    const candidate = attempts[index];
    try {
      return JSON.parse(candidate);
    } catch (error) {
      // try next candidate
    }
  }

  const error = new Error(
    "模型输出 JSON 解析失败（requestId: " + String(requestId || "") + "）。"
  );
  error.code = "invalid-model-json";
  error.statusCode = 502;
  throw error;
}

function normalizeListenResponse(modelJson) {
  const source = modelJson && typeof modelJson === "object" ? modelJson : {};
  const heardText = normalizeShortText(source.heardText, 600);
  const confidence = normalizeConfidence(source.confidence);
  const isValidAudio =
    typeof source.isValidAudio === "boolean" ? source.isValidAudio : true;
  const invalidReasons = normalizeStringArray(source.invalidReasons, 10, 60);
  const uncertainParts = normalizeStringArray(source.uncertainParts, 10, 80);
  const audioNotes = normalizeShortText(source.audioNotes, 40);

  if (!isValidAudio && invalidReasons.length === 0) {
    invalidReasons.push("音频无效或不可访问。");
  }

  return {
    heardText,
    confidence,
    isValidAudio,
    invalidReasons,
    uncertainParts,
    audioNotes,
  };
}

function normalizeEvidence(value, fallbackHeardText) {
  const source = value && typeof value === "object" ? value : {};
  function normalizeMatch(valueText) {
    const text = normalizeShortText(valueText, 16).toLowerCase();
    if (text === "high" || text === "medium" || text === "low") {
      return text;
    }
    return "unknown";
  }
  return {
    heardText: normalizeShortText(
      source.heardText || fallbackHeardText || "",
      600
    ),
    asrText1Match: normalizeMatch(source.asrText1Match),
    asrText2Match: normalizeMatch(source.asrText2Match),
    contextHint: normalizeShortText(source.contextHint, 120),
    webSearchHint: normalizeShortText(source.webSearchHint, 120),
  };
}

function normalizeCompareResponse(modelJson, context) {
  const source = modelJson && typeof modelJson === "object" ? modelJson : {};
  const answer = String(source.answer || "").trim();
  if (!Object.prototype.hasOwnProperty.call(ANSWER_CHOICE_MAP, answer)) {
    throw createSchemaError("模型返回的 answer 不在允许范围内。", "invalid-model-schema");
  }

  const rawChoiceActionKey = String(source.choiceActionKey || "").trim();
  const mappedChoiceActionKey = ANSWER_CHOICE_MAP[answer];
  if (rawChoiceActionKey && rawChoiceActionKey !== mappedChoiceActionKey) {
    throw createSchemaError(
      "模型返回的 choiceActionKey 与 answer 映射不一致。",
      "invalid-model-schema"
    );
  }

  const confidence = normalizeConfidence(source.confidence);
  const riskLevel = normalizeShortText(source.riskLevel, 12).toLowerCase() || "medium";
  if (RISK_LEVELS.indexOf(riskLevel) < 0) {
    throw createSchemaError("模型返回的 riskLevel 不在允许范围内。", "invalid-model-schema");
  }

  const needManualSearch = source.needManualSearch === true;
  const shouldWarnBeforeApply =
    source.shouldWarnBeforeApply === true ||
    needManualSearch ||
    confidence < 0.65 ||
    riskLevel === "high";
  const contextAvailable = context?.contextAvailable === true;
  const contextIncluded = context?.contextIncluded === true && contextAvailable;
  const contextUsed =
    source.contextUsed === true || (contextIncluded && normalizeShortText(source.reasonSummary, 200).length > 0);

  return {
    answer,
    answerText: ANSWER_TEXT_MAP[answer],
    choiceActionKey: mappedChoiceActionKey,
    confidence,
    reasonSummary: normalizeShortText(source.reasonSummary, 80) || "模型未提供理由。",
    riskLevel,
    needManualSearch,
    shouldWarnBeforeApply,
    contextUsed: contextUsed === true,
    evidence: normalizeEvidence(source.evidence, context?.heardText || ""),
  };
}

function normalizeUsage(usage) {
  const source = usage && typeof usage === "object" ? usage : {};
  const normalized = {};
  ["prompt_tokens", "completion_tokens", "total_tokens"].forEach(function (key) {
    const value = Number(source[key]);
    if (Number.isFinite(value) && value >= 0) {
      normalized[key] = Math.floor(value);
    }
  });
  return normalized;
}

function buildSuggestResponse(parts) {
  const request = parts?.request || {};
  const listen = parts?.listen || {};
  const compare = parts?.compare || {};
  const webSearch = parts?.webSearch || {};
  return {
    requestId: String(parts?.requestId || ""),
    answer: String(compare.answer || ""),
    answerText: ANSWER_TEXT_MAP[String(compare.answer || "")] || "",
    choiceActionKey: String(compare.choiceActionKey || ANSWER_CHOICE_MAP[compare.answer] || ""),
    confidence: normalizeConfidence(compare.confidence),
    reasonSummary: normalizeShortText(compare.reasonSummary, 80) || "模型未提供理由。",
    riskLevel: String(compare.riskLevel || "medium"),
    needManualSearch: compare.needManualSearch === true,
    shouldWarnBeforeApply: compare.shouldWarnBeforeApply === true,
    contextAvailable: request.contextAvailable === true,
    contextIncluded: request.contextIncluded === true,
    listen: {
      heardText: normalizeShortText(listen.heardText, 600),
      confidence: normalizeConfidence(listen.confidence),
      isValidAudio: listen.isValidAudio !== false,
      invalidReasons: normalizeStringArray(listen.invalidReasons, 10, 60),
      uncertainParts: normalizeStringArray(listen.uncertainParts, 10, 80),
      audioNotes: normalizeShortText(listen.audioNotes, 40),
    },
    evidence: compare.evidence || normalizeEvidence({}, listen.heardText),
    models: {
      listenModel: String(parts?.listenModel || ""),
      compareModel: String(parts?.compareModel || ""),
    },
    usage: {
      listen: normalizeUsage(parts?.listenUsage),
      compare: normalizeUsage(parts?.compareUsage),
    },
    timing: {
      listenDurationMs: Math.max(0, Number(parts?.listenDurationMs || 0)),
      compareDurationMs: Math.max(0, Number(parts?.compareDurationMs || 0)),
      totalDurationMs: Math.max(0, Number(parts?.totalDurationMs || 0)),
    },
    webSearch: {
      enabled: webSearch.enabled === true,
      used: webSearch.used === true,
      fallbackUsed: webSearch.fallbackUsed === true,
      fallbackReason: normalizeShortText(webSearch.fallbackReason, 120),
    },
    thinking: {
      requested: parts?.thinking?.requested === true,
      listenFallbackUsed: parts?.thinking?.listenFallbackUsed === true,
      compareFallbackUsed: parts?.thinking?.compareFallbackUsed === true,
    },
    model: String(parts?.compareModel || ""),
    ruleVersion: String(parts?.ruleVersion || ""),
    mock: parts?.mock === true,
  };
}

module.exports = {
  ANSWER_CHOICE_MAP,
  ANSWER_TEXT_MAP,
  RISK_LEVELS,
  buildSuggestResponse,
  normalizeCompareResponse,
  normalizeConfidence,
  normalizeListenResponse,
  normalizeUsage,
  parseModelJsonText,
};

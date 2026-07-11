"use strict";

const VERDICT_SET = new Set(["same", "mostly_same", "different", "uncertain", "invalid_audio"]);
const LINE_DECISION_SET = new Set(["same", "minor_diff", "different", "uncertain"]);
const REVIEW_CONCLUSION_SET = new Set(["pass", "need_review", "risky", "invalid_audio", "uncertain"]);
const VALIDITY_DECISION_SET = new Set(["valid", "invalid", "uncertain"]);
const AGE_RANGE_SET = new Set(["0-5", "6-12", "13-18", "19-25", "26-36", "37-50", "51-65", "65以上", "uncertain"]);

function normalizeConfidence(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }
  return Math.max(0, Math.min(1, numericValue));
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeStringArray(value, maxLength) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map(function (item) {
      if (typeof item === "string") {
        return item.trim();
      }
      if (item && typeof item === "object") {
        return JSON.stringify(item);
      }
      return String(item || "").trim();
    })
    .filter(Boolean)
    .slice(0, maxLength || 30);
}

function parseModelJsonText(rawText, requestId) {
  const source = String(rawText || "").trim();
  if (!source) {
    throw new Error("模型未返回文本。");
  }

  const withoutFence = source
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const attempts = [withoutFence];
  const firstBrace = withoutFence.indexOf("{");
  const lastBrace = withoutFence.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    attempts.push(withoutFence.slice(firstBrace, lastBrace + 1));
  }

  for (let index = 0; index < attempts.length; index += 1) {
    try {
      return JSON.parse(attempts[index]);
    } catch (error) {
      // try next
    }
  }

  const parseError = new Error(
    "模型 JSON 解析失败（requestId: " + String(requestId || "") + "）。"
  );
  parseError.code = "invalid-json";
  throw parseError;
}

function normalizeLineDecision(value) {
  const decision = String(value || "").trim();
  return LINE_DECISION_SET.has(decision) ? decision : "uncertain";
}

function normalizeVerdict(value) {
  const verdict = String(value || "").trim();
  return VERDICT_SET.has(verdict) ? verdict : "uncertain";
}

function normalizeReviewConclusion(value) {
  const conclusion = String(value || "").trim();
  return REVIEW_CONCLUSION_SET.has(conclusion) ? conclusion : "uncertain";
}

function normalizeValidityDecision(value, isValidAudio) {
  const decision = String(value || "").trim();
  if (VALIDITY_DECISION_SET.has(decision)) {
    return decision;
  }
  return isValidAudio ? "valid" : "invalid";
}

function normalizeAgeRangeGuess(value) {
  const text = String(value || "").trim();
  return AGE_RANGE_SET.has(text) ? text : "uncertain";
}

function normalizeTriState(value) {
  if (value === true || value === false || value === null) {
    return value;
  }
  const text = String(value || "").trim().toLowerCase();
  if (!text) {
    return null;
  }
  if (text === "true" || text === "correct" || text === "pass" || text === "same" || text === "yes") {
    return true;
  }
  if (
    text === "false" ||
    text === "wrong" ||
    text === "fail" ||
    text === "different" ||
    text === "no"
  ) {
    return false;
  }
  if (text === "null" || text === "uncertain" || text === "unknown") {
    return null;
  }
  return null;
}

function resolveCheckCorrect(explicitValue, platformValue, suggestedValue, issues) {
  if (explicitValue === true || explicitValue === false || explicitValue === null) {
    return explicitValue;
  }
  if (Array.isArray(issues) && issues.length > 0) {
    return false;
  }
  const platform = normalizeText(platformValue);
  const suggested = normalizeText(suggestedValue);
  if (!platform || !suggested || suggested === "uncertain") {
    return null;
  }
  return platform === suggested;
}

function normalizePredictionCheck(source, fallback) {
  const input = source && typeof source === "object" ? source : {};
  const options = fallback && typeof fallback === "object" ? fallback : {};
  const platformValue = normalizeText(input.platformValue || options.platformValue || "");
  const suggestedValue = normalizeText(
    input.suggestedValue || input.recommendedText || options.suggestedValue || platformValue
  );
  const reason = normalizeText(input.reason || input.message || options.reason || "");
  const issues = normalizeStringArray(options.issues, 20);
  const confidenceValue =
    input.confidence !== undefined && input.confidence !== null
      ? input.confidence
      : options.confidence;
  const explicit = normalizeTriState(input.isCorrect);
  return {
    isCorrect: resolveCheckCorrect(explicit, platformValue, suggestedValue, issues),
    platformValue: platformValue,
    suggestedValue: suggestedValue || platformValue,
    reason: reason,
    confidence: normalizeConfidence(confidenceValue),
  };
}

function normalizeListenResponse(modelJson) {
  const source = modelJson && typeof modelJson === "object" ? modelJson : {};
  const isValidAudio = source.isValidAudio !== false;
  const recognizedMandarinText = normalizeText(
    source.recognizedMandarinText ||
      source.heardMandarinMeaning ||
      source.mandarinMeaning ||
      source.meaning ||
      ""
  );
  return {
    heardDialectText: normalizeText(source.heardDialectText || source.heardText || source.text || ""),
    heardMandarinMeaning: recognizedMandarinText,
    recognizedMandarinText: recognizedMandarinText,
    isValidAudio,
    validityDecision: normalizeValidityDecision(source.validityDecision, isValidAudio),
    invalidReasons: normalizeStringArray(source.invalidReasons, 20),
    riskFlags: normalizeStringArray(source.riskFlags, 20),
    genderGuess: ["男", "女", "uncertain"].includes(String(source.genderGuess || "").trim())
      ? String(source.genderGuess || "").trim() || "uncertain"
      : "uncertain",
    ageRangeGuess: normalizeAgeRangeGuess(source.ageRangeGuess),
    confidence: normalizeConfidence(source.confidence),
  };
}

function normalizeRuleFirstComparison(modelJson, request, listen) {
  const source = modelJson && typeof modelJson === "object" ? modelJson : {};
  const check = source.textRuleCheck && typeof source.textRuleCheck === "object" ? source.textRuleCheck : {};
  const recommendations =
    source.recommendations && typeof source.recommendations === "object" ? source.recommendations : {};
  const speakerCheckSource =
    source.speakerCheck && typeof source.speakerCheck === "object" ? source.speakerCheck : {};
  const dialectTextCheckSource =
    source.dialectTextCheck && typeof source.dialectTextCheck === "object" ? source.dialectTextCheck : {};
  const mandarinTextCheckSource =
    source.mandarinTextCheck && typeof source.mandarinTextCheck === "object" ? source.mandarinTextCheck : {};
  const overallSource = source.overall && typeof source.overall === "object" ? source.overall : {};

  const speakerIssues = normalizeStringArray(check.speakerAttributeIssues, 30);
  const dialectIssues = normalizeStringArray(check.dialectIssues, 30);
  const mandarinIssues = normalizeStringArray(check.mandarinIssues, 30);
  const translationConsistencyIssues = normalizeStringArray(check.translationConsistencyIssues, 30);
  const punctuationIssues = normalizeStringArray(check.punctuationIssues, 30);
  const lexiconIssues = normalizeStringArray(check.lexiconIssues, 30);
  const ruleIssues = normalizeStringArray(check.ruleIssues, 30);

  const speakerCheck = {
    gender: normalizePredictionCheck(speakerCheckSource.gender, {
      platformValue: request?.speaker?.gender || "",
      suggestedValue: listen?.genderGuess || "",
      reason: speakerIssues[0] || "",
      issues: speakerIssues,
      confidence: listen?.confidence || source.confidence,
    }),
    ageRange: normalizePredictionCheck(speakerCheckSource.ageRange, {
      platformValue: request?.speaker?.ageRange || "",
      suggestedValue: listen?.ageRangeGuess || "",
      reason: speakerIssues[1] || speakerIssues[0] || "",
      issues: speakerIssues,
      confidence: listen?.confidence || source.confidence,
    }),
  };

  const dialectTextCheck = normalizePredictionCheck(dialectTextCheckSource, {
    platformValue: request.platformDialectText,
    suggestedValue: recommendations.dialectText || request.platformDialectText,
    reason: dialectIssues[0] || "",
    issues: dialectIssues,
    confidence: source.confidence,
  });
  const mandarinTextCheck = normalizePredictionCheck(mandarinTextCheckSource, {
    platformValue: request.platformMandarinText,
    suggestedValue: recommendations.mandarinText || request.platformMandarinText,
    reason: mandarinIssues[0] || translationConsistencyIssues[0] || "",
    issues: mandarinIssues.concat(translationConsistencyIssues),
    confidence: source.confidence,
  });

  const conclusion = normalizeReviewConclusion(overallSource.reviewConclusion || source.reviewConclusion);
  const summary = normalizeText(
    overallSource.summary || recommendations.summary || source.summary || ""
  );
  if (
    speakerCheck.gender.isCorrect === false &&
    speakerCheck.gender.reason &&
    speakerIssues.indexOf(speakerCheck.gender.reason) < 0
  ) {
    speakerIssues.push(speakerCheck.gender.reason);
  }
  if (
    speakerCheck.ageRange.isCorrect === false &&
    speakerCheck.ageRange.reason &&
    speakerIssues.indexOf(speakerCheck.ageRange.reason) < 0
  ) {
    speakerIssues.push(speakerCheck.ageRange.reason);
  }
  if (
    dialectTextCheck.isCorrect === false &&
    dialectTextCheck.reason &&
    dialectIssues.indexOf(dialectTextCheck.reason) < 0
  ) {
    dialectIssues.push(dialectTextCheck.reason);
  }
  if (
    mandarinTextCheck.isCorrect === false &&
    mandarinTextCheck.reason &&
    mandarinIssues.indexOf(mandarinTextCheck.reason) < 0
  ) {
    mandarinIssues.push(mandarinTextCheck.reason);
  }
  return {
    reviewConclusion: conclusion,
    shouldReview:
      overallSource.shouldReview === true ||
      source.shouldReview === true ||
      conclusion === "need_review" ||
      conclusion === "risky" ||
      conclusion === "uncertain",
    confidence: normalizeConfidence(source.confidence),
    speakerCheck: speakerCheck,
    dialectTextCheck: dialectTextCheck,
    mandarinTextCheck: mandarinTextCheck,
    overall: {
      reviewConclusion: conclusion,
      shouldReview:
        overallSource.shouldReview === true ||
        source.shouldReview === true ||
        conclusion === "need_review" ||
        conclusion === "risky" ||
        conclusion === "uncertain",
      summary: summary,
    },
    textRuleCheck: {
      dialectIssues: dialectIssues,
      mandarinIssues: mandarinIssues,
      translationConsistencyIssues: translationConsistencyIssues,
      punctuationIssues: punctuationIssues,
      speakerAttributeIssues: speakerIssues,
      lexiconIssues: lexiconIssues,
      ruleIssues: ruleIssues,
    },
    recommendations: {
      dialectText: dialectTextCheck.suggestedValue,
      mandarinText: mandarinTextCheck.suggestedValue,
      summary: summary,
    },
    legacyComparison: {
      verdict:
        conclusion === "pass"
          ? "same"
          : conclusion === "need_review"
            ? "mostly_same"
            : conclusion === "risky"
              ? "different"
              : conclusion === "invalid_audio"
                ? "invalid_audio"
              : "uncertain",
      dialectLine: {
        decision:
          dialectTextCheck.isCorrect === true
            ? "same"
            : dialectTextCheck.isCorrect === false
              ? "different"
              : conclusion === "need_review"
              ? "minor_diff"
              : "uncertain",
        platformText: normalizeText(request.platformDialectText),
        aiText: normalizeText(listen.heardDialectText),
        recommendedText: dialectTextCheck.suggestedValue,
        issues: dialectIssues,
      },
      mandarinLine: {
        decision:
          mandarinTextCheck.isCorrect === true
            ? "same"
            : mandarinTextCheck.isCorrect === false
              ? "different"
              : conclusion === "need_review"
              ? "minor_diff"
              : "uncertain",
        platformText: normalizeText(request.platformMandarinText),
        recommendedText: mandarinTextCheck.suggestedValue,
        issues: mandarinIssues,
      },
      lexiconIssues: lexiconIssues,
      ruleIssues: ruleIssues,
    },
  };
}

function normalizeOmniSingleComparison(modelJson, request) {
  const source = modelJson && typeof modelJson === "object" ? modelJson : {};
  const audioCheckSource =
    source.audioCheck && typeof source.audioCheck === "object" ? source.audioCheck : {};
  const check = source.textRuleCheck && typeof source.textRuleCheck === "object" ? source.textRuleCheck : {};
  const recommendations =
    source.recommendations && typeof source.recommendations === "object" ? source.recommendations : {};
  const heardDialectText = normalizeText(
    audioCheckSource.heardDialectText || source.heardDialectText || source.heardText || ""
  );
  const heardMandarinMeaning = normalizeText(
    audioCheckSource.heardMandarinMeaning || source.heardMandarinMeaning || source.heardMeaning || ""
  );
  const speakerCheckSource =
    source.speakerCheck && typeof source.speakerCheck === "object" ? source.speakerCheck : {};
  const dialectTextCheckSource =
    source.dialectTextCheck && typeof source.dialectTextCheck === "object" ? source.dialectTextCheck : {};
  const mandarinTextCheckSource =
    source.mandarinTextCheck && typeof source.mandarinTextCheck === "object" ? source.mandarinTextCheck : {};
  const overallSource = source.overall && typeof source.overall === "object" ? source.overall : {};

  const fallbackConclusion =
    source.decision === "keep_page_text"
      ? "pass"
      : source.needHumanReview === true
        ? "need_review"
        : "uncertain";
  const reviewConclusion = normalizeReviewConclusion(
    overallSource.reviewConclusion || source.reviewConclusion || fallbackConclusion
  );
  const shouldReview =
    overallSource.shouldReview === true ||
    source.shouldReview === true ||
    source.needHumanReview === true ||
    reviewConclusion === "need_review" ||
    reviewConclusion === "risky" ||
    reviewConclusion === "uncertain";

  const dialectRecommendation = normalizeText(
    recommendations.dialectText || source.recommendedDialectText || source.recommendedText || request.platformDialectText
  );
  const mandarinRecommendation = normalizeText(
    recommendations.mandarinText || source.recommendedMandarinText || request.platformMandarinText
  );
  const summary = normalizeText(overallSource.summary || recommendations.summary || source.summary || "");

  const ruleIssuesFromChangePoints = Array.isArray(source.changePoints)
    ? source.changePoints.map(function (item) {
        if (typeof item === "string") {
          return item.trim();
        }
        if (item && typeof item === "object") {
          const fromText = String(item.from || "").trim();
          const toText = String(item.to || "").trim();
          if (fromText || toText) {
            return (fromText || "-") + " -> " + (toText || "-");
          }
          return JSON.stringify(item);
        }
        return String(item || "").trim();
      }).filter(Boolean)
    : [];

  const textRuleCheck = {
    dialectIssues: normalizeStringArray(check.dialectIssues, 30),
    mandarinIssues: normalizeStringArray(check.mandarinIssues, 30),
    translationConsistencyIssues: normalizeStringArray(check.translationConsistencyIssues, 30),
    punctuationIssues: normalizeStringArray(check.punctuationIssues, 30),
    speakerAttributeIssues: normalizeStringArray(check.speakerAttributeIssues, 30),
    lexiconIssues: normalizeStringArray(check.lexiconIssues, 30),
    ruleIssues: normalizeStringArray(check.ruleIssues, 30).concat(ruleIssuesFromChangePoints),
  };
  const speakerCheck = {
    gender: normalizePredictionCheck(speakerCheckSource.gender, {
      platformValue: request?.speaker?.gender || "",
      suggestedValue: audioCheckSource.genderGuess || "",
      reason: textRuleCheck.speakerAttributeIssues[0] || "",
      issues: textRuleCheck.speakerAttributeIssues,
      confidence: audioCheckSource.confidence || source.confidence,
    }),
    ageRange: normalizePredictionCheck(speakerCheckSource.ageRange, {
      platformValue: request?.speaker?.ageRange || "",
      suggestedValue: audioCheckSource.ageRangeGuess || "",
      reason: textRuleCheck.speakerAttributeIssues[1] || textRuleCheck.speakerAttributeIssues[0] || "",
      issues: textRuleCheck.speakerAttributeIssues,
      confidence: audioCheckSource.confidence || source.confidence,
    }),
  };
  const dialectTextCheck = normalizePredictionCheck(dialectTextCheckSource, {
    platformValue: request.platformDialectText,
    suggestedValue: dialectRecommendation,
    reason: textRuleCheck.dialectIssues[0] || "",
    issues: textRuleCheck.dialectIssues,
    confidence: source.confidence,
  });
  const mandarinTextCheck = normalizePredictionCheck(mandarinTextCheckSource, {
    platformValue: request.platformMandarinText,
    suggestedValue: mandarinRecommendation,
    reason: textRuleCheck.mandarinIssues[0] || textRuleCheck.translationConsistencyIssues[0] || "",
    issues: textRuleCheck.mandarinIssues.concat(textRuleCheck.translationConsistencyIssues),
    confidence: source.confidence,
  });
  if (
    speakerCheck.gender.isCorrect === false &&
    speakerCheck.gender.reason &&
    textRuleCheck.speakerAttributeIssues.indexOf(speakerCheck.gender.reason) < 0
  ) {
    textRuleCheck.speakerAttributeIssues.push(speakerCheck.gender.reason);
  }
  if (
    speakerCheck.ageRange.isCorrect === false &&
    speakerCheck.ageRange.reason &&
    textRuleCheck.speakerAttributeIssues.indexOf(speakerCheck.ageRange.reason) < 0
  ) {
    textRuleCheck.speakerAttributeIssues.push(speakerCheck.ageRange.reason);
  }
  if (
    dialectTextCheck.isCorrect === false &&
    dialectTextCheck.reason &&
    textRuleCheck.dialectIssues.indexOf(dialectTextCheck.reason) < 0
  ) {
    textRuleCheck.dialectIssues.push(dialectTextCheck.reason);
  }
  if (
    mandarinTextCheck.isCorrect === false &&
    mandarinTextCheck.reason &&
    textRuleCheck.mandarinIssues.indexOf(mandarinTextCheck.reason) < 0
  ) {
    textRuleCheck.mandarinIssues.push(mandarinTextCheck.reason);
  }

  return {
    reviewConclusion: reviewConclusion,
    shouldReview: shouldReview,
    confidence: normalizeConfidence(source.confidence),
    speakerCheck: speakerCheck,
    dialectTextCheck: dialectTextCheck,
    mandarinTextCheck: mandarinTextCheck,
    overall: {
      reviewConclusion: reviewConclusion,
      shouldReview: shouldReview,
      summary: summary,
    },
    audioCheck: {
      isValidAudio: audioCheckSource.isValidAudio !== false,
      validityDecision: normalizeValidityDecision(
        audioCheckSource.validityDecision,
        audioCheckSource.isValidAudio !== false
      ),
      invalidReasons: normalizeStringArray(audioCheckSource.invalidReasons, 20),
      riskFlags: normalizeStringArray(audioCheckSource.riskFlags, 20),
      genderGuess: ["男", "女", "uncertain"].includes(String(audioCheckSource.genderGuess || "").trim())
        ? String(audioCheckSource.genderGuess || "").trim() || "uncertain"
        : "uncertain",
      ageRangeGuess: normalizeAgeRangeGuess(audioCheckSource.ageRangeGuess),
      heardDialectText: heardDialectText,
      heardMandarinMeaning: heardMandarinMeaning,
      confidence: normalizeConfidence(audioCheckSource.confidence || source.confidence),
    },
    textRuleCheck: textRuleCheck,
    recommendations: {
      dialectText: dialectTextCheck.suggestedValue,
      mandarinText: mandarinTextCheck.suggestedValue,
      summary: summary,
    },
    legacyComparison: {
      verdict:
        reviewConclusion === "pass"
          ? "same"
          : reviewConclusion === "need_review"
            ? "mostly_same"
            : reviewConclusion === "risky"
              ? "different"
              : reviewConclusion === "invalid_audio"
                ? "invalid_audio"
              : "uncertain",
      dialectLine: {
        decision:
          reviewConclusion === "pass"
            ? "same"
            : reviewConclusion === "need_review"
              ? "minor_diff"
              : reviewConclusion === "risky"
                ? "different"
                : "uncertain",
        platformText: normalizeText(request.platformDialectText),
        aiText: heardDialectText,
        recommendedText: dialectRecommendation,
        issues: normalizeStringArray(textRuleCheck.dialectIssues, 30),
      },
      mandarinLine: {
        decision:
          reviewConclusion === "pass"
            ? "same"
            : reviewConclusion === "need_review"
              ? "minor_diff"
              : reviewConclusion === "risky"
                ? "different"
                : "uncertain",
        platformText: normalizeText(request.platformMandarinText),
        recommendedText: mandarinRecommendation,
        issues: normalizeStringArray(textRuleCheck.mandarinIssues, 30),
      },
      lexiconIssues: normalizeStringArray(textRuleCheck.lexiconIssues, 30),
      ruleIssues: normalizeStringArray(textRuleCheck.ruleIssues, 30),
    },
  };
}

function normalizeComparisonResponse(modelJson, request) {
  const source = modelJson && typeof modelJson === "object" ? modelJson : {};
  const dialectSource = source.dialectLine && typeof source.dialectLine === "object" ? source.dialectLine : {};
  const mandarinSource =
    source.mandarinLine && typeof source.mandarinLine === "object" ? source.mandarinLine : {};

  return {
    verdict: normalizeVerdict(source.verdict),
    shouldReview:
      source.shouldReview === true ||
      source.should_review === true ||
      normalizeVerdict(source.verdict) !== "same",
    confidence: normalizeConfidence(source.confidence),
    dialectLine: {
      decision: normalizeLineDecision(dialectSource.decision),
      platformText: normalizeText(dialectSource.platformText || request.platformDialectText),
      aiText: normalizeText(dialectSource.aiText),
      recommendedText: normalizeText(dialectSource.recommendedText || dialectSource.aiText),
      issues: normalizeStringArray(dialectSource.issues, 30),
    },
    mandarinLine: {
      decision: normalizeLineDecision(mandarinSource.decision),
      platformText: normalizeText(mandarinSource.platformText || request.platformMandarinText),
      recommendedText: normalizeText(mandarinSource.recommendedText),
      issues: normalizeStringArray(mandarinSource.issues, 30),
    },
    lexiconIssues: normalizeStringArray(source.lexiconIssues, 30),
    ruleIssues: normalizeStringArray(source.ruleIssues, 30),
  };
}

function normalizeUsage(usage) {
  const source = usage && typeof usage === "object" ? usage : {};
  const promptTokens = Number(source.promptTokens || source.prompt_tokens || source.input_tokens || 0);
  const completionTokens = Number(
    source.completionTokens || source.completion_tokens || source.output_tokens || 0
  );
  const totalTokens = Number(
    source.totalTokens || source.total_tokens || promptTokens + completionTokens || 0
  );

  return {
    promptTokens: Number.isFinite(promptTokens) ? promptTokens : 0,
    completionTokens: Number.isFinite(completionTokens) ? completionTokens : 0,
    totalTokens: Number.isFinite(totalTokens) ? totalTokens : 0,
    raw: source,
  };
}

module.exports = {
  normalizeComparisonResponse,
  normalizeConfidence,
  normalizeLineDecision,
  normalizeListenResponse,
  normalizeOmniSingleComparison,
  normalizeReviewConclusion,
  normalizeRuleFirstComparison,
  normalizeUsage,
  parseModelJsonText,
};


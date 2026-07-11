"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const routesModule = require("./ai-routes.js");

test("Magic Data Hakka success lexicon meta keeps rewrite mode", function () {
  const helper = routesModule.__test__?.buildReviewLexiconMeta;
  assert.equal(typeof helper, "function");

  const result = helper(
    {
      enabled: true,
      status: "ready",
      matchedCount: 2,
      matches: [{ suggested: "屋下" }],
    },
    "aggressive"
  );

  assert.deepEqual(result, {
    enabled: true,
    status: "ready",
    matchedCount: 2,
    matches: [{ suggested: "屋下" }],
    rewriteMode: "aggressive",
  });
});

test("Magic Data Hakka response normalization only rewrites final dialect suggestion fields", function () {
  const helper = routesModule.__test__?.applyFinalDialectNormalizationToResponseData;
  assert.equal(typeof helper, "function");

  const responseData = {
    dialectTextCheck: {
      suggestedValue: "涯系嘅",
    },
    recommendations: {
      dialectText: "没给这很",
      mandarinText: "不用改",
      summary: "自由文本不改",
    },
    audioCheck: {
      heardDialectText: "涯系嘅没给这很",
    },
    recognitionConvert: null,
  };

  const result = helper(responseData, {
    rewriteMode: "exact",
  });

  assert.equal(result.dialectTextCheck.suggestedValue, "𠊎係个");
  assert.equal(result.recommendations.dialectText, "冇畀𠮶咹");
  assert.equal(result.audioCheck.heardDialectText, "涯系嘅没给这很");
  assert.equal(result.recommendations.summary, "自由文本不改");
  assert.equal(result.recommendations.mandarinText, "不用改");
});

test("Magic Data Hakka recognition convert response normalizes convertedDialectText", function () {
  const helper = routesModule.__test__?.applyFinalDialectNormalizationToResponseData;
  assert.equal(typeof helper, "function");

  const responseData = {
    dialectTextCheck: {
      suggestedValue: "涯系",
    },
    recommendations: {
      dialectText: "涯系嘅",
      mandarinText: "普通话",
      summary: "总结",
    },
    audioCheck: {
      heardDialectText: "涯系嘅",
    },
    recognitionConvert: {
      recognitionStrategy: "mandarin_to_dialect",
      pipelineMode: "recognition_convert",
      recognizedMandarinText: "我是那个人",
      convertedDialectText: "涯系嘅个人",
      lexiconMatches: [],
      conversionWarnings: [],
    },
  };

  const result = helper(responseData, {
    rewriteMode: "exact",
  });

  assert.equal(result.recognitionConvert.convertedDialectText, "𠊎係个个人");
  assert.equal(result.audioCheck.heardDialectText, "涯系嘅");
});

"use strict";

function normalizeText(value, maxLength) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength || 80);
}

function normalizeAiUsageOperatorName(value) {
  return normalizeText(value, 40);
}

function buildAiUsageRequestMeta(input) {
  const source = input && typeof input === "object" ? input : {};
  const settings = source.settings && typeof source.settings === "object" ? source.settings : {};

  return {
    aiUsageOperatorName: normalizeAiUsageOperatorName(settings?.meta?.aiUsageOperatorName),
    platformUserName: normalizeText(source.platformUserName, 80),
    platformUserId: normalizeText(source.platformUserId, 120),
  };
}

function createAiUsageOperatorSettingsPatch(operatorName) {
  return {
    meta: {
      aiUsageOperatorName: normalizeAiUsageOperatorName(operatorName),
    },
  };
}

function appendAiUsageRequestMeta(payload, requestMeta) {
  const sourcePayload = payload && typeof payload === "object" ? payload : {};
  const meta = requestMeta && typeof requestMeta === "object" ? requestMeta : {};
  return Object.assign({}, sourcePayload, {
    aiUsageOperatorName: normalizeAiUsageOperatorName(meta.aiUsageOperatorName),
    platformUserName: normalizeText(meta.platformUserName, 80),
    platformUserId: normalizeText(meta.platformUserId, 120),
  });
}

function assertAiUsageOperatorConfigured(requestMeta) {
  if (!normalizeAiUsageOperatorName(requestMeta?.aiUsageOperatorName)) {
    throw createMissingAiUsageOperatorError();
  }
  return requestMeta;
}

function createMissingAiUsageOperatorError() {
  const error = new Error("请先在 options 首页填写 AI 调用使用人。");
  error.code = "missing-ai-usage-operator-name";
  return error;
}

const api = {
  normalizeAiUsageOperatorName,
  buildAiUsageRequestMeta,
  createAiUsageOperatorSettingsPatch,
  appendAiUsageRequestMeta,
  assertAiUsageOperatorConfigured,
  createMissingAiUsageOperatorError,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = api;
}

if (typeof globalThis !== "undefined") {
  globalThis.ASREdgeAiUsageMeta = api;
}

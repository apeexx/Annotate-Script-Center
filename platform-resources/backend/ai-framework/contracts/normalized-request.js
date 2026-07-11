"use strict";

const crypto = require("crypto");

function createRequestId() {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString("hex");
}

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizePlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value;
}

function createNormalizedRequest(input) {
  const source = input && typeof input === "object" ? input : {};

  return {
    requestId: normalizeString(source.requestId) || createRequestId(),
    platform: normalizeString(source.platform),
    scriptId: normalizeString(source.scriptId),
    routeKey: normalizeString(source.routeKey),
    input: normalizePlainObject(source.input),
    projectOptions: normalizePlainObject(source.projectOptions),
    debugOptions: normalizePlainObject(source.debugOptions),
    runtimeContext: normalizePlainObject(source.runtimeContext),
  };
}

module.exports = {
  createNormalizedRequest,
  createRequestId,
};

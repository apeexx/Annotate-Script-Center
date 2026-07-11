"use strict";

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeNullableObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value;
}

function normalizeNotes(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map(function mapNote(item) {
      return String(item || "").trim();
    })
    .filter(Boolean);
}

function createNormalizedResponse(input) {
  const source = input && typeof input === "object" ? input : {};

  return {
    success: source.success !== false,
    requestId: normalizeString(source.requestId),
    platform: normalizeString(source.platform),
    scriptId: normalizeString(source.scriptId),
    routeKey: normalizeString(source.routeKey),
    models: normalizeNullableObject(source.models),
    usage: normalizeNullableObject(source.usage),
    timing: normalizeNullableObject(source.timing),
    cache: normalizeNullableObject(source.cache),
    debug: normalizeNullableObject(source.debug),
    notes: normalizeNotes(source.notes),
    projectResult: normalizeNullableObject(source.projectResult),
  };
}

module.exports = {
  createNormalizedResponse,
};

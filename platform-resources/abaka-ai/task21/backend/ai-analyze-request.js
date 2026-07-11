"use strict";

const {
  DEFAULT_ANALYSIS_MODE,
  getClientConfig,
  normalizeAnalysisMode,
  sanitizeModelName,
} = require("./ai-client");

const SCRIPT_ID = "abakaAiTaskPageCapture";
const ALLOWED_TARGETS = ["same_font", "image_b_texts_removed", "other_changes", "overall"];
const ALLOWED_IMAGE_FIELDS = ["image_a", "image_b", "image_b_removed"];
const MIN_TIMEOUT_MS = 1000;
const MAX_TIMEOUT_MS = 300000;

function createHttpError(statusCode, code, message) {
  const error = new Error(String(message || "request-error"));
  error.statusCode = statusCode;
  error.code = String(code || "request-error");
  return error;
}

function normalizeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeString(value, maxLength) {
  return String(value || "").replace(/\r\n/g, "\n").trim().slice(0, maxLength || 6000);
}

function normalizeStringArrayPreserveDuplicates(value, maxItems, maxLengthPerItem) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map(function (item) {
      return normalizeString(item, maxLengthPerItem || 300);
    })
    .filter(Boolean)
    .slice(0, maxItems || 12);
}

function normalizeTimeoutMs(value, fallback) {
  const number = Number(value);
  const base = Number.isFinite(number) ? number : Number(fallback);
  const safe = Number.isFinite(base) ? base : 60000;
  return Math.max(MIN_TIMEOUT_MS, Math.min(MAX_TIMEOUT_MS, Math.floor(safe)));
}

function normalizeTarget(value) {
  const text = String(value || "").trim();
  if (ALLOWED_TARGETS.indexOf(text) >= 0) {
    return text;
  }
  return "";
}

function normalizeImageRecord(record) {
  const source = normalizeObject(record);
  const fieldName = String(source.fieldName || "").trim();
  const safeFieldName = ALLOWED_IMAGE_FIELDS.indexOf(fieldName) >= 0 ? fieldName : "";
  const dataUrl = String(source.dataUrl || "").trim();
  const imageUrl = String(source.imageUrl || "").trim();
  const mime = String(source.mime || "").trim().slice(0, 80) || "unknown";
  const width = Number(source.width);
  const height = Number(source.height);
  const bytes = Number(source.bytes);

  return {
    fieldName: safeFieldName,
    dataUrl,
    imageUrl,
    mime,
    width: Number.isFinite(width) && width > 0 ? Math.floor(width) : "unknown",
    height: Number.isFinite(height) && height > 0 ? Math.floor(height) : "unknown",
    bytes: Number.isFinite(bytes) && bytes >= 0 ? Math.floor(bytes) : "unknown",
    sourceKind: dataUrl ? "dataUrl" : imageUrl ? "url" : "unknown",
  };
}

function normalizeImages(images) {
  const source = Array.isArray(images) ? images : [];
  const normalized = [];
  source.forEach(function (item) {
    const row = normalizeImageRecord(item);
    if (!row.fieldName) {
      return;
    }
    const exists = normalized.some(function (entry) {
      return entry.fieldName === row.fieldName;
    });
    if (!exists) {
      normalized.push(row);
    }
  });
  ALLOWED_IMAGE_FIELDS.forEach(function (fieldName) {
    const exists = normalized.some(function (entry) {
      return entry.fieldName === fieldName;
    });
    if (exists) {
      return;
    }
    normalized.push({
      fieldName,
      dataUrl: "",
      imageUrl: "",
      mime: "unknown",
      width: "unknown",
      height: "unknown",
      bytes: "unknown",
      sourceKind: "unknown",
    });
  });
  return normalized;
}

function normalizeAnalyzeRequest(body) {
  const source = normalizeObject(body);
  const target = normalizeTarget(source.target);
  if (!target) {
    throw createHttpError(400, "unsupported-target", "target 不受支持。");
  }

  const context = normalizeObject(source.context);
  const currentValues = normalizeObject(context.currentValues);
  return {
    target,
    debug: source.debug === true,
    context: {
      imageATexts: normalizeString(context.imageATexts, 12000),
      imageBTexts: normalizeString(context.imageBTexts, 12000),
      textPositions: normalizeObject(context.textPositions),
      targetRemovalTextHints: normalizeStringArrayPreserveDuplicates(
        context.targetRemovalTextHints,
        12,
        240
      ),
      currentValues: {
        same_font: normalizeString(currentValues.same_font, 300),
        image_b_texts_removed: normalizeString(currentValues.image_b_texts_removed, 3000),
        other_changes: normalizeString(currentValues.other_changes, 3000),
      },
      route: normalizeObject(context.route),
    },
    images: normalizeImages(source.images),
  };
}

function resolveRuntimeOptions(requestBody, config) {
  const source = normalizeObject(requestBody);
  const options = normalizeObject(source.options);
  const debugConfig = normalizeObject(source.debugConfig);
  const safeConfig = config && typeof config === "object" ? config : getClientConfig();

  const analysisMode = normalizeAnalysisMode(
    source.analysisMode || options.analysisMode || debugConfig.analysisMode,
    DEFAULT_ANALYSIS_MODE
  );
  const ocrEnabledValue =
    typeof source.ocrEnabled === "boolean"
      ? source.ocrEnabled
      : typeof options.ocrEnabled === "boolean"
        ? options.ocrEnabled
        : typeof debugConfig.ocrEnabled === "boolean"
          ? debugConfig.ocrEnabled
          : safeConfig.ocrEnabled === true;
  const enableThinkingValue = false;
  const timeoutMs = normalizeTimeoutMs(
    source.timeoutMs || options.timeoutMs || debugConfig.timeoutMs,
    safeConfig.timeoutMs || 60000
  );
  const allowClientModelOverride = safeConfig.allowClientModelOverride === true;

  function resolveModel(fieldName, defaultModel, allowedModels) {
    const requested = sanitizeModelName(
      source[fieldName] || options[fieldName] || debugConfig[fieldName] || "",
      ""
    );
    if (!allowClientModelOverride) {
      return defaultModel;
    }
    const allowed = Array.isArray(allowedModels) ? allowedModels : [];
    if (requested && allowed.indexOf(requested) >= 0) {
      return requested;
    }
    return defaultModel;
  }

  const visionModel = resolveModel(
    "visionModel",
    safeConfig.visionModel,
    safeConfig.allowedVisionModels
  );
  const ocrModel = resolveModel(
    "ocrModel",
    safeConfig.ocrModel,
    safeConfig.allowedOcrModels
  );
  const reasoningModel = resolveModel(
    "reasoningModel",
    safeConfig.reasoningModel,
    safeConfig.allowedReasoningModels
  );
  const singleModel = resolveModel(
    "singleModel",
    safeConfig.singleModel,
    safeConfig.allowedSingleModels
  );

  const thinkingSource = "forced-off";

  return {
    analysisMode,
    visionModel,
    ocrEnabled: ocrEnabledValue === true,
    ocrModel,
    reasoningModel,
    singleModel,
    enableThinking: enableThinkingValue === true,
    timeoutMs,
    thinkingSource,
    allowClientModelOverride,
    allowedVisionModels: safeConfig.allowedVisionModels,
    allowedOcrModels: safeConfig.allowedOcrModels,
    allowedReasoningModels: safeConfig.allowedReasoningModels,
    allowedSingleModels: safeConfig.allowedSingleModels,
  };
}

module.exports = {
  SCRIPT_ID,
  createHttpError,
  normalizeAnalyzeRequest,
  resolveRuntimeOptions,
};

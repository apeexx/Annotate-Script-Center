"use strict";

const JUDGEMENT_KIND = "judgement";
const TRANSCRIPTION_KIND = "transcription";
const UNKNOWN_KIND = "unknown";

const JUDGEMENT_LABEL_MODEL = "vote";
const TRANSCRIPTION_LABEL_MODEL = "single";

const JUDGEMENT_TASK_NAME_PATTERNS = [
  "asr结果判断",
  "asr更优结果判断",
  "更优结果判断",
  "更优判断",
  "结果判断海天",
  "dialogue_海天",
];

const TRANSCRIPTION_TASK_NAME_PATTERNS = ["中文普通话asr任务", "asr语音转写", "语音转写", "转写"];

function cleanText(value) {
  return String(value === undefined || value === null ? "" : value)
    .replace(/\uFEFF/g, "")
    .replace(/[\u200B-\u200D\u2060]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTaskName(value) {
  return cleanText(value).toLowerCase();
}

function normalizeKind(value) {
  const text = cleanText(value).toLowerCase();
  if (text === JUDGEMENT_KIND || text === TRANSCRIPTION_KIND || text === UNKNOWN_KIND) {
    return text;
  }
  return UNKNOWN_KIND;
}

function normalizeConfidence(value) {
  const text = cleanText(value).toLowerCase();
  if (text === "high" || text === "medium" || text === "low") {
    return text;
  }
  return "low";
}

function getNestedValue(input, path) {
  const source = input && typeof input === "object" ? input : {};
  const keys = Array.isArray(path) ? path : [];
  let current = source;
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    if (!current || typeof current !== "object") {
      return "";
    }
    current = current[key];
  }
  return current;
}

function pickText(input, candidates) {
  const paths = Array.isArray(candidates) ? candidates : [];
  for (let index = 0; index < paths.length; index += 1) {
    const raw = getNestedValue(input, paths[index]);
    const text = cleanText(raw);
    if (text) {
      return text;
    }
  }
  return "";
}

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : NaN;
}

function getQuestionCount(input) {
  const candidatePaths = [
    ["questionCount"],
    ["metrics", "itemCount"],
    ["metrics", "fetchedItemCount"],
    ["csvPatch", "题数"],
    ["row", "题数"],
  ];
  for (let index = 0; index < candidatePaths.length; index += 1) {
    const numeric = toNumber(getNestedValue(input, candidatePaths[index]));
    if (Number.isFinite(numeric) && numeric >= 0) {
      return numeric;
    }
  }
  return NaN;
}

function getTaskName(input) {
  return pickText(input, [
    ["taskName"],
    ["name"],
    ["payload", "rawKeys", "taskName"],
    ["payload", "taskName"],
    ["payload", "name"],
    ["csvPatch", "任务名称"],
    ["row", "任务名称"],
  ]);
}

function getProjectPath(input) {
  return normalizeTaskName(
    pickText(input, [
      ["payload", "project"],
      ["payload", "projectPath"],
      ["project"],
      ["projectPath"],
      ["row", "project"],
    ])
  );
}

function getLabelModel(input) {
  return normalizeTaskName(
    pickText(input, [
      ["payload", "rawKeys", "labelModel"],
      ["payload", "labelModel"],
      ["rawKeys", "labelModel"],
      ["labelModel"],
      ["row", "labelModel"],
    ])
  );
}

function hasSchemaField(row, csvColumns, field) {
  const safeField = cleanText(field);
  if (!safeField) {
    return false;
  }
  const sourceRow = row && typeof row === "object" ? row : {};
  if (Object.prototype.hasOwnProperty.call(sourceRow, safeField)) {
    return true;
  }
  const cols = Array.isArray(csvColumns) ? csvColumns : [];
  return cols.some(function (column) {
    return cleanText(column) === safeField;
  });
}

function detectByTaskName(taskName) {
  const normalized = normalizeTaskName(taskName);
  if (!normalized) {
    return UNKNOWN_KIND;
  }
  if (
    JUDGEMENT_TASK_NAME_PATTERNS.some(function (pattern) {
      return normalized.indexOf(pattern) >= 0;
    })
  ) {
    return JUDGEMENT_KIND;
  }
  if (
    TRANSCRIPTION_TASK_NAME_PATTERNS.some(function (pattern) {
      return normalized.indexOf(pattern) >= 0;
    })
  ) {
    return TRANSCRIPTION_KIND;
  }
  return UNKNOWN_KIND;
}

function createDecision(kind, confidence, reason) {
  return {
    kind: normalizeKind(kind),
    confidence: normalizeConfidence(confidence),
    reason: cleanText(reason) || "no-signal",
  };
}

function resolveAsrProjectKind(input) {
  const source = input && typeof input === "object" ? input : {};
  const payload = source.payload && typeof source.payload === "object" ? source.payload : source;
  const row = source.row && typeof source.row === "object" ? source.row : {};
  const csvColumns = Array.isArray(source.csvColumns) ? source.csvColumns : [];

  const projectPath = getProjectPath({ payload: payload, row: row, projectPath: source.projectPath });
  if (projectPath.indexOf("asr-judgement") >= 0) {
    return createDecision(JUDGEMENT_KIND, "high", "payload.project=asr-judgement");
  }
  if (projectPath.indexOf("asr-transcription") >= 0) {
    return createDecision(TRANSCRIPTION_KIND, "high", "payload.project=asr-transcription");
  }

  const labelModel = getLabelModel({ payload: payload, row: row, labelModel: source.labelModel });
  if (labelModel === JUDGEMENT_LABEL_MODEL) {
    return createDecision(JUDGEMENT_KIND, "high", "labelModel=vote");
  }
  if (labelModel === TRANSCRIPTION_LABEL_MODEL) {
    return createDecision(TRANSCRIPTION_KIND, "high", "labelModel=single");
  }

  const taskName = getTaskName({
    payload: payload,
    row: row,
    taskName: source.taskName,
    name: source.name,
    csvPatch: payload.csvPatch,
  });
  const kindByName = detectByTaskName(taskName);
  if (kindByName !== UNKNOWN_KIND) {
    return createDecision(kindByName, "medium", "taskName-pattern");
  }

  const hasJudgementSlots =
    hasSchemaField(row, csvColumns, "标注员1子任务ID") ||
    hasSchemaField(row, csvColumns, "标注员2子任务ID") ||
    hasSchemaField(row, csvColumns, "标注员3子任务ID");
  const hasTranscriptionSlot = hasSchemaField(row, csvColumns, "标注子任务ID");
  if (hasJudgementSlots && !hasTranscriptionSlot) {
    return createDecision(JUDGEMENT_KIND, "medium", "csv-schema-judgement");
  }
  if (hasTranscriptionSlot && !hasJudgementSlots) {
    return createDecision(TRANSCRIPTION_KIND, "medium", "csv-schema-transcription");
  }

  const questionCount = getQuestionCount({
    payload: payload,
    row: row,
    csvPatch: payload.csvPatch,
    metrics: payload.metrics,
    questionCount: source.questionCount,
  });
  if (Number.isFinite(questionCount) && questionCount === 400) {
    return createDecision(JUDGEMENT_KIND, "low", "question-count=400-fallback");
  }
  if (Number.isFinite(questionCount) && questionCount > 0 && questionCount !== 400) {
    return createDecision(TRANSCRIPTION_KIND, "low", "question-count-non400-fallback");
  }

  return createDecision(UNKNOWN_KIND, "low", "no-strong-signal");
}

module.exports = {
  JUDGEMENT_KIND,
  TRANSCRIPTION_KIND,
  UNKNOWN_KIND,
  JUDGEMENT_LABEL_MODEL,
  TRANSCRIPTION_LABEL_MODEL,
  JUDGEMENT_TASK_NAME_PATTERNS,
  TRANSCRIPTION_TASK_NAME_PATTERNS,
  resolveAsrProjectKind,
};

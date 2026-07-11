"use strict";

const fs = require("fs");
const path = require("path");
const { CSV_COLUMNS: JUDGEMENT_COLUMNS } = require("../asr-judgement/backend/csv-columns");
const { CSV_COLUMNS: TRANSCRIPTION_COLUMNS } = require("../asr-transcription/backend/csv-columns");
const { writeMergedCsv: writeJudgementCsv } = require("../asr-judgement/backend/csv-writer");
const { writeMergedCsv: writeTranscriptionCsv } = require("../asr-transcription/backend/csv-writer");
const {
  applyPayloadToRows: applyJudgementPayloadToRows,
  createEmptyRow: createJudgementEmptyRow,
} = require("../asr-judgement/backend/payload-merge");
const {
  applyPayloadToRows: applyTranscriptionPayloadToRows,
  createEmptyRow: createTranscriptionEmptyRow,
} = require("../asr-transcription/backend/payload-merge");
const {
  UNKNOWN_SUPPLIER_NAME,
  cleanCsvValue,
  isUnknownSupplierName,
  preferHealthyText,
  resolveSupplierInfo,
} = require("./supplier-utils");
const {
  JUDGEMENT_KIND,
  resolveAsrProjectKind,
} = require("./asr-project-kind");

const DEFAULT_JUDGEMENT_CSV = path.join(
  __dirname,
  "..",
  "asr-judgement",
  "backend",
  "statistics-data",
  "statistics-merged.csv"
);
const DEFAULT_TRANSCRIPTION_CSV = path.join(
  __dirname,
  "..",
  "asr-transcription",
  "backend",
  "statistics-data",
  "statistics-merged.csv"
);

function parseArgs(argv) {
  const args = Array.isArray(argv) ? argv.slice() : [];
  const options = {
    dryRun: true,
    write: false,
    backup: false,
    judgementCsv: DEFAULT_JUDGEMENT_CSV,
    transcriptionCsv: DEFAULT_TRANSCRIPTION_CSV,
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--dry-run") {
      options.dryRun = true;
      options.write = false;
      continue;
    }
    if (arg === "--write") {
      options.write = true;
      options.dryRun = false;
      continue;
    }
    if (arg === "--backup") {
      options.backup = true;
      continue;
    }
    if (arg === "--judgement-csv") {
      options.judgementCsv = path.resolve(args[index + 1] || "");
      index += 1;
      continue;
    }
    if (arg === "--transcription-csv") {
      options.transcriptionCsv = path.resolve(args[index + 1] || "");
      index += 1;
      continue;
    }
  }
  return options;
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === '"' && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === ",") {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells;
}

function normalizeHeader(header) {
  const cleaned = cleanCsvValue(header);
  if (cleaned === "有效时长(秒)") {
    return "有效时长";
  }
  return cleaned;
}

function readCsv(filePath) {
  if (!fs.existsSync(filePath)) {
    return {
      exists: false,
      headers: [],
      rows: [],
    };
  }
  const lines = fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter(function (line) {
      return line.trim() !== "";
    });
  if (lines.length === 0) {
    return {
      exists: true,
      headers: [],
      rows: [],
    };
  }
  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const rows = lines.slice(1).map(function (line) {
    const cells = parseCsvLine(line);
    const row = {};
    headers.forEach(function (header, index) {
      row[header] = cleanCsvValue(cells[index] || "");
    });
    return row;
  });
  return {
    exists: true,
    headers: headers,
    rows: rows,
  };
}

function normalizeSupplier(row, counters) {
  const safeRow = row && typeof row === "object" ? row : {};
  const before = cleanCsvValue(safeRow["供应商"] || "");
  const info = resolveSupplierInfo({
    csvPatch: safeRow,
    taskName: safeRow["任务名称"] || "",
  });
  const normalized = cleanCsvValue(info.name || UNKNOWN_SUPPLIER_NAME) || UNKNOWN_SUPPLIER_NAME;
  if (normalized !== before) {
    counters.supplierFixedCount += 1;
  }
  safeRow["供应商"] = normalized;
  return safeRow;
}

function isLikelyJudgementTaskName(taskName) {
  const normalized = cleanCsvValue(taskName || "").toLowerCase();
  return (
    normalized.indexOf("asr结果判断") >= 0 ||
    normalized.indexOf("asr更优结果判断") >= 0 ||
    normalized.indexOf("更优结果判断") >= 0 ||
    normalized.indexOf("更优判断") >= 0 ||
    normalized.indexOf("dialogue_海天") >= 0
  );
}

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : NaN;
}

function shouldMoveToJudgement(row, headers) {
  const kind = resolveAsrProjectKind({
    row: row,
    csvColumns: headers,
    taskName: row["任务名称"],
    questionCount: row["题数"],
  });
  if (kind.kind === JUDGEMENT_KIND && (kind.confidence === "high" || kind.confidence === "medium")) {
    return true;
  }
  if (isLikelyJudgementTaskName(row["任务名称"])) {
    return true;
  }
  const questionCount = toNumber(row["题数"]);
  if (Number.isFinite(questionCount) && questionCount === 400) {
    return true;
  }
  return false;
}

function buildJudgementPatchFromTranscription(row) {
  return {
    "任务名称": row["任务名称"] || "",
    "供应商": row["供应商"] || "",
    "任务ID": row["任务ID"] || "",
    "分包ID": row["分包ID"] || "",
    "题数": row["题数"] || "",
    "有效时长": row["有效时长"] || row["有效时长(秒)"] || "",
  };
}

function buildTranscriptionPatch(row) {
  return {
    "任务名称": row["任务名称"] || "",
    "供应商": row["供应商"] || "",
    "任务ID": row["任务ID"] || "",
    "分包ID": row["分包ID"] || "",
    "题数": row["题数"] || "",
    "有效时长": row["有效时长"] || row["有效时长(秒)"] || "",
  };
}

function applyJudgementRowByPayload(targetRows, row) {
  const patch = buildJudgementPatchFromTranscription(row);
  const batchId = cleanCsvValue(patch["分包ID"] || "");
  if (!batchId) {
    return;
  }

  const labelSubTaskId = cleanCsvValue(row["标注员1子任务ID"] || row["标注子任务ID"] || "");
  const auditSubTaskId = cleanCsvValue(row["审核子任务ID"] || "");

  if (labelSubTaskId) {
    applyJudgementPayloadToRows(
      {
        csvPatch: patch,
        mergeKey: { batchId: batchId },
        roleRecord: {
          role: "label",
          subTaskId: labelSubTaskId,
          userName: row["标注员1"] || row["标注员"] || "",
          receiveTime: row["标注员1领取时间"] || row["标注领取时间"] || "",
          submitTime: row["标注员1提交时间"] || row["标注提交时间"] || "",
          completed: row["标注员1是否完成"] || row["标注是否完成"] || "",
        },
      },
      targetRows,
      JUDGEMENT_COLUMNS
    );
  }

  if (auditSubTaskId) {
    applyJudgementPayloadToRows(
      {
        csvPatch: patch,
        mergeKey: { batchId: batchId },
        roleRecord: {
          role: "audit",
          subTaskId: auditSubTaskId,
          userName: row["审核员"] || "",
          receiveTime: row["审核领取时间"] || "",
          submitTime: row["审核提交时间"] || "",
          completed: row["审核是否完成"] || "",
        },
      },
      targetRows,
      JUDGEMENT_COLUMNS
    );
  }
}

function applyTranscriptionRowByPayload(targetRows, row) {
  const patch = buildTranscriptionPatch(row);
  const batchId = cleanCsvValue(patch["分包ID"] || "");
  if (!batchId) {
    return;
  }
  const labelSubTaskId = cleanCsvValue(row["标注子任务ID"] || "");
  const auditSubTaskId = cleanCsvValue(row["审核子任务ID"] || "");

  if (labelSubTaskId) {
    applyTranscriptionPayloadToRows(
      {
        csvPatch: patch,
        mergeKey: { batchId: batchId },
        roleRecord: {
          role: "label",
          subTaskId: labelSubTaskId,
          userName: row["标注员"] || "",
          receiveTime: row["标注领取时间"] || "",
          submitTime: row["标注提交时间"] || "",
          completed: row["标注是否完成"] || "",
        },
      },
      targetRows,
      TRANSCRIPTION_COLUMNS
    );
  }
  if (auditSubTaskId) {
    applyTranscriptionPayloadToRows(
      {
        csvPatch: patch,
        mergeKey: { batchId: batchId },
        roleRecord: {
          role: "audit",
          subTaskId: auditSubTaskId,
          userName: row["审核员"] || "",
          receiveTime: row["审核领取时间"] || "",
          submitTime: row["审核提交时间"] || "",
          completed: row["审核是否完成"] || "",
        },
      },
      targetRows,
      TRANSCRIPTION_COLUMNS
    );
  }
}

function createMergeMapFromRows(rows, csvColumns) {
  const map = {};
  (Array.isArray(rows) ? rows : []).forEach(function (row) {
    const batchId = cleanCsvValue(row?.["分包ID"] || "");
    if (!batchId) {
      return;
    }
    const supplierInfo = resolveSupplierInfo({
      csvPatch: row,
      taskName: row?.["任务名称"] || "",
    });
    const key = String(supplierInfo.key || "unknown-supplier") + "::" + batchId;
    const base = csvColumns === JUDGEMENT_COLUMNS
      ? createJudgementEmptyRow(csvColumns)
      : createTranscriptionEmptyRow(csvColumns);
    const target = Object.assign(base, map[key] || {});
    Object.keys(row || {}).forEach(function (field) {
      if (target[field] && !cleanCsvValue(row[field] || "")) {
        return;
      }
      target[field] = cleanCsvValue(row[field] || "");
    });
    map[key] = target;
  });
  return map;
}

function cloneRowsFromMap(map, csvColumns) {
  return Object.keys(map || {}).map(function (key) {
    const base = csvColumns === JUDGEMENT_COLUMNS
      ? createJudgementEmptyRow(csvColumns)
      : createTranscriptionEmptyRow(csvColumns);
    return Object.assign(base, map[key] || {});
  });
}

function maybeBackup(filePath, enableBackup, backupPaths) {
  if (!enableBackup || !fs.existsSync(filePath)) {
    return;
  }
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const backupPath = filePath + ".bak." + stamp + ".csv";
  fs.copyFileSync(filePath, backupPath);
  backupPaths.push(backupPath);
}

function countUnknownSuppliers(rows) {
  return (Array.isArray(rows) ? rows : []).reduce(function (total, row) {
    const supplier = cleanCsvValue(row?.["供应商"] || "");
    return total + (isUnknownSupplierName(supplier) ? 1 : 0);
  }, 0);
}

function writeCsvIfNeeded(filePath, map, csvColumns, writeFn, options, backupPaths) {
  if (!options.write) {
    return;
  }
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  maybeBackup(filePath, options.backup, backupPaths);
  writeFn(filePath, map, csvColumns);
}

function runRepair(options) {
  const judgementData = readCsv(options.judgementCsv);
  const transcriptionData = readCsv(options.transcriptionCsv);
  const backupPaths = [];
  const counters = {
    supplierFixedCount: 0,
  };

  const normalizedJudgementRows = (judgementData.rows || []).map(function (row) {
    return normalizeSupplier(Object.assign({}, row), counters);
  });
  const normalizedTranscriptionRows = (transcriptionData.rows || []).map(function (row) {
    return normalizeSupplier(Object.assign({}, row), counters);
  });

  const movedRows = [];
  const keptTranscriptionRows = [];
  normalizedTranscriptionRows.forEach(function (row) {
    if (shouldMoveToJudgement(row, transcriptionData.headers)) {
      movedRows.push(row);
      return;
    }
    keptTranscriptionRows.push(row);
  });

  const judgementMap = createMergeMapFromRows(normalizedJudgementRows, JUDGEMENT_COLUMNS);
  movedRows.forEach(function (row) {
    applyJudgementRowByPayload(judgementMap, row);
  });

  const transcriptionMap = {};
  keptTranscriptionRows.forEach(function (row) {
    applyTranscriptionRowByPayload(transcriptionMap, row);
  });

  const finalJudgementRows = cloneRowsFromMap(judgementMap, JUDGEMENT_COLUMNS).map(function (row) {
    return normalizeSupplier(row, counters);
  });
  const finalTranscriptionRows = cloneRowsFromMap(transcriptionMap, TRANSCRIPTION_COLUMNS).map(
    function (row) {
      return normalizeSupplier(row, counters);
    }
  );

  const finalJudgementMap = createMergeMapFromRows(finalJudgementRows, JUDGEMENT_COLUMNS);
  const finalTranscriptionMap = createMergeMapFromRows(finalTranscriptionRows, TRANSCRIPTION_COLUMNS);

  writeCsvIfNeeded(
    options.judgementCsv,
    finalJudgementMap,
    JUDGEMENT_COLUMNS,
    writeJudgementCsv,
    options,
    backupPaths
  );
  writeCsvIfNeeded(
    options.transcriptionCsv,
    finalTranscriptionMap,
    TRANSCRIPTION_COLUMNS,
    writeTranscriptionCsv,
    options,
    backupPaths
  );

  return {
    judgementCsv: options.judgementCsv,
    transcriptionCsv: options.transcriptionCsv,
    judgementRowsBefore: normalizedJudgementRows.length,
    transcriptionRowsBefore: normalizedTranscriptionRows.length,
    movedTranscriptionToJudgementCount: movedRows.length,
    keptTranscriptionCount: keptTranscriptionRows.length,
    supplierFixedCount: counters.supplierFixedCount,
    unknownSupplierRemainingCount:
      countUnknownSuppliers(finalJudgementRows) + countUnknownSuppliers(finalTranscriptionRows),
    judgementRowsAfter: finalJudgementRows.length,
    transcriptionRowsAfter: finalTranscriptionRows.length,
    backupPaths: backupPaths,
    writeApplied: options.write,
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = runRepair(options);
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main();
}

module.exports = {
  DEFAULT_JUDGEMENT_CSV,
  DEFAULT_TRANSCRIPTION_CSV,
  parseArgs,
  runRepair,
};


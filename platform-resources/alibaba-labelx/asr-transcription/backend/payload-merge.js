"use strict";

const { CSV_COLUMNS } = require("./csv-columns");
const {
  cleanCsvValue,
  cleanHealthyCsvValue,
  isCorruptedText,
  preferHealthyText,
  resolveSupplierInfo,
} = require("../../backend/supplier-utils");
const {
  JUDGEMENT_KIND,
  TRANSCRIPTION_KIND,
  resolveAsrProjectKind,
} = require("../../backend/asr-project-kind");

const BASE_PATCH_COLUMNS = new Set([
  "任务名称",
  "供应商",
  "任务ID",
  "分包ID",
  "题数",
  "有效时长",
  "有效时长(秒)",
  "有效时长(秒)_S",
]);
const ROLE_SPECIFIC_COLUMNS = new Set([
  "标注子任务ID",
  "审核子任务ID",
  "标注员_P",
  "审核员_P",
  "标注领取时间",
  "标注提交时间",
  "审核领取时间",
  "审核提交时间",
  "标注是否完成",
  "审核是否完成",
]);
const QUALITY_CRITICAL_COLUMNS = new Set(["任务名称", "标注员_P", "审核员_P", "供应商"]);
const LEGACY_COLUMN_ALIAS = {
  "有效时长": "有效时长(秒)_S",
  "有效时长(秒)": "有效时长(秒)_S",
  "有效时长(秒)_S": "有效时长(秒)_S",
  "标注员": "标注员_P",
  "审核员": "审核员_P",
};

function normalizeCsvColumnKey(key) {
  return LEGACY_COLUMN_ALIAS[key] || key;
}

function migrateLegacyRowColumns(row, csvColumns) {
  const next = createEmptyRow(csvColumns);
  const source = row && typeof row === "object" ? row : {};
  Object.keys(source).forEach(function (key) {
    const normalizedKey = normalizeCsvColumnKey(key);
    if (!normalizedKey || csvColumns.indexOf(normalizedKey) < 0) {
      return;
    }
    const value = source[key];
    if (value == null || value === "") {
      return;
    }
    if (normalizedKey === "有效时长(秒)_S") {
      const normalizedDuration = formatDuration(value);
      if (normalizedDuration !== "") {
        next[normalizedKey] = normalizedDuration;
      }
      return;
    }
    const cleanedValue = cleanCsvValue(value);
    if (cleanedValue !== "") {
      next[normalizedKey] = cleanedValue;
    }
  });
  return next;
}

function createEmptyRow(csvColumns) {
  const row = {};
  (csvColumns || CSV_COLUMNS).forEach(function (column) {
    row[column] = "";
  });
  return row;
}

function formatDuration(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return "";
  }
  return numeric.toFixed(4).replace(/\.?0+$/, "");
}

function normalizeCompletedValue(value) {
  const text = cleanCsvValue(value);
  if (!text) {
    return "";
  }
  if (text === "已完成") {
    return "已完成";
  }
  if (
    text === "未完成" ||
    text === "false" ||
    text === "0" ||
    text === "待完成" ||
    text === "待提交"
  ) {
    return "未完成";
  }
  if (text === "true" || text === "1") {
    return "已完成";
  }
  return text;
}

function inferCompleted(roleRecord, payload) {
  const hasSubmitTime = Boolean(
    roleRecord?.submitTime ||
      payload?.rawKeys?.gmtCommit ||
      payload?.rawKeys?.commitTime ||
      payload?.rawKeys?.submitTime
  );
  if (hasSubmitTime) {
    return "已完成";
  }

  const statusValue =
    roleRecord?.status !== undefined
      ? roleRecord.status
      : payload?.rawKeys?.status !== undefined
        ? payload.rawKeys.status
        : "";
  const normalizedStatus = cleanCsvValue(statusValue);
  if (!normalizedStatus) {
    return "";
  }
  const numericStatus = Number(statusValue);
  if (Number.isFinite(numericStatus)) {
    return numericStatus > 0 ? "已完成" : "未完成";
  }
  return "";
}

function applyNonEmptyValue(row, key, value) {
  const nextValue = cleanCsvValue(value);
  if (nextValue) {
    row[key] = nextValue;
  }
}

function applyCompletedValue(row, key, roleRecord, payload) {
  const nextValue = normalizeCompletedValue(roleRecord?.completed) || inferCompleted(roleRecord, payload);
  if (nextValue) {
    row[key] = nextValue;
  }
}

function applyRoleRecord(row, roleRecord, payload) {
  const role = String(roleRecord?.role || "").toLowerCase();
  if (role !== "label" && role !== "audit") {
    throw new Error("payload roleRecord.role 必须为 label 或 audit。");
  }

  if (role === "audit") {
    applyNonEmptyValue(row, "审核子任务ID", roleRecord?.subTaskId);
    const auditUser = preferHealthyText(
      cleanCsvValue(roleRecord?.userName || roleRecord?.userId || ""),
      row["审核员_P"] || ""
    );
    if (auditUser) {
      row["审核员_P"] = auditUser;
    }
    applyNonEmptyValue(row, "审核领取时间", roleRecord?.receiveTime);
    applyNonEmptyValue(row, "审核提交时间", roleRecord?.submitTime);
    applyCompletedValue(row, "审核是否完成", roleRecord, payload);
    return;
  }

  applyNonEmptyValue(row, "标注子任务ID", roleRecord?.subTaskId);
  const labelUser = preferHealthyText(
    cleanCsvValue(roleRecord?.userName || roleRecord?.userId || ""),
    row["标注员_P"] || ""
  );
  if (labelUser) {
    row["标注员_P"] = labelUser;
  }
  applyNonEmptyValue(row, "标注领取时间", roleRecord?.receiveTime);
  applyNonEmptyValue(row, "标注提交时间", roleRecord?.submitTime);
  applyCompletedValue(row, "标注是否完成", roleRecord, payload);
}

function getBatchId(payload, patch, roleRecord) {
  return cleanCsvValue(
    payload?.mergeKey?.batchId || roleRecord?.batchId || patch?.["分包ID"] || ""
  );
}

function resolveRowSupplier(payload, patch, existingRow) {
  const fallbackPatch = Object.assign({}, patch || {});
  if (!fallbackPatch["供应商"] && existingRow?.["供应商"]) {
    fallbackPatch["供应商"] = existingRow["供应商"];
  }
  return resolveSupplierInfo({
    payload: payload,
    supplier: payload?.supplier,
    vendor: payload?.vendor,
    csvPatch: fallbackPatch,
    taskName:
      fallbackPatch["任务名称"] ||
      payload?.rawKeys?.taskName ||
      payload?.taskName ||
      payload?.name ||
      "",
  });
}

function createMergeRowId(supplierKey, batchId) {
  return String(supplierKey || "unknown-supplier") + "::" + String(batchId || "");
}

function normalizeRole(role) {
  const text = cleanCsvValue(role || "").toLowerCase();
  if (text === "audit" || text === "check") {
    return "audit";
  }
  return "label";
}

function findExistingMergeRowId(rowsByMergeRowId, batchId, roleRecord) {
  const rows = rowsByMergeRowId && typeof rowsByMergeRowId === "object" ? rowsByMergeRowId : {};
  const normalizedBatchId = cleanCsvValue(batchId || "");
  if (!normalizedBatchId) {
    return "";
  }
  const role = normalizeRole(roleRecord?.role || "label");
  const subTaskId = cleanCsvValue(roleRecord?.subTaskId || "");
  const roleField = role === "audit" ? "审核子任务ID" : "标注子任务ID";

  if (subTaskId) {
    for (const mergeRowId of Object.keys(rows)) {
      const row = rows[mergeRowId] || {};
      if (cleanCsvValue(row["分包ID"] || "") !== normalizedBatchId) {
        continue;
      }
      if (cleanCsvValue(row[roleField] || "") === subTaskId) {
        return mergeRowId;
      }
    }
  }

  for (const mergeRowId of Object.keys(rows)) {
    const row = rows[mergeRowId] || {};
    if (cleanCsvValue(row["分包ID"] || "") !== normalizedBatchId) {
      continue;
    }
    if (cleanCsvValue(row[roleField] || "")) {
      return mergeRowId;
    }
  }

  return "";
}

function applyBasePatch(row, patch, csvColumns) {
  Object.keys(patch).forEach(function (key) {
    const normalizedKey = normalizeCsvColumnKey(key);
    if (csvColumns.indexOf(normalizedKey) < 0) {
      return;
    }
    if (ROLE_SPECIFIC_COLUMNS.has(normalizedKey) || !BASE_PATCH_COLUMNS.has(key)) {
      return;
    }

    if (normalizedKey === "有效时长(秒)_S") {
      const normalizedDuration = formatDuration(patch[key]);
      if (normalizedDuration !== "") {
        row["有效时长(秒)_S"] = normalizedDuration;
      }
      return;
    }

    const value = patch[key];
    const normalizedValue = cleanCsvValue(value);
    if (normalizedValue !== "") {
      if (QUALITY_CRITICAL_COLUMNS.has(normalizedKey)) {
        row[normalizedKey] = preferHealthyText(normalizedValue, row[normalizedKey] || "");
        return;
      }
      row[normalizedKey] = normalizedValue;
    }
  });
}

function rejectIfCrossProjectPayload(payload) {
  const detected = resolveAsrProjectKind({
    payload: payload,
    row: payload?.csvPatch,
    csvColumns: CSV_COLUMNS,
  });
  if (detected.kind === JUDGEMENT_KIND && detected.confidence === "high") {
    const reason = detected.reason ? "（" + detected.reason + "）" : "";
    throw new Error("检测到判断项目数据，已拒绝写入转写统计表。" + reason);
  }
}

function applyPayloadToRows(payload, rowsByMergeRowId, csvColumns) {
  const patch = payload && typeof payload.csvPatch === "object" ? payload.csvPatch : {};
  const roleRecord = payload && typeof payload.roleRecord === "object" ? payload.roleRecord : {};
  const batchId = getBatchId(payload || {}, patch, roleRecord);
  if (!batchId) {
    throw new Error("payload 缺少 mergeKey.batchId / 分包ID。");
  }

  const supplierInfo = resolveRowSupplier(payload || {}, patch, null);
  const preferredMergeRowId = createMergeRowId(supplierInfo.key, batchId);
  const mergeRowId =
    findExistingMergeRowId(rowsByMergeRowId, batchId, roleRecord) || preferredMergeRowId;
  const existingRow = migrateLegacyRowColumns(rowsByMergeRowId[mergeRowId] || {}, csvColumns);
  const row = Object.assign(createEmptyRow(csvColumns), existingRow);
  const stableSupplierInfo = resolveRowSupplier(payload || {}, patch, row);

  applyBasePatch(row, patch, csvColumns);
  row["供应商"] = cleanHealthyCsvValue(
    preferHealthyText(stableSupplierInfo.name || "", row["供应商"] || "")
  );
  if (isCorruptedText(row["供应商"])) {
    row["供应商"] = "";
  }
  row["任务名称"] = cleanHealthyCsvValue(row["任务名称"] || "");
  row["分包ID"] = cleanCsvValue(batchId);
  applyRoleRecord(row, roleRecord, payload || {});

  rowsByMergeRowId[mergeRowId] = row;
  return {
    mergeRowId: mergeRowId,
    batchId: batchId,
    supplierName: row["供应商"],
  };
}

function normalizePayloads(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload?.payloads)) {
    return payload.payloads;
  }
  return [payload];
}

function extractFailedPayloadInfo(payload, error) {
  const role = String(payload?.roleRecord?.role || "").toLowerCase();
  const batchId = cleanCsvValue(
    payload?.mergeKey?.batchId || payload?.roleRecord?.batchId || payload?.csvPatch?.["分包ID"] || ""
  );
  const message = error && error.message ? error.message : String(error);
  const missingFields = [];
  if (!batchId) {
    missingFields.push("分包ID");
  }
  return {
    batchId: batchId,
    role: role || "label",
    message: message,
    missingFields: missingFields,
  };
}

function isForceReplaceByBatchId(payload) {
  return payload?.forceReplaceByBatchId === true || payload?.replaceMode === "batch";
}

function normalizeReplaceBatchIds(payload) {
  const values = [];
  if (Array.isArray(payload?.replaceBatchIds)) {
    values.push.apply(values, payload.replaceBatchIds);
  }
  normalizePayloads(payload).forEach(function (item) {
    if (!item || typeof item !== "object") {
      return;
    }
    const patch = item && typeof item.csvPatch === "object" ? item.csvPatch : {};
    const roleRecord = item && typeof item.roleRecord === "object" ? item.roleRecord : {};
    const batchId = getBatchId(item, patch, roleRecord);
    if (batchId) {
      values.push(batchId);
    }
  });
  return Array.from(
    new Set(
      values
        .map(function (item) {
          return cleanCsvValue(item || "");
        })
        .filter(Boolean)
    )
  );
}

function removeRowsByBatchIds(rowsByMergeRowId, batchIds) {
  const rows = rowsByMergeRowId && typeof rowsByMergeRowId === "object" ? rowsByMergeRowId : {};
  const normalizedBatchIds = Array.from(
    new Set(
      (Array.isArray(batchIds) ? batchIds : [])
        .map(function (item) {
          return cleanCsvValue(item || "");
        })
        .filter(Boolean)
    )
  );
  if (normalizedBatchIds.length === 0) {
    return {
      deletedRowCount: 0,
      deletedBatchIds: [],
    };
  }

  const batchIdSet = new Set(normalizedBatchIds);
  let deletedRowCount = 0;
  Object.keys(rows).forEach(function (mergeRowId) {
    const row = rows[mergeRowId] || {};
    const rowBatchId = cleanCsvValue(row["分包ID"] || "");
    if (!rowBatchId || !batchIdSet.has(rowBatchId)) {
      return;
    }
    delete rows[mergeRowId];
    deletedRowCount += 1;
  });

  return {
    deletedRowCount: deletedRowCount,
    deletedBatchIds: normalizedBatchIds,
  };
}

function mergeUploadPayloads(payload, store) {
  const payloads = normalizePayloads(payload).filter(function (item) {
    return item && typeof item === "object";
  });
  if (payloads.length === 0) {
    throw new Error("payloads 为空，无法合并统计数据。");
  }

  const csvColumns = store.csvColumns || CSV_COLUMNS;
  const rowsByMergeRowId = store.loadRows();
  const forceReplaceByBatchId = isForceReplaceByBatchId(payload);
  const replaceBatchIds = forceReplaceByBatchId ? normalizeReplaceBatchIds(payload) : [];
  if (forceReplaceByBatchId && replaceBatchIds.length === 0) {
    throw new Error("force replace 缺少 replaceBatchIds / 分包ID，无法执行当前人员局部覆盖。");
  }
  const deleteResult = { deletedRowCount: 0, deletedBatchIds: [] };
  const results = [];
  const failures = [];
  payloads.forEach(function (item) {
    try {
      rejectIfCrossProjectPayload(item);
      const result = applyPayloadToRows(item, rowsByMergeRowId, csvColumns);
      store.appendUploadEvent(item);
      results.push(result);
    } catch (error) {
      failures.push(extractFailedPayloadInfo(item, error));
    }
  });
  if (results.length > 0) {
    store.saveRows(rowsByMergeRowId);
    store.writeCsv(rowsByMergeRowId);
  }

  const paths = store.getPaths();
  return {
    acceptedCount: results.length,
    rejectedCount: failures.length,
    rejectedItems: failures,
    batchCount: results.length,
    failedCount: failures.length,
    failures: failures,
    forceReplaceByBatchId: forceReplaceByBatchId,
    replaceMode: forceReplaceByBatchId ? "batch" : "",
    replaceBatchIds: forceReplaceByBatchId ? replaceBatchIds : [],
    replacedBatchCount: forceReplaceByBatchId ? replaceBatchIds.length : 0,
    deletedRowCount: deleteResult.deletedRowCount,
    results: results.map(function (item) {
      return {
        supplier: item.supplierName,
        batchId: item.batchId,
      };
    }),
    rowCount: Object.keys(rowsByMergeRowId).length,
    rowsPath: paths.rowsPath,
    eventsPath: paths.eventsPath,
  };
}

module.exports = {
  BASE_PATCH_COLUMNS,
  ROLE_SPECIFIC_COLUMNS,
  applyBasePatch,
  applyPayloadToRows,
  applyRoleRecord,
  createEmptyRow,
  createMergeRowId,
  formatDuration,
  inferCompleted,
  isForceReplaceByBatchId,
  mergeUploadPayloads,
  normalizeCompletedValue,
  normalizePayloads,
  normalizeReplaceBatchIds,
  removeRowsByBatchIds,
  resolveRowSupplier,
};



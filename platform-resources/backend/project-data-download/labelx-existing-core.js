"use strict";

function normalizeRole(role) {
  const text = String(role || "").trim().toLowerCase();
  if (text === "audit" || text === "check") {
    return "audit";
  }
  return "label";
}

function buildRowsByBatchId(rowsByMergeRowId, getBatchIdFromRow) {
  const rowsByBatch = {};
  const rows = rowsByMergeRowId && typeof rowsByMergeRowId === "object" ? rowsByMergeRowId : {};
  const resolveBatchId =
    typeof getBatchIdFromRow === "function"
      ? getBatchIdFromRow
      : function (row) {
          return String(row?.["分包ID"] || "").trim();
        };

  Object.keys(rows).forEach(function (mergeRowId) {
    const row = rows[mergeRowId] || {};
    const batchId = String(resolveBatchId(row) || "").trim();
    if (!batchId) {
      return;
    }
    if (!rowsByBatch[batchId]) {
      rowsByBatch[batchId] = [];
    }
    rowsByBatch[batchId].push(row);
  });

  return rowsByBatch;
}

function buildExistingResponseItems(items, rowsByMergeRowId, adapter) {
  const config = adapter && typeof adapter === "object" ? adapter : {};
  const pickRow =
    typeof config.pickRow === "function"
      ? config.pickRow
      : function (rows) {
          return rows[0] || null;
        };
  const evaluateCompletion =
    typeof config.evaluateCompletion === "function"
      ? config.evaluateCompletion
      : function () {
          return {
            complete: false,
            missingFields: [],
          };
        };
  const getMissingFieldsForAbsentBatch =
    typeof config.getMissingFieldsForAbsentBatch === "function"
      ? config.getMissingFieldsForAbsentBatch
      : function () {
          return [];
        };
  const getBatchIdFromRow =
    typeof config.getBatchIdFromRow === "function" ? config.getBatchIdFromRow : null;

  const rowsByBatch = buildRowsByBatchId(rowsByMergeRowId, getBatchIdFromRow);
  const sourceItems = Array.isArray(items) ? items : [];

  return sourceItems.map(function (item) {
    const batchId = String(item?.batchId || "").trim();
    const role = normalizeRole(item?.role || "label");
    const subTaskId = String(item?.subTaskId || "").trim();
    const userName = String(item?.userName || "").trim();

    if (!batchId) {
      return {
        batchId: "",
        role,
        subTaskId,
        exists: false,
        complete: false,
        missingFields: ["分包ID"],
      };
    }

    const rows = rowsByBatch[batchId] || [];
    if (rows.length === 0) {
      return {
        batchId,
        role,
        subTaskId,
        exists: false,
        complete: false,
        missingFields: getMissingFieldsForAbsentBatch(role, subTaskId, userName),
      };
    }

    const matchedRow = pickRow(rows, role, subTaskId, userName) || {};
    const check = evaluateCompletion(matchedRow, role, subTaskId, userName) || {};
    const complete = check.complete === true;

    return {
      batchId,
      role,
      subTaskId,
      exists: true,
      complete,
      missingFields: complete ? [] : Array.isArray(check.missingFields) ? check.missingFields : [],
    };
  });
}

module.exports = {
  buildExistingResponseItems,
  buildRowsByBatchId,
  normalizeRole,
};

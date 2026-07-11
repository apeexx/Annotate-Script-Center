"use strict";

function isBlank(value) {
  return String(value === undefined || value === null ? "" : value).trim() === "";
}

function pickRow(rows, role, subTaskId) {
  const list = Array.isArray(rows) ? rows : [];
  if (list.length === 0) {
    return null;
  }
  const subTaskIdText = String(subTaskId || "").trim();
  if (role === "audit") {
    if (subTaskIdText) {
      const byId = list.find(function (row) {
        return String(row["审核子任务ID"] || "").trim() === subTaskIdText;
      });
      if (byId) {
        return byId;
      }
    }
    return (
      list.find(function (row) {
        return !isBlank(row["审核子任务ID"]);
      }) || list[0]
    );
  }
  if (subTaskIdText) {
    const byId = list.find(function (row) {
      return String(row["标注子任务ID"] || "").trim() === subTaskIdText;
    });
    if (byId) {
      return byId;
    }
  }
  return (
    list.find(function (row) {
      return !isBlank(row["标注子任务ID"]);
    }) || list[0]
  );
}

function evaluateCompletion(row, role) {
  const target = row || {};
  const missingFields = [];
  ["分包ID", "任务名称", "任务ID", "题数"].forEach(function (field) {
    if (isBlank(target[field])) {
      missingFields.push(field);
    }
  });
  if (role === "audit") {
    if (isBlank(target["审核子任务ID"])) {
      missingFields.push("审核子任务ID");
    }
    const complete = missingFields.length === 0;
    return {
      complete,
      missingFields: complete ? [] : missingFields,
    };
  }
  if (isBlank(target["标注子任务ID"])) {
    missingFields.push("标注子任务ID");
  }
  const complete = missingFields.length === 0;
  return {
    complete,
    missingFields: complete ? [] : missingFields,
  };
}

function getMissingFieldsForAbsentBatch(role) {
  return role === "audit" ? ["审核子任务ID"] : ["标注子任务ID"];
}

function getBatchIdFromRow(row) {
  return String(row?.["分包ID"] || "").trim();
}

module.exports = {
  datasetId: "asr-transcription-statistics",
  downloadFilePrefix: "asr-transcription",
  getBatchIdFromRow,
  getMissingFieldsForAbsentBatch,
  pickRow,
  evaluateCompletion,
};

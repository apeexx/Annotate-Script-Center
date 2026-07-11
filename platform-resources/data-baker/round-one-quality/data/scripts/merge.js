"use strict";

const {
  EXPORT_ROW_KEY_FIELD_GROUPS,
  TASK_ID_FIELD_GROUP,
} = require("../field-mappings");
const { parseCsvText } = require("./csv");

function safeJsonStringify(value) {
  try {
    return JSON.stringify(value || {});
  } catch (error) {
    return "{}";
  }
}

function readFirst(row, keys) {
  for (let i = 0; i < keys.length; i += 1) {
    const value = row && row[keys[i]] != null ? String(row[keys[i]]).trim() : "";
    if (value) {
      return value;
    }
  }
  return "";
}

function createCsvRowKey(row) {
  const textNumber = readFirst(row, EXPORT_ROW_KEY_FIELD_GROUPS.textNumber);
  if (textNumber) {
    return "textNumber:" + textNumber;
  }
  const fileName = readFirst(row, EXPORT_ROW_KEY_FIELD_GROUPS.fileName);
  const segmentNumber = readFirst(row, EXPORT_ROW_KEY_FIELD_GROUPS.segmentNumber);
  if (fileName && segmentNumber) {
    return "file+segment:" + fileName + "::" + segmentNumber;
  }
  if (fileName) {
    return "file:" + fileName;
  }
  const collector = readFirst(row, EXPORT_ROW_KEY_FIELD_GROUPS.collector);
  const mobile = readFirst(row, EXPORT_ROW_KEY_FIELD_GROUPS.mobile);
  if (collector && mobile && segmentNumber) {
    return "collector+mobile+segment:" + collector + "::" + mobile + "::" + segmentNumber;
  }
  return "fallback:" + safeJsonStringify(row);
}

function pickTaskIds(rows) {
  const set = new Set();
  const list = Array.isArray(rows) ? rows : [];
  for (let i = 0; i < list.length; i += 1) {
    const taskId = readFirst(list[i], TASK_ID_FIELD_GROUP);
    if (taskId) {
      set.add(taskId);
    }
  }
  return Array.from(set).sort();
}

function rowContentSignature(row, headers) {
  const safeHeaders = Array.isArray(headers) ? headers : [];
  const obj = {};
  for (let i = 0; i < safeHeaders.length; i += 1) {
    const header = safeHeaders[i];
    obj[header] = row && row[header] != null ? String(row[header]) : "";
  }
  return safeJsonStringify(obj);
}

function mergeCsvRows(existingCsvText, incomingCsvText) {
  const existingParsed =
    existingCsvText && String(existingCsvText).trim()
      ? parseCsvText(existingCsvText)
      : { headers: [], rows: [] };
  const incomingParsed = parseCsvText(incomingCsvText);
  if (incomingParsed.rows.length === 0) {
    throw new Error("上传 CSV 无有效数据行。");
  }
  const headers = existingParsed.headers.slice();
  const headerSet = new Set(headers);
  if (headers.length === 0) {
    for (let i = 0; i < incomingParsed.headers.length; i += 1) {
      headers.push(incomingParsed.headers[i]);
      headerSet.add(incomingParsed.headers[i]);
    }
  } else {
    for (let i = 0; i < incomingParsed.headers.length; i += 1) {
      const header = incomingParsed.headers[i];
      if (!headerSet.has(header)) {
        headers.push(header);
        headerSet.add(header);
      }
    }
  }

  const map = new Map();
  const mergedRows = [];
  for (let i = 0; i < existingParsed.rows.length; i += 1) {
    const row = existingParsed.rows[i];
    const key = createCsvRowKey(row);
    const normalized = {};
    headers.forEach(function (header) {
      normalized[header] = row[header] != null ? String(row[header]) : "";
    });
    if (!map.has(key)) {
      map.set(key, mergedRows.length);
      mergedRows.push(normalized);
    } else {
      mergedRows[map.get(key)] = normalized;
    }
  }

  let addedRowCount = 0;
  let updatedRowCount = 0;
  let unchangedRowCount = 0;
  for (let i = 0; i < incomingParsed.rows.length; i += 1) {
    const row = incomingParsed.rows[i];
    const key = createCsvRowKey(row);
    const normalized = {};
    headers.forEach(function (header) {
      normalized[header] = row[header] != null ? String(row[header]) : "";
    });
    if (!map.has(key)) {
      map.set(key, mergedRows.length);
      mergedRows.push(normalized);
      addedRowCount += 1;
      continue;
    }
    const index = map.get(key);
    const before = rowContentSignature(mergedRows[index], headers);
    const after = rowContentSignature(normalized, headers);
    if (before === after) {
      unchangedRowCount += 1;
    } else {
      updatedRowCount += 1;
    }
    mergedRows[index] = normalized;
  }

  return {
    headers,
    mergedRows,
    existingRowCount: existingParsed.rows.length,
    incomingRowCount: incomingParsed.rows.length,
    rowCount: mergedRows.length,
    addedRowCount,
    updatedRowCount,
    unchangedRowCount,
    taskIds: pickTaskIds(mergedRows),
  };
}

function createRawRecordKey(record) {
  const textNumber = readFirst(record, EXPORT_ROW_KEY_FIELD_GROUPS.textNumber);
  if (textNumber) {
    return "textNumber:" + textNumber;
  }
  return "fallback:" + safeJsonStringify(record);
}

function mergeRawRecords(existingRecords, incomingRecords) {
  const base = Array.isArray(existingRecords) ? existingRecords : [];
  const incoming = Array.isArray(incomingRecords) ? incomingRecords : [];
  const map = new Map();
  const merged = [];
  for (let i = 0; i < base.length; i += 1) {
    const record = base[i];
    const key = createRawRecordKey(record);
    if (!map.has(key)) {
      map.set(key, merged.length);
      merged.push(record);
    } else {
      merged[map.get(key)] = record;
    }
  }
  for (let i = 0; i < incoming.length; i += 1) {
    const record = incoming[i];
    const key = createRawRecordKey(record);
    if (!map.has(key)) {
      map.set(key, merged.length);
      merged.push(record);
    } else {
      merged[map.get(key)] = record;
    }
  }
  return merged;
}

module.exports = {
  createCsvRowKey,
  mergeCsvRows,
  mergeRawRecords,
};

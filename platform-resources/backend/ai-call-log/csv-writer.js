"use strict";

const fs = require("fs");
const path = require("path");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeCsvCell(value) {
  const text = String(value ?? "");
  if (/[",\r\n]/.test(text)) {
    return '"' + text.replace(/"/g, '""') + '"';
  }
  return text;
}

function buildHeaderLine(schema) {
  return schema
    .map(function mapColumn(column) {
      return escapeCsvCell(column.header);
    })
    .join(",") + "\n";
}

function toCsvLine(schema, row) {
  return schema
    .map(function mapColumn(column) {
      return escapeCsvCell(row[column.key] || "");
    })
    .join(",") + "\n";
}

function formatDatePart(input) {
  const date = input ? new Date(input) : new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

function createDailyLogFileName(filePrefix, datePart, version) {
  const prefix = String(filePrefix || "ai-calls").trim() || "ai-calls";
  const suffix = Number(version) > 1 ? "-v" + String(version) : "";
  return prefix + "-" + datePart + suffix + ".csv";
}

function readFirstLine(filePath) {
  if (!fs.existsSync(filePath)) {
    return "";
  }
  const text = fs.readFileSync(filePath, "utf8");
  const newLineIndex = text.indexOf("\n");
  if (newLineIndex < 0) {
    return text;
  }
  return text.slice(0, newLineIndex + 1);
}

function resolveWritableFilePath(logDir, schema, createdAt, filePrefix) {
  const targetDir = String(logDir || "").trim();
  const datePart = formatDatePart(createdAt);
  const headerLine = buildHeaderLine(schema);

  for (let version = 1; version < 1000; version += 1) {
    const filePath = path.join(targetDir, createDailyLogFileName(filePrefix, datePart, version));
    const firstLine = readFirstLine(filePath);
    if (!firstLine || firstLine === headerLine) {
      return {
        filePath,
        headerLine,
      };
    }
  }

  throw new Error("AI 调用日志文件版本号超出限制。");
}

function appendCsvRow(options) {
  const source = options && typeof options === "object" ? options : {};
  const logDir = String(source.logDir || "").trim();
  const schema = Array.isArray(source.schema) ? source.schema : [];
  const row = source.row && typeof source.row === "object" ? source.row : {};
  const filePrefix = String(source.filePrefix || "ai-calls").trim() || "ai-calls";

  ensureDir(logDir);
  const target = resolveWritableFilePath(logDir, schema, row.createdAt, filePrefix);
  if (!fs.existsSync(target.filePath)) {
    fs.writeFileSync(target.filePath, target.headerLine, "utf8");
  }
  fs.appendFileSync(target.filePath, toCsvLine(schema, row), "utf8");
  return {
    filePath: target.filePath,
    row,
  };
}

function parseCsvRows(text) {
  const source = String(text || "").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (inQuotes) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (char === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }

  if (cell || row.length > 0) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }

  return rows.filter(function filterEmpty(cells) {
    return cells.length > 1 || String(cells[0] || "").trim() !== "";
  });
}

function readCsvObjects(filePath, schema) {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const headerMap = new Map();
  schema.forEach(function mapColumn(column) {
    headerMap.set(column.header, column.key);
    headerMap.set(column.key, column.key);
  });

  const rows = parseCsvRows(fs.readFileSync(filePath, "utf8"));
  if (rows.length <= 1) {
    return [];
  }
  const headers = rows[0].map(function mapHeader(header) {
    const normalized = String(header || "").trim();
    return headerMap.get(normalized) || normalized;
  });

  return rows.slice(1).map(function mapRow(cells) {
    const record = {};
    headers.forEach(function assignCell(key, index) {
      record[key] = String(cells[index] || "");
    });
    return record;
  });
}

function listLogFiles(options) {
  const source = options && typeof options === "object" ? options : {};
  const logDir = String(source.logDir || "").trim();
  const filePrefix = String(source.filePrefix || "ai-calls").trim() || "ai-calls";
  const from = String(source.from || "").trim();
  const to = String(source.to || "").trim();

  if (!logDir || !fs.existsSync(logDir)) {
    return [];
  }

  const matcher = new RegExp(
    "^" + escapeRegExp(filePrefix) + "-(\\d{4}-\\d{2}-\\d{2})(?:-v\\d+)?\\.csv$",
    "i"
  );

  return fs
    .readdirSync(logDir)
    .filter(function filterName(name) {
      const matched = matcher.exec(name);
      if (!matched) {
        return false;
      }
      const datePart = matched[1];
      if (from && datePart < from) {
        return false;
      }
      if (to && datePart > to) {
        return false;
      }
      return true;
    })
    .sort()
    .map(function toPath(name) {
      return path.join(logDir, name);
    });
}

module.exports = {
  appendCsvRow,
  buildHeaderLine,
  createDailyLogFileName,
  escapeCsvCell,
  formatDatePart,
  listLogFiles,
  parseCsvRows,
  readCsvObjects,
  resolveWritableFilePath,
  toCsvLine,
};

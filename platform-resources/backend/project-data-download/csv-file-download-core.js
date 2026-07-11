"use strict";

const fs = require("fs");
const path = require("path");
const { createCorsHeaders } = require("../response");

function sanitizeHeaderFilename(value) {
  const text = String(value || "download.csv")
    .replace(/[\r\n]/g, "")
    .replace(/"/g, "")
    .trim();
  return text || "download.csv";
}

function createAsciiFallbackFilename(filename) {
  const cleaned = sanitizeHeaderFilename(filename);
  const hasCsvExt = /\.csv$/i.test(cleaned);
  const base = hasCsvExt ? cleaned.replace(/\.csv$/i, "") : cleaned;
  const asciiBase = base
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/[\\/:*?<>|]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .trim();
  return (asciiBase || "download") + ".csv";
}

function createContentDisposition(filename) {
  const utf8Filename = sanitizeHeaderFilename(filename);
  const asciiFilename = createAsciiFallbackFilename(utf8Filename);
  return (
    'attachment; filename="' +
    asciiFilename +
    '"; filename*=UTF-8\'\'' +
    encodeURIComponent(utf8Filename)
  );
}

function createCsvDownloadHeaders(filename, fileSize) {
  return createCorsHeaders({
    "Cache-Control": "no-store",
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Length": String(fileSize),
    "Content-Disposition": createContentDisposition(filename),
  });
}

function createCsvDownloadTarget(filePath, options) {
  const config = options && typeof options === "object" ? options : {};
  const targetPath = String(filePath || "").trim();
  const missingMessage = String(config.missingMessage || "CSV 文件不存在。");
  const invalidPathMessage = String(config.invalidPathMessage || "CSV 路径不是文件。");
  if (!targetPath || !fs.existsSync(targetPath)) {
    throw new Error(missingMessage);
  }
  const stat = fs.statSync(targetPath);
  if (!stat.isFile()) {
    throw new Error(invalidPathMessage);
  }
  const configuredFileName = String(config.fileName || "").trim();
  const fileName = configuredFileName
    ? sanitizeHeaderFilename(configuredFileName)
    : path.basename(targetPath || "download.csv") || "download.csv";
  return {
    filePath: targetPath,
    fileName,
    fileSize: stat.size,
    headers: createCsvDownloadHeaders(fileName, stat.size),
  };
}

function sendCsvDownload(request, response, target) {
  const downloadTarget = target && typeof target === "object" ? target : {};
  response.writeHead(200, downloadTarget.headers || createCsvDownloadHeaders(downloadTarget.fileName, downloadTarget.fileSize));
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  const stream = fs.createReadStream(downloadTarget.filePath);
  stream.on("error", function (error) {
    response.destroy(error);
  });
  stream.pipe(response);
}

module.exports = {
  createAsciiFallbackFilename,
  createContentDisposition,
  createCsvDownloadHeaders,
  createCsvDownloadTarget,
  sanitizeHeaderFilename,
  sendCsvDownload,
};

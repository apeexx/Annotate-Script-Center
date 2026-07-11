"use strict";

const {
  createCsvDownloadTarget,
} = require("../../../../backend/project-data-download/csv-file-download-core");
const { createLegacyExportDownloadTarget } = require("../adapter");

function createLatestCsvDownloadTarget(options) {
  const target = createLegacyExportDownloadTarget(options && typeof options === "object" ? options : {});
  return createCsvDownloadTarget(target.filePath, {
    fileName: target.fileName,
    missingMessage: "latest.csv 不存在，请先上传导出数据。",
    invalidPathMessage: "latest.csv 路径不是文件。",
  });
}

module.exports = {
  createLatestCsvDownloadTarget,
};

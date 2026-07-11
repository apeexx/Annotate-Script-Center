"use strict";

const path = require("path");
const {
  DEFAULT_LATEST_FILE_NAME,
  resolveExportStorePaths,
} = require("../backend/export-store");

const DATASET_ID = "data-baker-round-one-export";
const DATASET_LABEL = "闽南语助手导出数据";
const PROJECT_DOWNLOAD_FILE_NAME = "data-baker-round-one-quality-latest.csv";

function resolveDataBakerExportPaths(options) {
  return resolveExportStorePaths(options && typeof options === "object" ? options : {});
}

function createProjectDownloadDataset(options) {
  const paths = resolveDataBakerExportPaths(options);
  return {
    id: DATASET_ID,
    label: DATASET_LABEL,
    defaultFileName: PROJECT_DOWNLOAD_FILE_NAME,
    getCsvPath: function () {
      return paths.latestCsvPath;
    },
  };
}

function createLegacyExportDownloadTarget(options) {
  const paths = resolveDataBakerExportPaths(options);
  return {
    fileName: path.basename(paths.latestCsvPath || DEFAULT_LATEST_FILE_NAME) || DEFAULT_LATEST_FILE_NAME,
    filePath: paths.latestCsvPath,
  };
}

module.exports = {
  DATASET_ID,
  DATASET_LABEL,
  PROJECT_DOWNLOAD_FILE_NAME,
  createLegacyExportDownloadTarget,
  createProjectDownloadDataset,
  resolveDataBakerExportPaths,
};

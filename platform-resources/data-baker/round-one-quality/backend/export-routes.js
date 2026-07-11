"use strict";

const fs = require("fs");
const { sendJson } = require("../../../backend/response");
const { MAX_CSV_BYTES, createExportStore } = require("./export-store");
const { createLatestCsvDownloadTarget } = require("../data/scripts/download");
const {
  listHistoryCsvFiles,
  readLatestExportMeta,
  readLatestExportSnapshot,
  readUploadEventEntries,
} = require("../data/scripts/fetch");
const {
  MAX_RAW_RECORDS_BYTES,
  normalizeExportUploadPayload,
} = require("../data/scripts/upload");

const EXPORT_BASE_PATH = "/api/data-baker/round-one-quality/export";
const EXPORT_HEALTH_PATH = EXPORT_BASE_PATH + "/health";
const EXPORT_CONFIG_PATH = EXPORT_BASE_PATH + "/config";
const EXPORT_UPLOAD_PATH = EXPORT_BASE_PATH + "/upload";
const EXPORT_DOWNLOAD_PATH = EXPORT_BASE_PATH + "/download";
const EXPORT_LIST_PATH = EXPORT_BASE_PATH + "/list";
const MAX_BODY_BYTES = MAX_CSV_BYTES + MAX_RAW_RECORDS_BYTES + 1024 * 1024;

function createRequestId() {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

function readRequestBody(request) {
  return new Promise(function (resolve, reject) {
    let body = "";
    request.on("data", function (chunk) {
      body += chunk;
      if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) {
        reject(new Error("请求体超过限制。"));
        request.destroy();
      }
    });
    request.on("end", function () {
      resolve(body);
    });
    request.on("error", reject);
  });
}

function sendHealth(response, store) {
  sendJson(response, 200, {
    success: true,
    service: "data-baker-round-one-quality-export",
    uploadPath: EXPORT_UPLOAD_PATH,
    downloadPath: EXPORT_DOWNLOAD_PATH,
    configPath: EXPORT_CONFIG_PATH,
    dataDir: store.getPaths().dataDir,
    latestCsvPath: store.getPaths().latestCsvPath,
    latestRawJsonPath: store.getPaths().latestRawPath,
  });
}

function sendConfig(response, store) {
  const paths = store.getPaths();
  const snapshot = readLatestExportSnapshot({
    dataDir: paths.dataDir,
  });
  const latestMeta = readLatestExportMeta({
    dataDir: paths.dataDir,
  });
  const recentUploadEvents = readUploadEventEntries({
    dataDir: paths.dataDir,
    limit: 5,
  });
  const historyItems = listHistoryCsvFiles({
    dataDir: paths.dataDir,
  });
  sendJson(response, 200, {
    success: true,
    data: {
      exportEnabled: true,
      dataDir: paths.dataDir,
      latestCsvPath: paths.latestCsvPath,
      latestRawJsonPath: paths.latestRawPath,
      latestMetaPath: paths.latestMetaPath,
      historyDirPath: paths.historyDirPath || "",
      maxCsvBytes: MAX_CSV_BYTES,
      latestCsvExists: snapshot.exists.latestCsv,
      latestMetaJsonExists: snapshot.exists.latestMetaJson,
      latestRawJsonExists: snapshot.exists.latestRawJson,
      uploadEventsExists: snapshot.exists.uploadEvents,
      historyCsvCount: historyItems.length,
      latestMeta: latestMeta,
      recentUploadEvents: recentUploadEvents,
    },
  });
}

function handleDownload(request, response, store) {
  try {
    const downloadTarget = createLatestCsvDownloadTarget({
      dataDir: store.getPaths().dataDir,
    });
    response.writeHead(200, downloadTarget.headers);
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    const stream = fs.createReadStream(downloadTarget.filePath);
    stream.on("error", function (error) {
      response.destroy(error);
    });
    stream.pipe(response);
  } catch (error) {
    sendJson(response, 404, {
      success: false,
      message: error && error.message ? error.message : String(error),
    });
  }
}

function handleList(response, store) {
  sendJson(response, 200, {
    success: true,
    data: listHistoryCsvFiles({
      dataDir: store.getPaths().dataDir,
    }),
  });
}

async function handleUpload(request, response, store) {
  const requestId = createRequestId();
  try {
    const contentType = String(request.headers["content-type"] || "").toLowerCase();
    if (contentType.indexOf("application/json") < 0) {
      throw new Error("仅支持 application/json 请求体。");
    }
    const rawBody = await readRequestBody(request);
    const payload = normalizeExportUploadPayload(JSON.parse(rawBody || "{}"));
    const saved = store.saveUpload(payload);
    const baseUrl = "http://" + String(request.headers.host || "127.0.0.1:3333");
    const downloadUrl = baseUrl + EXPORT_DOWNLOAD_PATH;

    console.info(
      "[DataBaker Export][upload]",
      JSON.stringify(
        {
          requestId: requestId,
          incomingRowCount: saved.incomingRowCount,
          existingRowCount: saved.existingRowCount,
          addedRowCount: saved.addedRowCount,
          updatedRowCount: saved.updatedRowCount,
          rowCount: saved.rowCount,
          fileName: saved.fileName,
          csvPath: saved.csvPath,
          uploadedAt: saved.uploadedAt,
          taskIds: saved.taskIds,
        },
        null,
        0
      )
    );

    sendJson(response, 200, {
      success: true,
      data: {
        requestId: requestId,
        fileName: saved.fileName,
        rowCount: saved.rowCount,
        incomingRowCount: saved.incomingRowCount,
        existingRowCount: saved.existingRowCount,
        addedRowCount: saved.addedRowCount,
        updatedRowCount: saved.updatedRowCount,
        unchangedRowCount: saved.unchangedRowCount,
        taskIds: saved.taskIds,
        csvPath: saved.csvPath,
        rawJsonPath: saved.rawJsonPath,
        latestMetaPath: saved.latestMetaPath,
        downloadUrl: downloadUrl,
        uploadedAt: saved.uploadedAt,
        warnings: Array.isArray(saved.warnings) ? saved.warnings : [],
      },
    });
  } catch (error) {
    sendJson(response, 400, {
      success: false,
      message: error && error.message ? error.message : String(error),
      requestId: requestId,
    });
  }
}

function registerExportRoutes(router, options) {
  const store = createExportStore(options);
  store.ensureDataDir();

  router.get(EXPORT_HEALTH_PATH, function ({ response }) {
    sendHealth(response, store);
  });

  router.get(EXPORT_CONFIG_PATH, function ({ response }) {
    sendConfig(response, store);
  });

  router.post(EXPORT_UPLOAD_PATH, function ({ request, response }) {
    return handleUpload(request, response, store);
  });

  router.get(EXPORT_DOWNLOAD_PATH, function ({ request, response }) {
    handleDownload(request, response, store);
  });

  router.head(EXPORT_DOWNLOAD_PATH, function ({ request, response }) {
    handleDownload(request, response, store);
  });

  router.get(EXPORT_LIST_PATH, function ({ response }) {
    handleList(response, store);
  });
}

module.exports = {
  EXPORT_BASE_PATH,
  EXPORT_CONFIG_PATH,
  EXPORT_DOWNLOAD_PATH,
  EXPORT_HEALTH_PATH,
  EXPORT_LIST_PATH,
  EXPORT_UPLOAD_PATH,
  registerExportRoutes,
};

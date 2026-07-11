"use strict";

const { createCorsHeaders, sendJson } = require("../../../backend/response");
const {
  handleLabelxDownloadCsv,
  handleLabelxSuppliers,
} = require("../../../backend/project-data-download/labelx-download-core");
const {
  buildExistingResponseItems,
} = require("../../../backend/project-data-download/labelx-existing-core");
const { createStatisticsStore } = require("./file-store");
const { mergeUploadPayloads } = require("./payload-merge");
const { createMergedCsvContent } = require("./csv-writer");
const dataAdapter = require("../data/adapter");

const API_BASE_PATH = "/api/alibaba-labelx/asr-transcription/statistics";
const LEGACY_API_BASE_PATH = "/api/asr-transcription/statistics";
const UPLOAD_PATH = API_BASE_PATH + "/upload";
const CONFIG_PATH = API_BASE_PATH + "/config";
const HEALTH_PATH = API_BASE_PATH + "/health";
const DOWNLOAD_PATH = API_BASE_PATH + "/download";
const SUPPLIERS_PATH = API_BASE_PATH + "/suppliers";
const EXISTING_PATH = API_BASE_PATH + "/existing";
const LEGACY_UPLOAD_PATH = LEGACY_API_BASE_PATH + "/upload";
const LEGACY_CONFIG_PATH = LEGACY_API_BASE_PATH + "/config";
const LEGACY_HEALTH_PATH = LEGACY_API_BASE_PATH + "/health";
const MAX_BODY_BYTES = 20 * 1024 * 1024;
const DEFAULT_UPLOAD_TIMES = ["10:00", "16:00"];
const DEFAULT_JITTER_MINUTES = 0;
const DEFAULT_RANDOM_DELAY_MAX_SECONDS = 300;
const DEFAULT_RANDOM_DELAY_STEP_MS = 100;

function createRequestId() {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

function readRequestBody(request) {
  return new Promise(function (resolve, reject) {
    let body = "";
    request.on("data", function (chunk) {
      body += chunk;
      if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) {
        reject(new Error("请求体超过 20MB。"));
        request.destroy();
      }
    });
    request.on("end", function () {
      resolve(body);
    });
    request.on("error", reject);
  });
}

function extractLogInfo(payload, result) {
  const payloads = Array.isArray(payload?.payloads)
    ? payload.payloads
    : Array.isArray(payload)
      ? payload
      : [payload];
  const firstPayload = payloads[0] || {};
  return {
    projectId: String(payload?.mergeKey?.projectId || firstPayload?.url?.projectId || ""),
    batchId: String(
      firstPayload?.mergeKey?.batchId ||
        firstPayload?.roleRecord?.batchId ||
        firstPayload?.csvPatch?.["分包ID"] ||
        ""
    ),
    supplierName: String(
      firstPayload?.supplier?.name ||
        firstPayload?.mergeKey?.supplierName ||
        firstPayload?.csvPatch?.["供应商"] ||
        ""
    ),
    payloadCount: payloads.filter(function (item) {
      return item && typeof item === "object";
    }).length,
    rowCount: Number(result?.rowCount || 0),
  };
}

async function handleUpload(request, response, store) {
  const requestId = createRequestId();
  try {
    const body = await readRequestBody(request);
    const payload = JSON.parse(body || "{}");
    const result = mergeUploadPayloads(payload, store);
    const logInfo = extractLogInfo(payload, result);
    console.info(
      "[ASR Transcription Stats][upload]",
      JSON.stringify(
        {
          requestId: requestId,
          projectId: logInfo.projectId,
          supplierName: logInfo.supplierName,
          batchId: logInfo.batchId,
          payloadCount: logInfo.payloadCount,
          rowCount: logInfo.rowCount,
          csvPath: store.getPaths().csvPath,
        },
        null,
        0
      )
    );

    sendJson(response, 200, {
      success: true,
      data: Object.assign({ requestId: requestId }, result),
    });
  } catch (error) {
    sendJson(response, 400, {
      success: false,
      message: error && error.message ? error.message : String(error),
      requestId: requestId,
    });
  }
}

function createScheduleConfig() {
  return {
    enabled: true,
    times: DEFAULT_UPLOAD_TIMES.slice(),
    uploadTimes: DEFAULT_UPLOAD_TIMES.slice(),
    scheduleTimes: DEFAULT_UPLOAD_TIMES.slice(),
    jitterMinutes: DEFAULT_JITTER_MINUTES,
    randomDelayMaxSeconds: DEFAULT_RANDOM_DELAY_MAX_SECONDS,
    randomDelayStepMs: DEFAULT_RANDOM_DELAY_STEP_MS,
  };
}

async function handleExisting(request, response, store) {
  try {
    const body = await readRequestBody(request);
    const payload = JSON.parse(body || "{}");
    const items = Array.isArray(payload?.items) ? payload.items : [];
    const resultItems = buildExistingResponseItems(items, store.loadRows() || {}, dataAdapter);

    sendJson(response, 200, {
      success: true,
      data: {
        items: resultItems,
      },
    });
  } catch (error) {
    sendJson(response, 400, {
      success: false,
      message: error && error.message ? error.message : String(error),
    });
  }
}

function sendHealth(response, store) {
  const paths = store.getPaths();
  sendJson(response, 200, {
    success: true,
    service: "asr-transcription-statistics",
    uploadPath: UPLOAD_PATH,
    legacyUploadPath: LEGACY_UPLOAD_PATH,
    configPath: CONFIG_PATH,
    legacyConfigPath: LEGACY_CONFIG_PATH,
    downloadPath: DOWNLOAD_PATH,
    suppliersPath: SUPPLIERS_PATH,
    existingPath: EXISTING_PATH,
    downloadRequiresSupplier: false,
    csvPath: paths.csvPath,
    deprecatedCsvPath: "",
  });
}

function handleSuppliers(response, store) {
  return handleLabelxSuppliers(response, store, DOWNLOAD_PATH);
}

function handleDownloadCsv(request, response, query, store) {
  return handleLabelxDownloadCsv(request, response, query, store, {
    downloadFilePrefix: dataAdapter.downloadFilePrefix,
    createMergedCsvContent,
  });
}

function addAliases(router, method, paths, handler) {
  paths.forEach(function (routePath) {
    router.add(method, routePath, handler);
  });
}

function registerAsrTranscriptionRoutes(router, options) {
  const store = createStatisticsStore(options);
  store.ensureDataDir();

  addAliases(router, "GET", [HEALTH_PATH, LEGACY_HEALTH_PATH], function ({ response }) {
    sendHealth(response, store);
  });

  addAliases(router, "GET", [CONFIG_PATH, LEGACY_CONFIG_PATH], function ({ response }) {
    sendJson(response, 200, {
      success: true,
      data: createScheduleConfig(),
    });
  });

  addAliases(router, "GET", [UPLOAD_PATH, LEGACY_UPLOAD_PATH], function ({ query, response }) {
    const purpose = String(query?.purpose || "").toLowerCase();
    if (purpose !== "schedule") {
      sendHealth(response, store);
      return;
    }
    sendJson(response, 200, {
      success: true,
      data: createScheduleConfig(),
    });
  });

  addAliases(router, "POST", [UPLOAD_PATH, LEGACY_UPLOAD_PATH], function ({ request, response }) {
    return handleUpload(request, response, store);
  });

  addAliases(router, "POST", [EXISTING_PATH], function ({ request, response }) {
    return handleExisting(request, response, store);
  });

  addAliases(router, "GET", [SUPPLIERS_PATH], function ({ response }) {
    handleSuppliers(response, store);
  });

  addAliases(router, "GET", [DOWNLOAD_PATH], function ({ request, response, query }) {
    handleDownloadCsv(request, response, query, store);
  });

  addAliases(router, "HEAD", [DOWNLOAD_PATH], function ({ request, response, query }) {
    handleDownloadCsv(request, response, query, store);
  });
}

module.exports = {
  API_BASE_PATH,
  CONFIG_PATH,
  DOWNLOAD_PATH,
  HEALTH_PATH,
  LEGACY_API_BASE_PATH,
  LEGACY_CONFIG_PATH,
  LEGACY_HEALTH_PATH,
  LEGACY_UPLOAD_PATH,
  SUPPLIERS_PATH,
  EXISTING_PATH,
  UPLOAD_PATH,
  createScheduleConfig,
  handleDownloadCsv,
  readRequestBody,
  registerAsrTranscriptionRoutes,
};


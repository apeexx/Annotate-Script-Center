"use strict";

const fs = require("fs");
const path = require("path");
const { authenticateAdminRequest, getAdminAuthConfig } = require("../admin-auth");
const { appendRuntimeLog } = require("../runtime-log-store");
const { createCorsHeaders, sendJson } = require("../response");
const { createAuditStore } = require("./audit-store");
const { createSignedToken, verifySignedToken } = require("./jwt");
const { createProjectDownloadDataset } = require("../../data-baker/round-one-quality/data/adapter");
const {
  appendSupplierSuffix,
  collectSuppliers,
  filterRowsBySupplier,
  normalizeText,
  parseCsv,
  sanitizeParsedCsv,
  stringifyCsv,
} = require("./csv-utils");

const OPTIONS_PATH = "/api/admin/project-data-download/options";
const REQUEST_PATH = "/api/admin/project-data-download/request";
const FILE_PATH = "/api/admin/project-data-download/file";
const MAX_BODY_BYTES = 1024 * 1024;
const DEFAULT_EXPIRES_IN_SECONDS = 120;
const TRAILING_PUNCTUATION_PATTERN = /[；;。，“”"'’)\]】}》>\s]+$/u;
const ALL_SUPPLIERS_VALUE = "__all__";

function createRequestId() {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
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

function getHeaderText(headers, key) {
  const value = headers ? headers[key] : "";
  if (Array.isArray(value)) {
    return String(value[0] || "");
  }
  return String(value || "");
}

function isAllSuppliersSelection(value) {
  return normalizeText(value) === ALL_SUPPLIERS_VALUE;
}

function normalizeRequestedSupplier(value) {
  return isAllSuppliersSelection(value) ? "" : normalizeText(value);
}

function getClientIp(request) {
  const forwardedFor = getHeaderText(request.headers, "x-forwarded-for")
    .split(",")
    .map(function (item) {
      return normalizeText(item);
    })
    .filter(Boolean);
  if (forwardedFor.length > 0) {
    return forwardedFor[0];
  }
  const realIp = normalizeText(getHeaderText(request.headers, "x-real-ip"));
  if (realIp) {
    return realIp;
  }
  return normalizeText(request?.socket?.remoteAddress || "");
}

function getRequestBaseUrl(request) {
  const protoHeader = normalizeText(getHeaderText(request.headers, "x-forwarded-proto"));
  const proto = protoHeader ? protoHeader.split(",")[0].trim() : "http";
  const hostHeader = normalizeText(getHeaderText(request.headers, "x-forwarded-host")) || normalizeText(getHeaderText(request.headers, "host"));
  const host = hostHeader ? hostHeader.split(",")[0].trim() : "127.0.0.1:3333";
  return proto + "://" + host;
}

function getAuthConfig() {
  const passwordSha256 =
    normalizeText(process.env.ASC_PROJECT_DATA_DOWNLOAD_PASSWORD_SHA256) ||
    normalizeText(process.env.ASC_DATA_DOWNLOAD_PASSWORD_SHA256);
  const jwtSecret =
    normalizeText(process.env.ASC_PROJECT_DATA_DOWNLOAD_JWT_SECRET) ||
    normalizeText(process.env.ASC_DATA_DOWNLOAD_JWT_SECRET);
  return {
    passwordSha256: passwordSha256,
    jwtSecret: jwtSecret,
  };
}

function createDatasetRegistry(config) {
  const options = config && typeof config === "object" ? config : {};
  if (Array.isArray(options.datasets) && options.datasets.length > 0) {
    return options.datasets.slice();
  }
  const asrJudgementDir =
    normalizeText(options.asrJudgementStatsDir) ||
    normalizeText(process.env.ASR_JUDGEMENT_STATS_DIR) ||
    path.join(__dirname, "..", "..", "alibaba-labelx", "asr-judgement", "backend", "statistics-data");
  const asrTranscriptionDir =
    normalizeText(options.asrTranscriptionStatsDir) ||
    normalizeText(process.env.ASR_TRANSCRIPTION_STATS_DIR) ||
    path.join(__dirname, "..", "..", "alibaba-labelx", "asr-transcription", "backend", "statistics-data");
  const dataBakerExportDir =
    normalizeText(options.dataBakerExportDir) ||
    normalizeText(process.env.DATABAKER_ROUND_ONE_EXPORT_DIR) ||
    path.join(__dirname, "..", "..", "data-baker", "round-one-quality", "backend", "export-data");
  const dataBakerDataset = createProjectDownloadDataset({
    dataDir: dataBakerExportDir,
  });

  return [
    {
      id: "asr-judgement-statistics",
      label: "ASR 快判统计数据",
      defaultFileName: "asr-judgement-statistics-merged.csv",
      getCsvPath: function () {
        return path.join(asrJudgementDir, "statistics-merged.csv");
      },
    },
    {
      id: "asr-transcription-statistics",
      label: "ASR 转写统计数据",
      defaultFileName: "asr-transcription-statistics-merged.csv",
      getCsvPath: function () {
        return path.join(asrTranscriptionDir, "statistics-merged.csv");
      },
    },
    dataBakerDataset,
  ];
}

function getDatasetById(datasets, datasetId) {
  const target = normalizeText(datasetId);
  return (datasets || []).find(function (item) {
    return normalizeText(item.id) === target;
  }) || null;
}

function readDatasetCsvMeta(dataset) {
  const csvPath = dataset?.getCsvPath ? dataset.getCsvPath() : "";
  if (!csvPath || !fs.existsSync(csvPath)) {
    return {
      csvPath: csvPath,
      exists: false,
      suppliers: [],
      supplierRequired: false,
      headers: [],
      rows: [],
    };
  }

  const csvText = fs.readFileSync(csvPath, "utf8");
  const parsed = parseCsv(csvText);
  const suppliers = collectSuppliers(parsed);
  return {
    csvPath: csvPath,
    exists: true,
    suppliers: suppliers,
    supplierRequired: suppliers.length > 1,
    headers: parsed.headers || [],
    rows: parsed.rows || [],
  };
}

function buildProjectDataDownloadOption(dataset) {
  const meta = readDatasetCsvMeta(dataset);
  return {
    id: dataset.id,
    label: dataset.label,
    supplierRequired: meta.supplierRequired,
    suppliers: meta.suppliers,
    hasData: meta.exists,
  };
}

function listProjectDataDownloadDatasets(config) {
  return createDatasetRegistry(config).map(buildProjectDataDownloadOption);
}

function toStatusCodeForCode(code) {
  if (code === "project-data-download-auth-not-configured") {
    return 500;
  }
  if (code === "project-data-download-password-invalid") {
    return 401;
  }
  if (code === "project-data-download-token-missing") {
    return 401;
  }
  if (code === "project-data-download-token-invalid") {
    return 401;
  }
  if (code === "project-data-download-token-expired") {
    return 401;
  }
  if (code === "project-data-download-csv-not-found") {
    return 404;
  }
  if (code === "project-data-download-supplier-no-data") {
    return 404;
  }
  if (code === "project-data-download-supplier-required") {
    return 400;
  }
  return 400;
}

function sendError(response, code, message, requestId) {
  sendJson(response, toStatusCodeForCode(code), {
    success: false,
    code: code,
    message: message,
    requestId: requestId,
  });
}

function sendErrorWithData(response, code, message, requestId, data) {
  sendJson(response, toStatusCodeForCode(code), {
    success: false,
    code: code,
    message: message,
    requestId: requestId,
    data: data && typeof data === "object" ? data : {},
  });
}

function normalizeTokenText(value) {
  let text = normalizeText(value);
  let guard = 0;
  while (TRAILING_PUNCTUATION_PATTERN.test(text) && guard < 5) {
    text = text.replace(TRAILING_PUNCTUATION_PATTERN, "");
    guard += 1;
  }
  return text;
}

function formatIsoTimeFromUnixSeconds(secondsValue) {
  const seconds = Number(secondsValue);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "";
  }
  return new Date(seconds * 1000).toISOString();
}

function buildAuditPayload(input) {
  const data = input && typeof input === "object" ? input : {};
  return {
    requestId: normalizeText(data.requestId),
    jti: normalizeText(data.jti),
    dataset: normalizeText(data.dataset),
    supplier: normalizeText(data.supplier),
    operatorName: normalizeText(data.operatorName),
    status: normalizeText(data.status),
    reason: normalizeText(data.reason),
    ip: normalizeText(data.ip),
    userAgent: normalizeText(data.userAgent),
    platform: normalizeText(data.platform),
    language: normalizeText(data.language),
    screen: normalizeText(data.screen),
    requestedAt: normalizeText(data.requestedAt),
    downloadedAt: normalizeText(data.downloadedAt),
    tokenExpiresAt: normalizeText(data.tokenExpiresAt),
    fileName: normalizeText(data.fileName),
    fileSize: Number.isFinite(Number(data.fileSize)) ? Number(data.fileSize) : 0,
  };
}

function appendProjectDownloadRuntimeLog(level, action, requestId, payload) {
  const data = payload && typeof payload === "object" ? payload : {};
  appendRuntimeLog({
    level: level,
    scope: "admin.project_data_download",
    action: action,
    message: normalizeText(data.message) || "项目数据下载事件",
    requestId,
    details: {
      dataset: normalizeText(data.dataset),
      supplier: normalizeText(data.supplier),
      operatorName: normalizeText(data.operatorName),
      reason: normalizeText(data.reason),
      fileName: normalizeText(data.fileName),
    },
  });
}

function createCsvHeaders(fileName, fileSize) {
  const safeFileName = normalizeText(fileName).replace(/"/g, "") || "project-data-download.csv";
  const asciiFileName = safeFileName.replace(/[^\x20-\x7E]/g, "_");
  return createCorsHeaders({
    "Cache-Control": "no-store",
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Length": String(fileSize),
    "Content-Disposition":
      'attachment; filename="' +
      asciiFileName +
      '"; filename*=UTF-8\'\'' +
      encodeURIComponent(safeFileName),
  });
}

function registerProjectDataDownloadRoutes(router, options) {
  const config = options && typeof options === "object" ? options : {};
  const datasets = createDatasetRegistry(config);
  const auditStore = createAuditStore({
    dataDir:
      normalizeText(config.auditDataDir) ||
      path.join(__dirname, "audit-data"),
  });
  auditStore.ensureDataDir();

  router.get(OPTIONS_PATH, function ({ response }) {
    const result = datasets.map(buildProjectDataDownloadOption);
    sendJson(response, 200, {
      success: true,
      data: result,
    });
  });

  router.post(REQUEST_PATH, async function ({ request, response }) {
    const requestId = createRequestId();
    const ip = getClientIp(request);
    try {
      const body = JSON.parse(await readRequestBody(request) || "{}");
      const datasetId = normalizeText(body?.dataset);
      const supplier = normalizeText(body?.supplier);
      const password = String(body?.password || "");
      const operatorName = normalizeText(body?.operatorName);
      const clientInfo = body?.clientInfo && typeof body.clientInfo === "object" ? body.clientInfo : {};
      const userAgent = normalizeText(clientInfo.userAgent || getHeaderText(request.headers, "user-agent"));
      const platform = normalizeText(clientInfo.platform);
      const language = normalizeText(clientInfo.language);
      const screen = normalizeText(clientInfo.screen);

      const dataset = getDatasetById(datasets, datasetId);
      if (!dataset) {
        const code = "project-data-download-dataset-invalid";
        appendProjectDownloadRuntimeLog("warn", "request_failed", requestId, {
          dataset: datasetId,
          supplier,
          operatorName,
          reason: code,
          message: "项目数据下载失败：数据类型无效",
        });
        auditStore.append(
          buildAuditPayload({
            requestId: requestId,
            dataset: datasetId,
            supplier: supplier,
            operatorName: operatorName,
            status: "request_failed",
            reason: code,
            ip: ip,
            userAgent: userAgent,
            platform: platform,
            language: language,
            screen: screen,
            requestedAt: new Date().toISOString(),
          })
        );
        sendError(response, code, "数据类型无效。", requestId);
        return;
      }
      if (!operatorName) {
        const code = "project-data-download-operator-name-required";
        appendProjectDownloadRuntimeLog("warn", "request_failed", requestId, {
          dataset: dataset.id,
          supplier,
          operatorName,
          reason: code,
          message: "项目数据下载失败：未填写获取人姓名",
        });
        auditStore.append(
          buildAuditPayload({
            requestId: requestId,
            dataset: dataset.id,
            supplier: supplier,
            operatorName: operatorName,
            status: "request_failed",
            reason: code,
            ip: ip,
            userAgent: userAgent,
            platform: platform,
            language: language,
            screen: screen,
            requestedAt: new Date().toISOString(),
          })
        );
        sendError(response, code, "请先填写获取人姓名。", requestId);
        return;
      }

      const authConfig = getAuthConfig();
      if (!authConfig.passwordSha256 || !authConfig.jwtSecret) {
        const code = "project-data-download-auth-not-configured";
        appendProjectDownloadRuntimeLog("error", "request_failed", requestId, {
          dataset: dataset.id,
          supplier,
          operatorName,
          reason: code,
          message: "项目数据下载失败：后端未配置下载鉴权",
        });
        auditStore.append(
          buildAuditPayload({
            requestId: requestId,
            dataset: dataset.id,
            supplier: supplier,
            operatorName: operatorName,
            status: "request_failed",
            reason: code,
            ip: ip,
            userAgent: userAgent,
            platform: platform,
            language: language,
            screen: screen,
            requestedAt: new Date().toISOString(),
          })
        );
        sendError(response, code, "后端未配置项目数据下载鉴权环境变量。", requestId);
        return;
      }

      const authResult = authenticateAdminRequest({
        request,
        password,
        authConfig,
        sessionAuthConfig: getAdminAuthConfig(),
      });
      if (!authResult.ok) {
        const code =
          authResult.code === "admin-auth-not-configured"
            ? "project-data-download-auth-not-configured"
            : authResult.code === "admin-auth-password-invalid"
              ? "project-data-download-password-invalid"
              : authResult.code === "admin-auth-missing"
                ? "project-data-download-token-missing"
                : authResult.code === "admin-session-token-expired"
                  ? "project-data-download-token-expired"
                  : "project-data-download-token-invalid";
        appendProjectDownloadRuntimeLog("warn", "request_failed", requestId, {
          dataset: dataset.id,
          supplier,
          operatorName,
          reason: code,
          message: "项目数据下载失败：管理员鉴权未通过",
        });
        auditStore.append(
          buildAuditPayload({
            requestId: requestId,
            dataset: dataset.id,
            supplier: supplier,
            operatorName: operatorName,
            status: "request_failed",
            reason: code,
            ip: ip,
            userAgent: userAgent,
            platform: platform,
            language: language,
            screen: screen,
            requestedAt: new Date().toISOString(),
          })
        );
        sendError(
          response,
          code,
          code === "project-data-download-password-invalid"
            ? "下载密码错误。"
            : authResult.message || "管理员会话无效。",
          requestId
        );
        return;
      }

      const meta = readDatasetCsvMeta(dataset);
      if (!meta.exists) {
        const code = "project-data-download-csv-not-found";
        auditStore.append(
          buildAuditPayload({
            requestId: requestId,
            dataset: dataset.id,
            supplier: supplier,
            operatorName: operatorName,
            status: "request_failed",
            reason: code,
            ip: ip,
            userAgent: userAgent,
            platform: platform,
            language: language,
            screen: screen,
            requestedAt: new Date().toISOString(),
          })
        );
        sendError(response, code, "当前数据文件不存在，请先生成数据后再下载。", requestId);
        return;
      }

      const supplierSelection = normalizeText(body?.supplier);
      const normalizedSupplier = normalizeRequestedSupplier(body?.supplier);

      if (
        meta.supplierRequired &&
        !normalizedSupplier &&
        !isAllSuppliersSelection(supplierSelection)
      ) {
        const code = "project-data-download-supplier-required";
        auditStore.append(
          buildAuditPayload({
            requestId: requestId,
            dataset: dataset.id,
            supplier: normalizedSupplier,
            operatorName: operatorName,
            status: "request_failed",
            reason: code,
            ip: ip,
            userAgent: userAgent,
            platform: platform,
            language: language,
            screen: screen,
            requestedAt: new Date().toISOString(),
          })
        );
        sendError(response, code, "当前数据存在多个供应商，请先选择供应商。", requestId);
        return;
      }

      if (
        normalizedSupplier &&
        meta.suppliers.length > 0 &&
        meta.suppliers.indexOf(normalizedSupplier) < 0
      ) {
        const code = "project-data-download-supplier-no-data";
        auditStore.append(
          buildAuditPayload({
            requestId: requestId,
            dataset: dataset.id,
            supplier: normalizedSupplier,
            operatorName: operatorName,
            status: "request_failed",
            reason: code,
            ip: ip,
            userAgent: userAgent,
            platform: platform,
            language: language,
            screen: screen,
            requestedAt: new Date().toISOString(),
          })
        );
        sendErrorWithData(response, code, "所选供应商暂无可下载数据。", requestId, {
          dataset: dataset.id,
          supplier: normalizedSupplier,
          suppliers: meta.suppliers,
        });
        return;
      }

      const signed = createSignedToken(
        {
          dataset: dataset.id,
          supplier: supplierSelection || normalizedSupplier,
          operatorName: operatorName,
        },
        authConfig.jwtSecret,
        DEFAULT_EXPIRES_IN_SECONDS
      );
      const downloadUrl = getRequestBaseUrl(request) + FILE_PATH + "?token=" + encodeURIComponent(signed.token);
      appendProjectDownloadRuntimeLog("success", "request_success", requestId, {
        dataset: dataset.id,
        supplier: normalizedSupplier,
        operatorName,
        reason: "ok",
        message: "项目数据下载链接已生成",
      });

      auditStore.append(
        buildAuditPayload({
          requestId: requestId,
          jti: signed.payload.jti,
          dataset: dataset.id,
          supplier: normalizedSupplier,
          operatorName: operatorName,
          status: "request_success",
          reason: "ok",
          ip: ip,
          userAgent: userAgent,
          platform: platform,
          language: language,
          screen: screen,
          requestedAt: new Date().toISOString(),
          tokenExpiresAt: formatIsoTimeFromUnixSeconds(signed.payload.exp),
        })
      );

      sendJson(response, 200, {
        success: true,
        data: {
          downloadUrl: downloadUrl,
          expiresInSeconds: DEFAULT_EXPIRES_IN_SECONDS,
        },
        requestId: requestId,
      });
    } catch (error) {
      appendProjectDownloadRuntimeLog("error", "request_failed", requestId, {
        reason: "project-data-download-request-invalid",
        message: "项目数据下载失败：请求参数无效",
      });
      auditStore.append(
        buildAuditPayload({
          requestId: requestId,
          status: "request_failed",
          reason: "project-data-download-request-invalid",
          ip: ip,
          userAgent: normalizeText(getHeaderText(request.headers, "user-agent")),
          requestedAt: new Date().toISOString(),
        })
      );
      sendError(
        response,
        "project-data-download-request-invalid",
        error && error.message ? error.message : "请求参数无效。",
        requestId
      );
    }
  });

  function handleFileDownload(method, request, response, query) {
    const requestId = createRequestId();
    const ip = getClientIp(request);
    const authConfig = getAuthConfig();
    if (!authConfig.jwtSecret) {
      sendError(
        response,
        "project-data-download-auth-not-configured",
        "后端未配置项目数据下载鉴权环境变量。",
        requestId
      );
      return;
    }

    const token = normalizeTokenText(query?.token);
    const verified = verifySignedToken(token, authConfig.jwtSecret);
    if (!verified.ok) {
      appendProjectDownloadRuntimeLog("warn", "download_failed", requestId, {
        dataset: normalizeText(verified?.payload?.dataset),
        supplier: normalizeText(verified?.payload?.supplier),
        operatorName: normalizeText(verified?.payload?.operatorName),
        reason: verified.code,
        message: "项目数据下载失败：token 无效",
      });
      auditStore.append(
        buildAuditPayload({
          requestId: requestId,
          dataset: normalizeText(verified?.payload?.dataset),
          supplier: normalizeText(verified?.payload?.supplier),
          operatorName: normalizeText(verified?.payload?.operatorName),
          status: "download_failed",
          reason: verified.code,
          ip: ip,
          userAgent: normalizeText(getHeaderText(request.headers, "user-agent")),
          requestedAt: formatIsoTimeFromUnixSeconds(verified?.payload?.iat) || new Date().toISOString(),
          tokenExpiresAt: formatIsoTimeFromUnixSeconds(verified?.payload?.exp),
        })
      );
      sendErrorWithData(
        response,
        verified.code || "project-data-download-token-invalid",
        verified.message || "下载 token 无效。",
        requestId,
        {
          dataset: normalizeText(verified?.payload?.dataset),
          supplier: normalizeText(verified?.payload?.supplier),
        }
      );
      return;
    }

    const payload = verified.payload || {};
    const dataset = getDatasetById(datasets, payload.dataset);
    if (!dataset) {
      auditStore.append(
        buildAuditPayload({
          requestId: requestId,
          jti: normalizeText(payload.jti),
          dataset: normalizeText(payload.dataset),
          supplier: normalizeText(payload.supplier),
          operatorName: normalizeText(payload.operatorName),
          status: "download_failed",
          reason: "project-data-download-dataset-invalid",
          ip: ip,
          userAgent: normalizeText(getHeaderText(request.headers, "user-agent")),
          requestedAt: formatIsoTimeFromUnixSeconds(payload.iat),
          tokenExpiresAt: formatIsoTimeFromUnixSeconds(payload.exp),
        })
      );
      sendError(response, "project-data-download-dataset-invalid", "下载 token 中的数据类型无效。", requestId);
      return;
    }

    const meta = readDatasetCsvMeta(dataset);
    if (!meta.exists) {
      const code = "project-data-download-csv-not-found";
      auditStore.append(
        buildAuditPayload({
          requestId: requestId,
          jti: normalizeText(payload.jti),
          dataset: dataset.id,
          supplier: normalizeText(payload.supplier),
          operatorName: normalizeText(payload.operatorName),
          status: "download_failed",
          reason: code,
          ip: ip,
          userAgent: normalizeText(getHeaderText(request.headers, "user-agent")),
          requestedAt: formatIsoTimeFromUnixSeconds(payload.iat),
          tokenExpiresAt: formatIsoTimeFromUnixSeconds(payload.exp),
        })
      );
      sendError(response, code, "当前数据文件不存在，请先生成数据后再下载。", requestId);
      return;
    }

    const supplierSelection = normalizeText(payload.supplier);
    const supplier = normalizeRequestedSupplier(payload.supplier);
    if (meta.supplierRequired && !supplier && !isAllSuppliersSelection(supplierSelection)) {
      auditStore.append(
        buildAuditPayload({
          requestId: requestId,
          jti: normalizeText(payload.jti),
          dataset: dataset.id,
          supplier: supplier,
          operatorName: normalizeText(payload.operatorName),
          status: "download_failed",
          reason: "project-data-download-supplier-required",
          ip: ip,
          userAgent: normalizeText(getHeaderText(request.headers, "user-agent")),
          requestedAt: formatIsoTimeFromUnixSeconds(payload.iat),
          tokenExpiresAt: formatIsoTimeFromUnixSeconds(payload.exp),
        })
      );
      sendError(response, "project-data-download-supplier-required", "当前数据存在多个供应商，请先选择供应商。", requestId);
      return;
    }

    if (supplier && meta.suppliers.length > 0 && meta.suppliers.indexOf(supplier) < 0) {
      auditStore.append(
        buildAuditPayload({
          requestId: requestId,
          jti: normalizeText(payload.jti),
          dataset: dataset.id,
          supplier: supplier,
          operatorName: normalizeText(payload.operatorName),
          status: "download_failed",
          reason: "project-data-download-supplier-no-data",
          ip: ip,
          userAgent: normalizeText(getHeaderText(request.headers, "user-agent")),
          requestedAt: formatIsoTimeFromUnixSeconds(payload.iat),
          tokenExpiresAt: formatIsoTimeFromUnixSeconds(payload.exp),
        })
      );
      sendErrorWithData(response, "project-data-download-supplier-no-data", "所选供应商暂无可下载数据。", requestId, {
        dataset: dataset.id,
        supplier: supplier,
        suppliers: meta.suppliers,
      });
      return;
    }

    const filteredRows = supplier ? filterRowsBySupplier(meta, supplier) : meta.rows.slice();
    console.info(
      "[ProjectDataDownload][file]",
      JSON.stringify(
        {
          requestId: requestId,
          jti: normalizeText(payload.jti),
          dataset: dataset.id,
          supplier: supplier,
          supplierCount: meta.suppliers.length,
          filteredRowCount: filteredRows.length,
          csvExists: meta.exists,
        },
        null,
        0
      )
    );
    if (supplier && filteredRows.length <= 0) {
      auditStore.append(
        buildAuditPayload({
          requestId: requestId,
          jti: normalizeText(payload.jti),
          dataset: dataset.id,
          supplier: supplier,
          operatorName: normalizeText(payload.operatorName),
          status: "download_failed",
          reason: "project-data-download-supplier-no-data",
          ip: ip,
          userAgent: normalizeText(getHeaderText(request.headers, "user-agent")),
          requestedAt: formatIsoTimeFromUnixSeconds(payload.iat),
          tokenExpiresAt: formatIsoTimeFromUnixSeconds(payload.exp),
        })
      );
      sendErrorWithData(response, "project-data-download-supplier-no-data", "该供应商没有可下载数据。", requestId, {
        dataset: dataset.id,
        supplier: supplier,
        suppliers: meta.suppliers,
      });
      return;
    }

    const safeCsv = sanitizeParsedCsv(meta.headers, filteredRows);
    const csvText = stringifyCsv(safeCsv.headers, safeCsv.rows, true);
    const fileName = supplier
      ? appendSupplierSuffix(dataset.defaultFileName, supplier)
      : dataset.defaultFileName;
    const fileSize = Buffer.byteLength(csvText, "utf8");

    auditStore.append(
      buildAuditPayload({
        requestId: requestId,
        jti: normalizeText(payload.jti),
        dataset: dataset.id,
        supplier: supplier,
        operatorName: normalizeText(payload.operatorName),
        status: "download_success",
        reason: method === "HEAD" ? "head" : "ok",
        ip: ip,
        userAgent: normalizeText(getHeaderText(request.headers, "user-agent")),
        requestedAt: formatIsoTimeFromUnixSeconds(payload.iat),
        downloadedAt: new Date().toISOString(),
        tokenExpiresAt: formatIsoTimeFromUnixSeconds(payload.exp),
        fileName: fileName,
        fileSize: fileSize,
      })
    );
    appendProjectDownloadRuntimeLog("success", method === "HEAD" ? "download_head" : "download_success", requestId, {
      dataset: dataset.id,
      supplier,
      operatorName: normalizeText(payload.operatorName),
      reason: method === "HEAD" ? "head" : "ok",
      fileName,
      message: method === "HEAD" ? "项目数据下载 HEAD 校验成功" : "项目数据下载成功",
    });

    response.writeHead(200, createCsvHeaders(fileName, fileSize));
    if (method === "HEAD") {
      response.end();
      return;
    }
    response.end(csvText, "utf8");
  }

  router.get(FILE_PATH, function ({ request, response, query }) {
    handleFileDownload("GET", request, response, query);
  });

  router.head(FILE_PATH, function ({ request, response, query }) {
    handleFileDownload("HEAD", request, response, query);
  });
}

module.exports = {
  FILE_PATH,
  OPTIONS_PATH,
  REQUEST_PATH,
  listProjectDataDownloadDatasets,
  registerProjectDataDownloadRoutes,
};

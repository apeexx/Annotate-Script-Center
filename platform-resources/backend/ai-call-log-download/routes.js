"use strict";

const path = require("path");
const { authenticateAdminRequest, getAdminAuthConfig } = require("../admin-auth");
const { appendRuntimeLog } = require("../runtime-log-store");
const {
  buildHeaderLine,
  listLogFiles,
  readCsvObjects,
  toCsvLine,
} = require("../ai-call-log/csv-writer");
const { normalizeText } = require("../ai-call-log/sanitizer");
const { createCorsHeaders, sendJson } = require("../response");
const { createAuditStore } = require("../project-data-download/audit-store");
const {
  createSignedToken,
  verifySignedToken,
} = require("../project-data-download/jwt");

const { aiCallLogger: dataBakerLogger } = require("../../data-baker/round-one-quality/backend/ai-call-log");
const { aiCallLogger: aishellLogger } = require("../../aishell-tech/minnan-helper/data/ai-call-log");
const {
  aiCallLogger: aishellVietnameseLogger,
} = require("../../aishell-tech/vietnamese-helper/data/ai-call-log");
const {
  aiCallLogger: aishellThaiLogger,
} = require("../../aishell-tech/thai-helper/data/ai-call-log");
const {
  aiCallLogger: aishellCantoneseLogger,
} = require("../../aishell-tech/cantonese-helper/data/ai-call-log");
const { aiCallLogger: magicDataHakkaLogger } = require("../../magic-data/hakka-helper/backend/ai-call-log");
const { aiCallLogger: magicDataMinnanLogger } = require("../../magic-data/minnan-helper/backend/ai-call-log");
const { aiCallLogger: asrJudgementLogger } = require("../../alibaba-labelx/asr-judgement/backend/ai-call-log");
const { aiCallLogger: asrTranscriptionLogger } = require("../../alibaba-labelx/asr-transcription/backend/ai-call-log");
const { aiCallLogger: abakaTask21Logger } = require("../../abaka-ai/task21/backend/ai-call-log");

const OPTIONS_PATH = "/api/admin/ai-call-log/options";
const REQUEST_PATH = "/api/admin/ai-call-log/request";
const FILE_PATH = "/api/admin/ai-call-log/file";
const MAX_BODY_BYTES = 1024 * 1024;
const DEFAULT_EXPIRES_IN_SECONDS = 120;
const DATE_TEXT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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
    normalizeText(process.env.ASC_AI_CALL_LOG_DOWNLOAD_PASSWORD_SHA256) ||
    normalizeText(process.env.ASC_PROJECT_DATA_DOWNLOAD_PASSWORD_SHA256) ||
    normalizeText(process.env.ASC_DATA_DOWNLOAD_PASSWORD_SHA256);
  const jwtSecret =
    normalizeText(process.env.ASC_AI_CALL_LOG_DOWNLOAD_JWT_SECRET) ||
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
  return [
    {
      id: "data-baker-round-one-quality-ai",
      label: "DataBaker 一检 AI 调用记录",
      defaultFileName: "data-baker-round-one-quality-ai-calls.csv",
      getLogger: function () {
        return dataBakerLogger;
      },
    },
    {
      id: "aishell-tech-minnan-helper-ai",
      label: "Aishell Tech 闽南语助手 AI 调用记录",
      defaultFileName: "aishell-tech-minnan-helper-ai-calls.csv",
      getLogger: function () {
        return aishellLogger;
      },
    },
    {
      id: "aishell-tech-vietnamese-helper-ai",
      label: "Aishell Tech 越南语助手 AI 调用记录",
      defaultFileName: "aishell-tech-vietnamese-helper-ai-calls.csv",
      getLogger: function () {
        return aishellVietnameseLogger;
      },
    },
    {
      id: "aishell-tech-thai-helper-ai",
      label: "Aishell Tech 泰语助手 AI 调用记录",
      defaultFileName: "aishell-tech-thai-helper-ai-calls.csv",
      getLogger: function () {
        return aishellThaiLogger;
      },
    },
    {
      id: "aishell-tech-cantonese-helper-ai",
      label: "Aishell Tech 粤语助手 AI 调用记录",
      defaultFileName: "aishell-tech-cantonese-helper-ai-calls.csv",
      getLogger: function () {
        return aishellCantoneseLogger;
      },
    },
    {
      id: "magic-data-hakka-helper-ai",
      label: "Magic Data 客家话助手 AI 调用记录",
      defaultFileName: "magic-data-hakka-helper-ai-calls.csv",
      getLogger: function () {
        return magicDataHakkaLogger;
      },
    },
    {
      id: "magic-data-minnan-helper-ai",
      label: "Magic Data 闽南语助手 AI 调用记录",
      defaultFileName: "magic-data-minnan-helper-ai-calls.csv",
      getLogger: function () {
        return magicDataMinnanLogger;
      },
    },
    {
      id: "alibaba-labelx-asr-judgement-ai",
      label: "LabelX 快判 AI 调用记录",
      defaultFileName: "alibaba-labelx-asr-judgement-ai-calls.csv",
      getLogger: function () {
        return asrJudgementLogger;
      },
    },
    {
      id: "alibaba-labelx-asr-transcription-ai",
      label: "LabelX 转写 AI 调用记录",
      defaultFileName: "alibaba-labelx-asr-transcription-ai-calls.csv",
      getLogger: function () {
        return asrTranscriptionLogger;
      },
    },
    {
      id: "abaka-task21-ai",
      label: "Abaka Task21 AI 调用记录",
      defaultFileName: "abaka-task21-ai-calls.csv",
      getLogger: function () {
        return abakaTask21Logger;
      },
    },
  ];
}

function getDatasetById(datasets, datasetId) {
  const target = normalizeText(datasetId);
  return (datasets || []).find(function (item) {
    return normalizeText(item.id) === target;
  }) || null;
}

function normalizeDateText(value) {
  const text = normalizeText(value);
  return DATE_TEXT_PATTERN.test(text) ? text : "";
}

function extractDatePartFromFilePath(filePath) {
  const matched = /(\d{4}-\d{2}-\d{2})(?:-v\d+)?\.csv$/i.exec(path.basename(String(filePath || "")));
  return matched ? matched[1] : "";
}

function readDatasetLogMeta(dataset, range) {
  const logger = dataset?.getLogger ? dataset.getLogger() : null;
  const logDir = typeof logger?.getLogDir === "function" ? logger.getLogDir() : "";
  const filePrefix = normalizeText(logger?.filePrefix) || "ai-calls";
  const normalizedRange = range && typeof range === "object" ? range : {};
  const files = listLogFiles({
    logDir: logDir,
    filePrefix: filePrefix,
    from: normalizeDateText(normalizedRange.from),
    to: normalizeDateText(normalizedRange.to),
  });
  const dates = files
    .map(extractDatePartFromFilePath)
    .filter(Boolean)
    .sort();
  return {
    logger: logger,
    logDir: logDir,
    filePrefix: filePrefix,
    files: files,
    fileCount: files.length,
    hasData: files.length > 0,
    dateFrom: dates.length > 0 ? dates[0] : "",
    dateTo: dates.length > 0 ? dates[dates.length - 1] : "",
  };
}

function buildAiCallLogDatasetOption(dataset) {
  const meta = readDatasetLogMeta(dataset, {});
  return {
    id: dataset.id,
    label: dataset.label,
    visibility: normalizeText(dataset.visibility),
    hasData: meta.hasData,
    fileCount: meta.fileCount,
    dateFrom: meta.dateFrom,
    dateTo: meta.dateTo,
  };
}

function listAiCallLogDatasets(config) {
  return createDatasetRegistry(config).map(buildAiCallLogDatasetOption);
}

function toStatusCodeForCode(code) {
  if (code === "ai-call-log-download-auth-not-configured") {
    return 500;
  }
  if (
    code === "ai-call-log-download-password-invalid" ||
    code === "ai-call-log-download-token-missing" ||
    code === "ai-call-log-download-token-invalid" ||
    code === "ai-call-log-download-token-expired"
  ) {
    return 401;
  }
  if (code === "ai-call-log-download-empty") {
    return 404;
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
    operatorName: normalizeText(data.operatorName),
    status: normalizeText(data.status),
    reason: normalizeText(data.reason),
    ip: normalizeText(data.ip),
    userAgent: normalizeText(data.userAgent),
    platform: normalizeText(data.platform),
    language: normalizeText(data.language),
    screen: normalizeText(data.screen),
    dateFrom: normalizeDateText(data.dateFrom),
    dateTo: normalizeDateText(data.dateTo),
    requestedAt: normalizeText(data.requestedAt),
    downloadedAt: normalizeText(data.downloadedAt),
    tokenExpiresAt: normalizeText(data.tokenExpiresAt),
    fileName: normalizeText(data.fileName),
    fileSize: Number.isFinite(Number(data.fileSize)) ? Number(data.fileSize) : 0,
    rowCount: Number.isFinite(Number(data.rowCount)) ? Number(data.rowCount) : 0,
  };
}

function appendAiCallLogRuntimeLog(level, action, requestId, payload) {
  const data = payload && typeof payload === "object" ? payload : {};
  appendRuntimeLog({
    level: level,
    scope: "admin.ai_call_log_download",
    action: action,
    message: normalizeText(data.message) || "AI 调用日志事件",
    requestId,
    details: {
      dataset: normalizeText(data.dataset),
      operatorName: normalizeText(data.operatorName),
      dateFrom: normalizeDateText(data.dateFrom),
      dateTo: normalizeDateText(data.dateTo),
      reason: normalizeText(data.reason),
      fileName: normalizeText(data.fileName),
    },
  });
}

function validateDateRange(dateFrom, dateTo) {
  if (dateFrom && !DATE_TEXT_PATTERN.test(dateFrom)) {
    return {
      ok: false,
      code: "ai-call-log-download-date-invalid",
      message: "开始日期格式无效。",
    };
  }
  if (dateTo && !DATE_TEXT_PATTERN.test(dateTo)) {
    return {
      ok: false,
      code: "ai-call-log-download-date-invalid",
      message: "结束日期格式无效。",
    };
  }
  if (dateFrom && dateTo && dateFrom > dateTo) {
    return {
      ok: false,
      code: "ai-call-log-download-date-range-invalid",
      message: "开始日期不能晚于结束日期。",
    };
  }
  return {
    ok: true,
    from: dateFrom,
    to: dateTo,
  };
}

function buildClientInfo(request, clientInfo) {
  const source = clientInfo && typeof clientInfo === "object" ? clientInfo : {};
  return {
    userAgent: normalizeText(source.userAgent || getHeaderText(request.headers, "user-agent")),
    platform: normalizeText(source.platform),
    language: normalizeText(source.language),
    screen: normalizeText(source.screen),
  };
}

function buildExportFileName(defaultFileName, dateFrom, dateTo) {
  const baseName = normalizeText(defaultFileName) || "ai-call-log-export.csv";
  if (!dateFrom && !dateTo) {
    return baseName;
  }
  const suffix = dateFrom && dateTo
    ? dateFrom + "_to_" + dateTo
    : dateFrom
      ? "from_" + dateFrom
      : "to_" + dateTo;
  const dotIndex = baseName.lastIndexOf(".");
  if (dotIndex <= 0) {
    return baseName + "-" + suffix;
  }
  return baseName.slice(0, dotIndex) + "-" + suffix + baseName.slice(dotIndex);
}

function createCsvBody(logger, files) {
  const schema = Array.isArray(logger?.schema) ? logger.schema : [];
  const rows = [];
  files.forEach(function appendRows(filePath) {
    readCsvObjects(filePath, schema).forEach(function appendRow(row) {
      rows.push(row);
    });
  });
  if (rows.length <= 0) {
    return {
      csvText: "",
      rowCount: 0,
    };
  }
  let csvText = "\uFEFF" + buildHeaderLine(schema);
  rows.forEach(function writeRow(row) {
    csvText += toCsvLine(schema, row);
  });
  return {
    csvText: csvText,
    rowCount: rows.length,
  };
}

function createCsvHeaders(fileName, fileSize) {
  const safeFileName = normalizeText(fileName).replace(/"/g, "") || "ai-call-log-export.csv";
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

function registerAiCallLogDownloadRoutes(router, options) {
  const config = options && typeof options === "object" ? options : {};
  const datasets = createDatasetRegistry(config);
  const auditStore = createAuditStore({
    dataDir:
      normalizeText(config.auditDataDir) ||
      path.join(__dirname, "..", "audit-data", "ai-call-log-download"),
    fileName: "ai-call-log-download-audit.jsonl",
  });
  auditStore.ensureDataDir();

  router.get(OPTIONS_PATH, function ({ response }) {
    const result = datasets.map(buildAiCallLogDatasetOption);
    sendJson(response, 200, {
      success: true,
      data: result,
    });
  });

  router.post(REQUEST_PATH, async function ({ request, response }) {
    const requestId = createRequestId();
    const ip = getClientIp(request);
    try {
      const body = JSON.parse((await readRequestBody(request)) || "{}");
      const datasetId = normalizeText(body?.dataset);
      const operatorName = normalizeText(body?.operatorName);
      const password = String(body?.password || "");
      const rawDateFrom = normalizeText(body?.dateFrom);
      const rawDateTo = normalizeText(body?.dateTo);
      const clientInfo = buildClientInfo(request, body?.clientInfo);
      const dataset = getDatasetById(datasets, datasetId);
      if (!dataset) {
        const code = "ai-call-log-download-dataset-invalid";
        appendAiCallLogRuntimeLog("warn", "request_failed", requestId, {
          dataset: datasetId,
          operatorName,
          dateFrom: rawDateFrom,
          dateTo: rawDateTo,
          reason: code,
          message: "AI 调用日志导出失败：脚本类型无效",
        });
        auditStore.append(
          buildAuditPayload({
            requestId: requestId,
            dataset: datasetId,
            operatorName: operatorName,
            status: "request_failed",
            reason: code,
            ip: ip,
            userAgent: clientInfo.userAgent,
            platform: clientInfo.platform,
            language: clientInfo.language,
            screen: clientInfo.screen,
            dateFrom: rawDateFrom,
            dateTo: rawDateTo,
            requestedAt: new Date().toISOString(),
          })
        );
        sendError(response, code, "脚本类型无效。", requestId);
        return;
      }
      if (!operatorName) {
        const code = "ai-call-log-download-operator-name-required";
        appendAiCallLogRuntimeLog("warn", "request_failed", requestId, {
          dataset: dataset.id,
          operatorName,
          dateFrom: rawDateFrom,
          dateTo: rawDateTo,
          reason: code,
          message: "AI 调用日志导出失败：未填写获取人姓名",
        });
        auditStore.append(
          buildAuditPayload({
            requestId: requestId,
            dataset: dataset.id,
            operatorName: operatorName,
            status: "request_failed",
            reason: code,
            ip: ip,
            userAgent: clientInfo.userAgent,
            platform: clientInfo.platform,
            language: clientInfo.language,
            screen: clientInfo.screen,
            dateFrom: rawDateFrom,
            dateTo: rawDateTo,
            requestedAt: new Date().toISOString(),
          })
        );
        sendError(response, code, "请先填写获取人姓名。", requestId);
        return;
      }

      const validatedDateRange = validateDateRange(rawDateFrom, rawDateTo);
      if (!validatedDateRange.ok) {
        auditStore.append(
          buildAuditPayload({
            requestId: requestId,
            dataset: dataset.id,
            operatorName: operatorName,
            status: "request_failed",
            reason: validatedDateRange.code,
            ip: ip,
            userAgent: clientInfo.userAgent,
            platform: clientInfo.platform,
            language: clientInfo.language,
            screen: clientInfo.screen,
            dateFrom: rawDateFrom,
            dateTo: rawDateTo,
            requestedAt: new Date().toISOString(),
          })
        );
        sendError(response, validatedDateRange.code, validatedDateRange.message, requestId);
        return;
      }

      const authConfig = getAuthConfig();
      if (!authConfig.passwordSha256 || !authConfig.jwtSecret) {
        const code = "ai-call-log-download-auth-not-configured";
        appendAiCallLogRuntimeLog("error", "request_failed", requestId, {
          dataset: dataset.id,
          operatorName,
          dateFrom: validatedDateRange.from,
          dateTo: validatedDateRange.to,
          reason: code,
          message: "AI 调用日志导出失败：后端未配置下载鉴权",
        });
        auditStore.append(
          buildAuditPayload({
            requestId: requestId,
            dataset: dataset.id,
            operatorName: operatorName,
            status: "request_failed",
            reason: code,
            ip: ip,
            userAgent: clientInfo.userAgent,
            platform: clientInfo.platform,
            language: clientInfo.language,
            screen: clientInfo.screen,
            dateFrom: validatedDateRange.from,
            dateTo: validatedDateRange.to,
            requestedAt: new Date().toISOString(),
          })
        );
        sendError(response, code, "后端未配置 AI 请求记录下载鉴权环境变量。", requestId);
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
            ? "ai-call-log-download-auth-not-configured"
            : authResult.code === "admin-auth-password-invalid"
              ? "ai-call-log-download-password-invalid"
              : authResult.code === "admin-auth-missing"
                ? "ai-call-log-download-token-missing"
                : authResult.code === "admin-session-token-expired"
                  ? "ai-call-log-download-token-expired"
                  : "ai-call-log-download-token-invalid";
        appendAiCallLogRuntimeLog("warn", "request_failed", requestId, {
          dataset: dataset.id,
          operatorName,
          dateFrom: validatedDateRange.from,
          dateTo: validatedDateRange.to,
          reason: code,
          message: "AI 调用日志导出失败：管理员鉴权未通过",
        });
        auditStore.append(
          buildAuditPayload({
            requestId: requestId,
            dataset: dataset.id,
            operatorName: operatorName,
            status: "request_failed",
            reason: code,
            ip: ip,
            userAgent: clientInfo.userAgent,
            platform: clientInfo.platform,
            language: clientInfo.language,
            screen: clientInfo.screen,
            dateFrom: validatedDateRange.from,
            dateTo: validatedDateRange.to,
            requestedAt: new Date().toISOString(),
          })
        );
        sendError(
          response,
          code,
          code === "ai-call-log-download-password-invalid"
            ? "下载密码错误。"
            : authResult.message || "管理员会话无效。",
          requestId
        );
        return;
      }

      const meta = readDatasetLogMeta(dataset, validatedDateRange);
      if (!meta.hasData) {
        const code = "ai-call-log-download-empty";
        auditStore.append(
          buildAuditPayload({
            requestId: requestId,
            dataset: dataset.id,
            operatorName: operatorName,
            status: "request_failed",
            reason: code,
            ip: ip,
            userAgent: clientInfo.userAgent,
            platform: clientInfo.platform,
            language: clientInfo.language,
            screen: clientInfo.screen,
            dateFrom: validatedDateRange.from,
            dateTo: validatedDateRange.to,
            requestedAt: new Date().toISOString(),
          })
        );
        sendError(response, code, "当前筛选范围内没有 AI 请求记录。", requestId);
        return;
      }

      const signed = createSignedToken(
        {
          dataset: dataset.id,
          operatorName: operatorName,
          dateFrom: validatedDateRange.from,
          dateTo: validatedDateRange.to,
        },
        authConfig.jwtSecret,
        DEFAULT_EXPIRES_IN_SECONDS
      );
      const downloadUrl = getRequestBaseUrl(request) + FILE_PATH + "?token=" + encodeURIComponent(signed.token);
      appendAiCallLogRuntimeLog("success", "request_success", requestId, {
        dataset: dataset.id,
        operatorName,
        dateFrom: validatedDateRange.from,
        dateTo: validatedDateRange.to,
        reason: "ok",
        message: "AI 调用日志导出链接已生成",
      });

      auditStore.append(
        buildAuditPayload({
          requestId: requestId,
          jti: signed.payload.jti,
          dataset: dataset.id,
          operatorName: operatorName,
          status: "request_success",
          reason: "ok",
          ip: ip,
          userAgent: clientInfo.userAgent,
          platform: clientInfo.platform,
          language: clientInfo.language,
          screen: clientInfo.screen,
          dateFrom: validatedDateRange.from,
          dateTo: validatedDateRange.to,
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
      appendAiCallLogRuntimeLog("error", "request_failed", requestId, {
        reason: "ai-call-log-download-request-invalid",
        message: "AI 调用日志导出失败：请求参数无效",
      });
      auditStore.append(
        buildAuditPayload({
          requestId: requestId,
          status: "request_failed",
          reason: "ai-call-log-download-request-invalid",
          ip: ip,
          userAgent: normalizeText(getHeaderText(request.headers, "user-agent")),
          requestedAt: new Date().toISOString(),
        })
      );
      sendError(
        response,
        "ai-call-log-download-request-invalid",
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
        "ai-call-log-download-auth-not-configured",
        "后端未配置 AI 请求记录下载鉴权环境变量。",
        requestId
      );
      return;
    }

    const verified = verifySignedToken(
      normalizeText(query?.token),
      authConfig.jwtSecret,
      {
        errorPrefix: "ai-call-log-download",
      }
    );
    if (!verified.ok) {
      appendAiCallLogRuntimeLog("warn", "download_failed", requestId, {
        dataset: normalizeText(verified?.payload?.dataset),
        operatorName: normalizeText(verified?.payload?.operatorName),
        dateFrom: normalizeDateText(verified?.payload?.dateFrom),
        dateTo: normalizeDateText(verified?.payload?.dateTo),
        reason: verified.code,
        message: "AI 调用日志导出失败：token 无效",
      });
      auditStore.append(
        buildAuditPayload({
          requestId: requestId,
          dataset: normalizeText(verified?.payload?.dataset),
          operatorName: normalizeText(verified?.payload?.operatorName),
          status: "download_failed",
          reason: verified.code,
          ip: ip,
          userAgent: normalizeText(getHeaderText(request.headers, "user-agent")),
          dateFrom: normalizeDateText(verified?.payload?.dateFrom),
          dateTo: normalizeDateText(verified?.payload?.dateTo),
          requestedAt: formatIsoTimeFromUnixSeconds(verified?.payload?.iat) || new Date().toISOString(),
          tokenExpiresAt: formatIsoTimeFromUnixSeconds(verified?.payload?.exp),
        })
      );
      sendError(
        response,
        verified.code || "ai-call-log-download-token-invalid",
        verified.message || "下载 token 无效。",
        requestId
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
          operatorName: normalizeText(payload.operatorName),
          status: "download_failed",
          reason: "ai-call-log-download-dataset-invalid",
          ip: ip,
          userAgent: normalizeText(getHeaderText(request.headers, "user-agent")),
          dateFrom: normalizeDateText(payload.dateFrom),
          dateTo: normalizeDateText(payload.dateTo),
          requestedAt: formatIsoTimeFromUnixSeconds(payload.iat),
          tokenExpiresAt: formatIsoTimeFromUnixSeconds(payload.exp),
        })
      );
      sendError(response, "ai-call-log-download-dataset-invalid", "下载 token 中的脚本类型无效。", requestId);
      return;
    }

    const validatedDateRange = validateDateRange(
      normalizeDateText(payload.dateFrom),
      normalizeDateText(payload.dateTo)
    );
    const meta = readDatasetLogMeta(dataset, validatedDateRange.ok ? validatedDateRange : {});
    if (!meta.hasData) {
      const code = "ai-call-log-download-empty";
      auditStore.append(
        buildAuditPayload({
          requestId: requestId,
          jti: normalizeText(payload.jti),
          dataset: dataset.id,
          operatorName: normalizeText(payload.operatorName),
          status: "download_failed",
          reason: code,
          ip: ip,
          userAgent: normalizeText(getHeaderText(request.headers, "user-agent")),
          dateFrom: normalizeDateText(payload.dateFrom),
          dateTo: normalizeDateText(payload.dateTo),
          requestedAt: formatIsoTimeFromUnixSeconds(payload.iat),
          tokenExpiresAt: formatIsoTimeFromUnixSeconds(payload.exp),
        })
      );
      sendError(response, code, "当前筛选范围内没有 AI 请求记录。", requestId);
      return;
    }

    const exported = createCsvBody(meta.logger, meta.files);
    if (exported.rowCount <= 0) {
      const code = "ai-call-log-download-empty";
      auditStore.append(
        buildAuditPayload({
          requestId: requestId,
          jti: normalizeText(payload.jti),
          dataset: dataset.id,
          operatorName: normalizeText(payload.operatorName),
          status: "download_failed",
          reason: code,
          ip: ip,
          userAgent: normalizeText(getHeaderText(request.headers, "user-agent")),
          dateFrom: normalizeDateText(payload.dateFrom),
          dateTo: normalizeDateText(payload.dateTo),
          requestedAt: formatIsoTimeFromUnixSeconds(payload.iat),
          tokenExpiresAt: formatIsoTimeFromUnixSeconds(payload.exp),
        })
      );
      sendError(response, code, "当前筛选范围内没有 AI 请求记录。", requestId);
      return;
    }

    const fileName = buildExportFileName(
      dataset.defaultFileName,
      normalizeDateText(payload.dateFrom),
      normalizeDateText(payload.dateTo)
    );
    const fileSize = Buffer.byteLength(exported.csvText, "utf8");

    auditStore.append(
      buildAuditPayload({
        requestId: requestId,
        jti: normalizeText(payload.jti),
        dataset: dataset.id,
        operatorName: normalizeText(payload.operatorName),
        status: "download_success",
        reason: method === "HEAD" ? "head" : "ok",
        ip: ip,
        userAgent: normalizeText(getHeaderText(request.headers, "user-agent")),
        dateFrom: normalizeDateText(payload.dateFrom),
        dateTo: normalizeDateText(payload.dateTo),
        requestedAt: formatIsoTimeFromUnixSeconds(payload.iat),
        downloadedAt: new Date().toISOString(),
        tokenExpiresAt: formatIsoTimeFromUnixSeconds(payload.exp),
        fileName: fileName,
        fileSize: fileSize,
        rowCount: exported.rowCount,
      })
    );
    appendAiCallLogRuntimeLog("success", method === "HEAD" ? "download_head" : "download_success", requestId, {
      dataset: dataset.id,
      operatorName: normalizeText(payload.operatorName),
      dateFrom: normalizeDateText(payload.dateFrom),
      dateTo: normalizeDateText(payload.dateTo),
      reason: method === "HEAD" ? "head" : "ok",
      fileName,
      message: method === "HEAD" ? "AI 调用日志 HEAD 校验成功" : "AI 调用日志导出成功",
    });

    response.writeHead(200, createCsvHeaders(fileName, fileSize));
    if (method === "HEAD") {
      response.end();
      return;
    }
    response.end(exported.csvText, "utf8");
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
  listAiCallLogDatasets,
  registerAiCallLogDownloadRoutes,
};

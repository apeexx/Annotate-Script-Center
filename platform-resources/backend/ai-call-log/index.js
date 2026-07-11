"use strict";

const {
  appendCsvRow,
  listLogFiles,
  readCsvObjects,
} = require("./csv-writer");
const { createAiCallLogSchema } = require("./schema");
const {
  assertAiUsageOperatorName,
  buildErrorSnapshot,
  coerceBooleanCell,
  normalizeText,
  parseBooleanCell,
  pickUsageCells,
  resolveDurationMs,
  safeJsonStringify,
} = require("./sanitizer");

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeConfig(config) {
  const source = config && typeof config === "object" ? config : {};
  return {
    logDir: normalizeText(source.logDir, 400),
    filePrefix: normalizeText(source.filePrefix, 80) || "ai-calls",
    platformId: normalizeText(source.platformId, 80),
    scriptId: normalizeText(source.scriptId, 120),
    extraColumns: Array.isArray(source.extraColumns) ? source.extraColumns : [],
    buildExtendedRow:
      typeof source.buildExtendedRow === "function" ? source.buildExtendedRow : null,
    pickRawResponse:
      typeof source.pickRawResponse === "function" ? source.pickRawResponse : null,
    pickRawError: typeof source.pickRawError === "function" ? source.pickRawError : null,
  };
}

function pickRequestActors(context) {
  const rawBody = isPlainObject(context?.rawBody) ? context.rawBody : {};
  const normalizedRequest = isPlainObject(context?.normalizedRequest)
    ? context.normalizedRequest
    : {};
  const input = isPlainObject(normalizedRequest.input) ? normalizedRequest.input : {};
  const runtimeContext = isPlainObject(normalizedRequest.runtimeContext)
    ? normalizedRequest.runtimeContext
    : {};

  return {
    aiUsageOperatorName: normalizeText(
      rawBody.aiUsageOperatorName || input.aiUsageOperatorName || runtimeContext.aiUsageOperatorName,
      40
    ),
    platformUserName: normalizeText(
      rawBody.platformUserName || input.platformUserName || runtimeContext.platformUserName,
      80
    ),
    platformUserId: normalizeText(
      rawBody.platformUserId || input.platformUserId || runtimeContext.platformUserId,
      120
    ),
  };
}

function pickEnvelopeValue() {
  for (let index = 0; index < arguments.length; index += 1) {
    const candidate = arguments[index];
    if (isPlainObject(candidate)) {
      return candidate;
    }
  }
  return {};
}

function pickResultMeta(context) {
  const result = isPlainObject(context?.result) ? context.result : {};
  const error = isPlainObject(context?.error) ? context.error : null;
  const execution = isPlainObject(context?.execution) ? context.execution : {};
  const resultMeta = pickEnvelopeValue(result.meta);
  const errorMeta = error ? pickEnvelopeValue(error.meta) : {};
  const finalMeta = error ? errorMeta : resultMeta;

  return {
    result,
    error,
    execution,
    resultMeta,
    errorMeta,
    finalMeta,
    usage: pickEnvelopeValue(
      finalMeta.usage,
      execution.usage,
      result.usage,
      execution.projectResult?.usage,
      execution.postProcessedResult?.usage,
      execution.pipelineResult?.usage
    ),
    timing: pickEnvelopeValue(
      finalMeta.timing,
      execution.timing,
      result.timing,
      execution.projectResult?.timing,
      execution.postProcessedResult?.timing,
      execution.pipelineResult?.timing
    ),
    models: pickEnvelopeValue(
      finalMeta.models,
      execution.models,
      result.models,
      execution.projectResult?.models,
      execution.postProcessedResult?.models,
      execution.pipelineResult?.models
    ),
  };
}

function buildBaseRow(config, context) {
  const source = context && typeof context === "object" ? context : {};
  const normalizedRequest = isPlainObject(source.normalizedRequest)
    ? source.normalizedRequest
    : {};
  const requestId = normalizeText(
    source.requestId ||
      normalizedRequest.requestId ||
      source.error?.requestId ||
      source.result?.requestId,
    120
  );
  const createdAt = normalizeText(source.createdAt || new Date().toISOString(), 80);
  const actors = pickRequestActors(source);
  const resolved = pickResultMeta(source);
  const usageCells = pickUsageCells(resolved.usage);
  const errorMessage = resolved.error
    ? normalizeText(
        resolved.error.safeMessage ||
          resolved.error.message ||
          resolved.error.summary ||
          "AI 调用失败。",
        500
      )
    : "";
  const rawResponseSource = config.pickRawResponse
    ? config.pickRawResponse(source)
    : resolved.result && Object.keys(resolved.result).length > 0
      ? resolved.result
      : resolved.execution.projectResult ||
        resolved.execution.postProcessedResult ||
        resolved.execution.pipelineResult ||
        null;
  const rawErrorSource = config.pickRawError
    ? config.pickRawError(source)
    : buildErrorSnapshot(resolved.error, requestId);

  return {
    createdAt,
    requestId,
    platformId: normalizeText(
      config.platformId || normalizedRequest.platform || source.platformId,
      80
    ),
    scriptId: normalizeText(
      config.scriptId || normalizedRequest.scriptId || source.scriptId,
      120
    ),
    success: coerceBooleanCell(!resolved.error),
    errorCode: resolved.error ? normalizeText(resolved.error.code, 120) : "",
    errorMessage,
    durationMs: resolveDurationMs(
      source.durationMs,
      resolved.timing,
      resolved.finalMeta,
      resolved.error
    ),
    promptTokens: usageCells.promptTokens,
    completionTokens: usageCells.completionTokens,
    totalTokens: usageCells.totalTokens,
    aiUsageOperatorName: actors.aiUsageOperatorName,
    platformUserName: actors.platformUserName,
    platformUserId: actors.platformUserId,
    rawResponseJson: resolved.error ? "" : safeJsonStringify(rawResponseSource),
    rawErrorJson: resolved.error ? safeJsonStringify(rawErrorSource) : "",
  };
}

function mapSchemaRow(schema, row) {
  const result = {};
  schema.forEach(function assignColumn(column) {
    result[column.key] = row[column.key] === undefined || row[column.key] === null ? "" : String(row[column.key]);
  });
  return result;
}

function normalizeSummaryQuery(query) {
  const source = query && typeof query === "object" ? query : {};
  return {
    from: normalizeText(source.from || source.dateFrom, 20),
    to: normalizeText(source.to || source.dateTo, 20),
  };
}

function createSummaryBucket(seed) {
  return Object.assign(
    {
      totalCalls: 0,
      successCalls: 0,
      failedCalls: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    },
    seed || {}
  );
}

function addRowToBucket(bucket, row) {
  const target = bucket;
  const promptTokens = Number(row.promptTokens || 0) || 0;
  const completionTokens = Number(row.completionTokens || 0) || 0;
  const fallbackTotalTokens = Number(row.totalTokens || 0) || 0;
  const effectiveTotal = promptTokens || completionTokens ? promptTokens + completionTokens : fallbackTotalTokens;

  target.totalCalls += 1;
  if (parseBooleanCell(row.success)) {
    target.successCalls += 1;
  } else {
    target.failedCalls += 1;
  }
  target.promptTokens += promptTokens;
  target.completionTokens += completionTokens;
  target.totalTokens += effectiveTotal;
}

function mapBucketList(sourceMap, keyName) {
  return Array.from(sourceMap.values())
    .sort(function sortBuckets(left, right) {
      if (left.totalCalls !== right.totalCalls) {
        return right.totalCalls - left.totalCalls;
      }
      return String(left[keyName] || "").localeCompare(String(right[keyName] || ""));
    })
    .map(function cloneBucket(bucket) {
      return Object.assign({}, bucket);
    });
}

function createAiCallLogger(config) {
  const normalizedConfig = normalizeConfig(config);
  const schema = createAiCallLogSchema({
    extraColumns: normalizedConfig.extraColumns,
  });

  function buildExtendedRow(context) {
    if (!normalizedConfig.buildExtendedRow) {
      return {};
    }
    const row = normalizedConfig.buildExtendedRow(context);
    return isPlainObject(row) ? row : {};
  }

  function buildRow(context) {
    const baseRow = buildBaseRow(normalizedConfig, context);
    const extendedRow = buildExtendedRow(context);
    return mapSchemaRow(schema, Object.assign({}, baseRow, extendedRow));
  }

  function append(context) {
    const row = buildRow(context);
    return appendCsvRow({
      logDir: normalizedConfig.logDir,
      filePrefix: normalizedConfig.filePrefix,
      schema,
      row,
    });
  }

  function appendSafe(context) {
    try {
      return append(context);
    } catch (error) {
      console.warn("[ai-call-log] append failed:", error?.message || error);
      return null;
    }
  }

  function summarize(query) {
    const normalizedQuery = normalizeSummaryQuery(query);
    const files = listLogFiles({
      logDir: normalizedConfig.logDir,
      filePrefix: normalizedConfig.filePrefix,
      from: normalizedQuery.from,
      to: normalizedQuery.to,
    });

    const totals = createSummaryBucket();
    const byDate = new Map();
    const byOperator = new Map();
    const byErrorCode = new Map();

    files.forEach(function readFile(filePath) {
      const rows = readCsvObjects(filePath, schema);
      rows.forEach(function consumeRow(row) {
        addRowToBucket(totals, row);

        const dateKey = normalizeText(row.createdAt, 10).slice(0, 10) || "unknown";
        if (!byDate.has(dateKey)) {
          byDate.set(dateKey, createSummaryBucket({ date: dateKey }));
        }
        addRowToBucket(byDate.get(dateKey), row);

        const operatorKey = normalizeText(row.aiUsageOperatorName, 40) || "<empty>";
        if (!byOperator.has(operatorKey)) {
          byOperator.set(
            operatorKey,
            createSummaryBucket({
              aiUsageOperatorName: operatorKey,
            })
          );
        }
        addRowToBucket(byOperator.get(operatorKey), row);

        const errorCode = normalizeText(row.errorCode, 120);
        if (errorCode) {
          if (!byErrorCode.has(errorCode)) {
            byErrorCode.set(
              errorCode,
              {
                errorCode,
                totalCalls: 0,
              }
            );
          }
          byErrorCode.get(errorCode).totalCalls += 1;
        }
      });
    });

    return {
      logDir: normalizedConfig.logDir,
      filePrefix: normalizedConfig.filePrefix,
      fileCount: files.length,
      totals,
      byDate: mapBucketList(byDate, "date"),
      byOperator: mapBucketList(byOperator, "aiUsageOperatorName"),
      byErrorCode: Array.from(byErrorCode.values()).sort(function sortErrors(left, right) {
        if (left.totalCalls !== right.totalCalls) {
          return right.totalCalls - left.totalCalls;
        }
        return left.errorCode.localeCompare(right.errorCode);
      }),
    };
  }

  return {
    append,
    appendSafe,
    buildRow,
    filePrefix: normalizedConfig.filePrefix,
    getLogDir() {
      return normalizedConfig.logDir;
    },
    schema,
    summarize,
  };
}

function buildAiCallLogSummaryPayload(options) {
  const source = options && typeof options === "object" ? options : {};
  const logger = source.logger;
  return {
    success: true,
    service: normalizeText(source.service, 160),
    scriptId: normalizeText(source.scriptId, 120),
    callLogDir: typeof logger?.getLogDir === "function" ? logger.getLogDir() : "",
    stats:
      logger && typeof logger.summarize === "function"
        ? logger.summarize(source.query || {})
        : {
            logDir: "",
            filePrefix: "ai-calls",
            fileCount: 0,
            totals: createSummaryBucket(),
            byDate: [],
            byOperator: [],
            byErrorCode: [],
          },
  };
}

module.exports = {
  assertAiUsageOperatorName,
  buildAiCallLogSummaryPayload,
  createAiCallLogger,
};

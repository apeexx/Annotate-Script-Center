"use strict";

const { sendJson } = require("../../response");
const {
  assertAiUsageOperatorName,
} = require("../../ai-call-log");
const {
  createNormalizedRequest,
  createRequestId,
} = require("../contracts/normalized-request");
const {
  createNormalizedResponse,
} = require("../contracts/normalized-response");
const { loadProjectAssets } = require("../loaders/project-assets");
const {
  executeProjectPipeline,
} = require("../runtime/execute-project-pipeline");
const {
  createErrorBody,
  createHttpError,
  readRequestBody,
} = require("./create-ai-route");
const {
  sharedAiJobStore,
} = require("../runtime/ai-job-store");

function normalizeString(value) {
  return String(value || "").trim();
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeAdapterPayload(payload) {
  if (!isPlainObject(payload)) {
    return {
      input: {},
      projectOptions: {},
      debugOptions: {},
      runtimeContext: {},
    };
  }

  if (
    Object.prototype.hasOwnProperty.call(payload, "input") ||
    Object.prototype.hasOwnProperty.call(payload, "projectOptions") ||
    Object.prototype.hasOwnProperty.call(payload, "debugOptions") ||
    Object.prototype.hasOwnProperty.call(payload, "runtimeContext")
  ) {
    return {
      input: isPlainObject(payload.input) ? payload.input : {},
      projectOptions: isPlainObject(payload.projectOptions) ? payload.projectOptions : {},
      debugOptions: isPlainObject(payload.debugOptions) ? payload.debugOptions : {},
      runtimeContext: isPlainObject(payload.runtimeContext) ? payload.runtimeContext : {},
    };
  }

  return {
    input: payload,
    projectOptions: {},
    debugOptions: {},
    runtimeContext: {},
  };
}

function extractJobMeta(parsedBody, normalizedRequest) {
  return {
    itemId: normalizeString(
      parsedBody?.itemId ||
        parsedBody?.taskItemId ||
        parsedBody?.samplingRecordId ||
        normalizedRequest?.input?.itemId ||
        normalizedRequest?.input?.taskItemId
    ),
    textId: normalizeString(
      parsedBody?.textId ||
        parsedBody?.collectId ||
        parsedBody?.taskId ||
        normalizedRequest?.input?.textId
    ),
  };
}

function extractDebugPayload(error, errorBody) {
  const payload = {};
  if (isPlainObject(error?.rawAiDebug)) {
    payload.rawAiDebug = error.rawAiDebug;
  } else if (isPlainObject(errorBody?.rawAiDebug)) {
    payload.rawAiDebug = errorBody.rawAiDebug;
  }
  if (isPlainObject(error?.debugRawJson)) {
    payload.debugRawJson = error.debugRawJson;
  } else if (isPlainObject(errorBody?.debugRawJson)) {
    payload.debugRawJson = errorBody.debugRawJson;
  }
  return Object.keys(payload).length > 0 ? payload : null;
}

async function executeAiRequest(adapter, runtimeOptions, routeContext, parsedBody, requestId, jobContext) {
  const source = adapter && typeof adapter === "object" ? adapter : {};
  const context = routeContext && typeof routeContext === "object" ? routeContext : {};
  const normalizedAdapterPayload = normalizeAdapterPayload(
    typeof source.normalizeInput === "function"
      ? await source.normalizeInput(parsedBody, context)
      : parsedBody
  );

  const normalizedRequest = createNormalizedRequest({
    requestId,
    platform: source.platform,
    scriptId: source.scriptId,
    routeKey: source.routeKey || context.pathname,
    input: normalizedAdapterPayload.input,
    projectOptions: normalizedAdapterPayload.projectOptions,
    debugOptions: normalizedAdapterPayload.debugOptions,
    runtimeContext: Object.assign({}, normalizedAdapterPayload.runtimeContext, {
      pathname: normalizeString(context.pathname),
      query: isPlainObject(context.query) ? context.query : {},
      params: isPlainObject(context.params) ? context.params : {},
      signal: jobContext?.signal || null,
      jobId: normalizeString(jobContext?.jobId),
    }),
  });

  const assets = loadProjectAssets(source, runtimeOptions.assetLoaderOptions || {});
  const runner = typeof runtimeOptions.run === "function" ? runtimeOptions.run : source.run;
  const execution = await executeProjectPipeline({
    adapter: source,
    normalizedRequest,
    assets,
    runtimeContext: {
      routeContext: context,
      rawBody: parsedBody,
      signal: jobContext?.signal || null,
      jobId: normalizeString(jobContext?.jobId),
    },
    runner,
  });

  if (source.aiCallLogger && typeof source.aiCallLogger.appendSafe === "function") {
    source.aiCallLogger.appendSafe({
      createdAt: new Date().toISOString(),
      requestId: normalizedRequest.requestId,
      rawBody: parsedBody,
      normalizedRequest,
      execution,
    });
  }

  const successBody =
    typeof runtimeOptions.createSuccessBody === "function"
      ? runtimeOptions.createSuccessBody({
          adapter: source,
          routeContext: context,
          parsedBody,
          normalizedRequest,
          assets,
          execution,
        })
      : createNormalizedResponse({
          success: true,
          requestId: normalizedRequest.requestId,
          platform: normalizedRequest.platform,
          scriptId: normalizedRequest.scriptId,
          routeKey: normalizedRequest.routeKey,
          models: execution.models,
          usage: execution.usage,
          timing: execution.timing,
          cache: execution.cache,
          debug: execution.debug,
          notes: execution.notes,
          projectResult: execution.projectResult,
        });

  return {
    parsedBody,
    normalizedRequest,
    execution,
    successBody,
  };
}

function buildJobStatusBody(job) {
  const source = job && typeof job === "object" ? job : {};
  return {
    success: true,
    jobId: normalizeString(source.jobId),
    requestId: normalizeString(source.requestId),
    routeKey: normalizeString(source.routeKey),
    status: normalizeString(source.status || "pending"),
    createdAt: Number(source.createdAt || 0) || 0,
    updatedAt: Number(source.updatedAt || 0) || 0,
    startedAt: Number(source.startedAt || 0) || 0,
    finishedAt: Number(source.finishedAt || 0) || 0,
    itemId: normalizeString(source.itemId),
    textId: normalizeString(source.textId),
    hasDebugPayload: source.hasDebugPayload === true,
    data: source.status === "succeeded" ? source.responseBody || null : null,
    error: source.status === "failed" ? source.errorBody || null : null,
  };
}

function createAiJobRouteHandlers(adapter, options) {
  const source = adapter && typeof adapter === "object" ? adapter : {};
  const runtimeOptions = options && typeof options === "object" ? options : {};
  const jobStore = runtimeOptions.jobStore || sharedAiJobStore;

  async function handleCreateJob(routeContext) {
    const context = routeContext && typeof routeContext === "object" ? routeContext : {};
    const request = context.request;
    const response = context.response;
    let requestId = "";
    try {
      const rawBody = await readRequestBody(request, runtimeOptions.maxBodyBytes);
      let parsedBody = {};
      try {
        parsedBody = JSON.parse(rawBody || "{}");
      } catch (_error) {
        throw createHttpError(400, "invalid-json", "请求体 JSON 解析失败。");
      }
      requestId = normalizeString(parsedBody.requestId) || createRequestId();
      assertAiUsageOperatorName(parsedBody);
      const normalizedAdapterPayload = normalizeAdapterPayload(
        typeof source.normalizeInput === "function"
          ? await source.normalizeInput(parsedBody, context)
          : parsedBody
      );
      const normalizedRequest = createNormalizedRequest({
        requestId,
        platform: source.platform,
        scriptId: source.scriptId,
        routeKey: source.routeKey || context.pathname,
        input: normalizedAdapterPayload.input,
        projectOptions: normalizedAdapterPayload.projectOptions,
        debugOptions: normalizedAdapterPayload.debugOptions,
        runtimeContext: Object.assign({}, normalizedAdapterPayload.runtimeContext, {
          pathname: normalizeString(context.pathname),
          query: isPlainObject(context.query) ? context.query : {},
          params: isPlainObject(context.params) ? context.params : {},
        }),
      });
      const job = jobStore.createJob(
        Object.assign(
          {
            requestId,
            routeKey: source.routeKey || context.pathname,
          },
          extractJobMeta(parsedBody, normalizedRequest)
        )
      );
      sendJson(response, 202, buildJobStatusBody(job));
      Promise.resolve()
        .then(async function () {
          try {
            jobStore.markJobRunning(job.jobId);
            const execution = await executeAiRequest(
              source,
              runtimeOptions,
              context,
              parsedBody,
              requestId,
              {
                signal: jobStore.getJobSignal(job.jobId),
                jobId: job.jobId,
              }
            );
            jobStore.markJobSucceeded(job.jobId, {
              responseBody: execution.successBody,
            });
          } catch (error) {
            if (source.aiCallLogger && typeof source.aiCallLogger.appendSafe === "function") {
              source.aiCallLogger.appendSafe({
                createdAt: new Date().toISOString(),
                requestId: normalizeString(error?.requestId || requestId),
                rawBody: parsedBody,
                normalizedRequest: null,
                error,
              });
            }
            const errorBody =
              typeof runtimeOptions.createErrorBody === "function"
                ? runtimeOptions.createErrorBody({
                    adapter: source,
                    routeContext: context,
                    error,
                    requestId: normalizeString(error?.requestId || requestId),
                  })
                : createErrorBody(error, requestId);
            jobStore.markJobFailed(job.jobId, {
              errorBody,
              debugPayload: extractDebugPayload(error, errorBody),
            });
          }
        })
        .catch(function () {});
    } catch (error) {
      const statusCode = Math.max(400, Number(error && error.statusCode) || 500);
      const errorBody =
        typeof runtimeOptions.createErrorBody === "function"
          ? runtimeOptions.createErrorBody({
              adapter: source,
              routeContext: context,
              error,
              requestId: normalizeString((error && error.requestId) || requestId),
            })
          : createErrorBody(error, requestId);
      sendJson(response, statusCode, errorBody);
    }
  }

  async function handleGetJobStatus(routeContext) {
    const context = routeContext && typeof routeContext === "object" ? routeContext : {};
    const response = context.response;
    const jobId = context.params?.jobId;
    try {
      sendJson(response, 200, buildJobStatusBody(jobStore.getJob(jobId)));
    } catch (error) {
      const statusCode = Math.max(400, Number(error && error.statusCode) || 500);
      sendJson(response, statusCode, createErrorBody(error, ""));
    }
  }

  async function handleGetJobDebug(routeContext) {
    const context = routeContext && typeof routeContext === "object" ? routeContext : {};
    const response = context.response;
    const jobId = context.params?.jobId;
    try {
      sendJson(response, 200, {
        success: true,
        jobId: normalizeString(jobId),
        debug: jobStore.getJobDebug(jobId),
      });
    } catch (error) {
      const statusCode = Math.max(400, Number(error && error.statusCode) || 500);
      sendJson(response, statusCode, createErrorBody(error, ""));
    }
  }

  return {
    buildJobStatusBody,
    handleCreateJob,
    handleGetJobDebug,
    handleGetJobStatus,
  };
}

module.exports = {
  buildJobStatusBody,
  createAiJobRouteHandlers,
};

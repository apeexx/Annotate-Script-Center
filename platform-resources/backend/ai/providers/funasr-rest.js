"use strict";

const { TextDecoder } = require("util");

const {
  DEFAULT_FUN_ASR_MODEL,
  getFunAsrRestConfig,
} = require("../config");
const {
  createAudioUrlUnavailableError,
  createFunAsrProviderError,
  createTimeoutError,
  isAudioUrlLikelyUnavailable,
  isRateLimitProviderCode,
  normalizeAbortError,
} = require("../errors");
const { sanitizeProviderErrorSummary } = require("../sanitizer");

const UTF8_DECODER = new TextDecoder("utf-8", { fatal: false });
const MOCK_TEXT = "mock 听音文本";
const PENDING_STATUS_SET = new Set(["", "PENDING", "RUNNING", "UNKNOWN", "SUBMITTED"]);
const SUCCESS_STATUS_SET = new Set(["SUCCEEDED", "SUCCESS"]);
const FAILURE_STATUS_SET = new Set(["FAILED", "FAIL", "CANCELED", "CANCELLED"]);

function createError(message, code, statusCode, summary) {
  const error = new Error(message);
  error.code = code || "";
  error.statusCode = Number(statusCode) || 500;
  if (summary) {
    error.summary = sanitizeProviderErrorSummary(summary);
  }
  return error;
}

function createAbortError(signal, fallbackMessage) {
  return normalizeAbortError(signal?.reason, fallbackMessage || "当前任务超过60s，请重新请求。", "aborted", 504);
}

function isAbortSignalAborted(signal) {
  return Boolean(signal && signal.aborted === true);
}

function bindAbortSignal(controller, signal) {
  if (!controller || !signal || typeof signal.addEventListener !== "function") {
    return function () {};
  }
  if (signal.aborted) {
    try {
      controller.abort(signal.reason);
    } catch (error) {
      controller.abort();
    }
    return function () {};
  }
  const onAbort = function () {
    try {
      controller.abort(signal.reason);
    } catch (error) {
      controller.abort();
    }
  };
  signal.addEventListener("abort", onAbort, { once: true });
  return function () {
    signal.removeEventListener("abort", onAbort);
  };
}

function waitWithSignal(ms, signal) {
  return new Promise(function (resolve, reject) {
    if (isAbortSignalAborted(signal)) {
      reject(createAbortError(signal));
      return;
    }
    const timer = setTimeout(function () {
      if (signal && typeof signal.removeEventListener === "function") {
        signal.removeEventListener("abort", onAbort);
      }
      resolve();
    }, Math.max(0, Number(ms) || 0));
    const onAbort = function () {
      clearTimeout(timer);
      if (signal && typeof signal.removeEventListener === "function") {
        signal.removeEventListener("abort", onAbort);
      }
      reject(createAbortError(signal));
    };
    if (signal && typeof signal.addEventListener === "function") {
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

function decodeUtf8Buffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length <= 0) {
    return "";
  }
  return UTF8_DECODER.decode(buffer);
}

function isHeardTextLikelyMojibake(text) {
  const value = String(text || "").trim();
  if (!value) {
    return false;
  }
  const replacementCount = (value.match(/\uFFFD/g) || []).length;
  if (replacementCount >= 3) {
    return true;
  }
  if (replacementCount >= 1 && value.length <= 32) {
    return true;
  }
  return replacementCount > 0 && replacementCount / Math.max(value.length, 1) >= 0.08;
}

function normalizeTaskStatus(value) {
  return String(value || "").trim().toUpperCase();
}

function extractApiBaseHost(apiBase) {
  try {
    return new URL(String(apiBase || "")).host || "";
  } catch (error) {
    return "";
  }
}

function extractTaskId(payload) {
  const output = payload && typeof payload.output === "object" ? payload.output : {};
  return String(output.task_id || output.taskId || payload?.task_id || payload?.taskId || "").trim();
}

function extractTaskStatus(payload) {
  const output = payload && typeof payload.output === "object" ? payload.output : {};
  return normalizeTaskStatus(output.task_status || output.taskStatus || payload?.task_status || payload?.taskStatus || "");
}

function extractProviderMessage(payload, fallbackText) {
  const output = payload && typeof payload.output === "object" ? payload.output : {};
  return String(
    output.message ||
      output.task_message ||
      output.taskMessage ||
      payload?.message ||
      payload?.code ||
      fallbackText ||
      ""
  ).trim();
}

function extractProviderCode(payload) {
  const output = payload && typeof payload.output === "object" ? payload.output : {};
  return String(output.code || payload?.code || "").trim();
}

function createInvalidFunAsrModelError(summary) {
  return createError("Fun-ASR 模型名应为 fun-asr。", "invalid-fun-asr-model", 400, summary);
}

function createTaskMissingError(summary) {
  return createError("Fun-ASR REST 提交任务成功，但未返回 task_id。", "fun-asr-task-id-missing", 502, summary);
}

function createEmptyTextError(summary) {
  return createError("Fun-ASR 未返回可用转写文本。", "fun-asr-empty-text", 502, summary);
}

function createMojibakeError(summary) {
  return createError(
    "Fun-ASR 返回文本疑似编码异常，请检查 REST 结果文件编码。",
    "fun-asr-mojibake-text",
    502,
    summary
  );
}

function createForbiddenError(summary, rawStatus) {
  const error = createError(
    "Fun-ASR 调用被拒绝。可能是 DashScope 权限/地域未开通、API Key 无权限，或平台音频 URL 无法被 Fun-ASR 服务访问。",
    "fun-asr-forbidden",
    403,
    summary
  );
  error.providerStatus = 403;
  error.rawStatus = String(rawStatus || "").trim();
  return error;
}

function createFunAsrAuthError(summary, rawStatus) {
  return createFunAsrProviderError(
    "Fun-ASR 鉴权或权限错误，请检查 DASHSCOPE_API_KEY、服务开通与地域。",
    "fun-asr-auth-error",
    401,
    {
      providerStatus: 401,
      rawStatus,
      summary,
    }
  );
}

function createFunAsrRateLimitedError(summary, providerCode, rawStatus) {
  return createFunAsrProviderError(
    "Fun-ASR 上游限流，请稍后重试。",
    "fun-asr-rate-limited",
    429,
    {
      providerStatus: 429,
      providerCode,
      rawStatus,
      summary,
    }
  );
}

function createFunAsrTaskFailedError(summary, rawStatus, providerCode) {
  return createFunAsrProviderError(
    "Fun-ASR 任务失败，可查看原始AI返回。",
    "fun-asr-task-failed",
    502,
    {
      providerStatus: 502,
      providerCode,
      rawStatus,
      summary,
    }
  );
}

function createFunAsrTranscriptionDownloadFailedError(summary, statusCode, rawStatus, providerCode) {
  return createFunAsrProviderError(
    "Fun-ASR 识别结果下载失败，可查看原始AI返回。",
    "fun-asr-transcription-download-failed",
    statusCode || 502,
    {
      providerStatus: statusCode || 502,
      providerCode,
      rawStatus,
      summary,
    }
  );
}

function attachFunAsrDebug(error, meta) {
  const source = meta && typeof meta === "object" ? meta : {};
  if (!(error instanceof Error)) {
    return error;
  }
  error.provider = "fun-asr-rest";
  error.stage = String(source.stage || error.stage || "fun_asr").trim() || "fun_asr";
  error.model = String(source.model || error.model || "").trim();
  error.taskId = String(source.taskId || error.taskId || "").trim();
  error.taskStatus = String(source.taskStatus || source.rawStatus || error.taskStatus || error.rawStatus || "").trim();
  if (!error.providerCode && source.providerCode) {
    error.providerCode = String(source.providerCode || "").trim();
  }
  if (!Number(error.providerStatus) && Number(source.statusCode)) {
    error.providerStatus = Number(source.statusCode) || 0;
  }
  error.debugRawAiResponse = {
    provider: "fun-asr-rest",
    stage: error.stage,
    model: error.model,
    providerStatus: Number(error.providerStatus || error.statusCode || source.statusCode || 0) || 0,
    providerCode: String(error.providerCode || source.providerCode || "").trim(),
    taskId: error.taskId,
    taskStatus: error.taskStatus,
    responseBody: source.payload || null,
    rawText: String(source.rawText || source.fallbackText || "").trim(),
    createdAt: new Date().toISOString(),
  };
  return error;
}

function isInvalidModelSummary(code, summary) {
  const lowered = String(code || summary || "").toLowerCase();
  return lowered.indexOf("model") >= 0 && (
    lowered.indexOf("invalid") >= 0 ||
    lowered.indexOf("not found") >= 0 ||
    lowered.indexOf("unsupported") >= 0 ||
    lowered.indexOf("illegal") >= 0
  );
}

function isDownloadFailedSummary(code, summary) {
  const lowered = String(code || "").toLowerCase() + " " + String(summary || "").toLowerCase();
  return lowered.indexOf("invalidfile.downloadfailed") >= 0 || isAudioUrlLikelyUnavailable(lowered);
}

async function readResponsePayload(response) {
  const text = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(text || "{}");
  } catch (error) {
    payload = null;
  }
  return {
    status: Number(response.status) || 0,
    text,
    payload,
  };
}

async function fetchWithTimeout(url, options, timeoutMs, timeoutMessage) {
  if (typeof fetch !== "function") {
    throw new Error("当前 Node 运行时不支持 fetch。");
  }
  const signal = options?.signal;
  if (isAbortSignalAborted(signal)) {
    throw createAbortError(signal);
  }
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const unbindAbort = bindAbortSignal(controller, signal);
  const timer = controller
    ? setTimeout(function () {
        controller.abort();
      }, Math.max(1000, Number(timeoutMs) || 60000))
    : null;
  try {
    return await fetch(url, Object.assign({}, options || {}, {
      signal: controller ? controller.signal : undefined,
    }));
  } catch (error) {
    if (error?.name === "AbortError") {
      if (isAbortSignalAborted(signal)) {
        throw createAbortError(signal);
      }
      throw createTimeoutError(timeoutMessage);
    }
    throw error;
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
    unbindAbort();
  }
}

function classifyRestFailure(options) {
  const source = options && typeof options === "object" ? options : {};
  const statusCode = Number(source.statusCode) || 0;
  const payload = source.payload || null;
  const rawStatus = String(source.rawStatus || "").trim();
  const stage = String(source.stage || "fun_asr").trim() || "fun_asr";
  const model = String(source.model || "").trim();
  const taskId = String(source.taskId || "").trim();
  const fallbackText = String(source.fallbackText || "");
  const summary = sanitizeProviderErrorSummary(extractProviderMessage(payload, fallbackText));
  const providerCode = extractProviderCode(payload);
  let error = null;
  if (isInvalidModelSummary(providerCode, summary)) {
    error = createInvalidFunAsrModelError(summary);
  } else if (statusCode === 401) {
    error = createFunAsrAuthError(summary, rawStatus);
  } else if (statusCode === 429 || isRateLimitProviderCode(providerCode)) {
    error = createFunAsrRateLimitedError(summary, providerCode, rawStatus);
  } else if (stage === "fun_asr_transcription_download") {
    error = createFunAsrTranscriptionDownloadFailedError(summary, statusCode || 502, rawStatus, providerCode);
  } else if (stage === "fun_asr_poll" && FAILURE_STATUS_SET.has(rawStatus)) {
    error = createFunAsrTaskFailedError(summary, rawStatus, providerCode);
  } else if (statusCode === 403) {
    if (isDownloadFailedSummary(providerCode, summary)) {
      error = createAudioUrlUnavailableError(
        "Fun-ASR 无法下载平台音频，请确认 audioUrl 对阿里云服务可访问或签名未过期。",
        403,
        rawStatus
      );
    } else {
      error = createForbiddenError(summary, rawStatus);
    }
  } else if (isDownloadFailedSummary(providerCode, summary)) {
    error = createAudioUrlUnavailableError(
      "Fun-ASR 无法下载平台音频，请确认 audioUrl 对阿里云服务可访问或签名未过期。",
      statusCode || 403,
      rawStatus
    );
  } else {
    error = createFunAsrProviderError(
      "Fun-ASR 上游模型接口返回错误，可查看原始AI返回。",
      "fun-asr-provider-error",
      statusCode || 502,
      {
        providerStatus: statusCode || 502,
        providerCode,
        rawStatus,
        summary,
      }
    );
  }
  if (error.code === "fun-asr-audio-url-unreachable") {
    error.providerCode = providerCode;
  }
  throw attachFunAsrDebug(error, {
    stage,
    model,
    taskId,
    taskStatus: rawStatus,
    statusCode,
    providerCode,
    payload,
    fallbackText,
  });
}

async function submitTask(audioUrl, model, config, options) {
  const requestId = String(options?.requestId || options?.traceId || "").trim();
  const startedAt = Date.now();
  console.info("[FunASR][REST] submit start", {
    requestId,
    model,
    apiBaseHost: extractApiBaseHost(config.apiBase),
    timeoutMs: config.timeoutMs,
  });
  const response = await fetchWithTimeout(
    config.apiBase + "/services/audio/asr/transcription",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + config.apiKey,
        "Content-Type": "application/json",
        "X-DashScope-Async": "enable",
      },
      signal: options?.signal,
      body: JSON.stringify({
        model,
        input: {
          file_urls: [audioUrl],
        },
        parameters: {
          language_hints: Array.isArray(config.languageHints) && config.languageHints.length > 0
            ? config.languageHints.slice(0, 8)
            : ["zh"],
        },
      }),
    },
    config.timeoutMs,
    "Fun-ASR 提交任务超时。"
  );
  const body = await readResponsePayload(response);
  const statusCode = body.status;
  const taskId = extractTaskId(body.payload);
  const rawStatus = extractTaskStatus(body.payload) || "SUBMITTED";
  console.info("[FunASR][REST] submit finish", {
    requestId,
    durationMs: Math.max(0, Date.now() - startedAt),
    success: response.ok && Boolean(taskId),
    rawStatus,
  });
  if (!response.ok) {
    classifyRestFailure({
      statusCode,
      payload: body.payload,
      fallbackText: body.text,
      rawStatus,
      stage: "fun_asr_submit",
      model,
    });
  }
  if (!taskId) {
    throw createTaskMissingError(body.text);
  }
  return {
    taskId,
    rawStatus,
    payload: body.payload || {},
  };
}

async function pollTask(taskId, config, options) {
  const requestId = String(options?.requestId || options?.traceId || "").trim();
  const startedAt = Date.now();
  const deadlineAt = Date.now() + Math.max(1000, Number(options?.timeoutMs) || config.timeoutMs);
  let lastPayload = null;
  let lastStatus = "SUBMITTED";
  console.info("[FunASR][REST] poll start", {
    requestId,
    taskId,
    pollIntervalMs: config.pollIntervalMs,
  });
  while (Date.now() <= deadlineAt) {
    const remainingMs = Math.max(1000, deadlineAt - Date.now());
    const response = await fetchWithTimeout(
      config.apiBase + "/tasks/" + encodeURIComponent(taskId),
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + config.apiKey,
        },
        signal: options?.signal,
      },
      remainingMs,
      "Fun-ASR 查询任务超时。"
    );
    const body = await readResponsePayload(response);
    const rawStatus = extractTaskStatus(body.payload) || lastStatus;
    lastPayload = body.payload || {};
    lastStatus = rawStatus;
    if (!response.ok) {
      classifyRestFailure({
        statusCode: body.status,
        payload: body.payload,
        fallbackText: body.text,
        rawStatus,
        stage: "fun_asr_poll",
        model: options?.model,
        taskId,
      });
    }
    if (SUCCESS_STATUS_SET.has(rawStatus)) {
      console.info("[FunASR][REST] poll finish", {
        requestId,
        taskId,
        durationMs: Math.max(0, Date.now() - startedAt),
        success: true,
        rawStatus,
      });
      return {
        payload: lastPayload,
        rawStatus,
      };
    }
    if (FAILURE_STATUS_SET.has(rawStatus)) {
      console.info("[FunASR][REST] poll finish", {
        requestId,
        taskId,
        durationMs: Math.max(0, Date.now() - startedAt),
        success: false,
        rawStatus,
      });
      classifyRestFailure({
        statusCode: 502,
        payload: body.payload,
        fallbackText: body.text,
        rawStatus,
        stage: "fun_asr_poll",
        model: options?.model,
        taskId,
      });
    }
    if (!PENDING_STATUS_SET.has(rawStatus)) {
      console.info("[FunASR][REST] poll finish", {
        requestId,
        taskId,
        durationMs: Math.max(0, Date.now() - startedAt),
        success: false,
        rawStatus,
      });
      classifyRestFailure({
        statusCode: 502,
        payload: body.payload,
        fallbackText: body.text,
        rawStatus,
        stage: "fun_asr_poll",
        model: options?.model,
        taskId,
      });
    }
    await waitWithSignal(config.pollIntervalMs, options?.signal);
  }
  console.info("[FunASR][REST] poll finish", {
    requestId,
    taskId,
    durationMs: Math.max(0, Date.now() - startedAt),
    success: false,
    rawStatus: lastStatus || "TIMEOUT",
  });
  const timeoutError = createTimeoutError("Fun-ASR 等待识别结果超时。");
  timeoutError.rawStatus = lastStatus;
  throw timeoutError;
}

function pickResultRecord(results, audioUrl) {
  const list = Array.isArray(results) ? results : [];
  const exact = list.find(function (item) {
    return String(item?.file_url || item?.fileUrl || "").trim() === String(audioUrl || "").trim();
  });
  return exact || list[0] || null;
}

function extractTranscriptionUrl(payload, audioUrl) {
  const output = payload && typeof payload.output === "object" ? payload.output : {};
  const resultRecord = pickResultRecord(output.results, audioUrl);
  if (resultRecord) {
    return String(resultRecord.transcription_url || resultRecord.transcriptionUrl || "").trim();
  }
  return String(output.transcription_url || output.transcriptionUrl || "").trim();
}

function extractHeardText(payload) {
  const directText = String(
    payload?.text ||
      payload?.output?.text ||
      ""
  ).trim();
  if (directText) {
    return directText;
  }
  const candidates = [];
  ["transcripts", "sentences", "segments", "utterances"].forEach(function (key) {
    const items = Array.isArray(payload?.[key]) ? payload[key] : [];
    items.forEach(function (item) {
      if (!item || typeof item !== "object") {
        return;
      }
      const text = String(item.text || item.transcript || item.content || "").trim();
      if (text) {
        candidates.push(text);
      }
    });
  });
  return candidates.join("").trim();
}

function tryDecodeBytes(buffer, encoding) {
  try {
    if (encoding === "utf-8-sig") {
      const text = Buffer.from(buffer).toString("utf8");
      return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
    }
    if (encoding === "utf-8") {
      return Buffer.from(buffer).toString("utf8");
    }
    if (encoding === "gb18030") {
      try {
        return new TextDecoder("gb18030", { fatal: false }).decode(buffer);
      } catch (error) {
        return null;
      }
    }
  } catch (error) {
    return null;
  }
  return null;
}

function parseTranscriptionPayload(buffer) {
  const utf8SigText = tryDecodeBytes(buffer, "utf-8-sig");
  if (utf8SigText !== null) {
    try {
      return JSON.parse(utf8SigText || "{}");
    } catch (error) {
      // continue
    }
  }
  const utf8Text = tryDecodeBytes(buffer, "utf-8");
  if (utf8Text !== null) {
    try {
      return JSON.parse(utf8Text || "{}");
    } catch (error) {
      if (isHeardTextLikelyMojibake(utf8Text) || utf8Text.indexOf("\uFFFD") >= 0) {
        const gbText = tryDecodeBytes(buffer, "gb18030");
        if (gbText !== null) {
          return JSON.parse(gbText || "{}");
        }
      }
    }
  }
  const gbText = tryDecodeBytes(buffer, "gb18030");
  if (gbText !== null) {
    try {
      return JSON.parse(gbText || "{}");
    } catch (error) {
      // continue
    }
  }
  throw createError("Fun-ASR 结果文件 JSON 解析失败。", "fun-asr-transcription-json-invalid", 502);
}

async function downloadTranscriptionPayload(transcriptionUrl, timeoutMs, options) {
  const response = await fetchWithTimeout(
    transcriptionUrl,
    { method: "GET", signal: options?.signal },
    timeoutMs,
    "Fun-ASR 下载转写结果超时。"
  );
  if (!response.ok) {
    const text = await response.text();
    classifyRestFailure({
      statusCode: response.status,
      payload: null,
      fallbackText: text,
      rawStatus: options?.rawStatus || "",
      stage: "fun_asr_transcription_download",
      model: options?.model,
      taskId: options?.taskId,
    });
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  try {
    return parseTranscriptionPayload(buffer);
  } catch (error) {
    throw attachFunAsrDebug(error, {
      stage: "fun_asr_parse",
      model: options?.model,
      taskId: options?.taskId,
      rawStatus: options?.rawStatus || "",
      rawText:
        tryDecodeBytes(buffer, "utf-8-sig") ||
        tryDecodeBytes(buffer, "utf-8") ||
        tryDecodeBytes(buffer, "gb18030") ||
        "",
    });
  }
}

async function requestFunAsrRecognitionRest(input, options) {
  const overrideConfig =
    options && options.clientConfig && typeof options.clientConfig === "object"
      ? options.clientConfig
      : {};
  const config = Object.assign({}, getFunAsrRestConfig(), overrideConfig);
  const model = String(options?.model || config.model || DEFAULT_FUN_ASR_MODEL).trim() || DEFAULT_FUN_ASR_MODEL;
  const requestId = String(options?.requestId || options?.traceId || "").trim();
  if (isAbortSignalAborted(options?.signal)) {
    throw createAbortError(options?.signal);
  }
  if (config.mockEnabled) {
    return {
      model,
      heardText: String(input?.pageText || "").trim() || MOCK_TEXT,
      confidence: 0.82,
      usage: {},
      mock: true,
      taskId: "mock-task",
      rawStatus: "MOCK",
      simplifiedChineseNormalized: false,
      simplifiedChineseSource: "",
    };
  }
  if (!config.hasApiKey) {
    throw createError("缺少 DASHSCOPE_API_KEY。", "missing-api-key", 503);
  }
  const audioUrl = String(input?.audioUrl || "").trim();
  const timeoutMs = Math.max(1000, Number(options?.timeoutMs) || config.timeoutMs);
  let submitResult = null;
  let pollResult = null;
  submitResult = await submitTask(audioUrl, model, Object.assign({}, config, { timeoutMs }), {
    requestId,
  });
  pollResult = await pollTask(
    submitResult.taskId,
    Object.assign({}, config, { timeoutMs }),
    {
      requestId,
      timeoutMs,
      model,
    }
  );
  const transcriptionUrl = extractTranscriptionUrl(pollResult.payload, audioUrl);
  let heardText = "";
  let transcriptPayload = null;
  if (transcriptionUrl) {
    transcriptPayload = await downloadTranscriptionPayload(transcriptionUrl, timeoutMs, {
      signal: options?.signal,
      model,
      taskId: submitResult.taskId,
      rawStatus: pollResult.rawStatus,
    });
    heardText = extractHeardText(transcriptPayload);
  }
  if (!heardText) {
    heardText = extractHeardText(pollResult.payload?.output || {});
  }
  heardText = String(heardText || "").trim();
  if (!heardText) {
    throw attachFunAsrDebug(createEmptyTextError(String(pollResult.rawStatus || "")), {
      stage: "fun_asr_parse",
      model,
      taskId: submitResult.taskId,
      rawStatus: pollResult.rawStatus,
      payload: transcriptPayload || pollResult.payload || null,
    });
  }
  if (isHeardTextLikelyMojibake(heardText)) {
    throw attachFunAsrDebug(createMojibakeError(String(pollResult.rawStatus || "")), {
      stage: "fun_asr_parse",
      model,
      taskId: submitResult.taskId,
      rawStatus: pollResult.rawStatus,
      payload: transcriptPayload || pollResult.payload || null,
      rawText: heardText,
    });
  }
  return {
    model,
    heardText,
    confidence: 0,
    usage: {},
    mock: false,
    taskId: submitResult.taskId,
    rawStatus: pollResult.rawStatus,
    simplifiedChineseNormalized: false,
    simplifiedChineseSource: "",
  };
}

async function requestFunAsrRecognition(input, options) {
  return requestFunAsrRecognitionRest(input, options);
}

module.exports = {
  DEFAULT_FUN_ASR_MODEL,
  getFunAsrRestConfig,
  requestFunAsrRecognition,
  requestFunAsrRecognitionRest,
};

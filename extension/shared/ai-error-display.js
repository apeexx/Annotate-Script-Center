"use strict";

function normalizeText(value, maxLength) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength || 200);
}

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function pickNestedObject(source, key) {
  const value = source && typeof source === "object" ? source[key] : null;
  return value && typeof value === "object" ? value : {};
}

function pickProviderErrorFields(rawResponse) {
  const raw = rawResponse && typeof rawResponse === "object" ? rawResponse : {};
  const error = pickNestedObject(raw, "error");
  const meta = pickNestedObject(raw, "meta");
  return {
    code: normalizeText(error.code || raw.code),
    message: normalizeText(error.message || raw.message, 240),
    providerCode: normalizeText(error.providerCode || raw.providerCode),
    providerStatus: toNumber(error.providerStatus || raw.providerStatus || error.statusCode || raw.statusCode),
    requestId: normalizeText(meta.requestId || raw.requestId),
    debugId: normalizeText(meta.debugId || raw.debugId),
  };
}

function isSystemErrorRawResponse(rawResponse) {
  const raw = rawResponse && typeof rawResponse === "object" ? rawResponse : {};
  return normalizeText(raw.type) === "client-network-error";
}

function isAiErrorRawResponse(rawResponse) {
  const raw = rawResponse && typeof rawResponse === "object" ? rawResponse : {};
  if (raw.success === false && raw.error && typeof raw.error === "object") {
    return true;
  }
  if (raw.error && typeof raw.error === "object" && (raw.meta || raw.requestId || raw.debugId)) {
    return true;
  }
  const fields = pickProviderErrorFields(raw);
  return Boolean(fields.code || fields.providerCode || fields.providerStatus || fields.requestId);
}

function simplifyHealthCheck(healthCheck) {
  const source = healthCheck && typeof healthCheck === "object" ? healthCheck : {};
  const body = pickNestedObject(source, "body");
  return {
    ok: source.ok === true,
    endpoint: normalizeText(source.endpoint, 240),
    statusCode: toNumber(source.statusCode),
    service: normalizeText(body.service || source.service),
    component: normalizeText(body.component || source.component),
    status: normalizeText(body.status || source.status),
  };
}

function buildSystemInference(rawResponse, message) {
  const raw = rawResponse && typeof rawResponse === "object" ? rawResponse : {};
  const healthCheck = simplifyHealthCheck(raw.healthCheck);
  const backendMode = normalizeText(raw.backendMode);
  const originalMessage = normalizeText(raw.originalErrorMessage || message, 240).toLowerCase();

  if (originalMessage.indexOf("extension context invalidated") >= 0) {
    return "扩展上下文已失效，请刷新当前业务页面后重试。";
  }
  if (raw.online === false) {
    return "浏览器当前离线，请先恢复网络连接。";
  }
  if (healthCheck.ok === true) {
    return "后端 health 可达，但真实 recommend 请求在网络层被中断。优先检查反向代理、PM2、Node 进程日志。";
  }
  if (backendMode === "local") {
    return "本机后端不可达。优先确认 `node platform-resources/backend/server.js` 是否已启动，或切回服务器模式。";
  }
  if (raw.fallbackAttempted === true) {
    return "主入口与回退入口都失败。优先检查当前后端接口地址、服务进程和网络连通性。";
  }
  return "网络层请求失败。优先检查当前接口地址、后端服务状态和浏览器到接口的连通性。";
}

function buildSystemSuggestions(rawResponse) {
  const raw = rawResponse && typeof rawResponse === "object" ? rawResponse : {};
  const suggestions = [];
  const endpoint = normalizeText(raw.endpoint, 240);
  const fallbackEndpoint = normalizeText(raw.fallbackEndpoint, 240);
  const healthEndpoint = normalizeText(raw.healthCheck?.endpoint, 240);
  if (endpoint) {
    suggestions.push("检查接口：" + endpoint);
  }
  if (healthEndpoint) {
    suggestions.push("检查 health：" + healthEndpoint);
  }
  if (fallbackEndpoint) {
    suggestions.push("检查回退接口：" + fallbackEndpoint);
  }
  if (normalizeText(raw.backendMode) === "local") {
    suggestions.push("检查本机服务：node platform-resources/backend/server.js");
  }
  return suggestions;
}

function buildSystemRawJson(rawResponse, message) {
  const raw = rawResponse && typeof rawResponse === "object" ? rawResponse : {};
  return {
    category: "system",
    summary: normalizeText(message, 240),
    inference: buildSystemInference(raw, message),
    backendMode: normalizeText(raw.backendMode),
    endpoint: normalizeText(raw.endpoint, 240),
    fallbackEndpoint: normalizeText(raw.fallbackEndpoint, 240),
    fallbackAttempted: raw.fallbackAttempted === true,
    online: typeof raw.online === "boolean" ? raw.online : null,
    originalError: {
      name: normalizeText(raw.originalErrorName),
      message: normalizeText(raw.originalErrorMessage, 240),
    },
    healthCheck: simplifyHealthCheck(raw.healthCheck),
    suggestions: buildSystemSuggestions(raw),
  };
}

function buildAiInference(rawResponse, message) {
  const fields = pickProviderErrorFields(rawResponse);
  const summaryText = normalizeText(
    fields.message || message || JSON.stringify(rawResponse || {})
  ).toLowerCase();

  if (
    fields.providerStatus === 429 ||
    fields.code === "provider-rate-limited" ||
    fields.code === "qwen-burst-rate-limited" ||
    fields.providerCode.toLowerCase() === "limit_burst_rate"
  ) {
    return "上游模型限流。`limit_burst_rate` 通常表示请求增长过快，不是本地机器算力不足。";
  }
  if (
    fields.providerStatus === 400 &&
    (fields.providerCode.toLowerCase() === "arrearage" ||
      summaryText.indexOf("arrearage") >= 0 ||
      summaryText.indexOf("余额") >= 0 ||
      summaryText.indexOf("欠费") >= 0)
  ) {
    return "阿里云账号可能欠费或余额不足，请先检查百炼账户状态。";
  }
  if (fields.providerStatus === 400) {
    return "这是 400 类上游错误，更像请求参数、请求格式或模型调用条件不合法，不能直接判断为余额不足。";
  }
  if (fields.code.indexOf("invalid-") === 0) {
    return "当前请求字段不合法或缺少必要字段，请检查当前条数据和前端请求参数。";
  }
  if (fields.code === "timeout") {
    return "AI 同步请求超时，建议缩短任务链路或稍后重试。";
  }
  if (fields.code === "provider-queue-full") {
    return "后端队列已满，说明当前待处理 AI 请求过多。";
  }
  return "这是 AI 或上游模型返回的业务错误，请结合完整原始返回继续排查。";
}

function buildAiDetailRows(rawResponse, message) {
  const fields = pickProviderErrorFields(rawResponse);
  const rows = [["错误解读", normalizeText(message || fields.message, 240) || "-"]];
  const inference = buildAiInference(rawResponse, message);
  if (inference) {
    rows.push(["可能原因", inference]);
  }
  if (fields.providerStatus > 0) {
    rows.push(["providerStatus", String(fields.providerStatus)]);
  }
  if (fields.providerCode) {
    rows.push(["providerCode", fields.providerCode]);
  }
  if (fields.requestId) {
    rows.push(["requestId", fields.requestId]);
  }
  if (fields.debugId) {
    rows.push(["debugId", fields.debugId]);
  }
  return rows;
}

function buildAiErrorDisplay(input) {
  const source = input && typeof input === "object" ? input : {};
  const rawResponse = source.rawResponse && typeof source.rawResponse === "object" ? source.rawResponse : null;
  const summary = normalizeText(source.message, 240) || "请求失败。";

  if (isSystemErrorRawResponse(rawResponse)) {
    const simplified = buildSystemRawJson(rawResponse, summary);
    return {
      category: "system",
      summary: simplified.summary,
      inference: simplified.inference,
      detailRows: [
        ["错误解读", simplified.summary],
        ["可能原因", simplified.inference],
        ["后端模式", simplified.backendMode || "-"],
        ["请求接口", simplified.endpoint || "-"],
      ],
      rawJson: simplified,
    };
  }

  if (isAiErrorRawResponse(rawResponse)) {
    return {
      category: "ai",
      summary: summary,
      inference: buildAiInference(rawResponse, summary),
      detailRows: buildAiDetailRows(rawResponse, summary),
      rawJson: rawResponse,
    };
  }

  return {
    category: "unknown",
    summary: summary,
    inference: "",
    detailRows: [["错误解读", summary]],
    rawJson: rawResponse || {},
  };
}

const api = {
  buildAiErrorDisplay,
  isAiErrorRawResponse,
  isSystemErrorRawResponse,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = api;
}

if (typeof globalThis !== "undefined") {
  globalThis.ASREdgeAiErrorDisplay = api;
}

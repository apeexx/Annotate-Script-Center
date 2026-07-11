"use strict";

const { authenticateAdminRequest, getAdminAuthConfig } = require("../admin-auth");
const { appendRuntimeLog } = require("../runtime-log-store");
const { sendJson } = require("../response");
const { createLiveAdminDashboardOverview } = require("./overview");
const { buildAdminDashboardRuntimeLogs } = require("./runtime-logs");

const OVERVIEW_PATH = "/api/admin/dashboard/overview";
const RUNTIME_LOGS_PATH = "/api/admin/dashboard/runtime-logs";

function createRequestId() {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

function sendError(response, statusCode, code, message, requestId) {
  sendJson(response, statusCode, {
    success: false,
    code,
    message,
    requestId,
  });
}

function getRefreshSource(request) {
  const value = request?.headers?.["x-asc-dashboard-refresh"];
  if (Array.isArray(value)) {
    return String(value[0] || "").trim() || "unknown";
  }
  return String(value || "").trim() || "unknown";
}

function authenticateDashboardRequest(request, response, requestId, scope) {
  const authResult = authenticateAdminRequest({
    request,
    authConfig: getAdminAuthConfig(),
  });
  if (authResult.ok) {
    return {
      ok: true,
    };
  }

  const code = authResult.code === "admin-auth-not-configured"
    ? "admin-dashboard-auth-not-configured"
    : authResult.code === "admin-auth-missing"
      ? "admin-dashboard-token-missing"
      : authResult.code;
  appendRuntimeLog({
    level: "warn",
    scope: scope,
    action: "auth_failed",
    message: "系统管理接口鉴权失败",
    requestId,
    details: {
      code,
    },
  });
  sendError(
    response,
    code === "admin-dashboard-auth-not-configured" ? 500 : 401,
    code,
    authResult.message,
    requestId
  );
  return {
    ok: false,
  };
}

function registerAdminDashboardRoutes(router, options) {
  const config = options && typeof options === "object" ? options : {};
  router.get(OVERVIEW_PATH, function ({ request, response }) {
    const requestId = createRequestId();
    const authResult = authenticateDashboardRequest(
      request,
      response,
      requestId,
      "admin.dashboard.overview"
    );
    if (!authResult.ok) {
      return;
    }

    try {
      const payload = createLiveAdminDashboardOverview(config);
      appendRuntimeLog({
        level: "success",
        scope: "admin.dashboard.overview",
        action: "read",
        message: "系统仪表盘总览已刷新",
        requestId,
        persist: false,
        details: {
          refreshSource: getRefreshSource(request),
          activePools: payload?.data?.runtime?.queue?.activePools?.length || 0,
        },
      });
      sendJson(response, 200, payload);
    } catch (error) {
      appendRuntimeLog({
        level: "error",
        scope: "admin.dashboard.overview",
        action: "read_failed",
        message: "系统仪表盘总览加载失败",
        requestId,
        details: {
          refreshSource: getRefreshSource(request),
          error: error && error.message ? error.message : String(error),
        },
      });
      sendError(
        response,
        500,
        "admin-dashboard-overview-failed",
        error && error.message ? error.message : "系统仪表盘总览加载失败。",
        requestId
      );
    }
  });

  router.get(RUNTIME_LOGS_PATH, function ({ request, response, query }) {
    const requestId = createRequestId();
    const authResult = authenticateDashboardRequest(
      request,
      response,
      requestId,
      "admin.dashboard.runtime_logs"
    );
    if (!authResult.ok) {
      return;
    }

    try {
      sendJson(
        response,
        200,
        buildAdminDashboardRuntimeLogs({
          limit: query?.limit,
        })
      );
    } catch (error) {
      appendRuntimeLog({
        level: "error",
        scope: "admin.dashboard.runtime_logs",
        action: "read_failed",
        message: "系统仪表盘运行日志加载失败",
        requestId,
        details: {
          error: error && error.message ? error.message : String(error),
        },
      });
      sendError(
        response,
        500,
        "admin-dashboard-runtime-logs-failed",
        error && error.message ? error.message : "系统仪表盘运行日志加载失败。",
        requestId
      );
    }
  });
}

module.exports = {
  OVERVIEW_PATH,
  RUNTIME_LOGS_PATH,
  registerAdminDashboardRoutes,
};

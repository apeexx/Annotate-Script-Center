"use strict";

const { appendRuntimeLog } = require("../runtime-log-store");
const { sendJson } = require("../response");
const { loadAdminDownloadCenterReleases } = require("./releases");

const RELEASES_PATH = "/api/admin/download-center/releases";

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

function registerAdminDownloadCenterRoutes(router, options) {
  const config = options && typeof options === "object" ? options : {};
  router.get(RELEASES_PATH, async function ({ request, response }) {
    const requestId = createRequestId();
    try {
      const data = await loadAdminDownloadCenterReleases(config);
      appendRuntimeLog({
        level: "info",
        scope: "admin.download-center.releases",
        action: "read",
        message: "脚本下载版本列表已刷新",
        requestId,
        persist: false,
        details: {
          latestVersion: data.latestVersion,
          items: Array.isArray(data.items) ? data.items.length : 0,
          usedFallback: data?.source?.usedFallback === true,
        },
      });
      sendJson(response, 200, {
        success: true,
        data,
        requestId,
      });
    } catch (error) {
      appendRuntimeLog({
        level: "error",
        scope: "admin.download-center.releases",
        action: "read_failed",
        message: "脚本下载版本列表加载失败",
        requestId,
        persist: false,
        details: {
          error: error && error.message ? error.message : String(error),
        },
      });
      sendError(
        response,
        502,
        "admin-download-center-releases-unavailable",
        error && error.message ? error.message : "脚本下载版本列表加载失败。",
        requestId
      );
    }
  });
}

module.exports = {
  RELEASES_PATH,
  registerAdminDownloadCenterRoutes,
};

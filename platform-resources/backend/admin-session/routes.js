"use strict";

const { appendRuntimeLog } = require("../runtime-log-store");
const { sendJson } = require("../response");
const {
  createAdminSessionToken,
  getAdminAuthConfig,
  isAdminAuthConfigured,
} = require("../admin-auth");

const UNLOCK_PATH = "/api/admin/session/unlock";
const MAX_BODY_BYTES = 256 * 1024;

function createRequestId() {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

function normalizeText(value) {
  return String(value || "").trim();
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

function sendError(response, statusCode, code, message, requestId) {
  sendJson(response, statusCode, {
    success: false,
    code,
    message,
    requestId,
  });
}

function registerAdminSessionRoutes(router) {
  router.post(UNLOCK_PATH, async function ({ request, response }) {
    const requestId = createRequestId();
    try {
      const authConfig = getAdminAuthConfig();
      if (!isAdminAuthConfigured(authConfig)) {
        appendRuntimeLog({
          level: "error",
          scope: "admin.session",
          action: "unlock_failed",
          message: "管理员登录失败：后端未配置鉴权环境变量",
          requestId,
        });
        sendError(
          response,
          500,
          "admin-session-auth-not-configured",
          "后端未配置管理员鉴权环境变量。",
          requestId
        );
        return;
      }

      const body = JSON.parse((await readRequestBody(request)) || "{}");
      const password = normalizeText(body?.password);
      if (!password) {
        appendRuntimeLog({
          level: "warn",
          scope: "admin.session",
          action: "unlock_failed",
          message: "管理员登录失败：缺少密码",
          requestId,
        });
        sendError(response, 400, "admin-session-password-required", "请输入管理员密码。", requestId);
        return;
      }

      const { authenticateAdminRequest } = require("../admin-auth");
      const authResult = authenticateAdminRequest({
        request,
        password,
        authConfig,
      });
      if (!authResult.ok) {
        appendRuntimeLog({
          level: "warn",
          scope: "admin.session",
          action: "unlock_failed",
          message:
            authResult.code === "admin-auth-password-invalid"
              ? "管理员登录失败：密码错误"
              : "管理员登录失败：鉴权未通过",
          requestId,
          details: {
            code: authResult.code,
            operatorName: normalizeText(body?.operatorName),
          },
        });
        sendError(
          response,
          authResult.code === "admin-auth-not-configured" ? 500 : 401,
          authResult.code === "admin-auth-password-invalid"
            ? "admin-session-password-invalid"
            : authResult.code,
          authResult.code === "admin-auth-password-invalid"
            ? "管理员密码错误。"
            : authResult.message,
          requestId
        );
        return;
      }

      const issued = createAdminSessionToken(
        {
          operatorName: normalizeText(body?.operatorName),
        },
        {
          jwtSecret: authConfig.jwtSecret,
        }
      );

      appendRuntimeLog({
        level: "success",
        scope: "admin.session",
        action: "unlock_success",
        message: "管理员已进入系统管理",
        requestId,
        details: {
          operatorName: normalizeText(body?.operatorName) || "未设置",
          expiresInSeconds: issued.expiresInSeconds,
        },
      });

      sendJson(response, 200, {
        success: true,
        data: {
          token: issued.token,
          expiresAt: issued.expiresAt,
          expiresInSeconds: issued.expiresInSeconds,
        },
        requestId,
      });
    } catch (error) {
      appendRuntimeLog({
        level: "error",
        scope: "admin.session",
        action: "unlock_failed",
        message: "管理员登录请求无效",
        requestId,
        details: {
          error: error && error.message ? error.message : String(error),
        },
      });
      sendError(
        response,
        400,
        "admin-session-request-invalid",
        error && error.message ? error.message : "请求参数无效。",
        requestId
      );
    }
  });
}

module.exports = {
  UNLOCK_PATH,
  registerAdminSessionRoutes,
};

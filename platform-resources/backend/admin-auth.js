"use strict";

const {
  createSha256Hex,
  createSignedToken,
  timingSafeEqualHex,
  verifySignedToken,
} = require("./project-data-download/jwt");

const ADMIN_SESSION_TTL_SECONDS = 30 * 60;

function normalizeText(value) {
  return String(value || "").trim();
}

function getHeaderText(headers, key) {
  const value = headers ? headers[key] : "";
  if (Array.isArray(value)) {
    return String(value[0] || "");
  }
  return String(value || "");
}

function createPasswordSha256(password) {
  return createSha256Hex(password);
}

function getAdminAuthConfig() {
  return {
    passwordSha256:
      normalizeText(process.env.ASC_PROJECT_DATA_DOWNLOAD_PASSWORD_SHA256) ||
      normalizeText(process.env.ASC_DATA_DOWNLOAD_PASSWORD_SHA256),
    jwtSecret:
      normalizeText(process.env.ASC_PROJECT_DATA_DOWNLOAD_JWT_SECRET) ||
      normalizeText(process.env.ASC_DATA_DOWNLOAD_JWT_SECRET),
  };
}

function isAdminAuthConfigured(authConfig) {
  const config = authConfig && typeof authConfig === "object" ? authConfig : {};
  return Boolean(normalizeText(config.passwordSha256) && normalizeText(config.jwtSecret));
}

function readAdminBearerToken(request) {
  const authorization = normalizeText(getHeaderText(request?.headers, "authorization"));
  if (!authorization) {
    return "";
  }
  const matched = /^Bearer\s+(.+)$/i.exec(authorization);
  return matched ? normalizeText(matched[1]) : "";
}

function createAdminSessionToken(payload, options) {
  const config = options && typeof options === "object" ? options : {};
  const expiresInSeconds = Number.isFinite(Number(config.expiresInSeconds)) && Number(config.expiresInSeconds) > 0
    ? Math.floor(Number(config.expiresInSeconds))
    : ADMIN_SESSION_TTL_SECONDS;
  const signed = createSignedToken(
    Object.assign(
      {
        scope: "admin-session",
      },
      payload && typeof payload === "object" ? payload : {}
    ),
    normalizeText(config.jwtSecret),
    expiresInSeconds
  );
  return {
    token: signed.token,
    payload: signed.payload,
    expiresInSeconds,
    expiresAt: new Date(Number(signed.payload.exp || 0) * 1000).toISOString(),
  };
}

function verifyAdminSessionToken(token, options) {
  const config = options && typeof options === "object" ? options : {};
  const verified = verifySignedToken(
    token,
    normalizeText(config.jwtSecret),
    {
      errorPrefix: "admin-session",
    }
  );
  if (!verified.ok) {
    return verified;
  }
  if (normalizeText(verified.payload?.scope) !== "admin-session") {
    return {
      ok: false,
      code: "admin-session-token-invalid",
      message: "管理员会话 token 范围无效。",
    };
  }
  return verified;
}

function authenticateAdminRequest(options) {
  const config = options && typeof options === "object" ? options : {};
  const request = config.request;
  const authConfig = config.authConfig && typeof config.authConfig === "object"
    ? config.authConfig
    : getAdminAuthConfig();
  const sessionAuthConfig =
    config.sessionAuthConfig && typeof config.sessionAuthConfig === "object"
      ? config.sessionAuthConfig
      : authConfig;
  const passwordAuthReady = Boolean(normalizeText(authConfig.passwordSha256));
  const sessionAuthReady = Boolean(normalizeText(sessionAuthConfig.jwtSecret));
  if (!passwordAuthReady && !sessionAuthReady) {
    return {
      ok: false,
      code: "admin-auth-not-configured",
      message: "后端未配置管理员鉴权环境变量。",
    };
  }

  const password = String(config.password || "");
  if (normalizeText(password)) {
    if (!passwordAuthReady) {
      return {
        ok: false,
        code: "admin-auth-not-configured",
        message: "后端未配置管理员鉴权环境变量。",
      };
    }
    const passwordSha256 = createPasswordSha256(password);
    if (!timingSafeEqualHex(authConfig.passwordSha256, passwordSha256)) {
      return {
        ok: false,
        code: "admin-auth-password-invalid",
        message: "管理员密码错误。",
      };
    }
    return {
      ok: true,
      method: "password",
      payload: {
        scope: "password-direct",
      },
    };
  }

  const bearerToken = readAdminBearerToken(request);
  if (!bearerToken) {
    return {
      ok: false,
      code: "admin-auth-missing",
      message: "缺少管理员密码或会话 token。",
    };
  }

  const verified = verifyAdminSessionToken(bearerToken, {
    jwtSecret: sessionAuthConfig.jwtSecret,
  });
  if (!verified.ok) {
    return verified;
  }
  return {
    ok: true,
    method: "bearer",
    payload: verified.payload,
    token: bearerToken,
  };
}

module.exports = {
  ADMIN_SESSION_TTL_SECONDS,
  authenticateAdminRequest,
  createAdminSessionToken,
  createPasswordSha256,
  getAdminAuthConfig,
  isAdminAuthConfigured,
  readAdminBearerToken,
  verifyAdminSessionToken,
};

"use strict";

const crypto = require("crypto");

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(input) {
  const text = String(input || "").replace(/-/g, "+").replace(/_/g, "/");
  const paddingLength = text.length % 4 === 0 ? 0 : 4 - (text.length % 4);
  const padded = text + "=".repeat(paddingLength);
  return Buffer.from(padded, "base64").toString("utf8");
}

function createSha256Hex(text) {
  return crypto.createHash("sha256").update(String(text || ""), "utf8").digest("hex");
}

function timingSafeEqualHex(expectedHex, actualHex) {
  const expected = String(expectedHex || "").trim().toLowerCase();
  const actual = String(actualHex || "").trim().toLowerCase();
  if (!expected || !actual || expected.length !== actual.length) {
    return false;
  }
  const left = Buffer.from(expected, "utf8");
  const right = Buffer.from(actual, "utf8");
  return crypto.timingSafeEqual(left, right);
}

function signTokenPayload(payload, secret) {
  const header = {
    alg: "HS256",
    typ: "JWT",
  };
  const headerPart = base64UrlEncode(JSON.stringify(header));
  const payloadPart = base64UrlEncode(JSON.stringify(payload || {}));
  const signature = crypto
    .createHmac("sha256", String(secret || ""))
    .update(headerPart + "." + payloadPart)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return headerPart + "." + payloadPart + "." + signature;
}

function buildTokenPayload(data, expiresInSeconds) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const ttl = Number.isFinite(Number(expiresInSeconds)) && Number(expiresInSeconds) > 0
    ? Math.floor(Number(expiresInSeconds))
    : 120;
  const source = data && typeof data === "object" ? data : {};
  const payload = {};

  Object.keys(source).forEach(function assignKey(key) {
    if (key === "iat" || key === "exp" || key === "jti") {
      return;
    }
    payload[key] =
      typeof source[key] === "string"
        ? source[key]
        : source[key] === undefined || source[key] === null
          ? ""
          : String(source[key]);
  });

  payload.iat = nowSeconds;
  payload.exp = nowSeconds + ttl;
  payload.jti =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : crypto.randomBytes(16).toString("hex");
  return payload;
}

function createSignedToken(data, secret, expiresInSeconds) {
  const payload = buildTokenPayload(data || {}, expiresInSeconds);
  const token = signTokenPayload(payload, secret);
  return {
    token: token,
    payload: payload,
  };
}

function verifySignedToken(token, secret, options) {
  const config = options && typeof options === "object" ? options : {};
  const errorPrefix = String(config.errorPrefix || "project-data-download").trim() || "project-data-download";
  const rawToken = String(token || "").trim();
  if (!rawToken) {
    return {
      ok: false,
      code: errorPrefix + "-token-missing",
      message: "缺少下载 token。",
    };
  }
  const parts = rawToken.split(".");
  if (parts.length !== 3) {
    return {
      ok: false,
      code: errorPrefix + "-token-invalid",
      message: "下载 token 格式无效。",
    };
  }
  const signInput = parts[0] + "." + parts[1];
  const expectedSignature = crypto
    .createHmac("sha256", String(secret || ""))
    .update(signInput)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const actualSignature = String(parts[2] || "");
  if (expectedSignature.length !== actualSignature.length) {
    return {
      ok: false,
      code: errorPrefix + "-token-invalid",
      message: "下载 token 签名无效。",
    };
  }
  if (!crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(actualSignature))) {
    return {
      ok: false,
      code: errorPrefix + "-token-invalid",
      message: "下载 token 签名无效。",
    };
  }

  let payload = {};
  try {
    payload = JSON.parse(base64UrlDecode(parts[1]));
  } catch (error) {
    return {
      ok: false,
      code: errorPrefix + "-token-invalid",
      message: "下载 token 内容无效。",
    };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const exp = Number(payload?.exp);
  if (!Number.isFinite(exp) || exp <= nowSeconds) {
    return {
      ok: false,
      code: errorPrefix + "-token-expired",
      message: "下载 token 已过期。",
      payload: payload,
    };
  }

  return {
    ok: true,
    payload: payload,
  };
}

module.exports = {
  createSha256Hex,
  createSignedToken,
  timingSafeEqualHex,
  verifySignedToken,
};

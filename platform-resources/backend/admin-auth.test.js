"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  ADMIN_SESSION_TTL_SECONDS,
  authenticateAdminRequest,
  createAdminSessionToken,
  createPasswordSha256,
  verifyAdminSessionToken,
} = require("./admin-auth");

function createRequest(headers) {
  return {
    headers: headers || {},
  };
}

test("admin auth issues and verifies admin session token", function () {
  const issued = createAdminSessionToken(
    {
      operatorName: "傅成林",
    },
    {
      jwtSecret: "secret-admin-session",
    }
  );

  assert.equal(typeof issued.token, "string");
  assert.equal(issued.expiresInSeconds, ADMIN_SESSION_TTL_SECONDS);
  assert.ok(issued.expiresAt);

  const verified = verifyAdminSessionToken(issued.token, {
    jwtSecret: "secret-admin-session",
  });

  assert.equal(verified.ok, true);
  assert.equal(verified.payload.scope, "admin-session");
  assert.equal(verified.payload.operatorName, "傅成林");
});

test("admin auth accepts direct password request", function () {
  const result = authenticateAdminRequest({
    request: createRequest(),
    password: "download-pass",
    authConfig: {
      passwordSha256: createPasswordSha256("download-pass"),
      jwtSecret: "secret-admin-session",
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.method, "password");
});

test("admin auth accepts bearer token request", function () {
  const issued = createAdminSessionToken(
    {
      operatorName: "管理员",
    },
    {
      jwtSecret: "secret-admin-session",
    }
  );

  const result = authenticateAdminRequest({
    request: createRequest({
      authorization: "Bearer " + issued.token,
    }),
    authConfig: {
      passwordSha256: createPasswordSha256("download-pass"),
      jwtSecret: "secret-admin-session",
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.method, "bearer");
  assert.equal(result.payload.operatorName, "管理员");
});

test("admin auth rejects request without password or bearer token", function () {
  const result = authenticateAdminRequest({
    request: createRequest(),
    authConfig: {
      passwordSha256: createPasswordSha256("download-pass"),
      jwtSecret: "secret-admin-session",
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "admin-auth-missing");
});

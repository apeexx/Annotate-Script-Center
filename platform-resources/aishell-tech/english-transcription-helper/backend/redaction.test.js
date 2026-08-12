"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const redaction = require(path.resolve(__dirname, "redaction.js"));

function createJwtFixture() {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ sub: "123" })).toString("base64url");
  const signature = Buffer.from("safe-test-signature").toString("base64url");
  return [header, payload, signature].join(".");
}

test("English redaction removes complete JWTs from ordinary and serialized public fields", function () {
  const jwt = createJwtFixture();
  const sanitized = redaction.sanitizePublicPayload({
    value: "provider detail contains " + jwt,
    detail: jwt,
    nested: {
      values: [jwt],
      serialized: JSON.stringify({ detail: jwt }),
    },
    ordinaryVersion: "version.one.two",
  });
  const json = JSON.stringify(sanitized);

  assert.equal(sanitized.value, "[redacted-jwt]");
  assert.equal(sanitized.detail, "[redacted-jwt]");
  assert.equal(sanitized.nested.values[0], "[redacted-jwt]");
  assert.equal(sanitized.nested.serialized.detail, "[redacted-jwt]");
  assert.equal(sanitized.ordinaryVersion, "version.one.two");
  assert.equal(json.includes(jwt), false);
});

"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const registry = require(path.resolve(__dirname, "registry.js"));

test("project registry exposes the JD TTS Shanghai health route", function () {
  const registered = [];
  const router = new Proxy({}, {
    get: function (_target, method) {
      return function (route) { registered.push(String(method).toUpperCase() + " " + route); };
    },
  });
  registry.registerProjectRoutes(router, {});
  assert.ok(registered.includes("GET /api/jd-tts-annotation/shanghainese-helper/ai/recommend/health"));
});

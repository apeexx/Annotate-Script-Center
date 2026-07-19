"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { createRouter } = require("./router");
const { registerProjectRoutes } = require("./registry");

test("platform registry exposes the Cantonese Aishell direct endpoints", function () {
  const router = createRouter();
  registerProjectRoutes(router);
  const routes = router.routes.map(function (entry) {
    return entry.method + " " + entry.path;
  });

  assert.ok(routes.includes("GET /api/aishell-tech/cantonese-helper/ai/recommend/health"));
  assert.ok(routes.includes("GET /api/aishell-tech/cantonese-helper/ai/recommend/defaults"));
  assert.ok(routes.includes("POST /api/aishell-tech/cantonese-helper/ai/recommend"));
});

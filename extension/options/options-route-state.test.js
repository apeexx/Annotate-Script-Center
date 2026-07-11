"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildOptionsRouteHref,
  parseOptionsRoute,
} = require("./options-route-state");

const scriptLibrary = {
  judgement: {
    label: "普通话语音判别",
  },
  dataBakerRoundOneQuality: {
    label: "标贝易采一检质检",
  },
};

test("options route defaults to public center", function () {
  const route = parseOptionsRoute("", scriptLibrary);

  assert.equal(route.view, "center");
  assert.equal(route.scriptId, null);
  assert.equal(route.adminTab, "overview");
});

test("options route resolves public download center view", function () {
  const route = parseOptionsRoute("?view=downloads", scriptLibrary);

  assert.equal(route.view, "downloads");
  assert.equal(route.scriptId, null);
  assert.equal(route.adminTab, "overview");
});

test("options route resolves script detail view from query", function () {
  const route = parseOptionsRoute("?view=script&script=judgement", scriptLibrary);

  assert.equal(route.view, "script");
  assert.equal(route.scriptId, "judgement");
  assert.equal(route.adminTab, "overview");
});

test("options route falls back to overview tab for invalid admin tab", function () {
  const route = parseOptionsRoute("?view=admin&tab=unknown", scriptLibrary);

  assert.equal(route.view, "admin");
  assert.equal(route.adminTab, "overview");
});

test("options route aliases stats tab to overview for legacy links", function () {
  const route = parseOptionsRoute("?view=admin&tab=stats", scriptLibrary);

  assert.equal(route.view, "admin");
  assert.equal(route.adminTab, "overview");
});

test("options route aliases legacy downloads tab to exports", function () {
  const route = parseOptionsRoute("?view=admin&tab=downloads", scriptLibrary);

  assert.equal(route.view, "admin");
  assert.equal(route.adminTab, "exports");
});

test("options route builds href with admin tab and without stale script query", function () {
  const href = buildOptionsRouteHref(
    "chrome-extension://extension-id/options/options.html?view=script&script=judgement",
    {
      view: "admin",
      adminTab: "overview",
    }
  );

  assert.equal(
    href,
    "chrome-extension://extension-id/options/options.html?view=admin&tab=overview"
  );
});

test("options route builds href for public download center", function () {
  const href = buildOptionsRouteHref(
    "chrome-extension://extension-id/options/options.html?view=center",
    {
      view: "downloads",
    }
  );

  assert.equal(
    href,
    "chrome-extension://extension-id/options/options.html?view=downloads"
  );
});

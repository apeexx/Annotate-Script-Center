"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildDefaultLatestJsonUrl,
  FALLBACK_DOWNLOAD_BASE_URL,
  loadAdminDownloadCenterReleases,
  parseDirectoryIndex,
  resolveDownloadBaseUrl,
} = require("./releases");

test("parseDirectoryIndex merges crx and zip files by version", function () {
  const html = [
    '<a href="annotation-script-center-v0.4.0.crx">annotation-script-center-v0.4.0.crx</a>',
    '<a href="annotation-script-center-v0.4.0.zip">annotation-script-center-v0.4.0.zip</a>',
    '<a href="annotation-script-center-v0.3.7.crx">annotation-script-center-v0.3.7.crx</a>',
  ].join("\n");
  const items = parseDirectoryIndex(html, "https://script.xiangtianzhen.store/downloads/");
  assert.equal(items.length, 2);
  assert.equal(items[0].version, "0.4.0");
  assert.match(items[0].crxUrl, /v0\.4\.0\.crx$/);
  assert.match(items[0].zipUrl, /v0\.4\.0\.zip$/);
  assert.equal(items[1].version, "0.3.7");
});

test("loadAdminDownloadCenterReleases returns latest and directory history", async function () {
  let fetchCount = 0;
  const result = await loadAdminDownloadCenterReleases({
    latestJsonUrl: "https://example.test/downloads/annotation-script-center-crx-latest.json",
    directoryIndexUrl: "https://example.test/downloads/",
    fetchImpl: async function fetchImpl(url) {
      fetchCount += 1;
      if (/crx-latest\.json$/.test(url)) {
        return {
          ok: true,
          json: async function () {
            return {
              latest_version: "0.4.0",
              download_url: "https://example.test/downloads/annotation-script-center-v0.4.0.crx",
              zip_download_url: "https://example.test/downloads/annotation-script-center-v0.4.0.zip",
              created_at: "2026-06-02T12:00:00.000Z",
            };
          },
        };
      }
      return {
        ok: true,
        text: async function () {
          return [
            '<a href="annotation-script-center-v0.4.0.crx">0.4.0 crx</a>',
            '<a href="annotation-script-center-v0.4.0.zip">0.4.0 zip</a>',
            '<a href="annotation-script-center-v0.3.7.crx">0.3.7 crx</a>',
          ].join("\n");
        },
      };
    },
  });
  assert.equal(fetchCount, 2);
  assert.equal(result.latestVersion, "0.4.0");
  assert.equal(result.source.usedFallback, false);
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].isLatest, true);
  assert.equal(result.items[0].createdAt, "2026-06-02T12:00:00.000Z");
  assert.match(result.items[1].crxUrl, /v0\.3\.7\.crx$/);
});

test("loadAdminDownloadCenterReleases falls back to latest when directory fetch fails", async function () {
  const result = await loadAdminDownloadCenterReleases({
    latestJsonUrl: "https://example.test/downloads/annotation-script-center-crx-latest.json",
    directoryIndexUrl: "https://example.test/downloads/",
    fetchImpl: async function fetchImpl(url) {
      if (/crx-latest\.json$/.test(url)) {
        return {
          ok: true,
          json: async function () {
            return {
              latest_version: "0.4.0",
              download_url: "https://example.test/downloads/annotation-script-center-v0.4.0.crx",
              zip_download_url: "",
              created_at: "2026-06-02T12:00:00.000Z",
            };
          },
        };
      }
      throw new Error("network disabled");
    },
  });
  assert.equal(result.latestVersion, "0.4.0");
  assert.equal(result.source.usedFallback, true);
  assert.match(result.source.fallbackReason, /network disabled/);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].version, "0.4.0");
});

test("resolveDownloadBaseUrl prefers explicit option and normalizes trailing slash", function () {
  assert.equal(
    resolveDownloadBaseUrl({ downloadBaseUrl: "http://47.109.197.170/downloads" }),
    "http://47.109.197.170/downloads/"
  );
  assert.equal(
    buildDefaultLatestJsonUrl("http://47.109.197.170/downloads/"),
    "http://47.109.197.170/downloads/annotation-script-center-crx-latest.json"
  );
  assert.equal(resolveDownloadBaseUrl({}), FALLBACK_DOWNLOAD_BASE_URL);
});

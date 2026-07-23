"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const cache = require(path.resolve(__dirname, "cache.js"));

test("JD TTS cache clears expired entries before reads and caps retained entries", function () {
  let now = 100;
  const store = cache.createRecommendCache({ ttlMs: 10, maxEntries: 2, now: function () { return now; } });
  store.set("expired", { value: 1 });
  now = 111;
  store.set("first", { value: 2 });
  store.set("second", { value: 3 });
  store.set("third", { value: 4 });

  assert.equal(store.get("expired"), null);
  assert.equal(store.size(), 2);
  assert.deepEqual(store.get("second"), { value: 3 });
  assert.deepEqual(store.get("third"), { value: 4 });
});

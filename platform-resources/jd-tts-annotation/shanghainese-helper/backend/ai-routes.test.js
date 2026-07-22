"use strict";

const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const path = require("node:path");
const test = require("node:test");

const routes = require(path.resolve(__dirname, "ai-routes.js"));

test("JD TTS Shanghai registers health, defaults, recommend, and job lifecycle routes", function () {
  const registered = [];
  routes.createRecommendRouteRuntime().registerAiRoutes({
    get: function (route) { registered.push("GET " + route); },
    post: function (route) { registered.push("POST " + route); },
  });

  assert.deepEqual(registered, [
    "GET /api/jd-tts-annotation/shanghainese-helper/ai/recommend/health",
    "GET /api/jd-tts-annotation/shanghainese-helper/ai/recommend/defaults",
    "POST /api/jd-tts-annotation/shanghainese-helper/ai/recommend",
    "POST /api/jd-tts-annotation/shanghainese-helper/ai/recommend/jobs",
    "GET /api/jd-tts-annotation/shanghainese-helper/ai/recommend/jobs/:jobId",
    "GET /api/jd-tts-annotation/shanghainese-helper/ai/recommend/jobs/:jobId/debug",
    "POST /api/jd-tts-annotation/shanghainese-helper/ai/recommend/jobs/:jobId/cancel",
  ]);
});

test("JD TTS Shanghai debug sanitizer redacts audio data and source URLs", function () {
  const sanitized = routes.sanitizeDebugPayload({
    audioDataUrl: "data:audio/x-wav;base64,UklGRg==",
    audioUrl: "https://private.example.test/audio.wav?signature=private",
    nested: { cookie: "private-cookie" },
  });
  const serialized = JSON.stringify(sanitized);
  assert.doesNotMatch(serialized, /data:audio|private\.example|private-cookie/i);
});

test("JD TTS Shanghai stops reading an oversized request body before later chunks", async function () {
  const request = new EventEmitter();
  const response = {};
  let resumed = false;
  request.resume = function () { resumed = true; };
  const runtime = routes.createRecommendRouteRuntime({
    sendJson: function (target, statusCode, body) {
      target.statusCode = statusCode;
      target.body = body;
    },
  });

  process.nextTick(function () {
    request.emit("data", Buffer.alloc(3 * 1024 * 1024 + 1, 0x61));
    request.emit("data", Buffer.from("must-not-be-buffered"));
    request.emit("end");
  });
  await runtime.handleRecommend({ request, response });

  assert.equal(resumed, true);
  assert.equal(response.statusCode, 413);
  assert.equal(response.body.error.code, "payload-too-large");
  assert.equal(request.listenerCount("data"), 0);
});

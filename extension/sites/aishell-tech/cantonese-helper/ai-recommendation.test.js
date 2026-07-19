"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const jobClient = require(path.resolve(__dirname, "../../../shared/ai-job-client.js"));
const recommendation = require("./ai-recommendation.js");

function createJsonResponse(body, statusCode) {
  const status = Number(statusCode || 200);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async function () {
      return JSON.stringify(body);
    },
  };
}

test("Aishell Cantonese sends the single raw-listen aiOmni contract to jobs", function () {
  const source = fs.readFileSync(path.resolve(__dirname, "ai-recommendation.js"), "utf8");
  const start = source.indexOf("function createRequestBody(item)");
  const end = source.indexOf("async function sendRequest", start);
  const block = source.slice(start, end);

  assert.match(block, /aiOmni/);
  assert.doesNotMatch(block, /aiStages/);
  assert.doesNotMatch(block, /convert:/);
  assert.doesNotMatch(block, /compare:/);
});

test("Aishell Cantonese cancels an already-created batch job after stop aborts its request", async function () {
  const controller = new AbortController();
  const requests = [];
  const runtime = recommendation.createRuntime({
    endpoint: "http://127.0.0.1:3333/api/aishell-tech/cantonese-helper/ai/recommend",
    fetchImpl: async function (url, init) {
      requests.push({ url, method: init?.method || "GET", body: init?.body });
      if (url.endsWith("/jobs")) {
        setTimeout(function () {
          controller.abort();
        }, 10);
        return createJsonResponse({
          success: true,
          jobId: "cantonese-job-1",
          status: "queued",
        }, 202);
      }
      if (url.endsWith("/jobs/cantonese-job-1/cancel")) {
        return createJsonResponse({
          success: true,
          jobId: "cantonese-job-1",
          status: "cancelled",
          data: {},
        });
      }
      throw new Error("unexpected request: " + url);
    },
    jobClient,
    settings: {
      meta: {
        aiUsageOperatorName: "test-operator",
      },
    },
  });

  await assert.rejects(
    runtime.recommend(
      {
        taskId: "task-1",
        packageId: "package-1",
        taskItemId: "item-1",
        audioUrl: "https://example.test/audio.wav",
        audioDataUrl: "data:audio/wav;base64,UklGRg==",
        regionId: "region-1",
        segmentNumber: 1,
        startMs: 1830,
        endMs: 2990,
        durationMs: 1160,
        selectionKey: "region-1:1830-2990",
      },
      { signal: controller.signal }
    ),
    function (error) {
      return error?.code === "user-aborted";
    }
  );

  assert.deepEqual(
    requests.map(function (entry) {
      return [
        entry.method,
        entry.url.replace("http://127.0.0.1:3333", ""),
        entry.body === undefined ? undefined : JSON.parse(entry.body).taskId,
      ];
    }),
    [
      ["POST", "/api/aishell-tech/cantonese-helper/ai/recommend/jobs", "task-1"],
      ["POST", "/api/aishell-tech/cantonese-helper/ai/recommend/jobs/cantonese-job-1/cancel", undefined],
    ]
  );
});

test("Aishell Cantonese sends only the cropped WAV together with the selected segment identity", async function () {
  let receivedBody = null;
  const runtime = recommendation.createRuntime({
    endpoint: "http://127.0.0.1:3333/api/aishell-tech/cantonese-helper/ai/recommend",
    jobClient: {
      runJobLifecycle: async function (input) {
        receivedBody = input.body;
        return {
          data: {
            listenText: "聽到嘅片段",
            meta: {},
          },
        };
      },
    },
    settings: {
      meta: {
        aiUsageOperatorName: "test-operator",
      },
    },
  });

  await runtime.recommend({
    taskId: "task-1",
    packageId: "package-1",
    taskItemId: "item-1",
    audioUrl: "https://example.test/original.wav",
    audioDataUrl: "data:audio/wav;base64,UklGRg==",
    regionId: "region-3",
    segmentNumber: 3,
    startMs: 4650,
    endMs: 5120,
    durationMs: 470,
    selectionKey: "region-3:4650-5120",
  });

  assert.equal(receivedBody.audioDataUrl, "data:audio/wav;base64,UklGRg==");
  assert.equal(receivedBody.regionId, "region-3");
  assert.equal(receivedBody.segmentNumber, 3);
  assert.equal(receivedBody.startMs, 4650);
  assert.equal(receivedBody.endMs, 5120);
  assert.equal(receivedBody.durationMs, 470);
  assert.equal(receivedBody.selectionKey, "region-3:4650-5120");
});

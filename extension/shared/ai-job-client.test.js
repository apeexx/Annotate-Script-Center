"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const client = require("./ai-job-client.js");

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

test("AI job lifecycle notifies the backend to cancel an already-created job", async function () {
  const controller = new AbortController();
  const requests = [];

  await assert.rejects(
    client.runJobLifecycle({
      endpoint: "http://127.0.0.1:3333/api/example/ai/recommend",
      body: { requestId: "client-test" },
      signal: controller.signal,
      pollIntervalMs: 100,
      fetchImpl: async function (url, init) {
        requests.push({ url, method: init?.method || "GET" });
        if (url.endsWith("/jobs")) {
          setTimeout(function () {
            controller.abort();
          }, 10);
          return createJsonResponse({ success: true, jobId: "job-1", status: "queued" }, 202);
        }
        if (url.endsWith("/jobs/job-1/cancel")) {
          return createJsonResponse({ success: true, jobId: "job-1", status: "failed" });
        }
        throw new Error("unexpected request: " + url);
      },
    }),
    function (error) {
      return error?.code === "user-aborted";
    }
  );

  assert.deepEqual(
    requests.map(function (entry) {
      return [entry.method, entry.url.replace("http://127.0.0.1:3333", "")];
    }),
    [
      ["POST", "/api/example/ai/recommend/jobs"],
      ["POST", "/api/example/ai/recommend/jobs/job-1/cancel"],
    ]
  );
});

test("AI job lifecycle reports create and poll phases without exposing job data", async function () {
  const phases = [];
  let pollCount = 0;

  const result = await client.runJobLifecycle({
    endpoint: "http://127.0.0.1:3333/api/example/ai/recommend",
    body: { requestId: "client-test" },
    pollIntervalMs: 1,
    onPhase: function (phase) { phases.push(phase); },
    fetchImpl: async function (url) {
      if (url.endsWith("/jobs")) {
        return createJsonResponse({ success: true, jobId: "job-1", status: "queued" }, 202);
      }
      if (url.endsWith("/jobs/job-1")) {
        pollCount += 1;
        return createJsonResponse({ success: true, jobId: "job-1", status: "succeeded", data: { listenText: "ok" } });
      }
      throw new Error("unexpected request: " + url);
    },
  });

  assert.equal(pollCount, 1);
  assert.deepEqual(phases, ["create", "poll"]);
  assert.deepEqual(result.data, { listenText: "ok" });
});

"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createConcurrentAiRequestStream,
} = require("./concurrent-ai-request-stream");

function wait(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise(function (innerResolve, innerReject) {
    resolve = innerResolve;
    reject = innerReject;
  });
  return {
    promise,
    resolve,
    reject,
  };
}

test("concurrent AI request stream fills the front window first and keeps 50ms spacing", async function () {
  const deferreds = Array.from({ length: 5 }, createDeferred);
  const started = [];
  const stream = createConcurrentAiRequestStream({
    tasks: ["A", "B", "C", "D", "E"],
    concurrency: 3,
    staggerMs: 50,
    runTask: function (task, index) {
      started.push({
        task: task,
        index: index,
        at: Date.now(),
      });
      return deferreds[index].promise;
    },
  });

  await wait(140);

  assert.deepEqual(
    started.map(function (entry) {
      return entry.task;
    }),
    ["A", "B", "C"]
  );
  assert.ok(started[1].at - started[0].at >= 45);
  assert.ok(started[2].at - started[1].at >= 45);
  assert.equal(stream.getSnapshot().launchedCount, 3);
  assert.equal(stream.getSnapshot().activeAiCount, 3);

  deferreds.forEach(function (deferred, index) {
    deferred.resolve("done-" + String(index));
  });
  await stream.whenProducersDone;
});

test("concurrent AI request stream refills immediately after AI completion and keeps completion order", async function () {
  const deferreds = Array.from({ length: 5 }, createDeferred);
  const started = [];
  const stream = createConcurrentAiRequestStream({
    tasks: ["A", "B", "C", "D", "E"],
    concurrency: 3,
    staggerMs: 50,
    runTask: function (task, index) {
      started.push(task);
      return deferreds[index].promise;
    },
  });

  await wait(140);
  assert.deepEqual(started, ["A", "B", "C"]);

  deferreds[1].resolve("result-B");
  await wait(80);
  assert.deepEqual(started, ["A", "B", "C", "D"]);

  deferreds[0].resolve("result-A");
  deferreds[2].resolve("result-C");
  deferreds[3].resolve("result-D");
  deferreds[4].resolve("result-E");

  const firstResult = await stream.nextResult();
  const secondResult = await stream.nextResult();

  assert.equal(firstResult.ok, true);
  assert.equal(firstResult.task, "B");
  assert.equal(firstResult.value, "result-B");
  assert.equal(secondResult.ok, true);
  assert.equal(secondResult.task, "A");
  assert.equal(secondResult.value, "result-A");

  await stream.whenProducersDone;
});

test("Aishell-style batch stream allows out-of-order results and stops launching new AI requests after cancelPending", async function () {
  const deferreds = Array.from({ length: 20 }, createDeferred);
  const started = [];
  const stream = createConcurrentAiRequestStream({
    tasks: Array.from({ length: 20 }, function (_, index) {
      return {
        displayName: "第 " + String(index + 1) + " 条",
      };
    }),
    concurrency: 15,
    staggerMs: 50,
    runTask: function (task, index) {
      started.push(index);
      return deferreds[index].promise;
    },
  });

  await wait(980);
  assert.equal(started.length, 15);

  deferreds[1].resolve({ recommendedText: "2号先返回" });
  const firstResult = await stream.nextResult();
  assert.equal(firstResult.ok, true);
  assert.equal(firstResult.index, 1);

  stream.cancelPending("批量识别已手动停止。");

  for (let index = 0; index < 15; index += 1) {
    if (index !== 1) {
      deferreds[index].resolve({ recommendedText: String(index + 1) + "号完成" });
    }
  }

  await stream.whenProducersDone;

  assert.equal(started.length, 15);
  assert.equal(stream.getSnapshot().remainingToLaunchCount, 5);
  assert.equal(stream.getSnapshot().cancelled, true);
});

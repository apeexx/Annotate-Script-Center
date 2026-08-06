"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const modulePath = path.resolve(__dirname, "timeline-timer.js");

function loadApi() {
  if (!fs.existsSync(modulePath)) {
    return {};
  }
  const context = { globalThis: {}, console };
  context.globalThis.globalThis = context.globalThis;
  vm.runInNewContext(fs.readFileSync(modulePath, "utf8"), context, { filename: modulePath });
  return context.globalThis.ASREdgePulseTimelineTimer || {};
}

test("轨道像素可换算为 30fps 的起止帧、时长和时间码", function () {
  const api = loadApi();
  assert.equal(typeof api.calculateSegmentTime, "function");
  const result = api.calculateSegmentTime({
    left: 100,
    width: 200,
    trackWidth: 800,
    totalFrames: 3980,
    frameRate: 30,
  });

  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    status: "ready",
    startFrame: 498,
    endFrame: 1493,
    durationFrames: 995,
    startTimecode: "00:00:16:18",
    endTimecode: "00:00:49:23",
    durationTimecode: "00:00:33:05",
  });
});

test("拖动变化值使用基线片段时长并显示正负号", function () {
  const api = loadApi();
  assert.equal(typeof api.calculateDurationDelta, "function");
  assert.equal(api.calculateDurationDelta(1020, 995), "+00:00:00:25");
  assert.equal(api.calculateDurationDelta(960, 995), "-00:00:01:05");
});

test("没有有效轨道、总帧数或帧率时安全降级", function () {
  const api = loadApi();
  assert.equal(typeof api.calculateSegmentTime, "function");
  [
    { left: 0, width: 20, trackWidth: 0, totalFrames: 3980, frameRate: 30 },
    { left: 0, width: 20, trackWidth: 800, totalFrames: 0, frameRate: 30 },
    { left: 0, width: 20, trackWidth: 800, totalFrames: 3980, frameRate: 0 },
  ].forEach(function (input) {
    assert.deepEqual(JSON.parse(JSON.stringify(api.calculateSegmentTime(input))), {
      status: "unavailable",
      reason: "时间信息待加载",
    });
  });
});

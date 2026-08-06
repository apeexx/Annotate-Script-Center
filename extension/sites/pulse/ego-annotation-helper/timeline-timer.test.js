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

test("左下角分段长度和边界变化统一使用秒数显示", function () {
  const api = loadApi();
  assert.equal(typeof api.formatDurationSeconds, "function");
  assert.equal(typeof api.calculateDurationDeltaSeconds, "function");
  assert.equal(api.formatDurationSeconds(141, 30), "4.7s");
  assert.equal(api.calculateDurationDeltaSeconds(150, 141, 30), "+0.3s");
  assert.equal(api.calculateDurationDeltaSeconds(132, 141, 30), "-0.3s");
});

test("右侧拖动每次位移都会立即生成新的片段预览和时间码", function () {
  const api = loadApi();
  assert.equal(typeof api.calculateDragPreview, "function");
  const preview = api.calculateDragPreview({
    left: 100,
    width: 200,
    delta: 40,
    mode: "end",
    trackWidth: 800,
  });

  assert.deepEqual(JSON.parse(JSON.stringify(preview)), { left: 100, width: 240 });
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(
        api.calculateSegmentTime({
          ...preview,
          trackWidth: 800,
          totalFrames: 3980,
          frameRate: 30,
        })
      )
    ),
    {
      status: "ready",
      startFrame: 498,
      endFrame: 1692,
      durationFrames: 1194,
      startTimecode: "00:00:16:18",
      endTimecode: "00:00:56:12",
      durationTimecode: "00:00:39:24",
    }
  );
});

test("只有分段框左右边界会进入切点拖动，框中间和进度条不参与预览", function () {
  const api = loadApi();
  assert.equal(typeof api.getDragMode, "function");
  const segment = {
    getBoundingClientRect: () => ({ left: 100, width: 60 }),
  };

  assert.equal(api.getDragMode(segment, { clientX: 102 }), "start");
  assert.equal(api.getDragMode(segment, { clientX: 158 }), "end");
  assert.equal(api.getDragMode(segment, { clientX: 130 }), null);
  assert.equal(api.getDragMode(null, { clientX: 130 }), null);
  assert.equal(
    api.calculateDragPreview({ left: 100, width: 60, delta: 20, mode: "move", trackWidth: 800 }),
    null
  );
});

test("相邻的分段端点拖拽柄也能锁定对应分段并在移动中预览", function () {
  const api = loadApi();
  assert.equal(typeof api.findSegmentBoundary, "function");
  const segment = {
    nodeType: 1,
    style: { left: "100px", width: "60px" },
    classList: { contains: (name) => name === "absolute" || name === "overflow-hidden" },
    getBoundingClientRect: () => ({ left: 100, width: 60 }),
  };
  const track = { children: [segment] };
  const boundary = api.findSegmentBoundary(track, { clientX: 160, target: {} });

  assert.equal(boundary.segment, segment);
  assert.equal(boundary.mode, "end");
  assert.equal(api.findSegmentBoundary(track, { clientX: 130, target: {} }), null);
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

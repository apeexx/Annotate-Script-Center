"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const modulePath = path.resolve(__dirname, "cn-en-short-drama", "ui-panel.js");

function loadModule() {
  delete require.cache[modulePath];
  delete globalThis.__ASREdgeAishellTechCnEnShortDramaUiPanelInstalled;
  delete globalThis.__ASREdgeAishellTechCnEnShortDramaUiPanel;
  const api = require(modulePath);
  return {
    api,
    cleanup: function () {
      delete require.cache[modulePath];
      delete globalThis.__ASREdgeAishellTechCnEnShortDramaUiPanelInstalled;
      delete globalThis.__ASREdgeAishellTechCnEnShortDramaUiPanel;
    },
  };
}

test("cn-en short drama panel rows include title template duration segments video and audio", function () {
  const harness = loadModule();

  try {
    assert.deepEqual(
      harness.api.__test__.buildMediaRows({
        title: "7659251845881188147",
        template: "7628929157338042146",
        durationText: "78.739 秒",
        segmentCount: "38",
        videoUrl: "https://media.example.com/video.mp4",
        audioUrl: "https://media.example.com/audio.wav",
        hasVideo: true,
      }),
      [
        ["题目", "7659251845881188147"],
        ["模板", "7628929157338042146"],
        ["总时长", "78.739 秒"],
        ["分段数", "38"],
        ["视频", "https://media.example.com/video.mp4"],
        ["音频", "https://media.example.com/audio.wav"],
      ]
    );
  } finally {
    harness.cleanup();
  }
});

test("cn-en short drama panel shows 暂无视频 when video is missing", function () {
  const harness = loadModule();

  try {
    assert.deepEqual(
      harness.api.__test__.buildMediaRows({
        title: "t",
        template: "tpl",
        durationText: "1.000 秒",
        segmentCount: "1",
        videoUrl: "",
        audioUrl: "https://media.example.com/audio.wav",
        hasVideo: false,
      })[4],
      ["视频", "暂无视频"]
    );
  } finally {
    harness.cleanup();
  }
});

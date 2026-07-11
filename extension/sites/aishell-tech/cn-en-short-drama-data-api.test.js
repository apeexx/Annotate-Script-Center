"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const dataApiModulePath = path.resolve(
  __dirname,
  "cn-en-short-drama",
  "data-api.js"
);

function loadApi() {
  delete require.cache[dataApiModulePath];
  delete globalThis.__ASREdgeAishellTechCnEnShortDramaDataApiInstalled;
  delete globalThis.__ASREdgeAishellTechCnEnShortDramaDataApi;
  const api = require(dataApiModulePath);
  return {
    api,
    cleanup: function () {
      delete require.cache[dataApiModulePath];
      delete globalThis.__ASREdgeAishellTechCnEnShortDramaDataApiInstalled;
      delete globalThis.__ASREdgeAishellTechCnEnShortDramaDataApi;
    },
  };
}

test("cn-en short drama media info extracts title template duration segment count audio and video", function () {
  const harness = loadApi();

  try {
    const media = harness.api.extractCurrentMediaInfo(
      {
        dataRoot: "https://media.example.com/root",
        title: "7659251845881188147",
        templateName: "7628929157338042146",
        duration: 78.739,
      },
      [
        { id: "item-1", url: "/audio/001.wav" },
        {
          id: "item-2",
          url: "/audio/002.wav",
          videoUrl: "https://media.example.com/video/002.mp4",
        },
      ],
      1,
      {
        title: "",
        template: "",
        segmentCount: "",
      }
    );

    assert.deepEqual(media, {
      title: "7659251845881188147",
      template: "7628929157338042146",
      durationText: "78.739 秒",
      segmentCount: "2",
      videoUrl: "https://media.example.com/video/002.mp4",
      audioUrl: "https://media.example.com/root/audio/002.wav",
      hasVideo: true,
    });
  } finally {
    harness.cleanup();
  }
});

test("cn-en short drama media info keeps video empty when no stable video field exists", function () {
  const harness = loadApi();

  try {
    const media = harness.api.extractCurrentMediaInfo(
      {
        dataRoot: "https://media.example.com/root",
        title: "",
        templateName: "",
        duration: 78.739,
      },
      [{ id: "item-1", url: "/audio/001.wav" }],
      0,
      {
        title: "fallback-title",
        template: "fallback-template",
        segmentCount: "1",
      }
    );

    assert.equal(media.title, "fallback-title");
    assert.equal(media.template, "fallback-template");
    assert.equal(media.durationText, "78.739 秒");
    assert.equal(media.segmentCount, "1");
    assert.equal(media.videoUrl, "");
    assert.equal(media.audioUrl, "https://media.example.com/root/audio/001.wav");
    assert.equal(media.hasVideo, false);
  } finally {
    harness.cleanup();
  }
});

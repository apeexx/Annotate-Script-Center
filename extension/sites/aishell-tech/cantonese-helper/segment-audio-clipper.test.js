"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const modulePath = path.resolve(__dirname, "segment-audio-clipper.js");

function loadApi() {
  delete require.cache[modulePath];
  delete globalThis.__ASREdgeAishellTechCantoneseSegmentAudioClipperInstalled;
  delete globalThis.__ASREdgeAishellTechCantoneseSegmentAudioClipper;
  const api = require(modulePath);
  return {
    api,
    cleanup: function () {
      delete require.cache[modulePath];
      delete globalThis.__ASREdgeAishellTechCantoneseSegmentAudioClipperInstalled;
      delete globalThis.__ASREdgeAishellTechCantoneseSegmentAudioClipper;
    },
  };
}

function createRegion(id, label, title, left, width) {
  return {
    style: {
      left: String(left) + "px",
      width: String(width) + "px",
    },
    getAttribute: function (name) {
      return {
        "data-id": id,
        "data-region-label": label,
        title: title,
      }[name] || null;
    },
  };
}

test("Aishell Cantonese maps the selected region by DOM order and preserves millisecond boundaries", function () {
  const harness = loadApi();
  try {
    const segment = harness.api.resolveSegmentSnapshot({
      regions: [
        createRegion("region-1", "1", "0:01-0:02", 183, 116),
        createRegion("region-2", "2", "0:03-0:06", 315, 336),
      ],
      selectedSegmentNumber: 1,
      selectedDurationMs: 1160,
    });

    assert.deepEqual(segment, {
      regionId: "region-1",
      regionLabel: "1",
      segmentNumber: 1,
      startMs: 1830,
      endMs: 2990,
      durationMs: 1160,
      selectionKey: "region-1:1830-2990",
    });
  } finally {
    harness.cleanup();
  }
});

function createMarkDocument(regions, selectedNumber, selectedDurationSeconds) {
  return {
    querySelector: function (selector) {
      return selector === "button.regionSelected" ? { textContent: String(selectedNumber) } : null;
    },
    querySelectorAll: function (selector) {
      return selector === "wave > region.wavesurfer-region" ? regions : [];
    },
    body: {
      textContent:
        "当前选择：" + String(selectedNumber) + " 截取时长：" + String(selectedDurationSeconds) + "s",
    },
  };
}

test("Aishell Cantonese resolves the numbered segment when speaker overlays surround it", function () {
  const harness = loadApi();
  try {
    const documentLike = createMarkDocument(
      [
        createRegion("speaker-s1", "说话人S1:1", "0:04-0:05", 465, 47),
        createRegion("region-1", "1", "0:01-0:02", 183, 116),
        createRegion("speaker-s2", "说话人S2:2", "0:06-0:07", 630, 50),
        createRegion("region-2", "2", "0:03-0:06", 315, 336),
        createRegion("speaker-s3", "说话人S3:2", "0:07-0:08", 730, 50),
      ],
      1,
      1.16
    );

    const segment = harness.api.getCurrentSegment(documentLike);
    const catalog = harness.api.getSegmentCatalog(documentLike);

    assert.equal(segment.regionId, "region-1");
    assert.equal(segment.segmentNumber, 1);
    assert.equal(segment.selectionKey, "region-1:1830-2990");
    assert.deepEqual(
      catalog.map(function (entry) {
        return entry.regionId;
      }),
      ["region-1", "region-2"]
    );
  } finally {
    harness.cleanup();
  }
});

test("Aishell Cantonese rejects duplicate numeric region labels", function () {
  const harness = loadApi();
  try {
    const documentLike = createMarkDocument(
      [
        createRegion("region-1", "1", "0:01-0:02", 183, 116),
        createRegion("region-1-copy", "1", "0:03-0:06", 315, 336),
      ],
      1,
      1.16
    );

    assert.throws(function () {
      harness.api.getSegmentCatalog(documentLike);
    }, /编号/);
  } finally {
    harness.cleanup();
  }
});

test("Aishell Cantonese rejects missing numeric region labels", function () {
  const harness = loadApi();
  try {
    const documentLike = createMarkDocument(
      [
        createRegion("region-1", "1", "0:01-0:02", 183, 116),
        createRegion("region-3", "3", "0:03-0:06", 315, 336),
      ],
      1,
      1.16
    );

    assert.throws(function () {
      harness.api.getSegmentCatalog(documentLike);
    }, /编号/);
  } finally {
    harness.cleanup();
  }
});

test("Aishell Cantonese rejects an inconsistent selected duration instead of guessing a whole-audio range", function () {
  const harness = loadApi();
  try {
    assert.throws(
      function () {
        harness.api.resolveSegmentSnapshot({
          regions: [createRegion("region-1", "1", "0:01-0:02", 183, 116)],
          selectedSegmentNumber: 1,
          selectedDurationMs: 0,
        });
      },
      /截取时长/
    );
  } finally {
    harness.cleanup();
  }
});

test("Aishell Cantonese decodes one source buffer for concurrent cropped segments", async function () {
  const harness = loadApi();
  const previousBtoa = globalThis.btoa;
  let fetchCount = 0;
  class FakeAudioContext {
    async decodeAudioData() {
      return { duration: 10 };
    }
    close() {}
  }
  class FakeOfflineAudioContext {
    constructor(_channels, _length, sampleRate) {
      this.destination = {};
      this.sampleRate = sampleRate;
    }
    createBufferSource() {
      return { connect() {}, start() {} };
    }
    async startRendering() {
      return {
        sampleRate: this.sampleRate,
        getChannelData() {
          return new Float32Array([0, 0.25, -0.25, 0]);
        },
      };
    }
  }
  try {
    globalThis.btoa = function (value) {
      return Buffer.from(value, "binary").toString("base64");
    };
    const session = harness.api.createAudioClipSession("https://audio.example.test/source.wav", {
      fetchImpl: async function () {
        fetchCount += 1;
        return { ok: true, arrayBuffer: async function () { return new ArrayBuffer(16); } };
      },
      AudioContextClass: FakeAudioContext,
      OfflineAudioContextClass: FakeOfflineAudioContext,
    });
    const [first, second] = await Promise.all([
      session.createAudioDataUrl({ startMs: 0, endMs: 500 }),
      session.createAudioDataUrl({ startMs: 500, endMs: 1000 }),
    ]);

    assert.equal(fetchCount, 1);
    assert.match(first, /^data:audio\/wav;base64,/);
    assert.match(second, /^data:audio\/wav;base64,/);
  } finally {
    globalThis.btoa = previousBtoa;
    harness.cleanup();
  }
});

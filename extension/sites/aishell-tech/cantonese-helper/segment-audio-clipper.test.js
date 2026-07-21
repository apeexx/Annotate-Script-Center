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

test("Aishell Cantonese prioritizes the numeric primary region over speaker overlays and preserves millisecond boundaries", function () {
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

test("Aishell Cantonese crops a hand-drawn numeric segment by pixels when its title differs", function () {
  const harness = loadApi();
  try {
    const documentLike = createMarkDocument(
      [
        createRegion("speaker-s1", "说话人S1:1", "0:01-0:02", 410, 40),
        createRegion("region-1", "1", "0:00-0:01", 100, 120),
        createRegion("speaker-s2", "说话人S2:2", "0:05-0:06", 500, 45),
        createRegion("hand-drawn-region-2", "2", "0:01-0:02", 480, 150),
        createRegion("speaker-s1-copy", "说话人S1:2", "0:06-0:07", 650, 45),
      ],
      2,
      1.5
    );

    const segment = harness.api.getCurrentSegment(documentLike);
    const catalog = harness.api.getSegmentCatalog(documentLike);

    assert.deepEqual(segment, {
      regionId: "hand-drawn-region-2",
      regionLabel: "2",
      segmentNumber: 2,
      startMs: 4800,
      endMs: 6300,
      durationMs: 1500,
      selectionKey: "hand-drawn-region-2:4800-6300",
    });
    assert.deepEqual(
      catalog.map(function (entry) {
        return entry.regionId;
      }),
      ["region-1", "hand-drawn-region-2"]
    );
  } finally {
    harness.cleanup();
  }
});

test("Aishell Cantonese rejects numbered segments without usable CSS geometry", function () {
  const harness = loadApi();
  try {
    [-1, 0].forEach(function (invalidValue, index) {
      const region =
        index === 0
          ? createRegion("negative-left", "1", "0:01-0:02", invalidValue, 120)
          : createRegion("zero-width", "1", "0:01-0:02", 100, invalidValue);
      assert.throws(
        function () {
          harness.api.resolveSegmentSnapshot({
            regions: [region],
            selectedSegmentNumber: 1,
            selectedDurationMs: 1200,
          });
        },
        /缺少可用的波形位置或宽度/
      );
    });
  } finally {
    harness.cleanup();
  }
});

test("Aishell Cantonese maps the real speaker prefix by CSS left instead of speaker-local labels", function () {
  const harness = loadApi();
  try {
    const documentLike = createMarkDocument(
      [
        createRegion("speaker-s3-1", "说话人S3:1", "0:00-0:02", 66, 163),
        createRegion("speaker-s4-1", "说话人S4:1", "0:01-0:02", 192, 44),
        createRegion("speaker-s3-2", "说话人S3:2", "0:02-0:03", 257, 76),
        createRegion("speaker-s2-1", "说话人S2:1", "0:03-0:03", 336, 53),
        createRegion("region-5", "5", "0:04-0:09", 402, 540),
      ],
      3,
      0.76
    );

    assert.deepEqual(harness.api.getCurrentSegment(documentLike), {
      regionId: "speaker-s3-2",
      regionLabel: "说话人S3:2",
      segmentNumber: 3,
      startMs: 2570,
      endMs: 3330,
      durationMs: 760,
      selectionKey: "speaker-s3-2:2570-3330",
    });
  } finally {
    harness.cleanup();
  }
});

test("Aishell Cantonese maps a valid speaker prefix and retains its numeric primary anchor", function () {
  const harness = loadApi();
  try {
    const documentLike = createMarkDocument(
      [
        createRegion("speaker-s3-1", "说话人S3:1", "0:02-0:04", 200, 163),
        createRegion("speaker-s2-2", "说话人 S2：2", "0:04-0:06", 400, 140),
        createRegion("region-3", "3", "0:06-0:08", 600, 120),
      ],
      1,
      1.63
    );

    assert.deepEqual(
      harness.api.getSegmentCatalog(documentLike).map(function (segment) {
        return [segment.segmentNumber, segment.regionId];
      }),
      [
        [1, "speaker-s3-1"],
        [2, "speaker-s2-2"],
        [3, "region-3"],
      ]
    );
  } finally {
    harness.cleanup();
  }
});

test("Aishell Cantonese rejects a speaker prefix node that crosses the numeric anchor", function () {
  const harness = loadApi();
  try {
    const documentLike = createMarkDocument(
      [
        createRegion("speaker-left", "说话人S1:7", "0:00-0:01", 40, 100),
        createRegion("speaker-crossing", "说话人S2:4", "0:02-0:03", 250, 100),
        createRegion("region-3", "3", "0:03-0:04", 300, 120),
      ],
      3,
      1.2
    );

    assert.equal(harness.api.getCurrentSegment(documentLike).regionId, "region-3");
    assert.deepEqual(
      harness.api.getSegmentPreflight(documentLike).failures.map(function (failure) {
        return failure.segmentNumber;
      }),
      [1, 2]
    );
  } finally {
    harness.cleanup();
  }
});

test("Aishell Cantonese ignores an invalid speaker node wholly to the right of the numeric anchor", function () {
  const harness = loadApi();
  try {
    const invalidRightSpeaker = createRegion("speaker-right-invalid", "说话人S4:9", "0:04-0:05", 350, 0);
    const documentLike = createMarkDocument(
      [
        createRegion("speaker-second", "说话人S2:8", "0:01-0:02", 160, 80),
        invalidRightSpeaker,
        createRegion("region-3", "3", "0:03-0:04", 300, 120),
        createRegion("speaker-first", "说话人S1:6", "0:00-0:01", 40, 80),
      ],
      1,
      0.8
    );

    assert.deepEqual(
      harness.api.getSegmentCatalog(documentLike).map(function (segment) {
        return [segment.segmentNumber, segment.regionId];
      }),
      [
        [1, "speaker-first"],
        [2, "speaker-second"],
        [3, "region-3"],
      ]
    );
  } finally {
    harness.cleanup();
  }
});

test("Aishell Cantonese maps an unordered speaker input array by CSS left", function () {
  const harness = loadApi();
  try {
    const documentLike = createMarkDocument(
      [
        createRegion("speaker-third", "说话人S3:1", "0:02-0:03", 220, 60),
        createRegion("region-4", "4", "0:04-0:05", 360, 120),
        createRegion("speaker-first", "说话人S1:3", "0:00-0:01", 40, 60),
        createRegion("speaker-second", "说话人S2:2", "0:01-0:02", 130, 60),
      ],
      2,
      0.6
    );

    assert.equal(harness.api.getCurrentSegment(documentLike).regionId, "speaker-second");
  } finally {
    harness.cleanup();
  }
});

test("Aishell Cantonese rejects tied speaker left positions in a prefix", function () {
  const harness = loadApi();
  try {
    const documentLike = createMarkDocument(
      [
        createRegion("speaker-one", "说话人S1:1", "0:00-0:01", 40, 60),
        createRegion("speaker-two", "说话人S2:1", "0:00-0:01", 40, 60),
        createRegion("region-3", "3", "0:03-0:04", 300, 120),
      ],
      3,
      1.2
    );

    assert.deepEqual(
      harness.api.getSegmentPreflight(documentLike).failures.map(function (failure) {
        return failure.segmentNumber;
      }),
      [1, 2]
    );
  } finally {
    harness.cleanup();
  }
});

test("Aishell Cantonese keeps a safe numeric primary segment when the speaker prefix is invalid", function () {
  const harness = loadApi();
  try {
    const documentLike = createMarkDocument(
      [
        createRegion("speaker-s1-1", "说话人S1:1", "0:02-0:04", 200, 163),
        createRegion("speaker-s2-1", "说话人S2:1", "0:04-0:06", 400, 163),
        createRegion("region-5", "5", "0:06-0:08", 600, 120),
      ],
      5,
      1.2
    );

    assert.equal(harness.api.getCurrentSegment(documentLike).regionId, "region-5");
    assert.deepEqual(
      harness.api.getSegmentCatalog(documentLike).map(function (segment) {
        return segment.segmentNumber;
      }),
      [5]
    );
    assert.deepEqual(
      harness.api.getSegmentPreflight(documentLike).failures.map(function (failure) {
        return failure.segmentNumber;
      }),
      [1, 2, 3, 4]
    );
  } finally {
    harness.cleanup();
  }
});

test("Aishell Cantonese isolates a duplicate numeric primary to its own preflight failure", function () {
  const harness = loadApi();
  try {
    const documentLike = createMarkDocument(
      [
        createRegion("region-1-a", "1", "0:00-0:01", 100, 80),
        createRegion("region-1-b", "1", "0:01-0:02", 220, 80),
        createRegion("region-5", "5", "0:04-0:05", 500, 120),
      ],
      5,
      1.2
    );

    assert.equal(harness.api.getCurrentSegment(documentLike).regionId, "region-5");
    assert.deepEqual(
      harness.api.getSegmentPreflight(documentLike).failures.map(function (failure) {
        return [failure.segmentNumber, failure.code];
      }),
      [[1, "duplicate-segment-number"]]
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

test("Aishell Cantonese allows sparse numeric region labels", function () {
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

    assert.doesNotThrow(function () {
      harness.api.getSegmentCatalog(documentLike);
    }, /编号/);
  } finally {
    harness.cleanup();
  }
});

test("Aishell Cantonese resolves sparse selected numbers by their label", function () {
  const harness = loadApi();
  try {
    const documentLike = createMarkDocument(
      [
        createRegion("region-1", "1", "0:01-0:02", 183, 116),
        createRegion("region-3", "3", "0:03-0:06", 315, 336),
      ],
      3,
      3.36
    );

    const segment = harness.api.getCurrentSegment(documentLike);
    const catalog = harness.api.getSegmentCatalog(documentLike);

    assert.equal(segment.regionId, "region-3");
    assert.equal(segment.segmentNumber, 3);
    assert.deepEqual(
      catalog.map(function (entry) {
        return entry.segmentNumber;
      }),
      [1, 3]
    );
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

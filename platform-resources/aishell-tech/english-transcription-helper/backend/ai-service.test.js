"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const modulePath = path.resolve(__dirname, "ai-service.js");
const CROPPED_WAV_DATA_URL = "data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQIAAAAAAA==";

function createWavDataUrl(overrides) {
  const config = overrides && typeof overrides === "object" ? overrides : {};
  const format = Number(config.format ?? 1);
  const channels = Number(config.channels ?? 1);
  const sampleRate = Number(config.sampleRate ?? 16000);
  const bitsPerSample = Number(config.bitsPerSample ?? 16);
  const blockAlign = Number(config.blockAlign ?? Math.max(1, Math.ceil(channels * bitsPerSample / 8)));
  const byteRate = Number(config.byteRate ?? sampleRate * blockAlign);
  const data = Buffer.isBuffer(config.data)
    ? config.data
    : Buffer.alloc(Number(config.dataBytes ?? Math.max(1, blockAlign)));
  const bytes = Buffer.alloc(44 + data.length);
  bytes.write("RIFF", 0, "ascii");
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write("WAVE", 8, "ascii");
  bytes.write("fmt ", 12, "ascii");
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(format, 20);
  bytes.writeUInt16LE(channels, 22);
  bytes.writeUInt32LE(sampleRate, 24);
  bytes.writeUInt32LE(byteRate, 28);
  bytes.writeUInt16LE(blockAlign, 32);
  bytes.writeUInt16LE(bitsPerSample, 34);
  bytes.write("data", 36, "ascii");
  bytes.writeUInt32LE(Number(config.dataChunkSize ?? data.length), 40);
  data.copy(bytes, 44);
  return "data:audio/wav;base64," + bytes.toString("base64");
}

function createCroppedRequest(overrides) {
  return Object.assign(
    {
      taskId: "task-safe-fixture",
      packageId: "package-safe-fixture",
      taskItemId: "item-safe-fixture",
      audioDataUrl: CROPPED_WAV_DATA_URL,
      regionId: "region-safe-fixture",
      segmentNumber: 7,
      startMs: 1200,
      endMs: 2600,
      durationMs: 1400,
      selectionKey: "region-safe-fixture:1200-2600",
      aiOmni: {
        model: "qwen3.5-omni-flash",
        prompt: "Keep original English.",
        enableThinking: true,
      },
    },
    overrides || {}
  );
}

test("English transcription AI service is available", function () {
  assert.equal(fs.existsSync(modulePath), true);
});

function loadModule() {
  delete require.cache[modulePath];
  return require(modulePath);
}

test("English transcription defaults require original English and disable thinking", function () {
  const api = loadModule();
  const defaults = api.createDefaultsPayload();

  assert.equal(defaults.scriptId, "aishellTechEnglishTranscriptionAssistant");
  assert.equal(defaults.defaults.timeoutMs, 60000);
  assert.equal(defaults.defaults.aiOmni.model, "qwen3.5-omni-plus");
  assert.match(defaults.defaults.aiOmni.prompt, /original English/i);
  assert.match(defaults.defaults.aiOmni.prompt, /#N#/);
  assert.equal(defaults.defaults.aiOmni.enableThinking, false);
  assert.equal(defaults.contract.outputField, "listenText");
  assert.equal(defaults.contract.enableThinking, false);
});

test("English transcription accepts only an exact cropped WAV segment identity", function () {
  const api = loadModule();
  const request = api.normalizeRecommendRequest(createCroppedRequest());

  assert.equal(request.audioDataUrl, CROPPED_WAV_DATA_URL);
  assert.equal(request.taskId, "task-safe-fixture");
  assert.equal(request.packageId, "package-safe-fixture");
  assert.equal(request.regionId, "region-safe-fixture");
  assert.equal(request.segmentNumber, 7);
  assert.equal(request.startMs, 1200);
  assert.equal(request.endMs, 2600);
  assert.equal(request.durationMs, 1400);
  assert.equal(request.selectionKey, "region-safe-fixture:1200-2600");
  assert.equal(request.aiOmni.enableThinking, false);
  assert.equal(request.timeoutMs, 60000);

  assert.throws(
    function () {
      api.normalizeRecommendRequest(createCroppedRequest({ audioDataUrl: "" }));
    },
    function (error) {
      return error?.code === "missing-audio-data-url";
    }
  );
  assert.throws(
    function () {
      api.normalizeRecommendRequest(createCroppedRequest({ selectionKey: "region-safe-fixture:0-999" }));
    },
    function (error) {
      return error?.code === "invalid-segment-identity";
    }
  );
});


test("English transcription rejects clips without a task and package identity", function () {
  const api = loadModule();

  [
    createCroppedRequest({ taskId: "" }),
    createCroppedRequest({ packageId: "" }),
  ].forEach(function (request) {
    assert.throws(function () {
      api.normalizeRecommendRequest(request);
    }, function (error) {
      return error?.code === "missing-task-context";
    });
  });
});

test("English transcription rejects WAV declarations that are not 16 kHz mono PCM clips", function () {
  const api = loadModule();
  const invalidAudioDataUrls = [
    "data:audio/wav;base64,QUJD",
    createWavDataUrl({ format: 3 }),
    createWavDataUrl({ channels: 2 }),
    createWavDataUrl({ sampleRate: 8000 }),
    createWavDataUrl({ bitsPerSample: 12 }),
    createWavDataUrl({ dataChunkSize: 999 }),
    createWavDataUrl({ data: Buffer.alloc(2 * 1024 * 1024 + 2) }),
  ];

  invalidAudioDataUrls.forEach(function (audioDataUrl) {
    assert.throws(function () {
      api.normalizeRecommendRequest(createCroppedRequest({ audioDataUrl }));
    }, function (error) {
      assert.equal(error?.code, "invalid-audio-data-url");
      assert.doesNotMatch(String(error?.message || ""), /data:audio|QUJD|UklGR/i);
      return true;
    });
  });
});

test("English transcription public errors do not reveal upstream request details", function () {
  const api = loadModule();
  const upstreamDetail =
    "Upstream request failed at https://upstream.example.invalid/recognize?signature=fake-signature-for-test";
  const result = api.buildRecommendErrorBody({
    error: {
      code: "provider-failed",
      message: upstreamDetail,
      safeMessage: upstreamDetail,
      summary: "The provider request failed.",
    },
  });

  assert.equal(result.error.message, "English transcription request failed.");
  assert.doesNotMatch(JSON.stringify(result), /upstream\.example\.invalid|fake-signature-for-test/);
});

test("English transcription public errors never expose queue messages or serialized audio values", function () {
  const api = loadModule();
  const urlSafeAudio = Buffer.alloc(48, 0xff).toString("base64url");
  const unpaddedAudio = Buffer.alloc(49, 0xab).toString("base64").replace(/=+$/, "");
  const upstreamMessage = "provider-queue-internal-detail " + JSON.stringify({
    audioBase64: urlSafeAudio,
    audio_base64: unpaddedAudio,
    dataUrl: "data:application/octet-stream;base64," + unpaddedAudio,
  });
  const result = api.buildRecommendErrorBody({
    error: {
      code: "provider-failed",
      message: upstreamMessage,
      summary: upstreamMessage,
      meta: {
        providerMessage: upstreamMessage,
        serializedAudio: upstreamMessage,
        directAudio: { audioBase64: urlSafeAudio, audio_base64: unpaddedAudio },
      },
    },
  });
  const publicJson = JSON.stringify(result);

  assert.equal(result.error.message, "English transcription request failed.");
  assert.doesNotMatch(publicJson, /provider-queue-internal-detail/);
  assert.doesNotMatch(publicJson, new RegExp(urlSafeAudio));
  assert.doesNotMatch(publicJson, new RegExp(unpaddedAudio));
  assert.doesNotMatch(publicJson, /data:application\/octet-stream;base64/i);
});

test("English transcription whitelists public error codes and removes unsafe limit details", function () {
  const api = loadModule();
  const opaqueDataUrl = "data:,opaque";
  const base64DataUrl = "data:;base64,SGVsbG8=";
  const urlSafePayload = Buffer.alloc(48, 0xff).toString("base64url");
  const genericFailure = api.buildRecommendErrorBody({
    error: {
      code: "https://provider.example.invalid/error?signature=test-signature",
      providerCode: urlSafePayload,
      providerStatus: 502,
      meta: {
        ordinaryField: opaqueDataUrl,
        serialized: JSON.stringify({ embedded: base64DataUrl }),
      },
    },
  });
  const rateLimitedFailure = api.buildRecommendErrorBody({
    error: {
      code: "provider-rate-limited",
      providerCode: base64DataUrl,
      providerStatus: 429,
    },
  });
  const publicJson = JSON.stringify({ genericFailure, rateLimitedFailure });

  assert.equal(genericFailure.error.code, "request-error");
  assert.equal(genericFailure.error.providerCode, "");
  assert.equal(rateLimitedFailure.error.code, "provider-rate-limited");
  assert.equal(rateLimitedFailure.error.providerCode, "");
  assert.equal(rateLimitedFailure.error.providerStatus, 429);
  assert.equal(publicJson.includes("provider.example.invalid"), false);
  assert.equal(publicJson.includes("test-signature"), false);
  assert.equal(publicJson.includes(opaqueDataUrl), false);
  assert.equal(publicJson.includes(base64DataUrl), false);
  assert.equal(publicJson.includes(urlSafePayload), false);
});

test("English transcription public success metadata excludes raw provider usage without changing transcript values", function () {
  const api = loadModule();
  const opaqueDataUrl = "data:,opaque";
  const base64DataUrl = "data:;base64,SGVsbG8=";
  const providerPayload = Buffer.alloc(48, 0xff).toString("base64url");
  const bodies = ["Keep original English.", "#N#"].map(function (listenText) {
    return api.buildRecommendSuccessBody({
      data: {
        taskItemId: "item-safe-fixture",
        regionId: "region-safe-fixture",
        segmentNumber: 7,
        startMs: 1200,
        endMs: 2600,
        durationMs: 1400,
        selectionKey: "region-safe-fixture:1200-2600",
        listenText,
        needHumanReview: listenText === "#N#",
      },
      meta: {
        requestId: "request-safe-fixture",
        usage: {
          promptTokens: 8,
          completionTokens: 4,
          totalTokens: 12,
          raw: {
            ordinaryField: opaqueDataUrl,
            serialized: JSON.stringify({ embedded: base64DataUrl }),
            providerPayload,
            sourceUrl: "https://provider.example.invalid/usage?signature=test-signature",
          },
        },
      },
    });
  });
  const publicJson = JSON.stringify(bodies);

  assert.equal(bodies[0].data.listenText, "Keep original English.");
  assert.equal(bodies[1].data.listenText, "#N#");
  assert.equal(Object.hasOwn(bodies[0].meta.usage, "raw"), false);
  assert.equal(Object.hasOwn(bodies[1].meta.usage, "raw"), false);
  assert.equal(publicJson.includes("provider.example.invalid"), false);
  assert.equal(publicJson.includes("test-signature"), false);
  assert.equal(publicJson.includes(opaqueDataUrl), false);
  assert.equal(publicJson.includes(base64DataUrl), false);
  assert.equal(publicJson.includes(providerPayload), false);
});

test("English transcription public success redacts reflected Data URLs without changing transcripts", function () {
  const api = loadModule();
  const opaqueDataUrl = "data:,opaque";
  const base64DataUrl = "data:;base64,SGVsbG8=";
  const result = api.buildRecommendSuccessBody({
    data: {
      taskId: opaqueDataUrl,
      packageId: base64DataUrl,
      taskItemId: opaqueDataUrl,
      fileName: base64DataUrl,
      referenceText: opaqueDataUrl,
      existingMarkText: base64DataUrl,
      regionId: "region-safe-fixture",
      selectionKey: "region-safe-fixture:1200-2600",
      listenText: "Keep original English.",
    },
  });
  const publicJson = JSON.stringify(result);

  assert.equal(result.data.listenText, "Keep original English.");
  assert.equal(publicJson.includes(opaqueDataUrl), false);
  assert.equal(publicJson.includes(base64DataUrl), false);
});

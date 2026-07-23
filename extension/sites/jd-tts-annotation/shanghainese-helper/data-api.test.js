"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const api = require(path.resolve(__dirname, "data-api.js"));

function createWindowHarness(origin) {
  const listeners = new Map();
  const posted = [];
  return {
    posted,
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    removeEventListener(type) {
      listeners.delete(type);
    },
    postMessage(message, targetOrigin) {
      posted.push({ message, targetOrigin });
    },
    async emitMessage(data) {
      const listener = listeners.get("message");
      assert.ok(listener, "message bridge should be installed");
      return listener({ source: this, origin, data });
    },
  };
}

test("JD TTS data API turns a bridge WAV into a current string identity snapshot", async function () {
  const origin = "https://tts-biaozhu-pub.jd.com";
  const windowHarness = createWindowHarness(origin);
  const runtime = api.createRuntime({
    window: windowHarness,
    location: { origin },
    randomValues: function (bytes) {
      bytes.fill(7);
      return bytes;
    },
  });
  runtime.start();

  const request = runtime.getCurrentAudio();
  const register = windowHarness.posted[0]?.message;
  const requestAudio = windowHarness.posted[1]?.message;
  assert.equal(register.type, "register");
  assert.equal(requestAudio.type, "request-audio");
  assert.equal(register.nonce, requestAudio.nonce);

  await windowHarness.emitMessage({
    source: "ASC_JD_TTS_SHANGHAI_PAGE",
    type: "utterance-snapshot",
    nonce: register.nonce,
    utteranceId: "4881635",
    checksum: "a".repeat(32),
  });
  await windowHarness.emitMessage({
    source: "ASC_JD_TTS_SHANGHAI_PAGE",
    type: "utterance-audio",
    nonce: register.nonce,
    utteranceId: "4881635",
    checksum: "a".repeat(32),
    mimeType: "audio/x-wav",
    audioBuffer: new Uint8Array([82, 73, 70, 70]).buffer,
  });

  const snapshot = await request;
  assert.deepEqual(
    { utteranceId: snapshot.utteranceId, checksum: snapshot.checksum },
    { utteranceId: "4881635", checksum: "a".repeat(32) }
  );
  assert.match(snapshot.audioDataUrl, /^data:audio\/x-wav;base64,/);
  assert.equal(runtime.isCurrentSnapshot(snapshot), true);
  runtime.stop();
});

test("JD TTS data API invalidates an old audio snapshot as soon as the page reports a new utterance", async function () {
  const origin = "https://tts-biaozhu-pub.jd.com";
  const windowHarness = createWindowHarness(origin);
  const runtime = api.createRuntime({
    window: windowHarness,
    location: { origin },
    randomValues: function (bytes) {
      bytes.fill(9);
      return bytes;
    },
  });
  runtime.start();
  const nonce = runtime.getNonce();

  await windowHarness.emitMessage({
    source: "ASC_JD_TTS_SHANGHAI_PAGE",
    type: "utterance-snapshot",
    nonce,
    utteranceId: "4881635",
    checksum: "a".repeat(32),
  });
  assert.equal(
    runtime.isCurrentSnapshot({ utteranceId: "4881635", checksum: "a".repeat(32) }),
    true
  );

  await windowHarness.emitMessage({
    source: "ASC_JD_TTS_SHANGHAI_PAGE",
    type: "utterance-snapshot",
    nonce,
    utteranceId: "4881636",
    checksum: "b".repeat(32),
  });
  assert.equal(
    runtime.isCurrentSnapshot({ utteranceId: "4881635", checksum: "a".repeat(32) }),
    false
  );
  runtime.stop();
});

test("JD TTS data API accepts a changed snapshot when its latest complete WAV is unchanged", async function () {
  const origin = "https://tts-biaozhu-pub.jd.com";
  const windowHarness = createWindowHarness(origin);
  const runtime = api.createRuntime({
    window: windowHarness,
    location: { origin },
    randomValues: function (bytes) {
      bytes.fill(5);
      return bytes;
    },
  });
  runtime.start();
  const nonce = runtime.getNonce();
  const initialAudio = runtime.getCurrentAudio();

  await windowHarness.emitMessage({
    source: "ASC_JD_TTS_SHANGHAI_PAGE",
    type: "utterance-snapshot",
    nonce,
    utteranceId: "4881635",
    checksum: "a".repeat(32),
  });
  await windowHarness.emitMessage({
    source: "ASC_JD_TTS_SHANGHAI_PAGE",
    type: "utterance-audio",
    nonce,
    utteranceId: "4881635",
    checksum: "a".repeat(32),
    mimeType: "audio/x-wav",
    audioBuffer: new Uint8Array([82, 73, 70, 70]).buffer,
  });
  const snapshot = await initialAudio;

  await windowHarness.emitMessage({
    source: "ASC_JD_TTS_SHANGHAI_PAGE",
    type: "utterance-snapshot",
    nonce,
    utteranceId: "4881636",
    checksum: "b".repeat(32),
  });
  const sameAudio = runtime.isSameFullAudio(snapshot);
  const secondRequest = windowHarness.posted.at(-1)?.message;
  assert.equal(secondRequest.type, "request-audio");
  await windowHarness.emitMessage({
    source: "ASC_JD_TTS_SHANGHAI_PAGE",
    type: "utterance-audio",
    nonce,
    utteranceId: "4881636",
    checksum: "b".repeat(32),
    mimeType: "audio/x-wav",
    audioBuffer: new Uint8Array([82, 73, 70, 70]).buffer,
  });

  assert.equal(await sameAudio, true);
  runtime.stop();
});

test("JD TTS data API rejects a changed snapshot when its latest complete WAV differs", async function () {
  const origin = "https://tts-biaozhu-pub.jd.com";
  const windowHarness = createWindowHarness(origin);
  const runtime = api.createRuntime({
    window: windowHarness,
    location: { origin },
    randomValues: function (bytes) {
      bytes.fill(6);
      return bytes;
    },
  });
  runtime.start();
  const nonce = runtime.getNonce();
  const initialAudio = runtime.getCurrentAudio();

  await windowHarness.emitMessage({
    source: "ASC_JD_TTS_SHANGHAI_PAGE",
    type: "utterance-snapshot",
    nonce,
    utteranceId: "4881635",
    checksum: "a".repeat(32),
  });
  await windowHarness.emitMessage({
    source: "ASC_JD_TTS_SHANGHAI_PAGE",
    type: "utterance-audio",
    nonce,
    utteranceId: "4881635",
    checksum: "a".repeat(32),
    mimeType: "audio/x-wav",
    audioBuffer: new Uint8Array([82, 73, 70, 70]).buffer,
  });
  const snapshot = await initialAudio;

  await windowHarness.emitMessage({
    source: "ASC_JD_TTS_SHANGHAI_PAGE",
    type: "utterance-snapshot",
    nonce,
    utteranceId: "4881636",
    checksum: "b".repeat(32),
  });
  const sameAudio = runtime.isSameFullAudio(snapshot);
  await windowHarness.emitMessage({
    source: "ASC_JD_TTS_SHANGHAI_PAGE",
    type: "utterance-audio",
    nonce,
    utteranceId: "4881636",
    checksum: "b".repeat(32),
    mimeType: "audio/x-wav",
    audioBuffer: new Uint8Array([87, 65, 86, 69]).buffer,
  });

  assert.equal(await sameAudio, false);
  runtime.stop();
});

test("JD TTS data API rejects invalid bridge payloads without accepting a URL", async function () {
  const origin = "https://tts-biaozhu-pub.jd.com";
  const windowHarness = createWindowHarness(origin);
  const runtime = api.createRuntime({
    window: windowHarness,
    location: { origin },
    randomValues: function (bytes) {
      bytes.fill(3);
      return bytes;
    },
  });
  runtime.start();
  const nonce = runtime.getNonce();

  assert.equal(
    await windowHarness.emitMessage({
      source: "ASC_JD_TTS_SHANGHAI_PAGE",
      type: "utterance-audio",
      nonce,
      utteranceId: "4881635",
      checksum: "a".repeat(32),
      mimeType: "audio/mpeg",
      audioBuffer: new Uint8Array([1]).buffer,
      url: "https://private.example.test/audio.wav",
    }),
    false
  );
  assert.equal(runtime.getCurrentSnapshot(), null);
  runtime.stop();
});

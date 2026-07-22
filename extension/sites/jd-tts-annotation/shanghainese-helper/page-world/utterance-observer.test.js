"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const observerApi = require(path.resolve(__dirname, "utterance-observer.js"));

function createHeaders(values) {
  return {
    get(name) {
      return values[String(name || "").toLowerCase()] || null;
    },
  };
}

test("JD TTS observer publishes an identity snapshot without exposing the signed audio URL", async function () {
  const messages = [];
  const pageWindow = {
    postMessage(message, targetOrigin, transfer) {
      messages.push({ message, targetOrigin, transfer });
    },
  };
  const observer = observerApi.createObserver({
    window: pageWindow,
    location: {
      origin: "https://tts-biaozhu-pub.jd.com",
      href: "https://tts-biaozhu-pub.jd.com/#/annotation/dataset/annotate",
    },
  });

  assert.equal(
    await observer.handleBridgeMessage({
      source: pageWindow,
      origin: "https://tts-biaozhu-pub.jd.com",
      data: { source: "ASC_JD_TTS_SHANGHAI_PAGE", type: "register", nonce: "a".repeat(32) },
    }),
    true
  );
  assert.equal(
    observer.observeResponse(
      "https://tts-biaozhu-pub.jd.com/annotation/get_utterance/",
      {
        status: 0,
        utterance: {
          id: "4881635",
          checksum: "b".repeat(32),
          url: "https://s3.example.test/private.wav?signature=redacted",
        },
      }
    ),
    true
  );

  assert.deepEqual(messages[0], {
    message: {
      source: "ASC_JD_TTS_SHANGHAI_PAGE",
      type: "utterance-snapshot",
      nonce: "a".repeat(32),
      utteranceId: "4881635",
      checksum: "b".repeat(32),
    },
    targetOrigin: "https://tts-biaozhu-pub.jd.com",
    transfer: undefined,
  });
  assert.doesNotMatch(JSON.stringify(messages[0]), /s3\.example\.test|signature/i);
});

test("JD TTS observer fetches the cached WAV only for the registered nonce and transfers no URL", async function () {
  const messages = [];
  const requested = [];
  const pageWindow = {
    postMessage(message, targetOrigin, transfer) {
      messages.push({ message, targetOrigin, transfer });
    },
  };
  const observer = observerApi.createObserver({
    window: pageWindow,
    location: {
      origin: "https://tts-biaozhu-pub.jd.com",
      href: "https://tts-biaozhu-pub.jd.com/#/annotation/dataset/annotate",
    },
    fetchImpl: async function (url, init) {
      requested.push({ url, init });
      return {
        ok: true,
        headers: createHeaders({ "content-type": "audio/x-wav" }),
        arrayBuffer: async function () {
          return new Uint8Array([82, 73, 70, 70]).buffer;
        },
      };
    },
  });
  observer.handleBridgeMessage({
    source: pageWindow,
    origin: "https://tts-biaozhu-pub.jd.com",
    data: { source: "ASC_JD_TTS_SHANGHAI_PAGE", type: "register", nonce: "c".repeat(32) },
  });
  observer.observeResponse("/annotation/get_utterance/", {
    status: 0,
    utterance: {
      id: "4881635",
      checksum: "d".repeat(32),
      url: "https://s3.example.test/private.wav?signature=redacted",
    },
  });

  assert.equal(
    await observer.handleBridgeMessage({
      source: pageWindow,
      origin: "https://tts-biaozhu-pub.jd.com",
      data: { source: "ASC_JD_TTS_SHANGHAI_PAGE", type: "request-audio", nonce: "c".repeat(32) },
    }),
    true
  );
  assert.deepEqual(requested[0].init, { credentials: "omit" });
  const audioMessage = messages.find(function (entry) {
    return entry.message.type === "utterance-audio";
  });
  assert.equal(audioMessage.message.utteranceId, "4881635");
  assert.equal(audioMessage.message.mimeType, "audio/x-wav");
  assert.ok(audioMessage.message.audioBuffer instanceof ArrayBuffer);
  assert.equal(Object.hasOwn(audioMessage.message, "url"), false);
  assert.equal(audioMessage.transfer[0], audioMessage.message.audioBuffer);
});

(function () {
  "use strict";

  const SOURCE = "ASC_JD_TTS_SHANGHAI_PAGE";
  const REGISTER_TYPE = "register";
  const REQUEST_AUDIO_TYPE = "request-audio";
  const SNAPSHOT_TYPE = "utterance-snapshot";
  const AUDIO_TYPE = "utterance-audio";
  const WAV_MIME_TYPES = new Set(["audio/wav", "audio/x-wav", "audio/wave"]);
  const MAX_AUDIO_BYTES = 2 * 1024 * 1024;

  function normalizeUtteranceId(value) {
    const text = String(value || "").trim();
    return /^\d+$/.test(text) ? text : "";
  }

  function normalizeChecksum(value) {
    const text = String(value || "").trim();
    return /^[A-Za-z0-9_-]{32,128}$/.test(text) ? text : "";
  }

  function isSameIdentity(left, right) {
    return (
      normalizeUtteranceId(left?.utteranceId) !== "" &&
      normalizeUtteranceId(left?.utteranceId) === normalizeUtteranceId(right?.utteranceId) &&
      normalizeChecksum(left?.checksum) !== "" &&
      normalizeChecksum(left?.checksum) === normalizeChecksum(right?.checksum)
    );
  }

  function createNonce(randomValues) {
    const bytes = new Uint8Array(16);
    const fill = typeof randomValues === "function" ? randomValues : crypto.getRandomValues.bind(crypto);
    fill(bytes);
    return Array.from(bytes, function (value) {
      return value.toString(16).padStart(2, "0");
    }).join("");
  }

  function arrayBufferToDataUrl(buffer, mimeType) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let index = 0; index < bytes.length; index += 1) {
      binary += String.fromCharCode(bytes[index]);
    }
    return "data:" + mimeType + ";base64," + btoa(binary);
  }

  function createClientError(code, message) {
    const error = new Error(message || "音频读取失败。");
    error.code = code;
    return error;
  }

  function createRuntime(options) {
    const config = options && typeof options === "object" ? options : {};
    const pageWindow = config.window || window;
    const pageLocation = config.location || location;
    const origin = String(pageLocation?.origin || "");
    const nonce = createNonce(config.randomValues);
    let started = false;
    let currentIdentity = null;
    let currentAudio = null;
    let pendingRequest = null;

    function post(type) {
      pageWindow.postMessage(
        { source: SOURCE, type: type, nonce: nonce },
        origin
      );
    }

    function updateIdentity(data) {
      const identity = {
        utteranceId: normalizeUtteranceId(data?.utteranceId),
        checksum: normalizeChecksum(data?.checksum),
      };
      if (!identity.utteranceId || !identity.checksum) {
        return false;
      }
      if (!isSameIdentity(currentIdentity, identity)) {
        currentAudio = null;
      }
      currentIdentity = identity;
      return true;
    }

    function settlePending(error, value) {
      const pending = pendingRequest;
      pendingRequest = null;
      if (!pending) {
        return;
      }
      if (pending.signal && typeof pending.signal.removeEventListener === "function") {
        pending.signal.removeEventListener("abort", pending.onAbort);
      }
      if (error) {
        pending.reject(error);
      } else {
        pending.resolve(value);
      }
    }

    async function handlePageMessage(event) {
      if (event?.source !== pageWindow || event?.origin !== origin) {
        return false;
      }
      const data = event.data && typeof event.data === "object" ? event.data : {};
      if (data.source !== SOURCE || data.nonce !== nonce) {
        return false;
      }
      if (data.type === SNAPSHOT_TYPE) {
        return updateIdentity(data);
      }
      if (data.type !== AUDIO_TYPE || Object.prototype.hasOwnProperty.call(data, "url")) {
        return false;
      }
      if (!WAV_MIME_TYPES.has(String(data.mimeType || "").toLowerCase())) {
        return false;
      }
      if (!(data.audioBuffer instanceof ArrayBuffer) || data.audioBuffer.byteLength > MAX_AUDIO_BYTES) {
        return false;
      }
      const identity = {
        utteranceId: normalizeUtteranceId(data.utteranceId),
        checksum: normalizeChecksum(data.checksum),
      };
      if (!identity.utteranceId || !identity.checksum || !isSameIdentity(currentIdentity, identity)) {
        settlePending(createClientError("stale-utterance", "当前条目已变化，识别已取消。"));
        return false;
      }
      currentAudio = {
        utteranceId: identity.utteranceId,
        checksum: identity.checksum,
        audioDataUrl: arrayBufferToDataUrl(data.audioBuffer, String(data.mimeType).toLowerCase()),
      };
      settlePending(null, currentAudio);
      return true;
    }

    function onMessage(event) {
      return handlePageMessage(event);
    }

    function start() {
      if (started) {
        return;
      }
      started = true;
      pageWindow.addEventListener("message", onMessage);
      post(REGISTER_TYPE);
    }

    function stop() {
      if (started) {
        pageWindow.removeEventListener("message", onMessage);
      }
      started = false;
      currentIdentity = null;
      currentAudio = null;
      settlePending(createClientError("stopped", "页面识别已停止。"));
    }

    function getCurrentAudio(options) {
      const requestOptions = options && typeof options === "object" ? options : {};
      if (!started) {
        start();
      }
      if (currentAudio && isSameIdentity(currentAudio, currentIdentity)) {
        return Promise.resolve(Object.assign({}, currentAudio));
      }
      if (pendingRequest) {
        return pendingRequest.promise;
      }
      if (requestOptions.signal?.aborted) {
        return Promise.reject(createClientError("aborted", "识别请求已取消。"));
      }
      const pending = {};
      pending.promise = new Promise(function (resolve, reject) {
        pending.resolve = resolve;
        pending.reject = reject;
      });
      pending.signal = requestOptions.signal || null;
      pending.onAbort = function () {
        settlePending(createClientError("aborted", "识别请求已取消。"));
      };
      if (pending.signal && typeof pending.signal.addEventListener === "function") {
        pending.signal.addEventListener("abort", pending.onAbort, { once: true });
      }
      pendingRequest = pending;
      post(REQUEST_AUDIO_TYPE);
      return pending.promise;
    }

    function isCurrentSnapshot(snapshot) {
      return isSameIdentity(currentIdentity, snapshot);
    }

    function getCurrentSnapshot() {
      return currentIdentity && currentAudio && isSameIdentity(currentIdentity, currentAudio)
        ? Object.assign({}, currentAudio)
        : null;
    }

    return {
      start,
      stop,
      getNonce: function () { return nonce; },
      getCurrentAudio,
      getCurrentSnapshot,
      isCurrentSnapshot,
      handlePageMessage,
    };
  }

  const api = { createRuntime };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof globalThis !== "undefined") {
    globalThis.ASREdgeJdTtsShanghaiDataApi = api;
  }
})();

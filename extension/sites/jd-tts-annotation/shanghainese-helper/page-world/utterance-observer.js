(function () {
  "use strict";

  const SOURCE = "ASC_JD_TTS_SHANGHAI_PAGE";
  const REGISTER_TYPE = "register";
  const REQUEST_AUDIO_TYPE = "request-audio";
  const SNAPSHOT_TYPE = "utterance-snapshot";
  const AUDIO_TYPE = "utterance-audio";
  const UTTERANCE_PATH = "/annotation/get_utterance/";
  const MAX_AUDIO_BYTES = 2 * 1024 * 1024;
  const WAV_MIME_TYPES = new Set(["audio/wav", "audio/x-wav", "audio/wave"]);

  function normalizeUtteranceId(value) {
    const text = String(value || "").trim();
    return /^\d+$/.test(text) ? text : "";
  }

  function normalizeChecksum(value) {
    const text = String(value || "").trim();
    return /^[A-Za-z0-9_-]{32,128}$/.test(text) ? text : "";
  }

  function resolveUrl(rawUrl, baseUrl) {
    try {
      return new URL(String(rawUrl || ""), String(baseUrl || ""));
    } catch (_error) {
      return null;
    }
  }

  function createObserver(options) {
    const config = options && typeof options === "object" ? options : {};
    const pageWindow = config.window || window;
    const pageLocation = config.location || location;
    const origin = String(pageLocation?.origin || "");
    const pageHref = String(pageLocation?.href || origin + "/");
    const fetchImpl = config.fetchImpl || pageWindow.fetch?.bind(pageWindow);
    let nonce = "";
    let latest = null;

    function post(message, transfer) {
      if (!nonce) {
        return;
      }
      if (transfer) {
        pageWindow.postMessage(message, origin, transfer);
      } else {
        pageWindow.postMessage(message, origin);
      }
    }

    function publishSnapshot() {
      if (!latest || !nonce) {
        return;
      }
      post({
        source: SOURCE,
        type: SNAPSHOT_TYPE,
        nonce: nonce,
        utteranceId: latest.utteranceId,
        checksum: latest.checksum,
      });
    }

    function observeResponse(rawUrl, payload) {
      const target = resolveUrl(rawUrl, pageHref);
      if (!target || target.pathname !== UTTERANCE_PATH || payload?.status !== 0) {
        return false;
      }
      const utterance = payload.utterance && typeof payload.utterance === "object" ? payload.utterance : {};
      const audioUrl = resolveUrl(utterance.url, pageHref);
      const utteranceId = normalizeUtteranceId(utterance.id);
      const checksum = normalizeChecksum(utterance.checksum);
      if (!utteranceId || !checksum || !audioUrl || audioUrl.protocol !== "https:") {
        return false;
      }
      latest = { utteranceId: utteranceId, checksum: checksum, audioUrl: audioUrl.href };
      publishSnapshot();
      return true;
    }

    async function deliverAudio() {
      if (!latest || !nonce || typeof fetchImpl !== "function") {
        return false;
      }
      try {
        const response = await fetchImpl(latest.audioUrl, { credentials: "omit" });
        const mimeType = String(response?.headers?.get("content-type") || "").toLowerCase().split(";", 1)[0];
        if (!response?.ok || !WAV_MIME_TYPES.has(mimeType)) {
          return false;
        }
        const audioBuffer = await response.arrayBuffer();
        if (!(audioBuffer instanceof ArrayBuffer) || audioBuffer.byteLength > MAX_AUDIO_BYTES) {
          return false;
        }
        post(
          {
            source: SOURCE,
            type: AUDIO_TYPE,
            nonce: nonce,
            utteranceId: latest.utteranceId,
            checksum: latest.checksum,
            mimeType: mimeType,
            audioBuffer: audioBuffer,
          },
          [audioBuffer]
        );
        return true;
      } catch (_error) {
        return false;
      }
    }

    async function handleBridgeMessage(event) {
      if (event?.source !== pageWindow || event?.origin !== origin) {
        return false;
      }
      const data = event.data && typeof event.data === "object" ? event.data : {};
      if (data.source !== SOURCE || !/^[a-f0-9]{32,128}$/i.test(String(data.nonce || ""))) {
        return false;
      }
      if (data.type === REGISTER_TYPE) {
        nonce = String(data.nonce);
        publishSnapshot();
        return true;
      }
      if (data.type === REQUEST_AUDIO_TYPE && nonce && data.nonce === nonce) {
        return deliverAudio();
      }
      return false;
    }

    function install() {
      pageWindow.addEventListener("message", handleBridgeMessage);
      const nativeFetch = pageWindow.fetch;
      if (typeof nativeFetch === "function") {
        pageWindow.fetch = function () {
          const args = Array.from(arguments);
          const rawUrl = typeof args[0] === "string" ? args[0] : args[0]?.url;
          return nativeFetch.apply(this, args).then(function (response) {
            const target = resolveUrl(rawUrl, pageHref);
            if (target?.pathname === UTTERANCE_PATH) {
              response.clone().json().then(function (payload) {
                observeResponse(rawUrl, payload);
              }).catch(function () {});
            }
            return response;
          });
        };
      }
      const NativeXhr = pageWindow.XMLHttpRequest;
      if (typeof NativeXhr === "function") {
        const nativeOpen = NativeXhr.prototype.open;
        const nativeSend = NativeXhr.prototype.send;
        NativeXhr.prototype.open = function (_method, url) {
          this.__ascJdTtsUrl = String(url || "");
          return nativeOpen.apply(this, arguments);
        };
        NativeXhr.prototype.send = function () {
          const xhr = this;
          if (resolveUrl(xhr.__ascJdTtsUrl, pageHref)?.pathname === UTTERANCE_PATH) {
            xhr.addEventListener("load", function () {
              try {
                observeResponse(xhr.__ascJdTtsUrl, JSON.parse(xhr.responseText || "{}"));
              } catch (_error) {}
            });
          }
          return nativeSend.apply(this, arguments);
        };
      }
    }

    return { observeResponse, handleBridgeMessage, install };
  }

  const api = { createObserver };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof window !== "undefined" && !window.__ASREdgeJdTtsShanghaiObserverInstalled) {
    window.__ASREdgeJdTtsShanghaiObserverInstalled = true;
    createObserver().install();
  }
})();

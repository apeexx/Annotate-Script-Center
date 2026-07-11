(function () {
  const protocol = globalThis.__ASREdgeJudgementNetworkProtocol;
  const networkConfig = globalThis.__ASREdgeJudgementNetworkConfig;
  const urlRewriter = globalThis.__ASREdgeJudgementNetworkUrlRewriter;
  const summary = globalThis.__ASREdgeJudgementNetworkSummary;

  if (window.__ASREdgeJudgementNetworkObserver) {
    return;
  }

  if (!protocol || !networkConfig || !urlRewriter || !summary) {
    return;
  }

  const state = networkConfig.createInitialState();

  function patchFetch() {
    if (typeof window.fetch !== "function") {
      return;
    }

    const nativeFetch = window.fetch;
    window.fetch = function (resource, init) {
      const rewrite = urlRewriter.rewriteFetchResource(resource, init, state);
      return nativeFetch.call(this, rewrite.resource, rewrite.init).then(function (response) {
        summary.captureFetchResponse(state, response, rewrite.captureUrl || response.url, rewrite.pageSize || null);
        return response;
      });
    };
  }

  function patchXhr() {
    if (typeof window.XMLHttpRequest !== "function") {
      return;
    }

    const nativeOpen = window.XMLHttpRequest.prototype.open;
    const nativeSend = window.XMLHttpRequest.prototype.send;

    window.XMLHttpRequest.prototype.open = function (method, url) {
      const rewrite = urlRewriter.maybeRewriteUrl(url, method, state);
      this.__asrEdgeJudgementDataUrl = rewrite.absoluteUrl;
      this.__asrEdgeJudgementRewrittenPageSize = rewrite.pageSize || null;

      const args = Array.prototype.slice.call(arguments);
      args[1] = rewrite.changed ? urlRewriter.formatResourceUrl(url, rewrite.url) : rewrite.url;
      return nativeOpen.apply(this, args);
    };

    window.XMLHttpRequest.prototype.send = function () {
      if (protocol.isSubtaskDataUrl(protocol.parseUrl(this.__asrEdgeJudgementDataUrl || ""))) {
        this.addEventListener(
          "loadend",
          function () {
            try {
              const text = String(this.responseText || "");
              if (!text) {
                return;
              }
              summary.captureBody(
                state,
                JSON.parse(text),
                this.__asrEdgeJudgementDataUrl || "",
                this.__asrEdgeJudgementRewrittenPageSize || null
              );
            } catch (error) {}
          },
          { once: true }
        );
      }

      return nativeSend.apply(this, arguments);
    };
  }

  function handleConfigMessage(event) {
    const message = event && event.data && typeof event.data === "object" ? event.data : null;
    if (!message || message.source !== protocol.SOURCE_CONTENT || message.type !== protocol.TYPE_CONFIG) {
      return;
    }

    const payload = message.payload && typeof message.payload === "object" ? message.payload : {};
    networkConfig.applyConfigPayload(state, payload);
  }

  Object.defineProperty(window, "__ASREdgeJudgementNetworkObserver", {
    value: {
      getState: function () {
        return protocol.clone(state);
      },
    },
    configurable: false,
    enumerable: false,
    writable: false,
  });

  window.addEventListener("message", handleConfigMessage);
  patchFetch();
  patchXhr();
})();

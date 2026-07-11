(function () {
  if (globalThis.__ascHaitianUtransDownloadBridgeInstalled) {
    if (document && document.documentElement) {
      document.documentElement.setAttribute("data-asc-haitian-utrans-download-bridge-ready", "true");
    }
    return;
  }

  const REQUEST_EVENT = "asc-haitian-utrans-download-request";
  const RESPONSE_EVENT = "asc-haitian-utrans-download-response";

  function normalizeText(value) {
    return String(value || "").trim();
  }

  function emitResponse(requestId, payload) {
    document.dispatchEvent(
      new CustomEvent(RESPONSE_EVENT, {
        detail: Object.assign(
          {
            requestId: requestId,
          },
          payload || {}
        ),
      })
    );
  }

  async function handleRequest(event) {
    const detail = event && event.detail && typeof event.detail === "object" ? event.detail : {};
    const requestId = normalizeText(detail.requestId);
    const downloadUrl = normalizeText(detail.downloadUrl);
    const fileName = normalizeText(detail.fileName) || "audio.wav";

    if (!requestId || !downloadUrl) {
      emitResponse(requestId, {
        ok: false,
        message: "页内下载参数缺失。",
      });
      return;
    }

    try {
      const response = await fetch(downloadUrl, {
        credentials: "include",
        cache: "no-store",
      });
      if (!response || !response.ok) {
        emitResponse(requestId, {
          ok: false,
          message: "下载请求失败，状态 " + String((response && response.status) || "unknown") + "。",
        });
        return;
      }

      const buffer = await response.arrayBuffer();
      if (!buffer || buffer.byteLength <= 0) {
        emitResponse(requestId, {
          ok: false,
          message: "音频响应为空，可能是登录态失效或参数不完整。",
        });
        return;
      }

      const blob = new Blob([buffer], {
        type: "audio/wav",
      });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      link.style.display = "none";
      (document.body || document.documentElement).appendChild(link);
      link.click();
      window.setTimeout(function () {
        if (link.parentNode) {
          link.parentNode.removeChild(link);
        }
        URL.revokeObjectURL(objectUrl);
      }, 0);

      emitResponse(requestId, {
        ok: true,
        message: "已开始下载 " + fileName + "。",
      });
    } catch (error) {
      emitResponse(requestId, {
        ok: false,
        message: "下载失败：" + String((error && error.message) || error || "unknown"),
      });
    }
  }

  document.addEventListener(REQUEST_EVENT, handleRequest, true);
  globalThis.__ascHaitianUtransDownloadBridgeInstalled = true;
  if (document && document.documentElement) {
    document.documentElement.setAttribute("data-asc-haitian-utrans-download-bridge-ready", "true");
  }
})();

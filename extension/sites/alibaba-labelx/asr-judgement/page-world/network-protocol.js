(function () {
  const DATA_PATH_PATTERN = /\/api\/v1\/label\/center\/subTask\/([^/]+?)\s*\/data$/;
  const MAX_ALL_PAGE_SIZE = 400;

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function normalizePageSize(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      return null;
    }

    return Math.max(1, Math.min(MAX_ALL_PAGE_SIZE, Math.floor(numericValue)));
  }

  function parseUrl(value) {
    try {
      return new URL(String(value), location.href);
    } catch (error) {
      return null;
    }
  }

  function isSubtaskDataUrl(url) {
    if (!url) {
      return false;
    }

    let decodedPath = url.pathname;
    try {
      decodedPath = decodeURIComponent(url.pathname);
    } catch (error) {
      decodedPath = url.pathname;
    }

    return DATA_PATH_PATTERN.test(decodedPath);
  }

  globalThis.__ASREdgeJudgementNetworkProtocol = {
    SOURCE_PAGE: "ASR_EDGE_JUDGEMENT_PAGE_WORLD",
    SOURCE_CONTENT: "ASR_EDGE_JUDGEMENT_CONTENT",
    TYPE_CONFIG: "ASR_EDGE_JUDGEMENT_NETWORK_CONFIG",
    TYPE_SUBTASK_DATA_SUMMARY: "ASR_EDGE_JUDGEMENT_SUBTASK_DATA_SUMMARY",
    CONFIG_CACHE_KEY: "__ASREdgeJudgementNetworkConfig",
    CONFIG_CACHE_TTL_MS: 4 * 60 * 60 * 1000,
    MAX_ALL_PAGE_SIZE: MAX_ALL_PAGE_SIZE,
    clone: clone,
    normalizePageSize: normalizePageSize,
    parseUrl: parseUrl,
    isSubtaskDataUrl: isSubtaskDataUrl,
  };
})();

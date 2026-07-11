(function () {
  const protocol = globalThis.__ASREdgeJudgementNetworkProtocol;

  function readCachedConfig() {
    try {
      const rawValue = window.sessionStorage.getItem(protocol.CONFIG_CACHE_KEY);
      const cached = rawValue ? JSON.parse(rawValue) : null;
      if (!cached || Date.now() - Number(cached.savedAt || 0) > protocol.CONFIG_CACHE_TTL_MS) {
        return null;
      }

      return cached;
    } catch (error) {
      return null;
    }
  }

  function createInitialState() {
    const cachedConfig = readCachedConfig();
    return {
      enabled: cachedConfig?.enabled === true,
      pageSizeOverride: protocol.normalizePageSize(cachedConfig?.pageSizeOverride),
      lastConfigAt: null,
      lastRewriteAt: null,
      lastSummaryAt: null,
    };
  }

  function applyConfigPayload(state, payload) {
    state.enabled = payload.enabled === true;
    state.pageSizeOverride = protocol.normalizePageSize(payload.pageSizeOverride);
    state.lastConfigAt = new Date().toISOString();

    try {
      window.sessionStorage.setItem(
        protocol.CONFIG_CACHE_KEY,
        JSON.stringify({
          enabled: state.enabled,
          pageSizeOverride: state.pageSizeOverride,
          savedAt: Date.now(),
        })
      );
    } catch (error) {}
  }

  globalThis.__ASREdgeJudgementNetworkConfig = {
    createInitialState: createInitialState,
    applyConfigPayload: applyConfigPayload,
  };
})();

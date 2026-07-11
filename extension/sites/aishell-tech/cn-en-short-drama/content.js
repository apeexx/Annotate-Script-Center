(function () {
  if (globalThis.__ASREdgeAishellTechCnEnShortDramaContentInstalled === true) {
    return;
  }
  globalThis.__ASREdgeAishellTechCnEnShortDramaContentInstalled = true;

  const CONSTANTS = globalThis.ASREdgeConstants || {};
  const STORAGE = globalThis.ASREdgeStorage || null;
  const SCRIPT_ID =
    CONSTANTS.AISHELL_TECH_CN_EN_SHORT_DRAMA_SCRIPT_ID || "aishellTechCnEnShortDrama";

  let activeRuntime = null;
  let currentUrl = location.href;
  let routeTimer = null;

  function isMarkPage() {
    return (
      location.hostname === "mark.aishelltech.com" &&
      String(location.pathname || "").toLowerCase() === "/mytask/mark"
    );
  }

  function getTargetAnchor() {
    return (
      document.querySelector(".floating-mark-area.is-docked .floating-mark") ||
      document.querySelector(".mark-form-content")
    );
  }

  async function loadRuntimeConfig() {
    const settings =
      STORAGE && typeof STORAGE.getSettings === "function"
        ? await STORAGE.getSettings()
        : { platforms: {} };
    const scriptConfig = settings?.platforms?.aishellTech?.scripts?.cnEnShortDrama || {};
    return {
      enabled:
        settings?.platforms?.aishellTech?.enabled !== false &&
        scriptConfig.enabled === true &&
        settings?.platforms?.aishellTech?.activeScriptId === SCRIPT_ID,
    };
  }

  function createRuntime() {
    const dataApiFactory = globalThis.__ASREdgeAishellTechCnEnShortDramaDataApi;
    const uiFactory = globalThis.__ASREdgeAishellTechCnEnShortDramaUiPanel;
    if (!dataApiFactory?.createRuntime || !uiFactory?.createPanel) {
      return null;
    }

    const dataApi = dataApiFactory.createRuntime();
    const panel = uiFactory.createPanel();
    let refreshTimer = null;

    async function refresh() {
      const anchor = getTargetAnchor();
      if (!anchor) {
        return;
      }
      panel.mount(anchor);
      const mediaInfo = await dataApi.getCurrentMediaInfo();
      panel.render(mediaInfo);
    }

    function start() {
      void refresh().catch(function (error) {
        console.warn(
          "[Aishell][cn-en-short-drama] initial render failed",
          error?.message || error
        );
      });
      refreshTimer = window.setInterval(function () {
        void refresh().catch(function (error) {
          console.warn(
            "[Aishell][cn-en-short-drama] refresh failed",
            error?.message || error
          );
        });
      }, 1200);
    }

    function stop() {
      if (refreshTimer) {
        window.clearInterval(refreshTimer);
        refreshTimer = null;
      }
      panel.remove();
    }

    return {
      start: start,
      stop: stop,
    };
  }

  function stopRuntime() {
    if (activeRuntime) {
      activeRuntime.stop();
      activeRuntime = null;
    }
  }

  async function evaluatePage() {
    if (!isMarkPage()) {
      stopRuntime();
      return;
    }
    const runtimeConfig = await loadRuntimeConfig();
    if (runtimeConfig.enabled !== true) {
      stopRuntime();
      return;
    }
    if (!activeRuntime) {
      const runtime = createRuntime();
      if (!runtime) {
        return;
      }
      activeRuntime = runtime;
      activeRuntime.start();
    }
  }

  function startRouteWatch() {
    if (routeTimer) {
      return;
    }
    routeTimer = window.setInterval(function () {
      if (location.href !== currentUrl) {
        currentUrl = location.href;
        void evaluatePage().catch(function (error) {
          console.warn(
            "[Aishell][cn-en-short-drama] route evaluate failed",
            error?.message || error
          );
        });
      }
    }, 300);
  }

  function bootstrap() {
    startRouteWatch();
    void evaluatePage().catch(function (error) {
      console.warn(
        "[Aishell][cn-en-short-drama] bootstrap failed",
        error?.message || error
      );
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
  } else {
    bootstrap();
  }
})();

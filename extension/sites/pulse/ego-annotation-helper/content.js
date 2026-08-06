(function () {
  const constants = globalThis.ASREdgeConstants || {};
  const storage = globalThis.ASREdgeStorage || null;
  const forbiddenTerms = globalThis.ASREdgePulseForbiddenTerms || {};
  const timelineTimer = globalThis.ASREdgePulseTimelineTimer || {};
  const uiPanel = globalThis.ASREdgePulseUiPanel || {};
  const scriptId =
    constants.PULSE_EGO_ANNOTATION_HELPER_SCRIPT_ID || "pulseEgoAnnotationHelper";
  const routePrefix = "/annotation/my/corrector/ego-annotation-gui/";
  let active = false;
  let panelHandle = null;
  let timelineHandle = null;
  let observer = null;
  let routeTimer = null;
  let scheduled = false;

  function isTargetRoute() {
    return (
      location.hostname === (constants.PULSE_PLATFORM?.host || "pulse.xdof.cn") &&
      String(location.pathname || "").startsWith(routePrefix)
    );
  }

  function isEnabled(settings) {
    if (typeof constants.isScriptRuntimeAccessible === "function") {
      return constants.isScriptRuntimeAccessible(scriptId, settings || {});
    }
    return Boolean(
      settings?.platforms?.pulse?.enabled === true &&
        settings?.platforms?.pulse?.activeScriptId === scriptId &&
        settings?.platforms?.pulse?.scripts?.egoAnnotationHelper?.enabled === true
    );
  }

  function getMatcher() {
    if (typeof forbiddenTerms.loadMatcherFromExtension !== "function") {
      return Promise.reject(new Error("禁用词模块不可用。"));
    }
    return forbiddenTerms.loadMatcherFromExtension();
  }

  function mountPageUi() {
    if (!active || !isTargetRoute()) {
      return;
    }
    if (!timelineHandle && typeof timelineTimer.createController === "function") {
      timelineHandle = timelineTimer.createController(document, window);
      timelineHandle.start();
    }
    if (typeof uiPanel.mount === "function") {
      panelHandle = uiPanel.mount(document, getMatcher) || panelHandle;
    }
  }

  function unmount() {
    active = false;
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (timelineHandle) {
      timelineHandle.stop();
      timelineHandle = null;
    }
    if (panelHandle) {
      panelHandle.destroy();
      panelHandle = null;
    }
    if (typeof uiPanel.removeAll === "function") {
      uiPanel.removeAll(document);
    }
  }

  function scheduleMount() {
    if (scheduled) {
      return;
    }
    scheduled = true;
    const schedule = typeof requestAnimationFrame === "function" ? requestAnimationFrame : setTimeout;
    schedule(function () {
      scheduled = false;
      if (!isTargetRoute()) {
        unmount();
        return;
      }
      mountPageUi();
    });
  }

  function activate() {
    if (active) {
      scheduleMount();
      return;
    }
    active = true;
    observer = new MutationObserver(scheduleMount);
    observer.observe(document.documentElement || document, { childList: true, subtree: true });
    mountPageUi();
  }

  async function reconcile() {
    if (!isTargetRoute() || !storage || typeof storage.getSettings !== "function") {
      unmount();
      return;
    }
    try {
      const settings = await storage.getSettings();
      if (isEnabled(settings)) {
        activate();
      } else {
        unmount();
      }
    } catch (_error) {
      unmount();
    }
  }

  function handleStorageChange(changes, areaName) {
    const customTermsChanged =
      typeof forbiddenTerms.isCustomTermsStorageChange === "function" &&
      forbiddenTerms.isCustomTermsStorageChange(changes, areaName);
    if (customTermsChanged) {
      if (typeof forbiddenTerms.invalidateMatcherCache === "function") {
        forbiddenTerms.invalidateMatcherCache();
      }
      if (panelHandle && typeof panelHandle.resetForbiddenTermsCheck === "function") {
        panelHandle.resetForbiddenTermsCheck();
      }
    }
    void reconcile();
  }

  window.addEventListener("popstate", handleStorageChange);
  window.addEventListener("hashchange", handleStorageChange);
  if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener(handleStorageChange);
  }
  routeTimer = window.setInterval(function () {
    if (!isTargetRoute()) {
      unmount();
    } else if (!active) {
      void reconcile();
    }
  }, 500);

  void reconcile();

  window.addEventListener("beforeunload", function () {
    if (routeTimer) {
      window.clearInterval(routeTimer);
      routeTimer = null;
    }
    unmount();
  });
})();

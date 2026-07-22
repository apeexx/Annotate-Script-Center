(function () {
  "use strict";

  const SCRIPT_ID = "jdTtsShanghaineseAssistant";
  const ROUTE_PART = "/annotation/dataset/annotate";
  const TIMEOUT_MS = 60000;

  function isAnnotateRoute(locationRef) { return String(locationRef?.hash || "").indexOf(ROUTE_PART) >= 0; }
  function sameIdentity(left, right) { return String(left?.utteranceId || "") === String(right?.utteranceId || "") && String(left?.checksum || "") === String(right?.checksum || ""); }
  function sanitizeError(error) { return String(error?.code || error?.message || "识别失败。").replace(/https?:\/\/\S+|data:audio\/\S+/gi, "[已隐藏]").slice(0, 120); }

  function createRuntime(options) {
    const config = options && typeof options === "object" ? options : {};
    const locationRef = config.location || globalThis.location;
    const documentRef = config.document || globalThis.document;
    const dataApi = config.createDataApi ? config.createDataApi() : globalThis.ASREdgeJdTtsShanghaiDataApi?.createRuntime?.({});
    const aiClient = config.createAiClient ? config.createAiClient() : globalThis.ASREdgeJdTtsShanghaiAiRecommendation?.createRuntime?.(config);
    let panel = null;
    let observer = null;
    let activeAbortController = null;
    let timeoutTimer = null;
    let started = false;

    async function enabled() {
      if (typeof config.isEnabled === "function") { return config.isEnabled(); }
      const settings = await globalThis.ASREdgeStorage?.getSettings?.();
      const script = settings?.platforms?.jdTtsAnnotation?.scripts?.shanghaineseHelper;
      return script?.enabled === true && settings?.platforms?.jdTtsAnnotation?.activeScriptId === SCRIPT_ID;
    }

    function cancelActiveRequest() {
      if (timeoutTimer) { globalThis.clearTimeout(timeoutTimer); timeoutTimer = null; }
      activeAbortController?.abort?.();
      activeAbortController = null;
    }

    function ensureMounted() { panel?.ensureMounted?.(); }

    async function handleRecommend() {
      if (!started || activeAbortController) { return; }
      const controller = new AbortController();
      activeAbortController = controller;
      timeoutTimer = globalThis.setTimeout(function () { controller.abort(); }, TIMEOUT_MS);
      panel?.setBusy?.(true);
      try {
        const snapshot = await dataApi.getCurrentAudio({ signal: controller.signal });
        if (controller.signal.aborted || !snapshot) { return; }
        const result = await aiClient.recommend(snapshot, { signal: controller.signal });
        if (controller.signal.aborted || !sameIdentity(result, snapshot) || dataApi.isCurrentSnapshot?.(snapshot) !== true) { return; }
        panel?.fillRecommendedText?.(result, function () { return controller.signal.aborted !== true && dataApi.isCurrentSnapshot?.(snapshot) === true; });
      } catch (error) {
        if (!controller.signal.aborted) { panel?.setStatus?.(sanitizeError(error)); }
      } finally {
        if (activeAbortController === controller) { activeAbortController = null; }
        if (timeoutTimer) { globalThis.clearTimeout(timeoutTimer); timeoutTimer = null; }
        panel?.setBusy?.(false);
      }
    }

    function start() {
      if (started) { return; }
      started = true;
      dataApi?.start?.();
      panel = config.createPanel ? config.createPanel() : globalThis.ASREdgeJdTtsShanghaiUiPanel?.createRuntime?.({ document: documentRef });
      panel?.setOnRecommend?.(handleRecommend);
      ensureMounted();
      if (typeof globalThis.MutationObserver === "function" && documentRef?.documentElement) {
        observer = new globalThis.MutationObserver(ensureMounted);
        observer.observe(documentRef.documentElement, { childList: true, subtree: true });
      }
    }

    function stop() {
      cancelActiveRequest();
      observer?.disconnect?.(); observer = null;
      panel?.remove?.(); panel = null;
      dataApi?.stop?.();
      started = false;
    }

    async function evaluatePage() { if (!isAnnotateRoute(locationRef) || !(await enabled())) { stop(); return false; } start(); return true; }
    function setActiveAbortController(value) { activeAbortController = value; }
    return { evaluatePage, handleRecommend, stop, setActiveAbortController, location: locationRef };
  }

  const api = { createRuntime, isAnnotateRoute, sameIdentity };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; }
  globalThis.ASREdgeJdTtsShanghaiContent = api;

  if (typeof document !== "undefined" && globalThis.__ASREdgeJdTtsShanghaiContentInstalled !== true) {
    globalThis.__ASREdgeJdTtsShanghaiContentInstalled = true;
    const runtime = createRuntime({});
    const evaluate = function () { void runtime.evaluatePage(); };
    evaluate();
    globalThis.setInterval(function () { evaluate(); }, 300);
  }
})();

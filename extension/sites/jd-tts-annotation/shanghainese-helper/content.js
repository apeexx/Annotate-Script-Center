(function () {
  "use strict";

  const SCRIPT_ID = "jdTtsShanghaineseAssistant";
  const ROUTE_PART = "/annotation/dataset/annotate";
  const TIMEOUT_MS = 60000;

  function isAnnotateRoute(locationRef) { return String(locationRef?.hash || "").indexOf(ROUTE_PART) >= 0; }
  function sameIdentity(left, right) { return String(left?.utteranceId || "") === String(right?.utteranceId || "") && String(left?.checksum || "") === String(right?.checksum || ""); }
  function sanitizeError(error) {
    return String(error?.code || error?.message || "识别失败。")
      .replace(/data:audio\/[^\s"'<>]+/gi, "[已隐藏]")
      .replace(/https?:\/\/[^\s"'<>]+/gi, "[已隐藏]")
      .replace(/\b(?:cookie|authorization|token|signature|secret(?:key)?|api[_-]?key)\b\s*[:=]\s*(?:Bearer\s+)?(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, "[已隐藏]")
      .replace(/\bBearer\s+[^\s,;]+/gi, "Bearer [已隐藏]")
      .slice(0, 120);
  }

  function createRuntime(options) {
    const config = options && typeof options === "object" ? options : {};
    const locationRef = config.location || globalThis.location;
    const documentRef = config.document || globalThis.document;
    const dataApi = config.createDataApi ? config.createDataApi() : globalThis.ASREdgeJdTtsShanghaiDataApi?.createRuntime?.({});
    const aiClient = config.createAiClient ? config.createAiClient() : globalThis.ASREdgeJdTtsShanghaiAiRecommendation?.createRuntime?.({});
    let panel = null;
    let observer = null;
    let observerTarget = null;
    let activeRun = null;
    let nextRunId = 0;
    let evaluationVersion = 0;
    let started = false;

    async function enabled() {
      if (typeof config.isEnabled === "function") { return config.isEnabled(); }
      const settings = await globalThis.ASREdgeStorage?.getSettings?.();
      const script = settings?.platforms?.jdTtsAnnotation?.scripts?.shanghaineseHelper;
      return script?.enabled === true && settings?.platforms?.jdTtsAnnotation?.activeScriptId === SCRIPT_ID;
    }

    function cancelActiveRequest() {
      const run = activeRun;
      if (!run) { return; }
      if (run.timer) { globalThis.clearTimeout(run.timer); run.timer = null; }
      activeRun = null;
      run.controller?.abort?.();
      panel?.setBusy?.(false);
    }

    function installObserver() {
      const nextTarget = panel?.getMountTarget?.() || null;
      if (!nextTarget || observerTarget === nextTarget || typeof globalThis.MutationObserver !== "function") { return; }
      observer?.disconnect?.();
      observerTarget = nextTarget;
      observer = new globalThis.MutationObserver(function () { ensureMounted(); });
      observer.observe(nextTarget, { childList: true, subtree: true });
    }

    function ensureMounted() {
      panel?.ensureMounted?.();
      installObserver();
    }

    async function handleRecommend() {
      if (!started || activeRun) { return; }
      const run = { id: ++nextRunId, controller: new AbortController(), timer: null };
      activeRun = run;
      run.timer = globalThis.setTimeout(function () { run.controller.abort(); }, TIMEOUT_MS);
      panel?.setBusy?.(true);
      try {
        const snapshot = await dataApi?.getCurrentAudio?.({ signal: run.controller.signal });
        if (run.controller.signal.aborted || !snapshot || activeRun !== run) { return; }
        const result = await aiClient?.recommend?.(snapshot, { signal: run.controller.signal });
        if (run.controller.signal.aborted || activeRun !== run || !sameIdentity(result, snapshot) || dataApi?.isCurrentSnapshot?.(snapshot) !== true) { return; }
        panel?.fillRecommendedText?.(result, function () { return activeRun === run && run.controller.signal.aborted !== true && dataApi?.isCurrentSnapshot?.(snapshot) === true; });
      } catch (error) {
        if (activeRun === run && !run.controller.signal.aborted) { panel?.setStatus?.(sanitizeError(error)); }
      } finally {
        if (activeRun === run) {
          if (run.timer) { globalThis.clearTimeout(run.timer); run.timer = null; }
          activeRun = null;
          panel?.setBusy?.(false);
        }
      }
    }

    function start() {
      if (started) { ensureMounted(); return; }
      started = true;
      dataApi?.start?.();
      panel = config.createPanel ? config.createPanel() : globalThis.ASREdgeJdTtsShanghaiUiPanel?.createRuntime?.({ document: documentRef });
      panel?.setOnRecommend?.(handleRecommend);
      ensureMounted();
    }

    function stop() {
      evaluationVersion += 1;
      cancelActiveRequest();
      observer?.disconnect?.(); observer = null; observerTarget = null;
      panel?.remove?.(); panel = null;
      dataApi?.stop?.();
      started = false;
    }

    async function evaluatePage() {
      const version = ++evaluationVersion;
      if (!isAnnotateRoute(locationRef)) { stop(); return false; }
      const pageEnabled = await enabled();
      if (version !== evaluationVersion) { return false; }
      if (!pageEnabled) { stop(); return false; }
      start();
      return true;
    }

    function setActiveAbortController(value) {
      activeRun = value ? { id: ++nextRunId, controller: value, timer: null } : null;
    }
    return { evaluatePage, handleRecommend, stop, setActiveAbortController, location: locationRef };
  }

  const api = { createRuntime, isAnnotateRoute, sameIdentity, sanitizeError };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; }
  globalThis.ASREdgeJdTtsShanghaiContent = api;

  if (typeof document !== "undefined" && globalThis.__ASREdgeJdTtsShanghaiContentInstalled !== true) {
    globalThis.__ASREdgeJdTtsShanghaiContentInstalled = true;
    const runtime = createRuntime({});
    const evaluate = function () { void runtime.evaluatePage(); };
    evaluate();
    globalThis.setInterval(evaluate, 300);
  }
})();

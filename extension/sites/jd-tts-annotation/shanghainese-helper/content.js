(function () {
  "use strict";

  const SCRIPT_ID = "jdTtsShanghaineseAssistant";
  const ROUTE_PART = "/annotation/dataset/annotate";
  const TIMEOUT_MS = 60000;
  const diagnostics = globalThis.ASREdgeJdTtsShanghaiDiagnostics || {};

  function isAnnotateRoute(locationRef) { return String(locationRef?.hash || "").indexOf(ROUTE_PART) >= 0; }
  function sameIdentity(left, right) { return String(left?.utteranceId || "") === String(right?.utteranceId || "") && String(left?.checksum || "") === String(right?.checksum || ""); }
  async function isSameFullAudio(dataApi, snapshot, signal) {
    if (typeof dataApi?.isSameFullAudio === "function") {
      return (await dataApi.isSameFullAudio(snapshot, { signal })) === true;
    }
    return dataApi?.isCurrentSnapshot?.(snapshot) === true;
  }
  function sanitizeError(error) {
    return String(error?.message || error?.code || "识别失败。")
      .replace(/data:audio\/[^\s"'<>]+/gi, "[已隐藏]")
      .replace(/https?:\/\/[^\s"'<>]+/gi, "[已隐藏]")
      .replace(/\b(?:cookie|authorization|token|signature|secret(?:key)?|api[_-]?key)\b\s*[:=]\s*(?:Bearer\s+)?(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, "[已隐藏]")
      .replace(/\bBearer\s+[^\s,;]+/gi, "Bearer [已隐藏]")
      .slice(0, 120);
  }

  function stageLabel(value, fallback) {
    const key = String(value || "").trim().toLowerCase();
    if (key === "validate") { return "使用人检查"; }
    if (key === "health") { return "后端健康检查"; }
    if (key === "create") { return "创建识别任务"; }
    if (key === "poll" || key === "job") { return "等待识别结果"; }
    if (key === "write") { return "写入文本框"; }
    return String(fallback || "识别请求");
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

    function updateRunInfo(run, patch) {
      if (!run || activeRun !== run) { return; }
      run.info = Object.assign({}, run.info || {}, patch || {});
      panel?.updateInfo?.(run.info);
    }

    function buildFailure(error, fallbackStage) {
      const safeError = {
        code: String(error?.code || "request-error"),
        message: sanitizeError(error),
        rawResponse: error?.rawResponse && typeof error.rawResponse === "object" ? error.rawResponse : null,
      };
      if (typeof diagnostics.buildFailureDetails === "function") {
        return diagnostics.buildFailureDetails(safeError, fallbackStage);
      }
      return { step: fallbackStage, code: safeError.code, summary: safeError.message, suggestion: "请稍后重试。" };
    }

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
      const run = {
        id: ++nextRunId,
        controller: new AbortController(),
        timer: null,
        timedOut: false,
        info: { operatorName: "未设置", status: "进行中", stage: "使用人检查", resultText: "", fillState: "未写入", details: [], error: null },
      };
      activeRun = run;
      run.timer = globalThis.setTimeout(function () { run.timedOut = true; run.controller.abort(); }, TIMEOUT_MS);
      panel?.setBusy?.(true);
      panel?.setStatus?.("正在识别当前音频…", "pending");
      try {
        updateRunInfo(run, { status: "进行中", stage: "使用人检查", fillState: "未写入", error: null });
        const preparedRun = typeof aiClient?.prepareRun === "function" ? await aiClient.prepareRun() : {};
        if (run.controller.signal.aborted || activeRun !== run) { return; }
        updateRunInfo(run, {
          operatorName: preparedRun?.requestMeta?.aiUsageOperatorName || "未设置",
          status: "进行中",
          stage: "获取当前 WAV",
        });
        const lockedTextTarget = panel?.getTextTarget?.() || null;
        const snapshot = await dataApi?.getCurrentAudio?.({ signal: run.controller.signal });
        if (run.controller.signal.aborted || activeRun !== run) { return; }
        if (!snapshot) {
          panel?.setStatus?.("未获取当前 WAV，请刷新页面后重试。", "warning");
          updateRunInfo(run, { status: "失败", stage: "获取当前 WAV", fillState: "未写入", error: { step: "获取当前 WAV", code: "audio-unavailable", summary: "未获取当前 WAV，请刷新页面后重试。", suggestion: "刷新当前标注页面后重新点击识别。" } });
          return;
        }
        updateRunInfo(run, { status: "进行中", stage: "后端健康检查" });
        const result = await aiClient?.recommend?.(snapshot, {
          signal: run.controller.signal,
          preparedRun,
          onStage: function (stage) {
            updateRunInfo(run, { status: "进行中", stage: stageLabel(stage?.key, stage?.label) });
          },
        });
        if (run.controller.signal.aborted || activeRun !== run) { return; }
        updateRunInfo(run, { status: "进行中", stage: "校验完整 WAV", resultText: typeof result?.listenText === "string" ? result.listenText : "" });
        if (!sameIdentity(result, snapshot)) {
          panel?.setStatus?.("识别结果与当前请求不一致，未写入文本。", "warning");
          updateRunInfo(run, { status: "未回填", stage: "校验完整 WAV", fillState: "识别结果与当前请求不一致", error: null });
          return;
        }
        if (!(await isSameFullAudio(dataApi, snapshot, run.controller.signal)) || run.controller.signal.aborted || activeRun !== run) {
          if (run.controller.signal.aborted || activeRun !== run) { return; }
          panel?.setStatus?.("完整音频已切换，未写入旧识别结果。", "warning");
          updateRunInfo(run, { status: "未回填", stage: "校验完整 WAV", fillState: "完整音频已切换", error: null });
          return;
        }
        updateRunInfo(run, { status: "进行中", stage: "写入文本框" });
        const filled = panel?.fillRecommendedText?.(result, function () { return activeRun === run && run.controller.signal.aborted !== true; }, lockedTextTarget) === true;
        const details = typeof diagnostics.buildSuccessDetails === "function" ? diagnostics.buildSuccessDetails(result) : [];
        if (filled) {
          panel?.setStatus?.("识别完成，已回填文本。", "success");
          updateRunInfo(run, { status: "成功", stage: "写入文本框", fillState: "已回填文本", details, error: null });
        } else if (!String(result?.listenText || "").trim()) {
          panel?.setStatus?.("未识别到有效文本，请人工复核。", "warning");
          updateRunInfo(run, { status: "需人工复核", stage: "写入文本框", fillState: "未写入（空识别）", details, error: null });
        } else {
          panel?.setStatus?.("未写入文本：文本框已更新或不可写。", "warning");
          updateRunInfo(run, { status: "未回填", stage: "写入文本框", fillState: "文本框已更新或不可写", details, error: null });
        }
      } catch (error) {
        if (activeRun === run && !run.controller.signal.aborted) {
          const failureStage = stageLabel(error?.stage || error?.phase, run.info?.stage);
          const failure = buildFailure(error, failureStage);
          panel?.setStatus?.(failure.summary, "error");
          updateRunInfo(run, { status: "失败", stage: failureStage, fillState: "未写入", error: failure });
        }
      } finally {
        if (activeRun === run) {
          if (run.timer) { globalThis.clearTimeout(run.timer); run.timer = null; }
          activeRun = null;
          panel?.setBusy?.(false);
          if (run.timedOut) {
            const timedOutStage = String(run.info?.stage || "").trim() || "等待识别结果";
            panel?.setStatus?.("识别超时，请稍后重试。", "warning");
            run.info = Object.assign({}, run.info || {}, { status: "失败", stage: timedOutStage, fillState: "未写入", error: { step: timedOutStage, code: "timeout", summary: "识别超时，请稍后重试。", suggestion: "识别超过 60 秒，请稍后重试。" } });
            panel?.updateInfo?.(run.info);
          }
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

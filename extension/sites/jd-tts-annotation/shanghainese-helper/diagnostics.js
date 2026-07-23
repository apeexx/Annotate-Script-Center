(function () {
  "use strict";

  const errorDisplay = globalThis.ASREdgeAiErrorDisplay || {};

  function normalizeText(value, maxLength) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/data:audio\/[^\s"'<>]+/gi, "[已隐藏]")
      .replace(/https?:\/\/[^\s"'<>]+/gi, "[已隐藏]")
      .replace(/\b(?:cookie|authorization|token|signature|secret(?:key)?|api[_-]?key)\b\s*[:=]\s*(?:Bearer\s+)?(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, "[已隐藏]")
      .replace(/\bBearer\s+[^\s,;]+/gi, "Bearer [已隐藏]")
      .slice(0, maxLength || 240);
  }

  function formatDurationMs(value) {
    const number = Number(value || 0);
    if (!Number.isFinite(number) || number <= 0) { return "-"; }
    if (number >= 1000) { return (number / 1000).toFixed(1).replace(/\.0$/, "") + "s"; }
    return String(Math.round(number)) + "ms";
  }

  function formatTokenSummary(usage) {
    const source = usage && typeof usage === "object" ? usage : {};
    const prompt = Number(source.promptTokens || 0);
    const completion = Number(source.completionTokens || 0);
    const total = Number(source.totalTokens || 0);
    if (prompt <= 0 && completion <= 0 && total <= 0) { return "-"; }
    return "输入 " + String(prompt || 0) + " / 输出 " + String(completion || 0) + " / 合计 " + String(total || 0);
  }

  function formatCost(cost, usage) {
    const source = cost && typeof cost === "object" ? cost : {};
    const number = Number(source.totalEstimatedCostCny ?? source.recognize?.estimatedCostCny ?? usage?.estimatedCostCny);
    if (Number.isFinite(number)) {
      return String(number.toFixed(6)).replace(/0+$/, "").replace(/\.$/, "") + " 元";
    }
    if (normalizeText(source.recognize?.reason) === "没有数据源") { return "没有数据源"; }
    return normalizeText(source.note || source.recognize?.reason) || "-";
  }

  function buildSuccessDetails(result) {
    const meta = result?.meta && typeof result.meta === "object" ? result.meta : {};
    const models = meta.models && typeof meta.models === "object" ? meta.models : {};
    const timing = meta.timing && typeof meta.timing === "object" ? meta.timing : {};
    const usage = meta.usage && typeof meta.usage === "object" ? meta.usage : {};
    const cost = meta.cost && typeof meta.cost === "object" ? meta.cost : {};
    const queue = meta.queue && typeof meta.queue === "object" ? meta.queue : {};
    const cache = meta.cache && typeof meta.cache === "object" ? meta.cache : {};
    return [
      ["模型", normalizeText(models.omniModel || models.recognizeModel) || "-"],
      ["总耗时", formatDurationMs(timing.totalDurationMs)],
      ["Token", formatTokenSummary(usage)],
      ["预估人民币", formatCost(cost, usage)],
      ["排队等待", formatDurationMs(queue.totalQueueWaitMs)],
      ["缓存命中", cache.hit === true ? "是" : "否"],
      ["requestId", normalizeText(meta.requestId) || "-"],
    ];
  }

  function defaultSuggestion(code, rawResponse) {
    const backendMode = normalizeText(rawResponse?.backendMode).toLowerCase() === "local" ? "local" : "server";
    if (code === "missing-ai-usage-operator-name") {
      return "当前标注页所属的同一个扩展实例未读取到 AI 调用使用人；请在同一个扩展首页填写并保存后刷新当前标注页。";
    }
    if (code === "extension-context-invalidated") {
      return "扩展已重新加载，当前页面仍在使用旧脚本；请刷新当前标注页后再识别。";
    }
    if (code === "ai-usage-operator-storage-unavailable") {
      return "当前扩展实例无法读取使用人配置；请重新打开扩展首页，并确认浏览器只保留一个 0.4.5 扩展实例。";
    }
    if (code === "backend-health-check-failed") {
      if (backendMode === "local") {
        return "当前为本地模式，本机后端未通过健康检查；请启动 node platform-resources\\backend\\server.js 后重试。";
      }
      return "当前为服务端模式，远端未部署上海话路由；如需本地验收，请切换为本地模式并启动 node platform-resources\\backend\\server.js。";
    }
    if (code === "shanghainese-route-not-deployed") {
      if (backendMode === "local") {
        return "当前本机后端未部署上海话路由；请从当前仓库启动 node platform-resources\\backend\\server.js 后重试。";
      }
      return "当前远端未部署上海话路由；请切换为本地模式并启动 node platform-resources\\backend\\server.js 进行验收。";
    }
    if (code === "timeout" || code === "ai-job-timeout") { return "识别超过 60 秒，请稍后重试。"; }
    if (code === "network-disconnected") { return "请检查当前后端服务和网络连通性。"; }
    if (/rate-limited|limit_burst_rate/i.test(code)) { return "上游模型限流，请稍后重试。"; }
    return "请根据错误摘要检查当前条目和后端服务。";
  }

  function buildFailureDetails(error, fallbackStep) {
    const source = error && typeof error === "object" ? error : {};
    const display = typeof errorDisplay.buildAiErrorDisplay === "function"
      ? errorDisplay.buildAiErrorDisplay({ message: source.message, rawResponse: source.rawResponse })
      : {};
    const code = normalizeText(source.code) || "request-error";
    return {
      step: normalizeText(fallbackStep) || "识别请求",
      code,
      summary: normalizeText(display.summary || source.message || code),
      suggestion: normalizeText(defaultSuggestion(code, source.rawResponse) || display.inference),
    };
  }

  const api = { buildFailureDetails, buildSuccessDetails, formatDurationMs, formatTokenSummary };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; }
  globalThis.ASREdgeJdTtsShanghaiDiagnostics = api;
})();

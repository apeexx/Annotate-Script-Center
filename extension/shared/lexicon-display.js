(function () {
  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function resolveLexiconStatusLabel(status) {
    const normalized = normalizeText(status).toLowerCase();
    if (normalized === "ready") {
      return "主词表已加载";
    }
    if (normalized === "reference_only") {
      return "仅参考源";
    }
    if (normalized === "missing") {
      return "主词表缺失";
    }
    return normalized ? "主词表异常" : "";
  }

  function formatLexiconStatusAndMode(lexicon, options) {
    const source = lexicon && typeof lexicon === "object" ? lexicon : null;
    if (!source) {
      return "";
    }
    const statusLabel = resolveLexiconStatusLabel(source.status);
    if (!statusLabel) {
      return "";
    }
    return (
      statusLabel +
      " / 固定携带 / 改写模式 " +
      (normalizeText(source.rewriteMode).toLowerCase() || "off")
    );
  }

  const api = {
    formatLexiconStatusAndMode,
  };

  globalThis.ASREdgeLexiconDisplay = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();

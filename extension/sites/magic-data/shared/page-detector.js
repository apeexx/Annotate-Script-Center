(function () {
  const HOSTNAME = "work.magicdatatech.com";

  function isMagicDataHost() {
    return location.hostname === HOSTNAME;
  }

  function parseHashParams() {
    const hash = String(location.hash || "");
    const queryIndex = hash.indexOf("?");
    const params = new URLSearchParams(queryIndex >= 0 ? hash.slice(queryIndex + 1) : "");
    return {
      taskItemId: String(params.get("taskItemId") || "").trim(),
      formType: String(params.get("formType") || "").trim(),
      userId: String(params.get("userId") || "").trim(),
      samplingRecordId: String(params.get("id") || "").trim(),
    };
  }

  function getRoutePath() {
    const hash = String(location.hash || "");
    if (!hash) {
      return "";
    }
    const cleanHash = hash.charAt(0) === "#" ? hash.slice(1) : hash;
    return cleanHash.split("?")[0] || "";
  }

  function getPageType() {
    if (!isMagicDataHost()) {
      return "unknown";
    }
    const routePath = getRoutePath();
    if (routePath === "/welcome") {
      return "welcome";
    }
    if (routePath === "/mark/list") {
      return "markList";
    }
    if (routePath === "/mark/details") {
      return "markDetails";
    }
    if (routePath === "/asrmark") {
      return "asrmark";
    }
    if (routePath === "/checkTask") {
      return "checkTask";
    }
    if (routePath === "/checkdata/taskDetail") {
      return "checkTaskDetail";
    }
    if (routePath === "/asrmarkCheck") {
      return "asrmarkCheck";
    }
    return "unknown";
  }

  function isAsrmarkPage() {
    return isMagicDataHost() && getPageType() === "asrmark";
  }

  function isAsrmarkCheckPage() {
    return isMagicDataHost() && getPageType() === "asrmarkCheck";
  }

  globalThis.__ASREdgeMagicDataAnnotatorPageDetector = {
    HOSTNAME,
    getPageType,
    getRoutePath,
    isAsrmarkCheckPage,
    isAsrmarkPage,
    isMagicDataHost,
    parseHashParams,
  };
})();

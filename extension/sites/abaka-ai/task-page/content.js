(function () {
  const INSTALL_FLAG = "__ASCEdgeAbakaAiTaskPageContentInstalled";
  if (window[INSTALL_FLAG]) {
    return;
  }
  window[INSTALL_FLAG] = true;

  const storage = globalThis.ASREdgeStorage || {};
  const toast = globalThis.__ASCEdgeAbakaAiToast || {};
  const domActionsFactory = globalThis.__ASCEdgeAbakaAiDomActions || {};
  const shortcutFactory = globalThis.__ASCEdgeAbakaAiTask21Shortcuts || {};
  const dataCollector = globalThis.__ASCEdgeAbakaAiTask21DataCollector || {};
  const aiClient = globalThis.__ASCEdgeAbakaAiTask21AiClient || {};
  const aiPanelFactory = globalThis.__ASCEdgeAbakaAiTask21AiPanel || {};
  const pricing = globalThis.__ASCEdgeAbakaAiTask21Pricing || {};
  const TASK21_ASSISTANT_RUNTIME_VERSION = String(
    aiPanelFactory.runtimeVersion || domActionsFactory.runtimeVersion || "task21-assistant-runtime-unknown"
  );
  const TASK21_STATISTICS_TOOLBAR_RUNTIME_VERSION = "task21-statistics-toolbar-v1-20260521";
  const TASK21_STATISTICS_STYLE_ID = "asc-abaka-task21-statistics-toolbar-style";
  const TASK21_STATISTICS_TOOLBAR_ATTR = "data-asc-task21-statistics-toolbar";
  const TASK21_STATISTICS_ROUTE_HOST = "abao.fortidyndns.com";
  const TASK21_STATISTICS_ROUTE_PATH = "/task-v2/data-item";
  const TASK21_STATISTICS_REFRESH_INTERVAL_MS = 1500;
  const TASK21_STATISTICS_MUTATION_DEBOUNCE_MS = 160;

  if (
    typeof storage.getSettings !== "function" ||
    typeof domActionsFactory.createRuntime !== "function" ||
    typeof shortcutFactory.createRuntime !== "function"
  ) {
    console.warn("[ASC][Abaka AI] Task21 shortcuts skipped: runtime dependencies missing.");
    return;
  }

  let settingsCache = null;
  let shortcutRuntime = null;
  let domActionsRuntime = null;
  let aiPanelRuntime = null;
  let task21StatisticsObserver = null;
  let task21StatisticsRefreshTimer = null;
  let task21StatisticsEnsureInterval = null;
  let task21StatisticsToolbarStarted = false;
  let task21StatisticsMountedLogged = false;
  let task21StatisticsFallbackWarned = false;
  let lastTask21StatisticsUrl = String(location.href || "");

  function showToast(message, tone) {
    if (typeof toast.show === "function") {
      toast.show(message, tone || "info");
      return;
    }
    if (typeof console !== "undefined" && typeof console.info === "function") {
      console.info("[ASC][Abaka AI] " + String(message || ""));
    }
  }

  function isVisible(node) {
    if (!(node instanceof Element)) {
      return false;
    }
    const style = window.getComputedStyle(node);
    if (!style || style.display === "none" || style.visibility === "hidden") {
      return false;
    }
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function isTask21DataItemListPage() {
    const hostname = String(location.hostname || "").toLowerCase();
    const pathname = String(location.pathname || "");
    const params = new URLSearchParams(location.search || "");
    const taskId = String(params.get("taskId") || "").trim();
    const vm = String(params.get("vm") || "").trim().toLowerCase();
    if (hostname !== TASK21_STATISTICS_ROUTE_HOST) {
      return false;
    }
    if (pathname.indexOf(TASK21_STATISTICS_ROUTE_PATH) < 0) {
      return false;
    }
    if (!taskId) {
      return false;
    }
    return vm === "all" || vm === "batch";
  }

  function getTask21StatisticsRuntime() {
    return (
      globalThis.__ASCEdgeAbakaAiTask21StatisticsRuntime ||
      globalThis.__ASCEdgeAbakaAiTask21Statistics ||
      {}
    );
  }

  function ensureTask21StatisticsToolbarStyle() {
    if (document.getElementById(TASK21_STATISTICS_STYLE_ID)) {
      return;
    }
    const style = document.createElement("style");
    style.id = TASK21_STATISTICS_STYLE_ID;
    style.textContent = [
      ".asc-task21-statistics-actions{display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap;}",
      ".asc-task21-statistics-actions.is-floating{position:fixed;top:88px;right:24px;z-index:2147483000;padding:8px 10px;border-radius:12px;background:rgba(255,255,255,.98);box-shadow:0 12px 28px rgba(15,23,42,.18);border:1px solid rgba(148,163,184,.28);}",
      ".asc-task21-statistics-btn{min-width:96px;user-select:none;}",
      ".asc-task21-statistics-btn.disabled,.asc-task21-statistics-btn[aria-disabled='true']{opacity:.55;cursor:not-allowed;pointer-events:none;}",
    ].join("");
    (document.head || document.documentElement).appendChild(style);
  }

  function findTask21StatisticsMountTarget() {
    const selectors = [
      ".app-content-header-right .action-buttons.is-global",
      ".app-content-header-right .search-actions.is-global",
      ".app-content-header-right",
    ];
    for (let index = 0; index < selectors.length; index += 1) {
      const node = document.querySelector(selectors[index]);
      if (isVisible(node)) {
        return node;
      }
    }
    return null;
  }

  function getTask21StatisticsToolbarRoot() {
    return document.querySelector("[" + TASK21_STATISTICS_TOOLBAR_ATTR + "='true']");
  }

  function setPseudoButtonDisabled(button, disabled, title) {
    if (!(button instanceof HTMLElement)) {
      return;
    }
    button.classList.toggle("disabled", disabled === true);
    button.setAttribute("aria-disabled", disabled === true ? "true" : "false");
    button.tabIndex = disabled === true ? -1 : 0;
    button.title = title ? String(title) : "";
  }

  function createTask21StatisticsButton(label, variant, onClick) {
    const button = document.createElement("div");
    button.className = "button " + (variant === "primary" ? "primary" : "second") + " asc-task21-statistics-btn";
    button.setAttribute("role", "button");
    button.tabIndex = 0;
    button.textContent = label;
    button.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (button.getAttribute("aria-disabled") === "true") {
        return;
      }
      onClick();
    });
    button.addEventListener("keydown", function (event) {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      if (button.getAttribute("aria-disabled") === "true") {
        return;
      }
      onClick();
    });
    return button;
  }

  function showTask21StatisticsNotReady() {
    showToast("Task21统计模块未就绪，请先完成统计采集模块。", "warning");
  }

  function handleTask21StatisticsClick() {
    const runtime = getTask21StatisticsRuntime();
    try {
      if (typeof runtime.openPanel === "function") {
        runtime.openPanel({ source: "task21-data-item-toolbar" });
        return;
      }
      if (typeof runtime.runStatistics === "function") {
        runtime.runStatistics({ source: "task21-data-item-toolbar" });
        return;
      }
      if (typeof runtime.collectStatistics === "function") {
        runtime.collectStatistics({ source: "task21-data-item-toolbar" });
        return;
      }
    } catch (error) {
      showToast(
        "Task21统计入口调用失败：" + String(error && error.message ? error.message : error || "unknown"),
        "error"
      );
      return;
    }
    showTask21StatisticsNotReady();
  }

  function handleTask21StatisticsDownloadClick() {
    const runtime = getTask21StatisticsRuntime();
    if (typeof runtime.downloadStatisticsCsv === "function") {
      runtime.downloadStatisticsCsv({ source: "task21-data-item-toolbar" });
      return;
    }
    if (typeof runtime.getDownloadUrl === "function") {
      const url = String(runtime.getDownloadUrl() || "").trim();
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
        return;
      }
    }
    showToast("暂无统计数据，请先统计当前列表。", "info");
  }

  function updateTask21StatisticsToolbarButtons(root) {
    if (!(root instanceof HTMLElement)) {
      return;
    }
    const runtime = getTask21StatisticsRuntime();
    const downloadButton = root.querySelector("[data-asc-task21-statistics-download='true']");
    const canDownload =
      typeof runtime.downloadStatisticsCsv === "function" || typeof runtime.getDownloadUrl === "function";
    setPseudoButtonDisabled(
      downloadButton,
      canDownload !== true,
      canDownload ? "下载 Task21 统计 CSV。" : "Task21统计下载接口未就绪。"
    );
  }

  function createTask21StatisticsToolbarRoot() {
    const root = document.createElement("div");
    root.className = "asc-task21-statistics-actions";
    root.setAttribute(TASK21_STATISTICS_TOOLBAR_ATTR, "true");
    root.setAttribute("data-asc-task21-statistics-runtime", TASK21_STATISTICS_TOOLBAR_RUNTIME_VERSION);

    const statsButton = createTask21StatisticsButton("统计当前列表", "second", handleTask21StatisticsClick);
    statsButton.setAttribute("data-asc-task21-statistics-run", "true");
    statsButton.title = "统计当前列表并触发 Task21 统计入口。";
    root.appendChild(statsButton);

    const downloadButton = createTask21StatisticsButton("下载统计CSV", "second", handleTask21StatisticsDownloadClick);
    downloadButton.setAttribute("data-asc-task21-statistics-download", "true");
    root.appendChild(downloadButton);

    updateTask21StatisticsToolbarButtons(root);
    return root;
  }

  function removeTask21StatisticsToolbarButton() {
    const existing = getTask21StatisticsToolbarRoot();
    if (existing && existing.parentElement) {
      existing.parentElement.removeChild(existing);
    }
  }

  function mountTask21StatisticsToolbar(root, target) {
    if (!(root instanceof HTMLElement)) {
      return;
    }
    if (target instanceof HTMLElement) {
      root.classList.remove("is-floating");
      if (root.parentElement !== target) {
        target.appendChild(root);
      }
      return;
    }
    root.classList.add("is-floating");
    if (root.parentElement !== document.body && document.body) {
      document.body.appendChild(root);
    }
  }

  function ensureTask21StatisticsToolbarButton() {
    if (!isTask21DataItemListPage()) {
      removeTask21StatisticsToolbarButton();
      return { ok: false, message: "当前不是 Task21 数据列表页。" };
    }
    if (!document.body) {
      return { ok: false, message: "页面主体尚未就绪。" };
    }

    ensureTask21StatisticsToolbarStyle();
    const target = findTask21StatisticsMountTarget();
    let root = getTask21StatisticsToolbarRoot();
    if (!(root instanceof HTMLElement)) {
      root = createTask21StatisticsToolbarRoot();
    }
    mountTask21StatisticsToolbar(root, target);
    updateTask21StatisticsToolbarButtons(root);

    if (!task21StatisticsMountedLogged) {
      console.info("[ASC][Abaka AI] Task21 statistics toolbar mounted");
      task21StatisticsMountedLogged = true;
    }
    if (target) {
      task21StatisticsFallbackWarned = false;
    } else if (!task21StatisticsFallbackWarned) {
      console.warn("[ASC][Abaka AI] Task21 statistics toolbar fallback mounted: header target not found.");
      task21StatisticsFallbackWarned = true;
    }
    return {
      ok: true,
      message: target ? "Task21 statistics toolbar mounted." : "Task21 statistics toolbar fallback mounted.",
    };
  }

  function scheduleTask21StatisticsToolbarEnsure() {
    if (task21StatisticsRefreshTimer) {
      window.clearTimeout(task21StatisticsRefreshTimer);
    }
    task21StatisticsRefreshTimer = window.setTimeout(function () {
      task21StatisticsRefreshTimer = null;
      ensureTask21StatisticsToolbarButton();
    }, TASK21_STATISTICS_MUTATION_DEBOUNCE_MS);
  }

  function startTask21StatisticsToolbarRuntime() {
    if (task21StatisticsToolbarStarted) {
      scheduleTask21StatisticsToolbarEnsure();
      return;
    }
    task21StatisticsToolbarStarted = true;
    ensureTask21StatisticsToolbarButton();

    if (document.body && typeof MutationObserver === "function") {
      task21StatisticsObserver = new MutationObserver(function () {
        scheduleTask21StatisticsToolbarEnsure();
      });
      task21StatisticsObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }

    task21StatisticsEnsureInterval = window.setInterval(function () {
      const currentUrl = String(location.href || "");
      if (currentUrl !== lastTask21StatisticsUrl) {
        lastTask21StatisticsUrl = currentUrl;
        if (!isTask21DataItemListPage()) {
          removeTask21StatisticsToolbarButton();
          return;
        }
      }
      ensureTask21StatisticsToolbarButton();
    }, TASK21_STATISTICS_REFRESH_INTERVAL_MS);
  }

  function getCurrentAbakaScriptConfig() {
    const source = settingsCache?.platforms?.abakaAi?.scripts?.taskPageCapture || {};
    return {
      autoSelectSpecifyOnSameFontTrue: source.autoSelectSpecifyOnSameFontTrue !== false,
    };
  }

  async function bootstrap() {
    startTask21StatisticsToolbarRuntime();
    settingsCache = await storage.getSettings();

    domActionsRuntime = domActionsFactory.createRuntime({
      getAutoSelectSpecifyOnSameFontTrue: function () {
        return getCurrentAbakaScriptConfig().autoSelectSpecifyOnSameFontTrue;
      },
    });

    shortcutRuntime = shortcutFactory.createRuntime({
      settings: settingsCache,
      showToast: showToast,
      hasSameFontField: function () {
        return domActionsRuntime && domActionsRuntime.hasSameFontField
          ? domActionsRuntime.hasSameFontField()
          : false;
      },
      actions: {
        sameFontTrue: function () {
          return domActionsRuntime.selectSameFontTrue();
        },
        sameFontFalse: function () {
          return domActionsRuntime.selectSameFontFalse();
        },
        sameFontArtisticEffect: function () {
          return domActionsRuntime.selectSameFontArtisticEffect();
        },
        imageBTextsRemovedSpecify: function () {
          return domActionsRuntime.selectImageBTextsRemovedSpecify();
        },
        otherChangesSpecify: function () {
          return domActionsRuntime.selectOtherChangesSpecify();
        },
        stashSave: function () {
          return domActionsRuntime.clickStashSave();
        },
        submitReview: function () {
          return domActionsRuntime.clickSubmitReview();
        },
        aiAnalyzeSameFont: function () {
          if (!aiPanelRuntime || typeof aiPanelRuntime.runAnalysis !== "function") {
            return { ok: false, message: "AI 分析功能未就绪。" };
          }
          return aiPanelRuntime.runAnalysis("same_font", { source: "shortcut" });
        },
        aiAnalyzeImageBTextsRemoved: function () {
          if (!aiPanelRuntime || typeof aiPanelRuntime.runAnalysis !== "function") {
            return { ok: false, message: "AI 分析功能未就绪。" };
          }
          return aiPanelRuntime.runAnalysis("image_b_texts_removed", { source: "shortcut" });
        },
        aiAnalyzeOtherChanges: function () {
          if (!aiPanelRuntime || typeof aiPanelRuntime.runAnalysis !== "function") {
            return { ok: false, message: "AI 分析功能未就绪。" };
          }
          return aiPanelRuntime.runAnalysis("other_changes", { source: "shortcut" });
        },
        aiAnalyzeOverall: function () {
          if (!aiPanelRuntime || typeof aiPanelRuntime.runAnalysis !== "function") {
            return { ok: false, message: "AI 分析功能未就绪。" };
          }
          return aiPanelRuntime.runAnalysis("overall", { source: "shortcut" });
        },
      },
    });

    shortcutRuntime.start();
    console.info(
      "[ASC][Abaka AI] Task21 assistant runtime version: " + TASK21_ASSISTANT_RUNTIME_VERSION
    );
    console.info("[ASC][Abaka AI] Task21 shortcuts ready");

    try {
      if (
        typeof dataCollector.collectTask21Payload !== "function" ||
        typeof aiClient.analyze !== "function" ||
        typeof aiPanelFactory.createRuntime !== "function"
      ) {
        console.warn("[ASC][Abaka AI] Task21 AI panel skipped: runtime dependencies missing.");
        return;
      }

      aiPanelRuntime = aiPanelFactory.createRuntime({
        collector: dataCollector,
        client: aiClient,
        pricing: pricing,
        settings: settingsCache,
        showToast: showToast,
        actions: domActionsRuntime,
      });
      const aiStarted = aiPanelRuntime.start();
      if (aiStarted && aiStarted.ok === true) {
        console.info("[ASC][Abaka AI] Task21 AI panel ready");
      }
    } catch (error) {
      console.warn(
        "[ASC][Abaka AI] Task21 AI panel init failed:",
        error && error.message ? error.message : error
      );
    }
  }

  bootstrap().catch(function (error) {
    console.warn(
      "[ASC][Abaka AI] Task21 shortcuts init failed:",
      error && error.message ? error.message : error
    );
  });
})();

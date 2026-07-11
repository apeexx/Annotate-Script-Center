(function () {
  const ROOT_ATTR = "data-asc-magic-data-review-inline";
  const STYLE_ATTR = "data-asc-magic-data-review-inline-style";
  const INCOME_PER_EFFECTIVE_HOUR = 120;
  const PANEL_HEIGHT_STORAGE_KEY = "scriptCenter.magicDataAnnotator.panelHeight";
  const DEFAULT_PANEL_HEIGHT = 420;
  const MIN_PANEL_HEIGHT = 260;
  const RESIZE_BODY_CLASS = "asc-magic-data-review-resizing";
  const lexiconDisplay =
    globalThis.ASREdgeLexiconDisplay ||
    (typeof module !== "undefined" && module.exports
      ? require("../../../shared/lexicon-display.js")
      : {});
  const aiCostDisplay =
    globalThis.ASREdgeAiCostDisplay ||
    (typeof module !== "undefined" && module.exports
      ? require("../../../shared/ai-cost-display.js")
      : {});
  const formatLexiconStatusAndMode =
    typeof lexiconDisplay.formatLexiconStatusAndMode === "function"
      ? lexiconDisplay.formatLexiconStatusAndMode
      : function () {
          return "";
        };
  const buildCostRows =
    typeof aiCostDisplay.buildCostRows === "function"
      ? aiCostDisplay.buildCostRows
      : function () {
          return [];
        };

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function toNumber(value) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
  }

  function formatNumber(value, digits) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return "-";
    }
    return numericValue.toFixed(digits || 2);
  }

  function toSecondsText(value) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? formatNumber(numericValue, 3) + "s" : "-";
  }

  function calcEstimatedIncome(effectiveTime) {
    const seconds = Number(effectiveTime);
    if (!Number.isFinite(seconds) || seconds < 0) {
      return null;
    }
    return (seconds / 3600) * INCOME_PER_EFFECTIVE_HOUR;
  }

  function joinIssues(value) {
    if (!Array.isArray(value)) {
      return "-";
    }
    return value.length > 0 ? value.join("；") : "-";
  }

  function formatReviewConclusionLabel(result) {
    const text = String(result?.reviewConclusion || result?.verdict || "").trim();
    if (text === "pass") {
      return "通过";
    }
    if (text === "need_review" || text === "mostly_same" || text === "different") {
      return "建议复核";
    }
    if (text === "risky" || text === "invalid_audio") {
      return "明显风险";
    }
    return "无法判断";
  }

  function isSingleStageResult(source) {
    const models = source?.models && typeof source.models === "object" ? source.models : {};
    const modelMode = normalizeText(models.modelMode || models.recognitionMode || source?.recognitionMode).toLowerCase();
    return (
      modelMode === "omni_single" ||
      (normalizeText(models.singleModel) &&
        !normalizeText(models.reviewModel) &&
        !normalizeText(models.compareModel))
    );
  }

  function formatModelSummary(source) {
    const models = source?.models && typeof source.models === "object" ? source.models : {};
    if (isSingleStageResult(source)) {
      return normalizeText(models.singleModel || models.listenModel) || "-";
    }
    return (
      "听音 " +
      (normalizeText(models.listenModel) || "-") +
      " / 复核 " +
      (normalizeText(models.reviewModel || models.compareModel) || "-")
    );
  }

  function formatTimingDetail(source) {
    const timing = source?.timing && typeof source.timing === "object" ? source.timing : {};
    const totalDurationMs = Number(timing.totalDurationMs || 0);
    const listenDurationMs = Number(timing.listenDurationMs || 0);
    const reviewDurationMs = Number(timing.reviewDurationMs || timing.compareDurationMs || 0);
    if (totalDurationMs <= 0 && listenDurationMs <= 0 && reviewDurationMs <= 0) {
      return "-";
    }
    if (isSingleStageResult(source)) {
      return (
        "识别 " +
        String(listenDurationMs || totalDurationMs || 0) +
        "ms / 总计 " +
        String(totalDurationMs || listenDurationMs || 0) +
        "ms"
      );
    }
    return (
      "听音 " +
      String(listenDurationMs || 0) +
      "ms / 复核 " +
      String(reviewDurationMs || 0) +
      "ms / 总计 " +
      String(totalDurationMs || 0) +
      "ms"
    );
  }

  function buildCostSummaryRows(source) {
    const cost = source?.cost && typeof source.cost === "object" ? source.cost : {};
    if (isSingleStageResult(source)) {
      return buildCostRows({
        cost: cost,
        stageDefinitions: [
          {
            key: "single",
            label: "预估人民币",
            fallbackToTotal: true,
          },
        ],
      });
    }
    return buildCostRows({
      cost: cost,
      stageDefinitions: [
        {
          key: "listen",
          label: "听音预估人民币",
        },
        {
          key: "compare",
          label: "复核预估人民币",
        },
      ],
      totalLabel: "总预估人民币",
    });
  }

  function buildResultRows(data, runtimeSettings) {
    const source = data && typeof data === "object" ? data : {};
    const settings = runtimeSettings && typeof runtimeSettings === "object" ? runtimeSettings : {};
    const audioCheck = source.audioCheck && typeof source.audioCheck === "object" ? source.audioCheck : {};
    const textRuleCheck =
      source.textRuleCheck && typeof source.textRuleCheck === "object" ? source.textRuleCheck : {};
    const timing = source.timing && typeof source.timing === "object" ? source.timing : {};
    const showHeardText = settings.showHeardText !== false;
    const rows = [
      ["总结论", formatReviewConclusionLabel(source)],
      ["shouldReview", String(Boolean(source.shouldReview))],
      ["方言行规则检查", joinIssues(textRuleCheck.dialectIssues)],
      ["普通话翻译检查", joinIssues(textRuleCheck.mandarinIssues)],
      ["翻译一致性检查", joinIssues(textRuleCheck.translationConsistencyIssues)],
      ["正字表检查", joinIssues(textRuleCheck.lexiconIssues)],
      ["音频有效性检查", joinIssues(audioCheck.riskFlags)],
      ["性别年龄辅助判断", [audioCheck.genderGuess || "-", audioCheck.ageRangeGuess || "-"].join(" / ")],
      [
        "AI 辅助听音（客家话，仅供参考）",
        showHeardText ? audioCheck.heardDialectText || source?.listen?.heardDialectText || "-" : "已关闭显示",
      ],
      [
        "AI 辅助听音（普通话理解，仅供参考）",
        showHeardText ? audioCheck.heardMandarinMeaning || source?.listen?.heardMandarinMeaning || "-" : "已关闭显示",
      ],
    ];
    const lexiconSummary = formatLexiconStatusAndMode(source.lexicon, {
      scriptType: "default",
    });
    if (lexiconSummary) {
      rows.push(["词表状态与模式", lexiconSummary]);
    }
    rows.push(
      ["模型", formatModelSummary(source)],
      ["耗时", formatTimingDetail(source)]
    );
    rows.push.apply(rows, buildCostSummaryRows(source));
    rows.push(["requestId", source.requestId || "-"]);
    return rows;
  }

  function copyText(text) {
    const value = String(text || "").trim();
    if (!value) {
      return Promise.reject(new Error("暂无可复制内容。"));
    }
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      return navigator.clipboard.writeText(value);
    }
    return Promise.reject(new Error("当前页面不支持剪贴板 API。"));
  }

  function createButton(text, className) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    if (className) {
      button.className = className;
    }
    return button;
  }

  function getDynamicMaxPanelHeight() {
    const viewportHeight = Number(window.innerHeight || 0);
    const computed = Math.floor(viewportHeight - 320);
    return Math.max(MIN_PANEL_HEIGHT, computed);
  }

  function clampPanelHeight(value) {
    const numericValue = Number(value);
    const fallback = DEFAULT_PANEL_HEIGHT;
    const resolved = Number.isFinite(numericValue) ? numericValue : fallback;
    const rounded = Math.round(resolved);
    return Math.max(MIN_PANEL_HEIGHT, Math.min(getDynamicMaxPanelHeight(), rounded));
  }

  function loadStoredPanelHeight() {
    return new Promise(function (resolve) {
      if (!chrome?.storage?.local) {
        resolve(null);
        return;
      }
      chrome.storage.local.get([PANEL_HEIGHT_STORAGE_KEY], function (result) {
        if (chrome.runtime?.lastError) {
          resolve(null);
          return;
        }
        resolve(clampPanelHeight(result?.[PANEL_HEIGHT_STORAGE_KEY]));
      });
    });
  }

  function saveStoredPanelHeight(panelHeight) {
    return new Promise(function (resolve) {
      if (!chrome?.storage?.local) {
        resolve(false);
        return;
      }
      const payload = {};
      payload[PANEL_HEIGHT_STORAGE_KEY] = clampPanelHeight(panelHeight);
      chrome.storage.local.set(payload, function () {
        resolve(!chrome.runtime?.lastError);
      });
    });
  }

  function ensureStyle() {
    if (document.querySelector("style[" + STYLE_ATTR + "]")) {
      return;
    }
    const style = document.createElement("style");
    style.setAttribute(STYLE_ATTR, "true");
    style.textContent = [
      "[" + ROOT_ATTR + "]{width:100%;margin-top:8px;padding:10px;border:1px solid rgba(91,140,255,.45);border-radius:6px;background:rgba(15,23,42,.92);color:#e5e7eb;font-family:'Microsoft YaHei',sans-serif;font-size:12px;line-height:1.5;height:var(--asc-magic-data-review-height,420px);min-height:260px;max-height:calc(100vh - 320px);overflow:hidden;display:flex;flex-direction:column;}",
      "[" + ROOT_ATTR + "] *{box-sizing:border-box;}",
      "[" + ROOT_ATTR + "] .md-inline-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;border-bottom:1px solid #334155;padding-bottom:8px;margin-bottom:8px;}",
      "[" + ROOT_ATTR + "] .md-inline-title{font-size:13px;font-weight:700;color:#f8fafc;}",
      "[" + ROOT_ATTR + "] .md-inline-sub{font-size:12px;color:#94a3b8;margin-top:2px;line-height:1.45;}",
      "[" + ROOT_ATTR + "] .md-inline-actions{display:flex;gap:6px;align-items:center;flex-wrap:wrap;}",
      "[" + ROOT_ATTR + "] .asc-magic-data-review-body{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding-right:2px;}",
      "[" + ROOT_ATTR + "] .md-inline-grid{display:grid;grid-template-columns:92px 1fr;gap:3px 8px;font-size:12px;line-height:1.45;}",
      "[" + ROOT_ATTR + "] .md-k{color:#94a3b8;font-weight:700;}",
      "[" + ROOT_ATTR + "] .md-v{white-space:pre-wrap;word-break:break-word;}",
      "[" + ROOT_ATTR + "] .md-block{border:1px solid #334155;border-radius:6px;padding:7px;background:#111827;margin-bottom:7px;}",
      "[" + ROOT_ATTR + "] .md-block-title{font-size:12px;font-weight:700;color:#cbd5e1;margin-bottom:6px;}",
      "[" + ROOT_ATTR + "] .md-inline-buttons{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-bottom:7px;}",
      "[" + ROOT_ATTR + "] button{border:1px solid #475569;border-radius:6px;padding:6px 8px;background:#1e293b;color:#e2e8f0;font-size:12px;cursor:pointer;}",
      "[" + ROOT_ATTR + "] button:hover{background:#334155;}",
      "[" + ROOT_ATTR + "] button:disabled{opacity:.55;cursor:not-allowed;}",
      "[" + ROOT_ATTR + "] .md-primary{background:#0ea5e9;border-color:#0ea5e9;color:#f8fafc;font-weight:700;}",
      "[" + ROOT_ATTR + "] .md-message{font-size:12px;border:1px solid #334155;background:#172554;color:#bfdbfe;border-radius:8px;padding:8px;}",
      "[" + ROOT_ATTR + "] .md-safe{font-size:11px;line-height:1.4;color:#fdba74;border:1px solid #7c2d12;background:#431407;border-radius:6px;padding:6px 7px;}",
      "[" + ROOT_ATTR + "] .asc-magic-data-review-resize-handle{height:8px;flex:0 0 auto;margin-top:8px;border-top:1px solid rgba(91,140,255,.25);background:rgba(148,163,184,.12);cursor:ns-resize;}",
      "[" + ROOT_ATTR + "] .asc-magic-data-review-resize-handle:hover{background:rgba(91,140,255,.25);}",
      "[" + ROOT_ATTR + "] .md-empty{font-size:12px;color:#94a3b8;}",
      "body." + RESIZE_BODY_CLASS + "{user-select:none!important;cursor:ns-resize!important;}",
      "@media (max-width: 900px){[" + ROOT_ATTR + "] .md-inline-buttons{grid-template-columns:repeat(2,minmax(0,1fr));}}",
    ].join("");
    (document.head || document.documentElement).appendChild(style);
  }

  function findInlineMountTarget() {
    const audioList = document.querySelector(".audio_list");
    const audioBodyBox = audioList?.querySelector(".body_box");
    if (audioList && audioBodyBox && audioBodyBox.parentElement) {
      return {
        anchor: audioBodyBox,
        mode: "after",
      };
    }

    if (audioList) {
      return {
        anchor: audioList,
        mode: "append",
      };
    }

    const entiretyBody = document.querySelector(".entirety_body");
    if (entiretyBody) {
      return {
        anchor: entiretyBody,
        mode: "append",
      };
    }

    const textContainer = document.querySelector(".text-container");
    if (textContainer) {
      return {
        anchor: textContainer,
        mode: "append",
      };
    }

    return {
      anchor: document.body || document.documentElement,
      mode: "append",
    };
  }

  function ensureRootPlacement(node) {
    if (!(node instanceof HTMLElement)) {
      return false;
    }
    const target = findInlineMountTarget();
    if (!target || !target.anchor) {
      return false;
    }
    if (target.mode === "after" && target.anchor.parentElement) {
      const shouldMove =
        node.parentElement !== target.anchor.parentElement ||
        node.previousElementSibling !== target.anchor;
      if (shouldMove) {
        if (typeof target.anchor.after === "function") {
          target.anchor.after(node);
        } else {
          target.anchor.parentElement.insertBefore(node, target.anchor.nextSibling);
        }
      }
      return true;
    }

    if (node.parentElement !== target.anchor) {
      target.anchor.appendChild(node);
    }
    return true;
  }

  function createRuntime(deps) {
    const options = deps && typeof deps === "object" ? deps : {};
    const runtimeSettingsDefault = {
      enabled: true,
      aiReviewEnabled: true,
      aiReviewModelMode: "two_stage",
      aiReviewRecognitionStrategy: "direct_dialect",
      aiReviewRecognitionMode: "two_stage",
      aiReviewListenModel: "qwen3.5-omni-flash",
      aiReviewCompareModel: "qwen3.5-flash",
      aiReviewSingleModel: "qwen3.5-omni-flash",
      aiReviewEnableThinking: false,
      listenModel: "qwen3.5-omni-flash",
      reviewModel: "qwen3.5-flash",
      reviewMode: "rule_first",
      showHeardText: true,
      showEstimatedIncome: true,
      enableThinking: false,
      aiReviewListenPrompt: "",
      aiReviewComparePrompt: "",
      aiReviewTemperature: "",
      aiReviewTopP: "",
      aiReviewMaxTokens: "",
      aiReviewMaxCompletionTokens: "",
      aiReviewPresencePenalty: "",
      aiReviewFrequencyPenalty: "",
      aiReviewSeed: "",
      aiReviewStopSequences: "",
    };

    let root = null;
    let bodyScrollNode = null;
    let resizeHandleNode = null;
    let messageNode = null;
    let summaryNode = null;
    let platformNode = null;
    let resultNode = null;
    let loading = false;
    let latestSnapshot = {};
    let latestBackend = null;
    let latestResult = null;
    let currentPanelHeight = clampPanelHeight(DEFAULT_PANEL_HEIGHT);
    let panelHeightHydrated = false;
    let dragState = null;
    let viewportResizeBound = false;
    let runtimeSettings = Object.assign({}, runtimeSettingsDefault);

    const buttons = {
      refresh: null,
      review: null,
      copySummary: null,
      fillDialect: null,
      fillMandarin: null,
      ignore: null,
      resetHeight: null,
    };

    function applyPanelHeight(nextHeight) {
      currentPanelHeight = clampPanelHeight(nextHeight);
      if (root instanceof HTMLElement) {
        root.style.setProperty("--asc-magic-data-review-height", String(currentPanelHeight) + "px");
      }
    }

    async function persistPanelHeight(nextHeight) {
      const saveOk = await saveStoredPanelHeight(nextHeight);
      if (!saveOk && typeof console !== "undefined" && typeof console.info === "function") {
        console.info("[MagicData][AI Review] panel height persistence failed");
      }
    }

    function setResizingActive(active) {
      const body = document.body;
      if (!body) {
        return;
      }
      body.classList.toggle(RESIZE_BODY_CLASS, active === true);
    }

    function onResizeMove(event) {
      if (!dragState) {
        return;
      }
      const nextHeight = dragState.startHeight + (event.clientY - dragState.startY);
      applyPanelHeight(nextHeight);
    }

    function stopResizeDrag(shouldPersist) {
      if (!dragState) {
        return;
      }
      window.removeEventListener("mousemove", onResizeMove, true);
      window.removeEventListener("mouseup", onResizeUp, true);
      setResizingActive(false);
      dragState = null;
      if (shouldPersist) {
        void persistPanelHeight(currentPanelHeight);
      }
    }

    function onResizeUp() {
      stopResizeDrag(true);
    }

    function startResizeDrag(event) {
      event.preventDefault();
      event.stopPropagation();
      dragState = {
        startY: Number(event.clientY || 0),
        startHeight: currentPanelHeight,
      };
      setResizingActive(true);
      window.addEventListener("mousemove", onResizeMove, true);
      window.addEventListener("mouseup", onResizeUp, true);
    }

    function ensurePanelHeightHydrated() {
      if (panelHeightHydrated) {
        return;
      }
      panelHeightHydrated = true;
      void loadStoredPanelHeight().then(function (storedHeight) {
        applyPanelHeight(storedHeight === null ? DEFAULT_PANEL_HEIGHT : storedHeight);
      });
    }

    function handleViewportResize() {
      applyPanelHeight(currentPanelHeight);
    }

    function ensureViewportResizeListener() {
      if (viewportResizeBound) {
        return;
      }
      viewportResizeBound = true;
      window.addEventListener("resize", handleViewportResize, { passive: true });
    }

    function setMessage(text) {
      if (messageNode) {
        messageNode.textContent = normalizeText(text) || "就绪。";
      }
    }

    function refreshButtons() {
      const hasResult = Boolean(latestResult);
      const dialectText = getDialectFillText();
      const mandarinText = getMandarinFillText();
      if (buttons.review) {
        buttons.review.disabled = loading;
        buttons.review.textContent = loading ? "AI 质检当前条（执行中）" : "AI 质检当前条";
      }
      if (buttons.refresh) {
        buttons.refresh.disabled = loading;
      }
      if (buttons.copySummary) {
        buttons.copySummary.disabled = loading || !hasResult;
      }
      if (buttons.fillDialect) {
        buttons.fillDialect.disabled = loading || !dialectText;
      }
      if (buttons.fillMandarin) {
        buttons.fillMandarin.disabled = loading || !mandarinText;
      }
      if (buttons.ignore) {
        buttons.ignore.disabled = loading || !hasResult;
      }
      if (buttons.resetHeight) {
        buttons.resetHeight.disabled = loading;
      }
    }

    function setLoading(nextValue) {
      loading = nextValue === true;
      refreshButtons();
    }

    function resolveReviewConclusion(result) {
      return formatReviewConclusionLabel(result);
    }

    function getDialectFillText() {
      const text =
        latestResult?.recommendations?.dialectText ||
        latestResult?.comparison?.dialectLine?.recommendedText ||
        latestResult?.listen?.heardDialectText ||
        latestResult?.audioCheck?.heardDialectText ||
        "";
      return normalizeText(text);
    }

    function getMandarinFillText() {
      const text =
        latestResult?.recommendations?.mandarinText ||
        latestResult?.comparison?.mandarinLine?.recommendedText ||
        latestResult?.listen?.heardMandarinMeaning ||
        latestResult?.audioCheck?.heardMandarinMeaning ||
        "";
      return normalizeText(text);
    }

    function buildSummaryText() {
      if (!latestResult) {
        return "暂无 AI 质检结果。";
      }
      const summary = normalizeText(latestResult?.recommendations?.summary || "");
      if (summary) {
        return summary;
      }
      const segments = [];
      segments.push("结论：" + resolveReviewConclusion(latestResult));
      if (Array.isArray(latestResult?.textRuleCheck?.ruleIssues) && latestResult.textRuleCheck.ruleIssues.length > 0) {
        segments.push("规则问题：" + latestResult.textRuleCheck.ruleIssues.join("；"));
      }
      if (Array.isArray(latestResult?.textRuleCheck?.lexiconIssues) && latestResult.textRuleCheck.lexiconIssues.length > 0) {
        segments.push("词表问题：" + latestResult.textRuleCheck.lexiconIssues.join("；"));
      }
      return segments.join("\n");
    }

    function renderSummary(snapshot, backend) {
      latestSnapshot = snapshot || latestSnapshot || {};
      if (backend) {
        latestBackend = backend;
      }
      if (!summaryNode) {
        return;
      }
      const estimatedIncome = Number.isFinite(Number(latestResult?.estimatedIncome))
        ? Number(latestResult.estimatedIncome)
        : calcEstimatedIncome(latestSnapshot.effectiveTime);
      const speaker = latestSnapshot.speaker || {};
      const rows = [
        ["taskItemId", latestSnapshot.taskItemId || "-"],
        ["有效句子时长", toSecondsText(latestSnapshot.effectiveTime)],
        ["预计金额", runtimeSettings.showEstimatedIncome === false || estimatedIncome === null ? "已隐藏" : formatNumber(estimatedIncome, 4) + " 元"],
        ["音频 hostname", latestSnapshot.audioHostname || "未获取"],
        ["性别", speaker.gender || "-"],
        ["年龄", speaker.ageRange || "-"],
        ["后端", latestBackend?.baseUrl || "-"],
      ];
      summaryNode.innerHTML = "";
      rows.forEach(function (row) {
        const key = document.createElement("div");
        key.className = "md-k";
        key.textContent = row[0];
        const value = document.createElement("div");
        value.className = "md-v";
        value.textContent = row[1];
        summaryNode.appendChild(key);
        summaryNode.appendChild(value);
      });
    }

    function renderPlatform(snapshot) {
      if (!platformNode) {
        return;
      }
      const rows = [
        ["平台方言行", snapshot?.platformDialectText || "未读取到平台文本"],
        ["平台普通话行", snapshot?.platformMandarinText || "未读取到平台文本"],
      ];
      platformNode.innerHTML = "";
      rows.forEach(function (row) {
        const key = document.createElement("div");
        key.className = "md-k";
        key.textContent = row[0];
        const value = document.createElement("div");
        value.className = "md-v";
        value.textContent = row[1];
        platformNode.appendChild(key);
        platformNode.appendChild(value);
      });
    }

    function renderResult(data) {
      latestResult = data || null;
      if (!resultNode) {
        return;
      }
      resultNode.innerHTML = "";
      if (!data) {
        const emptyNode = document.createElement("div");
        emptyNode.className = "md-empty";
        emptyNode.textContent = "暂无质检结果，请点击 AI 质检当前条。";
        resultNode.appendChild(emptyNode);
        refreshButtons();
        return;
      }
      const rows = buildResultRows(data, runtimeSettings);

      const grid = document.createElement("div");
      grid.className = "md-inline-grid";
      rows.forEach(function (row) {
        const key = document.createElement("div");
        key.className = "md-k";
        key.textContent = row[0];
        const value = document.createElement("div");
        value.className = "md-v";
        value.textContent = row[1];
        grid.appendChild(key);
        grid.appendChild(value);
      });
      resultNode.appendChild(grid);
      refreshButtons();
    }

    async function collectAndRenderSnapshot(preferApi) {
      if (typeof options.collectCurrentItem !== "function") {
        setMessage("采集器未就绪，请刷新页面。");
        return null;
      }
      let snapshot = options.collectCurrentItem() || {};
      if (preferApi && typeof options.refreshCurrentItem === "function") {
        try {
          snapshot = await options.refreshCurrentItem({
            taskItemId: snapshot.taskItemId,
          });
        } catch (error) {
          // keep dom fallback
        }
      }
      snapshot.pageType = snapshot.pageType || latestSnapshot.pageType || "asrmark";
      renderSummary(snapshot, latestBackend);
      renderPlatform(snapshot);
      if (!snapshot.audioUrl) {
        setMessage("未获取到音频 URL，请先播放一次音频后再点刷新采集或 AI 质检。");
      } else {
        setMessage("采集完成，可点击 AI 质检当前条。");
      }
      return snapshot;
    }

    async function triggerReview() {
      if (typeof options.reviewCurrent !== "function") {
        const message = "AI 客户端未就绪。";
        setMessage(message);
        return {
          ok: false,
          message: message,
        };
      }
      const snapshot = await collectAndRenderSnapshot(true);
      if (!snapshot) {
        return { ok: false, message: "采集失败。" };
      }
      if (!snapshot.audioUrl) {
        return { ok: false, message: "未获取到音频 URL。" };
      }
      if (!snapshot.platformDialectText && !snapshot.platformMandarinText) {
        const message = "未读取到平台两行文本，请先确认当前页面是标注单条页。";
        setMessage(message);
        return { ok: false, message: message };
      }

      setLoading(true);
      setMessage("正在调用 AI 质检后端...");
      try {
        const modelMode = String(
          runtimeSettings.aiReviewModelMode || runtimeSettings.aiReviewRecognitionMode || "two_stage"
        )
          .trim()
          .toLowerCase() === "omni_single"
          ? "omni_single"
          : "two_stage";
        const recognitionStrategy = String(runtimeSettings.aiReviewRecognitionStrategy || "")
          .trim()
          .toLowerCase() === "mandarin_to_dialect"
          ? "mandarin_to_dialect"
          : "direct_dialect";
        const recognitionMode =
          recognitionStrategy === "mandarin_to_dialect" ? "recognition_convert" : modelMode;
        const listenModel = String(
          runtimeSettings.aiReviewListenModel || runtimeSettings.listenModel || "qwen3.5-omni-flash"
        )
          .trim()
          .slice(0, 80);
        const compareModel = String(
          runtimeSettings.aiReviewCompareModel || runtimeSettings.reviewModel || "qwen3.5-flash"
        )
          .trim()
          .slice(0, 80);
        const singleModel = String(
          runtimeSettings.aiReviewSingleModel ||
            (modelMode === "omni_single"
              ? runtimeSettings.aiReviewListenModel ||
                runtimeSettings.listenModel ||
                "qwen3.5-omni-flash"
              : "qwen3.5-omni-flash")
        )
          .trim()
          .slice(0, 80);
        const enableThinking =
          typeof runtimeSettings.aiReviewEnableThinking === "boolean"
            ? runtimeSettings.aiReviewEnableThinking === true
            : runtimeSettings.enableThinking === true;
        const response = await options.reviewCurrent({
          taskItemId: snapshot.taskItemId,
          samplingRecordId: snapshot.samplingRecordId,
          projectName: snapshot.projectName,
          audioUrl: snapshot.audioUrl,
          audioDuration: snapshot.audioDuration,
          effectiveStartTime: snapshot.effectiveStartTime,
          effectiveEndTime: snapshot.effectiveEndTime,
          effectiveTime: snapshot.effectiveTime,
          platformDialectText: snapshot.platformDialectText,
          platformMandarinText: snapshot.platformMandarinText,
          speaker: snapshot.speaker || {},
          rulesProfile: "hakka",
          clientVersion: options.getClientVersion ? options.getClientVersion() : "0.3.0",
          recognitionMode: recognitionMode,
          pipelineMode: recognitionMode,
          modelMode: modelMode,
          recognitionStrategy: recognitionStrategy,
          listenModel: listenModel,
          compareModel: compareModel,
          singleModel: singleModel,
          reviewModel: compareModel,
          reviewMode: runtimeSettings.reviewMode,
          showHeardText: runtimeSettings.showHeardText !== false,
          enableThinking: enableThinking,
          aiOptions: (function () {
            const optionsPayload = {
              listenModel: listenModel,
              compareModel: compareModel,
              reviewModel: compareModel,
              singleModel: singleModel,
              enable_thinking: enableThinking,
            };
            const listenPrompt = String(runtimeSettings.aiReviewListenPrompt || "").trim();
            const comparePrompt = String(runtimeSettings.aiReviewComparePrompt || "").trim();
            if (listenPrompt) {
              optionsPayload.listenPrompt = listenPrompt.slice(0, 8000);
            }
            if (comparePrompt) {
              optionsPayload.comparePrompt = comparePrompt.slice(0, 8000);
            }
            const temperature = Number(runtimeSettings.aiReviewTemperature);
            if (Number.isFinite(temperature) && temperature >= 0 && temperature <= 2) {
              optionsPayload.temperature = temperature;
            }
            const topP = Number(runtimeSettings.aiReviewTopP);
            if (Number.isFinite(topP) && topP >= 0 && topP <= 1) {
              optionsPayload.top_p = topP;
            }
            const maxTokens = Math.floor(Number(runtimeSettings.aiReviewMaxTokens));
            if (Number.isFinite(maxTokens) && maxTokens >= 1 && maxTokens <= 8192) {
              optionsPayload.max_tokens = maxTokens;
            }
            const maxCompletionTokens = Math.floor(
              Number(runtimeSettings.aiReviewMaxCompletionTokens)
            );
            if (
              Number.isFinite(maxCompletionTokens) &&
              maxCompletionTokens >= 1 &&
              maxCompletionTokens <= 8192
            ) {
              optionsPayload.max_completion_tokens = maxCompletionTokens;
            }
            const presencePenalty = Number(runtimeSettings.aiReviewPresencePenalty);
            if (
              Number.isFinite(presencePenalty) &&
              presencePenalty >= -2 &&
              presencePenalty <= 2
            ) {
              optionsPayload.presence_penalty = presencePenalty;
            }
            const frequencyPenalty = Number(runtimeSettings.aiReviewFrequencyPenalty);
            if (
              Number.isFinite(frequencyPenalty) &&
              frequencyPenalty >= -2 &&
              frequencyPenalty <= 2
            ) {
              optionsPayload.frequency_penalty = frequencyPenalty;
            }
            const seed = Math.floor(Number(runtimeSettings.aiReviewSeed));
            if (Number.isFinite(seed) && seed >= 0 && seed <= 2147483647) {
              optionsPayload.seed = seed;
            }
            const stop = String(runtimeSettings.aiReviewStopSequences || "")
              .split(/\r?\n/)
              .map(function (item) {
                return String(item || "").trim().slice(0, 80);
              })
              .filter(Boolean)
              .slice(0, 8);
            if (stop.length > 0) {
              optionsPayload.stop = stop;
            }
            return optionsPayload;
          })(),
        }, {
          timeoutMs: Number(runtimeSettings.aiReviewRequestTimeoutMs || 60000) || 60000,
        });
        renderResult(response.data);
        renderSummary(snapshot, response.backend);
        renderPlatform(snapshot);
        setMessage("AI 质检完成，请人工确认。AI 不会自动保存或提交。");
        return { ok: true, message: "AI 质检完成。" };
      } catch (error) {
        const message = normalizeText(error?.message || "AI 质检失败。");
        setMessage(message);
        return { ok: false, message: message };
      } finally {
        setLoading(false);
      }
    }

    async function triggerCopySummary() {
      const summary = buildSummaryText();
      await copyText(summary);
      setMessage("AI 质检摘要已复制。");
      return { ok: true, message: "AI 质检摘要已复制。" };
    }

    function triggerFillDialect() {
      const text = getDialectFillText();
      if (!text) {
        const message = "暂无可填入的第一行文本。";
        setMessage(message);
        return { ok: false, message: message };
      }
      const result = options.fillDialectLine ? options.fillDialectLine(text) : { ok: false, message: "填入能力未就绪。" };
      setMessage(result?.message || "已填入第一行。\n");
      return result;
    }

    function triggerFillMandarin() {
      const text = getMandarinFillText();
      if (!text) {
        const message = "暂无可填入的第二行文本。";
        setMessage(message);
        return { ok: false, message: message };
      }
      const result = options.fillMandarinLine ? options.fillMandarinLine(text) : { ok: false, message: "填入能力未就绪。" };
      setMessage(result?.message || "已填入第二行。\n");
      return result;
    }

    function clearResult() {
      latestResult = null;
      renderResult(null);
      renderSummary(latestSnapshot || {}, latestBackend);
    }

    function mountInlineRoot(nextRoot) {
      const moved = ensureRootPlacement(nextRoot);
      if (!moved) {
        (document.body || document.documentElement).appendChild(nextRoot);
      }
    }

    function ensureMounted() {
      if (root && document.documentElement && document.documentElement.contains(root)) {
        ensureRootPlacement(root);
        applyPanelHeight(currentPanelHeight);
        return root;
      }
      const existing = document.querySelector("[" + ROOT_ATTR + "], [data-asc-magic-data-review-inline='true']");
      if (existing && existing instanceof HTMLElement) {
        existing.remove();
      }
      ensureStyle();
      root = document.createElement("section");
      root.setAttribute(ROOT_ATTR, "true");
      root.setAttribute("data-asc-magic-data-review-inline", "true");
      root.className = "asc-magic-data-review-inline";

      const head = document.createElement("div");
      head.className = "md-inline-head";
      const headText = document.createElement("div");
      const title = document.createElement("div");
      title.className = "md-inline-title";
      title.textContent = "客家话助手结果";
      const sub = document.createElement("div");
      sub.className = "md-inline-sub";
      sub.textContent = "以平台现有文本为基准，AI 仅做规则质检和风险提示，不自动保存、不自动提交。";
      headText.appendChild(title);
      headText.appendChild(sub);

      const headActions = document.createElement("div");
      headActions.className = "md-inline-actions";
      buttons.refresh = createButton("刷新采集");
      buttons.refresh.addEventListener("click", function () {
        void collectAndRenderSnapshot(true);
      });
      buttons.review = createButton("AI 质检当前条", "md-primary");
      buttons.review.addEventListener("click", function () {
        void triggerReview();
      });
      buttons.resetHeight = createButton("重置高度");
      buttons.resetHeight.addEventListener("click", function () {
        applyPanelHeight(DEFAULT_PANEL_HEIGHT);
        void persistPanelHeight(DEFAULT_PANEL_HEIGHT);
        setMessage("卡片高度已重置为默认值。");
      });
      headActions.appendChild(buttons.refresh);
      headActions.appendChild(buttons.review);
      headActions.appendChild(buttons.resetHeight);
      head.appendChild(headText);
      head.appendChild(headActions);
      root.appendChild(head);

      bodyScrollNode = document.createElement("div");
      bodyScrollNode.className = "asc-magic-data-review-body";

      const summaryBlock = document.createElement("div");
      summaryBlock.className = "md-block";
      const summaryTitle = document.createElement("div");
      summaryTitle.className = "md-block-title";
      summaryTitle.textContent = "当前条摘要";
      summaryNode = document.createElement("div");
      summaryNode.className = "md-inline-grid";
      summaryBlock.appendChild(summaryTitle);
      summaryBlock.appendChild(summaryNode);
      bodyScrollNode.appendChild(summaryBlock);

      const platformBlock = document.createElement("div");
      platformBlock.className = "md-block";
      const platformTitle = document.createElement("div");
      platformTitle.className = "md-block-title";
      platformTitle.textContent = "平台文本";
      platformNode = document.createElement("div");
      platformNode.className = "md-inline-grid";
      platformBlock.appendChild(platformTitle);
      platformBlock.appendChild(platformNode);
      bodyScrollNode.appendChild(platformBlock);

      const actions = document.createElement("div");
      actions.className = "md-inline-buttons";
      buttons.copySummary = createButton("复制 AI 质检摘要");
      buttons.copySummary.addEventListener("click", function () {
        triggerCopySummary().catch(function (error) {
          setMessage(error?.message || "复制失败。");
        });
      });
      buttons.fillDialect = createButton("填入第一行");
      buttons.fillDialect.addEventListener("click", function () {
        triggerFillDialect();
      });
      buttons.fillMandarin = createButton("填入第二行");
      buttons.fillMandarin.addEventListener("click", function () {
        triggerFillMandarin();
      });
      buttons.ignore = createButton("忽略结果");
      buttons.ignore.addEventListener("click", function () {
        clearResult();
        setMessage("已忽略当前 AI 结果。");
      });
      actions.appendChild(buttons.copySummary);
      actions.appendChild(buttons.fillDialect);
      actions.appendChild(buttons.fillMandarin);
      actions.appendChild(buttons.ignore);
      bodyScrollNode.appendChild(actions);

      messageNode = document.createElement("div");
      messageNode.className = "md-message";
      messageNode.textContent = "就绪。";
      bodyScrollNode.appendChild(messageNode);

      const resultBlock = document.createElement("div");
      resultBlock.className = "md-block";
      const resultTitle = document.createElement("div");
      resultTitle.className = "md-block-title";
      resultTitle.textContent = "AI 质检结果";
      resultNode = document.createElement("div");
      resultBlock.appendChild(resultTitle);
      resultBlock.appendChild(resultNode);
      bodyScrollNode.appendChild(resultBlock);

      const safe = document.createElement("div");
      safe.className = "md-safe";
      safe.textContent = "AI 仅辅助复核，不会自动保存、提交、审核或领取任务。";
      bodyScrollNode.appendChild(safe);

      root.appendChild(bodyScrollNode);

      resizeHandleNode = document.createElement("div");
      resizeHandleNode.className = "asc-magic-data-review-resize-handle";
      resizeHandleNode.title = "拖拽调整高度";
      resizeHandleNode.addEventListener("mousedown", startResizeDrag);
      root.appendChild(resizeHandleNode);

      mountInlineRoot(root);
      ensurePanelHeightHydrated();
      ensureViewportResizeListener();
      applyPanelHeight(currentPanelHeight);
      renderSummary(latestSnapshot || {}, latestBackend);
      renderPlatform(latestSnapshot || {});
      renderResult(latestResult);
      refreshButtons();
      return root;
    }

    function remove() {
      stopResizeDrag(false);
      setResizingActive(false);
      if (root) {
        root.remove();
      }
      root = null;
      bodyScrollNode = null;
      resizeHandleNode = null;
      if (viewportResizeBound) {
        window.removeEventListener("resize", handleViewportResize);
        viewportResizeBound = false;
      }
      messageNode = null;
      summaryNode = null;
      platformNode = null;
      resultNode = null;
      latestResult = null;
      latestSnapshot = {};
      latestBackend = null;
      loading = false;
    }

    function refreshPageSnapshot(snapshot, backend, settings) {
      const node = ensureMounted();
      if (!node) {
        return;
      }
      if (settings && typeof settings === "object") {
        runtimeSettings = Object.assign({}, runtimeSettingsDefault, settings);
      }
      renderSummary(snapshot || {}, backend || null);
      renderPlatform(snapshot || {});
      if (latestResult) {
        renderResult(latestResult);
      }
    }

    function setRuntimeSettings(settings) {
      if (!settings || typeof settings !== "object") {
        return;
      }
      runtimeSettings = Object.assign({}, runtimeSettingsDefault, settings);
      applyPanelHeight(currentPanelHeight);
      renderSummary(latestSnapshot || {}, latestBackend);
      if (latestResult) {
        renderResult(latestResult);
      }
    }

    function showAsrmarkCheckNotice() {
      ensureMounted();
      clearResult();
      setMessage("审核页暂未接入填入，只支持后续扩展。");
    }

    return {
      clearResult: clearResult,
      ensureMounted: ensureMounted,
      refreshPageSnapshot: refreshPageSnapshot,
      remove: remove,
      setMessage: setMessage,
      setRuntimeSettings: setRuntimeSettings,
      showAsrmarkCheckNotice: showAsrmarkCheckNotice,
      triggerCopySummary: triggerCopySummary,
      triggerFillDialect: triggerFillDialect,
      triggerFillMandarin: triggerFillMandarin,
      triggerReview: triggerReview,
    };
  }

  const api = {
    createRuntime: createRuntime,
  };
  api.__test__ = {
    buildResultRows,
  };
  globalThis.__ASREdgeMagicDataAnnotatorInlinePanel = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();

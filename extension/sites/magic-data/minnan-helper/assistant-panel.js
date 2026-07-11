(function () {
  const ROOT_ATTR = "data-asc-magic-data-minnan-review-inline";
  const STYLE_ATTR = "data-asc-magic-data-minnan-review-inline-style";
  const INLINE_SUGGESTION_ATTR = "data-asc-magic-data-minnan-inline-suggestion";
  const SPEAKER_SUGGESTION_ATTR = "data-asc-magic-data-minnan-speaker-suggestion";
  const RAW_MODAL_ATTR = "data-asc-magic-data-minnan-raw-modal";
  const TASK_KEY_ATTR = "data-asc-task-key";
  const PANEL_HEIGHT_STORAGE_KEY = "scriptCenter.magicDataMinnanAssistant.panelHeight";
  const DEFAULT_PANEL_HEIGHT = 420;
  const MIN_PANEL_HEIGHT = 260;
  const RESIZE_BODY_CLASS = "asc-magic-data-minnan-review-resizing";
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
    button.className = "asc-md-minnan-btn el-button el-button--mini is-plain";
    if (className) {
      button.className = button.className + " " + className;
    }
    return button;
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

  function buildOverallRows(data) {
    const source = data && typeof data === "object" ? data : {};
    const overall = source.overall && typeof source.overall === "object" ? source.overall : {};
    const rows = [
      [
        "结论",
        formatReviewConclusionLabel({
          reviewConclusion: overall.reviewConclusion || source.reviewConclusion,
        }),
      ],
      ["需人工复核", String(overall.shouldReview === true || source.shouldReview === true)],
      ["摘要", normalizeText(overall.summary || source?.recommendations?.summary || "-")],
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
    rows.push(["requestId", normalizeText(source.requestId || "-")]);
    return rows;
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
      "[" + ROOT_ATTR + "] .md-inline-buttons{display:flex;gap:6px;margin-bottom:7px;flex-wrap:wrap;}",
      "[" + ROOT_ATTR + "] .md-inline-actions-main{display:flex;gap:6px;margin-bottom:7px;align-items:center;flex-wrap:wrap;}",
      "[" + ROOT_ATTR + "] .md-check-grid{display:grid;grid-template-columns:108px 1fr;gap:4px 8px;font-size:12px;line-height:1.45;}",
      "[" + ROOT_ATTR + "] .md-check-title{font-size:12px;font-weight:700;color:#dbeafe;margin-bottom:6px;}",
      "[" + ROOT_ATTR + "] .md-tag{display:inline-block;padding:2px 6px;border-radius:999px;font-size:11px;font-weight:700;}",
      "[" + ROOT_ATTR + "] .md-tag-ok{background:rgba(34,197,94,.2);color:#86efac;border:1px solid rgba(34,197,94,.5);}",
      "[" + ROOT_ATTR + "] .md-tag-bad{background:rgba(239,68,68,.2);color:#fda4af;border:1px solid rgba(239,68,68,.5);}",
      "[" + ROOT_ATTR + "] .md-tag-uncertain{background:rgba(251,191,36,.2);color:#fde68a;border:1px solid rgba(251,191,36,.5);}",
      "[" + ROOT_ATTR + "] button{border:1px solid #475569;border-radius:6px;padding:5px 10px;background:#1e293b;color:#e2e8f0;font-size:12px;cursor:pointer;line-height:1.2;}",
      "[" + ROOT_ATTR + "] button:hover{background:#334155;}",
      "[" + ROOT_ATTR + "] button:disabled{opacity:.55;cursor:not-allowed;}",
      "[" + ROOT_ATTR + "] .md-primary{background:#2563eb;border-color:#2563eb;color:#f8fafc;font-weight:700;}",
      "[" + ROOT_ATTR + "] .asc-md-minnan-btn.el-button{border-color:#4b5563;background:rgba(51,65,85,.42);color:#e5e7eb;}",
      "[" + ROOT_ATTR + "] .asc-md-minnan-btn.el-button:hover{background:rgba(71,85,105,.78);}",
      "[" + ROOT_ATTR + "] .asc-md-minnan-btn.el-button.el-button--primary{border-color:#2563eb;background:#2563eb;color:#f8fafc;}",
      "[" + ROOT_ATTR + "] .asc-md-minnan-btn.el-button.el-button--primary:hover{background:#1d4ed8;}",
      "[" + ROOT_ATTR + "] .asc-md-minnan-btn.el-button.el-button--success{border-color:#22c55e;background:#16a34a;color:#f8fafc;}",
      "[" + ROOT_ATTR + "] .asc-md-minnan-btn.el-button.el-button--success:hover{background:#15803d;}",
      "[" + ROOT_ATTR + "] .asc-md-minnan-btn.is-plain{background:rgba(30,41,59,.68);}",
      "[" + ROOT_ATTR + "] .md-message{font-size:12px;border:1px solid #334155;background:#172554;color:#bfdbfe;border-radius:8px;padding:8px;}",
      "[" + ROOT_ATTR + "] .md-safe{font-size:11px;line-height:1.4;color:#fdba74;border:1px solid #7c2d12;background:#431407;border-radius:6px;padding:6px 7px;}",
      "[" + ROOT_ATTR + "] .asc-magic-data-review-resize-handle{height:8px;flex:0 0 auto;margin-top:8px;border-top:1px solid rgba(91,140,255,.25);background:rgba(148,163,184,.12);cursor:ns-resize;}",
      "[" + ROOT_ATTR + "] .asc-magic-data-review-resize-handle:hover{background:rgba(91,140,255,.25);}",
      "[" + ROOT_ATTR + "] .md-empty{font-size:12px;color:#94a3b8;}",
      "[" + INLINE_SUGGESTION_ATTR + "]{margin-top:6px;border:1px solid rgba(71,85,105,.65);border-radius:6px;background:rgba(15,23,42,.58);padding:5px 8px;}",
      "[" + INLINE_SUGGESTION_ATTR + "] .asc-md-minnan-inline-text{font-size:12px;color:#e2e8f0;white-space:pre-wrap;word-break:break-word;margin-bottom:0;}",
      "[" + INLINE_SUGGESTION_ATTR + "] .asc-md-minnan-inline-row{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:24px;}",
      "[" + INLINE_SUGGESTION_ATTR + "] .asc-md-minnan-inline-row .asc-md-minnan-inline-text{margin:0;flex:1;}",
      "[" + ROOT_ATTR + "] .asc-md-minnan-diff-same{color:#e2e8f0;}",
      "[" + ROOT_ATTR + "] .asc-md-minnan-diff-insert{background:rgba(34,197,94,.22);color:#bbf7d0;padding:0 1px;border-radius:2px;}",
      "[" + ROOT_ATTR + "] .asc-md-minnan-diff-delete{background:rgba(239,68,68,.24);color:#fecaca;padding:0 1px;border-radius:2px;text-decoration:line-through;}",
      "[" + INLINE_SUGGESTION_ATTR + "] .asc-md-minnan-diff-same{color:#e2e8f0;}",
      "[" + INLINE_SUGGESTION_ATTR + "] .asc-md-minnan-diff-insert{background:rgba(34,197,94,.22);color:#bbf7d0;padding:0 1px;border-radius:2px;}",
      "[" + INLINE_SUGGESTION_ATTR + "] .asc-md-minnan-diff-delete{background:rgba(239,68,68,.24);color:#fecaca;padding:0 1px;border-radius:2px;text-decoration:line-through;}",
      "[" + SPEAKER_SUGGESTION_ATTR + "]{margin-top:4px;padding:4px 6px;border-radius:4px;border:1px solid rgba(100,116,139,.45);background:rgba(30,41,59,.48);}",
      "[" + SPEAKER_SUGGESTION_ATTR + "] .asc-md-minnan-speaker-text{font-size:12px;color:#e5e7eb;}",
      "[" + SPEAKER_SUGGESTION_ATTR + "] .asc-md-minnan-speaker-actions{display:flex;gap:6px;margin-top:4px;flex-wrap:wrap;}",
      "[" + ROOT_ATTR + "] .md-fold-section{border:1px solid #334155;border-radius:6px;background:#111827;margin-bottom:7px;overflow:hidden;}",
      "[" + ROOT_ATTR + "] .md-fold-toggle{width:100%;text-align:left;border:none;border-bottom:1px solid #334155;background:rgba(30,41,59,.62);color:#cbd5e1;font-weight:700;padding:8px 10px;cursor:pointer;}",
      "[" + ROOT_ATTR + "] .md-fold-toggle:hover{background:rgba(51,65,85,.85);}",
      "[" + ROOT_ATTR + "] .md-fold-body{display:none;padding:8px;}",
      "[" + ROOT_ATTR + "] .md-fold-section.is-open .md-fold-body{display:block;}",
      "[" + RAW_MODAL_ATTR + "]{position:fixed;inset:0;background:rgba(2,6,23,.72);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;}",
      "[" + RAW_MODAL_ATTR + "] .asc-md-minnan-raw-dialog{width:min(920px,96vw);max-height:86vh;display:flex;flex-direction:column;border:1px solid #334155;border-radius:8px;background:#0f172a;color:#e5e7eb;}",
      "[" + RAW_MODAL_ATTR + "] .asc-md-minnan-raw-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px;border-bottom:1px solid #334155;}",
      "[" + RAW_MODAL_ATTR + "] .asc-md-minnan-raw-title{font-size:13px;font-weight:700;color:#dbeafe;}",
      "[" + RAW_MODAL_ATTR + "] .asc-md-minnan-raw-actions{display:flex;gap:6px;}",
      "[" + RAW_MODAL_ATTR + "] textarea{width:100%;height:60vh;border:none;outline:none;resize:none;padding:10px;background:#020617;color:#e2e8f0;font-size:12px;line-height:1.4;}",
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
      aiReviewCompareModel: "qwen3.5-plus",
      aiReviewSingleModel: "qwen3.5-omni-flash",
      aiReviewEnableThinking: false,
      listenModel: "qwen3.5-omni-flash",
      reviewModel: "qwen3.5-plus",
      reviewMode: "rule_first",
      showHeardText: true,
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
    let resultNode = null;
    let rawOutputModal = null;
    let rawOutputTextArea = null;
    let loading = false;
    let latestSnapshot = {};
    let latestBackend = null;
    let latestResult = null;
    let currentPanelHeight = clampPanelHeight(DEFAULT_PANEL_HEIGHT);
    let panelHeightHydrated = false;
    let dragState = null;
    let viewportResizeBound = false;
    let runtimeSettings = Object.assign({}, runtimeSettingsDefault);
    const foldStateByTask = new Map();

    const buttons = {
      refresh: null,
      review: null,
      fillAll: null,
      copySummary: null,
      showRawOutput: null,
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

    function getSnapshotTaskKey(snapshot) {
      const source = snapshot && typeof snapshot === "object" ? snapshot : latestSnapshot;
      return normalizeText(source?.taskItemId || source?.samplingRecordId || "");
    }

    function hasActionableTextSuggestion(checkData) {
      if (!checkData || checkData.isCorrect === true) {
        return false;
      }
      return Boolean(normalizeText(checkData.suggestedValue || ""));
    }

    function hasActionableSpeakerSuggestion(checkData, validateFn) {
      if (!checkData || checkData.isCorrect === true) {
        return false;
      }
      const suggestedValue = normalizeText(checkData.suggestedValue || "");
      return validateFn(suggestedValue);
    }

    function hasActionableSuggestion(resultData) {
      const data = resultData || latestResult || {};
      const speakerCheck = data.speakerCheck || {};
      return (
        hasActionableSpeakerSuggestion(speakerCheck.gender || {}, isValidGenderValue) ||
        hasActionableSpeakerSuggestion(speakerCheck.ageRange || {}, isValidAgeRangeValue) ||
        hasActionableTextSuggestion(data.dialectTextCheck || {}) ||
        hasActionableTextSuggestion(data.mandarinTextCheck || {})
      );
    }

    function shouldDisableShowRawOutput(isLoading) {
      return isLoading === true;
    }

    function refreshButtons() {
      const hasResult = Boolean(latestResult);
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
      if (buttons.showRawOutput) {
        buttons.showRawOutput.disabled = shouldDisableShowRawOutput(loading);
      }
      if (buttons.fillAll) {
        const canFillAll = hasResult && hasActionableSuggestion(latestResult);
        buttons.fillAll.style.display = canFillAll ? "" : "none";
        buttons.fillAll.disabled = loading || !canFillAll;
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
        latestResult?.dialectTextCheck?.suggestedValue ||
        latestResult?.recommendations?.dialectText ||
        latestResult?.comparison?.dialectLine?.recommendedText ||
        latestResult?.listen?.heardDialectText ||
        latestResult?.audioCheck?.heardDialectText ||
        "";
      return normalizeText(text);
    }

    function getMandarinFillText() {
      const text =
        latestResult?.mandarinTextCheck?.suggestedValue ||
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

    function findSpeakerAttributesRoot() {
      return document.querySelector(".speaker-attributes");
    }

    function renderSummary(snapshot, backend) {
      latestSnapshot = snapshot || latestSnapshot || {};
      if (backend) {
        latestBackend = backend;
      }
    }

    function renderPlatform(snapshot) {
      latestSnapshot = snapshot || latestSnapshot || {};
    }

    function joinIssues(value) {
      if (!Array.isArray(value)) {
        return "-";
      }
      return value.length > 0 ? value.join("；") : "-";
    }

    function renderCorrectTag(value) {
      if (value === true) {
        return '<span class="md-tag md-tag-ok">正确</span>';
      }
      if (value === false) {
        return '<span class="md-tag md-tag-bad">错误</span>';
      }
      return '<span class="md-tag md-tag-uncertain">待复核</span>';
    }

    function createCheckGrid(rows) {
      const grid = document.createElement("div");
      grid.className = "md-check-grid";
      rows.forEach(function (row) {
        const key = document.createElement("div");
        key.className = "md-k";
        key.textContent = row[0];
        const value = document.createElement("div");
        value.className = "md-v";
        if (row[2] === true) {
          value.innerHTML = row[1];
        } else if (row[2] === "node" && row[1] instanceof HTMLElement) {
          value.appendChild(row[1]);
        } else {
          value.textContent = row[1];
        }
        grid.appendChild(key);
        grid.appendChild(value);
      });
      return grid;
    }

    function createDiffPart(type, text) {
      return {
        type: type,
        text: String(text || ""),
      };
    }

    function mergeDiffParts(parts) {
      const source = Array.isArray(parts) ? parts : [];
      const merged = [];
      source.forEach(function (part) {
        if (!part || !part.text) {
          return;
        }
        const last = merged[merged.length - 1];
        if (last && last.type === part.type) {
          last.text += part.text;
          return;
        }
        merged.push(createDiffPart(part.type, part.text));
      });
      return merged;
    }

    function buildTextDiffParts(originalText, suggestedText) {
      const left = Array.from(String(originalText || ""));
      const right = Array.from(String(suggestedText || ""));
      const maxLength = 500;
      if (left.length > maxLength || right.length > maxLength) {
        return null;
      }
      const rows = left.length + 1;
      const cols = right.length + 1;
      const matrix = Array.from({ length: rows }, function () {
        return new Array(cols).fill(0);
      });

      for (let i = 1; i < rows; i += 1) {
        for (let j = 1; j < cols; j += 1) {
          if (left[i - 1] === right[j - 1]) {
            matrix[i][j] = matrix[i - 1][j - 1] + 1;
          } else {
            matrix[i][j] = Math.max(matrix[i - 1][j], matrix[i][j - 1]);
          }
        }
      }

      const parts = [];
      let i = left.length;
      let j = right.length;
      while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && left[i - 1] === right[j - 1]) {
          parts.push(createDiffPart("same", left[i - 1]));
          i -= 1;
          j -= 1;
          continue;
        }
        const up = i > 0 ? matrix[i - 1][j] : -1;
        const leftScore = j > 0 ? matrix[i][j - 1] : -1;
        if (j > 0 && (i === 0 || leftScore >= up)) {
          parts.push(createDiffPart("insert", right[j - 1]));
          j -= 1;
        } else if (i > 0) {
          parts.push(createDiffPart("delete", left[i - 1]));
          i -= 1;
        }
      }

      return mergeDiffParts(parts.reverse());
    }

    function renderDiffParts(container, parts) {
      if (!(container instanceof HTMLElement)) {
        return;
      }
      container.innerHTML = "";
      (Array.isArray(parts) ? parts : []).forEach(function (part) {
        const span = document.createElement("span");
        span.className = "asc-md-minnan-diff-" + (part.type || "same");
        span.textContent = String(part.text || "");
        container.appendChild(span);
      });
    }

    function createInlineDiffNode(originalText, suggestedText) {
      const node = document.createElement("span");
      node.className = "asc-md-minnan-inline-text";
      const original = normalizeText(originalText || "");
      const suggested = normalizeText(suggestedText || "");
      const parts = buildTextDiffParts(original, suggested);
      if (!parts || parts.length <= 0) {
        node.textContent = suggested;
        return node;
      }
      renderDiffParts(node, parts);
      return node;
    }

    function createDetailDiffNode(originalText, suggestedText) {
      const node = document.createElement("div");
      node.className = "asc-md-minnan-inline-text";
      const original = normalizeText(originalText || "");
      const suggested = normalizeText(suggestedText || "");
      const parts = buildTextDiffParts(original, suggested);
      if (!parts || parts.length <= 0) {
        node.textContent = suggested || "-";
        return node;
      }
      renderDiffParts(node, parts);
      return node;
    }

    function sanitizeDebugText(value) {
      return String(value || "")
        .replace(/https?:\/\/([^\s"'?]+)\?[^ \n\r"']+/gi, "https://$1?<signed-query-redacted>")
        .replace(/(authorization|cookie|token|signature|ossaccesskeyid)\s*[:=]\s*([^\s,;]+)/gi, "$1=<redacted>");
    }

    function sanitizeDebugValue(value) {
      if (value === undefined || value === null) {
        return value;
      }
      if (typeof value === "string") {
        return sanitizeDebugText(value);
      }
      if (Array.isArray(value)) {
        return value.map(sanitizeDebugValue);
      }
      if (typeof value === "object") {
        const next = {};
        Object.keys(value).forEach(function (key) {
          const lower = String(key || "").toLowerCase();
          if (
            lower.indexOf("authorization") >= 0 ||
            lower.indexOf("cookie") >= 0 ||
            lower.indexOf("token") >= 0 ||
            lower.indexOf("signature") >= 0 ||
            lower.indexOf("ossaccesskeyid") >= 0
          ) {
            next[key] = "<redacted>";
          } else {
            next[key] = sanitizeDebugValue(value[key]);
          }
        });
        return next;
      }
      return value;
    }

    function closeRawOutputModal() {
      if (rawOutputModal) {
        rawOutputModal.remove();
      }
      rawOutputModal = null;
      rawOutputTextArea = null;
    }

    function buildRawOutputPayload() {
      const rawPayload = {
        requestId: latestResult?.requestId || "",
        models: latestResult?.models || {},
        timing: latestResult?.timing || {},
        pipeline: {
          recognitionMode: latestResult?.recognitionMode || "",
          pipelineMode: latestResult?.pipelineMode || "",
          derivedPipelineMode: latestResult?.derivedPipelineMode || "",
        },
        rawAiDebug: latestResult?.rawAiDebug || null,
        rawModelText: latestResult?.rawModelText || null,
        rawJson: latestResult?.rawJson || null,
        normalizedResult: latestResult || {},
      };
      return sanitizeDebugValue(rawPayload);
    }

    function openRawOutputModal() {
      if (!latestResult) {
        setMessage("暂无可查看的 AI 原始输出。");
        return;
      }
      closeRawOutputModal();
      const overlay = document.createElement("div");
      overlay.setAttribute(RAW_MODAL_ATTR, "true");
      const dialog = document.createElement("div");
      dialog.className = "asc-md-minnan-raw-dialog";
      const head = document.createElement("div");
      head.className = "asc-md-minnan-raw-head";
      const title = document.createElement("div");
      title.className = "asc-md-minnan-raw-title";
      title.textContent = "AI 原始输出（脱敏）";
      const actions = document.createElement("div");
      actions.className = "asc-md-minnan-raw-actions";
      const copyBtn = createButton("复制");
      copyBtn.addEventListener("click", function () {
        copyText(rawOutputTextArea?.value || "")
          .then(function () {
            setMessage("已复制 AI 原始输出。");
          })
          .catch(function (error) {
            setMessage(error?.message || "复制失败。");
          });
      });
      const closeBtn = createButton("关闭");
      closeBtn.addEventListener("click", closeRawOutputModal);
      actions.appendChild(copyBtn);
      actions.appendChild(closeBtn);
      head.appendChild(title);
      head.appendChild(actions);
      const textarea = document.createElement("textarea");
      textarea.readOnly = true;
      textarea.value = JSON.stringify(buildRawOutputPayload(), null, 2);
      rawOutputTextArea = textarea;
      dialog.appendChild(head);
      dialog.appendChild(textarea);
      overlay.appendChild(dialog);
      overlay.addEventListener("click", function (event) {
        if (event.target === overlay) {
          closeRawOutputModal();
        }
      });
      (document.body || document.documentElement).appendChild(overlay);
      rawOutputModal = overlay;
    }

    function findCurrentRegionRoot() {
      const preferredRegionId = normalizeText(
        latestSnapshot?.regionId || latestSnapshot?.segmentId || latestSnapshot?.dataItemId || ""
      );
      if (preferredRegionId) {
        const matched = document.querySelector(
          '.region-item[region_id="' + preferredRegionId.replace(/"/g, '\\"') + '"]'
        );
        if (matched instanceof HTMLElement) {
          return matched;
        }
      }
      const visibleRegions = Array.from(document.querySelectorAll(".region-item")).filter(function (node) {
        return node.getClientRects().length > 0;
      });
      if (visibleRegions.length === 0) {
        return null;
      }
      const withEditableRows = visibleRegions.find(function (region) {
        const editableRows = Array.from(
          region.querySelectorAll(".edit.region-edit[contenteditable='true']")
        );
        return editableRows.some(function (row) {
          const idx = String(row.getAttribute("data-index") || row.getAttribute("alt") || "").trim();
          return idx === "0";
        }) && editableRows.some(function (row) {
          const idx = String(row.getAttribute("data-index") || row.getAttribute("alt") || "").trim();
          return idx === "1";
        });
      });
      return withEditableRows || visibleRegions[0];
    }

    function findRowEditorByIndex(indexValue) {
      const region = findCurrentRegionRoot();
      if (!region) {
        return null;
      }
      const rows = Array.from(region.querySelectorAll(".speak-item"));
      const matched = rows.find(function (row) {
        const editor = row.querySelector(".edit.region-edit[contenteditable='true']");
        const indexText = String(
          editor?.getAttribute("data-index") ||
            row.getAttribute("data-index") ||
            editor?.getAttribute("alt") ||
            row.getAttribute("alt") ||
            ""
        ).trim();
        return indexText === String(indexValue);
      });
      return matched ? matched.querySelector(".edit.region-edit[contenteditable='true']") : null;
    }

    function fillInlineEditor(editor, text) {
      if (!(editor instanceof HTMLElement)) {
        return { ok: false, message: "未定位到对应文本行。"};
      }
      editor.focus();
      editor.textContent = normalizeText(text);
      editor.dispatchEvent(new Event("input", { bubbles: true }));
      editor.dispatchEvent(new Event("change", { bubbles: true }));
      return { ok: true, message: "已填入本行，未保存、未提交，请人工确认。" };
    }

    function clearInlineSuggestionBlocks(taskKey) {
      const normalizedTaskKey = normalizeText(taskKey || "");
      Array.from(document.querySelectorAll("[" + INLINE_SUGGESTION_ATTR + "]")).forEach(function (node) {
        if (!normalizedTaskKey || normalizeText(node.getAttribute(TASK_KEY_ATTR) || "") === normalizedTaskKey) {
          node.remove();
        }
      });
    }

    function clearSpeakerSuggestionBlocks(taskKey) {
      const normalizedTaskKey = normalizeText(taskKey || "");
      Array.from(document.querySelectorAll("[" + SPEAKER_SUGGESTION_ATTR + "]")).forEach(function (node) {
        if (!normalizedTaskKey || normalizeText(node.getAttribute(TASK_KEY_ATTR) || "") === normalizedTaskKey) {
          node.remove();
        }
      });
    }

    function isValidGenderValue(value) {
      return ["男", "女"].indexOf(normalizeText(value)) >= 0;
    }

    function isValidAgeRangeValue(value) {
      return ["0-5", "6-12", "13-18", "19-25", "26-36", "37-50", "51-65", "65以上"].indexOf(
        normalizeText(value)
      ) >= 0;
    }

    function findSpeakerFormItemByLabel(labelText) {
      const speakerRoot = findSpeakerAttributesRoot();
      if (!(speakerRoot instanceof HTMLElement)) {
        return null;
      }
      const normalizedLabel = normalizeText(labelText);
      const formItems = Array.from(speakerRoot.querySelectorAll(".el-form-item"));
      return (
        formItems.find(function (item) {
          const label = normalizeText(item.querySelector(".el-form-item__label")?.textContent || "");
          return label === normalizedLabel;
        }) || null
      );
    }

    function clickSpeakerOptionInItem(formItem, optionValue) {
      if (!(formItem instanceof HTMLElement)) {
        return { ok: false, message: "未找到说话人属性项。" };
      }
      const normalizedValue = normalizeText(optionValue);
      const inputs = Array.from(
        formItem.querySelectorAll("input.el-radio__original, input[type='radio']")
      );
      const input = inputs.find(function (node) {
        return normalizeText(node.value) === normalizedValue;
      });
      if (!(input instanceof HTMLElement)) {
        return { ok: false, message: "未找到建议值对应的单选项。" };
      }
      if (input.disabled) {
        return { ok: false, message: "目标单选项不可点击。"} ;
      }
      const label = input.closest("label.el-radio, label");
      if (label?.classList?.contains("is-disabled")) {
        return { ok: false, message: "目标单选项不可点击。"} ;
      }
      if (label && typeof label.click === "function") {
        label.click();
      } else if (typeof input.click === "function") {
        input.click();
      }
      return { ok: true, message: "已选择" + normalizedValue + "，未保存、未提交。" };
    }

    function buildSpeakerSuggestionText(checkData) {
      const suggestedValue = normalizeText(checkData?.suggestedValue || "");
      if (checkData?.isCorrect === true) {
        return "AI建议：正确";
      }
      if (suggestedValue) {
        return "AI建议：" + suggestedValue;
      }
      return "AI建议：待复核";
    }

    function ensureSpeakerSuggestionWrapper(formItem, labelText, taskKey) {
      if (!(formItem instanceof HTMLElement)) {
        return null;
      }
      const normalizedTaskKey = normalizeText(taskKey || "");
      const selector =
        "[" + SPEAKER_SUGGESTION_ATTR + '="' + labelText + '"]';
      const existed = formItem.querySelector(selector);
      if (
        existed &&
        normalizeText(existed.getAttribute(TASK_KEY_ATTR) || "") === normalizedTaskKey
      ) {
        return existed;
      }
      if (existed) {
        existed.remove();
      }
      const wrapper = document.createElement("div");
      wrapper.setAttribute(SPEAKER_SUGGESTION_ATTR, labelText);
      wrapper.setAttribute(TASK_KEY_ATTR, normalizedTaskKey);
      const contentNode = formItem.querySelector(".el-form-item__content");
      if (contentNode && contentNode.parentElement === formItem) {
        formItem.insertBefore(wrapper, contentNode.nextSibling);
      } else {
        formItem.appendChild(wrapper);
      }
      return wrapper;
    }

    function renderSpeakerSuggestion(formItem, labelText, checkData, validateFn) {
      if (!(formItem instanceof HTMLElement)) {
        return;
      }
      const taskKey = getSnapshotTaskKey(latestSnapshot);
      const wrapper = ensureSpeakerSuggestionWrapper(formItem, labelText, taskKey);
      if (!(wrapper instanceof HTMLElement)) {
        return;
      }
      let text = wrapper.querySelector(".asc-md-minnan-speaker-text");
      if (!(text instanceof HTMLElement)) {
        text = document.createElement("div");
        text.className = "asc-md-minnan-speaker-text";
        wrapper.appendChild(text);
      }
      const suggestedValue = normalizeText(checkData?.suggestedValue || "");
      text.textContent = buildSpeakerSuggestionText(checkData);
      const oldActions = wrapper.querySelector(".asc-md-minnan-speaker-actions");
      if (oldActions) {
        oldActions.remove();
      }
      const canFill = checkData?.isCorrect !== true && validateFn(suggestedValue);
      if (canFill) {
        const actions = document.createElement("div");
        actions.className = "asc-md-minnan-speaker-actions";
        const fillBtn = createButton("填入" + labelText, "el-button--primary is-plain");
        fillBtn.addEventListener("mousedown", function (event) {
          event.preventDefault();
        });
        fillBtn.addEventListener("click", function () {
          let result = null;
          if (typeof options.selectSpeakerValue === "function") {
            result = options.selectSpeakerValue(suggestedValue);
          }
          if (!result || result.ok !== true) {
            result = clickSpeakerOptionInItem(formItem, suggestedValue);
          }
          setMessage(result?.message || "已填入建议值。");
        });
        actions.appendChild(fillBtn);
        wrapper.appendChild(actions);
      }
    }

    function renderSpeakerAttributeSuggestions(resultData) {
      if (!resultData) {
        clearSpeakerSuggestionBlocks(getSnapshotTaskKey(latestSnapshot));
        return;
      }
      const speakerCheck = resultData.speakerCheck || {};
      const genderItem = findSpeakerFormItemByLabel("性别");
      const ageItem = findSpeakerFormItemByLabel("年龄");
      renderSpeakerSuggestion(genderItem, "性别", speakerCheck.gender || {}, isValidGenderValue);
      renderSpeakerSuggestion(ageItem, "年龄", speakerCheck.ageRange || {}, isValidAgeRangeValue);
    }

    function shouldShowTextFillButton(checkData) {
      if (checkData?.isCorrect === true) {
        return false;
      }
      return Boolean(normalizeText(checkData?.suggestedValue || ""));
    }

    function getInlineSuggestionText(checkData) {
      if (checkData?.isCorrect === true) {
        return "正确";
      }
      return normalizeText(checkData?.suggestedValue || "待复核");
    }

    function getOriginalTextByType(type, checkData) {
      if (type === "dialect") {
        return normalizeText(
          checkData?.platformValue || latestSnapshot?.platformDialectText || ""
        );
      }
      if (type === "mandarin") {
        return normalizeText(
          checkData?.platformValue || latestSnapshot?.platformMandarinText || ""
        );
      }
      return "";
    }

    function ensureInlineSuggestionBlock(container, type, taskKey) {
      if (!(container instanceof HTMLElement)) {
        return null;
      }
      const normalizedTaskKey = normalizeText(taskKey || "");
      const selector = "[" + INLINE_SUGGESTION_ATTR + '="' + type + '"]';
      const existed = container.querySelector(selector);
      if (
        existed &&
        normalizeText(existed.getAttribute(TASK_KEY_ATTR) || "") === normalizedTaskKey
      ) {
        return existed;
      }
      if (existed) {
        existed.remove();
      }
      const block = document.createElement("div");
      block.setAttribute(INLINE_SUGGESTION_ATTR, type);
      block.setAttribute(TASK_KEY_ATTR, normalizedTaskKey);
      const row = document.createElement("div");
      row.className = "asc-md-minnan-inline-row";
      const text = document.createElement("div");
      text.className = "asc-md-minnan-inline-text";
      row.appendChild(text);
      block.appendChild(row);
      container.appendChild(block);
      return block;
    }

    function updateInlineSuggestionBlock(block, type, checkData) {
      if (!(block instanceof HTMLElement)) {
        return;
      }
      const row = block.querySelector(".asc-md-minnan-inline-row") || block;
      const textNode = row.querySelector(".asc-md-minnan-inline-text");
      if (textNode) {
        const suggestionText = getInlineSuggestionText(checkData);
        if (checkData?.isCorrect === true || suggestionText === "待复核") {
          textNode.textContent = suggestionText;
        } else {
          const diffNode = createInlineDiffNode(getOriginalTextByType(type, checkData), suggestionText);
          textNode.replaceWith(diffNode);
        }
      }
      const oldButton = row.querySelector("button");
      if (oldButton) {
        oldButton.remove();
      }
      if (shouldShowTextFillButton(checkData)) {
        const fillBtn = createButton("填入本行", "el-button--primary is-plain");
        fillBtn.addEventListener("mousedown", function (event) {
          event.preventDefault();
        });
        fillBtn.addEventListener("click", function () {
          const editor = type === "dialect" ? findRowEditorByIndex(0) : findRowEditorByIndex(1);
          const result = fillInlineEditor(editor, checkData?.suggestedValue || "");
          setMessage(result.message);
        });
        row.appendChild(fillBtn);
      }
    }

    function renderInlineSuggestions() {
      if (!latestResult) {
        clearInlineSuggestionBlocks(getSnapshotTaskKey(latestSnapshot));
        return;
      }
      const taskKey = getSnapshotTaskKey(latestSnapshot);
      const dialectEditor = findRowEditorByIndex(0);
      const mandarinEditor = findRowEditorByIndex(1);
      const dialectContainer = dialectEditor?.closest(".edit-container");
      const mandarinContainer = mandarinEditor?.closest(".edit-container");
      if (dialectContainer) {
        const block = ensureInlineSuggestionBlock(
          dialectContainer,
          "dialect",
          taskKey
        );
        updateInlineSuggestionBlock(block, "dialect", latestResult?.dialectTextCheck || {});
      }
      if (mandarinContainer) {
        const block = ensureInlineSuggestionBlock(
          mandarinContainer,
          "mandarin",
          taskKey
        );
        updateInlineSuggestionBlock(block, "mandarin", latestResult?.mandarinTextCheck || {});
      }
    }

    function getFoldStateKey(sectionName) {
      const taskKey = getSnapshotTaskKey(latestSnapshot) || "no-task";
      return taskKey + "::" + sectionName;
    }

    function isFoldSectionOpen(sectionName) {
      return foldStateByTask.get(getFoldStateKey(sectionName)) === true;
    }

    function saveFoldSectionState(sectionName, isOpen) {
      foldStateByTask.set(getFoldStateKey(sectionName), isOpen === true);
    }

    function createFoldSection(title, rows) {
      const section = document.createElement("section");
      section.className = "md-fold-section";
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "md-fold-toggle";
      toggle.setAttribute("data-section", title);
      toggle.textContent = title;
      const body = document.createElement("div");
      body.className = "md-fold-body";
      const block = document.createElement("div");
      block.className = "md-block";
      block.appendChild(createCheckGrid(rows));
      body.appendChild(block);
      if (isFoldSectionOpen(title)) {
        section.classList.add("is-open");
      }
      toggle.addEventListener("click", function (event) {
        event.preventDefault();
        const nextOpen = !section.classList.contains("is-open");
        section.classList.toggle("is-open", nextOpen);
        saveFoldSectionState(title, nextOpen);
      });
      section.appendChild(toggle);
      section.appendChild(body);
      return section;
    }

    function toggleFoldSection(sectionName) {
      if (!(resultNode instanceof HTMLElement)) {
        return { ok: false, message: "结果区域未就绪。" };
      }
      const toggle = resultNode.querySelector('.md-fold-toggle[data-section="' + sectionName + '"]');
      if (!(toggle instanceof HTMLElement)) {
        return { ok: false, message: "未找到对应详情板块：" + sectionName };
      }
      toggle.click();
      const section = toggle.closest(".md-fold-section");
      const isOpen = Boolean(section?.classList?.contains("is-open"));
      return {
        ok: true,
        message: (isOpen ? "已展开" : "已收起") + "「" + sectionName + "」详情。",
      };
    }

    function renderResult(data) {
      latestResult = data || null;
      if (!resultNode) {
        return;
      }
      resultNode.innerHTML = "";
      if (!data) {
        clearInlineSuggestionBlocks();
        clearSpeakerSuggestionBlocks();
        const emptyNode = document.createElement("div");
        emptyNode.className = "md-empty";
        emptyNode.textContent = "暂无质检结果，请点击 AI 质检当前条。";
        resultNode.appendChild(emptyNode);
        refreshButtons();
        return;
      }

      const speakerCheck = data.speakerCheck || {};
      const genderCheck = speakerCheck.gender || {};
      const ageRangeCheck = speakerCheck.ageRange || {};
      const dialectCheck = data.dialectTextCheck || {};
      const mandarinCheck = data.mandarinTextCheck || {};

      const overallBlock = document.createElement("div");
      overallBlock.className = "md-block";
      overallBlock.innerHTML = '<div class="md-check-title">总结论</div>';
      overallBlock.appendChild(createCheckGrid(buildOverallRows(data)));
      resultNode.appendChild(overallBlock);
      resultNode.appendChild(
        createFoldSection("说话人属性", [
          ["性别判断", renderCorrectTag(genderCheck.isCorrect), true],
          ["平台值", normalizeText(genderCheck.platformValue || "-")],
          ["AI建议", normalizeText(genderCheck.suggestedValue || "-")],
          ["原因", normalizeText(genderCheck.reason || "-")],
          ["置信度", formatNumber(genderCheck.confidence, 2)],
          ["年龄判断", renderCorrectTag(ageRangeCheck.isCorrect), true],
          ["平台值", normalizeText(ageRangeCheck.platformValue || "-")],
          ["AI建议", normalizeText(ageRangeCheck.suggestedValue || "-")],
          ["原因", normalizeText(ageRangeCheck.reason || "-")],
          ["置信度", formatNumber(ageRangeCheck.confidence, 2)],
        ])
      );
      resultNode.appendChild(
        createFoldSection("闽南语内容", [
          ["是否正确", renderCorrectTag(dialectCheck.isCorrect), true],
          ["平台文本", normalizeText(dialectCheck.platformValue || latestSnapshot.platformDialectText || "-")],
          ["AI建议", normalizeText(dialectCheck.suggestedValue || "-")],
          [
            "差异对比",
            createDetailDiffNode(
              normalizeText(dialectCheck.platformValue || latestSnapshot.platformDialectText || ""),
              normalizeText(dialectCheck.suggestedValue || "")
            ),
            "node",
          ],
          ["原因", normalizeText(dialectCheck.reason || "-")],
          ["置信度", formatNumber(dialectCheck.confidence, 2)],
        ])
      );
      resultNode.appendChild(
        createFoldSection("普通话文本", [
          ["是否正确", renderCorrectTag(mandarinCheck.isCorrect), true],
          ["平台文本", normalizeText(mandarinCheck.platformValue || latestSnapshot.platformMandarinText || "-")],
          ["AI建议", normalizeText(mandarinCheck.suggestedValue || "-")],
          [
            "差异对比",
            createDetailDiffNode(
              normalizeText(mandarinCheck.platformValue || latestSnapshot.platformMandarinText || ""),
              normalizeText(mandarinCheck.suggestedValue || "")
            ),
            "node",
          ],
          ["原因", normalizeText(mandarinCheck.reason || "-")],
          ["置信度", formatNumber(mandarinCheck.confidence, 2)],
        ])
      );

      renderInlineSuggestions();
      renderSpeakerAttributeSuggestions(data);
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
        const modelMode = (function () {
          const text = String(
            runtimeSettings.aiReviewModelMode || runtimeSettings.aiReviewRecognitionMode || ""
          )
            .trim()
            .toLowerCase();
          if (text === "omni_single") {
            return "omni_single";
          }
          return "two_stage";
        })();
        const recognitionStrategy = (function () {
          const text = String(runtimeSettings.aiReviewRecognitionStrategy || "")
            .trim()
            .toLowerCase();
          if (text === "mandarin_to_dialect") {
            return "mandarin_to_dialect";
          }
          const legacyText = String(runtimeSettings.aiReviewRecognitionMode || "")
            .trim()
            .toLowerCase();
          return legacyText === "recognition_convert" ? "mandarin_to_dialect" : "direct_dialect";
        })();
        const recognitionMode =
          recognitionStrategy === "mandarin_to_dialect" ? "recognition_convert" : modelMode;
        const listenModel = String(
          runtimeSettings.aiReviewListenModel || runtimeSettings.listenModel || "qwen3.5-omni-flash"
        )
          .trim()
          .slice(0, 80);
        const compareModel = String(
          runtimeSettings.aiReviewCompareModel || runtimeSettings.reviewModel || "qwen3.5-plus"
        )
          .trim()
          .slice(0, 80);
        const singleModel = String(
          runtimeSettings.aiReviewSingleModel ||
            (modelMode === "omni_single"
              ? runtimeSettings.listenModel || "qwen3.5-omni-flash"
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
          rulesProfile: "minnan",
          clientVersion: options.getClientVersion ? options.getClientVersion() : "0.3.0",
          recognitionMode: recognitionMode,
          pipelineMode: recognitionMode,
          modelMode: modelMode,
          recognitionStrategy: recognitionStrategy,
          listenModel: listenModel,
          compareModel: compareModel,
          singleModel: singleModel,
          reviewModel: compareModel,
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

    function triggerFillAllSuggestions() {
      if (!latestResult) {
        const message = "暂无 AI 结果可填入。";
        setMessage(message);
        return { ok: false, message: message };
      }
      const speakerCheck = latestResult.speakerCheck || {};
      const genderCheck = speakerCheck.gender || {};
      const ageRangeCheck = speakerCheck.ageRange || {};
      const dialectCheck = latestResult.dialectTextCheck || {};
      const mandarinCheck = latestResult.mandarinTextCheck || {};

      let appliedCount = 0;
      const results = [];

      if (hasActionableSpeakerSuggestion(genderCheck, isValidGenderValue)) {
        const genderItem = findSpeakerFormItemByLabel("性别");
        const suggestedValue = normalizeText(genderCheck.suggestedValue || "");
        let result = null;
        if (typeof options.selectSpeakerValue === "function") {
          result = options.selectSpeakerValue(suggestedValue);
        }
        if (!result || result.ok !== true) {
          result = clickSpeakerOptionInItem(genderItem, suggestedValue);
        }
        if (result?.ok === true) {
          appliedCount += 1;
        }
        results.push(result);
      }

      if (hasActionableSpeakerSuggestion(ageRangeCheck, isValidAgeRangeValue)) {
        const ageItem = findSpeakerFormItemByLabel("年龄");
        const suggestedValue = normalizeText(ageRangeCheck.suggestedValue || "");
        let result = null;
        if (typeof options.selectSpeakerValue === "function") {
          result = options.selectSpeakerValue(suggestedValue);
        }
        if (!result || result.ok !== true) {
          result = clickSpeakerOptionInItem(ageItem, suggestedValue);
        }
        if (result?.ok === true) {
          appliedCount += 1;
        }
        results.push(result);
      }

      if (hasActionableTextSuggestion(dialectCheck)) {
        const editor = findRowEditorByIndex(0);
        const result = fillInlineEditor(editor, dialectCheck.suggestedValue || "");
        if (result?.ok === true) {
          appliedCount += 1;
        }
        results.push(result);
      }

      if (hasActionableTextSuggestion(mandarinCheck)) {
        const editor = findRowEditorByIndex(1);
        const result = fillInlineEditor(editor, mandarinCheck.suggestedValue || "");
        if (result?.ok === true) {
          appliedCount += 1;
        }
        results.push(result);
      }

      if (appliedCount <= 0) {
        const fallback = results.find(function (item) {
          return item && item.ok !== true && item.message;
        });
        const message = fallback?.message || "无需要填入的修改。";
        setMessage(message);
        return { ok: false, message: message };
      }
      const message = "已填入 AI 推荐，未保存、未提交，请人工确认。";
      setMessage(message);
      return { ok: true, message: message };
    }

    async function triggerRefreshCollection() {
      const snapshot = await collectAndRenderSnapshot(true);
      if (!snapshot) {
        return { ok: false, message: "刷新采集失败。" };
      }
      return { ok: true, message: "采集已刷新。" };
    }

    function triggerResetPanelHeight() {
      applyPanelHeight(DEFAULT_PANEL_HEIGHT);
      void persistPanelHeight(DEFAULT_PANEL_HEIGHT);
      const message = "卡片高度已重置为默认值。";
      setMessage(message);
      return { ok: true, message: message };
    }

    function triggerShowRawOutput() {
      if (!latestResult) {
        const message = "暂无 AI 原始输出。";
        setMessage(message);
        return { ok: false, message: message };
      }
      openRawOutputModal();
      return { ok: true, message: "已打开 AI 原始输出。" };
    }

    function clearResult() {
      const taskKey = getSnapshotTaskKey(latestSnapshot);
      latestResult = null;
      closeRawOutputModal();
      clearInlineSuggestionBlocks(taskKey);
      clearSpeakerSuggestionBlocks(taskKey);
      renderResult(null);
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
      const existing = document.querySelector("[" + ROOT_ATTR + "]");
      if (existing && existing instanceof HTMLElement) {
        existing.remove();
      }
      ensureStyle();
      root = document.createElement("section");
      root.setAttribute(ROOT_ATTR, "true");
      root.className = "asc-magic-data-review-inline";

      const head = document.createElement("div");
      head.className = "md-inline-head";
      const headText = document.createElement("div");
      const title = document.createElement("div");
      title.className = "md-inline-title";
      title.textContent = "闽南语助手结果";
      const sub = document.createElement("div");
      sub.className = "md-inline-sub";
      sub.textContent = "以平台现有文本为基准，AI 仅做闽南语规则质检和风险提示，不自动保存、不自动提交。";
      headText.appendChild(title);
      headText.appendChild(sub);

      head.appendChild(headText);
      root.appendChild(head);

      bodyScrollNode = document.createElement("div");
      bodyScrollNode.className = "asc-magic-data-review-body";

      const actions = document.createElement("div");
      actions.className = "md-inline-buttons";
      const mainActions = document.createElement("div");
      mainActions.className = "md-inline-actions-main";
      buttons.review = createButton("AI 质检当前条", "md-primary el-button--primary");
      buttons.review.addEventListener("click", function () {
        void triggerReview();
      });
      buttons.fillAll = createButton("全部填入AI推荐", "el-button--success is-plain");
      buttons.fillAll.style.display = "none";
      buttons.fillAll.addEventListener("click", function () {
        const result = triggerFillAllSuggestions();
        if (result?.message) {
          setMessage(result.message);
        }
      });
      mainActions.appendChild(buttons.review);
      mainActions.appendChild(buttons.fillAll);
      bodyScrollNode.appendChild(mainActions);

      buttons.refresh = createButton("刷新采集");
      buttons.refresh.addEventListener("click", function () {
        void collectAndRenderSnapshot(true);
      });
      buttons.resetHeight = createButton("重置高度");
      buttons.resetHeight.addEventListener("click", function () {
        applyPanelHeight(DEFAULT_PANEL_HEIGHT);
        void persistPanelHeight(DEFAULT_PANEL_HEIGHT);
        setMessage("卡片高度已重置为默认值。");
      });
      actions.appendChild(buttons.refresh);
      actions.appendChild(buttons.resetHeight);
      buttons.copySummary = createButton("复制 AI 质检摘要");
      buttons.copySummary.addEventListener("click", function () {
        triggerCopySummary().catch(function (error) {
          setMessage(error?.message || "复制失败。");
        });
      });
      buttons.showRawOutput = createButton("显示 AI 原始输出");
      buttons.showRawOutput.addEventListener("click", function () {
        openRawOutputModal();
      });
      actions.appendChild(buttons.copySummary);
      actions.appendChild(buttons.showRawOutput);
      bodyScrollNode.appendChild(actions);

      messageNode = document.createElement("div");
      messageNode.className = "md-message";
      messageNode.textContent = "就绪。";
      bodyScrollNode.appendChild(messageNode);

      const resultBlock = document.createElement("div");
      resultBlock.className = "md-block";
      const resultTitle = document.createElement("div");
      resultTitle.className = "md-block-title";
      resultTitle.textContent = "三项预测质检结果";
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
      closeRawOutputModal();
      clearInlineSuggestionBlocks();
      clearSpeakerSuggestionBlocks();
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
      const prevTaskKey = getSnapshotTaskKey(latestSnapshot);
      if (settings && typeof settings === "object") {
        runtimeSettings = Object.assign({}, runtimeSettingsDefault, settings);
      }
      renderSummary(snapshot || {}, backend || null);
      renderPlatform(snapshot || {});
      const nextTaskKey = getSnapshotTaskKey(snapshot || latestSnapshot);
      if (prevTaskKey && nextTaskKey && prevTaskKey !== nextTaskKey) {
        clearInlineSuggestionBlocks(prevTaskKey);
        clearSpeakerSuggestionBlocks(prevTaskKey);
      }
      if (latestResult) {
        renderInlineSuggestions();
        renderSpeakerAttributeSuggestions(latestResult);
      }
      refreshButtons();
    }

    function setRuntimeSettings(settings) {
      if (!settings || typeof settings !== "object") {
        return;
      }
      runtimeSettings = Object.assign({}, runtimeSettingsDefault, settings);
      applyPanelHeight(currentPanelHeight);
      renderSummary(latestSnapshot || {}, latestBackend);
      refreshButtons();
    }

    function showAsrmarkCheckNotice() {
      ensureMounted();
      clearResult();
      setMessage("审核页当前不启用闽南语写入；可切换到客家话助手进行审核页 AI 质检。");
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
      triggerFillAllSuggestions: triggerFillAllSuggestions,
      triggerFillDialect: triggerFillDialect,
      triggerFillMandarin: triggerFillMandarin,
      triggerRefreshCollection: triggerRefreshCollection,
      triggerReview: triggerReview,
      triggerResetPanelHeight: triggerResetPanelHeight,
      triggerShowRawOutput: triggerShowRawOutput,
      triggerToggleDialectDetail: function () {
        return toggleFoldSection("闽南语内容");
      },
      triggerToggleMandarinDetail: function () {
        return toggleFoldSection("普通话文本");
      },
      triggerToggleSpeakerDetail: function () {
        return toggleFoldSection("说话人属性");
      },
    };
  }

  const exportedApi = {
    createRuntime: createRuntime,
  };
  exportedApi.__test__ = {
    buildOverallRows: buildOverallRows,
    shouldDisableShowRawOutput: function (isLoading) {
      return isLoading === true;
    },
  };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = exportedApi;
  }
  globalThis.__ASREdgeMagicDataMinnanInlinePanel = exportedApi;
})();

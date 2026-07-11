(function () {
  const TASK21_ASSISTANT_RUNTIME_VERSION = "task21-assistant-fill-v2-20260519";
  const FIELD_INPUT_WAIT_MS = 5000;
  const STYLE_ID = "asc-abaka-ai-inline-style";
  const ACTIONS_WRAP_CLASS = "asc-abaka-ai-inline-actions";
  const PANEL_CLASS = "asc-abaka-ai-result-panel";
  const BUTTON_CLASS = "asc-abaka-ai-btn";
  const BUTTON_OVERALL_CLASS = "asc-abaka-ai-btn-overall";
  const LAYOUT_STORAGE_KEY = "asc-abaka-task21-ai-panel-layout-v1";

  const FIELD_CONFIGS = {
    same_font: {
      key: "same_font",
      title: "same_font",
      actionButtons: [
        { key: "aiAnalyzeSameFont", label: "AI分析", target: "same_font", panelField: "same_font" },
        {
          key: "aiAnalyzeOverall",
          label: "整体分析",
          target: "overall",
          panelField: "same_font",
          overall: true,
        },
      ],
    },
    image_b_texts_removed: {
      key: "image_b_texts_removed",
      title: "image_b_texts_removed",
      actionButtons: [
        {
          key: "aiAnalyzeImageBTextsRemoved",
          label: "AI分析",
          target: "image_b_texts_removed",
          panelField: "image_b_texts_removed",
        },
      ],
    },
    other_changes: {
      key: "other_changes",
      title: "other_changes",
      actionButtons: [
        {
          key: "aiAnalyzeOtherChanges",
          label: "AI分析",
          target: "other_changes",
          panelField: "other_changes",
        },
      ],
    },
  };

  const TARGET_TO_PANEL_FIELD = {
    same_font: "same_font",
    overall: "same_font",
    image_b_texts_removed: "image_b_texts_removed",
    other_changes: "other_changes",
  };

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function normalizeDisplayText(value) {
    return String(value || "").replace(/\r\n/g, "\n").trim();
  }

  function normalizeLower(value) {
    return normalizeText(value).toLowerCase();
  }

  function nowMs() {
    return Date.now();
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

  function safeJsonParse(text) {
    try {
      return JSON.parse(text);
    } catch (error) {
      return null;
    }
  }

  function sanitizeRawForDisplay(payload) {
    function sanitizeValue(key, value) {
      const keyText = String(key || "").toLowerCase();
      if (
        keyText === "dataurl" ||
        keyText === "imageurl" ||
        keyText.indexOf("authorization") >= 0 ||
        keyText.indexOf("token") >= 0 ||
        keyText.indexOf("cookie") >= 0 ||
        keyText.indexOf("password") >= 0 ||
        keyText.indexOf("secret") >= 0 ||
        keyText.indexOf("signature") >= 0
      ) {
        return "[redacted]";
      }
      if (typeof value === "string") {
        if (/^data:image\//i.test(value)) {
          return "[data-url-redacted]";
        }
        if (/^https?:\/\//i.test(value)) {
          return "[url-redacted]";
        }
      }
      return value;
    }
    return safeJsonParse(
      JSON.stringify(payload || {}, function (key, value) {
        return sanitizeValue(key, value);
      })
    );
  }

  function formatElapsedMs(ms) {
    const value = Number(ms);
    if (!Number.isFinite(value) || value <= 0) {
      return "0.0s";
    }
    return (value / 1000).toFixed(1) + "s";
  }

  function findFieldItemByTitle(fieldTitle) {
    const target = normalizeLower(fieldTitle);
    if (!target) {
      return null;
    }
    const titleNodes = document.querySelectorAll(".l-title-text");
    for (let index = 0; index < titleNodes.length; index += 1) {
      const node = titleNodes[index];
      if (!isVisible(node)) {
        continue;
      }
      if (normalizeLower(node.textContent || "") !== target) {
        continue;
      }
      const item = node.closest(".l-item");
      if (item) {
        return { item: item, titleNode: node };
      }
    }
    return null;
  }

  function createBadgeClass(choice) {
    const text = normalizeLower(choice);
    if (text === "true") {
      return "good";
    }
    if (text === "false" || text === "error") {
      return "bad";
    }
    if (text === "specify" || text === "same underlying font+artistic effect") {
      return "info";
    }
    return "muted";
  }

  function normalizeSameFontChoice(value) {
    const text = normalizeLower(value);
    if (
      text === "true" ||
      text === "false" ||
      text === "unsure" ||
      text === "error" ||
      text === "same underlying font+artistic effect"
    ) {
      return text;
    }
    return "unsure";
  }

  function normalizeRemovedChoice(section) {
    const source = section && typeof section === "object" ? section : {};
    const choice = normalizeLower(source.choice);
    if (choice === "specify" || choice === "true" || choice === "null") {
      return choice;
    }
    const valueText = normalizeText(source.value || "");
    if (normalizeLower(valueText) === "true") {
      return "true";
    }
    const lines = Array.isArray(source.lines)
      ? source.lines
      : valueText
          .split(/\r?\n/)
          .map(function (line) {
            return normalizeText(line);
          })
          .filter(Boolean);
    return lines.length > 0 ? "specify" : "null";
  }

  function normalizeOtherChoice(section) {
    const source = section && typeof section === "object" ? section : {};
    const choice = normalizeLower(source.choice);
    if (choice === "specify" || choice === "unsure" || choice === "null") {
      return choice;
    }
    const valueText = normalizeText(source.value || "");
    if (normalizeLower(valueText) === "unsure") {
      return "unsure";
    }
    return valueText ? "specify" : "null";
  }

  function buildDisplaySuggestion(fieldKey, result) {
    const source = result && typeof result === "object" ? result : {};
    if (fieldKey === "same_font") {
      const section = source.same_font || {};
      const choice = normalizeSameFontChoice(section.choice || section.value);
      return {
        target: "same_font",
        primaryChoice: choice,
        answerText: "",
        reasonText: normalizeText(section.reason_cn || ""),
        evidence: Array.isArray(section.evidence) ? section.evidence : [],
        warnings: Array.isArray(section.warnings) ? section.warnings : [],
        canFill:
          choice === "true" ||
          choice === "false" ||
          choice === "unsure" ||
          choice === "error" ||
          choice === "same underlying font+artistic effect",
      };
    }

    if (fieldKey === "image_b_texts_removed") {
      const section = source.image_b_texts_removed || {};
      const choice = normalizeRemovedChoice(section);
      const lines = Array.isArray(section.lines)
        ? section.lines
            .map(function (line) {
              return normalizeDisplayText(line);
            })
            .filter(Boolean)
        : [];
      return {
        target: "image_b_texts_removed",
        primaryChoice: choice,
        answerText:
          choice === "specify"
            ? lines.length > 0
              ? lines.join("\n")
              : normalizeDisplayText(section.value || "")
            : "",
        reasonText: normalizeText(section.reason_cn || ""),
        evidence: Array.isArray(section.evidence) ? section.evidence : [],
        warnings: Array.isArray(section.warnings) ? section.warnings : [],
        canFill: choice === "specify" || choice === "true" || choice === "null",
      };
    }

    const section = source.other_changes || {};
    const choice = normalizeOtherChoice(section);
    return {
      target: "other_changes",
      primaryChoice: choice,
      answerText: choice === "specify" ? normalizeText(section.value || "") : "",
      reasonText: normalizeText(section.reason_cn || ""),
      evidence: Array.isArray(section.evidence) ? section.evidence : [],
      warnings: Array.isArray(section.warnings) ? section.warnings : [],
      canFill: choice === "specify" || choice === "unsure" || choice === "null",
    };
  }

  function buildDisplaySuggestions(target, result) {
    if (target === "same_font") {
      return [buildDisplaySuggestion("same_font", result)];
    }
    if (target === "image_b_texts_removed") {
      return [buildDisplaySuggestion("image_b_texts_removed", result)];
    }
    if (target === "other_changes") {
      return [buildDisplaySuggestion("other_changes", result)];
    }
    return [
      buildDisplaySuggestion("same_font", result),
      buildDisplaySuggestion("image_b_texts_removed", result),
      buildDisplaySuggestion("other_changes", result),
    ];
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      "." + ACTIONS_WRAP_CLASS + "{display:inline-flex;align-items:center;gap:6px;margin-left:10px;flex-wrap:wrap;}",
      "." + BUTTON_CLASS + "{height:24px;line-height:22px;padding:0 9px;border:1px solid #7ba7ff;border-radius:12px;background:#eef4ff;color:#1d4ed8;font-size:12px;font-weight:600;cursor:pointer;}",
      "." + BUTTON_CLASS + ":hover{background:#dbeafe;}",
      "." + BUTTON_CLASS + ":disabled{opacity:.45;cursor:not-allowed;}",
      "." + BUTTON_OVERALL_CLASS + "{border-color:#93c5fd;background:#f0f9ff;color:#1d4ed8;}",
      "." + PANEL_CLASS + "{position:fixed;z-index:2147483640;width:520px;height:360px;min-width:360px;min-height:220px;max-width:calc(100vw - 16px);max-height:calc(100vh - 16px);resize:both;overflow:auto;border:1px solid #cbd5e1;border-radius:12px;background:#ffffff;color:#0f172a;box-shadow:0 18px 42px rgba(15,23,42,.22);}",
      "." + PANEL_CLASS + " *{box-sizing:border-box;}",
      "." + PANEL_CLASS + " .asc-panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;padding:10px 12px;border-bottom:1px solid #e2e8f0;background:#f8fafc;cursor:move;user-select:none;}",
      "." + PANEL_CLASS + " .asc-head-main{display:grid;gap:2px;}",
      "." + PANEL_CLASS + " .asc-panel-title{font-weight:700;font-size:14px;color:#0f172a;}",
      "." + PANEL_CLASS + " .asc-panel-sub{font-size:11px;color:#64748b;}",
      "." + PANEL_CLASS + " .asc-head-actions{display:flex;gap:6px;flex-wrap:wrap;}",
      "." + PANEL_CLASS + " .asc-panel-close,." + PANEL_CLASS + " .asc-panel-reset{border:1px solid #cbd5e1;border-radius:8px;background:#fff;padding:2px 8px;font-size:12px;cursor:pointer;}",
      "." + PANEL_CLASS + " .asc-panel-body{padding:10px 12px;display:grid;gap:8px;}",
      "." + PANEL_CLASS + " .asc-status{font-size:12px;font-weight:700;color:#1e293b;}",
      "." + PANEL_CLASS + " .asc-meta{font-size:12px;color:#475569;}",
      "." + PANEL_CLASS + " .asc-fill-status{font-size:12px;color:#334155;}",
      "." + PANEL_CLASS + " .asc-result-list{display:grid;gap:8px;}",
      "." + PANEL_CLASS + " .asc-card{border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;padding:8px;display:grid;gap:6px;}",
      "." + PANEL_CLASS + " .asc-card-title{font-size:12px;font-weight:700;color:#334155;}",
      "." + PANEL_CLASS + " .asc-choice-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}",
      "." + PANEL_CLASS + " .asc-pill{display:inline-flex;align-items:center;min-height:22px;padding:0 8px;border-radius:999px;font-size:12px;font-weight:700;}",
      "." + PANEL_CLASS + " .asc-pill.good{background:rgba(16,185,129,.15);color:#047857;}",
      "." + PANEL_CLASS + " .asc-pill.bad{background:rgba(239,68,68,.15);color:#b91c1c;}",
      "." + PANEL_CLASS + " .asc-pill.info{background:rgba(37,99,235,.15);color:#1d4ed8;}",
      "." + PANEL_CLASS + " .asc-pill.muted{background:rgba(148,163,184,.2);color:#475569;}",
      "." + PANEL_CLASS + " .asc-answer{border:1px solid #dbe4ef;background:#fff;border-radius:6px;padding:6px;white-space:pre-wrap;word-break:break-word;font-size:12px;}",
      "." + PANEL_CLASS + " .asc-reason{font-size:12px;color:#334155;line-height:1.5;}",
      "." + PANEL_CLASS + " .asc-main-actions{display:flex;gap:8px;flex-wrap:wrap;}",
      "." + PANEL_CLASS + " details{border:1px solid #e2e8f0;border-radius:8px;background:#fff;}",
      "." + PANEL_CLASS + " details summary{cursor:pointer;padding:8px 10px;font-size:12px;color:#334155;}",
      "." + PANEL_CLASS + " details pre,." + PANEL_CLASS + " details .asc-debug-text{margin:0;border-top:1px solid #e2e8f0;padding:8px 10px;white-space:pre-wrap;word-break:break-word;font-size:12px;max-height:220px;overflow:auto;}",
    ].join("");
    (document.head || document.documentElement).appendChild(style);
  }

  function loadLayout() {
    try {
      const raw = String(window.localStorage.getItem(LAYOUT_STORAGE_KEY) || "");
      if (!raw) {
        return null;
      }
      const parsed = safeJsonParse(raw);
      if (!parsed || typeof parsed !== "object") {
        return null;
      }
      const left = Number(parsed.left);
      const top = Number(parsed.top);
      const width = Number(parsed.width);
      const height = Number(parsed.height);
      if (!Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(width) || !Number.isFinite(height)) {
        return null;
      }
      return { left: left, top: top, width: width, height: height };
    } catch (error) {
      return null;
    }
  }

  function saveLayout(panel) {
    if (!panel || !(panel.root instanceof HTMLElement)) {
      return;
    }
    try {
      const rect = panel.root.getBoundingClientRect();
      window.localStorage.setItem(
        LAYOUT_STORAGE_KEY,
        JSON.stringify({
          left: Math.round(rect.left),
          top: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        })
      );
    } catch (error) {
      // ignore
    }
  }

  function clearLayout() {
    try {
      window.localStorage.removeItem(LAYOUT_STORAGE_KEY);
    } catch (error) {
      // ignore
    }
  }

  function clampPanelRect(left, top, width, height) {
    const safeWidth = Math.max(360, Math.min(width, window.innerWidth - 8));
    const safeHeight = Math.max(220, Math.min(height, window.innerHeight - 8));
    const safeLeft = Math.max(8, Math.min(left, window.innerWidth - safeWidth - 8));
    const safeTop = Math.max(8, Math.min(top, window.innerHeight - safeHeight - 8));
    return { left: safeLeft, top: safeTop, width: safeWidth, height: safeHeight };
  }

  function applyPanelRect(panel, rect) {
    if (!panel || !rect) {
      return;
    }
    panel.root.style.left = String(Math.round(rect.left)) + "px";
    panel.root.style.top = String(Math.round(rect.top)) + "px";
    panel.root.style.width = String(Math.round(rect.width)) + "px";
    panel.root.style.height = String(Math.round(rect.height)) + "px";
  }

  function createRuntime(options) {
    const config = options && typeof options === "object" ? options : {};
    const collector = config.collector || {};
    const client = config.client || {};
    const pricing = config.pricing || {};
    const actions = config.actions || {};
    const showToast = typeof config.showToast === "function" ? config.showToast : function () {};

    const actionButtonByKey = {};
    const panelByField = {};
    const latestByField = {};
    const runningByField = {};
    const missingFieldLogged = {};

    let started = false;
    let mutationObserver = null;
    let refreshTimer = null;

    function getDomActionsVersion() {
      return String(actions.version || config.domActionsVersion || "-");
    }

    function buildRuntimeDebugText(extraLines) {
      const lines = [
        "runtimeVersion: " + TASK21_ASSISTANT_RUNTIME_VERSION,
        "domActionsVersion: " + getDomActionsVersion(),
      ];
      if (Array.isArray(extraLines)) {
        extraLines.forEach(function (line) {
          if (line) {
            lines.push(String(line));
          }
        });
      }
      return lines.join("\n");
    }

    function buildMetaText(display) {
      const usage = display.usage || {};
      const warnings = Array.isArray(display.warnings) ? display.warnings : [];
      const lines = [];
      lines.push("runtimeVersion: " + String(display.runtimeVersion || TASK21_ASSISTANT_RUNTIME_VERSION));
      lines.push("domActionsVersion: " + String(display.domActionsVersion || getDomActionsVersion()));
      lines.push("requestId: " + String(display.requestId || "-"));
      lines.push("analysisMode: " + String(display.analysisMode || "-"));
      lines.push("model: " + String(display.model || "-"));
      lines.push("visionModel: " + String(display.visionModel || "-"));
      lines.push("ocrEnabled: " + String(display.ocrEnabled === true));
      lines.push("ocrModel: " + String(display.ocrModel || "-"));
      lines.push("reasoningModel: " + String(display.reasoningModel || "-"));
      lines.push("singleModel: " + String(display.singleModel || "-"));
      lines.push("elapsedMs: " + String(display.elapsedMs || 0));
      lines.push(
        "tokens: input=" +
          String(usage.inputTokens || 0) +
          ", output=" +
          String(usage.outputTokens || 0) +
          ", total=" +
          String(usage.totalTokens || 0)
      );
      if (display.price && display.price.totalPrice !== undefined) {
        lines.push("price.total: " + String(display.price.totalPrice));
      }
      if (warnings.length > 0) {
        lines.push("warnings:");
        warnings.slice(0, 10).forEach(function (item) {
          lines.push("- " + String(item || ""));
        });
      }
      return lines.join("\n");
    }

    function buildShortCopyText(display) {
      const suggestions = Array.isArray(display.suggestions) ? display.suggestions : [];
      return suggestions
        .map(function (item) {
          const key = item.target;
          const choice = item.primaryChoice || "";
          const answer = normalizeDisplayText(item.answerText || "");
          return answer ? key + "=" + choice + "\n" + answer : key + "=" + choice;
        })
        .join("\n\n");
    }

    function getFieldAnchor(fieldKey) {
      const fieldConfig = FIELD_CONFIGS[fieldKey];
      if (!fieldConfig) {
        return null;
      }
      return findFieldItemByTitle(fieldConfig.title);
    }

    function updatePanelPosition(fieldKey) {
      const panel = panelByField[fieldKey];
      if (!panel || panel.root.style.display === "none" || panel.manualLayout) {
        return;
      }
      const anchor = getFieldAnchor(fieldKey);
      if (!anchor || !(anchor.item instanceof Element)) {
        return;
      }
      const rect = anchor.item.getBoundingClientRect();
      const currentWidth = panel.root.offsetWidth || 520;
      const currentHeight = panel.root.offsetHeight || 360;
      let left = rect.right + 8;
      if (left + currentWidth > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - currentWidth - 8);
      }
      const top = Math.max(8, Math.min(rect.top + 8, window.innerHeight - currentHeight - 8));
      applyPanelRect(panel, clampPanelRect(left, top, currentWidth, currentHeight));
    }

    function updateAllPanelPositions() {
      Object.keys(panelByField).forEach(function (fieldKey) {
        updatePanelPosition(fieldKey);
      });
    }

    function setPanelLoading(panel, label) {
      panel.status.textContent = "分析中";
      panel.meta.textContent =
        String(label || "") + " · waiting... · " + TASK21_ASSISTANT_RUNTIME_VERSION;
      panel.fillStatus.textContent = "";
      panel.results.innerHTML = "";
      panel.debugText.textContent = buildRuntimeDebugText(["status: waiting..."]);
      panel.rawText.textContent = "{}";
      panel.copyButton.disabled = true;
      panel.fillButton.disabled = true;
    }

    function setPanelError(panel, message) {
      panel.status.textContent = "失败";
      panel.meta.textContent =
        (normalizeText(message || "分析失败。") || "分析失败。") +
        " · " +
        TASK21_ASSISTANT_RUNTIME_VERSION;
      panel.fillStatus.textContent = "";
      panel.results.innerHTML = "";
      panel.debugText.textContent = buildRuntimeDebugText([
        "status: error",
        "message: " + String(message || "分析失败。"),
      ]);
      panel.copyButton.disabled = true;
      panel.fillButton.disabled = true;
    }

    function renderSuggestionCard(suggestion) {
      const card = document.createElement("div");
      card.className = "asc-card";

      const title = document.createElement("div");
      title.className = "asc-card-title";
      title.textContent = suggestion.target;
      card.appendChild(title);

      const choiceRow = document.createElement("div");
      choiceRow.className = "asc-choice-row";
      const label = document.createElement("span");
      label.textContent = "推荐选择";
      const pill = document.createElement("span");
      pill.className = "asc-pill " + createBadgeClass(suggestion.primaryChoice);
      pill.textContent = suggestion.primaryChoice || "-";
      choiceRow.appendChild(label);
      choiceRow.appendChild(pill);
      card.appendChild(choiceRow);

      if (normalizeText(suggestion.answerText || "")) {
        const answerTitle = document.createElement("div");
        answerTitle.className = "asc-card-title";
        answerTitle.textContent = "标准答案";
        const answer = document.createElement("pre");
        answer.className = "asc-answer";
        answer.textContent = String(suggestion.answerText || "");
        card.appendChild(answerTitle);
        card.appendChild(answer);
      }

      const reasonTitle = document.createElement("div");
      reasonTitle.className = "asc-card-title";
      reasonTitle.textContent = "理由";
      const reason = document.createElement("div");
      reason.className = "asc-reason";
      reason.textContent = normalizeText(suggestion.reasonText || "") || "-";
      card.appendChild(reasonTitle);
      card.appendChild(reason);

      return card;
    }

    function setPanelResult(panel, display) {
      panel.status.textContent = "分析完成";
      panel.meta.textContent =
        String(display.model || "-") +
        " · " +
        formatElapsedMs(display.elapsedMs) +
        " · " +
        String(display.analysisMode || "-") +
        " · " +
        String(display.runtimeVersion || TASK21_ASSISTANT_RUNTIME_VERSION);
      panel.fillStatus.textContent = "";
      panel.results.innerHTML = "";
      const suggestions = Array.isArray(display.suggestions) ? display.suggestions : [];
      suggestions.forEach(function (suggestion) {
        panel.results.appendChild(renderSuggestionCard(suggestion));
      });
      panel.debugText.textContent = buildMetaText(display);
      panel.rawText.textContent = JSON.stringify(sanitizeRawForDisplay(display.raw), null, 2);
      panel.copyButton.disabled = suggestions.length <= 0;
      panel.fillButton.disabled = !suggestions.some(function (item) {
        return item.canFill === true;
      });
    }

    function getFieldStates(snapshot) {
      const page = snapshot?.page || {};
      const values = snapshot?.context?.currentValues || {};
      return {
        same_font: page.hasSameFontField === true,
        image_b_texts_removed: values.image_b_texts_removed_exists === true,
        other_changes: values.other_changes_exists === true,
      };
    }

    function updateInlineButtonState(snapshot) {
      const states = getFieldStates(snapshot || {});
      Object.keys(actionButtonByKey).forEach(function (actionKey) {
        const entry = actionButtonByKey[actionKey];
        const button = entry && entry.button;
        if (!(button instanceof HTMLButtonElement)) {
          return;
        }
        const panelField = entry.panelField;
        const enabled = states[panelField] === true;
        button.disabled = !enabled || runningByField[panelField] === true;
        button.title = enabled ? "" : "未检测到该板块";
      });
    }

    function buildRequestPayload(snapshot, target) {
      const currentValues = snapshot?.context?.currentValues || {};
      return {
        target: target,
        context: {
          imageATexts: snapshot?.context?.imageATexts || "",
          imageBTexts: snapshot?.context?.imageBTexts || "",
          textPositions: snapshot?.context?.textPositions || {},
          currentValues: {
            same_font: currentValues.same_font || "",
            image_b_texts_removed: currentValues.image_b_texts_removed || "",
            other_changes: currentValues.other_changes || "",
          },
          route: snapshot?.context?.route || {},
        },
        images: Array.isArray(snapshot?.images)
          ? snapshot.images.map(function (item) {
              return {
                fieldName: item.fieldName,
                dataUrl: item.dataUrl || "",
                imageUrl: item.dataUrl ? "" : item.imageUrl || "",
                mime: item.mime || "unknown",
                width: item.width || 0,
                height: item.height || 0,
                bytes: item.bytes || 0,
              };
            })
          : [],
        debug: true,
      };
    }

    function extractPriceInput(snapshot, result) {
      const currentValues = snapshot?.context?.currentValues || {};
      return {
        imageATexts: snapshot?.context?.imageATexts || "",
        imageBTexts: snapshot?.context?.imageBTexts || "",
        sameFontValue: result?.same_font?.value || currentValues.same_font || "",
        imageBTextsRemovedValue:
          result?.image_b_texts_removed?.value || currentValues.image_b_texts_removed || "",
        otherChangesValue: result?.other_changes?.value || currentValues.other_changes || "",
      };
    }

    async function chooseSameFont(choice) {
      const normalized = normalizeLower(choice);
      if (normalized === "error" && typeof actions.selectFieldOption === "function") {
        return actions.selectFieldOption("same_font", "error", { ensureSelected: true });
      }
      if (normalized === "true" && typeof actions.selectSameFontTrue === "function") {
        return actions.selectSameFontTrue();
      }
      if (normalized === "false" && typeof actions.selectSameFontFalse === "function") {
        return actions.selectSameFontFalse();
      }
      if (
        normalized === "same underlying font+artistic effect" &&
        typeof actions.selectSameFontArtisticEffect === "function"
      ) {
        return actions.selectSameFontArtisticEffect();
      }
      if (typeof actions.selectFieldOption === "function") {
        return actions.selectFieldOption("same_font", normalized, { ensureSelected: true });
      }
      return { ok: false, message: "same_font 动作未就绪。" };
    }

    function chooseFieldOption(fieldName, option) {
      if (typeof actions.selectFieldOption !== "function") {
        return { ok: false, message: "字段选择动作未就绪。" };
      }
      return actions.selectFieldOption(fieldName, option, { ensureSelected: true });
    }

    function fillFieldText(fieldName, value) {
      if (typeof actions.fillFieldText !== "function") {
        return { ok: false, message: "文本填写动作未就绪。" };
      }
      return actions.fillFieldText(fieldName, value);
    }

    async function waitForFieldTextInput(fieldName, timeoutMs) {
      if (typeof actions.waitForFieldTextInput === "function") {
        return actions.waitForFieldTextInput(fieldName, timeoutMs);
      }
      await new Promise(function (resolve) {
        window.setTimeout(resolve, Math.max(100, Math.min(Number(timeoutMs) || 250, 300)));
      });
      return { ok: true, message: "已等待输入框渲染（fallback）。" };
    }

    function formatInputDiagnostic(diagnostic) {
      if (!diagnostic || typeof diagnostic !== "object") {
        return "";
      }
      return (
        "runtimeVersion=" +
        TASK21_ASSISTANT_RUNTIME_VERSION +
        "，domActionsVersion=" +
        getDomActionsVersion() +
        "，找到标题=" +
        String(Boolean(diagnostic.titleFound)) +
        "，找到字段容器=" +
        String(Boolean(diagnostic.fieldItemFound)) +
        "，custom-md-editor=" +
        String(Boolean(diagnostic.customMdEditorFound)) +
        "，monaco-container=" +
        String(Boolean(diagnostic.monacoContainerFound)) +
        "，monaco-editor=" +
        String(Boolean(diagnostic.monacoEditorFound)) +
        "，monacoDataUri=" +
        String(diagnostic.monacoDataUri || "-") +
        "，textarea.inputarea=" +
        String(Boolean(diagnostic.monacoTextareaFound)) +
        "，naive textarea=" +
        String(Boolean(diagnostic.naiveTextareaFound)) +
        "，view-lines=" +
        String(Boolean(diagnostic.viewLinesFound)) +
        "，viewLinesPreview=" +
        String(diagnostic.viewLinesPreview || "-") +
        "，候选数=" +
        String(Number(diagnostic.candidateCount || 0))
      );
    }

    async function applySingleSuggestion(suggestion) {
      if (!suggestion || suggestion.canFill !== true) {
        return { ok: false, message: "当前建议不支持填写。" };
      }
      if (suggestion.target === "same_font") {
        return chooseSameFont(suggestion.primaryChoice);
      }
      if (suggestion.target === "image_b_texts_removed") {
        const choice = normalizeLower(suggestion.primaryChoice);
        const selected = await chooseFieldOption("image_b_texts_removed", choice);
        if (!selected.ok) {
          return selected;
        }
        if (choice === "specify") {
          const waitResult = await waitForFieldTextInput(
            "image_b_texts_removed",
            FIELD_INPUT_WAIT_MS
          );
          if (!waitResult.ok) {
            const diagnosticText = formatInputDiagnostic(waitResult.diagnostic);
            return {
              ok: false,
              message:
                "已选择 image_b_texts_removed=specify，但未找到/未写入输入框：" +
                (diagnosticText ? "（" + diagnosticText + "）" : ""),
            };
          }
          const filled = fillFieldText("image_b_texts_removed", suggestion.answerText || "");
          if (!filled.ok) {
            const filledDiagnosticText = formatInputDiagnostic(filled.diagnostic);
            const monacoMatched =
              filled &&
              filled.diagnostic &&
              (filled.diagnostic.customMdEditorFound ||
                filled.diagnostic.monacoContainerFound ||
                filled.diagnostic.monacoEditorFound);
            return {
              ok: false,
              message:
                (monacoMatched
                  ? "已找到 Monaco 编辑器，但写入模型失败："
                  : "已选择 image_b_texts_removed=specify，但未找到/未写入输入框：") +
                String(filled.message || "未知错误") +
                (filledDiagnosticText ? "（" + filledDiagnosticText + "）" : ""),
            };
          }
          if (filled.warning) {
            return {
              ok: true,
              message:
                "已尝试填写 image_b_texts_removed=specify，但需要人工确认：" +
                String(filled.warning),
            };
          }
          return {
            ok: true,
            message: "已填写：image_b_texts_removed=specify",
          };
        }
        return selected;
      }
      if (suggestion.target === "other_changes") {
        const choice = normalizeLower(suggestion.primaryChoice);
        const selected = await chooseFieldOption("other_changes", choice);
        if (!selected.ok) {
          return selected;
        }
        if (choice === "specify") {
          const waitResult = await waitForFieldTextInput("other_changes", FIELD_INPUT_WAIT_MS);
          if (!waitResult.ok) {
            const diagnosticText = formatInputDiagnostic(waitResult.diagnostic);
            return {
              ok: false,
              message:
                "已选择 other_changes=specify，但未找到/未写入输入框：" +
                (diagnosticText ? "（" + diagnosticText + "）" : ""),
            };
          }
          const filled = fillFieldText("other_changes", suggestion.answerText || "");
          if (!filled.ok) {
            return {
              ok: false,
              message:
                "已选择 other_changes=specify，但文本写入失败：" +
                String(filled.message || "未知错误"),
            };
          }
          if (filled.warning) {
            return {
              ok: true,
              message:
                "已尝试填写 other_changes=specify，但需要人工确认：" +
                String(filled.warning),
            };
          }
          return {
            ok: true,
            message: "已填写：other_changes=specify",
          };
        }
        return selected;
      }
      return { ok: false, message: "未知字段，无法填写。" };
    }

    async function applySuggestions(display) {
      const suggestions = Array.isArray(display?.suggestions) ? display.suggestions : [];
      if (suggestions.length <= 0) {
        return { ok: false, message: "暂无可填写建议。" };
      }
      if (display.target !== "overall") {
        return applySingleSuggestion(suggestions[0]);
      }

      const messages = [];
      const sameFontSuggestion = suggestions.find(function (item) {
        return item.target === "same_font";
      });
      if (sameFontSuggestion) {
        const sameFontResult = await applySingleSuggestion(sameFontSuggestion);
        if (!sameFontResult.ok) {
          return sameFontResult;
        }
        messages.push("已填写：same_font=" + String(sameFontSuggestion.primaryChoice || ""));
        const sameFontChoice = normalizeLower(sameFontSuggestion.primaryChoice || "");
        if (sameFontChoice === "false" || sameFontChoice === "unsure" || sameFontChoice === "error") {
          return { ok: true, message: messages.join("；") };
        }
      }

      const removedSuggestion = suggestions.find(function (item) {
        return item.target === "image_b_texts_removed";
      });
      if (removedSuggestion && removedSuggestion.canFill) {
        const removedResult = await applySingleSuggestion(removedSuggestion);
        if (!removedResult.ok) {
          return removedResult;
        }
        messages.push(
          "已填写：image_b_texts_removed=" + String(removedSuggestion.primaryChoice || "")
        );
      }

      const otherSuggestion = suggestions.find(function (item) {
        return item.target === "other_changes";
      });
      if (otherSuggestion && otherSuggestion.canFill) {
        const otherResult = await applySingleSuggestion(otherSuggestion);
        if (!otherResult.ok) {
          return otherResult;
        }
        messages.push("已填写：other_changes=" + String(otherSuggestion.primaryChoice || ""));
      }

      return { ok: true, message: messages.length > 0 ? messages.join("；") : "已填写 AI 建议。" };
    }

    function attachDragHandlers(panel) {
      let dragging = false;
      let startMouseX = 0;
      let startMouseY = 0;
      let startLeft = 0;
      let startTop = 0;

      function onMouseMove(event) {
        if (!dragging) {
          return;
        }
        event.preventDefault();
        const deltaX = event.clientX - startMouseX;
        const deltaY = event.clientY - startMouseY;
        const rect = panel.root.getBoundingClientRect();
        applyPanelRect(
          panel,
          clampPanelRect(startLeft + deltaX, startTop + deltaY, rect.width, rect.height)
        );
      }

      function onMouseUp() {
        if (!dragging) {
          return;
        }
        dragging = false;
        panel.manualLayout = true;
        saveLayout(panel);
        document.removeEventListener("mousemove", onMouseMove, true);
        document.removeEventListener("mouseup", onMouseUp, true);
      }

      panel.head.addEventListener("mousedown", function (event) {
        const target = event.target;
        if (
          target instanceof Element &&
          target.closest("button,input,textarea,select,summary,details,a")
        ) {
          return;
        }
        event.preventDefault();
        const rect = panel.root.getBoundingClientRect();
        dragging = true;
        startMouseX = event.clientX;
        startMouseY = event.clientY;
        startLeft = rect.left;
        startTop = rect.top;
        document.addEventListener("mousemove", onMouseMove, true);
        document.addEventListener("mouseup", onMouseUp, true);
      });

      const resizeObserver = new ResizeObserver(function () {
        if (panel.root.style.display === "none") {
          return;
        }
        panel.manualLayout = true;
        saveLayout(panel);
      });
      resizeObserver.observe(panel.root);
      panel.resizeObserver = resizeObserver;
    }

    function ensurePanel(fieldKey) {
      let panel = panelByField[fieldKey] || null;
      if (panel && document.documentElement.contains(panel.root)) {
        return panel;
      }

      const root = document.createElement("section");
      root.className = PANEL_CLASS;
      root.style.display = "none";

      const head = document.createElement("div");
      head.className = "asc-panel-head";
      const headMain = document.createElement("div");
      headMain.className = "asc-head-main";
      const title = document.createElement("div");
      title.className = "asc-panel-title";
      title.textContent = "Task21助手";
      const sub = document.createElement("div");
      sub.className = "asc-panel-sub";
      sub.textContent =
        "AI 仅辅助建议；点击按钮才写入，不自动保存/提交。runtime=" +
        TASK21_ASSISTANT_RUNTIME_VERSION;
      headMain.appendChild(title);
      headMain.appendChild(sub);

      const headActions = document.createElement("div");
      headActions.className = "asc-head-actions";
      const resetButton = document.createElement("button");
      resetButton.type = "button";
      resetButton.className = "asc-panel-reset";
      resetButton.textContent = "重置位置";
      const closeButton = document.createElement("button");
      closeButton.type = "button";
      closeButton.className = "asc-panel-close";
      closeButton.textContent = "关闭";
      closeButton.addEventListener("click", function () {
        root.style.display = "none";
      });
      headActions.appendChild(resetButton);
      headActions.appendChild(closeButton);

      head.appendChild(headMain);
      head.appendChild(headActions);

      const body = document.createElement("div");
      body.className = "asc-panel-body";

      const status = document.createElement("div");
      status.className = "asc-status";
      status.textContent = "就绪";
      const meta = document.createElement("div");
      meta.className = "asc-meta";
      meta.textContent = "-";
      const fillStatus = document.createElement("div");
      fillStatus.className = "asc-fill-status";
      const results = document.createElement("div");
      results.className = "asc-result-list";

      const mainActions = document.createElement("div");
      mainActions.className = "asc-main-actions";
      const fillButton = document.createElement("button");
      fillButton.type = "button";
      fillButton.className = BUTTON_CLASS;
      fillButton.textContent = "填写 AI 答案";
      fillButton.disabled = true;
      const copyButton = document.createElement("button");
      copyButton.type = "button";
      copyButton.className = BUTTON_CLASS;
      copyButton.textContent = "复制建议";
      copyButton.disabled = true;
      mainActions.appendChild(fillButton);
      mainActions.appendChild(copyButton);

      const debugDetails = document.createElement("details");
      const debugSummary = document.createElement("summary");
      debugSummary.textContent = "调试信息";
      const debugText = document.createElement("pre");
      debugText.className = "asc-debug-text";
      debugText.textContent = "{}";
      debugDetails.appendChild(debugSummary);
      debugDetails.appendChild(debugText);

      const rawDetails = document.createElement("details");
      const rawSummary = document.createElement("summary");
      rawSummary.textContent = "原始 JSON（脱敏）";
      const rawText = document.createElement("pre");
      rawText.textContent = "{}";
      rawDetails.appendChild(rawSummary);
      rawDetails.appendChild(rawText);

      body.appendChild(status);
      body.appendChild(meta);
      body.appendChild(fillStatus);
      body.appendChild(results);
      body.appendChild(mainActions);
      body.appendChild(debugDetails);
      body.appendChild(rawDetails);
      root.appendChild(head);
      root.appendChild(body);
      (document.body || document.documentElement).appendChild(root);

      panel = {
        fieldKey: fieldKey,
        root: root,
        head: head,
        status: status,
        meta: meta,
        fillStatus: fillStatus,
        results: results,
        debugText: debugText,
        rawText: rawText,
        copyButton: copyButton,
        fillButton: fillButton,
        manualLayout: false,
        resizeObserver: null,
      };

      resetButton.addEventListener("click", function () {
        panel.manualLayout = false;
        clearLayout();
        updatePanelPosition(fieldKey);
      });

      copyButton.addEventListener("click", function () {
        const latest = latestByField[fieldKey];
        if (!latest) {
          return;
        }
        const copyText = buildShortCopyText(latest);
        if (!copyText) {
          showToast("暂无可复制建议", "warn");
          return;
        }
        if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
          navigator.clipboard
            .writeText(copyText)
            .then(function () {
              showToast("建议已复制", "success");
            })
            .catch(function () {
              showToast("复制失败", "warn");
            });
          return;
        }
        showToast("当前页面不支持剪贴板 API", "warn");
      });

      fillButton.addEventListener("click", async function () {
        const latest = latestByField[fieldKey];
        if (!latest) {
          return;
        }
        panel.fillStatus.textContent = "正在填写 AI 答案...";
        const result = await applySuggestions(latest);
        panel.fillStatus.textContent = normalizeText(result.message || "") || "填写完成。";
        showToast(panel.fillStatus.textContent, result.ok ? "success" : "warn");
      });

      attachDragHandlers(panel);
      panelByField[fieldKey] = panel;
      return panel;
    }

    function applyInitialPanelLayout(panel, fieldKey) {
      const saved = loadLayout();
      if (saved) {
        panel.manualLayout = true;
        applyPanelRect(panel, clampPanelRect(saved.left, saved.top, saved.width, saved.height));
        return;
      }
      panel.manualLayout = false;
      updatePanelPosition(fieldKey);
      if (!panel.root.style.left || !panel.root.style.top) {
        applyPanelRect(panel, clampPanelRect(20, 20, 520, 360));
      }
    }

    async function runAnalysis(target, options) {
      const runtimeOptions = options && typeof options === "object" ? options : {};
      const panelField = runtimeOptions.panelField || TARGET_TO_PANEL_FIELD[target] || "same_font";
      const fieldConfig = FIELD_CONFIGS[panelField];
      if (!fieldConfig) {
        return { ok: false, message: "未知分析目标。" };
      }
      if (runningByField[panelField] === true) {
        return { ok: false, message: "该板块正在分析中，请稍候。" };
      }
      if (typeof collector.collectTask21Payload !== "function") {
        return { ok: false, message: "data-collector 未就绪。" };
      }
      if (typeof client.analyze !== "function") {
        return { ok: false, message: "ai-client 未就绪。" };
      }

      const panel = ensurePanel(panelField);
      panel.root.style.display = "block";
      applyInitialPanelLayout(panel, panelField);
      setPanelLoading(panel, target);
      runningByField[panelField] = true;

      try {
        const snapshot = await collector.collectTask21Payload();
        updateInlineButtonState(snapshot);

        const states = getFieldStates(snapshot);
        if ((target === "same_font" || target === "overall") && !states.same_font) {
          const message = "未检测到 same_font 板块。";
          setPanelError(panel, message);
          return { ok: false, message: message };
        }
        if (target === "image_b_texts_removed" && !states.image_b_texts_removed) {
          const message = "未检测到 image_b_texts_removed 板块。";
          setPanelError(panel, message);
          return { ok: false, message: message };
        }
        if (target === "other_changes" && !states.other_changes) {
          const message = "未检测到 other_changes 板块。";
          setPanelError(panel, message);
          return { ok: false, message: message };
        }

        const startedAt = nowMs();
        const requestPayload = buildRequestPayload(snapshot, target);
        const response = await client.analyze(requestPayload, {
          settings: config.settings || null,
        });
        const body = response.data || {};
        const result = body.result || {};
        const requestDebug = response.requestDebug || {};
        const price =
          typeof pricing.estimateTask21Price === "function"
            ? pricing.estimateTask21Price(extractPriceInput(snapshot, result))
            : null;

        const display = {
          target: target,
          runtimeVersion: TASK21_ASSISTANT_RUNTIME_VERSION,
          domActionsVersion: getDomActionsVersion(),
          requestId: body.requestId || "",
          model: body.model || "",
          analysisMode:
            String(body.analysisMode || "") || String(requestDebug.analysisMode || "") || "two_stage",
          visionModel: String(body.visionModel || "") || String(requestDebug.visionModel || ""),
          ocrEnabled:
            body.ocrEnabled === true ||
            (body.ocrEnabled !== false && requestDebug.ocrEnabled === true),
          ocrModel: String(body.ocrModel || "") || String(requestDebug.ocrModel || ""),
          reasoningModel:
            String(body.reasoningModel || "") || String(requestDebug.reasoningModel || ""),
          singleModel: String(body.singleModel || "") || String(requestDebug.singleModel || ""),
          elapsedMs: Number(body.elapsedMs || nowMs() - startedAt),
          usage: Object.assign(
            {
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
              source: "unavailable",
            },
            body.usage || {}
          ),
          price: price,
          result: result,
          suggestions: buildDisplaySuggestions(target, result),
          warnings: Array.isArray(body.warnings) ? body.warnings : [],
          raw: {
            request: requestPayload,
            response: body,
          },
        };

        latestByField[panelField] = display;
        setPanelResult(panel, display);
        if (runtimeOptions.source !== "shortcut") {
          showToast("AI 分析完成：" + target, "success");
        }
        return { ok: true, message: "AI 分析完成：" + target };
      } catch (error) {
        const message = normalizeText(error && error.message ? error.message : "AI 分析失败。");
        setPanelError(panel, message);
        return { ok: false, message: message || "AI 分析失败。" };
      } finally {
        runningByField[panelField] = false;
        try {
          const snapshot = await collector.collectTask21Payload();
          updateInlineButtonState(snapshot);
        } catch (error) {
          updateInlineButtonState(null);
        }
      }
    }

    function ensureInlineButtons() {
      Object.keys(FIELD_CONFIGS).forEach(function (fieldKey) {
        const fieldConfig = FIELD_CONFIGS[fieldKey];
        const anchor = findFieldItemByTitle(fieldConfig.title);
        if (!anchor || !(anchor.item instanceof Element)) {
          if (!missingFieldLogged[fieldKey]) {
            console.info("[ASC][Abaka AI] 未检测到 " + fieldConfig.title + " 板块，跳过挂载。");
            missingFieldLogged[fieldKey] = true;
          }
          return;
        }

        const headerActions =
          anchor.item.querySelector(".l-header-actions") ||
          anchor.item.querySelector(".l-header") ||
          anchor.titleNode.parentElement;
        if (!(headerActions instanceof Element)) {
          return;
        }

        let wrap = headerActions.querySelector(
          "." + ACTIONS_WRAP_CLASS + "[data-asc-field='" + fieldKey + "']"
        );
        if (!wrap) {
          wrap = document.createElement("span");
          wrap.className = ACTIONS_WRAP_CLASS;
          wrap.setAttribute("data-asc-field", fieldKey);
          headerActions.appendChild(wrap);
        }

        fieldConfig.actionButtons.forEach(function (buttonConfig) {
          let button = wrap.querySelector("button[data-asc-action='" + buttonConfig.key + "']");
          if (!(button instanceof HTMLButtonElement)) {
            button = document.createElement("button");
            button.type = "button";
            button.className =
              BUTTON_CLASS + (buttonConfig.overall ? " " + BUTTON_OVERALL_CLASS : "");
            button.textContent = buttonConfig.label;
            button.setAttribute("data-asc-action", buttonConfig.key);
            button.addEventListener("click", function () {
              void runAnalysis(buttonConfig.target, {
                panelField: buttonConfig.panelField,
                source: "button",
              });
            });
            wrap.appendChild(button);
          }
          actionButtonByKey[buttonConfig.key] = {
            button: button,
            panelField: buttonConfig.panelField,
          };
        });
      });
    }

    function scheduleRefreshMount() {
      if (refreshTimer) {
        return;
      }
      refreshTimer = window.setTimeout(function () {
        refreshTimer = null;
        ensureInlineButtons();
        updateAllPanelPositions();
        if (typeof collector.collectTask21Payload === "function") {
          collector
            .collectTask21Payload()
            .then(function (snapshot) {
              updateInlineButtonState(snapshot);
            })
            .catch(function () {
              updateInlineButtonState(null);
            });
        }
      }, 160);
    }

    function startObservers() {
      if (mutationObserver) {
        return;
      }
      mutationObserver = new MutationObserver(function () {
        scheduleRefreshMount();
      });
      mutationObserver.observe(document.documentElement || document.body, {
        childList: true,
        subtree: true,
      });
      window.addEventListener("resize", updateAllPanelPositions, true);
      window.addEventListener("scroll", updateAllPanelPositions, true);
    }

    function stopObservers() {
      if (mutationObserver) {
        mutationObserver.disconnect();
        mutationObserver = null;
      }
      window.removeEventListener("resize", updateAllPanelPositions, true);
      window.removeEventListener("scroll", updateAllPanelPositions, true);
      if (refreshTimer) {
        window.clearTimeout(refreshTimer);
        refreshTimer = null;
      }
    }

    function isEligiblePage() {
      if (typeof collector.isItemsPage === "function") {
        return collector.isItemsPage() === true;
      }
      return String(location.pathname || "").indexOf("/items") >= 0;
    }

    function start() {
      if (started) {
        return { ok: true, message: "AI inline runtime already started." };
      }
      if (!isEligiblePage()) {
        return { ok: false, message: "当前不是 /items 页面，跳过 AI 内联按钮挂载。" };
      }
      ensureStyle();
      ensureInlineButtons();
      startObservers();
      started = true;
      if (typeof collector.collectTask21Payload === "function") {
        collector
          .collectTask21Payload()
          .then(function (snapshot) {
            updateInlineButtonState(snapshot);
          })
          .catch(function () {
            updateInlineButtonState(null);
          });
      }
      return { ok: true, message: "AI inline runtime started." };
    }

    function remove() {
      stopObservers();
      Object.keys(panelByField).forEach(function (fieldKey) {
        const panel = panelByField[fieldKey];
        if (panel && panel.resizeObserver && typeof panel.resizeObserver.disconnect === "function") {
          panel.resizeObserver.disconnect();
        }
        if (panel && panel.root && panel.root.parentElement) {
          panel.root.parentElement.removeChild(panel.root);
        }
        delete panelByField[fieldKey];
      });
      const wraps = document.querySelectorAll("." + ACTIONS_WRAP_CLASS);
      wraps.forEach(function (node) {
        if (node && node.parentElement) {
          node.parentElement.removeChild(node);
        }
      });
      Object.keys(actionButtonByKey).forEach(function (key) {
        delete actionButtonByKey[key];
      });
      started = false;
    }

    return {
      version: TASK21_ASSISTANT_RUNTIME_VERSION,
      start: start,
      remove: remove,
      runAnalysis: runAnalysis,
      refreshState: function () {
        ensureInlineButtons();
        updateAllPanelPositions();
      },
      getLatest: function (fieldKey) {
        return latestByField[fieldKey || "same_font"] || null;
      },
    };
  }

  globalThis.__ASCEdgeAbakaAiTask21AiPanel = {
    runtimeVersion: TASK21_ASSISTANT_RUNTIME_VERSION,
    createRuntime: createRuntime,
  };
})();

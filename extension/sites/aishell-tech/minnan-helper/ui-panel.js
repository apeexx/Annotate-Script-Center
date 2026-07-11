(function () {
  if (globalThis.__ASREdgeAishellTechMinnanUiPanelInstalled === true) {
    return;
  }
  globalThis.__ASREdgeAishellTechMinnanUiPanelInstalled = true;

  const ROOT_ATTR = "data-asr-edge-aishell-tech-panel";
  const STYLE_ID = "asr-edge-aishell-tech-panel-style";
  const errorDisplay = globalThis.ASREdgeAiErrorDisplay || {};
  const aiBatchSummary =
    globalThis.ASREdgeAiBatchSummary ||
    (typeof module !== "undefined" && module.exports
      ? require("../../../shared/ai-batch-summary.js")
      : {});
  const buildAiErrorDisplay =
    typeof errorDisplay.buildAiErrorDisplay === "function"
      ? errorDisplay.buildAiErrorDisplay
      : function (input) {
          const source = input && typeof input === "object" ? input : {};
          return {
            summary: String(source.message || ""),
            rawJson:
              source.rawResponse && typeof source.rawResponse === "object" ? source.rawResponse : {},
          };
        };
  const buildBatchSummaryRows =
    typeof aiBatchSummary.buildBatchSummaryRows === "function"
      ? aiBatchSummary.buildBatchSummaryRows
      : function () {
          return [];
        };

  function buildBatchRows(snapshot) {
    const source = snapshot && typeof snapshot === "object" ? snapshot : {};
    const rows = [
      ["阶段", source.phaseText || "-"],
      ["总数", Number(source.total || 0)],
      ["已完成", Number(source.completed || 0)],
      ["失败", Number(source.failed || 0)],
      ["当前条", source.currentText || "-"],
    ];

    if (source.frontConcurrency !== undefined) {
      rows.push(["前端并发", Number(source.frontConcurrency || 0)]);
    }
    if (source.requestStaggerMs !== undefined) {
      rows.push(["发送间隔", String(Number(source.requestStaggerMs || 0)) + "ms"]);
    }
    if (source.launchedCount !== undefined) {
      rows.push(["已发请求", Number(source.launchedCount || 0)]);
    }
    if (source.activeAiCount !== undefined) {
      rows.push(["AI处理中", Number(source.activeAiCount || 0)]);
    }
    if (source.completedAiCount !== undefined) {
      rows.push(["AI已返回", Number(source.completedAiCount || 0)]);
    }
    if (source.bufferedCount !== undefined) {
      rows.push(["待保存队列", Number(source.bufferedCount || 0)]);
    }
    return rows.concat(buildBatchSummaryRows(source));
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      "[" + ROOT_ATTR + "] {",
      "  position: relative;",
      "  width: 100%;",
      "  margin-top: 16px;",
      "  padding: 14px;",
      "  overflow: auto;",
      "  border: 1px solid #bfdbfe;",
      "  border-radius: 12px;",
      "  background: #f8fbff;",
      "  color: #1f2937;",
      "  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);",
      "  font-size: 12px;",
      "  line-height: 1.6;",
      "}",
      "[" + ROOT_ATTR + "] * { box-sizing: border-box; }",
      "[" + ROOT_ATTR + "] .asc-status { margin-top: 12px; color: #475569; white-space: pre-wrap; }",
      "[" + ROOT_ATTR + "] .asc-status[data-tone='success'] { color: #047857; }",
      "[" + ROOT_ATTR + "] .asc-status[data-tone='error'] { color: #b91c1c; }",
      "[" + ROOT_ATTR + "] .asc-status[data-tone='warning'] { color: #b45309; }",
      "[" + ROOT_ATTR + "] .asc-section { margin-top: 12px; border-top: 1px solid #dbeafe; padding-top: 12px; }",
      "[" + ROOT_ATTR + "] .asc-section-title { display: flex; align-items: center; font-size: 14px; font-weight: 700; color: #1d4ed8; margin-bottom: 8px; }",
      "[" + ROOT_ATTR + "] .asc-grid { display: grid; grid-template-columns: 88px minmax(0, 1fr); gap: 6px 8px; }",
      "[" + ROOT_ATTR + "] .asc-label { color: #475569; font-weight: 700; }",
      "[" + ROOT_ATTR + "] .asc-value { white-space: pre-wrap; overflow-wrap: anywhere; }",
      "[" + ROOT_ATTR + "] .asc-failures { margin: 8px 0 0 16px; padding: 0; }",
      "[" + ROOT_ATTR + "] .asc-failures li { margin-bottom: 6px; color: #b91c1c; }",
      "[" + ROOT_ATTR + "] .asc-result-row { display: flex; align-items: center; gap: 8px; margin-top: 10px; }",
      "[" + ROOT_ATTR + "] .asc-result-label { flex-shrink: 0; font-weight: 700; color: #475569; }",
      "[" + ROOT_ATTR + "] .asc-result-content { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }",
      "[" + ROOT_ATTR + "] .asc-result-text-box { flex: 1; min-height: 32px; max-height: 80px; overflow-y: auto; padding: 6px 12px; border: 1px solid #cbd5e1; border-radius: 8px; background: #ffffff; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 12px; display: flex; align-items: center; }",
      "[" + ROOT_ATTR + "] .asc-toggle-bar { display: flex; justify-content: center; margin-top: 12px; border-top: 1px solid #dbeafe; padding-top: 8px; }",
      "[" + ROOT_ATTR + "] .asc-toggle-btn { background: none; border: none; color: #1d4ed8; cursor: pointer; font-weight: 700; font-size: 11px; min-height: 20px; padding: 0; }",
      "[" + ROOT_ATTR + "] .asc-error-json { background: #fee2e2; border: 1px solid #fca5a5; color: #991b1b; padding: 10px; border-radius: 8px; font-family: monospace; font-size: 11px; overflow: auto; margin-top: 10px; white-space: pre-wrap; max-height: 200px; }",
      "[" + ROOT_ATTR + "] .asc-failure-item-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }",
      "[" + ROOT_ATTR + "] .asc-failure-item-text { flex: 1; min-width: 0; }",
      "[" + ROOT_ATTR + "] .asc-failure-actions { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; }",
      "[" + ROOT_ATTR + "] .asc-link-btn { border: none; background: none; padding: 0; color: #1d4ed8; cursor: pointer; font-size: 11px; font-weight: 700; }",
      "[" + ROOT_ATTR + "] .asc-failure-detail { margin-top: 8px; padding: 8px 10px; border: 1px solid #dbeafe; border-radius: 8px; background: #ffffff; color: #334155; }",
      "[" + ROOT_ATTR + "] .asc-failure-raw { margin-top: 8px; max-height: 220px; overflow: auto; padding: 8px 10px; border-radius: 8px; background: #0f172a; color: #e2e8f0; font-family: monospace; font-size: 11px; white-space: pre-wrap; }",
      "[" + ROOT_ATTR + "] .asc-diff-card { margin-top: 12px; padding: 10px; border: 1px solid #dbeafe; border-radius: 10px; background: #ffffff; }",
      "[" + ROOT_ATTR + "] .asc-diff-title { font-weight: 700; color: #1d4ed8; margin-bottom: 8px; }",
      "[" + ROOT_ATTR + "] .asc-diff-row { display: grid; grid-template-columns: 88px minmax(0, 1fr); gap: 8px; align-items: start; }",
      "[" + ROOT_ATTR + "] .asc-diff-row + .asc-diff-row { margin-top: 8px; }",
      "[" + ROOT_ATTR + "] .asc-diff-text { min-height: 32px; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: #f8fafc; white-space: pre-wrap; overflow-wrap: anywhere; }",
      "[" + ROOT_ATTR + "] .asc-diff-char--heard { background: #fef3c7; color: #92400e; border-radius: 4px; padding: 0 1px; }",
      "[" + ROOT_ATTR + "] .asc-diff-char--candidate { background: #dbeafe; color: #1d4ed8; border-radius: 4px; padding: 0 1px; }",
      "[" + ROOT_ATTR + "] .asc-diff-empty { color: #64748b; font-style: italic; }",
    ].join("\n");
    (document.head || document.documentElement).appendChild(style);
  }

  function createButton(text, attrs) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    Object.keys(attrs || {}).forEach(function (key) {
      button.setAttribute(key, attrs[key]);
    });
    return button;
  }

  function copyText(text) {
    const value = String(text || "");
    if (!value) {
      return Promise.reject(new Error("没有可复制的文本。"));
    }
    if (navigator.clipboard?.writeText) {
      return navigator.clipboard.writeText(value);
    }
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "readonly");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    textarea.remove();
    if (!ok) {
      return Promise.reject(new Error("浏览器未允许复制。"));
    }
    return Promise.resolve();
  }

  function normalizeCompareText(text) {
    return String(text || "").replace(/[\s\u3000]+/g, "").trim();
  }

  function sanitizeButtonClassName(className, fallback) {
    const tokens = String(className || "")
      .split(/\s+/)
      .map(function (token) {
        return String(token || "").trim();
      })
      .filter(function (token) {
        return token && token !== "is-disabled";
      });
    if (tokens.length > 0) {
      return Array.from(new Set(tokens)).join(" ");
    }
    return String(fallback || "el-button");
  }

  function syncButtonDisabledState(button, disabled) {
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }
    button.disabled = disabled === true;
    if (disabled === true) {
      button.setAttribute("aria-disabled", "true");
      button.classList.add("is-disabled");
    } else {
      button.removeAttribute("disabled");
      button.setAttribute("aria-disabled", "false");
      button.classList.remove("is-disabled");
      button.style.pointerEvents = "auto";
    }
  }

  function createRuntime(options) {
    const deps = options && typeof options === "object" ? options : {};
    const diagnosticsFactory = globalThis.__ASREdgeAishellTechMinnanDiagnostics || {};
    const buildCurrentResultDiagnostics =
      typeof diagnosticsFactory.buildCurrentResultDiagnostics === "function"
        ? diagnosticsFactory.buildCurrentResultDiagnostics
        : function () {
            return { rows: [] };
          };
    let root = null;
    let statusNode = null;
    let resultNode = null;
    let batchNode = null;
    let singleButtonNode = null;
    let batchAllButtonNode = null;
    let batchPendingButtonNode = null;
    let stopButtonNode = null;
    let currentItemKey = "";
    let currentResult = null;
    let isExpanded = false;
    let advancedSectionNode = null;
    let toggleBtnNode = null;
    let recommendTextDisplay = null;
    let fillRecommendBtn = null;
    let errorJsonNode = null;
    let currentBusyState = {
      single: false,
      batch: false,
    };

    function getContainerAnchor() {
      const form = document.querySelector(".mark-area form.el-form");
      return form || document.querySelector(".mark-area");
    }

    function getNativeBatchButtonContainer() {
      const buttons = Array.from(document.querySelectorAll("button"));
      const target = buttons.find(function (button) {
        const text = String(button.textContent || "");
        return text.indexOf("删除音频标点") >= 0 || text.indexOf("查看历史标注记录") >= 0;
      });
      return target ? target.parentNode : null;
    }

    function getNativeSaveButton() {
      const buttons = Array.from(
        document.querySelectorAll(".mark-area button.el-button--primary")
      );
      return buttons.find(function (button) {
        return String(button.textContent || "").indexOf("保存") >= 0;
      }) || null;
    }

    function getScopedDataAttrs(element) {
      const attrs = {};
      if (!element) {
        return attrs;
      }
      Array.from(element.attributes || []).forEach(function (attr) {
        if (attr.name.indexOf("data-v-") === 0) {
          attrs[attr.name] = attr.value;
        }
      });
      return attrs;
    }

    function applyScopedAttrs(element, attrs) {
      Object.keys(attrs || {}).forEach(function (key) {
        element.setAttribute(key, attrs[key]);
      });
    }

    function syncLayoutVisibility() {
      if (advancedSectionNode) {
        advancedSectionNode.style.display = isExpanded ? "block" : "none";
      }
      if (toggleBtnNode) {
        toggleBtnNode.textContent = isExpanded ? "收起详细信息" : "查看详细信息";
      }
    }

    function requireCurrentResult() {
      if (!currentResult || typeof currentResult !== "object") {
        throw new Error("当前没有可操作的识别结果。");
      }
      return currentResult;
    }

    function copyCurrentHeardText() {
      const result = requireCurrentResult();
      return copyText(result.heardText || "").then(function () {
        setStatus("听音文本已复制。", "success");
        return { ok: true };
      });
    }

    function copyCurrentRecommendedText() {
      const result = requireCurrentResult();
      return copyText(result.recommendedText || "").then(function () {
        setStatus("推荐文本已复制。", "success");
        return { ok: true };
      });
    }

    function fillCurrentRecommendedText() {
      const result = requireCurrentResult();
      if (typeof deps.fillAndSaveCurrent !== "function") {
        return Promise.reject(new Error("当前运行时没有填入并保存能力。"));
      }
      setStatus("正在填入并保存当前条...", "info");
      return Promise.resolve(deps.fillAndSaveCurrent(result.recommendedText || "")).then(
        function (fillResult) {
          setStatus(
            fillResult?.message || "已填入并保存当前条。",
            fillResult?.ok === false ? "error" : "success"
          );
          return fillResult;
        }
      );
    }

    function ignoreCurrentResult() {
      clearResult();
      setStatus("已忽略本次识别结果。", "info");
      return { ok: true };
    }

    function ensureRoot() {
      ensureStyle();
      const anchor = getContainerAnchor();
      if (root && document.documentElement.contains(root)) {
        if (anchor && root.parentNode !== anchor && root.previousSibling !== anchor) {
          if (anchor.tagName === "FORM") {
            anchor.insertAdjacentElement("afterend", root);
          } else {
            anchor.appendChild(root);
          }
        }
        syncLayoutVisibility();
        syncInjectedButtons();
        return root;
      }

      root = document.createElement("div");
      root.setAttribute(ROOT_ATTR, "true");

      const resultsSection = document.createElement("div");
      resultsSection.className = "asc-section";
      resultsSection.style.marginTop = "0";
      resultsSection.style.borderTop = "none";
      resultsSection.style.paddingTop = "0";

      const resultsTitle = document.createElement("div");
      resultsTitle.className = "asc-section-title";
      resultsTitle.textContent = "希尔贝壳闽南语推荐";
      resultsSection.appendChild(resultsTitle);

      const recommendRow = document.createElement("div");
      recommendRow.className = "asc-result-row";

      const recommendLabel = document.createElement("div");
      recommendLabel.className = "asc-result-label";
      recommendLabel.textContent = "AI推荐文本";
      recommendRow.appendChild(recommendLabel);

      const recommendContent = document.createElement("div");
      recommendContent.className = "asc-result-content";

      recommendTextDisplay = document.createElement("div");
      recommendTextDisplay.className = "asc-result-text-box";
      recommendTextDisplay.style.backgroundColor = "#f0fdf4";
      recommendTextDisplay.style.borderColor = "#bbf7d0";
      recommendTextDisplay.style.color = "#166534";
      recommendTextDisplay.style.fontWeight = "700";
      recommendTextDisplay.textContent = "暂无 AI 推荐";
      recommendContent.appendChild(recommendTextDisplay);

      fillRecommendBtn = createButton("填入并保存", {
        "data-primary": "true",
      });
      fillRecommendBtn.disabled = true;
      fillRecommendBtn.style.padding = "0 14px";
      fillRecommendBtn.addEventListener("click", function () {
        fillCurrentRecommendedText().catch(function (error) {
          setStatus(error?.message || String(error), "error");
        });
      });
      recommendContent.appendChild(fillRecommendBtn);

      recommendRow.appendChild(recommendContent);
      resultsSection.appendChild(recommendRow);

      statusNode = document.createElement("div");
      statusNode.className = "asc-status";
      statusNode.textContent = "等待进入标注页并点击“AI识别”或批量识别按钮。";
      resultsSection.appendChild(statusNode);
      root.appendChild(resultsSection);

      advancedSectionNode = document.createElement("div");
      advancedSectionNode.style.marginTop = "12px";
      advancedSectionNode.style.borderTop = "1px dashed #dbeafe";
      advancedSectionNode.style.paddingTop = "12px";
      root.appendChild(advancedSectionNode);

      const toggleBar = document.createElement("div");
      toggleBar.className = "asc-toggle-bar";
      toggleBtnNode = document.createElement("button");
      toggleBtnNode.type = "button";
      toggleBtnNode.className = "asc-toggle-btn";
      toggleBtnNode.textContent = "查看详细信息";
      toggleBtnNode.addEventListener("click", function () {
        isExpanded = !isExpanded;
        syncLayoutVisibility();
      });
      toggleBar.appendChild(toggleBtnNode);
      root.appendChild(toggleBar);

      if (anchor) {
        if (anchor.tagName === "FORM") {
          anchor.insertAdjacentElement("afterend", root);
        } else {
          anchor.appendChild(root);
        }
      }

      syncLayoutVisibility();
      syncInjectedButtons();
      return root;
    }

    function renderKeyValueRows(container, rows) {
      const grid = document.createElement("div");
      grid.className = "asc-grid";
      rows.forEach(function (row) {
        const labelNode = document.createElement("div");
        labelNode.className = "asc-label";
        labelNode.textContent = row[0];
        const valueNode = document.createElement("div");
        valueNode.className = "asc-value";
        valueNode.textContent = String(row[1] || "");
        grid.appendChild(labelNode);
        grid.appendChild(valueNode);
      });
      container.appendChild(grid);
    }

    function pushDiffPart(parts, text, type) {
      const value = String(text || "");
      if (!value) {
        return;
      }
      const last = parts[parts.length - 1];
      if (last && last.type === type) {
        last.text += value;
        return;
      }
      parts.push({
        type: type,
        text: value,
      });
    }

    function buildTextDiffState(leftText, rightText) {
      const leftChars = Array.from(String(leftText || ""));
      const rightChars = Array.from(String(rightText || ""));
      const dp = Array.from({ length: leftChars.length + 1 }, function () {
        return new Array(rightChars.length + 1).fill(0);
      });

      for (let leftIndex = leftChars.length - 1; leftIndex >= 0; leftIndex -= 1) {
        for (let rightIndex = rightChars.length - 1; rightIndex >= 0; rightIndex -= 1) {
          dp[leftIndex][rightIndex] =
            leftChars[leftIndex] === rightChars[rightIndex]
              ? dp[leftIndex + 1][rightIndex + 1] + 1
              : Math.max(dp[leftIndex + 1][rightIndex], dp[leftIndex][rightIndex + 1]);
        }
      }

      const leftParts = [];
      const rightParts = [];
      let leftIndex = 0;
      let rightIndex = 0;
      let hasDiff = false;

      while (leftIndex < leftChars.length && rightIndex < rightChars.length) {
        if (leftChars[leftIndex] === rightChars[rightIndex]) {
          pushDiffPart(leftParts, leftChars[leftIndex], "same");
          pushDiffPart(rightParts, rightChars[rightIndex], "same");
          leftIndex += 1;
          rightIndex += 1;
          continue;
        }
        hasDiff = true;
        if (dp[leftIndex + 1][rightIndex] >= dp[leftIndex][rightIndex + 1]) {
          pushDiffPart(leftParts, leftChars[leftIndex], "diff");
          leftIndex += 1;
        } else {
          pushDiffPart(rightParts, rightChars[rightIndex], "diff");
          rightIndex += 1;
        }
      }

      while (leftIndex < leftChars.length) {
        hasDiff = true;
        pushDiffPart(leftParts, leftChars[leftIndex], "diff");
        leftIndex += 1;
      }
      while (rightIndex < rightChars.length) {
        hasDiff = true;
        pushDiffPart(rightParts, rightChars[rightIndex], "diff");
        rightIndex += 1;
      }

      return {
        hasDiff: hasDiff,
        leftParts: leftParts,
        rightParts: rightParts,
      };
    }

    function renderDiffText(textNode, parts, diffClassName) {
      textNode.textContent = "";
      if (!Array.isArray(parts) || parts.length === 0) {
        textNode.textContent = "";
        return;
      }
      parts.forEach(function (part) {
        const span = document.createElement("span");
        span.textContent = part.text;
        if (part.type === "diff") {
          span.className = diffClassName;
        }
        textNode.appendChild(span);
      });
    }

    function renderTextDiffSection(container, heardText, convertedText) {
      const diffState = buildTextDiffState(heardText, convertedText);
      const section = document.createElement("div");
      section.className = "asc-diff-card";

      const title = document.createElement("div");
      title.className = "asc-diff-title";
      title.textContent = "听音文本与转换文本差异";
      section.appendChild(title);

      if (!diffState.hasDiff) {
        const empty = document.createElement("div");
        empty.className = "asc-diff-empty";
        empty.textContent = "听音文本与转换文本一致。";
        section.appendChild(empty);
        container.appendChild(section);
        return;
      }

      [
        {
          label: "听音文本",
          parts: diffState.leftParts,
          diffClassName: "asc-diff-char--heard",
        },
        {
          label: "转换文本",
          parts: diffState.rightParts,
          diffClassName: "asc-diff-char--candidate",
        },
      ].forEach(function (item) {
        const row = document.createElement("div");
        row.className = "asc-diff-row";
        const label = document.createElement("div");
        label.className = "asc-label";
        label.textContent = item.label;
        const text = document.createElement("div");
        text.className = "asc-diff-text";
        renderDiffText(text, item.parts, item.diffClassName);
        row.appendChild(label);
        row.appendChild(text);
        section.appendChild(row);
      });

      container.appendChild(section);
    }

    function clearErrorJson() {
      if (errorJsonNode) {
        errorJsonNode.remove();
        errorJsonNode = null;
      }
    }

    function clearResult() {
      currentResult = null;
      if (resultNode) {
        resultNode.remove();
      }
      resultNode = null;
      clearErrorJson();
      if (recommendTextDisplay) {
        recommendTextDisplay.textContent = "暂无 AI 推荐";
        recommendTextDisplay.style.backgroundColor = "#f0fdf4";
        recommendTextDisplay.style.borderColor = "#bbf7d0";
        recommendTextDisplay.style.color = "#166534";
        recommendTextDisplay.style.fontStyle = "normal";
        recommendTextDisplay.style.fontWeight = "700";
      }
      if (fillRecommendBtn) {
        fillRecommendBtn.disabled = true;
      }
    }

    function clearBatch() {
      if (batchNode) {
        batchNode.remove();
      }
      batchNode = null;
    }

    function setStatus(message, tone, rawResponse) {
      ensureRoot();
      if (!statusNode) {
        return;
      }
      const displayError =
        tone === "error" && rawResponse && typeof rawResponse === "object"
          ? buildAiErrorDisplay({
              message: message,
              rawResponse: rawResponse,
            })
          : null;
      statusNode.textContent = String(displayError?.summary || message || "");
      statusNode.setAttribute("data-tone", String(tone || "info"));
      clearErrorJson();
      if (tone === "error" && rawResponse && typeof rawResponse === "object") {
        errorJsonNode = document.createElement("pre");
        errorJsonNode.className = "asc-error-json";
        errorJsonNode.textContent = JSON.stringify(displayError?.rawJson || rawResponse, null, 2);
        statusNode.parentNode.insertBefore(errorJsonNode, statusNode.nextSibling);
        isExpanded = true;
        syncLayoutVisibility();
      }
    }

    function setBusy(state) {
      const nextState = state && typeof state === "object" ? state : {};
      currentBusyState = Object.assign({}, nextState);
      ensureRoot();
      if (singleButtonNode) {
        syncButtonDisabledState(
          singleButtonNode,
          nextState.single === true || nextState.batch === true
        );
      }
      if (batchAllButtonNode) {
        syncButtonDisabledState(
          batchAllButtonNode,
          nextState.batch === true || nextState.single === true
        );
        batchAllButtonNode.style.color = batchAllButtonNode.disabled ? "#94a3b8" : "#1d4ed8";
      }
      if (batchPendingButtonNode) {
        syncButtonDisabledState(
          batchPendingButtonNode,
          nextState.batch === true || nextState.single === true
        );
        batchPendingButtonNode.style.color = batchPendingButtonNode.disabled ? "#94a3b8" : "#1d4ed8";
      }
      if (stopButtonNode) {
        syncButtonDisabledState(stopButtonNode, nextState.batch !== true);
        stopButtonNode.style.color = stopButtonNode.disabled ? "#94a3b8" : "#dc2626";
        stopButtonNode.style.fontWeight = stopButtonNode.disabled ? "400" : "700";
      }
      if (fillRecommendBtn) {
        fillRecommendBtn.disabled =
          nextState.single === true ||
          nextState.batch === true ||
          !currentResult ||
          !String(currentResult.recommendedText || "");
      }
    }

    function syncInjectedButtons() {
      syncSingleButton();
      syncBatchButtons();
    }

    function syncSingleButton() {
      const saveButton = getNativeSaveButton();
      if (!saveButton || !saveButton.parentNode) {
        return;
      }
      if (
        singleButtonNode &&
        document.documentElement.contains(singleButtonNode) &&
        singleButtonNode.parentNode === saveButton.parentNode
      ) {
        return;
      }
      if (singleButtonNode) {
        singleButtonNode.remove();
      }
      const scopedAttrs = getScopedDataAttrs(saveButton);
      singleButtonNode = document.createElement("button");
      singleButtonNode.type = "button";
      singleButtonNode.className = sanitizeButtonClassName(
        saveButton.className,
        "el-button el-button--primary"
      );
      applyScopedAttrs(singleButtonNode, scopedAttrs);
      singleButtonNode.setAttribute("data-asc-injected-single", "true");
      singleButtonNode.style.marginLeft = "12px";
      singleButtonNode.style.pointerEvents = "auto";
      const label = document.createElement("span");
      applyScopedAttrs(label, scopedAttrs);
      label.textContent = "AI识别";
      singleButtonNode.appendChild(label);
      singleButtonNode.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        if (typeof deps.onRecommend === "function") {
          void deps.onRecommend();
        }
      });
      saveButton.insertAdjacentElement("afterend", singleButtonNode);
      setBusy(currentBusyState);
    }

    function syncBatchButtons() {
      const container = getNativeBatchButtonContainer();
      if (!container) {
        return;
      }
      if (
        batchAllButtonNode &&
        batchPendingButtonNode &&
        stopButtonNode &&
        document.documentElement.contains(batchAllButtonNode) &&
        document.documentElement.contains(batchPendingButtonNode) &&
        document.documentElement.contains(stopButtonNode)
      ) {
        return;
      }
      if (batchAllButtonNode) {
        batchAllButtonNode.remove();
      }
      if (batchPendingButtonNode) {
        batchPendingButtonNode.remove();
      }
      if (stopButtonNode) {
        stopButtonNode.remove();
      }
      const scopedAttrs = getScopedDataAttrs(container);
      const referenceButton = Array.from(container.children).find(function (child) {
        if (!(child instanceof HTMLButtonElement)) {
          return false;
        }
        const text = String(child.textContent || "");
        return text.indexOf("删除音频标点") >= 0 || text.indexOf("查看历史标注记录") >= 0;
      });

      function createToolbarButton(text, attrName, onClick) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "el-button el-button--text el-button--small";
        button.setAttribute(attrName, "true");
        applyScopedAttrs(button, scopedAttrs);
        button.style.marginRight = "12px";
        button.style.color = "#1d4ed8";
        button.style.fontWeight = "700";
        button.style.pointerEvents = "auto";
        const label = document.createElement("span");
        applyScopedAttrs(label, scopedAttrs);
        label.textContent = text;
        button.appendChild(label);
        button.addEventListener("click", function (event) {
          event.preventDefault();
          event.stopPropagation();
          if (typeof onClick === "function") {
            void onClick();
          }
        });
        return button;
      }

      batchAllButtonNode = createToolbarButton(
        "全部AI批量识别",
        "data-asc-injected-batch-all",
        function () {
          if (typeof deps.onBatchRecommendAll === "function") {
            return deps.onBatchRecommendAll();
          }
          return null;
        }
      );
      batchPendingButtonNode = createToolbarButton(
        "未完成的AI批量识别",
        "data-asc-injected-batch-pending",
        function () {
          if (typeof deps.onBatchRecommendPending === "function") {
            return deps.onBatchRecommendPending();
          }
          return null;
        }
      );

      stopButtonNode = document.createElement("button");
      stopButtonNode.type = "button";
      stopButtonNode.className = "el-button el-button--text el-button--small";
      stopButtonNode.setAttribute("data-asc-injected-stop", "true");
      applyScopedAttrs(stopButtonNode, scopedAttrs);
      stopButtonNode.style.marginRight = "12px";
      stopButtonNode.style.color = "#94a3b8";
      stopButtonNode.style.pointerEvents = "auto";
      const stopLabel = document.createElement("span");
      applyScopedAttrs(stopLabel, scopedAttrs);
      stopLabel.textContent = "停止批量";
      stopButtonNode.appendChild(stopLabel);
      stopButtonNode.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        if (typeof deps.onBatchStop === "function") {
          void deps.onBatchStop();
        }
      });

      if (referenceButton) {
        container.insertBefore(stopButtonNode, referenceButton);
        container.insertBefore(batchPendingButtonNode, stopButtonNode);
        container.insertBefore(batchAllButtonNode, batchPendingButtonNode);
      } else {
        container.appendChild(batchAllButtonNode);
        container.appendChild(batchPendingButtonNode);
        container.appendChild(stopButtonNode);
      }
      setBusy(currentBusyState);
    }

    function renderResult(result) {
      const source = result && typeof result === "object" ? result : null;
      ensureRoot();
      clearResult();
      if (!source) {
        return;
      }
      currentResult = source;

      const recommendedText = String(source.recommendedText || "");
      const referenceText = String(source.referenceText || "");
      const candidateText = String(
        source.convertedText ||
          source.meta?.audioFirstReference?.convertedText ||
          source.meta?.audioFirstReference?.candidateText ||
          source.audioFirstReference?.convertedText ||
          source.audioFirstReference?.candidateText ||
          source.lexiconCandidateText ||
          ""
      );
      const heardText = String(source.heardText || "");
      const showNoChange =
        recommendedText &&
        normalizeCompareText(recommendedText) === normalizeCompareText(referenceText);
      if (recommendTextDisplay) {
        if (showNoChange) {
          recommendTextDisplay.textContent = "无需修改";
          recommendTextDisplay.style.backgroundColor = "#f1f5f9";
          recommendTextDisplay.style.borderColor = "#cbd5e1";
          recommendTextDisplay.style.color = "#64748b";
          recommendTextDisplay.style.fontStyle = "italic";
          recommendTextDisplay.style.fontWeight = "400";
        } else {
          recommendTextDisplay.textContent = recommendedText || "暂无 AI 推荐";
          recommendTextDisplay.style.backgroundColor = "#f0fdf4";
          recommendTextDisplay.style.borderColor = "#bbf7d0";
          recommendTextDisplay.style.color = "#166534";
          recommendTextDisplay.style.fontStyle = "normal";
          recommendTextDisplay.style.fontWeight = "700";
        }
      }
      if (fillRecommendBtn) {
        fillRecommendBtn.disabled = !recommendedText;
      }

      resultNode = document.createElement("div");
      resultNode.className = "asc-section";

      const title = document.createElement("div");
      title.className = "asc-section-title";
      title.textContent = "当前识别结果";
      resultNode.appendChild(title);

      renderKeyValueRows(resultNode, [
        ["原始文本", referenceText],
        ["转换文本", candidateText || "-"],
        ["听音文本", heardText],
        ["推荐文本", recommendedText],
      ]);
      if (candidateText) {
        renderTextDiffSection(resultNode, heardText, candidateText);
      }
      const diagnostics = buildCurrentResultDiagnostics(source, {
        fallbackFrontConcurrency: source.debug?.frontConcurrencyNormalized,
      });
      if (Array.isArray(diagnostics.rows) && diagnostics.rows.length > 0) {
        renderKeyValueRows(resultNode, diagnostics.rows);
      }

      advancedSectionNode.appendChild(resultNode);
    }

    function updateBatch(snapshot) {
      const source = snapshot && typeof snapshot === "object" ? snapshot : {};
      ensureRoot();
      clearBatch();

      batchNode = document.createElement("div");
      batchNode.className = "asc-section";

      const title = document.createElement("div");
      title.className = "asc-section-title";
      title.textContent = "批量识别状态";
      batchNode.appendChild(title);

      renderKeyValueRows(batchNode, buildBatchRows(source));

      if (Array.isArray(source.failures) && source.failures.length > 0) {
        const failureTitle = document.createElement("div");
        failureTitle.className = "asc-section-title";
        failureTitle.textContent = "失败清单";
        batchNode.appendChild(failureTitle);

        const list = document.createElement("ul");
        list.className = "asc-failures";
        source.failures.forEach(function (entry) {
          const item = document.createElement("li");
          const row = document.createElement("div");
          row.className = "asc-failure-item-row";

          const textNode = document.createElement("div");
          textNode.className = "asc-failure-item-text";
          textNode.textContent =
            String(entry?.displayName || "未知条目") + "： " + String(entry?.message || "失败");
          row.appendChild(textNode);

          const actions = document.createElement("div");
          actions.className = "asc-failure-actions";

          const detailNode = document.createElement("div");
          detailNode.className = "asc-failure-detail";
          detailNode.style.display = "none";
          if (Array.isArray(entry?.detailRows) && entry.detailRows.length > 0) {
            renderKeyValueRows(detailNode, entry.detailRows);
          } else {
            detailNode.textContent = "当前没有更多详情。";
          }

          const rawNode = document.createElement("pre");
          rawNode.className = "asc-failure-raw";
          rawNode.style.display = "none";
          rawNode.textContent = JSON.stringify(entry?.rawJson || {}, null, 2);

          const detailBtn = document.createElement("button");
          detailBtn.type = "button";
          detailBtn.className = "asc-link-btn";
          detailBtn.textContent = "查看详情";
          detailBtn.addEventListener("click", function () {
            const nextVisible = detailNode.style.display === "none";
            detailNode.style.display = nextVisible ? "block" : "none";
            detailBtn.textContent = nextVisible ? "收起详情" : "查看详情";
          });
          actions.appendChild(detailBtn);

          const rawBtn = document.createElement("button");
          rawBtn.type = "button";
          rawBtn.className = "asc-link-btn";
          rawBtn.textContent = "查看原始JSON";
          rawBtn.addEventListener("click", function () {
            const nextVisible = rawNode.style.display === "none";
            rawNode.style.display = nextVisible ? "block" : "none";
            rawBtn.textContent = nextVisible ? "收起原始JSON" : "查看原始JSON";
          });
          actions.appendChild(rawBtn);

          row.appendChild(actions);
          item.appendChild(row);
          item.appendChild(detailNode);
          item.appendChild(rawNode);
          list.appendChild(item);
        });
        batchNode.appendChild(list);
      }

      advancedSectionNode.appendChild(batchNode);
    }

    function updateCurrentItemKey(itemKey) {
      const nextKey = String(itemKey || "");
      if (nextKey && currentItemKey && nextKey !== currentItemKey) {
        clearResult();
        setStatus("当前条已变化，请重新点击“AI识别”。", "warning");
      }
      currentItemKey = nextKey;
    }

    function ensureMounted() {
      return ensureRoot();
    }

    function remove() {
      clearResult();
      clearBatch();
      if (singleButtonNode) {
        singleButtonNode.remove();
      }
      if (batchAllButtonNode) {
        batchAllButtonNode.remove();
      }
      if (batchPendingButtonNode) {
        batchPendingButtonNode.remove();
      }
      if (stopButtonNode) {
        stopButtonNode.remove();
      }
      if (root) {
        root.remove();
      }
      root = null;
      statusNode = null;
      singleButtonNode = null;
      batchAllButtonNode = null;
      batchPendingButtonNode = null;
      stopButtonNode = null;
      currentItemKey = "";
      advancedSectionNode = null;
      toggleBtnNode = null;
      recommendTextDisplay = null;
      fillRecommendBtn = null;
      errorJsonNode = null;
    }

    return {
      ensureMounted,
      remove,
      renderResult,
      copyHeardText: copyCurrentHeardText,
      copyRecommendedText: copyCurrentRecommendedText,
      fillRecommendedText: fillCurrentRecommendedText,
      ignoreAiResult: ignoreCurrentResult,
      setBusy,
      setStatus,
      updateBatch,
      updateCurrentItemKey,
    };
  }

  const api = {
    createRuntime,
  };

  api.__test__ = {
    buildBatchRows,
  };

  globalThis.__ASREdgeAishellTechMinnanUiPanel = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();

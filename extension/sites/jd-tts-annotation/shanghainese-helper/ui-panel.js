(function () {
  "use strict";

  const BUTTON_TEXT = "上海话识别";
  const RUNNING_TEXT = "识别中…";

  function normalizeText(value, maxLength) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength || 240);
  }

  function normalizeFieldLabel(value) {
    return normalizeText(value).replace(/：/g, ":");
  }

  function createRuntime(options) {
    const config = options && typeof options === "object" ? options : {};
    const documentRef = config.document || globalThis.document;
    const TextareaCtor = config.HTMLTextAreaElement || globalThis.HTMLTextAreaElement;
    const InputEventCtor = config.InputEvent || globalThis.InputEvent;
    const diagnostics = globalThis.ASREdgeJdTtsShanghaiDiagnostics || {};
    let button = null;
    let status = null;
    let infoPanel = null;
    let infoExpanded = false;
    let infoState = {
      operatorName: "未设置",
      status: "等待识别",
      stage: "-",
      resultText: "暂无识别结果",
      fillState: "未写入",
      details: [],
      error: null,
    };
    let mountedAfterNativeAutoAnnotate = false;
    let targetTextarea = null;
    let onRecommend = typeof config.onRecommend === "function" ? config.onRecommend : null;

    function findUniqueTextFieldInCell(cell) {
      const textareas = Array.from(cell?.querySelectorAll?.("textarea.el-textarea__inner") || []);
      if (textareas.length !== 1) { return null; }
      const textarea = textareas[0];
      let container = textarea?.parentElement || cell;
      while (container?.parentElement && container.parentElement !== cell) {
        container = container.parentElement;
      }
      return { container, textarea };
    }

    function findSharedTextPinyinFieldInCell(cell) {
      const labels = Array.from(cell?.querySelectorAll?.("span") || []);
      const textLabelIndexes = labels.map(function (label, index) {
        return normalizeFieldLabel(label?.textContent) === "文本:" ? index : -1;
      }).filter(function (index) { return index >= 0; });
      const pinyinLabelIndexes = labels.map(function (label, index) {
        return normalizeFieldLabel(label?.textContent) === "拼音:" ? index : -1;
      }).filter(function (index) { return index >= 0; });
      if (textLabelIndexes.length !== 1 || pinyinLabelIndexes.length !== 1 || textLabelIndexes[0] >= pinyinLabelIndexes[0]) {
        return null;
      }
      if (labels[textLabelIndexes[0]]?.parentElement !== labels[pinyinLabelIndexes[0]]?.parentElement) { return null; }

      const inputContainers = Array.from(cell?.querySelectorAll?.("div.input-container.el-textarea.el-input--suffix") || []);
      if (inputContainers.length !== 2 || inputContainers.some(function (container) { return container?.parentElement !== cell; })) { return null; }
      const firstContainerTextareas = Array.from(inputContainers[0]?.querySelectorAll?.("textarea.el-textarea__inner") || []);
      if (firstContainerTextareas.length !== 1) { return null; }
      return { container: inputContainers[0], textarea: firstContainerTextareas[0] };
    }

    function findTextField() {
      const labels = Array.from(documentRef?.querySelectorAll?.("div.cell > span:first-child") || []);
      for (const label of labels) {
        if (normalizeFieldLabel(label?.textContent) !== "文本:") { continue; }
        const field = findUniqueTextFieldInCell(label?.parentElement);
        if (field) { return field; }
        if (!label?.parentElement) {
          const container = label.nextElementSibling;
          const textarea = container?.querySelector?.("textarea.el-textarea__inner");
          if (textarea) { return { container, textarea }; }
        }
      }

      const cells = Array.from(documentRef?.querySelectorAll?.("div.cell") || []);
      for (const cell of cells) {
        const cellLabels = Array.from(cell?.querySelectorAll?.("span") || []);
        const hasTextLabel = cellLabels.some(function (label) {
          return normalizeFieldLabel(label?.textContent) === "文本:";
        });
        if (!hasTextLabel) { continue; }
        const field = findUniqueTextFieldInCell(cell);
        if (field) { return field; }
        const sharedField = findSharedTextPinyinFieldInCell(cell);
        if (sharedField) { return sharedField; }
      }
      return null;
    }

    function findToolbarAutoAnnotateButton() {
      const buttons = Array.from(documentRef?.querySelectorAll?.("button") || []);
      return buttons.find(function (candidate) {
        return normalizeText(candidate?.textContent).trim() === "自动标注";
      }) || null;
    }

    function mountButton(nextButton, field) {
      const nativeAutoAnnotate = findToolbarAutoAnnotateButton();
      if (nativeAutoAnnotate?.insertAdjacentElement) {
        nativeAutoAnnotate.insertAdjacentElement("afterend", nextButton);
        const adjacentButton = nativeAutoAnnotate.nextElementSibling || nativeAutoAnnotate.nextSibling;
        if (adjacentButton === nextButton || (nextButton.isConnected === true && nextButton.parentElement === nativeAutoAnnotate.parentElement)) {
          return true;
        }
      }
      field.container?.insertAdjacentElement?.("afterend", nextButton);
      return false;
    }

    function isMountedImmediatelyAfter(nativeAutoAnnotate) {
      return (nativeAutoAnnotate?.nextElementSibling || nativeAutoAnnotate?.nextSibling) === button;
    }

    function setBusy(busy) {
      if (!button) { return; }
      button.disabled = busy === true;
      button.textContent = busy === true ? RUNNING_TEXT : BUTTON_TEXT;
    }

    function removeStatus() {
      status?.remove?.();
      status = null;
    }

    function ensureStatus() {
      if (!button) { return null; }
      if (!status) {
        status = documentRef.createElement("span");
        status.className = "asc-jd-tts-shanghai-status";
        if (status.style) {
          status.style.marginLeft = "8px";
          status.style.fontSize = "13px";
          status.style.whiteSpace = "nowrap";
        }
      }
      const adjacent = button.nextElementSibling || button.nextSibling;
      if (status.isConnected !== true || status.parentElement !== button.parentElement || adjacent !== status) {
        status.remove?.();
        button.insertAdjacentElement?.("afterend", status);
      }
      return status;
    }

    function setStatus(message, tone) {
      const text = normalizeText(message, 120);
      if (button) { button.title = text; }
      if (!text) { removeStatus(); return; }
      const statusNode = ensureStatus();
      if (!statusNode) { return; }
      statusNode.textContent = text;
      statusNode.title = text;
      if (statusNode.style) {
        statusNode.style.color = tone === "success" ? "#15803d" : tone === "warning" ? "#b45309" : tone === "error" ? "#b91c1c" : "#475569";
      }
    }

    function removeChildren(node) {
      if (!node) { return; }
      if (typeof node.replaceChildren === "function") { node.replaceChildren(); return; }
      if (Array.isArray(node.children)) { node.children.splice(0, node.children.length); }
      else { node.textContent = ""; }
    }

    function appendText(parent, tagName, text, style) {
      const node = documentRef.createElement(tagName);
      node.textContent = String(text || "");
      if (style && node.style) { Object.assign(node.style, style); }
      parent?.appendChild?.(node);
      return node;
    }

    function appendRow(parent, label, value) {
      const row = documentRef.createElement("div");
      if (row.style) {
        row.style.display = "grid";
        row.style.gridTemplateColumns = "88px minmax(0, 1fr)";
        row.style.gap = "6px 8px";
        row.style.marginTop = "6px";
      }
      appendText(row, "strong", label, { color: "#475569" });
      appendText(row, "span", value, { whiteSpace: "pre-wrap", overflowWrap: "anywhere" });
      parent?.appendChild?.(row);
    }

    function nextSiblingOf(node) {
      return node?.nextElementSibling || node?.nextSibling || null;
    }

    function findInfoAnchor(field) {
      if (!field?.container) { return null; }
      let anchor = field.container;
      if (button?.isConnected === true && button.parentElement === field.container.parentElement && nextSiblingOf(field.container) === button) {
        anchor = button;
        if (status?.isConnected === true && status.parentElement === button.parentElement && nextSiblingOf(button) === status) {
          anchor = status;
        }
      }
      return anchor;
    }

    function ensureInfoPanel(field) {
      const anchor = findInfoAnchor(field);
      if (!anchor) { return null; }
      const expectedParent = anchor.parentElement || null;
      if (!infoPanel) {
        infoPanel = documentRef.createElement("section");
        infoPanel.setAttribute?.("data-asc-jd-tts-shanghai-info", "true");
        infoPanel.className = "asc-jd-tts-shanghai-info";
        if (infoPanel.style) {
          infoPanel.style.marginTop = "10px";
          infoPanel.style.padding = "12px";
          infoPanel.style.border = "1px solid #bfdbfe";
          infoPanel.style.borderRadius = "8px";
          infoPanel.style.background = "#f8fbff";
          infoPanel.style.color = "#1f2937";
          infoPanel.style.fontSize = "13px";
          infoPanel.style.lineHeight = "1.6";
        }
      }
      if (infoPanel.isConnected !== true || (expectedParent && infoPanel.parentElement !== expectedParent) || nextSiblingOf(anchor) !== infoPanel) {
        infoPanel.remove?.();
        anchor.insertAdjacentElement?.("afterend", infoPanel);
      }
      return infoPanel;
    }

    function renderInfo() {
      const field = findTextField();
      const root = ensureInfoPanel(field);
      if (!root) { return; }
      removeChildren(root);
      appendText(root, "strong", "上海话 AI 信息", { color: "#1d4ed8", fontSize: "14px" });
      appendRow(root, "AI 使用人", normalizeText(infoState.operatorName) || "未设置");
      appendRow(root, "当前状态", normalizeText(infoState.status) || "等待识别");
      appendRow(root, "当前步骤", normalizeText(infoState.stage) || "-");
      appendRow(root, "识别文本", infoState.resultText === "" ? "暂无识别结果" : String(infoState.resultText || "暂无识别结果"));
      appendRow(root, "回填结果", normalizeText(infoState.fillState) || "未写入");
      if (infoState.error) {
        appendRow(root, "失败步骤", normalizeText(infoState.error.step) || normalizeText(infoState.stage) || "-");
        appendRow(root, "错误摘要", normalizeText(infoState.error.summary) || "识别失败");
        appendRow(root, "下一步建议", normalizeText(infoState.error.suggestion) || "请稍后重试。");
      }
      const toggle = documentRef.createElement("button");
      toggle.type = "button";
      toggle.textContent = infoExpanded ? "收起详细信息" : "查看详细信息";
      if (toggle.style) {
        toggle.style.marginTop = "10px";
        toggle.style.border = "none";
        toggle.style.background = "transparent";
        toggle.style.color = "#1d4ed8";
        toggle.style.cursor = "pointer";
        toggle.style.padding = "0";
      }
      toggle.addEventListener?.("click", function () { infoExpanded = !infoExpanded; renderInfo(); });
      root.appendChild?.(toggle);
      if (infoExpanded) {
        const details = Array.isArray(infoState.details) ? infoState.details : [];
        details.forEach(function (row) { appendRow(root, row?.[0], row?.[1]); });
      }
    }

    function updateInfo(value) {
      const source = value && typeof value === "object" ? value : {};
      const error = source.error && typeof source.error === "object"
        ? {
            step: normalizeText(source.error.step, 120),
            code: normalizeText(source.error.code, 120),
            summary: normalizeText(source.error.summary, 240),
            suggestion: normalizeText(source.error.suggestion, 240),
          }
        : null;
      infoState = Object.assign({}, infoState, {
        operatorName: source.operatorName !== undefined ? normalizeText(source.operatorName, 40) : infoState.operatorName,
        status: source.status !== undefined ? normalizeText(source.status, 120) : infoState.status,
        stage: source.stage !== undefined ? normalizeText(source.stage, 120) : infoState.stage,
        resultText: source.resultText !== undefined ? String(source.resultText || "") : infoState.resultText,
        fillState: source.fillState !== undefined ? normalizeText(source.fillState, 120) : infoState.fillState,
        details: Array.isArray(source.details) ? source.details.slice(0, 10).map(function (row) { return [normalizeText(row?.[0], 80), normalizeText(row?.[1], 240)]; }) : infoState.details,
        error,
      });
      renderInfo();
    }

    function ensureMounted() {
      const field = findTextField();
      if (!field) { return false; }
      if (button && (button.isConnected === false || targetTextarea !== field.textarea)) {
        button.remove?.();
        removeStatus();
        button = null;
        mountedAfterNativeAutoAnnotate = false;
      }
      targetTextarea = field.textarea;
      const nativeAutoAnnotate = findToolbarAutoAnnotateButton();
      if (button && !nativeAutoAnnotate && mountedAfterNativeAutoAnnotate) {
        button.remove?.();
        removeStatus();
        button = null;
        mountedAfterNativeAutoAnnotate = false;
      }
      if (button && nativeAutoAnnotate && (!mountedAfterNativeAutoAnnotate || !isMountedImmediatelyAfter(nativeAutoAnnotate))) {
        button.remove?.();
        removeStatus();
        button = null;
        mountedAfterNativeAutoAnnotate = false;
      }
      if (!button) {
        button = documentRef.createElement("button");
        button.type = "button";
        button.textContent = BUTTON_TEXT;
        button.className = "asc-jd-tts-shanghai-recommend";
        button.title = "扩展功能：识别当前音频并仅填入文本";
        if (button.style) {
          button.style.marginLeft = "8px";
          button.style.padding = "6px 12px";
          button.style.border = "1px solid #6d28d9";
          button.style.borderRadius = "4px";
          button.style.background = "#7c3aed";
          button.style.color = "#ffffff";
          button.style.cursor = "pointer";
        }
        button.addEventListener("click", function () {
          if (button.disabled || typeof onRecommend !== "function") { return; }
          setStatus("");
          Promise.resolve(onRecommend()).catch(function (error) { setStatus(error?.message || "识别失败。", "error"); });
        });
        mountedAfterNativeAutoAnnotate = mountButton(button, field);
      }
      renderInfo();
      return true;
    }

    function getMountTarget() {
      if (button?.isConnected !== false && button?.parentElement) { return button.parentElement; }
      return findTextField()?.container || null;
    }

    function getTextTarget() {
      return targetTextarea && targetTextarea.isConnected !== false ? targetTextarea : null;
    }

    function fillRecommendedText(result, isCurrent, lockedTextTarget) {
      const listenText = typeof result?.listenText === "string" ? result.listenText : "";
      const target = lockedTextTarget || targetTextarea;
      if (!listenText || !target || target !== targetTextarea || target.isConnected === false || target.disabled === true || target.readOnly === true || typeof isCurrent !== "function" || isCurrent() !== true) {
        return false;
      }
      const setter = Object.getOwnPropertyDescriptor(TextareaCtor?.prototype || {}, "value")?.set;
      if (typeof setter !== "function" || typeof InputEventCtor !== "function") { return false; }
      setter.call(target, listenText);
      target.dispatchEvent(new InputEventCtor("input", { bubbles: true, inputType: "insertText", data: listenText }));
      return true;
    }

    function remove() {
      button?.remove?.();
      button = null;
      removeStatus();
      infoPanel?.remove?.();
      infoPanel = null;
      mountedAfterNativeAutoAnnotate = false;
      targetTextarea = null;
    }

    function setOnRecommend(handler) { onRecommend = typeof handler === "function" ? handler : null; }
    return { ensureMounted, fillRecommendedText, getMountTarget, getTextTarget, remove, setBusy, setOnRecommend, setStatus, updateInfo };
  }

  const api = { createRuntime };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; }
  globalThis.ASREdgeJdTtsShanghaiUiPanel = api;
})();

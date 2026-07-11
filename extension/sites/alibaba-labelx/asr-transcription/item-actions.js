(function () {
  const activeItemApi = globalThis.__ASREdgeAlibabaLabelxTranscriptionActiveItem || null;
  const textUtils = globalThis.__ASREdgeAlibabaLabelxTranscriptionTextUtils || null;

  function result(ok, message, extra) {
    return Object.assign(
      {
        ok: ok === true,
        message: String(message || ""),
      },
      extra || {}
    );
  }

  function dispatchInputEvents(textarea) {
    ["input", "change"].forEach(function (eventName) {
      textarea.dispatchEvent(new Event(eventName, { bubbles: true }));
    });
  }

  function setTextareaValue(textarea, nextValue) {
    const safeValue = String(nextValue || "");
    if (textarea.value === safeValue) {
      return false;
    }
    textarea.value = safeValue;
    dispatchInputEvents(textarea);
    return true;
  }

  function isDisabledNode(node) {
    if (!(node instanceof HTMLElement)) {
      return true;
    }
    if (node.hasAttribute("disabled") || node.getAttribute("aria-disabled") === "true") {
      return true;
    }
    const className = String(node.className || "").toLowerCase();
    return className.includes("disabled") || className.includes("is-disabled");
  }

  function findMarkNode(item, keyword) {
    const nodes = Array.from(
      item.querySelectorAll("button, label, [role='button'], [role='radio'], .el-radio, .el-checkbox")
    );
    const normalizedKeyword = String(keyword || "").trim();
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i];
      if (isDisabledNode(node)) {
        continue;
      }
      const text = String(node.textContent || "").replace(/\s+/g, "");
      if (text.includes(normalizedKeyword)) {
        return node;
      }
    }
    return null;
  }

  function getCurrentContext() {
    if (!activeItemApi || typeof activeItemApi.getCurrentContext !== "function") {
      return null;
    }
    return activeItemApi.getCurrentContext();
  }

  function quickFillCurrentItem() {
    const ctx = getCurrentContext();
    if (!ctx || !ctx.item || !ctx.textarea) {
      return result(false, "未定位到当前题文本框。");
    }

    const sourceTexts = activeItemApi.getSourceTexts(ctx.item);
    const currentValue = textUtils.normalizeText(ctx.textarea.value);
    const candidate = sourceTexts
      .filter(function (text) {
        return textUtils.normalizeText(text) !== currentValue;
      })
      .sort(function (a, b) {
        return b.length - a.length;
      })[0];

    if (!candidate) {
      return result(false, "当前题未找到可填入的源文本。");
    }

    const changed = setTextareaValue(ctx.textarea, candidate);
    if (!changed) {
      return result(true, "当前题文本无需更新。");
    }
    return result(true, "已填入当前题源文本。");
  }

  function markCurrentItem(valid) {
    const ctx = getCurrentContext();
    if (!ctx || !ctx.item) {
      return result(false, "未定位到当前题。");
    }
    const node = findMarkNode(ctx.item, valid ? "有效" : "无效");
    if (!node) {
      return result(false, valid ? "当前题未找到“有效”选项。" : "当前题未找到“无效”选项。");
    }
    node.click();
    return result(true, valid ? "已标记当前题为有效。" : "已标记当前题为无效。");
  }

  function removeSpacesCurrentItem() {
    const ctx = getCurrentContext();
    if (!ctx || !ctx.textarea) {
      return result(false, "未定位到当前题文本框。");
    }
    const nextValue = textUtils.removeAllSpaces(ctx.textarea.value);
    const changed = setTextareaValue(ctx.textarea, nextValue);
    return result(true, changed ? "当前题已去空格。" : "当前题无需去空格。");
  }

  function convertNumberCurrentItem(config) {
    const ctx = getCurrentContext();
    if (!ctx || !ctx.textarea) {
      return result(false, "未定位到当前题文本框。");
    }
    const nextValue = textUtils.transformForNumberConvert(ctx.textarea.value, config || {});
    const changed = setTextareaValue(ctx.textarea, nextValue);
    return result(true, changed ? "当前题数字已转换。" : "当前题无需数字转换。");
  }

  function toggleFocusCurrentItem() {
    const ctx = getCurrentContext();
    if (!ctx || !ctx.item) {
      return result(false, "未定位到当前题。");
    }
    const textarea = activeItemApi.getItemTextarea(ctx.item);
    if (!textarea) {
      return result(false, "当前题未找到可编辑文本框。");
    }
    if (document.activeElement === textarea) {
      textarea.blur();
      return result(true, "已退出文本框焦点。");
    }
    activeItemApi.focusTextarea(ctx.item);
    return result(true, "已切换到当前题文本框焦点。");
  }

  function applyTextToCurrentItem(text) {
    const ctx = getCurrentContext();
    if (!ctx || !ctx.textarea) {
      return result(false, "未定位到当前题文本框。");
    }
    const changed = setTextareaValue(ctx.textarea, text);
    if (changed) {
      return result(true, "已填入推荐文本（未自动保存）。");
    }
    return result(true, "当前题文本与推荐一致，无需更新。");
  }

  globalThis.__ASREdgeAlibabaLabelxTranscriptionItemActions = {
    quickFillCurrentItem: quickFillCurrentItem,
    markCurrentItemValid: function () {
      return markCurrentItem(true);
    },
    markCurrentItemInvalid: function () {
      return markCurrentItem(false);
    },
    removeSpacesCurrentItem: removeSpacesCurrentItem,
    convertNumberCurrentItem: convertNumberCurrentItem,
    toggleFocusCurrentItem: toggleFocusCurrentItem,
    applyTextToCurrentItem: applyTextToCurrentItem,
  };
})();

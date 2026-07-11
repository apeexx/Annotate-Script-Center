(function () {
  const ITEM_SELECTOR = ".labelRender-item";

  function isVisible(element) {
    if (!element || !(element instanceof HTMLElement)) {
      return false;
    }
    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") {
      return false;
    }
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function getVisibleItems() {
    return Array.from(document.querySelectorAll(ITEM_SELECTOR)).filter(isVisible);
  }

  function getItemFromNode(node) {
    if (!node || !(node instanceof Element)) {
      return null;
    }
    return node.closest(ITEM_SELECTOR);
  }

  function getItemTextarea(item) {
    if (!item) {
      return null;
    }
    const textarea = item.querySelector("textarea");
    if (!(textarea instanceof HTMLTextAreaElement) || textarea.disabled || textarea.readOnly) {
      return null;
    }
    return textarea;
  }

  function getItemAudio(item) {
    if (!item) {
      return null;
    }
    const audio = item.querySelector("audio");
    return audio instanceof HTMLAudioElement ? audio : null;
  }

  function getFocusedItem() {
    const target = document.activeElement;
    return getItemFromNode(target);
  }

  function getActiveItem() {
    const selectors = [
      ".labelRender-item-selected",
      ".labelRender-item.active",
      ".labelRender-item.is-active",
      ".labelRender-item[data-active='true']",
      ".labelRender-item[aria-selected='true']",
    ];
    for (let i = 0; i < selectors.length; i += 1) {
      const candidate = document.querySelector(selectors[i]);
      if (candidate && isVisible(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  function getFallbackItem() {
    const items = getVisibleItems();
    return items.length > 0 ? items[0] : null;
  }

  function resolveCurrentItem() {
    const focused = getFocusedItem();
    if (focused) {
      return { item: focused, source: "focused" };
    }
    const active = getActiveItem();
    if (active) {
      return { item: active, source: "active" };
    }
    const fallback = getFallbackItem();
    if (fallback) {
      return { item: fallback, source: "fallback-first-visible" };
    }
    return { item: null, source: "none" };
  }

  function getCurrentContext() {
    const resolved = resolveCurrentItem();
    return {
      item: resolved.item,
      textarea: getItemTextarea(resolved.item),
      audio: getItemAudio(resolved.item),
      source: resolved.source,
    };
  }

  function focusTextarea(item) {
    const textarea = getItemTextarea(item);
    if (!textarea) {
      return false;
    }
    textarea.focus();
    const length = textarea.value.length;
    textarea.setSelectionRange(length, length);
    return true;
  }

  function getSourceTexts(item) {
    if (!item) {
      return [];
    }
    const selectors = [
      "[data-role='source-text']",
      "[data-source-text]",
      ".source-text",
      ".origin-text",
      ".asr-source-text",
      ".asr-text",
      ".asr_text",
      ".dt-text-container p",
      ".dt-text-container span",
      ".dt-text-container div",
    ];
    const values = [];
    selectors.forEach(function (selector) {
      Array.from(item.querySelectorAll(selector)).forEach(function (node) {
        const text = String(node.textContent || "").replace(/\s+/g, " ").trim();
        if (text) {
          values.push(text);
        }
      });
    });
    return Array.from(new Set(values));
  }

  globalThis.__ASREdgeAlibabaLabelxTranscriptionActiveItem = {
    ITEM_SELECTOR: ITEM_SELECTOR,
    getVisibleItems: getVisibleItems,
    getItemFromNode: getItemFromNode,
    getItemTextarea: getItemTextarea,
    getItemAudio: getItemAudio,
    getCurrentContext: getCurrentContext,
    resolveCurrentItem: resolveCurrentItem,
    focusTextarea: focusTextarea,
    getSourceTexts: getSourceTexts,
  };
})();

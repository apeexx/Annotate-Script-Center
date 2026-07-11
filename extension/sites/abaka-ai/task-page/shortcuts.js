(function () {
  const STORAGE_KEY = "asrEdgeSettings";
  const ACTION_ORDER = [
    "sameFontTrue",
    "sameFontFalse",
    "sameFontArtisticEffect",
    "imageBTextsRemovedSpecify",
    "otherChangesSpecify",
    "stashSave",
    "submitReview",
    "aiAnalyzeSameFont",
    "aiAnalyzeImageBTextsRemoved",
    "aiAnalyzeOtherChanges",
    "aiAnalyzeOverall",
  ];

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function normalizeKeyName(key) {
    if (key === " ") {
      return "Space";
    }
    return String(key || "");
  }

  function normalizeShortcut(shortcut) {
    if (!shortcut || typeof shortcut !== "object") {
      return null;
    }
    const hasKey = typeof shortcut.key === "string" && shortcut.key.length > 0;
    const hasButton = typeof shortcut.button === "number";
    if (!hasKey && !hasButton) {
      return null;
    }
    return {
      ctrl: shortcut.ctrl === true,
      alt: shortcut.alt === true,
      shift: shortcut.shift === true,
      meta: shortcut.meta === true,
      key: hasKey ? normalizeKeyName(shortcut.key) : null,
      button: hasButton ? shortcut.button : null,
    };
  }

  function normalizeShortcutMap(shortcuts) {
    const source = shortcuts && typeof shortcuts === "object" ? shortcuts : {};
    const result = {};
    ACTION_ORDER.forEach(function (actionKey) {
      result[actionKey] = normalizeShortcut(source[actionKey]);
    });
    return result;
  }

  function shortcutMatchesEvent(shortcut, event) {
    if (!shortcut || shortcut.button !== null || !shortcut.key) {
      return false;
    }
    return (
      shortcut.ctrl === (event.ctrlKey === true) &&
      shortcut.alt === (event.altKey === true) &&
      shortcut.shift === (event.shiftKey === true) &&
      shortcut.meta === (event.metaKey === true) &&
      shortcut.key === normalizeKeyName(event.key)
    );
  }

  function shortcutMatchesMouseEvent(shortcut, event) {
    if (!shortcut || typeof shortcut.button !== "number") {
      return false;
    }
    return (
      shortcut.ctrl === (event.ctrlKey === true) &&
      shortcut.alt === (event.altKey === true) &&
      shortcut.shift === (event.shiftKey === true) &&
      shortcut.meta === (event.metaKey === true) &&
      shortcut.button === event.button
    );
  }

  function isEditableTarget(target) {
    if (!(target instanceof Element)) {
      return false;
    }
    const tag = String(target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") {
      return true;
    }
    if (target.isContentEditable) {
      return true;
    }
    if (target.closest("[contenteditable='true'], [contenteditable=''], [role='textbox']")) {
      return true;
    }
    if (target.closest(".monaco-editor, .ProseMirror, .ql-editor, [class*='editor']")) {
      return true;
    }
    return false;
  }

  function isItemsPage() {
    const pathname = String(location.pathname || "");
    if (pathname === "/items") {
      return true;
    }
    if (pathname.indexOf("/data-task/v2") === 0 || pathname.indexOf("/task-v2/data-item") === 0) {
      return false;
    }
    return pathname.indexOf("/items") >= 0;
  }

  function getAbakaConfig(settings) {
    const source = settings?.platforms?.abakaAi?.scripts?.taskPageCapture || {};
    return {
      enabled: source.enabled !== false,
      autoSelectSpecifyOnSameFontTrue: source.autoSelectSpecifyOnSameFontTrue !== false,
      shortcuts: normalizeShortcutMap(source.shortcuts),
    };
  }

  function createRuntime(options) {
    const config = options && typeof options === "object" ? options : {};
    let currentSettings = clone(config.settings || {});
    let currentShortcutMap = normalizeShortcutMap(
      getAbakaConfig(currentSettings).shortcuts || {}
    );
    let started = false;

    function showToast(message, tone) {
      if (typeof config.showToast === "function") {
        config.showToast(message, tone);
      }
    }

    function refreshFromSettings(nextSettings) {
      currentSettings = clone(nextSettings || {});
      currentShortcutMap = normalizeShortcutMap(
        getAbakaConfig(currentSettings).shortcuts || {}
      );
    }

    function findActionByEvent(event) {
      for (let i = 0; i < ACTION_ORDER.length; i += 1) {
        const actionKey = ACTION_ORDER[i];
        if (shortcutMatchesEvent(currentShortcutMap[actionKey], event)) {
          return actionKey;
        }
      }
      return null;
    }

    function findActionByMouseEvent(event) {
      for (let i = 0; i < ACTION_ORDER.length; i += 1) {
        const actionKey = ACTION_ORDER[i];
        if (shortcutMatchesMouseEvent(currentShortcutMap[actionKey], event)) {
          return actionKey;
        }
      }
      return null;
    }

    async function runAction(actionKey) {
      const actions = config.actions || {};
      if (typeof actions[actionKey] !== "function") {
        showToast("未找到动作处理：" + actionKey, "warn");
        return;
      }
      const result = await actions[actionKey]();
      if (!result || result.ok !== true) {
        showToast((result && result.message) || "快捷键执行失败", "warn");
        return;
      }
      showToast(result.message || "快捷键执行成功", "success");
    }

    function handleKeydown(event) {
      if (event.isTrusted !== true || event.repeat === true) {
        return;
      }
      if (!isItemsPage()) {
        return;
      }
      const platformEnabled = currentSettings?.platforms?.abakaAi?.enabled !== false;
      const scriptConfig = getAbakaConfig(currentSettings);
      if (!platformEnabled || scriptConfig.enabled === false) {
        return;
      }
      if (isEditableTarget(event.target)) {
        return;
      }

      const actionKey = findActionByEvent(event);
      if (!actionKey) {
        return;
      }

      if (typeof config.hasSameFontField === "function" && config.hasSameFontField() !== true) {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") {
          event.stopImmediatePropagation();
        }
        showToast("当前页面未检测到 same_font 字段，未执行快捷键。", "warn");
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
      }
      void runAction(actionKey);
    }

    function handleMousedown(event) {
      if (event.isTrusted !== true) {
        return;
      }
      if (!isItemsPage()) {
        return;
      }
      const platformEnabled = currentSettings?.platforms?.abakaAi?.enabled !== false;
      const scriptConfig = getAbakaConfig(currentSettings);
      if (!platformEnabled || scriptConfig.enabled === false) {
        return;
      }
      if (isEditableTarget(event.target)) {
        return;
      }

      const actionKey = findActionByMouseEvent(event);
      if (!actionKey) {
        return;
      }

      if (typeof config.hasSameFontField === "function" && config.hasSameFontField() !== true) {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") {
          event.stopImmediatePropagation();
        }
        showToast("当前页面未检测到 same_font 字段，未执行快捷键。", "warn");
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
      }
      void runAction(actionKey);
    }

    function handleStorageChanged(changes, areaName) {
      if (areaName !== "local" || !changes || !changes[STORAGE_KEY]) {
        return;
      }
      const newValue = changes[STORAGE_KEY].newValue || {};
      refreshFromSettings(newValue);
    }

    function start() {
      if (started) {
        return;
      }
      started = true;
      window.addEventListener("keydown", handleKeydown, true);
      document.addEventListener("keydown", handleKeydown, true);
      window.addEventListener("mousedown", handleMousedown, true);
      document.addEventListener("mousedown", handleMousedown, true);
      if (
        typeof chrome !== "undefined" &&
        chrome.storage &&
        chrome.storage.onChanged &&
        typeof chrome.storage.onChanged.addListener === "function"
      ) {
        chrome.storage.onChanged.addListener(handleStorageChanged);
      }
    }

    function stop() {
      if (!started) {
        return;
      }
      started = false;
      window.removeEventListener("keydown", handleKeydown, true);
      document.removeEventListener("keydown", handleKeydown, true);
      window.removeEventListener("mousedown", handleMousedown, true);
      document.removeEventListener("mousedown", handleMousedown, true);
      if (
        typeof chrome !== "undefined" &&
        chrome.storage &&
        chrome.storage.onChanged &&
        typeof chrome.storage.onChanged.removeListener === "function"
      ) {
        chrome.storage.onChanged.removeListener(handleStorageChanged);
      }
    }

    return {
      start: start,
      stop: stop,
      refreshFromSettings: refreshFromSettings,
    };
  }

  globalThis.__ASCEdgeAbakaAiTask21Shortcuts = {
    ACTION_ORDER: ACTION_ORDER.slice(),
    createRuntime: createRuntime,
    normalizeShortcut: normalizeShortcut,
    normalizeShortcutMap: normalizeShortcutMap,
  };
})();

(function () {
  if (globalThis.__ASREdgeAishellTechVietnameseShortcutsInstalled === true) {
    return;
  }
  globalThis.__ASREdgeAishellTechVietnameseShortcutsInstalled = true;
  const ACTION_LABELS = {
    aiRecommendCurrentItem: "AI 识别当前条",
    autoFillQualifiedItem: "批量识别并保存",
    copyRecommendedText: "复制识别文本",
    fillRecommendedText: "填入并保存当前条",
    ignoreAiResult: "忽略 AI 结果",
  };
  const HANDLED_FLAG = "__asrEdgeAishellTechShortcutHandled";

  function normalizeKey(key) {
    const text = String(key || "");
    if (text === " ") {
      return "Space";
    }
    return text.length === 1 ? text.toLowerCase() : text;
  }

  function normalizeShortcut(shortcut) {
    if (!shortcut || typeof shortcut !== "object") {
      return null;
    }
    const hasKey = typeof shortcut.key === "string" && shortcut.key.length > 0;
    if (!hasKey) {
      return null;
    }
    return {
      ctrl: shortcut.ctrl === true,
      alt: shortcut.alt === true,
      shift: shortcut.shift === true,
      meta: shortcut.meta === true,
      key: normalizeKey(shortcut.key),
    };
  }

  function normalizeShortcutMap(shortcuts) {
    const source = shortcuts && typeof shortcuts === "object" ? shortcuts : {};
    const result = {};
    Object.keys(ACTION_LABELS).forEach(function (actionKey) {
      result[actionKey] = normalizeShortcut(source[actionKey]);
    });
    return result;
  }

  function shortcutMatchesEvent(shortcut, event) {
    if (!shortcut) {
      return false;
    }
    return (
      shortcut.ctrl === event.ctrlKey &&
      shortcut.alt === event.altKey &&
      shortcut.shift === event.shiftKey &&
      shortcut.meta === event.metaKey &&
      shortcut.key === normalizeKey(event.key)
    );
  }

  function runPromiseAction(promise, actions) {
    Promise.resolve(promise).catch(function (error) {
      if (actions && typeof actions.showStatus === "function") {
        actions.showStatus(error?.message || String(error), "error");
      }
    });
  }

  function createRuntime(options) {
    const config = options && typeof options === "object" ? options : {};
    let shortcuts = normalizeShortcutMap(config.shortcuts);
    let actions = config.actions || {};
    let started = false;

    function findMatchedAction(event) {
      return Object.keys(shortcuts).find(function (key) {
        return shortcutMatchesEvent(shortcuts[key], event);
      });
    }

    function handleKeydown(event) {
      if (event[HANDLED_FLAG]) {
        return;
      }
      const actionKey = findMatchedAction(event);
      if (!actionKey) {
        return;
      }
      event[HANDLED_FLAG] = true;
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
      }

      if (actionKey === "aiRecommendCurrentItem" && typeof actions.requestAiRecommend === "function") {
        runPromiseAction(actions.requestAiRecommend(), actions);
        return;
      }
      if (actionKey === "autoFillQualifiedItem" && typeof actions.autoFillQualifiedItem === "function") {
        runPromiseAction(actions.autoFillQualifiedItem(), actions);
        return;
      }
      if (actionKey === "copyRecommendedText" && typeof actions.copyRecommendedText === "function") {
        runPromiseAction(actions.copyRecommendedText(), actions);
        return;
      }
      if (actionKey === "fillRecommendedText" && typeof actions.fillRecommendedText === "function") {
        runPromiseAction(actions.fillRecommendedText(), actions);
        return;
      }
      if (actionKey === "ignoreAiResult" && typeof actions.ignoreAiResult === "function") {
        actions.ignoreAiResult();
      }
    }

    function start() {
      if (started) {
        return;
      }
      started = true;
      window.addEventListener("keydown", handleKeydown, true);
      document.addEventListener("keydown", handleKeydown, true);
    }

    function stop() {
      if (!started) {
        return;
      }
      started = false;
      window.removeEventListener("keydown", handleKeydown, true);
      document.removeEventListener("keydown", handleKeydown, true);
    }

    function refresh(nextOptions) {
      const next = nextOptions && typeof nextOptions === "object" ? nextOptions : {};
      shortcuts = normalizeShortcutMap(next.shortcuts || shortcuts);
      actions = next.actions || actions;
    }

    return {
      refresh,
      start,
      stop,
    };
  }

  globalThis.__ASREdgeAishellTechVietnameseShortcuts = {
    createRuntime,
  };
})();

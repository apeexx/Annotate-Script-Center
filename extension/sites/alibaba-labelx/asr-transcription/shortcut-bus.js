(function () {
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

  function isEditableNode(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) {
      return false;
    }

    const element = node;
    const tagName = String(element.tagName || "").toLowerCase();
    const inputType = String(element.getAttribute?.("type") || "").toLowerCase();
    const nonTextInputTypes = [
      "button",
      "checkbox",
      "color",
      "file",
      "hidden",
      "image",
      "radio",
      "range",
      "reset",
      "submit",
    ];
    return (
      (tagName === "input" && nonTextInputTypes.indexOf(inputType) < 0) ||
      tagName === "textarea" ||
      tagName === "select" ||
      element.isContentEditable === true ||
      Boolean(element.closest && element.closest("[contenteditable='true']"))
    );
  }

  function isEditableEventTarget(event) {
    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    if (path.some(isEditableNode)) {
      return true;
    }
    return isEditableNode(event.target);
  }

  function isToolbarEventTarget(event) {
    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    if (
      path.some(function (node) {
        return node?.getAttribute?.("data-asr-edge-transcription-toolbar") === "true";
      })
    ) {
      return true;
    }
    return Boolean(
      event.target?.closest &&
        event.target.closest("[data-asr-edge-transcription-toolbar='true']")
    );
  }

  function isPlainPrintableKey(key) {
    if (typeof key !== "string" || key.length !== 1) {
      return false;
    }
    return /[^\s]/.test(key);
  }

  function isShortcutMatch(event, shortcut) {
    const normalized = normalizeShortcut(shortcut);
    if (!normalized) {
      return false;
    }

    if (
      normalized.ctrl !== event.ctrlKey ||
      normalized.alt !== event.altKey ||
      normalized.shift !== event.shiftKey ||
      normalized.meta !== event.metaKey
    ) {
      return false;
    }

    if (event.type === "keydown") {
      return normalized.button === null && normalized.key === normalizeKeyName(event.key);
    }
    if (event.type === "mousedown") {
      return normalized.key === null && normalized.button === event.button;
    }
    return false;
  }

  function haltShortcutEvent(event) {
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") {
      event.stopImmediatePropagation();
    }
  }

  function createRuntime(deps) {
    const options = deps && typeof deps === "object" ? deps : {};
    let listenersBound = false;

    const ACTION_BY_SHORTCUT_KEY = {
      shortcutPlayPause: "playPause",
      shortcutValid: "markValid",
      shortcutInvalid: "markInvalid",
      shortcutFill: "quickFill",
      shortcutRemoveSpaces: "removeSpaces",
      shortcutConvertNum: "convertNumbers",
      shortcutToggleFocus: "toggleFocus",
      shortcutBackward: "seekBackward",
      shortcutForward: "seekForward",
      shortcutSpeedDown: "speedDown",
      shortcutSpeedUp: "speedUp",
      shortcutResetSpeed: "speedReset",
      shortcutVolDown: "volumeDown",
      shortcutVolUp: "volumeUp",
      shortcutResetVol: "volumeReset",
      shortcutCopyDuration: "copyDuration",
      shortcutUploadStats: "uploadStats",
      shortcutAiSuggest: "aiSuggestCurrent",
      shortcutApplyAiSuggestion: "applyAiSuggestion",
      shortcutSubmitTask: "submitTask",
      shortcutSubmitTaskAndFinish: "submitTaskAndFinish",
    };

    function isEnabled() {
      return typeof options.isEnabled === "function" ? options.isEnabled() : false;
    }

    function getConfig() {
      return typeof options.getConfig === "function" ? options.getConfig() || {} : {};
    }

    function findShortcutAction(event) {
      const config = getConfig();
      return (
        Object.keys(ACTION_BY_SHORTCUT_KEY).find(function (shortcutKey) {
          const shortcut = config?.shortcuts?.[shortcutKey] || config?.[shortcutKey];
          return isShortcutMatch(event, shortcut);
        }) || null
      );
    }

    function runAction(actionKey) {
      const actionName = ACTION_BY_SHORTCUT_KEY[actionKey];
      if (!actionName || typeof options.runAction !== "function") {
        return;
      }
      void options.runAction(actionName, "shortcut");
    }

    function handleShortcutEvent(event) {
      if (
        event.isTrusted !== true ||
        !isEnabled() ||
        event.repeat === true ||
        isToolbarEventTarget(event)
      ) {
        return;
      }

      const editable = isEditableEventTarget(event);
      if (
        editable &&
        event.type === "keydown" &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.metaKey &&
        isPlainPrintableKey(event.key)
      ) {
        return;
      }

      const actionKey = findShortcutAction(event);
      if (!actionKey) {
        return;
      }

      haltShortcutEvent(event);
      runAction(actionKey);
    }

    function bind() {
      if (listenersBound) {
        return;
      }
      window.addEventListener("keydown", handleShortcutEvent, true);
      window.addEventListener("mousedown", handleShortcutEvent, true);
      listenersBound = true;
    }

    function unbind() {
      if (!listenersBound) {
        return;
      }
      window.removeEventListener("keydown", handleShortcutEvent, true);
      window.removeEventListener("mousedown", handleShortcutEvent, true);
      listenersBound = false;
    }

    return {
      bind: bind,
      unbind: unbind,
    };
  }

  globalThis.__ASREdgeAlibabaLabelxTranscriptionShortcutBus = {
    createRuntime: createRuntime,
    normalizeKeyName: normalizeKeyName,
  };
})();

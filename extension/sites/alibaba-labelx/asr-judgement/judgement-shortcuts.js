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
        return node?.getAttribute?.("data-asr-edge-judgement-toolbar") === "true";
      })
    ) {
      return true;
    }

    return Boolean(
      event.target?.closest &&
        event.target.closest("[data-asr-edge-judgement-toolbar='true']")
    );
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

    if (
      event.type === "mousedown" ||
      event.type === "mouseup" ||
      event.type === "auxclick" ||
      event.type === "contextmenu"
    ) {
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

  function getKeyboardShortcutSignature(event) {
    return {
      key: normalizeKeyName(event.key),
      ctrl: event.ctrlKey === true,
      alt: event.altKey === true,
      shift: event.shiftKey === true,
      meta: event.metaKey === true,
    };
  }

  function isSameKeyboardShortcut(left, right) {
    return Boolean(
      left &&
        right &&
        left.key === right.key &&
        left.ctrl === right.ctrl &&
        left.alt === right.alt &&
        left.shift === right.shift &&
        left.meta === right.meta
    );
  }

  function createRuntime(deps) {
    const options = deps && typeof deps === "object" ? deps : {};
    let listenersBound = false;
    let lastMouseShortcutSuppression = null;
    let suppressedKeyupShortcuts = [];

    function getShortcuts() {
      return typeof options.getShortcuts === "function" ? options.getShortcuts() || {} : {};
    }

    function getShortcutActionOrder() {
      return typeof options.getShortcutActionOrder === "function" ? options.getShortcutActionOrder() || [] : [];
    }

    function isEnabled() {
      return typeof options.isEnabled === "function" ? options.isEnabled() : false;
    }

    function findShortcutAction(event) {
      const shortcuts = getShortcuts();
      return (
        getShortcutActionOrder().find(function (actionKey) {
          return isShortcutMatch(event, shortcuts[actionKey]);
        }) || null
      );
    }

    function rememberKeyboardShortcutSuppression(event) {
      if (event.type !== "keydown") {
        return;
      }

      const now = Date.now();
      const signature = getKeyboardShortcutSignature(event);
      suppressedKeyupShortcuts = suppressedKeyupShortcuts
        .filter(function (entry) {
          return entry.expiresAt > now && !isSameKeyboardShortcut(entry, signature);
        })
        .concat([
          Object.assign({}, signature, {
            expiresAt: now + 1200,
          }),
        ]);
    }

    function shouldSuppressKeyboardFollowup(event) {
      const now = Date.now();
      const signature = getKeyboardShortcutSignature(event);
      const matched = suppressedKeyupShortcuts.some(function (entry) {
        return entry.expiresAt > now && isSameKeyboardShortcut(entry, signature);
      });

      suppressedKeyupShortcuts = suppressedKeyupShortcuts.filter(function (entry) {
        return entry.expiresAt > now && !isSameKeyboardShortcut(entry, signature);
      });

      return matched === true;
    }

    function rememberMouseShortcutSuppression(event) {
      if (event.type !== "mousedown") {
        return;
      }

      lastMouseShortcutSuppression = {
        button: event.button,
        ctrl: event.ctrlKey === true,
        alt: event.altKey === true,
        shift: event.shiftKey === true,
        meta: event.metaKey === true,
        expiresAt: Date.now() + 800,
      };
    }

    function shouldSuppressMouseFollowup(event) {
      if (!lastMouseShortcutSuppression || Date.now() > lastMouseShortcutSuppression.expiresAt) {
        lastMouseShortcutSuppression = null;
        return false;
      }

      return (
        event.button === lastMouseShortcutSuppression.button &&
        event.ctrlKey === lastMouseShortcutSuppression.ctrl &&
        event.altKey === lastMouseShortcutSuppression.alt &&
        event.shiftKey === lastMouseShortcutSuppression.shift &&
        event.metaKey === lastMouseShortcutSuppression.meta
      );
    }

    function scheduleShortcutAction(actionKey) {
      const run = function () {
        window.setTimeout(function () {
          options.runActionWithFeedback(actionKey, "shortcut", "shortcut-", "lastShortcutAction");
        }, 0);
      };

      if (typeof window.requestAnimationFrame === "function") {
        window.requestAnimationFrame(run);
        return;
      }

      window.setTimeout(run, 16);
    }

    function handleShortcutEvent(event) {
      if (
        event.isTrusted !== true ||
        !isEnabled() ||
        isEditableEventTarget(event) ||
        isToolbarEventTarget(event)
      ) {
        return;
      }

      const actionKey = findShortcutAction(event);
      if (!actionKey) {
        return;
      }

      haltShortcutEvent(event);
      rememberKeyboardShortcutSuppression(event);
      rememberMouseShortcutSuppression(event);

      if (event.repeat === true) {
        return;
      }

      scheduleShortcutAction(actionKey);
    }

    function handleKeyupFollowupEvent(event) {
      if (event.isTrusted !== true || !isEnabled() || isToolbarEventTarget(event)) {
        return;
      }

      if (shouldSuppressKeyboardFollowup(event)) {
        haltShortcutEvent(event);
      }
    }

    function handleMouseFollowupEvent(event) {
      if (
        event.isTrusted !== true ||
        !isEnabled() ||
        isEditableEventTarget(event) ||
        isToolbarEventTarget(event)
      ) {
        return;
      }

      if (shouldSuppressMouseFollowup(event) || findShortcutAction(event)) {
        haltShortcutEvent(event);
      }
    }

    function bind() {
      if (listenersBound) {
        return;
      }

      window.addEventListener("keydown", handleShortcutEvent, true);
      window.addEventListener("keyup", handleKeyupFollowupEvent, true);
      window.addEventListener("mousedown", handleShortcutEvent, true);
      window.addEventListener("mouseup", handleMouseFollowupEvent, true);
      window.addEventListener("auxclick", handleMouseFollowupEvent, true);
      window.addEventListener("contextmenu", handleMouseFollowupEvent, true);
      listenersBound = true;
    }

    return {
      bind: bind,
    };
  }

  globalThis.__ASREdgeAlibabaLabelxJudgementShortcuts = {
    createRuntime: createRuntime,
    normalizeKeyName: normalizeKeyName,
  };
})();

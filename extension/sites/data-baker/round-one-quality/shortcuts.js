(function () {
  const ACTION_LABELS = {
    aiRecommendCurrentItem: "AI 推荐文本",
    autoFillQualifiedItem: "AI并发分析并连续填入合格项",
    copyAiHeardText: "复制 AI 听音文本",
    copyRecommendedText: "复制 AI 推荐文本",
    fillRecommendedText: "填入推荐文本",
    ignoreAiResult: "忽略 AI 推荐结果",
    sentenceQualified: "句子判定：合格",
    sentenceUnqualified: "句子判定：不合格",
    taskPass: "任务判定：通过",
    taskPartialReject: "任务判定：部分驳回",
    taskFullReject: "任务判定：全部驳回",
  };

  const HANDLED_FLAG = "__asrEdgeDataBakerShortcutHandled";
  const PAGE_TEXT_CHECK_INTERVAL_MS = 500;
  const PAGE_TEXT_CHANGE_DELAY_MS = 120;
  const PAGE_TEXT_BLUR_DELAY_MS = 60;
  const USER_EDIT_GRACE_MS = 1500;

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
      key: hasKey ? normalizeKey(shortcut.key) : null,
      button: hasButton ? shortcut.button : null,
    };
  }

  function normalizeKey(key) {
    const text = String(key || "");
    if (text === " ") {
      return "Space";
    }
    return text.length === 1 ? text.toLowerCase() : text;
  }

  function normalizeShortcutMap(shortcuts) {
    const source = shortcuts && typeof shortcuts === "object" ? shortcuts : {};
    const result = {};
    Object.keys(ACTION_LABELS).forEach(function (actionKey) {
      result[actionKey] = normalizeShortcut(source[actionKey]);
    });
    return result;
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, "").trim();
  }

  function isEditableTarget(target) {
    if (!(target instanceof Element)) {
      return false;
    }
    const tagName = String(target.tagName || "").toLowerCase();
    if (tagName === "input" || tagName === "textarea" || tagName === "select") {
      return true;
    }
    if (target.isContentEditable) {
      return true;
    }
    return Boolean(target.closest("[contenteditable='true'], [contenteditable='']"));
  }

  function focusBody() {
    if (!(document.body instanceof HTMLElement)) {
      return;
    }
    try {
      if (!document.body.hasAttribute("tabindex")) {
        document.body.setAttribute("tabindex", "-1");
      }
      document.body.focus({ preventScroll: true });
    } catch (error) {
      try {
        document.body.focus();
      } catch (innerError) {
        // Ignore focus failures.
      }
    }
  }

  function blurActiveElementForShortcut() {
    const activeElement = document.activeElement;
    if (
      activeElement &&
      activeElement instanceof HTMLElement &&
      activeElement !== document.body &&
      typeof activeElement.blur === "function"
    ) {
      activeElement.blur();
    }

    try {
      const nextActiveElement = document.activeElement;
      if (
        isEditableTarget(nextActiveElement) &&
        nextActiveElement instanceof HTMLElement &&
        typeof nextActiveElement.blur === "function"
      ) {
        nextActiveElement.blur();
      }
    } catch (error) {
      // Ignore blur failures.
    }

    focusBody();
    return true;
  }

  function findPageTextArea() {
    const textBoxes = Array.from(document.querySelectorAll(".waver-page .text-box"));
    const textBox = textBoxes.find(function (node) {
      return String(node.textContent || "").indexOf("本句话文本") >= 0;
    });

    return (
      textBox?.querySelector("textarea.el-textarea__inner, textarea") ||
      document.querySelector(".waver-page .text-box textarea.el-textarea__inner") ||
      document.querySelector(".el-textarea textarea.el-textarea__inner") ||
      null
    );
  }

  function getPageTextValue() {
    const textarea = findPageTextArea();
    return textarea ? String(textarea.value || "") : "";
  }

  function focusPageTextThenExit() {
    const textarea = findPageTextArea();
    if (!textarea || !(textarea instanceof HTMLElement)) {
      return false;
    }

    try {
      textarea.focus({ preventScroll: true });
    } catch (error) {
      try {
        textarea.focus();
      } catch (innerError) {
        return false;
      }
    }

    window.setTimeout(function () {
      try {
        textarea.blur();
      } catch (error) {
        // Ignore blur failures.
      }
      focusBody();
    }, PAGE_TEXT_BLUR_DELAY_MS);

    return true;
  }

  function shortcutMatchesEvent(shortcut, event) {
    if (!shortcut || shortcut.button !== null) {
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

  function isDisabledButton(button) {
    return (
      !button ||
      button.disabled === true ||
      button.classList.contains("is-disabled") ||
      button.getAttribute("disabled") !== null ||
      button.getAttribute("aria-disabled") === "true"
    );
  }

  function findButtonInContainers(containerSelector, headingText, buttonText) {
    const heading = normalizeText(headingText);
    const target = normalizeText(buttonText);
    const containers = Array.from(document.querySelectorAll(containerSelector));
    for (let index = containers.length - 1; index >= 0; index -= 1) {
      const container = containers[index];
      if (heading && normalizeText(container.textContent).indexOf(heading) < 0) {
        continue;
      }
      const buttons = Array.from(container.querySelectorAll("button"));
      const button = buttons.find(function (item) {
        return normalizeText(item.textContent) === target;
      });
      if (button) {
        return button;
      }
    }
    return null;
  }

  function showStatus(message, tone, actions) {
    if (actions && typeof actions.showStatus === "function") {
      actions.showStatus(message, tone);
      return;
    }
    if (typeof console !== "undefined" && typeof console.debug === "function") {
      console.debug("[DataBaker][round-one-quality][shortcut] " + String(message || ""));
    }
  }

  function clickButton(button, failureMessage, actions) {
    if (!button) {
      showStatus(failureMessage || "未找到对应按钮。", "error", actions);
      return false;
    }
    if (isDisabledButton(button)) {
      showStatus("对应按钮当前不可用，未绕过平台限制。", "error", actions);
      return false;
    }
    button.click();
    showStatus("已触发：" + normalizeText(button.textContent), "success", actions);
    return true;
  }

  function runPromiseAction(promise, actions) {
    Promise.resolve(promise).catch(function (error) {
      showStatus(error?.message || String(error), "error", actions);
    });
  }

  function runAction(actionKey, actions) {
    const safeActions = actions && typeof actions === "object" ? actions : {};

    if (actionKey === "aiRecommendCurrentItem") {
      if (typeof safeActions.requestAiRecommend !== "function") {
        showStatus("AI 推荐工具卡未就绪。", "error", safeActions);
        return;
      }
      runPromiseAction(safeActions.requestAiRecommend(), safeActions);
      return;
    }
    if (actionKey === "autoFillQualifiedItem") {
      if (typeof safeActions.autoFillQualifiedItem !== "function") {
        showStatus("AI并发分析并连续填入合格项未就绪。", "error", safeActions);
        return;
      }
      runPromiseAction(safeActions.autoFillQualifiedItem(), safeActions);
      return;
    }
    if (actionKey === "copyAiHeardText") {
      runPromiseAction(safeActions.copyHeardText?.() || Promise.resolve(), safeActions);
      return;
    }
    if (actionKey === "copyRecommendedText") {
      runPromiseAction(safeActions.copyRecommendedText?.() || Promise.resolve(), safeActions);
      return;
    }
    if (actionKey === "fillRecommendedText") {
      if (typeof safeActions.fillRecommendedText === "function") {
        safeActions.fillRecommendedText();
      } else {
        showStatus("暂无 AI 推荐文本。", "error", safeActions);
      }
      return;
    }
    if (actionKey === "ignoreAiResult") {
      if (typeof safeActions.ignoreAiResult === "function") {
        safeActions.ignoreAiResult();
      } else {
        showStatus("暂无 AI 推荐结果。", "error", safeActions);
      }
      return;
    }
    if (actionKey === "sentenceQualified") {
      clickButton(
        findButtonInContainers(".submit-btn", "句子判定", "合格"),
        "未找到句子判定合格按钮。",
        safeActions
      );
      return;
    }
    if (actionKey === "sentenceUnqualified") {
      clickButton(
        findButtonInContainers(".submit-btn", "句子判定", "不合格"),
        "未找到句子判定不合格按钮。",
        safeActions
      );
      return;
    }
    if (actionKey === "taskPass") {
      clickButton(
        findButtonInContainers(".operate-btn", "任务判定", "通过"),
        "未找到任务判定通过按钮。",
        safeActions
      );
      return;
    }
    if (actionKey === "taskPartialReject") {
      clickButton(
        findButtonInContainers(".operate-btn", "任务判定", "部分驳回"),
        "未找到任务判定部分驳回按钮。",
        safeActions
      );
      return;
    }
    if (actionKey === "taskFullReject") {
      clickButton(
        findButtonInContainers(".operate-btn", "任务判定", "全部驳回"),
        "未找到任务判定全部驳回按钮。",
        safeActions
      );
    }
  }

  function createRuntime(options) {
    const config = options && typeof options === "object" ? options : {};
    let shortcuts = normalizeShortcutMap(config.shortcuts);
    let actions = config.actions || {};
    let started = false;

    let lastPageTextValue = "";
    let hasPageTextSnapshot = false;
    let lastUserEditingAt = 0;
    let pageTextCheckTimer = null;
    let pageTextObserver = null;
    let pageTextIntervalTimer = null;
    const handleFocusIn = function (event) {
      markUserEditingByTarget(event.target);
    };
    const handleInput = function (event) {
      markUserEditingByTarget(event.target);
    };

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
      blurActiveElementForShortcut({ force: true, reason: "shortcut" });
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
      }
      runAction(actionKey, actions);
    }

    function markUserEditingByTarget(target) {
      const element = target instanceof Element ? target : null;
      if (!element) {
        return;
      }
      const textarea = findPageTextArea();
      if (textarea && element === textarea) {
        lastUserEditingAt = Date.now();
        return;
      }
      if (isEditableTarget(element)) {
        lastUserEditingAt = Date.now();
      }
    }

    function checkPageTextChanged() {
      const textarea = findPageTextArea();
      if (!textarea) {
        hasPageTextSnapshot = false;
        lastPageTextValue = "";
        return;
      }

      const nextValue = getPageTextValue();
      if (!hasPageTextSnapshot) {
        hasPageTextSnapshot = true;
        lastPageTextValue = nextValue;
        return;
      }

      if (nextValue === lastPageTextValue) {
        return;
      }

      lastPageTextValue = nextValue;

      if (
        document.activeElement === textarea &&
        Date.now() - lastUserEditingAt < USER_EDIT_GRACE_MS
      ) {
        return;
      }

      window.setTimeout(function () {
        const currentTextarea = findPageTextArea();
        if (
          currentTextarea &&
          document.activeElement === currentTextarea &&
          Date.now() - lastUserEditingAt < USER_EDIT_GRACE_MS
        ) {
          return;
        }
        focusPageTextThenExit("page-text-changed");
      }, PAGE_TEXT_CHANGE_DELAY_MS);
    }

    function schedulePageTextCheck() {
      if (pageTextCheckTimer) {
        return;
      }
      pageTextCheckTimer = window.setTimeout(function () {
        pageTextCheckTimer = null;
        checkPageTextChanged();
      }, 80);
    }

    function startPageTextWatchers() {
      if (!pageTextObserver) {
        pageTextObserver = new MutationObserver(schedulePageTextCheck);
        pageTextObserver.observe(document.body || document.documentElement, {
          childList: true,
          subtree: true,
          characterData: true,
        });
      }

      if (!pageTextIntervalTimer) {
        pageTextIntervalTimer = window.setInterval(
          checkPageTextChanged,
          PAGE_TEXT_CHECK_INTERVAL_MS
        );
      }

      schedulePageTextCheck();
    }

    function stopPageTextWatchers() {
      if (pageTextObserver) {
        pageTextObserver.disconnect();
        pageTextObserver = null;
      }
      if (pageTextIntervalTimer) {
        window.clearInterval(pageTextIntervalTimer);
        pageTextIntervalTimer = null;
      }
      if (pageTextCheckTimer) {
        window.clearTimeout(pageTextCheckTimer);
        pageTextCheckTimer = null;
      }
      hasPageTextSnapshot = false;
      lastPageTextValue = "";
      lastUserEditingAt = 0;
    }

    function start() {
      if (started) {
        return;
      }
      started = true;
      window.addEventListener("keydown", handleKeydown, true);
      document.addEventListener("keydown", handleKeydown, true);
      document.addEventListener("focusin", handleFocusIn, true);
      document.addEventListener("input", handleInput, true);
      startPageTextWatchers();
    }

    function stop() {
      if (!started) {
        return;
      }
      started = false;
      window.removeEventListener("keydown", handleKeydown, true);
      document.removeEventListener("keydown", handleKeydown, true);
      document.removeEventListener("focusin", handleFocusIn, true);
      document.removeEventListener("input", handleInput, true);
      stopPageTextWatchers();
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

  globalThis.__ASREdgeDataBakerRoundOneShortcuts = {
    blurActiveElementForShortcut,
    createRuntime,
    findPageTextArea,
    focusPageTextThenExit,
    normalizeShortcut,
  };
})();

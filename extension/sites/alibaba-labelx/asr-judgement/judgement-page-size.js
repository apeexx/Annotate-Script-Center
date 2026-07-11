(function () {
  const DEFAULT_MAX_PAGE_SIZE = 400;
  const nativePageSizes = [1, 2, 3, 4, 5, 10, 20, 30, 40, 50];

  function buildNativePageSize(pageSize) {
    return {
      mode: "native",
      pageSize: pageSize,
      label: String(pageSize) + " 条/页",
      nativeLabel: String(pageSize) + " 条/页",
    };
  }

  function buildCustomPageSize(pageSize) {
    return {
      mode: "custom",
      pageSize: pageSize,
      label: String(pageSize) + " 条/页",
      nativeLabel: "50 条/页",
    };
  }

  function normalizePageSizeSetting(value, allPageSizeValue) {
    const maxPageSize = Number(allPageSizeValue) || DEFAULT_MAX_PAGE_SIZE;
    if (value === "all" || value === "全部") {
      return buildCustomPageSize(maxPageSize);
    }

    const match = String(value || "").match(/\d+/);
    const numericValue = match ? Number(match[0]) : NaN;
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      return buildNativePageSize(50);
    }

    const pageSize = Math.max(1, Math.min(maxPageSize, Math.floor(numericValue)));
    if (nativePageSizes.indexOf(pageSize) >= 0) {
      return buildNativePageSize(pageSize);
    }

    return pageSize === maxPageSize ? buildCustomPageSize(pageSize) : buildNativePageSize(50);
  }

  function getCurrentNativePageSizeLabel() {
    const node = document.querySelector(
      ".ant-v5-pagination-options-size-changer .ant-v5-select-selection-item"
    );
    return String(node?.textContent || node?.getAttribute?.("title") || "").trim();
  }

  function findNativePageSizeOption(label) {
    const options = Array.from(
      document.querySelectorAll(".ant-v5-select-dropdown [role='option'], .ant-v5-select-item-option")
    );

    return (
      options.find(function (option) {
        const text = String(option.textContent || option.getAttribute("title") || "").trim();
        return text === label;
      }) || null
    );
  }

  function dispatchMouseSequence(element) {
    if (!element || typeof element.dispatchEvent !== "function") {
      return false;
    }

    ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach(function (eventName) {
      const EventClass =
        eventName.indexOf("pointer") === 0 && typeof PointerEvent === "function" ? PointerEvent : MouseEvent;
      element.dispatchEvent(
        new EventClass(eventName, {
          bubbles: true,
          cancelable: true,
          view: window,
        })
      );
    });
    return true;
  }

  function clickNativePageSizeOption(label) {
    const changer = document.querySelector(".ant-v5-pagination-options-size-changer");
    if (!changer || typeof changer.dispatchEvent !== "function") {
      return false;
    }

    const trigger =
      changer.querySelector(".ant-v5-select-selector") ||
      changer.querySelector("input[role='combobox']") ||
      changer;
    dispatchMouseSequence(trigger);
    if (typeof trigger.focus === "function") {
      trigger.focus();
    }

    [120, 300, 600].forEach(function (delay) {
      window.setTimeout(function () {
        const option = findNativePageSizeOption(label);
        if (!option) {
          return;
        }

        dispatchMouseSequence(option);
      }, delay);
    });

    return true;
  }

  function createRuntime(options) {
    const deps = options && typeof options === "object" ? options : {};
    let applyTimer = null;
    let applyKey = "";
    let appliedKey = "";
    let applyAttempts = 0;

    function applyConfiguredNativePageSize() {
      if (!deps.shouldApply()) {
        return;
      }

      const pageSize = deps.getPageSize();
      const currentLabel = getCurrentNativePageSizeLabel();
      const currentApplyKey = applyKey;
      let targetLabel = pageSize.nativeLabel;
      let followupLabel = null;

      if (
        pageSize.mode === "custom" &&
        appliedKey === currentApplyKey &&
        currentLabel === pageSize.nativeLabel
      ) {
        return;
      }

      if (pageSize.mode === "custom" && currentLabel === "50 条/页") {
        targetLabel = "40 条/页";
        followupLabel = "50 条/页";
      }

      if (currentLabel === targetLabel) {
        appliedKey = currentApplyKey;
        return;
      }

      applyAttempts += 1;
      if (!clickNativePageSizeOption(targetLabel)) {
        if (applyAttempts <= 20) {
          scheduleApply("selector-not-ready");
        }
        return;
      }

      window.setTimeout(function () {
        const nextLabel = getCurrentNativePageSizeLabel();
        const targetReached =
          nextLabel === targetLabel || (pageSize.mode === "custom" && nextLabel === "50 条/页");

        if (followupLabel && nextLabel === targetLabel) {
          if (clickNativePageSizeOption(followupLabel)) {
            appliedKey = currentApplyKey;
          }
          return;
        }

        if (targetReached) {
          appliedKey = currentApplyKey;
        }

        if (!targetReached && applyAttempts <= 20) {
          scheduleApply("selector-not-applied");
        }
      }, 900);
    }

    function scheduleApply() {
      const pageSize = deps.getPageSize();
      const nextApplyKey = [
        location.pathname,
        location.search,
        pageSize.mode,
        pageSize.pageSize,
      ].join("|");

      if (applyKey !== nextApplyKey) {
        applyKey = nextApplyKey;
        applyAttempts = 0;
      }

      if (applyTimer) {
        window.clearTimeout(applyTimer);
      }

      applyTimer = window.setTimeout(function () {
        applyTimer = null;
        applyConfiguredNativePageSize();
      }, 650);
    }

    function stop() {
      if (applyTimer) {
        window.clearTimeout(applyTimer);
        applyTimer = null;
      }
    }

    return {
      scheduleApply: scheduleApply,
      stop: stop,
    };
  }

  globalThis.__ASREdgeAlibabaLabelxJudgementPageSize = {
    normalizePageSizeSetting: normalizePageSizeSetting,
    getCurrentNativePageSizeLabel: getCurrentNativePageSizeLabel,
    clickNativePageSizeOption: clickNativePageSizeOption,
    createRuntime: createRuntime,
  };
})();

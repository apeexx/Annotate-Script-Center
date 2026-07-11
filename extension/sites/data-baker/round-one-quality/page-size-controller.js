(function () {
  const MAX_ATTEMPTS = 5;
  const RETRY_DELAY_MS = 350;
  const OPTIONS = ["5条/页", "10条/页", "20条/页", "50条/页", "100条/页"];

  function normalizePageSize(value) {
    const text = String(value || "").replace(/\s+/g, "");
    return OPTIONS.indexOf(text) >= 0 ? text : "50条/页";
  }

  function isVisible(element) {
    if (!(element instanceof Element)) {
      return false;
    }
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  }

  function debug(message) {
    if (typeof console !== "undefined" && typeof console.debug === "function") {
      console.debug("[DataBaker][round-one-quality][page-size] " + String(message || ""));
    }
  }

  function findPaginationSelect() {
    return document.querySelector(".roundOneCollect-el-pagination span.el-pagination__sizes .el-select");
  }

  function findVisibleOption(targetText) {
    const dropdowns = Array.from(document.querySelectorAll(".el-select-dropdown.el-popper"));
    for (let index = dropdowns.length - 1; index >= 0; index -= 1) {
      const dropdown = dropdowns[index];
      if (!isVisible(dropdown)) {
        continue;
      }
      const items = Array.from(dropdown.querySelectorAll(".el-select-dropdown__item"));
      const match = items.find(function (item) {
        const span = item.querySelector("span") || item;
        return String(span.textContent || "").replace(/\s+/g, "") === targetText;
      });
      if (match) {
        return match;
      }
    }
    return null;
  }

  function createRuntime(options) {
    const config = options && typeof options === "object" ? options : {};
    let attempts = 0;
    let timer = null;
    let observer = null;
    let stopped = false;
    let completed = false;
    let targetPageSize = normalizePageSize(config.defaultPageSize);

    function applyConfig(nextOptions) {
      const next = nextOptions && typeof nextOptions === "object" ? nextOptions : {};
      targetPageSize = normalizePageSize(next.defaultPageSize || targetPageSize);
    }

    function clearTimer() {
      if (timer) {
        window.clearTimeout(timer);
        timer = null;
      }
    }

    function schedule(delayMs) {
      if (stopped || completed || attempts >= MAX_ATTEMPTS) {
        return;
      }
      clearTimer();
      timer = window.setTimeout(tryApply, typeof delayMs === "number" ? delayMs : RETRY_DELAY_MS);
    }

    function clickSelect(select) {
      const inputWrap = select.querySelector(".el-input") || select;
      inputWrap.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
      inputWrap.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
      inputWrap.click();
    }

    function tryApply() {
      if (stopped || completed) {
        return;
      }
      attempts += 1;

      const select = findPaginationSelect();
      const input = select?.querySelector("input.el-input__inner");
      if (!select || !input) {
        debug("pagination select not ready");
        schedule();
        return;
      }

      const currentText = String(input.value || input.getAttribute("placeholder") || "").replace(/\s+/g, "");
      if (currentText === targetPageSize) {
        completed = true;
        return;
      }

      clickSelect(select);
      window.setTimeout(function () {
        if (stopped || completed) {
          return;
        }
        const option = findVisibleOption(targetPageSize);
        if (!option) {
          debug("target option not found: " + targetPageSize);
          schedule();
          return;
        }
        option.click();
        completed = true;
      }, 120);
    }

    function start() {
      stopped = false;
      attempts = 0;
      completed = false;
      schedule(200);
      observer = new MutationObserver(function () {
        if (!completed) {
          schedule(250);
        }
      });
      observer.observe(document.documentElement || document.body, {
        childList: true,
        subtree: true,
      });
    }

    function stop() {
      stopped = true;
      clearTimer();
      if (observer) {
        observer.disconnect();
        observer = null;
      }
    }

    function refresh(nextOptions) {
      applyConfig(nextOptions);
      attempts = 0;
      completed = false;
      schedule(150);
    }

    return {
      refresh,
      start,
      stop,
    };
  }

  globalThis.__ASREdgeDataBakerRoundOnePageSizeController = {
    createRuntime,
    normalizePageSize,
  };
})();

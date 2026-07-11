(function () {
  function buildResult(ok, extra) {
    return Object.assign(
      {
        ok: ok === true,
        at: new Date().toISOString(),
      },
      extra || {}
    );
  }

  function getTaskItems() {
    return Array.from(document.querySelectorAll(".labelRender-item[data-index]")).sort(function (left, right) {
      const leftIndex = Number(left.getAttribute("data-index"));
      const rightIndex = Number(right.getAttribute("data-index"));
      return (Number.isFinite(leftIndex) ? leftIndex : 0) - (Number.isFinite(rightIndex) ? rightIndex : 0);
    });
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

  function resolveCurrentIndex(result, items) {
    const resultIndex = Number(result?.itemIndex);
    if (Number.isFinite(resultIndex)) {
      return items.findIndex(function (item) {
        return Number(item.getAttribute("data-index")) === resultIndex;
      });
    }

    const selected = document.querySelector(".labelRender-item-selected.labelRender-item[data-index]");
    return selected ? items.indexOf(selected) : -1;
  }

  function createRuntime(deps) {
    const options = deps && typeof deps === "object" ? deps : {};
    let lastResult = null;

    function advance(result) {
      if (options.shouldApply && !options.shouldApply()) {
        lastResult = buildResult(false, {
          reason: "runtime-disabled",
          message: "自动下一题未启用。",
        });
        return lastResult;
      }

      const items = getTaskItems();
      const currentIndex = resolveCurrentIndex(result, items);
      const nextItem = currentIndex >= 0 ? items[currentIndex + 1] : null;
      if (!nextItem) {
        lastResult = buildResult(false, {
          reason: "next-item-not-found",
          currentIndex: currentIndex,
          message: "已选择，当前页没有下一题。",
        });
        return lastResult;
      }

      if (typeof nextItem.scrollIntoView === "function") {
        nextItem.scrollIntoView({
          block: "center",
          inline: "nearest",
          behavior: "smooth",
        });
      }

      dispatchMouseSequence(nextItem);
      const nextIndex = Number(nextItem.getAttribute("data-index"));
      lastResult = buildResult(true, {
        itemIndex: Number.isFinite(nextIndex) ? nextIndex : null,
        message: "已选择，自动跳到第 " + String((Number.isFinite(nextIndex) ? nextIndex : currentIndex + 1) + 1) + " 题。",
      });
      return lastResult;
    }

    function getState() {
      return {
        lastResult: lastResult ? Object.assign({}, lastResult) : null,
      };
    }

    return {
      advance: advance,
      getState: getState,
    };
  }

  globalThis.__ASREdgeAlibabaLabelxJudgementAutoAdvance = {
    createRuntime: createRuntime,
  };
})();

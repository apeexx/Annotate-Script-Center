(function () {
  const actionKeys = {
    submitTask: "submitTask",
    submitTaskAndFinish: "submitTaskAndFinish",
  };

  const actionLabels = {
    submitTask: "提交任务",
    submitTaskAndFinish: "提交任务并结束",
  };

  const submitTaskAction = {
    key: actionKeys.submitTask,
    preferredTexts: ["提交任务"],
    fallbackTexts: ["提交", "提交当前任务"],
    excludeTexts: ["并结束", "结束", "完结", "关闭"],
    notFoundReason: "submit-button-not-found",
    notFoundMessage: "未找到“提交任务”按钮。",
    successMessage: "已触发提交任务，请按页面提示确认。",
  };

  const submitTaskAndFinishAction = {
    key: actionKeys.submitTaskAndFinish,
    preferredTexts: ["提交任务并结束"],
    fallbackTexts: ["提交并结束", "提交后结束", "提交并完结", "提交任务并关闭", "提交并关闭"],
    excludeTexts: [],
    notFoundReason: "submit-finish-button-not-found",
    notFoundMessage: "未找到“提交任务并结束”按钮。",
    successMessage: "已触发提交任务并结束，请按页面提示确认。",
  };

  function normalizeText(text) {
    return String(text || "").replace(/\s+/g, "");
  }

  function getButtonText(element) {
    return normalizeText(element?.innerText || element?.textContent || "");
  }

  function isVisibleElement(element) {
    if (!(element instanceof Element)) {
      return false;
    }
    if (element.offsetParent !== null) {
      return true;
    }
    return element.getClientRects().length > 0;
  }

  function isDisabledButton(element) {
    if (!(element instanceof Element)) {
      return true;
    }
    if (element.hasAttribute("disabled")) {
      return true;
    }
    if (String(element.getAttribute("aria-disabled") || "").toLowerCase() === "true") {
      return true;
    }
    const className = String(element.className || "").toLowerCase();
    if (className.indexOf("disabled") >= 0 || className.indexOf("ant-btn-disabled") >= 0) {
      return true;
    }
    return false;
  }

  function findButtonByTexts(preferredTexts, fallbackTexts, excludeTexts) {
    const preferred = Array.isArray(preferredTexts) ? preferredTexts.map(normalizeText).filter(Boolean) : [];
    const fallback = Array.isArray(fallbackTexts) ? fallbackTexts.map(normalizeText).filter(Boolean) : [];
    const excludes = Array.isArray(excludeTexts) ? excludeTexts.map(normalizeText).filter(Boolean) : [];
    const elements = Array.from(
      document.querySelectorAll("button, .ant-btn, [role='button'], input[type='button'], input[type='submit']")
    );
    const candidates = elements.filter(function (element) {
      if (!isVisibleElement(element) || isDisabledButton(element)) {
        return false;
      }
      const text = getButtonText(element);
      if (!text) {
        return false;
      }
      return excludes.every(function (excludeText) {
        return text.indexOf(excludeText) < 0;
      });
    });

    function pick(targets) {
      for (let i = 0; i < targets.length; i += 1) {
        const target = targets[i];
        const matched = candidates.find(function (element) {
          return getButtonText(element).indexOf(target) >= 0;
        });
        if (matched) {
          return matched;
        }
      }
      return null;
    }

    return pick(preferred) || pick(fallback) || null;
  }

  function getSubmitAction(actionKey) {
    if (actionKey === actionKeys.submitTask) {
      return submitTaskAction;
    }
    if (actionKey === actionKeys.submitTaskAndFinish) {
      return submitTaskAndFinishAction;
    }
    return null;
  }

  function findSubmitButton(actionKey) {
    const action = getSubmitAction(actionKey);
    if (!action) {
      return null;
    }
    return findButtonByTexts(action.preferredTexts, action.fallbackTexts, action.excludeTexts);
  }

  function runAction(actionKey) {
    const action = getSubmitAction(actionKey);
    if (!action) {
      return {
        ok: false,
        action: String(actionKey || ""),
        reason: "unknown-submit-action",
        message: "未知提交动作。",
      };
    }
    const button = findSubmitButton(actionKey);
    if (!button || isDisabledButton(button)) {
      return {
        ok: false,
        action: action.key,
        reason: action.notFoundReason,
        message: action.notFoundMessage,
      };
    }
    button.click();
    return {
      ok: true,
      action: action.key,
      message: action.successMessage,
    };
  }

  function submitTask() {
    return runAction(actionKeys.submitTask);
  }

  function submitTaskAndFinish() {
    return runAction(actionKeys.submitTaskAndFinish);
  }

  globalThis.__ASREdgeAlibabaLabelxSubmitActions = {
    actionKeys: actionKeys,
    actionLabels: actionLabels,
    getSubmitAction: getSubmitAction,
    findSubmitButton: findSubmitButton,
    submitTask: submitTask,
    submitTaskAndFinish: submitTaskAndFinish,
    runAction: runAction,
  };
})();

(function () {
  const choiceActions = [
    {
      key: "choiceFirstBetter",
      label: "第一个更好",
      shortLabel: "1 第一个",
      value: "第一个更好",
      index: 0,
    },
    {
      key: "choiceSecondBetter",
      label: "第二个更好",
      shortLabel: "2 第二个",
      value: "第二个更好",
      index: 1,
    },
    {
      key: "choiceBothBad",
      label: "都不好",
      shortLabel: "3 都不好",
      value: "都不好",
      index: 2,
    },
    {
      key: "choiceUnsure",
      label: "不确定或差不多",
      shortLabel: "4 不确定",
      value: "不确定或差不多",
      index: 3,
    },
    {
      key: "choiceOtherDialect",
      label: "其他方言或语种",
      shortLabel: "5 其他",
      value: "其他方言或语种",
      index: 4,
    },
  ];
  const audioActionLabels = {
    volumeUp: "音量 +",
    volumeDown: "音量 -",
    volumeReset: "重置音量",
    rateUp: "倍速 +",
    rateDown: "倍速 -",
    rateReset: "重置倍速",
    seekBackward: "后退",
    seekForward: "前进",
  };
  const shortcutActionOrder = [
    "choiceFirstBetter",
    "choiceSecondBetter",
    "choiceBothBad",
    "choiceUnsure",
    "choiceOtherDialect",
    "submitTask",
    "submitTaskAndFinish",
    "volumeUp",
    "volumeDown",
    "volumeReset",
    "rateUp",
    "rateDown",
    "rateReset",
    "seekBackward",
    "seekForward",
    "playPause",
    "aiSuggestCurrentItem",
  ];
  const sharedSubmitActions = globalThis.__ASREdgeAlibabaLabelxSubmitActions || null;


  function buildActionResult(action, ok, extra) {
    return Object.assign(
      {
        action: action,
        ok: ok === true,
        at: new Date().toISOString(),
      },
      extra || {}
    );
  }

  function getChoiceAction(actionKey) {
    return (
      choiceActions.find(function (choice) {
        return choice.key === actionKey;
      }) || null
    );
  }

  function getTaskItems() {
    return Array.from(document.querySelectorAll(".labelRender-item[data-index]")).sort(function (left, right) {
      const leftIndex = Number(left.getAttribute("data-index"));
      const rightIndex = Number(right.getAttribute("data-index"));
      return (Number.isFinite(leftIndex) ? leftIndex : 0) - (Number.isFinite(rightIndex) ? rightIndex : 0);
    });
  }

  function parseAnswerNavIndex(text) {
    const match = String(text || "").match(/第\s*(\d+)\s*题/);
    if (!match) {
      return null;
    }

    const questionNumber = Number(match[1]);
    return Number.isFinite(questionNumber) && questionNumber > 0 ? questionNumber - 1 : null;
  }

  function resolveAnswerNavItem() {
    const selectedStatus = document.querySelector(
      ".labelRender-item-selected .labelRender-answerNav-status"
    );
    const statusNode = selectedStatus || document.querySelector(".labelRender-answerNav-status");
    const itemIndex = parseAnswerNavIndex(statusNode?.textContent || "");
    if (itemIndex === null) {
      return null;
    }

    return (
      document.querySelector('.labelRender-item[data-index="' + String(itemIndex) + '"]') ||
      null
    );
  }

  function getItemLabel(item) {
    const index = item ? Number(item.getAttribute("data-index")) : -1;
    return Number.isFinite(index) && index >= 0 ? "第 " + String(index + 1) + " 条题卡" : "当前题卡";
  }

  function resolveCurrentItem() {
    const selectedItem = document.querySelector(".labelRender-item-selected.labelRender-item[data-index]");
    if (selectedItem) {
      return selectedItem;
    }

    const playingAudio = Array.from(document.querySelectorAll("audio[controls]")).find(function (audio) {
      return audio && !audio.paused && !audio.ended;
    });
    const playingItem = playingAudio?.closest ? playingAudio.closest(".labelRender-item[data-index]") : null;
    if (playingItem) {
      return playingItem;
    }

    return resolveAnswerNavItem();
  }

  function getChoiceInputs(item) {
    if (!item) {
      return [];
    }

    const answerWraps = Array.from(item.querySelectorAll(".labelRender-item-answer-wrap"));
    const targetWrap = answerWraps.find(function (wrap) {
      const title = wrap.querySelector(".labelRender-item-answer-title");
      return String(title?.textContent || "").indexOf("哪个ASR更优") >= 0;
    });
    const scope = targetWrap || item;
    return Array.from(scope.querySelectorAll(".ant-v5-radio-wrapper input[type='radio'], input[type='radio']"));
  }

  function getInputLabel(input) {
    const label = input?.closest ? input.closest("label") : null;
    const labelNode = label ? label.querySelector(".ant-v5-radio-label") : null;
    return String(labelNode?.textContent || input?.value || "").trim();
  }

  function resolveChoiceInput(item, choice) {
    const inputs = getChoiceInputs(item);
    if (inputs.length === 0) {
      return null;
    }

    return (
      inputs.find(function (input) {
        return input.value === choice.value || getInputLabel(input) === choice.value;
      }) ||
      inputs[choice.index] ||
      null
    );
  }

  function forceRadioChange(input) {
    const checkedDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "checked");
    if (checkedDescriptor && typeof checkedDescriptor.set === "function") {
      checkedDescriptor.set.call(input, true);
    } else {
      input.checked = true;
    }

    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function selectJudgementChoice(actionKey) {
    const choice = getChoiceAction(actionKey);
    if (!choice) {
      return buildActionResult(actionKey, false, {
        reason: "unknown-choice-action",
        message: "未识别的判别选项动作：" + String(actionKey),
      });
    }

    const item = resolveCurrentItem();
    if (!item) {
      return buildActionResult(actionKey, false, {
        reason: "current-item-not-found",
        message: "未找到当前题卡，请先点击要判别的题卡。",
      });
    }

    const input = resolveChoiceInput(item, choice);
    if (!input) {
      return buildActionResult(actionKey, false, {
        reason: "radio-not-found",
        message: getItemLabel(item) + "未找到“" + choice.label + "”选项。",
      });
    }

    if (input.disabled) {
      return buildActionResult(actionKey, false, {
        reason: "radio-disabled",
        message: getItemLabel(item) + "的“" + choice.label + "”不可选择。",
      });
    }

    if (input.checked) {
      return buildActionResult(actionKey, true, {
        choice: choice.value,
        itemIndex: Number(item.getAttribute("data-index")),
        message: getItemLabel(item) + "已是：" + choice.label,
      });
    }

    const label = input.closest ? input.closest("label") : null;
    if (typeof input.click === "function") {
      input.click();
    } else if (label && typeof label.click === "function") {
      label.click();
    }

    if (!input.checked) {
      forceRadioChange(input);
    }

    return buildActionResult(actionKey, true, {
      choice: choice.value,
      itemIndex: Number(item.getAttribute("data-index")),
      message: getItemLabel(item) + "已选择：" + choice.label,
    });
  }

  function submitTask() {
    if (sharedSubmitActions && typeof sharedSubmitActions.runAction === "function") {
      return sharedSubmitActions.runAction("submitTask");
    }
    return buildActionResult("submitTask", false, {
      reason: "submit-module-missing",
      message: "提交模块未加载。",
    });
  }

  function submitTaskAndFinish() {
    if (sharedSubmitActions && typeof sharedSubmitActions.runAction === "function") {
      return sharedSubmitActions.runAction("submitTaskAndFinish");
    }
    return buildActionResult("submitTaskAndFinish", false, {
      reason: "submit-module-missing",
      message: "提交模块未加载。",
    });
  }

  globalThis.__ASREdgeAlibabaLabelxJudgementActions = {
    choiceActions: choiceActions,
    audioActionLabels: audioActionLabels,
    shortcutActionOrder: shortcutActionOrder,
    buildActionResult: buildActionResult,
    getChoiceAction: getChoiceAction,
    selectJudgementChoice: selectJudgementChoice,
    submitTask: submitTask,
    submitTaskAndFinish: submitTaskAndFinish,
  };
})();

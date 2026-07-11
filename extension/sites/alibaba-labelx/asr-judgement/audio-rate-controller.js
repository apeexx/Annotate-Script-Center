(function () {
  function formatRate(rate) {
    return Number.isInteger(rate)
      ? String(rate) + "x"
      : Number(rate).toFixed(2).replace(/0$/, "").replace(/0$/, "") + "x";
  }

  function updateVisibleRate(audio, rate) {
    const container = audio.closest ? audio.closest(".dt-audio-base-container") : null;
    const speedNode = container ? container.querySelector(".ant-v5-select-selection-item") : null;
    if (!speedNode) {
      return;
    }

    const label = formatRate(rate);
    speedNode.textContent = label;
    speedNode.title = label;
  }

  function setRuntimeRate(rateValue, reason, deps) {
    const audio = deps.resolveCurrentAudio();
    if (!audio) {
      return deps.buildActionResult(reason || "rate", false, {
        reason: "audio-not-found",
        message: "未找到可调整倍速的音频。",
      });
    }

    const fallbackRate =
      typeof deps.getCurrentAudioPlaybackRate === "function"
        ? deps.getCurrentAudioPlaybackRate(audio)
        : deps.getDefaultPlaybackRate();
    const nextRateValue = deps.clampNumber(rateValue, fallbackRate, 0.25, 5, 2);
    if (typeof deps.setCurrentAudioPlaybackRate === "function") {
      deps.setCurrentAudioPlaybackRate(audio, nextRateValue, reason || "rate");
    } else {
      audio.playbackRate = nextRateValue;
      updateVisibleRate(audio, nextRateValue);
      deps.updateCurrentAudioState(audio);
    }

    return deps.buildActionResult(reason || "rate", true, {
      playbackRateValue: nextRateValue,
      message:
        reason === "rate-reset"
          ? deps.getCurrentItemLabel() + "倍速已重置为 " + formatRate(nextRateValue)
          : deps.getCurrentItemLabel() + "倍速已调整为 " + formatRate(nextRateValue),
    });
  }

  function adjustRate(direction, deps) {
    const nextRate = deps.getCurrentAudioPlaybackRate() + direction * deps.getConfig().rateStepValue;
    return setRuntimeRate(nextRate, direction > 0 ? "rate-up" : "rate-down", deps);
  }

  function resetRate(deps) {
    return setRuntimeRate(deps.getDefaultPlaybackRate(), "rate-reset", deps);
  }

  globalThis.__ASREdgeAlibabaLabelxJudgementRateController = {
    formatRate: formatRate,
    updateVisibleRate: updateVisibleRate,
    setRuntimeRate: setRuntimeRate,
    adjustRate: adjustRate,
    resetRate: resetRate,
  };
})();

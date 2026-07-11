(function () {
  const LOG_PREFIX = "[ASR Edge][judgement-audio-controller]";
  const sharedCore = globalThis.__ASREdgeAlibabaLabelxSharedAudioControllerCore || null;
  const rateController = globalThis.__ASREdgeAlibabaLabelxJudgementRateController || null;

  if (!sharedCore || typeof sharedCore.createAudioRuntime !== "function") {
    globalThis.__ASREdgeAlibabaLabelxJudgementAudioController = {
      start: function () {},
      stop: function () {},
      updateConfig: function () {},
      scan: function () {},
      runAction: function (actionKey) {
        return Promise.resolve({
          ok: false,
          reason: "shared-audio-core-missing",
          actionKey: actionKey,
          message: "通用音频核心模块未加载。",
        });
      },
      getState: function () {
        return {
          started: false,
          reason: "shared-audio-core-missing",
        };
      },
      LOG_PREFIX: LOG_PREFIX,
    };
    return;
  }

  function getTaskItems() {
    return Array.from(document.querySelectorAll(".labelRender-item[data-index]")).sort(function (left, right) {
      const leftIndex = Number(left.getAttribute("data-index"));
      const rightIndex = Number(right.getAttribute("data-index"));
      return (Number.isFinite(leftIndex) ? leftIndex : 0) - (Number.isFinite(rightIndex) ? rightIndex : 0);
    });
  }

  function getItemAudio(item) {
    if (!item) {
      return null;
    }
    const audio = item.querySelector(".dt-audio-base-container audio[controls], audio[controls]");
    return audio instanceof HTMLAudioElement ? audio : null;
  }

  function resolveSelectedItem() {
    return document.querySelector(".labelRender-item-selected.labelRender-item[data-index]");
  }

  function resolveSelectedAudio(audios) {
    const selectedAudio = getItemAudio(resolveSelectedItem());
    if (selectedAudio instanceof HTMLAudioElement) {
      return selectedAudio;
    }
    const list = Array.isArray(audios) ? audios : [];
    const playingAudio = list.find(function (audio) {
      return !audio.paused && !audio.ended;
    });
    if (playingAudio) {
      return playingAudio;
    }
    return list[0] || null;
  }

  const runtime = sharedCore.createAudioRuntime({
    defaultConfig: {
      autoPlay: true,
      resetRateValue: 2.0,
      playbackRateValue: 2.0,
      rateStepValue: 0.25,
      seekStepSeconds: 0.5,
      volumeValue: 100,
    },
    getTaskItems: getTaskItems,
    getItemAudio: getItemAudio,
    resolveSelectedItem: resolveSelectedItem,
    resolveSelectedAudio: resolveSelectedAudio,
    updateVisibleRate: function (audio, rateValue) {
      if (rateController && typeof rateController.updateVisibleRate === "function") {
        rateController.updateVisibleRate(audio, rateValue);
      }
    },
  });

  globalThis.__ASREdgeAlibabaLabelxJudgementAudioController = {
    start: runtime.start,
    stop: runtime.stop,
    updateConfig: runtime.updateConfig,
    scan: runtime.scan,
    runAction: runtime.runAction,
    getState: runtime.getState,
    LOG_PREFIX: LOG_PREFIX,
  };
})();

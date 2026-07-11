(function () {
  const sharedCore = globalThis.__ASREdgeAlibabaLabelxSharedAudioControllerCore || null;
  const activeItemApi = globalThis.__ASREdgeAlibabaLabelxTranscriptionActiveItem || null;

  if (!sharedCore || typeof sharedCore.createAudioRuntime !== "function") {
    globalThis.__ASREdgeAlibabaLabelxTranscriptionAudioController = {
      start: function () {},
      stop: function () {},
      updateConfig: function () {},
      scan: function () {},
      resolveCurrentAudio: function () {
        return null;
      },
      playPauseCurrentAudio: function () {
        return Promise.resolve({ ok: false, message: "通用音频核心模块未加载。" });
      },
      seekCurrentAudio: function () {
        return Promise.resolve({ ok: false, message: "通用音频核心模块未加载。" });
      },
      adjustPlaybackRate: function () {
        return { ok: false, message: "通用音频核心模块未加载。" };
      },
      setPlaybackRate: function () {
        return { ok: false, message: "通用音频核心模块未加载。" };
      },
      adjustVolumePercent: function () {
        return { ok: false, message: "通用音频核心模块未加载。" };
      },
      setVolumePercent: function () {
        return { ok: false, message: "通用音频核心模块未加载。" };
      },
      copyCurrentAudioDuration: function () {
        return Promise.resolve({ ok: false, message: "通用音频核心模块未加载。" });
      },
      autoPlayCurrentAudioIfNeeded: function () {
        return Promise.resolve({ ok: false, skipped: true });
      },
      getCurrentAudioSnapshot: function () {
        return { found: false };
      },
      getState: function () {
        return {
          started: false,
          reason: "shared-audio-core-missing",
        };
      },
    };
    return;
  }

  function getTaskItems() {
    if (activeItemApi && typeof activeItemApi.getVisibleItems === "function") {
      return activeItemApi.getVisibleItems();
    }
    return Array.from(document.querySelectorAll(".labelRender-item"));
  }

  function getItemAudio(item) {
    if (!item) {
      return null;
    }
    const audio =
      activeItemApi && typeof activeItemApi.getItemAudio === "function"
        ? activeItemApi.getItemAudio(item)
        : item.querySelector("audio");
    return audio instanceof HTMLAudioElement ? audio : null;
  }

  function resolveSelectedItem() {
    if (activeItemApi && typeof activeItemApi.resolveCurrentItem === "function") {
      const resolved = activeItemApi.resolveCurrentItem();
      if (resolved && resolved.item instanceof Element) {
        return resolved.item;
      }
    }
    return document.querySelector(".labelRender-item-selected, .labelRender-item.active");
  }

  function resolveCurrentAudioFromContext() {
    if (activeItemApi && typeof activeItemApi.getCurrentContext === "function") {
      const context = activeItemApi.getCurrentContext();
      if (context && context.audio instanceof HTMLAudioElement) {
        return context.audio;
      }
    }
    const playingAudio = Array.from(document.querySelectorAll("audio")).find(function (audio) {
      return audio instanceof HTMLAudioElement && !audio.paused && !audio.ended;
    });
    if (playingAudio) {
      return playingAudio;
    }
    const fallback = Array.from(document.querySelectorAll(".labelRender-item audio")).find(function (audio) {
      return audio instanceof HTMLAudioElement;
    });
    return fallback || null;
  }

  function resolveSelectedAudio(audios) {
    const selectedItem = resolveSelectedItem();
    const selectedAudio = getItemAudio(selectedItem);
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
      resetRateValue: 1.5,
      playbackRateValue: 1.5,
      rateStepValue: 0.25,
      seekStepSeconds: 0.5,
      volumeValue: 100,
    },
    getTaskItems: getTaskItems,
    getItemAudio: getItemAudio,
    resolveSelectedItem: resolveSelectedItem,
    resolveSelectedAudio: resolveSelectedAudio,
    resolveCurrentAudio: function () {
      return resolveCurrentAudioFromContext();
    },
  });

  globalThis.__ASREdgeAlibabaLabelxTranscriptionAudioController = {
    start: runtime.start,
    stop: runtime.stop,
    updateConfig: runtime.updateConfig,
    scan: runtime.scan,
    resolveCurrentAudio: runtime.resolveCurrentAudio,
    playPauseCurrentAudio: runtime.playPauseCurrentAudio,
    seekCurrentAudio: runtime.seekCurrentAudio,
    adjustPlaybackRate: runtime.adjustPlaybackRate,
    setPlaybackRate: runtime.setPlaybackRate,
    adjustVolumePercent: runtime.adjustVolumePercent,
    setVolumePercent: runtime.setVolumePercent,
    copyCurrentAudioDuration: runtime.copyCurrentAudioDuration,
    autoPlayCurrentAudioIfNeeded: runtime.autoPlayCurrentAudioIfNeeded,
    getCurrentAudioSnapshot: runtime.getCurrentAudioSnapshot,
    getState: runtime.getState,
  };
})();

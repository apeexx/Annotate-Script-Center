(function () {
  function playAudio(audio, reason, deps) {
    if (!audio) {
      return Promise.resolve(
        deps.buildActionResult(reason || "play", false, {
          reason: "audio-not-found",
          message: "未找到可播放的音频。",
        })
      );
    }

    deps.applyAudio(audio, reason || "play");
    deps.pauseOtherAudios(audio);
    deps.updateCurrentAudioState(audio);

    return Promise.resolve(audio.play())
      .then(function () {
        return deps.buildActionResult(reason || "play", true, {
          currentAudioIndex: deps.getCurrentAudioIndex(),
          message: deps.getCurrentItemLabel() + "开始播放",
        });
      })
      .catch(function (error) {
        const result = deps.buildActionResult(reason || "play", false, {
          currentAudioIndex: deps.getCurrentAudioIndex(),
          reason: error && error.message ? error.message : String(error),
          message: "播放失败：" + (error && error.message ? error.message : String(error)),
        });
        deps.setLastError(result.reason);
        return result;
      });
  }

  function autoplay(audio, reason, deps) {
    if (!audio || deps.getConfig().autoPlay !== true) {
      return;
    }

    const meta = deps.getAudioMeta(audio);
    const signature = deps.getAudioSourceSignature(audio);
    if (meta.lastAutoplaySignature === signature) {
      return;
    }

    meta.lastAutoplaySignature = signature;
    void playAudio(audio, reason || "autoplay", deps).then(function (result) {
      deps.setLastAutoplay(
        Object.assign({}, result, {
          src: signature,
        })
      );
    });
  }

  function resolveAutoplayTarget(audios) {
    const selectedItem = document.querySelector(".labelRender-item-selected audio[controls]");
    if (selectedItem && audios.indexOf(selectedItem) >= 0) {
      return selectedItem;
    }

    return audios[0] || null;
  }

  function playPauseCurrent(deps) {
    const audio = deps.resolveCurrentAudio();
    if (!audio) {
      return Promise.resolve({
        ok: false,
        reason: "audio-not-found",
        message: "未找到可控制的音频。",
      });
    }

    if (audio.paused || audio.ended) {
      return playAudio(audio, "play-pause", deps);
    }

    audio.pause();
    deps.updateCurrentAudioState(audio);
    return Promise.resolve(
      deps.buildActionResult("play-pause", true, {
        paused: true,
        currentAudioIndex: deps.getCurrentAudioIndex(),
        message: deps.getCurrentItemLabel() + "已暂停",
      })
    );
  }

  function playRelative(offset, deps) {
    const items = deps.getTaskItems();
    if (items.length === 0) {
      return Promise.resolve({
        ok: false,
        reason: "item-not-found",
      });
    }

    const currentAudio = deps.resolveCurrentAudio();
    const currentItem = deps.getItemForAudio(currentAudio);
    let currentIndex = items.indexOf(currentItem);
    if (currentIndex < 0) {
      currentIndex = offset > 0 ? -1 : 0;
    }

    const nextIndex = Math.max(0, Math.min(items.length - 1, currentIndex + offset));
    const nextAudio = deps.getItemAudio(items[nextIndex]);
    return playAudio(nextAudio, offset > 0 ? "play-next" : "play-previous", deps);
  }

  function formatSeconds(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return "0 秒";
    }

    return Number(numericValue.toFixed(2)).toString() + " 秒";
  }

  function seekCurrent(direction, deps) {
    const audio = deps.resolveCurrentAudio();
    const reason = direction > 0 ? "seek-forward" : "seek-backward";
    if (!audio) {
      return Promise.resolve(
        deps.buildActionResult(reason, false, {
          reason: "audio-not-found",
          message: "未找到可前进 / 后退的音频。",
        })
      );
    }

    const stepSeconds = deps.getSeekStepSeconds();
    const currentTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : null;
    const nextTime = Math.max(
      0,
      duration === null
        ? currentTime + direction * stepSeconds
        : Math.min(duration, currentTime + direction * stepSeconds)
    );

    try {
      deps.applyAudio(audio, reason);
      audio.currentTime = nextTime;
      deps.updateCurrentAudioState(audio);
      return Promise.resolve(
        deps.buildActionResult(reason, true, {
          currentAudioIndex: deps.getCurrentAudioIndex(),
          currentTime: nextTime,
          seekStepSeconds: stepSeconds,
          message:
            deps.getCurrentItemLabel() +
            (direction > 0 ? "已前进 " : "已后退 ") +
            formatSeconds(stepSeconds),
        })
      );
    } catch (error) {
      const result = deps.buildActionResult(reason, false, {
        reason: error && error.message ? error.message : String(error),
        message: "调整播放位置失败：" + (error && error.message ? error.message : String(error)),
      });
      deps.setLastError(result.reason);
      return Promise.resolve(result);
    }
  }

  globalThis.__ASREdgeAlibabaLabelxJudgementPlaybackController = {
    playAudio: playAudio,
    autoplay: autoplay,
    resolveAutoplayTarget: resolveAutoplayTarget,
    playPauseCurrent: playPauseCurrent,
    playRelative: playRelative,
    seekCurrent: seekCurrent,
  };
})();

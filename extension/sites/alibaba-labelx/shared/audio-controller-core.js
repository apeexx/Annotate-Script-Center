(function () {
  function clampNumber(value, fallback, min, max, precision) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return fallback;
    }
    const clamped = Math.max(min, Math.min(max, numericValue));
    return typeof precision === "number" ? Number(clamped.toFixed(precision)) : clamped;
  }

  function createAudioRuntime(profile) {
    const safeProfile = profile && typeof profile === "object" ? profile : {};
    const audioMetaMap = new WeakMap();
    let audioContext = null;
    let observer = null;
    let scanTimer = null;
    let started = false;
    let config = normalizeConfig(safeProfile.defaultConfig || {});
    let lastSelectedItemKey = "";
    let lastSelectedAudio = null;
    let state = {
      audioCount: 0,
      currentAudioIndex: -1,
      lastApplyAt: null,
      lastApplyReason: "",
      lastAction: null,
      lastAutoplay: null,
      lastError: null,
    };

    function normalizeConfig(nextConfig) {
      const input = nextConfig && typeof nextConfig === "object" ? nextConfig : {};
      const defaultRate = clampNumber(
        input.resetRateValue ?? input.playbackRateValue,
        1.0,
        0.25,
        5,
        2
      );
      const rateStepValue = normalizeStep(input.rateStepValue, [0.1, 0.25, 0.5, 1], 0.25);
      const seekStepSeconds = normalizeStep(input.seekStepSeconds, [0.1, 0.25, 0.5, 1], 0.5);
      return {
        autoPlay: input.autoPlay === true,
        resetRateValue: defaultRate,
        playbackRateValue: defaultRate,
        rateStepValue: rateStepValue,
        seekStepSeconds: seekStepSeconds,
        volumeValue: clampNumber(input.volumeValue, 100, 0, 1000, 0),
      };
    }

    function normalizeStep(value, allowedValues, fallback) {
      const numericValue = Number(value);
      if (allowedValues.indexOf(numericValue) >= 0) {
        return numericValue;
      }
      return allowedValues.indexOf(fallback) >= 0 ? fallback : allowedValues[0];
    }

    function clone(value) {
      return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
    }

    function getDefaultPlaybackRate() {
      return clampNumber(config.resetRateValue ?? config.playbackRateValue, 1.0, 0.25, 5, 2);
    }

    function getDefaultVolume() {
      return clampNumber(config.volumeValue, 100, 0, 1000, 0);
    }

    function getAudioContext() {
      if (!audioContext) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
          return null;
        }
        audioContext = new AudioContextClass();
      }
      if (audioContext.state === "suspended") {
        void audioContext.resume().catch(function () {});
      }
      return audioContext;
    }

    function getAudioMeta(audio) {
      let meta = audioMetaMap.get(audio);
      if (!meta) {
        meta = {
          sourceSignature: "",
          listenersBound: false,
          volumeValue: getDefaultVolume(),
          playbackRateValue: getDefaultPlaybackRate(),
          lastApplySignature: "",
          gainNode: null,
          sourceNode: null,
          applyingRate: false,
          verifyTimer: null,
          verifyAttempt: 0,
          verifyExpectedRate: 0,
          verifyReason: "",
        };
        audioMetaMap.set(audio, meta);
      }
      return meta;
    }

    function getAudioSourceSignature(audio) {
      return audio.currentSrc || audio.src || audio.querySelector("source")?.src || "inline-audio";
    }

    function setLastError(message) {
      state.lastError = String(message || "");
    }

    function setLastAutoplay(payload) {
      state.lastAutoplay = clone(payload);
    }

    function buildActionResult(action, ok, extra) {
      const result = Object.assign(
        {
          action: action,
          ok: ok === true,
          at: new Date().toISOString(),
        },
        extra || {}
      );
      state.lastAction = clone(result);
      return clone(result);
    }

    function getTaskItems() {
      if (typeof safeProfile.getTaskItems === "function") {
        const items = safeProfile.getTaskItems() || [];
        return Array.isArray(items) ? items : [];
      }
      return Array.from(document.querySelectorAll(".labelRender-item[data-index]")).sort(function (left, right) {
        const leftIndex = Number(left.getAttribute("data-index"));
        const rightIndex = Number(right.getAttribute("data-index"));
        return (Number.isFinite(leftIndex) ? leftIndex : 0) - (Number.isFinite(rightIndex) ? rightIndex : 0);
      });
    }

    function getItemAudio(item) {
      if (typeof safeProfile.getItemAudio === "function") {
        return safeProfile.getItemAudio(item) || null;
      }
      return item ? item.querySelector("audio[controls], audio") : null;
    }

    function getAudios() {
      if (typeof safeProfile.getAudios === "function") {
        const audios = safeProfile.getAudios() || [];
        return (Array.isArray(audios) ? audios : []).filter(function (audio) {
          return audio instanceof HTMLAudioElement && audio.isConnected;
        });
      }
      return Array.from(document.querySelectorAll("audio[controls], audio")).filter(function (audio) {
        return audio instanceof HTMLAudioElement && audio.isConnected;
      });
    }

    function getItemForAudio(audio) {
      if (!(audio instanceof HTMLAudioElement) || typeof audio.closest !== "function") {
        return null;
      }
      if (typeof safeProfile.getItemForAudio === "function") {
        return safeProfile.getItemForAudio(audio) || null;
      }
      return audio.closest(".labelRender-item[data-index]") || null;
    }

    function resolveSelectedItem() {
      if (typeof safeProfile.resolveSelectedItem === "function") {
        return safeProfile.resolveSelectedItem() || null;
      }
      return document.querySelector(".labelRender-item-selected.labelRender-item[data-index]") || null;
    }

    function resolveSelectedAudio(audios) {
      if (typeof safeProfile.resolveSelectedAudio === "function") {
        return safeProfile.resolveSelectedAudio(audios || getAudios()) || null;
      }
      const selectedItem = resolveSelectedItem();
      const selectedAudio = getItemAudio(selectedItem);
      if (selectedAudio instanceof HTMLAudioElement) {
        return selectedAudio;
      }
      const playingAudio = (audios || getAudios()).find(function (audio) {
        return !audio.paused && !audio.ended;
      });
      return playingAudio || (audios || getAudios())[0] || null;
    }

    function resolveCurrentAudio() {
      const audios = getAudios();
      if (typeof safeProfile.resolveCurrentAudio === "function") {
        const resolved = safeProfile.resolveCurrentAudio(audios);
        if (resolved instanceof HTMLAudioElement) {
          return resolved;
        }
      }
      return resolveSelectedAudio(audios);
    }

    function getSelectedItemKey(selectedItem, selectedAudio) {
      if (typeof safeProfile.getSelectedItemKey === "function") {
        return String(safeProfile.getSelectedItemKey(selectedItem, selectedAudio) || "");
      }
      const item = selectedItem || getItemForAudio(selectedAudio);
      if (item) {
        const itemId = String(item.getAttribute("data-id") || "").trim();
        const itemIndex = String(item.getAttribute("data-index") || "").trim();
        if (itemId) {
          return "item-id:" + itemId;
        }
        if (itemIndex) {
          return "item-index:" + itemIndex;
        }
      }
      const sourceSignature = selectedAudio ? getAudioSourceSignature(selectedAudio) : "";
      return sourceSignature ? "audio:" + sourceSignature : "";
    }

    function updateCurrentAudioState(audio) {
      const item = getItemForAudio(audio);
      const index = item ? Number(item.getAttribute("data-index")) : -1;
      state.currentAudioIndex = Number.isFinite(index) ? index : -1;
    }

    function getCurrentItemLabel() {
      if (state.currentAudioIndex >= 0) {
        return "第 " + String(state.currentAudioIndex + 1) + " 条音频";
      }
      return "当前音频";
    }

    function pauseAllExcept(targetAudio) {
      getAudios().forEach(function (audio) {
        if (audio !== targetAudio && !audio.paused) {
          hardPauseAudio(audio);
        }
      });
    }

    function hardPauseAudio(audio) {
      if (!(audio instanceof HTMLAudioElement)) {
        return;
      }
      try {
        audio.pause();
      } catch (error) {
        setLastError(error && error.message ? error.message : String(error));
      }
    }

    function setAudioVolume(audio, volumePercent) {
      const normalizedVolume = clampNumber(volumePercent, getDefaultVolume(), 0, 1000, 0);
      const meta = getAudioMeta(audio);
      if (!meta.gainNode && normalizedVolume <= 100) {
        audio.volume = Math.max(0, Math.min(normalizedVolume / 100, 1));
        return;
      }
      try {
        if (!meta.gainNode) {
          const context = getAudioContext();
          if (!context) {
            throw new Error("AudioContext not supported");
          }
          meta.sourceNode = context.createMediaElementSource(audio);
          meta.gainNode = context.createGain();
          meta.sourceNode.connect(meta.gainNode);
          meta.gainNode.connect(context.destination);
        }
        audio.volume = 1;
        meta.gainNode.gain.value = normalizedVolume / 100;
      } catch (error) {
        audio.volume = Math.max(0, Math.min(normalizedVolume / 100, 1));
        setLastError(error && error.message ? error.message : String(error));
      }
    }

    function updateVisibleRate(audio, rateValue) {
      if (typeof safeProfile.updateVisibleRate === "function") {
        safeProfile.updateVisibleRate(audio, rateValue);
      }
    }

    function clearVerifyTimer(meta) {
      if (meta.verifyTimer) {
        window.clearTimeout(meta.verifyTimer);
        meta.verifyTimer = null;
      }
      meta.verifyAttempt = 0;
      meta.verifyExpectedRate = 0;
      meta.verifyReason = "";
    }

    function scheduleVerifyPlaybackRate(audio, expectedRate, reason) {
      const meta = getAudioMeta(audio);
      clearVerifyTimer(meta);
      meta.verifyExpectedRate = expectedRate;
      meta.verifyReason = String(reason || "verify-rate");

      function verifyStep() {
        if (!started || !audio.isConnected) {
          clearVerifyTimer(meta);
          return;
        }
        const actualRate = Number(audio.playbackRate || 1);
        if (Math.abs(actualRate - expectedRate) <= 0.001) {
          clearVerifyTimer(meta);
          return;
        }
        if (meta.verifyAttempt >= 2) {
          clearVerifyTimer(meta);
          return;
        }
        meta.verifyAttempt += 1;
        meta.applyingRate = true;
        if (typeof audio.defaultPlaybackRate === "number") {
          audio.defaultPlaybackRate = expectedRate;
        }
        audio.playbackRate = expectedRate;
        updateVisibleRate(audio, expectedRate);
        window.setTimeout(function () {
          meta.applyingRate = false;
        }, 0);
        const nextDelay = meta.verifyAttempt === 1 ? 80 : 200;
        meta.verifyTimer = window.setTimeout(verifyStep, nextDelay);
      }

      meta.verifyTimer = window.setTimeout(verifyStep, 0);
    }

    function bindAudioListeners(audio) {
      const meta = getAudioMeta(audio);
      if (meta.listenersBound) {
        return;
      }

      audio.addEventListener("loadedmetadata", function () {
        const audioMeta = getAudioMeta(audio);
        audioMeta.playbackRateValue = getDefaultPlaybackRate();
        audioMeta.volumeValue = getDefaultVolume();
        audioMeta.lastApplySignature = "";
        applyAudioDefaults(audio, "loadedmetadata");
      });
      audio.addEventListener("canplay", function () {
        applyAudioDefaults(audio, "canplay");
      });
      audio.addEventListener("emptied", function () {
        const audioMeta = getAudioMeta(audio);
        audioMeta.lastApplySignature = "";
        scheduleScan("emptied");
      });
      audio.addEventListener("ratechange", function () {
        const audioMeta = getAudioMeta(audio);
        if (audioMeta.applyingRate) {
          return;
        }
        audioMeta.playbackRateValue = clampNumber(
          audio.playbackRate,
          audioMeta.playbackRateValue || getDefaultPlaybackRate(),
          0.25,
          5,
          2
        );
        audioMeta.lastApplySignature = "";
      });
      audio.addEventListener("play", function () {
        pauseAllExcept(audio);
        applyAudioDefaults(audio, "play");
        updateCurrentAudioState(audio);
      });

      meta.listenersBound = true;
    }

    function applyAudioDefaults(audio, reason) {
      if (!(audio instanceof HTMLAudioElement) || !audio.isConnected) {
        return;
      }
      bindAudioListeners(audio);
      const meta = getAudioMeta(audio);
      const sourceSignature = getAudioSourceSignature(audio);

      if (meta.sourceSignature && meta.sourceSignature !== sourceSignature) {
        meta.playbackRateValue = getDefaultPlaybackRate();
        meta.volumeValue = getDefaultVolume();
        meta.lastApplySignature = "";
      }
      meta.sourceSignature = sourceSignature;
      if (!Number.isFinite(meta.playbackRateValue)) {
        meta.playbackRateValue = getDefaultPlaybackRate();
      }
      if (!Number.isFinite(meta.volumeValue)) {
        meta.volumeValue = getDefaultVolume();
      }

      const targetRate = clampNumber(meta.playbackRateValue, getDefaultPlaybackRate(), 0.25, 5, 2);
      const targetVolume = clampNumber(meta.volumeValue, getDefaultVolume(), 0, 1000, 0);
      const applySignature = [sourceSignature, targetRate, targetVolume].join("|");
      const needRateApply = Math.abs(Number(audio.playbackRate || 1) - targetRate) > 0.001;
      if (meta.lastApplySignature === applySignature && !needRateApply) {
        return;
      }

      setAudioVolume(audio, targetVolume);
      meta.applyingRate = true;
      if (typeof audio.defaultPlaybackRate === "number") {
        audio.defaultPlaybackRate = targetRate;
      }
      audio.playbackRate = targetRate;
      updateVisibleRate(audio, targetRate);
      window.setTimeout(function () {
        meta.applyingRate = false;
      }, 0);
      scheduleVerifyPlaybackRate(audio, targetRate, reason || "apply");

      meta.lastApplySignature = applySignature;
      state.lastApplyAt = new Date().toISOString();
      state.lastApplyReason = String(reason || "scan");
    }

    function playAudio(audio, reason) {
      if (!(audio instanceof HTMLAudioElement)) {
        return Promise.resolve(
          buildActionResult(reason || "play", false, {
            reason: "audio-not-found",
            message: "未找到可播放的音频。",
          })
        );
      }
      applyAudioDefaults(audio, reason || "play");
      pauseAllExcept(audio);
      updateCurrentAudioState(audio);
      return Promise.resolve(audio.play())
        .then(function () {
          return buildActionResult(reason || "play", true, {
            currentAudioIndex: state.currentAudioIndex,
            message: getCurrentItemLabel() + "开始播放",
          });
        })
        .catch(function (error) {
          const reasonText = error && error.message ? error.message : String(error);
          setLastError(reasonText);
          return buildActionResult(reason || "play", false, {
            currentAudioIndex: state.currentAudioIndex,
            reason: reasonText,
            message: "播放失败：" + reasonText,
          });
        });
    }

    function autoplaySelectedAudio(reason) {
      const selectedAudio = resolveCurrentAudio();
      if (!(selectedAudio instanceof HTMLAudioElement)) {
        return Promise.resolve({
          ok: false,
          skipped: true,
          reason: "audio-not-found",
          message: "未找到当前音频。",
        });
      }
      pauseAllExcept(selectedAudio);
      applyAudioDefaults(selectedAudio, reason || "autoplay");
      if (config.autoPlay !== true) {
        return Promise.resolve({
          ok: false,
          skipped: true,
          reason: "autoplay-disabled",
        });
      }
      return playAudio(selectedAudio, reason || "autoplay").then(function (result) {
        setLastAutoplay(
          Object.assign({}, result, {
            src: getAudioSourceSignature(selectedAudio),
          })
        );
        return result;
      });
    }

    function handleSelectedItemChange(nextSelectedItem, nextSelectedAudio, reason) {
      if (lastSelectedAudio && lastSelectedAudio !== nextSelectedAudio && !lastSelectedAudio.paused) {
        hardPauseAudio(lastSelectedAudio);
      }
      if (nextSelectedAudio) {
        pauseAllExcept(nextSelectedAudio);
        applyAudioDefaults(nextSelectedAudio, reason || "selected-change");
        updateCurrentAudioState(nextSelectedAudio);
      }
      lastSelectedAudio = nextSelectedAudio || null;
      if (config.autoPlay === true && nextSelectedAudio) {
        void autoplaySelectedAudio(reason || "selected-change");
      }
      if (typeof safeProfile.onSelectedItemChanged === "function") {
        safeProfile.onSelectedItemChanged(nextSelectedItem, nextSelectedAudio, reason || "selected-change");
      }
    }

    function performScan(reason) {
      if (!started) {
        return;
      }
      const audios = getAudios();
      state.audioCount = audios.length;

      audios.forEach(function (audio) {
        applyAudioDefaults(audio, reason || "scan");
      });

      const selectedItem = resolveSelectedItem();
      const selectedAudio = resolveSelectedAudio(audios);
      const selectedKey = getSelectedItemKey(selectedItem, selectedAudio);
      if (selectedKey && selectedKey !== lastSelectedItemKey) {
        lastSelectedItemKey = selectedKey;
        handleSelectedItemChange(selectedItem, selectedAudio, reason || "selected-change");
      } else if (selectedAudio) {
        pauseAllExcept(selectedAudio);
      }
    }

    function scheduleScan(reason) {
      if (!started) {
        return;
      }
      if (scanTimer) {
        window.clearTimeout(scanTimer);
      }
      scanTimer = window.setTimeout(function () {
        scanTimer = null;
        performScan(reason || "mutation");
      }, 80);
    }

    function resetAllMetaToDefaults() {
      getAudios().forEach(function (audio) {
        const meta = getAudioMeta(audio);
        meta.playbackRateValue = getDefaultPlaybackRate();
        meta.volumeValue = getDefaultVolume();
        meta.lastApplySignature = "";
        clearVerifyTimer(meta);
      });
    }

    function start(nextConfig) {
      config = normalizeConfig(nextConfig || config);
      resetAllMetaToDefaults();
      if (started) {
        scheduleScan("config-update");
        return;
      }
      started = true;
      observer = new MutationObserver(function () {
        scheduleScan("mutation");
      });
      observer.observe(document.documentElement || document, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "src"],
      });
      scheduleScan("start");
    }

    function stop() {
      started = false;
      if (scanTimer) {
        window.clearTimeout(scanTimer);
        scanTimer = null;
      }
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      getAudios().forEach(function (audio) {
        const meta = getAudioMeta(audio);
        clearVerifyTimer(meta);
      });
    }

    function updateConfig(nextConfig) {
      config = normalizeConfig(nextConfig || config);
      resetAllMetaToDefaults();
      scheduleScan("config-update");
    }

    function getCurrentAudioPlaybackRate(audio) {
      const targetAudio = audio || resolveCurrentAudio();
      if (!(targetAudio instanceof HTMLAudioElement)) {
        return getDefaultPlaybackRate();
      }
      const meta = getAudioMeta(targetAudio);
      const liveRate = Number(targetAudio.playbackRate);
      if (Number.isFinite(liveRate) && liveRate > 0) {
        meta.playbackRateValue = clampNumber(liveRate, getDefaultPlaybackRate(), 0.25, 5, 2);
      }
      return clampNumber(meta.playbackRateValue, getDefaultPlaybackRate(), 0.25, 5, 2);
    }

    function getCurrentAudioVolume(audio) {
      const targetAudio = audio || resolveCurrentAudio();
      if (!(targetAudio instanceof HTMLAudioElement)) {
        return getDefaultVolume();
      }
      const meta = getAudioMeta(targetAudio);
      if (!Number.isFinite(meta.volumeValue)) {
        meta.volumeValue = getDefaultVolume();
      }
      return clampNumber(meta.volumeValue, getDefaultVolume(), 0, 1000, 0);
    }

    function setCurrentAudioPlaybackRate(audio, value, reason) {
      const targetAudio = audio || resolveCurrentAudio();
      if (!(targetAudio instanceof HTMLAudioElement)) {
        return getDefaultPlaybackRate();
      }
      const meta = getAudioMeta(targetAudio);
      meta.playbackRateValue = clampNumber(value, getDefaultPlaybackRate(), 0.25, 5, 2);
      meta.lastApplySignature = "";
      applyAudioDefaults(targetAudio, reason || "set-rate");
      updateCurrentAudioState(targetAudio);
      return meta.playbackRateValue;
    }

    function setCurrentAudioVolume(audio, value, reason) {
      const targetAudio = audio || resolveCurrentAudio();
      if (!(targetAudio instanceof HTMLAudioElement)) {
        return getDefaultVolume();
      }
      const meta = getAudioMeta(targetAudio);
      meta.volumeValue = clampNumber(value, getDefaultVolume(), 0, 1000, 0);
      meta.lastApplySignature = "";
      applyAudioDefaults(targetAudio, reason || "set-volume");
      updateCurrentAudioState(targetAudio);
      return meta.volumeValue;
    }

    function setRuntimeRate(rateValue, reason) {
      const audio = resolveCurrentAudio();
      if (!audio) {
        return buildActionResult(reason || "rate", false, {
          reason: "audio-not-found",
          message: "未找到可调整倍速的音频。",
        });
      }
      const currentRate = getCurrentAudioPlaybackRate(audio);
      const nextRate = clampNumber(rateValue, currentRate, 0.25, 5, 2);
      const appliedRate = setCurrentAudioPlaybackRate(audio, nextRate, reason || "rate");
      return buildActionResult(reason || "rate", true, {
        playbackRateValue: appliedRate,
        message:
          reason === "rate-reset"
            ? getCurrentItemLabel() + "倍速已重置为 " + formatRate(appliedRate)
            : getCurrentItemLabel() + "倍速已调整为 " + formatRate(appliedRate),
      });
    }

    function adjustRate(direction) {
      const delta = config.rateStepValue * direction;
      return setRuntimeRate(getCurrentAudioPlaybackRate() + delta, direction > 0 ? "rate-up" : "rate-down");
    }

    function resetRate() {
      return setRuntimeRate(getDefaultPlaybackRate(), "rate-reset");
    }

    function setRuntimeVolume(volumeValue, reason) {
      const audio = resolveCurrentAudio();
      if (!audio) {
        return buildActionResult(reason || "volume", false, {
          reason: "audio-not-found",
          message: "未找到可调整音量的音频。",
        });
      }
      const currentVolume = getCurrentAudioVolume(audio);
      const nextVolume = clampNumber(volumeValue, currentVolume, 0, 1000, 0);
      const appliedVolume = setCurrentAudioVolume(audio, nextVolume, reason || "volume");
      return buildActionResult(reason || "volume", true, {
        volumeValue: appliedVolume,
        message:
          reason === "volume-reset"
            ? getCurrentItemLabel() + "音量已重置为 " + String(appliedVolume) + "%"
            : getCurrentItemLabel() + "音量已调整为 " + String(appliedVolume) + "%",
      });
    }

    function adjustVolume(direction) {
      return setRuntimeVolume(getCurrentAudioVolume() + direction * 50, direction > 0 ? "volume-up" : "volume-down");
    }

    function resetVolume() {
      return setRuntimeVolume(getDefaultVolume(), "volume-reset");
    }

    function seekCurrent(direction) {
      const audio = resolveCurrentAudio();
      const reason = direction > 0 ? "seek-forward" : "seek-backward";
      if (!audio) {
        return buildActionResult(reason, false, {
          reason: "audio-not-found",
          message: "未找到可前进 / 后退的音频。",
        });
      }
      const stepSeconds = config.seekStepSeconds;
      const currentTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
      const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : null;
      const nextTime = Math.max(
        0,
        duration === null
          ? currentTime + direction * stepSeconds
          : Math.min(duration, currentTime + direction * stepSeconds)
      );
      try {
        applyAudioDefaults(audio, reason);
        audio.currentTime = nextTime;
        updateCurrentAudioState(audio);
        return buildActionResult(reason, true, {
          currentAudioIndex: state.currentAudioIndex,
          currentTime: nextTime,
          seekStepSeconds: stepSeconds,
          message:
            getCurrentItemLabel() +
            (direction > 0 ? "已前进 " : "已后退 ") +
            formatSeconds(stepSeconds),
        });
      } catch (error) {
        const reasonText = error && error.message ? error.message : String(error);
        setLastError(reasonText);
        return buildActionResult(reason, false, {
          reason: reasonText,
          message: "调整播放位置失败：" + reasonText,
        });
      }
    }

    function playPauseCurrent() {
      const audio = resolveCurrentAudio();
      if (!audio) {
        return Promise.resolve(
          buildActionResult("play-pause", false, {
            reason: "audio-not-found",
            message: "未找到可控制的音频。",
          })
        );
      }
      if (audio.paused || audio.ended) {
        return playAudio(audio, "play-pause");
      }
      audio.pause();
      updateCurrentAudioState(audio);
      return Promise.resolve(
        buildActionResult("play-pause", true, {
          paused: true,
          currentAudioIndex: state.currentAudioIndex,
          message: getCurrentItemLabel() + "已暂停",
        })
      );
    }

    function copyCurrentAudioDuration() {
      const audio = resolveCurrentAudio();
      if (!audio || !Number.isFinite(audio.duration)) {
        return Promise.resolve({
          ok: false,
          message: "当前音频时长不可用。",
        });
      }
      const value = String(Number(audio.duration.toFixed(3)));
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        return navigator.clipboard
          .writeText(value)
          .then(function () {
            return { ok: true, message: "当前音频时长已复制。", value: value };
          })
          .catch(function () {
            return fallbackCopy(value);
          });
      }
      return Promise.resolve(fallbackCopy(value));
    }

    function fallbackCopy(value) {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.style.position = "fixed";
      textarea.style.top = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
      return { ok: true, message: "当前音频时长已复制。", value: value };
    }

    function autoPlayCurrentAudioIfNeeded(enabled) {
      if (enabled !== true) {
        return Promise.resolve({ ok: false, skipped: true });
      }
      return autoplaySelectedAudio("manual-autoplay");
    }

    function getCurrentAudioSnapshot() {
      const audio = resolveCurrentAudio();
      if (!audio) {
        return { found: false };
      }
      return {
        found: true,
        paused: audio.paused === true,
        playbackRate: Number(audio.playbackRate || 1),
        volumePercent: Math.round(getCurrentAudioVolume(audio)),
        duration: Number.isFinite(audio.duration) ? Number(audio.duration.toFixed(3)) : null,
        currentTime: Number.isFinite(audio.currentTime) ? Number(audio.currentTime.toFixed(3)) : null,
      };
    }

    function runAction(actionKey) {
      if (actionKey === "volumeUp") {
        return Promise.resolve(adjustVolume(1));
      }
      if (actionKey === "volumeDown") {
        return Promise.resolve(adjustVolume(-1));
      }
      if (actionKey === "volumeReset") {
        return Promise.resolve(resetVolume());
      }
      if (actionKey === "rateUp") {
        return Promise.resolve(adjustRate(1));
      }
      if (actionKey === "rateDown") {
        return Promise.resolve(adjustRate(-1));
      }
      if (actionKey === "rateReset") {
        return Promise.resolve(resetRate());
      }
      if (actionKey === "seekBackward") {
        return Promise.resolve(seekCurrent(-1));
      }
      if (actionKey === "seekForward") {
        return Promise.resolve(seekCurrent(1));
      }
      if (actionKey === "playPause") {
        return playPauseCurrent();
      }
      return Promise.resolve(
        buildActionResult(actionKey || "unknown", false, {
          reason: "unknown-action",
          message: "未识别的快捷键动作：" + String(actionKey || ""),
        })
      );
    }

    function formatRate(rate) {
      return Number.isInteger(rate)
        ? String(rate) + "x"
        : Number(rate).toFixed(2).replace(/0$/, "").replace(/0$/, "") + "x";
    }

    function formatSeconds(value) {
      const numericValue = Number(value);
      if (!Number.isFinite(numericValue)) {
        return "0 秒";
      }
      return Number(numericValue.toFixed(2)).toString() + " 秒";
    }

    function getState() {
      return Object.assign({}, clone(state), {
        started: started,
        config: clone(config),
        defaultVolumeValue: getDefaultVolume(),
        defaultPlaybackRateValue: getDefaultPlaybackRate(),
      });
    }

    return {
      start: start,
      stop: stop,
      updateConfig: updateConfig,
      scan: performScan,
      runAction: runAction,
      getState: getState,
      resolveCurrentAudio: resolveCurrentAudio,
      playPauseCurrentAudio: playPauseCurrent,
      seekCurrentAudio: function (seconds) {
        const step = Number(seconds);
        if (!Number.isFinite(step) || step === 0) {
          return buildActionResult("seek-current", false, {
            reason: "invalid-seek-step",
            message: "无效的前进 / 后退步长。",
          });
        }
        return seekCurrent(step > 0 ? 1 : -1);
      },
      adjustPlaybackRate: function (step) {
        const numericStep = Number(step);
        if (!Number.isFinite(numericStep) || numericStep === 0) {
          return buildActionResult("rate", false, {
            reason: "invalid-rate-step",
            message: "无效的倍速步进。",
          });
        }
        const currentRate = getCurrentAudioPlaybackRate();
        return setRuntimeRate(currentRate + numericStep, numericStep > 0 ? "rate-up" : "rate-down");
      },
      setPlaybackRate: function (rate) {
        return setRuntimeRate(rate, "rate-reset");
      },
      adjustVolumePercent: function (stepPercent) {
        const numericStep = Number(stepPercent);
        if (!Number.isFinite(numericStep) || numericStep === 0) {
          return buildActionResult("volume", false, {
            reason: "invalid-volume-step",
            message: "无效的音量步进。",
          });
        }
        const currentVolume = getCurrentAudioVolume();
        return setRuntimeVolume(currentVolume + numericStep, numericStep > 0 ? "volume-up" : "volume-down");
      },
      setVolumePercent: function (volumePercent) {
        return setRuntimeVolume(volumePercent, "volume-reset");
      },
      copyCurrentAudioDuration: copyCurrentAudioDuration,
      autoPlayCurrentAudioIfNeeded: autoPlayCurrentAudioIfNeeded,
      getCurrentAudioSnapshot: getCurrentAudioSnapshot,
      applyAudioDefaults: applyAudioDefaults,
      pauseAllExcept: pauseAllExcept,
      hardPauseAudio: hardPauseAudio,
      getAudios: getAudios,
      getTaskItems: getTaskItems,
      getSelectedItem: resolveSelectedItem,
      getSelectedAudio: function () {
        return resolveSelectedAudio(getAudios());
      },
      setPlaybackRateAndSyncUi: setCurrentAudioPlaybackRate,
      setVolumeAndSyncUi: setCurrentAudioVolume,
      scheduleVerifyPlaybackRate: scheduleVerifyPlaybackRate,
    };
  }

  globalThis.__ASREdgeAlibabaLabelxSharedAudioControllerCore = {
    clampNumber: clampNumber,
    createAudioRuntime: createAudioRuntime,
  };
})();

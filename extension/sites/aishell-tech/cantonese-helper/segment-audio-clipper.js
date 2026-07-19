(function () {
  if (globalThis.__ASREdgeAishellTechCantoneseSegmentAudioClipperInstalled === true) {
    return;
  }
  globalThis.__ASREdgeAishellTechCantoneseSegmentAudioClipperInstalled = true;

  const TARGET_SAMPLE_RATE = 16000;

  function normalizeText(value) {
    return String(value || "").trim();
  }

  function toFiniteNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function createSegmentError(message, code) {
    const error = new Error(message);
    error.code = code || "invalid-segment";
    return error;
  }

  function readCssPixels(value) {
    const matched = String(value || "").match(/(-?\d+(?:\.\d+)?)px/i);
    return matched ? Number(matched[1]) : NaN;
  }

  function getStyleValue(node, name) {
    if (node?.style && typeof node.style[name] === "string") {
      return node.style[name];
    }
    const styleText = normalizeText(node?.getAttribute?.("style"));
    const matched = styleText.match(new RegExp(name + "\\s*:\\s*([^;]+)", "i"));
    return matched ? matched[1] : "";
  }

  function parseClockToSeconds(value) {
    const matched = normalizeText(value).match(/^(?:(\d+):)?(\d{1,2})$/);
    if (!matched) {
      return NaN;
    }
    const minutes = Number(matched[1] || 0);
    const seconds = Number(matched[2]);
    return Number.isFinite(minutes) && Number.isFinite(seconds) && seconds < 60
      ? minutes * 60 + seconds
      : NaN;
  }

  function parseRegionTitle(value) {
    const matched = normalizeText(value).match(/^([^\-]+)-([^\-]+)$/);
    if (!matched) {
      return null;
    }
    const startSeconds = parseClockToSeconds(matched[1]);
    const endSeconds = parseClockToSeconds(matched[2]);
    if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds)) {
      return null;
    }
    return { startSeconds, endSeconds };
  }

  function assertTitleMatchesRange(title, startMs, endMs) {
    const parsed = parseRegionTitle(title);
    if (!parsed) {
      throw createSegmentError("当前区段缺少可校验的时间标题。", "missing-region-title");
    }
    const displayedStart = Math.floor(Math.max(0, Number(startMs) || 0) / 1000);
    const displayedEnd = Math.floor(Math.max(0, Number(endMs) || 0) / 1000);
    if (displayedStart !== parsed.startSeconds || displayedEnd !== parsed.endSeconds) {
      throw createSegmentError("当前区段的像素范围与页面时间标题不一致。", "region-range-mismatch");
    }
  }

  function getRegionNodeParts(node) {
    const regionId = normalizeText(node?.getAttribute?.("data-id"));
    const regionLabel = normalizeText(node?.getAttribute?.("data-region-label"));
    const title = normalizeText(node?.getAttribute?.("title"));
    const left = readCssPixels(getStyleValue(node, "left"));
    const width = readCssPixels(getStyleValue(node, "width"));
    if (!regionId || !Number.isFinite(left) || left < 0 || !Number.isFinite(width) || width <= 0) {
      throw createSegmentError("当前区段缺少可用的波形位置或宽度。", "invalid-region-layout");
    }
    return { regionId, regionLabel, title, left, width };
  }

  function buildSegmentSnapshot(node, segmentNumber, pixelsPerSecond) {
    const parts = getRegionNodeParts(node);
    const scale = Number(pixelsPerSecond);
    if (!Number.isFinite(scale) || scale <= 0) {
      throw createSegmentError("未能校准当前波形的时间比例。", "invalid-wave-scale");
    }
    const startMs = Math.round((parts.left / scale) * 1000);
    const endMs = Math.round(((parts.left + parts.width) / scale) * 1000);
    if (!Number.isInteger(Number(segmentNumber)) || Number(segmentNumber) <= 0 || endMs <= startMs) {
      throw createSegmentError("当前区段的开始/结束时间无效。", "invalid-segment-range");
    }
    assertTitleMatchesRange(parts.title, startMs, endMs);
    return {
      regionId: parts.regionId,
      regionLabel: parts.regionLabel,
      segmentNumber: Number(segmentNumber),
      startMs,
      endMs,
      durationMs: endMs - startMs,
      selectionKey: parts.regionId + ":" + startMs + "-" + endMs,
    };
  }

  function resolveSegmentSnapshot(input) {
    const source = input && typeof input === "object" ? input : {};
    const regions = Array.isArray(source.regions) ? source.regions : [];
    const selectedSegmentNumber = Math.round(toFiniteNumber(source.selectedSegmentNumber, 0));
    const selectedDurationMs = Math.round(toFiniteNumber(source.selectedDurationMs, 0));
    if (!Number.isInteger(selectedSegmentNumber) || selectedSegmentNumber <= 0 || selectedSegmentNumber > regions.length) {
      throw createSegmentError("未读取到当前选择的区段编号。", "missing-selected-segment");
    }
    if (!Number.isFinite(selectedDurationMs) || selectedDurationMs <= 0) {
      throw createSegmentError("未读取到当前区段的截取时长。", "missing-selected-duration");
    }
    const selectedParts = getRegionNodeParts(regions[selectedSegmentNumber - 1]);
    const pixelsPerSecond = selectedParts.width / (selectedDurationMs / 1000);
    if (!Number.isFinite(pixelsPerSecond) || pixelsPerSecond < 10 || pixelsPerSecond > 2000) {
      throw createSegmentError("当前波形的时间比例无效。", "invalid-wave-scale");
    }
    return buildSegmentSnapshot(regions[selectedSegmentNumber - 1], selectedSegmentNumber, pixelsPerSecond);
  }

  function getRegionNodes(documentLike) {
    if (!documentLike || typeof documentLike.querySelectorAll !== "function") {
      return [];
    }
    return Array.from(documentLike.querySelectorAll("wave > region.wavesurfer-region"));
  }

  function getSelectedSegmentNumber(documentLike) {
    const selected = documentLike?.querySelector?.("button.regionSelected");
    const value = Math.round(toFiniteNumber(String(selected?.textContent || "").match(/\d+/)?.[0], 0));
    if (!Number.isInteger(value) || value <= 0) {
      throw createSegmentError("请先点击需要识别的蓝色区段。", "missing-selected-segment");
    }
    const pageText = String(documentLike?.body?.textContent || documentLike?.documentElement?.textContent || "");
    const currentMatched = pageText.match(/当前选择\s*[：:]\s*(\d+)/);
    if (!currentMatched || Number(currentMatched[1]) !== value) {
      throw createSegmentError("当前选择的区段编号未完成同步，请稍后重试。", "selected-segment-not-ready");
    }
    return value;
  }

  function getSelectedDurationMs(documentLike) {
    const pageText = String(documentLike?.body?.textContent || documentLike?.documentElement?.textContent || "");
    const matched = pageText.match(/截取时长\s*[：:]\s*(\d+(?:\.\d+)?)\s*s/i);
    const seconds = toFiniteNumber(matched?.[1], NaN);
    if (!Number.isFinite(seconds) || seconds <= 0) {
      throw createSegmentError("未读取到当前区段的截取时长。", "missing-selected-duration");
    }
    return Math.round(seconds * 1000);
  }

  function getCurrentSegment(documentLike) {
    const regions = getRegionNodes(documentLike);
    return resolveSegmentSnapshot({
      regions,
      selectedSegmentNumber: getSelectedSegmentNumber(documentLike),
      selectedDurationMs: getSelectedDurationMs(documentLike),
    });
  }

  function getSegmentCatalog(documentLike) {
    const regions = getRegionNodes(documentLike);
    const current = getCurrentSegment(documentLike);
    const selectedParts = getRegionNodeParts(regions[current.segmentNumber - 1]);
    const pixelsPerSecond = selectedParts.width / (current.durationMs / 1000);
    return regions.map(function (region, index) {
      return buildSegmentSnapshot(region, index + 1, pixelsPerSecond);
    });
  }

  function encodeWavBuffer(channelData, sampleRate) {
    const pcmLength = channelData.length;
    const buffer = new ArrayBuffer(44 + pcmLength * 2);
    const view = new DataView(buffer);

    function writeAscii(offset, value) {
      for (let index = 0; index < value.length; index += 1) {
        view.setUint8(offset + index, value.charCodeAt(index));
      }
    }

    writeAscii(0, "RIFF");
    view.setUint32(4, 36 + pcmLength * 2, true);
    writeAscii(8, "WAVE");
    writeAscii(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeAscii(36, "data");
    view.setUint32(40, pcmLength * 2, true);
    for (let index = 0; index < pcmLength; index += 1) {
      const value = Math.max(-1, Math.min(1, channelData[index] || 0));
      view.setInt16(44 + index * 2, value < 0 ? Math.round(value * 0x8000) : Math.round(value * 0x7fff), true);
    }
    return new Uint8Array(buffer);
  }

  function bytesToBase64(bytes) {
    let binary = "";
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(offset, offset + chunkSize));
    }
    if (typeof btoa !== "function") {
      throw createSegmentError("当前浏览器不支持音频 Base64 编码。", "unsupported-base64");
    }
    return btoa(binary);
  }

  function assertNotAborted(signal) {
    if (signal?.aborted === true) {
      throw createSegmentError("音频裁剪已取消。", "user-aborted");
    }
  }

  function createAudioClipSession(audioUrl, options) {
    const source = options && typeof options === "object" ? options : {};
    const fetchImpl = typeof source.fetchImpl === "function" ? source.fetchImpl : fetch;
    const AudioContextClass = source.AudioContextClass || globalThis.AudioContext || globalThis.webkitAudioContext;
    const OfflineAudioContextClass =
      source.OfflineAudioContextClass || globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
    const targetSampleRate = Math.max(8000, Math.round(toFiniteNumber(source.targetSampleRate, TARGET_SAMPLE_RATE)));
    let decodedBuffer = null;
    let loadPromise = null;
    let released = false;

    async function load(signal) {
      assertNotAborted(signal);
      if (released) {
        throw createSegmentError("音频裁剪已释放。", "clip-session-released");
      }
      if (decodedBuffer) {
        return decodedBuffer;
      }
      if (!normalizeText(audioUrl)) {
        throw createSegmentError("缺少当前音频地址。", "missing-audio-url");
      }
      if (typeof fetchImpl !== "function" || typeof AudioContextClass !== "function") {
        throw createSegmentError("当前浏览器不支持音频裁剪。", "unsupported-audio-clip");
      }
      if (!loadPromise) {
        loadPromise = (async function () {
          let response;
          try {
            response = await fetchImpl(audioUrl, { signal: signal || undefined });
          } catch (error) {
            if (signal?.aborted === true) {
              throw createSegmentError("音频裁剪已取消。", "user-aborted");
            }
            throw createSegmentError("当前音频访问失败，请刷新页面后重试。", "audio-source-fetch-failed");
          }
          if (!response?.ok) {
            throw createSegmentError("当前音频访问已失效，请刷新页面后重试。", "audio-source-fetch-failed");
          }
          const audioBytes = await response.arrayBuffer();
          assertNotAborted(signal);
          const context = new AudioContextClass();
          try {
            decodedBuffer = await context.decodeAudioData(audioBytes.slice(0));
          } finally {
            if (typeof context.close === "function") {
              void context.close();
            }
          }
          if (released) {
            decodedBuffer = null;
            throw createSegmentError("音频裁剪已释放。", "clip-session-released");
          }
          return decodedBuffer;
        })();
      }
      try {
        const decoded = await loadPromise;
        assertNotAborted(signal);
        return decoded;
      } finally {
        if (!decodedBuffer) {
          loadPromise = null;
        }
      }
    }

    async function createAudioDataUrl(segment, signal) {
      assertNotAborted(signal);
      const current = segment && typeof segment === "object" ? segment : {};
      const startMs = Math.max(0, Math.round(toFiniteNumber(current.startMs, NaN)));
      const endMs = Math.max(startMs, Math.round(toFiniteNumber(current.endMs, NaN)));
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
        throw createSegmentError("当前区段的开始/结束时间无效。", "invalid-segment-range");
      }
      const decoded = await load(signal);
      assertNotAborted(signal);
      if (typeof OfflineAudioContextClass !== "function") {
        throw createSegmentError("当前浏览器不支持离线音频裁剪。", "unsupported-audio-clip");
      }
      const totalDurationMs = Math.max(0, Math.round(toFiniteNumber(decoded?.duration, 0) * 1000));
      const clippedStartMs = Math.min(startMs, totalDurationMs);
      const clippedEndMs = Math.min(endMs, totalDurationMs);
      if (clippedEndMs <= clippedStartMs) {
        throw createSegmentError("当前区段超出音频实际时长。", "segment-out-of-range");
      }
      const offline = new OfflineAudioContextClass(
        1,
        Math.max(1, Math.ceil(((clippedEndMs - clippedStartMs) / 1000) * targetSampleRate)),
        targetSampleRate
      );
      const sourceNode = offline.createBufferSource();
      sourceNode.buffer = decoded;
      sourceNode.connect(offline.destination);
      sourceNode.start(0, clippedStartMs / 1000, (clippedEndMs - clippedStartMs) / 1000);
      const rendered = await offline.startRendering();
      assertNotAborted(signal);
      return "data:audio/wav;base64," + bytesToBase64(encodeWavBuffer(rendered.getChannelData(0), rendered.sampleRate || targetSampleRate));
    }

    return {
      createAudioDataUrl,
      release: function () {
        released = true;
        decodedBuffer = null;
        loadPromise = null;
      },
    };
  }

  const api = {
    createAudioClipSession,
    getCurrentSegment,
    getSegmentCatalog,
    resolveSegmentSnapshot,
  };

  api.__test__ = {
    buildSegmentSnapshot,
    encodeWavBuffer,
    getRegionNodeParts,
    parseRegionTitle,
  };

  globalThis.__ASREdgeAishellTechCantoneseSegmentAudioClipper = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();

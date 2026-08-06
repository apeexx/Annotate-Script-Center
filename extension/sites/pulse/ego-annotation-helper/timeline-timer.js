(function () {
  const TIMER_ATTR = "data-asr-edge-pulse-timeline-timer";

  function formatTimecode(frame, frameRate) {
    const safeFrame = Math.max(0, Math.round(Number(frame) || 0));
    const safeFrameRate = Math.round(Number(frameRate) || 0);
    if (!safeFrameRate) {
      return "";
    }
    const hours = Math.floor(safeFrame / (safeFrameRate * 3600));
    const minutes = Math.floor((safeFrame % (safeFrameRate * 3600)) / (safeFrameRate * 60));
    const seconds = Math.floor((safeFrame % (safeFrameRate * 60)) / safeFrameRate);
    const frames = safeFrame % safeFrameRate;
    return [hours, minutes, seconds, frames]
      .map(function (value) {
        return String(value).padStart(2, "0");
      })
      .join(":");
  }

  function calculateSegmentTime(input) {
    const left = Number(input && input.left);
    const width = Number(input && input.width);
    const trackWidth = Number(input && input.trackWidth);
    const totalFrames = Number(input && input.totalFrames);
    const frameRate = Number(input && input.frameRate);
    if (
      !Number.isFinite(left) ||
      !Number.isFinite(width) ||
      width < 0 ||
      !Number.isFinite(trackWidth) ||
      trackWidth <= 0 ||
      !Number.isFinite(totalFrames) ||
      totalFrames <= 0 ||
      !Number.isFinite(frameRate) ||
      frameRate <= 0
    ) {
      return { status: "unavailable", reason: "时间信息待加载" };
    }

    const startFrame = Math.round((left / trackWidth) * totalFrames);
    const endFrame = Math.round(((left + width) / trackWidth) * totalFrames);
    const normalizedStart = Math.max(0, Math.min(Math.round(totalFrames), startFrame));
    const normalizedEnd = Math.max(normalizedStart, Math.min(Math.round(totalFrames), endFrame));
    const durationFrames = normalizedEnd - normalizedStart;
    return {
      status: "ready",
      startFrame: normalizedStart,
      endFrame: normalizedEnd,
      durationFrames: durationFrames,
      startTimecode: formatTimecode(normalizedStart, frameRate),
      endTimecode: formatTimecode(normalizedEnd, frameRate),
      durationTimecode: formatTimecode(durationFrames, frameRate),
    };
  }

  function calculateDurationDelta(currentDurationFrames, baselineDurationFrames, frameRate) {
    const delta = Math.round(Number(currentDurationFrames) || 0) - Math.round(Number(baselineDurationFrames) || 0);
    const rate = Number(frameRate) || 30;
    return (delta >= 0 ? "+" : "-") + formatTimecode(Math.abs(delta), rate);
  }

  function formatDurationSeconds(frame, frameRate) {
    const safeFrameRate = Number(frameRate);
    if (!Number.isFinite(safeFrameRate) || safeFrameRate <= 0) {
      return "";
    }
    const seconds = Math.max(0, Number(frame) || 0) / safeFrameRate;
    return seconds.toFixed(1) + "s";
  }

  function calculateDurationDeltaSeconds(currentDurationFrames, baselineDurationFrames, frameRate) {
    const delta = Math.round(Number(currentDurationFrames) || 0) - Math.round(Number(baselineDurationFrames) || 0);
    return (delta >= 0 ? "+" : "-") + formatDurationSeconds(Math.abs(delta), frameRate);
  }

  function calculateDragPreview(input) {
    const left = Number(input && input.left);
    const width = Number(input && input.width);
    const delta = Number(input && input.delta);
    const trackWidth = Number(input && input.trackWidth);
    const mode = String(input && input.mode || "move");
    if (
      !Number.isFinite(left) ||
      !Number.isFinite(width) ||
      width < 0 ||
      !Number.isFinite(delta) ||
      !Number.isFinite(trackWidth) ||
      trackWidth <= 0
    ) {
      return null;
    }

    const end = Math.max(left, Math.min(trackWidth, left + width));
    if (mode === "start") {
      const nextLeft = Math.max(0, Math.min(end, left + delta));
      return { left: nextLeft, width: end - nextLeft };
    }
    if (mode === "end") {
      const nextEnd = Math.max(left, Math.min(trackWidth, end + delta));
      return { left: left, width: nextEnd - left };
    }
    return null;
  }

  function parsePixels(value) {
    const pixels = Number.parseFloat(String(value || ""));
    return Number.isFinite(pixels) ? pixels : NaN;
  }

  function getSegments(track) {
    return Array.from(track && track.children ? track.children : []).filter(function (node) {
      return (
        node &&
        node.nodeType === 1 &&
        node.classList.contains("absolute") &&
        node.classList.contains("overflow-hidden") &&
        Number.isFinite(parsePixels(node.style.left)) &&
        Number.isFinite(parsePixels(node.style.width))
      );
    });
  }

  function findTimelineTrack(root) {
    const candidates = Array.from(root.querySelectorAll("div.relative"));
    return (
      candidates
        .map(function (node) {
          return { node: node, width: parsePixels(node.style.width), segments: getSegments(node) };
        })
        .filter(function (item) {
          return Number.isFinite(item.width) && item.width > 0 && item.segments.length > 0;
        })
        .sort(function (left, right) {
          return right.segments.length - left.segments.length || right.width - left.width;
        })[0]?.node || null
    );
  }

  function findTimelineHeader(root) {
    const candidates = Array.from(root.querySelectorAll("*"))
      .filter(function (node) {
        return /^TIMELINE\s*(?:·|\\.)?/i.test(String(node.textContent || "").trim());
      })
      .sort(function (left, right) {
        return String(left.textContent || "").length - String(right.textContent || "").length;
      });
    return candidates[0] || null;
  }

  function readFrameInfo(root) {
    const text = String(root.body?.innerText || root.documentElement?.textContent || "");
    const frameMatch = text.match(/\bf\s*(\d+)\s*\/\s*(\d+)\b/i);
    const fpsMatch = text.match(/(\d+(?:\.\d+)?)\s*fps\b/i);
    const totalFrames = Number(frameMatch && frameMatch[2]);
    const frameRate = Number(fpsMatch && fpsMatch[1]);
    return Number.isFinite(totalFrames) && totalFrames > 0 && Number.isFinite(frameRate) && frameRate > 0
      ? { totalFrames: totalFrames, frameRate: frameRate }
      : null;
  }

  function findSelectedSegment(track) {
    return getSegments(track)
      .map(function (node) {
        return { node: node, zIndex: Number(node.style.zIndex) || 0 };
      })
      .filter(function (item) {
        return item.zIndex > 1;
      })
      .sort(function (left, right) {
        return right.zIndex - left.zIndex;
      })[0]?.node || null;
  }

  function toSegmentResult(track, segment, frameInfo) {
    return calculateSegmentTime({
      left: parsePixels(segment && segment.style.left),
      width: parsePixels(segment && segment.style.width),
      trackWidth: parsePixels(track && track.style.width),
      totalFrames: frameInfo && frameInfo.totalFrames,
      frameRate: frameInfo && frameInfo.frameRate,
    });
  }

  function getDragMode(segment, event) {
    const bounds = segment && typeof segment.getBoundingClientRect === "function" ? segment.getBoundingClientRect() : null;
    const clientX = Number(event && event.clientX);
    if (!bounds || !Number.isFinite(clientX) || !Number.isFinite(bounds.left) || !Number.isFinite(bounds.width)) {
      return null;
    }
    const edgeWidth = Math.min(12, Math.max(4, bounds.width / 3));
    if (clientX - bounds.left <= edgeWidth) {
      return "start";
    }
    if (bounds.left + bounds.width - clientX <= edgeWidth) {
      return "end";
    }
    return null;
  }

  function findSegmentBoundary(track, event) {
    const clientX = Number(event && event.clientX);
    if (!Number.isFinite(clientX)) {
      return null;
    }
    return (
      getSegments(track)
        .map(function (segment) {
          const mode = getDragMode(segment, event);
          if (!mode) {
            return null;
          }
          const bounds = segment.getBoundingClientRect();
          const boundaryX = mode === "start" ? bounds.left : bounds.left + bounds.width;
          return { segment: segment, mode: mode, distance: Math.abs(clientX - boundaryX) };
        })
        .filter(Boolean)
        .sort(function (left, right) {
          return left.distance - right.distance;
        })[0] || null
    );
  }

  function getTrackScale(track) {
    const styleWidth = parsePixels(track && track.style.width);
    const bounds = track && typeof track.getBoundingClientRect === "function" ? track.getBoundingClientRect() : null;
    const renderedWidth = Number(bounds && bounds.width);
    return Number.isFinite(styleWidth) && styleWidth > 0 && Number.isFinite(renderedWidth) && renderedWidth > 0
      ? styleWidth / renderedWidth
      : 1;
  }

  function createController(rootDocument, rootWindow) {
    const doc = rootDocument || document;
    const win = rootWindow || window;
    let observer = null;
    let timerNode = null;
    let baseline = null;
    let selectedSegment = null;
    let dragging = false;
    let dragState = null;
    let dragPreview = null;
    let scheduled = false;

    function scheduleRefresh() {
      if (scheduled) {
        return;
      }
      scheduled = true;
      const schedule = typeof win.requestAnimationFrame === "function" ? win.requestAnimationFrame : win.setTimeout;
      schedule.call(win, function () {
        scheduled = false;
        refresh();
      });
    }

    function ensureTimerNode() {
      if (timerNode && timerNode.isConnected) {
        return timerNode;
      }
      const header = findTimelineHeader(doc);
      if (!header || !header.parentElement) {
        return null;
      }
      const existing = header.parentElement.querySelector("[" + TIMER_ATTR + "]");
      if (existing) {
        timerNode = existing;
        return timerNode;
      }
      timerNode = doc.createElement("span");
      timerNode.setAttribute(TIMER_ATTR, "true");
      timerNode.style.marginLeft = "8px";
      timerNode.style.fontSize = "11px";
      timerNode.style.fontWeight = "600";
      timerNode.style.color = "var(--xdof-slate, #5b6472)";
      header.parentElement.appendChild(timerNode);
      return timerNode;
    }

    function render(message) {
      const node = ensureTimerNode();
      if (node) {
        node.textContent = message;
      }
    }

    function renderResult(result, frameInfo) {
      const change = dragging && baseline
        ? " · 变化 " + calculateDurationDeltaSeconds(result.durationFrames, baseline.durationFrames, frameInfo.frameRate)
        : "";
      render("分段长度 " + formatDurationSeconds(result.durationFrames, frameInfo.frameRate) + change);
    }

    function refresh() {
      const track = findTimelineTrack(doc);
      const frameInfo = readFrameInfo(doc);
      if (dragging && dragPreview) {
        const previewResult = calculateSegmentTime({
          left: dragPreview.left,
          width: dragPreview.width,
          trackWidth: dragPreview.trackWidth,
          totalFrames: frameInfo && frameInfo.totalFrames,
          frameRate: frameInfo && frameInfo.frameRate,
        });
        if (previewResult.status === "ready") {
          renderResult(previewResult, frameInfo);
          return previewResult;
        }
      }
      const segment = selectedSegment && selectedSegment.isConnected ? selectedSegment : findSelectedSegment(track);
      if (!track || !frameInfo || !segment) {
        render("时间信息待加载");
        return { status: "unavailable", reason: "时间信息待加载" };
      }
      const result = toSegmentResult(track, segment, frameInfo);
      if (result.status !== "ready") {
        render(result.reason);
        return result;
      }
      renderResult(result, frameInfo);
      return result;
    }

    function handlePointerDown(event) {
      const track = findTimelineTrack(doc);
      const boundary = findSegmentBoundary(track, event);
      if (!boundary) {
        return;
      }
      const segment = boundary.segment;
      const dragMode = boundary.mode;
      selectedSegment = segment;
      const result = toSegmentResult(track, segment, readFrameInfo(doc));
      baseline = result.status === "ready" ? result : null;
      dragging = Boolean(baseline);
      const left = parsePixels(segment.style.left);
      const width = parsePixels(segment.style.width);
      const trackWidth = parsePixels(track && track.style.width);
      const pointerStartX = Number(event.clientX);
      dragPreview = null;
      dragState =
        dragging &&
        Number.isFinite(left) &&
        Number.isFinite(width) &&
        Number.isFinite(trackWidth) &&
        trackWidth > 0 &&
        Number.isFinite(pointerStartX)
          ? {
              left: left,
              width: width,
              trackWidth: trackWidth,
              pointerStartX: pointerStartX,
              scale: getTrackScale(track),
              mode: dragMode,
              pointerId: event.pointerId,
            }
          : null;
      scheduleRefresh();
    }

    function handlePointerMove(event) {
      if (!dragging || !dragState || (dragState.pointerId != null && event.pointerId !== dragState.pointerId)) {
        return;
      }
      const clientX = Number(event.clientX);
      if (!Number.isFinite(clientX)) {
        return;
      }
      const preview = calculateDragPreview({
        left: dragState.left,
        width: dragState.width,
        trackWidth: dragState.trackWidth,
        delta: (clientX - dragState.pointerStartX) * dragState.scale,
        mode: dragState.mode,
      });
      if (!preview) {
        return;
      }
      dragPreview = Object.assign({ trackWidth: dragState.trackWidth }, preview);
      scheduleRefresh();
    }

    function handlePointerUp(event) {
      if (dragState && dragState.pointerId != null && event && event.pointerId !== dragState.pointerId) {
        return;
      }
      dragging = false;
      baseline = null;
      dragState = null;
      dragPreview = null;
      scheduleRefresh();
    }

    function start() {
      if (observer) {
        return;
      }
      doc.addEventListener("pointerdown", handlePointerDown, true);
      doc.addEventListener("pointermove", handlePointerMove, true);
      doc.addEventListener("pointerup", handlePointerUp, true);
      doc.addEventListener("pointercancel", handlePointerUp, true);
      observer = new MutationObserver(scheduleRefresh);
      observer.observe(doc.documentElement || doc, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["style"],
      });
      refresh();
    }

    function stop() {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      doc.removeEventListener("pointerdown", handlePointerDown, true);
      doc.removeEventListener("pointermove", handlePointerMove, true);
      doc.removeEventListener("pointerup", handlePointerUp, true);
      doc.removeEventListener("pointercancel", handlePointerUp, true);
      if (timerNode) {
        timerNode.remove();
      }
      timerNode = null;
      baseline = null;
      selectedSegment = null;
      dragging = false;
      dragState = null;
      dragPreview = null;
    }

    return { start: start, stop: stop, refresh: refresh };
  }

  globalThis.ASREdgePulseTimelineTimer = {
    TIMER_ATTR: TIMER_ATTR,
    formatTimecode: formatTimecode,
    calculateSegmentTime: calculateSegmentTime,
    calculateDurationDelta: calculateDurationDelta,
    formatDurationSeconds: formatDurationSeconds,
    calculateDurationDeltaSeconds: calculateDurationDeltaSeconds,
    calculateDragPreview: calculateDragPreview,
    getDragMode: getDragMode,
    findSegmentBoundary: findSegmentBoundary,
    createController: createController,
  };
})();

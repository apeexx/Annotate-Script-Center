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

  function createController(rootDocument, rootWindow) {
    const doc = rootDocument || document;
    const win = rootWindow || window;
    let observer = null;
    let timerNode = null;
    let baseline = null;
    let selectedSegment = null;
    let dragging = false;
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

    function refresh() {
      const track = findTimelineTrack(doc);
      const frameInfo = readFrameInfo(doc);
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
      const change = dragging && baseline
        ? " · 变化 " + calculateDurationDelta(result.durationFrames, baseline.durationFrames, frameInfo.frameRate)
        : "";
      render(
        "起 " +
          result.startTimecode +
          " · 终 " +
          result.endTimecode +
          " · 时长 " +
          result.durationTimecode +
          change
      );
      return result;
    }

    function handlePointerDown(event) {
      const track = findTimelineTrack(doc);
      const target = event.target;
      const segment = getSegments(track).find(function (node) {
        return node === target || node.contains(target);
      });
      if (!segment) {
        return;
      }
      selectedSegment = segment;
      const result = toSegmentResult(track, segment, readFrameInfo(doc));
      baseline = result.status === "ready" ? result : null;
      dragging = Boolean(baseline);
      scheduleRefresh();
    }

    function handlePointerUp() {
      dragging = false;
      baseline = null;
      scheduleRefresh();
    }

    function start() {
      if (observer) {
        return;
      }
      doc.addEventListener("pointerdown", handlePointerDown, true);
      doc.addEventListener("pointerup", handlePointerUp, true);
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
      doc.removeEventListener("pointerup", handlePointerUp, true);
      if (timerNode) {
        timerNode.remove();
      }
      timerNode = null;
      baseline = null;
      selectedSegment = null;
      dragging = false;
    }

    return { start: start, stop: stop, refresh: refresh };
  }

  globalThis.ASREdgePulseTimelineTimer = {
    TIMER_ATTR: TIMER_ATTR,
    formatTimecode: formatTimecode,
    calculateSegmentTime: calculateSegmentTime,
    calculateDurationDelta: calculateDurationDelta,
    createController: createController,
  };
})();

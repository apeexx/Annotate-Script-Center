"use strict";

(function initOptionsWorkbenchState(globalObject) {
  function normalizeText(value) {
    return String(value || "").trim();
  }

  function buildPlatformEntryDescriptor(platform) {
    const target = platform && typeof platform === "object" ? platform : {};
    const explicitEntryUrl = normalizeText(target.entryUrl);
    const displayHost = normalizeText(target.displayHost) || normalizeText(target.host);
    if (explicitEntryUrl) {
      return {
        displayHost,
        entryUrl: explicitEntryUrl,
      };
    }

    const matches = Array.isArray(target.matches) ? target.matches : [];
    const firstPattern = normalizeText(matches[0]);
    if (!firstPattern) {
      return {
        displayHost,
        entryUrl: "",
      };
    }

    try {
      const url = new URL(firstPattern.replace(/\*.*$/, ""));
      return {
        displayHost,
        entryUrl: url.origin,
      };
    } catch (_error) {
      const matched = /^(https?:\/\/[^/*]+)/i.exec(firstPattern);
      return {
        displayHost,
        entryUrl: matched ? normalizeText(matched[1]) : "",
      };
    }
  }

  function buildOrderedPlatformIds(platformIds, savedOrder) {
    const sourceIds = Array.isArray(platformIds) ? platformIds : [];
    const preferredOrder = Array.isArray(savedOrder) ? savedOrder : [];
    const knownIds = new Set(sourceIds);
    const result = [];
    const pushed = new Set();

    preferredOrder.forEach(function (platformId) {
      const normalizedId = normalizeText(platformId);
      if (!normalizedId || !knownIds.has(normalizedId) || pushed.has(normalizedId)) {
        return;
      }
      pushed.add(normalizedId);
      result.push(normalizedId);
    });

    sourceIds.forEach(function (platformId) {
      const normalizedId = normalizeText(platformId);
      if (!normalizedId || pushed.has(normalizedId)) {
        return;
      }
      pushed.add(normalizedId);
      result.push(normalizedId);
    });

    return result;
  }

  function movePlatformOrderItem(platformIds, movingPlatformId, nextIndex) {
    const orderedIds = Array.isArray(platformIds) ? platformIds.slice() : [];
    const normalizedMovingId = normalizeText(movingPlatformId);
    const currentIndex = orderedIds.indexOf(normalizedMovingId);
    if (currentIndex < 0) {
      return orderedIds;
    }

    const clampedIndex = Math.max(0, Math.min(orderedIds.length - 1, Number(nextIndex) || 0));
    if (clampedIndex === currentIndex) {
      return orderedIds;
    }

    orderedIds.splice(currentIndex, 1);
    orderedIds.splice(clampedIndex, 0, normalizedMovingId);
    return orderedIds;
  }

  function getDetailWorkbenchLayoutMode(input) {
    const config = input && typeof input === "object" ? input : {};
    const hasBasePanel = config.hasBasePanel !== false;
    const hasAiPanel = config.hasAiPanel === true;
    const hasShortcutPanel = config.hasShortcutPanel === true;

    if (!hasBasePanel) {
      if (hasAiPanel && hasShortcutPanel) {
        return "ai-shortcut";
      }
      if (hasAiPanel) {
        return "single";
      }
      if (hasShortcutPanel) {
        return "single";
      }
      return "empty";
    }

    if (hasAiPanel && hasShortcutPanel) {
      return "base-ai-shortcut";
    }
    if (hasAiPanel) {
      return "base-ai";
    }
    if (hasShortcutPanel) {
      return "base-shortcut";
    }
    return "single";
  }

  function buildDetailWorkbenchTrackState(input) {
    const config = input && typeof input === "object" ? input : {};
    const orderedPanelKinds = [];
    if (config.hasBasePanel !== false) {
      orderedPanelKinds.push("base");
    }
    if (config.hasAiPanel === true) {
      orderedPanelKinds.push("ai");
    }
    if (config.hasShortcutPanel === true) {
      orderedPanelKinds.push("shortcut");
    }

    const primary = [];
    const secondary = [];
    if (orderedPanelKinds[0]) {
      primary.push(orderedPanelKinds[0]);
    }
    if (orderedPanelKinds[1]) {
      secondary.push(orderedPanelKinds[1]);
    }
    if (orderedPanelKinds[2]) {
      primary.push(orderedPanelKinds[2]);
    }

    return {
      primary,
      secondary,
      panelCount: orderedPanelKinds.length,
      isSingle: orderedPanelKinds.length <= 1,
    };
  }

  const api = {
    buildPlatformEntryDescriptor,
    buildDetailWorkbenchTrackState,
    buildOrderedPlatformIds,
    getDetailWorkbenchLayoutMode,
    movePlatformOrderItem,
  };

  globalObject.ASREdgeOptionsWorkbenchState = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);

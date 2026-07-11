(function () {
  const activeItemApi = globalThis.__ASREdgeAlibabaLabelxTranscriptionActiveItem || null;

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function normalizeUrlValue(value) {
    return String(value || "").trim();
  }

  function inferAudioFormat(url) {
    const text = String(url || "").split("?")[0].toLowerCase();
    const matched = text.match(/\.([a-z0-9]+)$/);
    const ext = matched ? matched[1] : "";
    if (!ext) {
      return "wav";
    }
    return ext.slice(0, 12);
  }

  function collectAudioCandidates(item) {
    const list = [];
    const dedup = new Set();

    Array.from(item.querySelectorAll("audio")).forEach(function (audio) {
      if (!(audio instanceof HTMLAudioElement)) {
        return;
      }

      const urls = [audio.currentSrc, audio.src]
        .concat(Array.from(audio.querySelectorAll("source")).map(function (source) {
          return source?.src || source?.getAttribute?.("src") || "";
        }))
        .map(normalizeUrlValue)
        .filter(Boolean);

      urls.forEach(function (url) {
        if (dedup.has(url)) {
          return;
        }
        dedup.add(url);
        list.push({
          id: list.length === 0 ? "a" : "b",
          url,
          format: inferAudioFormat(url),
        });
      });
    });

    return list.slice(0, 2);
  }

  function collectTextCandidates(item, currentText) {
    const dedup = new Set();
    const candidates = [];
    const current = normalizeText(currentText || "");

    function push(text, hintId) {
      const normalized = normalizeText(text);
      if (!normalized || normalized === current || dedup.has(normalized)) {
        return;
      }
      dedup.add(normalized);
      candidates.push({
        id: hintId || (candidates.length === 0 ? "a" : "b"),
        text: normalized,
      });
    }

    if (activeItemApi && typeof activeItemApi.getSourceTexts === "function") {
      const sourceTexts = activeItemApi.getSourceTexts(item) || [];
      sourceTexts.forEach(function (text, index) {
        push(text, index === 0 ? "a" : index === 1 ? "b" : "");
      });
    }

    const textWrap = item.querySelector(".dt-text-container");
    if (textWrap) {
      const raw = String(textWrap.textContent || "").replace(/\r\n/g, "\n");
      const pairMatch = raw.match(/asr_text1\s*:\s*([\s\S]*?)\s*asr_text2\s*:\s*([\s\S]*)$/i);
      if (pairMatch) {
        push(pairMatch[1], "a");
        push(pairMatch[2], "b");
      }
    }

    return candidates.slice(0, 2);
  }

  function getProjectName() {
    const breadcrumb = document.querySelector(".mark-toolbox-breadcrumb-wrapper");
    if (breadcrumb) {
      const text = normalizeText(breadcrumb.textContent || "");
      if (text) {
        return text.slice(0, 120);
      }
    }

    const titleNode = document.querySelector(".mark-toolbox");
    return normalizeText(titleNode?.textContent || "").slice(0, 120);
  }

  function getTaskItemId(item, itemIndex) {
    const attrs = [
      item?.getAttribute?.("data-id"),
      item?.getAttribute?.("data-item-id"),
      item?.getAttribute?.("data-task-item-id"),
      new URLSearchParams(location.search || "").get("taskItemId"),
      new URLSearchParams(location.search || "").get("subTaskId"),
    ]
      .map(normalizeText)
      .filter(Boolean);

    if (attrs.length > 0) {
      return attrs[0].slice(0, 120);
    }

    return "item-" + String(itemIndex >= 0 ? itemIndex + 1 : 0);
  }

  function collectCurrentPayload() {
    if (!activeItemApi || typeof activeItemApi.getCurrentContext !== "function") {
      return {
        ok: false,
        message: "当前题定位模块未加载。",
      };
    }

    const context = activeItemApi.getCurrentContext();
    const item = context?.item || null;
    const textarea = context?.textarea || null;
    if (!item || !(item instanceof HTMLElement) || !textarea) {
      return {
        ok: false,
        message: "未定位到当前题文本框。",
      };
    }

    const itemIndexRaw = Number(item.getAttribute("data-index"));
    const itemIndex = Number.isFinite(itemIndexRaw) && itemIndexRaw >= 0 ? itemIndexRaw : 0;
    const currentText = String(textarea.value || "");
    const audioCandidates = collectAudioCandidates(item);
    const textCandidates = collectTextCandidates(item, currentText);

    if (audioCandidates.length === 0 && textCandidates.length === 0 && !normalizeText(currentText)) {
      return {
        ok: false,
        message: "当前题缺少可分析内容（音频与候选文本均为空）。",
      };
    }

    return {
      ok: true,
      item,
      textarea,
      payload: {
        taskItemId: getTaskItemId(item, itemIndex),
        itemIndex,
        projectName: getProjectName(),
        audioCandidates,
        textCandidates,
        currentText,
      },
    };
  }

  globalThis.__ASREdgeAlibabaLabelxTranscriptionAiSuggestionCollector = {
    collectCurrentPayload,
  };
})();

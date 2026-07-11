(function () {
  const ROOT_ATTR = "data-asr-edge-judgement-compact-card";
  const ITEM_ATTR = "data-asr-edge-judgement-compact-item";
  const STYLE_ID = "asr-edge-judgement-compact-card-style";
  const RENDER_VERSION = "compact-card-v3";
  const DEFAULT_DIFF_COLORS = {
    changeBackground: "#fef3c7",
    gapBackground: "#fee2e2",
    punctuationBackground: "#ede9fe",
  };
  const ASR_TITLE_ALLOW_LIST = [
    "两个asr文本",
    "online_rec",
    "online_recognition",
    "asr",
    "asr_text",
  ];
  const ASR_TITLE_IGNORE_LIST = ["上文", "音频地址", "wav_id", "音频", "音频文件"];

  function getStyleText() {
    return [
      ".labelRender-item[" + ITEM_ATTR + "] {",
      "  flex-wrap: wrap !important;",
      "  align-items: stretch;",
      "}",
      ".labelRender-item > [" + ROOT_ATTR + "] {",
      "  display: block !important;",
      "  flex: 0 0 100%;",
      "  align-self: stretch;",
      "  max-width: 100%;",
      "  order: -1;",
      "  position: relative;",
      "  z-index: 1;",
      "}",
      "[" + ROOT_ATTR + "] {",
      "  box-sizing: border-box;",
      "  width: calc(100% - 12px);",
      "  margin: 4px 6px 8px;",
      "  padding: 0;",
      "  border: 0;",
      "  background: transparent;",
      "  color: #0f172a;",
      "  font-size: 12px;",
      "  line-height: 1.5;",
      "  overflow: visible;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-compact-shell {",
      "  box-sizing: border-box;",
      "  width: 100%;",
      "  padding: 6px 8px;",
      "  border: 1px solid #bfdbfe;",
      "  border-radius: 4px;",
      "  background: #f8fbff;",
      "  color: #0f172a;",
      "  overflow: visible;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-compact-head {",
      "  display: flex;",
      "  align-items: flex-start;",
      "  justify-content: space-between;",
      "  gap: 8px;",
      "  margin-bottom: 4px;",
      "  min-width: 0;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-compact-main {",
      "  display: flex;",
      "  flex: 1 1 auto;",
      "  flex-direction: column;",
      "  align-items: flex-start;",
      "  gap: 3px;",
      "  min-width: 0;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-compact-title {",
      "  min-width: 0;",
      "  color: #075985;",
      "  font-weight: 700;",
      "  white-space: nowrap;",
      "  overflow: hidden;",
      "  text-overflow: ellipsis;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-compact-meta {",
      "  display: flex;",
      "  flex-direction: column;",
      "  align-items: stretch;",
      "  gap: 3px;",
      "  min-width: 118px;",
      "  max-width: 46%;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-compact-choice {",
      "  min-width: 0;",
      "  padding: 1px 6px;",
      "  border-radius: 4px;",
      "  background: #e0f2fe;",
      "  color: #075985;",
      "  font-weight: 700;",
      "  text-align: right;",
      "  white-space: nowrap;",
      "  overflow: hidden;",
      "  text-overflow: ellipsis;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-compact-choice[data-choice='first'] {",
      "  background: #dbeafe;",
      "  color: #1d4ed8;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-compact-choice[data-choice='second'] {",
      "  background: #dcfce7;",
      "  color: #166534;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-compact-choice[data-choice='bad'] {",
      "  background: #ffe4e6;",
      "  color: #be123c;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-compact-choice[data-choice='uncertain'] {",
      "  background: #fef3c7;",
      "  color: #92400e;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-compact-choice[data-choice='other'] {",
      "  background: #ede9fe;",
      "  color: #6d28d9;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-compact-choice[data-empty='true'] {",
      "  background: #f1f5f9;",
      "  color: #64748b;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-compact-audio-time {",
      "  min-width: 0;",
      "  padding: 1px 6px;",
      "  border-radius: 4px;",
      "  background: #eef2ff;",
      "  color: #4338ca;",
      "  font-weight: 700;",
      "  text-align: right;",
      "  white-space: nowrap;",
      "  overflow: hidden;",
      "  text-overflow: ellipsis;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-compact-thunder {",
      "  margin: 4px 0 5px;",
      "  padding: 4px 6px;",
      "  border: 1px solid #fbbf24;",
      "  border-radius: 4px;",
      "  background: #fffbeb;",
      "  color: #92400e;",
      "  font-weight: 700;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-compact-thunder[data-mismatch='true'] {",
      "  border-color: #ef4444;",
      "  background: #fef2f2;",
      "  color: #991b1b;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-compact-row {",
      "  display: grid;",
      "  grid-template-columns: 62px minmax(0, 1fr);",
      "  gap: 6px;",
      "  align-items: start;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-compact-label {",
      "  color: #475569;",
      "  font-weight: 700;",
      "  white-space: nowrap;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-compact-text {",
      "  min-width: 0;",
      "  overflow: visible;",
      "  text-overflow: clip;",
      "  white-space: normal;",
      "  word-break: break-word;",
      "  overflow-wrap: anywhere;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-compact-row[data-diff='true'] .asr-edge-compact-text {",
      "  font-family: Consolas, 'Microsoft YaHei UI', 'Microsoft YaHei', monospace;",
      "  line-height: 1.7;",
      "  word-break: break-all;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-compact-diff-summary {",
      "  display: inline-flex;",
      "  align-items: center;",
      "  width: fit-content;",
      "  max-width: 100%;",
      "  margin: 0;",
      "  padding: 1px 6px;",
      "  border-radius: 4px;",
      "  background: #e0f2fe;",
      "  color: #075985;",
      "  font-weight: 700;",
      "  white-space: nowrap;",
      "  overflow: hidden;",
      "  text-overflow: ellipsis;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-compact-diff-equal {",
      "  color: #0f172a;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-compact-diff-change {",
      "  background: var(--asr-edge-diff-change-bg, #fef3c7);",
      "  color: #92400e;",
      "  border-radius: 3px;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-compact-diff-gap {",
      "  background: var(--asr-edge-diff-gap-bg, #fee2e2);",
      "  color: transparent;",
      "  border-radius: 3px;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-compact-diff-punctuation {",
      "  background: var(--asr-edge-diff-punctuation-bg, #ede9fe);",
      "  color: #5b21b6;",
      "  border-radius: 3px;",
      "}",
    ].join("\n");
  }

  function ensureStyle() {
    const styleText = getStyleText();
    const existing = document.getElementById(STYLE_ID);
    if (existing) {
      if (existing.textContent !== styleText) {
        existing.textContent = styleText;
      }
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = styleText;
    (document.head || document.documentElement).appendChild(style);
  }

  function getText(node) {
    return String(node?.textContent || "").replace(/\s+/g, " ").trim();
  }

  function parseAsrText(rawText) {
    const text = String(rawText || "").replace(/\r\n/g, "\n");
    const match = text.match(/asr_text1\s*:\s*([\s\S]*?)\s*asr_text2\s*:\s*([\s\S]*)$/i);
    if (!match) {
      return null;
    }

    return {
      first: match[1].trim(),
      second: match[2].trim(),
    };
  }

  function parseDiffSignature(signature) {
    const text = String(signature || "").replace(/\r\n/g, "\n");
    const parts = text.split("\n---\n");
    if (parts.length < 2) {
      return null;
    }

    return {
      first: parts[0].trim(),
      second: parts.slice(1).join("\n---\n").trim(),
    };
  }

  function normalizeHexColor(value, fallback) {
    const text = typeof value === "string" ? value.trim() : "";
    if (/^#[0-9a-fA-F]{6}$/.test(text)) {
      return text.toLowerCase();
    }

    return fallback;
  }

  function normalizeDiffColors(colors) {
    const diffModule = getDiffModule();
    if (diffModule && typeof diffModule.normalizeDiffColors === "function") {
      return diffModule.normalizeDiffColors(colors);
    }

    const source = colors && typeof colors === "object" ? colors : {};
    return {
      changeBackground: normalizeHexColor(
        source.changeBackground,
        DEFAULT_DIFF_COLORS.changeBackground
      ),
      gapBackground: normalizeHexColor(source.gapBackground, DEFAULT_DIFF_COLORS.gapBackground),
      punctuationBackground: normalizeHexColor(
        source.punctuationBackground,
        DEFAULT_DIFF_COLORS.punctuationBackground
      ),
    };
  }

  function getColorSignature(colors) {
    const diffModule = getDiffModule();
    if (diffModule && typeof diffModule.getColorSignature === "function") {
      return diffModule.getColorSignature(colors);
    }

    const normalized = normalizeDiffColors(colors);
    return [
      normalized.changeBackground,
      normalized.gapBackground,
      normalized.punctuationBackground,
    ].join("|");
  }

  function applyDiffColors(root, colors) {
    const normalized = normalizeDiffColors(colors);
    root.style.setProperty("--asr-edge-diff-change-bg", normalized.changeBackground);
    root.style.setProperty("--asr-edge-diff-gap-bg", normalized.gapBackground);
    root.style.setProperty("--asr-edge-diff-punctuation-bg", normalized.punctuationBackground);
    root.setAttribute("data-asr-edge-color-signature", getColorSignature(normalized));
  }

  function buildFastAlignment(first, second) {
    const firstChars = Array.from(first || "");
    const secondChars = Array.from(second || "");
    const maxLength = Math.max(firstChars.length, secondChars.length);
    const result = [];
    for (let index = 0; index < maxLength; index += 1) {
      result.push({
        left: firstChars[index] || "",
        right: secondChars[index] || "",
        type: firstChars[index] === secondChars[index] ? "equal" : "change",
      });
    }
    return result;
  }

  function getDiffModule() {
    return globalThis.__ASREdgeAlibabaLabelxJudgementAsrDiffView || null;
  }

  function getThunderModule() {
    return globalThis.__ASREdgeAlibabaLabelxJudgementThunderQuestion || null;
  }

  function getThunderInfo(item) {
    const thunderModule = getThunderModule();
    if (thunderModule && typeof thunderModule.getItemInfo === "function") {
      return thunderModule.getItemInfo(item);
    }

    return null;
  }

  function buildAlignment(first, second) {
    const diffModule = getDiffModule();
    if (diffModule && typeof diffModule.buildAlignment === "function") {
      return diffModule.buildAlignment(first || "", second || "");
    }

    return buildFastAlignment(first, second);
  }

  function isPunctuation(char) {
    const diffModule = getDiffModule();
    if (diffModule && typeof diffModule.isPunctuation === "function") {
      return diffModule.isPunctuation(char);
    }

    return /^[\s\p{P}\p{S}]$/u.test(char || "");
  }

  function summarizeDiff(first, second, alignment) {
    const diffModule = getDiffModule();
    if (diffModule && typeof diffModule.summarize === "function") {
      return diffModule.summarize(first || "", second || "", alignment || []);
    }

    return first === second ? "完全相同" : "存在差异";
  }

  function formatSeconds(seconds) {
    const value = Number(seconds);
    if (!Number.isFinite(value) || value < 0) {
      return "--:--";
    }

    const totalSeconds = Math.floor(value);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secondPart = String(totalSeconds % 60).padStart(2, "0");
    if (hours > 0) {
      return String(hours) + ":" + String(minutes).padStart(2, "0") + ":" + secondPart;
    }

    return String(minutes) + ":" + secondPart;
  }

  function getAudioTimeText(item) {
    const audio = item?.querySelector?.(".dt-audio-base-container audio[controls], audio[controls]");
    if (!audio) {
      return "--:-- / --:--";
    }

    const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : NaN;
    const currentTime = Number.isFinite(audio.currentTime) && audio.currentTime >= 0 ? audio.currentTime : 0;
    return formatSeconds(currentTime) + " / " + formatSeconds(duration);
  }

  function findWrapByTitle(item, wrapSelector, titleSelector, targetTitle) {
    const wraps = Array.from(item.querySelectorAll(wrapSelector));
    return (
      wraps.find(function (wrap) {
        const title = wrap.querySelector(titleSelector);
        const text = getText(title);
        return text === targetTitle || text.indexOf(targetTitle) >= 0;
      }) || null
    );
  }

  function normalizeTitle(title) {
    return String(title || "").replace(/\s+/g, "").trim().toLowerCase();
  }

  function isIgnoredContentTitle(title) {
    const normalized = normalizeTitle(title);
    return ASR_TITLE_IGNORE_LIST.some(function (item) {
      return normalized === normalizeTitle(item);
    });
  }

  function isAllowedAsrTitle(title) {
    const normalized = normalizeTitle(title);
    return ASR_TITLE_ALLOW_LIST.some(function (item) {
      return normalized === normalizeTitle(item);
    });
  }

  function findAsrContentWrap(item) {
    const wraps = Array.from(item.querySelectorAll(".labelRender-item-content-wrap"));
    let fallbackWrap = null;
    for (const wrap of wraps) {
      const title = getText(wrap.querySelector(".labelRender-item-content-title"));
      if (isIgnoredContentTitle(title)) {
        continue;
      }
      const container = wrap.querySelector(".dt-text-wrapper .dt-text-container");
      const pair = parseAsrText(container?.textContent || "");
      if (!pair) {
        continue;
      }
      if (isAllowedAsrTitle(title)) {
        return wrap;
      }
      if (!fallbackWrap) {
        fallbackWrap = wrap;
      }
    }
    return fallbackWrap;
  }

  function getAsrPair(item) {
    const wrap = findAsrContentWrap(item);
    const container = wrap?.querySelector(".dt-text-container");
    const rawPair = parseAsrText(container?.textContent || "");
    if (rawPair) {
      return rawPair;
    }

    const diffView = wrap?.querySelector("[data-asr-edge-judgement-diff-view]");
    return parseDiffSignature(diffView?.getAttribute("data-asr-edge-signature") || "");
  }

  function getChoiceText(item) {
    const wrap = findWrapByTitle(
      item,
      ".labelRender-item-answer-wrap",
      ".labelRender-item-answer-title",
      "哪个ASR更优"
    );
    const scope = wrap || item;
    const checkedInput =
      scope.querySelector(".ant-v5-radio-wrapper-checked input[type='radio']") ||
      scope.querySelector("input[type='radio']:checked");
    if (checkedInput) {
      const label = checkedInput.closest("label");
      const labelNode = label?.querySelector(".ant-v5-radio-label");
      return getText(labelNode) || String(checkedInput.value || "").trim();
    }

    return "";
  }

  function getChoiceKey(choiceText) {
    const text = String(choiceText || "").trim();
    if (text === "第一个更好") {
      return "first";
    }
    if (text === "第二个更好") {
      return "second";
    }
    if (text === "都不好") {
      return "bad";
    }
    if (text === "不确定或差不多") {
      return "uncertain";
    }
    if (text === "其他方言或语种") {
      return "other";
    }
    return "";
  }

  function getQuestionText(item) {
    const status = item.querySelector(".labelRender-answerNav-status");
    const text = getText(status);
    if (text) {
      return text;
    }

    const index = Number(item.getAttribute("data-index"));
    return Number.isFinite(index) && index >= 0 ? "第 " + String(index + 1) + " 题" : "当前题";
  }

  function appendText(parent, className, text, attrs) {
    const node = document.createElement("div");
    node.className = className;
    node.textContent = text;
    Object.keys(attrs || {}).forEach(function (key) {
      node.setAttribute(key, attrs[key]);
    });
    parent.appendChild(node);
    return node;
  }

  function appendRow(parent, label, text) {
    const row = document.createElement("div");
    row.className = "asr-edge-compact-row";
    appendText(row, "asr-edge-compact-label", label);
    const textNode = appendText(row, "asr-edge-compact-text", text || "");
    textNode.title = text || "";
    parent.appendChild(row);
  }

  function appendDiffChar(parent, char, type) {
    const span = document.createElement("span");
    span.textContent = char || "\u00a0";
    if (type === "equal") {
      span.className = "asr-edge-compact-diff-equal";
    } else if (!char) {
      span.className = "asr-edge-compact-diff-gap";
      span.title = "此处为空，用于对齐另一条 ASR 文本。";
    } else if (isPunctuation(char)) {
      span.className = "asr-edge-compact-diff-punctuation";
    } else {
      span.className = "asr-edge-compact-diff-change";
    }
    parent.appendChild(span);
  }

  function appendDiffRow(parent, label, side, alignment) {
    const row = document.createElement("div");
    row.className = "asr-edge-compact-row";
    row.setAttribute("data-diff", "true");
    appendText(row, "asr-edge-compact-label", label);
    const textNode = appendText(row, "asr-edge-compact-text", "");
    alignment.forEach(function (part) {
      appendDiffChar(textNode, side === "left" ? part.left : part.right, part.type);
    });
    textNode.title = textNode.textContent || "";
    parent.appendChild(row);
  }

  function renderCompactCard(data) {
    const root = document.createElement("div");
    root.setAttribute(ROOT_ATTR, "true");
    applyDiffColors(root, data.diffColors);
    const alignment = data.renderDiff === true ? buildAlignment(data.first, data.second) : null;
    const diffSummary =
      data.renderDiff === true ? summarizeDiff(data.first, data.second, alignment) : "";

    const shell = document.createElement("div");
    shell.className = "asr-edge-compact-shell";

    const head = document.createElement("div");
    head.className = "asr-edge-compact-head";
    const main = document.createElement("div");
    main.className = "asr-edge-compact-main";
    appendText(main, "asr-edge-compact-title", "两个ASR文本 · " + data.questionText);
    if (diffSummary) {
      appendText(main, "asr-edge-compact-diff-summary", diffSummary);
    }
    head.appendChild(main);
    const meta = document.createElement("div");
    meta.className = "asr-edge-compact-meta";
    appendText(
      meta,
      "asr-edge-compact-choice",
      "哪个ASR更优：" + (data.choiceText || "未选择"),
      {
        "data-choice": getChoiceKey(data.choiceText),
        "data-empty": data.choiceText ? "false" : "true",
      }
    );
    appendText(meta, "asr-edge-compact-audio-time", data.audioTimeText || "--:-- / --:--");
    head.appendChild(meta);
    shell.appendChild(head);

    if (data.thunderInfo) {
      const thunderNode = appendText(
        shell,
        "asr-edge-compact-thunder",
        data.thunderInfo.mismatch
          ? "严重提示：该雷题与标准答案不一致。标准答案：" +
              String(data.thunderInfo.standardAnswer || "未知") +
              "；当前选择：" +
              String(data.thunderInfo.selectedAnswer || "未选择")
          : "雷题：标准答案：" +
              String(data.thunderInfo.standardAnswer || "未知") +
              "；当前选择：" +
              String(data.thunderInfo.selectedAnswer || "未选择")
      );
      thunderNode.setAttribute("data-mismatch", data.thunderInfo.mismatch ? "true" : "false");
    }

    if (data.renderDiff === true) {
      appendDiffRow(shell, "asr_text1", "left", alignment);
      appendDiffRow(shell, "asr_text2", "right", alignment);
    } else {
      appendRow(shell, "asr_text1", data.first);
      appendRow(shell, "asr_text2", data.second);
    }
    root.appendChild(shell);
    return root;
  }

  function getSignature(data) {
    return [
      RENDER_VERSION,
      data.questionText,
      data.choiceText || "",
      data.audioTimeText || "",
      data.renderDiff === true ? "diff" : "plain",
      data.renderDiff === true ? getColorSignature(data.diffColors) : "",
      data.thunderInfo
        ? [
            data.thunderInfo.standardAnswer || "",
            data.thunderInfo.selectedAnswer || "",
            data.thunderInfo.mismatch ? "mismatch" : "ok",
          ].join("|")
        : "",
      data.first || "",
      data.second || "",
    ].join("\n---\n");
  }

  function getItemKey(item) {
    const id = String(item?.getAttribute?.("data-id") || "").trim();
    if (id) {
      return "id:" + id;
    }

    const index = String(item?.getAttribute?.("data-index") || "").trim();
    return index ? "index:" + index : "";
  }

  function getCompactHost(item) {
    return item instanceof HTMLElement ? item : null;
  }

  function getHostCompactCards(host) {
    return Array.from(host?.children || []).filter(function (child) {
      return child instanceof HTMLElement && child.hasAttribute(ROOT_ATTR);
    });
  }

  function findCompactCard(host, key) {
    return (
      getHostCompactCards(host).find(function (child) {
        return child.getAttribute("data-asr-edge-source-key") === key;
      }) || null
    );
  }

  function removeStaleCompactCards(item, activeKey) {
    getHostCompactCards(item).forEach(function (child) {
      const key = child.getAttribute("data-asr-edge-source-key") || "";
      if (key !== activeKey) {
        child.remove();
      }
    });
  }

  function removeLegacyExternalCompactCards() {
    document.querySelectorAll(".labelRender-scrollable > [" + ROOT_ATTR + "]").forEach(function (node) {
      node.remove();
    });
  }

  function upsertCompactCard(item, renderDiff, diffColors) {
    const host = getCompactHost(item);
    const key = getItemKey(item);
    if (!host || !key) {
      return false;
    }
    removeStaleCompactCards(item, key);

    const pair = getAsrPair(item);
    if (!pair) {
      removeCompactCard(item);
      return false;
    }

    const data = {
      questionText: getQuestionText(item),
      choiceText: getChoiceText(item),
      audioTimeText: getAudioTimeText(item),
      renderDiff: renderDiff === true,
      diffColors: normalizeDiffColors(diffColors),
      thunderInfo: getThunderInfo(item),
      first: pair.first,
      second: pair.second,
    };
    const signature = getSignature(data);
    const existing = findCompactCard(host, key);
    if (
      existing &&
      existing.getAttribute("data-asr-edge-signature") === signature &&
      existing.parentElement === item
    ) {
      return false;
    }

    const nextNode = renderCompactCard(data);
    nextNode.setAttribute("data-asr-edge-source-key", key);
    nextNode.setAttribute("data-asr-edge-source-index", String(item.getAttribute("data-index") || ""));
    nextNode.setAttribute("data-asr-edge-source-id", String(item.getAttribute("data-id") || ""));
    nextNode.setAttribute("data-asr-edge-signature", signature);
    item.setAttribute(ITEM_ATTR, "true");
    if (existing) {
      existing.replaceWith(nextNode);
      return true;
    }
    item.insertBefore(nextNode, item.firstElementChild || item.firstChild);
    return true;
  }

  function removeCompactCard(item) {
    const host = getCompactHost(item);
    const key = getItemKey(item);
    const existing = host && key ? findCompactCard(host, key) : null;
    item.removeAttribute(ITEM_ATTR);
    if (existing) {
      existing.remove();
      return true;
    }

    return false;
  }

  function createRuntime(deps) {
    const options = deps && typeof deps === "object" ? deps : {};
    const audioEvents = ["timeupdate", "loadedmetadata", "durationchange", "seeked", "play", "pause", "ended"];
    const thunderModule = getThunderModule();
    const thunderUpdatedEvent = thunderModule?.EVENT_UPDATED || "ASR_EDGE_JUDGEMENT_THUNDER_UPDATED";
    let observer = null;
    let timer = null;
    let started = false;
    let state = {
      visibleCount: 0,
      updatedCount: 0,
      removedCount: 0,
      lastUpdatedAt: null,
    };

    function scan() {
      timer = null;
      if (!started || (options.shouldApply && !options.shouldApply())) {
        return;
      }

      ensureStyle();
      let visibleCount = 0;
      let updatedCount = 0;
      const renderDiff = options.shouldRenderDiff ? options.shouldRenderDiff() === true : false;
      const diffColors = normalizeDiffColors(
        typeof options.getDiffColors === "function" ? options.getDiffColors() : null
      );
      removeLegacyExternalCompactCards();
      const items = Array.from(document.querySelectorAll(".labelRender-item[data-index]"));
      items.forEach(function (item) {
        try {
          visibleCount += 1;
          if (upsertCompactCard(item, renderDiff, diffColors)) {
            updatedCount += 1;
          }
        } catch (error) {
          removeCompactCard(item);
        }
      });

      state = {
        visibleCount: visibleCount,
        updatedCount: updatedCount,
        removedCount: 0,
        lastUpdatedAt: new Date().toISOString(),
      };
    }

    function scheduleScan() {
      if (timer) {
        return;
      }
      timer = window.setTimeout(scan, 120);
    }

    function start() {
      if (started) {
        scheduleScan();
        return;
      }

      started = true;
      observer = new MutationObserver(scheduleScan);
      observer.observe(document.documentElement || document, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "style", "checked", "data-index", "data-asr-edge-signature"],
        characterData: true,
      });
      document.addEventListener("change", scheduleScan, true);
      window.addEventListener("resize", scheduleScan, true);
      document.addEventListener(thunderUpdatedEvent, scheduleScan, true);
      audioEvents.forEach(function (eventName) {
        document.addEventListener(eventName, scheduleScan, true);
      });
      scan();
    }

    function stop() {
      started = false;
      if (timer) {
        window.clearTimeout(timer);
        timer = null;
      }
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      document.removeEventListener("change", scheduleScan, true);
      window.removeEventListener("resize", scheduleScan, true);
      document.removeEventListener(thunderUpdatedEvent, scheduleScan, true);
      audioEvents.forEach(function (eventName) {
        document.removeEventListener(eventName, scheduleScan, true);
      });
      document.querySelectorAll("[" + ROOT_ATTR + "]").forEach(function (node) {
        node.remove();
      });
      document.querySelectorAll("[" + ITEM_ATTR + "]").forEach(function (node) {
        node.removeAttribute(ITEM_ATTR);
      });
    }

    function getState() {
      return Object.assign({}, state, {
        started: started,
      });
    }

    return {
      start: start,
      stop: stop,
      getState: getState,
    };
  }

  globalThis.__ASREdgeAlibabaLabelxJudgementCompactCard = {
    createRuntime: createRuntime,
    parseAsrText: parseAsrText,
    parseDiffSignature: parseDiffSignature,
  };
})();

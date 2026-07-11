(function () {
  const ROOT_ATTR = "data-asr-edge-judgement-diff-view";
  const RAW_HIDDEN_ATTR = "data-asr-edge-judgement-diff-raw-hidden";
  const STYLE_ID = "asr-edge-judgement-diff-view-style";
  const MAX_DP_CELLS = 160000;
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
  const ASR_TITLE_IGNORE_LIST = [
    "上文",
    "音频地址",
    "wav_id",
    "音频",
    "音频文件",
  ];

  function getStyleText() {
    return [
      "[" + ROOT_ATTR + "] {",
      "  margin-top: 8px;",
      "  padding: 8px 10px;",
      "  border: 1px solid #bfdbfe;",
      "  border-radius: 6px;",
      "  background: #f8fbff;",
      "  color: #0f172a;",
      "  font-size: 13px;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-diff-summary {",
      "  display: inline-flex;",
      "  align-items: center;",
      "  gap: 6px;",
      "  margin-bottom: 6px;",
      "  padding: 2px 6px;",
      "  border-radius: 4px;",
      "  background: #e0f2fe;",
      "  color: #075985;",
      "  font-weight: 700;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-diff-row {",
      "  display: grid;",
      "  grid-template-columns: 74px minmax(0, 1fr);",
      "  gap: 8px;",
      "  align-items: start;",
      "  margin-top: 4px;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-diff-label {",
      "  color: #475569;",
      "  font-weight: 700;",
      "  white-space: nowrap;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-diff-text {",
      "  font-family: Consolas, 'Microsoft YaHei UI', 'Microsoft YaHei', monospace;",
      "  white-space: pre-wrap;",
      "  word-break: break-all;",
      "  line-height: 1.75;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-diff-equal {",
      "  color: #0f172a;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-diff-change {",
      "  background: var(--asr-edge-diff-change-bg, #fef3c7);",
      "  color: #92400e;",
      "  border-radius: 3px;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-diff-gap {",
      "  background: var(--asr-edge-diff-gap-bg, #fee2e2);",
      "  color: transparent;",
      "  border-radius: 3px;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-diff-punctuation {",
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

  function isPunctuation(char) {
    return /^[\s\p{P}\p{S}]$/u.test(char || "");
  }

  function normalizeHexColor(value, fallback) {
    const text = typeof value === "string" ? value.trim() : "";
    if (/^#[0-9a-fA-F]{6}$/.test(text)) {
      return text.toLowerCase();
    }

    return fallback;
  }

  function normalizeDiffColors(colors) {
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

  function normalizeForPunctuationCompare(text) {
    return Array.from(String(text || ""))
      .filter(function (char) {
        return !isPunctuation(char);
      })
      .join("");
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

  function normalizeTitle(title) {
    return String(title || "").replace(/\s+/g, "").trim().toLowerCase();
  }

  function getContentWrapTitle(wrap) {
    const titleNode = wrap?.querySelector?.(".labelRender-item-content-title");
    return String(titleNode?.textContent || "").trim();
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

  function hasAsrPairText(rawText) {
    return Boolean(parseAsrText(rawText));
  }

  function isAsrTextWrap(wrap) {
    const title = getContentWrapTitle(wrap);
    if (isIgnoredContentTitle(title)) {
      return false;
    }

    const sourceContainer = wrap?.querySelector?.(".dt-text-wrapper .dt-text-container");
    const rawText = String(sourceContainer?.textContent || "");
    if (!hasAsrPairText(rawText)) {
      return false;
    }

    if (isAllowedAsrTitle(title)) {
      return true;
    }

    return true;
  }

  function buildFastAlignment(first, second) {
    const firstChars = Array.from(first);
    const secondChars = Array.from(second);
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

  function buildAlignment(first, second) {
    const firstChars = Array.from(first);
    const secondChars = Array.from(second);
    const rowCount = firstChars.length + 1;
    const colCount = secondChars.length + 1;
    if (rowCount * colCount > MAX_DP_CELLS) {
      return buildFastAlignment(first, second);
    }

    const scores = Array.from({ length: rowCount }, function () {
      return Array(colCount).fill(0);
    });
    const steps = Array.from({ length: rowCount }, function () {
      return Array(colCount).fill("");
    });

    for (let row = 1; row < rowCount; row += 1) {
      scores[row][0] = scores[row - 1][0] + getGapCost(firstChars[row - 1]);
      steps[row][0] = "delete";
    }
    for (let col = 1; col < colCount; col += 1) {
      scores[0][col] = scores[0][col - 1] + getGapCost(secondChars[col - 1]);
      steps[0][col] = "insert";
    }

    for (let row = 1; row < rowCount; row += 1) {
      for (let col = 1; col < colCount; col += 1) {
        const leftChar = firstChars[row - 1];
        const rightChar = secondChars[col - 1];
        const same = leftChar === rightChar;
        const substituteCost = getSubstituteCost(leftChar, rightChar);
        const candidates = [
          {
            score: scores[row - 1][col - 1] + substituteCost,
            step: same ? "equal" : "change",
            priority: same ? 0 : 2,
          },
          {
            score: scores[row - 1][col] + getGapCost(leftChar),
            step: "delete",
            priority: isPunctuation(leftChar) ? 1 : 3,
          },
          {
            score: scores[row][col - 1] + getGapCost(rightChar),
            step: "insert",
            priority: isPunctuation(rightChar) ? 1 : 3,
          },
        ].sort(function (left, right) {
          if (left.score !== right.score) {
            return left.score - right.score;
          }
          return left.priority - right.priority;
        });
        scores[row][col] = candidates[0].score;
        steps[row][col] = candidates[0].step;
      }
    }

    const alignment = [];
    let row = firstChars.length;
    let col = secondChars.length;
    while (row > 0 || col > 0) {
      const step = steps[row][col];
      if (step === "equal" || step === "change") {
        alignment.push({
          left: firstChars[row - 1],
          right: secondChars[col - 1],
          type: step,
        });
        row -= 1;
        col -= 1;
      } else if (step === "delete") {
        alignment.push({
          left: firstChars[row - 1],
          right: "",
          type: "gap",
        });
        row -= 1;
      } else {
        alignment.push({
          left: "",
          right: secondChars[col - 1],
          type: "gap",
        });
        col -= 1;
      }
    }

    return alignment.reverse();
  }

  function getGapCost(char) {
    return isPunctuation(char) ? 0.35 : 1;
  }

  function getSubstituteCost(leftChar, rightChar) {
    if (leftChar === rightChar) {
      return 0;
    }

    const leftPunctuation = isPunctuation(leftChar);
    const rightPunctuation = isPunctuation(rightChar);
    if (leftPunctuation && rightPunctuation) {
      return 0.3;
    }
    if (leftPunctuation || rightPunctuation) {
      return 2.2;
    }
    return 1.45;
  }

  function summarize(first, second, alignment) {
    if (first === second) {
      return "完全相同";
    }

    if (normalizeForPunctuationCompare(first) === normalizeForPunctuationCompare(second)) {
      return "仅标点或空格不同";
    }

    let gapCount = 0;
    let changeCount = 0;
    alignment.forEach(function (part) {
      if (part.type === "gap") {
        gapCount += 1;
      } else if (part.type === "change") {
        changeCount += 1;
      }
    });

    if (gapCount > 0 && changeCount === 0) {
      return "存在缺字或多字";
    }
    if (Math.abs(Array.from(first).length - Array.from(second).length) >= 4) {
      return "长度差异较大";
    }
    return "存在 " + String(gapCount + changeCount) + " 处差异";
  }

  function appendChar(parent, char, type) {
    const span = document.createElement("span");
    const normalizedChar = char || "\u00a0";
    span.textContent = normalizedChar;

    if (type === "equal") {
      span.className = "asr-edge-diff-equal";
    } else if (!char) {
      span.className = "asr-edge-diff-gap";
      span.title = "此处为空，用于对齐另一条 ASR 文本。";
    } else if (isPunctuation(char)) {
      span.className = "asr-edge-diff-punctuation";
    } else {
      span.className = "asr-edge-diff-change";
    }

    parent.appendChild(span);
  }

  function createTextRow(label, side, alignment) {
    const row = document.createElement("div");
    row.className = "asr-edge-diff-row";

    const labelNode = document.createElement("div");
    labelNode.className = "asr-edge-diff-label";
    labelNode.textContent = label;
    row.appendChild(labelNode);

    const textNode = document.createElement("div");
    textNode.className = "asr-edge-diff-text";
    alignment.forEach(function (part) {
      const char = side === "left" ? part.left : part.right;
      appendChar(textNode, char, part.type);
    });
    row.appendChild(textNode);
    return row;
  }

  function renderDiffView(pair, colors) {
    const alignment = buildAlignment(pair.first, pair.second);
    const root = document.createElement("div");
    root.setAttribute(ROOT_ATTR, "true");
    applyDiffColors(root, colors);

    const summary = document.createElement("div");
    summary.className = "asr-edge-diff-summary";
    summary.textContent = summarize(pair.first, pair.second, alignment);
    root.appendChild(summary);
    root.appendChild(createTextRow("asr_text1", "left", alignment));
    root.appendChild(createTextRow("asr_text2", "right", alignment));
    return root;
  }

  function findAsrTextWraps() {
    return Array.from(document.querySelectorAll(".labelRender-item-content-wrap")).filter(isAsrTextWrap);
  }

  function processWrap(wrap, colors) {
    const sourceWrapper = wrap.querySelector(".dt-text-wrapper");
    const sourceContainer = sourceWrapper?.querySelector(".dt-text-container");
    if (!sourceWrapper || !sourceContainer) {
      return false;
    }

    const pair = parseAsrText(sourceContainer.textContent || "");
    if (!pair) {
      return false;
    }

    const signature = pair.first + "\n---\n" + pair.second;
    const colorSignature = getColorSignature(colors);
    const existing = wrap.querySelector("[" + ROOT_ATTR + "]");
    if (existing && existing.getAttribute("data-asr-edge-signature") === signature) {
      if (existing.getAttribute("data-asr-edge-color-signature") !== colorSignature) {
        applyDiffColors(existing, colors);
      }
      sourceWrapper.style.display = "none";
      sourceWrapper.setAttribute(RAW_HIDDEN_ATTR, "true");
      return false;
    }

    const nextView = renderDiffView(pair, colors);
    nextView.setAttribute("data-asr-edge-signature", signature);
    if (existing) {
      existing.replaceWith(nextView);
    } else {
      sourceWrapper.insertAdjacentElement("afterend", nextView);
    }

    sourceWrapper.style.display = "none";
    sourceWrapper.setAttribute(RAW_HIDDEN_ATTR, "true");
    return true;
  }

  function createRuntime(deps) {
    const options = deps && typeof deps === "object" ? deps : {};
    let observer = null;
    let timer = null;
    let started = false;
    let state = {
      processedCount: 0,
      lastUpdatedAt: null,
    };

    function scan() {
      timer = null;
      if (!started || (options.shouldApply && !options.shouldApply())) {
        return;
      }

      ensureStyle();
      const colors = normalizeDiffColors(
        typeof options.getColors === "function" ? options.getColors() : null
      );
      let processedCount = 0;
      findAsrTextWraps().forEach(function (wrap) {
        if (processWrap(wrap, colors)) {
          processedCount += 1;
        }
      });

      state = {
        processedCount: processedCount,
        lastUpdatedAt: new Date().toISOString(),
      };
    }

    function scheduleScan() {
      if (timer) {
        return;
      }
      timer = window.setTimeout(scan, 180);
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
        characterData: true,
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

      document.querySelectorAll("[" + ROOT_ATTR + "]").forEach(function (node) {
        node.remove();
      });
      document.querySelectorAll("[" + RAW_HIDDEN_ATTR + "]").forEach(function (node) {
        node.style.display = "";
        node.removeAttribute(RAW_HIDDEN_ATTR);
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

  globalThis.__ASREdgeAlibabaLabelxJudgementAsrDiffView = {
    createRuntime: createRuntime,
    parseAsrText: parseAsrText,
    buildAlignment: buildAlignment,
    summarize: summarize,
    isPunctuation: isPunctuation,
    normalizeDiffColors: normalizeDiffColors,
    getColorSignature: getColorSignature,
  };
})();

(function () {
  const STYLE_ID = "asr-edge-judgement-thunder-question-style";
  const NOTICE_ATTR = "data-asr-edge-judgement-thunder-notice";
  const EVENT_UPDATED = "ASR_EDGE_JUDGEMENT_THUNDER_UPDATED";
  const BANK_PATH =
    "sites/alibaba-labelx/asr-judgement/data/thunder-question-bank.csv";
  const VALID_ANSWERS = [
    "第一个更好",
    "第二个更好",
    "都不好",
    "不确定或差不多",
    "其他方言或语种",
  ];
  const ASR_TITLE_ALLOW_LIST = [
    "两个asr文本",
    "online_rec",
    "online_recognition",
    "asr",
    "asr_text",
  ];
  const ASR_TITLE_IGNORE_LIST = ["上文", "音频地址", "wav_id", "音频", "音频文件"];

  let bankPromise = null;
  let bankIndex = new Map();
  let bankLoaded = false;
  let bankError = "";
  let enabled = true;

  function getStyleText() {
    return [
      "[" + NOTICE_ATTR + "] {",
      "  box-sizing: border-box;",
      "  margin: 6px 0 8px;",
      "  padding: 8px 10px;",
      "  border: 1px solid #fbbf24;",
      "  border-radius: 4px;",
      "  background: #fffbeb;",
      "  color: #92400e;",
      "  font-size: 13px;",
      "  line-height: 1.5;",
      "}",
      "[" + NOTICE_ATTR + "][data-mismatch='true'] {",
      "  border-color: #ef4444;",
      "  background: #fef2f2;",
      "  color: #991b1b;",
      "  font-weight: 700;",
      "}",
      "[" + NOTICE_ATTR + "] .asr-edge-thunder-title {",
      "  margin-right: 8px;",
      "  font-weight: 700;",
      "}",
      "[" + NOTICE_ATTR + "] .asr-edge-thunder-detail {",
      "  margin-top: 2px;",
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

  function normalizeTextForKey(value) {
    return String(value || "")
      .replace(/\r\n/g, "\n")
      .replace(/\s+/g, "")
      .trim()
      .toLowerCase();
  }

  function buildPairKey(first, second) {
    return normalizeTextForKey(first) + "\n---\n" + normalizeTextForKey(second);
  }

  function normalizeAnswer(value) {
    const text = String(value || "").replace(/\s+/g, "").trim();
    if (!text) {
      return "";
    }

    if (text.indexOf("第一") >= 0 || text.indexOf("1") === 0) {
      return "第一个更好";
    }
    if (text.indexOf("第二") >= 0 || text.indexOf("2") === 0) {
      return "第二个更好";
    }
    if (text.indexOf("都不好") >= 0 || text.indexOf("都不") >= 0) {
      return "都不好";
    }
    if (text.indexOf("不确定") >= 0 || text.indexOf("差不多") >= 0) {
      return "不确定或差不多";
    }
    if (text.indexOf("其他") >= 0 || text.indexOf("方言") >= 0 || text.indexOf("语种") >= 0) {
      return "其他方言或语种";
    }

    return VALID_ANSWERS.indexOf(value) >= 0 ? value : String(value || "").trim();
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;
    const source = String(text || "");

    for (let index = 0; index < source.length; index += 1) {
      const char = source[index];
      const nextChar = source[index + 1];

      if (inQuotes) {
        if (char === '"' && nextChar === '"') {
          field += '"';
          index += 1;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          field += char;
        }
        continue;
      }

      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        row.push(field);
        field = "";
      } else if (char === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (char !== "\r") {
        field += char;
      }
    }

    row.push(field);
    if (row.length > 1 || String(row[0] || "").trim()) {
      rows.push(row);
    }

    return rows;
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

  function buildIndexFromCsv(csvText) {
    const rows = parseCsv(csvText);
    const header = rows.shift() || [];
    const onlineIndex = header.findIndex(function (name) {
      return String(name || "").trim() === "online_rec";
    });
    const answerIndex = header.findIndex(function (name) {
      return String(name || "").trim() === "better_asr";
    });
    const nextIndex = new Map();

    rows.forEach(function (row, index) {
      const rawPair = row[onlineIndex >= 0 ? onlineIndex : 0];
      const answer = normalizeAnswer(row[answerIndex >= 0 ? answerIndex : 1]);
      const pair = parseAsrText(rawPair);
      if (!pair || !answer) {
        return;
      }

      nextIndex.set(buildPairKey(pair.first, pair.second), {
        rowNumber: index + 2,
        standardAnswer: answer,
        first: pair.first,
        second: pair.second,
      });
    });

    return nextIndex;
  }

  function getBankUrl() {
    if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.getURL) {
      return "";
    }

    return chrome.runtime.getURL(BANK_PATH);
  }

  function ensureBankLoaded() {
    if (bankPromise) {
      return bankPromise;
    }

    const bankUrl = getBankUrl();
    if (!bankUrl) {
      bankError = "无法获取雷题库地址。";
      bankPromise = Promise.resolve(false);
      return bankPromise;
    }

    bankPromise = fetch(bankUrl, { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("雷题库读取失败：" + String(response.status));
        }
        return response.text();
      })
      .then(function (csvText) {
        bankIndex = buildIndexFromCsv(csvText);
        bankLoaded = true;
        bankError = "";
        dispatchUpdatedEvent();
        return true;
      })
      .catch(function (error) {
        bankLoaded = false;
        bankError = error && error.message ? error.message : String(error);
        dispatchUpdatedEvent();
        return false;
      });

    return bankPromise;
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

  function getItemKey(item) {
    const id = String(item?.getAttribute?.("data-id") || "").trim();
    if (id) {
      return "id:" + id;
    }

    const index = String(item?.getAttribute?.("data-index") || "").trim();
    return index ? "index:" + index : "";
  }

  function getItemInfo(item) {
    if (!enabled || !bankLoaded || !(item instanceof HTMLElement)) {
      return null;
    }

    const pair = getAsrPair(item);
    if (!pair) {
      return null;
    }

    const record = bankIndex.get(buildPairKey(pair.first, pair.second));
    if (!record) {
      return null;
    }

    const selectedAnswer = normalizeAnswer(getChoiceText(item));
    const mismatch = Boolean(selectedAnswer && selectedAnswer !== record.standardAnswer);
    return {
      isThunder: true,
      standardAnswer: record.standardAnswer,
      selectedAnswer: selectedAnswer,
      mismatch: mismatch,
      rowNumber: record.rowNumber,
      first: pair.first,
      second: pair.second,
    };
  }

  function dispatchUpdatedEvent() {
    try {
      document.dispatchEvent(
        new CustomEvent(EVENT_UPDATED, {
          detail: {
            enabled: enabled,
            loaded: bankLoaded,
            size: bankIndex.size,
            error: bankError,
          },
        })
      );
    } catch (error) {
      // Ignore CustomEvent failures in unusual document states.
    }
  }

  function getNoticeSignature(info) {
    return [
      info.standardAnswer || "",
      info.selectedAnswer || "",
      info.mismatch ? "mismatch" : "ok",
    ].join("|");
  }

  function createNotice(info) {
    const node = document.createElement("div");
    node.setAttribute(NOTICE_ATTR, "true");
    node.setAttribute("data-mismatch", info.mismatch ? "true" : "false");
    node.setAttribute("data-signature", getNoticeSignature(info));

    const line = document.createElement("div");
    const title = document.createElement("span");
    title.className = "asr-edge-thunder-title";
    title.textContent = info.mismatch ? "严重提示" : "雷题判断";
    line.appendChild(title);
    const summary = document.createElement("span");
    summary.textContent = info.mismatch
      ? "该雷题与标准答案不一致。"
      : "该题是雷题。";
    line.appendChild(summary);
    node.appendChild(line);

    const detail = document.createElement("div");
    detail.className = "asr-edge-thunder-detail";
    detail.textContent =
      "标准答案：" +
      String(info.standardAnswer || "未知") +
      "；当前选择：" +
      String(info.selectedAnswer || "未选择");
    node.appendChild(detail);
    return node;
  }

  function getExistingNotice(wrap) {
    return (
      Array.from(wrap?.children || []).find(function (child) {
        return child instanceof HTMLElement && child.hasAttribute(NOTICE_ATTR);
      }) || null
    );
  }

  function upsertAnswerNotice(item, info) {
    const wrap = findWrapByTitle(
      item,
      ".labelRender-item-answer-wrap",
      ".labelRender-item-answer-title",
      "特殊情况标注"
    );
    if (!wrap) {
      return false;
    }

    const existing = getExistingNotice(wrap);
    const signature = getNoticeSignature(info);
    if (existing && existing.getAttribute("data-signature") === signature) {
      return false;
    }

    const nextNotice = createNotice(info);
    if (existing) {
      existing.replaceWith(nextNotice);
      return true;
    }

    const title = wrap.querySelector(".labelRender-item-answer-title");
    if (title && title.parentElement === wrap) {
      title.insertAdjacentElement("afterend", nextNotice);
    } else {
      wrap.insertBefore(nextNotice, wrap.firstElementChild || wrap.firstChild);
    }
    return true;
  }

  function removeAnswerNotice(item) {
    let removed = false;
    item.querySelectorAll("[" + NOTICE_ATTR + "]").forEach(function (node) {
      node.remove();
      removed = true;
    });
    return removed;
  }

  function createRuntime(deps) {
    const options = deps && typeof deps === "object" ? deps : {};
    let observer = null;
    let timer = null;
    let started = false;
    let warnedMismatchKeys = new Set();
    let state = {
      loaded: false,
      bankSize: 0,
      matchedCount: 0,
      mismatchCount: 0,
      error: "",
      lastUpdatedAt: null,
    };

    function getConfig() {
      return typeof options.getConfig === "function" ? options.getConfig() || {} : {};
    }

    function shouldApply() {
      return typeof options.shouldApply === "function" ? options.shouldApply() === true : true;
    }

    function shouldEnable() {
      return getConfig().thunderQuestionEnabled !== false;
    }

    function showToast(message, tone) {
      if (typeof options.showToast === "function") {
        options.showToast(message, tone);
      }
    }

    function maybeWarnMismatch(item, info) {
      const key = getItemKey(item) + "|" + getNoticeSignature(info);
      if (!info.mismatch) {
        return;
      }
      if (warnedMismatchKeys.has(key)) {
        return;
      }

      warnedMismatchKeys.add(key);
      showToast(
        "严重提示：该雷题与标准答案不一致。标准答案：" + String(info.standardAnswer || "未知"),
        "error"
      );
    }

    function removeAllNotices() {
      let removed = false;
      document.querySelectorAll(".labelRender-item[data-index]").forEach(function (item) {
        if (removeAnswerNotice(item)) {
          removed = true;
        }
      });
      if (removed) {
        dispatchUpdatedEvent();
      }
    }

    function scan() {
      timer = null;
      enabled = shouldEnable();
      if (!started || !shouldApply() || !enabled) {
        removeAllNotices();
        state = Object.assign({}, state, {
          matchedCount: 0,
          mismatchCount: 0,
          loaded: bankLoaded,
          bankSize: bankIndex.size,
          error: bankError,
          lastUpdatedAt: new Date().toISOString(),
        });
        return;
      }

      ensureStyle();
      if (!bankLoaded) {
        void ensureBankLoaded().then(scheduleScan);
        state = Object.assign({}, state, {
          loaded: bankLoaded,
          bankSize: bankIndex.size,
          error: bankError,
          lastUpdatedAt: new Date().toISOString(),
        });
        return;
      }

      let matchedCount = 0;
      let mismatchCount = 0;
      let changed = false;
      document.querySelectorAll(".labelRender-item[data-index]").forEach(function (item) {
        const info = getItemInfo(item);
        if (!info) {
          changed = removeAnswerNotice(item) || changed;
          return;
        }

        matchedCount += 1;
        if (info.mismatch) {
          mismatchCount += 1;
          maybeWarnMismatch(item, info);
        }
        changed = upsertAnswerNotice(item, info) || changed;
      });

      state = {
        loaded: bankLoaded,
        bankSize: bankIndex.size,
        matchedCount: matchedCount,
        mismatchCount: mismatchCount,
        error: bankError,
        lastUpdatedAt: new Date().toISOString(),
      };

      if (changed) {
        dispatchUpdatedEvent();
      }
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
      enabled = shouldEnable();
      observer = new MutationObserver(scheduleScan);
      observer.observe(document.documentElement || document, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "style", "checked", "data-index", "data-asr-edge-signature"],
        characterData: true,
      });
      document.addEventListener("change", scheduleScan, true);
      void ensureBankLoaded().then(scheduleScan);
      scan();
    }

    function stop() {
      started = false;
      enabled = false;
      if (timer) {
        window.clearTimeout(timer);
        timer = null;
      }
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      document.removeEventListener("change", scheduleScan, true);
      warnedMismatchKeys = new Set();
      removeAllNotices();
    }

    function getState() {
      return Object.assign({}, state, {
        started: started,
        enabled: enabled,
      });
    }

    return {
      start: start,
      stop: stop,
      scheduleScan: scheduleScan,
      getState: getState,
    };
  }

  globalThis.__ASREdgeAlibabaLabelxJudgementThunderQuestion = {
    EVENT_UPDATED: EVENT_UPDATED,
    createRuntime: createRuntime,
    ensureBankLoaded: ensureBankLoaded,
    getItemInfo: getItemInfo,
    parseCsv: parseCsv,
    parseAsrText: parseAsrText,
    normalizeAnswer: normalizeAnswer,
    buildPairKey: buildPairKey,
  };
})();

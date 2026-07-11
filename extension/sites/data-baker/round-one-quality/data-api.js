(function () {
  const SOURCE = "ASR_EDGE_DATABAKER_ROUND_ONE_QUALITY_PAGE";
  const MESSAGE_TYPE = "DATABAKER_ROUND_ONE_QUALITY_COLLECT_RESPONSE";
  const API_PATH = "/cms/tbAudioUserTask/queryCollectStatementByCondtion";
  const FOCUS_SENTINEL_ID = "asr-edge-data-baker-focus-sentinel";

  function isRoundOneCollectPage() {
    return (
      location.hostname === "datafactory.data-baker.com" &&
      String(location.hash || "").indexOf("/quality/roundOneCollect") >= 0
    );
  }

  function parseHashParams() {
    const hash = String(location.hash || "");
    const queryIndex = hash.indexOf("?");
    const params = new URLSearchParams(queryIndex >= 0 ? hash.slice(queryIndex + 1) : "");
    return {
      collectId: String(params.get("collectId") || "").trim(),
      checkType: String(params.get("checkType") || "").trim(),
    };
  }

  function normalizeText(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  function normalizeSentenceText(text) {
    return normalizeText(text).replace(/^\d+\s*/, "").trim();
  }

  function normalizeStatusName(value) {
    return String(value || "").replace(/\s+/g, "").trim();
  }

  function isQualifiedStatus(value) {
    const normalized = normalizeStatusName(value);
    return normalized === "质检合格" || normalized === "一检合格";
  }

  function isUnqualifiedStatus(value) {
    const normalized = normalizeStatusName(value);
    return normalized === "质检不合格" || normalized === "一检不合格";
  }

  function isUncheckedStatus(value) {
    return normalizeStatusName(value) === "未质检";
  }

  function ensureChineseSentencePunctuation(text) {
    const value = String(text || "").trim();
    if (!value) {
      return "";
    }
    const last = value[value.length - 1];
    if ("。！？；…".indexOf(last) >= 0) {
      return value;
    }
    if (last === ".") {
      return value.slice(0, -1) + "。";
    }
    if (last === "?") {
      return value.slice(0, -1) + "？";
    }
    if (last === "!") {
      return value.slice(0, -1) + "！";
    }
    if (last === ";") {
      return value.slice(0, -1) + "；";
    }
    return value + "。";
  }

  function removeTextSpaces(text) {
    return String(text || "").replace(/[\s\u3000]+/g, "");
  }

  function isEditableElement(element) {
    if (!(element instanceof Element)) {
      return false;
    }
    const tagName = String(element.tagName || "").toLowerCase();
    if (tagName === "input" || tagName === "textarea" || tagName === "select") {
      return true;
    }
    if (element.isContentEditable) {
      return true;
    }
    return Boolean(
      element.closest(
        "textarea.el-textarea__inner, .el-textarea textarea, input.el-input__inner, [contenteditable='true'], [contenteditable='']"
      )
    );
  }

  function focusSafeBody() {
    try {
      let focusNode = document.getElementById(FOCUS_SENTINEL_ID);
      if (!focusNode) {
        focusNode = document.createElement("button");
        focusNode.id = FOCUS_SENTINEL_ID;
        focusNode.type = "button";
        focusNode.setAttribute("aria-hidden", "true");
        focusNode.tabIndex = -1;
        focusNode.style.position = "fixed";
        focusNode.style.left = "-9999px";
        focusNode.style.top = "-9999px";
        focusNode.style.width = "1px";
        focusNode.style.height = "1px";
        focusNode.style.opacity = "0";
        document.documentElement.appendChild(focusNode);
      }

      focusNode.focus({ preventScroll: true });

      if (document.body instanceof HTMLElement) {
        if (!document.body.hasAttribute("tabindex")) {
          document.body.setAttribute("tabindex", "-1");
        }
        document.body.focus({ preventScroll: true });
      }
    } catch (error) {
      // Ignore focus restoration failures; text has already been filled.
    }
  }

  function exitEditingFocus(element) {
    try {
      if (element && typeof element.blur === "function") {
        element.blur();
      }
    } catch (error) {
      // Ignore focus restoration failures; text has already been filled.
    }

    try {
      const activeElement = document.activeElement;
      if (
        isEditableElement(activeElement) &&
        activeElement instanceof HTMLElement &&
        typeof activeElement.blur === "function"
      ) {
        activeElement.blur();
      }
    } catch (error) {
      // Ignore focus restoration failures; text has already been filled.
    }

    focusSafeBody();
  }

  function toNumberOrNull(value) {
    if (value === undefined || value === null || value === "") {
      return null;
    }
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
  }

  function toPositiveNumber(value, fallbackValue) {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue) && numericValue > 0) {
      return numericValue;
    }
    const fallbackNumber = Number(fallbackValue);
    if (Number.isFinite(fallbackNumber) && fallbackNumber > 0) {
      return fallbackNumber;
    }
    return null;
  }

  function parseFirstNumber(text) {
    const match = String(text || "").match(/(-?\d+(?:\.\d+)?)/);
    if (!match) {
      return null;
    }
    return toNumberOrNull(match[1]);
  }

  function parseSentenceNumberFromTitle(text) {
    const match = String(text || "").match(/^\s*(\d+)\s+/);
    if (!match) {
      return null;
    }
    return toNumberOrNull(match[1]);
  }

  function delay(ms) {
    return new Promise(function (resolve) {
      window.setTimeout(resolve, ms);
    });
  }

  function extractRecords(payload) {
    const candidates = [
      payload?.data?.list,
      payload?.data?.records,
      payload?.data?.rows,
      payload?.data?.data,
      payload?.data,
      payload?.records,
      payload?.rows,
      payload?.list,
    ];

    for (let index = 0; index < candidates.length; index += 1) {
      if (Array.isArray(candidates[index])) {
        return candidates[index];
      }
    }

    return [];
  }

  function normalizeRecord(record, index) {
    const sourceRecord = record && typeof record === "object" ? record : {};
    return {
      id: sourceRecord.id,
      audioUrl: sourceRecord.audioUrl,
      audioText: sourceRecord.audioText,
      sentenceNumber: sourceRecord.sentenceNumber,
      readRequire: sourceRecord.readRequire,
      effectiveStartTime: sourceRecord.effectiveStartTime,
      effectiveEndTime: sourceRecord.effectiveEndTime,
      effectiveTime: sourceRecord.effectiveTime,
      audioDuration: sourceRecord.audioDuration,
      vad: sourceRecord.vad,
      statusName: sourceRecord.statusName,
      collectId: sourceRecord.collectId,
      textId: sourceRecord.textId,
      snr: sourceRecord.snr,
      volume: sourceRecord.volume,
      noise: sourceRecord.noise,
      __index: index,
    };
  }

  function extractTotal(payload, records) {
    const candidates = [
      payload?.data?.total,
      payload?.data?.count,
      payload?.data?.totalCount,
      payload?.total,
      payload?.count,
      payload?.totalCount,
    ];

    for (let index = 0; index < candidates.length; index += 1) {
      const value = Number(candidates[index]);
      if (Number.isFinite(value)) {
        return value;
      }
    }

    return Array.isArray(records) ? records.length : 0;
  }

  function createRuntime() {
    const networkEntries = [];

    function rememberNetworkEntry(entry) {
      if (!entry || typeof entry !== "object") {
        return;
      }
      networkEntries.unshift(entry);
      networkEntries.splice(8);
    }

    function handleMessage(event) {
      if (event.source !== window || event.origin !== location.origin) {
        return;
      }
      const data = event.data || {};
      if (data.source !== SOURCE || data.type !== MESSAGE_TYPE) {
        return;
      }
      rememberNetworkEntry(data.payload);
    }

    function start() {
      window.addEventListener("message", handleMessage);
    }

    function stop() {
      window.removeEventListener("message", handleMessage);
      networkEntries.splice(0);
    }

    function getActiveSentenceItem() {
      return (
        document.querySelector(".sentence-list .sentence-item.active") ||
        document.querySelector(".sentence-list .sentence-item")
      );
    }

    function parseDomStatusName(item) {
      if (!(item instanceof Element)) {
        return "";
      }
      if (item.querySelector(".labelStatus3")) {
        return "质检合格";
      }
      if (item.querySelector(".labelStatus4")) {
        return "质检不合格";
      }
      if (item.querySelector(".labelStatus1")) {
        return "未质检";
      }
      const text = normalizeText(item.textContent || "");
      if (text.indexOf("一检合格") >= 0 || text.indexOf("质检合格") >= 0) {
        return "质检合格";
      }
      if (text.indexOf("一检不合格") >= 0 || text.indexOf("质检不合格") >= 0) {
        return "质检不合格";
      }
      if (text.indexOf("未质检") >= 0) {
        return "未质检";
      }
      return "";
    }

    function getSentenceItems() {
      return Array.from(document.querySelectorAll(".sentence-list .sentence-item")).map(function (
        item,
        index
      ) {
        const titleNode = item.querySelector(".title");
        const titleText = normalizeText(titleNode?.textContent || "");
        return {
          itemNode: item,
          titleNode: titleNode || null,
          index: index,
          titleText: titleText,
          normalizedTitleText: normalizeSentenceText(titleText),
          sentenceNumber: parseSentenceNumberFromTitle(titleText),
          statusName: parseDomStatusName(item),
        };
      });
    }

    function getActiveListIndex() {
      const active = getActiveSentenceItem();
      const items = Array.from(document.querySelectorAll(".sentence-list .sentence-item"));
      return Math.max(0, items.indexOf(active));
    }

    function getPageTextArea() {
      const textBox = Array.from(document.querySelectorAll(".waver-page .text-box")).find(function (
        node
      ) {
        return normalizeText(node.textContent).indexOf("本句话文本") >= 0;
      });
      return (
        textBox?.querySelector("textarea.el-textarea__inner, textarea") ||
        document.querySelector(".waver-page .text-box textarea.el-textarea__inner") ||
        null
      );
    }

    function getPageText() {
      const textarea = getPageTextArea();
      const value = textarea ? String(textarea.value || "").trim() : "";
      if (value) {
        return value;
      }

      const title = getActiveSentenceItem()?.querySelector(".title");
      return normalizeSentenceText(title?.textContent || "");
    }

    function getSentenceNumber() {
      const title = getActiveSentenceItem()?.querySelector(".title");
      return parseSentenceNumberFromTitle(title?.textContent || "");
    }

    function getReadRequire() {
      const nodes = Array.from(document.querySelectorAll(".waver-page *"));
      const node = nodes.find(function (item) {
        return Array.from(item.childNodes || []).some(function (child) {
          return child.nodeType === Node.TEXT_NODE && normalizeText(child.textContent).indexOf("朗读要求：") >= 0;
        });
      });
      const text = normalizeText(node?.textContent || "");
      return text.replace(/^.*?朗读要求：/, "").trim();
    }

    function getDurationInfoFromDom() {
      const container = document.querySelector(".timeform_left_time");
      const text = normalizeText(container?.textContent || "");
      return {
        audioDuration: parseFirstNumber((text.match(/总时长：[^截]+/) || [""])[0]),
        effectiveTime: parseFirstNumber((text.match(/截取时长：[^有]+/) || [""])[0]),
        effectiveStartTime: parseFirstNumber((text.match(/有效开始时间：[^有]+/) || [""])[0]),
        effectiveEndTime: parseFirstNumber((text.match(/有效结束时间：.*/) || [""])[0]),
      };
    }

    function getPageInfoFromDom() {
      const activePage = document.querySelector(".roundOneCollect-el-pagination .el-pager li.active");
      const selectedSize = document.querySelector(
        ".roundOneCollect-el-pagination .el-select-dropdown__item.selected span"
      );
      const pageSizeText = normalizeText(selectedSize?.textContent || "");
      const pageSize = parseFirstNumber(pageSizeText);
      const pageNum = parseFirstNumber(activePage?.textContent || "");
      return {
        pageNum: pageNum || 1,
        pageSize: pageSize || 10,
      };
    }

    function findBestNetworkEntry(routeParams) {
      const collectId = String(routeParams.collectId || "");
      return (
        networkEntries.find(function (entry) {
          return String(entry?.params?.collectId || "") === collectId;
        }) ||
        networkEntries[0] ||
        null
      );
    }

    function findRecord(entry, domState) {
      const records = Array.isArray(entry?.records) ? entry.records : [];
      const sentenceNumber = toNumberOrNull(domState.sentenceNumber);
      const pageText = normalizeText(domState.pageText);
      const listIndex = getActiveListIndex();

      return (
        records.find(function (record) {
          return toNumberOrNull(record.sentenceNumber) === sentenceNumber;
        }) ||
        records.find(function (record) {
          return normalizeText(record.audioText) === pageText;
        }) ||
        records[listIndex] ||
        null
      );
    }

    async function fetchCurrentPageData(routeParams, pageInfo) {
      const url = new URL(API_PATH, location.origin);
      url.searchParams.set("pageSize", String(pageInfo.pageSize || 10));
      url.searchParams.set("pageNum", String(pageInfo.pageNum || 1));
      url.searchParams.set("collectId", String(routeParams.collectId || ""));
      url.searchParams.set("audioText", "");
      url.searchParams.set("sentenceNumber", "");
      url.searchParams.set("vadStatus", "");

      const response = await fetch(url.toString(), {
        method: "GET",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("读取当前列表接口失败（HTTP " + String(response.status) + "）。");
      }
      const payload = await response.json();
      const records = extractRecords(payload).map(normalizeRecord);
      const entry = {
        at: Date.now(),
        params: {
          collectId: routeParams.collectId,
          pageNum: pageInfo.pageNum,
          pageSize: pageInfo.pageSize,
        },
        total: extractTotal(payload, records),
        records,
      };
      rememberNetworkEntry(entry);
      return entry;
    }

    async function refreshCurrentPageData(options) {
      const runtimeOptions = options && typeof options === "object" ? options : {};
      const routeParams = parseHashParams();
      if (!routeParams.collectId) {
        return {
          ok: false,
          message: "当前页面缺少 collectId，无法刷新列表数据。",
        };
      }
      const domPageInfo = getPageInfoFromDom();
      const pageNum = toPositiveNumber(runtimeOptions.pageNum, domPageInfo.pageNum || 1) || 1;
      const requestedPageSize = runtimeOptions.forcePageSize === true
        ? toPositiveNumber(runtimeOptions.pageSize, 50) || 50
        : toPositiveNumber(runtimeOptions.pageSize, domPageInfo.pageSize || 10) ||
          domPageInfo.pageSize ||
          10;
      try {
        const entry = await fetchCurrentPageData(routeParams, {
          pageNum: pageNum,
          pageSize: requestedPageSize,
        });
        return {
          ok: true,
          entry: {
            total: entry.total,
            records: Array.isArray(entry.records) ? entry.records : [],
            params: Object.assign({}, entry.params || {}),
          },
        };
      } catch (error) {
        return {
          ok: false,
          message: error?.message || "刷新当前页列表失败。",
        };
      }
    }

    function findDomItemForRecord(record, domItems) {
      const list = Array.isArray(domItems) ? domItems : getSentenceItems();
      if (!record || typeof record !== "object") {
        return null;
      }
      const sentenceNumber = toNumberOrNull(record.sentenceNumber);
      if (Number.isFinite(sentenceNumber)) {
        const bySentence = list.find(function (item) {
          return toNumberOrNull(item.sentenceNumber) === sentenceNumber;
        });
        if (bySentence) {
          return bySentence;
        }
      }
      const normalizedAudioText = normalizeSentenceText(record.audioText || "");
      if (normalizedAudioText) {
        const byAudioText =
          list.find(function (item) {
            return item.normalizedTitleText === normalizedAudioText;
          }) || null;
        if (byAudioText) {
          return byAudioText;
        }
      }
      const byIndex = Number.isFinite(record.__index) ? list[record.__index] : null;
      if (byIndex) {
        return byIndex;
      }
      return null;
    }

    function getDomStatusForRecord(record) {
      const domItem = findDomItemForRecord(record);
      return normalizeStatusName(domItem?.statusName || "");
    }

    function isRecordQualified(record) {
      const statusFromRecord = normalizeStatusName(record?.statusName || "");
      const statusFromDom = getDomStatusForRecord(record);

      if (
        isUnqualifiedStatus(statusFromRecord) ||
        isUncheckedStatus(statusFromRecord) ||
        isUnqualifiedStatus(statusFromDom) ||
        isUncheckedStatus(statusFromDom)
      ) {
        return false;
      }
      if (isQualifiedStatus(statusFromRecord) || isQualifiedStatus(statusFromDom)) {
        return true;
      }
      return false;
    }

    function getRecordDisplayName(record) {
      const sentenceNumber = toNumberOrNull(record?.sentenceNumber);
      if (Number.isFinite(sentenceNumber)) {
        return "第 " + String(sentenceNumber) + " 条";
      }
      const audioText = normalizeSentenceText(record?.audioText || "");
      if (audioText) {
        return audioText.slice(0, 20);
      }
      const index = toNumberOrNull(record?.__index);
      if (Number.isFinite(index)) {
        return "索引 " + String(index + 1);
      }
      return "未命名条目";
    }

    function getQualifiedRecords(entry) {
      const records = Array.isArray(entry?.records) ? entry.records : [];
      return records.filter(isRecordQualified);
    }

    function createItemFromRecord(record, entry) {
      const routeParams = parseHashParams();
      const params = entry?.params && typeof entry.params === "object" ? entry.params : {};
      const sourceRecord = record && typeof record === "object" ? record : {};
      const collectId = String(
        sourceRecord.collectId ||
          params.collectId ||
          routeParams.collectId ||
          ""
      ).trim();
      const item = {
        collectId: collectId,
        checkType: String(routeParams.checkType || "").trim(),
        pageNum: toNumberOrNull(params.pageNum),
        pageSize: toNumberOrNull(params.pageSize),
        itemId: String(sourceRecord.id || "").trim(),
        textId: String(sourceRecord.textId || "").trim(),
        sentenceNumber: toNumberOrNull(sourceRecord.sentenceNumber),
        pageText: String(sourceRecord.audioText || "").trim(),
        readRequire: String(sourceRecord.readRequire || "").trim(),
        audioUrl: String(sourceRecord.audioUrl || "").trim(),
        effectiveStartTime: toNumberOrNull(sourceRecord.effectiveStartTime),
        effectiveEndTime: toNumberOrNull(sourceRecord.effectiveEndTime),
        effectiveTime: toNumberOrNull(sourceRecord.effectiveTime),
        audioDuration: toNumberOrNull(sourceRecord.audioDuration),
        record: sourceRecord,
      };

      item.key = [
        item.collectId,
        item.itemId,
        item.textId,
        item.sentenceNumber,
        normalizeText(item.pageText),
      ].join("|");
      return item;
    }

    function createItemsFromQualifiedRecords(records, entry) {
      const source = Array.isArray(records) ? records : [];
      return source.map(function (record, index) {
        const item = createItemFromRecord(record, entry);
        const processKey = String(item.itemId || "").trim()
          ? "id:" + String(item.itemId || "").trim()
          : Number.isFinite(item.sentenceNumber)
            ? "sentence:" + String(item.sentenceNumber)
            : "index:" + String(Number.isFinite(record?.__index) ? record.__index : index);
        return {
          record,
          item,
          processKey,
          displayName: getRecordDisplayName(record),
        };
      });
    }

    async function waitForRecordActivated(domItem, record, timeoutMs) {
      const timeout = Math.max(500, Number(timeoutMs) || 3000);
      const deadline = Date.now() + timeout;
      const expectedText = normalizeSentenceText(record?.audioText || "");
      while (Date.now() < deadline) {
        if (domItem?.itemNode?.classList?.contains("active")) {
          return true;
        }
        if (expectedText) {
          const currentText = normalizeSentenceText(getPageText());
          if (currentText && currentText === expectedText) {
            return true;
          }
        }
        await delay(100);
      }
      return false;
    }

    async function selectRecord(record) {
      if (!record || typeof record !== "object") {
        return { ok: false, message: "无可选记录。" };
      }
      const domItems = getSentenceItems();
      const target = findDomItemForRecord(record, domItems);
      if (!target || !(target.itemNode instanceof HTMLElement)) {
        return { ok: false, message: "找不到对应 DOM 条目。" };
      }
      const clickable = target.titleNode instanceof HTMLElement ? target.titleNode : target.itemNode;
      clickable.click();
      const activated = await waitForRecordActivated(target, record, 3000);
      if (!activated) {
        return { ok: false, message: "已点击条目，但未能确认选中状态。" };
      }
      return {
        ok: true,
        message: "已选中目标条目。",
        record: record,
      };
    }

    async function waitForPageTextReady(record, timeoutMs) {
      const timeout = Math.max(500, Number(timeoutMs) || 3000);
      const deadline = Date.now() + timeout;
      const expectedText = normalizeSentenceText(record?.audioText || "");
      const expectedSentenceNumber = toNumberOrNull(record?.sentenceNumber);
      while (Date.now() < deadline) {
        const currentText = normalizeSentenceText(getPageText());
        if (expectedText && currentText && currentText === expectedText) {
          return { ok: true };
        }
        const activeItem = getActiveSentenceItem();
        const activeTitle = normalizeSentenceText(activeItem?.querySelector(".title")?.textContent || "");
        if (expectedText && activeTitle && activeTitle === expectedText) {
          return { ok: true };
        }
        const activeSentenceNumber = parseSentenceNumberFromTitle(
          activeItem?.querySelector(".title")?.textContent || ""
        );
        if (
          Number.isFinite(expectedSentenceNumber) &&
          Number.isFinite(activeSentenceNumber) &&
          expectedSentenceNumber === activeSentenceNumber
        ) {
          return { ok: true };
        }
        await delay(100);
      }
      return { ok: false, message: "页面文本同步超时。" };
    }

    function getAudioUrlFromDom() {
      const audio = document.querySelector("audio");
      if (audio?.currentSrc || audio?.src) {
        return String(audio.currentSrc || audio.src || "").trim();
      }

      const iframe = document.querySelector("#iframeBox iframe#myIframe, #iframeBox iframe");
      try {
        const iframeAudio = iframe?.contentDocument?.querySelector("audio");
        return String(iframeAudio?.currentSrc || iframeAudio?.src || "").trim();
      } catch (error) {
        return "";
      }
    }

    function canFillPageText() {
      const textarea = getPageTextArea();
      return Boolean(textarea && !textarea.disabled && !textarea.readOnly);
    }

    function fillPageText(text) {
      const textarea = getPageTextArea();
      if (!textarea || textarea.disabled || textarea.readOnly) {
        return {
          ok: false,
          message: "无法安全定位可编辑的“本句话文本”输入框。",
        };
      }

      const nextText = ensureChineseSentencePunctuation(removeTextSpaces(text));
      textarea.focus();
      textarea.value = nextText;
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      textarea.dispatchEvent(new Event("change", { bubbles: true }));
      exitEditingFocus(textarea);
      window.setTimeout(function () {
        exitEditingFocus(textarea);
      }, 50);
      window.setTimeout(function () {
        exitEditingFocus(textarea);
      }, 180);
      return {
        ok: true,
        message: "已填入推荐文本，并退出输入框。",
      };
    }

    async function getCurrentItem(options) {
      const runtimeOptions = options && typeof options === "object" ? options : {};
      const routeParams = parseHashParams();
      const pageInfo = getPageInfoFromDom();
      const domDurations = getDurationInfoFromDom();
      const domState = {
        collectId: routeParams.collectId,
        checkType: routeParams.checkType,
        pageNum: pageInfo.pageNum,
        pageSize: pageInfo.pageSize,
        sentenceNumber: getSentenceNumber(),
        pageText: getPageText(),
        readRequire: getReadRequire(),
        audioUrl: getAudioUrlFromDom(),
        effectiveStartTime: domDurations.effectiveStartTime,
        effectiveEndTime: domDurations.effectiveEndTime,
        effectiveTime: domDurations.effectiveTime,
        audioDuration: domDurations.audioDuration,
      };

      let entry = findBestNetworkEntry(routeParams);
      if (!entry && routeParams.collectId && runtimeOptions.allowFetch !== false) {
        entry = await fetchCurrentPageData(routeParams, pageInfo);
      }

      const record = findRecord(entry, domState);
      const item = Object.assign({}, domState, {
        itemId: String(record?.id || ""),
        textId: String(record?.textId || ""),
        sentenceNumber: toNumberOrNull(record?.sentenceNumber) || domState.sentenceNumber,
        pageText: String(record?.audioText || domState.pageText || ""),
        readRequire: String(record?.readRequire || domState.readRequire || ""),
        audioUrl: String(record?.audioUrl || domState.audioUrl || ""),
        effectiveStartTime:
          toNumberOrNull(record?.effectiveStartTime) ?? domState.effectiveStartTime,
        effectiveEndTime: toNumberOrNull(record?.effectiveEndTime) ?? domState.effectiveEndTime,
        effectiveTime: toNumberOrNull(record?.effectiveTime) ?? domState.effectiveTime,
        audioDuration: toNumberOrNull(record?.audioDuration) ?? domState.audioDuration,
        record,
      });

      item.key = [
        item.collectId,
        item.itemId,
        item.textId,
        item.sentenceNumber,
        normalizeText(item.pageText),
      ].join("|");
      return item;
    }

    return {
      canFillPageText,
      createItemFromRecord,
      createItemsFromQualifiedRecords,
      fillPageText,
      getQualifiedRecords,
      getRecordDisplayName,
      isRecordQualified,
      getCurrentItem,
      refreshCurrentPageData,
      selectRecord,
      waitForPageTextReady,
      isRoundOneCollectPage,
      parseHashParams,
      start,
      stop,
    };
  }

  globalThis.__ASREdgeDataBakerRoundOneDataApi = {
    createRuntime,
    ensureChineseSentencePunctuation,
    exitEditingFocus,
    focusSafeBody,
    isRoundOneCollectPage,
    parseHashParams,
    removeTextSpaces,
  };
})();

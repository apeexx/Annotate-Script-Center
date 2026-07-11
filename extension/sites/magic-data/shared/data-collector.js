(function () {
  const MAIN_SOURCE = "ASC_MAGIC_DATA_MAIN";
  const MAIN_DETAIL_TYPE = "ASC_MAGIC_DATA_ANNOTATE_DETAIL_RESPONSE";
  const MAIN_HEADER_TYPE = "ASC_MAGIC_DATA_ANNOTATE_HEADER_RESPONSE";
  const API_DETAIL_PATH_PREFIX = "/api/management-service/annotateTask/annotateDetailInfo/";
  const API_HEADER_PATH_PREFIX = "/api/management-service/annotateTask/annotateHeaderInfo/";
  const DETAIL_FETCH_RETRY_INTERVAL_MS = 1500;
  const HEADER_FETCH_RETRY_INTERVAL_MS = 1500;
  const READY_WAIT_INTERVAL_MS = 120;
  const GENDER_OPTIONS = ["男", "女"];
  const AGE_OPTIONS = ["0-5", "6-12", "13-18", "19-25", "26-36", "37-50", "51-65", "65以上"];
  const PURE_DIALECT_OPTIONS = ["纯方言", "口音普通话"];
  const GENDER_OPTION_SET = new Set(GENDER_OPTIONS);
  const AGE_OPTION_SET = new Set(AGE_OPTIONS);
  const PURE_DIALECT_OPTION_SET = new Set(PURE_DIALECT_OPTIONS);
  const REJECT_BUTTON_TEXTS = ["清除结果", "清除文本", "挂起", "驳回", "拒绝"];
  const FOCUS_SENTINEL_ATTR = "data-asc-magic-data-shortcut-focus-sentinel";

  const detailCacheByTaskItemId = new Map();
  const detailFetchInflightByTaskItemId = new Map();
  const detailFetchAtByTaskItemId = new Map();
  const headerCacheByTaskItemId = new Map();
  const headerFetchInflightByTaskItemId = new Map();
  const headerFetchAtByTaskItemId = new Map();
  let focusSentinel = null;

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function normalizeCompactText(value) {
    return String(value || "").replace(/\s+/g, "").trim();
  }

  function toNumberOrNull(value) {
    if (value === undefined || value === null || value === "") {
      return null;
    }
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function parseFirstNumber(value) {
    const match = String(value || "").match(/(-?\d+(?:\.\d+)?)/);
    return match ? toNumberOrNull(match[1]) : null;
  }

  function isVisible(element) {
    if (!(element instanceof Element)) {
      return false;
    }
    if (element.getClientRects().length === 0) {
      return false;
    }
    const style = window.getComputedStyle(element);
    return style.visibility !== "hidden" && style.display !== "none";
  }

  function isEditableElement(element) {
    if (!(element instanceof HTMLElement)) {
      return false;
    }
    const tagName = String(element.tagName || "").toLowerCase();
    if (tagName === "textarea" || tagName === "input") {
      return !element.disabled && !element.readOnly;
    }
    if (element.isContentEditable) {
      return true;
    }
    return false;
  }

  function getEditableValue(element) {
    if (!(element instanceof HTMLElement)) {
      return "";
    }
    const tagName = String(element.tagName || "").toLowerCase();
    if (tagName === "textarea" || tagName === "input") {
      return String(element.value || "");
    }
    return String(element.innerText || element.textContent || "");
  }

  function setEditableValue(element, text) {
    if (!(element instanceof HTMLElement)) {
      return false;
    }
    const nextText = String(text || "");
    const tagName = String(element.tagName || "").toLowerCase();
    if (tagName === "textarea" || tagName === "input") {
      element.focus();
      element.value = nextText;
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      restoreShortcutFocusAfterAction();
      return true;
    }
    if (element.isContentEditable) {
      element.focus();
      element.textContent = nextText;
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      restoreShortcutFocusAfterAction();
      return true;
    }
    return false;
  }

  function ensureFocusSentinel() {
    if (focusSentinel && document.documentElement?.contains(focusSentinel)) {
      return focusSentinel;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute(FOCUS_SENTINEL_ATTR, "true");
    button.tabIndex = -1;
    button.setAttribute("aria-hidden", "true");
    button.style.position = "fixed";
    button.style.left = "-9999px";
    button.style.top = "-9999px";
    button.style.width = "1px";
    button.style.height = "1px";
    button.style.opacity = "0";
    button.style.pointerEvents = "none";
    (document.body || document.documentElement).appendChild(button);
    focusSentinel = button;
    return focusSentinel;
  }

  function blurActiveElementSafe() {
    const active = document.activeElement;
    if (active && typeof active.blur === "function") {
      try {
        active.blur();
      } catch (error) {
        // keep stable
      }
    }
  }

  function focusSafeBody() {
    const body = document.body || document.documentElement;
    if (!body) {
      return;
    }
    if (body instanceof HTMLElement) {
      if (!body.hasAttribute("tabindex")) {
        body.setAttribute("tabindex", "-1");
      }
      try {
        body.focus({ preventScroll: true });
      } catch (error) {
        try {
          body.focus();
        } catch (ignoreError) {
          // keep stable
        }
      }
    }
  }

  function restoreShortcutFocusAfterAction() {
    const intervals = [0, 50, 180];
    intervals.forEach(function (delay) {
      window.setTimeout(function () {
        blurActiveElementSafe();
        const sentinel = ensureFocusSentinel();
        if (sentinel && typeof sentinel.focus === "function") {
          try {
            sentinel.focus({ preventScroll: true });
          } catch (error) {
            try {
              sentinel.focus();
            } catch (ignoreError) {
              // keep stable
            }
          }
        }
        focusSafeBody();
      }, delay);
    });
  }

  function findTextNodeElementByKeyword(keyword) {
    const normalizedKeyword = normalizeText(keyword);
    if (!normalizedKeyword) {
      return null;
    }
    const root = document.body || document.documentElement;
    if (!root) {
      return null;
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let current = walker.nextNode();
    while (current) {
      const text = normalizeText(current.textContent || "");
      if (text && text.indexOf(normalizedKeyword) >= 0) {
        return current.parentElement || null;
      }
      current = walker.nextNode();
    }
    return null;
  }

  function findNearbyNumberByKeyword(keyword) {
    const anchor = findTextNodeElementByKeyword(keyword);
    if (!anchor) {
      return null;
    }
    const localText = normalizeText(anchor.textContent || "");
    const localNumber = parseFirstNumber(localText.slice(localText.indexOf(keyword)));
    if (localNumber !== null) {
      return localNumber;
    }
    const parentText = normalizeText(anchor.parentElement?.textContent || "");
    const parentNumber = parseFirstNumber(parentText.slice(parentText.indexOf(keyword)));
    if (parentNumber !== null) {
      return parentNumber;
    }
    return null;
  }

  function findProjectNameFromDom() {
    const anchor = findTextNodeElementByKeyword("项目名称");
    if (!anchor) {
      return "";
    }
    const text = normalizeText(anchor.textContent || anchor.parentElement?.textContent || "");
    return text.replace(/^.*?项目名称[:：]/, "").trim().slice(0, 120);
  }

  function findAudioUrlFromDom() {
    const audios = Array.from(document.querySelectorAll("audio"));
    for (let index = 0; index < audios.length; index += 1) {
      const url = String(audios[index].currentSrc || audios[index].src || "").trim();
      if (url) {
        return url;
      }
    }
    return "";
  }

  function findAudioUrlFromPerformance() {
    const performanceApi = globalThis.performance;
    if (!performanceApi || typeof performanceApi.getEntriesByType !== "function") {
      return "";
    }
    const entries = performanceApi.getEntriesByType("resource");
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const entryName = String(entries[index]?.name || "");
      if (!entryName) {
        continue;
      }
      const lower = entryName.toLowerCase();
      const isAudio =
        lower.indexOf("magicdatacloud") >= 0 ||
        lower.indexOf(".wav") >= 0 ||
        lower.indexOf(".mp3") >= 0 ||
        lower.indexOf(".m4a") >= 0 ||
        lower.indexOf(".aac") >= 0;
      if (isAudio) {
        return entryName;
      }
    }
    return "";
  }

  function parseAudioHostname(audioUrl) {
    try {
      return new URL(String(audioUrl || "")).hostname || "";
    } catch (error) {
      return "";
    }
  }

  function collectEditableFieldsInContainer(container) {
    if (!(container instanceof Element)) {
      return [];
    }
    const candidates = Array.from(
      container.querySelectorAll(
        "textarea, input[type='text'], input:not([type]), [contenteditable='true'], [contenteditable='']"
      )
    );
    return candidates.filter(function (node) {
      return isEditableElement(node) && isVisible(node);
    });
  }

  function collectGlobalEditableFields() {
    const candidates = Array.from(
      document.querySelectorAll(
        "textarea, input[type='text'], input:not([type]), [contenteditable='true'], [contenteditable='']"
      )
    );
    return candidates.filter(function (node) {
      return isEditableElement(node) && isVisible(node);
    });
  }

  function pickDialectAndMandarinFields() {
    const anchor = findTextNodeElementByKeyword("说话内容");
    let fields = [];
    if (anchor) {
      const container =
        anchor.closest(".el-table, table, [class*='table'], [class*='mark']") ||
        anchor.closest("[class*='content']") ||
        anchor.parentElement;
      fields = collectEditableFieldsInContainer(container);
    }
    if (fields.length < 2) {
      fields = collectGlobalEditableFields();
    }
    if (fields.length > 2) {
      const ranked = fields
        .map(function (node, index) {
          return {
            node: node,
            index: index,
            score: normalizeText(getEditableValue(node)).length,
          };
        })
        .sort(function (left, right) {
          if (right.score !== left.score) {
            return right.score - left.score;
          }
          return left.index - right.index;
        })
        .slice(0, 4)
        .sort(function (left, right) {
          const posA = left.node.getBoundingClientRect();
          const posB = right.node.getBoundingClientRect();
          if (Math.abs(posA.top - posB.top) > 6) {
            return posA.top - posB.top;
          }
          return posA.left - posB.left;
        });
      fields = ranked.map(function (item) {
        return item.node;
      });
    }

    return {
      dialectField: fields[0] || null,
      mandarinField: fields[1] || null,
    };
  }

  function parseSpeakerFromDom() {
    function findSpeakerScope() {
      return (
        document.querySelector(".speaker-attributes") ||
        findTextNodeElementByKeyword("说话人属性")?.closest(".speaker-attributes, .el-form, [class*='speaker'], [class*='attr'], [class*='card']") ||
        findTextNodeElementByKeyword("说话人属性")?.closest("[class*='form'], [class*='panel'], [class*='card']") ||
        null
      );
    }

    function findFormItemByLabel(scope, labelText) {
      const normalizedLabel = normalizeCompactText(labelText);
      const formItems = Array.from(scope?.querySelectorAll(".el-form-item, [class*='form-item']") || []);
      return (
        formItems.find(function (item) {
          const label = item.querySelector(".el-form-item__label, label, .label, [class*='label']");
          const text = normalizeCompactText(label?.textContent || "");
          return text.indexOf(normalizedLabel) >= 0;
        }) || null
      );
    }

    function readCheckedRadioValue(scope) {
      if (!(scope instanceof Element)) {
        return "";
      }
      const checkedInput = scope.querySelector(
        ".el-radio.is-checked input.el-radio__original, .el-radio.is-checked input[type='radio']"
      );
      const checkedInputValue = normalizeText(checkedInput?.value || "");
      if (checkedInputValue) {
        return checkedInputValue;
      }
      const checkedLabel = scope.querySelector(".el-radio.is-checked .el-radio__label");
      const checkedLabelValue = normalizeText(checkedLabel?.textContent || "");
      if (checkedLabelValue) {
        return checkedLabelValue;
      }
      const ariaChecked = scope.querySelector(
        "[role='radio'][aria-checked='true'] input, [role='radio'][aria-checked='true'] .el-radio__label, [role='radio'][aria-checked='true']"
      );
      return normalizeText(
        ariaChecked?.value || ariaChecked?.textContent || ariaChecked?.getAttribute?.("value") || ""
      );
    }

    const scope = findSpeakerScope();
    if (!scope) {
      return {};
    }
    const genderItem = findFormItemByLabel(scope, "性别");
    const ageItem = findFormItemByLabel(scope, "年龄");
    const pureDialectItem = findFormItemByLabel(scope, "音频是否是纯方言");
    const genderValue = readCheckedRadioValue(genderItem);
    const ageValue = readCheckedRadioValue(ageItem);
    const pureDialectValue = readCheckedRadioValue(pureDialectItem);
    return {
      gender: GENDER_OPTION_SET.has(genderValue) ? genderValue : "",
      ageRange: AGE_OPTION_SET.has(ageValue) ? ageValue : "",
      pureDialect: PURE_DIALECT_OPTION_SET.has(pureDialectValue) ? pureDialectValue : "",
    };
  }

  function getRouteParams() {
    const detector = globalThis.__ASREdgeMagicDataAnnotatorPageDetector;
    return detector?.parseHashParams ? detector.parseHashParams() : {};
  }

  function getCurrentTaskItemId() {
    return normalizeText(getRouteParams().taskItemId);
  }

  function normalizeDetailEntry(input) {
    const source = input && typeof input === "object" ? input : {};
    const markInfo = Array.isArray(source.mark_info) ? source.mark_info : [];
    return {
      at: Number(source.at) || Date.now(),
      taskItemId: normalizeText(source.taskItemId),
      samplingRecordId: normalizeText(source.samplingRecordId),
      path: String(source.path || "").trim(),
      object_key: normalizeText(source.object_key),
      wav_name: normalizeText(source.wav_name),
      dataItemId: normalizeText(source.dataItemId),
      start_time: toNumberOrNull(source.start_time),
      end_time: toNumberOrNull(source.end_time),
      mark_info: markInfo.map(function (item) {
        const row = item && typeof item === "object" ? item : {};
        return {
          mark_text: normalizeText(row.mark_text),
          speak_people: row.speak_people,
          mark_type: normalizeText(row.mark_type),
        };
      }),
      statistics: source.statistics && typeof source.statistics === "object" ? source.statistics : null,
      is_valid: source.is_valid,
      base_speak: Array.isArray(source.base_speak) ? source.base_speak : [],
      duration: toNumberOrNull(source.duration),
      length_time: toNumberOrNull(source.length_time),
      sentence_valid_time: toNumberOrNull(source.sentence_valid_time),
      sentence_unvalid_time: toNumberOrNull(source.sentence_unvalid_time),
      unlabeled_sentence_time: toNumberOrNull(source.unlabeled_sentence_time),
    };
  }

  function normalizeHeaderEntry(input) {
    const source = input && typeof input === "object" ? input : {};
    return {
      at: Number(source.at) || Date.now(),
      taskItemId: normalizeText(source.taskItemId),
      code: toNumberOrNull(source.code),
      message: normalizeText(source.message),
      projectName: normalizeText(source.projectName),
      batchNo: normalizeText(source.batchNo),
      packageId: normalizeText(source.packageId),
      annotateMode: normalizeText(source.annotateMode),
      pending: source.pending === true,
      isSubmit: source.isSubmit === true,
      processNodeId: normalizeText(source.processNodeId),
      teamId: normalizeText(source.teamId),
      projectId: normalizeText(source.projectId),
      rawData: source.rawData && typeof source.rawData === "object" ? source.rawData : {},
    };
  }

  function rememberDetailEntry(entry) {
    if (!entry || !entry.taskItemId) {
      return;
    }
    detailCacheByTaskItemId.set(entry.taskItemId, normalizeDetailEntry(entry));
  }

  function rememberHeaderEntry(entry) {
    if (!entry || !entry.taskItemId) {
      return;
    }
    headerCacheByTaskItemId.set(entry.taskItemId, normalizeHeaderEntry(entry));
  }

  function parseDetailResponsePayload(payload, fallbackTaskItemId) {
    const outer = payload && typeof payload === "object" ? payload.data : {};
    const detailData = outer && typeof outer.data === "object" ? outer.data : outer;
    const segments = Array.isArray(detailData?.data) ? detailData.data : [];
    const firstSegment = segments.find(function (item) {
      return item && typeof item === "object";
    }) || {};
    const detailMarkInfo = Array.isArray(detailData?.mark_info) ? detailData.mark_info : [];
    const segmentMarkInfo = Array.isArray(firstSegment?.mark_info) ? firstSegment.mark_info : [];
    const normalized = normalizeDetailEntry({
      taskItemId: normalizeText(outer?.taskItemId || detailData?.taskItemId || fallbackTaskItemId),
      samplingRecordId: normalizeText(outer?.samplingRecordId || detailData?.samplingRecordId),
      path: detailData?.path,
      object_key: detailData?.object_key,
      wav_name: detailData?.wav_name,
      dataItemId: detailData?.dataItemId || firstSegment?.id,
      start_time: firstSegment?.start_time ?? detailData?.start_time,
      end_time: firstSegment?.end_time ?? detailData?.end_time,
      mark_info: segmentMarkInfo.length > 0 ? segmentMarkInfo : detailMarkInfo,
      statistics: detailData?.statistics,
      is_valid: detailData?.is_valid,
      base_speak: detailData?.base_speak,
      duration:
        detailData?.duration !== undefined
          ? detailData.duration
          : detailData?.audio_duration !== undefined
            ? detailData.audio_duration
            : detailData?.length_time !== undefined
              ? detailData.length_time
              : detailData?.total_duration,
      length_time: detailData?.length_time,
      sentence_valid_time: detailData?.sentence_valid_time,
      sentence_unvalid_time: detailData?.sentence_unvalid_time,
      unlabeled_sentence_time: detailData?.unlabeled_sentence_time,
    });
    return normalized.taskItemId ? normalized : null;
  }

  async function requestAnnotateDetail(taskItemId) {
    const response = await fetch(
      location.origin + API_DETAIL_PATH_PREFIX + encodeURIComponent(taskItemId),
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json;charset=UTF-8",
          Accept: "application/json, text/plain, */*",
          "md-language": "zh",
        },
        body: JSON.stringify({
          taskItemId: taskItemId,
        }),
      }
    );
    let payload = null;
    try {
      payload = await response.json();
    } catch (error) {
      payload = null;
    }
    return {
      response: response,
      payload: payload,
    };
  }

  async function requestAnnotateHeader(taskItemId) {
    const response = await fetch(
      location.origin + API_HEADER_PATH_PREFIX + encodeURIComponent(taskItemId),
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json;charset=UTF-8",
          Accept: "application/json, text/plain, */*",
          "md-language": "zh",
        },
        body: JSON.stringify({
          taskItemId: taskItemId,
        }),
      }
    );
    let payload = null;
    try {
      payload = await response.json();
    } catch (error) {
      payload = null;
    }
    return {
      response: response,
      payload: payload,
    };
  }

  async function fetchAnnotateDetail(taskItemId) {
    const normalizedTaskItemId = normalizeText(taskItemId);
    if (!normalizedTaskItemId) {
      return null;
    }

    const lastFetchAt = Number(detailFetchAtByTaskItemId.get(normalizedTaskItemId) || 0);
    if (Date.now() - lastFetchAt < DETAIL_FETCH_RETRY_INTERVAL_MS) {
      return detailCacheByTaskItemId.get(normalizedTaskItemId) || null;
    }
    detailFetchAtByTaskItemId.set(normalizedTaskItemId, Date.now());

    const inflight = detailFetchInflightByTaskItemId.get(normalizedTaskItemId);
    if (inflight) {
      return inflight;
    }

    const requestPromise = requestAnnotateDetail(normalizedTaskItemId)
      .then(function (result) {
        if (!result.response.ok || !result.payload || !result.payload.data) {
          return null;
        }
        const entry = parseDetailResponsePayload(result.payload, normalizedTaskItemId);
        if (!entry) {
          return null;
        }
        rememberDetailEntry(entry);
        return entry;
      })
      .catch(function () {
        return null;
      })
      .finally(function () {
        detailFetchInflightByTaskItemId.delete(normalizedTaskItemId);
      });

    detailFetchInflightByTaskItemId.set(normalizedTaskItemId, requestPromise);
    return requestPromise;
  }

  async function fetchAnnotateHeader(taskItemId) {
    const normalizedTaskItemId = normalizeText(taskItemId);
    if (!normalizedTaskItemId) {
      return null;
    }

    const lastFetchAt = Number(headerFetchAtByTaskItemId.get(normalizedTaskItemId) || 0);
    if (Date.now() - lastFetchAt < HEADER_FETCH_RETRY_INTERVAL_MS) {
      return headerCacheByTaskItemId.get(normalizedTaskItemId) || null;
    }
    headerFetchAtByTaskItemId.set(normalizedTaskItemId, Date.now());

    const inflight = headerFetchInflightByTaskItemId.get(normalizedTaskItemId);
    if (inflight) {
      return inflight;
    }

    const requestPromise = requestAnnotateHeader(normalizedTaskItemId)
      .then(function (result) {
        if (!result.response.ok || !result.payload || result.payload.code !== 0 || !result.payload.data) {
          return null;
        }
        const entry = normalizeHeaderEntry(Object.assign({}, result.payload.data, {
          at: Date.now(),
          taskItemId: normalizedTaskItemId,
          code: result.payload.code,
          message: result.payload.message,
        }));
        if (!entry.taskItemId) {
          return null;
        }
        rememberHeaderEntry(entry);
        return entry;
      })
      .catch(function () {
        return null;
      })
      .finally(function () {
        headerFetchInflightByTaskItemId.delete(normalizedTaskItemId);
      });

    headerFetchInflightByTaskItemId.set(normalizedTaskItemId, requestPromise);
    return requestPromise;
  }

  function getCachedDetail(taskItemId) {
    const normalizedTaskItemId = normalizeText(taskItemId);
    if (!normalizedTaskItemId) {
      return null;
    }
    return detailCacheByTaskItemId.get(normalizedTaskItemId) || null;
  }

  function getCachedHeader(taskItemId) {
    const normalizedTaskItemId = normalizeText(taskItemId);
    if (!normalizedTaskItemId) {
      return null;
    }
    return headerCacheByTaskItemId.get(normalizedTaskItemId) || null;
  }

  function parseSpeakerFromDetail(detail, fallbackSpeaker) {
    function normalizeSpeakerId(value) {
      const text = normalizeText(value);
      if (!text) {
        return "";
      }
      const numericValue = Number(text);
      if (Number.isFinite(numericValue)) {
        return String(Math.trunc(numericValue));
      }
      return text;
    }

    function parseSpeakerFromBaseEntry(baseEntry) {
      const result = {
        speakId: normalizeSpeakerId(baseEntry?.speak_id || baseEntry?.speakId || baseEntry?.id),
        gender: "",
        ageRange: "",
        pureDialect: "",
      };
      const speakInfoList = Array.isArray(baseEntry?.speak_info)
        ? baseEntry.speak_info
        : Array.isArray(baseEntry?.speakInfo)
          ? baseEntry.speakInfo
          : [];
      speakInfoList.forEach(function (item) {
        const values = Array.isArray(item?.value)
          ? item.value
          : item?.value !== undefined && item?.value !== null
            ? [item.value]
            : [];
        values.forEach(function (value) {
          const text = normalizeText(value);
          if (!text) {
            return;
          }
          if (!result.gender && GENDER_OPTION_SET.has(text)) {
            result.gender = text;
            return;
          }
          if (!result.ageRange && AGE_OPTION_SET.has(text)) {
            result.ageRange = text;
            return;
          }
          if (!result.pureDialect && PURE_DIALECT_OPTION_SET.has(text)) {
            result.pureDialect = text;
          }
        });
      });
      return result;
    }

    const speaker = Object.assign({}, fallbackSpeaker || {});
    const markInfo = Array.isArray(detail?.mark_info) ? detail.mark_info : [];
    const baseSpeakList = Array.isArray(detail?.base_speak) ? detail.base_speak : [];
    const targetSpeakerId = normalizeSpeakerId(
      markInfo
        .map(function (row) {
          return row?.speak_people;
        })
        .find(function (value) {
          return normalizeText(value);
        })
    );
    let matchedSpeaker = null;
    if (targetSpeakerId) {
      matchedSpeaker = baseSpeakList.find(function (item) {
        return normalizeSpeakerId(item?.speak_id || item?.speakId || item?.id) === targetSpeakerId;
      }) || null;
    }
    if (!matchedSpeaker) {
      matchedSpeaker = baseSpeakList[0] || null;
    }
    const parsedSpeaker = parseSpeakerFromBaseEntry(matchedSpeaker || {});
    if (parsedSpeaker.speakId) {
      speaker.speakId = parsedSpeaker.speakId;
    }
    if (parsedSpeaker.gender) {
      speaker.gender = parsedSpeaker.gender;
    }
    if (parsedSpeaker.ageRange) {
      speaker.ageRange = parsedSpeaker.ageRange;
    }
    if (parsedSpeaker.pureDialect) {
      speaker.pureDialect = parsedSpeaker.pureDialect;
    }
    if (!speaker.speakId && targetSpeakerId) {
      speaker.speakId = targetSpeakerId;
    }
    return speaker;
  }

  function pickTextFromMarkInfo(detail, index, fallbackText) {
    const markInfo = Array.isArray(detail?.mark_info) ? detail.mark_info : [];
    const direct = normalizeText(markInfo[index]?.mark_text || "");
    if (direct) {
      return direct;
    }
    const list = markInfo
      .map(function (row) {
        return normalizeText(row?.mark_text || "");
      })
      .filter(Boolean);
    return list[index] || normalizeText(fallbackText || "");
  }

  function collectDomSnapshot() {
    const detector = globalThis.__ASREdgeMagicDataAnnotatorPageDetector;
    const routeParams = getRouteParams();
    const textFields = pickDialectAndMandarinFields();
    const dialectText = normalizeText(getEditableValue(textFields.dialectField));
    const mandarinText = normalizeText(getEditableValue(textFields.mandarinField));
    const audioUrl = findAudioUrlFromDom() || findAudioUrlFromPerformance();

    const effectiveTime =
      findNearbyNumberByKeyword("有效句子时长") ??
      findNearbyNumberByKeyword("截取时长") ??
      null;
    const audioDuration = findNearbyNumberByKeyword("音频总时长");
    const effectiveStartTime =
      findNearbyNumberByKeyword("有效开始时间") ?? findNearbyNumberByKeyword("开始时间");
    const effectiveEndTime =
      findNearbyNumberByKeyword("有效结束时间") ?? findNearbyNumberByKeyword("结束时间");

    return {
      pageType: typeof detector?.getPageType === "function" ? detector.getPageType() : "",
      taskItemId: normalizeText(routeParams.taskItemId),
      samplingRecordId: normalizeText(routeParams.samplingRecordId),
      projectName: findProjectNameFromDom(),
      audioUrl: audioUrl,
      audioHostname: parseAudioHostname(audioUrl),
      audioDuration: toNumberOrNull(audioDuration),
      effectiveStartTime: toNumberOrNull(effectiveStartTime),
      effectiveEndTime: toNumberOrNull(effectiveEndTime),
      effectiveTime: toNumberOrNull(effectiveTime),
      platformDialectText: dialectText,
      platformMandarinText: mandarinText,
      speaker: parseSpeakerFromDom(),
      fields: {
        dialectAvailable: Boolean(textFields.dialectField),
        mandarinAvailable: Boolean(textFields.mandarinField),
      },
    };
  }

  function mergeSnapshotWithDetail(domSnapshot, detail) {
    const snapshot = Object.assign({}, domSnapshot || {});
    if (!detail) {
      return snapshot;
    }
    const startTime = toNumberOrNull(detail.start_time);
    const endTime = toNumberOrNull(detail.end_time);
    const effectiveTime =
      startTime !== null && endTime !== null && endTime >= startTime ? Number((endTime - startTime).toFixed(3)) : null;
    const audioUrl = String(detail.path || "").trim();
    snapshot.taskItemId = normalizeText(detail.taskItemId || snapshot.taskItemId);
    snapshot.samplingRecordId = normalizeText(detail.samplingRecordId || snapshot.samplingRecordId);
    snapshot.objectKey = normalizeText(detail.object_key || snapshot.objectKey);
    snapshot.wavName = normalizeText(detail.wav_name || snapshot.wavName);
    snapshot.dataItemId = normalizeText(detail.dataItemId || snapshot.dataItemId);
    snapshot.audioUrl = audioUrl || snapshot.audioUrl || "";
    snapshot.audioHostname = parseAudioHostname(snapshot.audioUrl);
    snapshot.audioDuration =
      toNumberOrNull(detail.duration) ??
      toNumberOrNull(detail.length_time) ??
      snapshot.audioDuration;
    snapshot.effectiveStartTime = startTime ?? snapshot.effectiveStartTime;
    snapshot.effectiveEndTime = endTime ?? snapshot.effectiveEndTime;
    snapshot.effectiveTime =
      toNumberOrNull(detail.sentence_valid_time) ??
      effectiveTime ??
      snapshot.effectiveTime;
    snapshot.sentenceValidTime = toNumberOrNull(detail.sentence_valid_time) ?? snapshot.sentenceValidTime ?? null;
    snapshot.totalLengthTime = toNumberOrNull(detail.length_time) ?? snapshot.totalLengthTime ?? null;
    snapshot.unlabeledSentenceTime =
      toNumberOrNull(detail.unlabeled_sentence_time) ?? snapshot.unlabeledSentenceTime ?? null;
    snapshot.platformDialectText = pickTextFromMarkInfo(detail, 0, snapshot.platformDialectText);
    snapshot.platformMandarinText = pickTextFromMarkInfo(detail, 1, snapshot.platformMandarinText);
    snapshot.speaker = parseSpeakerFromDetail(detail, snapshot.speaker);
    return snapshot;
  }

  function mergeSnapshotWithHeader(domSnapshot, header) {
    const snapshot = Object.assign({}, domSnapshot || {});
    if (!header) {
      return snapshot;
    }
    snapshot.taskItemId = normalizeText(header.taskItemId || snapshot.taskItemId);
    snapshot.projectName = normalizeText(header.projectName || snapshot.projectName);
    snapshot.batchNo = normalizeText(header.batchNo || snapshot.batchNo);
    snapshot.packageId = normalizeText(header.packageId || snapshot.packageId);
    snapshot.annotateMode = normalizeText(header.annotateMode || snapshot.annotateMode);
    snapshot.headerReady = header.code === 0;
    return snapshot;
  }

  function collectCurrentItem() {
    const domSnapshot = collectDomSnapshot();
    const detail = getCachedDetail(domSnapshot.taskItemId);
    const withDetail = mergeSnapshotWithDetail(domSnapshot, detail);
    const header = getCachedHeader(withDetail.taskItemId || domSnapshot.taskItemId);
    return mergeSnapshotWithHeader(withDetail, header);
  }

  async function refreshCurrentItem(options) {
    const config = options && typeof options === "object" ? options : {};
    const domSnapshot = collectDomSnapshot();
    const taskItemId = normalizeText(config.taskItemId || domSnapshot.taskItemId || getCurrentTaskItemId());
    const samplingRecordId = normalizeText(config.samplingRecordId || domSnapshot.samplingRecordId);
    if (samplingRecordId && !domSnapshot.samplingRecordId) {
      domSnapshot.samplingRecordId = samplingRecordId;
    }
    const pageType = normalizeText(config.pageType || domSnapshot.pageType);
    if (pageType && !domSnapshot.pageType) {
      domSnapshot.pageType = pageType;
    }
    if (!taskItemId) {
      return domSnapshot;
    }
    const detail = await fetchAnnotateDetail(taskItemId);
    const withDetail = mergeSnapshotWithDetail(domSnapshot, detail);
    const header = await fetchAnnotateHeader(taskItemId);
    return mergeSnapshotWithHeader(withDetail, header);
  }

  function fillDialectLine(text) {
    const fields = pickDialectAndMandarinFields();
    if (!fields.dialectField) {
      return {
        ok: false,
        message: "未定位到第一行文本框，无法填入。",
      };
    }
    const success = setEditableValue(fields.dialectField, normalizeText(text));
    return {
      ok: success,
      message: success
        ? "已填入第一行，但未保存、未提交，请人工确认。快捷键焦点已恢复。"
        : "填入第一行失败。",
    };
  }

  function fillMandarinLine(text) {
    const fields = pickDialectAndMandarinFields();
    if (!fields.mandarinField) {
      return {
        ok: false,
        message: "未定位到第二行文本框，无法填入。",
      };
    }
    const success = setEditableValue(fields.mandarinField, normalizeText(text));
    return {
      ok: success,
      message: success
        ? "已填入第二行，但未保存、未提交，请人工确认。快捷键焦点已恢复。"
        : "填入第二行失败。",
    };
  }

  function findVisibleButtonsByExactText(text) {
    const targetText = normalizeCompactText(text);
    return Array.from(document.querySelectorAll("button, .el-button, [role='button']"))
      .filter(isVisible)
      .filter(function (node) {
        return normalizeCompactText(node.textContent || "") === targetText;
      });
  }

  function findOperationButton(text) {
    const targetText = normalizeCompactText(text);
    const candidates = findVisibleButtonsByExactText(text).filter(function (node) {
      const currentText = normalizeCompactText(node.textContent || "");
      if (currentText !== targetText) {
        return false;
      }
      return !REJECT_BUTTON_TEXTS.some(function (rejectText) {
        return currentText === normalizeCompactText(rejectText);
      });
    });
    return candidates[0] || null;
  }

  function isOperationButtonEnabled(text) {
    const button = findOperationButton(text);
    if (!(button instanceof HTMLElement)) {
      return false;
    }
    if (button.hasAttribute("disabled") || button.getAttribute("aria-disabled") === "true") {
      return false;
    }
    return !button.classList.contains("is-disabled");
  }

  function clickOperationButton(text) {
    const button = findOperationButton(text);
    if (!button) {
      return {
        ok: false,
        message: "未找到“" + text + "”按钮。",
      };
    }
    if (!isOperationButtonEnabled(text)) {
      return {
        ok: false,
        message: "“" + text + "”按钮当前不可点击。",
      };
    }
    button.click();
    restoreShortcutFocusAfterAction();
    return {
      ok: true,
      message: "检测到" + text + "快捷键，已触发平台" + text + "按钮。快捷键焦点已恢复。",
    };
  }

  function findSpeakerScope() {
    const anchor = findTextNodeElementByKeyword("说话人属性");
    return anchor?.closest("[class*='form'], [class*='panel'], [class*='card'], .el-form") || null;
  }

  function findClickableNodeByText(scope, text) {
    if (!scope) {
      return null;
    }
    const targetText = normalizeCompactText(text);
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    let current = walker.nextNode();
    while (current) {
      const currentText = normalizeCompactText(current.textContent || "");
      if (currentText === targetText) {
        const parent = current.parentElement;
        const clickable =
          parent?.closest("label, button, [role='radio'], .el-radio, .el-checkbox, li, span, div") || null;
        if (clickable && isVisible(clickable)) {
          return clickable;
        }
      }
      current = walker.nextNode();
    }
    return null;
  }

  function selectSpeakerValue(text) {
    const scope = findSpeakerScope();
    if (!scope) {
      return {
        ok: false,
        message: "未找到说话人属性区域。",
      };
    }
    const target = findClickableNodeByText(scope, text);
    if (!target) {
      return {
        ok: false,
        message: "未找到“" + text + "”选项。",
      };
    }
    target.click();
    restoreShortcutFocusAfterAction();
    return {
      ok: true,
      message: "已选择" + text + "，快捷键焦点已恢复。未自动保存。",
    };
  }

  function waitForTimeout(ms, signal) {
    return new Promise(function (resolve, reject) {
      const timer = window.setTimeout(function () {
        cleanup();
        resolve();
      }, Math.max(0, Number(ms) || 0));

      function onAbort() {
        cleanup();
        const error = new Error("已停止自动流程。");
        error.code = "user-aborted";
        reject(error);
      }

      function cleanup() {
        window.clearTimeout(timer);
        if (signal && typeof signal.removeEventListener === "function") {
          signal.removeEventListener("abort", onAbort);
        }
      }

      if (signal?.aborted) {
        onAbort();
        return;
      }
      if (signal && typeof signal.addEventListener === "function") {
        signal.addEventListener("abort", onAbort, { once: true });
      }
    });
  }

  async function waitForAsrmarkReady(options) {
    const config = options && typeof options === "object" ? options : {};
    const expectedTaskItemId = normalizeText(config.taskItemId);
    const signal = config.signal || null;
    const timeoutMs = Math.max(1000, Number(config.timeoutMs) || 15000);
    const deadlineAt = Date.now() + timeoutMs;

    while (Date.now() < deadlineAt) {
      if (signal?.aborted) {
        const abortedError = new Error("已停止自动流程。");
        abortedError.code = "user-aborted";
        throw abortedError;
      }

      const snapshot = collectCurrentItem();
      const currentTaskItemId = normalizeText(snapshot.taskItemId);
      const headerTaskItemId = expectedTaskItemId || currentTaskItemId;
      const header = getCachedHeader(headerTaskItemId);
      const taskMatches = !expectedTaskItemId || currentTaskItemId === expectedTaskItemId;
      const headerReady = header?.code === 0;
      const textReady = Boolean(snapshot.fields?.dialectAvailable && snapshot.fields?.mandarinAvailable);
      const submitReady = isOperationButtonEnabled("提交");

      if (
        normalizeText(snapshot.pageType) === "asrmark" &&
        currentTaskItemId &&
        taskMatches &&
        headerReady &&
        textReady &&
        submitReady
      ) {
        return mergeSnapshotWithHeader(snapshot, header);
      }

      if (headerTaskItemId) {
        void fetchAnnotateHeader(headerTaskItemId);
      }
      await waitForTimeout(READY_WAIT_INTERVAL_MS, signal);
    }

    const timeoutError = new Error("等待页面加载完成超时。");
    timeoutError.code = "wait-ready-timeout";
    throw timeoutError;
  }

  function handleMainWorldMessage(event) {
    if (event.source !== window || event.origin !== location.origin) {
      return;
    }
    const data = event.data || {};
    if (data.source !== MAIN_SOURCE) {
      return;
    }
    if (data.type === MAIN_DETAIL_TYPE) {
      const entry = normalizeDetailEntry(data.payload || {});
      if (!entry.taskItemId) {
        return;
      }
      rememberDetailEntry(entry);
      return;
    }
    if (data.type === MAIN_HEADER_TYPE) {
      const headerEntry = normalizeHeaderEntry(data.payload || {});
      if (!headerEntry.taskItemId) {
        return;
      }
      rememberHeaderEntry(headerEntry);
    }
  }

  window.addEventListener("message", handleMainWorldMessage);

  globalThis.__ASREdgeMagicDataAnnotatorDataCollector = {
    clickOperationButton,
    collectCurrentItem,
    fillDialectLine,
    fillMandarinLine,
    getCachedDetail,
    getCachedHeader,
    findOperationButton,
    isOperationButtonEnabled,
    normalizeText,
    refreshAnnotateHeader: fetchAnnotateHeader,
    refreshCurrentItem,
    restoreShortcutFocusAfterAction,
    selectSpeakerValue,
    waitForAsrmarkReady,
  };
})();

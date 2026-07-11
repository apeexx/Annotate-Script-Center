(function () {
  const SOURCE = "ASR_EDGE_DATABAKER_ROUND_ONE_QUALITY_PAGE";
  const COLLECT_MESSAGE_TYPE = "DATABAKER_ROUND_ONE_QUALITY_COLLECT_RESPONSE";
  const GROUP_MESSAGE_TYPE = "DATABAKER_ROUND_ONE_QUALITY_GROUP_QUERY_RESPONSE";
  const COLLECT_PATH = "/cms/tbAudioUserTask/queryCollectStatementByCondtion";
  const GROUP_PATH = "/cms/tbAudioUserTask/queryByCondition";
  const COLLECT_CACHE_LIMIT = 8;
  const GROUP_CACHE_LIMIT = 20;

  if (window.__ASREdgeDataBakerRoundOneNetworkObserverInstalled) {
    return;
  }
  window.__ASREdgeDataBakerRoundOneNetworkObserverInstalled = true;

  const state = {
    collectEntries: [],
    groupEntries: [],
  };

  function resolveTarget(rawUrl) {
    try {
      const url = new URL(String(rawUrl || ""), location.href);
      if (url.hostname !== location.hostname) {
        return null;
      }
      if (url.pathname === COLLECT_PATH) {
        return { path: COLLECT_PATH, kind: "collect", url: url };
      }
      if (url.pathname === GROUP_PATH) {
        return { path: GROUP_PATH, kind: "group", url: url };
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  function toPositiveNumber(value, fallbackValue) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallbackValue;
    }
    return Math.floor(parsed);
  }

  function readCollectParams(url) {
    return {
      collectId: String(url.searchParams.get("collectId") || ""),
      pageNum: toPositiveNumber(url.searchParams.get("pageNum"), 1),
      pageSize: toPositiveNumber(url.searchParams.get("pageSize"), 10),
      audioText: String(url.searchParams.get("audioText") || ""),
      sentenceNumber: String(url.searchParams.get("sentenceNumber") || ""),
      vadStatus: String(url.searchParams.get("vadStatus") || ""),
    };
  }

  function readGroupParams(url) {
    return {
      taskId: String(url.searchParams.get("taskId") || ""),
      pageNum: toPositiveNumber(url.searchParams.get("pageNum"), 1),
      pageSize: toPositiveNumber(url.searchParams.get("pageSize"), 10),
      collectName: String(url.searchParams.get("collectName") || ""),
      mobile: String(url.searchParams.get("mobile") || ""),
      status: String(url.searchParams.get("status") || ""),
      startTime: String(url.searchParams.get("startTime") || ""),
      endTime: String(url.searchParams.get("endTime") || ""),
      retrieveStatus: String(url.searchParams.get("retrieveStatus") || ""),
      forceRecover: String(url.searchParams.get("forceRecover") || ""),
      textNumber: String(url.searchParams.get("textNumber") || ""),
      checkName: String(url.searchParams.get("checkName") || ""),
      acceptCheckName: String(url.searchParams.get("acceptCheckName") || ""),
      noPassType: String(url.searchParams.get("noPassType") || ""),
      submitOrder: String(url.searchParams.get("submitOrder") || ""),
    };
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

  function normalizeCollectRecord(record, index) {
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

  function notify(type, entry) {
    try {
      window.postMessage(
        {
          source: SOURCE,
          type: type,
          payload: entry,
        },
        location.origin
      );
    } catch (error) {
      // Keep observer silent; content script can fall back to DOM.
    }
  }

  function storeCollectResponse(url, payload) {
    const params = readCollectParams(url);
    const records = extractRecords(payload).map(normalizeCollectRecord);
    const entry = {
      at: Date.now(),
      path: COLLECT_PATH,
      params: params,
      total: extractTotal(payload, records),
      records: records,
    };

    state.collectEntries.unshift(entry);
    state.collectEntries = state.collectEntries.slice(0, COLLECT_CACHE_LIMIT);
    window.__ASREdgeDataBakerRoundOneCollectCache = {
      entries: state.collectEntries,
      latest: state.collectEntries[0] || null,
    };
    notify(COLLECT_MESSAGE_TYPE, entry);
  }

  function storeGroupResponse(url, payload) {
    const params = readGroupParams(url);
    const data = payload && typeof payload === "object" ? payload.data : null;
    const records = Array.isArray(data?.list) ? data.list : [];
    const pageNum = toPositiveNumber(data?.pageNum, params.pageNum || 1);
    const pageSize = toPositiveNumber(data?.pageSize, params.pageSize || 10);
    const total = toPositiveNumber(data?.total, records.length);
    const pages = toPositiveNumber(data?.pages, Math.max(Math.ceil(total / Math.max(pageSize, 1)), 1));

    const entry = {
      at: Date.now(),
      path: GROUP_PATH,
      params: params,
      code: payload?.code,
      message: String(payload?.message || ""),
      success: payload?.success,
      total: total,
      pages: pages,
      pageNum: pageNum,
      pageSize: pageSize,
      records: records,
      rawData: data,
    };

    state.groupEntries.unshift(entry);
    state.groupEntries = state.groupEntries.slice(0, GROUP_CACHE_LIMIT);
    window.__ASREdgeDataBakerRoundOneGroupQueryCache = {
      entries: state.groupEntries,
      latest: state.groupEntries[0] || null,
    };
    notify(GROUP_MESSAGE_TYPE, entry);
  }

  function observeResponse(rawUrl, responseText) {
    const target = resolveTarget(rawUrl);
    if (!target) {
      return;
    }

    try {
      const payload = JSON.parse(String(responseText || "{}"));
      if (target.kind === "collect") {
        storeCollectResponse(target.url, payload);
      } else if (target.kind === "group") {
        storeGroupResponse(target.url, payload);
      }
    } catch (error) {
      // ignore non-json or partial responses
    }
  }

  const nativeFetch = window.fetch;
  if (typeof nativeFetch === "function") {
    window.fetch = function () {
      const args = Array.from(arguments);
      const rawUrl =
        typeof args[0] === "string"
          ? args[0]
          : args[0] && typeof args[0].url === "string"
            ? args[0].url
            : "";
      const target = resolveTarget(rawUrl);

      return nativeFetch.apply(this, args).then(function (response) {
        if (!target) {
          return response;
        }

        try {
          response
            .clone()
            .text()
            .then(function (text) {
              observeResponse(rawUrl, text);
            })
            .catch(function () {});
        } catch (error) {
          // ignore clone/read errors
        }

        return response;
      });
    };
  }

  const NativeXhr = window.XMLHttpRequest;
  if (typeof NativeXhr === "function") {
    const nativeOpen = NativeXhr.prototype.open;
    const nativeSend = NativeXhr.prototype.send;

    NativeXhr.prototype.open = function (method, url) {
      this.__asrEdgeDataBakerRequestUrl = String(url || "");
      return nativeOpen.apply(this, arguments);
    };

    NativeXhr.prototype.send = function () {
      const xhr = this;
      const rawUrl = xhr.__asrEdgeDataBakerRequestUrl || "";
      if (resolveTarget(rawUrl)) {
        xhr.addEventListener("load", function () {
          observeResponse(rawUrl, xhr.responseText);
        });
      }
      return nativeSend.apply(this, arguments);
    };
  }
})();

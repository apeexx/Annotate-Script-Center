(function () {
  const SOURCE = "ASC_MAGIC_DATA_MAIN";
  const DETAIL_TYPE = "ASC_MAGIC_DATA_ANNOTATE_DETAIL_RESPONSE";
  const HEADER_TYPE = "ASC_MAGIC_DATA_ANNOTATE_HEADER_RESPONSE";
  const DETAIL_PATH_PREFIX = "/api/management-service/annotateTask/annotateDetailInfo/";
  const HEADER_PATH_PREFIX = "/api/management-service/annotateTask/annotateHeaderInfo/";
  const CACHE_LIMIT = 20;

  if (window.__ASREdgeMagicDataNetworkObserverInstalled) {
    return;
  }
  window.__ASREdgeMagicDataNetworkObserverInstalled = true;

  const cache = [];
  const headerCache = [];

  function safeToObject(value) {
    return value && typeof value === "object" ? value : {};
  }

  function toText(value) {
    return String(value || "").trim();
  }

  function toNumberOrNull(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function resolveObservedTarget(rawUrl) {
    try {
      const url = new URL(String(rawUrl || ""), location.href);
      if (url.hostname !== location.hostname) {
        return null;
      }
      if (url.pathname.indexOf(DETAIL_PATH_PREFIX) === 0) {
        return {
          kind: "detail",
          type: DETAIL_TYPE,
          url: url,
          taskItemIdFromPath: toText(decodeURIComponent(url.pathname.slice(DETAIL_PATH_PREFIX.length))),
        };
      }
      if (url.pathname.indexOf(HEADER_PATH_PREFIX) === 0) {
        return {
          kind: "header",
          type: HEADER_TYPE,
          url: url,
          taskItemIdFromPath: toText(decodeURIComponent(url.pathname.slice(HEADER_PATH_PREFIX.length))),
        };
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  function sanitizePayload(rawPayload, target) {
    const payload = safeToObject(rawPayload);
    const outer = safeToObject(payload.data);
    const detailData = outer && typeof outer.data === "object" ? safeToObject(outer.data) : outer;
    const segments = Array.isArray(detailData.data) ? detailData.data : [];
    const firstSegment = segments.find(function (item) {
      return item && typeof item === "object";
    }) || {};
    const segmentMarkInfo = Array.isArray(firstSegment.mark_info) ? firstSegment.mark_info : [];
    const detailMarkInfo = Array.isArray(detailData.mark_info) ? detailData.mark_info : [];
    const markInfo = segmentMarkInfo.length > 0 ? segmentMarkInfo : detailMarkInfo;
    const taskItemId =
      toText(outer.taskItemId) ||
      toText(detailData.taskItemId) ||
      toText(payload.taskItemId) ||
      toText(target?.taskItemIdFromPath);

    return {
      at: Date.now(),
      taskItemId: taskItemId,
      samplingRecordId: toText(outer.samplingRecordId || detailData.samplingRecordId),
      path: toText(detailData.path),
      object_key: toText(detailData.object_key),
      wav_name: toText(detailData.wav_name),
      dataItemId: toText(detailData.dataItemId || firstSegment.id),
      start_time: toNumberOrNull(firstSegment.start_time ?? detailData.start_time),
      end_time: toNumberOrNull(firstSegment.end_time ?? detailData.end_time),
      mark_info: markInfo.map(function (item) {
        const source = safeToObject(item);
        return {
          mark_text: toText(source.mark_text),
          speak_people: source.speak_people,
          mark_type: toText(source.mark_type),
        };
      }),
      statistics: detailData.statistics,
      is_valid: detailData.is_valid,
      base_speak: Array.isArray(detailData.base_speak) ? detailData.base_speak : [],
      duration: toNumberOrNull(
        detailData.duration !== undefined
          ? detailData.duration
          : detailData.audio_duration !== undefined
            ? detailData.audio_duration
            : detailData.length_time !== undefined
              ? detailData.length_time
              : detailData.total_duration
      ),
      length_time: toNumberOrNull(detailData.length_time),
      sentence_valid_time: toNumberOrNull(detailData.sentence_valid_time),
      sentence_unvalid_time: toNumberOrNull(detailData.sentence_unvalid_time),
      unlabeled_sentence_time: toNumberOrNull(detailData.unlabeled_sentence_time),
    };
  }

  function sanitizeHeaderPayload(rawPayload, target) {
    const payload = safeToObject(rawPayload);
    const data = safeToObject(payload.data);
    const taskItemId =
      toText(payload.taskItemId) ||
      toText(data.taskItemId) ||
      toText(target?.taskItemIdFromPath);

    return {
      at: Date.now(),
      taskItemId: taskItemId,
      code: toNumberOrNull(payload.code),
      message: toText(payload.message),
      projectName: toText(data.projectName),
      batchNo: toText(data.batchNo),
      packageId: toText(data.packageId),
      annotateMode: toText(data.annotateMode),
      pending: data.pending === true,
      isSubmit: data.isSubmit === true,
      processNodeId: toText(data.processNodeId),
      teamId: toText(data.teamId),
      projectId: toText(data.projectId),
      rawData: {
        expirationTime: toNumberOrNull(data.expirationTime),
        saveSuccessTime: toNumberOrNull(data.saveSuccessTime),
      },
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
      // Keep silent. ISOLATED side has fallback collection.
    }
  }

  function remember(entry) {
    cache.unshift(entry);
    cache.splice(CACHE_LIMIT);
    window.__ASREdgeMagicDataAnnotateDetailCache = {
      latest: cache[0] || null,
      entries: cache,
    };
    notify(DETAIL_TYPE, entry);
  }

  function rememberHeader(entry) {
    headerCache.unshift(entry);
    headerCache.splice(CACHE_LIMIT);
    window.__ASREdgeMagicDataAnnotateHeaderCache = {
      latest: headerCache[0] || null,
      entries: headerCache,
    };
    notify(HEADER_TYPE, entry);
  }

  function observeResponse(rawUrl, responseText) {
    const target = resolveObservedTarget(rawUrl);
    if (!target) {
      return;
    }
    try {
      const payload = JSON.parse(String(responseText || "{}"));
      if (target.kind === "detail") {
        const entry = sanitizePayload(payload, target);
        if (!entry.taskItemId) {
          return;
        }
        remember(entry);
        return;
      }
      const headerEntry = sanitizeHeaderPayload(payload, target);
      if (!headerEntry.taskItemId) {
        return;
      }
      rememberHeader(headerEntry);
    } catch (error) {
      // ignore non-json body
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
      const target = resolveObservedTarget(rawUrl);
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
          // ignore clone/read failures
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
      this.__ascMagicDataRequestUrl = String(url || "");
      return nativeOpen.apply(this, arguments);
    };

    NativeXhr.prototype.send = function () {
      const xhr = this;
      const rawUrl = xhr.__ascMagicDataRequestUrl || "";
      if (resolveObservedTarget(rawUrl)) {
        xhr.addEventListener("load", function () {
          observeResponse(rawUrl, xhr.responseText);
        });
      }
      return nativeSend.apply(this, arguments);
    };
  }
})();

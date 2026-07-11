(function () {
  const SOURCE = "ASR_EDGE_AISHELL_TECH_MARK_PAGE";
  const MESSAGE_TYPES = {
    TASK_DETAIL: "AISHELL_TECH_TASK_DETAIL",
    PACKAGE_ITEMS: "AISHELL_TECH_PACKAGE_ITEMS",
    MARK_DETAIL: "AISHELL_TECH_MARK_DETAIL",
    SHORT_MARK: "AISHELL_TECH_SHORT_MARK",
    SAVE_RESULT: "AISHELL_TECH_SAVE_RESULT",
  };
  const API_HOST = "markapi.aishelltech.com";
  const INSTALL_FLAG = "__ASREdgeAishellTechMarkObserverInstalled";
  const CACHE_KEY = "__ASREdgeAishellTechMarkCache";
  const CACHE_LIMIT = 30;

  if (window[INSTALL_FLAG]) {
    return;
  }
  window[INSTALL_FLAG] = true;
  try {
    document.documentElement.setAttribute("data-asc-aishell-main-world", "1");
  } catch (_error) {}

  const state = {
    taskDetails: [],
    packageItems: [],
    markDetails: [],
    shortMarks: [],
    saveResults: [],
  };

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function parseRouteParams() {
    const params = new URLSearchParams(location.search || "");
    return {
      taskId: normalizeText(params.get("taskId")),
      packageId: normalizeText(params.get("packageId")),
    };
  }

  function resolveTarget(rawUrl) {
    try {
      const url = new URL(String(rawUrl || ""), location.href);
      if (url.hostname !== API_HOST) {
        return null;
      }
      const taskDetailMatch = url.pathname.match(/^\/api\/task\/detail\/([^/]+)$/);
      if (taskDetailMatch) {
        return {
          kind: "task-detail",
          taskId: normalizeText(taskDetailMatch[1]),
          url: url,
        };
      }
      const packageItemsMatch = url.pathname.match(/^\/api\/taskItem\/packageItemList\/([^/]+)$/);
      if (packageItemsMatch) {
        return {
          kind: "package-items",
          packageId: normalizeText(packageItemsMatch[1]),
          url: url,
        };
      }
      const markDetailMatch = url.pathname.match(/^\/api\/taskItem\/markDetail\/([^/]+)$/);
      if (markDetailMatch) {
        return {
          kind: "mark-detail",
          taskItemId: normalizeText(markDetailMatch[1]),
          url: url,
        };
      }
      const shortMarkMatch = url.pathname.match(/^\/api\/mark\/getShortMark\/([^/]+)$/);
      if (shortMarkMatch) {
        return {
          kind: "short-mark",
          taskItemId: normalizeText(shortMarkMatch[1]),
          url: url,
        };
      }
      if (url.pathname === "/api/mark/SaveShortMark") {
        return {
          kind: "save",
          url: url,
        };
      }
      return null;
    } catch (_error) {
      return null;
    }
  }

  function remember(listKey, entry) {
    if (!entry || typeof entry !== "object") {
      return;
    }
    state[listKey].unshift(entry);
    state[listKey] = state[listKey].slice(0, CACHE_LIMIT);
    window[CACHE_KEY] = {
      taskDetails: state.taskDetails.slice(),
      packageItems: state.packageItems.slice(),
      markDetails: state.markDetails.slice(),
      shortMarks: state.shortMarks.slice(),
      saveResults: state.saveResults.slice(),
    };
  }

  function notify(type, payload) {
    try {
      window.postMessage(
        {
          source: SOURCE,
          type: type,
          payload: payload,
        },
        location.origin
      );
    } catch (_error) {
      // ignore
    }
  }

  function parseJson(text) {
    try {
      return JSON.parse(String(text || "{}"));
    } catch (_error) {
      return null;
    }
  }

  function parseRequestBody(body) {
    if (!body) {
      return {};
    }
    if (typeof body === "string") {
      return parseJson(body) || {};
    }
    if (typeof body === "object") {
      return body;
    }
    return {};
  }

  function extractMarkText(value) {
    if (value === undefined || value === null) {
      return "";
    }
    if (typeof value === "string") {
      const parsed = parseJson(value);
      if (parsed && typeof parsed.text === "string") {
        return normalizeText(parsed.text);
      }
      return normalizeText(value);
    }
    if (typeof value === "object") {
      if (typeof value.text === "string") {
        return normalizeText(value.text);
      }
      if (typeof value.mark === "string") {
        return extractMarkText(value.mark);
      }
    }
    return "";
  }

  function storeTaskDetail(target, payload) {
    const result = payload?.data?.result || {};
    const entry = {
      at: Date.now(),
      taskId: target.taskId || parseRouteParams().taskId,
      templateId: normalizeText(result.templateId),
      taskName: normalizeText(result.taskName),
      dataRoot: normalizeText(result?.project?.dataRoot),
      projectName: normalizeText(result?.project?.projectName),
      raw: result,
    };
    remember("taskDetails", entry);
    notify(MESSAGE_TYPES.TASK_DETAIL, entry);
  }

  function storePackageItems(target, payload) {
    const routeParams = parseRouteParams();
    const taskDetail = state.taskDetails[0] || {};
    const result = payload?.data?.result || {};
    const dataRoot = normalizeText(taskDetail.dataRoot);
    const items = Array.isArray(result.items)
      ? result.items.map(function (item, index) {
          const source = item && typeof item === "object" ? item : {};
          const relativeUrl = normalizeText(source.url);
          return {
            id: normalizeText(source.id),
            number: Number(source.number || index + 1) || index + 1,
            fileName: normalizeText(source.fileName),
            url: relativeUrl,
            audioUrl: dataRoot && relativeUrl ? dataRoot + relativeUrl : "",
            text: normalizeText(source.text),
            dataStatus: Number(source.dataStatus || 0) || 0,
            checkStatus: Number(source.checkStatus || 0) || 0,
            markUserName: normalizeText(source.markUserName),
            spendTime: Number(source.spendTime || 0) || 0,
            __index: index,
          };
        })
      : [];
    const entry = {
      at: Date.now(),
      taskId: routeParams.taskId,
      packageId: target.packageId || routeParams.packageId,
      totalCount: Number(result.totalCount || items.length) || items.length,
      pageSize: Number(result.pageSize || items.length) || items.length,
      dataRoot: dataRoot,
      items: items,
    };
    remember("packageItems", entry);
    notify(MESSAGE_TYPES.PACKAGE_ITEMS, entry);
  }

  function storeMarkDetail(target, payload) {
    const result = payload?.data?.result || {};
    const dataRoot = normalizeText(result.dataRoot);
    const relativeUrl = normalizeText(result.url);
    const entry = {
      at: Date.now(),
      taskItemId: target.taskItemId,
      dataRoot: dataRoot,
      url: relativeUrl,
      audioUrl: dataRoot && relativeUrl ? dataRoot + relativeUrl : "",
      fileName: normalizeText(result.fileName),
      text: normalizeText(result.text),
      audioLength: Number(result.audioLength || 0) || 0,
      raw: result,
    };
    remember("markDetails", entry);
    notify(MESSAGE_TYPES.MARK_DETAIL, entry);
  }

  function storeShortMark(target, payload) {
    const result = payload?.data?.result;
    const entry = {
      at: Date.now(),
      taskItemId: target.taskItemId,
      markText: extractMarkText(result),
      raw: result || null,
    };
    remember("shortMarks", entry);
    notify(MESSAGE_TYPES.SHORT_MARK, entry);
  }

  function storeSaveResult(requestBody, payload) {
    const body = requestBody && typeof requestBody === "object" ? requestBody : {};
    const entry = {
      at: Date.now(),
      taskItemId: normalizeText(body.taskItemId),
      markText: extractMarkText(body.mark),
      spendTime: Number(body.spendTime || 0) || 0,
      duration: Number(body.duration || 0) || 0,
      scene: normalizeText(body.scene),
      success: payload?.data?.isSucceed === true || payload?.status === 200,
      message: normalizeText(payload?.data?.message),
      status: Number(payload?.status || 0) || 0,
    };
    remember("saveResults", entry);
    notify(MESSAGE_TYPES.SAVE_RESULT, entry);
  }

  function observeResponse(rawUrl, requestBody, responseText) {
    const target = resolveTarget(rawUrl);
    if (!target) {
      return;
    }
    const payload = parseJson(responseText);
    if (!payload) {
      return;
    }

    if (target.kind === "task-detail") {
      storeTaskDetail(target, payload);
      return;
    }
    if (target.kind === "package-items") {
      storePackageItems(target, payload);
      return;
    }
    if (target.kind === "mark-detail") {
      storeMarkDetail(target, payload);
      return;
    }
    if (target.kind === "short-mark") {
      storeShortMark(target, payload);
      return;
    }
    if (target.kind === "save") {
      storeSaveResult(requestBody, payload);
    }
  }

  const nativeFetch = window.fetch;
  if (typeof nativeFetch === "function") {
    window.fetch = function () {
      const args = Array.from(arguments);
      const input = args[0];
      const init = args[1] || {};
      const rawUrl =
        typeof input === "string"
          ? input
          : input && typeof input.url === "string"
            ? input.url
            : "";
      const requestBody = Object.prototype.hasOwnProperty.call(init, "body") ? init.body : null;
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
              observeResponse(rawUrl, parseRequestBody(requestBody), text);
            })
            .catch(function () {});
        } catch (_error) {
          // ignore
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
      this.__asrEdgeAishellRequestUrl = String(url || "");
      return nativeOpen.apply(this, arguments);
    };

    NativeXhr.prototype.send = function (body) {
      const xhr = this;
      const rawUrl = xhr.__asrEdgeAishellRequestUrl || "";
      const parsedBody = parseRequestBody(body);
      if (resolveTarget(rawUrl)) {
        xhr.addEventListener("load", function () {
          observeResponse(rawUrl, parsedBody, xhr.responseText);
        });
      }
      return nativeSend.apply(this, arguments);
    };
  }
})();

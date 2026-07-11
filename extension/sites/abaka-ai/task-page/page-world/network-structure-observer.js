(function () {
  const INSTALL_FLAG = "__ASCAbakaAiNetworkStructureObserverInstalled";
  const CAPTURE_KEY = "__ASCAbakaAiCapture";
  const SOURCE = "ASC_ABAKA_AI_MAIN";
  const ENTRY_TYPE = "ASC_ABAKA_AI_NETWORK_STRUCTURE_ENTRY";
  const MAX_ENTRIES = 200;
  const MAX_DEPTH = 5;
  const MAX_OBJECT_KEYS = 30;
  const MAX_ARRAY_SAMPLE = 2;
  const LIST_CANDIDATE_KEYS = new Set([
    "data",
    "list",
    "records",
    "rows",
    "items",
    "result",
  ]);
  const TOTAL_CANDIDATE_KEYS = new Set([
    "total",
    "count",
    "totalcount",
    "pagesize",
    "pagenum",
    "current",
    "page",
    "pages",
  ]);
  const SENSITIVE_KEYWORDS = [
    "cookie",
    "authorization",
    "token",
    "access_token",
    "refresh_token",
    "password",
    "secret",
    "sign",
    "signature",
    "credential",
    "session",
    "audio",
    "url",
    "file",
    "download",
    "oss",
    "path",
    "src",
    "href",
  ];
  const MASKED_STRING_KEYWORDS = ["audio", "url", "file", "download", "oss", "path", "src", "href"];

  if (window[INSTALL_FLAG]) {
    return;
  }
  window[INSTALL_FLAG] = true;

  const state = {
    entries: [],
  };

  function toIso(value) {
    return new Date(value).toISOString();
  }

  function toTrimmedText(value, maxLength) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    if (!text) {
      return "";
    }
    return text.length > maxLength ? text.slice(0, maxLength) : text;
  }

  function uniqueList(items) {
    return Array.from(new Set(items.filter(Boolean)));
  }

  function isVisibleElement(node) {
    if (!(node instanceof Element)) {
      return false;
    }
    const style = window.getComputedStyle(node);
    if (!style || style.display === "none" || style.visibility === "hidden") {
      return false;
    }
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function collectVisibleTexts(selectors, maxItems, maxTextLength) {
    const texts = [];
    const nodes = document.querySelectorAll(selectors.join(","));
    for (let i = 0; i < nodes.length && texts.length < maxItems; i += 1) {
      const node = nodes[i];
      if (!isVisibleElement(node)) {
        continue;
      }
      const text = toTrimmedText(node.textContent || "", maxTextLength);
      if (!text || texts.indexOf(text) >= 0) {
        continue;
      }
      texts.push(text);
    }
    return texts;
  }

  function collectPageSummary() {
    const allTexts = [];
    if (document.body) {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode() && allTexts.length < 2000) {
        const value = toTrimmedText(walker.currentNode.nodeValue || "", 120);
        if (value) {
          allTexts.push(value);
        }
      }
    }

    const taskTextMatches = [];
    const taskNoMatches = [];
    const taskTextPattern = /\bTask\d+\b/g;
    const taskNoPattern = /#HM_[A-Za-z0-9_]+/g;
    for (let i = 0; i < allTexts.length; i += 1) {
      const text = allTexts[i];
      taskTextPattern.lastIndex = 0;
      taskNoPattern.lastIndex = 0;
      let match;
      while ((match = taskTextPattern.exec(text)) && taskTextMatches.length < 50) {
        taskTextMatches.push(match[0]);
      }
      while ((match = taskNoPattern.exec(text)) && taskNoMatches.length < 50) {
        taskNoMatches.push(match[0]);
      }
      if (taskTextMatches.length >= 50 && taskNoMatches.length >= 50) {
        break;
      }
    }

    const formControls = [];
    const formNodes = document.querySelectorAll("input, textarea, select");
    for (let i = 0; i < formNodes.length && formControls.length < 120; i += 1) {
      const node = formNodes[i];
      if (!(node instanceof Element) || !isVisibleElement(node)) {
        continue;
      }
      formControls.push({
        tag: node.tagName.toLowerCase(),
        type: toTrimmedText(node.getAttribute("type") || "", 40),
        name: toTrimmedText(node.getAttribute("name") || "", 80),
        placeholder: toTrimmedText(node.getAttribute("placeholder") || "", 80),
        ariaLabel: toTrimmedText(node.getAttribute("aria-label") || "", 80),
      });
    }

    const url = new URL(location.href);
    return {
      location: {
        origin: url.origin,
        pathname: url.pathname,
        hash: url.hash || "",
      },
      searchKeys: uniqueList(Array.from(url.searchParams.keys())),
      title: toTrimmedText(document.title || "", 120),
      tableHeaders: collectVisibleTexts(["table th", "[role='columnheader']", ".ant-table-thead th"], 80, 30),
      buttons: collectVisibleTexts(["button", "[role='button']", ".ant-btn"], 80, 30),
      tabsOrMenus: collectVisibleTexts(
        [
          "[role='tab']",
          ".ant-tabs-tab",
          "[role='menuitem']",
          ".ant-menu-item",
          ".menu-item",
          ".tabs li",
        ],
        80,
        30
      ),
      formControls: formControls,
      taskTexts: uniqueList(taskTextMatches).slice(0, 50),
      taskNumbers: uniqueList(taskNoMatches).slice(0, 50),
    };
  }

  function normalizeKey(value) {
    return String(value || "").trim().toLowerCase();
  }

  function includesKeyword(text, keywords) {
    const normalized = normalizeKey(text);
    if (!normalized) {
      return false;
    }
    for (let i = 0; i < keywords.length; i += 1) {
      if (normalized.indexOf(keywords[i]) >= 0) {
        return true;
      }
    }
    return false;
  }

  function isSensitiveKey(key) {
    return includesKeyword(key, SENSITIVE_KEYWORDS);
  }

  function isMaskedStringKey(key) {
    return includesKeyword(key, MASKED_STRING_KEYWORDS);
  }

  function getValueType(value) {
    if (value === null) {
      return "null";
    }
    if (Array.isArray(value)) {
      return "array";
    }
    return typeof value;
  }

  function maskSensitiveValue(value, key) {
    const type = getValueType(value);
    if (typeof value === "string" && isMaskedStringKey(key)) {
      return {
        type: "string",
        length: value.length,
        masked: true,
      };
    }
    if (typeof value === "string") {
      return "<redacted>";
    }
    return {
      type: type,
      masked: true,
    };
  }

  function buildShape(value, depth, keyHint) {
    if (isSensitiveKey(keyHint)) {
      return maskSensitiveValue(value, keyHint);
    }
    if (depth >= MAX_DEPTH) {
      return {
        type: getValueType(value),
        truncated: true,
      };
    }
    if (value === null) {
      return { type: "null" };
    }
    if (Array.isArray(value)) {
      const sample = [];
      for (let i = 0; i < value.length && i < MAX_ARRAY_SAMPLE; i += 1) {
        sample.push(buildShape(value[i], depth + 1, keyHint));
      }
      return {
        type: "array",
        length: value.length,
        sample: sample,
      };
    }
    if (typeof value === "object") {
      const keys = Object.keys(value).slice(0, MAX_OBJECT_KEYS);
      const shape = {};
      for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i];
        shape[key] = buildShape(value[key], depth + 1, key);
      }
      return {
        type: "object",
        keys: keys,
        shape: shape,
      };
    }
    if (typeof value === "string") {
      return {
        type: "string",
        length: value.length,
      };
    }
    return {
      type: typeof value,
    };
  }

  function tryParseJson(text) {
    try {
      return { ok: true, value: JSON.parse(String(text || "")) };
    } catch (error) {
      return { ok: false, error: error };
    }
  }

  function readRequestBodyShape(body) {
    if (body === undefined || body === null) {
      return null;
    }
    try {
      if (typeof body === "string") {
        const parsed = tryParseJson(body);
        if (parsed.ok) {
          return buildShape(parsed.value, 0, "body");
        }
        return { type: "string", length: body.length };
      }
      if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) {
        return {
          type: "urlencoded",
          keys: uniqueList(Array.from(body.keys())).slice(0, MAX_OBJECT_KEYS),
        };
      }
      if (typeof FormData !== "undefined" && body instanceof FormData) {
        const keys = [];
        body.forEach(function (_, key) {
          keys.push(String(key || ""));
        });
        return {
          type: "form-data",
          keys: uniqueList(keys).slice(0, MAX_OBJECT_KEYS),
        };
      }
      if (typeof Blob !== "undefined" && body instanceof Blob) {
        return {
          type: "blob",
          size: Number(body.size || 0),
          contentType: String(body.type || ""),
        };
      }
      if (typeof ArrayBuffer !== "undefined" && body instanceof ArrayBuffer) {
        return {
          type: "array-buffer",
          length: body.byteLength,
        };
      }
      if (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView(body)) {
        return {
          type: "array-buffer-view",
          length: Number(body.byteLength || 0),
        };
      }
      if (typeof body === "object") {
        return buildShape(body, 0, "body");
      }
      return {
        type: typeof body,
      };
    } catch (error) {
      return {
        type: "unavailable",
      };
    }
  }

  function getUrlMeta(rawUrl) {
    try {
      const url = new URL(String(rawUrl || ""), location.href);
      return {
        sameOrigin: url.origin === location.origin,
        origin: url.origin,
        pathname: url.pathname,
        queryKeys: uniqueList(Array.from(url.searchParams.keys())).slice(0, 80),
      };
    } catch (error) {
      return {
        sameOrigin: false,
        origin: "",
        pathname: "",
        queryKeys: [],
      };
    }
  }

  function collectListCandidates(value) {
    const result = [];

    function walk(node, path, lastKey, depth) {
      if (depth > MAX_DEPTH || result.length >= 50) {
        return;
      }
      if (Array.isArray(node)) {
        if (LIST_CANDIDATE_KEYS.has(normalizeKey(lastKey))) {
          const firstObject = node.find(function (item) {
            return item && typeof item === "object" && !Array.isArray(item);
          });
          result.push({
            path: path.join("."),
            length: node.length,
            sampleKeys: firstObject ? Object.keys(firstObject).slice(0, MAX_OBJECT_KEYS) : [],
          });
        }
        if (node.length > 0) {
          walk(node[0], path.concat("[0]"), "", depth + 1);
        }
        return;
      }
      if (!node || typeof node !== "object") {
        return;
      }
      const keys = Object.keys(node).slice(0, MAX_OBJECT_KEYS);
      for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i];
        walk(node[key], path.concat(key), key, depth + 1);
      }
    }

    walk(value, ["$"], "", 0);
    return result;
  }

  function collectTotalCandidates(value) {
    const result = [];

    function walk(node, path, depth) {
      if (depth > MAX_DEPTH || result.length >= 50) {
        return;
      }
      if (!node || typeof node !== "object" || Array.isArray(node)) {
        return;
      }
      const keys = Object.keys(node).slice(0, MAX_OBJECT_KEYS);
      for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i];
        const normalizedKey = normalizeKey(key);
        const nextPath = path.concat(key);
        const valueAtKey = node[key];
        if (TOTAL_CANDIDATE_KEYS.has(normalizedKey) && typeof valueAtKey === "number") {
          result.push({
            path: nextPath.join("."),
            valueType: "number",
            value: valueAtKey,
          });
        }
        if (valueAtKey && typeof valueAtKey === "object" && !Array.isArray(valueAtKey)) {
          walk(valueAtKey, nextPath, depth + 1);
        }
      }
    }

    walk(value, ["$"], 0);
    return result;
  }

  function summarizeResponse(responseText) {
    const parsed = tryParseJson(responseText);
    if (!parsed.ok) {
      return {
        responseShape: null,
        listCandidates: [],
        totalCandidates: [],
        error: "parse-failed",
      };
    }
    return {
      responseShape: buildShape(parsed.value, 0, "response"),
      listCandidates: collectListCandidates(parsed.value),
      totalCandidates: collectTotalCandidates(parsed.value),
      error: "",
    };
  }

  function rememberEntry(entry) {
    state.entries.unshift(entry);
    if (state.entries.length > MAX_ENTRIES) {
      state.entries = state.entries.slice(0, MAX_ENTRIES);
    }

    try {
      window.postMessage(
        {
          source: SOURCE,
          type: ENTRY_TYPE,
          payload: entry,
        },
        location.origin
      );
    } catch (error) {
      // keep observer silent
    }
  }

  function buildBaseRequestEntry(rawUrl, method, body, startedAt) {
    const urlMeta = getUrlMeta(rawUrl);
    return {
      request: {
        method: String(method || "GET").toUpperCase(),
        sameOrigin: urlMeta.sameOrigin,
        origin: urlMeta.origin,
        pathname: urlMeta.pathname,
        queryKeys: urlMeta.queryKeys,
        bodyShape: readRequestBodyShape(body),
        startedAt: toIso(startedAt),
      },
      response: {
        status: null,
        ok: null,
        contentType: "",
        responseShape: null,
        listCandidates: [],
        totalCandidates: [],
        error: "",
      },
      elapsedMs: null,
      capturedAt: toIso(Date.now()),
    };
  }

  function finalizeRequestEntry(baseEntry, status, ok, contentType, responseText, startedAt) {
    const elapsedMs = Date.now() - startedAt;
    const responseSummary = summarizeResponse(responseText);
    const entry = {
      request: Object.assign({}, baseEntry.request, {
        startedAt: toIso(startedAt),
        elapsedMs: elapsedMs,
      }),
      response: {
        status: Number.isFinite(Number(status)) ? Number(status) : null,
        ok: Boolean(ok),
        contentType: String(contentType || ""),
        responseShape: responseSummary.responseShape,
        listCandidates: responseSummary.listCandidates,
        totalCandidates: responseSummary.totalCandidates,
        error: responseSummary.error,
      },
      elapsedMs: elapsedMs,
      capturedAt: toIso(Date.now()),
    };
    rememberEntry(entry);
  }

  function installFetchObserver() {
    const nativeFetch = window.fetch;
    if (typeof nativeFetch !== "function") {
      return;
    }
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
      const method =
        (init && init.method) ||
        (input && typeof input.method === "string" ? input.method : "GET");
      const body = init && Object.prototype.hasOwnProperty.call(init, "body") ? init.body : null;
      const startedAt = Date.now();
      const baseEntry = buildBaseRequestEntry(rawUrl, method, body, startedAt);

      return nativeFetch.apply(this, args).then(
        function (response) {
          try {
            response
              .clone()
              .text()
              .then(function (text) {
                finalizeRequestEntry(
                  baseEntry,
                  response.status,
                  response.ok,
                  response.headers && typeof response.headers.get === "function"
                    ? response.headers.get("content-type")
                    : "",
                  text,
                  startedAt
                );
              })
              .catch(function () {
                finalizeRequestEntry(baseEntry, response.status, response.ok, "", "", startedAt);
              });
          } catch (error) {
            finalizeRequestEntry(baseEntry, response.status, response.ok, "", "", startedAt);
          }
          return response;
        },
        function (error) {
          const failedEntry = Object.assign({}, baseEntry, {
            response: {
              status: null,
              ok: false,
              contentType: "",
              responseShape: null,
              listCandidates: [],
              totalCandidates: [],
              error: "request-failed",
            },
            elapsedMs: Date.now() - startedAt,
            capturedAt: toIso(Date.now()),
          });
          rememberEntry(failedEntry);
          throw error;
        }
      );
    };
  }

  function installXhrObserver() {
    const NativeXhr = window.XMLHttpRequest;
    if (typeof NativeXhr !== "function") {
      return;
    }
    const nativeOpen = NativeXhr.prototype.open;
    const nativeSend = NativeXhr.prototype.send;

    NativeXhr.prototype.open = function (method, url) {
      this.__ascAbakaAiMethod = String(method || "GET");
      this.__ascAbakaAiUrl = String(url || "");
      return nativeOpen.apply(this, arguments);
    };

    NativeXhr.prototype.send = function (body) {
      const xhr = this;
      const startedAt = Date.now();
      const baseEntry = buildBaseRequestEntry(
        xhr.__ascAbakaAiUrl || "",
        xhr.__ascAbakaAiMethod || "GET",
        body,
        startedAt
      );

      xhr.addEventListener("loadend", function () {
        let responseText = "";
        try {
          responseText = typeof xhr.responseText === "string" ? xhr.responseText : "";
        } catch (error) {
          responseText = "";
        }
        finalizeRequestEntry(
          baseEntry,
          xhr.status,
          xhr.status >= 200 && xhr.status < 300,
          xhr.getResponseHeader ? xhr.getResponseHeader("content-type") : "",
          responseText,
          startedAt
        );
      });

      return nativeSend.apply(this, arguments);
    };
  }

  function getSnapshot() {
    return {
      platform: "Abaka AI",
      scriptId: "abakaAiTaskPageCapture",
      capturedAt: toIso(Date.now()),
      page: collectPageSummary(),
      network: state.entries.slice(),
    };
  }

  function getTimestampToken() {
    const now = new Date();
    const pad = function (value) {
      return String(value).padStart(2, "0");
    };
    return (
      String(now.getFullYear()) +
      pad(now.getMonth() + 1) +
      pad(now.getDate()) +
      "-" +
      pad(now.getHours()) +
      pad(now.getMinutes()) +
      pad(now.getSeconds())
    );
  }

  function downloadSnapshot() {
    const payload = getSnapshot();
    const text = JSON.stringify(payload, null, 2);
    const blob = new Blob([text], { type: "application/json;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = "abaka-ai-task-page-structure-" + getTimestampToken() + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
    return a.download;
  }

  installFetchObserver();
  installXhrObserver();

  window[CAPTURE_KEY] = {
    snapshot: function () {
      return getSnapshot();
    },
    list: function () {
      return state.entries.slice();
    },
    latest: function () {
      return state.entries[0] || null;
    },
    page: function () {
      return collectPageSummary();
    },
    clear: function () {
      state.entries = [];
      return {
        cleared: true,
      };
    },
    download: function () {
      return downloadSnapshot();
    },
  };

  console.info(
    "[ASC][Abaka AI] network structure observer installed. Use window.__ASCAbakaAiCapture.snapshot() or download()."
  );
})();

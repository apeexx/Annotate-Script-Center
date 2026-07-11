(function () {
  if (globalThis.__ASREdgeAishellTechCnEnShortDramaDataApiInstalled === true) {
    return;
  }
  globalThis.__ASREdgeAishellTechCnEnShortDramaDataApiInstalled = true;

  const API_ORIGIN = "https://markapi.aishelltech.com";
  const DEFAULT_AUDIO_ROOT = "https://bpp-collect.oss-cn-hangzhou.aliyuncs.com";
  const TOKEN_PATTERN = /^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/;
  const PRIORITY_TOKEN_KEYS = [
    "authorization",
    "authorisation",
    "token",
    "accessToken",
    "access_token",
    "jwt",
    "id_token",
  ];

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function isMarkPage() {
    return (
      location.hostname === "mark.aishelltech.com" &&
      String(location.pathname || "").toLowerCase() === "/mytask/mark"
    );
  }

  function parseRouteParams() {
    const params = new URLSearchParams(location.search || "");
    return {
      taskId: normalizeText(params.get("taskId")),
      packageId: normalizeText(params.get("packageId")),
    };
  }

  function formatDurationSeconds(value) {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue) || numberValue < 0) {
      return "";
    }
    return numberValue.toFixed(3) + " 秒";
  }

  function safeJsonParse(value) {
    try {
      return JSON.parse(String(value || ""));
    } catch (_error) {
      return null;
    }
  }

  function stripBearerPrefix(value) {
    const text = normalizeText(value);
    if (!text) {
      return "";
    }
    if (/^bearer\s+/i.test(text)) {
      return normalizeText(text.replace(/^bearer\s+/i, ""));
    }
    return text;
  }

  function isJwtLike(value) {
    return TOKEN_PATTERN.test(String(value || ""));
  }

  function extractAuthTokenFromUnknown(value, depth, seen) {
    if (depth > 6) {
      return "";
    }
    if (value === undefined || value === null) {
      return "";
    }

    if (typeof value === "string") {
      const direct = stripBearerPrefix(value);
      if (isJwtLike(direct)) {
        return direct;
      }
      const trimmed = String(value || "").trim();
      if (!trimmed || (trimmed[0] !== "{" && trimmed[0] !== "[")) {
        return "";
      }
      const parsed = safeJsonParse(trimmed);
      return parsed ? extractAuthTokenFromUnknown(parsed, depth + 1, seen) : "";
    }

    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        const token = extractAuthTokenFromUnknown(value[index], depth + 1, seen);
        if (token) {
          return token;
        }
      }
      return "";
    }

    if (typeof value !== "object") {
      return "";
    }

    if (seen.has(value)) {
      return "";
    }
    seen.add(value);

    const orderedKeys = Object.keys(value)
      .slice()
      .sort(function (left, right) {
        const leftPriority = PRIORITY_TOKEN_KEYS.indexOf(left);
        const rightPriority = PRIORITY_TOKEN_KEYS.indexOf(right);
        const leftRank = leftPriority >= 0 ? leftPriority : PRIORITY_TOKEN_KEYS.length + 1;
        const rightRank = rightPriority >= 0 ? rightPriority : PRIORITY_TOKEN_KEYS.length + 1;
        return leftRank - rightRank;
      });

    for (let index = 0; index < orderedKeys.length; index += 1) {
      const token = extractAuthTokenFromUnknown(value[orderedKeys[index]], depth + 1, seen);
      if (token) {
        return token;
      }
    }

    return "";
  }

  function readStorageEntries(storageLike) {
    if (!storageLike || typeof storageLike.length !== "number") {
      return [];
    }
    const entries = [];
    for (let index = 0; index < storageLike.length; index += 1) {
      const key =
        typeof storageLike.key === "function" ? normalizeText(storageLike.key(index)) : "";
      if (!key) {
        continue;
      }
      let value = "";
      try {
        value = storageLike.getItem(key);
      } catch (_error) {
        value = "";
      }
      entries.push({
        key: key,
        value: value,
      });
    }
    return entries;
  }

  function findAuthTokenInEntries(entries) {
    const source = Array.isArray(entries) ? entries : [];
    const prioritized = source
      .slice()
      .sort(function (left, right) {
        const leftKey = String(left?.key || "").toLowerCase();
        const rightKey = String(right?.key || "").toLowerCase();
        const leftPriority = PRIORITY_TOKEN_KEYS.findIndex(function (tokenKey) {
          return leftKey.indexOf(tokenKey.toLowerCase()) >= 0;
        });
        const rightPriority = PRIORITY_TOKEN_KEYS.findIndex(function (tokenKey) {
          return rightKey.indexOf(tokenKey.toLowerCase()) >= 0;
        });
        const leftRank = leftPriority >= 0 ? leftPriority : PRIORITY_TOKEN_KEYS.length + 1;
        const rightRank = rightPriority >= 0 ? rightPriority : PRIORITY_TOKEN_KEYS.length + 1;
        return leftRank - rightRank;
      });

    for (let index = 0; index < prioritized.length; index += 1) {
      const token = extractAuthTokenFromUnknown(prioritized[index]?.value, 0, new WeakSet());
      if (token) {
        return token;
      }
    }
    return "";
  }

  function readAuthTokenFromPageStorage() {
    const localEntries =
      typeof window !== "undefined" ? readStorageEntries(window.localStorage) : [];
    const localToken = findAuthTokenInEntries(localEntries);
    if (localToken) {
      return localToken;
    }
    const sessionEntries =
      typeof window !== "undefined" ? readStorageEntries(window.sessionStorage) : [];
    return findAuthTokenInEntries(sessionEntries);
  }

  function createRequestError(message) {
    return new Error(String(message || "请求失败。"));
  }

  function buildApiUrl(path) {
    return API_ORIGIN + String(path || "");
  }

  function buildAudioUrl(dataRoot, relativeUrl) {
    const root = normalizeText(dataRoot || DEFAULT_AUDIO_ROOT).replace(/\/+$/, "");
    const path = String(relativeUrl || "").trim();
    if (!path) {
      return "";
    }
    if (/^https?:\/\//i.test(path)) {
      return path;
    }
    return root + (path.charAt(0) === "/" ? path : "/" + path);
  }

  function getListItemNodes(documentLike) {
    const source =
      documentLike && typeof documentLike.querySelectorAll === "function" ? documentLike : null;
    if (!source) {
      return [];
    }
    return Array.from(
      source.querySelectorAll(
        ".list .list-item, .list .list-item-selected, .list .list-item-finshed, .list .list-item-invalid"
      )
    );
  }

  function getSelectedIndexFromDom(documentLike) {
    const items = getListItemNodes(documentLike);
    const selectedIndex = items.findIndex(function (node) {
      return Boolean(node?.classList?.contains?.("list-item-selected"));
    });
    return selectedIndex >= 0 ? selectedIndex : items.length > 0 ? 0 : -1;
  }

  function findDefinitionValueByLabel(documentLike, labels) {
    const source =
      documentLike && typeof documentLike.querySelectorAll === "function" ? documentLike : null;
    const targetLabels = Array.isArray(labels) ? labels.map(normalizeText).filter(Boolean) : [];
    if (!source || targetLabels.length === 0) {
      return "";
    }
    const scopedRows = Array.from(
      source.querySelectorAll(".current-media-info-row, .field-card li, .field-card p, .el-form-item")
    );
    for (let index = 0; index < scopedRows.length; index += 1) {
      const text = normalizeText(scopedRows[index]?.textContent || "");
      if (!text) {
        continue;
      }
      for (let labelIndex = 0; labelIndex < targetLabels.length; labelIndex += 1) {
        const label = targetLabels[labelIndex];
        const pattern = new RegExp("^" + escapeRegExp(label) + "\\s*[:：]?\\s*(.+)$", "i");
        const matched = text.match(pattern);
        if (matched && normalizeText(matched[1])) {
          return normalizeText(matched[1]);
        }
      }
    }
    return "";
  }

  function escapeRegExp(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function readDomFallbacks(documentLike) {
    const source =
      documentLike && typeof documentLike.querySelector === "function" ? documentLike : null;
    const segmentCountFromList = String(Math.max(0, getListItemNodes(documentLike).length || 0));
    return {
      title:
        normalizeText(
          source?.querySelector?.("[data-current-title]")?.textContent ||
            source?.querySelector?.(".task-title")?.textContent ||
            ""
        ) || findDefinitionValueByLabel(documentLike, ["题目", "标题", "任务名"]),
      template:
        normalizeText(
          source?.querySelector?.("[data-current-template]")?.textContent ||
            source?.querySelector?.(".template-name")?.textContent ||
            ""
        ) || findDefinitionValueByLabel(documentLike, ["模板", "模板名", "模板ID"]),
      segmentCount:
        findDefinitionValueByLabel(documentLike, ["分段数", "分段", "条目数"]) || segmentCountFromList,
    };
  }

  function extractCurrentMediaInfo(taskDetail, packageItems, selectedIndex, domFallbacks) {
    const fallback = domFallbacks && typeof domFallbacks === "object" ? domFallbacks : {};
    const records = Array.isArray(packageItems) ? packageItems : [];
    const record =
      records[Number(selectedIndex)] ||
      records[0] ||
      {};
    const title = normalizeText(
      taskDetail?.title ||
        taskDetail?.taskName ||
        record?.title ||
        fallback.title
    );
    const template = normalizeText(
      taskDetail?.templateName ||
        taskDetail?.templateId ||
        record?.templateName ||
        fallback.template
    );
    const durationText = formatDurationSeconds(
      taskDetail?.duration || taskDetail?.audioDuration || record?.duration
    );
    const segmentCount = records.length > 0 ? String(records.length) : normalizeText(fallback.segmentCount);
    const videoUrl = normalizeText(
      record?.videoUrl || record?.videoPath || taskDetail?.videoUrl || taskDetail?.videoPath || ""
    );
    const audioUrl = buildAudioUrl(
      taskDetail?.dataRoot || taskDetail?.project?.dataRoot,
      record?.url || record?.audioUrl || record?.audioPath
    );

    return {
      title: title,
      template: template,
      durationText: durationText,
      segmentCount: segmentCount,
      videoUrl: videoUrl,
      audioUrl: audioUrl,
      hasVideo: Boolean(videoUrl),
    };
  }

  function createRuntime() {
    const state = {
      authToken: "",
      taskDetailByTaskId: {},
      packageItemsByPackageId: {},
    };

    function getAuthToken() {
      if (state.authToken) {
        return state.authToken;
      }
      state.authToken = readAuthTokenFromPageStorage();
      if (!state.authToken) {
        throw createRequestError("Aishell 登录状态缺失，请先重新登录后再试。");
      }
      return state.authToken;
    }

    async function requestJson(path) {
      const token = getAuthToken();
      const response = await fetch(buildApiUrl(path), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: "Bearer " + token,
        },
      });
      const payload = await response.json().catch(function () {
        return null;
      });

      if (response.status === 401 || response.status === 403) {
        state.authToken = "";
        throw createRequestError("Aishell 登录状态已失效，请重新登录后再试。");
      }
      if (!response.ok) {
        throw createRequestError(
          "Aishell 平台请求失败（HTTP " + String(response.status) + "）。"
        );
      }
      if (!payload || payload.success === false) {
        throw createRequestError(
          normalizeText(payload?.error || payload?.message) || "Aishell 平台返回了失败响应。"
        );
      }
      return payload;
    }

    async function ensureTaskDetail(taskId) {
      const key = normalizeText(taskId || parseRouteParams().taskId);
      if (!key) {
        throw createRequestError("当前页面缺少 taskId。");
      }
      if (state.taskDetailByTaskId[key]) {
        return state.taskDetailByTaskId[key];
      }
      const payload = await requestJson("/api/task/detail/" + encodeURIComponent(key));
      const result = payload?.data?.result || payload?.data || {};
      const entry = {
        taskId: key,
        title: normalizeText(result.title || result.taskName),
        taskName: normalizeText(result.taskName || result.title),
        templateId: normalizeText(result.templateId),
        templateName: normalizeText(result.templateName),
        duration: Number(result.duration || result.audioDuration || 0) || 0,
        dataRoot: normalizeText(result.dataRoot || result?.project?.dataRoot),
        raw: result,
      };
      state.taskDetailByTaskId[key] = entry;
      return entry;
    }

    async function ensurePackageItems(packageId) {
      const key = normalizeText(packageId || parseRouteParams().packageId);
      if (!key) {
        throw createRequestError("当前页面缺少 packageId。");
      }
      if (state.packageItemsByPackageId[key]) {
        return state.packageItemsByPackageId[key];
      }
      const payload = await requestJson(
        "/api/taskItem/packageItemList/" + encodeURIComponent(key)
      );
      const result = payload?.data?.result || payload?.data || {};
      const entry = Array.isArray(result.items)
        ? result.items.map(function (item, index) {
            const source = item && typeof item === "object" ? item : {};
            return {
              id: normalizeText(source.id),
              number: Number(source.number || index + 1) || index + 1,
              title: normalizeText(source.title),
              fileName: normalizeText(source.fileName),
              url: normalizeText(source.url || source.audioUrl || source.audioPath),
              videoUrl: normalizeText(source.videoUrl),
              videoPath: normalizeText(source.videoPath),
              duration: Number(source.duration || source.audioDuration || 0) || 0,
              text: normalizeText(source.text),
              raw: source,
            };
          })
        : [];
      state.packageItemsByPackageId[key] = entry;
      return entry;
    }

    async function getCurrentMediaInfo() {
      const route = parseRouteParams();
      const taskDetail = await ensureTaskDetail(route.taskId);
      const packageItems = await ensurePackageItems(route.packageId);
      const selectedIndex = getSelectedIndexFromDom(document);
      return extractCurrentMediaInfo(
        taskDetail,
        packageItems,
        selectedIndex,
        readDomFallbacks(document)
      );
    }

    return {
      getCurrentMediaInfo: getCurrentMediaInfo,
    };
  }

  const api = {
    createRuntime,
    extractCurrentMediaInfo,
    formatDurationSeconds,
    getSelectedIndexFromDom,
    isMarkPage,
    parseRouteParams,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalThis.__ASREdgeAishellTechCnEnShortDramaDataApi = api;
})();

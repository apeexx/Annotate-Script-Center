(function () {
  const LOG_PREFIX = "[ASR Edge][transcription-stats]";
  const DETAIL_PAGE_SIZE = 5000;
  const LIST_PAGE_SIZE = 50;
  const DEFAULT_EXPORT_CONCURRENCY = 5;
  const MAX_EXPORT_CONCURRENCY = 999;
  const MAX_LIST_PAGES = 999;
  const MAX_DETAIL_PAGES = 999;
  const CONSTANTS = globalThis.ASREdgeConstants || {};
  const BACKEND_MODE_SERVER = CONSTANTS.BACKEND_ENDPOINT_MODE_SERVER || "server";
  const BACKEND_MODE_LOCAL = CONSTANTS.BACKEND_ENDPOINT_MODE_LOCAL || "local";
  const DEFAULT_UPLOAD_PATH = "/api/alibaba-labelx/asr-transcription/statistics/upload";
  const DEFAULT_EXISTING_PATH = "/api/alibaba-labelx/asr-transcription/statistics/existing";
  const DEFAULT_SERVER_UPLOAD_ENDPOINT =
    String(CONSTANTS.DEFAULT_BACKEND_BASE_URLS?.server || "").replace(/\/+$/, "") +
    DEFAULT_UPLOAD_PATH;
  const DEFAULT_UPLOAD_TIMES = ["10:00", "16:00"];
  const DEFAULT_UPLOAD_JITTER_MINUTES = 0;
  const SCHEDULE_UPLOAD_DELAY_MAX_MS = 300000;
  const SCHEDULE_UPLOAD_DELAY_STEP_MS = 100;
  const EXISTING_CHECK_CHUNK_SIZE = 1000;
  const TRANSCRIPTION_LABEL_MODEL = "single";
  const JUDGEMENT_LABEL_MODEL = "vote";
  const TRANSCRIPTION_TASK_SIZE = 50;
  const JUDGEMENT_TASK_SIZE = 400;
  const HOME_TASK_KINDS = [
    {
      key: "label",
      role: "label",
      route: "/corpora/labeling/labelingtask",
      listType: "label",
      taskType: "label",
      label: "标注",
    },
    {
      key: "check",
      role: "audit",
      route: "/corpora/labeling/checktask",
      listType: "check",
      taskType: "check",
      label: "审核",
    },
  ];
  const CSV_COLUMNS = [
    "任务名称",
    "任务ID",
    "标注子任务ID",
    "审核子任务ID",
    "分包ID",
    "题数",
    "有效时长(秒)_S",
    "标注员_P",
    "审核员_P",
    "标注领取时间",
    "标注提交时间",
    "审核领取时间",
    "审核提交时间",
    "标注是否完成",
    "审核是否完成",
    "供应商",
  ];
  const SUPPLIER_HELPER = globalThis.ASREdgeStatisticsSupplier || {};
  const PROGRESS_HELPER = globalThis.ASREdgeProgressIndicator || {};
  const UNKNOWN_SUPPLIER_NAME = SUPPLIER_HELPER.UNKNOWN_SUPPLIER_NAME || "未识别供应商";
  const REPLACEMENT_CHAR = "\uFFFD";

  function cleanText(value) {
    if (typeof SUPPLIER_HELPER.cleanCsvValue === "function") {
      return SUPPLIER_HELPER.cleanCsvValue(value);
    }
    return String(value || "")
      .replace(/\uFEFF/g, "")
      .replace(/[\u200B-\u200D\u2060]/g, "")
      .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000\t\r\n\f\v]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function hasReplacementChar(value) {
    if (typeof SUPPLIER_HELPER.hasReplacementChar === "function") {
      return SUPPLIER_HELPER.hasReplacementChar(value);
    }
    return String(value || "").indexOf(REPLACEMENT_CHAR) >= 0;
  }

  function stripReplacementChars(value) {
    return String(value || "").replace(/\uFFFD+/g, "");
  }

  function isCorruptedText(value) {
    if (typeof SUPPLIER_HELPER.isCorruptedText === "function") {
      return SUPPLIER_HELPER.isCorruptedText(value);
    }
    const text = cleanText(value);
    return Boolean(text) && hasReplacementChar(text);
  }

  function pickHealthyText(candidates) {
    const list = Array.isArray(candidates) ? candidates : [candidates];
    let fallback = "";
    for (let index = 0; index < list.length; index += 1) {
      const cleaned = cleanText(list[index]);
      if (!cleaned) {
        continue;
      }
      if (!fallback) {
        fallback = cleaned;
      }
      if (!isCorruptedText(cleaned)) {
        return cleaned;
      }
    }
    return cleanText(stripReplacementChars(fallback));
  }

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function normalizeUrlParam(value) {
    try {
      return decodeURIComponent(String(value || "")).trim();
    } catch (error) {
      return String(value || "").trim();
    }
  }

  function sanitizeSubTaskId(value) {
    let decoded = "";
    try {
      decoded = decodeURIComponent(String(value || ""));
    } catch (error) {
      decoded = String(value || "");
    }
    return decoded.replace(/[\s\u3000]+/g, "").trim();
  }

  function getUrlParams() {
    const params = new URLSearchParams(location.search || "");
    return {
      projectId: normalizeUrlParam(params.get("projectId") || ""),
      subTaskId: sanitizeSubTaskId(params.get("subTaskId") || ""),
      missionType: normalizeUrlParam(params.get("missionType") || ""),
    };
  }

  function getProjectIdFromUrl() {
    return getUrlParams().projectId || "";
  }

  function trimSlash(value) {
    return String(value || "").replace(/\/+$/, "");
  }

  function normalizeEndpoint(value) {
    const text = String(value || "").trim();
    if (!text) {
      return "";
    }
    try {
      return new URL(text, location.origin).toString();
    } catch (error) {
      return "";
    }
  }

  function summarizeUploadResponseBody(body) {
    if (!body) {
      return "";
    }
    const text =
      typeof body === "string"
        ? body
        : body.message
          ? body.message
          : JSON.stringify(body);
    return String(text || "").replace(/\s+/g, " ").trim().slice(0, 300);
  }

  function getEndpointLabel(endpoint) {
    try {
      const url = new URL(endpoint);
      return url.origin + url.pathname;
    } catch (error) {
      return String(endpoint || "").trim();
    }
  }

  function resolveUploadEndpoint(config) {
    const modeText = String(config?.backendEndpointMode || "").trim().toLowerCase();
    const endpointMode =
      modeText === BACKEND_MODE_LOCAL
        ? BACKEND_MODE_LOCAL
        : modeText === BACKEND_MODE_BETA
          ? BACKEND_MODE_BETA
          : BACKEND_MODE_SERVER;
    if (typeof CONSTANTS.buildBackendUrl === "function") {
      const byMode = normalizeEndpoint(CONSTANTS.buildBackendUrl(DEFAULT_UPLOAD_PATH, endpointMode));
      if (byMode) {
        return byMode;
      }
    }
    if (config?.settings && typeof CONSTANTS.buildBackendUrl === "function") {
      const bySettings = normalizeEndpoint(CONSTANTS.buildBackendUrl(DEFAULT_UPLOAD_PATH, config.settings));
      if (bySettings) {
        return bySettings;
      }
    }

    const baseUrl =
      endpointMode === BACKEND_MODE_LOCAL
        ? CONSTANTS.DEFAULT_BACKEND_BASE_URLS?.local
        : CONSTANTS.DEFAULT_BACKEND_BASE_URLS?.server;
    return trimSlash(baseUrl) + DEFAULT_UPLOAD_PATH;
  }

  function resolveExistingEndpoint(config) {
    const modeText = String(config?.backendEndpointMode || "").trim().toLowerCase();
    const endpointMode =
      modeText === BACKEND_MODE_LOCAL
        ? BACKEND_MODE_LOCAL
        : modeText === BACKEND_MODE_BETA
          ? BACKEND_MODE_BETA
          : BACKEND_MODE_SERVER;
    if (typeof CONSTANTS.buildBackendUrl === "function") {
      const byMode = normalizeEndpoint(CONSTANTS.buildBackendUrl(DEFAULT_EXISTING_PATH, endpointMode));
      if (byMode) {
        return byMode;
      }
    }
    const baseUrl =
      endpointMode === BACKEND_MODE_LOCAL
        ? CONSTANTS.DEFAULT_BACKEND_BASE_URLS?.local
        : CONSTANTS.DEFAULT_BACKEND_BASE_URLS?.server;
    return trimSlash(baseUrl) + DEFAULT_EXISTING_PATH;
  }

  function sanitizeBatchId(value) {
    let decoded = "";
    try {
      decoded = decodeURIComponent(String(value || ""));
    } catch (error) {
      decoded = String(value || "");
    }
    return cleanText(decoded);
  }

  function createScheduleUploadDelayMs() {
    const maxSteps = Math.floor(SCHEDULE_UPLOAD_DELAY_MAX_MS / SCHEDULE_UPLOAD_DELAY_STEP_MS);
    const step = Math.floor(Math.random() * (maxSteps + 1));
    return step * SCHEDULE_UPLOAD_DELAY_STEP_MS;
  }

  function isForceReplaceReason(reason) {
    const text = String(reason || "").toLowerCase();
    return text === "home-manual-force-replace" || text === "manual-force-replace";
  }

  function isManualReason(reason) {
    const text = String(reason || "").toLowerCase();
    return (
      text === "manual" ||
      text === "home-manual" ||
      text === "detail-manual" ||
      isForceReplaceReason(text)
    );
  }

  function getDurationValueForCheck(payload) {
    const value = payload?.csvPatch?.["有效时长(秒)_S"] ?? payload?.csvPatch?.["有效时长(秒)"] ?? payload?.csvPatch?.["有效时长"];
    return value === 0 || value === "0" ? "0" : cleanText(value);
  }

  function pushIfBlank(list, value, field) {
    if (!cleanText(value)) {
      list.push(field);
    }
  }

  function validateTranscriptionPayload(payload) {
    const warningFields = [];
    const csvPatch = payload?.csvPatch || {};
    const roleRecord = payload?.roleRecord || {};
    const role = String(roleRecord.role || "").toLowerCase();
    const batchId = sanitizeBatchId(
      payload?.mergeKey?.batchId || roleRecord?.batchId || csvPatch?.["分包ID"] || ""
    );
    const completedField = role === "audit" ? "审核是否完成" : "标注是否完成";
    const submitField = role === "audit" ? "审核提交时间" : "标注提交时间";

    pushIfBlank(warningFields, csvPatch["任务名称"], "任务名称");
    pushIfBlank(warningFields, csvPatch["任务ID"], "任务ID");
    pushIfBlank(warningFields, csvPatch["题数"], "题数");
    pushIfBlank(warningFields, roleRecord.subTaskId, role === "audit" ? "审核子任务ID" : "标注子任务ID");
    pushIfBlank(
      warningFields,
      roleRecord.userName || roleRecord.userId || "",
      role === "audit" ? "审核员_P" : "标注员_P"
    );
    pushIfBlank(
      warningFields,
      roleRecord.receiveTime || "",
      role === "audit" ? "审核领取时间" : "标注领取时间"
    );
    pushIfBlank(warningFields, csvPatch[completedField], completedField);
    if (cleanText(csvPatch[completedField]) === "已完成") {
      pushIfBlank(warningFields, roleRecord.submitTime || "", submitField);
      if (!getDurationValueForCheck(payload)) {
        warningFields.push("有效时长(秒)_S");
      }
    }
    return {
      ok: Boolean(batchId),
      rejectedReason: batchId ? "" : "分包ID",
      warningFields: warningFields,
    };
  }

  function resolveScheduleEndpoint(config) {
    const uploadEndpoint = resolveUploadEndpoint(config);
    if (!uploadEndpoint) {
      return "";
    }
    try {
      const url = new URL(uploadEndpoint);
      url.searchParams.set("purpose", "schedule");
      return url.toString();
    } catch (error) {
      return "";
    }
  }

  function normalizeTimeList(value) {
    const source = Array.isArray(value)
      ? value
      : typeof value === "string"
        ? value.split(/[,，\n]/)
        : DEFAULT_UPLOAD_TIMES;
    const result = [];

    source.forEach(function (item) {
      const text = String(item || "").trim();
      const match = text.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
      if (!match) {
        return;
      }
      const normalized = String(Number(match[1])).padStart(2, "0") + ":" + match[2];
      if (result.indexOf(normalized) < 0) {
        result.push(normalized);
      }
    });

    return result.length > 0 ? result : DEFAULT_UPLOAD_TIMES.slice();
  }

  function parseScheduleResponse(body, fallbackConfig) {
    const data = body && typeof body === "object" ? body.data || body : {};
    const times = normalizeTimeList(
      data.times || data.uploadTimes || data.scheduleTimes || fallbackConfig.statsUploadTimes
    );
    const jitterMinutes = Number(data.jitterMinutes || data.randomDelayMinutes);

    return {
      enabled: data.enabled !== false,
      times: times,
      jitterMinutes: Number.isFinite(jitterMinutes)
        ? Math.max(0, Math.min(120, jitterMinutes))
        : Math.max(
            0,
            Math.min(
              120,
              Number(fallbackConfig.statsUploadJitterMinutes) || DEFAULT_UPLOAD_JITTER_MINUTES
            )
          ),
      source: body && typeof body === "object" ? "remote" : "local",
      fetchedAt: new Date().toISOString(),
    };
  }

  function buildSubtaskDataUrl(subTaskId, pageSize, page) {
    const url = new URL(
      "/api/v1/label/center/subTask/" + encodeURIComponent(subTaskId) + "/data",
      location.origin
    );
    url.searchParams.set("page", String(page || 1));
    url.searchParams.set("pageSize", String(pageSize || DETAIL_PAGE_SIZE));
    url.searchParams.set("filterPassedVote", "false");
    url.searchParams.set(
      "filter",
      JSON.stringify({
        questions: [],
        dataStatus: "ALL",
        questionsQueryConditions: "AND",
      })
    );
    url.searchParams.set("_", String(Date.now()));
    return url;
  }

  function getHomeTaskKind(pathname) {
    const routeText = String(pathname || location.pathname || "").toLowerCase();
    return (
      HOME_TASK_KINDS.find(function (kind) {
        return routeText.indexOf(kind.route) >= 0;
      }) || null
    );
  }

  function getHomeTaskKindsToFetch() {
    return HOME_TASK_KINDS.slice();
  }

  function buildHomeTasksUrl(projectId, page, pageSize, kind) {
    const url = new URL("/api/v1/label/center/tasks", location.origin);
    url.searchParams.set("subTaskType", String(kind?.taskType || "label"));
    url.searchParams.set("keyword", "");
    url.searchParams.set("appId", String(projectId || ""));
    url.searchParams.set("page", String(page || 1));
    url.searchParams.set("pageSize", String(pageSize || LIST_PAGE_SIZE));
    url.searchParams.set("_", String(Date.now()));
    return url;
  }

  function buildHomeSubTasksUrl(projectId, finished, page, pageSize, kind) {
    const url = new URL("/api/v1/label/center/subTasks", location.origin);
    url.searchParams.set("type", String(kind?.listType || "label"));
    url.searchParams.set("keyword", "");
    url.searchParams.set("appId", String(projectId || ""));
    url.searchParams.set("finished", finished ? "true" : "false");
    url.searchParams.set("page", String(page || 1));
    url.searchParams.set("pageSize", String(pageSize || LIST_PAGE_SIZE));
    url.searchParams.set("_", String(Date.now()));
    return url;
  }

  function normalizeConcurrency(value, fallbackValue) {
    const fallback = Math.max(1, Number(fallbackValue) || DEFAULT_EXPORT_CONCURRENCY);
    const parsed = Math.floor(Number(value));
    if (!Number.isFinite(parsed) || parsed < 1) {
      return Math.min(fallback, MAX_EXPORT_CONCURRENCY);
    }
    return Math.max(1, Math.min(parsed, MAX_EXPORT_CONCURRENCY));
  }

  function resolveConcurrency(itemCount, preferred) {
    const total = Math.max(1, Math.floor(Number(itemCount) || 1));
    const normalizedPreferred = normalizeConcurrency(preferred, DEFAULT_EXPORT_CONCURRENCY);
    return Math.max(1, Math.min(total, normalizedPreferred, MAX_EXPORT_CONCURRENCY));
  }

  function resolveDynamicConcurrency(total) {
    const parsedTotal = Math.floor(Number(total));
    if (!Number.isFinite(parsedTotal) || parsedTotal < 1) {
      return 1;
    }
    const computed = Math.floor(parsedTotal / 5);
    if (!Number.isFinite(computed)) {
      return 1;
    }
    return Math.max(1, Math.min(computed, MAX_EXPORT_CONCURRENCY));
  }

  async function runConcurrent(items, maxConcurrent, handler) {
    const list = Array.isArray(items) ? items : [];
    if (list.length === 0) {
      return [];
    }

    const results = new Array(list.length);
    const workerCount = resolveConcurrency(list.length, maxConcurrent);
    let cursor = 0;
    const workers = new Array(workerCount).fill(null).map(async function () {
      while (cursor < list.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await handler(list[index], index);
      }
    });
    await Promise.all(workers);
    return results;
  }

  async function fetchJson(url, init) {
    const response = await fetch(url.toString(), init || {});
    if (!response.ok) {
      throw new Error("请求失败：" + String(response.status));
    }

    const body = await response.json();
    if (body?.success === false || (body?.code !== undefined && body.code !== 0)) {
      throw new Error(body?.message || "业务响应失败。");
    }
    return body;
  }

  function chunkItems(items, chunkSize) {
    const result = [];
    const size = Math.max(1, Number(chunkSize) || 1);
    for (let index = 0; index < items.length; index += size) {
      result.push(items.slice(index, index + size));
    }
    return result;
  }

  async function fetchExistingStatuses(config, items, progressReporter) {
    const endpoint = resolveExistingEndpoint(config);
    if (!endpoint || !Array.isArray(items) || items.length === 0) {
      return {
        ok: true,
        byKey: {},
        message: "",
      };
    }
    const chunks = chunkItems(items, EXISTING_CHECK_CHUNK_SIZE);
    const byKey = {};
    let completed = 0;
    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index];
      const body = await fetchJson(endpoint, {
        method: "POST",
        cache: "no-store",
        credentials: "omit",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/plain, */*",
        },
        body: JSON.stringify({ items: chunk }),
      });
      const responseItems = Array.isArray(body?.data?.items) ? body.data.items : [];
      responseItems.forEach(function (entry, entryIndex) {
        const requestItem = chunk[entryIndex] || {};
        const key = [
          sanitizeBatchId(entry?.batchId || requestItem.batchId || ""),
          String(entry?.role || requestItem.role || "label").toLowerCase(),
          sanitizeSubTaskId(entry?.subTaskId || requestItem.subTaskId || ""),
        ].join("|");
        byKey[key] = entry;
      });
      completed += chunk.length;
      if (progressReporter && typeof progressReporter.update === "function") {
        progressReporter.update({
          phase: "检查已有数据",
          total: items.length,
          completed: completed,
          concurrency: 1,
          success: completed,
          failed: 0,
        });
      }
    }
    return {
      ok: true,
      byKey: byKey,
      message: "",
    };
  }

  function extractHistoryUserNameFromDataResultHistory(historyMap) {
    if (!historyMap || typeof historyMap !== "object") {
      return "";
    }
    const firstKey = Object.keys(historyMap)[0];
    if (!firstKey) {
      return "";
    }
    const historyList = historyMap[firstKey];
    if (!Array.isArray(historyList) || historyList.length === 0) {
      return "";
    }
    const initial =
      historyList.find(function (item) {
        return Number(item?.type) === 0;
      }) || historyList[historyList.length - 1];
    return pickHealthyText(initial?.userName || "");
  }

  async function fetchSubtaskDataPage(cleanSubTaskId, page, pageSize) {
    const requestPage = Math.max(1, Number(page) || 1);
    const requestPageSize = Math.max(1, Number(pageSize) || DETAIL_PAGE_SIZE);
    try {
      const body = await fetchJson(buildSubtaskDataUrl(cleanSubTaskId, requestPageSize, requestPage), {
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json, text/plain, */*",
        },
      });
      const data = body?.data && typeof body.data === "object" ? body.data : {};
      const list = Array.isArray(data.dataList)
        ? data.dataList
        : Array.isArray(data.data)
          ? data.data
          : Array.isArray(data.list)
            ? data.list
            : [];
      const rawRecordCount = data.recordCount ?? data.size ?? data.total;
      const parsedRecordCount = Number(rawRecordCount);
      const historyUserName = extractHistoryUserNameFromDataResultHistory(data.dataResultHistory);
      return {
        list: list,
        recordCount:
          Number.isFinite(parsedRecordCount) && parsedRecordCount >= 0
            ? parsedRecordCount
            : null,
        metadata: {
          id: sanitizeSubTaskId(data.id || cleanSubTaskId),
          taskId: String(data.taskId || ""),
          batchId: String(data.batchId || ""),
          status: data.status,
          gmtCreate: data.gmtCreate || data.receiveTime || "",
          gmtCommit: data.gmtCommit || data.submitTime || "",
          taskName: pickHealthyText([data.taskName, data.name]),
          size: Number(data.size),
          historyUserName: historyUserName,
        },
      };
    } catch (error) {
      const message = error && error.message ? error.message : String(error);
      throw new Error(
        "子任务详情请求失败（subTaskId=" +
          cleanSubTaskId +
          ", page=" +
          String(requestPage) +
          "）：" +
          message
      );
    }
  }

  async function fetchSubtaskDataPages(subTaskId) {
    const cleanSubTaskId = sanitizeSubTaskId(subTaskId);
    if (!cleanSubTaskId) {
      console.warn(LOG_PREFIX, "Skip subtask data fetch: empty sanitized subTaskId.");
      return {
        subTaskId: "",
        metadata: {},
        dataList: [],
        recordCount: 0,
        fetchedItemCount: 0,
        rawPageData: [],
      };
    }

    const firstPageResult = await fetchSubtaskDataPage(cleanSubTaskId, 1, DETAIL_PAGE_SIZE);
    const metadata = firstPageResult.metadata || {};
    const recordCount =
      Number.isFinite(firstPageResult.recordCount) && firstPageResult.recordCount >= 0
        ? firstPageResult.recordCount
        : firstPageResult.list.length;
    const computedTotalPages =
      recordCount > 0 ? Math.ceil(recordCount / DETAIL_PAGE_SIZE) : firstPageResult.list.length > 0 ? 1 : 0;
    const totalPages = Math.max(0, computedTotalPages);
    const boundedTotalPages = Math.min(totalPages, MAX_DETAIL_PAGES);
    const overflow = totalPages > MAX_DETAIL_PAGES;

    const pageResults = [{ page: 1, pageResult: firstPageResult }];
    if (boundedTotalPages > 1) {
      const pages = [];
      for (let page = 2; page <= boundedTotalPages; page += 1) {
        pages.push(page);
      }
      const pageConcurrency = resolveConcurrency(pages.length, DEFAULT_EXPORT_CONCURRENCY);
      const restResults = await runConcurrent(pages, pageConcurrency, async function (page) {
        return {
          page: page,
          pageResult: await fetchSubtaskDataPage(cleanSubTaskId, page, DETAIL_PAGE_SIZE),
        };
      });
      pageResults.push.apply(pageResults, restResults);
    }

    pageResults.sort(function (left, right) {
      return left.page - right.page;
    });

    const rawPageData = [];
    const allItems = [];
    const itemSeen = new Set();
    pageResults.forEach(function (entry) {
      const list = Array.isArray(entry.pageResult?.list) ? entry.pageResult.list : [];
      rawPageData.push({
        page: entry.page,
        itemCount: list.length,
        recordCount: entry.pageResult?.recordCount,
      });

      list.forEach(function (item, index) {
        const keyCandidate = String(item?.dataId || item?.id || "").trim();
        const key =
          keyCandidate ||
          "page" + String(entry.page) + "-index" + String(index) + "-" + JSON.stringify(item || {});
        if (itemSeen.has(key)) {
          return;
        }
        itemSeen.add(key);
        allItems.push(item);
      });
    });

    if (overflow) {
      console.warn(
        LOG_PREFIX,
        "subtask detail pages exceed max limit, truncated to " +
          String(MAX_DETAIL_PAGES) +
          " pages:",
        {
          subTaskId: cleanSubTaskId,
          totalPages: totalPages,
          maxPages: MAX_DETAIL_PAGES,
        }
      );
    }

    return {
      subTaskId: cleanSubTaskId,
      metadata: metadata,
      dataList: allItems,
      recordCount: Number.isFinite(recordCount) && recordCount >= 0 ? recordCount : allItems.length,
      fetchedItemCount: allItems.length,
      totalPages: totalPages,
      fetchedPages: boundedTotalPages > 0 ? boundedTotalPages : pageResults.length,
      pageOverflow: overflow,
      rawPageData: rawPageData,
    };
  }

  async function fetchSubtaskDetail(summary) {
    const safeSummary = summary && typeof summary === "object" ? summary : {};
    const cleanSubTaskId = sanitizeSubTaskId(getSummarySubTaskId(safeSummary));
    if (!cleanSubTaskId) {
      console.warn(LOG_PREFIX, "Skip subtask detail: invalid subTaskId in summary.");
      return Object.assign({}, safeSummary, {
        id: "",
        dataList: [],
        recordCount: 0,
        fetchedItemCount: 0,
      });
    }

    const pageResult = await fetchSubtaskDataPages(cleanSubTaskId);
    return Object.assign({}, safeSummary, pageResult.metadata || {}, {
      id: cleanSubTaskId,
      dataList: pageResult.dataList,
      recordCount: pageResult.recordCount,
      fetchedItemCount: pageResult.fetchedItemCount,
      totalPages: pageResult.totalPages,
      fetchedPages: pageResult.fetchedPages,
      pageOverflow: pageResult.pageOverflow,
      rawPageData: pageResult.rawPageData,
    });
  }

  function normalizeListPage(body) {
    const data = body?.data && typeof body.data === "object" ? body.data : {};
    const list = Array.isArray(data.data) ? data.data : Array.isArray(data.list) ? data.list : [];
    const rawRecordCount = data.recordCount ?? data.total;
    const parsedRecordCount = Number(rawRecordCount);
    return {
      list: list,
      recordCount:
        Number.isFinite(parsedRecordCount) && parsedRecordCount >= 0
          ? parsedRecordCount
          : null,
    };
  }

  async function fetchPagedList(buildUrl, pageSize, maxPages, preferredConcurrency) {
    const normalizedPageSize = Math.max(1, Number(pageSize) || LIST_PAGE_SIZE);
    const normalizedMaxPages = Math.max(1, Number(maxPages) || MAX_LIST_PAGES);

    const firstBody = await fetchJson(buildUrl(1, normalizedPageSize), {
      credentials: "include",
      cache: "no-store",
      headers: {
        Accept: "application/json, text/plain, */*",
      },
    });
    const firstPage = normalizeListPage(firstBody);
    const recordCount =
      Number.isFinite(firstPage.recordCount) && firstPage.recordCount >= 0
        ? firstPage.recordCount
        : firstPage.list.length;
    const computedTotalPages =
      recordCount > 0
        ? Math.ceil(recordCount / normalizedPageSize)
        : firstPage.list.length > 0
          ? 1
          : 0;
    const totalPages = Math.max(0, computedTotalPages);
    const boundedTotalPages = Math.min(totalPages, normalizedMaxPages);
    const overflow = totalPages > normalizedMaxPages;

    const pageResults = [{ page: 1, normalized: firstPage }];
    if (boundedTotalPages > 1) {
      const pages = [];
      for (let page = 2; page <= boundedTotalPages; page += 1) {
        pages.push(page);
      }
      const pageConcurrency = resolveConcurrency(
        pages.length,
        normalizeConcurrency(preferredConcurrency, DEFAULT_EXPORT_CONCURRENCY)
      );
      const rest = await runConcurrent(pages, pageConcurrency, async function (page) {
        const body = await fetchJson(buildUrl(page, normalizedPageSize), {
          credentials: "include",
          cache: "no-store",
          headers: {
            Accept: "application/json, text/plain, */*",
          },
        });
        return { page: page, normalized: normalizeListPage(body) };
      });
      pageResults.push.apply(pageResults, rest);
    }

    pageResults.sort(function (left, right) {
      return left.page - right.page;
    });

    const list = [];
    const seenIds = new Set();
    pageResults.forEach(function (entry) {
      const pageList = Array.isArray(entry.normalized?.list) ? entry.normalized.list : [];
      pageList.forEach(function (item, index) {
        const keyCandidate = sanitizeSubTaskId(item?.id || item?.subTaskId || item?.subtaskId || "");
        const fallbackKey = "p" + String(entry.page) + "_i" + String(index) + "_" + String(item?.taskId || "");
        const key = keyCandidate || fallbackKey;
        if (seenIds.has(key)) {
          return;
        }
        seenIds.add(key);
        list.push(item);
      });
    });

    if (overflow) {
      console.warn(LOG_PREFIX, "list pages exceed max limit and were truncated", {
        totalPages: totalPages,
        maxPages: normalizedMaxPages,
      });
    }

    return {
      list: list,
      recordCount: recordCount,
      totalPages: totalPages,
      fetchedPages: boundedTotalPages > 0 ? boundedTotalPages : pageResults.length,
      pageOverflow: overflow,
    };
  }

  async function fetchHomeTasks(projectId, kind) {
    return fetchPagedList(
      function (page, pageSize) {
        return buildHomeTasksUrl(projectId, page, pageSize, kind);
      },
      LIST_PAGE_SIZE,
      MAX_LIST_PAGES,
      DEFAULT_EXPORT_CONCURRENCY
    );
  }

  async function fetchHomeSubTasks(projectId, finished, kind) {
    return fetchPagedList(
      function (page, pageSize) {
        return buildHomeSubTasksUrl(projectId, finished, page, pageSize, kind);
      },
      LIST_PAGE_SIZE,
      MAX_LIST_PAGES,
      DEFAULT_EXPORT_CONCURRENCY
    );
  }

  function roundDurationSeconds(totalSeconds) {
    const seconds = Math.max(0, Number(totalSeconds) || 0);
    return Math.round((seconds + Number.EPSILON) * 10000) / 10000;
  }

  function formatDurationForCsv(totalSeconds) {
    const text = roundDurationSeconds(totalSeconds).toFixed(4);
    return text.replace(/\.?0+$/, "");
  }

  function getItemDurationSeconds(item) {
    const candidates = [
      item?.data?.duration,
      item?.duration,
      item?.audioDuration,
      item?.data?.audioDuration,
      item?.data?.audio?.duration,
    ];

    for (let index = 0; index < candidates.length; index += 1) {
      const duration = Number(candidates[index]);
      if (Number.isFinite(duration) && duration >= 0) {
        return duration;
      }
    }
    return 0;
  }

  function getItemMarkResultList(item) {
    const resultMark = item?.result?.markResult;
    if (!Array.isArray(resultMark)) {
      return [];
    }
    return resultMark;
  }

  function getItemValidLabel(item) {
    const markResultList = getItemMarkResultList(item);
    const validRecord = markResultList.find(function (entry) {
      return String(entry?.title || "").trim() === "是否有效";
    });
    if (!validRecord) {
      return "";
    }
    const value = validRecord?.value;
    if (Array.isArray(value)) {
      return String(value[0] || "").trim();
    }
    return String(value || "").trim();
  }

  function sumDurationSeconds(dataList) {
    const total = (Array.isArray(dataList) ? dataList : []).reduce(function (sum, item) {
      const validLabel = getItemValidLabel(item);
      if (validLabel !== "有效") {
        return sum;
      }
      return sum + getItemDurationSeconds(item);
    }, 0);
    return roundDurationSeconds(total);
  }

  function getFirstRecordValue(records, keys) {
    const recordList = Array.isArray(records) ? records : [records];
    for (let recordIndex = 0; recordIndex < recordList.length; recordIndex += 1) {
      const record = recordList[recordIndex];
      if (!record || typeof record !== "object") {
        continue;
      }

      for (let keyIndex = 0; keyIndex < keys.length; keyIndex += 1) {
        const value = record[keys[keyIndex]];
        if (value !== undefined && value !== null && String(value).trim() !== "") {
          return value;
        }
      }
    }

    return "";
  }

  function normalizeTaskName(value) {
    return String(value || "").replace(/\s+/g, "").toLowerCase();
  }

  function getTaskSizeFromRecords(records) {
    const size = Number(getFirstRecordValue(records, ["size", "total", "itemCount"]));
    return Number.isFinite(size) ? size : null;
  }

  function hasJudgementTaskName(name) {
    const normalized = normalizeTaskName(name);
    return (
      normalized.indexOf("asr更优结果判断") >= 0 ||
      normalized.indexOf("asr更优") >= 0 ||
      normalized.indexOf("更优结果判断") >= 0 ||
      normalized.indexOf("更优判断") >= 0
    );
  }

  function hasTranscriptionTaskName(name) {
    const normalized = normalizeTaskName(name);
    return (
      normalized.indexOf("中文普通话asr任务") >= 0 ||
      normalized.indexOf("中文普通话asr") >= 0 ||
      normalized.indexOf("asr任务") >= 0 ||
      normalized.indexOf("普通话asr") >= 0
    );
  }

  function resolveSupplierInfoForStats(subtaskData, payloadContext, draftPatch) {
    const basePatch = draftPatch && typeof draftPatch === "object" ? draftPatch : {};
    const context = payloadContext && typeof payloadContext === "object" ? payloadContext : {};
    const taskName = pickHealthyText([
      subtaskData?.taskName,
      subtaskData?.name,
      basePatch["任务名称"],
    ]);
    if (typeof SUPPLIER_HELPER.resolveSupplierInfo === "function") {
      return SUPPLIER_HELPER.resolveSupplierInfo({
        payload: {
          supplier: context.supplier,
          vendor: context.vendor,
        },
        supplier: context.supplier,
        vendor: context.vendor,
        csvPatch: basePatch,
        taskName: taskName,
        name: taskName,
      });
    }
    return {
      key: String(taskName || "").trim() ? "task-name" : "unknown-supplier",
      name: UNKNOWN_SUPPLIER_NAME,
      safeName: UNKNOWN_SUPPLIER_NAME,
      source: "fallback",
    };
  }

  function getTaskIdentityRecords(record, linkedTask) {
    return [record || {}, linkedTask || {}];
  }

  function isAsrTranscriptionTaskRecord(record, linkedTask) {
    const records = getTaskIdentityRecords(record, linkedTask);
    const labelModel = String(getFirstRecordValue(records, ["labelModel"]) || "").toLowerCase();
    const taskName = getFirstRecordValue(records, ["taskName", "name"]);
    const size = getTaskSizeFromRecords(records);
    const hasJudgementName = hasJudgementTaskName(taskName);
    const hasTranscriptionName = hasTranscriptionTaskName(taskName);
    const normalizedTaskName = normalizeTaskName(taskName);

    if (labelModel === JUDGEMENT_LABEL_MODEL) {
      return false;
    }
    if (hasJudgementName) {
      return false;
    }
    if (
      size === JUDGEMENT_TASK_SIZE &&
      (normalizedTaskName.indexOf("更优") >= 0 || normalizedTaskName.indexOf("判断") >= 0)
    ) {
      return false;
    }
    if (labelModel === TRANSCRIPTION_LABEL_MODEL) {
      return true;
    }
    if (hasTranscriptionName) {
      return true;
    }
    if (size === TRANSCRIPTION_TASK_SIZE && !hasJudgementName) {
      return true;
    }
    return false;
  }

  function isIgnoredUserText(text) {
    return (
      !text ||
      text === "填写问卷" ||
      text === "退出登录" ||
      text === "标注中心" ||
      text === "帮助文档" ||
      text === "智能标注" ||
      text.indexOf("总时长") >= 0 ||
      text.indexOf("上传统计") >= 0 ||
      text.indexOf("上传转写统计") >= 0
    );
  }

  function getCurrentUserText() {
    const candidates = Array.from(
      document.querySelectorAll(
        ".header-component-container .ant-v5-select-selection-item, .header-component-container [title], .header-component-container"
      )
    );

    for (let index = 0; index < candidates.length; index += 1) {
      const text = String(candidates[index].textContent || candidates[index].getAttribute("title") || "")
        .replace(/\s+/g, " ")
        .trim();
      if (!isIgnoredUserText(text) && text.length <= 40) {
        return text;
      }
    }

    return "";
  }

  function delay(ms) {
    return new Promise(function (resolve) {
      window.setTimeout(resolve, ms);
    });
  }

  function getVisibleText(node) {
    return String(node?.textContent || "").replace(/\s+/g, " ").trim();
  }

  function dispatchMouseEvent(element, type) {
    if (!element) {
      return;
    }

    element.dispatchEvent(
      new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        view: window,
      })
    );
  }

  function findAvatarTrigger() {
    return (
      document.querySelector(
        ".ant-v5-dropdown-trigger[class*='NavAvatar-module__userInfoWrapper'], .ant-v5-dropdown-trigger.avatar, [class*='NavAvatar-module__userInfoWrapper'], .header-component-container .ant-v5-avatar"
      ) || null
    );
  }

  function readVisibleAvatarDropdownUserText() {
    const menuItems = Array.from(
      document.querySelectorAll(
        ".ant-v5-dropdown:not(.ant-v5-dropdown-hidden) .ant-v5-dropdown-menu-item, .ant-v5-dropdown-menu:not(.ant-v5-dropdown-menu-hidden) .ant-v5-dropdown-menu-item"
      )
    );

    const userItem =
      menuItems.find(function (item) {
        return String(item.className || "").indexOf("NavAvatar-module__userAvatar") >= 0;
      }) || menuItems[0] || null;
    const candidates = userItem
      ? Array.from(
          userItem.querySelectorAll(
            ".ant-v5-dropdown-menu-title-content, [class*='title-content'], span, div"
          )
        )
      : [];
    if (userItem) {
      candidates.unshift(userItem);
    }

    for (let index = 0; index < candidates.length; index += 1) {
      const text = getVisibleText(candidates[index]);
      if (!isIgnoredUserText(text) && text.length <= 50) {
        return text;
      }
    }

    return "";
  }

  async function resolveCurrentUserText() {
    const avatar = findAvatarTrigger();
    if (avatar) {
      dispatchMouseEvent(avatar, "mouseenter");
      dispatchMouseEvent(avatar, "mouseover");
      dispatchMouseEvent(avatar, "mousemove");
      await delay(180);
      const dropdownText = readVisibleAvatarDropdownUserText();
      dispatchMouseEvent(avatar, "mouseleave");
      if (dropdownText) {
        return dropdownText;
      }
    }

    return getCurrentUserText();
  }

  function inferRole(subtaskData, overrideRole) {
    if (overrideRole === "audit" || overrideRole === "label") {
      return overrideRole;
    }

    const currentKind = getHomeTaskKind();
    if (currentKind?.role) {
      return currentKind.role;
    }

    const missionType = String(getUrlParams().missionType || "").toLowerCase();
    if (missionType === "check" || missionType === "audit" || missionType === "review") {
      return "audit";
    }

    const type = String(subtaskData?.type || "").toUpperCase();
    const sourceType = String(subtaskData?.sourceType || "").toUpperCase();
    if (
      type.indexOf("CHECK") >= 0 ||
      type.indexOf("REVIEW") >= 0 ||
      type.indexOf("AUDIT") >= 0 ||
      sourceType.indexOf("CHECK") >= 0
    ) {
      return "audit";
    }

    return "label";
  }

  function getCompletionText(subtaskData) {
    if (subtaskData?.gmtCommit || subtaskData?.commitTime || subtaskData?.submitTime) {
      return "已完成";
    }
    const status = Number(subtaskData?.status);
    if (Number.isFinite(status)) {
      return status > 0 ? "已完成" : "未完成";
    }
    return "未完成";
  }

  function formatDateTime(value) {
    if (value === undefined || value === null || value === "") {
      return "";
    }
    let date = null;
    if (typeof value === "number") {
      date = new Date(value);
    } else {
      const text = String(value).trim();
      const numeric = Number(text);
      if (Number.isFinite(numeric) && text.length >= 10) {
        date = new Date(numeric);
      } else {
        const normalized = text.replace(/-/g, "/");
        const parsed = new Date(normalized);
        if (!Number.isNaN(parsed.getTime())) {
          date = parsed;
        } else {
          return text;
        }
      }
    }

    if (!date || Number.isNaN(date.getTime())) {
      return "";
    }

    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hour = date.getHours();
    const minute = String(date.getMinutes()).padStart(2, "0");
    return (
      String(year) +
      "/" +
      String(month) +
      "/" +
      String(day) +
      " " +
      String(hour) +
      ":" +
      minute
    );
  }

  function buildCsvBasePatch(subtaskData, durationSeconds, supplierInfo) {
    const resolvedSupplier =
      supplierInfo && typeof supplierInfo === "object" ? supplierInfo : {};
    const safeTaskName = pickHealthyText([subtaskData?.taskName, subtaskData?.name]);
    const safeSupplierName = pickHealthyText([resolvedSupplier.name, UNKNOWN_SUPPLIER_NAME]);
    return {
      任务名称: safeTaskName,
      供应商: safeSupplierName || UNKNOWN_SUPPLIER_NAME,
      任务ID: cleanText(subtaskData?.taskId || ""),
      分包ID: cleanText(subtaskData?.batchId || ""),
      题数: String(
        subtaskData?.size ||
          subtaskData?.recordCount ||
          (Array.isArray(subtaskData?.dataList) ? subtaskData.dataList.length : "") ||
          ""
      ),
      "有效时长(秒)_S": formatDurationForCsv(durationSeconds),
    };
  }

  function getUserNameFromRecord(record) {
    return pickHealthyText([
      record?.userName,
      record?.operatorName,
      record?.operator,
      record?.nickName,
      record?.displayName,
    ]);
  }

  function buildPayload(subtaskData, durationSeconds, reason, context) {
    const payloadContext = context && typeof context === "object" ? context : {};
    const urlParams = getUrlParams();
    const dataList = Array.isArray(subtaskData?.dataList) ? subtaskData.dataList : [];
    const firstItem = dataList[0] || {};
    const normalizedDurationSeconds = roundDurationSeconds(durationSeconds);
    const role = inferRole(subtaskData, payloadContext.role);
    const batchId = cleanText(subtaskData?.batchId || "");
    const subTaskId = sanitizeSubTaskId(subtaskData?.id || urlParams.subTaskId || "");
    const userName = pickHealthyText([
      payloadContext.userName,
      subtaskData?.historyUserName,
      getUserNameFromRecord(subtaskData),
      getUserNameFromRecord(firstItem),
    ]);
    const completed = getCompletionText(subtaskData);
    const draftPatch = buildCsvBasePatch(subtaskData, normalizedDurationSeconds);
    const supplierInfo = resolveSupplierInfoForStats(subtaskData, payloadContext, draftPatch);
    const csvPatch = buildCsvBasePatch(subtaskData, normalizedDurationSeconds, supplierInfo);
    const supplierName = pickHealthyText([supplierInfo?.name, UNKNOWN_SUPPLIER_NAME]);
    const supplierKey = String(supplierInfo?.key || "unknown-supplier");
    const supplierSource = String(supplierInfo?.source || "fallback");

    return {
      schemaVersion: 1,
      source: "chromium-extension",
      project: "alibaba-labelx/asr-transcription",
      reason: reason || "manual",
      uploadedAt: new Date().toISOString(),
      mergeKey: {
        supplierKey: supplierKey,
        supplierName: supplierName,
        batchId: batchId,
      },
      url: {
        projectId: urlParams.projectId,
        subTaskId: urlParams.subTaskId,
        missionType: urlParams.missionType,
      },
      csvColumns: CSV_COLUMNS.slice(),
      csvPatch: csvPatch,
      supplier: {
        key: supplierKey,
        name: supplierName,
        source: supplierSource,
      },
      roleRecord: {
        role: role,
        subTaskId: subTaskId,
        taskId: cleanText(subtaskData?.taskId || ""),
        batchId: batchId,
        userId: cleanText(firstItem?.userId || ""),
        userName: userName,
        status: subtaskData?.status,
        receiveTime: formatDateTime(
          subtaskData?.gmtCreate || subtaskData?.receiveTime || subtaskData?.createTime
        ),
        submitTime: formatDateTime(
          subtaskData?.gmtCommit || subtaskData?.submitTime || subtaskData?.commitTime
        ),
        completed: completed,
      },
      metrics: {
        itemCount: Number(subtaskData?.size) || dataList.length,
        fetchedItemCount: dataList.length,
        durationSeconds: normalizedDurationSeconds,
        durationText: formatDurationForCsv(normalizedDurationSeconds),
        answeredCount: dataList.filter(function (item) {
          return item?.answer !== undefined && item?.answer !== null;
        }).length,
      },
      rawKeys: {
        taskName: pickHealthyText([subtaskData?.taskName, subtaskData?.name]),
        taskId: cleanText(subtaskData?.taskId || ""),
        batchId: batchId,
        subTaskId: subTaskId,
        supplierName: supplierName,
        supplierSource: supplierSource,
      },
      dedupeKey: [supplierKey, batchId, role, subTaskId].join(":"),
    };
  }

  function getSummarySubTaskId(summary) {
    return sanitizeSubTaskId(
      summary?.id || summary?.subTaskId || summary?.subtaskId || summary?.subtaskID || ""
    );
  }

  function resolveLinkedTask(taskMap, taskId) {
    const map = taskMap && typeof taskMap === "object" ? taskMap : {};
    const normalizedTaskId = cleanText(taskId || "");
    if (!normalizedTaskId) {
      return {};
    }
    return (
      map[normalizedTaskId] ||
      map[String(Number(normalizedTaskId))] ||
      map[String(parseInt(normalizedTaskId, 10))] ||
      {}
    );
  }

  function resolveSubtaskTaskName(detailData, summary, linkedTask) {
    return pickHealthyText([
      detailData?.taskName,
      detailData?.name,
      summary?.taskName,
      summary?.name,
      linkedTask?.taskName,
      linkedTask?.name,
    ]);
  }

  function enrichSubtaskData(detailData, summary, taskMap, kind) {
    const summaryTaskId = cleanText(summary?.taskId || detailData?.taskId || "");
    const linkedTask = resolveLinkedTask(taskMap, summaryTaskId);
    const detailDataList = Array.isArray(detailData?.dataList) ? detailData.dataList : [];
    const resolvedSize =
      Number(summary?.size) ||
      Number(detailData?.recordCount) ||
      Number(detailData?.size) ||
      Number(linkedTask?.size) ||
      detailDataList.length ||
      0;
    const resolvedTaskName = resolveSubtaskTaskName(detailData, summary, linkedTask);
    return Object.assign({}, detailData || {}, {
      id: sanitizeSubTaskId(detailData?.id || getSummarySubTaskId(summary)),
      taskId: cleanText(summaryTaskId || detailData?.taskId || linkedTask?.taskId || linkedTask?.id || ""),
      batchId: cleanText(summary?.batchId || detailData?.batchId || ""),
      gmtCreate: summary?.gmtCreate || detailData?.gmtCreate,
      gmtCommit: summary?.gmtCommit || detailData?.gmtCommit,
      taskName: resolvedTaskName,
      size: resolvedSize > 0 ? resolvedSize : "",
      recordCount: Number(detailData?.recordCount) || resolvedSize || detailDataList.length,
      labelModel: summary?.labelModel || detailData?.labelModel || linkedTask?.labelModel,
      sourceType: summary?.sourceType || kind?.key || "",
      status:
        summary?.status !== undefined && summary?.status !== null
          ? summary.status
          : detailData?.status,
    });
  }

  function createState() {
    return {
      started: false,
      uploading: false,
      lastUploadAt: null,
      lastUploadReason: "",
      lastUploadOk: null,
      lastMessage: "",
      nextScheduleAt: null,
      schedule: {
        enabled: true,
        times: DEFAULT_UPLOAD_TIMES.slice(),
        jitterMinutes: DEFAULT_UPLOAD_JITTER_MINUTES,
        source: "local",
      },
    };
  }

  function createRuntime(deps) {
    const options = deps && typeof deps === "object" ? deps : {};
    let state = createState();
    let scheduleTimer = null;
    let uploadButtonTimer = null;
    let uploadButtonRoot = null;
    let progressIndicator = null;
    let progressIndicatorTimer = null;
    let forceReplaceAction = {
      visible: false,
      busy: false,
      summary: null,
      timerId: null,
    };

    function getConfig() {
      return typeof options.getConfig === "function" ? options.getConfig() || {} : {};
    }

    function shouldApply() {
      return typeof options.shouldApply === "function" ? options.shouldApply() === true : false;
    }

    function notify() {
      if (typeof options.onStateChange === "function") {
        options.onStateChange(clone(state));
      }
    }

    function setMessage(ok, reason, message) {
      state.lastUploadOk = ok;
      state.lastUploadReason = reason || "";
      state.lastMessage = message || "";
      state.lastUploadAt = new Date().toISOString();
      notify();
    }

    function clearForceReplaceTimer() {
      if (forceReplaceAction.timerId) {
        window.clearTimeout(forceReplaceAction.timerId);
        forceReplaceAction.timerId = null;
      }
    }

    function getForceReplaceAction() {
      if (!forceReplaceAction.visible || !isHomePage()) {
        return null;
      }
      return forceReplaceAction;
    }

    function hideForceReplaceButton() {
      clearForceReplaceTimer();
      forceReplaceAction.visible = false;
      forceReplaceAction.busy = false;
      forceReplaceAction.summary = null;
      ensureUploadButton();
    }

    function showForceReplaceButton(summary) {
      clearForceReplaceTimer();
      forceReplaceAction.visible = true;
      forceReplaceAction.busy = false;
      forceReplaceAction.summary = summary && typeof summary === "object" ? clone(summary) : null;
      forceReplaceAction.timerId = window.setTimeout(function () {
        forceReplaceAction.visible = false;
        forceReplaceAction.busy = false;
        forceReplaceAction.summary = null;
        forceReplaceAction.timerId = null;
        ensureUploadButton();
      }, 60000);
      ensureUploadButton();
    }

    function setForceReplaceButtonBusy(busy) {
      if (!forceReplaceAction.visible && !busy) {
        return;
      }
      forceReplaceAction.visible = true;
      forceReplaceAction.busy = busy === true;
      ensureUploadButton();
    }

    function showToast(message, tone) {
      if (typeof options.showToast === "function") {
        options.showToast(message, tone || "info");
      }
    }

    function clearScheduleTimer() {
      if (scheduleTimer) {
        window.clearTimeout(scheduleTimer);
        scheduleTimer = null;
      }
    }

    function clearUploadButtonTimer() {
      if (uploadButtonTimer) {
        window.clearInterval(uploadButtonTimer);
        uploadButtonTimer = null;
      }
    }

    function clearProgressIndicatorTimer() {
      if (progressIndicatorTimer) {
        window.clearTimeout(progressIndicatorTimer);
        progressIndicatorTimer = null;
      }
    }

    function removeUploadButton() {
      if (uploadButtonRoot && uploadButtonRoot.parentNode) {
        uploadButtonRoot.parentNode.removeChild(uploadButtonRoot);
      }
      uploadButtonRoot = null;
    }

    function removeProgressIndicator() {
      clearProgressIndicatorTimer();
      if (progressIndicator && typeof progressIndicator.destroy === "function") {
        progressIndicator.destroy();
      }
      progressIndicator = null;
    }

    function setUploadButtonStatus(message, tone) {
      const button =
        uploadButtonRoot?.querySelector('button[data-role="upload-primary"]') ||
        uploadButtonRoot?.querySelector("button");
      if (!button) {
        return;
      }
      button.removeAttribute("title");
      button.style.borderColor =
        tone === "error" ? "#fecaca" : tone === "success" ? "#bbf7d0" : "#bfdbfe";
      button.style.background =
        tone === "error" ? "#fef2f2" : tone === "success" ? "#f0fdf4" : "#eff6ff";
      button.style.color =
        tone === "error" ? "#b91c1c" : tone === "success" ? "#047857" : "#0958d9";
    }

    function resolveTopNavUploadMountPoint() {
      const avatar = findAvatarTrigger();
      if (avatar && avatar.parentNode) {
        return {
          host: avatar.parentNode,
          before: avatar,
        };
      }
      const header = document.querySelector(".header-component-container");
      return header ? { host: header, before: null } : null;
    }

    function ensureProgressIndicator() {
      if (typeof PROGRESS_HELPER.createProgressIndicator !== "function") {
        return null;
      }
      const mountPoint = resolveTopNavUploadMountPoint();
      if (!mountPoint || !mountPoint.host) {
        return null;
      }
      if (progressIndicator) {
        return progressIndicator;
      }
      progressIndicator = PROGRESS_HELPER.createProgressIndicator({
        id: "asr-edge-transcription-stats-progress",
        title: "上传转写统计",
        mount: mountPoint.host,
      });
      return progressIndicator;
    }

    function updateUploadProgress(patch) {
      const indicator = ensureProgressIndicator();
      if (!indicator || typeof indicator.update !== "function") {
        return;
      }
      indicator.update(patch || {});
    }

    function completeUploadProgress(message) {
      const indicator = ensureProgressIndicator();
      if (!indicator || typeof indicator.complete !== "function") {
        return;
      }
      indicator.complete(message || "");
      clearProgressIndicatorTimer();
      progressIndicatorTimer = window.setTimeout(removeProgressIndicator, 20000);
    }

    function failUploadProgress(message) {
      const indicator = ensureProgressIndicator();
      if (!indicator || typeof indicator.fail !== "function") {
        return;
      }
      indicator.fail(message || "");
      clearProgressIndicatorTimer();
      progressIndicatorTimer = window.setTimeout(removeProgressIndicator, 25000);
    }

    function ensureUploadButton() {
      if (!state.started || !isStatsPage()) {
        removeUploadButton();
        return;
      }

      const mountPoint = resolveTopNavUploadMountPoint();
      if (!mountPoint || !mountPoint.host) {
        return;
      }

      const forceAction = getForceReplaceAction();
      const forceVisibleFlag = forceAction ? "1" : "0";
      const forceBusyFlag = forceAction && forceAction.busy ? "1" : "0";
      if (
        uploadButtonRoot &&
        uploadButtonRoot.isConnected &&
        uploadButtonRoot.parentNode === mountPoint.host &&
        uploadButtonRoot.dataset.forceVisible === forceVisibleFlag &&
        uploadButtonRoot.dataset.forceBusy === forceBusyFlag &&
        uploadButtonRoot.dataset.uploading === String(state.uploading ? 1 : 0)
      ) {
        return;
      }

      removeUploadButton();
      uploadButtonRoot = document.createElement("span");
      uploadButtonRoot.id = "asr-edge-transcription-stats-upload-entry";
      uploadButtonRoot.dataset.forceVisible = forceVisibleFlag;
      uploadButtonRoot.dataset.forceBusy = forceBusyFlag;
      uploadButtonRoot.dataset.uploading = String(state.uploading ? 1 : 0);
      Object.assign(uploadButtonRoot.style, {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        flex: "0 0 auto",
        marginLeft: "8px",
        marginRight: "8px",
      });

      const button = document.createElement("button");
      button.type = "button";
      button.dataset.role = "upload-primary";
      button.textContent = state.uploading ? "上传中" : "上传转写统计";
      button.disabled = state.uploading;
      Object.assign(button.style, {
        border: "1px solid rgba(22, 119, 255, 0.42)",
        borderRadius: "6px",
        minHeight: "28px",
        padding: "0 12px",
        background: "#eff6ff",
        color: "#0958d9",
        fontSize: "12px",
        fontWeight: "700",
        lineHeight: "26px",
        cursor: state.uploading ? "not-allowed" : "pointer",
        whiteSpace: "nowrap",
        opacity: state.uploading ? "0.72" : "1",
      });
      button.addEventListener("click", function () {
        if (state.uploading) {
          return;
        }
        setUploadButtonStatus("正在上传转写统计数据...", "info");
        void uploadNow(isHomePage() ? "home-manual" : "detail-manual")
          .then(function (result) {
            if (result?.ok === true) {
              setUploadButtonStatus(
                "已上传 " + String(result.payload?.payloadCount || 0) + " 个子任务",
                "success"
              );
              return;
            }
            if (result?.skipped === true && result?.reason === "upload-in-progress") {
              setUploadButtonStatus(result?.message || "转写统计上传中，请勿重复点击。", "info");
              return;
            }
            setUploadButtonStatus(result?.message || "上传失败。", "error");
          })
          .catch(function (error) {
            setUploadButtonStatus(error && error.message ? error.message : String(error), "error");
          });
      });
      uploadButtonRoot.appendChild(button);

      if (forceAction) {
        const forceButton = document.createElement("button");
        forceButton.type = "button";
        forceButton.dataset.role = "upload-force-replace";
        forceButton.textContent = forceAction.busy ? "重新上传中" : "补传并覆盖当前人员";
        forceButton.title = "重新拉取本轮跳过的完整数据，并只覆盖当前人员或当前审核角色对应列。定时上传不会触发。";
        forceButton.disabled = state.uploading || forceAction.busy;
        Object.assign(forceButton.style, {
          border: "1px solid rgba(217, 119, 6, 0.42)",
          borderRadius: "6px",
          minHeight: "28px",
          padding: "0 12px",
          background: "#fff7ed",
          color: "#b45309",
          fontSize: "12px",
          fontWeight: "700",
          lineHeight: "26px",
          cursor: state.uploading || forceAction.busy ? "not-allowed" : "pointer",
          whiteSpace: "nowrap",
          opacity: state.uploading || forceAction.busy ? "0.72" : "1",
        });
        forceButton.addEventListener("click", function () {
          if (state.uploading || forceAction.busy) {
            return;
          }
          setForceReplaceButtonBusy(true);
          setUploadButtonStatus("正在取消跳过并重新上传...", "info");
          void uploadNow("home-manual-force-replace").catch(function (error) {
            setUploadButtonStatus(error && error.message ? error.message : String(error), "error");
          });
        });
        uploadButtonRoot.appendChild(forceButton);
      }

      if (mountPoint.before && mountPoint.before.parentNode === mountPoint.host) {
        mountPoint.host.insertBefore(uploadButtonRoot, mountPoint.before);
      } else {
        mountPoint.host.appendChild(uploadButtonRoot);
      }
    }

    function startUploadButton() {
      clearUploadButtonTimer();
      ensureUploadButton();
      uploadButtonTimer = window.setInterval(ensureUploadButton, 1500);
    }

    async function refreshSchedule() {
      const config = getConfig();
      const fallback = {
        times: normalizeTimeList(config.statsUploadTimes),
        jitterMinutes: Math.max(
          0,
          Math.min(120, Number(config.statsUploadJitterMinutes) || DEFAULT_UPLOAD_JITTER_MINUTES)
        ),
      };
      const scheduleUrl = normalizeEndpoint(resolveScheduleEndpoint(config));
      if (!scheduleUrl) {
        state.schedule = Object.assign({ enabled: true, source: "local" }, fallback);
        notify();
        return state.schedule;
      }

      const url = new URL(scheduleUrl);
      const params = getUrlParams();
      if (params.projectId) {
        url.searchParams.set("projectId", params.projectId);
      }
      if (params.subTaskId) {
        url.searchParams.set("subTaskId", params.subTaskId);
      }

      try {
        const body = await fetchJson(url, {
          cache: "no-store",
          credentials: "omit",
          headers: {
            Accept: "application/json",
          },
        });
        state.schedule = parseScheduleResponse(body, config);
      } catch (error) {
        state.schedule = Object.assign({ enabled: true, source: "local-fallback" }, fallback);
        console.warn(LOG_PREFIX, "Failed to fetch schedule config:", error);
      }

      notify();
      return state.schedule;
    }

    function getNextScheduleDelay(schedule) {
      const times = normalizeTimeList(schedule?.times || DEFAULT_UPLOAD_TIMES);
      const now = new Date();
      let bestTime = null;

      times.forEach(function (timeText) {
        const parts = timeText.split(":");
        const target = new Date(now.getTime());
        target.setHours(Number(parts[0]), Number(parts[1]), 0, 0);
        if (target.getTime() <= now.getTime()) {
          target.setDate(target.getDate() + 1);
        }

        if (!bestTime || target.getTime() < bestTime.getTime()) {
          bestTime = target;
        }
      });

      return {
        targetTime: bestTime,
        delayMs: Math.max(1000, bestTime.getTime() - now.getTime()),
      };
    }

    function scheduleNextUpload() {
      clearScheduleTimer();
      const config = getConfig();
      if (
        !state.started ||
        !shouldApply() ||
        state.schedule.enabled === false
      ) {
        state.nextScheduleAt = null;
        notify();
        return;
      }

      const next = getNextScheduleDelay(state.schedule);
      state.nextScheduleAt = next.targetTime.toISOString();
      notify();
      scheduleTimer = window.setTimeout(function () {
        scheduleTimer = null;
        void uploadNow("schedule").finally(function () {
          void refreshSchedule().finally(scheduleNextUpload);
        });
      }, next.delayMs);
    }

    async function collectPayload(reason, progressReporter) {
      if (isHomePage()) {
        return collectHomePayloads(reason, progressReporter);
      }
      return collectDetailPayload(reason, progressReporter);
    }

    async function collectHomePayloads(reason, progressReporter) {
      const projectId = getProjectIdFromUrl();
      if (!projectId) {
        throw new Error("当前页面 URL 中没有 projectId，无法上传全量统计。");
      }

      const userName = await resolveCurrentUserText();
      const kinds = getHomeTaskKindsToFetch();
      const kindPages = [];
      const errors = [];
      let skippedSubTaskCount = 0;
      let skippedDetailCount = 0;
      let skippedCompleteCount = 0;
      let incompleteFoundCount = 0;
      let discardedNoBatchCount = 0;
      let failedPayloadValidationCount = 0;
      let warningPayloadCount = 0;
      let existingCheckFailed = false;
      const listTotal = Math.max(1, kinds.length);
      let listCompleted = 0;
      let listSuccess = 0;
      let listFailed = 0;

      if (progressReporter && typeof progressReporter.update === "function") {
        progressReporter.update({
          phase: "拉取任务列表",
          total: listTotal,
          completed: 0,
          concurrency: 1,
          success: 0,
          failed: 0,
        });
      }

      for (let index = 0; index < kinds.length; index += 1) {
        const kind = kinds[index];
        try {
          const tasksPage = await fetchHomeTasks(projectId, kind);
          const taskMap = {};
          tasksPage.list.forEach(function (task) {
          const taskId = String(task?.taskId || "");
            const taskIdCandidates = [
              task?.taskId,
              task?.id,
              task?.taskID,
              task?.task_id,
              task?.taskIdStr,
            ];
            taskIdCandidates.forEach(function (candidate) {
              const normalizedTaskId = cleanText(candidate || "");
              if (!normalizedTaskId) {
                return;
              }
              taskMap[normalizedTaskId] = task;
            });
          });

          const unfinishedPage = await fetchHomeSubTasks(projectId, false, kind);
          const finishedPage = await fetchHomeSubTasks(projectId, true, kind);
          kindPages.push({
            kind: kind,
            tasksPage: tasksPage,
            taskMap: taskMap,
            unfinishedPage: unfinishedPage,
            finishedPage: finishedPage,
          });
          listCompleted += 1;
          listSuccess += 1;
          if (progressReporter && typeof progressReporter.update === "function") {
            progressReporter.update({
              phase: "拉取任务列表(" + String(kind.label || kind.key || "") + ")",
              total: listTotal,
              completed: listCompleted,
              concurrency: 1,
              success: listSuccess,
              failed: listFailed,
            });
          }
        } catch (error) {
          listCompleted += 1;
          listFailed += 1;
          if (progressReporter && typeof progressReporter.update === "function") {
            progressReporter.update({
              phase: "拉取任务列表(" + String(kind.label || kind.key || "") + ")",
              total: listTotal,
              completed: listCompleted,
              concurrency: 1,
              success: listSuccess,
              failed: listFailed,
            });
          }
          errors.push({
            kind: kind.key,
            message: error && error.message ? error.message : String(error),
          });
        }
      }

      const subtasks = [];
      const seenSubTaskIds = new Set();
      let scannedTranscriptionSubTaskCount = 0;
      let skippedDuplicateSubTaskCount = 0;
      let detailRequestCount = 0;
      let listPageOverflowCount = 0;
      let detailPageOverflowCount = 0;
      kindPages.forEach(function (pageGroup) {
        const subtaskMap = {};
        pageGroup.unfinishedPage.list.concat(pageGroup.finishedPage.list).forEach(function (subtask) {
          const id = sanitizeSubTaskId(getSummarySubTaskId(subtask));
          if (!id) {
            return;
          }
          const batchId = sanitizeBatchId(subtask?.batchId || "");
          if (!batchId) {
            discardedNoBatchCount += 1;
            errors.push({
              kind: pageGroup.kind.key,
              message: "subTaskId=" + id + " 缺少分包ID，已废弃。",
            });
            return;
          }

          const linkedTask = resolveLinkedTask(pageGroup.taskMap, subtask?.taskId || "");
          const normalizedSummary = Object.assign({}, subtask || {});
          const normalizedTaskName = resolveSubtaskTaskName({}, normalizedSummary, linkedTask);
          if (normalizedTaskName) {
            normalizedSummary.taskName = normalizedTaskName;
          }
          normalizedSummary.taskId = cleanText(
            normalizedSummary.taskId ||
              linkedTask?.taskId ||
              linkedTask?.id ||
              ""
          );
          normalizedSummary.size =
            Number(normalizedSummary.size) ||
            Number(linkedTask?.size) ||
            normalizedSummary.size;
          if (!isAsrTranscriptionTaskRecord(normalizedSummary, linkedTask)) {
            skippedSubTaskCount += 1;
            return;
          }
          scannedTranscriptionSubTaskCount += 1;
          if (seenSubTaskIds.has(id)) {
            skippedDuplicateSubTaskCount += 1;
            return;
          }

          seenSubTaskIds.add(id);
          subtaskMap[pageGroup.kind.key + ":" + id] = normalizedSummary;
        });
        Object.keys(subtaskMap).forEach(function (id) {
          const summary = subtaskMap[id];
          subtasks.push({
            summary: summary,
            batchId: sanitizeBatchId(summary?.batchId || ""),
            subTaskId: sanitizeSubTaskId(getSummarySubTaskId(summary)),
            pageGroup: pageGroup,
          });
        });

        if (pageGroup.tasksPage.pageOverflow) {
          listPageOverflowCount += 1;
        }
        if (pageGroup.unfinishedPage.pageOverflow) {
          listPageOverflowCount += 1;
        }
        if (pageGroup.finishedPage.pageOverflow) {
          listPageOverflowCount += 1;
        }
      });

      if (subtasks.length === 0) {
        throw new Error(
          "首页未读取到 ASR 转写子任务，已跳过 ASR 更优判断或其他项目数据。" +
            (errors.length
              ? " 失败：" +
                errors
                  .map(function (item) {
                    return item.kind + "=" + item.message;
                  })
                  .join("；")
              : "")
        );
      }

      const config = getConfig();
      const forceReplaceByBatchId = isForceReplaceReason(reason);
      const existingItems = subtasks.map(function (entry) {
        return {
          batchId: entry.batchId,
          role: entry.pageGroup?.kind?.role || "label",
          taskName: cleanText(entry.summary?.taskName || ""),
          subTaskId: entry.subTaskId,
        };
      });
      let existingStatusByKey = {};
      if (progressReporter && typeof progressReporter.update === "function") {
        progressReporter.update({
          phase: "检查已有数据",
          total: existingItems.length,
          completed: 0,
          concurrency: 1,
          success: 0,
          failed: 0,
        });
      }
      try {
        const existingResult = await fetchExistingStatuses(config, existingItems, progressReporter);
        existingStatusByKey = existingResult.byKey || {};
      } catch (error) {
        existingCheckFailed = true;
        errors.push({
          kind: "existing",
          message: "existing 检查失败，已回退全量拉取：" + (error?.message || String(error)),
        });
      }

      const detailTargets = subtasks.filter(function (entry) {
        if (existingCheckFailed) {
          return true;
        }
        const statusKey = [entry.batchId, String(entry.pageGroup?.kind?.role || "label"), entry.subTaskId].join("|");
        const status = existingStatusByKey[statusKey];
        if (status && status.complete === true) {
          if (forceReplaceByBatchId) {
            return true;
          }
          skippedCompleteCount += 1;
          return false;
        }
        if (status && status.exists === true && status.complete === false) {
          incompleteFoundCount += 1;
        }
        return true;
      });

      const detailConcurrency = resolveDynamicConcurrency(detailTargets.length || 1);
      const detailProgress = {
        completed: 0,
        success: 0,
        failed: 0,
      };
      if (progressReporter && typeof progressReporter.update === "function") {
        progressReporter.update({
          phase: "拉取详情",
          total: detailTargets.length,
          completed: 0,
          concurrency: detailConcurrency,
          success: 0,
          failed: 0,
          message:
            "跳过 " +
            String(skippedCompleteCount) +
            "，待补 " +
            String(incompleteFoundCount) +
            "，废弃 " +
            String(discardedNoBatchCount),
        });
      }
      const payloads = (
        await runConcurrent(detailTargets, detailConcurrency, async function (entry) {
          const summary = entry.summary;
          const pageGroup = entry.pageGroup;
          const kind = pageGroup.kind;
          const linkedTask = pageGroup.taskMap[String(summary?.taskId || "")] || {};
          detailRequestCount += 1;
          try {
            const detailData = await fetchSubtaskDetail(summary);
            if (!detailData?.id) {
              skippedDetailCount += 1;
              detailProgress.completed += 1;
              detailProgress.failed += 1;
              return null;
            }
            if (detailData.pageOverflow) {
              detailPageOverflowCount += 1;
            }
            const enrichedData = enrichSubtaskData(detailData, summary, pageGroup.taskMap, kind);
            if (!isAsrTranscriptionTaskRecord(enrichedData, linkedTask)) {
              skippedDetailCount += 1;
              detailProgress.completed += 1;
              return null;
            }
            const durationSeconds = sumDurationSeconds(enrichedData.dataList);
            const payload = buildPayload(enrichedData, durationSeconds, reason || "home-manual", {
              role: kind.role,
              userName: userName || getUserNameFromRecord(summary),
            });
            const validation = validateTranscriptionPayload(payload);
            if (!validation.ok) {
              failedPayloadValidationCount += 1;
              detailProgress.completed += 1;
              detailProgress.failed += 1;
              errors.push({
                kind: kind.key,
                message:
                  "subTaskId=" +
                  sanitizeSubTaskId(getSummarySubTaskId(summary)) +
                  " 拒绝上传：" +
                  (validation.rejectedReason || "缺少必要字段"),
              });
              return null;
            }
            if (validation.warningFields.length > 0) {
              warningPayloadCount += 1;
            }
            payload.homeContext = {
              projectId: projectId,
              kind: kind.key,
              role: kind.role,
              kindLabel: kind.label,
              taskCount: pageGroup.tasksPage.recordCount,
              subTaskCount: detailTargets.length,
              unfinishedCount: pageGroup.unfinishedPage.recordCount,
              finishedCount: pageGroup.finishedPage.recordCount,
              source: kind.route + " tasks/subTasks + subTask data",
              warningFields: validation.warningFields,
            };
            detailProgress.completed += 1;
            detailProgress.success += 1;
            return payload;
          } catch (error) {
            skippedDetailCount += 1;
            detailProgress.completed += 1;
            detailProgress.failed += 1;
            errors.push({
              kind: kind.key,
              message:
                "subTaskId=" +
                sanitizeSubTaskId(getSummarySubTaskId(summary)) +
                " " +
                (error && error.message ? error.message : String(error)),
            });
            return null;
          } finally {
            if (progressReporter && typeof progressReporter.update === "function") {
              progressReporter.update({
                phase: "拉取详情",
                total: detailTargets.length,
                completed: detailProgress.completed,
                concurrency: detailConcurrency,
                success: detailProgress.success,
                failed: detailProgress.failed,
                message:
                  "跳过 " +
                  String(skippedCompleteCount) +
                  "，待补 " +
                  String(incompleteFoundCount) +
                  "，废弃 " +
                  String(discardedNoBatchCount),
              });
            }
          }
        })
      ).filter(Boolean);

      if (progressReporter && typeof progressReporter.update === "function") {
        progressReporter.update({
          phase: "合并数据",
          total: payloads.length,
          completed: payloads.length,
          concurrency: 1,
          success: payloads.length,
          failed: 0,
        });
      }

      const failedCount = detailProgress.failed;
      const replaceBatchIds = forceReplaceByBatchId
        ? Array.from(
            new Set(
              payloads
                .map(function (item) {
                  return sanitizeBatchId(item?.mergeKey?.batchId || item?.csvPatch?.["分包ID"] || "");
                })
                .filter(Boolean)
            )
          )
        : [];

      return {
        schemaVersion: 1,
        source: "chromium-extension",
        project: "alibaba-labelx/asr-transcription",
        reason: reason || "home-manual",
        uploadedAt: new Date().toISOString(),
        mode: "project-batch",
        mergeKey: {
          projectId: projectId,
        },
        forceReplaceByBatchId: forceReplaceByBatchId,
        replaceMode: forceReplaceByBatchId ? "batch" : "",
        replaceBatchIds: replaceBatchIds,
        payloads: payloads,
        summary: {
          projectId: projectId,
          taskCount: kindPages.reduce(function (total, item) {
            return total + (Number(item.tasksPage.recordCount) || 0);
          }, 0),
          subTaskCount: detailTargets.length,
          scannedTranscriptionSubTaskCount: scannedTranscriptionSubTaskCount,
          detailRequestCount: detailRequestCount,
          payloadCount: payloads.length,
          skippedSubTaskCount: skippedSubTaskCount,
          skippedDuplicateSubTaskCount: skippedDuplicateSubTaskCount,
          skippedCompleteCount: forceReplaceByBatchId ? 0 : skippedCompleteCount,
          forceReplaceByBatchId: forceReplaceByBatchId,
          forceReplaceBatchCount: replaceBatchIds.length,
          incompleteFoundCount: incompleteFoundCount,
          discardedNoBatchCount: discardedNoBatchCount,
          skippedDetailCount: skippedDetailCount,
          failedPayloadValidationCount: failedPayloadValidationCount,
          warningPayloadCount: warningPayloadCount,
          existingCheckFailed: existingCheckFailed,
          failedCount: failedCount,
          detailConcurrency: detailConcurrency,
          listPageOverflowCount: listPageOverflowCount,
          detailPageOverflowCount: detailPageOverflowCount,
          kinds: kindPages.map(function (item) {
            return {
              kind: item.kind.key,
              role: item.kind.role,
              taskCount: item.tasksPage.recordCount,
              unfinishedCount: item.unfinishedPage.recordCount,
              finishedCount: item.finishedPage.recordCount,
              taskPages: item.tasksPage.totalPages,
              unfinishedPages: item.unfinishedPage.totalPages,
              finishedPages: item.finishedPage.totalPages,
              taskPageOverflow: Boolean(item.tasksPage.pageOverflow),
              unfinishedPageOverflow: Boolean(item.unfinishedPage.pageOverflow),
              finishedPageOverflow: Boolean(item.finishedPage.pageOverflow),
            };
          }),
          errors: errors,
        },
      };
    }

    async function collectDetailPayload(reason, progressReporter) {
      const params = getUrlParams();
      const cleanSubTaskId = sanitizeSubTaskId(params.subTaskId || "");
      if (!cleanSubTaskId) {
        throw new Error("详情页缺少有效 subTaskId，无法上传转写统计。");
      }

      if (progressReporter && typeof progressReporter.update === "function") {
        progressReporter.update({
          phase: "拉取详情",
          total: 1,
          completed: 0,
          concurrency: resolveDynamicConcurrency(1),
          success: 0,
          failed: 0,
        });
      }

      const detailData = await fetchSubtaskDetail({ id: cleanSubTaskId });
      if (progressReporter && typeof progressReporter.update === "function") {
        progressReporter.update({
          phase: "拉取详情",
          total: 1,
          completed: 1,
          concurrency: resolveDynamicConcurrency(1),
          success: 1,
          failed: 0,
        });
      }
      const userName = await resolveCurrentUserText();
      const durationSeconds = sumDurationSeconds(detailData.dataList);
      const payload = buildPayload(
        Object.assign({}, detailData, {
          id: cleanSubTaskId,
          size:
            Number(detailData?.size) ||
            Number(detailData?.recordCount) ||
            Number(detailData?.fetchedItemCount) ||
            (Array.isArray(detailData?.dataList) ? detailData.dataList.length : 0),
        }),
        durationSeconds,
        reason || "detail-manual",
        {
          role: inferRole(detailData),
          userName: userName,
        }
      );
      const validation = validateTranscriptionPayload(payload);
      if (!validation.ok) {
        throw new Error("详情统计缺少分包ID，已拒绝上传。");
      }

      const config = getConfig();
      try {
        const existingResult = await fetchExistingStatuses(
          config,
          [
            {
              batchId: sanitizeBatchId(payload?.mergeKey?.batchId || payload?.csvPatch?.["分包ID"] || ""),
              role: String(payload?.roleRecord?.role || "label").toLowerCase(),
              taskName: cleanText(payload?.csvPatch?.["任务名称"] || ""),
              subTaskId: sanitizeSubTaskId(payload?.roleRecord?.subTaskId || ""),
            },
          ],
          null
        );
        const statusKey = [
          sanitizeBatchId(payload?.mergeKey?.batchId || payload?.csvPatch?.["分包ID"] || ""),
          String(payload?.roleRecord?.role || "label").toLowerCase(),
          sanitizeSubTaskId(payload?.roleRecord?.subTaskId || ""),
        ].join("|");
        const status = existingResult?.byKey?.[statusKey];
        if (status && status.complete === true) {
          return {
            schemaVersion: 1,
            source: "chromium-extension",
            project: "alibaba-labelx/asr-transcription",
            reason: reason || "detail-manual",
            uploadedAt: new Date().toISOString(),
            mode: "project-batch",
            mergeKey: {
              projectId: payload?.mergeKey?.projectId || payload?.rawKeys?.projectId || "",
            },
            payloads: [],
            summary: {
              subTaskCount: 1,
              detailRequestCount: 0,
              payloadCount: 0,
              skippedCompleteCount: 1,
              incompleteFoundCount: 0,
              discardedNoBatchCount: 0,
              warningPayloadCount: 0,
              failedCount: 0,
              detailConcurrency: resolveDynamicConcurrency(1),
            },
          };
        }
      } catch (error) {
        // existing 检查失败时回退原流程，不阻断详情上传。
      }

      if (progressReporter && typeof progressReporter.update === "function") {
        progressReporter.update({
          phase: "合并数据",
          total: 1,
          completed: 1,
          concurrency: 1,
          success: 1,
          failed: 0,
        });
      }
      return payload;
    }

    async function postPayload(payload, reason, progressReporter) {
      const config = getConfig();
      const endpoint = resolveUploadEndpoint(config);
      if (!endpoint) {
        throw new Error("统计上传地址未配置。");
      }

      const payloadList = Array.isArray(payload?.payloads) ? payload.payloads : [payload];
      if (!isManualReason(reason) && payloadList.filter(Boolean).length > 0) {
        const delayMs = createScheduleUploadDelayMs();
        if (progressReporter && typeof progressReporter.update === "function") {
          progressReporter.update({
            phase: "等待随机延迟",
            total: 1,
            completed: 0,
            concurrency: 1,
            success: 0,
            failed: 0,
            message: String((delayMs / 1000).toFixed(1)) + " 秒后上传",
          });
        }
        await delay(delayMs);
      }

      const controller = typeof AbortController === "function" ? new AbortController() : null;
      const timeoutMs = Math.max(1000, Number(config.statsUploadRequestTimeoutMs) || 20000);
      const timeoutId = controller
        ? window.setTimeout(function () {
            controller.abort();
          }, timeoutMs)
        : null;

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          cache: "no-store",
          credentials: "omit",
          signal: controller ? controller.signal : undefined,
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json, text/plain, */*",
          },
          body: JSON.stringify(payload),
        });
        const contentType = response.headers.get("content-type") || "";
        const body = contentType.indexOf("application/json") >= 0 ? await response.json() : await response.text();
        if (!response.ok) {
          const responseSummary = summarizeUploadResponseBody(body);
          throw new Error(
            "上传失败：" +
              String(response.status) +
              (response.statusText ? " " + response.statusText : "") +
              "；地址：" +
              getEndpointLabel(endpoint) +
              (responseSummary ? "；响应：" + responseSummary : "")
          );
        }
        if (body && typeof body === "object" && body.success === false) {
          throw new Error(
            (body.message || "统计上传业务失败。") +
              "；地址：" +
              getEndpointLabel(endpoint)
          );
        }
        return body;
      } catch (error) {
        if (error && error.name === "AbortError") {
          throw new Error(
            "上传请求超时：" +
              String(timeoutMs) +
              "ms；地址：" +
              getEndpointLabel(endpoint)
          );
        }
        if (error instanceof TypeError) {
          throw new Error(
            "上传请求未发出或被浏览器/网络拦截：" +
              (error.message || String(error)) +
              "；地址：" +
              getEndpointLabel(endpoint)
          );
        }
        throw error;
      } finally {
        if (timeoutId) {
          window.clearTimeout(timeoutId);
        }
      }
    }

    async function uploadNow(reason) {
      const uploadReason = reason || "manual";
      const isForceReplaceUpload = isForceReplaceReason(uploadReason);
      const config = getConfig();
      if (!shouldApply()) {
        return {
          ok: false,
          reason: "runtime-disabled",
          message: "当前不是转写统计运行态，未上传统计。",
        };
      }
      if (isForceReplaceUpload && !isHomePage()) {
        return {
          success: false,
          ok: false,
          reason: uploadReason,
          message: "详情页不支持“补传并覆盖当前人员”，请回到首页后重新上传。",
        };
      }
      if (state.uploading) {
        return {
          success: false,
          ok: false,
          skipped: true,
          reason: "upload-in-progress",
          message: "转写统计上传中，请勿重复点击。",
        };
      }

      if (isForceReplaceUpload) {
        setForceReplaceButtonBusy(true);
      } else {
        hideForceReplaceButton();
      }

      state.uploading = true;
      removeProgressIndicator();
      updateUploadProgress({
        phase: "初始化",
        total: 1,
        completed: 0,
        concurrency: 1,
        success: 0,
        failed: 0,
      });
      notify();
      try {
        const payload = await collectPayload(uploadReason, {
          update: updateUploadProgress,
        });
        const uploadPayloadList = (Array.isArray(payload?.payloads) ? payload.payloads : [payload]).filter(Boolean);
        let postResult = null;
        if (uploadPayloadList.length > 0) {
          updateUploadProgress({
            phase: isForceReplaceUpload ? "补传并覆盖当前人员" : "上传后端",
            total: 1,
            completed: 0,
            concurrency: 1,
            success: 0,
            failed: 0,
          });
          postResult = await postPayload(payload, uploadReason, {
            update: updateUploadProgress,
          });
          updateUploadProgress({
            phase: isForceReplaceUpload ? "补传并覆盖当前人员" : "上传后端",
            total: 1,
            completed: 1,
            concurrency: 1,
            success: 1,
            failed: 0,
          });
        }
        const summary = payload?.summary && typeof payload.summary === "object" ? payload.summary : {};
        const backendFailedCount = Number(postResult?.data?.failedCount || 0);
        const failedCount = Number(summary.failedCount || 0) + backendFailedCount;
        const warningCount = Number(summary.warningPayloadCount || 0);
        const incompleteFoundCount = Number(summary.incompleteFoundCount || 0);
        const scannedCount = Number(summary.scannedTranscriptionSubTaskCount || summary.subTaskCount || 0);
        const detailCount = Number(summary.detailRequestCount || 0);
        const uploadCount = Number(summary.payloadCount || uploadPayloadList.length || 0);
        const skippedCompleteCount = Number(summary.skippedCompleteCount || 0);
        const discardedNoBatchCount = Number(summary.discardedNoBatchCount || 0);
        const concurrencyCount = Number(
          summary.detailConcurrency || resolveDynamicConcurrency(summary.subTaskCount || 1)
        );
        let summaryMessage = "";
        if (isForceReplaceUpload) {
          summaryMessage =
            "取消跳过上传完成：重新拉取 " +
            String(detailCount || summary.subTaskCount || 0) +
            "，上传 " +
            String(uploadCount) +
            "，局部覆盖 " +
            String(postResult?.data?.replacedBatchCount || summary.forceReplaceBatchCount || 0) +
            " 个分包的当前人员列，失败 " +
            String(failedCount) +
            "。";
        } else {
          summaryMessage =
            "上传完成：扫描 " +
            String(scannedCount) +
            "，补齐 " +
            String(detailCount) +
            "，上传 " +
            String(uploadCount) +
            "，跳过完整 " +
            String(skippedCompleteCount) +
            "，字段待补 " +
            String(incompleteFoundCount) +
            "，废弃(无分包ID) " +
            String(discardedNoBatchCount) +
            "，失败 " +
            String(failedCount) +
            "，并发 " +
            String(concurrencyCount) +
            (summary.listPageOverflowCount || summary.detailPageOverflowCount
              ? "（分页超上限，已截断）"
              : "") +
            (uploadPayloadList.length === 0 ? "。已全部完整，无需上传" : "") +
            (failedCount > 0
              ? "。有数据导出失败，请再次点击导出"
              : warningCount > 0
                ? "。上传完成，部分字段待后续角色补齐"
                : "");
          if (
            skippedCompleteCount > 0 &&
            isHomePage() &&
            isManualReason(uploadReason) &&
            !isForceReplaceUpload
          ) {
            summaryMessage += "。可点击“补传并覆盖当前人员”重新拉取这些分包，但只会覆盖当前人员或当前审核角色对应列。";
          }
        }
        completeUploadProgress(summaryMessage);
        setMessage(failedCount === 0, uploadReason, summaryMessage);
        showToast(summaryMessage, failedCount > 0 ? "error" : "info");
        if (
          skippedCompleteCount > 0 &&
          isHomePage() &&
          isManualReason(uploadReason) &&
          !isForceReplaceUpload
        ) {
          showForceReplaceButton(summary);
        } else {
          hideForceReplaceButton();
        }
        const uploadPayload = Array.isArray(payload.payloads) ? payload.payloads : [payload];
        return {
          success: true,
          ok: true,
          reason: uploadReason,
          message: summaryMessage,
          payload: {
            batchId: uploadPayload[0]?.mergeKey?.batchId || "",
            subTaskId: uploadPayload[0]?.roleRecord?.subTaskId || "",
            itemCount: uploadPayload.reduce(function (total, item) {
              return total + (Number(item?.metrics?.itemCount) || 0);
            }, 0),
            payloadCount: uploadPayload.length,
          },
        };
      } catch (error) {
        const message = error && error.message ? error.message : String(error);
        if (isForceReplaceUpload) {
          setForceReplaceButtonBusy(false);
        }
        failUploadProgress(message);
        setMessage(false, uploadReason, message);
        showToast("转写统计上传失败：" + message, "error");
        return {
          success: false,
          ok: false,
          reason: uploadReason,
          message: message,
        };
      } finally {
        state.uploading = false;
        notify();
        ensureUploadButton();
      }
    }

    function start() {
      state.started = true;
      startUploadButton();
      void refreshSchedule().finally(scheduleNextUpload);
      notify();
    }

    function stop() {
      state.started = false;
      state.nextScheduleAt = null;
      clearScheduleTimer();
      clearUploadButtonTimer();
      removeUploadButton();
      removeProgressIndicator();
      notify();
    }

    function getState() {
      return clone(state);
    }

    return {
      start: start,
      stop: stop,
      uploadNow: uploadNow,
      getState: getState,
    };
  }

  function isStatsPage() {
    if (location.hostname !== "labelx.alibaba-inc.com") {
      return false;
    }
    const routeText = String(location.pathname || "").toLowerCase();
    if (routeText.indexOf("/corpora/labeling/") < 0) {
      return false;
    }
    const text = String(document.body?.textContent || "").replace(/\s+/g, "");
    return text.indexOf("哪个ASR更优") < 0;
  }

  function isHomePage() {
    const routeText = String(location.pathname || "").toLowerCase();
    return routeText.indexOf("/corpora/labeling/labelingtask") >= 0 || routeText.indexOf("/corpora/labeling/checktask") >= 0;
  }

  globalThis.__ASREdgeAlibabaLabelxTranscriptionStatsClient = {
    createRuntime: createRuntime,
    CSV_COLUMNS: CSV_COLUMNS.slice(),
    isAsrTranscriptionTaskRecord: isAsrTranscriptionTaskRecord,
    resolveDynamicConcurrency: resolveDynamicConcurrency,
    createScheduleUploadDelayMs: createScheduleUploadDelayMs,
    sanitizeSubTaskId: sanitizeSubTaskId,
  };
})();

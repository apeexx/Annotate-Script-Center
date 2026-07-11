(function () {
  if (globalThis.__ASREdgeAishellTechMinnanDataApiInstalled === true) {
    return;
  }
  globalThis.__ASREdgeAishellTechMinnanDataApiInstalled = true;

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

  function removeTextSpaces(text) {
    return String(text || "").replace(/[\s\u3000]+/g, "");
  }

  function normalizeMarkCompareText(text) {
    return ensureChineseSentencePunctuation(removeTextSpaces(text || ""));
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

  function extractPlatformAccountName(value) {
    const text = normalizeText(value);
    if (!text) {
      return "";
    }
    return normalizeText(text.replace(/[【\[].*$/, ""));
  }

  function findPlatformAccountNameFromDocument(documentLike) {
    const source = documentLike && typeof documentLike.querySelector === "function" ? documentLike : null;
    if (!source) {
      return "";
    }
    const primaryText = extractPlatformAccountName(
      source.querySelector(".avatar-dropdown .user-name .hidden-xs-only")?.textContent || ""
    );
    if (primaryText) {
      return primaryText;
    }
    return extractPlatformAccountName(
      source.querySelector(".avatar-dropdown .user-name")?.textContent || ""
    );
  }

  function getPlatformUserMetaFromPage() {
    return {
      platformUserName: findPlatformAccountNameFromDocument(document),
      platformUserId: "",
    };
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

    const keys = Object.keys(value);
    const orderedKeys = keys
      .slice()
      .sort(function (left, right) {
        const leftPriority = PRIORITY_TOKEN_KEYS.indexOf(left);
        const rightPriority = PRIORITY_TOKEN_KEYS.indexOf(right);
        const leftRank = leftPriority >= 0 ? leftPriority : PRIORITY_TOKEN_KEYS.length + 1;
        const rightRank = rightPriority >= 0 ? rightPriority : PRIORITY_TOKEN_KEYS.length + 1;
        return leftRank - rightRank;
      });

    for (let index = 0; index < orderedKeys.length; index += 1) {
      const key = orderedKeys[index];
      const token = extractAuthTokenFromUnknown(value[key], depth + 1, seen);
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
      const entry = prioritized[index];
      const token = extractAuthTokenFromUnknown(entry?.value, 0, new WeakSet());
      if (token) {
        return token;
      }
    }
    return "";
  }

  function readAuthTokenFromPageStorage() {
    const localEntries = readStorageEntries(window.localStorage);
    const localToken = findAuthTokenInEntries(localEntries);
    if (localToken) {
      return localToken;
    }
    const sessionEntries = readStorageEntries(window.sessionStorage);
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

  function getCurrentInputValue() {
    const input = document.querySelector(".mark-area input.el-input__inner[type='text']");
    return input instanceof HTMLInputElement ? normalizeText(input.value) : "";
  }

  function getTextInput() {
    const input = document.querySelector(".mark-area input.el-input__inner[type='text']");
    return input instanceof HTMLInputElement ? input : null;
  }

  function getReferenceTextFromDom() {
    const rows = Array.from(document.querySelectorAll(".mark-area .el-form-item"));
    const target = rows.find(function (row) {
      return normalizeText(row.textContent || "").indexOf("原始文本") >= 0;
    });
    if (!(target instanceof HTMLElement)) {
      return "";
    }
    const content =
      target.querySelector(".el-form-item__content") ||
      target.querySelector(".el-input") ||
      target;
    return normalizeText(String(content.textContent || "").replace(/^原始文本/, ""));
  }

  function extractFileNameLineText(value) {
    const text = normalizeText(value);
    if (!text) {
      return "";
    }
    const matched = text.match(/(\d+\s*:\s*[^\s]+\.(?:wav|mp3|flac|pcm|m4a|ogg))/i);
    return matched ? normalizeText(matched[1] || "") : text;
  }

  function getCurrentFileNameLineText() {
    const lineNode =
      document && typeof document.querySelector === "function"
        ? document.querySelector(".fileName-line")
        : null;
    if (lineNode instanceof HTMLElement) {
      const lineText = extractFileNameLineText(lineNode.textContent || "");
      if (lineText) {
        return lineText;
      }
    }
    const nodes = Array.from(document.querySelectorAll(".fileName-line span"));
    const first = nodes.find(function (node) {
      return node instanceof HTMLElement && normalizeText(node.textContent || "");
    });
    return first instanceof HTMLElement
      ? extractFileNameLineText(first.textContent || "")
      : "";
  }

  function getListItemNodes() {
    return Array.from(
      document.querySelectorAll(".list .list-item, .list .list-item-selected, .list .list-item-finshed")
    ).filter(function (node) {
      return node instanceof HTMLElement;
    });
  }

  function parseListItemLabel(label) {
    const text = normalizeText(label);
    const match = text.match(/^(\d+)\s*:\s*(.+)$/);
    if (!match) {
      return {
        number: 0,
        fileHint: text,
      };
    }
    return {
      number: Number(match[1] || 0) || 0,
      fileHint: normalizeText(match[2] || ""),
    };
  }

  function normalizeListFileHint(value) {
    return normalizeText(value).replace(/^\.{3,}/, "").trim();
  }

  function doesListFileHintMatch(expectedFileName, fileHint) {
    const expected = normalizeText(expectedFileName);
    const hint = normalizeListFileHint(fileHint);
    if (!hint) {
      return !expected;
    }
    if (!expected) {
      return true;
    }
    return expected === hint || expected.endsWith(hint);
  }

  function doesDomListItemMatchTask(item, task) {
    const targetNumber = Number(task?.number || 0) || 0;
    const targetFileName = normalizeText(task?.fileName);
    if (targetNumber > 0 && Number(item?.number || 0) !== targetNumber) {
      return false;
    }
    return doesListFileHintMatch(targetFileName, item?.fileHint || item?.label || "");
  }

  function getListDomItems() {
    return getListItemNodes().map(function (node, index) {
      const button = node.querySelector("button.el-button--text, button");
      const label = normalizeText(button?.textContent || node.textContent || "");
      const parsed = parseListItemLabel(label);
      return {
        index: index,
        node: node,
        button: button instanceof HTMLElement ? button : node,
        selected: node.classList.contains("list-item-selected"),
        finished: node.classList.contains("list-item-finshed"),
        label: label,
        number: parsed.number,
        fileHint: parsed.fileHint,
      };
    });
  }

  function getSelectedDomItem() {
    return (
      getListDomItems().find(function (item) {
        return item.selected === true;
      }) || null
    );
  }

  function findDomItemForTask(task) {
    const domItems = getListDomItems();
    const exact = domItems.find(function (item) {
      return doesDomListItemMatchTask(item, task);
    });
    if (exact) {
      return exact;
    }
    const targetIndex = Number(task?.index);
    if (Number.isInteger(targetIndex) && targetIndex >= 0) {
      return domItems[targetIndex] || null;
    }
    return null;
  }

  function getSelectedIndex() {
    const items = getListDomItems();
    const selectedIndex = items.findIndex(function (item) {
      return item.selected === true;
    });
    return selectedIndex >= 0 ? selectedIndex : items.length > 0 ? 0 : -1;
  }

  function getSaveButton() {
    return (
      Array.from(document.querySelectorAll(".mark-area button.el-button--primary")).find(
        function (button) {
          return button instanceof HTMLButtonElement && normalizeText(button.textContent || "") === "保存";
        }
      ) || null
    );
  }

  function getToastMessageNodes() {
    return Array.from(document.querySelectorAll(".el-message")).filter(function (node) {
      return node instanceof HTMLElement;
    });
  }

  function getToastMessageText(node) {
    if (!(node instanceof HTMLElement)) {
      return "";
    }
    const contentNode = node.querySelector(".el-message__content");
    if (contentNode instanceof HTMLElement) {
      return normalizeText(contentNode.textContent || "");
    }
    return normalizeText(node.textContent || "");
  }

  function findNewToastMessage(previousNodes) {
    const seen = previousNodes instanceof Set ? previousNodes : new Set(previousNodes || []);
    const nodes = getToastMessageNodes();
    for (let index = 0; index < nodes.length; index += 1) {
      const node = nodes[index];
      if (seen.has(node)) {
        continue;
      }
      const text = getToastMessageText(node);
      if (!text) {
        continue;
      }
      return {
        node: node,
        text: text,
        success:
          String(node.className || "").indexOf("el-message--success") >= 0 &&
          text.indexOf("保存成功") >= 0,
        error:
          String(node.className || "").indexOf("el-message--error") >= 0 ||
          String(node.className || "").indexOf("el-message--warning") >= 0,
      };
    }
    return null;
  }

  function triggerNativeSaveButton(button) {
    if (!(button instanceof HTMLButtonElement)) {
      return false;
    }
    if (typeof button.focus === "function") {
      button.focus();
    }
    button.click();
    return true;
  }

  function sleep(ms) {
    return new Promise(function (resolve) {
      window.setTimeout(resolve, ms);
    });
  }

  function createRateLimitedTaskScheduler(options) {
    const config = options && typeof options === "object" ? options : {};
    const concurrency = Math.max(1, Math.floor(Number(config.concurrency || 1) || 1));
    const staggerMs = Math.max(0, Math.floor(Number(config.staggerMs || 0) || 0));
    const state = {
      activeCount: 0,
      queue: [],
      nextDispatchAt: 0,
      cancelled: false,
      cancelReason: null,
    };

    function scheduleNext() {
      while (
        state.cancelled !== true &&
        state.activeCount < concurrency &&
        state.queue.length > 0
      ) {
        const entry = state.queue.shift();
        if (!entry) {
          return;
        }
        const now = Date.now();
        const dispatchAt = Math.max(now, state.nextDispatchAt);
        state.nextDispatchAt = dispatchAt + staggerMs;
        state.activeCount += 1;
        globalThis.setTimeout(function () {
          Promise.resolve()
            .then(function () {
              if (state.cancelled === true) {
                throw state.cancelReason || new Error("调度已取消。");
              }
              return entry.task();
            })
            .then(entry.resolve, entry.reject)
            .finally(function () {
              state.activeCount = Math.max(0, state.activeCount - 1);
              scheduleNext();
            });
        }, Math.max(0, dispatchAt - now));
      }
    }

    return {
      run(task) {
        if (typeof task !== "function") {
          return Promise.reject(new Error("scheduler task 必须是函数。"));
        }
        if (state.cancelled === true) {
          return Promise.reject(state.cancelReason || new Error("调度已取消。"));
        }
        return new Promise(function (resolve, reject) {
          state.queue.push({
            task: task,
            resolve: resolve,
            reject: reject,
          });
          scheduleNext();
        });
      },
      cancelPending(reason) {
        state.cancelled = true;
        state.cancelReason =
          reason instanceof Error ? reason : new Error(String(reason || "调度已取消。"));
        while (state.queue.length > 0) {
          const entry = state.queue.shift();
          entry.reject(state.cancelReason);
        }
      },
      getSnapshot() {
        return {
          activeCount: state.activeCount,
          queuedCount: state.queue.length,
          concurrency: concurrency,
          staggerMs: staggerMs,
          cancelled: state.cancelled === true,
        };
      },
    };
  }

  function extractSavedMarkText(result) {
    const source = result && typeof result === "object" ? result : null;
    if (!source) {
      return "";
    }
    if (source.mark && typeof source.mark === "object") {
      return normalizeText(source.mark.text || "");
    }
    if (typeof source.mark === "string") {
      const parsed = safeJsonParse(source.mark);
      if (parsed && typeof parsed === "object") {
        return normalizeText(parsed.text || "");
      }
      return normalizeText(source.mark);
    }
    if (typeof source.text === "string") {
      return normalizeText(source.text);
    }
    return "";
  }

  function normalizeSaveSpendTime(value) {
    const numeric = Math.round(Number(value) || 0);
    return numeric > 0 ? numeric : 5;
  }

  function normalizeSaveDuration(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
  }

  function buildSaveShortMarkPayload(item, text, options) {
    const source = item && typeof item === "object" ? item : {};
    const normalizedText = ensureChineseSentencePunctuation(removeTextSpaces(text || ""));
    return {
      mark: JSON.stringify({
        text: normalizedText,
      }),
      taskItemId: normalizeText(source.taskItemId),
      spendTime: normalizeSaveSpendTime(options?.spendTime ?? source.spendTime),
      scene: "mark",
      duration: normalizeSaveDuration(options?.duration ?? source.duration),
    };
  }

  function isPackageItemSaved(record) {
    const source = record && typeof record === "object" ? record : {};
    return Number(source.dataStatus || 0) > 0;
  }

  function doesRenderedItemMatch(expected) {
    const source = expected && typeof expected === "object" ? expected : {};
    const expectedFileName = normalizeText(source.fileName);
    const expectedReferenceText = normalizeText(source.referenceText);
    const currentFileName = getCurrentFileNameLineText();
    const currentReferenceText = getReferenceTextFromDom();
    const fileMatched = !expectedFileName || currentFileName.indexOf(expectedFileName) >= 0;
    const referenceMatched =
      !expectedReferenceText ||
      removeTextSpaces(currentReferenceText) === removeTextSpaces(expectedReferenceText);
    return fileMatched && referenceMatched;
  }

  function getRecordDisplayName(record) {
    const number = Number(record?.number || 0) || 0;
    const fileName = normalizeText(record?.fileName);
    if (number > 0 && fileName) {
      return "第 " + String(number) + " 条 " + fileName;
    }
    if (fileName) {
      return fileName;
    }
    if (number > 0) {
      return "第 " + String(number) + " 条";
    }
    return "未命名条目";
  }

  function normalizeBatchTaskMode(value) {
    return String(value || "").trim().toLowerCase() === "all" ? "all" : "pending";
  }

  function shouldSkipBatchRecord(record, options) {
    const mode = normalizeBatchTaskMode(options?.mode);
    if (mode === "all") {
      return false;
    }
    return Number(record?.dataStatus || 0) === 2;
  }

  function createBatchTasksFromPackageItems(records, options) {
    const source = Array.isArray(records) ? records : [];
    return source
      .map(function (record, index) {
        return {
          index: index,
          record: record && typeof record === "object" ? record : {},
        };
      })
      .filter(function (entry) {
        return shouldSkipBatchRecord(entry.record, options) !== true;
      })
      .map(function (entry) {
        return {
          index: entry.index,
          taskItemId: normalizeText(entry.record.id),
          number: Number(entry.record.number || entry.index + 1) || entry.index + 1,
          fileName: normalizeText(entry.record.fileName),
          displayName: getRecordDisplayName(entry.record),
        };
      });
  }

  function isSaveCompletionState(previousIndex, snapshot) {
    const source = snapshot && typeof snapshot === "object" ? snapshot : {};
    if (!Number.isInteger(Number(previousIndex)) || Number(previousIndex) < 0) {
      return false;
    }
    if (Number(source.selectedIndex) !== Number(previousIndex)) {
      return true;
    }
    return source.previousItemFinished === true;
  }

  function createRuntime() {
    const state = {
      authToken: "",
      routeKey: "",
      taskDetailByTaskId: Object.create(null),
      packageItemsByPackageId: Object.create(null),
      markDetailByTaskItemId: Object.create(null),
    };

    function clearRouteCache() {
      state.taskDetailByTaskId = Object.create(null);
      state.packageItemsByPackageId = Object.create(null);
      state.markDetailByTaskItemId = Object.create(null);
    }

    function syncRouteKey() {
      const routeParams = parseRouteParams();
      const nextKey = [routeParams.taskId, routeParams.packageId].join("|");
      if (nextKey !== state.routeKey) {
        state.routeKey = nextKey;
        clearRouteCache();
      }
    }

    function captureListState(previousIndex) {
      const domItems = getListDomItems();
      const normalizedPreviousIndex = Number(previousIndex);
      return {
        selectedIndex: getSelectedIndex(),
        previousItemFinished:
          Number.isInteger(normalizedPreviousIndex) &&
          normalizedPreviousIndex >= 0 &&
          domItems[normalizedPreviousIndex]
            ? domItems[normalizedPreviousIndex].finished === true
            : false,
      };
    }

    function getAuthToken() {
      if (state.authToken) {
        return state.authToken;
      }
      const token = readAuthTokenFromPageStorage();
      if (!token) {
        throw createRequestError("未能从页面读取 Aishell 登录态，请重新登录后再试。");
      }
      state.authToken = token;
      return state.authToken;
    }

    async function requestJson(path) {
      return requestJsonWithOptions("GET", path);
    }

    async function requestJsonWithOptions(method, path, body) {
      syncRouteKey();
      const token = getAuthToken();
      const httpMethod = normalizeText(method || "GET").toUpperCase() || "GET";
      const headers = {
        Accept: "application/json",
        Authorization: "Bearer " + token,
      };
      let payloadBody;
      if (httpMethod !== "GET" && body !== undefined) {
        headers["Content-Type"] = "application/json;charset=UTF-8";
        payloadBody = JSON.stringify(body);
      }
      const response = await fetch(buildApiUrl(path), {
        method: httpMethod,
        headers: headers,
        body: payloadBody,
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
      if (payload?.data?.isSucceed === false) {
        throw createRequestError(normalizeText(payload?.data?.message) || "Aishell 平台返回失败。");
      }
      return payload;
    }

    async function ensureMarkDetail(taskItemId) {
      const key = normalizeText(taskItemId);
      if (!key) {
        throw createRequestError("当前缺少 taskItemId。");
      }
      if (state.markDetailByTaskItemId[key]) {
        return state.markDetailByTaskItemId[key];
      }
      const payload = await requestJson("/api/taskItem/markDetail/" + encodeURIComponent(key));
      const result = payload?.data?.result || {};
      const entry = {
        taskItemId: key,
        fileName: normalizeText(result.fileName),
        referenceText: normalizeText(result.text),
        duration: Number(result.audioLength || 0) || 0,
        url: normalizeText(result.url),
        dataRoot: normalizeText(result.dataRoot),
        raw: result,
      };
      state.markDetailByTaskItemId[key] = entry;
      return entry;
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
      const result = payload?.data?.result || {};
      const entry = {
        taskId: key,
        templateId: normalizeText(result.templateId),
        taskName: normalizeText(result.taskName),
        dataRoot: normalizeText(result?.project?.dataRoot),
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
      const result = payload?.data?.result || {};
      const entry = {
        packageId: key,
        totalCount: Number(result.totalCount || 0) || 0,
        items: Array.isArray(result.items)
          ? result.items.map(function (item, index) {
              const source = item && typeof item === "object" ? item : {};
              return {
                id: normalizeText(source.id),
                number: Number(source.number || index + 1) || index + 1,
                fileName: normalizeText(source.fileName),
                url: normalizeText(source.url),
                text: normalizeText(source.text),
                spendTime: Number(source.spendTime || 0) || 0,
                dataStatus: Number(source.dataStatus || 0) || 0,
                checkStatus: Number(source.checkStatus || 0) || 0,
              };
            })
          : [],
      };
      state.packageItemsByPackageId[key] = entry;
      return entry;
    }

    async function refreshPackageItems(packageId) {
      const key = normalizeText(packageId || parseRouteParams().packageId);
      if (!key) {
        throw createRequestError("当前页面缺少 packageId。");
      }
      delete state.packageItemsByPackageId[key];
      return ensurePackageItems(key);
    }

    async function getShortMarkResult(taskItemId) {
      const key = normalizeText(taskItemId);
      if (!key) {
        return null;
      }
      const payload = await requestJson("/api/mark/getShortMark/" + encodeURIComponent(key));
      return payload?.data?.result || null;
    }

    async function getExpectedItemForIndex(index) {
      syncRouteKey();
      const routeParams = parseRouteParams();
      const packageEntry = await ensurePackageItems(routeParams.packageId);
      const record = packageEntry.items[Number(index)];
      if (!record) {
        return null;
      }
      return {
        fileName: normalizeText(record.fileName),
        referenceText: normalizeText(record.text),
        taskItemId: normalizeText(record.id),
      };
    }

    async function getExpectedItemForTask(task) {
      if (!task || typeof task !== "object") {
        return null;
      }
      syncRouteKey();
      const routeParams = parseRouteParams();
      const packageEntry = await ensurePackageItems(routeParams.packageId);
      const taskItemId = normalizeText(task.taskItemId);
      const record = taskItemId
        ? packageEntry.items.find(function (item) {
            return normalizeText(item?.id) === taskItemId;
          })
        : packageEntry.items[Number(task.index)];
      if (!record) {
        return null;
      }
      return {
        fileName: normalizeText(record.fileName),
        referenceText: normalizeText(record.text),
        taskItemId: normalizeText(record.id),
        number: Number(record.number || 0) || 0,
      };
    }

    async function waitForItemRender(targetIndex, options) {
      const timeoutMs = Math.max(1000, Number(options?.timeoutMs || 5000) || 5000);
      const deadline = Date.now() + timeoutMs;
      const expected =
        options?.expected && typeof options.expected === "object"
          ? options.expected
          : await getExpectedItemForIndex(targetIndex);
      while (Date.now() < deadline) {
        if (getSelectedIndex() === targetIndex && doesRenderedItemMatch(expected)) {
          return true;
        }
        await sleep(120);
      }
      return getSelectedIndex() === targetIndex && doesRenderedItemMatch(expected);
    }

    async function waitForTaskRender(task, options) {
      const timeoutMs = Math.max(1000, Number(options?.timeoutMs || 5000) || 5000);
      const deadline = Date.now() + timeoutMs;
      const expected =
        options?.expected && typeof options.expected === "object"
          ? options.expected
          : await getExpectedItemForTask(task);
      while (Date.now() < deadline) {
        const selectedItem = getSelectedDomItem();
        if (selectedItem && doesDomListItemMatchTask(selectedItem, task) && doesRenderedItemMatch(expected)) {
          return true;
        }
        await sleep(120);
      }
      const selectedItem = getSelectedDomItem();
      return Boolean(
        selectedItem &&
          doesDomListItemMatchTask(selectedItem, task) &&
          doesRenderedItemMatch(expected)
      );
    }

    async function getItemRecordByTask(task) {
      syncRouteKey();
      const routeParams = parseRouteParams();
      const packageEntry = await ensurePackageItems(routeParams.packageId);
      const taskItemId = normalizeText(task?.taskItemId);
      if (taskItemId) {
        const matched = packageEntry.items.find(function (item) {
          return normalizeText(item?.id) === taskItemId;
        });
        if (matched) {
          return matched;
        }
      }
      const targetIndex = Number(task?.index);
      if (Number.isInteger(targetIndex) && targetIndex >= 0) {
        return packageEntry.items[targetIndex] || null;
      }
      return null;
    }

    function buildItemFromRecord(record, routeParams, taskDetail, options, fallbackIndex) {
      const source = options && typeof options === "object" ? options : {};
      const selectedIndex = Number(fallbackIndex);
      const existingMarkText =
        source.includeCurrentInput === true ? getCurrentInputValue() : "";
      const referenceText = normalizeText(record.text) || getReferenceTextFromDom();
      const audioUrl = buildAudioUrl(taskDetail.dataRoot, record.url);
      const userMeta = getPlatformUserMetaFromPage();
      return {
        taskId: routeParams.taskId,
        packageId: routeParams.packageId,
        taskItemId: normalizeText(record.id),
        number: Number(record.number || selectedIndex + 1) || selectedIndex + 1,
        fileName: normalizeText(record.fileName),
        audioUrl: audioUrl,
        referenceText: referenceText,
        existingMarkText: existingMarkText,
        duration: null,
        spendTime: Number(record.spendTime || 0) || 0,
        dataStatus: Number(record.dataStatus || 0) || 0,
        checkStatus: Number(record.checkStatus || 0) || 0,
        platformUserName: userMeta.platformUserName,
        platformUserId: userMeta.platformUserId,
        key: [
          routeParams.taskId,
          routeParams.packageId,
          normalizeText(record.id),
          normalizeText(record.fileName),
        ].join("|"),
      };
    }

    async function getItemByIndex(index, options) {
      syncRouteKey();
      const routeParams = parseRouteParams();
      const selectedIndex = Number(index);
      if (!Number.isInteger(selectedIndex) || selectedIndex < 0) {
        return null;
      }
      const taskDetail = await ensureTaskDetail(routeParams.taskId);
      const packageEntry = await ensurePackageItems(routeParams.packageId);
      const record = packageEntry.items[selectedIndex];
      if (!record) {
        return null;
      }
      return buildItemFromRecord(record, routeParams, taskDetail, options, selectedIndex);
    }

    async function getItemByTask(task, options) {
      const routeParams = parseRouteParams();
      const taskDetail = await ensureTaskDetail(routeParams.taskId);
      const record = await getItemRecordByTask(task);
      if (!record) {
        return null;
      }
      return buildItemFromRecord(
        record,
        routeParams,
        taskDetail,
        options,
        Number(task?.index || 0) || 0
      );
    }

    async function getCurrentItem() {
      const selectedIndex = getSelectedIndex();
      if (selectedIndex < 0) {
        return null;
      }
      return getItemByIndex(selectedIndex, {
        includeCurrentInput: true,
      });
    }

    async function getBatchTasksForPackage(options) {
      syncRouteKey();
      const routeParams = parseRouteParams();
      const packageEntry = await ensurePackageItems(routeParams.packageId);
      return createBatchTasksFromPackageItems(packageEntry.items, options);
    }

    async function waitForSelectedIndex(targetIndex, timeoutMs) {
      const deadline = Date.now() + Math.max(1000, Number(timeoutMs || 5000) || 5000);
      while (Date.now() < deadline) {
        if (getSelectedIndex() === targetIndex) {
          return true;
        }
        await sleep(120);
      }
      return getSelectedIndex() === targetIndex;
    }

    async function selectItemByIndex(targetIndex, options) {
      const selectedIndex = getSelectedIndex();
      const expected =
        options?.expected && typeof options.expected === "object"
          ? options.expected
          : await getExpectedItemForIndex(targetIndex);
      if (selectedIndex === targetIndex) {
        const readyWhenAlreadySelected = await waitForItemRender(targetIndex, {
          timeoutMs: options?.timeoutMs || 5000,
          expected: expected,
        });
        return readyWhenAlreadySelected
          ? {
              ok: true,
              message: "当前条已选中且表单已对齐。",
            }
          : {
              ok: false,
              message: "当前条虽然已选中，但右侧表单没有完成切换。",
            };
      }
      const domItems = getListDomItems();
      const entry = domItems[targetIndex];
      const trigger = entry?.button;
      if (!(trigger instanceof HTMLElement)) {
        return {
          ok: false,
          message: "无法定位要切换的列表条目。",
        };
      }
      trigger.click();
      const ready = await waitForItemRender(targetIndex, {
        timeoutMs: options?.timeoutMs || 5000,
        expected: expected,
      });
      return ready
        ? { ok: true, message: "已切换到目标条目，且表单已完成加载。" }
        : { ok: false, message: "切换条目后表单长时间没有完成加载。" };
    }

    async function selectTask(task, options) {
      const expected =
        options?.expected && typeof options.expected === "object"
          ? options.expected
          : await getExpectedItemForTask(task);
      const maxAttempts = Math.max(1, Math.floor(Number(options?.maxAttempts || 3) || 3));
      const timeoutMs = Math.max(1000, Number(options?.timeoutMs || 9000) || 9000);
      const attemptTimeoutMs = Math.max(1000, Math.floor(timeoutMs / maxAttempts));
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const domEntry = findDomItemForTask(task);
        if (!(domEntry?.button instanceof HTMLElement)) {
          return {
            ok: false,
            message: "无法在左侧列表中定位目标条目。",
          };
        }
        domEntry.node?.scrollIntoView?.({
          block: "center",
          inline: "nearest",
        });
        if (domEntry.selected !== true || doesRenderedItemMatch(expected) !== true) {
          await sleep(80);
          domEntry.button.click();
        }
        const ready = await waitForTaskRender(task, {
          timeoutMs: attemptTimeoutMs,
          expected: expected,
        });
        if (ready) {
          return {
            ok: true,
            message: "已切换到目标条目，且右侧表单已与当前识别结果对齐。",
          };
        }
        await sleep(160);
      }
      const selectedItem = getSelectedDomItem();
      if (selectedItem && doesDomListItemMatchTask(selectedItem, task)) {
        return {
          ok: false,
          message: "当前条虽然已选中，但右侧表单还没有完成切换。",
        };
      }
      return {
        ok: false,
        message: "切换条目后右侧表单长时间没有完成加载。",
      };
    }

    function start() {
      syncRouteKey();
    }

    function canFillPageText() {
      return getTextInput() instanceof HTMLInputElement;
    }

    function fillPageText(text) {
      const input = getTextInput();
      if (!(input instanceof HTMLInputElement)) {
        return {
          ok: false,
          message: "当前页面没有定位到可编辑文本框。",
        };
      }
      const nextValue = ensureChineseSentencePunctuation(removeTextSpaces(text));
      if (!nextValue) {
        return {
          ok: false,
          message: "没有可填入的推荐文本。",
        };
      }
      input.focus();
      input.value = nextValue;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return {
        ok: true,
        message: "已填入当前条文本框，请人工复核后决定是否保存。",
      };
    }

    async function clickSaveAndWait(options) {
      const expectedText = normalizeMarkCompareText(options?.expectedText || "");
      const taskItemId = normalizeText(options?.taskItemId);
      const packageId = normalizeText(options?.packageId);
      const previousIndex = Number.isInteger(Number(options?.selectedIndex))
        ? Number(options.selectedIndex)
        : getSelectedIndex();
      if (!taskItemId || !packageId) {
        return {
          ok: false,
          message: "当前保存缺少必要参数。",
        };
      }
      const saveButton = getSaveButton();
      if (!(saveButton instanceof HTMLButtonElement)) {
        return {
          ok: false,
          message: "当前页面没有定位到平台“保存”按钮。",
        };
      }
      if (saveButton.disabled === true) {
        return {
          ok: false,
          message: "平台“保存”按钮当前不可用，请先确认页面已完成填入。",
        };
      }
      const previousMessages = new Set(getToastMessageNodes());
      const clicked = triggerNativeSaveButton(saveButton);
      if (clicked !== true) {
        return {
          ok: false,
          message: "未能触发平台“保存”按钮。",
        };
      }
      const deadline = Date.now() + Math.max(3000, Number(options?.timeoutMs || 15000) || 15000);
      let networkCheckAt = 0;
      while (Date.now() < deadline) {
        const toastMessage = findNewToastMessage(previousMessages);
        if (toastMessage?.success === true) {
          return {
            ok: true,
            message: "已触发平台真实保存按钮，并检测到页面提示“保存成功！”。",
          };
        }
        if (toastMessage?.error === true) {
          return {
            ok: false,
            message: toastMessage.text || "平台保存失败，请检查页面提示。",
          };
        }
        if (isSaveCompletionState(previousIndex, captureListState(previousIndex))) {
          return {
            ok: true,
            message: "已触发平台真实保存按钮，并检测到列表条目已切换完成。",
          };
        }
        const now = Date.now();
        if (now - networkCheckAt >= 450) {
          networkCheckAt = now;
          try {
            const shortMarkResult = await getShortMarkResult(taskItemId);
            const savedText = extractSavedMarkText(shortMarkResult);
            if (savedText && normalizeMarkCompareText(savedText) === expectedText) {
              return {
                ok: true,
                message: "已触发平台真实保存按钮，并确认平台已保存当前文本。",
              };
            }
          } catch (_error) {}
          try {
            const packageEntry = await refreshPackageItems(packageId);
            const matchedRecord = Array.isArray(packageEntry?.items)
              ? packageEntry.items.find(function (item) {
                  return normalizeText(item?.id) === taskItemId;
                })
              : null;
            if (isPackageItemSaved(matchedRecord)) {
              return {
                ok: true,
                message: "已触发平台真实保存按钮，并检测到平台条目状态已更新为已标注。",
              };
            }
          } catch (_error) {}
        }
        await sleep(150);
      }
      return {
        ok: false,
        message: "触发平台保存后未能确认成功状态，请检查页面提示或平台请求结果。",
      };
    }

    async function fillAndSaveCurrent(text, options) {
      const currentItem = await getCurrentItem();
      if (!currentItem?.taskItemId) {
        return {
          ok: false,
          message: "当前没有可保存的条目上下文。",
        };
      }
      const fillResult = fillPageText(text);
      if (fillResult?.ok === false) {
        return fillResult;
      }
      const normalizedText = normalizeMarkCompareText(text);
      await sleep(Number(options?.postFillDelayMs || 120) || 120);
      return clickSaveAndWait({
        timeoutMs: options?.timeoutMs || 15000,
        expectedText: normalizedText,
        taskItemId: currentItem.taskItemId,
        packageId: currentItem.packageId,
        selectedIndex: getSelectedIndex(),
      });
    }

    function stop() {
      clearRouteCache();
    }

    return {
      canFillPageText,
      clickSaveAndWait,
      createBatchTasksFromPackageItems,
      createRateLimitedTaskScheduler,
      buildSaveShortMarkPayload,
      doesRenderedItemMatch,
      extractSavedMarkText,
      fillPageText,
      fillAndSaveCurrent,
      getBatchTasksForPackage,
      getCurrentItem,
      getItemByIndex,
      getItemByTask,
      getRecordDisplayName,
      getSelectedIndex,
      isMarkPage,
      parseRouteParams,
      selectItemByIndex,
      selectTask,
      start,
      stop,
    };
  }

  const api = {
    createRateLimitedTaskScheduler,
    createRuntime,
    buildSaveShortMarkPayload,
    createBatchTasksFromPackageItems,
    doesDomListItemMatchTask,
    doesListFileHintMatch,
    doesRenderedItemMatch,
    ensureChineseSentencePunctuation,
    extractPlatformAccountName,
    extractFileNameLineText,
    extractSavedMarkText,
    extractAuthTokenFromUnknown,
    findPlatformAccountNameFromDocument,
    findAuthTokenInEntries,
    isSaveCompletionState,
    isMarkPage,
    parseRouteParams,
    parseListItemLabel,
    readStorageEntries,
    removeTextSpaces,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalThis.__ASREdgeAishellTechMinnanDataApi = api;
})();

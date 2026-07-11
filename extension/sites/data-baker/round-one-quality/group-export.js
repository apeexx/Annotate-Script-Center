(function () {
  const ROOT_ATTR = "data-asr-edge-databaker-group-export";
  const STYLE_ID = "asr-edge-databaker-group-export-style";
  const STATUS_POLL_MS = 1000;
  const SOURCE = "ASR_EDGE_DATABAKER_ROUND_ONE_QUALITY_PAGE";
  const GROUP_MESSAGE_TYPE = "DATABAKER_ROUND_ONE_QUALITY_GROUP_QUERY_RESPONSE";
  const GROUP_QUERY_PATH = "/cms/tbAudioUserTask/queryByCondition";
  const TARGET_PAGE_SIZE = 100;
  const WAIT_RESPONSE_TIMEOUT_MS = 12000;
  const MAX_EXPORT_PAGES = 10000;
  const UPLOAD_TIMEOUT_MS = 20000;
  const MAX_UPLOAD_CSV_BYTES = 20 * 1024 * 1024;

  const CSV_COLUMNS = [
    { title: "任务ID", keys: ["taskId"] },
    { title: "项目名称", keys: ["projectName"] },
    { title: "任务名称", keys: ["taskName"] },
    { title: "团队名称", keys: ["teamName"] },
    { title: "采集人", keys: ["userName", "collectName"] },
    { title: "手机号", keys: ["mobile"] },
    { title: "年龄", keys: ["collectAge"] },
    { title: "性别", keys: ["collectSexName", "collectSex"] },
    { title: "省", keys: ["collectProvince"] },
    { title: "市", keys: ["collectCity"] },
    { title: "区县", keys: ["collectTown"] },
    { title: "文本编号", keys: ["textNumber"] },
    { title: "文本数量", keys: ["audioTextNum"] },
    { title: "上传音频数", keys: ["uploadAudioNum"] },
    { title: "状态", keys: ["statusName", "status"] },
    { title: "驳回类型", keys: ["noPassType"] },
    { title: "质检人_P", keys: ["checkName"] },
    { title: "质检时间", keys: ["checkTime"] },
    { title: "提交时间", keys: ["submitTime"] },
    { title: "更新时间", keys: ["updateTime"] },
    { title: "有效总时长", keys: ["effectiveTotalTime"] },
    { title: "有效合格时长_S", keys: ["effectivePassTotalTime"] },
    { title: "有效不合格时长", keys: ["effectiveNoPassTotalTime"] },
    { title: "文件名", keys: ["fileName"] },
    { title: "段编号", keys: ["segmentNumber"] },
    { title: "手机型号", keys: ["phoneModel"] },
    { title: "版本", keys: ["version"] },
    { title: "质检驳回原因", keys: ["checkRejectReason"] },
    { title: "验收驳回原因", keys: ["acceptCheckRejectReason"] },
  ];

  const SENSITIVE_KEYWORDS = ["token", "cookie", "authorization", "signature", "ossaccesskeyid"];
  const CONSTANTS = globalThis.ASREdgeConstants || {};
  const BACKEND_MODE_LOCAL = CONSTANTS.BACKEND_ENDPOINT_MODE_LOCAL || "local";
  const DATABAKER_EXPORT_UPLOAD_PATH =
    CONSTANTS.DATABAKER_EXPORT_UPLOAD_PATH || "/api/data-baker/round-one-quality/export/upload";
  const DATABAKER_EXPORT_DOWNLOAD_PATH =
    CONSTANTS.DATABAKER_EXPORT_DOWNLOAD_PATH || "/api/data-baker/round-one-quality/export/download";

  let root = null;
  let statusNode = null;
  let exportButton = null;
  let evaluating = false;
  let pending = false;
  let observer = null;
  let observerTimer = null;
  let exportInProgress = false;
  let exportState = null;
  let latestGroupQueryPayload = null;

  const responseWaiters = [];

  function normalizeText(value) {
    return String(value || "").trim();
  }

  function sleep(ms) {
    return new Promise(function (resolve) {
      window.setTimeout(resolve, Math.max(0, Number(ms) || 0));
    });
  }

  function toPositiveInt(value, fallbackValue) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallbackValue;
    }
    return Math.floor(parsed);
  }

  function parseHashRoute() {
    const hash = String(location.hash || "");
    const cleaned = hash.startsWith("#") ? hash.slice(1) : hash;
    const pathAndQuery = cleaned.startsWith("/") ? cleaned : "/" + cleaned;
    const queryIndex = pathAndQuery.indexOf("?");
    const pathname = queryIndex >= 0 ? pathAndQuery.slice(0, queryIndex) : pathAndQuery;
    const queryString = queryIndex >= 0 ? pathAndQuery.slice(queryIndex + 1) : "";
    return {
      pathname: pathname,
      params: new URLSearchParams(queryString),
    };
  }

  function isGroupDetailPage() {
    const route = parseHashRoute();
    return route.pathname.indexOf("/group/detail") >= 0;
  }

  function readTaskId() {
    const route = parseHashRoute();
    return normalizeText(route.params.get("taskId"));
  }

  function isElementVisible(element) {
    if (!element || typeof element.getBoundingClientRect !== "function") {
      return false;
    }
    const style = window.getComputedStyle(element);
    if (!style || style.display === "none" || style.visibility === "hidden") {
      return false;
    }
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function isElementDisabled(element) {
    if (!element) {
      return true;
    }
    const anyElement = element;
    if (anyElement.disabled === true) {
      return true;
    }
    if (normalizeText(element.getAttribute("aria-disabled")) === "true") {
      return true;
    }
    const className = normalizeText(element.className || "");
    return className.indexOf("is-disabled") >= 0 || className.indexOf("disabled") >= 0;
  }

  function getGroupCacheEntries() {
    const cache = window.__ASREdgeDataBakerRoundOneGroupQueryCache;
    if (!cache || !Array.isArray(cache.entries)) {
      return [];
    }
    return cache.entries;
  }

  async function loadScriptEnabled() {
    const storage = globalThis.ASREdgeStorage || null;
    if (!storage || typeof storage.getSettings !== "function") {
      return true;
    }
    try {
      const settings = await storage.getSettings();
      const platformEnabled = settings?.platforms?.dataBaker?.enabled !== false;
      const scriptEnabled =
        settings?.platforms?.dataBaker?.scripts?.roundOneQuality?.enabled !== false;
      return platformEnabled && scriptEnabled;
    } catch (error) {
      return true;
    }
  }

  async function loadExtensionSettings() {
    const storage = globalThis.ASREdgeStorage || null;
    if (!storage || typeof storage.getSettings !== "function") {
      return {};
    }
    try {
      return (await storage.getSettings()) || {};
    } catch (error) {
      return {};
    }
  }

  function normalizeBackendMode(value) {
    const text = normalizeText(value).toLowerCase();
    return text === BACKEND_MODE_LOCAL ? BACKEND_MODE_LOCAL : "server";
  }

  function getBackendMode(settings) {
    if (typeof CONSTANTS.getBackendEndpointModeFromSettings === "function") {
      return normalizeBackendMode(CONSTANTS.getBackendEndpointModeFromSettings(settings || {}));
    }
    return normalizeBackendMode(settings?.meta?.backendEndpointMode);
  }

  function buildBackendUrl(path, settings) {
    if (typeof CONSTANTS.buildBackendUrl === "function") {
      const built = normalizeText(CONSTANTS.buildBackendUrl(path, settings || {}));
      if (built) {
        return built;
      }
    }
    const mode = getBackendMode(settings || {});
    const baseUrl =
      mode === BACKEND_MODE_LOCAL
        ? CONSTANTS.DEFAULT_BACKEND_BASE_URLS?.local
        : CONSTANTS.DEFAULT_BACKEND_BASE_URLS?.server;
    const normalizedPath = String(path || "").startsWith("/") ? String(path || "") : "/" + String(path || "");
    return String(baseUrl || "").replace(/\/+$/, "") + normalizedPath;
  }

  function buildDataBakerExportUploadUrl(settings) {
    return buildBackendUrl(DATABAKER_EXPORT_UPLOAD_PATH, settings || {});
  }

  function buildDataBakerExportDownloadUrl(settings) {
    return buildBackendUrl(DATABAKER_EXPORT_DOWNLOAD_PATH, settings || {});
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      "[" + ROOT_ATTR + "] {",
      "  position: fixed;",
      "  right: 16px;",
      "  bottom: 20px;",
      "  z-index: 2147483647;",
      "  min-width: 260px;",
      "  max-width: 380px;",
      "  padding: 10px 12px;",
      "  border-radius: 8px;",
      "  border: 1px solid #bfdbfe;",
      "  background: #f8fbff;",
      "  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.14);",
      "  font-size: 12px;",
      "  color: #1f2937;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-db-export-title {",
      "  margin: 0 0 6px;",
      "  font-weight: 700;",
      "  color: #1d4ed8;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-db-export-btn {",
      "  width: 100%;",
      "  height: 30px;",
      "  border-radius: 6px;",
      "  border: 1px solid #1d4ed8;",
      "  background: #1d4ed8;",
      "  color: #fff;",
      "  cursor: pointer;",
      "  font-weight: 700;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-db-export-btn:disabled {",
      "  opacity: 0.65;",
      "  cursor: not-allowed;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-db-export-status {",
      "  margin-top: 8px;",
      "  min-height: 16px;",
      "  color: #475569;",
      "  white-space: pre-wrap;",
      "  overflow-wrap: anywhere;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-db-export-status[data-tone='error'] { color: #b91c1c; }",
      "[" + ROOT_ATTR + "] .asr-edge-db-export-status[data-tone='success'] { color: #047857; }",
    ].join("\n");
    (document.head || document.documentElement).appendChild(style);
  }

  function setStatus(message, tone) {
    if (!statusNode) {
      return;
    }
    statusNode.textContent = String(message || "");
    statusNode.setAttribute("data-tone", String(tone || "info"));
  }

  function extractPayloadTaskId(payload) {
    return normalizeText(
      payload?.params?.taskId ||
        payload?.records?.[0]?.taskId ||
        payload?.rawData?.taskId ||
        ""
    );
  }

  function readPayloadPageNum(payload) {
    return toPositiveInt(payload?.pageNum, toPositiveInt(payload?.params?.pageNum, 1));
  }

  function readPayloadPageSize(payload) {
    return toPositiveInt(payload?.pageSize, toPositiveInt(payload?.params?.pageSize, 10));
  }

  function isPayloadMatch(payload, options) {
    if (!payload || payload.path !== GROUP_QUERY_PATH) {
      return false;
    }
    const at = Number(payload?.at || 0);
    if (at < Number(options?.afterTime || 0)) {
      return false;
    }

    const expectedTaskId = normalizeText(options?.taskId);
    const payloadTaskId = extractPayloadTaskId(payload);
    if (expectedTaskId && payloadTaskId && expectedTaskId !== payloadTaskId) {
      return false;
    }

    const expectedPageNum = toPositiveInt(options?.pageNum, 0);
    if (expectedPageNum > 0 && readPayloadPageNum(payload) !== expectedPageNum) {
      return false;
    }

    const expectedPageSize = toPositiveInt(options?.pageSize, 0);
    if (expectedPageSize > 0 && readPayloadPageSize(payload) !== expectedPageSize) {
      return false;
    }

    return true;
  }

  function findMatchedPayloadFromCache(options) {
    if (isPayloadMatch(latestGroupQueryPayload, options)) {
      return latestGroupQueryPayload;
    }

    const entries = getGroupCacheEntries();
    for (let index = 0; index < entries.length; index += 1) {
      if (isPayloadMatch(entries[index], options)) {
        return entries[index];
      }
    }
    return null;
  }

  function rejectAllWaiters(reason) {
    while (responseWaiters.length > 0) {
      const waiter = responseWaiters.pop();
      if (!waiter) {
        continue;
      }
      window.clearTimeout(waiter.timer);
      waiter.reject(new Error(reason || "导出已取消。"));
    }
  }

  function waitForGroupQueryResponse(options) {
    const timeoutMs = Math.max(1000, Number(options?.timeoutMs) || WAIT_RESPONSE_TIMEOUT_MS);
    const immediate = findMatchedPayloadFromCache(options);
    if (immediate) {
      return Promise.resolve(immediate);
    }

    return new Promise(function (resolve, reject) {
      const waiter = {
        options: options || {},
        resolve: resolve,
        reject: reject,
        timer: window.setTimeout(function () {
          const index = responseWaiters.indexOf(waiter);
          if (index >= 0) {
            responseWaiters.splice(index, 1);
          }
          const pageNum = toPositiveInt(options?.pageNum, 0);
          if (pageNum > 0) {
            reject(new Error("未捕获到第 " + String(pageNum) + " 页平台响应，请确认页面分页控件可用。"));
            return;
          }
          reject(new Error("未捕获到平台 queryByCondition 响应，请确认页面可正常查询后重试。"));
        }, timeoutMs),
      };
      responseWaiters.push(waiter);
    });
  }

  function notifyWaiters(payload) {
    latestGroupQueryPayload = payload;
    for (let index = responseWaiters.length - 1; index >= 0; index -= 1) {
      const waiter = responseWaiters[index];
      if (!isPayloadMatch(payload, waiter.options)) {
        continue;
      }
      responseWaiters.splice(index, 1);
      window.clearTimeout(waiter.timer);
      waiter.resolve(payload);
    }
  }

  function clickElement(element) {
    if (!element) {
      return false;
    }

    try {
      dispatchMouseClick(element);
      if (typeof element.click === "function") {
        element.click();
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  function dispatchMouseClick(element) {
    if (!element) {
      return false;
    }
    const eventTypes = ["mousedown", "mouseup", "click"];
    for (let index = 0; index < eventTypes.length; index += 1) {
      element.dispatchEvent(
        new MouseEvent(eventTypes[index], {
          bubbles: true,
          cancelable: true,
          view: window,
        })
      );
    }
    return true;
  }

  function findGroupPagination() {
    const nodes = Array.from(document.querySelectorAll(".el-pagination"));
    const visible = [];
    const preferred = [];

    for (let index = 0; index < nodes.length; index += 1) {
      const node = nodes[index];
      if (!isElementVisible(node)) {
        continue;
      }
      visible.push(node);
      const totalNode = node.querySelector(".el-pagination__total");
      if (!totalNode) {
        continue;
      }
      const totalText = normalizeText(totalNode.textContent || "");
      if (totalText.indexOf("共") < 0) {
        continue;
      }
      preferred.push(node);
    }

    if (preferred.length > 0) {
      return preferred[preferred.length - 1];
    }
    if (visible.length === 0) {
      return null;
    }
    return visible[visible.length - 1];
  }

  function findPageSizeSelect(pagination) {
    if (!pagination) {
      return null;
    }
    return pagination.querySelector(".el-pagination__sizes .el-select");
  }

  function readPaginationCurrentPageSize(pagination) {
    if (!pagination) {
      return "";
    }
    const input = pagination.querySelector(".el-pagination__sizes .el-input__inner");
    return normalizeText(input?.value || input?.getAttribute("value") || input?.textContent || "");
  }

  function isPageSize100Text(text) {
    return normalizeText(text).replace(/\s+/g, "") === "100条/页";
  }

  function isPageSizeDropdown(dropdown, targetText) {
    if (!dropdown || !isElementVisible(dropdown)) {
      return false;
    }
    const optionNodes = Array.from(dropdown.querySelectorAll(".el-select-dropdown__item span"));
    if (optionNodes.length === 0) {
      return false;
    }

    const normalizedTarget = normalizeText(targetText).replace(/\s+/g, "");
    const texts = optionNodes.map(function (node) {
      return normalizeText(node.textContent || "").replace(/\s+/g, "");
    });
    if (texts.indexOf(normalizedTarget) < 0) {
      return false;
    }

    const required = ["10条/页", "20条/页", "50条/页", "100条/页"];
    let matched = 0;
    for (let index = 0; index < required.length; index += 1) {
      if (texts.indexOf(required[index]) >= 0) {
        matched += 1;
      }
    }
    return matched >= 3;
  }

  function findVisiblePageSizeOption(targetText) {
    const dropdowns = Array.from(document.querySelectorAll(".el-select-dropdown.el-popper"));
    const matchedDropdowns = [];
    for (let index = 0; index < dropdowns.length; index += 1) {
      const dropdown = dropdowns[index];
      if (!isPageSizeDropdown(dropdown, targetText)) {
        continue;
      }
      matchedDropdowns.push(dropdown);
    }
    if (matchedDropdowns.length === 0) {
      return null;
    }

    const selectedDropdown = matchedDropdowns[matchedDropdowns.length - 1];
    const optionNodes = Array.from(selectedDropdown.querySelectorAll(".el-select-dropdown__item"));
    const normalizedTarget = normalizeText(targetText).replace(/\s+/g, "");
    for (let index = 0; index < optionNodes.length; index += 1) {
      const optionNode = optionNodes[index];
      if (!isElementVisible(optionNode) || isElementDisabled(optionNode)) {
        continue;
      }
      const text = normalizeText(optionNode.textContent || "").replace(/\s+/g, "");
      if (text === normalizedTarget) {
        return optionNode;
      }
    }
    return null;
  }

  function openPageSizeDropdown(select) {
    if (!select) {
      return false;
    }
    const preferredTargets = [
      ".el-input.el-input--mini.el-input--suffix",
      ".el-input",
      ".el-input__inner",
    ];

    for (let index = 0; index < preferredTargets.length; index += 1) {
      const target = select.querySelector(preferredTargets[index]);
      if (!target || !isElementVisible(target)) {
        continue;
      }
      dispatchMouseClick(target);
      return true;
    }

    dispatchMouseClick(select);
    return true;
  }

  function clickPageSizeOption(option) {
    if (!option) {
      return false;
    }
    dispatchMouseClick(option);
    const span = option.querySelector("span");
    if (span) {
      dispatchMouseClick(span);
      if (typeof span.click === "function") {
        span.click();
      }
    }
    if (typeof option.click === "function") {
      option.click();
    }
    return true;
  }

  async function waitForPageSizeOption(targetText, timeoutMs) {
    const safeTimeout = Math.max(200, Number(timeoutMs) || 2500);
    const startedAt = Date.now();
    while (Date.now() - startedAt < safeTimeout) {
      const option = findVisiblePageSizeOption(targetText);
      if (option) {
        return option;
      }
      await sleep(80);
    }
    return null;
  }

  async function setPageSizeTo100(taskId) {
    const statusPrefix = buildTaskStatusPrefix(taskId);
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const pagination = findGroupPagination();
      if (!pagination) {
        throw new Error("未找到分页控件，请确认当前页面已加载表格。");
      }
      const pageSizeSelect = findPageSizeSelect(pagination);
      if (!pageSizeSelect) {
        throw new Error("未找到每页条数选择器，请确认页面分页控件可用。");
      }

      const currentPageSizeText = readPaginationCurrentPageSize(pagination);
      if (isPageSize100Text(currentPageSizeText)) {
        setStatus(statusPrefix + "\n已切换到100条/页。", "info");
        return true;
      }

      setStatus(statusPrefix + "\n正在展开每页条数下拉...", "info");
      const opened = openPageSizeDropdown(pageSizeSelect);
      if (!opened) {
        continue;
      }

      const option = await waitForPageSizeOption("100条/页", 2500);
      if (!option) {
        await sleep(80);
        continue;
      }

      setStatus(statusPrefix + "\n正在切换到100条/页...", "info");
      const afterTime = Date.now();
      clickPageSizeOption(option);
      setStatus(statusPrefix + "\n已选择100条/页，正在等待平台响应...", "info");

      const payload = await waitForGroupQueryResponse({
        taskId: taskId,
        pageSize: TARGET_PAGE_SIZE,
        afterTime: afterTime,
        timeoutMs: WAIT_RESPONSE_TIMEOUT_MS,
      }).catch(function () {
        return null;
      });

      if (payload) {
        setStatus(statusPrefix + "\n已切换到100条/页。", "info");
        return true;
      }

      const afterSwitchText = readPaginationCurrentPageSize(pagination);
      if (isPageSize100Text(afterSwitchText)) {
        setStatus(statusPrefix + "\n已切换到100条/页，等待后续分页响应。", "info");
        return true;
      }
    }

    throw new Error("无法展开每页条数下拉或未找到100条/页，请手动切换到100条/页后重试。");
  }

  function readActivePageNum(pagination) {
    if (!pagination) {
      return 0;
    }
    const active = pagination.querySelector(".el-pager li.number.active, .el-pager li.active");
    if (!active) {
      return 0;
    }
    return toPositiveInt(normalizeText(active.textContent || ""), 0);
  }

  function setNativeInputValue(input, value) {
    if (!input) {
      return;
    }
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    const setter = descriptor && descriptor.set;
    if (setter) {
      setter.call(input, String(value));
      return;
    }
    input.value = String(value);
  }

  function triggerJumpInputToPage(pagination, pageNum) {
    const jumpInput = pagination?.querySelector(".el-pagination__jump input.el-input__inner");
    if (!jumpInput || !isElementVisible(jumpInput) || isElementDisabled(jumpInput)) {
      return false;
    }

    jumpInput.focus();
    setNativeInputValue(jumpInput, pageNum);
    jumpInput.dispatchEvent(new Event("input", { bubbles: true }));
    jumpInput.dispatchEvent(new Event("change", { bubbles: true }));
    jumpInput.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true,
      })
    );
    jumpInput.dispatchEvent(
      new KeyboardEvent("keyup", {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true,
      })
    );
    jumpInput.blur();
    return true;
  }

  function triggerClickPagerNumber(pagination, pageNum) {
    const numbers = Array.from(pagination?.querySelectorAll(".el-pager li.number") || []);
    for (let index = 0; index < numbers.length; index += 1) {
      const node = numbers[index];
      const value = toPositiveInt(normalizeText(node.textContent || ""), 0);
      if (value !== pageNum) {
        continue;
      }
      if (!isElementVisible(node) || isElementDisabled(node)) {
        continue;
      }
      return clickElement(node);
    }
    return false;
  }

  function triggerClickNextPage(pagination, pageNum) {
    const current = readActivePageNum(pagination);
    if (current + 1 !== pageNum) {
      return false;
    }
    const nextButton = pagination.querySelector("button.btn-next");
    if (!nextButton || !isElementVisible(nextButton) || isElementDisabled(nextButton)) {
      return false;
    }
    return clickElement(nextButton);
  }

  function triggerClickCurrentPageToRefresh(pagination) {
    const active = pagination?.querySelector(".el-pager li.number.active, .el-pager li.active");
    if (!active || !isElementVisible(active) || isElementDisabled(active)) {
      return false;
    }
    return clickElement(active);
  }

  function findQueryButton() {
    const nodes = Array.from(document.querySelectorAll("button, .el-button"));
    let best = null;

    for (let index = 0; index < nodes.length; index += 1) {
      const node = nodes[index];
      const text = normalizeText(node.textContent || "").replace(/\s+/g, "");
      if (text !== "查询") {
        continue;
      }
      if (!isElementVisible(node) || isElementDisabled(node)) {
        continue;
      }

      let score = 0;
      if (String(node.className || "").indexOf("el-button--primary") >= 0) {
        score += 3;
      }
      if (node.closest && node.closest(".filter-screen")) {
        score += 2;
      }
      if (node.tagName === "BUTTON") {
        score += 1;
      }

      if (!best || score > best.score) {
        best = { score: score, element: node };
      }
    }

    return best ? best.element : null;
  }

  async function goToPage(taskId, pageNum, pageSize) {
    const pagination = findGroupPagination();
    if (!pagination) {
      throw new Error("未找到分页控件，请确认页面已加载后重试。");
    }

    const strategies = [
      {
        run: function () {
          return triggerJumpInputToPage(pagination, pageNum);
        },
      },
      {
        run: function () {
          return triggerClickPagerNumber(pagination, pageNum);
        },
      },
      {
        run: function () {
          return triggerClickNextPage(pagination, pageNum);
        },
      },
      {
        run: function () {
          return triggerClickCurrentPageToRefresh(pagination);
        },
      },
      {
        run: function () {
          const button = findQueryButton();
          if (!button) {
            return false;
          }
          return clickElement(button);
        },
      },
    ];

    let lastError = null;
    for (let index = 0; index < strategies.length; index += 1) {
      const strategy = strategies[index];
      const afterTime = Date.now();
      const triggered = strategy.run();
      if (!triggered) {
        continue;
      }
      try {
        const payload = await waitForGroupQueryResponse({
          taskId: taskId,
          pageNum: pageNum,
          pageSize: pageSize,
          afterTime: afterTime,
          timeoutMs: WAIT_RESPONSE_TIMEOUT_MS,
        });
        return payload;
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError) {
      throw lastError;
    }
    throw new Error("无法驱动分页跳转到第 " + String(pageNum) + " 页，请手动切页后重试。");
  }

  function redactUrlString(value) {
    const text = normalizeText(value);
    if (!/^https?:\/\//i.test(text)) {
      return value;
    }
    try {
      const parsed = new URL(text);
      return "[url:" + parsed.hostname + "]";
    } catch (error) {
      return "[url-redacted]";
    }
  }

  function shouldDropKey(key) {
    const lowerKey = normalizeText(key).toLowerCase();
    if (!lowerKey) {
      return false;
    }
    for (let index = 0; index < SENSITIVE_KEYWORDS.length; index += 1) {
      if (lowerKey.indexOf(SENSITIVE_KEYWORDS[index]) >= 0) {
        return true;
      }
    }
    return false;
  }

  function sanitizeValue(value, key) {
    if (shouldDropKey(key)) {
      return undefined;
    }

    if (Array.isArray(value)) {
      const result = [];
      for (let index = 0; index < value.length; index += 1) {
        const sanitized = sanitizeValue(value[index], key);
        if (sanitized !== undefined) {
          result.push(sanitized);
        }
      }
      return result;
    }

    if (value && typeof value === "object") {
      const output = {};
      const objectKeys = Object.keys(value);
      for (let index = 0; index < objectKeys.length; index += 1) {
        const objectKey = objectKeys[index];
        const sanitized = sanitizeValue(value[objectKey], objectKey);
        if (sanitized !== undefined) {
          output[objectKey] = sanitized;
        }
      }
      return output;
    }

    if (typeof value === "string") {
      return redactUrlString(value);
    }

    return value;
  }

  function sanitizeRawJsonRecord(row) {
    try {
      return sanitizeValue(row, "") || {};
    } catch (error) {
      return {};
    }
  }

  function readFieldValue(row, keys) {
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index];
      const value = row ? row[key] : "";
      if (value !== undefined && value !== null && String(value) !== "") {
        if (typeof value === "string") {
          return redactUrlString(value);
        }
        return value;
      }
    }
    return "";
  }

  function toCsvCell(value) {
    if (value === undefined || value === null) {
      return "";
    }
    const text = String(value);
    if (text.indexOf("\"") >= 0 || text.indexOf(",") >= 0 || text.indexOf("\n") >= 0) {
      return "\"" + text.replace(/\"/g, "\"\"") + "\"";
    }
    return text;
  }

  function buildCsv(rows) {
    const headers = CSV_COLUMNS.map(function (column) {
      return column.title;
    });
    const lines = [headers.map(toCsvCell).join(",")];

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index] || {};
      const values = CSV_COLUMNS.map(function (column) {
        return readFieldValue(row, column.keys);
      });
      lines.push(values.map(toCsvCell).join(","));
    }

    return lines.join("\n");
  }

  function buildRawRecords(rows) {
    const list = Array.isArray(rows) ? rows : [];
    return list.map(function (row) {
      return sanitizeRawJsonRecord(row);
    });
  }

  function estimateCsvRowCount(csvText) {
    const text = String(csvText || "");
    if (!text) {
      return 0;
    }
    const lines = text.split(/\r?\n/).filter(function (line) {
      return line.trim() !== "";
    });
    if (lines.length <= 1) {
      return 0;
    }
    return lines.length - 1;
  }

  function readSummaryField(rows, keys) {
    const keyList = Array.isArray(keys) ? keys : [];
    const list = Array.isArray(rows) ? rows : [];
    for (let rowIndex = 0; rowIndex < list.length; rowIndex += 1) {
      const row = list[rowIndex] || {};
      for (let keyIndex = 0; keyIndex < keyList.length; keyIndex += 1) {
        const key = keyList[keyIndex];
        const value = normalizeText(row[key]);
        if (value) {
          return value;
        }
      }
    }
    return "";
  }

  function buildExportSummary(rows) {
    return {
      projectName: readSummaryField(rows, ["projectName"]),
      taskName: readSummaryField(rows, ["taskName"]),
      teamName: readSummaryField(rows, ["teamName"]),
      collectCount: Array.isArray(rows) ? rows.length : 0,
    };
  }

  function buildExportUploadPayload(csvText, rows, meta) {
    const taskId = normalizeText(meta?.taskId);
    const fileName = normalizeText(meta?.fileName);
    const rowCount = Array.isArray(rows) ? rows.length : estimateCsvRowCount(csvText);
    const summary = buildExportSummary(rows);
    return {
      schemaVersion: 1,
      source: "extension/sites/data-baker/round-one-quality/group-export",
      project: "data-baker/round-one-quality",
      exportedAt: new Date().toISOString(),
      fileName: fileName || "data-baker-round-one-quality-export.csv",
      csvText: String(csvText || ""),
      rawRecords: buildRawRecords(rows),
      rowCount: rowCount,
      taskId: taskId,
      route: {
        hash: String(location.hash || ""),
        pathname: parseHashRoute().pathname,
      },
      summary: summary,
    };
  }

  async function uploadExportCsvToBackend(csvText, rows, meta) {
    const payload = buildExportUploadPayload(csvText, rows, meta || {});
    const csvContent = String(payload.csvText || "");
    const csvBytes =
      typeof TextEncoder === "function"
        ? new TextEncoder().encode(csvContent).length
        : encodeURIComponent(csvContent).replace(/%[A-F\d]{2}/gi, "U").length;
    if (csvBytes <= 0) {
      return {
        success: false,
        message: "导出 CSV 为空，已跳过后端上传。",
      };
    }
    if (csvBytes > MAX_UPLOAD_CSV_BYTES) {
      return {
        success: false,
        message: "导出 CSV 超过 20MB，已跳过后端上传。",
      };
    }

    const settings = await loadExtensionSettings();
    const uploadUrl = buildDataBakerExportUploadUrl(settings);
    const fallbackDownloadUrl = buildDataBakerExportDownloadUrl(settings);
    if (!uploadUrl) {
      return {
        success: false,
        message: "未解析出后端上传地址，已跳过后端上传。",
      };
    }

    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timeoutId = window.setTimeout(function () {
      if (controller) {
        controller.abort();
      }
    }, UPLOAD_TIMEOUT_MS);

    try {
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller ? controller.signal : undefined,
      });
      const bodyText = await response.text();
      let body = {};
      try {
        body = bodyText ? JSON.parse(bodyText) : {};
      } catch (error) {
        body = {};
      }
      if (!response.ok || body?.success !== true) {
        const summary = normalizeText(body?.message || response.statusText || "上传失败");
        return {
          success: false,
          message: "后端上传失败（HTTP " + String(response.status) + "）：" + summary,
        };
      }

      const data = body?.data && typeof body.data === "object" ? body.data : {};
      const downloadUrl = normalizeText(data.downloadUrl) || fallbackDownloadUrl;
      return {
        success: true,
        downloadUrl: downloadUrl,
        fileName: normalizeText(data.fileName) || payload.fileName,
        rowCount: Number(data.rowCount) || payload.rowCount,
      };
    } catch (error) {
      const message = normalizeText(error?.message || "网络异常");
      return {
        success: false,
        message: "后端上传失败：" + message,
      };
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function formatTimeStamp(date) {
    return (
      String(date.getFullYear()) +
      pad2(date.getMonth() + 1) +
      pad2(date.getDate()) +
      "-" +
      pad2(date.getHours()) +
      pad2(date.getMinutes()) +
      pad2(date.getSeconds())
    );
  }

  function triggerCsvDownload(fileName, csvText) {
    const withBom = "\uFEFF" + String(csvText || "");
    const blob = new Blob([withBom], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function createExportState(taskId) {
    return {
      exportSessionId: String(Date.now()) + "-" + String(Math.floor(Math.random() * 1000000)),
      expectedTaskId: normalizeText(taskId),
      expectedPageSize: TARGET_PAGE_SIZE,
      capturedPages: new Map(),
      capturedTotal: 0,
      capturedPagesCount: 0,
      latestGroupQueryPayload: null,
    };
  }

  function updateCapturedPages(state, payload) {
    if (!state || !payload) {
      return;
    }
    const records = Array.isArray(payload?.records) ? payload.records : [];
    const pageNum = readPayloadPageNum(payload);
    if (pageNum > 0) {
      state.capturedPages.set(pageNum, records);
      state.capturedPagesCount = state.capturedPages.size;
    }
    state.latestGroupQueryPayload = payload;
    const total = toPositiveInt(payload?.total, 0);
    if (total > 0) {
      state.capturedTotal = Math.max(state.capturedTotal, total);
    }
  }

  function dedupeRowsFromCapturedPages(capturedPages) {
    const rows = [];
    const seen = new Set();
    const pageNums = Array.from(capturedPages.keys()).sort(function (a, b) {
      return a - b;
    });

    for (let pageIndex = 0; pageIndex < pageNums.length; pageIndex += 1) {
      const pageNum = pageNums[pageIndex];
      const pageRows = Array.isArray(capturedPages.get(pageNum)) ? capturedPages.get(pageNum) : [];
      for (let rowIndex = 0; rowIndex < pageRows.length; rowIndex += 1) {
        const row = pageRows[rowIndex];
        const rowId = normalizeText(row?.id);
        let uniqueKey = "";
        if (rowId) {
          uniqueKey = "id:" + rowId;
        } else {
          try {
            uniqueKey = "json:" + JSON.stringify(row || {});
          } catch (error) {
            uniqueKey = "idx:" + String(pageNum) + ":" + String(rowIndex);
          }
        }
        if (seen.has(uniqueKey)) {
          continue;
        }
        seen.add(uniqueKey);
        rows.push(row);
      }
    }

    return rows;
  }

  function buildTaskStatusPrefix(taskId) {
    return "taskId: " + String(taskId || "-");
  }

  async function runExportAll(taskId) {
    exportState = createExportState(taskId);
    const state = exportState;

    setStatus(buildTaskStatusPrefix(taskId) + "\n准备导出，正在切换到 100条/页...", "info");
    await setPageSizeTo100(taskId);

    setStatus(buildTaskStatusPrefix(taskId) + "\n正在跳转第 1 页...", "info");
    const firstPayload = await goToPage(taskId, 1, TARGET_PAGE_SIZE);
    const firstCode = Number(firstPayload?.code);
    if (Number.isFinite(firstCode) && firstCode !== 0) {
      throw new Error(normalizeText(firstPayload?.message || "平台返回异常（code=" + String(firstCode) + "）。"));
    }

    updateCapturedPages(state, firstPayload);

    const total = toPositiveInt(firstPayload?.total, Array.isArray(firstPayload?.records) ? firstPayload.records.length : 0);
    const pagesFromPayload = toPositiveInt(firstPayload?.pages, 0);
    let totalPages = pagesFromPayload > 0 ? pagesFromPayload : Math.ceil(total / TARGET_PAGE_SIZE);
    totalPages = Math.max(totalPages, 1);
    if (totalPages > MAX_EXPORT_PAGES) {
      throw new Error("分页数量超过限制（" + String(MAX_EXPORT_PAGES) + "），请缩小筛选条件后重试。");
    }

    for (let pageNum = 2; pageNum <= totalPages; pageNum += 1) {
      const capturedRows = dedupeRowsFromCapturedPages(state.capturedPages).length;
      setStatus(
        buildTaskStatusPrefix(taskId) +
          "\n正在导出：第 " +
          String(pageNum) +
          " / " +
          String(totalPages) +
          " 页，已获取 " +
          String(capturedRows) +
          " / " +
          String(total) +
          " 条",
        "info"
      );

      const payload = await goToPage(taskId, pageNum, TARGET_PAGE_SIZE);
      const code = Number(payload?.code);
      if (Number.isFinite(code) && code !== 0) {
        throw new Error(normalizeText(payload?.message || "平台返回异常（code=" + String(code) + "）。"));
      }
      updateCapturedPages(state, payload);
    }

    const dedupedRows = dedupeRowsFromCapturedPages(state.capturedPages);
    const csv = buildCsv(dedupedRows);
    const fileName =
      "data-baker-task-" +
      String(normalizeText(taskId) || "unknown") +
      "-all-" +
      formatTimeStamp(new Date()) +
      ".csv";

    const uploadResult = await uploadExportCsvToBackend(csv, dedupedRows, {
      taskId: taskId,
      fileName: fileName,
    });

    triggerCsvDownload(fileName, csv);

    setStatus(
      buildTaskStatusPrefix(taskId) +
        "\n已导出 " +
        String(dedupedRows.length) +
        " 条 / 总计 " +
        String(total) +
        " 条，已下载 CSV。" +
        (uploadResult.success
          ? "\n后端上传成功，可下载：" + String(uploadResult.downloadUrl || "（未返回下载地址）")
          : "\n后端上传失败（不影响本地下载）：" + String(uploadResult.message || "未知错误。")),
      uploadResult.success ? "success" : "error"
    );
  }

  async function tryFallbackExportCurrentPage(taskId, reason) {
    const payload = findMatchedPayloadFromCache({
      taskId: taskId,
      afterTime: 0,
    });
    if (!payload || !Array.isArray(payload.records)) {
      return false;
    }

    const pageNum = readPayloadPageNum(payload);
    const records = payload.records;
    const csv = buildCsv(records);
    const fileName =
      "data-baker-task-" +
      String(normalizeText(taskId) || "unknown") +
      "-page-" +
      String(pageNum) +
      "-" +
      formatTimeStamp(new Date()) +
      ".csv";
    const uploadResult = await uploadExportCsvToBackend(csv, records, {
      taskId: taskId,
      fileName: fileName,
    });
    triggerCsvDownload(fileName, csv);

    setStatus(
      buildTaskStatusPrefix(taskId) +
        "\n全量导出失败：" +
        String(reason || "未知错误") +
        "\n已导出当前页 " +
        String(records.length) +
        " 条。" +
        (uploadResult.success
          ? "\n当前页 CSV 已上传后端，可下载：" + String(uploadResult.downloadUrl || "（未返回下载地址）")
          : "\n当前页 CSV 后端上传失败（不影响本地下载）：" + String(uploadResult.message || "未知错误。")),
      uploadResult.success ? "success" : "error"
    );
    return true;
  }

  async function handleExportClick() {
    if (exportInProgress) {
      return;
    }

    const taskId = readTaskId();
    if (!taskId) {
      setStatus("未找到 taskId，无法导出。", "error");
      return;
    }

    exportInProgress = true;
    exportButton.disabled = true;
    rejectAllWaiters("导出会话已重置。");

    try {
      await runExportAll(taskId);
    } catch (error) {
      const errorMessage = normalizeText(error?.message || "导出失败，请重试。");
      const fallbackDone = await tryFallbackExportCurrentPage(taskId, errorMessage);
      if (!fallbackDone) {
        setStatus(buildTaskStatusPrefix(taskId) + "\n导出失败：" + errorMessage, "error");
      }
    } finally {
      exportState = null;
      exportInProgress = false;
      if (exportButton) {
        exportButton.disabled = false;
      }
    }
  }

  function handlePageMessage(event) {
    if (!event || event.source !== window) {
      return;
    }
    if (event.origin !== location.origin) {
      return;
    }

    const data = event.data;
    if (!data || data.source !== SOURCE || data.type !== GROUP_MESSAGE_TYPE) {
      return;
    }

    const payload = data.payload;
    if (!payload || payload.path !== GROUP_QUERY_PATH) {
      return;
    }

    notifyWaiters(payload);
  }

  function ensureMounted() {
    if (root && document.documentElement.contains(root)) {
      return root;
    }

    ensureStyle();
    root = document.createElement("div");
    root.setAttribute(ROOT_ATTR, "true");

    const title = document.createElement("div");
    title.className = "asr-edge-db-export-title";
    title.textContent = "DataBaker 总表导出";

    exportButton = document.createElement("button");
    exportButton.type = "button";
    exportButton.className = "asr-edge-db-export-btn";
    exportButton.textContent = "导出数据总表";
    exportButton.addEventListener("click", handleExportClick);

    statusNode = document.createElement("div");
    statusNode.className = "asr-edge-db-export-status";
    statusNode.textContent = "通过平台原生分页请求拦截导出 CSV。";

    root.appendChild(title);
    root.appendChild(exportButton);
    root.appendChild(statusNode);
    document.documentElement.appendChild(root);
    return root;
  }

  function remove() {
    rejectAllWaiters("导出区域已卸载。");
    exportInProgress = false;
    exportState = null;

    if (observerTimer) {
      window.clearTimeout(observerTimer);
      observerTimer = null;
    }
    if (root) {
      root.remove();
    }
    root = null;
    statusNode = null;
    exportButton = null;
  }

  async function evaluatePage() {
    if (evaluating) {
      pending = true;
      return;
    }
    evaluating = true;
    try {
      if (!isGroupDetailPage()) {
        remove();
        return;
      }
      const enabled = await loadScriptEnabled();
      if (!enabled) {
        remove();
        return;
      }
      const taskId = readTaskId();
      ensureMounted();

      if (!taskId) {
        setStatus("当前页面缺少 taskId，无法导出。", "error");
        return;
      }

      if (!exportInProgress) {
        setStatus(buildTaskStatusPrefix(taskId), "info");
      }
    } finally {
      evaluating = false;
      if (pending) {
        pending = false;
        window.setTimeout(function () {
          void evaluatePage();
        }, 0);
      }
    }
  }

  function scheduleEvaluate() {
    void evaluatePage();
  }

  function installWatchers() {
    window.addEventListener("hashchange", scheduleEvaluate);
    window.addEventListener("popstate", scheduleEvaluate);
    window.addEventListener("message", handlePageMessage);

    window.setInterval(scheduleEvaluate, STATUS_POLL_MS);
    observer = new MutationObserver(function () {
      if (observerTimer) {
        window.clearTimeout(observerTimer);
      }
      observerTimer = window.setTimeout(scheduleEvaluate, 160);
    });
    observer.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true,
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleEvaluate, { once: true });
  } else {
    scheduleEvaluate();
  }
  installWatchers();
})();

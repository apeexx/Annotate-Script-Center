(function () {
  const ROOT_ATTR = "data-asr-edge-judgement-ai-suggestion";
  const STYLE_ID = "asr-edge-judgement-ai-suggestion-style";
  const AI_ACTION_KEY = "aiSuggestCurrentItem";
  const APPLY_ACTION_KEY = "applyAiSuggestion";
  const RETRY_ACTION_KEY = "retryAiSuggestion";
  const IGNORE_ACTION_KEY = "ignoreAiSuggestion";
  const COPY_ASR_ACTION_KEY = "copyAsrTextPair";
  const RULE_VERSION = "asr-judgement-ai-v2";
  const ANSWER_TO_CHOICE = {
    first_better: "choiceFirstBetter",
    second_better: "choiceSecondBetter",
    both_bad: "choiceBothBad",
    uncertain_or_similar: "choiceUnsure",
    other_dialect_or_language: "choiceOtherDialect",
  };
  const CONSTANTS = globalThis.ASREdgeConstants || {};
  const AI_SUGGEST_PATH =
    CONSTANTS.JUDGEMENT_AI_SUGGEST_PATH || "/api/alibaba-labelx/asr-judgement/ai/suggest";
  const JUDGEMENT_AI_ADVANCED_DEFS = Array.isArray(
    CONSTANTS.JUDGEMENT_AI_ADVANCED_PARAM_DEFINITIONS
  )
    ? CONSTANTS.JUDGEMENT_AI_ADVANCED_PARAM_DEFINITIONS
    : [];
  const JUDGEMENT_AI_SUPPORTED_PARAMS = JUDGEMENT_AI_ADVANCED_DEFS.reduce(function (result, item) {
    const apiKey = String(item?.apiKey || "").trim();
    if (!apiKey) {
      return result;
    }
    result[apiKey] = item?.supported !== false;
    return result;
  }, {});
  const CHOICE_LABELS = {
    choiceFirstBetter: "第一个更好",
    choiceSecondBetter: "第二个更好",
    choiceBothBad: "都不好",
    choiceUnsure: "不确定或差不多",
    choiceOtherDialect: "其他方言或语种",
  };
  const aiCostDisplay = globalThis.ASREdgeAiCostDisplay || {};
  const aiUsageMeta = globalThis.ASREdgeAiUsageMeta || {};
  const storage = globalThis.ASREdgeStorage || {};
  const jobClient = globalThis.ASREdgeAiJobClient || null;
  const buildAiUsageRequestMeta =
    typeof aiUsageMeta.buildAiUsageRequestMeta === "function"
      ? aiUsageMeta.buildAiUsageRequestMeta
      : function (input) {
          const source = input && typeof input === "object" ? input : {};
          return {
            aiUsageOperatorName: String(source.settings?.meta?.aiUsageOperatorName || "").replace(/\s+/g, " ").trim().slice(0, 40),
            platformUserName: String(source.platformUserName || "").replace(/\s+/g, " ").trim().slice(0, 80),
            platformUserId: String(source.platformUserId || "").replace(/\s+/g, " ").trim().slice(0, 120),
          };
        };
  const appendAiUsageRequestMeta =
    typeof aiUsageMeta.appendAiUsageRequestMeta === "function"
      ? aiUsageMeta.appendAiUsageRequestMeta
      : function (payload, requestMeta) {
          return Object.assign({}, payload || {}, {
            aiUsageOperatorName: String(requestMeta?.aiUsageOperatorName || "").replace(/\s+/g, " ").trim().slice(0, 40),
            platformUserName: String(requestMeta?.platformUserName || "").replace(/\s+/g, " ").trim().slice(0, 80),
            platformUserId: String(requestMeta?.platformUserId || "").replace(/\s+/g, " ").trim().slice(0, 120),
          });
        };
  const assertAiUsageOperatorConfigured =
    typeof aiUsageMeta.assertAiUsageOperatorConfigured === "function"
      ? aiUsageMeta.assertAiUsageOperatorConfigured
      : function (requestMeta) {
          if (!String(requestMeta?.aiUsageOperatorName || "").replace(/\s+/g, " ").trim()) {
            const error = new Error("请先在 options 首页填写 AI 调用使用人。");
            error.code = "missing-ai-usage-operator-name";
            throw error;
          }
          return requestMeta;
        };
  const buildCostRows =
    typeof aiCostDisplay.buildCostRows === "function"
      ? aiCostDisplay.buildCostRows
      : function () {
          return [];
        };
  const ASR_TITLE_ALLOW_LIST = [
    "两个asr文本",
    "online_rec",
    "online_recognition",
    "asr",
    "asr_text",
  ];
  const ASR_TITLE_IGNORE_LIST = ["上文", "音频地址", "wav_id", "音频", "音频文件"];
  const CONTEXT_TITLE = "上文";
  const pendingStateByItem = new WeakMap();
  const contextIncludeOverrideByItem = new WeakMap();
  const latestSuggestionByItem = new WeakMap();

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      "[" + ROOT_ATTR + "] {",
      "  box-sizing: border-box;",
      "  margin: 6px 8px 10px;",
      "  padding: 8px 10px;",
      "  border: 1px solid #bfdbfe;",
      "  border-radius: 6px;",
      "  background: #f8fbff;",
      "  color: #0f172a;",
      "  font-size: 12px;",
      "  line-height: 1.5;",
      "}",
      "[" + ROOT_ATTR + "][data-tone='warn'] {",
      "  border-color: #f59e0b;",
      "  background: #fffbeb;",
      "}",
      "[" + ROOT_ATTR + "][data-tone='danger'] {",
      "  border-color: #ef4444;",
      "  background: #fef2f2;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-ai-head {",
      "  display: flex;",
      "  align-items: center;",
      "  justify-content: space-between;",
      "  gap: 8px;",
      "  margin-bottom: 6px;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-ai-title {",
      "  font-weight: 700;",
      "  color: #1d4ed8;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-ai-request {",
      "  color: #475569;",
      "  font-family: Consolas, 'Microsoft YaHei', monospace;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-ai-status {",
      "  margin: 2px 0 8px;",
      "  color: #1e293b;",
      "  font-weight: 700;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-ai-warning {",
      "  margin: 4px 0 6px;",
      "  color: #b45309;",
      "  font-weight: 700;",
      "}",
      "[" + ROOT_ATTR + "][data-tone='danger'] .asr-edge-ai-warning {",
      "  color: #b91c1c;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-ai-grid {",
      "  display: grid;",
      "  grid-template-columns: 120px minmax(0, 1fr);",
      "  gap: 4px 8px;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-ai-label {",
      "  color: #475569;",
      "  font-weight: 700;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-ai-value {",
      "  min-width: 0;",
      "  word-break: break-word;",
      "  overflow-wrap: anywhere;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-ai-actions {",
      "  display: flex;",
      "  flex-wrap: wrap;",
      "  gap: 8px;",
      "  margin-top: 8px;",
      "}",
      "[" + ROOT_ATTR + "] button {",
      "  min-height: 26px;",
      "  padding: 0 10px;",
      "  border-radius: 6px;",
      "  border: 1px solid #cbd5e1;",
      "  cursor: pointer;",
      "  font-size: 12px;",
      "  font-weight: 700;",
      "}",
      "[" + ROOT_ATTR + "] button[data-action='apply'] {",
      "  border-color: #1d4ed8;",
      "  background: #1d4ed8;",
      "  color: #ffffff;",
      "}",
      "[" + ROOT_ATTR + "] button:disabled {",
      "  cursor: not-allowed;",
      "  opacity: 0.6;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-ai-foot {",
      "  margin-top: 6px;",
      "  color: #64748b;",
      "}",
    ].join("\n");
    (document.head || document.documentElement).appendChild(style);
  }

  function normalizeUrlParam(value) {
    try {
      return decodeURIComponent(String(value || "")).trim();
    } catch (error) {
      return String(value || "").trim();
    }
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
      text.indexOf("上传统计") >= 0
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

  async function loadAiUsageSettings() {
    if (typeof storage.getSettings !== "function") {
      return {};
    }
    try {
      return (await storage.getSettings()) || {};
    } catch (error) {
      return {};
    }
  }

  function readUrlParams() {
    const params = new URLSearchParams(location.search || "");
    return {
      projectId: normalizeUrlParam(params.get("projectId") || params.get("appId") || ""),
      subTaskId: normalizeUrlParam(params.get("subTaskId") || ""),
    };
  }

  function getText(node) {
    return String(node?.textContent || "").replace(/\s+/g, " ").trim();
  }

  function parseAsrText(rawText) {
    const text = String(rawText || "").replace(/\r\n/g, "\n");
    const match = text.match(/asr_text1\s*:\s*([\s\S]*?)\s*asr_text2\s*:\s*([\s\S]*)$/i);
    if (!match) {
      return null;
    }
    return {
      first: match[1].trim(),
      second: match[2].trim(),
    };
  }

  function parseDiffSignature(signature) {
    const text = String(signature || "").replace(/\r\n/g, "\n");
    const parts = text.split("\n---\n");
    if (parts.length < 2) {
      return null;
    }
    return {
      first: parts[0].trim(),
      second: parts.slice(1).join("\n---\n").trim(),
    };
  }

  function normalizeTitle(title) {
    return String(title || "").replace(/\s+/g, "").trim().toLowerCase();
  }

  function isIgnoredContentTitle(title) {
    const normalized = normalizeTitle(title);
    return ASR_TITLE_IGNORE_LIST.some(function (itemTitle) {
      return normalized === normalizeTitle(itemTitle);
    });
  }

  function isAllowedAsrTitle(title) {
    const normalized = normalizeTitle(title);
    return ASR_TITLE_ALLOW_LIST.some(function (itemTitle) {
      return normalized === normalizeTitle(itemTitle);
    });
  }

  function findAsrContentWrap(item) {
    const wraps = Array.from(item.querySelectorAll(".labelRender-item-content-wrap"));
    let fallbackWrap = null;
    for (const wrapItem of wraps) {
      const title = getText(wrapItem.querySelector(".labelRender-item-content-title"));
      if (isIgnoredContentTitle(title)) {
        continue;
      }
      const container = wrapItem.querySelector(".dt-text-wrapper .dt-text-container");
      const pair = parseAsrText(container?.textContent || "");
      if (!pair) {
        continue;
      }
      if (isAllowedAsrTitle(title)) {
        return wrapItem;
      }
      if (!fallbackWrap) {
        fallbackWrap = wrapItem;
      }
    }
    return fallbackWrap;
  }

  function resolveItemAsrPair(item) {
    const wrap = findAsrContentWrap(item);
    const rawPair = parseAsrText(wrap?.querySelector(".dt-text-container")?.textContent || "");
    if (rawPair) {
      return rawPair;
    }
    const diffView = wrap?.querySelector("[data-asr-edge-judgement-diff-view]");
    return parseDiffSignature(diffView?.getAttribute("data-asr-edge-signature") || "");
  }

  function normalizePairText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function formatAsrTextPair(pair) {
    const first = normalizePairText(pair?.first || "");
    const second = normalizePairText(pair?.second || "");
    if (!first || !second) {
      return "";
    }
    return "asr_text1:" + first + ";\nasr_text2:" + second;
  }

  async function writeClipboardText(text) {
    const value = String(text || "");
    if (!value) {
      throw new Error("复制内容为空。");
    }
    if (navigator?.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(value);
      return;
    }
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "readonly");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand("copy");
    textarea.remove();
    if (!success) {
      throw new Error("浏览器不支持复制，请手动复制。");
    }
  }

  function resolveItemContextText(item) {
    const wraps = Array.from(item.querySelectorAll(".labelRender-item-content-wrap"));
    for (const wrap of wraps) {
      const title = getText(wrap.querySelector(".labelRender-item-content-title"));
      if (title !== CONTEXT_TITLE) {
        continue;
      }
      const text = getText(wrap.querySelector(".dt-text-wrapper .dt-text-container"));
      if (text) {
        return text.slice(0, 1200);
      }
      break;
    }
    return "";
  }

  function hasItemContext(item) {
    return Boolean(resolveItemContextText(item));
  }

  function isAdvancedParamSupported(apiKey) {
    return JUDGEMENT_AI_SUPPORTED_PARAMS[String(apiKey || "")] === true;
  }

  function parseAnswerNavIndex(text) {
    const match = String(text || "").match(/第\s*(\d+)\s*题/);
    if (!match) {
      return null;
    }
    const index = Number(match[1]);
    return Number.isFinite(index) && index > 0 ? index - 1 : null;
  }

  function resolveCurrentItem() {
    const selectedItem = document.querySelector(".labelRender-item-selected.labelRender-item[data-index]");
    if (selectedItem) {
      return selectedItem;
    }

    const playingAudio = Array.from(document.querySelectorAll("audio[controls], audio")).find(function (audio) {
      return audio && !audio.paused && !audio.ended;
    });
    const playingItem = playingAudio?.closest ? playingAudio.closest(".labelRender-item[data-index]") : null;
    if (playingItem) {
      return playingItem;
    }

    const selectedStatus = document.querySelector(
      ".labelRender-item-selected .labelRender-answerNav-status"
    );
    const statusNode = selectedStatus || document.querySelector(".labelRender-answerNav-status");
    const index = parseAnswerNavIndex(statusNode?.textContent || "");
    if (index === null) {
      return null;
    }
    return document.querySelector('.labelRender-item[data-index="' + String(index) + '"]');
  }

  function resolveAudioUrl(item) {
    const audio = item.querySelector("audio[controls], audio");
    return String(audio?.currentSrc || audio?.src || "").trim();
  }

  function getClientVersion() {
    try {
      const manifest = chrome?.runtime?.getManifest ? chrome.runtime.getManifest() : null;
      return String(manifest?.version || "unknown");
    } catch (error) {
      return "unknown";
    }
  }

  function normalizeConfidence(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return 0;
    }
    return Math.max(0, Math.min(1, numericValue));
  }

  function getTone(result) {
    if (result.thunderConflict) {
      return "danger";
    }
    if (result.needManualSearch || result.shouldWarnBeforeApply || result.confidence < 0.65) {
      return "warn";
    }
    return "info";
  }

  function getWebSearchStatusText(webSearch) {
    const source = webSearch && typeof webSearch === "object" ? webSearch : {};
    if (source.enabled !== true) {
      return "关";
    }
    if (source.fallbackUsed === true) {
      return "开（已回退）";
    }
    return source.used === true ? "开（已使用）" : "开";
  }

  function createDetailRow(label, value) {
    const labelNode = document.createElement("span");
    labelNode.className = "asr-edge-ai-label";
    labelNode.textContent = label;

    const valueNode = document.createElement("span");
    valueNode.className = "asr-edge-ai-value";
    valueNode.textContent = String(value || "-");

    return [labelNode, valueNode];
  }

  function removeCard(item) {
    item.querySelectorAll("[" + ROOT_ATTR + "]").forEach(function (node) {
      node.remove();
    });
    latestSuggestionByItem.delete(item);
  }

  function setItemPending(item, pending, requestId) {
    if (!(item instanceof HTMLElement)) {
      return;
    }
    pendingStateByItem.set(item, {
      pending: pending === true,
      requestId: String(requestId || ""),
    });
  }

  function getItemPendingState(item) {
    if (!(item instanceof HTMLElement)) {
      return {
        pending: false,
        requestId: "",
      };
    }
    const state = pendingStateByItem.get(item);
    if (!state || state.pending !== true) {
      return {
        pending: false,
        requestId: "",
      };
    }
    return {
      pending: true,
      requestId: String(state.requestId || ""),
    };
  }

  function resolveContextState(item, contextText) {
    const contextAvailable = String(contextText || "").trim().length > 0;
    const override = contextIncludeOverrideByItem.get(item);
    const includeContext =
      contextAvailable && (typeof override === "boolean" ? override : true);
    return {
      contextAvailable,
      includeContext,
    };
  }

  function setContextIncludeOverride(item, includeContext) {
    if (!(item instanceof HTMLElement)) {
      return;
    }
    if (typeof includeContext !== "boolean") {
      contextIncludeOverrideByItem.delete(item);
      return;
    }
    contextIncludeOverrideByItem.set(item, includeContext);
  }

  function getContextDisplayText(contextState) {
    if (!contextState.contextAvailable) {
      return "未检测到上文";
    }
    return contextState.includeContext ? "开" : "关";
  }

  function appendCommonHead(root, requestId) {
    const head = document.createElement("div");
    head.className = "asr-edge-ai-head";
    const title = document.createElement("span");
    title.className = "asr-edge-ai-title";
    title.textContent = "AI 参考建议";
    const request = document.createElement("span");
    request.className = "asr-edge-ai-request";
    request.textContent = "requestId: " + String(requestId || "-");
    head.appendChild(title);
    head.appendChild(request);
    root.appendChild(head);
  }

  function appendFoot(root) {
    const foot = document.createElement("div");
    foot.className = "asr-edge-ai-foot";
    foot.textContent =
      "仅供参考：不会自动保存、不会自动提交、不会自动领取、不会自动流转。";
    root.appendChild(foot);
  }

  function renderLoadingCard(item, contextState, options) {
    removeCard(item);
    ensureStyle();

    const root = document.createElement("div");
    root.setAttribute(ROOT_ATTR, "true");
    root.setAttribute("data-tone", "info");
    appendCommonHead(root, "-");

    const status = document.createElement("div");
    status.className = "asr-edge-ai-status";
    status.textContent = "正在分析当前题...";
    root.appendChild(status);

    const grid = document.createElement("div");
    grid.className = "asr-edge-ai-grid";
    [
      createDetailRow("说明", "正在听音频并比较 asr_text1 / asr_text2，请稍候"),
      createDetailRow("使用上文理解", getContextDisplayText(contextState)),
      createDetailRow("建议答案", "-"),
      createDetailRow("模型", "-"),
    ].forEach(function (nodes) {
      grid.appendChild(nodes[0]);
      grid.appendChild(nodes[1]);
    });
    root.appendChild(grid);

    const actionWrap = document.createElement("div");
    actionWrap.className = "asr-edge-ai-actions";
    const applyButton = document.createElement("button");
    applyButton.type = "button";
    applyButton.setAttribute("data-action", "apply");
    applyButton.textContent = "采用建议";
    applyButton.disabled = true;
    const retryButton = document.createElement("button");
    retryButton.type = "button";
    retryButton.textContent = "重新分析";
    retryButton.disabled = true;
    const toggleButton = document.createElement("button");
    toggleButton.type = "button";
    toggleButton.textContent = contextState.contextAvailable
      ? contextState.includeContext
        ? "关闭上文理解"
        : "开启上文理解"
      : "未检测到上文";
    toggleButton.disabled = true;
    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.textContent = "复制两条 ASR";
    copyButton.addEventListener("click", function () {
      if (typeof options?.copyAsrTextPair !== "function") {
        return;
      }
      void options.copyAsrTextPair();
    });
    const ignoreButton = document.createElement("button");
    ignoreButton.type = "button";
    ignoreButton.setAttribute("data-action", "ignore");
    ignoreButton.textContent = "忽略";
    ignoreButton.addEventListener("click", function () {
      if (typeof options?.ignoreSuggestion === "function") {
        void options.ignoreSuggestion();
        return;
      }
      removeCard(item);
    });
    actionWrap.appendChild(applyButton);
    actionWrap.appendChild(retryButton);
    actionWrap.appendChild(toggleButton);
    actionWrap.appendChild(copyButton);
    actionWrap.appendChild(ignoreButton);
    root.appendChild(actionWrap);

    appendFoot(root);
    item.insertBefore(root, item.firstElementChild || null);
  }

  function renderErrorCard(item, errorInfo, contextState, options) {
    removeCard(item);
    ensureStyle();

    const detail = errorInfo && typeof errorInfo === "object" ? errorInfo : {};
    const root = document.createElement("div");
    root.setAttribute(ROOT_ATTR, "true");
    root.setAttribute("data-tone", "danger");
    appendCommonHead(root, detail.requestId || "-");

    const status = document.createElement("div");
    status.className = "asr-edge-ai-status";
    status.textContent = "分析失败";
    root.appendChild(status);

    const grid = document.createElement("div");
    grid.className = "asr-edge-ai-grid";
    [
      createDetailRow("错误原因", String(detail.message || "AI 分析失败。")),
      createDetailRow("错误码", String(detail.code || "-")),
      createDetailRow("使用上文理解", getContextDisplayText(contextState)),
    ].forEach(function (nodes) {
      grid.appendChild(nodes[0]);
      grid.appendChild(nodes[1]);
    });
    root.appendChild(grid);

    const actionWrap = document.createElement("div");
    actionWrap.className = "asr-edge-ai-actions";
    const retryButton = document.createElement("button");
    retryButton.type = "button";
    retryButton.setAttribute("data-action", "retry");
    retryButton.textContent = "重试";
    retryButton.addEventListener("click", function () {
      if (typeof options?.retrySuggestion !== "function") {
        return;
      }
      Promise.resolve(options.retrySuggestion())
        .then(function (result) {
          if (result?.ok === false && typeof options?.showToast === "function") {
            options.showToast(result.message || "AI 分析失败。", "error");
          }
        })
        .catch(function (error) {
          if (typeof options?.showToast === "function") {
            options.showToast(
              "AI 分析失败：" + (error && error.message ? error.message : String(error)),
              "error"
            );
          }
        });
    });

    const toggleButton = document.createElement("button");
    toggleButton.type = "button";
    toggleButton.textContent = contextState.contextAvailable
      ? contextState.includeContext
        ? "关闭上文理解"
        : "开启上文理解"
      : "未检测到上文";
    toggleButton.disabled = !contextState.contextAvailable;
    toggleButton.addEventListener("click", function () {
      if (!contextState.contextAvailable) {
        return;
      }
      const nextInclude = contextState.includeContext !== true;
      setContextIncludeOverride(item, nextInclude);
      if (typeof options?.showToast === "function") {
        options.showToast("已切换上文理解，点击重新分析生效。", "info");
      }
      renderErrorCard(
        item,
        detail,
        {
          contextAvailable: true,
          includeContext: nextInclude,
        },
        options
      );
    });

    const ignoreButton = document.createElement("button");
    ignoreButton.type = "button";
    ignoreButton.setAttribute("data-action", "ignore");
    ignoreButton.textContent = "忽略";
    ignoreButton.addEventListener("click", function () {
      if (typeof options?.ignoreSuggestion === "function") {
        void options.ignoreSuggestion();
        return;
      }
      removeCard(item);
    });

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.textContent = "复制两条 ASR";
    copyButton.addEventListener("click", function () {
      if (typeof options?.copyAsrTextPair !== "function") {
        return;
      }
      void options.copyAsrTextPair();
    });

    actionWrap.appendChild(retryButton);
    actionWrap.appendChild(toggleButton);
    actionWrap.appendChild(copyButton);
    actionWrap.appendChild(ignoreButton);
    root.appendChild(actionWrap);

    appendFoot(root);
    item.insertBefore(root, item.firstElementChild || null);
  }

  function renderCard(item, result, contextState, options) {
    removeCard(item);
    ensureStyle();

    const root = document.createElement("div");
    root.setAttribute(ROOT_ATTR, "true");
    root.setAttribute("data-tone", getTone(result));
    appendCommonHead(root, result.requestId || "-");

    if (result.thunderMatched) {
      const warning = document.createElement("div");
      warning.className = "asr-edge-ai-warning";
      warning.textContent = result.thunderConflict
        ? "雷题优先：AI 建议与雷题标准答案冲突，已禁用采用建议。"
        : "雷题优先：该题命中雷题库，请优先参考雷题标准答案。";
      root.appendChild(warning);
    } else if (result.needManualSearch) {
      const warning = document.createElement("div");
      warning.className = "asr-edge-ai-warning";
      warning.textContent = "需要人工搜索确认专有名词/语义。";
      root.appendChild(warning);
    }

    const grid = document.createElement("div");
    grid.className = "asr-edge-ai-grid";
    const detailRows = [
      createDetailRow("建议答案", result.answerText),
      createDetailRow("置信度", (result.confidence * 100).toFixed(1) + "%"),
      createDetailRow("风险等级", result.riskLevel || "unknown"),
      createDetailRow("需要人工搜索", result.needManualSearch ? "是" : "否"),
      createDetailRow("Web Search", result.webSearchStatusText || "-"),
      createDetailRow("搜索辅助", result.webSearchHint || "-"),
      createDetailRow("简短理由", result.reasonSummary || "-"),
      createDetailRow("听音文本", result.listenHeardText || "-"),
      createDetailRow("听音置信度", (result.listenConfidence * 100).toFixed(1) + "%"),
      createDetailRow("使用上文理解", result.contextIncluded ? "是" : "否"),
      createDetailRow("模型", "听音 " + result.listenModel + " / 比较 " + result.compareModel),
      createDetailRow(
        "耗时",
        "听音 " +
          String(result.listenDurationMs) +
          "ms / 比较 " +
          String(result.compareDurationMs) +
          "ms / 总计 " +
          String(result.totalDurationMs) +
          "ms"
      ),
    ];
    buildCostRows({
      cost: result.cost,
      stageDefinitions: [
        {
          key: "listen",
          label: "听音预估人民币",
        },
        {
          key: "compare",
          label: "比较预估人民币",
        },
      ],
      totalLabel: "总预估人民币",
    }).forEach(function (row) {
      detailRows.push(createDetailRow(row[0], row[1]));
    });
    detailRows.forEach(function (nodes) {
      grid.appendChild(nodes[0]);
      grid.appendChild(nodes[1]);
    });
    root.appendChild(grid);

    const actionWrap = document.createElement("div");
    actionWrap.className = "asr-edge-ai-actions";
    const applyButton = document.createElement("button");
    applyButton.type = "button";
    applyButton.setAttribute("data-action", "apply");
    applyButton.textContent = "采用建议";
    const canApply = Boolean(result.choiceActionKey) && !result.thunderConflict;
    applyButton.disabled = !canApply;
    applyButton.addEventListener("click", function () {
      if (!canApply || typeof options.applyCurrentSuggestion !== "function") {
        return;
      }
      void options.applyCurrentSuggestion();
    });

    const retryButton = document.createElement("button");
    retryButton.type = "button";
    retryButton.textContent = "重新分析";
    retryButton.addEventListener("click", function () {
      if (typeof options.retrySuggestion !== "function") {
        return;
      }
      void options.retrySuggestion();
    });

    const toggleButton = document.createElement("button");
    toggleButton.type = "button";
    toggleButton.textContent = contextState.contextAvailable
      ? contextState.includeContext
        ? "关闭上文理解"
        : "开启上文理解"
      : "未检测到上文";
    toggleButton.disabled = !contextState.contextAvailable;
    toggleButton.addEventListener("click", function () {
      if (!contextState.contextAvailable) {
        return;
      }
      const nextInclude = contextState.includeContext !== true;
      setContextIncludeOverride(item, nextInclude);
      if (typeof options.showToast === "function") {
        options.showToast("已切换上文理解，点击重新分析生效。", "info");
      }
      renderCard(
        item,
        Object.assign({}, result, {
          contextIncluded: nextInclude,
        }),
        {
          contextAvailable: true,
          includeContext: nextInclude,
        },
        options
      );
    });

    const ignoreButton = document.createElement("button");
    ignoreButton.type = "button";
    ignoreButton.setAttribute("data-action", "ignore");
    ignoreButton.textContent = "忽略";
    ignoreButton.addEventListener("click", function () {
      if (typeof options?.ignoreSuggestion === "function") {
        void options.ignoreSuggestion();
        return;
      }
      removeCard(item);
    });

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.textContent = "复制两条 ASR";
    copyButton.addEventListener("click", function () {
      if (typeof options?.copyAsrTextPair !== "function") {
        return;
      }
      void options.copyAsrTextPair();
    });

    actionWrap.appendChild(applyButton);
    actionWrap.appendChild(retryButton);
    actionWrap.appendChild(toggleButton);
    actionWrap.appendChild(copyButton);
    actionWrap.appendChild(ignoreButton);
    root.appendChild(actionWrap);

    appendFoot(root);
    item.insertBefore(root, item.firstElementChild || null);
  }

  function createRuntime(deps) {
    const options = deps && typeof deps === "object" ? deps : {};

    function shouldApply() {
      return typeof options.shouldApply === "function" ? options.shouldApply() === true : true;
    }

    function getConfig() {
      return typeof options.getConfig === "function" ? options.getConfig() || {} : {};
    }

    function buildActionResult(ok, message, extra) {
      return buildNamedActionResult(AI_ACTION_KEY, ok, message, extra);
    }

    function buildNamedActionResult(actionKey, ok, message, extra) {
      return Object.assign(
        {
          action: String(actionKey || AI_ACTION_KEY),
          ok: ok === true,
          message: String(message || ""),
          at: new Date().toISOString(),
        },
        extra || {}
      );
    }

    function parseChoiceActionKey(data) {
      if (typeof data.choiceActionKey === "string" && data.choiceActionKey.trim()) {
        return data.choiceActionKey.trim();
      }
      return ANSWER_TO_CHOICE[String(data.answer || "").trim()] || "";
    }

    function resolveHostname(audioUrl) {
      try {
        return new URL(audioUrl).hostname || "";
      } catch (error) {
        return "";
      }
    }

    function normalizePromptText(value) {
      return String(value || "").replace(/\r\n/g, "\n").trim().slice(0, 8000);
    }

    function normalizeOptionalNumber(value, min, max) {
      const text = String(value || "").trim();
      if (!text) {
        return null;
      }
      const numericValue = Number(text);
      if (!Number.isFinite(numericValue)) {
        return null;
      }
      return Math.max(min, Math.min(max, numericValue));
    }

    function normalizeOptionalInteger(value, min, max) {
      const numericValue = normalizeOptionalNumber(value, min, max);
      if (!Number.isFinite(numericValue)) {
        return null;
      }
      return Math.floor(numericValue);
    }

    function normalizeStopSequences(value) {
      const source = String(value || "");
      if (!source.trim()) {
        return [];
      }
      const result = [];
      source
        .split(/\r?\n/)
        .map(function (item) {
          return String(item || "").trim().slice(0, 80);
        })
        .filter(Boolean)
        .forEach(function (item) {
          if (result.length >= 8) {
            return;
          }
          if (result.indexOf(item) >= 0) {
            return;
          }
          result.push(item);
        });
      return result;
    }

    function buildAiOptions(config) {
      const options = {};
      options.listenModel = String(config.aiSuggestionListenModel || "qwen3.5-omni-flash").trim();
      options.compareModel = String(
        config.aiSuggestionCompareModel || config.aiSuggestionModel || "qwen3.5-plus"
      ).trim();
      const listenPrompt = normalizePromptText(config.aiSuggestionListenPrompt);
      const comparePrompt = normalizePromptText(config.aiSuggestionComparePrompt);
      if (listenPrompt) {
        options.listenPrompt = listenPrompt;
      }
      if (comparePrompt) {
        options.comparePrompt = comparePrompt;
      }

      const temperature = normalizeOptionalNumber(config.aiSuggestionTemperature, 0, 2);
      if (isAdvancedParamSupported("temperature") && Number.isFinite(temperature)) {
        options.temperature = temperature;
      }
      const topP = normalizeOptionalNumber(config.aiSuggestionTopP, 0, 1);
      if (isAdvancedParamSupported("top_p") && Number.isFinite(topP)) {
        options.top_p = topP;
      }
      const maxTokens = normalizeOptionalInteger(config.aiSuggestionMaxTokens, 1, 8192);
      if (isAdvancedParamSupported("max_tokens") && Number.isFinite(maxTokens)) {
        options.max_tokens = maxTokens;
      }
      const maxCompletionTokens = normalizeOptionalInteger(
        config.aiSuggestionMaxCompletionTokens,
        1,
        8192
      );
      if (
        isAdvancedParamSupported("max_completion_tokens") &&
        Number.isFinite(maxCompletionTokens)
      ) {
        options.max_completion_tokens = maxCompletionTokens;
      }
      const presencePenalty = normalizeOptionalNumber(config.aiSuggestionPresencePenalty, -2, 2);
      if (isAdvancedParamSupported("presence_penalty") && Number.isFinite(presencePenalty)) {
        options.presence_penalty = presencePenalty;
      }
      const frequencyPenalty = normalizeOptionalNumber(config.aiSuggestionFrequencyPenalty, -2, 2);
      if (isAdvancedParamSupported("frequency_penalty") && Number.isFinite(frequencyPenalty)) {
        options.frequency_penalty = frequencyPenalty;
      }
      const seed = normalizeOptionalInteger(config.aiSuggestionSeed, 0, 2147483647);
      if (isAdvancedParamSupported("seed") && Number.isFinite(seed)) {
        options.seed = seed;
      }
      const stop = normalizeStopSequences(config.aiSuggestionStopSequences);
      if (isAdvancedParamSupported("stop") && stop.length > 0) {
        options.stop = stop;
      }
      if (isAdvancedParamSupported("enable_thinking")) {
        options.enable_thinking = config.aiSuggestionEnableThinking === true;
      }
      options.webSearchEnabled = config.aiSuggestionWebSearchEnabled !== false;
      return options;
    }

    function buildFailedActionResult(message, source, extra) {
      return buildActionResult(false, "AI 分析失败：" + String(message || "未知错误"), {
        reason: "ai-request-failed",
        source: source || "unknown",
        code: String(extra?.code || ""),
        requestId: String(extra?.requestId || ""),
      });
    }

    function extractErrorMessage(error) {
      if (error?.name === "AbortError") {
        return "AI 后端请求超时，请检查后端日志或模型接口。";
      }
      return String(error?.message || "AI 服务请求失败。");
    }

    async function requestThunderInfo(item) {
      if (typeof options.getThunderInfo !== "function") {
        return null;
      }
      try {
        return (await options.getThunderInfo(item)) || null;
      } catch (error) {
        return null;
      }
    }

    function mapAnswerTextToChoice(answerText) {
      return (
        Object.keys(CHOICE_LABELS).find(function (choiceActionKey) {
          return CHOICE_LABELS[choiceActionKey] === String(answerText || "").trim();
        }) || ""
      );
    }

    function getLatestSuggestion(item) {
      const source = latestSuggestionByItem.get(item);
      return source && typeof source === "object" ? source : null;
    }

    function rememberLatestSuggestion(item, payload) {
      if (!(item instanceof HTMLElement)) {
        return;
      }
      latestSuggestionByItem.set(item, payload);
    }

    function resolveCurrentItemForAction(actionKey, source) {
      const item = resolveCurrentItem();
      if (!(item instanceof HTMLElement)) {
        return {
          ok: false,
          result: buildNamedActionResult(actionKey, false, "未找到当前题卡，请先点击要操作的题卡。", {
            reason: "current-item-not-found",
            source: source || "unknown",
          }),
        };
      }
      return {
        ok: true,
        item,
      };
    }

    async function applyCurrentSuggestion(source) {
      const resolved = resolveCurrentItemForAction(APPLY_ACTION_KEY, source);
      if (!resolved.ok) {
        return resolved.result;
      }
      const item = resolved.item;
      const latestSuggestion = getLatestSuggestion(item);
      if (!latestSuggestion || !latestSuggestion.result) {
        return buildNamedActionResult(APPLY_ACTION_KEY, false, "当前题暂无可采用的 AI 建议。", {
          reason: "ai-suggestion-missing",
          source: source || "unknown",
        });
      }
      const result = latestSuggestion.result;
      if (!result.choiceActionKey || result.thunderConflict) {
        return buildNamedActionResult(
          APPLY_ACTION_KEY,
          false,
          "当前建议不可直接采用，请人工复核。",
          {
            reason: result.thunderConflict ? "thunder-conflict" : "choice-action-missing",
            source: source || "unknown",
            requestId: String(result.requestId || ""),
          }
        );
      }
      if (typeof options.applySuggestion !== "function") {
        return buildNamedActionResult(APPLY_ACTION_KEY, false, "判别动作不可用。", {
          reason: "apply-action-missing",
          source: source || "unknown",
        });
      }

      const needConfirm =
        result.shouldWarnBeforeApply === true ||
        result.needManualSearch === true ||
        Number(result.confidence || 0) < 0.65;
      if (
        needConfirm &&
        window.confirm("当前建议存在风险，请人工复核后再采用。是否继续采用？") !== true
      ) {
        return buildNamedActionResult(APPLY_ACTION_KEY, false, "已取消采用 AI 建议。", {
          reason: "user-cancelled",
          source: source || "unknown",
          requestId: String(result.requestId || ""),
        });
      }

      try {
        const applyResult = await Promise.resolve(options.applySuggestion(result.choiceActionKey));
        if (applyResult?.ok === false) {
          throw new Error(applyResult.message || "采用建议失败。");
        }
        if (typeof options.showToast === "function") {
          options.showToast("AI 建议已采用。", "info");
        }
        return buildNamedActionResult(APPLY_ACTION_KEY, true, "AI 建议已采用。", {
          source: source || "unknown",
          requestId: String(result.requestId || ""),
          choiceActionKey: String(result.choiceActionKey || ""),
        });
      } catch (error) {
        const message = "采用建议失败：" + String(error?.message || error || "未知错误");
        if (typeof options.showToast === "function") {
          options.showToast(message, "error");
        }
        return buildNamedActionResult(APPLY_ACTION_KEY, false, message, {
          reason: "apply-failed",
          source: source || "unknown",
          requestId: String(result.requestId || ""),
        });
      }
    }

    function ignoreCurrentSuggestion(source) {
      const resolved = resolveCurrentItemForAction(IGNORE_ACTION_KEY, source);
      if (!resolved.ok) {
        return resolved.result;
      }
      removeCard(resolved.item);
      if (typeof options.showToast === "function") {
        options.showToast("已忽略当前题 AI 建议。", "info");
      }
      return buildNamedActionResult(IGNORE_ACTION_KEY, true, "已忽略当前题 AI 建议。", {
        source: source || "unknown",
      });
    }

    async function copyCurrentAsrTextPair(source) {
      const resolved = resolveCurrentItemForAction(COPY_ASR_ACTION_KEY, source);
      if (!resolved.ok) {
        return resolved.result;
      }
      const pair = resolveItemAsrPair(resolved.item);
      const text = formatAsrTextPair(pair);
      if (!text) {
        return buildNamedActionResult(
          COPY_ASR_ACTION_KEY,
          false,
          "未找到当前题两条 ASR 文本。",
          {
            reason: "asr-text-missing",
            source: source || "unknown",
          }
        );
      }
      try {
        await writeClipboardText(text);
        if (typeof options.showToast === "function") {
          options.showToast("已复制当前题两条 ASR 文本。", "info");
        }
        return buildNamedActionResult(COPY_ASR_ACTION_KEY, true, "已复制当前题两条 ASR 文本。", {
          source: source || "unknown",
        });
      } catch (error) {
        const message = "复制失败：" + String(error?.message || error || "未知错误");
        if (typeof options.showToast === "function") {
          options.showToast(message, "error");
        }
        return buildNamedActionResult(COPY_ASR_ACTION_KEY, false, message, {
          reason: "clipboard-write-failed",
          source: source || "unknown",
        });
      }
    }

    async function suggestCurrentItem(source) {
      if (!shouldApply()) {
        return buildActionResult(false, "当前页面不支持 AI 建议。", {
          reason: "page-not-supported",
          source: source || "unknown",
        });
      }

      const config = getConfig();

      const item = resolveCurrentItem();
      if (!(item instanceof HTMLElement)) {
        return buildActionResult(false, "未找到当前题卡，请先点击要分析的题卡。", {
          reason: "current-item-not-found",
          source: source || "unknown",
        });
      }

      const pair = resolveItemAsrPair(item);
      if (!pair || !pair.first || !pair.second) {
        return buildActionResult(false, "当前题卡缺少 asr_text1 / asr_text2。", {
          reason: "asr-text-missing",
          source: source || "unknown",
        });
      }

      const audioUrl = resolveAudioUrl(item);
      if (!audioUrl) {
        return buildActionResult(false, "当前题卡缺少音频地址，无法调用 AI。", {
          reason: "audio-url-missing",
          source: source || "unknown",
        });
      }

      let endpoint = "";
      try {
        const modeText = String(config.backendEndpointMode || "").trim().toLowerCase();
        const mode = modeText === "local" ? "local" : "server";
        endpoint =
          typeof CONSTANTS.buildBackendUrl === "function"
            ? CONSTANTS.buildBackendUrl(AI_SUGGEST_PATH, mode)
            : String(
                (
                  mode === "local"
                    ? CONSTANTS.DEFAULT_BACKEND_BASE_URLS?.local
        : CONSTANTS.DEFAULT_BACKEND_BASE_URLS?.server
                ) || ""
              ).replace(/\/+$/, "") + AI_SUGGEST_PATH;
        endpoint = new URL(String(endpoint)).toString();
      } catch (error) {
        return buildActionResult(false, "AI 接口地址无效，请检查全局后端接口地址设置。", {
          reason: "invalid-endpoint",
          source: source || "unknown",
        });
      }

      const timeoutMs = Math.max(
        1000,
        Math.min(180000, Number(config.aiSuggestionRequestTimeoutMs) || 60000)
      );
      const pendingState = getItemPendingState(item);
      if (pendingState.pending) {
        return buildActionResult(true, "当前题 AI 分析中，请稍候。", {
          reason: "ai-request-pending",
          source: source || "unknown",
          requestId: pendingState.requestId,
        });
      }

      const contextText = resolveItemContextText(item);
      const contextState = resolveContextState(item, contextText);
      const params = readUrlParams();
      const requestMeta = assertAiUsageOperatorConfigured(
        buildAiUsageRequestMeta({
          settings: await loadAiUsageSettings(),
          platformUserName: await resolveCurrentUserText(),
          platformUserId: "",
        })
      );
      const requestBody = appendAiUsageRequestMeta({
        projectId: params.projectId || "",
        subTaskId: params.subTaskId || "",
        itemIndex: Number(item.getAttribute("data-index")),
        itemId: String(item.getAttribute("data-id") || ""),
        audioUrl: audioUrl,
        asrText1: pair.first,
        asrText2: pair.second,
        contextText: contextText,
        includeContext: contextState.includeContext,
        listenModel: String(config.aiSuggestionListenModel || "qwen3.5-omni-flash"),
        compareModel: String(
          config.aiSuggestionCompareModel || config.aiSuggestionModel || "qwen3.5-plus"
        ),
        enableThinking: config.aiSuggestionEnableThinking === true,
        webSearchEnabled: config.aiSuggestionWebSearchEnabled !== false,
        aiOptions: buildAiOptions(config),
        ruleVersion: RULE_VERSION,
        clientVersion: getClientVersion(),
      }, requestMeta);

      const controller = typeof AbortController === "function" ? new AbortController() : null;
      const timer = controller
        ? window.setTimeout(function () {
            controller.abort();
          }, timeoutMs)
        : null;

      let responseBody = null;
      setItemPending(item, true, "");
      renderLoadingCard(item, contextState, {
        ignoreSuggestion: function () {
          return ignoreCurrentSuggestion("manual");
        },
        copyAsrTextPair: function () {
          return copyCurrentAsrTextPair("manual");
        },
      });
      try {
        if (jobClient && typeof jobClient.runJobLifecycle === "function") {
          const jobResult = await jobClient.runJobLifecycle({
            endpoint: endpoint,
            body: requestBody,
            timeoutMs: timeoutMs,
            fetchImpl: fetch.bind(globalThis),
            pollIntervalMs: Math.max(200, Number(config.jobPollIntervalMs) || 800),
            buildApiError: function (jobResponseBody, requestStatusCode) {
              const body = jobResponseBody && typeof jobResponseBody === "object" ? jobResponseBody : {};
              const errorBody = body.error && typeof body.error === "object" ? body.error : body;
              const responseError = new Error(
                errorBody.message || body.message || "AI 服务请求失败（HTTP " + String(requestStatusCode) + "）。"
              );
              responseError.code = String(errorBody.code || body.code || "");
              responseError.requestId = String(body.requestId || body.meta?.requestId || "");
              responseError.jobId = String(body.jobId || "");
              throw responseError;
            },
            buildTerminalError: function (jobBody) {
              const errorBody = jobBody?.error && typeof jobBody.error === "object" ? jobBody.error : {};
              const nestedError = errorBody.error && typeof errorBody.error === "object" ? errorBody.error : errorBody;
              const responseError = new Error(
                nestedError.message || errorBody.message || "AI 服务请求失败。"
              );
              responseError.code = String(nestedError.code || errorBody.code || "job-failed");
              responseError.requestId = String(jobBody?.requestId || errorBody?.meta?.requestId || "");
              responseError.jobId = String(jobBody?.jobId || "");
              throw responseError;
            },
            mapSuccess: function (jobBody) {
              return jobBody?.data;
            },
          });
          responseBody = {
            success: true,
            data: jobResult.data,
          };
        } else {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
            signal: controller ? controller.signal : undefined,
          });
          responseBody = await response.json().catch(function () {
            return null;
          });
          if (!response.ok || responseBody?.success !== true || !responseBody?.data) {
            const requestId = String(responseBody?.requestId || "");
            const responseError = new Error(
              responseBody?.message || "AI 服务请求失败（HTTP " + String(response.status) + "）。"
            );
            responseError.code = String(responseBody?.code || "");
            responseError.requestId = requestId;
            throw responseError;
          }
        }
      } catch (error) {
        const message = extractErrorMessage(error);
        const requestId = String(error?.requestId || responseBody?.requestId || "");
        renderErrorCard(
          item,
          {
            message,
            requestId,
            code: String(error?.code || ""),
          },
          contextState,
          {
            retrySuggestion: function () {
              return suggestCurrentItem("retry");
            },
            ignoreSuggestion: function () {
              return ignoreCurrentSuggestion("manual");
            },
            copyAsrTextPair: function () {
              return copyCurrentAsrTextPair("manual");
            },
            showToast: options.showToast,
          }
        );
        if (typeof options.showToast === "function") {
          options.showToast("AI 分析失败：" + message, "error");
        }
        return buildFailedActionResult(message, source, {
          code: String(error?.code || ""),
          requestId,
        });
      } finally {
        setItemPending(item, false, "");
        if (timer) {
          clearTimeout(timer);
        }
      }

      const suggestion = responseBody.data || {};
      const choiceActionKey =
        parseChoiceActionKey(suggestion) || mapAnswerTextToChoice(suggestion.answerText);
      const confidence = normalizeConfidence(suggestion.confidence);
      const thunderInfo = await requestThunderInfo(item);
      const thunderStandardChoice = mapAnswerTextToChoice(thunderInfo?.standardAnswer || "");
      const thunderConflict = Boolean(
        thunderInfo?.isThunder &&
          thunderStandardChoice &&
          choiceActionKey &&
          thunderStandardChoice !== choiceActionKey
      );

      const resultContextAvailable =
        suggestion.contextAvailable === true || contextState.contextAvailable;
      const resultContextIncluded =
        resultContextAvailable && suggestion.contextIncluded === true;
      setContextIncludeOverride(item, resultContextIncluded);
      const nextContextState = {
        contextAvailable: resultContextAvailable,
        includeContext: resultContextIncluded,
      };

      const models = suggestion.models && typeof suggestion.models === "object" ? suggestion.models : {};
      const timing = suggestion.timing && typeof suggestion.timing === "object" ? suggestion.timing : {};
      const listen = suggestion.listen && typeof suggestion.listen === "object" ? suggestion.listen : {};
      const cost = suggestion.cost && typeof suggestion.cost === "object" ? suggestion.cost : {};
      const cardData = {
        answerText: String(
          suggestion.answerText || CHOICE_LABELS[choiceActionKey] || suggestion.answer || "未知"
        ),
        choiceActionKey: choiceActionKey,
        confidence: confidence,
        reasonSummary: String(suggestion.reasonSummary || "").trim(),
        riskLevel: String(suggestion.riskLevel || "medium"),
        needManualSearch: suggestion.needManualSearch === true,
        shouldWarnBeforeApply:
          suggestion.shouldWarnBeforeApply === true ||
          suggestion.needManualSearch === true ||
          confidence < 0.65,
        requestId: String(suggestion.requestId || ""),
        thunderMatched: Boolean(thunderInfo?.isThunder),
        thunderConflict: thunderConflict,
        listenHeardText: String(listen.heardText || ""),
        listenConfidence: normalizeConfidence(listen.confidence),
        listenModel: String(models.listenModel || requestBody.listenModel || "-"),
        compareModel: String(models.compareModel || requestBody.compareModel || "-"),
        listenDurationMs: Number(timing.listenDurationMs || 0),
        compareDurationMs: Number(timing.compareDurationMs || 0),
        totalDurationMs: Number(timing.totalDurationMs || 0),
        cost: cost,
        contextIncluded: resultContextIncluded,
        webSearchStatusText: getWebSearchStatusText(suggestion.webSearch),
        webSearchHint: String(suggestion?.evidence?.webSearchHint || "").trim(),
      };
      rememberLatestSuggestion(item, {
        result: cardData,
        contextState: nextContextState,
      });
      renderCard(item, cardData, nextContextState, {
        applyCurrentSuggestion: function () {
          return applyCurrentSuggestion("manual");
        },
        retrySuggestion: function () {
          return suggestCurrentItem("retry");
        },
        ignoreSuggestion: function () {
          return ignoreCurrentSuggestion("manual");
        },
        copyAsrTextPair: function () {
          return copyCurrentAsrTextPair("manual");
        },
        showToast: options.showToast,
      });

      if (typeof options.onResult === "function") {
        options.onResult({
          requestId: cardData.requestId,
          hostname: resolveHostname(audioUrl),
          itemIndex: Number(requestBody.itemIndex),
          listenModel: cardData.listenModel,
          compareModel: cardData.compareModel,
          includeContext: cardData.contextIncluded === true,
        });
      }

      if (typeof options.showToast === "function") {
        options.showToast("AI 建议已生成，请人工确认后再采用。", "info");
      }

      return buildActionResult(true, "AI 建议已生成，请人工确认后再采用。", {
        source: source || "unknown",
        requestId: cardData.requestId,
      });
    }

    function clearAllCards() {
      document.querySelectorAll(".labelRender-item[data-index]").forEach(function (item) {
        removeCard(item);
      });
    }

    function retryCurrentSuggestion(source) {
      return suggestCurrentItem(source || "retry");
    }

    function start() {}

    function stop() {
      clearAllCards();
    }

    function getState() {
      return {
        active: true,
      };
    }

    return {
      start: start,
      stop: stop,
      getState: getState,
      suggestCurrentItem: suggestCurrentItem,
      applyCurrentSuggestion: applyCurrentSuggestion,
      retryCurrentSuggestion: retryCurrentSuggestion,
      ignoreCurrentSuggestion: ignoreCurrentSuggestion,
      copyCurrentAsrTextPair: copyCurrentAsrTextPair,
      hasItemContext: hasItemContext,
      resolveItemContextText: resolveItemContextText,
    };
  }

  globalThis.__ASREdgeAlibabaLabelxJudgementAiSuggestion = {
    AI_ACTION_KEY: AI_ACTION_KEY,
    RULE_VERSION: RULE_VERSION,
    ANSWER_TO_CHOICE: ANSWER_TO_CHOICE,
    createRuntime: createRuntime,
  };
})();

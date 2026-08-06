(function () {
  const PANEL_ATTR = "data-asr-edge-pulse-translation-panel";
  const PANEL_HANDLE_KEY = "__asrEdgePulsePanelHandle";
  const TASK_TEMPLATE_ICON_SELECTOR = "span.anticon-file-text";
  const ANNOTATION_STEPS_TITLE = "标注步骤";
  const RULE_LOAD_TIMEOUT_MS = 2500;

  function normalizeText(value) {
    return String(value || "").trim();
  }

  function findTaskTemplateButton(root) {
    const buttons = Array.from(root && root.querySelectorAll ? root.querySelectorAll("button") : []);
    return (
      buttons.find(function (button) {
        return Boolean(button && typeof button.querySelector === "function" && button.querySelector(TASK_TEMPLATE_ICON_SELECTOR));
      }) || null
    );
  }

  function findAnnotationStepsSection(root) {
    const sections = Array.from(root && root.querySelectorAll ? root.querySelectorAll("section") : []);
    return (
      sections.find(function (section) {
        const headings = Array.from(section && section.querySelectorAll ? section.querySelectorAll("div") : []);
        return headings.some(function (heading) {
          return normalizeText(heading && heading.textContent) === ANNOTATION_STEPS_TITLE;
        });
      }) || null
    );
  }

  function extractAnnotationSteps(section) {
    return Array.from(section && section.querySelectorAll ? section.querySelectorAll("ol > li") : [])
      .map(function (item) {
        return normalizeText(item && item.textContent);
      })
      .filter(Boolean);
  }

  function createTaskContextKey(locationLike, templateButton) {
    const pathname = normalizeText(locationLike && locationLike.pathname);
    const templateName = normalizeText(templateButton && templateButton.textContent);
    return pathname && templateName ? pathname + "|" + templateName : "";
  }

  function buildAnnotationStepsResult(section, openedByAssistant) {
    if (!section) {
      return { status: "missing_annotation_steps" };
    }
    const steps = extractAnnotationSteps(section);
    if (!steps.length) {
      return { status: "empty_annotation_steps" };
    }
    return {
      status: "ready",
      steps: steps,
      openedByAssistant: Boolean(openedByAssistant),
    };
  }

  function waitForAnnotationStepsSection(root, options) {
    const existing = findAnnotationStepsSection(root);
    if (existing) {
      return Promise.resolve(existing);
    }
    const config = options && typeof options === "object" ? options : {};
    const timeoutMs = Number.isFinite(config.timeoutMs) ? config.timeoutMs : RULE_LOAD_TIMEOUT_MS;
    const Observer = config.MutationObserver || globalThis.MutationObserver;
    const scheduleTimeout = config.setTimeout || globalThis.setTimeout;
    const cancelTimeout = config.clearTimeout || globalThis.clearTimeout;
    return new Promise(function (resolve) {
      let observer = null;
      let timeoutId = null;
      let completed = false;
      function finish(section) {
        if (completed) {
          return;
        }
        completed = true;
        if (observer && typeof observer.disconnect === "function") {
          observer.disconnect();
        }
        if (timeoutId != null && typeof cancelTimeout === "function") {
          cancelTimeout(timeoutId);
        }
        resolve(section || null);
      }
      if (typeof Observer === "function") {
        observer = new Observer(function () {
          const section = findAnnotationStepsSection(root);
          if (section) {
            finish(section);
          }
        });
        try {
          observer.observe((root && root.documentElement) || root, { childList: true, subtree: true });
        } catch (_error) {
          observer = null;
        }
      }
      if (typeof scheduleTimeout === "function") {
        timeoutId = scheduleTimeout(function () {
          finish(findAnnotationStepsSection(root));
        }, Math.max(0, timeoutMs));
        return;
      }
      finish(findAnnotationStepsSection(root));
    });
  }

  async function loadAnnotationSteps(root, options) {
    const initialSection = findAnnotationStepsSection(root);
    if (initialSection) {
      return buildAnnotationStepsResult(initialSection, false);
    }
    const templateButton = findTaskTemplateButton(root);
    if (!templateButton || typeof templateButton.click !== "function") {
      return { status: "missing_template_button" };
    }
    const config = options && typeof options === "object" ? options : {};
    let openedByAssistant = false;
    try {
      templateButton.click();
      openedByAssistant = true;
      const waitForSection = typeof config.waitForSection === "function" ? config.waitForSection : waitForAnnotationStepsSection;
      const section = await waitForSection(root, config);
      return buildAnnotationStepsResult(section, openedByAssistant);
    } catch (_error) {
      return { status: "missing_annotation_steps" };
    } finally {
      if (openedByAssistant) {
        templateButton.click();
      }
    }
  }

  function findTranslationGroup(root) {
    const labels = Array.from(root && root.querySelectorAll ? root.querySelectorAll("span") : []);
    for (const label of labels) {
      if (String(label.textContent || "").trim() !== "中文翻译") {
        continue;
      }
      let node = label.parentElement;
      while (node) {
        if (typeof node.querySelector === "function" && node.querySelector("textarea")) {
          return node;
        }
        node = node.parentElement;
      }
    }
    return null;
  }

  function hasMountedPanel(group) {
    return Boolean(group && typeof group.querySelector === "function" && group.querySelector("[" + PANEL_ATTR + "]"));
  }

  function createHighlightParts(text, matches) {
    const value = String(text || "");
    const sourceMatches = Array.isArray(matches) ? matches : [];
    const validMatches = sourceMatches
      .filter(function (match) {
        return (
          match &&
          Number.isInteger(match.start) &&
          Number.isInteger(match.end) &&
          match.start >= 0 &&
          match.end > match.start &&
          match.end <= value.length
        );
      })
      .sort(function (left, right) {
        return left.start - right.start || right.end - left.end;
      });
    const parts = [];
    let cursor = 0;
    validMatches.forEach(function (match) {
      if (match.start < cursor) {
        return;
      }
      if (match.start > cursor) {
        parts.push({ type: "text", text: value.slice(cursor, match.start) });
      }
      parts.push({ type: "match", text: value.slice(match.start, match.end), term: match.term || "" });
      cursor = match.end;
    });
    if (cursor < value.length || !parts.length) {
      parts.push({ type: "text", text: value.slice(cursor) });
    }
    return parts;
  }

  function renderHighlightParts(container, text, matches) {
    const doc = container.ownerDocument;
    container.replaceChildren();
    createHighlightParts(text, matches).forEach(function (part) {
      if (part.type === "match") {
        const mark = doc.createElement("span");
        mark.textContent = part.text;
        mark.style.color = "#d4380d";
        mark.style.fontWeight = "700";
        mark.setAttribute("data-asr-edge-pulse-forbidden", "true");
        container.appendChild(mark);
        return;
      }
      container.appendChild(doc.createTextNode(part.text));
    });
  }

  function renderAnnotationSteps(container, steps) {
    const doc = container.ownerDocument;
    container.replaceChildren();
    const list = doc.createElement("ol");
    list.style.margin = "0";
    list.style.paddingLeft = "18px";
    list.style.whiteSpace = "pre-wrap";
    list.style.wordBreak = "break-word";
    (Array.isArray(steps) ? steps : []).forEach(function (step) {
      const item = doc.createElement("li");
      item.textContent = step;
      list.appendChild(item);
    });
    container.appendChild(list);
  }

  function getDocumentTaskContextKey(doc, fallbackKey) {
    const locationLike = (doc && doc.defaultView && doc.defaultView.location) || globalThis.location || null;
    const directKey = createTaskContextKey(locationLike, findTaskTemplateButton(doc));
    if (directKey) {
      return directKey;
    }
    const pathname = normalizeText(locationLike && locationLike.pathname);
    const previousKey = normalizeText(fallbackKey);
    const separatorIndex = previousKey.indexOf("|");
    const fallbackTemplateName = separatorIndex >= 0 ? previousKey.slice(separatorIndex + 1) : "";
    return pathname && fallbackTemplateName ? pathname + "|" + fallbackTemplateName : "";
  }

  function createPanel(group, textarea, getMatcher) {
    const doc = group.ownerDocument;
    const panel = doc.createElement("section");
    panel.setAttribute(PANEL_ATTR, "true");
    panel.style.display = "flex";
    panel.style.flexDirection = "column";
    panel.style.gap = "6px";
    panel.style.marginTop = "8px";

    const actionRow = doc.createElement("div");
    actionRow.style.display = "flex";
    actionRow.style.alignItems = "center";
    actionRow.style.gap = "8px";
    const checkButton = doc.createElement("button");
    checkButton.type = "button";
    checkButton.textContent = "检查禁用词";
    checkButton.style.cursor = "pointer";
    checkButton.style.border = "1px solid var(--xdof-silver, #d9d9d9)";
    checkButton.style.borderRadius = "4px";
    checkButton.style.padding = "3px 9px";
    checkButton.style.background = "var(--xdof-white, #fff)";
    checkButton.style.color = "var(--xdof-black, #1f1f1f)";
    const status = doc.createElement("span");
    status.style.fontSize = "12px";
    status.style.color = "var(--xdof-slate, #5b6472)";
    actionRow.append(checkButton, status);

    const mirror = doc.createElement("div");
    mirror.setAttribute("data-asr-edge-pulse-forbidden-mirror", "true");
    mirror.setAttribute("aria-live", "polite");
    mirror.style.whiteSpace = "pre-wrap";
    mirror.style.wordBreak = "break-word";
    mirror.style.border = "1px solid var(--xdof-silver, #d9d9d9)";
    mirror.style.borderRadius = "4px";
    mirror.style.padding = "8px 11px";
    mirror.style.background = "var(--xdof-mist, #fafafa)";
    mirror.style.color = "var(--xdof-black, #1f1f1f)";
    mirror.style.fontSize = "14px";
    mirror.style.fontWeight = "500";
    mirror.style.lineHeight = "1.5";

    const details = doc.createElement("details");
    details.style.borderTop = "1px solid var(--xdof-silver, #d9d9d9)";
    details.style.paddingTop = "6px";
    const summary = doc.createElement("summary");
    summary.textContent = "标注规则";
    summary.style.cursor = "pointer";
    summary.style.fontSize = "12px";
    summary.style.fontWeight = "600";
    const rules = doc.createElement("div");
    rules.style.marginTop = "6px";
    rules.style.fontSize = "12px";
    rules.style.lineHeight = "1.6";
    rules.style.color = "var(--xdof-slate, #5b6472)";
    const rulesStatus = doc.createElement("div");
    rulesStatus.setAttribute("data-asr-edge-pulse-rules-status", "true");
    rulesStatus.style.marginTop = "6px";
    rulesStatus.style.fontSize = "12px";
    rulesStatus.style.color = "var(--xdof-slate, #5b6472)";
    details.append(summary, rulesStatus, rules);
    panel.append(actionRow, mirror, details);
    textarea.insertAdjacentElement("afterend", panel);

    let destroyed = false;
    let rulesLoading = false;
    let cachedRuleSteps = null;
    let taskContextKey = getDocumentTaskContextKey(doc);

    function clearRules(message) {
      rules.replaceChildren();
      rulesStatus.textContent = message;
    }

    function renderLoadedRules(steps) {
      renderAnnotationSteps(rules, steps);
      rulesStatus.textContent = "已读取当前任务的标注步骤。";
    }

    function refreshTaskContext(options) {
      const config = options && typeof options === "object" ? options : {};
      const nextKey = getDocumentTaskContextKey(doc, taskContextKey);
      if (!nextKey || nextKey === taskContextKey) {
        return false;
      }
      taskContextKey = nextKey;
      cachedRuleSteps = null;
      rulesLoading = false;
      clearRules("展开标注规则以加载当前任务规则。");
      if (config.keepOpen !== true) {
        details.open = false;
      }
      return true;
    }

    function renderUnverified(message) {
      renderHighlightParts(mirror, textarea.value, []);
      status.textContent = message;
    }

    function handleInput() {
      renderUnverified("内容已变更，请重新检查。");
    }

    function resetForbiddenTermsCheck() {
      renderUnverified("禁用词表已更新，请重新检查。");
    }

    async function handleCheck() {
      const value = String(textarea.value || "");
      if (!value) {
        renderHighlightParts(mirror, value, []);
        status.textContent = "当前文本为空。";
        return;
      }
      checkButton.disabled = true;
      status.textContent = "正在检查…";
      try {
        const matcher = await getMatcher();
        if (!matcher || typeof matcher.find !== "function") {
          throw new Error("禁用词表不可用。");
        }
        const matches = matcher.find(value);
        renderHighlightParts(mirror, value, matches);
        status.textContent = matches.length ? "发现 " + matches.length + " 处禁用词，已标红。" : "未发现禁用词。";
      } catch (error) {
        renderHighlightParts(mirror, value, []);
        status.textContent = "禁用词表加载失败，无法检查。";
      } finally {
        checkButton.disabled = false;
      }
    }

    async function handleRulesToggle() {
      if (!details.open) {
        return;
      }
      refreshTaskContext({ keepOpen: true });
      if (cachedRuleSteps) {
        renderLoadedRules(cachedRuleSteps);
        return;
      }
      if (rulesLoading) {
        return;
      }
      const requestedTaskKey = getDocumentTaskContextKey(doc, taskContextKey);
      rulesLoading = true;
      clearRules("正在读取当前任务规则…");
      const result = await loadAnnotationSteps(doc);
      if (destroyed) {
        return;
      }
      const currentTaskKey = getDocumentTaskContextKey(doc, requestedTaskKey);
      if (requestedTaskKey && currentTaskKey && requestedTaskKey !== currentTaskKey) {
        rulesLoading = false;
        refreshTaskContext({ keepOpen: true });
        return;
      }
      rulesLoading = false;
      if (result.status === "ready") {
        cachedRuleSteps = result.steps;
        renderLoadedRules(result.steps);
        return;
      }
      clearRules("未找到当前任务的标注步骤，可再次展开重试。");
    }

    textarea.addEventListener("input", handleInput);
    checkButton.addEventListener("click", handleCheck);
    details.addEventListener("toggle", handleRulesToggle);
    renderUnverified("点击“检查禁用词”开始核查。");
    clearRules("展开标注规则以加载当前任务规则。");
    const handle = {
      node: panel,
      refresh: function () {
        refreshTaskContext();
      },
      resetForbiddenTermsCheck: resetForbiddenTermsCheck,
      destroy: function () {
        if (destroyed) {
          return;
        }
        destroyed = true;
        textarea.removeEventListener("input", handleInput);
        checkButton.removeEventListener("click", handleCheck);
        details.removeEventListener("toggle", handleRulesToggle);
        delete panel[PANEL_HANDLE_KEY];
        panel.remove();
      },
    };
    panel[PANEL_HANDLE_KEY] = handle;
    return handle;
  }

  function mount(root, getMatcher) {
    const group = findTranslationGroup(root);
    const textarea = group && group.querySelector("textarea");
    if (!group || !textarea) {
      return null;
    }
    if (hasMountedPanel(group)) {
      const panel = group.querySelector("[" + PANEL_ATTR + "]");
      const handle = panel && panel[PANEL_HANDLE_KEY];
      if (handle && typeof handle.refresh === "function") {
        handle.refresh();
      }
      return handle || { node: panel, destroy: function () {} };
    }
    return createPanel(group, textarea, getMatcher);
  }

  function removeAll(root) {
    Array.from(root && root.querySelectorAll ? root.querySelectorAll("[" + PANEL_ATTR + "]") : []).forEach(
      function (node) {
        const handle = node && node[PANEL_HANDLE_KEY];
        if (handle && typeof handle.destroy === "function") {
          handle.destroy();
          return;
        }
        node.remove();
      }
    );
  }

  globalThis.ASREdgePulseUiPanel = {
    PANEL_ATTR: PANEL_ATTR,
    findTranslationGroup: findTranslationGroup,
    hasMountedPanel: hasMountedPanel,
    createHighlightParts: createHighlightParts,
    findTaskTemplateButton: findTaskTemplateButton,
    findAnnotationStepsSection: findAnnotationStepsSection,
    extractAnnotationSteps: extractAnnotationSteps,
    createTaskContextKey: createTaskContextKey,
    waitForAnnotationStepsSection: waitForAnnotationStepsSection,
    loadAnnotationSteps: loadAnnotationSteps,
    mount: mount,
    removeAll: removeAll,
  };
})();

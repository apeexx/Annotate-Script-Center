(function () {
  const TASK21_DOM_ACTIONS_VERSION = "task21-dom-actions-fill-v2-20260519";
  const FIELD_SAME_FONT = "same_font";
  const FIELD_IMAGE_B_TEXTS_REMOVED = "image_b_texts_removed";
  const FIELD_OTHER_CHANGES = "other_changes";
  const OPTION_TRUE = "true";
  const OPTION_FALSE = "false";
  const OPTION_ARTISTIC = "same underlying font+artistic effect";
  const OPTION_SPECIFY = "specify";
  const OPTION_UNSURE = "unsure";
  const OPTION_NULL = "null";
  const KNOWN_FIELD_NAMES = [FIELD_SAME_FONT, FIELD_IMAGE_B_TEXTS_REMOVED, FIELD_OTHER_CHANGES];
  const FORM_LIKE_SELECTOR =
    ".l-item,.l-label,[class*='form'],[class*='field'],[class*='item'],[class*='question']";
  const INPUT_SELECTOR_PRIORITY = [
    "textarea.n-input__textarea-el",
    ".custom-md-editor textarea.inputarea",
    ".monaco-editor textarea.inputarea",
    "textarea.monaco-mouse-cursor-text",
    ".n-input--textarea textarea",
    "textarea",
    "input[type='text']",
    "input:not([type])",
    "[contenteditable='true']",
    "[role='textbox']",
  ];
  const STASH_BUTTON_TEXTS = ["暂存", "save", "stash"];
  const SUBMIT_REVIEW_BUTTON_TEXTS = ["送审", "submit review", "submit"];
  const REVIEW_ROLE_SIGNAL_TEXTS = ["标注内审", "领取审核", "claim review", "reviewer", "review team"];

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function normalizeExact(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function normalizeCompactText(value) {
    return String(value || "").replace(/\s+/g, "").trim().toLowerCase();
  }

  function isKnownFieldName(value) {
    const text = normalizeText(value);
    return KNOWN_FIELD_NAMES.indexOf(text) >= 0;
  }

  function isAiPanelDescendant(node) {
    return node instanceof Element && Boolean(node.closest(".asc-abaka-ai-result-panel"));
  }

  function isVisible(node) {
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

  function isMonacoTextarea(node) {
    return (
      node instanceof HTMLTextAreaElement &&
      (node.classList.contains("inputarea") ||
        node.classList.contains("monaco-mouse-cursor-text") ||
        Boolean(node.closest(".monaco-editor")))
    );
  }

  function isNodeVisibleForTextInput(node) {
    if (!(node instanceof Element)) {
      return false;
    }
    if (isVisible(node)) {
      return true;
    }
    if (isMonacoTextarea(node)) {
      const monacoRoot = node.closest(".monaco-editor,.custom-md-editor");
      return monacoRoot ? isVisible(monacoRoot) : false;
    }
    return false;
  }

  function getAllVisibleTextElements() {
    const nodes = document.querySelectorAll(".l-title-text,div,span,label,strong,b,p,h1,h2,h3,h4,h5,h6");
    return Array.from(nodes).filter(function (node) {
      if (!(node instanceof Element)) {
        return false;
      }
      if (isAiPanelDescendant(node)) {
        return false;
      }
      return isVisible(node) && normalizeExact(node.textContent || "").length > 0;
    });
  }

  function findFieldTitleNode(fieldName) {
    const exactTask21Item = findTask21FieldItemByTitle(fieldName);
    if (exactTask21Item && exactTask21Item.titleNode) {
      return exactTask21Item.titleNode;
    }
    const target = normalizeText(fieldName);
    const candidates = getAllVisibleTextElements().filter(function (node) {
      return normalizeText(node.textContent || "") === target;
    });
    if (candidates.length <= 0) {
      return null;
    }
    candidates.sort(function (a, b) {
      function score(node) {
        let value = 0;
        if (!(node instanceof Element)) {
          return value;
        }
        if (node.matches(".l-title-text")) {
          value += 100;
        }
        if (node.closest(".l-item")) {
          value += 20;
        }
        if (node.closest(".l-label")) {
          value += 10;
        }
        if (node.closest(FORM_LIKE_SELECTOR)) {
          value += 5;
        }
        return value;
      }
      return score(b) - score(a);
    });
    return candidates[0] || null;
  }

  function findTask21FieldItemByTitle(fieldName) {
    const exactTarget = normalizeExact(fieldName);
    if (!exactTarget) {
      return null;
    }
    const items = document.querySelectorAll(".l-item");
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      if (!(item instanceof Element) || isAiPanelDescendant(item)) {
        continue;
      }
      const titleNode = item.querySelector(".l-title-text");
      if (!(titleNode instanceof Element) || isAiPanelDescendant(titleNode) || !isVisible(titleNode)) {
        continue;
      }
      if (normalizeExact(titleNode.textContent || "") !== exactTarget) {
        continue;
      }
      return { item: item, titleNode: titleNode };
    }
    return null;
  }

  function hasFieldInputSignal(root) {
    if (!(root instanceof Element)) {
      return false;
    }
    return Boolean(
      root.querySelector(
        ".custom-md-editor,.monaco-editor,textarea.n-input__textarea-el,.n-input--textarea,textarea"
      )
    );
  }

  function findFieldItem(fieldName) {
    const exactTask21Item = findTask21FieldItemByTitle(fieldName);
    if (exactTask21Item && exactTask21Item.item) {
      return exactTask21Item.item;
    }
    const titleNode = findFieldTitleNode(fieldName);
    if (!titleNode) {
      return null;
    }
    const chain = [];
    let current = titleNode;
    let depth = 0;
    while (current && current !== document.body && depth < 10) {
      if (current instanceof Element) {
        chain.push(current);
      }
      current = current.parentElement;
      depth += 1;
    }
    const preferred = chain.find(function (node) {
      return node.matches(".l-item");
    });
    if (preferred && hasFieldInputSignal(preferred)) {
      return preferred;
    }
    for (let i = 0; i < chain.length; i += 1) {
      const node = chain[i];
      if (
        node.matches &&
        node.matches("section,article,form,[role='group'],[class*='item'],[class*='field'],[class*='question']") &&
        hasFieldInputSignal(node)
      ) {
        return node;
      }
    }
    return preferred || titleNode.parentElement || null;
  }

  function collectKnownFieldTitleNodesInRoot(root) {
    if (!(root instanceof Element)) {
      return [];
    }
    const titleNodes = root.querySelectorAll(".l-title-text,div,span,label,strong,b,p,h1,h2,h3,h4,h5,h6");
    const result = [];
    for (let i = 0; i < titleNodes.length; i += 1) {
      const node = titleNodes[i];
      const text = normalizeText(node.textContent || "");
      if (!isKnownFieldName(text)) {
        continue;
      }
      if (!isVisible(node) || isAiPanelDescendant(node)) {
        continue;
      }
      result.push(node);
    }
    return result;
  }

  function isNodeInFieldRange(node, fieldName, titleNode, rangeRoot) {
    if (!(node instanceof Element) || !(titleNode instanceof Element) || !(rangeRoot instanceof Element)) {
      return false;
    }
    if (!rangeRoot.contains(node)) {
      return false;
    }
    const relation = titleNode.compareDocumentPosition(node);
    if (!(relation & Node.DOCUMENT_POSITION_FOLLOWING) && node !== titleNode) {
      return false;
    }
    const titles = collectKnownFieldTitleNodesInRoot(rangeRoot);
    let nextTitle = null;
    for (let i = 0; i < titles.length; i += 1) {
      const current = titles[i];
      if (current === titleNode) {
        continue;
      }
      const currentName = normalizeText(current.textContent || "");
      if (!isKnownFieldName(currentName) || currentName === normalizeText(fieldName)) {
        continue;
      }
      const currentRelation = titleNode.compareDocumentPosition(current);
      if (currentRelation & Node.DOCUMENT_POSITION_FOLLOWING) {
        if (!nextTitle) {
          nextTitle = current;
        } else {
          const nextRelation = current.compareDocumentPosition(nextTitle);
          if (nextRelation & Node.DOCUMENT_POSITION_PRECEDING) {
            nextTitle = current;
          }
        }
      }
    }
    if (!nextTitle) {
      return true;
    }
    const againstNext = node.compareDocumentPosition(nextTitle);
    return Boolean(againstNext & Node.DOCUMENT_POSITION_PRECEDING);
  }

  function findFieldSearchRoots(fieldName) {
    const roots = [];
    const seen = new Set();
    const titleNode = findFieldTitleNode(fieldName);
    const fieldItem = findFieldItem(fieldName);

    function push(node) {
      if (!(node instanceof Element) || seen.has(node)) {
        return;
      }
      seen.add(node);
      roots.push(node);
    }

    push(fieldItem);
    if (titleNode) {
      push(titleNode.closest(".l-item"));
      push(titleNode.parentElement);
      const header = titleNode.closest(".l-header");
      if (header && header.parentElement) {
        push(header.parentElement);
      }
      let sibling =
        (header && header.nextElementSibling) || (titleNode.parentElement && titleNode.parentElement.nextElementSibling);
      let steps = 0;
      while (sibling && steps < 5) {
        push(sibling);
        sibling = sibling.nextElementSibling;
        steps += 1;
      }
    }

    const labels = findFieldLabelContainers(fieldName);
    for (let i = 0; i < labels.length; i += 1) {
      push(labels[i]);
    }

    return {
      titleNode: titleNode,
      fieldItem: fieldItem,
      roots: roots,
    };
  }

  function findMonacoEditorForField(fieldName) {
    return getFieldEditorContext(fieldName).monacoEditor || null;
  }

  function isMonacoTextareaCandidate(node, fieldItem) {
    if (!(node instanceof HTMLTextAreaElement)) {
      return false;
    }
    if (!isMonacoTextarea(node)) {
      return false;
    }
    const monacoRoot = node.closest(".monaco-editor,.custom-md-editor");
    const scopeItem =
      fieldItem instanceof Element
        ? fieldItem
        : (node.getAttribute("data-asc-field-name") && findFieldItem(node.getAttribute("data-asc-field-name"))) ||
          node.closest(".l-item");
    return Boolean(scopeItem instanceof Element && monacoRoot instanceof Element && scopeItem.contains(monacoRoot));
  }

  function getFieldEditorContext(fieldName) {
    const exactTask21Item = findTask21FieldItemByTitle(fieldName);
    const fieldItem = (exactTask21Item && exactTask21Item.item) || findFieldItem(fieldName);
    const titleNode = (exactTask21Item && exactTask21Item.titleNode) || findFieldTitleNode(fieldName);
    const customMdEditor =
      fieldItem instanceof Element ? fieldItem.querySelector(".l-label .custom-md-editor,.custom-md-editor") : null;
    const monacoContainer =
      fieldItem instanceof Element ? fieldItem.querySelector(".l-label .monaco-container,.monaco-container") : null;
    const monacoEditor =
      fieldItem instanceof Element
        ? fieldItem.querySelector(
            ".custom-md-editor .monaco-editor,.monaco-container .monaco-editor,.monaco-editor"
          )
        : null;
    const monacoTextarea =
      fieldItem instanceof Element
        ? fieldItem.querySelector(
            ".monaco-editor textarea.inputarea,textarea.inputarea.monaco-mouse-cursor-text,textarea.monaco-mouse-cursor-text"
          )
        : null;
    const viewLines =
      fieldItem instanceof Element ? fieldItem.querySelector(".monaco-editor .view-lines,.view-lines") : null;
    const naiveTextarea =
      fieldItem instanceof Element
        ? fieldItem.querySelector("textarea.n-input__textarea-el,.n-input--textarea textarea")
        : null;
    return {
      fieldName: fieldName,
      titleNode: titleNode,
      fieldItem: fieldItem,
      customMdEditor: customMdEditor instanceof Element ? customMdEditor : null,
      monacoContainer: monacoContainer instanceof Element ? monacoContainer : null,
      monacoEditor: monacoEditor instanceof Element ? monacoEditor : null,
      monacoTextarea: monacoTextarea instanceof HTMLTextAreaElement ? monacoTextarea : null,
      naiveTextarea: naiveTextarea instanceof HTMLTextAreaElement ? naiveTextarea : null,
      viewLines: viewLines instanceof Element ? viewLines : null,
      monacoDataUri:
        monacoEditor instanceof Element ? normalizeExact(monacoEditor.getAttribute("data-uri") || "") : "",
    };
  }

  function getTextPreview(value, maxLength) {
    return normalizeExact(String(value || "").replace(/\s+/g, " ")).slice(0, Math.max(1, maxLength || 120));
  }

  function buildFieldTextInputDiagnostic(fieldName, searchRoots, candidates) {
    const search = searchRoots || findFieldSearchRoots(fieldName);
    const context = getFieldEditorContext(fieldName);
    return {
      fieldName: fieldName,
      titleFound: Boolean(context.titleNode || search.titleNode),
      fieldItemFound: Boolean(context.fieldItem || search.fieldItem),
      customMdEditorFound: Boolean(context.customMdEditor),
      monacoContainerFound: Boolean(context.monacoContainer),
      monacoEditorFound: Boolean(context.monacoEditor),
      monacoDataUri: context.monacoDataUri || "",
      monacoTextareaFound: Boolean(context.monacoTextarea),
      naiveTextareaFound: Boolean(context.naiveTextarea),
      viewLinesFound: Boolean(context.viewLines),
      viewLinesPreview: getTextPreview(context.viewLines ? context.viewLines.textContent || "" : "", 160),
      candidateCount: Array.isArray(candidates) ? candidates.length : 0,
    };
  }

  function diagnosticText(diagnostic) {
    if (!diagnostic || typeof diagnostic !== "object") {
      return "";
    }
    return (
      "找到标题=" +
      String(diagnostic.titleFound) +
      "，找到字段容器=" +
      String(diagnostic.fieldItemFound) +
      "，custom-md-editor=" +
      String(diagnostic.customMdEditorFound) +
      "，monaco-container=" +
      String(diagnostic.monacoContainerFound) +
      "，monaco-editor=" +
      String(diagnostic.monacoEditorFound) +
      "，monaco-data-uri=" +
      String(diagnostic.monacoDataUri || "-") +
      "，textarea.inputarea=" +
      String(diagnostic.monacoTextareaFound) +
      "，naive textarea=" +
      String(diagnostic.naiveTextareaFound) +
      "，view-lines=" +
      String(diagnostic.viewLinesFound) +
      "，viewLinesPreview=" +
      String(diagnostic.viewLinesPreview || "-") +
      "，候选数=" +
      String(diagnostic.candidateCount)
    );
  }

  function findFieldLabelContainers(fieldName) {
    const results = [];
    const seen = new Set();
    function pushNode(node) {
      if (!(node instanceof Element) || seen.has(node)) {
        return;
      }
      seen.add(node);
      results.push(node);
    }

    const fieldItem = findFieldItem(fieldName);
    const titleNode = findFieldTitleNode(fieldName);
    if (fieldItem) {
      pushNode(fieldItem);
      const labels = fieldItem.querySelectorAll(".l-label");
      for (let i = 0; i < labels.length; i += 1) {
        pushNode(labels[i]);
      }
    }
    if (titleNode) {
      const titleParents = [
        titleNode.parentElement,
        titleNode.closest(".l-header"),
        titleNode.closest(".l-item"),
      ].filter(Boolean);
      for (let i = 0; i < titleParents.length; i += 1) {
        const parent = titleParents[i];
        pushNode(parent);
        const labels = parent.querySelectorAll ? parent.querySelectorAll(".l-label") : [];
        for (let j = 0; j < labels.length; j += 1) {
          pushNode(labels[j]);
        }
      }
      let sibling = titleNode.closest(".l-header")?.nextElementSibling || titleNode.parentElement?.nextElementSibling;
      let steps = 0;
      while (sibling && steps < 6) {
        pushNode(sibling);
        const labels = sibling.querySelectorAll ? sibling.querySelectorAll(".l-label") : [];
        for (let j = 0; j < labels.length; j += 1) {
          pushNode(labels[j]);
        }
        sibling = sibling.nextElementSibling;
        steps += 1;
      }
    }
    return results;
  }

  function findOptionTextNode(container, optionText) {
    if (!(container instanceof Element)) {
      return null;
    }
    const target = normalizeText(optionText);
    const nodes = container.querySelectorAll(
      "label,button,[role='radio'],[role='button'],input[type='radio'],span,div,p"
    );
    const candidates = [];
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i];
      if (!isVisible(node)) {
        continue;
      }
      const text = normalizeText(node.textContent || "");
      if (!text || text !== target) {
        continue;
      }
      candidates.push(node);
    }
    if (candidates.length === 0) {
      return null;
    }
    candidates.sort(function (a, b) {
      const al = normalizeExact(a.textContent || "").length;
      const bl = normalizeExact(b.textContent || "").length;
      return al - bl;
    });
    return candidates[0];
  }

  function findFieldContainer(fieldName, optionText) {
    const titleNode = findFieldTitleNode(fieldName);
    if (!titleNode) {
      return null;
    }

    const maxDepth = 8;
    let current = titleNode;
    for (let depth = 0; depth < maxDepth && current && current !== document.body; depth += 1) {
      if (findOptionTextNode(current, optionText)) {
        return current;
      }
      current = current.parentElement;
    }

    const broad = findFieldItem(fieldName);
    if (broad && findOptionTextNode(broad, optionText)) {
      return broad;
    }
    return null;
  }

  function findClickableElement(node) {
    if (!(node instanceof Element)) {
      return null;
    }

    if (node.matches("input[type='radio']")) {
      return node;
    }

    const radio = node.querySelector("input[type='radio']");
    if (radio) {
      return radio;
    }

    const direct = node.closest("label,button,[role='radio'],[role='button'],.radio-item,.ant-radio-wrapper,.el-radio");
    if (direct) {
      return direct;
    }

    let current = node;
    while (current && current !== document.body) {
      if (
        current.matches &&
        current.matches("label,button,[role='radio'],[role='button'],.radio-item,.ant-radio-wrapper,.el-radio")
      ) {
        return current;
      }
      current = current.parentElement;
    }
    return node;
  }

  function dispatchClickSequence(target) {
    if (!(target instanceof Element)) {
      return;
    }
    if (target instanceof HTMLInputElement && target.type === "radio") {
      target.click();
      target.dispatchEvent(new Event("input", { bubbles: true }));
      target.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
    target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
    target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
    target.click();
    target.dispatchEvent(new Event("input", { bubbles: true }));
    target.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function isElementDisabled(node) {
    if (!(node instanceof Element)) {
      return true;
    }
    if (node.hasAttribute("disabled")) {
      return true;
    }
    if (node.getAttribute("aria-disabled") === "true") {
      return true;
    }
    const classText = String(node.className || "").toLowerCase();
    if (
      classText.indexOf("disabled") >= 0 ||
      classText.indexOf("is-disabled") >= 0 ||
      classText.indexOf("ant-btn-disabled") >= 0
    ) {
      return true;
    }
    return false;
  }

  function isTextInputWritable(node) {
    if (!(node instanceof Element) || !isNodeVisibleForTextInput(node) || isElementDisabled(node)) {
      return false;
    }
    if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) {
      if (node.readOnly) {
        return false;
      }
      return true;
    }
    if (node.getAttribute("contenteditable") === "true" || node.getAttribute("role") === "textbox") {
      return node.getAttribute("aria-readonly") !== "true";
    }
    return false;
  }

  function findFieldTextInput(fieldName) {
    const normalizedFieldName = normalizeText(fieldName);
    const scopedContext = getFieldEditorContext(fieldName);
    if (normalizedFieldName === FIELD_IMAGE_B_TEXTS_REMOVED) {
      const monacoCandidates = [];
      [
        scopedContext.customMdEditor,
        scopedContext.monacoContainer,
        scopedContext.monacoEditor,
        scopedContext.monacoTextarea,
        scopedContext.viewLines,
      ].forEach(function (node) {
        if (node instanceof Element && monacoCandidates.indexOf(node) < 0) {
          monacoCandidates.push(node);
        }
      });
      const diagnostic = buildFieldTextInputDiagnostic(fieldName, null, monacoCandidates);
      const targetNode =
        scopedContext.monacoEditor ||
        scopedContext.monacoTextarea ||
        scopedContext.customMdEditor ||
        scopedContext.viewLines;
      if (targetNode instanceof Element) {
        return {
          ok: true,
          node: targetNode,
          message: "已找到当前字段内的 Monaco 编辑器。",
          diagnostic: diagnostic,
        };
      }
      return {
        ok: false,
        node: null,
        message: "当前字段内未找到 Monaco 编辑器输入区：" + fieldName,
        diagnostic: diagnostic,
      };
    }
    if (normalizedFieldName === FIELD_OTHER_CHANGES) {
      const diagnostic = buildFieldTextInputDiagnostic(fieldName, null, scopedContext.naiveTextarea ? [scopedContext.naiveTextarea] : []);
      if (scopedContext.naiveTextarea instanceof HTMLTextAreaElement && isTextInputWritable(scopedContext.naiveTextarea)) {
        return {
          ok: true,
          node: scopedContext.naiveTextarea,
          message: "已找到当前字段内的 Naive UI textarea。",
          diagnostic: diagnostic,
        };
      }
      return {
        ok: false,
        node: null,
        message: "当前字段内未找到 Naive UI textarea：" + fieldName,
        diagnostic: diagnostic,
      };
    }

    const search = findFieldSearchRoots(fieldName);
    if (!search.roots || search.roots.length <= 0) {
      const diagnostic = buildFieldTextInputDiagnostic(fieldName, search, []);
      return {
        ok: false,
        message: "未找到完整字段容器：" + fieldName,
        node: null,
        diagnostic: diagnostic,
      };
    }

    const candidates = [];
    const seenCandidates = new Set();
    const titleNode = search.titleNode;
    for (let s = 0; s < INPUT_SELECTOR_PRIORITY.length; s += 1) {
      const selector = INPUT_SELECTOR_PRIORITY[s];
      for (let r = 0; r < search.roots.length; r += 1) {
        const root = search.roots[r];
        if (!(root instanceof Element)) {
          continue;
        }
        const nodes = root.querySelectorAll(selector);
        for (let i = 0; i < nodes.length; i += 1) {
          const node = nodes[i];
          if (!(node instanceof Element) || seenCandidates.has(node)) {
            continue;
          }
          if (!isNodeInFieldRange(node, fieldName, titleNode, root)) {
            continue;
          }
          seenCandidates.add(node);
          candidates.push(node);
        }
      }
    }

    for (let i = 0; i < candidates.length; i += 1) {
      const node = candidates[i];
      const writable = isTextInputWritable(node) || isMonacoTextareaCandidate(node, search.fieldItem);
      if (!writable) {
        continue;
      }
      return {
        ok: true,
        node: node,
        message: "已找到输入控件",
        diagnostic: buildFieldTextInputDiagnostic(fieldName, search, candidates),
      };
    }

    const diagnostic = buildFieldTextInputDiagnostic(fieldName, search, candidates);
    return {
      ok: false,
      message: "找到字段容器但未找到 Naive UI textarea / Monaco editor 输入区：" + fieldName,
      node: null,
      diagnostic: diagnostic,
    };
  }

  function getMonacoModelByUri(dataUri) {
    const editorApi = window.monaco && window.monaco.editor;
    if (!editorApi || typeof editorApi.getModels !== "function" || !dataUri) {
      return null;
    }
    try {
      const models = editorApi.getModels();
      for (let i = 0; i < models.length; i += 1) {
        const model = models[i];
        const uriText =
          model && model.uri && typeof model.uri.toString === "function" ? model.uri.toString() : "";
        if (uriText === dataUri) {
          return model;
        }
      }
    } catch (error) {
      return null;
    }
    return null;
  }

  function buildMonacoContext(node, fieldName) {
    const fieldScoped = getFieldEditorContext(fieldName);
    const monacoEditor =
      fieldScoped.monacoEditor ||
      (node instanceof Element ? node.closest(".monaco-editor") : null) ||
      null;
    const customMdEditor =
      fieldScoped.customMdEditor ||
      (node instanceof Element ? node.closest(".custom-md-editor") : null) ||
      null;
    const monacoContainer =
      fieldScoped.monacoContainer ||
      (node instanceof Element ? node.closest(".monaco-container") : null) ||
      null;
    const textarea =
      fieldScoped.monacoTextarea ||
      (node instanceof HTMLTextAreaElement && isMonacoTextarea(node) ? node : null) ||
      (monacoEditor instanceof Element
        ? monacoEditor.querySelector("textarea.inputarea,textarea.monaco-mouse-cursor-text")
        : null);
    const viewLines =
      fieldScoped.viewLines ||
      (monacoEditor instanceof Element ? monacoEditor.querySelector(".view-lines") : null) ||
      null;
    return {
      fieldName: fieldName,
      fieldItem: fieldScoped.fieldItem || (node instanceof Element ? node.closest(".l-item") : null),
      customMdEditor: customMdEditor instanceof Element ? customMdEditor : null,
      monacoContainer: monacoContainer instanceof Element ? monacoContainer : null,
      monacoEditor: monacoEditor instanceof Element ? monacoEditor : null,
      textarea: textarea instanceof HTMLTextAreaElement ? textarea : null,
      viewLines: viewLines instanceof Element ? viewLines : null,
      monacoDataUri:
        monacoEditor instanceof Element ? normalizeExact(monacoEditor.getAttribute("data-uri") || "") : "",
      diagnostic: buildFieldTextInputDiagnostic(fieldName, null, []),
    };
  }

  function getMonacoConfirmationSnippet(text) {
    const normalized = String(text || "").replace(/\r\n/g, "\n");
    const lines = normalized
      .split("\n")
      .map(function (line) {
        return normalizeExact(line);
      })
      .filter(Boolean);
    const source = lines[0] || normalizeExact(normalized);
    return source.slice(0, 80);
  }

  function isMonacoWriteConfirmed(context, text) {
    const snippet = getMonacoConfirmationSnippet(text);
    if (!snippet) {
      return true;
    }
    const model = getMonacoModelByUri(context.monacoDataUri);
    if (model && typeof model.getValue === "function" && normalizeExact(model.getValue()) === normalizeExact(text)) {
      return true;
    }
    const preview = getTextPreview(context.viewLines ? context.viewLines.textContent || "" : "", 200);
    return Boolean(preview && preview.indexOf(snippet) >= 0);
  }

  function tryWriteMonacoByModel(context, text) {
    const model = getMonacoModelByUri(context.monacoDataUri);
    if (!model || typeof model.setValue !== "function") {
      return { ok: false, message: "未通过 data-uri 找到 Monaco model。" };
    }
    try {
      model.setValue(text);
      if (isMonacoWriteConfirmed(context, text)) {
        return { ok: true, message: "Monaco model.setValue 写入成功。" };
      }
      return { ok: false, message: "Monaco model.setValue 已执行，但未确认界面同步。" };
    } catch (error) {
      return { ok: false, message: "Monaco model.setValue 失败：" + String(error && error.message ? error.message : error) };
    }
  }

  function tryWriteMonacoByEditorInstance(context, text) {
    const editorApi = window.monaco && window.monaco.editor;
    if (!editorApi || typeof editorApi.getEditors !== "function") {
      return { ok: false, message: "Monaco getEditors 不可用。" };
    }
    try {
      const editors = editorApi.getEditors();
      for (let i = 0; i < editors.length; i += 1) {
        const editor = editors[i];
        if (!editor) {
          continue;
        }
        const model = typeof editor.getModel === "function" ? editor.getModel() : null;
        const modelUri =
          model && model.uri && typeof model.uri.toString === "function" ? model.uri.toString() : "";
        const domNode = typeof editor.getDomNode === "function" ? editor.getDomNode() : null;
        const matchesUri = context.monacoDataUri && modelUri === context.monacoDataUri;
        const matchesDom =
          domNode instanceof Element &&
          context.monacoEditor instanceof Element &&
          (domNode === context.monacoEditor || context.monacoEditor.contains(domNode) || domNode.contains(context.monacoEditor));
        if (!matchesUri && !matchesDom) {
          continue;
        }
        if (typeof editor.setValue === "function") {
          editor.setValue(text);
        } else if (model && typeof model.setValue === "function") {
          model.setValue(text);
        } else {
          continue;
        }
        if (isMonacoWriteConfirmed(context, text)) {
          return { ok: true, message: "Monaco editor instance 写入成功。" };
        }
        return { ok: false, message: "Monaco editor instance 已执行，但未确认界面同步。" };
      }
    } catch (error) {
      return {
        ok: false,
        message: "Monaco editor instance 写入失败：" + String(error && error.message ? error.message : error),
      };
    }
    return { ok: false, message: "未通过 editor instance 匹配到当前 Monaco。" };
  }

  function tryWriteMonacoByExecCommand(context, text) {
    const monacoRoot = context.monacoEditor || context.customMdEditor || context.monacoContainer;
    if (!(monacoRoot instanceof Element)) {
      return { ok: false, message: "未找到 Monaco 编辑器容器。" };
    }
    const focusTarget = context.viewLines || monacoRoot.querySelector(".monaco-scrollable-element") || monacoRoot;
    if (focusTarget && typeof focusTarget.click === "function") {
      focusTarget.click();
    }
    if (context.textarea && typeof context.textarea.focus === "function") {
      context.textarea.focus();
    }
    try {
      document.execCommand("selectAll");
      const inserted = document.execCommand("insertText", false, text);
      if (context.textarea) {
        context.textarea.dispatchEvent(
          new InputEvent("beforeinput", { bubbles: true, data: text, inputType: "insertText" })
        );
        context.textarea.dispatchEvent(new Event("input", { bubbles: true }));
        context.textarea.dispatchEvent(new Event("change", { bubbles: true }));
        context.textarea.dispatchEvent(new Event("compositionend", { bubbles: true }));
      }
      if (inserted || isMonacoWriteConfirmed(context, text)) {
        return { ok: true, message: "Monaco execCommand 写入成功。" };
      }
    } catch (error) {
      // continue fallback
    }
    return { ok: false, message: "Monaco execCommand 写入失败。" };
  }

  function tryWriteMonacoByTextareaFallback(context, text) {
    if (!(context.textarea instanceof HTMLTextAreaElement)) {
      return { ok: false, message: "Monaco textarea fallback 不可用。" };
    }
    const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
    if (descriptor && typeof descriptor.set === "function") {
      descriptor.set.call(context.textarea, text);
    } else {
      context.textarea.value = text;
    }
    context.textarea.dispatchEvent(
      new InputEvent("beforeinput", { bubbles: true, data: text, inputType: "insertText" })
    );
    context.textarea.dispatchEvent(new Event("input", { bubbles: true }));
    context.textarea.dispatchEvent(new Event("change", { bubbles: true }));
    context.textarea.dispatchEvent(new Event("compositionend", { bubbles: true }));
    if (isMonacoWriteConfirmed(context, text)) {
      return {
        ok: true,
        message: "Monaco textarea fallback 已写入并确认同步。",
      };
    }
    if (normalizeExact(context.textarea.value || "") === normalizeExact(text)) {
      return {
        ok: true,
        message: "Monaco textarea fallback 已写入。",
        warning: "已写入 Monaco textarea fallback，需人工确认编辑器模型已同步。",
      };
    }
    return { ok: false, message: "Monaco textarea fallback 未写入目标文本。" };
  }

  function setTextValue(node, value) {
    const text = String(value || "");
    const fieldName =
      node instanceof Element ? normalizeExact(node.getAttribute("data-asc-field-name") || "") : "";
    const monacoContext = buildMonacoContext(node, fieldName);
    if (
      monacoContext.monacoEditor ||
      monacoContext.monacoTextarea ||
      monacoContext.customMdEditor ||
      (node instanceof HTMLTextAreaElement && isMonacoTextarea(node))
    ) {
      const modelRes = tryWriteMonacoByModel(monacoContext, text);
      if (modelRes.ok) {
        return { ok: true, message: modelRes.message, node: monacoContext.textarea || node, diagnostic: monacoContext.diagnostic };
      }
      const editorRes = tryWriteMonacoByEditorInstance(monacoContext, text);
      if (editorRes.ok) {
        return { ok: true, message: editorRes.message, node: monacoContext.textarea || node, diagnostic: monacoContext.diagnostic };
      }
      const execRes = tryWriteMonacoByExecCommand(monacoContext, text);
      if (execRes.ok) {
        return { ok: true, message: execRes.message, node: monacoContext.textarea || node, diagnostic: monacoContext.diagnostic };
      }
      const fallbackRes = tryWriteMonacoByTextareaFallback(monacoContext, text);
      if (fallbackRes.ok) {
        return {
          ok: true,
          message: fallbackRes.message,
          warning: fallbackRes.warning || "",
          node: monacoContext.textarea || node,
          diagnostic: monacoContext.diagnostic,
        };
      }
      return {
        ok: false,
        message:
          "Monaco 写入失败：" +
          [modelRes.message, editorRes.message, execRes.message, fallbackRes.message].filter(Boolean).join(" | "),
        node: monacoContext.textarea || node,
        diagnostic: monacoContext.diagnostic,
      };
    }
    if (!isTextInputWritable(node)) {
      return {
        ok: false,
        message: "输入控件不可写或不可见。",
      };
    }
    if (node instanceof HTMLTextAreaElement) {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
      if (typeof node.focus === "function") {
        node.focus();
      }
      if (descriptor && typeof descriptor.set === "function") {
        descriptor.set.call(node, text);
      } else {
        node.value = text;
      }
      node.dispatchEvent(
        new InputEvent("beforeinput", { bubbles: true, data: text, inputType: "insertText" })
      );
      node.dispatchEvent(new Event("input", { bubbles: true }));
      node.dispatchEvent(new Event("change", { bubbles: true }));
      node.dispatchEvent(new Event("compositionend", { bubbles: true }));
      if (typeof node.blur === "function") {
        node.blur();
      }
      return { ok: true, message: "已写入文本。", node: node };
    }
    if (node instanceof HTMLInputElement) {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
      if (typeof node.focus === "function") {
        node.focus();
      }
      if (descriptor && typeof descriptor.set === "function") {
        descriptor.set.call(node, text);
      } else {
        node.value = text;
      }
      node.dispatchEvent(
        new InputEvent("beforeinput", { bubbles: true, data: text, inputType: "insertText" })
      );
      node.dispatchEvent(new Event("input", { bubbles: true }));
      node.dispatchEvent(new Event("change", { bubbles: true }));
      node.dispatchEvent(new Event("compositionend", { bubbles: true }));
      return { ok: true, message: "已写入文本。", node: node };
    }
    node.textContent = text;
    node.dispatchEvent(new Event("input", { bubbles: true }));
    node.dispatchEvent(new Event("compositionend", { bubbles: true }));
    node.dispatchEvent(new Event("change", { bubbles: true }));
    return { ok: true, message: "已写入文本。", node: node };
  }

  function fillFieldText(fieldName, value) {
    const found = findFieldTextInput(fieldName);
    if (!found || !found.node) {
      if (found && found.diagnostic) {
        console.warn("[ASC][Abaka AI] 填写失败诊断:", found.diagnostic);
      }
      return {
        ok: false,
        message:
          (found && found.message ? found.message : "未找到可填写输入框：" + fieldName) +
          (found && found.diagnostic ? "（" + diagnosticText(found.diagnostic) + "）" : ""),
        diagnostic: found && found.diagnostic ? found.diagnostic : null,
      };
    }
    found.node.setAttribute("data-asc-field-name", fieldName);
    const result = setTextValue(found.node, value);
    if (!result.ok) {
      return {
        ok: false,
        message: result.message || "输入框不可写。",
        node: result.node || found.node,
        diagnostic: result.diagnostic || found.diagnostic || null,
      };
    }
    return {
      ok: true,
      message: "已填写 " + fieldName,
      node: result.node,
      warning: result.warning || "",
      diagnostic: result.diagnostic || found.diagnostic || null,
    };
  }

  function waitForFieldTextInput(fieldName, timeoutMs) {
    const normalizedFieldName = normalizeText(fieldName);
    const timeout = Number(timeoutMs) > 0 ? Number(timeoutMs) : 5000;
    const intervalMs = normalizedFieldName === FIELD_IMAGE_B_TEXTS_REMOVED ? 80 : 90;
    const startedAt = Date.now();
    return new Promise(function (resolve) {
      let lastFound = null;
      function check() {
        const found = findFieldTextInput(fieldName);
        lastFound = found;
        if (found && found.ok && found.node) {
          found.node.setAttribute("data-asc-field-name", fieldName);
          resolve({
            ok: true,
            node: found.node,
            message: "已找到输入框。",
            diagnostic: found.diagnostic || null,
          });
          return;
        }
        if (Date.now() - startedAt >= timeout) {
          const diagnostic =
            (found && found.diagnostic) ||
            (lastFound && lastFound.diagnostic) ||
            buildFieldTextInputDiagnostic(fieldName);
          if (diagnostic) {
            console.warn("[ASC][Abaka AI] 等待输入框超时诊断:", diagnostic);
          }
          resolve({
            ok: false,
            node: null,
            message:
              (found && found.message ? found.message : "未找到输入框。") +
              "（" +
              String(timeout) +
              "ms）",
            diagnostic: diagnostic,
          });
          return;
        }
        window.setTimeout(check, intervalMs);
      }
      check();
    });
  }

  function getActionButtonText(node) {
    if (!(node instanceof Element)) {
      return "";
    }
    if (node instanceof HTMLInputElement) {
      return normalizeExact(node.value || node.getAttribute("aria-label") || "");
    }
    return normalizeExact(
      node.textContent || node.getAttribute("aria-label") || node.getAttribute("title") || ""
    );
  }

  function getVisibleActionButtons() {
    const selectors = [
      "button",
      "[role='button']",
      ".ant-btn",
      ".el-button",
      "input[type='button']",
      "input[type='submit']",
    ];
    const nodes = document.querySelectorAll(selectors.join(","));
    const result = [];
    const seen = new Set();
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i];
      if (!(node instanceof Element) || !isVisible(node)) {
        continue;
      }
      const clickable = findClickableElement(node) || node;
      if (!(clickable instanceof Element) || !isVisible(clickable)) {
        continue;
      }
      if (seen.has(clickable)) {
        continue;
      }
      seen.add(clickable);
      result.push(clickable);
    }
    return result;
  }

  function isItemsPage() {
    const pathname = String(location.pathname || "");
    if (pathname === "/items") {
      return true;
    }
    if (pathname.indexOf("/data-task/v2") === 0 || pathname.indexOf("/task-v2/data-item") === 0) {
      return false;
    }
    return pathname.indexOf("/items") >= 0;
  }

  function isViewMode() {
    const params = new URLSearchParams(location.search || "");
    return params.get("viewMode") === "true";
  }

  function containsRoleSignal(text) {
    const normalized = normalizeText(text);
    if (!normalized) {
      return false;
    }
    return REVIEW_ROLE_SIGNAL_TEXTS.some(function (signal) {
      return normalized.indexOf(normalizeText(signal)) >= 0;
    });
  }

  function isLikelyReviewRole() {
    const params = new URLSearchParams(location.search || "");
    const roleText = normalizeText(params.get("role") || "");
    const nodeText = normalizeText(params.get("nodeId") || "");
    if (roleText.indexOf("review") >= 0 || nodeText.indexOf("review") >= 0) {
      return true;
    }

    const signalSelectors = [
      "header",
      "nav",
      "aside",
      ".ant-breadcrumb",
      ".breadcrumb",
      ".ant-menu",
      ".ant-layout-sider",
      ".ant-tabs-nav",
      "[class*='breadcrumb']",
      "[class*='menu']",
      "[class*='sider']",
      "[class*='header']",
      "[class*='role']",
      "[class*='tab']",
      "h1",
      "h2",
      "h3",
    ];
    const signalNodes = document.querySelectorAll(signalSelectors.join(","));
    for (let i = 0; i < signalNodes.length; i += 1) {
      const node = signalNodes[i];
      if (!(node instanceof Element) || !isVisible(node)) {
        continue;
      }
      if (containsRoleSignal(node.textContent || "")) {
        return true;
      }
    }
    return false;
  }

  function clickActionButtonByTexts(texts, options) {
    const runtimeOptions = options && typeof options === "object" ? options : {};
    const targets = Array.isArray(texts)
      ? texts
          .map(function (item) {
            return normalizeText(item);
          })
          .filter(Boolean)
      : [];
    if (targets.length === 0) {
      return {
        ok: false,
        message: "未提供按钮文案匹配规则。",
      };
    }

    const buttons = getVisibleActionButtons();
    const exactMatches = [];
    const fuzzyMatches = [];
    for (let i = 0; i < buttons.length; i += 1) {
      const button = buttons[i];
      const normalizedText = normalizeText(getActionButtonText(button));
      const compactText = normalizeCompactText(getActionButtonText(button));
      if (!normalizedText && !compactText) {
        continue;
      }
      for (let j = 0; j < targets.length; j += 1) {
        const target = targets[j];
        const compactTarget = normalizeCompactText(target);
        if (normalizedText === target || compactText === compactTarget) {
          exactMatches.push(button);
          break;
        }
        if (
          (normalizedText.indexOf(target) >= 0 && target.length >= 2) ||
          (compactText.indexOf(compactTarget) >= 0 && compactTarget.length >= 2)
        ) {
          fuzzyMatches.push(button);
          break;
        }
      }
    }

    const matches = exactMatches.length > 0 ? exactMatches : fuzzyMatches;
    if (matches.length === 0) {
      return {
        ok: false,
        message: runtimeOptions.notFoundMessage || "未找到目标按钮。",
      };
    }

    const firstEnabled = matches.find(function (item) {
      return !isElementDisabled(item);
    });
    if (!firstEnabled) {
      return {
        ok: false,
        message: runtimeOptions.disabledMessage || "目标按钮不可用（disabled）。",
      };
    }

    dispatchClickSequence(firstEnabled);
    return {
      ok: true,
      message: runtimeOptions.successMessage || "已点击目标按钮。",
    };
  }

  function hasSelectedLikeClass(node) {
    if (!(node instanceof Element)) {
      return false;
    }
    const classText = String(node.className || "").toLowerCase();
    if (!classText) {
      return false;
    }
    return (
      classText.indexOf("selected") >= 0 ||
      classText.indexOf("checked") >= 0 ||
      classText.indexOf("active") >= 0 ||
      classText.indexOf("is-checked") >= 0 ||
      classText.indexOf("ant-radio-wrapper-checked") >= 0 ||
      classText.indexOf("el-radio is-checked") >= 0
    );
  }

  function isNodeMarkedSelected(node) {
    if (!(node instanceof Element)) {
      return false;
    }
    if (node instanceof HTMLInputElement) {
      const inputType = String(node.type || "").toLowerCase();
      if (inputType === "radio" || inputType === "checkbox") {
        return node.checked === true;
      }
    }

    const role = String(node.getAttribute("role") || "").toLowerCase();
    if ((role === "radio" || role === "checkbox") && node.getAttribute("aria-checked") === "true") {
      return true;
    }
    if (node.getAttribute("aria-checked") === "true") {
      return true;
    }
    if (node.getAttribute("data-checked") === "true") {
      return true;
    }
    if (node.getAttribute("data-selected") === "true") {
      return true;
    }
    if (hasSelectedLikeClass(node)) {
      return true;
    }
    return false;
  }

  function isOptionSelected(optionNode, clickable) {
    const candidateRoots = [clickable, optionNode].filter(function (node) {
      return node instanceof Element;
    });

    for (let i = 0; i < candidateRoots.length; i += 1) {
      const root = candidateRoots[i];
      if (isNodeMarkedSelected(root)) {
        return true;
      }
      const roleNode = root.closest("[role='radio'],[role='checkbox']");
      if (isNodeMarkedSelected(roleNode)) {
        return true;
      }
      const selectedAncestor = root.closest(
        ".is-checked,.checked,.selected,.active,.ant-radio-wrapper-checked,.el-radio.is-checked"
      );
      if (selectedAncestor) {
        return true;
      }
      const checkedInput = root.querySelector("input[type='radio']:checked,input[type='checkbox']:checked");
      if (checkedInput) {
        return true;
      }
      const checkedRole = root.querySelector(
        "[role='radio'][aria-checked='true'],[role='checkbox'][aria-checked='true']"
      );
      if (checkedRole) {
        return true;
      }
      const selectedDataNode = root.querySelector("[data-checked='true'],[data-selected='true']");
      if (selectedDataNode) {
        return true;
      }
    }
    return false;
  }

  function selectFieldOption(fieldName, optionText, options) {
    const runtimeOptions = options && typeof options === "object" ? options : {};
    const ensureSelected = runtimeOptions.ensureSelected === true;
    const container = findFieldContainer(fieldName, optionText);
    if (!container) {
      return {
        ok: false,
        message: "未找到字段：" + fieldName,
      };
    }

    const optionNode = findOptionTextNode(container, optionText);
    if (!optionNode) {
      return {
        ok: false,
        message: "未找到选项：" + fieldName + " -> " + optionText,
      };
    }

    const clickable = findClickableElement(optionNode);
    if (!clickable) {
      return {
        ok: false,
        message: "选项不可点击：" + fieldName + " -> " + optionText,
      };
    }

    if (ensureSelected && isOptionSelected(optionNode, clickable)) {
      return {
        ok: true,
        skipped: true,
        message: "已保持 " + fieldName + "=" + optionText,
      };
    }

    dispatchClickSequence(clickable);
    return {
      ok: true,
      skipped: false,
      message: "已选择 " + fieldName + "=" + optionText,
    };
  }

  function waitForField(fieldName, timeoutMs) {
    const timeout = Number(timeoutMs) > 0 ? Number(timeoutMs) : 1500;
    const intervalMs = 100;
    const startedAt = Date.now();
    return new Promise(function (resolve) {
      function check() {
        const node = findFieldTitleNode(fieldName);
        if (node) {
          resolve({
            ok: true,
            node: node,
          });
          return;
        }
        if (Date.now() - startedAt >= timeout) {
          resolve({
            ok: false,
            node: null,
          });
          return;
        }
        window.setTimeout(check, intervalMs);
      }
      check();
    });
  }

  function hasSameFontField() {
    return Boolean(findFieldTitleNode(FIELD_SAME_FONT));
  }

  function createRuntime(options) {
    const config = options && typeof options === "object" ? options : {};
    function shouldAutoSelectSpecify() {
      if (typeof config.getAutoSelectSpecifyOnSameFontTrue === "function") {
        return config.getAutoSelectSpecifyOnSameFontTrue() !== false;
      }
      return config.autoSelectSpecifyOnSameFontTrue !== false;
    }

    async function ensureDerivedSpecifyFields(reason) {
      const waitImage = await waitForField(FIELD_IMAGE_B_TEXTS_REMOVED, 1500);
      const waitOther = await waitForField(FIELD_OTHER_CHANGES, 1500);
      if (!waitImage.ok || !waitOther.ok) {
        return {
          ok: false,
          message:
            String(reason || "same_font 联动") + "失败：派生字段未在 1500ms 内渲染",
        };
      }

      const imageRes = selectFieldOption(FIELD_IMAGE_B_TEXTS_REMOVED, OPTION_SPECIFY, {
        ensureSelected: true,
      });
      const otherRes = selectFieldOption(FIELD_OTHER_CHANGES, OPTION_SPECIFY, {
        ensureSelected: true,
      });

      if (!imageRes.ok || !otherRes.ok) {
        return {
          ok: false,
          message:
            String(reason || "same_font 联动") +
            "失败：" +
            [imageRes.message, otherRes.message].filter(Boolean).join("；"),
        };
      }

      const allSkipped = imageRes.skipped === true && otherRes.skipped === true;
      return {
        ok: true,
        message: allSkipped
          ? "已保持 image_b_texts_removed=specify、other_changes=specify"
          : "已确保 image_b_texts_removed=specify、other_changes=specify",
      };
    }

    async function selectSameFontTrue() {
      const primary = selectFieldOption(FIELD_SAME_FONT, OPTION_TRUE, {
        ensureSelected: true,
      });
      if (!primary.ok) {
        return primary;
      }

      if (!shouldAutoSelectSpecify()) {
        return primary;
      }

      const derived = await ensureDerivedSpecifyFields("same_font=true 联动");
      if (!derived.ok) {
        return derived;
      }
      return {
        ok: true,
        message: "已选择 same_font=true；" + derived.message,
      };
    }

    async function selectSameFontFalse() {
      return selectFieldOption(FIELD_SAME_FONT, OPTION_FALSE, {
        ensureSelected: true,
      });
    }

    async function selectSameFontArtisticEffect() {
      const primary = selectFieldOption(FIELD_SAME_FONT, OPTION_ARTISTIC, {
        ensureSelected: true,
      });
      if (!primary.ok) {
        return primary;
      }
      if (!shouldAutoSelectSpecify()) {
        return primary;
      }
      const derived = await ensureDerivedSpecifyFields(
        "same_font=same underlying font+artistic effect 联动"
      );
      if (!derived.ok) {
        return derived;
      }
      return {
        ok: true,
        message:
          "已选择 same_font=same underlying font+artistic effect；" + derived.message,
      };
    }

    async function selectImageBTextsRemovedSpecify() {
      return selectFieldOption(FIELD_IMAGE_B_TEXTS_REMOVED, OPTION_SPECIFY, {
        ensureSelected: true,
      });
    }

    async function selectOtherChangesSpecify() {
      return selectFieldOption(FIELD_OTHER_CHANGES, OPTION_SPECIFY, {
        ensureSelected: true,
      });
    }

    async function clickStashSave() {
      if (!isItemsPage()) {
        return {
          ok: false,
          message: "当前页面不是 /items，未执行“暂存”。",
        };
      }
      if (isViewMode()) {
        return {
          ok: false,
          message: "当前为 viewMode=true 查看页，未执行“暂存”。",
        };
      }
      if (!hasSameFontField()) {
        return {
          ok: false,
          message: "当前页面未检测到 same_font 字段，未执行“暂存”。",
        };
      }

      return clickActionButtonByTexts(STASH_BUTTON_TEXTS, {
        notFoundMessage: "未找到“暂存”按钮。",
        disabledMessage: "“暂存”按钮当前不可用。",
        successMessage: "已点击“暂存”按钮。",
      });
    }

    async function clickSubmitReview() {
      if (!isItemsPage()) {
        return {
          ok: false,
          message: "当前页面不是 /items，未执行“送审”。",
        };
      }
      if (isViewMode()) {
        return {
          ok: false,
          message: "当前为 viewMode=true 查看页，未执行“送审”。",
        };
      }
      if (!hasSameFontField()) {
        return {
          ok: false,
          message: "当前页面未检测到 same_font 字段，未执行“送审”。",
        };
      }
      if (isLikelyReviewRole()) {
        return {
          ok: false,
          message: "当前疑似标注内审环境，已阻止送审快捷键。",
        };
      }

      const result = clickActionButtonByTexts(SUBMIT_REVIEW_BUTTON_TEXTS, {
        notFoundMessage: "未找到“送审”按钮。",
        disabledMessage: "“送审”按钮当前不可用。",
        successMessage: "已点击“送审”按钮；若出现二次确认弹窗，请手动确认。",
      });
      return result;
    }

    return {
      version: TASK21_DOM_ACTIONS_VERSION,
      hasSameFontField: hasSameFontField,
      selectSameFontTrue: selectSameFontTrue,
      selectSameFontFalse: selectSameFontFalse,
      selectSameFontArtisticEffect: selectSameFontArtisticEffect,
      selectImageBTextsRemovedSpecify: selectImageBTextsRemovedSpecify,
      selectOtherChangesSpecify: selectOtherChangesSpecify,
      clickStashSave: clickStashSave,
      clickSubmitReview: clickSubmitReview,
      selectFieldOption: selectFieldOption,
      fillFieldText: fillFieldText,
      waitForFieldTextInput: waitForFieldTextInput,
      waitForField: waitForField,
      isViewMode: isViewMode,
      isLikelyReviewRole: isLikelyReviewRole,
      clickActionButtonByTexts: clickActionButtonByTexts,
      debugFindFieldTextInput: function (fieldName) {
        const found = findFieldTextInput(fieldName);
        return {
          ok: Boolean(found && found.ok),
          message: found && found.message ? found.message : "",
          nodeName: found && found.node ? found.node.nodeName : "",
          diagnostic: found && found.diagnostic ? found.diagnostic : buildFieldTextInputDiagnostic(fieldName),
        };
      },
      debugFillFieldText: function (fieldName, text) {
        return fillFieldText(fieldName, text);
      },
    };
  }

  globalThis.__ASCEdgeAbakaAiDomActions = {
    runtimeVersion: TASK21_DOM_ACTIONS_VERSION,
    createRuntime: createRuntime,
    selectFieldOption: selectFieldOption,
    fillFieldText: fillFieldText,
    waitForFieldTextInput: waitForFieldTextInput,
    setTextValue: setTextValue,
    waitForField: waitForField,
    debugFindFieldTextInput: function (fieldName) {
      const found = findFieldTextInput(fieldName);
      return {
        ok: Boolean(found && found.ok),
        message: found && found.message ? found.message : "",
        nodeName: found && found.node ? found.node.nodeName : "",
        diagnostic: found && found.diagnostic ? found.diagnostic : buildFieldTextInputDiagnostic(fieldName),
      };
    },
    debugFillFieldText: function (fieldName, text) {
      return fillFieldText(fieldName, text);
    },
  };
})();

"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const modulePath = path.resolve(__dirname, "ui-panel.js");
const panelModule = require("./ui-panel.js");

test("Aishell Vietnamese batch rows include aggregated token and estimated RMB rows", function () {
  const helper = panelModule.__test__?.buildBatchRows;
  assert.equal(typeof helper, "function");

  const rows = helper({
    phaseText: "全部AI批量识别已完成",
    total: 3,
    completed: 3,
    failed: 0,
    currentText: "条目-3",
    batchResultCount: 3,
    batchHasUsageData: true,
    batchPromptTokens: 3216,
    batchCompletionTokens: 114,
    batchTotalTokens: 3330,
    batchHasPriceData: true,
    batchEstimatedCostCny: 0.002345,
  });

  assert.deepEqual(
    rows.slice(-4),
    [
      ["批量输入Token", "3216"],
      ["批量输出Token", "114"],
      ["批量总Token", "3330"],
      ["批量预估人民币", "0.002345 元"],
    ]
  );
});

test("Aishell Vietnamese result stays actionable when text and speed already match", function () {
  const helper = panelModule.__test__?.canFillCurrentResult;
  assert.equal(typeof helper, "function");
  assert.equal(
    helper({
      recommendedText: "Xin chào.",
      recommendedSpeed: "normal",
      currentDisplayText: "Xin chào.",
      currentDisplaySpeed: "normal",
    }),
    true
  );
});

test("Aishell Vietnamese same-state hint compares displayed speed without normalization", function () {
  const helper = panelModule.__test__?.isSameAsDisplayedCurrent;
  assert.equal(typeof helper, "function");
  assert.equal(
    helper({
      recommendedText: "Xin chào.",
      recommendedSpeed: "normal",
      currentDisplayText: "Xin chào.",
      currentDisplaySpeed: "正常",
    }),
    false
  );
  assert.equal(
    helper({
      recommendedText: "Xin chào.",
      recommendedSpeed: "normal",
      currentDisplayText: "Xin chào.",
      currentDisplaySpeed: "normal",
    }),
    true
  );
});

test("Aishell Vietnamese result rows include current and recommended speed", function () {
  const helper = panelModule.__test__?.buildResultRows;
  assert.equal(typeof helper, "function");
  assert.deepEqual(
    helper({
      referenceText: "Xin chào",
      recommendedText: "Xin chào.",
      currentSpeed: "slow",
      recommendedSpeed: "normal",
    }),
    [
      ["原始文本", "Xin chào"],
      ["识别文本", "Xin chào."],
      ["当前语速", "slow"],
      ["语速建议", "normal"],
    ]
  );
});

class FakeClassList {
  constructor(node) {
    this.node = node;
    this.values = new Set();
  }

  add(name) {
    if (name) {
      this.values.add(String(name));
      this.node.className = Array.from(this.values).join(" ");
    }
  }

  remove(name) {
    this.values.delete(String(name));
    this.node.className = Array.from(this.values).join(" ");
  }

  contains(name) {
    return this.values.has(String(name));
  }
}

class FakeNode {
  constructor(tagName) {
    this.tagName = String(tagName || "div").toUpperCase();
    this.attributes = {};
    this.children = [];
    this.parentNode = null;
    this.style = {};
    this.className = "";
    this.classList = new FakeClassList(this);
    this.eventListeners = {};
    this._textContent = "";
    this._innerHTML = "";
    this.disabled = false;
    this.type = "";
  }

  appendChild(child) {
    if (child.parentNode) {
      child.parentNode.removeChild(child);
    }
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  insertBefore(child, referenceNode) {
    if (!referenceNode) {
      return this.appendChild(child);
    }
    const index = this.children.indexOf(referenceNode);
    if (index < 0) {
      return this.appendChild(child);
    }
    if (child.parentNode) {
      child.parentNode.removeChild(child);
    }
    child.parentNode = this;
    this.children.splice(index, 0, child);
    return child;
  }

  insertAdjacentElement(position, element) {
    if (!this.parentNode || position !== "afterend") {
      return this.appendChild(element);
    }
    const siblings = this.parentNode.children;
    const index = siblings.indexOf(this);
    if (index < 0 || index === siblings.length - 1) {
      return this.parentNode.appendChild(element);
    }
    return this.parentNode.insertBefore(element, siblings[index + 1]);
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) {
      this.children.splice(index, 1);
      child.parentNode = null;
    }
    return child;
  }

  remove() {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
  }

  setAttribute(name, value) {
    this.attributes[String(name)] = String(value);
  }

  removeAttribute(name) {
    delete this.attributes[String(name)];
  }

  getAttribute(name) {
    return this.attributes[String(name)] || "";
  }

  hasAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attributes, String(name));
  }

  addEventListener(type, listener) {
    this.eventListeners[String(type)] = listener;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    return collectDescendants(this).filter(function (node) {
      return matchesSelectorChain(node, selector);
    });
  }

  get previousSibling() {
    if (!this.parentNode) {
      return null;
    }
    const index = this.parentNode.children.indexOf(this);
    return index > 0 ? this.parentNode.children[index - 1] : null;
  }

  get textContent() {
    const ownText = String(this._textContent || this._innerHTML || "").replace(/<[^>]+>/g, " ");
    return [ownText]
      .concat(
        this.children.map(function (child) {
          return child.textContent || "";
        })
      )
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  set textContent(value) {
    this._textContent = String(value || "");
    this._innerHTML = "";
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(value) {
    this._innerHTML = String(value || "");
    this._textContent = "";
  }
}

class FakeButton extends FakeNode {}
class FakeInput extends FakeNode {}
class FakeTextArea extends FakeNode {}

function collectDescendants(root) {
  const result = [];
  (function visit(node) {
    (node.children || []).forEach(function (child) {
      result.push(child);
      visit(child);
    });
  })(root);
  return result;
}

function matchesSimpleSelector(node, selector) {
  const value = String(selector || "").trim();
  if (!value) {
    return false;
  }
  if (value === "button") {
    return node.tagName === "BUTTON";
  }
  const tagClassMatch = value.match(/^([a-z]+)(\.[\w-]+)+$/i);
  if (tagClassMatch) {
    const tagName = tagClassMatch[1].toUpperCase();
    const classNames = value
      .split(".")
      .slice(1)
      .filter(Boolean);
    return (
      node.tagName === tagName &&
      classNames.every(function (className) {
        return String(node.className || "")
          .split(/\s+/)
          .filter(Boolean)
          .indexOf(className) >= 0;
      })
    );
  }
  if (/^\.[\w-]+$/.test(value)) {
    return String(node.className || "")
      .split(/\s+/)
      .filter(Boolean)
      .indexOf(value.slice(1)) >= 0;
  }
  if (/^[a-z]+$/i.test(value)) {
    return node.tagName === value.toUpperCase();
  }
  return false;
}

function matchesSelectorChain(node, selector) {
  return String(selector || "")
    .split(",")
    .some(function (part) {
      const segments = part
        .trim()
        .split(/\s+/)
        .filter(Boolean);
      if (segments.length <= 0) {
        return false;
      }
      let current = node;
      for (let index = segments.length - 1; index >= 0; index -= 1) {
        if (!current || !matchesSimpleSelector(current, segments[index])) {
          return false;
        }
        current = current.parentNode;
      }
      return true;
    });
}

function createDocument() {
  const documentElement = new FakeNode("html");
  const head = new FakeNode("head");
  const body = new FakeNode("body");
  documentElement.appendChild(head);
  documentElement.appendChild(body);
  return {
    documentElement,
    head,
    body,
    createElement(tagName) {
      const normalized = String(tagName || "").toLowerCase();
      if (normalized === "button") {
        return new FakeButton(tagName);
      }
      if (normalized === "input") {
        return new FakeInput(tagName);
      }
      if (normalized === "textarea") {
        return new FakeTextArea(tagName);
      }
      return new FakeNode(tagName);
    },
    getElementById(id) {
      return collectDescendants(documentElement).find(function (node) {
        return node.attributes.id === id;
      }) || null;
    },
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    },
    querySelectorAll(selector) {
      return collectDescendants(documentElement).filter(function (node) {
        return matchesSelectorChain(node, selector);
      });
    },
    execCommand() {
      return true;
    },
  };
}

function containsNode(root, target) {
  if (root === target) {
    return true;
  }
  return collectDescendants(root).indexOf(target) >= 0;
}

function loadUiPanelModule() {
  delete require.cache[modulePath];
  delete globalThis.__ASREdgeAishellTechVietnameseUiPanelInstalled;
  delete globalThis.__ASREdgeAishellTechVietnameseUiPanel;
  require(modulePath);
  return globalThis.__ASREdgeAishellTechVietnameseUiPanel;
}

function createPageSkeleton(document) {
  const markArea = document.createElement("div");
  markArea.className = "mark-area";
  const form = document.createElement("form");
  form.className = "el-form";
  const saveButton = document.createElement("button");
  saveButton.className = "el-button el-button--primary";
  saveButton.textContent = "保存";
  const utilityButton = document.createElement("button");
  utilityButton.className = "el-button el-button--text";
  utilityButton.textContent = "查看历史标注记录";
  form.appendChild(saveButton);
  form.appendChild(utilityButton);
  markArea.appendChild(form);
  document.body.appendChild(markArea);
  return {
    saveButton,
    form,
    markArea,
  };
}

test("Aishell Vietnamese panel keeps fill action when text and speed match the page", function () {
  const previousDocument = globalThis.document;
  const previousNavigator = globalThis.navigator;
  const previousNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const previousHTMLElement = globalThis.HTMLElement;
  const previousHTMLButtonElement = globalThis.HTMLButtonElement;
  const previousHTMLInputElement = globalThis.HTMLInputElement;
  const previousHTMLTextAreaElement = globalThis.HTMLTextAreaElement;
  const previousWindow = globalThis.window;

  const document = createDocument();
  createPageSkeleton(document);
  document.documentElement.contains = function (node) {
    return containsNode(document.documentElement, node);
  };

  globalThis.document = document;
  globalThis.window = globalThis;
  globalThis.HTMLElement = FakeNode;
  globalThis.HTMLButtonElement = FakeButton;
  globalThis.HTMLInputElement = FakeInput;
  globalThis.HTMLTextAreaElement = FakeTextArea;

  try {
    const api = loadUiPanelModule();
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      writable: true,
      value: {},
    });
    const runtime = api.createRuntime({
      fillAndSaveCurrent: async function () {
        return { ok: true };
      },
    });

    runtime.ensureMounted();
    const renderMeta = runtime.renderResult({
      referenceText: "Máy chiếu hiển thị slide mới.",
      recommendedText: "Máy chiếu hiển thị slide mới.",
      recommendedSpeed: "normal",
      currentDisplayText: "Máy chiếu hiển thị slide mới.",
      currentDisplaySpeed: "normal",
      meta: {},
    });

    assert.equal(renderMeta.sameAsDisplayedCurrent, true);
    const allButtons = document.querySelectorAll("button");
    const fillButton = allButtons.find(function (node) {
      return node.textContent === "填入并保存";
    });
    const hintNode = collectDescendants(document.documentElement).find(function (node) {
      return node.textContent === "当前与页面一致，仍可重新填入保存。";
    });

    assert.ok(fillButton);
    assert.equal(fillButton.style.display || "", "");
    assert.equal(fillButton.disabled, false);
    assert.ok(hintNode);
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
    globalThis.HTMLElement = previousHTMLElement;
    globalThis.HTMLButtonElement = previousHTMLButtonElement;
    globalThis.HTMLInputElement = previousHTMLInputElement;
    globalThis.HTMLTextAreaElement = previousHTMLTextAreaElement;
    if (previousNavigatorDescriptor) {
      Object.defineProperty(globalThis, "navigator", previousNavigatorDescriptor);
    } else {
      globalThis.navigator = previousNavigator;
    }
    delete globalThis.__ASREdgeAishellTechVietnameseUiPanelInstalled;
    delete globalThis.__ASREdgeAishellTechVietnameseUiPanel;
  }
});

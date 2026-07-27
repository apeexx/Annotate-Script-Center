"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const panel = require(path.resolve(__dirname, "ui-panel.js"));

class FakeClassList {
  constructor(element) {
    this.element = element;
  }

  add(token) {
    const tokens = String(this.element.className || "")
      .split(/\s+/)
      .filter(Boolean);
    if (!tokens.includes(token)) {
      tokens.push(token);
      this.element.className = tokens.join(" ");
    }
  }

  remove(token) {
    this.element.className = String(this.element.className || "")
      .split(/\s+/)
      .filter(function (entry) {
        return entry && entry !== token;
      })
      .join(" ");
  }
}

class FakeElement {
  constructor(tagName) {
    this.tagName = String(tagName || "div").toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.className = "";
    this.style = {};
    this.textContent = "";
    this.id = "";
    this.disabled = false;
    this.attributeMap = new Map();
    this.classList = new FakeClassList(this);
  }

  get attributes() {
    return Array.from(this.attributeMap.entries()).map(function ([name, value]) {
      return { name: name, value: value };
    });
  }

  get previousSibling() {
    if (!this.parentNode) {
      return null;
    }
    const index = this.parentNode.children.indexOf(this);
    return index > 0 ? this.parentNode.children[index - 1] : null;
  }

  setAttribute(name, value) {
    this.attributeMap.set(String(name), String(value));
  }

  getAttribute(name) {
    return this.attributeMap.has(String(name)) ? this.attributeMap.get(String(name)) : null;
  }

  removeAttribute(name) {
    this.attributeMap.delete(String(name));
  }

  appendChild(node) {
    return this.insertBefore(node, null);
  }

  insertBefore(node, referenceNode) {
    if (node.parentNode) {
      node.remove();
    }
    const index = referenceNode ? this.children.indexOf(referenceNode) : -1;
    if (index < 0) {
      this.children.push(node);
    } else {
      this.children.splice(index, 0, node);
    }
    node.parentNode = this;
    return node;
  }

  insertAdjacentElement(position, node) {
    assert.equal(position, "afterend");
    assert.ok(this.parentNode);
    const index = this.parentNode.children.indexOf(this);
    this.parentNode.insertBefore(node, this.parentNode.children[index + 1] || null);
    return node;
  }

  remove() {
    if (!this.parentNode) {
      return;
    }
    const index = this.parentNode.children.indexOf(this);
    if (index >= 0) {
      this.parentNode.children.splice(index, 1);
    }
    this.parentNode = null;
  }

  addEventListener() {}

  contains(node) {
    return this === node || this.children.some(function (child) {
      return child.contains(node);
    });
  }
}

class FakeButton extends FakeElement {
  constructor() {
    super("button");
  }
}

function collectButtons(node, output) {
  if (node instanceof FakeButton) {
    output.push(node);
  }
  node.children.forEach(function (child) {
    collectButtons(child, output);
  });
  return output;
}

function createFakeDocument() {
  const documentLike = {
    documentElement: new FakeElement("html"),
    head: new FakeElement("head"),
    body: new FakeElement("body"),
    createElement: function (tagName) {
      return String(tagName).toLowerCase() === "button" ? new FakeButton() : new FakeElement(tagName);
    },
    getElementById: function (id) {
      const findById = function (node) {
        if (node.id === id) {
          return node;
        }
        for (const child of node.children) {
          const matched = findById(child);
          if (matched) {
            return matched;
          }
        }
        return null;
      };
      return findById(this.documentElement);
    },
    querySelector: function (selector) {
      if (selector === ".mark-area") {
        return this.markArea;
      }
      if (selector === ".mark-area form.el-form") {
        return this.markForm;
      }
      return null;
    },
    querySelectorAll: function (selector) {
      const buttons = collectButtons(this.documentElement, []);
      if (selector === "button") {
        return buttons;
      }
      if (selector === ".mark-area button.el-button--primary") {
        return buttons.filter(function (button) {
          return (
            documentLike.markArea.contains(button) &&
            String(button.className || "").split(/\s+/).includes("el-button--primary")
          );
        });
      }
      return [];
    },
  };
  documentLike.documentElement.appendChild(documentLike.head);
  documentLike.documentElement.appendChild(documentLike.body);
  documentLike.markArea = new FakeElement("section");
  documentLike.markArea.className = "mark-area";
  documentLike.markForm = new FakeElement("form");
  documentLike.markForm.className = "el-form";
  documentLike.actions = new FakeElement("div");
  documentLike.saveButton = new FakeButton();
  documentLike.saveButton.className = "el-button el-button--primary";
  documentLike.saveButton.textContent = "保存";
  documentLike.actions.appendChild(documentLike.saveButton);
  documentLike.markForm.appendChild(documentLike.actions);
  documentLike.markArea.appendChild(documentLike.markForm);
  documentLike.body.appendChild(documentLike.markArea);
  return documentLike;
}

function getButtonLabels(container) {
  return container.children
    .filter(function (node) {
      return node instanceof FakeButton;
    })
    .map(function (node) {
      return getNodeText(node);
    });
}

function getNodeText(node) {
  return String(node.textContent || "") +
    node.children.map(function (child) {
      return getNodeText(child);
    }).join("");
}

function findInjectedButtons(documentLike, attrName) {
  return collectButtons(documentLike.documentElement, []).filter(function (button) {
    return button.getAttribute(attrName) === "true";
  });
}

test("Aishell Cantonese refuses to fill a result after the selected task item changes", function () {
  const isResultBoundToCurrentItem = panel.__test__.isResultBoundToCurrentItem;

  assert.equal(
    isResultBoundToCurrentItem(
      { taskItemId: "task-item-before", listenText: "旧条识别文本" },
      { taskItemId: "task-item-after" }
    ),
    false
  );
  assert.equal(
    isResultBoundToCurrentItem(
      { taskItemId: "task-item-current", listenText: "当前条识别文本" },
      { taskItemId: "task-item-current" }
    ),
    true
  );
});

test("Aishell Cantonese refuses to fill a result after only the selected blue segment changes", function () {
  const isResultBoundToCurrentItem = panel.__test__.isResultBoundToCurrentItem;

  assert.equal(
    isResultBoundToCurrentItem(
      { taskItemId: "task-item-current", itemKey: "task-item-current|region-1:1830-2990", listenText: "第一段" },
      { taskItemId: "task-item-current", key: "task-item-current|region-2:3150-6510" }
    ),
    false
  );
});

test("Aishell Cantonese mounts batch controls beside save when the legacy utility toolbar is absent", function () {
  const previousDocument = global.document;
  const previousButton = global.HTMLButtonElement;
  const documentLike = createFakeDocument();
  global.document = documentLike;
  global.HTMLButtonElement = FakeButton;

  try {
    const runtime = panel.createRuntime({
      onRecommend: function () {},
      onBatchRecommendAll: function () {},
      onBatchRecommendPending: function () {},
      onBatchStop: function () {},
    });
    runtime.ensureMounted();

    assert.deepEqual(getButtonLabels(documentLike.actions), [
      "保存",
      "AI识别",
      "全部AI批量识别",
      "未完成的AI批量识别",
      "停止批量",
    ]);

    const legacyActions = new FakeElement("div");
    const legacyButton = new FakeButton();
    legacyButton.textContent = "删除音频标点";
    legacyActions.appendChild(legacyButton);
    documentLike.body.appendChild(legacyActions);

    runtime.ensureMounted();

    assert.deepEqual(getButtonLabels(documentLike.actions), ["保存", "AI识别"]);
    assert.deepEqual(getButtonLabels(legacyActions), [
      "全部AI批量识别",
      "未完成的AI批量识别",
      "停止批量",
      "删除音频标点",
    ]);
    assert.equal(findInjectedButtons(documentLike, "data-asc-injected-batch-all").length, 1);
    assert.equal(findInjectedButtons(documentLike, "data-asc-injected-batch-pending").length, 1);
    assert.equal(findInjectedButtons(documentLike, "data-asc-injected-stop").length, 1);
  } finally {
    global.document = previousDocument;
    global.HTMLButtonElement = previousButton;
  }
});

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const sharedSelectPath = path.resolve(__dirname, "options-shared-select.js");
const htmlPath = path.resolve(__dirname, "options.html");
const jsPath = path.resolve(__dirname, "options.js");

class FakeEvent {
  constructor(type, init) {
    const config = init && typeof init === "object" ? init : {};
    this.type = type;
    this.bubbles = config.bubbles !== false;
    this.key = config.key || "";
    this.defaultPrevented = false;
    this.target = null;
    this.currentTarget = null;
  }

  preventDefault() {
    this.defaultPrevented = true;
  }
}

class FakeClassList {
  constructor(node) {
    this.node = node;
    this.values = new Set();
  }

  add() {
    Array.from(arguments).forEach((value) => {
      if (value) {
        this.values.add(String(value));
      }
    });
    this._sync();
  }

  remove() {
    Array.from(arguments).forEach((value) => {
      this.values.delete(String(value));
    });
    this._sync();
  }

  contains(value) {
    return this.values.has(String(value));
  }

  toggle(value, force) {
    const name = String(value);
    if (force === true) {
      this.values.add(name);
      this._sync();
      return true;
    }
    if (force === false) {
      this.values.delete(name);
      this._sync();
      return false;
    }
    if (this.values.has(name)) {
      this.values.delete(name);
      this._sync();
      return false;
    }
    this.values.add(name);
    this._sync();
    return true;
  }

  _setFromString(value) {
    this.values = new Set(
      String(value || "")
        .split(/\s+/)
        .map((item) => item.trim())
        .filter(Boolean)
    );
    this._sync();
  }

  _sync() {
    this.node.attributes.class = Array.from(this.values).join(" ");
  }

  toString() {
    return Array.from(this.values).join(" ");
  }
}

function matchesSelector(node, selector) {
  if (!(node instanceof FakeElement)) {
    return false;
  }
  const trimmed = String(selector || "").trim();
  if (!trimmed) {
    return false;
  }
  if (trimmed.startsWith("#")) {
    return node.id === trimmed.slice(1);
  }
  if (trimmed.startsWith(".")) {
    return node.classList.contains(trimmed.slice(1));
  }
  const attrMatch = trimmed.match(
    /^([a-z0-9_-]+)?(?:\.([a-z0-9_-]+))?(?:\[([a-z0-9_-]+)(?:=['"]?([^'"\]]+)['"]?)?\])?$/i
  );
  if (!attrMatch) {
    return false;
  }
  const [, tagName, className, attrName, attrValue] = attrMatch;
  if (tagName && node.tagName.toLowerCase() !== tagName.toLowerCase()) {
    return false;
  }
  if (className && !node.classList.contains(className)) {
    return false;
  }
  if (attrName) {
    const actualValue = node.getAttribute(attrName);
    if (actualValue === null) {
      return false;
    }
    if (attrValue !== undefined && actualValue !== attrValue) {
      return false;
    }
  }
  return true;
}

class FakeElement {
  constructor(tagName, ownerDocument) {
    this.tagName = String(tagName || "div").toUpperCase();
    this.ownerDocument = ownerDocument || null;
    this.attributes = {};
    this.classList = new FakeClassList(this);
    this.children = [];
    this.parentNode = null;
    this.parentElement = null;
    this.hidden = false;
    this.disabled = false;
    this.isConnected = false;
    this.eventListeners = new Map();
    this.textContent = "";
    this.dataset = {};
    this.style = {};
    this.tabIndex = 0;
    this.role = "";
    this.id = "";
    this.value = "";
    this.scrollHeight = 160;
    this.scrollWidth = 240;
    this.offsetHeight = 160;
    this.clientHeight = 160;
    this.clientWidth = 240;
    this.focused = false;
    this.lastScrollIntoView = null;
    this._rect = {
      left: 40,
      top: 60,
      width: 240,
      height: 44,
      bottom: 104,
      right: 280,
    };
  }

  get className() {
    return this.classList.toString();
  }

  set className(value) {
    this.classList._setFromString(value);
  }

  setAttribute(name, value) {
    const key = String(name);
    const nextValue = String(value);
    this.attributes[key] = nextValue;
    if (key === "id") {
      this.id = nextValue;
    } else if (key === "class") {
      this.classList._setFromString(nextValue);
    } else if (key === "disabled") {
      this.disabled = nextValue !== "false";
    } else if (key === "hidden") {
      this.hidden = nextValue !== "false";
    } else if (key.startsWith("data-")) {
      const datasetKey = key
        .slice(5)
        .replace(/-([a-z])/g, function (_, letter) {
          return letter.toUpperCase();
        });
      this.dataset[datasetKey] = nextValue;
    }
  }

  getAttribute(name) {
    const key = String(name);
    return Object.prototype.hasOwnProperty.call(this.attributes, key) ? this.attributes[key] : null;
  }

  removeAttribute(name) {
    const key = String(name);
    delete this.attributes[key];
    if (key === "id") {
      this.id = "";
    } else if (key === "class") {
      this.classList._setFromString("");
    } else if (key.startsWith("data-")) {
      const datasetKey = key
        .slice(5)
        .replace(/-([a-z])/g, function (_, letter) {
          return letter.toUpperCase();
        });
      delete this.dataset[datasetKey];
    }
  }

  appendChild(child) {
    return this.insertBefore(child, null);
  }

  insertBefore(child, referenceNode) {
    if (!(child instanceof FakeElement)) {
      throw new Error("Only FakeElement children are supported");
    }
    if (child.parentNode) {
      child.parentNode.removeChild(child);
    }
    const index =
      referenceNode instanceof FakeElement ? this.children.indexOf(referenceNode) : this.children.length;
    const safeIndex = index >= 0 ? index : this.children.length;
    this.children.splice(safeIndex, 0, child);
    child.parentNode = this;
    child.parentElement = this;
    child.ownerDocument = this.ownerDocument;
    child._setConnected(this.isConnected);
    return child;
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) {
      this.children.splice(index, 1);
      child.parentNode = null;
      child.parentElement = null;
      child._setConnected(false);
    }
    return child;
  }

  contains(target) {
    if (target === this) {
      return true;
    }
    return this.children.some((child) => child.contains(target));
  }

  querySelector(selector) {
    const nodes = this.querySelectorAll(selector);
    return nodes[0] || null;
  }

  querySelectorAll(selector) {
    const matches = [];
    const visit = (node) => {
      node.children.forEach((child) => {
        if (matchesSelector(child, selector)) {
          matches.push(child);
        }
        visit(child);
      });
    };
    visit(this);
    return matches;
  }

  closest(selector) {
    let current = this;
    while (current) {
      if (matchesSelector(current, selector)) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }

  addEventListener(type, listener) {
    const key = String(type);
    if (!this.eventListeners.has(key)) {
      this.eventListeners.set(key, []);
    }
    this.eventListeners.get(key).push(listener);
  }

  removeEventListener(type, listener) {
    const key = String(type);
    const listeners = this.eventListeners.get(key) || [];
    const nextListeners = listeners.filter((item) => item !== listener);
    if (nextListeners.length > 0) {
      this.eventListeners.set(key, nextListeners);
      return;
    }
    this.eventListeners.delete(key);
  }

  dispatchEvent(event) {
    const currentEvent = event instanceof FakeEvent ? event : new FakeEvent(String(event?.type || ""));
    if (!currentEvent.target) {
      currentEvent.target = this;
    }
    currentEvent.currentTarget = this;
    const listeners = this.eventListeners.get(currentEvent.type) || [];
    listeners.forEach((listener) => {
      listener.call(this, currentEvent);
    });
    if (currentEvent.bubbles && this.parentElement) {
      this.parentElement.dispatchEvent(currentEvent);
    }
    return currentEvent.defaultPrevented !== true;
  }

  focus() {
    this.focused = true;
  }

  scrollIntoView(config) {
    this.lastScrollIntoView = config || {};
  }

  getBoundingClientRect() {
    return Object.assign({}, this._rect);
  }

  setBoundingClientRect(rect) {
    this._rect = Object.assign({}, this._rect, rect || {});
    this._rect.bottom = this._rect.top + this._rect.height;
    this._rect.right = this._rect.left + this._rect.width;
  }

  get previousElementSibling() {
    if (!(this.parentElement instanceof FakeElement)) {
      return null;
    }
    const index = this.parentElement.children.indexOf(this);
    return index > 0 ? this.parentElement.children[index - 1] : null;
  }

  get nextElementSibling() {
    if (!(this.parentElement instanceof FakeElement)) {
      return null;
    }
    const index = this.parentElement.children.indexOf(this);
    return index >= 0 && index < this.parentElement.children.length - 1
      ? this.parentElement.children[index + 1]
      : null;
  }

  _setConnected(value) {
    this.isConnected = Boolean(value);
    this.children.forEach((child) => child._setConnected(this.isConnected));
  }
}

class FakeButtonElement extends FakeElement {
  constructor(ownerDocument) {
    super("button", ownerDocument);
    this.type = "button";
  }
}

class FakeOptionElement extends FakeElement {
  constructor(ownerDocument) {
    super("option", ownerDocument);
    this.value = "";
    this.selected = false;
  }
}

class FakeSelectElement extends FakeElement {
  constructor(ownerDocument) {
    super("select", ownerDocument);
    this.value = "";
  }

  get options() {
    return this.children.filter((child) => child instanceof FakeOptionElement);
  }

  get selectedIndex() {
    return this.options.findIndex((option) => option.value === this.value);
  }

  set value(nextValue) {
    this._value = String(nextValue || "");
  }

  get value() {
    return String(this._value || "");
  }
}

class FakeDocument extends FakeElement {
  constructor() {
    super("#document", null);
    this.ownerDocument = this;
    this.body = new FakeElement("body", this);
    this.body._setConnected(true);
    this.children = [this.body];
    this.eventListeners = new Map();
  }

  createElement(tagName) {
    const normalized = String(tagName || "").toLowerCase();
    if (normalized === "select") {
      return new FakeSelectElement(this);
    }
    if (normalized === "button") {
      return new FakeButtonElement(this);
    }
    if (normalized === "option") {
      return new FakeOptionElement(this);
    }
    return new FakeElement(tagName, this);
  }

  getElementById(id) {
    return this.body.querySelector("#" + String(id || ""));
  }

  querySelector(selector) {
    return this.body.querySelector(selector);
  }

  querySelectorAll(selector) {
    return this.body.querySelectorAll(selector);
  }

  addEventListener(type, listener) {
    const key = String(type);
    if (!this.eventListeners.has(key)) {
      this.eventListeners.set(key, []);
    }
    this.eventListeners.get(key).push(listener);
  }

  removeEventListener(type, listener) {
    const key = String(type);
    const listeners = this.eventListeners.get(key) || [];
    const nextListeners = listeners.filter((item) => item !== listener);
    if (nextListeners.length > 0) {
      this.eventListeners.set(key, nextListeners);
      return;
    }
    this.eventListeners.delete(key);
  }

  dispatchEvent(event) {
    const currentEvent = event instanceof FakeEvent ? event : new FakeEvent(String(event?.type || ""));
    currentEvent.currentTarget = this;
    const listeners = this.eventListeners.get(currentEvent.type) || [];
    listeners.forEach((listener) => {
      listener.call(this, currentEvent);
    });
    return currentEvent.defaultPrevented !== true;
  }
}

class FakeWindow {
  constructor(documentNode) {
    this.document = documentNode;
    this.innerWidth = 1280;
    this.innerHeight = 720;
    this.eventListeners = new Map();
  }

  addEventListener(type, listener) {
    const key = String(type);
    if (!this.eventListeners.has(key)) {
      this.eventListeners.set(key, []);
    }
    this.eventListeners.get(key).push(listener);
  }

  removeEventListener(type, listener) {
    const key = String(type);
    const listeners = this.eventListeners.get(key) || [];
    const nextListeners = listeners.filter((item) => item !== listener);
    if (nextListeners.length > 0) {
      this.eventListeners.set(key, nextListeners);
      return;
    }
    this.eventListeners.delete(key);
  }

  dispatchEvent(event) {
    const currentEvent = event instanceof FakeEvent ? event : new FakeEvent(String(event?.type || ""));
    currentEvent.currentTarget = this;
    const listeners = this.eventListeners.get(currentEvent.type) || [];
    listeners.forEach((listener) => {
      listener.call(this, currentEvent);
    });
    return currentEvent.defaultPrevented !== true;
  }
}

function createDomEnvironment() {
  const documentNode = new FakeDocument();
  const windowNode = new FakeWindow(documentNode);
  return {
    documentNode,
    windowNode,
  };
}

function withFakeDom(callback) {
  const previous = {
    window: global.window,
    document: global.document,
    HTMLElement: global.HTMLElement,
    HTMLSelectElement: global.HTMLSelectElement,
    HTMLButtonElement: global.HTMLButtonElement,
    Event: global.Event,
    getComputedStyle: global.getComputedStyle,
  };
  const { documentNode, windowNode } = createDomEnvironment();
  const getComputedStyle = function (node) {
    const style = node && typeof node.style === "object" ? node.style : {};
    return {
      overflow: String(style.overflow || "visible"),
      overflowX: String(style.overflowX || style.overflow || "visible"),
      overflowY: String(style.overflowY || style.overflow || "visible"),
    };
  };
  global.window = windowNode;
  global.document = documentNode;
  global.HTMLElement = FakeElement;
  global.HTMLSelectElement = FakeSelectElement;
  global.HTMLButtonElement = FakeButtonElement;
  global.Event = FakeEvent;
  global.getComputedStyle = getComputedStyle;
  windowNode.getComputedStyle = getComputedStyle;

  delete require.cache[sharedSelectPath];
  const api = require(sharedSelectPath);

  try {
    callback({
      api,
      documentNode,
      windowNode,
    });
  } finally {
    delete require.cache[sharedSelectPath];
    global.window = previous.window;
    global.document = previous.document;
    global.HTMLElement = previous.HTMLElement;
    global.HTMLSelectElement = previous.HTMLSelectElement;
    global.HTMLButtonElement = previous.HTMLButtonElement;
    global.Event = previous.Event;
    global.getComputedStyle = previous.getComputedStyle;
  }
}

function appendOption(selectNode, value, label) {
  const optionNode = selectNode.ownerDocument.createElement("option");
  optionNode.value = String(value);
  optionNode.textContent = String(label);
  selectNode.appendChild(optionNode);
  return optionNode;
}

test("shared select module exposes the public API", function () {
  withFakeDom(function ({ api }) {
    assert.equal(typeof api.syncCustomSelects, "function");
    assert.equal(typeof api.syncCustomSelectState, "function");
    assert.equal(typeof api.closeAllCustomSelects, "function");
    assert.equal(global.ASREdgeOptionsSharedSelect, api);
  });
});

test("shared select syncs placeholder and selected label from the native select", function () {
  withFakeDom(function ({ api, documentNode }) {
    const layer = documentNode.createElement("div");
    layer.id = "detail-select-layer";
    documentNode.body.appendChild(layer);

    const scope = documentNode.createElement("section");
    documentNode.body.appendChild(scope);

    const selectNode = documentNode.createElement("select");
    selectNode.id = "example-detail-select";
    selectNode.setAttribute("data-options-custom-select", "true");
    selectNode.setAttribute("data-options-placeholder", "请选择模型");
    appendOption(selectNode, "", "");
    appendOption(selectNode, "react", "React");
    scope.appendChild(selectNode);

    api.syncCustomSelects(scope);

    const triggerLabel = scope.querySelector(".options-select-trigger-label");
    assert.ok(triggerLabel);
    assert.equal(triggerLabel.textContent, "请选择模型");
    assert.equal(triggerLabel.classList.contains("is-placeholder"), true);

    selectNode.value = "react";
    selectNode.dispatchEvent(new FakeEvent("change", { bubbles: true }));
    assert.equal(triggerLabel.textContent, "React");
    assert.equal(triggerLabel.classList.contains("is-placeholder"), false);
  });
});

test("shared select supports keyboard open, highlight, choose, and escape close", function () {
  withFakeDom(function ({ api, documentNode }) {
    const layer = documentNode.createElement("div");
    layer.id = "detail-select-layer";
    documentNode.body.appendChild(layer);

    const scope = documentNode.createElement("section");
    documentNode.body.appendChild(scope);

    const selectNode = documentNode.createElement("select");
    selectNode.id = "keyboard-detail-select";
    selectNode.setAttribute("data-options-custom-select", "true");
    appendOption(selectNode, "react", "React");
    appendOption(selectNode, "next", "Next.js");
    appendOption(selectNode, "astro", "Astro");
    selectNode.value = "react";
    scope.appendChild(selectNode);

    api.syncCustomSelects(scope);

    const wrapper = scope.querySelector(".options-custom-select");
    const trigger = scope.querySelector(".options-select-trigger");
    assert.ok(wrapper);
    assert.ok(trigger);

    trigger.dispatchEvent(new FakeEvent("keydown", { key: "ArrowDown" }));
    assert.equal(wrapper.getAttribute("data-open"), "true");
    assert.equal(wrapper.getAttribute("data-highlight-index"), "0");

    trigger.dispatchEvent(new FakeEvent("keydown", { key: "ArrowDown" }));
    assert.equal(wrapper.getAttribute("data-highlight-index"), "1");

    trigger.dispatchEvent(new FakeEvent("keydown", { key: "Enter" }));
    assert.equal(selectNode.value, "next");
    assert.equal(wrapper.getAttribute("data-open"), "");

    trigger.dispatchEvent(new FakeEvent("keydown", { key: " " }));
    assert.equal(wrapper.getAttribute("data-open"), "true");

    trigger.dispatchEvent(new FakeEvent("keydown", { key: "Escape" }));
    assert.equal(wrapper.getAttribute("data-open"), "");
  });
});

test("shared select closes on outside click, window resize, and window scroll", function () {
  withFakeDom(function ({ api, documentNode, windowNode }) {
    const layer = documentNode.createElement("div");
    layer.id = "detail-select-layer";
    documentNode.body.appendChild(layer);

    const scope = documentNode.createElement("section");
    documentNode.body.appendChild(scope);

    const selectNode = documentNode.createElement("select");
    selectNode.id = "close-detail-select";
    selectNode.setAttribute("data-options-custom-select", "true");
    appendOption(selectNode, "react", "React");
    appendOption(selectNode, "next", "Next.js");
    selectNode.value = "react";
    scope.appendChild(selectNode);

    const outside = documentNode.createElement("div");
    outside.id = "outside-target";
    documentNode.body.appendChild(outside);

    api.syncCustomSelects(scope);

    const wrapper = scope.querySelector(".options-custom-select");
    const trigger = scope.querySelector(".options-select-trigger");
    trigger.dispatchEvent(new FakeEvent("click"));
    assert.equal(wrapper.getAttribute("data-open"), "true");

    outside.dispatchEvent(new FakeEvent("click"));
    documentNode.dispatchEvent(new FakeEvent("click"));
    assert.equal(wrapper.getAttribute("data-open"), "");

    trigger.dispatchEvent(new FakeEvent("click"));
    assert.equal(wrapper.getAttribute("data-open"), "true");
    windowNode.dispatchEvent(new FakeEvent("resize"));
    assert.equal(wrapper.getAttribute("data-open"), "");

    trigger.dispatchEvent(new FakeEvent("click"));
    assert.equal(wrapper.getAttribute("data-open"), "true");
    windowNode.dispatchEvent(new FakeEvent("scroll"));
    assert.equal(wrapper.getAttribute("data-open"), "");
  });
});

test("shared select keeps menu open while the menu scrolls and closes on scroll-container scroll", function () {
  withFakeDom(function ({ api, documentNode }) {
    const layer = documentNode.createElement("div");
    layer.id = "detail-select-layer";
    documentNode.body.appendChild(layer);

    const scrollContainer = documentNode.createElement("div");
    scrollContainer.style.overflowY = "auto";
    scrollContainer.clientHeight = 120;
    scrollContainer.scrollHeight = 360;
    documentNode.body.appendChild(scrollContainer);

    const scope = documentNode.createElement("section");
    scrollContainer.appendChild(scope);

    const selectNode = documentNode.createElement("select");
    selectNode.id = "scroll-detail-select";
    selectNode.setAttribute("data-options-custom-select", "true");
    for (let index = 1; index <= 8; index += 1) {
      appendOption(selectNode, String(index), String(index));
    }
    selectNode.value = "2";
    scope.appendChild(selectNode);

    api.syncCustomSelects(scope);

    const wrapper = scope.querySelector(".options-custom-select");
    const trigger = scope.querySelector(".options-select-trigger");
    assert.ok(wrapper);
    assert.ok(trigger);

    trigger.dispatchEvent(new FakeEvent("click"));
    assert.equal(wrapper.getAttribute("data-open"), "true");

    const menu = documentNode.querySelector("#detail-select-menu");
    assert.ok(menu);

    menu.dispatchEvent(new FakeEvent("scroll"));
    assert.equal(wrapper.getAttribute("data-open"), "true");

    scrollContainer.dispatchEvent(new FakeEvent("scroll"));
    assert.equal(wrapper.getAttribute("data-open"), "");
  });
});

test("detail-page source wires shared custom-selects and leaves admin/download selects native", function () {
  const html = fs.readFileSync(htmlPath, "utf8");
  const script = fs.readFileSync(jsPath, "utf8");

  assert.match(html, /<script src="\.\/options-shared-select\.js"><\/script>/);
  assert.match(html, /id="detail-select-layer"/);
  assert.match(html, /<select id="transcription-rate-step"[^>]*data-options-custom-select="true"/);
  assert.match(html, /<select id="transcription-seek-step"[^>]*data-options-custom-select="true"/);
  assert.match(html, /<select id="judgement-rate-step"[^>]*data-options-custom-select="true"/);
  assert.match(html, /<select id="judgement-seek-step"[^>]*data-options-custom-select="true"/);
  assert.match(html, /<select id="judgement-items-per-page"[^>]*data-options-custom-select="true"/);
  assert.match(html, /<select id="data-baker-default-page-size"[^>]*data-options-custom-select="true"/);
  assert.match(
    html,
    /<select id="data-baker-cvpc-segment-silence-threshold-unit"[^>]*data-options-custom-select="true"/
  );
  assert.match(html, /<select\s+id="bytedance-aidp-default-playback-rate"[\s\S]*data-options-custom-select="true"/);
  assert.match(html, /<select\s+id="bytedance-aidp-fixed-wave-zoom"[\s\S]*data-options-custom-select="true"/);
  assert.match(html, /<select id="abaka-ai-analysis-mode"[^>]*data-options-custom-select="true"/);
  assert.match(html, /<select id="abaka-ai-vision-model"[^>]*data-options-custom-select="true"/);
  assert.match(html, /<select id="abaka-ai-ocr-model"[^>]*data-options-custom-select="true"/);
  assert.match(html, /<select id="abaka-ai-reasoning-model"[^>]*data-options-custom-select="true"/);
  assert.match(html, /<select id="abaka-ai-single-model"[^>]*data-options-custom-select="true"/);
  assert.doesNotMatch(html, /<select id="project-download-dataset"[^>]*data-options-custom-select="true"/);
  assert.doesNotMatch(html, /<select id="project-download-supplier"[^>]*data-options-custom-select="true"/);
  assert.doesNotMatch(html, /<select id="ai-call-log-dataset"[^>]*data-options-custom-select="true"/);
  assert.doesNotMatch(html, /<select id="public-release-version-select"[^>]*data-options-custom-select="true"/);
  assert.match(script, /data-options-custom-select="true"/);
  assert.match(script, /data-options-placeholder="请选择听音模型"/);
  assert.match(script, /data-options-placeholder="请选择收口模型"/);
  assert.match(html, /data-options-placeholder="请选择默认播放倍数"/);
  assert.match(html, /data-options-placeholder="请选择固定缩放倍数"/);
});

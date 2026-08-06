"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const modulePath = path.resolve(__dirname, "ui-panel.js");

function loadApi() {
  if (!fs.existsSync(modulePath)) {
    return {};
  }
  const context = { globalThis: {}, console };
  context.globalThis.globalThis = context.globalThis;
  vm.runInNewContext(fs.readFileSync(modulePath, "utf8"), context, { filename: modulePath });
  return context.globalThis.ASREdgePulseUiPanel || {};
}

test("中文翻译锚点只接受精确标签并定位包含 textarea 的父组", function () {
  const api = loadApi();
  assert.equal(typeof api.findTranslationGroup, "function");
  const textarea = { value: "原始文本" };
  const group = { querySelector: (selector) => (selector === "textarea" ? textarea : null) };
  const header = { parentElement: group };
  const label = { textContent: "中文翻译", parentElement: header };
  const root = {
    querySelectorAll: () => [{ textContent: "英文翻译", parentElement: header }, label],
  };

  assert.equal(api.findTranslationGroup(root), group);
});

test("核查横条完全保留原文，仅把命中区间标记为红色片段", function () {
  const api = loadApi();
  assert.equal(typeof api.createHighlightParts, "function");
  const text = "右手拿起A罐";
  const parts = api.createHighlightParts(text, [
    { start: 1, end: 2, term: "手" },
    { start: 4, end: 5, term: "A" },
  ]);

  assert.equal(parts.map((part) => part.text).join(""), text);
  assert.deepEqual(
    JSON.parse(JSON.stringify(parts.filter((part) => part.type === "match").map((part) => part.text))),
    ["手", "A"]
  );
  assert.deepEqual(JSON.parse(JSON.stringify(api.createHighlightParts(text, []))), [
    { type: "text", text },
  ]);
});

function createTaskTemplateButton(label) {
  let clicks = 0;
  return {
    textContent: label,
    querySelector: function (selector) {
      return selector === "span.anticon-file-text" ? {} : null;
    },
    click: function () {
      clicks += 1;
    },
    get clickCount() {
      return clicks;
    },
  };
}

function createAnnotationStepsSection(title, steps) {
  const heading = { textContent: title };
  const items = (steps || []).map(function (text) {
    return { textContent: text };
  });
  return {
    querySelectorAll: function (selector) {
      if (selector === "div") {
        return [heading];
      }
      if (selector === "ol > li") {
        return items;
      }
      return [];
    },
  };
}

function createTaskTemplateRoot(buttons, sections) {
  return {
    querySelectorAll: function (selector) {
      if (selector === "button") {
        return buttons || [];
      }
      if (selector === "section") {
        return sections || [];
      }
      return [];
    },
  };
}

test("任务模板按钮与标注步骤区块只按稳定图标和精确标题定位", function () {
  const api = loadApi();
  assert.equal(typeof api.findTaskTemplateButton, "function");
  assert.equal(typeof api.findAnnotationStepsSection, "function");
  const templateButton = createTaskTemplateButton("highlight text with marker");
  const ignoredButton = { textContent: "其他按钮", querySelector: () => null };
  const ignoredSection = createAnnotationStepsSection("补充说明", ["不应读取"]);
  const stepsSection = createAnnotationStepsSection("标注步骤", ["第一步", "第二步"]);
  const root = createTaskTemplateRoot([ignoredButton, templateButton], [ignoredSection, stepsSection]);

  assert.equal(api.findTaskTemplateButton(root), templateButton);
  assert.equal(api.findAnnotationStepsSection(root), stepsSection);
});

test("标注步骤按原顺序提取纯文本并跳过空项", function () {
  const api = loadApi();
  assert.equal(typeof api.extractAnnotationSteps, "function");
  const section = createAnnotationStepsSection("标注步骤", [" 第一条 ", "", "第二条"]);

  assert.deepEqual(JSON.parse(JSON.stringify(api.extractAnnotationSteps(section))), ["第一条", "第二条"]);
});

test("规则加载器打开自身关闭的模板后会恢复关闭状态", async function () {
  const api = loadApi();
  assert.equal(typeof api.loadAnnotationSteps, "function");
  const templateButton = createTaskTemplateButton("highlight text with marker");
  const root = createTaskTemplateRoot([templateButton], []);
  const section = createAnnotationStepsSection("标注步骤", ["第一步", "第二步"]);

  const result = await api.loadAnnotationSteps(root, {
    waitForSection: async function () {
      return section;
    },
  });

  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    status: "ready",
    steps: ["第一步", "第二步"],
    openedByAssistant: true,
  });
  assert.equal(templateButton.clickCount, 2);
});

test("规则加载器读取原本已打开的模板时不会改变原生面板状态", async function () {
  const api = loadApi();
  const templateButton = createTaskTemplateButton("highlight text with marker");
  const section = createAnnotationStepsSection("标注步骤", ["当前规则"]);
  const root = createTaskTemplateRoot([templateButton], [section]);

  const result = await api.loadAnnotationSteps(root);

  assert.equal(result.status, "ready");
  assert.deepEqual(JSON.parse(JSON.stringify(result.steps)), ["当前规则"]);
  assert.equal(result.openedByAssistant, false);
  assert.equal(templateButton.clickCount, 0);
});

test("模板或有效步骤缺失时返回可重试的失败状态", async function () {
  const api = loadApi();
  const noButton = await api.loadAnnotationSteps(createTaskTemplateRoot([], []));
  assert.equal(noButton.status, "missing_template_button");

  const templateButton = createTaskTemplateButton("highlight text with marker");
  const noSteps = await api.loadAnnotationSteps(createTaskTemplateRoot([templateButton], []), {
    waitForSection: async function () {
      return null;
    },
  });
  assert.equal(noSteps.status, "missing_annotation_steps");
  assert.equal(templateButton.clickCount, 2);
});

test("任务标识由路由与模板名称组成，变化后用于清空旧规则", function () {
  const api = loadApi();
  assert.equal(typeof api.createTaskContextKey, "function");
  const firstButton = createTaskTemplateButton("模板一");
  const secondButton = createTaskTemplateButton("模板二");
  const route = { pathname: "/annotation/my/corrector/ego-annotation-gui/ep_first" };

  const first = api.createTaskContextKey(route, firstButton);
  assert.equal(first, "/annotation/my/corrector/ego-annotation-gui/ep_first|模板一");
  assert.notEqual(first, api.createTaskContextKey(route, secondButton));
  assert.notEqual(first, api.createTaskContextKey({ pathname: "/annotation/my/corrector/ego-annotation-gui/ep_second" }, firstButton));
});

test("React 重绘后已有面板不会重复挂载，规则不再使用固定文案", function () {
  const api = loadApi();
  assert.equal(typeof api.hasMountedPanel, "function");
  assert.equal(api.hasMountedPanel({ querySelector: () => ({}) }), true);
  assert.equal(api.hasMountedPanel({ querySelector: () => null }), false);
  assert.equal(api.RULE_TEXT, undefined);
});

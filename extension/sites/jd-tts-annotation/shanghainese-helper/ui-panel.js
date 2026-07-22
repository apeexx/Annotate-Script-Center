(function () {
  "use strict";

  const BUTTON_TEXT = "上海话识别";
  const RUNNING_TEXT = "识别中";

  function normalizeText(value) { return String(value || ""); }

  function createRuntime(options) {
    const config = options && typeof options === "object" ? options : {};
    const documentRef = config.document || globalThis.document;
    const TextareaCtor = config.HTMLTextAreaElement || globalThis.HTMLTextAreaElement;
    const InputEventCtor = config.InputEvent || globalThis.InputEvent;
    let button = null;
    let targetTextarea = null;
    let onRecommend = typeof config.onRecommend === "function" ? config.onRecommend : null;

    function findTextField() {
      const labelSpan = Array.from(documentRef?.querySelectorAll("span") || []).find(function (span) {
        return normalizeText(span.textContent).trim() === "文本:";
      });
      if (!labelSpan) { return null; }
      const field = labelSpan.nextElementSibling.querySelector("textarea.el-textarea__inner");
      return field || null;
    }

    function setBusy(busy) {
      if (!button) { return; }
      button.disabled = busy === true;
      button.textContent = busy === true ? RUNNING_TEXT : BUTTON_TEXT;
    }

    function setStatus(message) {
      if (button) { button.title = normalizeText(message).slice(0, 120); }
    }

    function ensureMounted() {
      targetTextarea = findTextField();
      if (!targetTextarea || button) { return !!targetTextarea; }
      button = documentRef.createElement("button");
      button.type = "button";
      button.textContent = BUTTON_TEXT;
      button.className = "asc-jd-tts-shanghai-recommend";
      button.addEventListener("click", function () {
        if (button.disabled || typeof onRecommend !== "function") { return; }
        Promise.resolve(onRecommend()).catch(function (error) { setStatus(error?.message || "识别失败。"); });
      });
      targetTextarea.parentElement?.insertAdjacentElement?.("afterend", button);
      if (!button.parentElement) { targetTextarea.insertAdjacentElement?.("afterend", button); }
      return true;
    }

    function fillRecommendedText(result, isCurrent) {
      const listenText = typeof result?.listenText === "string" ? result.listenText : "";
      if (!listenText || !targetTextarea || targetTextarea.disabled === true || targetTextarea.readOnly === true || typeof isCurrent !== "function" || isCurrent() !== true) {
        return false;
      }
      const setter = Object.getOwnPropertyDescriptor(TextareaCtor?.prototype || {}, "value")?.set;
      if (typeof setter !== "function" || typeof InputEventCtor !== "function") { return false; }
      setter.call(targetTextarea, listenText);
      targetTextarea.dispatchEvent(new InputEventCtor("input", { bubbles: true, inputType: "insertText", data: listenText }));
      return true;
    }

    function remove() { button?.remove?.(); button = null; targetTextarea = null; }
    function setOnRecommend(handler) { onRecommend = typeof handler === "function" ? handler : null; }
    return { ensureMounted, setBusy, setStatus, fillRecommendedText, remove, setOnRecommend };
  }

  const api = { createRuntime };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; }
  globalThis.ASREdgeJdTtsShanghaiUiPanel = api;
})();

(function () {
  "use strict";

  const BUTTON_TEXT = "上海话识别";
  const RUNNING_TEXT = "识别中…";

  function normalizeText(value) { return String(value || ""); }

  function createRuntime(options) {
    const config = options && typeof options === "object" ? options : {};
    const documentRef = config.document || globalThis.document;
    const TextareaCtor = config.HTMLTextAreaElement || globalThis.HTMLTextAreaElement;
    const InputEventCtor = config.InputEvent || globalThis.InputEvent;
    let button = null;
    let mountedAfterNativeAutoAnnotate = false;
    let targetTextarea = null;
    let onRecommend = typeof config.onRecommend === "function" ? config.onRecommend : null;

    function findTextField() {
      const label = documentRef?.querySelector?.("div.cell > span:first-child");
      if (!label || normalizeText(label.textContent).trim() !== "文本:") { return null; }
      const container = label.nextElementSibling;
      const textarea = container?.querySelector?.("textarea.el-textarea__inner");
      return textarea ? { container, textarea } : null;
    }

    function findToolbarAutoAnnotateButton() {
      const buttons = Array.from(documentRef?.querySelectorAll?.("button") || []);
      return buttons.find(function (candidate) {
        return normalizeText(candidate?.textContent).trim() === "自动标注";
      }) || null;
    }

    function mountButton(nextButton, field) {
      const nativeAutoAnnotate = findToolbarAutoAnnotateButton();
      if (nativeAutoAnnotate?.insertAdjacentElement) {
        nativeAutoAnnotate.insertAdjacentElement("afterend", nextButton);
        return true;
      }
      if (!nextButton.parentElement) {
        field.container?.insertAdjacentElement?.("afterend", nextButton);
      }
      return false;
    }

    function isMountedImmediatelyAfter(nativeAutoAnnotate) {
      return (nativeAutoAnnotate?.nextElementSibling || nativeAutoAnnotate?.nextSibling) === button;
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
      const field = findTextField();
      if (!field) { return false; }
      if (button && (button.isConnected === false || targetTextarea !== field.textarea)) {
        button.remove?.();
        button = null;
        mountedAfterNativeAutoAnnotate = false;
      }
      targetTextarea = field.textarea;
      const nativeAutoAnnotate = findToolbarAutoAnnotateButton();
      if (button && nativeAutoAnnotate && (!mountedAfterNativeAutoAnnotate || !isMountedImmediatelyAfter(nativeAutoAnnotate))) {
        button.remove?.();
        button = null;
        mountedAfterNativeAutoAnnotate = false;
      }
      if (button) { return true; }
      button = documentRef.createElement("button");
      button.type = "button";
      button.textContent = BUTTON_TEXT;
      button.className = "asc-jd-tts-shanghai-recommend";
      button.title = "扩展功能：识别当前音频并仅填入文本";
      if (button.style) {
        button.style.marginLeft = "8px";
        button.style.padding = "6px 12px";
        button.style.border = "1px solid #6d28d9";
        button.style.borderRadius = "4px";
        button.style.background = "#7c3aed";
        button.style.color = "#ffffff";
        button.style.cursor = "pointer";
      }
      button.addEventListener("click", function () {
        if (button.disabled || typeof onRecommend !== "function") { return; }
        Promise.resolve(onRecommend()).catch(function (error) { setStatus(error?.message || "识别失败。"); });
      });
      mountedAfterNativeAutoAnnotate = mountButton(button, field);
      return true;
    }

    function getMountTarget() {
      if (button?.isConnected !== false && button?.parentElement) { return button.parentElement; }
      return findTextField()?.container || null;
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

    function remove() { button?.remove?.(); button = null; mountedAfterNativeAutoAnnotate = false; targetTextarea = null; }
    function setOnRecommend(handler) { onRecommend = typeof handler === "function" ? handler : null; }
    return { ensureMounted, getMountTarget, setBusy, setStatus, fillRecommendedText, remove, setOnRecommend };
  }

  const api = { createRuntime };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; }
  globalThis.ASREdgeJdTtsShanghaiUiPanel = api;
})();

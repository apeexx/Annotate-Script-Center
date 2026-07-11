"use strict";

(function initOptionsSharedShortcutPanel(globalObject) {
  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getShortcutText(actionKey, options) {
    const config = options && typeof options === "object" ? options : {};
    if (config.recordingKey && String(config.recordingKey) === String(actionKey)) {
      return "录制中...";
    }
    const formatter =
      typeof config.formatShortcut === "function"
        ? config.formatShortcut
        : function (value) {
            return String(value || "未设置");
          };
    const values = config.values && typeof config.values === "object" ? config.values : {};
    return formatter(values[actionKey]);
  }

  function buildRecordableRow(action, options) {
    const config = options && typeof options === "object" ? options : {};
    const recordAttrName = String(config.recordAttrName || "data-record-shortcut").trim();
    const clearAttrName = String(config.clearAttrName || "data-clear-shortcut").trim();
    const actionKey = String(action?.key || "");
    const actionLabel = String(action?.label || actionKey);
    const isRecording = String(config.recordingKey || "") === actionKey;

    return [
      '<div class="shortcut-row">',
      '<span class="shortcut-label">' + escapeHtml(actionLabel) + "</span>",
      '<span class="shortcut-value">' + escapeHtml(getShortcutText(actionKey, config)) + "</span>",
      '<button type="button" class="secondary-button" ' +
        recordAttrName +
        '="' +
        escapeHtml(actionKey) +
        '">' +
        (isRecording ? "录制中" : "录制") +
        "</button>",
      '<button type="button" class="ghost-button" ' +
        clearAttrName +
        '="' +
        escapeHtml(actionKey) +
        '">删除</button>',
      "</div>",
    ].join("");
  }

  function buildReadonlyRow(action, options) {
    const config = options && typeof options === "object" ? options : {};
    const actionKey = String(action?.key || "");
    const actionLabel = String(action?.label || actionKey);

    return [
      '<div class="shortcut-row shortcut-row-readonly">',
      '<span class="shortcut-label">' + escapeHtml(actionLabel) + "</span>",
      '<span class="shortcut-value">' + escapeHtml(getShortcutText(actionKey, config)) + "</span>",
      "</div>",
    ].join("");
  }

  function buildShortcutGridMarkup(options) {
    const config = options && typeof options === "object" ? options : {};
    const actions = Array.isArray(config.actions) ? config.actions : [];
    const mode = String(config.mode || "recordable").trim().toLowerCase() === "readonly"
      ? "readonly"
      : "recordable";

    return actions
      .map(function (action) {
        return mode === "readonly"
          ? buildReadonlyRow(action, config)
          : buildRecordableRow(action, config);
      })
      .join("");
  }

  function renderShortcutGrid(container, options) {
    const markup = buildShortcutGridMarkup(options);
    if (container && typeof container === "object" && "innerHTML" in container) {
      container.innerHTML = markup;
    }
    return markup;
  }

  const api = {
    buildShortcutGridMarkup,
    renderShortcutGrid,
  };

  globalObject.ASREdgeOptionsSharedShortcutPanel = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);

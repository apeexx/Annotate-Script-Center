(function () {
  const LEGACY_STORAGE_KEY = "scriptCenter.magicDataAnnotator.shortcuts";
  const ACTION_DEFINITIONS = [
    { key: "reviewCurrent", label: "AI 质检当前条" },
    { key: "fillAllAiSuggestions", label: "全部填入AI推荐" },
    { key: "copySummary", label: "复制 AI 质检摘要" },
    { key: "showRawAiOutput", label: "显示 AI 原始输出" },
    { key: "toggleSpeakerDetail", label: "展开/收起说话人属性详情" },
    { key: "toggleDialectDetail", label: "展开/收起方言内容详情" },
    { key: "toggleMandarinDetail", label: "展开/收起普通话文本详情" },
    { key: "refreshCollection", label: "刷新采集" },
    { key: "resetPanelHeight", label: "重置高度" },
    { key: "save", label: "保存" },
    { key: "submit", label: "提交" },
    { key: "genderMale", label: "性别男" },
    { key: "genderFemale", label: "性别女" },
    { key: "age0To5", label: "年龄0-5" },
    { key: "age6To12", label: "年龄6-12" },
    { key: "age13To18", label: "年龄13-18" },
    { key: "age19To25", label: "年龄19-25" },
    { key: "age26To36", label: "年龄26-36" },
    { key: "age37To50", label: "年龄37-50" },
    { key: "age51To65", label: "年龄51-65" },
    { key: "age65Plus", label: "年龄65以上" },
  ];

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function normalizeKey(key) {
    const text = String(key || "");
    if (text === " ") {
      return "Space";
    }
    if (text.length === 1) {
      return text.toLowerCase();
    }
    return text;
  }

  function normalizeShortcut(shortcut) {
    if (!shortcut || typeof shortcut !== "object") {
      return null;
    }
    const hasKey = typeof shortcut.key === "string" && shortcut.key.trim().length > 0;
    const hasButton = typeof shortcut.button === "number";
    if (!hasKey && !hasButton) {
      return null;
    }
    return {
      ctrl: shortcut.ctrl === true,
      alt: shortcut.alt === true,
      shift: shortcut.shift === true,
      meta: shortcut.meta === true,
      key: hasKey ? normalizeKey(shortcut.key) : null,
      button: hasButton ? shortcut.button : null,
    };
  }

  function shortcutToDisplayText(shortcut) {
    const value = normalizeShortcut(shortcut);
    if (!value) {
      return "未设置";
    }
    const parts = [];
    if (value.ctrl) {
      parts.push("Ctrl");
    }
    if (value.alt) {
      parts.push("Alt");
    }
    if (value.shift) {
      parts.push("Shift");
    }
    if (value.meta) {
      parts.push("Meta");
    }
    const key = value.key || (typeof value.button === "number" ? "Mouse" + value.button : "");
    if (key) {
      parts.push(key === " " ? "Space" : key);
    }
    return parts.length > 0 ? parts.join(" + ") : "未设置";
  }

  function eventToShortcut(event) {
    if (!event || typeof event !== "object") {
      return null;
    }
    const key = normalizeKey(event.key || "");
    if (!key || key === "Control" || key === "Alt" || key === "Shift" || key === "Meta") {
      return null;
    }
    return {
      ctrl: event.ctrlKey === true,
      alt: event.altKey === true,
      shift: event.shiftKey === true,
      meta: event.metaKey === true,
      key: key,
      button: null,
    };
  }

  function isEditableTarget(target) {
    if (!(target instanceof Element)) {
      return false;
    }
    const tagName = String(target.tagName || "").toLowerCase();
    if (tagName === "input" || tagName === "textarea" || tagName === "select") {
      return true;
    }
    if (target.isContentEditable) {
      return true;
    }
    return Boolean(target.closest("[contenteditable='true'], [contenteditable='']"));
  }

  function shortcutMatchesEvent(shortcut, event) {
    const value = normalizeShortcut(shortcut);
    if (!value || value.button !== null || !value.key) {
      return false;
    }
    return (
      value.ctrl === (event.ctrlKey === true) &&
      value.alt === (event.altKey === true) &&
      value.shift === (event.shiftKey === true) &&
      value.meta === (event.metaKey === true) &&
      value.key === normalizeKey(event.key || "")
    );
  }

  function createEmptyShortcutMap() {
    const map = {};
    ACTION_DEFINITIONS.forEach(function (item) {
      map[item.key] = null;
    });
    return map;
  }

  function normalizeShortcutMap(input) {
    const source = input && typeof input === "object" ? input : {};
    const map = createEmptyShortcutMap();
    ACTION_DEFINITIONS.forEach(function (item) {
      map[item.key] = normalizeShortcut(source[item.key]);
    });
    return map;
  }

  async function loadShortcutMapFromSettings() {
    const storage = globalThis.ASREdgeStorage || {};
    if (typeof storage.getSettings !== "function") {
      return {
        map: createEmptyShortcutMap(),
        persisted: false,
      };
    }
    try {
      const settings = await storage.getSettings();
      const projectSettings = settings?.scriptCenter?.projects?.magicDataAnnotator || {};
      return {
        map: normalizeShortcutMap(projectSettings.shortcuts),
        persisted: true,
      };
    } catch (error) {
      return {
        map: createEmptyShortcutMap(),
        persisted: false,
      };
    }
  }

  function loadShortcutMapFromLegacyStorage() {
    return new Promise(function (resolve) {
      if (!chrome?.storage?.local) {
        resolve({
          map: createEmptyShortcutMap(),
          persisted: false,
        });
        return;
      }
      chrome.storage.local.get([LEGACY_STORAGE_KEY], function (result) {
        if (chrome.runtime?.lastError) {
          resolve({
            map: createEmptyShortcutMap(),
            persisted: false,
          });
          return;
        }
        resolve({
          map: normalizeShortcutMap(result?.[LEGACY_STORAGE_KEY]),
          persisted: true,
        });
      });
    });
  }

  async function loadShortcutMap() {
    const fromSettings = await loadShortcutMapFromSettings();
    const hasAnySetting = Object.values(fromSettings.map || {}).some(Boolean);
    if (hasAnySetting || fromSettings.persisted) {
      return fromSettings;
    }
    return loadShortcutMapFromLegacyStorage();
  }

  async function saveShortcutMapToSettings(shortcutMap) {
    const storage = globalThis.ASREdgeStorage || {};
    if (typeof storage.patchSettings !== "function") {
      return false;
    }
    try {
      await storage.patchSettings({
        scriptCenter: {
          projects: {
            magicDataAnnotator: {
              shortcuts: normalizeShortcutMap(shortcutMap),
            },
          },
        },
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  function saveShortcutMapToLegacyStorage(shortcutMap) {
    return new Promise(function (resolve) {
      if (!chrome?.storage?.local) {
        resolve(false);
        return;
      }
      const payload = {};
      payload[LEGACY_STORAGE_KEY] = normalizeShortcutMap(shortcutMap);
      chrome.storage.local.set(payload, function () {
        resolve(!chrome.runtime?.lastError);
      });
    });
  }

  async function saveShortcutMap(shortcutMap) {
    const ok = await saveShortcutMapToSettings(shortcutMap);
    if (ok) {
      return true;
    }
    return saveShortcutMapToLegacyStorage(shortcutMap);
  }

  function createRuntime(options) {
    const config = options && typeof options === "object" ? options : {};
    let shortcuts = createEmptyShortcutMap();
    let actions = config.actions && typeof config.actions === "object" ? config.actions : {};
    let started = false;
    let persisted = true;
    const changeSubscribers = [];

    function emitChange() {
      const snapshot = {
        shortcuts: clone(shortcuts),
        persisted: persisted,
      };
      changeSubscribers.forEach(function (subscriber) {
        try {
          subscriber(snapshot);
        } catch (error) {
          // keep runtime stable
        }
      });
    }

    async function load() {
      const loaded = await loadShortcutMap();
      shortcuts = normalizeShortcutMap(loaded.map);
      persisted = loaded.persisted;
      emitChange();
      return {
        persisted: persisted,
      };
    }

    function setActions(nextActions) {
      actions = nextActions && typeof nextActions === "object" ? nextActions : {};
    }

    function getShortcutMap() {
      return clone(shortcuts);
    }

    function getActionDefinitions() {
      return clone(ACTION_DEFINITIONS);
    }

    function findMatchedAction(event) {
      return ACTION_DEFINITIONS.find(function (item) {
        return shortcutMatchesEvent(shortcuts[item.key], event);
      });
    }

    function runAction(actionKey) {
      if (typeof actions[actionKey] === "function") {
        return actions[actionKey]();
      }
      if (typeof actions.onMissingAction === "function") {
        return actions.onMissingAction(actionKey);
      }
      return null;
    }

    function handleKeydown(event) {
      if (isEditableTarget(event.target)) {
        return;
      }
      const matchedAction = findMatchedAction(event);
      if (!matchedAction) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
      }
      runAction(matchedAction.key);
    }

    async function setShortcut(actionKey, shortcut) {
      if (!ACTION_DEFINITIONS.some(function (item) { return item.key === actionKey; })) {
        return {
          ok: false,
          persisted: persisted,
          message: "未知快捷键动作：" + actionKey,
        };
      }
      shortcuts[actionKey] = normalizeShortcut(shortcut);
      const saveOk = await saveShortcutMap(shortcuts);
      if (!saveOk) {
        persisted = false;
      }
      emitChange();
      return {
        ok: true,
        persisted: saveOk,
      };
    }

    async function clearAllShortcuts() {
      shortcuts = createEmptyShortcutMap();
      const saveOk = await saveShortcutMap(shortcuts);
      if (!saveOk) {
        persisted = false;
      }
      emitChange();
      return {
        ok: true,
        persisted: saveOk,
      };
    }

    function subscribe(fn) {
      if (typeof fn !== "function") {
        return function () {};
      }
      changeSubscribers.push(fn);
      return function () {
        const index = changeSubscribers.indexOf(fn);
        if (index >= 0) {
          changeSubscribers.splice(index, 1);
        }
      };
    }

    async function start() {
      if (started) {
        return;
      }
      started = true;
      await load();
      window.addEventListener("keydown", handleKeydown, true);
      document.addEventListener("keydown", handleKeydown, true);
    }

    function stop() {
      if (!started) {
        return;
      }
      started = false;
      window.removeEventListener("keydown", handleKeydown, true);
      document.removeEventListener("keydown", handleKeydown, true);
    }

    return {
      clearAllShortcuts: clearAllShortcuts,
      getActionDefinitions: getActionDefinitions,
      getShortcutMap: getShortcutMap,
      isPersisted: function () {
        return persisted;
      },
      setActions: setActions,
      setShortcut: setShortcut,
      shortcutToDisplayText: shortcutToDisplayText,
      start: start,
      stop: stop,
      subscribe: subscribe,
      eventToShortcut: eventToShortcut,
    };
  }

  globalThis.__ASREdgeMagicDataAnnotatorShortcuts = {
    ACTION_DEFINITIONS: clone(ACTION_DEFINITIONS),
    createRuntime: createRuntime,
    eventToShortcut: eventToShortcut,
    normalizeShortcut: normalizeShortcut,
    shortcutToDisplayText: shortcutToDisplayText,
  };
})();
